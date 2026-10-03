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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import { APP_ROUTES, SLIM_APP_ID } from '@slim/shared';
import type {
  AssessmentRowDto,
  ReceiverAssessmentDto,
} from '@ui-slim/apiClient';
import { MapPoint, MapViewerComponent } from '@ui-slim/map';
import { StatusPillComponent } from '../../../../common/status-pill.component';
import { TableExportComponent } from '../../../../common/table-export.component';
import { AccessFacade } from '../../../../core/access/access.facade';
import { AreaFacade } from '../../../../core/area/area.facade';
import {
  AssessmentFacade,
  AssessmentQuery,
} from '../../../../core/calculation/assessment.facade';
import { MapFacade } from '../../../../core/calculation/map.facade';
import { tableExport, TableExportData } from '../../../../core/table/table-export';

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
 * `_mocks/area/detail.index.html`): the receivers of the area on the map /
 * as list, assessed against the LSV limits for a calculation state and a
 * period, with the four assessment rows of the selected point. The map is
 * the GIS-Kartenviewer (`slm 2`: swisstopo background, Anlagenteile and
 * Empfangspunkte in LV95); the schematic map stays as fallback when the map
 * library is not available or the state has no coordinates.
 * Rendered inside AreaContextComponent; data: AssessmentFacade, MapFacade.
 */
/** Id of the table in the export: file name (date and extension are added) and logbook. */
const EXPORT_TABLE = 'empfangspunkte';

/** One line of the export: an Empfangspunkt with one comparison; `row` is null for a point without assessment. */
interface ExportLine {
  receiver: ReceiverAssessmentDto;
  row: ReceiverAssessmentDto['rows'][number] | null;
}

/** `YYYY-MM-DD` as `DD.MM.YYYY`. */
function swissDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}.${month}.${year}`;
}

@Component({
  selector: 'app-area-details',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, RouterLink, TranslatePipe, StatusPillComponent, MapViewerComponent, TableExportComponent],
  templateUrl: './area-details.component.html',
  styleUrl: './area-details.component.scss',
})
export class AreaDetailsComponent extends ComponentBase {
  private readonly facade = inject(AssessmentFacade);
  private readonly maps = inject(MapFacade);
  private readonly areas = inject(AreaFacade);
  private readonly translate = inject(TranslateService);
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
  protected readonly yearsText = signal('');
  protected readonly yearsInvalid = signal(false);
  private readonly years = signal<string | null>(null);

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

  // GIS map (slm 2) ----------------------------------------------------------
  /** False once the map library could not be loaded: the schematic map takes over. */
  protected readonly gisAvailable = signal(true);
  protected readonly hasCoordinates = computed(() => this.receivers().some((r) => r.east !== null && r.north !== null));
  protected readonly useGis = computed(() => this.gisAvailable() && this.hasCoordinates());
  protected readonly plantParts = this.maps.plantParts;
  protected readonly mapPoints = computed<MapPoint[]>(() =>
    this.receivers().map((r) => ({
      id: r.id,
      code: r.code,
      east: r.east,
      north: r.north,
      state: r.state,
      label: `${r.code}, ${this.translate.translate('details.state.' + r.state) ?? r.state}`,
    })),
  );
  protected readonly mapTitle = computed(() => {
    const area = this.areas.byId(this.areaId());
    return area ? `${area.coordinationSectionNo} ${area.name}` : '';
  });
  /** Where a calculation is imported (5.18 / 5.19) — offered when nothing is there to assess, to users who may open it. */
  private readonly canOpenCalculations = inject(AccessFacade).can(SLIM_APP_ID.ADMIN_DATA_CALCULATIONS);
  protected readonly calculationsLink = computed(() => {
    const id = this.areaId();
    return id && this.canOpenCalculations() ? APP_ROUTES.admin.dataManagement.area.calculationsOf(id) : null;
  });
  /** «Vollansicht» in a new tab (B1 5.10), on the state the page shows. */
  protected readonly fullscreenLink = computed(() => {
    const id = this.areaId();
    const state = this.calculation()?.id;
    return id ? APP_ROUTES.admin.area.map(id) + (state ? `?state=${state}` : '') : null;
  });

  /**
   * The assessment for the Excel-/CSV-Export (B1 5.5.5, slm 3): one line per
   * Empfangspunkt and applicable comparison (Anhang 9 / 7, IGW / PW), the
   * points in the order of the list.
   */
  protected readonly exportSource = (): TableExportData => {
    const t = (key: string) => this.translate.translate(key) ?? key;
    const period = this.period();
    const lines = this.sorted().flatMap((receiver): ExportLine[] => {
      const rows = receiver.rows.filter((row) => row.applicable);
      return rows.length ? rows.map((row) => ({ receiver, row })) : [{ receiver, row: null }];
    });
    return tableExport<ExportLine>({
      table: EXPORT_TABLE,
      title: t('details.title'),
      subtitle: this.mapTitle(),
      filters: [
        { label: t('details.calc.basis'), value: this.calculation()?.name },
        { label: t('details.export.period'), value: period ? (period.selectedYears.length ? period.selectedYears.join(', ') : `${swissDate(period.from)} – ${swissDate(period.to)}`) : null },
      ],
      columns: [
        { header: t('details.receiver.no'), value: (l) => l.receiver.code },
        { header: t('details.export.address'), value: (l) => l.receiver.address },
        { header: t('details.receiver.es'), value: (l) => l.receiver.sensitivityLevel },
        { header: t('details.export.state'), value: (l) => t(`details.state.${l.receiver.state}`) },
        { header: t('details.columns.basis'), value: (l) => (l.row ? `${t(l.row.annex === 9 ? 'details.annex_9' : 'details.annex_7')}, ${t(`details.${l.row.limitKind}`)}` : null) },
        { header: t('details.columns.limit'), value: (l) => l.row?.limit },
        { header: t('details.columns.level'), value: (l) => l.row?.level },
        { header: t('details.columns.reserve'), value: (l) => l.row?.reserve },
        { header: t('details.export.row_state'), value: (l) => (l.row ? t(`details.state.${l.row.state}`) : null) },
      ],
      rows: lines,
    });
  };

  private readonly query = computed<AssessmentQuery>(() => {
    const query: AssessmentQuery = {};
    const calculationId = this.calculationId();
    const from = this.from();
    const to = this.to();
    const years = this.years();
    if (calculationId) query.calculationId = calculationId;
    if (years) return { ...query, years };
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

    // The Anlagenteile of the map belong to the state the assessment shows.
    effect(() => {
      const areaId = this.areaId();
      const state = this.calculation()?.id ?? null;
      untracked(() => {
        if (areaId && state) void this.maps.load(areaId, state);
      });
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
    this.clearYears();
    this.from.set(value || null);
  }

  protected onToChange(value: string): void {
    this.clearYears();
    this.to.set(value || null);
  }

  protected onYearsChange(value: string): void {
    this.yearsText.set(value);
    if (!value.trim()) { this.clearYears(); return; }
    const tokens = value.trim().split(/[,;\s]+/);
    const valid = tokens.length === 3 && new Set(tokens).size === 3 &&
      tokens.every(y => /^\d{4}$/.test(y) && +y >= 1900 && +y <= 2200);
    this.yearsInvalid.set(!valid);
    if (valid) this.years.set(tokens.map(Number).sort((a, b) => a - b).join(','));
  }

  private clearYears(): void {
    this.yearsText.set('');
    this.yearsInvalid.set(false);
    this.years.set(null);
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
