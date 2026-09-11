import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { AreaStatus } from '../core/area/area.facade';

const MODIFIER: Record<AreaStatus, string> = {
  ok: 'slim-badge--success',
  warn: 'slim-badge--warning',
  over: 'slim-badge--danger',
  none: '',
  // «nicht beurteilbar» (O8): deliberately no traffic-light colour.
  incomplete: 'slim-badge--outline',
};

/**
 * Traffic-light pill for quota / noise status (mock: .pill). Icon + label,
 * label from `status_area.*` in the common section.
 */
@Component({
  selector: 'app-status-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <span class="slim-badge" [class]="'slim-badge ' + modifier()">
      @switch (status()) {
        @case ('ok') {
          <svg class="slim-badge__icon" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="7" fill="currentColor" />
            <path
              d="M4.5 8.5l2.3 2.3L11.5 6"
              stroke="#fff"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"
            />
          </svg>
        }
        @case ('warn') {
          <svg class="slim-badge__icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 1.5L15 14H1L8 1.5z" fill="currentColor" />
            <path
              d="M8 6v4"
              stroke="#fff"
              stroke-width="1.6"
              stroke-linecap="round"
            />
            <circle cx="8" cy="12" r=".9" fill="#fff" />
          </svg>
        }
        @case ('over') {
          <svg class="slim-badge__icon" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="7" fill="currentColor" />
            <path
              d="M5.5 5.5l5 5M10.5 5.5l-5 5"
              stroke="#fff"
              stroke-width="1.8"
              stroke-linecap="round"
            />
          </svg>
        }
        @case ('incomplete') {
          <svg class="slim-badge__icon" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.5 2" />
            <path d="M8 4.8v3.9M8 11.2v.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        }
        @default {
          <svg class="slim-badge__icon" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="7" fill="currentColor" />
            <path
              d="M5 8h6"
              stroke="#fff"
              stroke-width="1.8"
              stroke-linecap="round"
            />
          </svg>
        }
      }
      {{ 'status_area.' + status() | translate }}
    </span>
  `,
})
export class StatusPillComponent {
  readonly status = input.required<AreaStatus>();
  protected readonly modifier = computed(() => MODIFIER[this.status()]);
}
