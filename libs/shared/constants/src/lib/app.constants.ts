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
  specialist: 'specialist',
  /** Schiessplatz-Verantwortlicher (W/R-O: only assigned areas) */
  rangeOwner: 'range_owner',
  /** Interessent Schiessplatznutzung */
  interested: 'interested',
  /** Applikationsadministrator*in */
  appAdmin: 'app_admin',
} as const;
export type SlimRoleKey = (typeof SLIM_ROLE_KEY)[keyof typeof SLIM_ROLE_KEY];
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
