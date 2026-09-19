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
import { UsageModule } from '../../usage/usage.module';
import { CalculationModule } from '../calculation.module';
import { AssessmentDto, CalculationDto, CalculationRunDto, SimulationBaseDto } from '../dto';

const NOW = new Date(2026, 11, 31);
const YEAR = 2026;
/** The dataset's Schiessplatz-Verantwortlicher: area rights, but no Immissionsberechnung (B1 8.1.2). */
const RANGE_OWNER_EMAIL = 'schiessplatz@demo.ch';

/**
 * HTTP contract of the calculation controller (supertest): states (5.18),
 * the receiver assessment (5.12), stored runs (5.10) and the simulation
 * (5.13) with the per-route app rights on top of the area right.
 */
describe('AdminCalculationController (HTTP)', () => {
  let api: TestApp;
  let geissalpId: string;
  let rangeOwnerId: string;
  let states: CalculationDto[];
  /** Interessent: reads areas, no simulation / run right. */
  let readOnlyUserId: string;

  const base = (areaId: string = geissalpId): string => `/api/admin/area/${areaId}/calculation`;

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
    const [owner] = await dataSource.query('select userId from auth_user where email = ?', [RANGE_OWNER_EMAIL]);
    rangeOwnerId = owner.userId;

    const areas: AreaResultDto[] = (await api.http().get('/api/admin/area').expect(200)).body;
    geissalpId = areas.find((a) => a.name === 'Geissalp')?.id as string;
    states = (await api.http().get(base()).expect(200)).body;
  });

  afterAll(async () => {
    await api.close();
  });

  it('lists the calculation states of the area with the current one flagged', () => {
    expect(states.length).toBeGreaterThan(0);
    const current = states.find((s) => s.isCurrent) as CalculationDto;
    expect(current).toMatchObject({ name: 'Initiale Aufnahme Areal Geissalp' });
    expect(current.sourceCount).toBeGreaterThan(0);
    expect(current).toEqual(expect.objectContaining({ id: expect.any(String), calculationId: expect.any(String), referenceYear: expect.any(Number) }));
  });

  it('assesses the receivers of the current state for the chosen years (5.12)', async () => {
    const res = await api.http().get(`${base()}/assessment`).query({ years: String(YEAR) }).expect(200);
    const assessment: AssessmentDto = res.body;
    expect(assessment.areaId).toBe(geissalpId);
    expect(assessment.calculation?.isCurrent).toBe(true);
    expect(assessment.period.selectedYears).toEqual([YEAR]);
    expect(assessment.receivers.length).toBeGreaterThan(0);
    expect(assessment.counts.total).toBe(assessment.receivers.length);
    expect(assessment.receivers[0].rows.length).toBeGreaterThan(0);
    expect(new Date(assessment.calculatedAt).getTime()).not.toBeNaN();
  });

  it('validates the assessment query (uuid, date pattern)', async () => {
    await api.http().get(`${base()}/assessment`).query({ calculationId: 'nope' }).expect(400);
    await api.http().get(`${base()}/assessment`).query({ from: '1.1.2026' }).expect(400);
    await api.http().get(`${base()}/assessment`).query({ calculationId: randomUUID() }).expect(404);
  });

  it('stores an Immissionsberechnung as an immutable run and reads it back (5.10)', async () => {
    const created = await api.http().post(`${base()}/run`).send({ years: [YEAR] }).expect(201);
    const run: CalculationRunDto = created.body;
    expect(run).toMatchObject({ areaId: geissalpId, years: [YEAR], createdBy: 'Test User' });
    expect(run.usageCount).toBeGreaterThan(0);
    expect(run.checksum).toEqual(expect.any(String));

    const list: CalculationRunDto[] = (await api.http().get(`${base()}/run`).expect(200)).body;
    expect(list.map((r) => r.id)).toContain(run.id);
    expect(list.every((r) => r.results === null)).toBe(true);

    const one: CalculationRunDto = (await api.http().get(`${base()}/run/${run.id}`).expect(200)).body;
    expect(one.results?.receivers.length).toBeGreaterThan(0);
    await api.http().get(`${base()}/run/${randomUUID()}`).expect(404);
  });

  it('needs the Immissionsberechnung right for a run (B1 8.1.2): the Schiessplatz-Verantwortlicher gets 403', async () => {
    const asOwner = authHeaders(rangeOwnerId);
    await api.http().get(base()).set(asOwner).expect(200);
    await api.http().get(`${base()}/run`).set(asOwner).expect(200);
    await api.http().post(`${base()}/run`).set(asOwner).send({ years: [YEAR] }).expect(403);
  });

  it('serves the simulation base and runs a simulation for the roles that may (5.13)', async () => {
    const res = await api.http().get(`${base()}/simulation`).query({ year: YEAR }).expect(200);
    const simulation: SimulationBaseDto = res.body;
    expect(simulation).toMatchObject({ areaId: geissalpId, year: YEAR });
    expect(simulation.rows.length).toBeGreaterThan(0);
    expect(simulation.receivers.length).toBeGreaterThan(0);

    const row = simulation.rows.find((r) => r.hasLevels && r.inside > 0) ?? simulation.rows[0];
    const result = await api
      .http()
      .post(`${base()}/simulation`)
      .send({ year: YEAR, rows: [{ roomId: row.roomId, combinationId: row.combinationId, inside: row.inside * 2, outside: row.outside }] })
      .expect(200);
    expect(result.body).toMatchObject({ areaId: geissalpId, year: YEAR });
    // Rows the client did not send keep their Ist values: total = base + the doubled row.
    expect(result.body.totals.inside).toBeCloseTo(result.body.totals.baseInside + row.inside, 3);
    expect(result.body.receivers.length).toBe(simulation.receivers.length);

    // Validation: year range, uuids, non-negative quantities.
    await api.http().post(`${base()}/simulation`).send({ year: 1999, rows: [] }).expect(400);
    await api.http().post(`${base()}/simulation`).send({ year: YEAR, rows: [{ roomId: 'x', combinationId: row.combinationId, inside: -1, outside: 0 }] }).expect(400);

    // The Interessent reads areas but has no simulation right.
    const asReader = authHeaders(readOnlyUserId);
    await api.http().get(base()).set(asReader).expect(200);
    await api.http().get(`${base()}/simulation`).set(asReader).query({ year: YEAR }).expect(403);
    // The Schiessplatz-Verantwortlicher may simulate his own areas.
    await api.http().get(`${base()}/simulation`).set(authHeaders(rangeOwnerId)).query({ year: YEAR }).expect(200);
  });
});
