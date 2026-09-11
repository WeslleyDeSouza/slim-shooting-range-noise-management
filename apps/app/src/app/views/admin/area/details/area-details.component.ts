import { DatePipe, DecimalPipe } from '@angular/common';
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
  AssessmentRowDto,
  ReceiverAssessmentDto,
} from '@ui-slim/apiClient';
import { StatusPillComponent } from '../../../../common/status-pill.component';
import {
  AssessmentFacade,
  AssessmentQuery,
} from '../../../../core/calculation/assessment.facade';

type ReceiverState = ReceiverAssessmentDto['state'];
type View = 'map' | 'list';

/** Worst first, as the list view orders the receivers. */
const STATE_ORDER: Record<ReceiverState, number> = {
  incomplete: 0,
  over: 1,
  warn: 2,
  ok: 3,
  none: 4,
};

/** Headroom above the limit the meter shows (mock: limit + 8 dB = 100 %). */
const METER_HEADROOM_DB = 8;

/**
 * "Schiessplatz – Details · Empfangspunkte" (B1 5.12, mock
 * `_mocks/area/detail.index.html`): the receivers of the area on a
 * schematic map / list, assessed against the LSV limits for a calculation
 * state and a period, with the four assessment rows of the selected point.
 * Rendered inside AreaContextComponent; data: AssessmentFacade.
 */
@Component({
  selector: 'app-area-details',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, TranslatePipe, StatusPillComponent],
  templateUrl: './area-details.component.html',
  styleUrl: './area-details.component.scss',
})
export class AreaDetailsComponent extends ComponentBase {
  private readonly facade = inject(AssessmentFacade);
  private readonly route = inject(ActivatedRoute);

  /** The area id lives on the parent route (`/admin/area/:id/details`). */
  private readonly areaId = toSignal(
    (this.route.parent ?? this.route).paramMap.pipe(
      map((p) => p.get('id') ?? ''),
    ),
    {
      initialValue:
        (this.route.parent ?? this.route).snapshot.paramMap.get('id') ?? '',
    },
  );

  protected readonly legendStates: ReceiverState[] = ['ok', 'warn', 'over', 'incomplete', 'none'];

  // View state ---------------------------------------------------------------
  protected readonly view = signal<View>('map');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly calculationId = signal<string | null>(null);
  protected readonly from = signal<string | null>(null);
  protected readonly to = signal<string | null>(null);

  // Data ---------------------------------------------------------------------
  protected readonly assessment = this.facade.assessment;
  protected readonly receivers = this.facade.receivers;
  protected readonly calculations = this.facade.calculations;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;

  protected readonly counts = computed(() => this.assessment()?.counts ?? null);
  protected readonly calculation = computed(
    () => this.assessment()?.calculation ?? null,
  );
  protected readonly current = computed(
    () => this.assessment()?.current ?? null,
  );
  protected readonly isOtherState = computed(() => {
    const selected = this.calculation();
    const current = this.current();
    return Boolean(selected && current && selected.id !== current.id);
  });
  protected readonly period = computed(() => this.assessment()?.period ?? null);

  protected readonly sorted = computed(() =>
    [...this.receivers()].sort(
      (a, b) =>
        STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
        a.code.localeCompare(b.code),
    ),
  );

  protected readonly selected = computed(
    () => this.receivers().find((r) => r.id === this.selectedId()) ?? null,
  );

  private readonly query = computed<AssessmentQuery>(() => {
    const query: AssessmentQuery = {};
    const calculationId = this.calculationId();
    const from = this.from();
    const to = this.to();
    if (calculationId) query.calculationId = calculationId;
    if (from) query.from = from;
    if (to) query.to = to;
    return query;
  });

  private lastLoaded: string | null = null;

  constructor() {
    super();

    // Area, state or period changed → reload (the initial run is the first load).
    effect(() => {
      const areaId = this.areaId();
      const query = this.query();
      untracked(() => this.load(areaId, query, false));
    });

    // Keep the selection across reloads; default to the first receiver.
    effect(() => {
      const receivers = this.receivers();
      const selectedId = untracked(() => this.selectedId());
      if (!receivers.length) {
        if (selectedId !== null) this.selectedId.set(null);
        return;
      }
      if (!receivers.some((r) => r.id === selectedId)) {
        this.selectedId.set(receivers[0].id);
      }
    });
  }

  /** ComponentBase: on init and on every DATA_RELOAD emit (forced reload). */
  override getData(): void {
    this.load(this.areaId(), this.query(), this.lastLoaded !== null);
  }

  private load(areaId: string, query: AssessmentQuery, force: boolean): void {
    if (!areaId) return;
    const key = `${areaId}|${JSON.stringify(query)}`;
    if (!force && key === this.lastLoaded) return;
    this.lastLoaded = key;
    void this.facade.load(areaId, query);
  }

  // Interaction --------------------------------------------------------------
  protected select(id: string): void {
    this.selectedId.set(id);
  }

  protected setView(view: View): void {
    this.view.set(view);
  }

  protected onCalculationChange(value: string): void {
    this.calculationId.set(value || null);
  }

  protected onFromChange(value: string): void {
    this.from.set(value || null);
  }

  protected onToChange(value: string): void {
    this.to.set(value || null);
  }

  // Helpers for the template -------------------------------------------------
  protected igwRow(receiver: ReceiverAssessmentDto): AssessmentRowDto | undefined {
    return receiver.rows.find((r) => r.annex === 9 && r.limitKind === 'igw');
  }

  /** Fill width of the meter in percent (limit + headroom = 100 %). */
  protected meterWidth(row: AssessmentRowDto): number {
    if (row.level === null) return 0;
    return Math.min(100, Math.max(0, (row.level / (row.limit + METER_HEADROOM_DB)) * 100));
  }

  /** Position of the limit marker in percent. */
  protected meterLimit(row: AssessmentRowDto): number {
    return (row.limit / (row.limit + METER_HEADROOM_DB)) * 100;
  }

  protected pinStyle(receiver: ReceiverAssessmentDto): string {
    return `--x:${receiver.mapX}%;--y:${receiver.mapY}%`;
  }

  protected calculationLabel(calc: { name: string; deliveredAt: string }): string {
    return `${calc.name} (${formatDate(calc.deliveredAt)})`;
  }
}

/** YYYY-MM-DD → dd.MM.yyyy for the select labels. */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : iso;
}
