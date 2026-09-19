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
import { CalculationModule } from '../../calculation/calculation.module';
import { UsageModule } from '../../usage/usage.module';
import { DataWeaponsModule } from '../data-weapons.module';
import { WeaponCombinationDto, WeaponMasterDataDto } from '../dto';

const NOW = new Date(2026, 11, 31);
const BASE = '/api/admin/data/weapons';
const INTERESTED_EMAIL = 'interessent@demo.ch';

/**
 * HTTP contract of Datenverwaltung › Waffen (B1 5.22–5.25): the four lists
 * with their usage counts, CRUD of every kind with uniqueness rules, the
 * referential delete protection (409 with the count), the XLSX export and
 * the rights (app 43: Fachspezialist root, every other role R).
 */
describe('AdminDataWeaponsController (HTTP)', () => {
  let api: TestApp;
  let interestedId: string;
  let data: WeaponMasterDataDto;

  beforeAll(async () => {
    api = await createTestApp({
      modules: [AreaModule, UsageModule, CalculationModule, DataWeaponsModule],
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
    const [interested] = await dataSource.query('select userId from auth_user where email = ?', [INTERESTED_EMAIL]);
    interestedId = interested.userId;
    data = (await api.http().get(BASE).expect(200)).body;
  });

  afterAll(async () => {
    await api.close();
  });

  it('answers 403 without the app right «Datenverwaltung › Waffen»', async () => {
    await api.http().get(BASE).set(authHeaders(randomUUID())).expect(403);
  });

  it('lists the four master-data lists of the demo with their usage (5.22–5.25)', () => {
    expect(data.categories.map((c) => c.code)).toEqual(['handguns', 'mortar', 'artillery', 'air_defence']);
    expect(data.categories.find((c) => c.code === 'handguns')?.weaponCount).toBe(3);
    expect(data.weapons.length).toBe(11);
    expect(data.calibers.length).toBe(9);
    expect(data.calibers.find((c) => c.nameDe === '5.6 mm GP 90')).toMatchObject({ alnNo: '594-7005', sapNo: '2000.7073', quantityUnit: 'shots' });
    expect(data.combinations.length).toBe(11);
    const stgw = data.combinations.find((k) => k.nameDe === 'Stgw 90 · 5.6 mm') as WeaponCombinationDto;
    expect(stgw).toMatchObject({ weaponName: 'Stgw 90', caliberName: '5.6 mm GP 90', categoryName: 'Handfeuerwaffen', sonarmsId: 'Stgw90', enabled: true });
    // Verwendung: Geissalp and every light area assign the Stgw 90.
    expect(stgw.areas.map((a) => a.name)).toContain('Geissalp');
    expect(stgw.areas.length).toBeGreaterThan(5);
    expect(stgw.usageCount).toBeGreaterThan(0);
    expect(stgw.quotaCount).toBeGreaterThan(0);
    expect(stgw.sourceCount).toBeGreaterThan(0);
    expect(stgw.inUse).toBeGreaterThan(stgw.usageCount);
    expect(data.sonarmsOptions).toContain('Stgw90');
  });

  it('creates, updates and deletes a Waffenkategorie with a derived key and uniqueness (5.25)', async () => {
    const created = await api.http().post(`${BASE}/category`).send({ nameDe: 'Fliegerabwehr Mobil', nameFr: 'DCA mobile' }).expect(201);
    expect(created.body).toMatchObject({ nameDe: 'Fliegerabwehr Mobil', nameFr: 'DCA mobile', code: 'fliegerabwehr_mobil', enabled: true, weaponCount: 0 });
    const id: string = created.body.id;

    await api.http().post(`${BASE}/category`).send({ nameDe: 'Fliegerabwehr Mobil' }).expect(409);
    await api.http().post(`${BASE}/category`).send({ nameDe: '' }).expect(400);
    await api.http().post(`${BASE}/category`).send({ nameDe: 'x', code: 'Not Valid' }).expect(400);

    const updated = await api.http().patch(`${BASE}/category/${id}`).send({ nameIt: 'DCA mobile IT', enabled: false }).expect(200);
    expect(updated.body).toMatchObject({ id, nameIt: 'DCA mobile IT', enabled: false });

    await api.http().delete(`${BASE}/category/${id}`).expect(204);
    await api.http().patch(`${BASE}/category/${id}`).send({ nameDe: 'x' }).expect(404);
    // The name is free again after the delete.
    const again = await api.http().post(`${BASE}/category`).send({ nameDe: 'Fliegerabwehr Mobil' }).expect(201);
    await api.http().delete(`${BASE}/category/${again.body.id}`).expect(204);
  });

  it('refuses to delete a category, weapon or caliber that is still in use (409 with the count)', async () => {
    const handguns = data.categories.find((c) => c.code === 'handguns');
    const res = await api.http().delete(`${BASE}/category/${handguns?.id}`).expect(409);
    expect(res.body).toMatchObject({ message: 'category-in-use', kind: 'category', inUse: 3 });

    const stgw = data.weapons.find((w) => w.nameDe === 'Stgw 90');
    const w = await api.http().delete(`${BASE}/weapon/${stgw?.id}`).expect(409);
    expect(w.body).toMatchObject({ message: 'weapon-in-use', inUse: 1 });

    const gp90 = data.calibers.find((c) => c.nameDe === '5.6 mm GP 90');
    const c = await api.http().delete(`${BASE}/caliber/${gp90?.id}`).expect(409);
    expect(c.body).toMatchObject({ message: 'caliber-in-use', inUse: 1 });

    const combination = data.combinations.find((k) => k.nameDe === 'Stgw 90 · 5.6 mm');
    const k = await api.http().delete(`${BASE}/combination/${combination?.id}`).expect(409);
    expect(k.body).toMatchObject({ message: 'combination-in-use', inUse: combination?.inUse });
  });

  it('maintains weapon, caliber and combination (5.22–5.24) with the Anhang 7 category and the sonARMS mapping', async () => {
    const handguns = data.categories.find((c) => c.code === 'handguns');

    const weapon = await api.http().post(`${BASE}/weapon`).send({ nameDe: 'Stgw 57', categoryId: handguns?.id, annex7Category: 'a' }).expect(201);
    expect(weapon.body).toMatchObject({ nameDe: 'Stgw 57', categoryName: 'Handfeuerwaffen', annex7Category: 'a', combinationCount: 0 });
    await api.http().post(`${BASE}/weapon`).send({ nameDe: 'Stgw 57', categoryId: handguns?.id }).expect(409);
    await api.http().post(`${BASE}/weapon`).send({ nameDe: 'Neu', categoryId: randomUUID() }).expect(404);
    await api.http().post(`${BASE}/weapon`).send({ nameDe: 'Neu', categoryId: handguns?.id, annex7Category: 'z' }).expect(400);

    const caliber = await api.http().post(`${BASE}/caliber`).send({ nameDe: '7.5 mm GP 11 Mark', alnNo: '550-1101', sapNo: '2410.0012' }).expect(201);
    expect(caliber.body).toMatchObject({ nameDe: '7.5 mm GP 11 Mark', alnNo: '550-1101', sapNo: '2410.0012', quantityUnit: 'shots' });
    await api.http().post(`${BASE}/caliber`).send({ nameDe: 'x', quantityUnit: 'liters' }).expect(400);

    // Combination: default name «Waffe · Kaliber», unique pair, sonARMS mapping editable.
    const combination = await api
      .http()
      .post(`${BASE}/combination`)
      .send({ weaponId: weapon.body.id, caliberId: caliber.body.id })
      .expect(201);
    expect(combination.body).toMatchObject({ nameDe: 'Stgw 57 · 7.5 mm GP 11 Mark', weaponName: 'Stgw 57', caliberName: '7.5 mm GP 11 Mark', categoryName: 'Handfeuerwaffen', sonarmsId: null, areas: [], inUse: 0 });
    const dup = await api.http().post(`${BASE}/combination`).send({ weaponId: weapon.body.id, caliberId: caliber.body.id }).expect(409);
    expect(dup.body.message).toContain('besteht bereits');

    const mapped = await api.http().patch(`${BASE}/combination/${combination.body.id}`).send({ sonarmsId: 'Stgw57', nameFr: 'Fass 57 · 7,5 mm' }).expect(200);
    expect(mapped.body).toMatchObject({ sonarmsId: 'Stgw57', nameFr: 'Fass 57 · 7,5 mm' });
    const list: WeaponMasterDataDto = (await api.http().get(BASE).expect(200)).body;
    expect(list.sonarmsOptions).toContain('Stgw57');
    expect(list.weapons.find((w) => w.id === weapon.body.id)?.combinationCount).toBe(1);

    // The weapon is now in use → 409; delete the combination first, then weapon and caliber.
    await api.http().delete(`${BASE}/weapon/${weapon.body.id}`).expect(409);
    await api.http().delete(`${BASE}/combination/${combination.body.id}`).expect(204);
    await api.http().delete(`${BASE}/weapon/${weapon.body.id}`).expect(204);
    await api.http().delete(`${BASE}/caliber/${caliber.body.id}`).expect(204);
  });

  it('exports the four lists as XLSX', async () => {
    const res = await api.http().get(`${BASE}/export?lang=de`).expect(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toContain('waffen_stammdaten_');
    expect(Number(res.headers['content-length'])).toBeGreaterThan(1000);
  });

  it('lets a read-only role look but not touch (B1 8.1.2: Interessent R)', async () => {
    const asInterested = authHeaders(interestedId);
    await api.http().get(BASE).set(asInterested).expect(200);
    await api.http().post(`${BASE}/category`).set(asInterested).send({ nameDe: 'x' }).expect(403);
    const handguns = data.categories.find((c) => c.code === 'handguns');
    await api.http().patch(`${BASE}/category/${handguns?.id}`).set(asInterested).send({ nameDe: 'x' }).expect(403);
    await api.http().delete(`${BASE}/category/${handguns?.id}`).set(asInterested).expect(403);
  });
});
