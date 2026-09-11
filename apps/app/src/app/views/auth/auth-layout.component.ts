import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import { SlimThemeToggleComponent } from '@ui-slim/design-system';

const I18N = 'auth';

/**
 * Rotating notes of the brand panel (seen by people signing in): what the
 * application does, where help is, that changes are traceable. No invented
 * figures.
 */
const FACTS = [
  {
    key: 'access',
    icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2.3" y="2.3" width="4.4" height="4.4" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="9.3" y="2.3" width="4.4" height="4.4" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="2.3" y="9.3" width="4.4" height="4.4" rx="1" stroke="currentColor" stroke-width="1.3"/><path d="M9.3 9.5h2m2.4 0v2m-4.4 2.2h2m2.4 0h-.9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  },
  {
    key: 'docs',
    icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3.5C6.8 2.6 5 2.2 2.5 2.2v10.6c2.5 0 4.3.4 5.5 1.3 1.2-.9 3-1.3 5.5-1.3V2.2C11 2.2 9.2 2.6 8 3.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 3.5v10.6" stroke="currentColor" stroke-width="1.4"/></svg>`,
  },
  {
    key: 'log',
    icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.8l5 1.8v4.1c0 3-2.1 5.2-5 6.5-2.9-1.3-5-3.5-5-6.5V3.6L8 1.8z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M5.8 8.1l1.6 1.7 3-3.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
];

/**
 * Layout of the auth pages (ELO / alco-map redesign): dark brand panel on
 * desktop, card side with language switch, theme toggle and the routed
 * page. Styles use the SLIM tokens (auth-layout.component.scss).
 */
@Component({
  selector: 'app-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterOutlet, TranslatePipe, SlimThemeToggleComponent],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss',
})
export class AuthLayoutComponent {
  protected readonly prefix = I18N;
  private readonly translate = inject(TranslateService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly facts = FACTS.map((fact) => ({
    ...fact,
    icon: this.sanitizer.bypassSecurityTrustHtml(fact.icon) as SafeHtml,
  }));

  readonly factIndex = signal(0);
  private readonly langChanged = signal(0);

  readonly headline = computed<SafeHtml>(() => {
    this.langChanged();
    const raw =
      this.translate.translate(`${I18N}.brand_headline`) ??
      'Schiesslärmimmissions-<br><em>Management</em>';
    return this.sanitizer.bypassSecurityTrustHtml(raw);
  });

  constructor() {
    const timer = setInterval(
      () => this.factIndex.set((this.factIndex() + 1) % FACTS.length),
      4800,
    );
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  languages(): string[] {
    const langs = (
      this.translate as unknown as { availableLang?: { name: string }[] }
    ).availableLang;
    return langs?.map((lang) => lang.name) ?? ['de', 'fr', 'it', 'en'];
  }

  currentLang(): string {
    return (this.translate as unknown as { lang: string }).lang;
  }

  setLang(code: string): void {
    (this.translate as unknown as { lang: string }).lang = code;
    this.langChanged.update((value) => value + 1);
  }
}
