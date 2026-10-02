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
import { SettingsModule } from '../../settings/settings.module';

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
        ...CalculationModule.DBOptions.entities, ...SettingsModule.DBOptions.entities,
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

  describe('a Nutzung under its own address (B1 5.6, slm 5 / slm 6)', () => {
    it('returns one usage with its positions, also of another year than the current one', async () => {
      const listed = overview.usages[0];
      const one = await api.http().get(`${base()}/${listed.id}`).expect(200);
      expect(one.body).toEqual(listed);

      const lastYear: UsageOverviewDto = (await api.http().get(overviewOf()).query({ year: 2025 }).expect(200)).body;
      const old = await api.http().get(`${base()}/${lastYear.usages[0].id}`).expect(200);
      expect(old.body.date.slice(0, 4)).toBe('2025');
      expect(old.body.positions.length).toBeGreaterThan(0);
    });

    it('answers 404 for an unknown id, for the usage of another Schiessplatz and for a deleted usage', async () => {
      await api.http().get(`${base()}/${randomUUID()}`).expect(404);
      await api.http().get(`${base()}/not-a-uuid`).expect(400);

      const areas: AreaResultDto[] = (await api.http().get('/api/admin/area').expect(200)).body;
      const other = areas.find((a) => a.id !== geissalpId) as AreaResultDto;
      // The id is real, but the usage does not belong to that Schiessplatz.
      await api.http().get(`${base(other.id)}/${overview.usages[0].id}`).expect(404);

      const created = await api.http().post(base()).send(validUsage()).expect(201);
      await api.http().post(`${base()}/delete`).send({ ids: [created.body.id] }).expect(200);
      await api.http().get(`${base()}/${created.body.id}`).expect(404);
    });

    it('is readable for a read-only role', async () => {
      await api.http().get(`${base()}/${overview.usages[0].id}`).set(authHeaders(readOnlyUserId)).expect(200);
    });
  });

  describe('sums per unit: Stück and Kilogramm are never added to each other', () => {
    it('moves each sum only by the quantities of its own unit', async () => {
      const kg = overview.combinations.find((c) => c.quantityUnit === 'kg') as UsageCombinationDto;
      const pieces = combo();
      const before: UsageOverviewDto = (await api.http().get(overviewOf()).query({ year: YEAR }).expect(200)).body;

      const explosive = await api
        .http()
        .post(base())
        .send({ ...validUsage(), roomId: kg.roomId, date: `${YEAR}-04-02`, positions: [{ combinationId: kg.combinationId, quantity: 2.5 }] })
        .expect(201);
      expect(explosive.body).toMatchObject({ shots: 0, kg: 2.5 });
      expect(explosive.body).not.toHaveProperty('quantityUnit');
      const rifle = await api
        .http()
        .post(base())
        .send({ ...validUsage(), date: `${YEAR}-04-02`, positions: [{ combinationId: pieces.combinationId, quantity: 1000 }] })
        .expect(201);
      expect(rifle.body).toMatchObject({ shots: 1000, kg: 0 });

      const after: UsageOverviewDto = (await api.http().get(overviewOf()).query({ year: YEAR }).expect(200)).body;
      // KPI of the year: 1000 Schuss and 2.5 kg, not 1002.5 of anything.
      expect(after.kpi.totalShots - before.kpi.totalShots).toBeCloseTo(1000, 3);
      expect(after.kpi.totalKg - before.kpi.totalKg).toBeCloseTo(2.5, 3);
      // Counters of the two rooms.
      const room = (o: UsageOverviewDto, id: string) => o.rooms.find((r) => r.id === id) as UsageOverviewDto['rooms'][number];
      expect(room(after, kg.roomId).kg - room(before, kg.roomId).kg).toBeCloseTo(2.5, 3);
      expect(room(after, kg.roomId).shots).toBe(room(before, kg.roomId).shots);
      expect(room(after, pieces.roomId).shots - room(before, pieces.roomId).shots).toBeCloseTo(1000, 3);
      expect(room(after, pieces.roomId).kg).toBe(room(before, pieces.roomId).kg);

      await api.http().post(`${base()}/delete`).send({ ids: [explosive.body.id, rifle.body.id] }).expect(200);
    });

    it('adds up to the positions of the list, per unit', () => {
      const sum = (unit: 'shots' | 'kg') =>
        overview.usages.reduce((total, u) => total + u.positions.filter((p) => p.quantityUnit === unit).reduce((s, p) => s + p.quantity, 0), 0);
      expect(overview.kpi.totalShots).toBeCloseTo(sum('shots'), 3);
      expect(overview.kpi.totalKg).toBeCloseTo(sum('kg'), 3);
      // The demo data records Sprengstoff, so the two sums really differ.
      expect(overview.kpi.totalKg).toBeGreaterThan(0);
      expect(overview.rooms.reduce((s, r) => s + r.kg, 0)).toBeCloseTo(overview.kpi.totalKg, 3);
      expect(overview.rooms.reduce((s, r) => s + r.shots, 0)).toBeCloseTo(overview.kpi.totalShots, 3);
    });
  });

  it('lets a read-only role read but not write (galaxy AppsRolesGuard)', async () => {
    const asReader = authHeaders(readOnlyUserId);
    await api.http().get(overviewOf()).set(asReader).expect(200);
    await api.http().post(base()).set(asReader).send(validUsage()).expect(403);
    await api.http().post(`${base()}/delete`).set(asReader).send({ ids: [randomUUID()] }).expect(403);
  });
});
