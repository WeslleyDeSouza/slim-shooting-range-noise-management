import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { APP_ROUTES } from '@slim/shared';
import type { AreaResultDto } from '@ui-slim/apiClient';
import { AreaFacade } from '../../../../core/area/area.facade';

type SortKey = 'coordinationSectionNo' | 'sectoralPlanNo' | 'name';

const I18N = 'admin.dm_area';

/**
 * 5.14 Datenverwaltung › Schiessplatz › Übersicht (mock
 * _mocks/data-management/area.index.html, B1 slm 13): search over name,
 * Koordinationsabschnitt-Nr. and Sachplan-Nr., sortable table, jumps to
 * Allgemein (5.15/5.16), Zuordnung Waffen (5.17) and Berechnungen (5.18).
 * No «Neuer Schiessplatz» — ranges come from the import / DB administration.
 * Data: AreaFacade (already scoped to the user's ranges by the API).
 */
@Component({
  selector: 'app-dm-area-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  styleUrl: './dm-area-overview.component.scss',
  template: `
    <div class="slim-page dma">
      <ol class="slim-breadcrumbs">
        <li class="slim-breadcrumbs__item">
          <a [routerLink]="routes.admin.home">{{ 'shell.home' | translate }}</a>
        </li>
        <li class="slim-breadcrumbs__item">
          <a [routerLink]="routes.admin.dataManagement.root">{{
            'menu.data_management' | translate
          }}</a>
        </li>
        <li class="slim-breadcrumbs__item">{{ 'menu.area' | translate }}</li>
        <li class="slim-breadcrumbs__item slim-breadcrumbs__item--current">
          {{ 'menu.area_overview' | translate }}
        </li>
      </ol>

      <div class="slim-page__header">
        <div>
          <h1 class="slim-page__title">{{ prefix + '.title' | translate }}</h1>
          <p class="slim-page__subtitle">
            {{ prefix + '.subtitle' | translate }}
          </p>
        </div>
      </div>

      @if (error(); as message) {
        <div class="slim-alert slim-alert--danger slim-u-mb-4">
          <div class="slim-alert__body">{{ message }}</div>
        </div>
      }

      <div class="slim-alert slim-alert--info slim-u-mb-4" data-testid="dma-no-create">
        <div class="slim-alert__body">{{ prefix + '.no_create' | translate }}</div>
      </div>

      <section class="slim-card slim-card--bleed">
        <div class="slim-toolbar">
          <div class="slim-search slim-toolbar__grow">
            <svg class="slim-search__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.6" />
              <path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.6" />
            </svg>
            <input
              class="slim-search__input"
              type="search"
              data-testid="dma-search"
              [placeholder]="prefix + '.search_placeholder' | translate"
              [value]="query()"
              (input)="query.set($any($event.target).value)"
            />
          </div>
          <div class="slim-toolbar__meta">
            <span data-testid="dma-count">{{
              prefix + '.count'
                | translate: { n: filtered().length, total: all().length }
            }}</span>
            <span class="slim-toolbar__lock">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.4" />
                <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" stroke-width="1.4" />
              </svg>
              {{ prefix + '.scope_lock' | translate }}
            </span>
          </div>
        </div>

        <div class="slim-table-wrap dma__table-wrap">
          <table class="slim-table slim-table--stack slim-table--compact">
            <thead>
              <tr>
                @for (col of columns; track col.key) {
                  <th
                    [attr.aria-sort]="sortKey() === col.key ? (sortAsc() ? 'ascending' : 'descending') : null"
                  >
                    <button
                      type="button"
                      class="dma__sort"
                      [class.dma__sort--active]="sortKey() === col.key"
                      [attr.title]="prefix + '.sort' | translate: { col: (prefix + '.' + col.label | translate) }"
                      (click)="sortBy(col.key)"
                    >
                      {{ prefix + '.' + col.label | translate }}
                      <span class="dma__sort-mark" aria-hidden="true">{{
                        sortKey() === col.key ? (sortAsc() ? '▴' : '▾') : ''
                      }}</span>
                    </button>
                  </th>
                }
                <th>{{ prefix + '.col_active' | translate }}</th>
                <th class="slim-table__cell--actions">
                  {{ prefix + '.col_nav' | translate }}
                </th>
              </tr>
            </thead>
            <tbody>
              @for (r of filtered(); track r.id) {
                <tr
                  class="slim-table__row slim-table__row--clickable"
                  [attr.data-testid]="'dma-row-' + r.id"
                  [routerLink]="routes.admin.dataManagement.area.masterDataOf(r.id)"
                >
                  <td
                    [attr.data-label]="prefix + '.col_ka' | translate"
                    class="slim-table__cell--num dma__num"
                  >
                    {{ r.coordinationSectionNo }}
                  </td>
                  <td
                    [attr.data-label]="prefix + '.col_sp' | translate"
                    class="slim-table__cell--num"
                    [class.slim-text--muted]="!r.sectoralPlanNo"
                  >
                    {{ r.sectoralPlanNo ?? '—' }}
                  </td>
                  <td [attr.data-label]="prefix + '.col_name' | translate">
                    <a
                      class="dma__name"
                      [routerLink]="routes.admin.dataManagement.area.masterDataOf(r.id)"
                      >{{ r.name }}</a
                    >
                  </td>
                  <td [attr.data-label]="prefix + '.col_active' | translate">
                    <span
                      class="slim-badge"
                      [class.slim-badge--success]="r.enabled"
                      >{{ prefix + (r.enabled ? '.active' : '.inactive') | translate }}</span
                    >
                  </td>
                  <td
                    [attr.data-label]="prefix + '.col_nav' | translate"
                    class="slim-table__cell--actions"
                  >
                    <div class="slim-row-actions dma__actions">
                      @for (action of rowActions; track action.id) {
                        <a
                          class="slim-btn slim-btn--ghost slim-btn--icon slim-btn--sm"
                          [routerLink]="action.link(r.id)"
                          [attr.title]="prefix + '.' + action.key | translate"
                          [attr.aria-label]="prefix + '.' + action.key | translate"
                          [attr.data-testid]="'dma-action-' + action.id"
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
                  <td colspan="5" class="slim-table__cell--wrap">
                    <div class="slim-empty">
                      @if (loading()) {
                        <span class="slim-spinner"></span>
                      } @else {
                        <div class="slim-empty__text">
                          {{ prefix + '.empty' | translate }}
                        </div>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
})
export class DmAreaOverviewComponent extends ComponentBase {
  private readonly area = inject(AreaFacade);

  protected readonly prefix = I18N;
  protected readonly routes = APP_ROUTES;

  protected readonly columns: { key: SortKey; label: string }[] = [
    { key: 'coordinationSectionNo', label: 'col_ka' },
    { key: 'sectoralPlanNo', label: 'col_sp' },
    { key: 'name', label: 'col_name' },
  ];

  /** Jumps of 5.14: Allgemein (5.15/5.16), Zuordnung Waffen (5.17), Berechnungen (5.18). */
  protected readonly rowActions = [
    { id: 'general', key: 'jump_general', link: APP_ROUTES.admin.dataManagement.area.masterDataOf, icon: ICON.layers },
    { id: 'weapons', key: 'jump_weapons', link: APP_ROUTES.admin.dataManagement.area.weaponAssignmentOf, icon: ICON.weapon },
    { id: 'calculations', key: 'jump_calculations', link: APP_ROUTES.admin.dataManagement.area.calculationsOf, icon: ICON.list },
  ];

  protected readonly query = signal('');
  protected readonly sortKey = signal<SortKey>('name');
  protected readonly sortAsc = signal(true);

  protected readonly all = this.area.areas;
  protected readonly loading = this.area.loading;
  protected readonly error = this.area.error;

  protected readonly filtered = computed<AreaResultDto[]>(() => {
    const q = this.query().trim().toLowerCase();
    const key = this.sortKey();
    const dir = this.sortAsc() ? 1 : -1;
    return this.all()
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.coordinationSectionNo.toLowerCase().includes(q) ||
          (r.sectoralPlanNo ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => {
        const x = (a[key] ?? '').toLowerCase();
        const y = (b[key] ?? '').toLowerCase();
        // Empty values (no Sachplan-Nr.) always sort last.
        if (x === '' && y !== '') return 1;
        if (y === '' && x !== '') return -1;
        return x.localeCompare(y, 'de-CH', { numeric: true }) * dir;
      });
  });

  sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortAsc.update((asc) => !asc);
    } else {
      this.sortKey.set(key);
      this.sortAsc.set(true);
    }
  }

  /** ComponentBase calls this on init and on every DATA_RELOAD emit. */
  override getData(): void {
    void this.area.load();
  }
}

const ICON = {
  layers: 'M2 5l4-2 4 2 4-2v9l-4 2-4-2-4 2V5zM6 3v9M10 5v9',
  weapon: 'M2 10h9l3-3M6 10v3M9 10v3',
  list: 'M3 3h10M3 8h10M3 13h10M6 1.5v3M10 6.5v3M5 11.5v3',
} as const;
