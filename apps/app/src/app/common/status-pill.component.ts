import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import type { AreaResultDto } from '@ui-slim/apiClient';
import { AreaStatus } from '../core/area/area.facade';

export type AreaStatusReason = NonNullable<AreaResultDto['quotaStatusReason']>;

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
 * label from `status_area.*` in the common section. «Keine Daten» is said
 * precisely when the API names a reason (`no-calculation`, `no-usages`),
 * and the tooltip explains every state: what the light compares, the
 * reason, and the data behind it (`basis`, e.g. the Zustand and the year).
 */
@Component({
  selector: 'app-status-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <span class="slim-badge" [class]="'slim-badge ' + modifier()" [attr.title]="tooltip()" [attr.data-reason]="reason()">
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
      {{ label() | translate }}
    </span>
  `,
})
export class StatusPillComponent {
  private readonly translate = inject(TranslateService);

  readonly status = input.required<AreaStatus>();
  /** Why the light is grey (`none`) or, for `no-quota`, why a computed light is red. */
  readonly reason = input<AreaStatusReason | null>(null);
  /** Which light: names the comparison in the tooltip. */
  readonly kind = input<'quota' | 'noise' | null>(null);
  /** Data behind the light (Zustand, year …), appended to the tooltip. */
  readonly basis = input<string | null>(null);

  protected readonly modifier = computed(() => MODIFIER[this.status()]);

  protected readonly label = computed(() => {
    const status = this.status();
    const reason = this.reason();
    if (status === 'none' && (reason === 'no-calculation' || reason === 'no-usages')) {
      return `status_area.none_${reason.replace('-', '_')}`;
    }
    return `status_area.${status}`;
  });

  protected readonly tooltip = computed(() => {
    const parts: (string | undefined)[] = [];
    const kind = this.kind();
    if (kind) parts.push(this.translate.translate(`status_area.hint.${kind}_${this.status()}`));
    const reason = this.reason();
    if (reason) parts.push(this.translate.translate(`status_area.hint.${reason.replace('-', '_')}`));
    parts.push(this.basis() ?? undefined);
    // Missing keys come back as the key itself: leave them out of the tooltip.
    return parts.filter((t): t is string => !!t && !t.startsWith('status_area.')).join(' · ') || null;
  });
}
