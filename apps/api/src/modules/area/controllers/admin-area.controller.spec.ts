import { randomUUID } from 'node:crypto';
import { TestMockUserMock } from '@app-galaxy/auth-api';
import {
  assignAppRole,
  authHeaders,
  createTestApp,
  mockTenantId,
  mockUserId,
  TestApp,
  testDbSeedBeforeEach,
} from '@api-slim/tests';
import { API_MOCK_DATA } from '../../../mocks/main.mock-data';
import { fillSlimRoles, SLIM_ROLE } from '../../../mocks/roles.mock-data';
import { seedDemoDataset } from '../../../mocks/tenant/demo-dataset.seed';
import { DemoSeedMarkerEntity } from '../../../mocks/tenant/demo-seed-marker.entity';
import { CalculationModule } from '../../calculation/calculation.module';
import { UsageModule } from '../../usage/usage.module';
import { AreaModule } from '../area.module';
import { AreaResultDto } from '../dto';

const NOW = new Date(2026, 11, 31);
const BASE = '/api/admin/area';
/** The dataset's Schiessplatz-Verantwortlicher (Geissalp + Thun, «W/R-O»). */
const RANGE_OWNER_EMAIL = 'schiessplatz@demo.ch';

/**
 * HTTP contract of the area controller (supertest): routing, the galaxy
 * app-rights guard, the «W/R-O» area-scope rule, the global validation
 * pipe and the status codes the generated client relies on.
 */
describe('AdminAreaController (HTTP)', () => {
  let api: TestApp;
  let rangeOwnerId: string;
  let areas: AreaResultDto[];

  const byName = (name: string): AreaResultDto => areas.find((a) => a.name === name) as AreaResultDto;

  beforeAll(async () => {
    api = await createTestApp({
      modules: [AreaModule, UsageModule, CalculationModule],
      entities: [
        ...AreaModule.DBOptions.entities,
        ...UsageModule.DBOptions.entities,
        ...CalculationModule.DBOptions.entities,
        DemoSeedMarkerEntity,
      ],
    });
    const { dataSource } = api;
    await testDbSeedBeforeEach(dataSource);
    // Same order as the boot seed: apps, roles, then the dataset (its users reference the roles).
    await TestMockUserMock.fill.Apps(dataSource, API_MOCK_DATA.customApps as never, API_MOCK_DATA.customCategories as never);
    await fillSlimRoles(dataSource, mockTenantId);
    await seedDemoDataset(dataSource, mockTenantId, { now: NOW });
    // The default test user acts as Fachspezialist (full area rights).
    await assignAppRole(dataSource, mockUserId, SLIM_ROLE.SPECIALIST);
    const [owner] = await dataSource.query('select userId from auth_user where email = ?', [RANGE_OWNER_EMAIL]);
    rangeOwnerId = owner.userId;

    areas = (await api.http().get(BASE).expect(200)).body;
  });

  afterAll(async () => {
    await api.close();
  });

  it('answers 403 for a signed-in user without an app right (B1 8.1.2 «X»)', async () => {
    const stranger = randomUUID();
    const res = await api.http().get(BASE).set(authHeaders(stranger)).expect(403);
    expect(res.body.message).toBe('User does not have permission to perform this task.');
  });

  it('lists the areas of the tenant with their traffic lights', () => {
    expect(areas).toHaveLength(9);
    expect(areas[0]).toMatchObject({ name: 'Geissalp', coordinationSectionNo: '1104.020', enabled: true });
    expect(areas[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        quotaStatus: expect.any(String),
        noiseStatus: expect.any(String),
        annex7Overall: expect.any(Boolean),
      }),
    );
  });

  it('answers 403 in a tenant where the user holds no role (rights are per tenant)', async () => {
    const res = await api.http().get(BASE).set(authHeaders(mockUserId, randomUUID())).expect(403);
    expect(res.body.message).toBe('User does not have permission to perform this task.');
  });

  it('serves the summary and the dashboard counts', async () => {
    const summary = await api.http().get(`${BASE}/summary`).expect(200);
    expect(summary.body).toMatchObject({ total: 9 });
    expect(summary.body.ok + summary.body.warn + summary.body.over + summary.body.none).toBe(9);

    const dashboard = await api.http().get(`${BASE}/dashboard`).expect(200);
    expect(dashboard.body).toMatchObject({ areas: 9 });
    expect(dashboard.body.users).toBeGreaterThan(0);
    expect(dashboard.body.weapons).toBeGreaterThan(0);
  });

  it('reads one area and answers 404 for an unknown id', async () => {
    const geissalp = byName('Geissalp');
    const res = await api.http().get(`${BASE}/${geissalp.id}`).expect(200);
    expect(res.body).toMatchObject({ id: geissalp.id, name: 'Geissalp' });

    await api.http().get(`${BASE}/${randomUUID()}`).expect(404);
  });

  it('rejects a create with wrong field types (global ValidationPipe)', async () => {
    const res = await api.http().post(BASE).send({ name: 123, coordinationSectionNo: 'x'.repeat(21) }).expect(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining('name'), expect.stringContaining('coordinationSectionNo')]),
    );
  });

  it('creates, updates and deletes an area (201 / 200 / 204 / 404)', async () => {
    const created = await api
      .http()
      .post(BASE)
      .send({ name: 'Testplatz HTTP', coordinationSectionNo: '9999.001', sectoralPlanNo: null })
      .expect(201);
    expect(created.body).toMatchObject({ name: 'Testplatz HTTP', coordinationSectionNo: '9999.001', enabled: true });
    const id: string = created.body.id;

    const updated = await api.http().patch(`${BASE}/${id}`).send({ name: 'Testplatz HTTP 2', enabled: false }).expect(200);
    expect(updated.body).toMatchObject({ id, name: 'Testplatz HTTP 2', enabled: false });

    await api.http().patch(`${BASE}/${id}`).send({ enabled: 'yes' }).expect(400);

    await api.http().delete(`${BASE}/${id}`).expect(204);
    await api.http().get(`${BASE}/${id}`).expect(404);
    const list: AreaResultDto[] = (await api.http().get(BASE).expect(200)).body;
    expect(list.map((a) => a.id)).not.toContain(id);
  });

  it('scopes the Schiessplatz-Verantwortlicher to the assigned areas (B1 8.1.2 «W/R-O»)', async () => {
    const asOwner = authHeaders(rangeOwnerId);
    const list: AreaResultDto[] = (await api.http().get(BASE).set(asOwner).expect(200)).body;
    expect(list.map((a) => a.name)).toEqual(['Geissalp', 'Thun']);

    await api.http().get(`${BASE}/${byName('Geissalp').id}`).set(asOwner).expect(200);
    const denied = await api.http().get(`${BASE}/${byName('Bière').id}`).set(asOwner).expect(403);
    expect(denied.body.message).toBe('Not assigned to this Schiessplatz');
    await api.http().patch(`${BASE}/${byName('Bière').id}`).set(asOwner).send({ name: 'x' }).expect(403);

    const summary = await api.http().get(`${BASE}/summary`).set(asOwner).expect(200);
    expect(summary.body.total).toBe(2);
  });
});
