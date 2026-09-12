export const APP_ID = 'slim';
export const APP_TITLE = 'SLIM – Schiesslärmimmissions-Management';

/** Supported UI languages (id order matters for the language switch). */
export const APP_LANGUAGES = ['de', 'fr', 'it', 'en'] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];

/**
 * Keys of the four roles of B1 8.1.1, stored as `settings.key` on the galaxy
 * role (`app_role.settings`). The API seeds the roles with these keys
 * (`roles.mock-data.ts`), the session exposes them to the frontend, and the
 * frontend abilities (CASL, planned) are derived from them — never from the
 * role title, which the administrator may rename.
 */
export const SLIM_ROLE_KEY = {
  /** Fachspezialist KOMZ Lärm */
  specialist: 'slim_specialist',
  /** Schiessplatz-Verantwortlicher (W/R-O: only assigned areas) */
  rangeOwner: 'slim_range_owner',
  /** Interessent Schiessplatznutzung */
  interested: 'slim_interested',
  /** Applikationsadministrator*in */
  appAdmin: 'slim_admin',
} as const;
export type SlimRoleKey = (typeof SLIM_ROLE_KEY)[keyof typeof SLIM_ROLE_KEY];

/**
 * App ids of this installation (galaxy `app_app.appId` rows). One app per
 * sitemap area (docs/architecture/sitemap.md); ids start at 40 to stay clear
 * of the galaxy defaults. The API guards its controllers with them
 * (`AppsRolesGuard`, `apps/api/src/mocks/apps.mapping.ts` re-exports this
 * enum as `API_APPS_MAPPING`) and the frontend shows only the menu entries
 * the signed-in user has a right for (`core/access`).
 */
export enum SLIM_APP_ID {
  /** Übersicht Schiessplätze (+ Übersicht / Schusszahlen / Details / Simulation) */
  ADMIN_AREA = 40,
  /** Datenverwaltung › Schiessplatz (Allgemein) */
  ADMIN_DATA_AREA = 41,
  /** Datenverwaltung › Schiessplatz › Berechnungen */
  ADMIN_DATA_CALCULATIONS = 42,
  /** Datenverwaltung › Waffen (Kaliber / Waffe / Waffenkategorie) */
  ADMIN_DATA_WEAPONS = 43,
  /** Datenverwaltung › MGDM Export */
  ADMIN_DATA_MGDM_EXPORT = 44,
  /** Datenverwaltung › Erweiterte Systemeinstellungen */
  ADMIN_DATA_SYSTEM = 45,
  /** Schiessplatz › Simulation (5.13) — own right, X for Interessent / Administrator */
  ADMIN_AREA_SIMULATION = 46,
  /** Schiessplatz › Immissionsberechnung durchführen und speichern (5.10) — Fachspezialist only */
  ADMIN_AREA_CALCULATION_RUN = 47,
  /** Datenverwaltung › Schiessplatz › Zuordnung Waffen (5.17) — W/R-O for the Schiessplatz-Verantwortlicher */
  ADMIN_DATA_AREA_WEAPONS = 48,
  /** Datenverwaltung › Logbuch (slm 56: Login-Logging und Auswertung) */
  ADMIN_LOGS = 49,
}

/** Galaxy apps of the Benutzerverwaltung (`@app-galaxy/auth-api` API_APPS_MAPPING). */
export enum GALAXY_APP_ID {
  ADMIN_USER_LIST = 1,
  ADMIN_ROLE_LIST = 2,
  ADMIN_APPS_LIST = 4,
}

/** Keys of the two galaxy roles every tenant gets (roleId 1 = admin, 2 = default). */
export const GALAXY_ROLE_KEY = {
  admin: 'galaxy_admin',
  user: 'galaxy_user',
} as const;
export const SLIM_ROLE_KEYS: readonly SlimRoleKey[] = Object.values(SLIM_ROLE_KEY);

/** Settings of a galaxy role as SLIM uses them (`app_role.settings`, JSON). */
export interface SlimRoleSettings {
  /** One of SLIM_ROLE_KEYS; free text for tenant-defined roles. */
  key?: string;
  /** «W/R-O» (B1 8.1.2): only the areas assigned in `area_user`. */
  ownAreasOnly?: boolean;
  /** Seeded system role: not deletable, rights matrix lives in code. */
  slim?: boolean;
}

/**
 * `app_role.settings` as SLIM reads it: TypeORM hands the JSON column back as
 * an object on MariaDB/PostgreSQL but as a string on SQLite — accept both.
 */
export function parseRoleSettings(value: unknown): SlimRoleSettings {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? (parsed as SlimRoleSettings) : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' ? (value as SlimRoleSettings) : {};
}
