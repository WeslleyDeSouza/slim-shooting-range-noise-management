import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import { worstState } from '@slim/lsv';
import { APP_ROUTES, SLIM_APP_ID } from '@slim/shared';
import type { AssessmentRowDto, QuotaRowDto, ReceiverAssessmentDto } from '@ui-slim/apiClient';
import { MapPoint, MapViewerComponent } from '@ui-slim/map';
import { StatusPillComponent } from '../../../../common/status-pill.component';
import { TableExportComponent } from '../../../../common/table-export.component';
import { AccessFacade } from '../../../../core/access/access.facade';
import { AreaFacade } from '../../../../core/area/area.facade';
import { AssessmentFacade } from '../../../../core/calculation/assessment.facade';
import { MapFacade } from '../../../../core/calculation/map.facade';
import { QuotaFacade } from '../../../../core/calculation/quota.facade';
import { SelectionListKey, SelectionListsFacade } from '../../../../core/settings/selection-lists.facade';
import { tableExport, TableExportData } from '../../../../core/table/table-export';

type ReceiverState = ReceiverAssessmentDto['state'];

/** Id of the table in the export: file name (date and extension are added) and logbook. */
const EXPORT_TABLE = 'kontingente_vergleich';

/** «Stand SPM / MPV / Projekt» (B1 5.10, Bedienelement 2): the fields of the Stammdaten (5.16) and their Auswahllisten. */
const STAND_FIELDS: readonly { key: string; list: SelectionListKey; field: 'spmState' | 'noiseRemediationState' | 'projectState' | 'remediationProjectState' | 'recalculationState' }[] = [
  { key: 'spm_state', list: 'spm_state', field: 'spmState' },
  { key: 'noise_remediation_state', list: 'noise_remediation_state', field: 'noiseRemediationState' },
  { key: 'project_state', list: 'project_state', field: 'projectState' },
  { key: 'remediation_project_state', list: 'remediation_project_state', field: 'remediationProjectState' },
  { key: 'recalculation_state', list: 'recalculation_state', field: 'recalculationState' },
];

/**
 * «Schiessplatz-Nutzungen – Übersicht» (B1 5.10, slm 9): the assessment of
 * the Lärmbelastung with both lights, the Stand SPM / MPV / Projekt, the
 * comparison with the Kontingente of the Plangenehmigung and the map of the
 * Empfangspunkte. Rendered inside AreaContextComponent; data: AreaFacade,
 * QuotaFacade, AssessmentFacade, MapFacade.
 */
@Component({
  selector: 'app-area-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, RouterLink, TranslatePipe, StatusPillComponent, MapViewerComponent, TableExportComponent],
  templateUrl: './area-summary.component.html',
  styleUrl: './area-summary.component.scss',
})
export class AreaSummaryComponent extends ComponentBase {
  private readonly areas = inject(AreaFacade);
  private readonly quotas = inject(QuotaFacade);
  private readonly assessments = inject(AssessmentFacade);
  private readonly maps = inject(MapFacade);
  private readonly lists = inject(SelectionListsFacade);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);

  /** The area id lives on the parent route (`/admin/area/:id/overview`). */
  private readonly areaId = toSignal((this.route.parent ?? this.route).paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: (this.route.parent ?? this.route).snapshot.paramMap.get('id') ?? '',
  });

  protected readonly routes = APP_ROUTES;
  protected readonly legendStates: ReceiverState[] = ['ok', 'warn', 'over', 'incomplete', 'none'];

  // Schiessplatz -------------------------------------------------------------
  protected readonly area = computed(() => this.areas.byId(this.areaId()) ?? null);
  protected readonly areaLabel = computed(() => {
    const area = this.area();
    return area ? `${area.coordinationSectionNo} ${area.name}` : '';
  });
  protected readonly classification = computed(() => this.listLabel('classification', this.area()?.classification));
  protected readonly stand = computed(() => {
    const area = this.area();
    return STAND_FIELDS.map((f) => ({ key: f.key, value: this.listLabel(f.list, area?.[f.field]) }));
  });

  // Kontingente --------------------------------------------------------------
  /** Year of the comparison; null = the current year. */
  protected readonly year = signal<number | null>(null);
  protected readonly quota = this.quotas.overview;
  protected readonly quotaLoading = this.quotas.loading;
  protected readonly quotaError = this.quotas.error;
  protected readonly rows = computed<QuotaRowDto[]>(() => this.quota()?.rows ?? []);
  protected readonly withoutQuota = computed(() => this.rows().some((row) => !row.hasQuota));
  protected readonly quotaBasis = computed(() => {
    const q = this.quota();
    return q ? (this.translate.translate('basis.quota', { year: q.year, from: q.fromYear }) ?? null) : null;
  });

  // Empfangspunkte -----------------------------------------------------------
  protected readonly receivers = this.assessments.receivers;
  protected readonly calculation = computed(() => this.assessments.assessment()?.calculation ?? null);
  protected readonly assessmentLoading = this.assessments.loading;
  /** The current calendar year the map assesses (B1 5.10, Bedienelement 4). */
  protected readonly mapYear = new Date().getFullYear();
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selected = computed(() => this.receivers().find((r) => r.id === this.selectedId()) ?? null);

  /** False once the map library could not be loaded: the list takes over. */
  protected readonly gisAvailable = signal(true);
  protected readonly hasCoordinates = computed(() => this.receivers().some((r) => r.east !== null && r.north !== null));
  protected readonly useGis = computed(() => this.gisAvailable() && this.hasCoordinates());
  protected readonly plantParts = this.maps.plantParts;
  protected readonly mapPoints = computed<MapPoint[]>(() =>
    this.receivers().map((r) => {
      const state = this.annex9State(r);
      return { id: r.id, code: r.code, east: r.east, north: r.north, state, label: `${r.code}, ${this.translate.translate('details.state.' + state) ?? state}` };
    }),
  );
  /** «Vollansicht» in a new tab (B1 5.10), on the state the page shows. */
  protected readonly fullscreenLink = computed(() => {
    const id = this.areaId();
    const state = this.calculation()?.id;
    return id ? APP_ROUTES.admin.area.map(id) + (state ? `?state=${state}` : '') : null;
  });
  /** Where a calculation is imported (5.18 / 5.19) — offered when nothing is there to assess, to users who may open it. */
  private readonly canOpenCalculations = inject(AccessFacade).can(SLIM_APP_ID.ADMIN_DATA_CALCULATIONS);
  protected readonly calculationsLink = computed(() => {
    const id = this.areaId();
    return id && this.canOpenCalculations() ? APP_ROUTES.admin.dataManagement.area.calculationsOf(id) : null;
  });

  constructor() {
    super();
    // Another Schiessplatz or another year → reload (the initial run is the first load).
    effect(() => {
      this.areaId();
      this.year();
      untracked(() => this.getData());
    });
    // The Anlagenteile of the map belong to the state the assessment shows.
    effect(() => {
      const areaId = this.areaId();
      const state = this.calculation()?.id ?? null;
      untracked(() => {
        if (areaId && state) void this.maps.load(areaId, state);
      });
    });
    // A selection that no longer exists is dropped.
    effect(() => {
      const receivers = this.receivers();
      const selectedId = untracked(() => this.selectedId());
      if (selectedId && !receivers.some((r) => r.id === selectedId)) this.selectedId.set(null);
    });
  }

  /** ComponentBase calls this on init and on every DATA_RELOAD emit. */
  override getData(): void {
    const id = this.areaId();
    if (!id) return;
    void this.areas.load();
    void this.quotas.load(id, this.year());
    // The map shows the current state for the usages of the current calendar year.
    void this.assessments.load(id, { from: `${this.mapYear}-01-01`, to: `${this.mapYear}-12-31` });
  }

  protected setYear(value: string): void {
    this.year.set(Number(value) || null);
  }

  protected select(id: string | null): void {
    this.selectedId.set(this.selectedId() === id ? null : id);
  }

  /** B1 5.10: the marker shows the colour of the assessment after Anhang 9. */
  protected annex9State(receiver: ReceiverAssessmentDto): ReceiverState {
    const rows = receiver.rows.filter((row) => row.annex === 9 && row.applicable);
    return rows.length ? worstState(rows.map((row) => row.state)) : receiver.state;
  }

  /** The rows of a receiver that apply (Anhang 9 and, where assessed, Anhang 7), for the pop-up. */
  protected applicableRows(receiver: ReceiverAssessmentDto): AssessmentRowDto[] {
    return receiver.rows.filter((row) => row.applicable);
  }

  /** Ist as a share of the Soll in percent; null when the Soll is 0 (nothing to divide by). */
  protected percent(actual: number, row: QuotaRowDto): number | null {
    return row.target > 0 ? Math.round((actual / row.target) * 100) : null;
  }

  /** The comparison as shown, for the Excel-/CSV-Export (B1 5.5.5, slm 3). */
  protected readonly exportSource = (): TableExportData => {
    const t = (key: string, params?: Record<string, unknown>) => this.translate.translate(key, params) ?? key;
    const q = this.quota();
    const unit = (row: QuotaRowDto) => t(row.quantityUnit === 'kg' ? 'shots.unit_kg' : 'shots.unit_shots');
    return tableExport<QuotaRowDto>({
      table: EXPORT_TABLE,
      title: t('summary.quota.title'),
      subtitle: this.areaLabel(),
      filters: [
        { label: t('year'), value: q?.year },
        { label: t('summary.quota.approval'), value: this.area()?.planningApproval },
      ],
      columns: [
        { header: t('summary.quota.col_weapon'), value: (row) => row.name },
        { header: t('summary.quota.col_unit'), value: (row) => unit(row) },
        { header: t('summary.quota.col_target'), value: (row) => row.target },
        { header: t('summary.quota.col_has_quota'), value: (row) => t(row.hasQuota ? 'common.yes' : 'common.no') },
        { header: t('summary.quota.col_current', { year: q?.year ?? '' }), value: (row) => row.current },
        { header: t('summary.quota.col_current_state'), value: (row) => t(`status_area.${row.currentState}`) },
        { header: t('summary.quota.col_average', { from: q?.fromYear ?? '', year: q?.year ?? '' }), value: (row) => row.average },
        { header: t('summary.quota.col_average_state'), value: (row) => t(`status_area.${row.averageState}`) },
      ],
      rows: this.rows(),
    });
  };

  private listLabel(list: SelectionListKey, code: string | null | undefined): string | null {
    this.lists.lists(); // re-evaluate when the lists change
    return code ? this.lists.label(list, code) : null;
  }
}
