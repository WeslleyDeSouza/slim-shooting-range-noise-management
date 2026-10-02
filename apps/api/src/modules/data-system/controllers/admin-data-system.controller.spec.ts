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
import { DataAreaModule } from '../../data-area/data-area.module';
import { AssessmentDto } from '../../calculation/dto';
import { SelectionListDto, SystemSettingsDto } from '../../settings/dto';
import { uniqueCode } from '../../settings/selection-list.service';
import { SettingsModule } from '../../settings/settings.module';
import { UsageCombinationDto, UsageOverviewDto } from '../../usage/dto';
import { UsageModule } from '../../usage/usage.module';
import { DataSystemModule } from '../data-system.module';

const NOW = new Date(2026, 11, 31);
const YEAR = 2026;
const SETTINGS = '/api/admin/settings';
const SYSTEM = '/api/admin/data/system';
const LISTS = '/api/admin/settings/lists';
/** Smallest file that starts like a PDF. */
const PDF = Buffer.from('%PDF-1.4\n% SLIM Benutzerhandbuch (Test)\n%%EOF\n', 'latin1');

/**
 * Erweiterte Konfiguration (B1 5.28, slm 27; FAQ 166) over HTTP: who may
 * change it, what the Sperrdatum does to the Schusszahlenerfassung, how the
 * thresholds move the Ampeln, and the Benutzerhandbuch (B1 5.9, slm 53).
 * The default user is the Applikationsadministrator; a Fachspezialist
 * records usages, an Interessent only reads.
 */
describe('AdminDataSystemController + AdminSettingsController (HTTP)', () => {
  let api: TestApp;
  let geissalpId: string;
  let overview: UsageOverviewDto;
  let specialist: Record<string, string>;
  let reader: Record<string, string>;

  const usageBase = (): string => `/api/admin/area/${geissalpId}/usage`;
  const settings = async (headers: Record<string, string> = authHeaders()): Promise<SystemSettingsDto> =>
    (await api.http().get(SETTINGS).set(headers).expect(200)).body;
  const patch = (body: Record<string, unknown>) => api.http().patch(SYSTEM).send(body);
  const assessment = async (): Promise<AssessmentDto> =>
    (await api.http().get(`/api/admin/area/${geissalpId}/calculation/assessment`).set(specialist).query({ years: String(YEAR) }).expect(200)).body;
  const noiseStatus = async (): Promise<string> =>
    ((await api.http().get('/api/admin/area').set(specialist).expect(200)).body as AreaResultDto[]).find((a) => a.id === geissalpId)?.noiseStatus as string;

  const usageOn = (date: string) => {
    const first = overview.combinations.find((c) => c.weapon === 'Stgw 90' && c.quantityUnit === 'shots') as UsageCombinationDto;
    return {
      roomId: first.roomId,
      unit: 'Inf Bat 12',
      date,
      timeFrom: '08:00',
      timeTo: '11:30',
      usageType: 'military',
      positions: [{ combinationId: first.combinationId, quantity: 100 }],
    };
  };

  beforeAll(async () => {
    api = await createTestApp({
      modules: [AreaModule, UsageModule, CalculationModule, SettingsModule, DataSystemModule, DataAreaModule],
      entities: [
        ...AreaModule.DBOptions.entities,
        ...UsageModule.DBOptions.entities,
        ...CalculationModule.DBOptions.entities,
        ...SettingsModule.DBOptions.entities,
        DemoSeedMarkerEntity,
      ],
    });
    const { dataSource } = api;
    await testDbSeedBeforeEach(dataSource);
    await TestMockUserMock.fill.Apps(dataSource, API_MOCK_DATA.customApps as never, API_MOCK_DATA.customCategories as never);
    await fillSlimRoles(dataSource, mockTenantId);
    await seedDemoDataset(dataSource, mockTenantId, { now: NOW });
    await assignAppRole(dataSource, mockUserId, SLIM_ROLE.APP_ADMIN);
    const specialistId = await insertTestUser(dataSource);
    await assignAppRole(dataSource, specialistId, SLIM_ROLE.SPECIALIST);
    specialist = authHeaders(specialistId);
    const readerId = await insertTestUser(dataSource);
    await assignAppRole(dataSource, readerId, SLIM_ROLE.INTERESTED);
    reader = authHeaders(readerId);

    const areas: AreaResultDto[] = (await api.http().get('/api/admin/area').set(specialist).expect(200)).body;
    geissalpId = areas.find((a) => a.coordinationSectionNo === '1104.020')?.id as string;
    overview = (await api.http().get(`${usageBase()}/overview`).set(specialist).query({ year: YEAR }).expect(200)).body;
  });

  afterAll(async () => {
    await api.close();
  });

  describe('reading and rights', () => {
    it('answers every signed-in user with the defaults of B1 5.10 when nothing is configured', async () => {
      const expected = {
        usageLockDate: null,
        quotaGreenMaxPercent: 100,
        quotaOrangeMaxPercent: 125,
        noiseGreenMaxDb: -5,
        noiseOrangeMaxDb: 0,
        colorOk: null,
        colorWarn: null,
        colorOver: null,
        manual: null,
      };
      expect(await settings(reader)).toMatchObject(expected);
      expect(await settings(specialist)).toMatchObject(expected);
      expect((await api.http().get(SYSTEM).expect(200)).body).toMatchObject(expected);
    });

    it('lets only the Applikationsadministrator open and change the mask (B1 8.1.2)', async () => {
      for (const headers of [specialist, reader]) {
        await api.http().get(SYSTEM).set(headers).expect(403);
        await api.http().patch(SYSTEM).set(headers).send({ usageLockDate: '2025-12-31' }).expect(403);
        await api.http().post(`${SYSTEM}/manual`).set(headers).attach('file', PDF, 'Handbuch.pdf').expect(403);
        await api.http().delete(`${SYSTEM}/manual`).set(headers).expect(403);
      }
      expect((await settings()).usageLockDate).toBeNull();
    });

    it('stores contacts and Ampel colours and resets them with null', async () => {
      const saved: SystemSettingsDto = (
        await patch({
          specialistName: '  KOMZ Lärm  ',
          specialistPhone: '+41 58 123 45 67',
          specialistEmail: 'laerm@example.org',
          sysadminEmail: 'betrieb@example.org',
          colorOk: '#1E7A3C',
          colorOver: '#c71624',
        }).expect(200)
      ).body;
      expect(saved).toMatchObject({
        specialistName: 'KOMZ Lärm',
        specialistPhone: '+41 58 123 45 67',
        specialistEmail: 'laerm@example.org',
        sysadminEmail: 'betrieb@example.org',
        colorOk: '#1e7a3c',
        colorWarn: null,
        colorOver: '#c71624',
      });
      // Every user reads them (main menu, B1 5.9).
      expect((await settings(reader)).specialistName).toBe('KOMZ Lärm');

      const reset: SystemSettingsDto = (await patch({ specialistName: null, specialistPhone: null, specialistEmail: null, sysadminEmail: null, colorOk: null, colorOver: null }).expect(200)).body;
      expect(reset).toMatchObject({ specialistName: null, specialistEmail: null, sysadminEmail: null, colorOk: null, colorOver: null });
    });

    it('rejects values that make no sense', async () => {
      await patch({ usageLockDate: '31.12.2025' }).expect(400);
      await patch({ usageLockDate: '2025-02-30' }).expect(400);
      await patch({ colorOk: 'green' }).expect(400);
      await patch({ specialistEmail: 'kein-at-zeichen' }).expect(400);
      await patch({ quotaGreenMaxPercent: 0 }).expect(400);
      // «orange» below «green» would leave no room for orange.
      await patch({ quotaGreenMaxPercent: 110, quotaOrangeMaxPercent: 105 }).expect(400);
      await patch({ noiseGreenMaxDb: 0, noiseOrangeMaxDb: -3 }).expect(400);
      expect(await settings()).toMatchObject({ usageLockDate: null, quotaGreenMaxPercent: 100, quotaOrangeMaxPercent: 125, noiseGreenMaxDb: -5, noiseOrangeMaxDb: 0, colorOk: null });
    });
  });

  describe('Sperrdatum der Schusszahlenerfassung (B1 5.28 Element 1)', () => {
    let juneId: string;
    let julyId: string;

    it('records usages freely while no Sperrdatum is set', async () => {
      juneId = (await api.http().post(usageBase()).set(specialist).send(usageOn(`${YEAR}-06-15`)).expect(201)).body.id;
      julyId = (await api.http().post(usageBase()).set(specialist).send(usageOn(`${YEAR}-07-02`)).expect(201)).body.id;
    });

    it('tells the entry form the Sperrdatum with the overview', async () => {
      await patch({ usageLockDate: `${YEAR}-06-30` }).expect(200);
      const locked: UsageOverviewDto = (await api.http().get(`${usageBase()}/overview`).set(specialist).query({ year: YEAR }).expect(200)).body;
      expect(locked.lockDate).toBe(`${YEAR}-06-30`);
      expect((await settings(reader)).usageLockDate).toBe(`${YEAR}-06-30`);
    });

    it('refuses new usages up to and including the Sperrdatum and accepts the day after', async () => {
      const refused = await api.http().post(usageBase()).set(specialist).send(usageOn(`${YEAR}-06-30`)).expect(409);
      expect(refused.body.message).toBe(`Die Schusszahlenerfassung ist bis und mit 30.06.${YEAR} gesperrt (Sperrdatum der erweiterten Konfiguration).`);
      await api.http().post(usageBase()).set(specialist).send(usageOn(`${YEAR}-03-01`)).expect(409);
      const created = await api.http().post(usageBase()).set(specialist).send(usageOn(`${YEAR}-07-01`)).expect(201);
      await api.http().post(`${usageBase()}/delete`).set(specialist).send({ ids: [created.body.id] }).expect(200);
    });

    it('freezes the usages of the locked period: no change, no deletion, no move into it', async () => {
      await api.http().patch(`${usageBase()}/${juneId}`).set(specialist).send({ unit: 'Geb Inf Bat 17' }).expect(409);
      await api.http().post(`${usageBase()}/delete`).set(specialist).send({ ids: [juneId] }).expect(409);
      // A usage after the Sperrdatum stays editable, but cannot be dated back into the locked period.
      await api.http().patch(`${usageBase()}/${julyId}`).set(specialist).send({ unit: 'Geb Inf Bat 17' }).expect(200);
      await api.http().patch(`${usageBase()}/${julyId}`).set(specialist).send({ date: `${YEAR}-06-01` }).expect(409);
      // A mixed deletion is refused as a whole — nothing is removed.
      await api.http().post(`${usageBase()}/delete`).set(specialist).send({ ids: [julyId, juneId] }).expect(409);
      const after: UsageOverviewDto = (await api.http().get(`${usageBase()}/overview`).set(specialist).query({ year: YEAR }).expect(200)).body;
      expect(after.usages.map((u) => u.id)).toEqual(expect.arrayContaining([juneId, julyId]));
      expect(after.usages.find((u) => u.id === juneId)?.unit).toBe('Inf Bat 12');
    });

    it('opens the period again when the Sperrdatum is removed', async () => {
      await patch({ usageLockDate: null }).expect(200);
      await api.http().patch(`${usageBase()}/${juneId}`).set(specialist).send({ unit: 'Geb Inf Bat 17' }).expect(200);
      await api.http().post(`${usageBase()}/delete`).set(specialist).send({ ids: [juneId, julyId] }).expect(200);
    });
  });

  describe('Schwellenwerte der Ampeln (B1 5.28 Element 3, FAQ 166)', () => {
    it('moves the Empfangspunkt-Ampel with the dB thresholds and back with the defaults', async () => {
      const before = await assessment();
      const e1 = () => before.receivers.find((r) => r.code === 'E1');
      // Demo: E1 lies above its Immissionsgrenzwert → red, and so is the Schiessplatz.
      expect(e1()?.state).toBe('over');
      expect(await noiseStatus()).toBe('over');
      const worstExcess = Math.max(
        ...before.receivers.flatMap((r) => r.rows.filter((row) => row.applicable && row.level !== null).map((row) => Math.round(row.level as number) - row.limit)),
      );
      expect(worstExcess).toBeGreaterThan(0);

      // Orange up to the worst exceedance: nothing is red any more, the exceeding points turn orange.
      await patch({ noiseOrangeMaxDb: worstExcess }).expect(200);
      const relaxed = await assessment();
      expect(relaxed.receivers.some((r) => r.state === 'over')).toBe(false);
      expect(relaxed.receivers.find((r) => r.code === 'E1')?.state).toBe('warn');
      expect(relaxed.counts.over).toBe(0);
      // The cached light of the overview follows at once.
      expect(await noiseStatus()).toBe('warn');

      // Green up to the limit, orange above: a point at or below its limit is green.
      await patch({ noiseGreenMaxDb: worstExcess, noiseOrangeMaxDb: worstExcess }).expect(200);
      expect((await assessment()).receivers.filter((r) => r.state === 'warn' || r.state === 'over')).toHaveLength(0);
      expect(await noiseStatus()).toBe('ok');

      await patch({ noiseGreenMaxDb: null, noiseOrangeMaxDb: null }).expect(200);
      expect((await assessment()).receivers.map((r) => [r.code, r.state])).toEqual(before.receivers.map((r) => [r.code, r.state]));
      expect(await noiseStatus()).toBe('over');
    });

    it('applies the percent thresholds of the Kontingent-Ampel to every Schiessplatz', async () => {
      const lights = async (): Promise<Record<string, string>> =>
        Object.fromEntries(((await api.http().get('/api/admin/area').set(specialist).expect(200)).body as AreaResultDto[]).map((a) => [a.coordinationSectionNo, a.quotaStatus]));
      const before = await lights();
      const green = Object.keys(before).filter((no) => before[no] === 'ok');
      expect(green.length).toBeGreaterThan(0);

      // Green and orange end at 1 % of the Soll: a Schiessplatz that was green with shots on record is red.
      await patch({ quotaGreenMaxPercent: 1, quotaOrangeMaxPercent: 1 }).expect(200);
      const strict = await lights();
      const turned = green.filter((no) => strict[no] === 'over');
      expect(turned.length).toBeGreaterThan(0);
      // Nothing gets better by a stricter threshold.
      for (const no of Object.keys(before)) if (before[no] === 'over') expect(strict[no]).toBe('over');

      // Green up to 1 %, orange up to 1000 %: the same Schiessplätze are orange.
      await patch({ quotaGreenMaxPercent: 1, quotaOrangeMaxPercent: 1000 }).expect(200);
      const wide = await lights();
      for (const no of turned) expect(wide[no]).toBe('warn');

      await patch({ quotaGreenMaxPercent: null, quotaOrangeMaxPercent: null }).expect(200);
      expect(await lights()).toEqual(before);
    });
  });

  describe('Benutzerhandbuch (B1 5.28 Element 2, 5.9, slm 53)', () => {
    it('has none at first: the download answers 404', async () => {
      await api.http().get(`${SETTINGS}/manual`).set(reader).expect(404);
    });

    it('accepts a PDF only', async () => {
      await api.http().post(`${SYSTEM}/manual`).expect(400);
      await api.http().post(`${SYSTEM}/manual`).attach('file', Buffer.from('PK\u0003\u0004 not a pdf'), 'Handbuch.pdf').expect(400);
      expect((await settings()).manual).toBeNull();
    });

    it('stores the upload, shows it to every user and serves it for download', async () => {
      const info = (await api.http().post(`${SYSTEM}/manual`).attach('file', PDF, 'Benutzerhandbuch SLIM.pdf').expect(201)).body;
      expect(info).toMatchObject({ fileName: 'Benutzerhandbuch SLIM.pdf', size: PDF.length });
      expect(Date.parse(info.uploadedAt)).not.toBeNaN();
      expect((await settings(reader)).manual).toMatchObject({ fileName: 'Benutzerhandbuch SLIM.pdf', size: PDF.length });

      const download = await api.http().get(`${SETTINGS}/manual`).set(reader).buffer(true).parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      }).expect(200);
      expect(download.headers['content-type']).toContain('application/pdf');
      expect(download.headers['content-disposition']).toContain("filename*=UTF-8''Benutzerhandbuch%20SLIM.pdf");
      expect(Buffer.compare(download.body as Buffer, PDF)).toBe(0);
    });

    it('replaces the document with the next upload and removes it on request', async () => {
      const next = Buffer.concat([PDF, Buffer.from('% Stand 10/2026\n')]);
      await api.http().post(`${SYSTEM}/manual`).attach('file', next, 'Handbuch 2026-10.pdf').expect(201);
      expect((await settings()).manual).toMatchObject({ fileName: 'Handbuch 2026-10.pdf', size: next.length });

      await api.http().delete(`${SYSTEM}/manual`).expect(204);
      expect((await settings()).manual).toBeNull();
      await api.http().get(`${SETTINGS}/manual`).set(reader).expect(404);
    });
  });

  describe('Auswahllisten (B1 5.3, slm 1)', () => {
    const lists = async (headers: Record<string, string> = authHeaders()): Promise<SelectionListDto[]> => (await api.http().get(LISTS).set(headers).expect(200)).body;
    const listOf = async (key: string): Promise<SelectionListDto> => (await lists()).find((l) => l.key === key) as SelectionListDto;
    const masterData = (areaId: string) => `/api/admin/data/area/${areaId}`;
    let otherAreaId: string;

    beforeAll(async () => {
      const areas: AreaResultDto[] = (await api.http().get('/api/admin/area').set(specialist).expect(200)).body;
      otherAreaId = areas.find((a) => a.id !== geissalpId)?.id as string;
    });

    it('serves every user the lists the masks pick from, with the values and labels the application ships with', async () => {
      const all = await lists(reader);
      expect(all.map((l) => l.key)).toEqual([
        'classification',
        'recalculation_state',
        'remediation_project_state',
        'spm_state',
        'noise_remediation_state',
        'project_state',
        'civil_usage_kind',
      ]);
      const spm = all.find((l) => l.key === 'spm_state') as SelectionListDto;
      expect(spm.values.map((v) => [v.code, v.labelDe, v.labelFr, v.enabled, v.builtIn])).toEqual([
        ['open', 'Offen', 'Ouvert', true, true],
        ['in_progress', 'In Bearbeitung', 'En cours', true, true],
        ['completed', 'Abgeschlossen', 'Terminé', true, true],
      ]);
      expect(all.find((l) => l.key === 'civil_usage_kind')?.values.map((v) => v.code)).toEqual(['obligatory', 'field_shooting', 'other']);
    });

    it('lets only the Applikationsadministrator maintain the lists', async () => {
      for (const headers of [specialist, reader]) {
        await api.http().post(`${SYSTEM}/lists/spm_state`).set(headers).send({ labelDe: 'Sistiert' }).expect(403);
        await api.http().patch(`${SYSTEM}/lists/spm_state/open`).set(headers).send({ enabled: false }).expect(403);
      }
      expect((await listOf('spm_state')).values).toHaveLength(3);
    });

    it('adds a value at the end of a list; the code comes from the German label', async () => {
      const list: SelectionListDto = (await api.http().post(`${SYSTEM}/lists/spm_state`).send({ labelDe: ' Sistiert ', labelFr: 'Suspendu' }).expect(201)).body;
      expect(list.values.map((v) => v.code)).toEqual(['open', 'in_progress', 'completed', 'sistiert']);
      expect(list.values[3]).toMatchObject({ labelDe: 'Sistiert', labelFr: 'Suspendu', labelIt: null, labelEn: null, enabled: true, builtIn: false, sortOrder: 4 });
      // The other lists are untouched.
      expect((await listOf('project_state')).values.map((v) => v.code)).toEqual(['not_started', 'ongoing', 'completed']);

      await api.http().post(`${SYSTEM}/lists/spm_state`).send({ labelDe: 'sistiert' }).expect(400); // already there
      await api.http().post(`${SYSTEM}/lists/spm_state`).send({ labelDe: '   ' }).expect(400);
      await api.http().post(`${SYSTEM}/lists/gibt_es_nicht`).send({ labelDe: 'Wert' }).expect(404);
    });

    it('accepts in the Stammdaten of a Schiessplatz what the list offers, and nothing else', async () => {
      const saved = await api.http().patch(masterData(geissalpId)).set(specialist).send({ spmState: 'sistiert' }).expect(200);
      expect(saved.body.spmState).toBe('sistiert');
      const refused = await api.http().patch(masterData(geissalpId)).set(specialist).send({ spmState: 'frei_erfunden' }).expect(400);
      expect(refused.body.message).toContain('«frei_erfunden»');
      await api.http().patch(masterData(geissalpId)).set(specialist).send({ classification: 'frei_erfunden' }).expect(400);
    });

    it('changes the labels of a value without touching the records that use it', async () => {
      const list: SelectionListDto = (await api.http().patch(`${SYSTEM}/lists/spm_state/sistiert`).send({ labelDe: 'Sistiert (ruht)', labelIt: 'Sospeso' }).expect(200)).body;
      expect(list.values.find((v) => v.code === 'sistiert')).toMatchObject({ labelDe: 'Sistiert (ruht)', labelFr: 'Suspendu', labelIt: 'Sospeso' });
      const area: AreaResultDto = (await api.http().get('/api/admin/area').set(specialist).expect(200)).body.find((a: AreaResultDto) => a.id === geissalpId);
      expect(area.spmState).toBe('sistiert');
      // A label that another value of the list already has is refused; an unknown value is 404.
      await api.http().patch(`${SYSTEM}/lists/spm_state/sistiert`).send({ labelDe: 'Offen' }).expect(400);
      await api.http().patch(`${SYSTEM}/lists/spm_state/gibt_es_nicht`).send({ labelDe: 'X' }).expect(404);
    });

    it('sets a value inactive: it stays on the records that carry it and is offered to no other', async () => {
      const list: SelectionListDto = (await api.http().patch(`${SYSTEM}/lists/spm_state/sistiert`).send({ enabled: false }).expect(200)).body;
      expect(list.values.find((v) => v.code === 'sistiert')?.enabled).toBe(false);
      // Geissalp keeps the value and can still be saved with it.
      await api.http().patch(masterData(geissalpId)).set(specialist).send({ spmState: 'sistiert', planningApproval: 'Plangenehmigung 2023' }).expect(200);
      // Another Schiessplatz cannot take the inactive value.
      await api.http().patch(masterData(otherAreaId)).set(specialist).send({ spmState: 'sistiert' }).expect(400);
      // Active again: now it can.
      await api.http().patch(`${SYSTEM}/lists/spm_state/sistiert`).send({ enabled: true }).expect(200);
      await api.http().patch(masterData(otherAreaId)).set(specialist).send({ spmState: 'sistiert' }).expect(200);
    });

    it('keeps at least one active value in a list', async () => {
      await api.http().patch(`${SYSTEM}/lists/project_state/not_started`).send({ enabled: false }).expect(200);
      await api.http().patch(`${SYSTEM}/lists/project_state/ongoing`).send({ enabled: false }).expect(200);
      const last = await api.http().patch(`${SYSTEM}/lists/project_state/completed`).send({ enabled: false }).expect(400);
      expect(last.body.message).toContain('letzte aktive Wert');
      await api.http().patch(`${SYSTEM}/lists/project_state/not_started`).send({ enabled: true }).expect(200);
      await api.http().patch(`${SYSTEM}/lists/project_state/ongoing`).send({ enabled: true }).expect(200);
    });

    it('offers a new zivile Nutzungsart to the Schusszahlenerfassung', async () => {
      const list: SelectionListDto = (await api.http().post(`${SYSTEM}/lists/civil_usage_kind`).send({ labelDe: 'Jungschützenkurs' }).expect(201)).body;
      const code = list.values[list.values.length - 1].code;
      // The column of the usage holds 16 characters.
      expect(code).toBe('jungschuetzenkur');

      const civil = { ...usageOn(`${YEAR}-08-20`), usageType: 'civil' };
      const created = await api.http().post(usageBase()).set(specialist).send({ ...civil, civilUsageKind: code }).expect(201);
      expect(created.body.civilUsageKind).toBe(code);
      await api.http().post(usageBase()).set(specialist).send({ ...civil, civilUsageKind: 'frei_erfunden' }).expect(400);
      await api.http().post(usageBase()).set(specialist).send({ ...civil, civilUsageKind: 'obligatory' }).expect(201);

      // Inactive: no new usage with it, the existing one can still be edited.
      await api.http().patch(`${SYSTEM}/lists/civil_usage_kind/${code}`).send({ enabled: false }).expect(200);
      await api.http().post(usageBase()).set(specialist).send({ ...civil, date: `${YEAR}-08-21`, civilUsageKind: code }).expect(400);
      await api.http().patch(`${usageBase()}/${created.body.id}`).set(specialist).send({ unit: 'Schützenverein' }).expect(200);
    });
  });
});

describe('uniqueCode (code of a new list value)', () => {
  it('derives a readable key from the label', () => {
    expect(uniqueCode('Sistiert', [], 24)).toBe('sistiert');
    expect(uniqueCode('Neubeurteilung nötig (Lärm)', [], 24)).toBe('neubeurteilung_noetig_la');
    expect(uniqueCode('Étude préliminaire', [], 24)).toBe('etude_preliminaire');
    expect(uniqueCode('!!!', [], 24)).toBe('wert');
  });

  it('keeps the code unique within the list and inside the column', () => {
    expect(uniqueCode('Offen', ['offen'], 24)).toBe('offen_2');
    expect(uniqueCode('Offen', ['offen', 'offen_2'], 24)).toBe('offen_3');
    expect(uniqueCode('Jungschützenkurs', ['jungschuetzenkur'], 16)).toBe('jungschuetzenk_2');
    expect(uniqueCode('Jungschützenkurs', ['jungschuetzenkur'], 16)).toHaveLength(16);
  });
});
