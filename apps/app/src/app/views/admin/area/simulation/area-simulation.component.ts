import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import type {
  SimulationReceiverDto,
  SimulationResultReceiverDto,
  SimulationRowDto,
} from '@ui-slim/apiClient';
import { MapPoint, MapViewerComponent } from '@ui-slim/map';
import { statusRank } from '../../../../common/status-pill.component';
import { TableExportComponent } from '../../../../common/table-export.component';
import { TableSelectComponent, TableSelectRowDirective } from '../../../../common/table-select.component';
import { TableSortHeaderComponent } from '../../../../common/table-sort-header.component';
import { tableExport, TableExportData } from '../../../../core/table/table-export';
import { TableSelection } from '../../../../core/table/table-selection';
import { SortValue, TableSort } from '../../../../core/table/table-sort';
import { AreaFacade } from '../../../../core/area/area.facade';
import { MapFacade } from '../../../../core/calculation/map.facade';
import { rowKey, SimulationFacade } from '../../../../core/calculation/simulation.facade';
import { QuantityComponent } from '../shots/quantity.component';

type ShotKey = 'inside' | 'outside';
type LightState = SimulationReceiverDto['currentState'];

/** Quick scale buttons of the mock (−20 % … +50 %). */
const SCALE_FACTORS = [0.8, 0.9, 1.1, 1.2, 1.5] as const;

const BADGE: Record<LightState, string> = {
  ok: 'slim-badge--success',
  warn: 'slim-badge--warning',
  over: 'slim-badge--danger',
  none: '',
  incomplete: 'slim-badge--outline',
};

/**
 * «Schiessplatz – Simulation» (B1 5.13, mock `_mocks/area/simulation.index.html`):
 * the year's military shot counts per Stellungsraum × Waffe are the Ist; the
 * user overwrites them, runs the Annex 9 calculation on the API and compares
 * the Beurteilungspegel per Empfangspunkt on the map and in the result
 * table. The map is the GIS-Kartenviewer (`slm 2`), the schematic map stays
 * as fallback. A sandbox — nothing is written. Data: SimulationFacade,
 * MapFacade (Anlagenteile of the state).
 */
/** Ids of the tables in the export: file name (date and extension are added) and logbook. */
const EXPORT_INPUT = 'simulation_schusszahlen';
const EXPORT_RESULT = 'simulation_resultat';

type InputSortKey = 'room' | 'weapon' | 'inside' | 'outside';
type ResultSortKey = 'point' | 'limit' | 'current' | 'simulated' | 'delta' | 'state';

/** One line of the Schusszahlen: a Stellungsraum with a Waffe/Kaliber. */
const inputRowId = (row: SimulationRowDto): string => `${row.roomId}|${row.combinationId}`;

/**
 * What the columns are sorted by (B1 5.5.2). The Schusszahlen by the Ist of
 * the year, so a row keeps its place while its value is overridden.
 */
const INPUT_SORT: Record<InputSortKey, (row: SimulationRowDto) => SortValue> = {
  room: (row) => `${row.roomName} ${row.roomNo ?? ''}`,
  weapon: (row) => `${row.weapon} ${row.caliber}`,
  inside: (row) => row.inside,
  outside: (row) => row.outside,
};
const RESULT_SORT: Record<ResultSortKey, (r: SimulationResultReceiverDto) => SortValue> = {
  point: (r) => r.code,
  limit: (r) => r.limit,
  current: (r) => r.current,
  simulated: (r) => r.simulated,
  delta: (r) => r.delta,
  state: (r) => statusRank(r.simulatedState),
};

@Component({
  selector: 'app-area-simulation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, TranslatePipe, MapViewerComponent, TableExportComponent, TableSelectComponent, TableSelectRowDirective, TableSortHeaderComponent, QuantityComponent],
  styleUrl: './area-simulation.component.scss',
  templateUrl: './area-simulation.component.html',
})
export class AreaSimulationComponent extends ComponentBase {
  private readonly facade = inject(SimulationFacade);
  private readonly maps = inject(MapFacade);
  private readonly areas = inject(AreaFacade);
  private readonly translate = inject(TranslateService);
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
  protected readonly inputSort = new TableSort<InputSortKey>();
  protected readonly inputSelection = new TableSelection();
  /** The Schusszahlen in the order of the API, or of the chosen column (B1 5.5.2). */
  protected readonly rows = computed(() => this.inputSort.apply(this.facade.rows(), INPUT_SORT));
  protected readonly rowIds = computed(() => this.rows().map(inputRowId));
  protected readonly rowId = inputRowId;

  protected readonly resultSort = new TableSort<ResultSortKey>();
  protected readonly resultSelection = new TableSelection();
  /** The Empfangspunkte of the result in the order of the API, or of the chosen column. */
  protected readonly resultRows = computed(() => this.resultSort.apply(this.result()?.receivers ?? [], RESULT_SORT));
  protected readonly resultIds = computed(() => this.resultRows().map((r) => r.id));
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

    // The Anlagenteile of the map belong to the state the simulation runs on.
    effect(() => {
      const areaId = this.areaId();
      const state = this.calculation()?.id ?? null;
      untracked(() => {
        if (areaId && state) void this.maps.load(areaId, state);
      });
    });
  }

  /** ComponentBase calls this on init and on every DATA_RELOAD emit. */
  override getData(): void {
    this.ready = true;
    const areaId = this.areaId();
    if (areaId) void this.facade.load(areaId, this.year());
  }

  // ----- export (B1 5.5.5, slm 3) --------------------------------------------

  /** The Schusszahlen of the simulation as shown: the Ist of the year and the values the simulation runs with. */
  protected readonly inputExportSource = (): TableExportData => {
    const t = (key: string) => this.translate.translate(key) ?? key;
    const picked = this.inputSelection.pick(this.rows(), inputRowId);
    return tableExport<SimulationRowDto>({
      table: EXPORT_INPUT,
      title: t('simulation.inputs_title'),
      subtitle: this.mapTitle(),
      filters: [
        { label: t('year'), value: this.year() },
        { label: t('simulation.export.basis'), value: this.calculation()?.name },
      ],
      columns: [
        { header: t('simulation.columns.room'), value: (row) => row.roomName },
        { header: t('simulation.columns.room_no'), value: (row) => row.roomNo },
        { header: t('simulation.columns.weapon'), value: (row) => `${row.weapon} · ${row.caliber}` },
        { header: t('simulation.quantity_unit'), value: (row) => t(row.quantityUnit === 'kg' ? 'shots.unit_kg' : 'shots.unit_shots') },
        { header: t('simulation.export.inside_current'), value: (row) => row.inside },
        { header: t('simulation.export.inside_simulated'), value: (row) => this.value(row, 'inside') },
        { header: t('simulation.export.outside_current'), value: (row) => row.outside },
        { header: t('simulation.export.outside_simulated'), value: (row) => this.value(row, 'outside') },
      ],
      rows: picked.rows,
      selection: picked.selection,
    });
  };

  /** The result of the last simulation: one line per Empfangspunkt and limit. */
  protected readonly resultExportSource = (): TableExportData => {
    const t = (key: string) => this.translate.translate(key) ?? key;
    const picked = this.resultSelection.pick(this.resultRows(), (r) => r.id);
    const lines = picked.rows.flatMap((receiver) => {
      const simulated = receiver.simulatedRows ?? [];
      return simulated.length
        ? simulated.map((row) => ({
            receiver,
            kind: row.limitKind,
            limit: row.limit,
            current: receiver.assessmentRows?.find((r) => r.limitKind === row.limitKind)?.level ?? null,
            simulated: row.level,
            state: row.state,
          }))
        : [{ receiver, kind: receiver.limitKind, limit: receiver.limit, current: receiver.current, simulated: receiver.simulated, state: receiver.simulatedState }];
    });
    return tableExport<(typeof lines)[number]>({
      table: EXPORT_RESULT,
      title: t('simulation.result_title'),
      subtitle: this.mapTitle(),
      filters: [
        { label: t('year'), value: this.year() },
        { label: t('simulation.export.basis'), value: this.calculation()?.name },
      ],
      columns: [
        { header: t('simulation.result.point'), value: (l) => l.receiver.code },
        { header: t('simulation.export.address'), value: (l) => l.receiver.address },
        { header: t('simulation.export.limit_kind'), value: (l) => l.kind.toUpperCase() },
        { header: t('simulation.result.limit'), value: (l) => l.limit },
        { header: t('simulation.result.current'), value: (l) => l.current },
        { header: t('simulation.result.simulated'), value: (l) => l.simulated },
        { header: t('simulation.result.delta'), value: (l) => (l.current === null || l.simulated === null ? null : Math.round((l.simulated - l.current) * 10) / 10) },
        { header: t('simulation.result.assessment'), value: (l) => t(`status_area.${l.state}`) },
      ],
      rows: lines,
      selection: picked.selection,
    });
  };

  // ----- table -------------------------------------------------------------

  protected value(row: SimulationRowDto, key: ShotKey): number {
    return this.values()[rowKey(row)]?.[key] ?? row[key];
  }

  /** The Ist of a cell (typed access for the template). */
  protected ist(row: SimulationRowDto, key: ShotKey): number {
    return row[key];
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
    const text = String(raw).replace(',', '.').replace(/[^\d.]/g, '');
    this.facade.setValue(rowKey(row), key, text ? Number(text) : 0);
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

  /** False once the map library could not be loaded: the schematic map takes over. */
  protected readonly gisAvailable = signal(true);
  protected readonly useGis = computed(
    () => this.gisAvailable() && this.receivers().some((r) => r.east !== null && r.north !== null),
  );
  protected readonly plantParts = this.maps.plantParts;
  /** Pins in the simulated state once a fresh result exists; the Ist then stays visible as a dot next to the pin. */
  protected readonly mapPoints = computed<MapPoint[]>(() => {
    const simulated = this.showSim();
    return this.receivers().map((r) => ({
      id: r.id,
      code: r.code,
      east: r.east,
      north: r.north,
      state: this.pinState(r),
      label: this.translate.translate('simulation.pin_label', { code: r.code }) ?? r.code,
      previousState: simulated ? r.currentState : null,
      previousLabel: simulated ? (this.translate.translate('simulation.ghost_title', { value: this.db(r.current) }) ?? '') : undefined,
    }));
  });
  /** Title of the map export. */
  protected readonly mapTitle = computed(() => {
    const area = this.areas.byId(this.areaId());
    return area ? `${area.coordinationSectionNo} ${area.name}` : '';
  });

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
