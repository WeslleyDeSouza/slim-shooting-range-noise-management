import { API_APPS_MAPPING as GALAXY_APPS } from '@app-galaxy/auth-api';
import { DataSource } from 'typeorm';
import { GALAXY_ROLE_KEY, SLIM_ROLE_KEY, SlimRoleSettings } from '@slim/shared';
import { API_APPS_MAPPING } from './apps.mapping';

/**
 * Access levels of the galaxy `AppsRolesGuard` (app_role_right.access):
 * `read` = GET only, `write` = everything but DELETE, `delete` / `root` = all.
 * `''` = no right → the guard answers 403 (B1 8.1.2 «X»).
 */
export type SlimAccess = '' | 'read' | 'write' | 'root';

/**
 * The four roles of B1 8.1.1 (`slm 35`), ids 10–13 (galaxy uses 1 = Admin,
 * 2 = User). «W/R-O» (only own Schiessplätze) of the Schiessplatz-
 * Verantwortlicher is stored as `settings.ownAreasOnly` on the role; the
 * per-area assignment and the scoping guard are not part of the prototype
 * yet — see docs/architecture/berechtigungen.md.
 */
export enum SLIM_ROLE {
  SPECIALIST = 10,
  RANGE_OWNER = 11,
  INTERESTED = 12,
  APP_ADMIN = 13,
}

/** Keys used by the demo dataset (`tenant.mock.json` users[].role). */
export const SLIM_ROLE_BY_KEY: Record<string, number> = {
  [SLIM_ROLE_KEY.specialist]: SLIM_ROLE.SPECIALIST,
  [SLIM_ROLE_KEY.rangeOwner]: SLIM_ROLE.RANGE_OWNER,
  [SLIM_ROLE_KEY.interested]: SLIM_ROLE.INTERESTED,
  [SLIM_ROLE_KEY.appAdmin]: SLIM_ROLE.APP_ADMIN,
  /** galaxy admin role (everything) — the default demo user. */
  admin: 1,
};

export interface SlimRoleSeed {
  roleId: SLIM_ROLE;
  /** `settings.key`, what the frontend and the seed identify the role by. */
  key: string;
  title: string;
  ownAreasOnly: boolean;
  /** appId → access; apps not listed get no right (X). */
  rights: Partial<Record<number, SlimAccess>>;
}

const A = API_APPS_MAPPING;
const G = GALAXY_APPS;

/** B1 8.1.2 matrix, one column per role. */
export const SLIM_ROLES: SlimRoleSeed[] = [
  {
    roleId: SLIM_ROLE.SPECIALIST,
    key: SLIM_ROLE_KEY.specialist,
    title: 'Fachspezialist KOMZ Lärm',
    ownAreasOnly: false,
    rights: {
      [A.ADMIN_AREA]: 'root', // 5.9–5.12 R/W incl. delete of usages
      [A.ADMIN_AREA_CALCULATION_RUN]: 'write', // 5.10 Immissionsberechnung R/W
      [A.ADMIN_AREA_SIMULATION]: 'write', // 5.13 R/W
      [A.ADMIN_DATA_AREA]: 'write', // 5.14–5.16 R / R/W
      [A.ADMIN_DATA_AREA_WEAPONS]: 'root', // 5.17 R/W
      [A.ADMIN_DATA_CALCULATIONS]: 'root', // 5.18–5.21 R/W
      [A.ADMIN_DATA_WEAPONS]: 'root', // 5.22–5.25 R/W
      [A.ADMIN_DATA_MGDM_EXPORT]: 'write',
      [G.APP_ADMIN_USER_LIST]: 'root', // 5.26 R/W
      [G.APP_ADMIN_ROLE_LIST]: 'read',
      [A.ADMIN_DATA_SYSTEM]: '', // Administration X
      [A.ADMIN_LOGS]: 'read', // Logbuch auswerten (slm 56)
    },
  },
  {
    roleId: SLIM_ROLE.RANGE_OWNER,
    key: SLIM_ROLE_KEY.rangeOwner,
    title: 'Schiessplatz-Verantwortlicher',
    ownAreasOnly: true,
    rights: {
      [A.ADMIN_AREA]: 'root', // W/R-O (scoping open)
      [A.ADMIN_AREA_CALCULATION_RUN]: '',
      [A.ADMIN_AREA_SIMULATION]: 'write', // W/R-O
      [A.ADMIN_DATA_AREA]: 'read',
      [A.ADMIN_DATA_AREA_WEAPONS]: 'write', // W/R-O
      [A.ADMIN_DATA_CALCULATIONS]: '',
      [A.ADMIN_DATA_WEAPONS]: 'read',
      [A.ADMIN_DATA_MGDM_EXPORT]: '',
      [G.APP_ADMIN_USER_LIST]: 'write', // W/R-O
      [G.APP_ADMIN_ROLE_LIST]: '',
      [A.ADMIN_DATA_SYSTEM]: '',
    },
  },
  {
    roleId: SLIM_ROLE.INTERESTED,
    key: SLIM_ROLE_KEY.interested,
    title: 'Interessent Schiessplatznutzung',
    ownAreasOnly: false,
    rights: {
      [A.ADMIN_AREA]: 'read',
      [A.ADMIN_AREA_CALCULATION_RUN]: '',
      [A.ADMIN_AREA_SIMULATION]: '',
      [A.ADMIN_DATA_AREA]: 'read',
      [A.ADMIN_DATA_AREA_WEAPONS]: '',
      [A.ADMIN_DATA_CALCULATIONS]: '',
      [A.ADMIN_DATA_WEAPONS]: 'read',
      [A.ADMIN_DATA_MGDM_EXPORT]: '',
      [G.APP_ADMIN_USER_LIST]: '',
      [G.APP_ADMIN_ROLE_LIST]: '',
      [A.ADMIN_DATA_SYSTEM]: '',
    },
  },
  {
    roleId: SLIM_ROLE.APP_ADMIN,
    key: SLIM_ROLE_KEY.appAdmin,
    title: 'Applikationsadministrator*in',
    ownAreasOnly: false,
    rights: {
      [A.ADMIN_AREA]: 'read',
      [A.ADMIN_AREA_CALCULATION_RUN]: '',
      [A.ADMIN_AREA_SIMULATION]: '',
      [A.ADMIN_DATA_AREA]: 'read',
      [A.ADMIN_DATA_AREA_WEAPONS]: 'read',
      [A.ADMIN_DATA_CALCULATIONS]: 'read',
      [A.ADMIN_DATA_WEAPONS]: 'read',
      [A.ADMIN_DATA_MGDM_EXPORT]: 'read',
      [G.APP_ADMIN_USER_LIST]: 'read',
      [G.APP_ADMIN_ROLE_LIST]: 'root', // Administration R/W
      [G.APP_ADMIN_APPS_LIST]: 'root',
      [A.ADMIN_DATA_SYSTEM]: 'root',
      [A.ADMIN_LOGS]: 'root',
    },
  },
];

/**
 * Writes the four roles and their app rights for a tenant (idempotent: the
 * role row is created once, the rights are replaced so the matrix in this
 * file is the truth). Users are not assigned here — the demo user keeps the
 * galaxy admin role; assign a SLIM role in the user administration to try
 * a restricted view.
 */
export async function fillSlimRoles(connection: DataSource, tenantId: string): Promise<void> {
  // The galaxy roles (TestMockTenantMock: 1 = Admin, 2 = User) get a key too,
  // so every row of the role overview identifies itself in code. Only set
  // when missing – this runs with the mock seed, not as a sync on every boot.
  for (const [roleId, key] of [[1, GALAXY_ROLE_KEY.admin], [2, GALAXY_ROLE_KEY.user]] as const) {
    const [row]: { settings: string | null }[] = await connection.query(
      'select settings from app_role where tenantId = ? and roleId = ?',
      [tenantId, roleId],
    );
    if (!row) continue;
    let settings: SlimRoleSettings = {};
    try {
      settings = row.settings ? JSON.parse(row.settings) : {};
    } catch {
      settings = {};
    }
    if (settings.key) continue;
    await connection.query('update app_role set settings = ? where tenantId = ? and roleId = ?', [
      JSON.stringify(<SlimRoleSettings>{ ...settings, key }),
      tenantId,
      roleId,
    ]);
  }
  for (const role of SLIM_ROLES) {
    const existing: { roleId: number }[] = await connection.query(
      'select roleId from app_role where tenantId = ? and roleId = ?',
      [tenantId, role.roleId],
    );
    if (!existing.length) {
      await connection.query(
        'insert into app_role (roleId, tenantId, type, domain, title, state, isDefault, hasAdminRights, hasOnBoardingRights, hasPaymentRights, sensitiveDataDisplay, permissionMode, settings) ' +
          "values (?, ?, 'business', 'business', ?, 1, 0, 0, 0, 0, 0, 'simple', ?)",
        [role.roleId, tenantId, role.title, JSON.stringify(<SlimRoleSettings>{ key: role.key, ownAreasOnly: role.ownAreasOnly, slim: true })],
      );
    } else {
      // Keep key and flags in sync with the code; a renamed title stays.
      const [row]: { settings: string | null }[] = await connection.query(
        'select settings from app_role where tenantId = ? and roleId = ?',
        [tenantId, role.roleId],
      );
      let settings: SlimRoleSettings = {};
      try {
        settings = row?.settings ? JSON.parse(row.settings) : {};
      } catch {
        settings = {};
      }
      await connection.query('update app_role set settings = ? where tenantId = ? and roleId = ?', [
        JSON.stringify(<SlimRoleSettings>{ ...settings, key: role.key, ownAreasOnly: role.ownAreasOnly, slim: true }),
        tenantId,
        role.roleId,
      ]);
    }
    await connection.query('delete from app_role_right where tenantId = ? and roleId = ?', [tenantId, role.roleId]);
    for (const [appId, access] of Object.entries(role.rights)) {
      if (!access) continue;
      await connection.query(
        'insert into app_role_right (id, tenantId, roleId, appId, access) values (?, ?, ?, ?, ?)',
        [`slim-role-${role.roleId}-app-${appId}`, tenantId, role.roleId, Number(appId), access],
      );
    }
  }
}
