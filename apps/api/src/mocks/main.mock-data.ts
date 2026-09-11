import { TestMockUserMock } from '@app-galaxy/auth-api';
import { TestMockTenantMock } from '@app-galaxy/core-api';
import { DataSource } from 'typeorm';

/**
 * App ids of this installation (galaxy `app_app.appId` rows). They are
 * assigned to the admin role and guard the admin controllers
 * (`AppsRolesGuard`). Ids start at 40 to stay clear of the galaxy defaults.
 * Paths follow docs/architecture/sitemap.md.
 */
export enum API_APPS_MAPPING {
  ADMIN_RANGES = 40,
  ADMIN_RANGE_DATA = 41,
  ADMIN_CALCULATIONS = 42,
  ADMIN_WEAPONS = 43,
  ADMIN_MGDM_EXPORT = 44,
  ADMIN_SYSTEM = 45,
}

export namespace API_MOCK_DATA {
  export const customCategories = [
    {
      categoryId: 8,
      domain: 'business',
      title: 'menu.data_management',
      parentCategoryId: null,
      icon: 'ri-database-2-line',
    },
  ];

  export const customApps = [
    {
      appId: API_APPS_MAPPING.ADMIN_RANGES,
      domain: 'business',
      tenantId: null,
      title: 'menu.ranges',
      roleKey: 'SLIM_RANGES',
      path: '/admin/schiessplaetze',
      categoryId: 8,
      img: null,
      icon: 'ri-focus-3-line',
    },
    {
      appId: API_APPS_MAPPING.ADMIN_RANGE_DATA,
      domain: 'business',
      tenantId: null,
      title: 'menu.range',
      roleKey: 'SLIM_RANGE_DATA',
      path: '/admin/verwaltung/schiessplatz',
      categoryId: 8,
      img: null,
      icon: 'ri-map-pin-line',
    },
    {
      appId: API_APPS_MAPPING.ADMIN_CALCULATIONS,
      domain: 'business',
      tenantId: null,
      title: 'menu.calculations',
      roleKey: 'SLIM_CALCULATIONS',
      path: '/admin/verwaltung/schiessplatz/berechnungen',
      categoryId: 8,
      img: null,
      icon: 'ri-calculator-line',
    },
    {
      appId: API_APPS_MAPPING.ADMIN_WEAPONS,
      domain: 'business',
      tenantId: null,
      title: 'menu.weapons',
      roleKey: 'SLIM_WEAPONS',
      path: '/admin/verwaltung/waffen',
      categoryId: 8,
      img: null,
      icon: 'ri-crosshair-line',
    },
    {
      appId: API_APPS_MAPPING.ADMIN_MGDM_EXPORT,
      domain: 'business',
      tenantId: null,
      title: 'menu.mgdm_export',
      roleKey: 'SLIM_MGDM_EXPORT',
      path: '/admin/verwaltung/mgdm-export',
      categoryId: 8,
      img: null,
      icon: 'ri-download-cloud-line',
    },
    {
      appId: API_APPS_MAPPING.ADMIN_SYSTEM,
      domain: 'business',
      tenantId: null,
      title: 'menu.system_settings',
      roleKey: 'SLIM_SYSTEM',
      path: '/admin/verwaltung/system',
      categoryId: 8,
      img: null,
      icon: 'ri-settings-3-line',
    },
  ];

  /** Seeds tenant, demo user (APP_DEFAULT_USER), apps and role mapping. */
  export const initMockData = async (connection: DataSource) => {
    // Swallowing these would make a broken seed look like a healthy boot.
    const fill = (what: string, run: Promise<unknown>) =>
      run.catch((error) =>
        console.warn(`[mock-data] ${what} failed: ${error?.message ?? error}`),
      );

    await fill('tenant', TestMockTenantMock.fill.All(connection));
    await fill('user', TestMockUserMock.fill.User(connection));
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
    await fill('role user com', TestMockTenantMock.fill.RoleUserCom(connection));
  };
}
