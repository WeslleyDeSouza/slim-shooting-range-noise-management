import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  SlimThemeService,
  SlimThemeToggleComponent,
} from '@ui-slim/design-system';

interface SwatchDef {
  name: string;
  label: string;
}

/**
 * Living styleguide: every block of the design system in one page, with the
 * runtime controls (theme mode, brand colours) wired to SlimThemeService.
 * Route: /styleguide. Not linked from production navigation.
 */
@Component({
  selector: 'app-styleguide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SlimThemeToggleComponent],
  styleUrl: './styleguide.component.scss',
  template: `
    <div class="slim-shell">
      <header class="slim-topbar slim-shell__topbar">
        <a class="slim-topbar__brand" routerLink="/">
          <span class="slim-topbar__mark"></span>
          SLIM
        </a>
        <span class="slim-topbar__title">Styleguide</span>
        <div class="slim-topbar__actions">
          <slim-theme-toggle />
        </div>
      </header>

      <aside class="slim-sidebar slim-shell__sidebar">
        <div class="slim-sidebar__brand">
          <span class="slim-topbar__mark"></span> SLIM
        </div>
        <nav class="slim-sidebar__section" aria-label="Abschnitte">
          <div class="slim-sidebar__heading">Design System</div>
          @for (s of sections; track s.id) {
            <a class="slim-sidebar__link" [class.slim-sidebar__link--active]="active() === s.id" [href]="'#' + s.id" (click)="active.set(s.id)">{{ s.label }}</a>
          }
        </nav>
        <div class="slim-sidebar__footer slim-text--muted slim-text--xs">
          libs/app/design-system
        </div>
      </aside>

      <main class="slim-page slim-shell__main sg">
        <div class="slim-page__header">
          <div>
            <p class="slim-eyebrow">Design System</p>
            <h1 class="slim-page__title">Styleguide</h1>
            <p class="slim-page__subtitle">
              Mobile first · SCSS → CSS-Variablen · BEM · Light &amp; Dark
            </p>
          </div>
          <div class="slim-page__actions">
            <div class="slim-segmented" role="group" aria-label="Farbschema">
              @for (m of modes; track m) {
                <button type="button" class="slim-segmented__item" [class.slim-segmented__item--active]="theme.mode() === m" (click)="theme.setMode(m)">{{ m }}</button>
              }
            </div>
          </div>
        </div>

        <div class="slim-page__body">
          <!-- Runtime colours -------------------------------------------- -->
          <section class="slim-card" id="theme">
            <header class="slim-card__header">
              <div>
                <h2 class="slim-card__title">Farben zur Laufzeit</h2>
                <p class="slim-card__subtitle">SlimThemeService.setColors() → --slim-color-*</p>
              </div>
              <div class="slim-card__actions">
                <button type="button" class="slim-btn slim-btn--sm" (click)="reset()">Zurücksetzen</button>
              </div>
            </header>
            <div class="slim-card__body slim-form__row">
              <label class="slim-field">
                <span class="slim-field__label">Primärfarbe</span>
                <input class="slim-input sg__color" type="color" [value]="primary()" (input)="setPrimary($event)" />
              </label>
              <label class="slim-field">
                <span class="slim-field__label">Primär (hover / strong)</span>
                <input class="slim-input sg__color" type="color" [value]="primaryStrong()" (input)="setPrimaryStrong($event)" />
              </label>
            </div>
            <div class="slim-card__footer">
              <span class="slim-text--muted slim-text--small">Aktuell: {{ primary() }} · Modus {{ theme.mode() }} → {{ theme.resolved() }}</span>
            </div>
          </section>

          <!-- Tokens --------------------------------------------------- -->
          <section class="slim-card" id="tokens">
            <header class="slim-card__header"><h2 class="slim-card__title">Farb-Tokens</h2></header>
            <div class="slim-card__body">
              <div class="sg__swatches">
                @for (s of swatches; track s.name) {
                  <div class="sg__swatch">
                    <div class="sg__swatch-chip" [style.background]="'var(--slim-color-' + s.name + ')'"></div>
                    <div class="sg__swatch-name">{{ s.label }}</div>
                    <code class="slim-text--mono slim-text--xs">--slim-color-{{ s.name }}</code>
                  </div>
                }
              </div>
            </div>
          </section>

          <!-- Typography ------------------------------------------------ -->
          <section class="slim-card" id="typography">
            <header class="slim-card__header"><h2 class="slim-card__title">Typografie</h2></header>
            <div class="slim-card__body slim-stack slim-stack--sm">
              <p class="slim-h1">Überschrift 1 · .slim-h1</p>
              <p class="slim-h2">Überschrift 2 · .slim-h2</p>
              <p class="slim-h3">Überschrift 3 · .slim-h3</p>
              <p class="slim-h4">Überschrift 4 · .slim-h4</p>
              <p>Fliesstext 15px, Zeilenhöhe 1.5. <a href="#typography">Ein Link</a>.</p>
              <p class="slim-text--secondary">Sekundärtext · .slim-text--secondary</p>
              <p class="slim-text--muted slim-text--small">Hinweis · .slim-text--muted .slim-text--small</p>
              <p class="slim-eyebrow">Eyebrow · .slim-eyebrow</p>
            </div>
          </section>

          <!-- Buttons --------------------------------------------------- -->
          <section class="slim-card" id="buttons">
            <header class="slim-card__header"><h2 class="slim-card__title">Buttons</h2></header>
            <div class="slim-card__body slim-stack">
              <div class="slim-btn-group">
                <button type="button" class="slim-btn slim-btn--primary">Primär</button>
                <button type="button" class="slim-btn slim-btn--secondary">Sekundär</button>
                <button type="button" class="slim-btn">Standard</button>
                <button type="button" class="slim-btn slim-btn--ghost">Ghost</button>
                <button type="button" class="slim-btn slim-btn--danger">Löschen</button>
                <button type="button" class="slim-btn slim-btn--link">Link</button>
              </div>
              <div class="slim-btn-group">
                <button type="button" class="slim-btn slim-btn--primary slim-btn--sm">Klein</button>
                <button type="button" class="slim-btn slim-btn--primary">Normal</button>
                <button type="button" class="slim-btn slim-btn--primary slim-btn--lg">Gross</button>
                <button type="button" class="slim-btn slim-btn--primary slim-btn--pill">Pill</button>
                <button type="button" class="slim-btn slim-btn--icon" aria-label="Mehr">
                  <svg class="slim-btn__icon" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                </button>
                <button type="button" class="slim-btn slim-btn--primary slim-btn--loading">Lädt</button>
                <button type="button" class="slim-btn slim-btn--primary" disabled>Deaktiviert</button>
              </div>
              <button type="button" class="slim-btn slim-btn--primary slim-btn--block-mobile">
                <svg class="slim-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                <span class="slim-btn__label">Vollbreit auf Mobile · --block-mobile</span>
              </button>
            </div>
          </section>

          <!-- Forms ----------------------------------------------------- -->
          <section class="slim-card" id="forms">
            <header class="slim-card__header"><h2 class="slim-card__title">Formulare</h2></header>
            <form class="slim-card__body slim-form" (submit)="$event.preventDefault()">
              <div class="slim-form__row">
                <div class="slim-field">
                  <label class="slim-field__label" for="sg-name">Name <span class="slim-field__required">*</span></label>
                  <input class="slim-input" id="sg-name" placeholder="Vor- und Nachname" />
                  <p class="slim-field__hint">Wie auf dem Ausweis.</p>
                </div>
                <div class="slim-field slim-field--invalid">
                  <label class="slim-field__label" for="sg-mail">E-Mail</label>
                  <input class="slim-input" id="sg-mail" type="email" value="keine-mail" />
                  <p class="slim-field__error">Bitte eine gültige E-Mail-Adresse eingeben.</p>
                </div>
              </div>
              <div class="slim-form__row">
                <div class="slim-field">
                  <label class="slim-field__label" for="sg-sel">Kategorie</label>
                  <select class="slim-select" id="sg-sel">
                    <option>Schiessplatz</option>
                    <option>Schiessanlage</option>
                  </select>
                </div>
                <div class="slim-field">
                  <label class="slim-field__label" for="sg-dis">Deaktiviert</label>
                  <input class="slim-input" id="sg-dis" value="Nicht editierbar" disabled />
                </div>
              </div>
              <div class="slim-field">
                <label class="slim-field__label" for="sg-txt">Bemerkung</label>
                <textarea class="slim-textarea" id="sg-txt" placeholder="Optional"></textarea>
              </div>
              <div class="slim-form__section">
                <div class="slim-form__legend">Optionen</div>
                <label class="slim-check">
                  <input class="slim-check__input" type="checkbox" checked />
                  <span class="slim-check__label">Checkbox <span class="slim-check__hint">mit Hinweis darunter</span></span>
                </label>
                <label class="slim-check">
                  <input class="slim-check__input" type="radio" name="sg-r" checked />
                  <span class="slim-check__label">Radio A</span>
                </label>
                <label class="slim-check">
                  <input class="slim-check__input" type="radio" name="sg-r" />
                  <span class="slim-check__label">Radio B</span>
                </label>
                <label class="slim-switch">
                  <span class="slim-switch__label">Benachrichtigungen</span>
                  <input class="slim-switch__input" type="checkbox" checked />
                </label>
              </div>
              <div class="slim-form__actions">
                <button type="button" class="slim-btn">Abbrechen</button>
                <button type="submit" class="slim-btn slim-btn--primary">Speichern</button>
              </div>
            </form>
          </section>

          <!-- Feedback -------------------------------------------------- -->
          <section class="slim-card" id="feedback">
            <header class="slim-card__header"><h2 class="slim-card__title">Feedback</h2></header>
            <div class="slim-card__body slim-stack">
              <div class="slim-chips">
                <span class="slim-badge">Standard</span>
                <span class="slim-badge slim-badge--primary">Primär</span>
                <span class="slim-badge slim-badge--success"><span class="slim-badge__dot"></span>Aktiv</span>
                <span class="slim-badge slim-badge--warning">Pendent</span>
                <span class="slim-badge slim-badge--danger">Fehler</span>
                <span class="slim-badge slim-badge--info">Info</span>
                <span class="slim-badge slim-badge--solid">Solid</span>
                <span class="slim-badge slim-badge--outline">Outline</span>
              </div>
              <div class="slim-chips slim-chips--scroll">
                @for (c of chips; track c) {
                  <button type="button" class="slim-chip" [class.slim-chip--selected]="chip() === c" (click)="chip.set(c)">{{ c }}</button>
                }
              </div>
              <div class="slim-alert slim-alert--info">
                <span class="slim-alert__icon">ⓘ</span>
                <div class="slim-alert__body"><div class="slim-alert__title">Hinweis</div>Die Meldung wird innert 24 Stunden verarbeitet.</div>
              </div>
              <div class="slim-alert slim-alert--success"><div class="slim-alert__body">Gespeichert.</div></div>
              <div class="slim-alert slim-alert--warning"><div class="slim-alert__body">Kontingent zu 90 % ausgeschöpft.</div></div>
              <div class="slim-alert slim-alert--danger"><div class="slim-alert__body">Verbindung zum Server verloren.</div></div>
              <div class="slim-u-flex">
                <span class="slim-spinner slim-spinner--sm"></span>
                <span class="slim-spinner"></span>
                <span class="slim-spinner slim-spinner--lg"></span>
                <span class="slim-avatar">WS</span>
                <span class="slim-avatar slim-avatar--lg">AB</span>
              </div>
              <div class="slim-grid slim-grid--3">
                <div class="slim-stat"><div class="slim-stat__label">Meldungen</div><div class="slim-stat__value">1'284</div><div class="slim-stat__delta slim-stat__delta--up">+12 % zum Vormonat</div></div>
                <div class="slim-stat"><div class="slim-stat__label">Offen</div><div class="slim-stat__value">37</div><div class="slim-stat__delta slim-stat__delta--down">−4</div></div>
                <div class="slim-stat"><div class="slim-stat__label">Schiessplätze</div><div class="slim-stat__value">58</div><div class="slim-stat__delta">unverändert</div></div>
              </div>
              <div>
                <span class="slim-skeleton slim-skeleton--title"></span>
                <span class="slim-skeleton slim-skeleton--text"></span>
                <span class="slim-skeleton slim-skeleton--text"></span>
              </div>
              <div class="slim-empty">
                <svg class="slim-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>
                <div class="slim-empty__title">Keine Meldungen</div>
                <p class="slim-empty__text">Sobald eine Meldung eingeht, erscheint sie hier.</p>
                <button type="button" class="slim-btn slim-btn--primary slim-empty__action">Meldung erfassen</button>
              </div>
            </div>
          </section>

          <!-- Data ------------------------------------------------------ -->
          <section class="slim-card" id="data">
            <header class="slim-card__header"><h2 class="slim-card__title">Daten</h2></header>
            <div class="slim-card__body slim-stack">
              <div class="slim-tabs">
                <button type="button" class="slim-tabs__tab slim-tabs__tab--active">Übersicht</button>
                <button type="button" class="slim-tabs__tab">Details</button>
                <button type="button" class="slim-tabs__tab">Verlauf</button>
              </div>
              <ul class="slim-list slim-list--divided">
                @for (row of rows; track row.id) {
                  <li class="slim-list__item slim-list__item--interactive">
                    <span class="slim-list__leading"><span class="slim-avatar slim-avatar--sm">{{ row.id }}</span></span>
                    <span class="slim-list__content">
                      <span class="slim-list__title">{{ row.place }}</span>
                      <span class="slim-list__meta">{{ row.date }} · {{ row.shots }} Schüsse</span>
                    </span>
                    <span class="slim-list__trailing">
                      <span class="slim-badge" [class.slim-badge--success]="row.state === 'ok'" [class.slim-badge--warning]="row.state === 'open'">{{ row.state }}</span>
                    </span>
                  </li>
                }
              </ul>
              <div class="slim-table-wrap">
                <table class="slim-table slim-table--stack">
                  <thead><tr><th>Schiessplatz</th><th>Datum</th><th class="slim-table__cell--num">Schüsse</th><th>Status</th></tr></thead>
                  <tbody>
                    @for (row of rows; track row.id) {
                      <tr class="slim-table__row slim-table__row--clickable">
                        <td data-label="Schiessplatz">{{ row.place }}</td>
                        <td data-label="Datum">{{ row.date }}</td>
                        <td data-label="Schüsse" class="slim-table__cell--num">{{ row.shots }}</td>
                        <td data-label="Status"><span class="slim-badge" [class.slim-badge--success]="row.state === 'ok'" [class.slim-badge--warning]="row.state === 'open'">{{ row.state }}</span></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <dl class="slim-kv">
                <dt class="slim-kv__key">Referenz</dt><dd class="slim-kv__value">SLIM-2026-0142</dd>
                <dt class="slim-kv__key">Zuständig</dt><dd class="slim-kv__value">Koordinationsstelle Bern</dd>
              </dl>
            </div>
          </section>

          <!-- Overlay --------------------------------------------------- -->
          <section class="slim-card" id="overlay">
            <header class="slim-card__header"><h2 class="slim-card__title">Sheet / Dialog</h2></header>
            <div class="slim-card__body slim-stack">
              <p class="slim-text--muted slim-text--small">Bottom-Sheet auf dem Smartphone, zentrierter Dialog ab 768 px.</p>
              <button type="button" class="slim-btn slim-btn--primary slim-btn--block-mobile" (click)="sheet.set(true)">Sheet öffnen</button>
              <div class="slim-menu sg__menu">
                <div class="slim-menu__heading">Aktionen</div>
                <button type="button" class="slim-menu__item">Bearbeiten</button>
                <button type="button" class="slim-menu__item slim-menu__item--active">Duplizieren</button>
                <div class="slim-menu__divider"></div>
                <button type="button" class="slim-menu__item slim-menu__item--danger">Löschen</button>
              </div>
            </div>
          </section>
        </div>
      </main>

      <nav class="slim-tabbar slim-shell__tabbar" aria-label="Hauptnavigation">
        @for (t of tabs; track t.label) {
          <a class="slim-tabbar__item" [class.slim-tabbar__item--active]="t.active" href="#top">
            <svg class="slim-tabbar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path [attr.d]="t.icon"/></svg>
            <span class="slim-tabbar__label">{{ t.label }}</span>
          </a>
        }
      </nav>

      <div class="slim-sheet" [class.slim-sheet--open]="sheet()" role="dialog" aria-modal="true" aria-labelledby="sg-sheet-title">
        <div class="slim-sheet__backdrop" (click)="sheet.set(false)"></div>
        <div class="slim-sheet__panel">
          <div class="slim-sheet__handle"></div>
          <header class="slim-sheet__header">
            <h2 class="slim-sheet__title" id="sg-sheet-title">Meldung bestätigen</h2>
            <button type="button" class="slim-sheet__close" aria-label="Schliessen" (click)="sheet.set(false)">✕</button>
          </header>
          <div class="slim-sheet__body slim-stack">
            <p>Die Meldung wird an die Koordinationsstelle übermittelt.</p>
            <div class="slim-field">
              <label class="slim-field__label" for="sg-sheet-note">Bemerkung</label>
              <input class="slim-input" id="sg-sheet-note" />
            </div>
          </div>
          <footer class="slim-sheet__footer">
            <button type="button" class="slim-btn" (click)="sheet.set(false)">Abbrechen</button>
            <button type="button" class="slim-btn slim-btn--primary" (click)="sheet.set(false)">Senden</button>
          </footer>
        </div>
      </div>
    </div>
  `,
})
export class StyleguideComponent {
  protected readonly theme = inject(SlimThemeService);

  protected readonly modes = ['light', 'dark', 'system'] as const;
  protected readonly sheet = signal(false);
  protected readonly chip = signal('Alle');
  protected readonly chips = ['Alle', 'Offen', 'Erledigt', 'Bern', 'Thun', 'Bière', 'Chur'];
  protected readonly active = signal('theme');

  protected readonly sections = [
    { id: 'theme', label: 'Laufzeit-Farben' },
    { id: 'tokens', label: 'Tokens' },
    { id: 'typography', label: 'Typografie' },
    { id: 'buttons', label: 'Buttons' },
    { id: 'forms', label: 'Formulare' },
    { id: 'feedback', label: 'Feedback' },
    { id: 'data', label: 'Daten' },
    { id: 'overlay', label: 'Sheet / Dialog' },
  ];

  protected readonly swatches: SwatchDef[] = [
    { name: 'primary', label: 'Primär' },
    { name: 'primary-strong', label: 'Primär strong' },
    { name: 'primary-subtle', label: 'Primär subtle' },
    { name: 'ink', label: 'Ink (Text)' },
    { name: 'text-2', label: 'Text 2' },
    { name: 'text-3', label: 'Text 3' },
    { name: 'text-4', label: 'Text 4' },
    { name: 'bg', label: 'Hintergrund' },
    { name: 'surface', label: 'Fläche' },
    { name: 'surface-2', label: 'Fläche 2' },
    { name: 'line', label: 'Linie' },
    { name: 'line-strong', label: 'Linie strong' },
    { name: 'success', label: 'Erfolg' },
    { name: 'warning', label: 'Warnung' },
    { name: 'danger', label: 'Fehler' },
    { name: 'info', label: 'Info' },
  ];

  protected readonly rows = [
    { id: 1, place: 'Schiessplatz Thun', date: '03.09.2026', shots: 1240, state: 'ok' },
    { id: 2, place: 'Waffenplatz Bière', date: '04.09.2026', shots: 860, state: 'open' },
    { id: 3, place: 'Schiessanlage Chur', date: '05.09.2026', shots: 412, state: 'ok' },
  ];

  protected readonly tabs = [
    { label: 'Start', active: true, icon: 'M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z' },
    { label: 'Meldungen', active: false, icon: 'M4 4h16v12H7l-3 3z' },
    { label: 'Karte', active: false, icon: 'M9 3l6 2 6-2v16l-6 2-6-2-6 2V5z' },
    { label: 'Profil', active: false, icon: 'M20 21a8 8 0 1 0-16 0M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  ];

  private readonly override = signal<{ primary?: string; primaryStrong?: string }>({});
  protected readonly primary = computed(() => this.override().primary ?? '#dc0018');
  protected readonly primaryStrong = computed(() => this.override().primaryStrong ?? '#b00013');

  protected setPrimary(event: Event): void {
    const primary = (event.target as HTMLInputElement).value;
    this.override.update((o) => ({ ...o, primary }));
    this.theme.setColors({ primary });
  }

  protected setPrimaryStrong(event: Event): void {
    const primaryStrong = (event.target as HTMLInputElement).value;
    this.override.update((o) => ({ ...o, primaryStrong }));
    this.theme.setColors({ primaryStrong });
  }

  protected reset(): void {
    this.override.set({});
    this.theme.resetColors();
  }
}
