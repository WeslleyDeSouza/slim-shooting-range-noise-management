import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@app-galaxy/translate-ui';

@Component({
  selector: 'app-error-404',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  template: `
    <main class="slim-page slim-error">
      <div class="slim-empty">
        <div class="slim-empty__title slim-h1">404</div>
        <p class="slim-empty__text">
          <strong>{{ 'error.404.title' | translate }}</strong><br />
          {{ 'error.404.message' | translate }}
        </p>
        <a class="slim-btn slim-btn--primary slim-empty__action" routerLink="/">
          {{ 'error.404.go_home' | translate }}
        </a>
      </div>
    </main>
  `,
})
export class Error404Component {}
