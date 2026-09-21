/**
 * Every route of the app in one place (English, mirrors
 * docs/architecture/sitemap.md). Used by the Angular router (segments),
 * by links (absolute paths) and by the API mocks (galaxy `app_app.path`).
 * Dependency-free on purpose — both builds consume this file.
 */
export const ROUTE_SEGMENT = {
  auth: 'auth',
  login: 'login',
  twoFaLogin: 'two-fa-login',
  tenantLogin: 'tenant-login',
  recoverPassword: 'recover-password',
  verifyEmail: 'verify-email',

  admin: 'admin',
  area: 'area',
  overview: 'overview',
  shots: 'shots',
  details: 'details',
  simulation: 'simulation',

  dataManagement: 'data-management',
  /** Datenverwaltung › Schiessplatz › Allgemein (5.15 Übersicht, 5.16 Stammdaten) */
  general: 'general',
  masterData: 'master-data',
  weaponAssignment: 'weapon-assignment',
  calculations: 'calculations',
  import: 'import',
  export: 'export',
  weapons: 'weapons',
  /** Datenverwaltung › Waffen › Waffe/Kaliber (5.22) */
  combination: 'combination',
  caliber: 'caliber',
  weapon: 'weapon',
  weaponCategory: 'weapon-category',
  users: 'users',
  roles: 'roles',
  logs: 'logs',
  apps: 'apps',
  create: 'create',
  edit: 'edit',
  mgdmExport: 'mgdm-export',
  system: 'system',

  styleguide: 'styleguide',
} as const;

const S = ROUTE_SEGMENT;
const join = (...parts: string[]) => '/' + parts.join('/');

/** Absolute paths for links, redirects, guards and the API app catalogue. */
export const APP_ROUTES = {
  auth: {
    root: join(S.auth),
    login: join(S.auth, S.login),
    twoFaLogin: join(S.auth, S.twoFaLogin),
    tenantLogin: join(S.auth, S.tenantLogin),
    recoverPassword: join(S.auth, S.recoverPassword),
    verifyEmail: join(S.auth, S.verifyEmail),
  },
  admin: {
    root: join(S.admin),
    home: join(S.admin),
    /** Übersicht Schiessplätze */
    area: {
      root: join(S.admin, S.area),
      overview: (id: string) => join(S.admin, S.area, id, S.overview),
      shots: (id: string) => join(S.admin, S.area, id, S.shots),
      details: (id: string) => join(S.admin, S.area, id, S.details),
      simulation: (id: string) => join(S.admin, S.area, id, S.simulation),
    },
    /** Datenverwaltung */
    dataManagement: {
      root: join(S.admin, S.dataManagement),
      area: {
        root: join(S.admin, S.dataManagement, S.area),
        overview: join(S.admin, S.dataManagement, S.area, S.overview),
        masterData: join(S.admin, S.dataManagement, S.area, S.masterData),
        weaponAssignment: join(
          S.admin,
          S.dataManagement,
          S.area,
          S.weaponAssignment,
        ),
        /** 5.15–5.18 of one Schiessplatz (jumps from the overview 5.14). */
        /** Allgemein › Übersicht (5.15) */
        generalOf: (id: string) =>
          join(S.admin, S.dataManagement, S.area, id, S.general, S.overview),
        /** Allgemein › Stammdaten (5.16) */
        masterDataOf: (id: string) =>
          join(S.admin, S.dataManagement, S.area, id, S.general, S.masterData),
        weaponAssignmentOf: (id: string) =>
          join(S.admin, S.dataManagement, S.area, id, S.weaponAssignment),
        calculationsOf: (id: string) =>
          join(S.admin, S.dataManagement, S.area, id, S.calculations),
        /** Berechnungen of one Schiessplatz: Übersicht (5.18) · Import (5.19) · Export (5.20) · Details (5.21) */
        calculationsOverviewOf: (id: string) =>
          join(S.admin, S.dataManagement, S.area, id, S.calculations, S.overview),
        calculationsImportOf: (id: string) =>
          join(S.admin, S.dataManagement, S.area, id, S.calculations, S.import),
        calculationsExportOf: (id: string) =>
          join(S.admin, S.dataManagement, S.area, id, S.calculations, S.export),
        calculationsDetailsOf: (id: string) =>
          join(S.admin, S.dataManagement, S.area, id, S.calculations, S.details),
      },
      calculations: {
        root: join(S.admin, S.dataManagement, S.area, S.calculations),
        overview: join(
          S.admin,
          S.dataManagement,
          S.area,
          S.calculations,
          S.overview,
        ),
        import: join(
          S.admin,
          S.dataManagement,
          S.area,
          S.calculations,
          S.import,
        ),
        export: join(
          S.admin,
          S.dataManagement,
          S.area,
          S.calculations,
          S.export,
        ),
        details: join(
          S.admin,
          S.dataManagement,
          S.area,
          S.calculations,
          S.details,
        ),
      },
      weapons: {
        root: join(S.admin, S.dataManagement, S.weapons),
        /** Waffe/Kaliber (5.22) */
        combination: join(S.admin, S.dataManagement, S.weapons, S.combination),
        caliber: join(S.admin, S.dataManagement, S.weapons, S.caliber),
        weapon: join(S.admin, S.dataManagement, S.weapons, S.weapon),
        category: join(S.admin, S.dataManagement, S.weapons, S.weaponCategory),
      },
      users: join(S.admin, S.dataManagement, S.users),
      usersCreate: join(S.admin, S.dataManagement, S.users, S.create),
      usersEdit: (id: string) => join(S.admin, S.dataManagement, S.users, S.edit, id),
      roles: join(S.admin, S.dataManagement, S.roles),
      rolesCreate: join(S.admin, S.dataManagement, S.roles, S.create),
      rolesEdit: (id: string) => join(S.admin, S.dataManagement, S.roles, S.edit, id),
      apps: join(S.admin, S.dataManagement, S.apps),
      /** Logbuch (slm 56) */
      logs: join(S.admin, S.dataManagement, S.logs),
      appsCreate: join(S.admin, S.dataManagement, S.apps, S.create),
      appsEdit: (id: string) => join(S.admin, S.dataManagement, S.apps, S.edit, id),
      mgdmExport: join(S.admin, S.dataManagement, S.mgdmExport),
      system: join(S.admin, S.dataManagement, S.system),
    },
  },
  styleguide: join(S.styleguide),
} as const;
