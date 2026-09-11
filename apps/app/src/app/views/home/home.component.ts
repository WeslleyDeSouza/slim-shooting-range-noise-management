import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { APP_TITLE } from '@slim/shared';
import { SlimThemeToggleComponent } from '@ui-slim/design-system';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SlimThemeToggleComponent],
  template: `
    <div class="slim-shell">
      <header class="slim-topbar slim-shell__topbar">
        <a class="slim-topbar__brand" routerLink="/">
          <span class="slim-topbar__mark"></span>
          SLIM
        </a>
        <div class="slim-topbar__actions">
          <slim-theme-toggle />
        </div>
      </header>

      <main class="slim-page slim-shell__main slim-home">
        <div class="slim-page__header">
          <div>
            <h1 class="slim-page__title">{{ title }}</h1>
            <p class="slim-page__subtitle">Angular 22 · NestJS 12 · Nx</p>
          </div>
        </div>

        <div class="slim-page__body">
          <section class="slim-card">
            <div class="slim-card__body slim-u-flex-between">
              <span class="slim-text--secondary">API</span>
              <span class="slim-home__status">
                @if (apiStatus() === 'ok') {
                  <span class="slim-badge slim-badge--success">
                    <span class="slim-badge__dot"></span>online
                  </span>
                } @else if (apiStatus() === 'error') {
                  <span class="slim-badge slim-badge--danger">
                    <span class="slim-badge__dot"></span>offline
                  </span>
                } @else {
                  <span class="slim-spinner slim-spinner--sm"></span>
                }
              </span>
            </div>
          </section>

          <a class="slim-btn slim-btn--secondary slim-btn--block-mobile" routerLink="/styleguide">
            Styleguide öffnen
          </a>
        </div>
      </main>
    </div>
  `,
})
export class HomeComponent {
  private readonly http = inject(HttpClient);

  protected readonly title = APP_TITLE;

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
