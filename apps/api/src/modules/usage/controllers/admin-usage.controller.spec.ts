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
import { API_MOCK_DATA } from '../../../mocks/main.mock-data';
import { fillSlimRoles, SLIM_ROLE } from '../../../mocks/roles.mock-data';
import { seedDemoDataset } from '../../../mocks/tenant/demo-dataset.seed';
import { DemoSeedMarkerEntity } from '../../../mocks/tenant/demo-seed-marker.entity';
import { AreaModule } from '../../area/area.module';
import { AreaResultDto } from '../../area/dto';
import { CalculationModule } from '../../calculation/calculation.module';
import { UsageCombinationDto, UsageOverviewDto } from '../dto';
import { UsageModule } from '../usage.module';

const NOW = new Date(2026, 11, 31);
const YEAR = 2026;

/**
 * HTTP contract of the usage controller (supertest, B1 5.11): routes under
 * `admin/area/:areaId/usage`, uuid params, the DTO validation of the global
 * pipe, «Erfasser» from the signed-in user and the read-only role.
 */
describe('AdminUsageController (HTTP)', () => {
  let api: TestApp;
  let geissalpId: string;
  let overview: UsageOverviewDto;
  /** Interessent: `read` on the area app → GET only. */
  let readOnlyUserId: string;

  const base = (areaId: string = geissalpId): string => `/api/admin/area/${areaId}/usage`;
  const overviewOf = (areaId: string = geissalpId): string => `${base(areaId)}/overview`;

  /** The Stgw 90 of a room that allows several combinations (military, Stück). */
  const combo = (): UsageCombinationDto =>
    overview.combinations.find(
      (c) => c.weapon === 'Stgw 90' && c.quantityUnit === 'shots' && overview.combinations.filter((x) => x.roomId === c.roomId).length > 1,
    ) as UsageCombinationDto;

  const validUsage = () => {
    const first = combo();
    const second = overview.combinations.find((c) => c.roomId === first.roomId && c.combinationId !== first.combinationId) as UsageCombinationDto;
    return {
      roomId: first.roomId,
      unit: 'Inf Bat 12',
      date: `${YEAR}-04-01`,
      timeFrom: '08:00',
      timeTo: '11:30',
      usageType: 'military',
      personCount: 42,
      positions: [
        { combinationId: first.combinationId, quantity: 250 },
        { combinationId: second.combinationId, quantity: 30.5 },
      ],
    };
  };

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
    await TestMockUserMock.fill.Apps(dataSource, API_MOCK_DATA.customApps as never, API_MOCK_DATA.customCategories as never);
    await fillSlimRoles(dataSource, mockTenantId);
    await seedDemoDataset(dataSource, mockTenantId, { now: NOW });
    await assignAppRole(dataSource, mockUserId, SLIM_ROLE.SPECIALIST);
    readOnlyUserId = await insertTestUser(dataSource);
    await assignAppRole(dataSource, readOnlyUserId, SLIM_ROLE.INTERESTED);

    const areas: AreaResultDto[] = (await api.http().get('/api/admin/area').expect(200)).body;
    geissalpId = areas.find((a) => a.coordinationSectionNo === '1104.020')?.id as string;
    overview = (await api.http().get(overviewOf()).query({ year: YEAR }).expect(200)).body;
  });

  afterAll(async () => {
    await api.close();
  });

  it('serves the overview of a year in one round trip', () => {
    expect(overview.kpi.year).toBe(YEAR);
    expect(overview.rooms).toHaveLength(14);
    expect(overview.combinations).toHaveLength(17);
    expect(overview.usages.length).toBeGreaterThan(60);
    expect(overview.kpi.count).toBe(overview.usages.length);
  });

  it('defaults to the current year and accepts another one', async () => {
    const thisYear = new Date().getFullYear();
    const res = await api.http().get(overviewOf()).expect(200);
    expect(res.body.kpi.year).toBe(thisYear);
    const last = await api.http().get(overviewOf()).query({ year: 2025 }).expect(200);
    expect(last.body.usages).toHaveLength(3);
  });

  it('rejects a malformed area id (ParseUUIDPipe) and an unknown area', async () => {
    const res = await api.http().get(overviewOf('not-a-uuid')).expect(400);
    expect(res.body.message).toMatch(/uuid/i);
    await api.http().get(overviewOf(randomUUID())).expect(404);
  });

  it('validates the body before the service runs', async () => {
    const bad = await api
      .http()
      .post(base())
      .send({ ...validUsage(), timeFrom: '08:10', date: '01.04.2026', positions: [{ combinationId: 'x', quantity: -1 }] })
      .expect(400);
    expect(bad.body.message).toEqual(
      expect.arrayContaining([
        expect.stringContaining('timeFrom'),
        expect.stringContaining('date'),
        expect.stringContaining('quantity'),
      ]),
    );
    // Business rules of the service answer 400 as well.
    const late = await api.http().post(base()).send({ ...validUsage(), timeTo: '07:00' }).expect(400);
    expect(late.body.message).toBe('timeTo must be after timeFrom');
  });

  it('creates, updates, deletes and restores a usage; «Erfasser» is the signed-in user', async () => {
    const created = await api.http().post(base()).send(validUsage()).expect(201);
    expect(created.body).toMatchObject({
      areaId: geissalpId,
      unit: 'Inf Bat 12',
      date: `${YEAR}-04-01`,
      recordedBy: 'Test User',
      shots: 280.5,
      source: 'manual',
    });
    expect(created.body.positions).toHaveLength(2);
    const id: string = created.body.id;

    const updated = await api.http().patch(`${base()}/${id}`).send({ unit: 'Inf Bat 13', personCount: 7 }).expect(200);
    expect(updated.body).toMatchObject({ id, unit: 'Inf Bat 13', personCount: 7 });
    await api.http().patch(`${base()}/${randomUUID()}`).send({ unit: 'x' }).expect(404);

    const removed = await api.http().post(`${base()}/delete`).send({ ids: [id] }).expect(200);
    expect(removed.body).toEqual({ ids: [id], count: 1 });
    const after: UsageOverviewDto = (await api.http().get(overviewOf()).query({ year: YEAR }).expect(200)).body;
    expect(after.usages.map((u) => u.id)).not.toContain(id);

    const restored = await api.http().post(`${base()}/restore`).send({ ids: [id] }).expect(200);
    expect(restored.body).toEqual({ ids: [id], count: 1 });
    const back: UsageOverviewDto = (await api.http().get(overviewOf()).query({ year: YEAR }).expect(200)).body;
    expect(back.usages.map((u) => u.id)).toContain(id);

    await api.http().post(`${base()}/delete`).send({ ids: ['nope'] }).expect(400);
    await api.http().post(`${base()}/delete`).send({ ids: [] }).expect(400);
  });

  it('lets a read-only role read but not write (galaxy AppsRolesGuard)', async () => {
    const asReader = authHeaders(readOnlyUserId);
    await api.http().get(overviewOf()).set(asReader).expect(200);
    await api.http().post(base()).set(asReader).send(validUsage()).expect(403);
    await api.http().post(`${base()}/delete`).set(asReader).send({ ids: [randomUUID()] }).expect(403);
  });
});
