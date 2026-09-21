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
import { AreaEntity } from '../../area/entities';
import { CalculationModule } from '../../calculation/calculation.module';
import { StateImportDto } from '../../calculation/dto';
import { UsageModule } from '../../usage/usage.module';
import { DataCalculationsModule } from '../data-calculations.module';
import { CalculationsOverviewDto, DeliveryDto, StateDetailsDto, StateSummaryDto, UploadResultDto } from '../dto';

const NOW = new Date(2026, 11, 31);
const INTERESTED_EMAIL = 'interessent@demo.ch';

/** A minimal Berechnungsdatei: one Anlageteil on «Stellungsrm B 2» (matched by name), one source, one point, one day level. */
function stateFile(overrides: Partial<StateImportDto> = {}): StateImportDto {
  return {
    calculation: { name: 'Lieferung HTTP', supplier: 'Büro XY', deliveredAt: '2026-09-19', description: 'Testlieferung' },
    state: { externalId: '02218_9', name: 'Zustand HTTP', referenceYear: 2026 },
    plantParts: [{ coordinationSectionNo: 'HTTP.01', name: 'Anlageteil HTTP', type: 'Schiessanlage (300m)', builtAfter1985: true, roomName: 'Stellungsrm B 2' }],
    sources: [{ sourceId: 'Q_HTTP_1', plantPartNo: 'HTTP.01', weaponSystem: 'Stgw90', a9: { shotsInside: 1000, shotsOutside: 100, year: 2026 } }],
    immissionPoints: [{ sonarmsId: 'H1', code: 'H1', address: 'Testweg 1', sensitivityLevel: 'II', mapX: 10, mapY: 10 }],
    wlr: [{ point: 'H1', source: 'Q_HTTP_1', timeGroup: 'day', lae: 60, lafmax: 70 }],
    ...overrides,
  };
}

/**
 * HTTP contract of Datenverwaltung › Schiessplatz › Berechnungen (B1 5.18–5.21):
 * overview with the delivered states, the pointer and delete rules, the
 * validated import, the WLR / Betriebsdaten uploads, the exports and the
 * per-room details — on the demo area 1104.020 Geissalp (one delivery, two
 * states: «Initiale Aufnahme» current + MGDM, «Sanierter Zustand»).
 */
describe('AdminDataCalculationsController (HTTP)', () => {
  let api: TestApp;
  let geissalpId: string;
  let interestedId: string;
  let appAdminId: string;
  let overview: CalculationsOverviewDto;

  const base = () => `/api/admin/data/area/${geissalpId}/calculations`;
  const initial = () => overview.deliveries[0].states.find((s) => s.name.startsWith('Initiale')) as StateSummaryDto;
  const sanitised = () => overview.deliveries[0].states.find((s) => s.name.startsWith('Sanierter')) as StateSummaryDto;

  beforeAll(async () => {
    api = await createTestApp({
      modules: [AreaModule, UsageModule, CalculationModule, DataCalculationsModule],
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
    geissalpId = (await dataSource.getRepository(AreaEntity).findOneByOrFail({ tenantId: mockTenantId, name: 'Geissalp' })).id;
    const [interested] = await dataSource.query('select userId from auth_user where email = ?', [INTERESTED_EMAIL]);
    interestedId = interested.userId;
    appAdminId = await insertTestUser(dataSource);
    await assignAppRole(dataSource, appAdminId, SLIM_ROLE.APP_ADMIN);
    overview = (await api.http().get(base()).expect(200)).body;
  });

  afterAll(async () => {
    await api.close();
  });

  it('answers 403 without the right «Datenverwaltung › Berechnungen» (Interessent, B1 8.1.2)', async () => {
    await api.http().get(base()).set(authHeaders(interestedId)).expect(403);
    await api.http().get(base()).set(authHeaders(randomUUID())).expect(403);
  });

  it('lists the delivery of the demo with its two states and their counts (5.18)', () => {
    expect(overview.deliveries).toHaveLength(1);
    const delivery = overview.deliveries[0];
    expect(delivery).toMatchObject({ supplier: 'Empa', deliveredAt: '2025-03-25', stateCount: 2, hasCurrent: true, hasMgdm: true });
    expect(initial()).toMatchObject({ isCurrent: true, isMgdm: true, referenceYear: 2019, buildYearClass: 'mixed', hasModel: true });
    expect(initial().sourceCount).toBe(17);
    expect(initial().pointCount).toBe(6);
    expect(initial().wlrCount).toBe(170);
    expect(initial().plantPartCount).toBe(14);
    expect(sanitised()).toMatchObject({ isCurrent: false, isMgdm: false, sourceCount: 18 });
    expect(overview.currentStateId).toBe(initial().id);
    expect(overview.mgdmStateId).toBe(initial().id);
  });

  it('lets the Applikationsadministrator read but not write', async () => {
    const asAdmin = authHeaders(appAdminId);
    await api.http().get(base()).set(asAdmin).expect(200);
    await api.http().patch(`${base()}/state/${initial().id}`).set(asAdmin).send({ name: 'x' }).expect(403);
  });

  it('moves the «aktuell» and «MGDM» pointer — exactly one state each (5.18)', async () => {
    const moved = await api.http().patch(`${base()}/state/${sanitised().id}/pointer`).send({ pointer: 'current' }).expect(200);
    expect(moved.body).toMatchObject({ id: sanitised().id, isCurrent: true, isMgdm: false });
    let now: CalculationsOverviewDto = (await api.http().get(base()).expect(200)).body;
    expect(now.currentStateId).toBe(sanitised().id);
    expect(now.mgdmStateId).toBe(initial().id);
    expect(now.deliveries[0].states.filter((s) => s.isCurrent)).toHaveLength(1);

    await api.http().patch(`${base()}/state/${initial().id}/pointer`).send({ pointer: 'current' }).expect(200);
    now = (await api.http().get(base()).expect(200)).body;
    expect(now.currentStateId).toBe(initial().id);
    await api.http().patch(`${base()}/state/${initial().id}/pointer`).send({ pointer: 'nope' }).expect(400);
    await api.http().patch(`${base()}/state/${randomUUID()}/pointer`).send({ pointer: 'current' }).expect(404);
  });

  it('edits a state (Baujahr Anlageteile, Bezeichnung) and refuses a duplicate name', async () => {
    const updated = await api.http().patch(`${base()}/state/${sanitised().id}`).send({ buildYearClass: 'after1985', referenceYear: 2026 }).expect(200);
    expect(updated.body).toMatchObject({ id: sanitised().id, buildYearClass: 'after1985', referenceYear: 2026 });
    await api.http().patch(`${base()}/state/${sanitised().id}`).send({ name: initial().name }).expect(409);
    await api.http().patch(`${base()}/state/${sanitised().id}`).send({ buildYearClass: 'unknown' }).expect(400);
    await api.http().patch(`${base()}/state/${sanitised().id}`).send({ buildYearClass: 'mixed', referenceYear: 2025 }).expect(200);
  });

  it('refuses to delete the delivery that holds the current state (5.18)', async () => {
    const res = await api.http().delete(`${base()}/delivery/${overview.deliveries[0].id}`).expect(409);
    expect(res.body.message).toContain('aktuell gültige Zustand');
  });

  it('creates a delivery and an empty state with a new ZustandID, edits and deletes them (5.18 / 5.20)', async () => {
    const created = await api.http().post(`${base()}/delivery`).send({ name: 'Neue Lieferung', supplier: 'Büro Z', deliveredAt: '2026-09-19', description: 'leer' }).expect(201);
    const delivery: DeliveryDto = created.body;
    expect(delivery).toMatchObject({ name: 'Neue Lieferung', supplier: 'Büro Z', stateCount: 0, hasCurrent: false });
    await api.http().post(`${base()}/delivery`).send({ name: 'Neue Lieferung', deliveredAt: '2026-09-19' }).expect(409);
    await api.http().post(`${base()}/delivery`).send({ name: 'x', deliveredAt: '19.09.2026' }).expect(400);

    const state = await api.http().post(`${base()}/state`).send({ calculationId: delivery.id, name: 'Variante A', referenceYear: 2027 }).expect(201);
    expect(state.body).toMatchObject({ name: 'Variante A', referenceYear: 2027, externalId: '1104.020_1', buildYearClass: 'mixed', hasModel: false, isCurrent: false });
    const second = await api.http().post(`${base()}/state`).send({ calculationId: delivery.id, name: 'Variante B', referenceYear: 2027, buildYearClass: 'before1985' }).expect(201);
    expect(second.body.externalId).toBe('1104.020_2');
    await api.http().post(`${base()}/state`).send({ calculationId: delivery.id, name: 'Variante A', referenceYear: 2027 }).expect(409);
    await api.http().post(`${base()}/state`).send({ calculationId: randomUUID(), name: 'Variante C', referenceYear: 2027 }).expect(404);

    const edited = await api.http().patch(`${base()}/delivery/${delivery.id}`).send({ description: 'Beschreibung neu', fileName: 'variante.gdb' }).expect(200);
    expect(edited.body).toMatchObject({ description: 'Beschreibung neu', fileName: 'variante.gdb', stateCount: 2 });

    // A delivery without pointers and runs may go; its states vanish from the overview.
    await api.http().delete(`${base()}/delivery/${delivery.id}`).expect(204);
    await api.http().delete(`${base()}/delivery/${delivery.id}`).expect(404);
    const after: CalculationsOverviewDto = (await api.http().get(base()).expect(200)).body;
    expect(after.deliveries.map((d) => d.name)).not.toContain('Neue Lieferung');
  });

  it('validates a Berechnungsdatei before the import and reports what would stop it (5.19, slm 45)', async () => {
    const unknownRoom = stateFile({ plantParts: [{ coordinationSectionNo: 'X.99', name: 'Fremd', type: '', builtAfter1985: false }] });
    const invalid = await api.http().post(`${base()}/import/validate`).send({ fileName: 'x.json', state: unknownRoom }).expect(200);
    expect(invalid.body.valid).toBe(false);
    expect(invalid.body.findings[0]).toContain('Unbekannter Stellungsraum');

    const valid = await api.http().post(`${base()}/import/validate`).send({ fileName: 'x.json', state: stateFile() }).expect(200);
    expect(valid.body).toMatchObject({ valid: true, findings: [], counts: { plantParts: 1, sources: 1, immissionPoints: 1, wlr: 1 } });
    // The import itself refuses the same file (400 with the findings).
    await api.http().post(`${base()}/import`).send({ fileName: 'x.json', state: unknownRoom }).expect(400);
  });

  it('imports the file, records its name and serves the details per Stellungsraum (5.19, 5.21)', async () => {
    const report = await api.http().post(`${base()}/import`).send({ fileName: 'geissalp_http.gdb.json', state: stateFile() }).expect(201);
    expect(report.body.counts).toMatchObject({ plantParts: 1, sources: 1, immissionPoints: 1, wlr: 1 });
    const stateId: string = report.body.stateId;

    const now: CalculationsOverviewDto = (await api.http().get(base()).expect(200)).body;
    const delivery = now.deliveries.find((d) => d.name === 'Lieferung HTTP') as DeliveryDto;
    expect(delivery).toMatchObject({ fileName: 'geissalp_http.gdb.json', description: 'Testlieferung', stateCount: 1 });

    const details: StateDetailsDto = (await api.http().get(`${base()}/state/${stateId}/details`).expect(200)).body;
    expect(details.state.id).toBe(stateId);
    expect(details.rooms).toHaveLength(14);
    const room = details.rooms.find((r) => r.name === 'Stellungsrm B 2');
    expect(room).toMatchObject({ plantPartCount: 1, sourceCount: 1, wlrCount: 1 });
    expect(details.wlr).toEqual([expect.objectContaining({ roomId: room?.id, point: 'H1', sourceId: 'Q_HTTP_1', weaponSystem: 'Stgw90', timeGroup: 'day', lae: 60, lafmax: 70 })]);
    expect(details.a9).toEqual([expect.objectContaining({ sourceId: 'Q_HTTP_1', shotsInside: 1000, shotsOutside: 100, combinationName: 'Stgw 90 · 5.6 mm' })]);
    expect(details.a7).toEqual([]);

    // The imported state keeps its file for the uploads below.
    (globalThis as { httpStateId?: string }).httpStateId = stateId;
  });

  it('loads a WLR NIGHT file onto the state, replaces the time group and reports unknown receivers', async () => {
    const stateId = (globalThis as { httpStateId?: string }).httpStateId as string;
    const text = 'Empfänger\tGebäude\tQuelle\tWaffe\tElevation\tLAE(MK)\tLAE(GK)\tLAE(Det)\tLAE\tLAFmax\nH1\t\tQ_HTTP_1\tStgw90\t0.1\t58\t50\t0\t58.5\t68\nH9\t\tQ_HTTP_1\tStgw90\t\t\t\t\t50\t60';
    const first: UploadResultDto = (await api.http().post(`${base()}/state/${stateId}/wlr`).send({ timeGroup: 'eve', text, fileName: 'eve.wlr' }).expect(200)).body;
    expect(first).toMatchObject({ rows: 2, applied: 1, replaced: 0, errors: [] });
    expect(first.unknown[0]).toContain('H9');

    const again: UploadResultDto = (await api.http().post(`${base()}/state/${stateId}/wlr`).send({ timeGroup: 'eve', text }).expect(200)).body;
    expect(again.replaced).toBe(1);
    const details: StateDetailsDto = (await api.http().get(`${base()}/state/${stateId}/details`).expect(200)).body;
    expect(details.wlr.map((w) => w.timeGroup).sort()).toEqual(['day', 'eve']);
    expect(details.wlr.find((w) => w.timeGroup === 'eve')).toMatchObject({ lae: 58.5, lafmax: 68, laeMk: 58, elevation: 0.1 });

    const broken: UploadResultDto = (await api.http().post(`${base()}/state/${stateId}/wlr`).send({ timeGroup: 'day', text: 'Empfänger;Quelle;LAE\nH1;Q_HTTP_1;1' }).expect(200)).body;
    expect(broken.errors).toEqual(['Spalte «LAFmax» fehlt in der Kopfzeile']);
    expect(broken.applied).toBe(0);
    await api.http().post(`${base()}/state/${stateId}/wlr`).send({ timeGroup: 'night', text }).expect(400);
  });

  it('loads Betriebsdaten Anhang 9 and 7 per QuellenID (5.19)', async () => {
    const stateId = (globalThis as { httpStateId?: string }).httpStateId as string;
    const a9: UploadResultDto = (await api.http().post(`${base()}/state/${stateId}/operating-data`).send({ annex: 9, text: 'QuellenID;A9_M1;A9_M2;Schätzung;Jahr\nQ_HTTP_1;2000;300;ja;2025\nQ_NIX;1;1;;', fileName: 'BetriebA9.txt' }).expect(200)).body;
    expect(a9).toMatchObject({ applied: 1, replaced: 1, errors: [] });
    expect(a9.unknown[0]).toContain('Q_NIX');

    const a7: UploadResultDto = (await api.http().post(`${base()}/state/${stateId}/operating-data`).send({ annex: 7, text: 'QuellenID;Halbtag_Wo;Halbtag_So;Zahl_Wo;Zahl_So\nQ_HTTP_1;10;2;4000;500' }).expect(200)).body;
    // The category comes from the weapon master data (Stgw 90 → a) when the file has none.
    expect(a7).toMatchObject({ applied: 1, replaced: 0, errors: [] });

    const details: StateDetailsDto = (await api.http().get(`${base()}/state/${stateId}/details`).expect(200)).body;
    expect(details.a9[0]).toMatchObject({ shotsInside: 2000, shotsOutside: 300, estimated: true, year: 2025 });
    expect(details.a7[0]).toMatchObject({ category: 'a', halfDaysWork: 10, halfDaysSunday: 2, shotsWork: 4000, shotsSunday: 500 });
    await api.http().post(`${base()}/state/${stateId}/operating-data`).send({ annex: 8, text: 'x' }).expect(400);
  });

  it('exports the chosen states as an importable JSON bundle and the Schusszahlen as CSV (5.20)', async () => {
    const stateId = (globalThis as { httpStateId?: string }).httpStateId as string;
    const bundle = await api.http().post(`${base()}/export/states`).send({ stateIds: [initial().id, stateId] }).expect(200);
    expect(bundle.headers['content-type']).toContain('application/json');
    expect(bundle.headers['content-disposition']).toContain('berechnungszustaende_1104.020_');
    const body = JSON.parse(bundle.text);
    expect(body.format).toBe('slim-state-export');
    expect(body.states).toHaveLength(2);
    const exported = body.states.find((s: StateImportDto) => s.state.name === 'Zustand HTTP') as StateImportDto;
    expect(exported.plantParts[0]).toMatchObject({ coordinationSectionNo: 'HTTP.01', roomName: 'Stellungsrm B 2', builtAfter1985: true });
    expect(exported.sources[0]).toMatchObject({ sourceId: 'Q_HTTP_1', plantPartNo: 'HTTP.01', a9: { shotsInside: 2000 }, a7: { category: 'a', shotsWork: 4000 } });
    expect(exported.wlr).toHaveLength(2);
    await api.http().post(`${base()}/export/states`).send({ stateIds: [randomUUID()] }).expect(404);
    await api.http().post(`${base()}/export/states`).send({ stateIds: [] }).expect(400);

    const years = await api.http().get(`${base()}/export/shots`).expect(200);
    // The demo rolls a few usages into the previous year ({{year-1}}); 2026 keeps the bulk.
    expect(years.body.years[0].year).toBe(2026);
    expect(years.body.years[0].usageCount).toBeGreaterThan(70);
    expect(years.body.years[0].shots).toBeGreaterThan(1000);

    const csv = await api.http().post(`${base()}/export/shots`).send({ years: [2026] }).expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    const lines = csv.text.split('\r\n').filter(Boolean);
    expect(lines[0]).toContain('Datum;Von;Bis;Stellungsraum');
    expect(lines.length).toBeGreaterThan(years.body.years[0].usageCount);
    expect(lines[1]).toMatch(/^2026-\d\d-\d\d;\d\d:\d\d;\d\d:\d\d;/);
  });
});
