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
import { AreaModule } from '../../area/area.module';
import { AreaEntity } from '../../area/entities';
import { CalculationModule } from '../../calculation/calculation.module';
import { UsageModule } from '../../usage/usage.module';
import { DataAreaModule } from '../data-area.module';
import { AreaGeneralDto, AreaQuotaDto } from '../dto';

const NOW = new Date(2026, 11, 31);
const BASE = '/api/admin/data/area';
const RANGE_OWNER_EMAIL = 'schiessplatz@demo.ch';
const INTERESTED_EMAIL = 'interessent@demo.ch';

/**
 * HTTP contract of Datenverwaltung › Schiessplatz › Allgemein (B1 5.15 /
 * 5.16): the read model with Stellungsräume and Kontingente, the Stammdaten
 * update, the Kontingent CRUD with its uniqueness rule, the rights of the
 * four roles (app 41: Fachspezialist R/W, others R) and the «W/R-O» scope.
 */
describe('AdminDataAreaController (HTTP)', () => {
  let api: TestApp;
  let geissalpId: string;
  let biereId: string;
  let rangeOwnerId: string;
  let interestedId: string;

  const url = (areaId: string, rest = '') => `${BASE}/${areaId}${rest}`;

  beforeAll(async () => {
    api = await createTestApp({
      modules: [AreaModule, UsageModule, CalculationModule, DataAreaModule],
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
    const areas = dataSource.getRepository(AreaEntity);
    geissalpId = (await areas.findOneByOrFail({ tenantId: mockTenantId, name: 'Geissalp' })).id;
    biereId = (await areas.findOneByOrFail({ tenantId: mockTenantId, name: 'Bière' })).id;
    const [owner] = await dataSource.query('select userId from auth_user where email = ?', [RANGE_OWNER_EMAIL]);
    const [interested] = await dataSource.query('select userId from auth_user where email = ?', [INTERESTED_EMAIL]);
    rangeOwnerId = owner.userId;
    interestedId = interested.userId;
  });

  afterAll(async () => {
    await api.close();
  });

  it('answers 403 without the app right «Datenverwaltung › Schiessplatz»', async () => {
    await api.http().get(url(geissalpId)).set(authHeaders(randomUUID())).expect(403);
  });

  it('serves the general read model of Geissalp (5.15): Stammdaten, rooms without a number, quotas, options', async () => {
    const res = await api.http().get(url(geissalpId)).expect(200);
    const body: AreaGeneralDto = res.body;
    expect(body.area).toMatchObject({
      name: 'Geissalp',
      coordinationSectionNo: '1104.020',
      classification: 'unproblematic',
      recalculationState: 'in_progress',
      remediationProjectState: 'concept',
      spmState: 'completed',
      noiseRemediationState: 'reassessment_needed',
      projectState: 'not_started',
      planningApproval: 'Militärische Plangenehmigung vom 13.02.2023',
      annex7Overall: false,
      enabled: true,
    });
    // Baujahr comes from the current state (initial 2019 = mixed).
    expect(body.buildYearClass).toBe('mixed');
    expect(body.currentStateName).toBeTruthy();
    expect(body.rooms).toHaveLength(14);
    expect(body.rooms.filter((r) => r.coordinationSectionNo === null).map((r) => r.name)).toEqual([
      'Stellungsrm Mw Schönenboden, D',
      'NGST Schönenboden D oben',
    ]);
    expect(body.quotas.length).toBeGreaterThan(5);
    const stgw = body.quotas.find((q) => q.name === 'Stgw 90 · 5.6 mm') as AreaQuotaDto;
    expect(stgw).toMatchObject({ shotsPerYear: 320000, basis: 'Plangenehmigung 2019', assigned: true, quantityUnit: 'shots' });
    // Every quota of the seed is a combination of the tenant; the options carry the flags.
    const option = body.combinations.find((c) => c.id === stgw.combinationId);
    expect(option).toMatchObject({ assigned: true, hasQuota: true });
    expect(body.combinations.some((c) => !c.hasQuota)).toBe(true);
  });

  it('updates the Stammdaten (5.16) and validates the pick lists', async () => {
    const updated = await api
      .http()
      .patch(url(geissalpId))
      .send({ classification: 'problematic', spmState: 'in_progress', planningApproval: 'Militärische Plangenehmigung vom 01.02.2026', annex7Overall: true })
      .expect(200);
    expect(updated.body).toMatchObject({ classification: 'problematic', spmState: 'in_progress', annex7Overall: true, planningApproval: 'Militärische Plangenehmigung vom 01.02.2026' });

    const bad = await api.http().patch(url(geissalpId)).send({ classification: 'whatever' }).expect(400);
    expect(bad.body.message).toEqual(expect.arrayContaining([expect.stringContaining('classification')]));
    await api.http().patch(url(geissalpId)).send({ name: '' }).expect(400);

    // The Koordinationsabschnitts-Nr. stays unique across the tenant.
    const clash = await api.http().patch(url(geissalpId)).send({ coordinationSectionNo: '2201.010' }).expect(409);
    expect(clash.body.message).toContain('2201.010');

    // Back to the seed values so the other cases read what they expect.
    await api
      .http()
      .patch(url(geissalpId))
      .send({ classification: 'unproblematic', spmState: 'completed', planningApproval: 'Militärische Plangenehmigung vom 13.02.2023', annex7Overall: false })
      .expect(200);
  });

  it('creates, updates and deletes a Kontingent (5.16), one per combination', async () => {
    const general: AreaGeneralDto = (await api.http().get(url(geissalpId)).expect(200)).body;
    const free = general.combinations.find((c) => !c.hasQuota);
    expect(free).toBeDefined();
    const taken = general.quotas[0];

    // One Kontingent per combination.
    const dup = await api.http().post(url(geissalpId, '/quota')).send({ combinationId: taken.combinationId, shotsPerYear: 10 }).expect(409);
    expect(dup.body.message).toContain('bereits');

    // Validation: positive amount, uuid.
    await api.http().post(url(geissalpId, '/quota')).send({ combinationId: free?.id, shotsPerYear: 0 }).expect(400);
    await api.http().post(url(geissalpId, '/quota')).send({ combinationId: 'nope', shotsPerYear: 5 }).expect(400);
    await api.http().post(url(geissalpId, '/quota')).send({ combinationId: randomUUID(), shotsPerYear: 5 }).expect(404);

    // Create: the basis defaults to the Plangenehmigung of the Schiessplatz.
    const created = await api.http().post(url(geissalpId, '/quota')).send({ combinationId: free?.id, shotsPerYear: 1234.5 }).expect(201);
    const quota: AreaQuotaDto = created.body;
    expect(quota).toMatchObject({ combinationId: free?.id, shotsPerYear: 1234.5, basis: 'Militärische Plangenehmigung vom 13.02.2023' });

    const updated = await api.http().patch(url(geissalpId, `/quota/${quota.id}`)).send({ shotsPerYear: 2000, basis: 'Sanierungsbericht 2025' }).expect(200);
    expect(updated.body).toMatchObject({ id: quota.id, shotsPerYear: 2000, basis: 'Sanierungsbericht 2025' });
    await api.http().patch(url(geissalpId, `/quota/${quota.id}`)).send({ combinationId: taken.combinationId }).expect(409);

    const after: AreaGeneralDto = (await api.http().get(url(geissalpId)).expect(200)).body;
    expect(after.quotas.map((q) => q.id)).toContain(quota.id);
    expect(after.combinations.find((c) => c.id === free?.id)?.hasQuota).toBe(true);

    await api.http().post(url(geissalpId, `/quota/${quota.id}/delete`)).expect(204);
    await api.http().post(url(geissalpId, `/quota/${quota.id}/delete`)).expect(404);
    const gone: AreaGeneralDto = (await api.http().get(url(geissalpId)).expect(200)).body;
    expect(gone.quotas.map((q) => q.id)).not.toContain(quota.id);
  });

  it('lets a read-only role look but not touch (B1 8.1.2: Interessent R)', async () => {
    const asInterested = authHeaders(interestedId);
    await api.http().get(url(geissalpId)).set(asInterested).expect(200);
    await api.http().patch(url(geissalpId)).set(asInterested).send({ name: 'x' }).expect(403);
    await api.http().post(url(geissalpId, '/quota')).set(asInterested).send({ combinationId: randomUUID(), shotsPerYear: 1 }).expect(403);
  });

  it('scopes the Schiessplatz-Verantwortliche to the assigned areas (W/R-O, read only on app 41)', async () => {
    const asOwner = authHeaders(rangeOwnerId);
    await api.http().get(url(geissalpId)).set(asOwner).expect(200);
    const denied = await api.http().get(url(biereId)).set(asOwner).expect(403);
    expect(denied.body.message).toBe('Not assigned to this Schiessplatz');
    await api.http().patch(url(geissalpId)).set(asOwner).send({ name: 'x' }).expect(403);
  });

  it('answers 404 for an unknown Schiessplatz and 400 for a malformed id', async () => {
    await api.http().get(url(randomUUID())).expect(404);
    await api.http().get(url('not-a-uuid')).expect(400);
  });
});
