import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { APP_ROUTES } from '@slim/shared';
import { AreaFacade } from '../../../core/area/area.facade';

/** Koordinationsabschnitt-Nr. of the prepared demo Schiessplatz («SLIM Demo» dataset). */
export const DEMO_AREA_NO = '1104.020';

/** sessionStorage key: dismissed for this browser session (= shown again after every login). */
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

/**
 * Welcome banner after signing in to the demo: what SLIM does, that this is
 * a prototype with prepared example data, and one button that opens the
 * prepared example Schiessplatz. Demo behaviour on purpose: it is dismissed
 * for the browser session only and **not** stored in the galaxy user
 * settings yet, so every login shows it again (product: persist the
 * dismissal per user in `app_user_setting`).
 */
@Component({
  selector: 'app-welcome-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  styleUrl: './welcome-dialog.component.scss',
  template: `
    <div class="slim-sheet slim-sheet--open welcome" role="dialog" aria-modal="true" [attr.aria-labelledby]="'welcome-title'" data-testid="welcome-dialog">
      <div class="slim-sheet__backdrop" (click)="close()"></div>
      <div class="slim-sheet__panel welcome__panel">
        <!-- Landschaftsbanner 950 × 250: schematic valley with a shooting range and receivers -->
        <svg class="welcome__banner" viewBox="0 0 950 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <linearGradient id="welcome-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" class="welcome__sky-top" />
              <stop offset="1" class="welcome__sky-bottom" />
            </linearGradient>
          </defs>
          <rect width="950" height="250" fill="url(#welcome-sky)" />
          <circle cx="790" cy="62" r="26" class="welcome__sun" />
          <path class="welcome__hill welcome__hill--far" d="M0 150 L120 92 L230 128 L340 70 L450 118 L560 82 L680 126 L790 96 L880 130 L950 112 L950 250 L0 250 Z" />
          <path class="welcome__hill welcome__hill--mid" d="M0 182 L90 150 L190 172 L300 138 L410 170 L520 146 L640 176 L760 150 L860 176 L950 158 L950 250 L0 250 Z" />
          <path class="welcome__lake" d="M0 212 C160 198 320 198 480 212 C640 226 800 226 950 212 L950 250 L0 250 Z" />
          <path class="welcome__hill welcome__hill--near" d="M0 250 L0 214 L140 196 L280 218 L420 200 L560 220 L700 204 L840 222 L950 206 L950 250 Z" />
          <!-- range: firing point, target berm, shot line -->
          <rect x="150" y="186" width="34" height="14" rx="2" class="welcome__stand" />
          <path d="M560 178 L610 178 L620 204 L550 204 Z" class="welcome__berm" />
          <path d="M184 193 L560 186" class="welcome__line" />
          <!-- receivers (houses) -->
          <g class="welcome__house" transform="translate(690 190)"><path d="M0 12 L0 0 L8 -8 L16 0 L16 12 Z" /></g>
          <g class="welcome__house" transform="translate(740 198)"><path d="M0 12 L0 0 L8 -8 L16 0 L16 12 Z" /></g>
          <g class="welcome__pin" transform="translate(698 174)"><circle r="5" /></g>
          <g class="welcome__pin welcome__pin--warn" transform="translate(748 182)"><circle r="5" /></g>
        </svg>

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
