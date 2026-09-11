import {
  Directive,
  ElementRef,
  booleanAttribute,
  effect,
  inject,
  input,
} from '@angular/core';

/**
 * Focuses the host element once it is rendered. Own copy for the redesigned
 * admin (`_ui`) instead of reaching into the wizard's step folder — the
 * implementation mirrors the wizard's `AutofocusDirective`.
 */
@Directive({
  selector: '[eloAutofocus]',
})
export class EloAutofocusDirective {
  readonly eloAutofocus = input<boolean, unknown>(true, {
    transform: (value) => value === '' || booleanAttribute(value),
  });

  private readonly elementRef = inject(ElementRef<HTMLElement>);

  constructor() {
    effect(() => {
      if (this.eloAutofocus()) {
        this.focus();
      }
    });
  }

  private focus(): void {
    setTimeout(() => this.elementRef.nativeElement?.focus(), 300);
  }
}
