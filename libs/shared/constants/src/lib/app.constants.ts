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
