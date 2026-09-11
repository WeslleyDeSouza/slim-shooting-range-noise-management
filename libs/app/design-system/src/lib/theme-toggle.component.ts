import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { SlimThemeService } from './theme.service';

/**
 * Light / dark switch. Renders a `.slim-topbar__btn` by default so it drops
 * straight into a topbar; pass `variant="btn"` for a regular button.
 */
@Component({
  selector: 'slim-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      [class]="variant() === 'btn' ? 'slim-btn slim-btn--ghost slim-btn--icon' : 'slim-topbar__btn'"
      [attr.aria-label]="theme.isDark() ? 'Helles Design' : 'Dunkles Design'"
      [attr.aria-pressed]="theme.isDark()"
      (click)="theme.toggle()"
    >
      @if (theme.isDark()) {
        <svg class="slim-btn__icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" />
        </svg>
      } @else {
        <svg class="slim-btn__icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      }
    </button>
  `,
})
export class SlimThemeToggleComponent {
  protected readonly theme = inject(SlimThemeService);
  readonly variant = input<'topbar' | 'btn'>('topbar');
}
