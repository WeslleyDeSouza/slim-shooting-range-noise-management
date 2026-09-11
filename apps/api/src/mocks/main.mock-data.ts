import { TestMockUserMock } from '@app-galaxy/auth-api';
import { TestMockTenantMock } from '@app-galaxy/core-api';
import { DataSource } from 'typeorm';
import { APP_ROUTES } from '@slim/shared';
import { API_APPS_MAPPING, API_CATEGORY_MAPPING } from './apps.mapping';
import { fillSlimRoles } from './roles.mock-data';
import { demoSeedEnabled, seedDemoDataset } from './tenant/demo-dataset.seed';
import { loadRawDatasets, DEFAULT_DATASET_KEY } from './tenant/tenant-dataset';

export { API_APPS_MAPPING, API_CATEGORY_MAPPING } from './apps.mapping';

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
    // Rights-only apps (no menu entry of their own): they split one sitemap
    // area into the rows of the B1 8.1.2 matrix.
    {
      appId: API_APPS_MAPPING.ADMIN_AREA_SIMULATION,
      domain: 'business',
      tenantId: null,
      title: 'menu.area_simulation',
      roleKey: 'SLIM_AREA_SIMULATION',
      path: null,
      categoryId: API_CATEGORY_MAPPING.WORKSPACE,
      img: null,
      icon: 'ri-line-chart-line',
      hiddenInMenu: true,
    },
    {
      appId: API_APPS_MAPPING.ADMIN_AREA_CALCULATION_RUN,
      domain: 'business',
      tenantId: null,
      title: 'menu.area_calculation_run',
      roleKey: 'SLIM_AREA_CALCULATION_RUN',
      path: null,
      categoryId: API_CATEGORY_MAPPING.WORKSPACE,
      img: null,
      icon: 'ri-calculator-line',
      hiddenInMenu: true,
    },
    {
      appId: API_APPS_MAPPING.ADMIN_DATA_AREA_WEAPONS,
      domain: 'business',
      tenantId: null,
      title: 'menu.area_weapon_assignment',
      roleKey: 'SLIM_DATA_AREA_WEAPONS',
      path: APP_ROUTES.admin.dataManagement.area.weaponAssignment,
      categoryId: API_CATEGORY_MAPPING.DATA_MANAGEMENT,
      img: null,
      icon: 'ri-links-line',
      hiddenInMenu: true,
    },
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
    {
      appId: API_APPS_MAPPING.ADMIN_LOGS,
      domain: 'business',
      tenantId: null,
      title: 'menu.logs',
      roleKey: 'SLIM_LOGS',
      path: APP_ROUTES.admin.dataManagement.logs,
      categoryId: API_CATEGORY_MAPPING.DATA_MANAGEMENT,
      img: null,
      icon: 'ri-file-list-3-line',
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
    // The four SLIM roles of B1 8.1 with the rights matrix (roles.mock-data.ts).
    await fill('slim roles', fillSlimRoles(connection, TestMockTenantMock.tenantId));

    // The «SLIM Demo» dataset (mocks/tenant/tenant.mock.json): areas with
    // rooms, weapons, receivers, calculation states and this year's usages,
    // plus the demo user's name. Rolled to the current year and rewritten
    // when the year turns, the dataset version changes, or DEMO_RESEED=1
    // asks for a fresh copy. DEMO_SEED=0 leaves the tenant alone.
    if (demoSeedEnabled()) {
      await seedDemoDataset(connection, TestMockTenantMock.tenantId, {
        force: process.env['DEMO_RESEED'] === '1',
      })
        .then((r) => {
          if (!r.skipped) {
            console.log(
              `[seed] SLIM Demo ${r.year}: ${r.areas} areas, ${r.rooms} rooms, ${r.weapons} sources, ${r.receivers} receivers, ${r.calculations} calculation states (${r.wlr} WLR rows), ${r.usages} usages`,
            );
          }
        })
        .catch((error) =>
          console.warn(`[seed] demo dataset failed: ${error?.message ?? error}`),
        );
    } else {
      console.log('[seed] demo dataset skipped (DEMO_SEED=0)');
    }
  };

  /** Demo credentials as the dataset declares them (setup wizard, e2e). */
  export const demoUser = () => loadRawDatasets()[DEFAULT_DATASET_KEY].users[0];
}
