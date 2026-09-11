import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import { APP_ROUTES } from '@slim/shared';
import { AreaFacade } from '../../../core/area/area.facade';
import { AuthFacade } from '../../auth/auth.facade';

/**
 * Entry page (mock `_mocks/home/index.html` → "Einstiegsseite"): greeting,
 * attention notice, entry tiles with KPIs from the API (AreaFacade).
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
        <div class="slim-hello__name">{{ userName() }}</div>
        <div class="slim-hello__sub">
          <span>{{ today | date: 'EEEE, d. MMMM y' }}</span>
          <span aria-hidden="true">·</span>
          <span>{{
            'authorized_for' | translate: { n: summary().total }
          }}</span>
          @if (loading()) {
            <span class="slim-spinner slim-spinner--sm"></span>
          }
        </div>
      </div>

      @if (error()) {
        <div class="slim-alert slim-alert--danger home__notice">
          <div class="slim-alert__body">{{ error() }}</div>
        </div>
      }

      @if (summary().attention > 0) {
        <div class="slim-alert slim-alert--warning home__notice">
          <svg
            class="slim-alert__icon"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8 1.5L15 14H1L8 1.5z"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linejoin="round"
            />
            <path
              d="M8 6v4"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
            />
            <circle cx="8" cy="12" r=".8" fill="currentColor" />
          </svg>
          <div class="slim-alert__body">
            <b>{{ 'notice.title' | translate: { n: summary().attention } }}</b>
            {{
              'notice.text'
                | translate: { over: summary().over, warn: summary().warn }
            }}
            <a
              [routerLink]="routes.admin.area.root"
              [queryParams]="{ status: 'attention' }"
              >{{ 'notice.show' | translate }}</a
            >
          </div>
        </div>
      }

      <div class="slim-tiles">
        <a class="slim-tile" [routerLink]="routes.admin.area.root">
          <span class="slim-tile__icon">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle
                cx="8"
                cy="8"
                r="6"
                stroke="currentColor"
                stroke-width="1.5"
              />
              <circle
                cx="8"
                cy="8"
                r="3"
                stroke="currentColor"
                stroke-width="1.5"
              />
              <circle cx="8" cy="8" r=".8" fill="currentColor" />
            </svg>
          </span>
          <span class="slim-tile__title">{{
            'tiles.area.title' | translate
          }}</span>
          <span class="slim-tile__text">{{
            'tiles.area.text' | translate
          }}</span>
          <span class="slim-tile__kpi">
            <span
              ><b>{{ summary().total }}</b>
              {{ 'tiles.area.kpi_total' | translate }}</span
            >
            <span
              ><b>{{ summary().ok }}</b>
              {{ 'tiles.area.kpi_ok' | translate }}</span
            >
            <span
              ><b>{{ summary().warn }}</b>
              {{ 'tiles.area.kpi_warn' | translate }}</span
            >
            <span
              ><b>{{ summary().over }}</b>
              {{ 'tiles.area.kpi_over' | translate }}</span
            >
          </span>
          <span class="slim-tile__foot"
            >{{ 'tiles.area.foot' | translate }}
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M6 3l5 5-5 5"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
        </a>

        <a
          class="slim-tile"
          [routerLink]="routes.admin.dataManagement.area.root"
        >
          <span class="slim-tile__icon slim-tile__icon--neutral">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <ellipse
                cx="8"
                cy="4"
                rx="5.5"
                ry="2"
                stroke="currentColor"
                stroke-width="1.4"
              />
              <path
                d="M2.5 4v8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V4M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2"
                stroke="currentColor"
                stroke-width="1.4"
              />
            </svg>
          </span>
          <span class="slim-tile__title">{{
            'tiles.data.title' | translate
          }}</span>
          <span class="slim-tile__text">{{
            'tiles.data.text' | translate
          }}</span>
          @if (dashboard(); as kpi) {
            <span class="slim-tile__kpi">
              <span
                ><b>{{ kpi.areas }}</b>
                {{ 'tiles.data.kpi_areas' | translate }}</span
              >
              @if (kpi.weapons !== null) {
                <span
                  ><b>{{ kpi.weapons }}</b>
                  {{ 'tiles.data.kpi_weapons' | translate }}</span
                >
              }
              <span
                ><b>{{ kpi.users }}</b>
                {{ 'tiles.data.kpi_users' | translate }}</span
              >
            </span>
          }
          <span class="slim-tile__foot slim-tile__foot--muted"
            >{{ 'tiles.data.foot' | translate }}
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M6 3l5 5-5 5"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
        </a>

        <div class="slim-tile slim-tile--disabled" aria-disabled="true">
          <span class="slim-tile__icon slim-tile__icon--neutral">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M2.5 13.5h11M4 11V7M8 11V4M12 11V8.5"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
              />
            </svg>
          </span>
          <span class="slim-tile__title">{{
            'tiles.reports.title' | translate
          }}</span>
          <span class="slim-tile__text">{{
            'tiles.reports.text' | translate
          }}</span>
          <span class="slim-tile__foot">{{
            'tiles.reports.foot' | translate
          }}</span>
        </div>
      </div>
    </div>
  `,
})
export class HomeComponent extends ComponentBase {
  private readonly area = inject(AreaFacade);
  private readonly auth = inject(AuthFacade);
  private readonly translate = inject(TranslateService);

  protected readonly routes = APP_ROUTES;
  protected readonly today = new Date();
  protected readonly userName = computed(
    () =>
      this.auth.currentUserName() ||
      this.translate.translate('shell.user') ||
      '',
  );
  protected readonly summary = this.area.summary;
  protected readonly dashboard = this.area.dashboard;
  protected readonly loading = this.area.loading;
  protected readonly error = this.area.error;

  protected readonly greeting = computed(() => {
    const hour = this.today.getHours();
    return hour < 11
      ? 'greet.morning'
      : hour < 17
        ? 'greet.day'
        : 'greet.evening';
  });

  /** ComponentBase calls this on init and on every DATA_RELOAD emit. */
  override getData(): void {
    void this.area.load();
  }
}
