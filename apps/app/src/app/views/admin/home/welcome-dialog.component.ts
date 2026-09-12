import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { APP_ROUTES } from '@slim/shared';
import { AreaFacade } from '../../../core/area/area.facade';

/** Koordinationsabschnitt-Nr. of the prepared demo Schiessplatz («SLIM Demo» dataset). */
export const DEMO_AREA_NO = '1104.020';

/**
 * sessionStorage key: dismissed for this browser tab — survives a page reload,
 * is cleared on sign-out (`resetWelcome()`), so the next login shows it again.
 */
export const WELCOME_SEEN_KEY = 'slim.welcome.seen';

export function welcomeSeen(): boolean {
  try {
    return sessionStorage.getItem(WELCOME_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markWelcomeSeen(): void {
  try {
    sessionStorage.setItem(WELCOME_SEEN_KEY, '1');
  } catch {
    // private mode / blocked storage: the dialog simply shows again next time
  }
}

/** Forget the dismissal (sign-out), so the dialog greets the next login. */
export function resetWelcome(): void {
  try {
    sessionStorage.removeItem(WELCOME_SEEN_KEY);
  } catch {
    // nothing stored, nothing to forget
  }
}

/**
 * Welcome banner after signing in to the demo: what SLIM does, that this is
 * a prototype with prepared example data, and one button that opens the
 * prepared example Schiessplatz. Demo behaviour on purpose: the dismissal
 * lives in sessionStorage (kept across reloads, dropped on sign-out) and is
 * **not** stored in the galaxy user settings yet, so every login shows it
 * again (product: persist the dismissal per user in `app_user_setting`).
 */
@Component({
  selector: 'app-welcome-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, TranslatePipe],
  styleUrl: './welcome-dialog.component.scss',
  template: `
    <div class="slim-sheet slim-sheet--open welcome" role="dialog" aria-modal="true" [attr.aria-labelledby]="'welcome-title'" data-testid="welcome-dialog">
      <button type="button" class="slim-sheet__backdrop" [attr.aria-label]="'common.close' | translate" (click)="close()"></button>
      <div class="slim-sheet__panel welcome__panel">
        <!-- Banner header_welcome.png (2103 × 748), cropped to the 950 × 250 strip of the sheet -->
        <img
          class="welcome__banner"
          ngSrc="assets/images/header_welcome.png"
          width="2103"
          height="748"
          priority
          alt=""
        />

        <div class="slim-sheet__body welcome__body">
          <span class="slim-badge slim-badge--outline welcome__tag">{{ 'welcome.tag' | translate }}</span>
          <h2 class="welcome__title" id="welcome-title">{{ 'welcome.title' | translate }}</h2>
          <p class="welcome__lead">{{ 'welcome.lead' | translate }}</p>
          <p>{{ 'welcome.explore' | translate }}</p>
          <p class="welcome__note">{{ 'welcome.prototype' | translate }}</p>
          <p class="welcome__disclaimer">{{ 'welcome.disclaimer' | translate }}</p>
        </div>

        <footer class="slim-sheet__footer welcome__footer">
          <button type="button" class="slim-btn" data-testid="welcome-close" (click)="close()">
            {{ 'welcome.later' | translate }}
          </button>
          <button type="button" class="slim-btn slim-btn--primary" data-testid="welcome-start" (click)="start()">
            {{ 'welcome.start' | translate }} →
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class WelcomeDialogComponent {
  private readonly router = inject(Router);
  private readonly areas = inject(AreaFacade);

  /** Emitted when the dialog was dismissed or the demo was started. */
  readonly closed = output<void>();

  protected readonly starting = signal(false);

  /** The prepared example Schiessplatz; falls back to the overview list. */
  protected readonly demoTarget = computed(() => {
    const demo = this.areas.areas().find((a) => a.coordinationSectionNo === DEMO_AREA_NO);
    return demo ? APP_ROUTES.admin.area.shots(demo.id) : APP_ROUTES.admin.area.root;
  });

  protected close(): void {
    markWelcomeSeen();
    this.closed.emit();
  }

  protected async start(): Promise<void> {
    markWelcomeSeen();
    this.starting.set(true);
    this.closed.emit();
    await this.router.navigateByUrl(this.demoTarget());
  }
}
