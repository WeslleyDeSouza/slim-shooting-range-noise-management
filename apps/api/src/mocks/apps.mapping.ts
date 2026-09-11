/**
 * App and category ids of this installation — in their own file so the
 * role seed (roles.mock-data.ts) and the catalogue (main.mock-data.ts) can
 * both import them without a circular import.
 */
/**
 * App ids of this installation (galaxy `app_app.appId` rows). They are
 * assigned to the admin role and guard the admin controllers
 * (`AppsRolesGuard`). Ids start at 40 to stay clear of the galaxy defaults.
 * One app per sitemap area (docs/architecture/sitemap.md); paths from
 * `APP_ROUTES` (@slim/shared) so the app catalogue and the router agree.
 */
export enum API_APPS_MAPPING {
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

/** Category ids (galaxy `app_category`), start at 8 to stay clear of defaults. */
export enum API_CATEGORY_MAPPING {
  WORKSPACE = 8,
  DATA_MANAGEMENT = 9,
}
