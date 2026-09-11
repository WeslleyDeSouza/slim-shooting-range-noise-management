import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import type {
  SimulationReceiverDto,
  SimulationResultReceiverDto,
  SimulationRowDto,
} from '@ui-slim/apiClient';
import { SimulationFacade } from '../../../../core/calculation/simulation.facade';

type ShotKey = 'inside' | 'outside';
type LightState = SimulationReceiverDto['currentState'];

/** Quick scale buttons of the mock (−20 % … +50 %). */
const SCALE_FACTORS = [0.8, 0.9, 1.1, 1.2, 1.5] as const;

const BADGE: Record<LightState, string> = {
  ok: 'slim-badge--success',
  warn: 'slim-badge--warning',
  over: 'slim-badge--danger',
  none: '',
};

/**
 * «Schiessplatz – Simulation» (B1 5.13, mock `_mocks/area/simulation.index.html`):
 * the year's military shot counts per Stellungsraum × Waffe are the Ist; the
 * user overwrites them, runs the Annex 9 calculation on the API and compares
 * the Beurteilungspegel per Empfangspunkt on the map and in the result
 * table. A sandbox — nothing is written. Data: SimulationFacade.
 */
@Component({
  selector: 'app-area-simulation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  styleUrl: './area-simulation.component.scss',
  templateUrl: './area-simulation.component.html',
})
export class AreaSimulationComponent extends ComponentBase {
  private readonly facade = inject(SimulationFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly numberFormat = new Intl.NumberFormat('de-CH');
  private readonly dbFormat = new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  /** Set once getData() ran; before that the effect must not load (init is getData's job). */
  private ready = false;

  /** The area id lives on the parent route (`/admin/area/:id/simulation`). */
  readonly areaId = toSignal(
    (this.route.parent ?? this.route).paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: (this.route.parent ?? this.route).snapshot.paramMap.get('id') ?? '' },
  );

  protected readonly currentYear = new Date().getFullYear();
  protected readonly years = [this.currentYear, this.currentYear - 1, this.currentYear - 2];
  protected readonly year = signal(this.currentYear);
  protected readonly editing = signal(false);
  protected readonly activePin = signal<string | null>(null);
  protected readonly scaleFactors = SCALE_FACTORS;

  protected readonly base = this.facade.base;
  protected readonly rows = this.facade.rows;
  protected readonly receivers = this.facade.receivers;
  protected readonly values = this.facade.values;
  protected readonly result = this.facade.result;
  protected readonly changedCount = this.facade.changedCount;
  protected readonly dirty = this.facade.dirty;
  protected readonly stale = this.facade.stale;
  protected readonly totals = this.facade.totals;
  protected readonly loading = this.facade.loading;
  protected readonly running = this.facade.running;
  protected readonly error = this.facade.error;

  protected readonly calculation = computed(() => this.base()?.calculation ?? null);
  /** A fresh result: computed with the values as they are now. */
  protected readonly showSim = computed(() => !!this.result() && !this.stale());
  protected readonly resultById = computed(() => {
    const byId: Record<string, SimulationResultReceiverDto> = {};
    for (const r of this.result()?.receivers ?? []) byId[r.id] = r;
    return byId;
  });
  protected readonly overCount = computed(() =>
    this.showSim() ? (this.result()?.counts.over ?? 0) : 0,
  );
  /** Total change in percent versus the Ist, for the action bar. */
  protected readonly totalPercent = computed(() => {
    const t = this.totals();
    const base = t.baseInside + t.baseOutside;
    return base ? Math.round(((t.inside + t.outside - base) / base) * 100) : 0;
  });
  protected readonly stateKey = computed(() => {
    if (!this.dirty()) return 'simulation.state.current';
    if (!this.result()) return 'simulation.state.not_run';
    return this.stale() ? 'simulation.state.stale' : 'simulation.state.fresh';
  });
  protected readonly activeReceiver = computed(() => {
    const id = this.activePin();
    return id ? (this.receivers().find((r) => r.id === id) ?? null) : null;
  });

  constructor() {
    super();
    // Area or year changed → reload (the initial load is getData's job).
    effect(() => {
      const areaId = this.areaId();
      const year = this.year();
      if (!this.ready || !areaId) return;
      untracked(() => void this.facade.load(areaId, year));
    });
  }

  /** ComponentBase calls this on init and on every DATA_RELOAD emit. */
  override getData(): void {
    this.ready = true;
    const areaId = this.areaId();
    if (areaId) void this.facade.load(areaId, this.year());
  }

  // ----- table -------------------------------------------------------------

  protected value(row: SimulationRowDto, key: ShotKey): number {
    return this.values()[row.weaponId]?.[key] ?? row[key];
  }

  protected changed(row: SimulationRowDto, key: ShotKey): boolean {
    return this.value(row, key) !== row[key];
  }

  /** «+12 %», «−8 %» or «neu» (Ist was 0); empty when unchanged. */
  protected deltaLabel(row: SimulationRowDto, key: ShotKey): string {
    if (!this.changed(row, key)) return '';
    const ist = row[key];
    if (ist === 0) return 'simulation.delta_new';
    const pct = Math.round(((this.value(row, key) - ist) / ist) * 100);
    return `${pct > 0 ? '+' : ''}${this.fmt(pct)} %`;
  }

  protected onInput(row: SimulationRowDto, key: ShotKey, raw: string): void {
    const digits = String(raw).replace(/[^\d]/g, '');
    this.facade.setValue(row.weaponId, key, digits ? Number(digits) : 0);
  }

  protected toggleEditing(): void {
    this.editing.update((on) => !on);
  }

  protected scale(factor: number): void {
    this.facade.scaleAll(factor);
  }

  protected reset(): void {
    this.facade.reset();
    this.activePin.set(null);
  }

  protected async run(): Promise<void> {
    await this.facade.run();
  }

  protected setYear(raw: string): void {
    const year = Number(raw);
    if (Number.isFinite(year)) this.year.set(year);
  }

  // ----- map / result ------------------------------------------------------

  /** Pin colour: the simulated state once a fresh result exists, else the Ist. */
  protected pinState(receiver: SimulationReceiverDto): LightState {
    if (this.showSim()) return this.resultById()[receiver.id]?.simulatedState ?? receiver.currentState;
    return receiver.currentState;
  }

  protected simulated(receiver: SimulationReceiverDto): SimulationResultReceiverDto | null {
    return this.showSim() ? (this.resultById()[receiver.id] ?? null) : null;
  }

  protected badge(state: LightState): string {
    return `slim-badge ${BADGE[state]}`;
  }

  protected selectPin(id: string): void {
    this.activePin.update((current) => (current === id ? null : id));
  }

  protected closePop(event?: Event): void {
    event?.stopPropagation();
    this.activePin.set(null);
  }

  protected deltaClass(delta: number | null): string {
    if (delta === null || Math.abs(delta) < 0.05) return 'sim__d sim__d--flat';
    return delta > 0 ? 'sim__d sim__d--up' : 'sim__d sim__d--down';
  }

  // ----- formatting ---------------------------------------------------------

  protected fmt(n: number): string {
    return this.numberFormat.format(n);
  }

  protected db(n: number | null | undefined): string {
    return n === null || n === undefined ? '–' : `${this.dbFormat.format(n)} dB`;
  }

  protected signed(n: number | null | undefined): string {
    if (n === null || n === undefined) return '–';
    return `${n > 0 ? '+' : ''}${this.dbFormat.format(n)} dB`;
  }

  protected signedInt(n: number): string {
    return `${n > 0 ? '+' : ''}${this.fmt(n)}`;
  }

  protected deliveredAt(iso: string | undefined): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }
}
