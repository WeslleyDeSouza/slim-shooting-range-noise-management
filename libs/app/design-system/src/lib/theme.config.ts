import { InjectionToken } from '@angular/core';

/** Colour scheme the user (or the OS) picked. */
export type SlimThemeMode = 'light' | 'dark' | 'system';

/**
 * Base colours that can be changed at runtime. Keys map 1:1 to the CSS
 * custom properties (`primary` → `--slim-color-primary`); the derived shades
 * (hover, subtle, muted) follow automatically via `color-mix()` in the SCSS.
 */
export interface SlimThemeColors {
  primary?: string;
  primaryStrong?: string;
  primaryContrast?: string;
  ink?: string;
  bg?: string;
  surface?: string;
  surface2?: string;
  line?: string;
  lineStrong?: string;
  success?: string;
  warning?: string;
  danger?: string;
  info?: string;
  link?: string;
  focus?: string;
}

/** Colours per scheme — `all` applies to both, `light` / `dark` only to one. */
export interface SlimThemeColorSet {
  all?: SlimThemeColors;
  light?: SlimThemeColors;
  dark?: SlimThemeColors;
}

export interface SlimThemeConfig {
  /** localStorage key for the chosen mode. Default `slim.theme`. */
  storageKey: string;
  /** Mode used when nothing is stored. Default `light`. */
  defaultMode: SlimThemeMode;
  /** Brand colours applied on start (e.g. from a tenant config). */
  colors: SlimThemeColorSet;
  /** Also write `data-bs-theme` so Bootstrap / ng-bootstrap follow. Default true. */
  syncBootstrap: boolean;
  /** Custom-property prefix; must match `$prefix` in the SCSS tokens. */
  prefix: string;
}

export const SLIM_THEME_DEFAULTS: SlimThemeConfig = {
  storageKey: 'slim.theme',
  defaultMode: 'light',
  colors: {},
  syncBootstrap: true,
  prefix: 'slim',
};

export const SLIM_THEME_CONFIG = new InjectionToken<SlimThemeConfig>(
  'SLIM_THEME_CONFIG',
  { providedIn: 'root', factory: () => SLIM_THEME_DEFAULTS },
);
