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
import { AreaWeaponAssignmentDto } from '../dto';

const NOW = new Date(2026, 11, 31);
const BASE = '/api/admin/data/area';

/**
 * HTTP contract of Datenverwaltung › Schiessplatz › Zuordnung Waffen (B1
 * 5.17, `slm 17`): the Stellungsräume with their zulässigen Kombinationen,
 * read only for every role (FAQ 52), the rights of app 48 and the «R-O»
 * scope of the Schiessplatz-Verantwortliche.
 */
describe('AdminDataAreaWeaponsController (HTTP)', () => {
  let api: TestApp;
  let geissalpId: string;
  let biereId: string;

  const url = (areaId: string) => `${BASE}/${areaId}/weapon-assignment`;
  const userId = async (email: string): Promise<string> => {
    const [row] = await api.dataSource.query('select userId from auth_user where email = ?', [email]);
    return row.userId;
  };

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
  });

  afterAll(async () => {
    await api.close();
  });

  it('answers 403 without the app right «Zuordnung Waffen»', async () => {
    await api.http().get(url(geissalpId)).set(authHeaders(randomUUID())).expect(403);
  });

  it('serves the rooms of Geissalp with their zulässigen Kombinationen (B1 Abbildung 28)', async () => {
    const body: AreaWeaponAssignmentDto = (await api.http().get(url(geissalpId)).expect(200)).body;
    expect(body.area).toMatchObject({ name: 'Geissalp', coordinationSectionNo: '1104.020' });

    // Left table: every Stellungsraum, in the order of the Schiessplatz, also the ones without an assignment.
    expect(body.rooms).toHaveLength(14);
    expect(body.rooms[0]).toMatchObject({ coordinationSectionNo: '1104.020.01', name: 'Zielrm / Stellungsrm Fendershuus, A 1 links', enabled: true, assignmentCount: 1 });
    expect(body.rooms.filter((r) => r.assignmentCount === 0).map((r) => r.name)).toEqual([
      'Zielrm / Stellungsrm Seelihuus, B 1',
      'NGST Seeli C links',
      'NGST Schönenboden D unten',
      'NGST Schönenboden D oben',
    ]);
    expect(body.rooms.reduce((sum, r) => sum + r.assignmentCount, 0)).toBe(body.assignments.length);
    expect(body.assignments).toHaveLength(17);

    // Right table: Waffenname für Erfassung, Waffe, Kaliber, Kategorie — sorted by the entry name.
    const b2 = body.rooms.find((r) => r.name === 'Stellungsrm B 2');
    expect(b2?.assignmentCount).toBe(3);
    const ofB2 = body.assignments.filter((a) => a.roomId === b2?.id);
    expect(ofB2.map((a) => a.entryName)).toEqual(['Mg 51 · 7.5 mm', 'Pist 75 · 9 mm', 'Stgw 90 · 5.6 mm']);
    expect(ofB2.find((a) => a.entryName.startsWith('Stgw 90'))).toMatchObject({
      weapon: 'Stgw 90',
      caliber: '5.6 mm GP 90',
      category: 'handguns',
      categoryName: 'Handfeuerwaffen',
      enabled: true,
    });
    for (const a of body.assignments) expect(body.rooms.some((r) => r.id === a.roomId)).toBe(true);
  });

  it('is a display for every role (FAQ 52): Fachspezialist, Schiessplatz-Verantwortliche and Applikationsadministrator read, the Interessent has no right', async () => {
    // The Fachspezialist of the suite reads (case above); there is nothing to write to.
    await api.http().post(url(geissalpId)).send({}).expect(404);
    await api.http().patch(url(geissalpId)).send({}).expect(404);
    await api.http().delete(url(geissalpId)).expect(404);

    await api.http().get(url(geissalpId)).set(authHeaders(await userId('appadmin@demo.ch'))).expect(200);
    await api.http().get(url(geissalpId)).set(authHeaders(await userId('interessent@demo.ch'))).expect(403);
  });

  it('scopes the Schiessplatz-Verantwortliche to the assigned areas (R-O)', async () => {
    const asOwner = authHeaders(await userId('schiessplatz@demo.ch'));
    const own: AreaWeaponAssignmentDto = (await api.http().get(url(geissalpId)).set(asOwner).expect(200)).body;
    expect(own.rooms).toHaveLength(14);
    const denied = await api.http().get(url(biereId)).set(asOwner).expect(403);
    expect(denied.body.message).toBe('Not assigned to this Schiessplatz');
  });

  it('answers 404 for an unknown Schiessplatz and 400 for a malformed id', async () => {
    await api.http().get(url(randomUUID())).expect(404);
    await api.http().get(url('not-a-uuid')).expect(400);
  });
});
