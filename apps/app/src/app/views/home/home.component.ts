import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import { APP_TITLE } from '@slim/shared';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="slim-home container py-5">
      <h1 class="slim-home__title h3">{{ title }}</h1>
      <p class="text-muted">Angular 22 · NestJS 12 · Nx</p>
      <p class="slim-home__status">
        API:
        @if (apiStatus() === 'ok') {
          <span class="badge text-bg-success">online</span>
        } @else if (apiStatus() === 'error') {
          <span class="badge text-bg-danger">offline</span>
        } @else {
          <span class="badge text-bg-secondary">…</span>
        }
      </p>
    </main>
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
