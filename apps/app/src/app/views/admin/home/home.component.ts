import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { environment } from '../../../../environments/environment';
import { RangesService } from '../../../core/ranges/ranges.service';

/**
 * Entry page (mock `_mocks/home/index.html` → "Einstiegsseite"): greeting,
 * attention notice, entry tiles with KPIs.
 */
@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, DatePipe],
  styleUrl: './home.component.scss',
  template: `
    <div class="slim-page home">
      <div class="slim-hello">
        <div class="slim-hello__greet">{{ greeting() | translate }}</div>
        <div class="slim-hello__name">{{ user().name }}</div>
        <div class="slim-hello__sub">
          <span>{{ today | date: 'EEEE, d. MMMM y' }}</span>
          <span aria-hidden="true">·</span>
          <span>{{ 'authorized_for' | translate: { n: summary().total } }}</span>
          <span class="slim-home__status">
            @if (apiStatus() === 'ok') {
              <span class="slim-badge slim-badge--success"><span class="slim-badge__dot"></span>{{ 'status.online' | translate }}</span>
            } @else if (apiStatus() === 'error') {
              <span class="slim-badge slim-badge--danger"><span class="slim-badge__dot"></span>{{ 'status.offline' | translate }}</span>
            }
          </span>
        </div>
      </div>

      @if (attention().length > 0) {
        <div class="slim-alert slim-alert--warning home__notice">
          <svg class="slim-alert__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1.5L15 14H1L8 1.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 6v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="12" r=".8" fill="currentColor"/></svg>
          <div class="slim-alert__body">
            <b>{{ 'notice.title' | translate: { n: attention().length } }}</b>
            {{ 'notice.text' | translate: { over: summary().over, warn: summary().warn } }}
            <a routerLink="/schiessplaetze" [queryParams]="{ status: 'attention' }">{{ 'notice.show' | translate }}</a>
          </div>
        </div>
      }

      <div class="slim-tiles">
        <a class="slim-tile" routerLink="/schiessplaetze">
          <span class="slim-tile__icon">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r=".8" fill="currentColor"/></svg>
          </span>
          <span class="slim-tile__title">{{ 'tiles.ranges.title' | translate }}</span>
          <span class="slim-tile__text">{{ 'tiles.ranges.text' | translate }}</span>
          <span class="slim-tile__kpi">
            <span><b>{{ summary().total }}</b> {{ 'tiles.ranges.kpi_total' | translate }}</span>
            <span><b>{{ summary().ok }}</b> {{ 'tiles.ranges.kpi_ok' | translate }}</span>
            <span><b>{{ summary().warn }}</b> {{ 'tiles.ranges.kpi_warn' | translate }}</span>
            <span><b>{{ summary().over }}</b> {{ 'tiles.ranges.kpi_over' | translate }}</span>
          </span>
          <span class="slim-tile__foot">{{ 'tiles.ranges.foot' | translate }}
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
        </a>

        <a class="slim-tile" routerLink="/admin/schiessplatz">
          <span class="slim-tile__icon slim-tile__icon--neutral">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><ellipse cx="8" cy="4" rx="5.5" ry="2" stroke="currentColor" stroke-width="1.4"/><path d="M2.5 4v8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V4M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2" stroke="currentColor" stroke-width="1.4"/></svg>
          </span>
          <span class="slim-tile__title">{{ 'tiles.data.title' | translate }}</span>
          <span class="slim-tile__text">{{ 'tiles.data.text' | translate }}</span>
          <span class="slim-tile__kpi">
            <span><b>{{ masterData().ranges }}</b> {{ 'tiles.data.kpi_ranges' | translate }}</span>
            <span><b>{{ masterData().weapons }}</b> {{ 'tiles.data.kpi_weapons' | translate }}</span>
            <span><b>{{ masterData().users }}</b> {{ 'tiles.data.kpi_users' | translate }}</span>
          </span>
          <span class="slim-tile__foot slim-tile__foot--muted">{{ 'tiles.data.foot' | translate }}
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
        </a>

        <div class="slim-tile slim-tile--disabled" aria-disabled="true">
          <span class="slim-tile__icon slim-tile__icon--neutral">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 13.5h11M4 11V7M8 11V4M12 11V8.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          </span>
          <span class="slim-tile__title">{{ 'tiles.reports.title' | translate }}</span>
          <span class="slim-tile__text">{{ 'tiles.reports.text' | translate }}</span>
          <span class="slim-tile__foot">{{ 'tiles.reports.foot' | translate }}</span>
        </div>
      </div>
    </div>
  `,
})
export class HomeComponent {
  private readonly http = inject(HttpClient);
  private readonly rangesService = inject(RangesService);

  protected readonly today = new Date();
  protected readonly user = this.rangesService.user;
  protected readonly summary = this.rangesService.summary;
  protected readonly attention = this.rangesService.attention;
  protected readonly masterData = this.rangesService.masterData;

  protected readonly greeting = computed(() => {
    const hour = this.today.getHours();
    return hour < 11 ? 'greet.morning' : hour < 17 ? 'greet.day' : 'greet.evening';
  });

  protected readonly apiStatus = toSignal(
    this.http
      .get<{ status: string }>(`${environment.api.url}/health/alive`)
      .pipe(
        map((res) => res.status),
        catchError(() => of('error')),
      ),
    { initialValue: 'pending' },
  );
}
