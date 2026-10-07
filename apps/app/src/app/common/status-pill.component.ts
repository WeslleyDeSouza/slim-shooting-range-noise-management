import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  Renderer2,
  signal,
  viewChild,
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

/** Locale key of the text of a light; «Keine Daten» is said precisely when the API names the reason. */
/** Order of the states in a sorted column: from «eingehalten» to «keine Angabe». */
const STATUS_ORDER: readonly AreaStatus[] = ['ok', 'warn', 'over', 'incomplete', 'none'];
export function statusRank(status: AreaStatus | null | undefined): number | null {
  const rank = status ? STATUS_ORDER.indexOf(status) : -1;
  return rank < 0 ? null : rank;
}

export function statusLabelKey(status: AreaStatus, reason: AreaStatusReason | null | undefined): string {
  if (status === 'none' && (reason === 'no-calculation' || reason === 'no-usages')) {
    return `status_area.none_${reason.replace('-', '_')}`;
  }
  return `status_area.${status}`;
}

/**
 * Traffic-light pill for quota / noise status (mock: .pill). Icon + label,
 * label from `status_area.*` in the common section. «Keine Daten» is said
 * precisely when the API names a reason (`no-calculation`, `no-usages`),
 * and the tooltip explains every state: what the light compares, the
 * reason, and the data behind it (`basis`, e.g. the Zustand and the year).
 *
 * `named` puts the kind in front of the label («Kontingent: Überschritten»),
 * for places where both lights stand side by side. With `popover` the pill
 * is a button: a click opens the explanation as a panel instead of the
 * tooltip; projected content (a link to the page behind the light) follows
 * the text. The panel closes on Escape, on a click outside and on its links.
 */
@Component({
  selector: 'app-status-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, TranslatePipe],
  styleUrl: './status-pill.component.scss',
  template: `
    @if (popover()) {
      <span class="status-pill">
        <button
          #trigger
          type="button"
          [class]="'slim-badge status-pill__trigger ' + modifier()"
          [attr.data-reason]="reason()"
          aria-haspopup="dialog"
          [attr.aria-expanded]="open()"
          (click)="toggle()"
        >
          <ng-container [ngTemplateOutlet]="content" />
          <svg class="status-pill__caret" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
          </svg>
        </button>
        @if (open()) {
          <div class="status-pill__panel" role="dialog" data-testid="status-pill-panel" (click)="onPanelClick($event)">
            @for (line of details().hints; track line) {
              <p class="status-pill__line">{{ line }}</p>
            }
            @if (details().basis; as basis) {
              <p class="status-pill__basis">{{ basis }}</p>
            }
            <div class="status-pill__actions"><ng-content /></div>
          </div>
        }
      </span>
    } @else {
      <span [class]="'slim-badge ' + modifier()" [attr.title]="tooltip()" [attr.data-reason]="reason()">
        <ng-container [ngTemplateOutlet]="content" />
      </span>
    }

    <ng-template #content>
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
      @if (named() && kind(); as k) {
        {{ 'status_area.named' | translate: { kind: ('status_area.kind.' + k | translate), status: (label() | translate) } }}
      } @else {
        {{ label() | translate }}
      }
    </ng-template>
  `,
})
export class StatusPillComponent {
  private readonly translate = inject(TranslateService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  /** Document listeners of the open panel; none while it is closed (a table holds many pills). */
  private listeners: (() => void)[] = [];

  readonly status = input.required<AreaStatus>();
  /** Why the light is grey (`none`) or, for `no-quota`, why a computed light is red. */
  readonly reason = input<AreaStatusReason | null>(null);
  /** Which light: names the comparison in the tooltip. */
  readonly kind = input<'quota' | 'noise' | null>(null);
  /** Data behind the light (Zustand, year …), appended to the tooltip. */
  readonly basis = input<string | null>(null);
  /** Kind in front of the label («Kontingent: Überschritten»); needs `kind`. */
  readonly named = input(false, { transform: booleanAttribute });
  /** The explanation opens on a click as a panel (with the projected content) instead of the tooltip. */
  readonly popover = input(false, { transform: booleanAttribute });

  protected readonly open = signal(false);

  protected readonly modifier = computed(() => MODIFIER[this.status()]);

  protected readonly label = computed(() => statusLabelKey(this.status(), this.reason()));

  /** What the light compares and why it shows this state, and the data behind it. */
  protected readonly details = computed(() => {
    const parts: (string | undefined)[] = [];
    const kind = this.kind();
    if (kind) parts.push(this.translate.translate(`status_area.hint.${kind}_${this.status()}`));
    const reason = this.reason();
    if (reason) parts.push(this.translate.translate(`status_area.hint.${reason.replace('-', '_')}`));
    // Missing keys come back as the key itself: leave them out.
    return { hints: parts.filter((t): t is string => !!t && !t.startsWith('status_area.')), basis: this.basis() };
  });

  protected readonly tooltip = computed(() => {
    const { hints, basis } = this.details();
    return [...hints, basis].filter((t) => !!t).join(' · ') || null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopListening());
  }

  protected toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    this.open.set(true);
    const host = this.host.nativeElement;
    this.listeners = [
      // The click that opens the panel reaches the document too: clicks inside the pill never close it here.
      this.renderer.listen('document', 'click', (event: Event) => {
        if (!host.contains(event.target as Node)) this.close();
      }),
      this.renderer.listen('document', 'keydown.escape', () => this.close(true)),
    ];
  }

  /** A link in the panel leads to another page (or further down this one): the panel has done its job. */
  protected onPanelClick(event: Event): void {
    if ((event.target as HTMLElement).closest('a')) this.close();
  }

  private close(focusTrigger = false): void {
    this.open.set(false);
    this.stopListening();
    if (focusTrigger) this.trigger()?.nativeElement.focus();
  }

  private stopListening(): void {
    this.listeners.forEach((off) => off());
    this.listeners = [];
  }
}
