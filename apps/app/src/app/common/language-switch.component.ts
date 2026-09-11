import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TranslateService } from '@app-galaxy/translate-ui';

/**
 * Language switch (de / fr / it / en) on the design-system segmented control.
 * Writes through TranslateService, which persists the choice (`app.lang`)
 * and reloads the loaded sections.
 */
@Component({
  selector: 'app-language-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="slim-segmented" role="group" [attr.aria-label]="label()">
      @for (lang of languages(); track lang) {
        <button
          type="button"
          class="slim-segmented__item"
          [class.slim-segmented__item--active]="current() === lang"
          [attr.aria-pressed]="current() === lang"
          (click)="setLang(lang)"
        >
          {{ lang.toUpperCase() }}
        </button>
      }
    </div>
  `,
})
export class LanguageSwitchComponent {
  private readonly translate = inject(TranslateService);

  readonly current = signal<string>(this.translate.lang);
  readonly languages = computed(() =>
    this.translate.availableLang.map((l) => l.name),
  );
  readonly label = computed(
    () => this.translate.translate('common.language') ?? 'Sprache',
  );

  setLang(lang: string): void {
    this.translate.lang = lang;
    this.current.set(lang);
  }
}
