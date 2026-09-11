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
  selector: '[appAutofocus]',
})
export class AppAutofocusDirective {
  readonly appAutofocus = input<boolean, unknown>(true, {
    transform: (value) => value === '' || booleanAttribute(value),
  });

  private readonly elementRef = inject(ElementRef<HTMLElement>);

  constructor() {
    effect(() => {
      if (this.appAutofocus()) {
        this.focus();
      }
    });
  }

  private focus(): void {
    setTimeout(() => this.elementRef.nativeElement?.focus(), 300);
  }
}
