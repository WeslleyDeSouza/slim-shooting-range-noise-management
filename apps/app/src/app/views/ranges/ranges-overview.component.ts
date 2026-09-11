import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { StatusPillComponent } from '../../common/status-pill.component';
import {
  needsAttention,
  RangeStatus,
  ShootingRange,
} from '../../core/ranges/ranges.model';
import { RangesService } from '../../core/ranges/ranges.service';

type StatusFilter = '' | 'attention' | RangeStatus;

/**
 * "Übersicht Schiessplätze" (mock view-plaetze, chapters 5.8 / 5.9):
 * breadcrumbs, year + export, search + status filter, table with
 * traffic-light pills and row actions, pager, legend.
 */
@Component({
  selector: 'app-ranges-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, StatusPillComponent],
  styleUrl: './ranges-overview.component.scss',
  template: `
    <div class="slim-page ranges">
      <ol class="slim-breadcrumbs">
        <li class="slim-breadcrumbs__item"><a routerLink="/">{{ 'shell.home' | translate }}</a></li>
        <li class="slim-breadcrumbs__item"><a routerLink="/schiessplaetze">{{ 'tiles.ranges.title' | translate }}</a></li>
        <li class="slim-breadcrumbs__item slim-breadcrumbs__item--current">{{ 'menu.range_overview' | translate }}</li>
      </ol>

      <div class="slim-page__header">
        <div>
          <h1 class="slim-page__title">{{ 'title' | translate }}</h1>
          <p class="slim-page__subtitle">{{ 'subtitle' | translate }}</p>
        </div>
        <div class="slim-page__actions">
          <label class="slim-filter">
            {{ 'year' | translate }}
            <select class="slim-select" [value]="year()" (change)="year.set(+$any($event.target).value)">
              @for (y of years; track y) {
                <option [value]="y">{{ y }}</option>
              }
            </select>
          </label>
          <button type="button" class="slim-btn">
            <svg class="slim-btn__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2v8M8 10l-3-3M8 10l3-3M2.5 13.5h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="slim-btn__label">{{ 'export' | translate }}</span>
          </button>
        </div>
      </div>

      <section class="slim-card slim-card--bleed">
        <div class="slim-toolbar">
          <div class="slim-search slim-toolbar__grow">
            <svg class="slim-search__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.6"/><path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.6"/></svg>
            <input
              class="slim-search__input"
              type="search"
              [placeholder]="'search_placeholder' | translate"
              [value]="query()"
              (input)="query.set($any($event.target).value)"
            />
          </div>
          <select class="slim-select ranges__status" [value]="status()" (change)="status.set($any($event.target).value)" [attr.aria-label]="'columns.quota' | translate">
            <option value="">{{ 'filter.all' | translate }}</option>
            <option value="attention">{{ 'filter.attention' | translate }}</option>
            <option value="ok">{{ 'status_range.ok' | translate }}</option>
            <option value="warn">{{ 'status_range.warn' | translate }}</option>
            <option value="over">{{ 'status_range.over' | translate }}</option>
            <option value="none">{{ 'status_range.none' | translate }}</option>
          </select>
          <div class="slim-toolbar__meta">
            <span>{{ 'count' | translate: { n: all().length } }}</span>
            <span class="slim-toolbar__lock">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" stroke-width="1.4"/></svg>
              {{ 'scope_lock' | translate }}
            </span>
          </div>
        </div>

        <div class="slim-table-wrap ranges__table-wrap">
          <table class="slim-table slim-table--stack">
            <thead>
              <tr>
                <th>{{ 'columns.name' | translate }}</th>
                <th>{{ 'columns.ka' | translate }}</th>
                <th>{{ 'columns.sp' | translate }}</th>
                <th>{{ 'columns.quota' | translate }} <span class="ranges__info" [title]="'columns.quota_info' | translate">i</span></th>
                <th>{{ 'columns.noise' | translate }} <span class="ranges__info" [title]="'columns.noise_info' | translate">i</span></th>
                <th class="slim-table__cell--actions">{{ 'columns.nav' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (r of filtered(); track r.id) {
                <tr class="slim-table__row slim-table__row--clickable" [routerLink]="['/schiessplaetze', r.id, 'uebersicht']">
                  <td [attr.data-label]="'columns.name' | translate"><a class="ranges__name" [routerLink]="['/schiessplaetze', r.id, 'uebersicht']">{{ r.name }}</a></td>
                  <td [attr.data-label]="'columns.ka' | translate" class="slim-table__cell--num ranges__num">{{ r.ka }}</td>
                  <td [attr.data-label]="'columns.sp' | translate" class="slim-table__cell--num" [class.slim-text--muted]="!r.sp">{{ r.sp ?? '—' }}</td>
                  <td [attr.data-label]="'columns.quota' | translate"><app-status-pill [status]="r.quota" /></td>
                  <td [attr.data-label]="'columns.noise' | translate"><app-status-pill [status]="r.noise" /></td>
                  <td [attr.data-label]="'columns.nav' | translate" class="slim-table__cell--actions">
                    <div class="slim-row-actions">
                      <a class="slim-btn slim-btn--sm slim-btn--pill" [routerLink]="['/schiessplaetze', r.id, 'uebersicht']" (click)="$event.stopPropagation()">{{ 'actions.overview' | translate }}</a>
                      <a class="slim-btn slim-btn--sm slim-btn--pill" [routerLink]="['/schiessplaetze', r.id, 'schusszahlen']" (click)="$event.stopPropagation()">{{ 'actions.shots' | translate }}</a>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="slim-table__cell--wrap">
                    <div class="slim-empty">
                      <div class="slim-empty__text">{{ 'empty' | translate }}</div>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="slim-table-foot">
          <span>{{ filtered().length ? ('foot_count' | translate: { n: filtered().length, total: filtered().length }) : ('count' | translate: { n: 0 }) }}</span>
          <span class="slim-table-foot__grow"></span>
          <div class="slim-pager">
            <button type="button" class="slim-pager__btn" disabled aria-label="‹">‹</button>
            <button type="button" class="slim-pager__btn slim-pager__btn--active">1</button>
            <button type="button" class="slim-pager__btn" disabled aria-label="›">›</button>
          </div>
        </div>
      </section>

      <div class="slim-legend" [attr.aria-label]="'legend' | translate">
        @for (s of legend; track s) {
          <span class="slim-legend__item"><app-status-pill [status]="s" /></span>
        }
      </div>
      <p class="slim-text--muted slim-text--xs slim-u-text-right">{{ 'sample_note' | translate }}</p>
    </div>
  `,
})
export class RangesOverviewComponent {
  private readonly rangesService = inject(RangesService);
  private readonly route = inject(ActivatedRoute);

  protected readonly years = [2026, 2025, 2024];
  protected readonly legend: RangeStatus[] = ['ok', 'warn', 'over', 'none'];

  protected readonly year = signal(this.years[0]);
  protected readonly query = signal('');

  private readonly statusFromUrl = toSignal(
    this.route.queryParamMap.pipe(
      map((p) => (p.get('status') ?? '') as StatusFilter),
    ),
    { initialValue: '' as StatusFilter },
  );
  // Query param seeds the filter (home notice → ?status=attention), the
  // select overrides it until the param changes again.
  protected readonly status = linkedSignal<StatusFilter>(() =>
    this.statusFromUrl(),
  );

  protected readonly all = this.rangesService.ranges;

  protected readonly filtered = computed<ShootingRange[]>(() => {
    const q = this.query().trim().toLowerCase();
    const status = this.status();
    return this.all().filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !r.ka.includes(q)) return false;
      if (status === 'attention') return needsAttention(r);
      if (status) return r.quota === status || r.noise === status;
      return true;
    });
  });
}
