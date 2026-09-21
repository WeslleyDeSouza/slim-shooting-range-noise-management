import { APP_ROUTES, ROUTE_SEGMENT } from './app-routes.constants';

describe('APP_ROUTES', () => {
  it('builds absolute paths from the segments', () => {
    expect(APP_ROUTES.admin.area.root).toBe('/admin/area');
    expect(APP_ROUTES.admin.area.shots('thun')).toBe('/admin/area/thun/shots');
    expect(APP_ROUTES.admin.dataManagement.calculations.import).toBe(
      '/admin/data-management/area/calculations/import',
    );
    expect(APP_ROUTES.admin.dataManagement.area.generalOf('thun')).toBe(
      '/admin/data-management/area/thun/general/overview',
    );
    expect(APP_ROUTES.admin.dataManagement.area.masterDataOf('thun')).toBe(
      '/admin/data-management/area/thun/general/master-data',
    );
    expect(APP_ROUTES.auth.login).toBe(
      `/${ROUTE_SEGMENT.auth}/${ROUTE_SEGMENT.login}`,
    );
  });
});
