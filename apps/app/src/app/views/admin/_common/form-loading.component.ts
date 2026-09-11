import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

/**
 * Loading note for admin forms whose fields are patched asynchronously:
 * shows a spinner line while `loading` is true. Pair it with the
 * `elo-form--loading` class from ELO_FORM_STYLES on the `<form>` element,
 * which dims the form and blocks pointer events — editing before the data
 * lands would be overwritten by the patch.
 *
 * Usage:
 *   <app-elo-form-loading
 *     [loading]="loading()"
 *     [label]="prefix + '.loading' | translate"
 *   />
 *   <form [formGroup]="form" [class.elo-form--loading]="loading()">…</form>
 *
 * Additionally call `form.disable()/enable({ emitEvent: false })` around the
 * load so keyboard focus cannot reach the fields either.
 */
@Component({
  selector: 'app-elo-form-loading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="elo-loading-note" role="status">
        <span class="elo-loading-note__dot"></span>
        {{ label() }}
      </div>
    }
  `,
  styles: `
    .elo-loading-note {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--ad-gray-500, #6b7280);
      margin-bottom: 10px;
    }
    .elo-loading-note__dot {
      width: 12px;
      height: 12px;
      border: 2px solid var(--ad-line-strong, #c9cdd4);
      border-top-color: var(--ad-red, #d8232a);
      border-radius: 50%;
      animation: elo-loading-spin 0.8s linear infinite;
    }
    @keyframes elo-loading-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class EloFormLoadingComponent {
  readonly loading = input.required<boolean>();
  /** Translated text; tolerant of the translate pipe's `undefined`. */
  readonly label = input<string | undefined>('…');
}
