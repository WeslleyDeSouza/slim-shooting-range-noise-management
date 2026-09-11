import {
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import {
  SLIM_THEME_CONFIG,
  SlimThemeColors,
  SlimThemeColorSet,
  SlimThemeMode,
} from './theme.config';

const MODES: readonly SlimThemeMode[] = ['light', 'dark', 'system'];

/** `primaryContrast` → `primary-contrast`, `surface2` → `surface-2`. */
export function toCssName(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([a-z])(\d)/g, '$1-$2')
    .toLowerCase();
}

/** `#rgb` / `#rrggbb` → `r, g, b`; anything else → null (no rgb triplet). */
export function hexToRgbTriplet(color: string): string | null {
  const hex = color.trim().replace(/^#/, '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/**
 * Runtime side of the design system.
 *
 * - `mode` (light / dark / system) → `data-theme` on `<html>` (+ `data-bs-theme`),
 *   persisted in localStorage. The SCSS reacts to the attribute; `system`
 *   resolves through `prefers-color-scheme` and follows OS changes live.
 * - `setColors()` writes `--slim-color-*` custom properties on `<html>`, so
 *   brand colours can come from a tenant config or a user setting. Derived
 *   shades (hover, subtle, muted) update by themselves (`color-mix()` in CSS).
 */
@Injectable({ providedIn: 'root' })
export class SlimThemeService {
  private readonly config = inject(SLIM_THEME_CONFIG);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  private readonly media: MediaQueryList | null =
    typeof this.document.defaultView?.matchMedia === 'function'
      ? this.document.defaultView.matchMedia('(prefers-color-scheme: dark)')
      : null;

  private readonly systemDark = signal<boolean>(this.media?.matches ?? false);

  /** Chosen mode (what the user picked). */
  readonly mode = signal<SlimThemeMode>(this.readStoredMode());

  /** Effective scheme after resolving `system`. */
  readonly resolved = computed<'light' | 'dark'>(() => {
    const mode = this.mode();
    if (mode === 'system') return this.systemDark() ? 'dark' : 'light';
    return mode;
  });

  readonly isDark = computed(() => this.resolved() === 'dark');

  /** Colours currently applied at runtime (on top of the SCSS defaults). */
  readonly colors = signal<SlimThemeColorSet>(this.config.colors ?? {});

  constructor() {
    const onChange = (e: MediaQueryListEvent) => this.systemDark.set(e.matches);
    this.media?.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() =>
      this.media?.removeEventListener('change', onChange),
    );

    effect(() => this.applyMode(this.resolved(), this.mode()));
    effect(() => this.applyColors(this.colors(), this.resolved()));
  }

  setMode(mode: SlimThemeMode): void {
    this.mode.set(mode);
    try {
      this.document.defaultView?.localStorage.setItem(
        this.config.storageKey,
        mode,
      );
    } catch {
      // Private mode — the choice just does not survive the session.
    }
  }

  /** light → dark → light (never lands on `system`; use setMode for that). */
  toggle(): void {
    this.setMode(this.isDark() ? 'light' : 'dark');
  }

  /**
   * Override brand colours at runtime. Keys are the token names in camelCase.
   *   setColors({ primary: '#0066cc', primaryStrong: '#004c99' })
   *   setColors({ light: { bg: '#fff' }, dark: { bg: '#000' } })
   */
  setColors(colors: SlimThemeColors | SlimThemeColorSet): void {
    const set = isColorSet(colors) ? colors : { all: colors };
    this.colors.update((current) => ({
      all: { ...current.all, ...set.all },
      light: { ...current.light, ...set.light },
      dark: { ...current.dark, ...set.dark },
    }));
  }

  /** Remove every runtime colour override (back to the SCSS tokens). */
  resetColors(): void {
    this.colors.set({});
  }

  /** Current value of a token, e.g. `cssVar('color-primary')`. */
  cssVar(name: string): string {
    const view = this.document.defaultView;
    if (!view) return '';
    return view
      .getComputedStyle(this.document.documentElement)
      .getPropertyValue(`--${this.config.prefix}-${name}`)
      .trim();
  }

  // -------------------------------------------------------------------------

  private readStoredMode(): SlimThemeMode {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(
        this.config.storageKey,
      );
      if (stored && MODES.includes(stored as SlimThemeMode)) {
        return stored as SlimThemeMode;
      }
    } catch {
      // Private mode — fall through to the default.
    }
    return this.config.defaultMode;
  }

  private applyMode(resolved: 'light' | 'dark', mode: SlimThemeMode): void {
    const root = this.document.documentElement;
    // `system` leaves the decision to the media query in CSS (no attribute),
    // so the page also renders correctly before this service runs.
    if (mode === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', resolved);

    if (this.config.syncBootstrap) root.setAttribute('data-bs-theme', resolved);
  }

  private applied = new Set<string>();

  private applyColors(
    set: SlimThemeColorSet,
    resolved: 'light' | 'dark',
  ): void {
    const root = this.document.documentElement;
    const merged: SlimThemeColors = { ...set.all, ...set[resolved] };
    const next = new Set<string>();

    for (const [key, value] of Object.entries(merged)) {
      if (!value) continue;
      const name = `--${this.config.prefix}-color-${toCssName(key)}`;
      root.style.setProperty(name, value);
      next.add(name);

      const rgb = hexToRgbTriplet(value);
      if (rgb) {
        root.style.setProperty(`${name}-rgb`, rgb);
        next.add(`${name}-rgb`);
      }
    }

    for (const name of this.applied) {
      if (!next.has(name)) root.style.removeProperty(name);
    }
    this.applied = next;
  }
}

function isColorSet(
  value: SlimThemeColors | SlimThemeColorSet,
): value is SlimThemeColorSet {
  return 'all' in value || 'light' in value || 'dark' in value;
}
