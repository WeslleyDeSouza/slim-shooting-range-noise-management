import { TestMockUserMock } from '@app-galaxy/auth-api';
import { TestMockTenantMock } from '@app-galaxy/core-api';
import { DataSource } from 'typeorm';
import { APP_ROUTES } from '@slim/shared';
import { AREA_MOCK_DATA } from '../modules/area/area.mock-data';

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
}

/** Category ids (galaxy `app_category`), start at 8 to stay clear of defaults. */
export enum API_CATEGORY_MAPPING {
  WORKSPACE = 8,
  DATA_MANAGEMENT = 9,
}

export namespace API_MOCK_DATA {
  export const customCategories = [
    {
      categoryId: API_CATEGORY_MAPPING.WORKSPACE,
      domain: 'business',
      title: 'shell.workspace',
      parentCategoryId: null,
      icon: 'ri-focus-3-line',
    },
    {
      categoryId: API_CATEGORY_MAPPING.DATA_MANAGEMENT,
      domain: 'business',
      title: 'menu.data_management',
      parentCategoryId: null,
      icon: 'ri-database-2-line',
    },
  ];

  export const customApps = [
    {
      appId: API_APPS_MAPPING.ADMIN_AREA,
      domain: 'business',
      tenantId: null,
      title: 'menu.areas',
      roleKey: 'SLIM_AREA',
      path: APP_ROUTES.admin.area.root,
      categoryId: API_CATEGORY_MAPPING.WORKSPACE,
      img: null,
      icon: 'ri-focus-3-line',
    },
    {
      appId: API_APPS_MAPPING.ADMIN_DATA_AREA,
      domain: 'business',
      tenantId: null,
      title: 'menu.area',
      roleKey: 'SLIM_DATA_AREA',
      path: APP_ROUTES.admin.dataManagement.area.root,
      categoryId: API_CATEGORY_MAPPING.DATA_MANAGEMENT,
      img: null,
      icon: 'ri-map-pin-line',
    },
    {
      appId: API_APPS_MAPPING.ADMIN_DATA_CALCULATIONS,
      domain: 'business',
      tenantId: null,
      title: 'menu.calculations',
      roleKey: 'SLIM_DATA_CALCULATIONS',
      path: APP_ROUTES.admin.dataManagement.calculations.root,
      categoryId: API_CATEGORY_MAPPING.DATA_MANAGEMENT,
      img: null,
      icon: 'ri-calculator-line',
    },
    {
      appId: API_APPS_MAPPING.ADMIN_DATA_WEAPONS,
      domain: 'business',
      tenantId: null,
      title: 'menu.weapons',
      roleKey: 'SLIM_DATA_WEAPONS',
      path: APP_ROUTES.admin.dataManagement.weapons.root,
      categoryId: API_CATEGORY_MAPPING.DATA_MANAGEMENT,
      img: null,
      icon: 'ri-crosshair-line',
    },
    {
      appId: API_APPS_MAPPING.ADMIN_DATA_MGDM_EXPORT,
      domain: 'business',
      tenantId: null,
      title: 'menu.mgdm_export',
      roleKey: 'SLIM_DATA_MGDM_EXPORT',
      path: APP_ROUTES.admin.dataManagement.mgdmExport,
      categoryId: API_CATEGORY_MAPPING.DATA_MANAGEMENT,
      img: null,
      icon: 'ri-download-cloud-line',
    },
    {
      appId: API_APPS_MAPPING.ADMIN_DATA_SYSTEM,
      domain: 'business',
      tenantId: null,
      title: 'menu.system_settings',
      roleKey: 'SLIM_DATA_SYSTEM',
      path: APP_ROUTES.admin.dataManagement.system,
      categoryId: API_CATEGORY_MAPPING.DATA_MANAGEMENT,
      img: null,
      icon: 'ri-settings-3-line',
    },
  ];

  /**
   * Seeds tenant, demo user (APP_DEFAULT_USER), the app catalogue with its
   * role mapping, and the demo data of every feature module. Users / roles
   * come from the galaxy tables (ELO pattern), so the app has no mocks.
   */
  export const initMockData = async (connection: DataSource) => {
    // Swallowing these would make a broken seed look like a healthy boot.
    const fill = (what: string, run: Promise<unknown>) =>
      run.catch((error) =>
        console.warn(`[mock-data] ${what} failed: ${error?.message ?? error}`),
      );

    await fill('tenant', TestMockTenantMock.fill.All(connection));
    await fill('user', TestMockUserMock.fill.User(connection));
    // The galaxy seed only sets the e-mail; give the demo account a name so
    // the greeting and the avatar have something to show (mock: Hans Muster).
    await fill(
      'user name',
      connection.query(
        "update auth_user set firstName = ?, lastName = ? where email = ? and (firstName is null or firstName = '')",
        ['Hans', 'Muster', process.env['APP_DEFAULT_USER'] || 'user@mail.com'],
      ),
    );
    await fill(
      'apps',
      TestMockUserMock.fill.Apps(connection, customApps, customCategories),
    );
    // customApps must be passed again: without them the admin role only
    // gets the galaxy default apps and the SLIM sections stay guarded away.
    await fill(
      'role apps',
      TestMockUserMock.fill.RoleApps(connection, [], customApps),
    );
    await fill(
      'role user com',
      TestMockTenantMock.fill.RoleUserCom(connection),
    );

    // Feature demo data
    await fill(
      'area demo data',
      AREA_MOCK_DATA.fill(connection, TestMockTenantMock.tenantId),
    );
  };
}
