import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-error-404',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <main class="slim-page slim-error">
      <div class="slim-empty">
        <div class="slim-empty__title slim-h1">404</div>
        <p class="slim-empty__text">Seite nicht gefunden.</p>
        <a class="slim-btn slim-btn--primary slim-empty__action" routerLink="/">
          Zur Startseite
        </a>
      </div>
    </main>
  `,
})
export class Error404Component {}
