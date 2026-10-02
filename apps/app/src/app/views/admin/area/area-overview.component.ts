import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import { APP_ROUTES } from '@slim/shared';
import type { AreaResultDto } from '@ui-slim/apiClient';
import { statusLabelKey, statusRank, StatusPillComponent } from '../../../common/status-pill.component';
import { TableExportComponent } from '../../../common/table-export.component';
import { TableSelectComponent, TableSelectRowDirective } from '../../../common/table-select.component';
import { TableSortHeaderComponent } from '../../../common/table-sort-header.component';
import {
  AreaFacade,
  AreaStatus,
  needsAttention,
} from '../../../core/area/area.facade';
import { tableExport, TableExportData } from '../../../core/table/table-export';
import { TableSelection } from '../../../core/table/table-selection';
import { SortValue, TableSort } from '../../../core/table/table-sort';

type StatusFilter = '' | AreaStatus;
type SortKey = 'name' | 'ka' | 'sp' | 'quota' | 'noise';

/** What every column is sorted by (B1 5.5.2); the lights by their severity. */
const SORT_VALUES: Record<SortKey, (r: AreaResultDto) => SortValue> = {
  name: (r) => r.name,
  ka: (r) => r.coordinationSectionNo,
  sp: (r) => r.sectoralPlanNo,
  quota: (r) => statusRank(r.quotaStatus),
  noise: (r) => statusRank(r.noiseStatus),
};

/** Id of the table in the export: file name (date and extension are added) and logbook. */
const EXPORT_TABLE = 'schiessplaetze';

/**
 * "Übersicht Schiessplätze" (mock view-plaetze, chapters 5.8 / 5.9):
 * breadcrumbs, year + export (Excel/CSV of the rows shown or marked, 5.5.5),
 * search + status filter, table with sortable columns (5.5.2), multi-selection
 * (5.5.3), traffic-light pills and row actions, pager, legend. Data: AreaFacade.
 */
@Component({
  selector: 'app-area-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, StatusPillComponent, TableExportComponent, TableSelectComponent, TableSelectRowDirective, TableSortHeaderComponent],
  styleUrl: './area-overview.component.scss',
  template: `
    <div class="slim-page area">
      <ol class="slim-breadcrumbs">
        <li class="slim-breadcrumbs__item">
          <a [routerLink]="routes.admin.home">{{ 'shell.home' | translate }}</a>
        </li>
        <li class="slim-breadcrumbs__item">
          <a [routerLink]="routes.admin.area.root">{{
            'menu.areas' | translate
          }}</a>
        </li>
        <li class="slim-breadcrumbs__item slim-breadcrumbs__item--current">
          {{ 'menu.area_overview' | translate }}
        </li>
      </ol>

      <div class="slim-page__header">
        <div>
          <h1 class="slim-page__title">{{ 'title' | translate }}</h1>
          <p class="slim-page__subtitle">{{ 'subtitle' | translate }}</p>
        </div>
        <div class="slim-page__actions">
          <label class="slim-filter" [attr.title]="'year_info' | translate">
            {{ 'year' | translate }}
            <select
              class="slim-select"
              [value]="year()"
              (change)="year.set(+$any($event.target).value)"
              [attr.aria-describedby]="'area-year-info'"
            >
              @for (y of years; track y) {
                <option [value]="y">{{ y }}</option>
              }
            </select>
          </label>
          <app-table-export testId="area-export" [source]="exportSource" [disabled]="!filtered().length" />
        </div>
      </div>

      <p class="slim-text--muted slim-text--xs area__year-info" id="area-year-info">
        {{ 'year_info' | translate }}
      </p>

      @if (error()) {
        <div class="slim-alert slim-alert--danger slim-u-mb-4">
          <div class="slim-alert__body">{{ error() }}</div>
        </div>
      }

      <section class="slim-card slim-card--bleed">
        <div class="slim-toolbar">
          <div class="slim-search slim-toolbar__grow">
            <svg
              class="slim-search__icon"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="7"
                cy="7"
                r="5"
                stroke="currentColor"
                stroke-width="1.6"
              />
              <path
                d="M11 11l3.5 3.5"
                stroke="currentColor"
                stroke-width="1.6"
              />
            </svg>
            <input
              class="slim-search__input"
              type="search"
              [placeholder]="'search_placeholder' | translate"
              [value]="query()"
              (input)="query.set($any($event.target).value)"
            />
          </div>
          <button
            type="button"
            class="slim-btn slim-btn--sm area__attention"
            [class.slim-btn--primary]="attention()"
            [attr.aria-pressed]="attention()"
            [attr.title]="'filter.attention_info' | translate"
            data-testid="area-filter-attention"
            (click)="attention.set(!attention())"
          >
            {{ 'filter.attention' | translate }}
          </button>
          <label class="slim-filter area__status">
            {{ 'columns.quota' | translate }}
            <select
              class="slim-select"
              [value]="quotaFilter()"
              (change)="quotaFilter.set($any($event.target).value)"
              data-testid="area-filter-quota"
            >
              <option value="">{{ 'filter.all' | translate }}</option>
              <option value="ok">{{ 'status_area.ok' | translate }}</option>
              <option value="warn">{{ 'status_area.warn' | translate }}</option>
              <option value="over">{{ 'status_area.over' | translate }}</option>
              <option value="none">{{ 'status_area.none' | translate }}</option>
            </select>
          </label>
          <label class="slim-filter area__status">
            {{ 'columns.noise' | translate }}
            <select
              class="slim-select"
              [value]="noiseFilter()"
              (change)="noiseFilter.set($any($event.target).value)"
              data-testid="area-filter-noise"
            >
              <option value="">{{ 'filter.all' | translate }}</option>
              <option value="ok">{{ 'status_area.ok' | translate }}</option>
              <option value="warn">{{ 'status_area.warn' | translate }}</option>
              <option value="over">{{ 'status_area.over' | translate }}</option>
              <option value="incomplete">{{ 'status_area.incomplete' | translate }}</option>
              <option value="none">{{ 'status_area.none' | translate }}</option>
            </select>
          </label>
          <div class="slim-toolbar__meta">
            <span>{{ 'count' | translate: { n: all().length } }}</span>
            <span class="slim-toolbar__lock">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect
                  x="3"
                  y="7"
                  width="10"
                  height="7"
                  rx="1.5"
                  stroke="currentColor"
                  stroke-width="1.4"
                />
                <path
                  d="M5.5 7V5a2.5 2.5 0 015 0v2"
                  stroke="currentColor"
                  stroke-width="1.4"
                />
              </svg>
              {{ 'scope_lock' | translate }}
            </span>
          </div>
        </div>

        <div class="slim-table-wrap area__table-wrap">
          <table class="slim-table slim-table--stack slim-table--compact">
            <thead>
              <tr>
                <th class="slim-table__cell--check">
                  <app-table-select testId="area-select-all" [selection]="selection" [shown]="shownIds()" [label]="'common.table.select_all' | translate" />
                </th>
                <th appSort="name" [sort]="sort" data-testid="area-sort-name">{{ 'columns.name' | translate }}</th>
                <th appSort="ka" [sort]="sort" data-testid="area-sort-ka">{{ 'columns.ka' | translate }}</th>
                <th appSort="sp" [sort]="sort">{{ 'columns.sp' | translate }}</th>
                <th appSort="quota" [sort]="sort" data-testid="area-sort-quota">
                  {{ 'columns.quota' | translate }}
                  <span
                    class="area__info"
                    [title]="'columns.quota_info' | translate"
                    >i</span
                  >
                </th>
                <th appSort="noise" [sort]="sort">
                  {{ 'columns.noise' | translate }}
                  <span
                    class="area__info"
                    [title]="'columns.noise_info' | translate"
                    >i</span
                  >
                </th>
                <th class="slim-table__cell--actions">
                  {{ 'columns.nav' | translate }}
                </th>
              </tr>
            </thead>
            <tbody>
              @for (r of rows(); track r.id) {
                <tr
                  class="slim-table__row slim-table__row--clickable"
                  data-testid="area-row"
                  [appSelectRow]="r.id"
                  [selection]="selection"
                  [shown]="shownIds()"
                  (click)="open($event, r.id)"
                >
                  <td class="slim-table__cell--check" [attr.data-label]="'common.table.select_row' | translate">
                    <app-table-select testId="area-select" [selection]="selection" [shown]="shownIds()" [rowId]="r.id" [label]="'common.table.select_row' | translate" />
                  </td>
                  <td [attr.data-label]="'columns.name' | translate">
                    <a
                      class="area__name"
                      [routerLink]="routes.admin.area.details(r.id)"
                      [attr.title]="'actions.details_hint' | translate"
                      >{{ r.name }}</a
                    >
                  </td>
                  <td
                    [attr.data-label]="'columns.ka' | translate"
                    class="slim-table__cell--num area__num"
                  >
                    {{ r.coordinationSectionNo }}
                  </td>
                  <td
                    [attr.data-label]="'columns.sp' | translate"
                    class="slim-table__cell--num"
                    [class.slim-text--muted]="!r.sectoralPlanNo"
                  >
                    {{ r.sectoralPlanNo ?? '—' }}
                  </td>
                  <td [attr.data-label]="'columns.quota' | translate">
                    <app-status-pill kind="quota" [status]="r.quotaStatus" [reason]="r.quotaStatusReason" [basis]="quotaBasis(r)" />
                  </td>
                  <td [attr.data-label]="'columns.noise' | translate">
                    <app-status-pill kind="noise" [status]="r.noiseStatus" [reason]="r.noiseStatusReason" [basis]="noiseBasis(r)" />
                  </td>
                  <td
                    [attr.data-label]="'columns.nav' | translate"
                    class="slim-table__cell--actions"
                  >
                    <div class="slim-row-actions area__actions">
                      @for (action of rowActions; track action.id) {
                        <a
                          class="slim-btn slim-btn--ghost slim-btn--icon slim-btn--sm"
                          [routerLink]="action.link(r.id)"
                          [attr.title]="action.key + '_hint' | translate"
                          [attr.aria-label]="action.key + '_hint' | translate"
                          [attr.data-testid]="'area-action-' + action.id"
                          (click)="$event.stopPropagation()"
                        >
                          <svg class="slim-btn__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path [attr.d]="action.icon" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                          </svg>
                        </a>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="slim-table__cell--wrap">
                    <div class="slim-empty">
                      @if (loading()) {
                        <span class="slim-spinner"></span>
                      } @else {
                        <div class="slim-empty__text">
                          {{ 'empty' | translate }}
                        </div>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="slim-table-foot">
          <span>{{
            filtered().length
              ? ('foot_count'
                | translate: { n: filtered().length, total: filtered().length })
              : ('count' | translate: { n: 0 })
          }}</span>
          @if (selection.count()) {
            <span data-testid="area-selected">· {{ 'common.table.selected' | translate: { n: selection.count() } }}</span>
          }
          <span class="slim-table-foot__grow"></span>
          <div class="slim-pager">
            <button
              type="button"
              class="slim-pager__btn"
              disabled
              aria-label="‹"
            >
              ‹
            </button>
            <button
              type="button"
              class="slim-pager__btn slim-pager__btn--active"
            >
              1
            </button>
            <button
              type="button"
              class="slim-pager__btn"
              disabled
              aria-label="›"
            >
              ›
            </button>
          </div>
        </div>
      </section>

      <div class="slim-legend" [attr.aria-label]="'legend' | translate">
        @for (s of legend; track s) {
          <span class="slim-legend__item"
            ><app-status-pill [status]="s" [attr.title]="'legend_hint.' + s | translate"
          /></span>
        }
        <span class="slim-legend__item slim-text--muted">{{ 'legend_note' | translate }}</span>
      </div>
    </div>
  `,
})
export class AreaOverviewComponent extends ComponentBase {
  private readonly area = inject(AreaFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly routes = APP_ROUTES;
  protected readonly sort = new TableSort<SortKey>();
  protected readonly selection = new TableSelection();
  protected readonly years = [2026, 2025, 2024];
  protected readonly legend: AreaStatus[] = ['ok', 'warn', 'over', 'incomplete', 'none'];

  /** Icon row actions (ELO collections look): the four pages of a Schiessplatz. */
  protected readonly rowActions = [
    { id: 'overview', key: 'actions.overview', link: APP_ROUTES.admin.area.overview, icon: ICON.home },
    { id: 'shots', key: 'actions.shots', link: APP_ROUTES.admin.area.shots, icon: ICON.target },
    { id: 'details', key: 'actions.details', link: APP_ROUTES.admin.area.details, icon: ICON.info },
    { id: 'simulation', key: 'actions.simulation', link: APP_ROUTES.admin.area.simulation, icon: ICON.chart },
  ];

  protected readonly year = signal(this.years[0]);
  protected readonly query = signal('');

  private readonly attentionFromUrl = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('status') === 'attention')),
    { initialValue: false },
  );
  // Query param seeds the filter (home notice → ?status=attention), the
  // toggle overrides it until the param changes again.
  protected readonly attention = linkedSignal<boolean>(() => this.attentionFromUrl());
  /** Separate filters per light: «Status: Alle» did not say which one it filtered. */
  protected readonly quotaFilter = signal<StatusFilter>('');
  protected readonly noiseFilter = signal<StatusFilter>('');

  protected readonly all = this.area.areas;
  protected readonly loading = this.area.loading;
  protected readonly error = this.area.error;

  protected readonly filtered = computed<AreaResultDto[]>(() => {
    const q = this.query().trim().toLowerCase();
    const quota = this.quotaFilter();
    const noise = this.noiseFilter();
    return this.all().filter((r) => {
      if (
        q &&
        !r.name.toLowerCase().includes(q) &&
        !r.coordinationSectionNo.includes(q)
      ) {
        return false;
      }
      if (this.attention() && !needsAttention(r)) return false;
      if (quota && r.quotaStatus !== quota) return false;
      if (noise && r.noiseStatus !== noise) return false;
      return true;
    });
  });

  /** The rows as shown: filtered, then in the order of the chosen column (B1 5.5.2). */
  protected readonly rows = computed(() => this.sort.apply(this.filtered(), SORT_VALUES));
  protected readonly shownIds = computed(() => this.rows().map((r) => r.id));

  /** A plain click opens the Schiessplatz; Ctrl / Shift + click marks the row (B1 5.5.3). */
  protected open(event: MouseEvent, id: string): void {
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
    void this.router.navigateByUrl(APP_ROUTES.admin.area.details(id));
  }

  /** Data behind the Kontingent light: the year window the API compared. */
  protected quotaBasis(r: AreaResultDto): string | null {
    if (!r.statusYear) return null;
    return this.translate.translate('basis.quota', { year: r.statusYear, from: r.statusYear - 2 }) ?? null;
  }

  /** Data behind the noise light: the current Zustand and the year. */
  protected noiseBasis(r: AreaResultDto): string | null {
    if (!r.noiseStatusBasis) return null;
    return this.translate.translate('basis.noise', { state: r.noiseStatusBasis, year: r.statusYear ?? '' }) ?? null;
  }

  /** The table as shown (search, filters and sorting applied), or the marked rows, for the Excel-/CSV-Export (B1 5.5.5, slm 3). */
  protected readonly exportSource = (): TableExportData => {
    const t = (key: string) => this.translate.translate(key) ?? key;
    const picked = this.selection.pick(this.rows(), (r) => r.id);
    const status = (value: StatusFilter) => (value ? t(`status_area.${value}`) : null);
    return tableExport<AreaResultDto>({
      table: EXPORT_TABLE,
      title: t('title'),
      filters: [
        { label: t('filter.search'), value: this.query().trim() },
        { label: t('columns.quota'), value: status(this.quotaFilter()) },
        { label: t('columns.noise'), value: status(this.noiseFilter()) },
        { label: t('filter.attention'), value: this.attention() ? t('common.yes') : null },
      ],
      columns: [
        { header: t('columns.name'), value: (r) => r.name },
        { header: t('columns.ka'), value: (r) => r.coordinationSectionNo },
        { header: t('columns.sp'), value: (r) => r.sectoralPlanNo ?? null },
        { header: t('columns.quota'), value: (r) => t(statusLabelKey(r.quotaStatus, r.quotaStatusReason)) },
        { header: t('columns.noise'), value: (r) => t(statusLabelKey(r.noiseStatus, r.noiseStatusReason)) },
        { header: t('columns.noise_basis'), value: (r) => r.noiseStatusBasis ?? null },
        { header: t('year'), value: (r) => r.statusYear ?? null },
      ],
      rows: picked.rows,
      selection: picked.selection,
    });
  };

  /** ComponentBase calls this on init and on every DATA_RELOAD emit. */
  override getData(): void {
    void this.area.load();
  }
}

const ICON = {
  home: 'M2 7.5L8 2.5l6 5V13a1 1 0 01-1 1h-3.5v-4h-3v4H3a1 1 0 01-1-1V7.5z',
  target: 'M8 2a6 6 0 100 12A6 6 0 008 2zm0 3a3 3 0 100 6 3 3 0 000-6z',
  info: 'M8 1.7a6.3 6.3 0 100 12.6A6.3 6.3 0 008 1.7zM8 7.2v4M8 5v.2',
  chart: 'M2 12l4-5 3 3 5-6',
} as const;
