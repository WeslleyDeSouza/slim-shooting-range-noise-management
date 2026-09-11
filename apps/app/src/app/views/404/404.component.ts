import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-error-404',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <main class="slim-error container py-5 text-center">
      <h1 class="slim-error__code display-4">404</h1>
      <p class="slim-error__text text-muted">Seite nicht gefunden.</p>
      <a routerLink="/" class="btn btn-primary">Zur Startseite</a>
    </main>
  `,
})
export class Error404Component {}
