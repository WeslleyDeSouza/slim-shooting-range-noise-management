import { randomUUID } from 'node:crypto';
import { TestMockUserMock } from '@app-galaxy/auth-api';
import {
  assignAppRole,
  authHeaders,
  createTestApp,
  insertTestUser,
  mockTenantId,
  mockUserId,
  TestApp,
  testDbSeedBeforeEach,
} from '@api-slim/tests';
import { SLIM_APP_ID } from '@slim/shared';
import { API_MOCK_DATA } from '../../../mocks/main.mock-data';
import { fillSlimRoles, SLIM_ROLE } from '../../../mocks/roles.mock-data';
import { AccessModule } from '../access.module';
import { AppAccessDto } from '../dto';

const BASE = '/api/admin/access';

/**
 * `GET admin/access`: the app rights of the signed-in user in the tenant
 * (B1 8.1.2). The four SLIM roles are seeded by `fillSlimRoles`; the
 * answers must match the matrix of roles.mock-data.ts.
 */
describe('AdminAccessController (HTTP)', () => {
  let api: TestApp;

  const byApp = (rows: AppAccessDto[]): Record<number, string> =>
    Object.fromEntries(rows.map((r) => [r.appId, r.access]));

  beforeAll(async () => {
    api = await createTestApp({ modules: [AccessModule], entities: [] });
    const { dataSource } = api;
    await testDbSeedBeforeEach(dataSource);
    await TestMockUserMock.fill.Apps(dataSource, API_MOCK_DATA.customApps as never, API_MOCK_DATA.customCategories as never);
    await fillSlimRoles(dataSource, mockTenantId);
  });

  afterAll(async () => {
    await api.close();
  });

  it('answers an empty list for a signed-in user without any role', async () => {
    const res = await api.http().get(BASE).set(authHeaders(randomUUID())).expect(200);
    expect(res.body).toEqual([]);
  });

  it('reports the matrix of the Fachspezialist (write on 41, root on 43, nothing on 45)', async () => {
    await assignAppRole(api.dataSource, mockUserId, SLIM_ROLE.SPECIALIST);
    const res = await api.http().get(BASE).expect(200);
    const access = byApp(res.body);
    expect(access[SLIM_APP_ID.ADMIN_AREA]).toBe('root');
    expect(access[SLIM_APP_ID.ADMIN_DATA_AREA]).toBe('write');
    expect(access[SLIM_APP_ID.ADMIN_DATA_WEAPONS]).toBe('root');
    expect(access[SLIM_APP_ID.ADMIN_LOGS]).toBe('read');
    expect(access[SLIM_APP_ID.ADMIN_DATA_SYSTEM]).toBeUndefined();
  });

  it('reports read-only for the Interessent and merges the best right over several roles', async () => {
    const userId = await insertTestUser(api.dataSource);
    await assignAppRole(api.dataSource, userId, SLIM_ROLE.INTERESTED);
    let access = byApp((await api.http().get(BASE).set(authHeaders(userId)).expect(200)).body);
    expect(access[SLIM_APP_ID.ADMIN_DATA_AREA]).toBe('read');
    expect(access[SLIM_APP_ID.ADMIN_DATA_WEAPONS]).toBe('read');
    expect(access[SLIM_APP_ID.ADMIN_AREA_SIMULATION]).toBeUndefined();

    // A second role adds up: roles never narrow.
    await assignAppRole(api.dataSource, userId, SLIM_ROLE.SPECIALIST);
    access = byApp((await api.http().get(BASE).set(authHeaders(userId)).expect(200)).body);
    expect(access[SLIM_APP_ID.ADMIN_DATA_AREA]).toBe('write');
    expect(access[SLIM_APP_ID.ADMIN_AREA_SIMULATION]).toBe('write');
  });

  it('is per tenant', async () => {
    const res = await api.http().get(BASE).set(authHeaders(mockUserId, randomUUID())).expect(200);
    expect(res.body).toEqual([]);
  });
});
