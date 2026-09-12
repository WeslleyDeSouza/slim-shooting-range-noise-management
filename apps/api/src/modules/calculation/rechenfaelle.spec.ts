import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { mockTenantId, testDbSeedBeforeEach, testDbSetup, TESTPLATZ_S, TESTPLATZ_S_DATASET, TESTPLATZ_S_REFERENCE as REF } from '@api-slim/tests';
import { AreaModule } from '../area/area.module';
import { AreaService } from '../area/area.service';
import { AreaRoomEntity, HolidayEntity, WeaponCombinationEntity } from '../area/entities';
import { UsageModule } from '../usage/usage.module';
import { UsageService } from '../usage/usage.service';
import { AreaUsageEntity } from '../usage/entities';
import { DemoSeedMarkerEntity } from '../../mocks/tenant/demo-seed-marker.entity';
import { seedDemoDataset } from '../../mocks/tenant/demo-dataset.seed';
import type { TenantDataset } from '../../mocks/tenant/tenant-dataset';
import { AssessmentService, assessModel, labeller, resolvePeriod } from './assessment.service';
import { CalculationModule } from './calculation.module';
import { CalculationService } from './calculation.service';
import { AssessmentDto, ReceiverAssessmentDto } from './dto';
import { AreaCalculationEntity } from './entities';
import { deriveOperatingData, refKey } from './operating-data';
import { RoomCombinationEntity } from '../area/entities/room-combination.entity';

/**
 * Mathematische Randfälle durch die ganze Kette Nutzung → Betriebsdaten → Pegel → Ampel,
 * ausgeführt gegen den Service mit «Testplatz S» (`@api-slim/tests`, Handrechnung in
 * apps/app-e2e/src/actors/fixtures/platz-s.md). Der Kernel ist in `libs/shared/lsv` je Regel
 * abgesichert; hier steht der Nachweis, dass der Service dieselbe Regel mit echten Nutzungen,
 * Feiertagskalender, Quellenverteilung und Jahresmittel anwendet.
 *
 * | Regel                                              | Kernel-Test (grün)                                     | Service        |
 * |----------------------------------------------------|--------------------------------------------------------|----------------|
 * | Nutzung 11:00–13:00 → Trennung 12:00, ½ + ½        | operating-data.spec.ts «splits a usage spanning 12:00» | Fall 1         |
 * | genau 2 h = ½, knapp darüber = 1                    | dito (10:00–12:00 = ½); 08:00–10:01 → todo 2a          | todo 2b/2c     |
 * | Werktag vs. lokaler Feiertag in A7 und A9            | «…holidays entirely outside», «…holidays as Sunday»    | Fall 3         |
 * | ×10 Menge: A9 +10 dB, A7 +3 dB                      | annex9.spec «+10 dB», annex7.spec «+3 dB»              | todo 4         |
 * | 60.4 / 60.5 bei Grenzwert 60                         | traffic-light.spec «rounds to whole dB before …»       | Fall 5         |
 * | Mittelung kleiner kg-Mengen ohne Rundung             | operating-data.spec «keeps decimal quantities (kg)»    | Fall 6         |
 * | mehrere Nutzungen im selben Halbtag                  | operating-data.spec «adds several usages … same half»  | todo 7         |
 *
 * Grundsätze: frische Fixture je Fall (`beforeEach` seedet Testplatz S neu); Zwischenwerte werden
 * geprüft (Halbtage, Mengen je Kombination, Quellenanteile, Rohpegel, Status), nicht nur die Endampel.
 * Ins öffentliche DTO gehören die geforderten Betriebsdaten (B1 5.21) und ein nachvollziehbarer
 * Beurteilungswert; Halbtage und Rohpegel werden über `deriveOperatingData` / `assessModel` geprüft.
 * Rundung: der Grenzwertvergleich rundet den ungerundeten Pegel direkt auf ganze dB (B1.2 10.4),
 * die Anzeige separat auf eine Dezimale. Soll-Werte = `TESTPLATZ_S_REFERENCE` (unabhängige
 * Gegenrechnung, volle Genauigkeit), nie das Ist der Anwendung.
 */
const NOW = new Date(2026, 11, 31);
const Y2026 = { from: '2026-01-01', to: '2026-12-31', now: NOW };
const Y2025 = { from: '2025-01-01', to: '2025-12-31', now: NOW };
/** Full-precision reference vs. double arithmetic of the kernel. */
const RAW = 9;

function row(receiver: ReceiverAssessmentDto, annex: 9 | 7) {
  const found = receiver.rows.find((r) => r.annex === annex && r.limitKind === 'igw');
  if (!found) throw new Error(`no row ${annex}/igw`);
  return found;
}

function receiver(dto: AssessmentDto, code: string): ReceiverAssessmentDto {
  const found = dto.receivers.find((r) => r.code === code);
  if (!found) throw new Error(`no receiver ${code}`);
  return found;
}

describe('Rechenfälle durch die Kette (Testplatz S)', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let assessment: AssessmentService;
  let calculations: CalculationService;
  let usageService: UsageService;
  let usages: Repository<AreaUsageEntity>;
  let holidays: Repository<HolidayEntity>;

  let areaId: string;
  let roomId: string;
  let combo: Record<'stgw90' | 'pist75' | 'sprengladung', string>;
  let states: Record<'z1' | 'z2' | 'z3', AreaCalculationEntity>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: testDbSetup(
        [AreaModule, UsageModule, CalculationModule],
        [...AreaModule.DBOptions.entities, ...UsageModule.DBOptions.entities, ...CalculationModule.DBOptions.entities, DemoSeedMarkerEntity] as never[],
      ),
    }).compile();
    dataSource = module.get(DataSource);
    assessment = module.get(AssessmentService);
    calculations = module.get(CalculationService);
    usageService = module.get(UsageService);
    usages = dataSource.getRepository(AreaUsageEntity);
    holidays = dataSource.getRepository(HolidayEntity);
    await testDbSeedBeforeEach(dataSource);
  });

  afterAll(async () => {
    await module.close();
  });

  // Fresh fixture for every case: the seed empties the tenant's tables and writes Testplatz S again.
  beforeEach(async () => {
    const result = await seedDemoDataset(dataSource, mockTenantId, { now: NOW, force: true, dataset: TESTPLATZ_S_DATASET as unknown as TenantDataset });
    expect(result.skipped).toBe(false);
    const area = (await module.get(AreaService).list(mockTenantId)).find((a) => a.coordinationSectionNo === TESTPLATZ_S.coordinationSectionNo);
    if (!area) throw new Error('Testplatz S was not seeded');
    areaId = area.id;
    roomId = (await dataSource.getRepository(AreaRoomEntity).findOneByOrFail({ tenantId: mockTenantId, areaId, name: TESTPLATZ_S.room })).id;
    const combos = await dataSource.getRepository(WeaponCombinationEntity).findBy({ tenantId: mockTenantId });
    const comboId = (nameDe: string) => {
      const c = combos.find((x) => x.nameDe === nameDe);
      if (!c) throw new Error(`combination ${nameDe} missing`);
      return c.id;
    };
    combo = { stgw90: comboId(TESTPLATZ_S.combinations.stgw90), pist75: comboId(TESTPLATZ_S.combinations.pist75), sprengladung: comboId(TESTPLATZ_S.combinations.sprengladung) };
    const all = await calculations.list(mockTenantId, areaId);
    const state = (name: string) => {
      const s = all.find((x) => x.name === name);
      if (!s) throw new Error(`state ${name} missing`);
      return s;
    };
    states = { z1: state(TESTPLATZ_S.states.z1), z2: state(TESTPLATZ_S.states.z2), z3: state(TESTPLATZ_S.states.z3) };
  });

  /** Betriebsdaten and raw levels of a period on Service level (no DTO rounding). */
  async function raw(period: { from?: string; to?: string; years?: number[] }, state: AreaCalculationEntity) {
    const resolved = resolvePeriod(period.from, period.to, NOW, period.years);
    const reference = await assessment.reference(mockTenantId, areaId);
    const list = await assessment.usagesOf(mockTenantId, areaId, resolved);
    const assignments = await dataSource.getRepository(RoomCombinationEntity).find({ where: { tenantId: mockTenantId, areaId } });
    const operating = deriveOperatingData(reference, list, resolved.years);
    const model = await calculations.loadModel(mockTenantId, state);
    const levels = assessModel(operating, reference, model, labeller(reference, assignments));
    const point = (code: string) => {
      const p = model.points.find((x) => x.code === code);
      if (!p) throw new Error(`point ${code} not in state ${state.name}`);
      const l = levels.get(p.id);
      if (!l) throw new Error(`no levels for ${code}`);
      return l;
    };
    return { operating, model, point, years: resolved.years };
  }

  const military = (date: string, from: string, to: string, combinationId: string, quantity: number, quantityUnit?: 'shots' | 'kg') =>
    usageService.create(mockTenantId, areaId, {
      roomId, unit: 'Test', date, timeFrom: from, timeTo: to, usageType: 'military', personCount: 10, recordedBy: 'rechenfaelle',
      positions: [{ combinationId, quantity, ...(quantityUnit ? { quantityUnit } : {}) }],
    });
  const civil = (date: string, from: string, to: string, quantity: number) =>
    usageService.create(mockTenantId, areaId, {
      roomId, unit: 'Test', date, timeFrom: from, timeTo: to, usageType: 'civil', civilUsageKind: 'other', personCount: 4, recordedBy: 'rechenfaelle',
      positions: [{ combinationId: combo.stgw90, quantity }],
    });

  describe('0 · Abgleich Handrechnung → Dataset → Seed → Service', () => {
    it('seeds Testplatz S as specified: 1 Platz, 1 Raum, 3 Zustände, 6 Nutzungen, 2 Feiertage, 5 Quellen, 18 WLR-Zeilen (2 + 8 + 8)', async () => {
      const result = await seedDemoDataset(dataSource, mockTenantId, { now: NOW, force: true, dataset: TESTPLATZ_S_DATASET as unknown as TenantDataset });
      expect(result).toMatchObject({ skipped: false, areas: 1, rooms: 1, calculations: 3, sources: 5, receivers: 5, wlr: 18, usages: 6 });
      const days = await holidays.find({ where: { tenantId: mockTenantId } });
      expect(days.map((h) => [h.date, h.from ?? null]).sort()).toEqual([['2026-12-24', '12:00'], ['2026-12-25', null]]);
      expect(states.z1.isCurrent).toBe(true);
      expect(states.z2.isCurrent).toBe(false);
    });

    it('2026: Betriebsdaten stgw90 1 210 / 200, zivil 110, Halbtage a = {1, 1}, alles auf Q1', async () => {
      const { operating, model, point } = await raw(Y2026, states.z1);
      expect(operating.years).toBe(1);
      expect(operating.annex9.get(refKey(roomId, combo.stgw90))).toEqual({ inside: REF.operating2026.stgw90.inside, outside: REF.operating2026.stgw90.outside });
      expect(operating.annex7Shots.get(refKey(roomId, combo.stgw90))).toBe(REF.operating2026.stgw90.civil);
      expect(operating.annex7HalfDays.a).toEqual(REF.halfDays2026);
      expect(operating.annex7HalfDays.b).toEqual({ work: 0, sunday: 0 });
      expect(model.sources.map((s) => s.sourceId)).toEqual(['Q1']);
      expect(point('E1').missing).toEqual([]);
    });

    it('Z1 E1: Rohpegel A9 57.14939920… und A7 38.14477796… (volle Genauigkeit der Gegenrechnung)', async () => {
      const { point } = await raw(Y2026, states.z1);
      expect(point('E1').annex9All).toBeCloseTo(REF.z1E1.lr9, RAW);
      expect(point('E1').annex7All).toBeCloseTo(REF.z1E1.lr7, RAW);
    });

    it('Z1 E1 im DTO: Anzeige 57.1 / 38.1, IGW 60 (ES II, vor 1985), Status warn / ok, Platz warn', async () => {
      const dto = await assessment.assess(mockTenantId, areaId, Y2026);
      expect(dto.calculation?.id).toBe(states.z1.id);
      expect(dto.period).toMatchObject({ from: '2026-01-01', to: '2026-12-31', years: 1 });
      const e1 = receiver(dto, 'E1');
      expect(dto.receivers.map((r) => r.code)).toEqual(['E1']);
      expect(row(e1, 9)).toMatchObject({ limit: 60, applicable: true, level: 57.1, state: 'warn', reserve: 2.9 });
      expect(row(e1, 7)).toMatchObject({ limit: 60, applicable: true, level: 38.1, state: 'ok' });
      expect(e1.rows.filter((r) => r.limitKind === 'pw').every((r) => !r.applicable && r.level === null)).toBe(true);
      expect(e1.state).toBe('warn');
      expect(e1.missingSources).toEqual([]);
      expect(dto.counts).toMatchObject({ total: 1, warn: 1, incomplete: 0 });
      const op = dto.operatingData.find((r) => r.combinationId === combo.stgw90);
      expect(op).toMatchObject({ inside: 1210, outside: 200, civil: 110, sources: ['Q1'] });
    });

    it('Z2: dieselben Nutzungen, E1 −6 dB (51.1494 / 32.1448), E2 nur hier (57.1494); Q1b mit Gewicht 0 bekommt nichts', async () => {
      const { point, operating } = await raw(Y2026, states.z2);
      expect(point('E1').annex9All).toBeCloseTo(REF.z2E1.lr9, RAW);
      expect(point('E1').annex7All).toBeCloseTo(REF.z2E1.lr7, RAW);
      expect(point('E2').annex9All).toBeCloseTo(REF.z2E2.lr9, RAW);
      expect(point('E1').missing).toEqual([]);
      // The usages did not change with the state (slm 44).
      expect(operating.annex9.get(refKey(roomId, combo.stgw90))).toEqual({ inside: 1210, outside: 200 });

      const dto = await assessment.assess(mockTenantId, areaId, { ...Y2026, calculationId: states.z2.id });
      expect(dto.receivers.map((r) => r.code)).toEqual(['E1', 'E2']);
      expect(row(receiver(dto, 'E1'), 9)).toMatchObject({ level: 51.1, state: 'ok', deltaToCurrent: -6 });
      expect(row(receiver(dto, 'E2'), 9)).toMatchObject({ limit: 65, level: 57.1, state: 'ok' });
      const op = dto.operatingData.find((r) => r.combinationId === combo.stgw90);
      expect(op?.sources).toEqual(['Q1a']);
    });

    it('Z3: Σ Quellengewichte = 0 → verweigert, E1 und E2 nicht beurteilbar (O8), kein Pegel', async () => {
      const dto = await assessment.assess(mockTenantId, areaId, { ...Y2026, calculationId: states.z3.id });
      for (const code of ['E1', 'E2']) {
        const r = receiver(dto, code);
        expect(r.state).toBe('incomplete');
        expect(r.missingSources).toHaveLength(1);
        expect(row(r, 9).state).toBe('incomplete');
      }
      expect(dto.counts).toMatchObject({ total: 2, incomplete: 2, ok: 0, warn: 0, over: 0 });
      const { point } = await raw(Y2026, states.z3);
      expect(point('E1').missing.map((m) => m.reason)).toEqual(['zero-weights']);
    });

    it('2025: pist75 und sprengladung ohne Quelle in Z1 → E1 nicht beurteilbar, Mengen bleiben sichtbar', async () => {
      const dto = await assessment.assess(mockTenantId, areaId, Y2025);
      const e1 = receiver(dto, 'E1');
      expect(e1.state).toBe('incomplete');
      expect(e1.missingSources).toHaveLength(2);
      expect(dto.operatingData.map((r) => [r.combinationId, r.inside, r.sources]).sort()).toEqual(
        [[combo.pist75, 50, []], [combo.sprengladung, 2.5, []]].sort(),
      );
      expect(dto.counts).toMatchObject({ incomplete: 1 });
    });
  });

  describe('1 · Trennung 12:00 (B1 7.4.3)', () => {
    it('U3 11:00–13:00 zählt ½ Vormittag + ½ Nachmittag: A7 38.1448 → 38.1 – mit U3 11:00–12:00 37.5649 → 37.6', async () => {
      const before = await raw(Y2026, states.z1);
      expect(before.operating.annex7HalfDays.a).toEqual({ work: 1, sunday: 1 });
      expect(before.point('E1').annex7All).toBeCloseTo(REF.z1E1.lr7, RAW);
      expect(row(receiver(await assessment.assess(mockTenantId, areaId, Y2026), 'E1'), 7)).toMatchObject({ level: 38.1, state: 'ok' });

      // Gegenprobe: one hour less (11:00–12:00) → only half a workday half-day.
      await usages.update({ tenantId: mockTenantId, areaId, recordedBy: 'Test U3' }, { timeTo: '12:00' });
      const after = await raw(Y2026, states.z1);
      expect(after.operating.annex7HalfDays.a).toEqual({ work: 0.5, sunday: 1 });
      expect(after.point('E1').annex7All).toBeCloseTo(REF.z1E1Noon13.lr7, RAW);
      expect(row(receiver(await assessment.assess(mockTenantId, areaId, Y2026), 'E1'), 7)).toMatchObject({ level: 37.6 });
    });
  });

  it.todo('2a · Kernel: 08:00–10:00 = ½ Halbtag, 08:00–10:01 = 1 Halbtag (interner Rechentest) — libs/shared/lsv operating-data.spec.ts');
  it.todo('2b · Service, regulärer Pfad (Viertelstundenraster): Zivil 08:00–10:00 → A7 28.9897 → 29.0; 08:00–10:15 → 32.0');
  it.todo('2c · Service mit 08:00–10:01 → 32.0 – ausdrücklich interner Rechentest (Raster erzwingen Maske/ELO, nicht der Kernel)');

  describe('3 · Feiertag am Standort (B1 7.4.3 / 7.4.4)', () => {
    it('A9: U4 am 25.12.2026 (Fr, Weihnachten) zählt ausserhalb → 57.1494; ohne Kalender 56.6072', async () => {
      const withHoliday = await raw(Y2026, states.z1);
      expect(withHoliday.operating.annex9.get(refKey(roomId, combo.stgw90))).toEqual({ inside: 1210, outside: 200 });
      expect(withHoliday.point('E1').annex9All).toBeCloseTo(REF.z1E1.lr9, RAW);
      expect(row(receiver(await assessment.assess(mockTenantId, areaId, Y2026), 'E1'), 9)).toMatchObject({ level: 57.1, state: 'warn' });

      // Gegenprobe: without the site's calendar the Friday is a workday.
      await holidays.delete({ tenantId: mockTenantId });
      const without = await raw(Y2026, states.z1);
      expect(without.operating.annex9.get(refKey(roomId, combo.stgw90))).toEqual({ inside: 1310, outside: 100 });
      expect(without.point('E1').annex9All).toBeCloseTo(REF.z1E1NoHoliday.lr9, RAW);
      expect(row(receiver(await assessment.assess(mockTenantId, areaId, Y2026), 'E1'), 9)).toMatchObject({ level: 56.6 });
    });

    it('A7: eine Zivil-Nutzung am 25.12.2026 ist ein Sonn-/Feiertags-Halbtag (Sh = 2 → 41.4176), ohne Kalender ein Werk-Halbtag (39.9564)', async () => {
      await civil('2026-12-25', '09:00', '12:00', 100);
      const withHoliday = await raw(Y2026, states.z1);
      expect(withHoliday.operating.annex7HalfDays.a).toEqual({ work: 1, sunday: 2 });
      expect(withHoliday.operating.annex7Shots.get(refKey(roomId, combo.stgw90))).toBe(210);
      expect(withHoliday.point('E1').annex7All).toBeCloseTo(REF.case3Civil2512.lr7, RAW);
      expect(row(receiver(await assessment.assess(mockTenantId, areaId, Y2026), 'E1'), 7)).toMatchObject({ level: 41.4 });

      await holidays.delete({ tenantId: mockTenantId });
      const without = await raw(Y2026, states.z1);
      expect(without.operating.annex7HalfDays.a).toEqual({ work: 2, sunday: 1 });
      expect(without.point('E1').annex7All).toBeCloseTo(REF.case3Civil2512.lr7NoHoliday, RAW);
    });

    it('halber Feiertag 24.12. ab 12:00: Nutzung 10:00–14:00 wird 50 / 50 geteilt (A9), zivil ½ Werk + ½ Sonn (A7)', async () => {
      await military('2026-12-24', '10:00', '14:00', combo.stgw90, 400);
      const a9 = await raw(Y2026, states.z1);
      expect(a9.operating.annex9.get(refKey(roomId, combo.stgw90))).toEqual({ inside: 1410, outside: 400 });

      await usages.update({ tenantId: mockTenantId, areaId, recordedBy: 'rechenfaelle' }, { usageType: 'civil', civilUsageKind: 'other' });
      const a7 = await raw(Y2026, states.z1);
      expect(a7.operating.annex7HalfDays.a).toEqual({ work: 1.5, sunday: 1.5 });
    });
  });

  it.todo('4 · ×10 auf alle Nutzungen 2026: A9 57.1494 → 67.1494 (+10.000), A7 38.1448 → 41.1448 (+3.000) – Simulation und kopierte Nutzungen');

  describe('5 · Grenzwertvergleich auf ganze dB aus dem ungerundeten Pegel (B1.2 10.4)', () => {
    /** One military usage inside the workday with N shots; Lr = 24.4954… + 10·log10(N). */
    async function only(n: number) {
      await usages.delete({ tenantId: mockTenantId, areaId });
      await military('2026-03-02', '08:00', '11:00', combo.stgw90, n);
      const { point } = await raw(Y2026, states.z1);
      const dto = await assessment.assess(mockTenantId, areaId, Y2026);
      return { rawLevel: point('E1').annex9All as number, row: row(receiver(dto, 'E1'), 9) };
    }

    it('N = 3 900: Rohwert 60.4061 · Anzeige 60.4 · Beurteilungswert 60 ≤ 60 → eingehalten, in der Warnzone → warn', async () => {
      const r = await only(3900);
      expect(r.rawLevel).toBeCloseTo(REF.case5.n3900, RAW);
      expect(r.row).toMatchObject({ limit: 60, level: 60.4, state: 'warn' });
    });

    it('N = 3 985: Rohwert 60.4997 · Anzeige 60.5 · Beurteilungswert 60 (aus dem Rohwert, nicht aus der Anzeige) → warn', async () => {
      const r = await only(3985);
      expect(r.rawLevel).toBeCloseTo(REF.case5.n3985, RAW);
      expect(r.row).toMatchObject({ limit: 60, level: 60.5, state: 'warn' });
    });

    it('N = 3 990: Rohwert 60.5052 · Anzeige 60.5 · Beurteilungswert 61 > 60 → über­schritten → over', async () => {
      const r = await only(3990);
      expect(r.rawLevel).toBeCloseTo(REF.case5.n3990, RAW);
      expect(r.row).toMatchObject({ limit: 60, level: 60.5, state: 'over' });
    });
  });

  describe('6 · Jahresmittel ohne vorzeitige Rundung (B1 7.4.5)', () => {
    it('{2025, 2026}: sprengladung 2.5 / 2 = 1.25 kg, pist75 25, stgw90 605 / 100', async () => {
      const { operating } = await raw({ years: [2025, 2026] }, states.z1);
      expect(operating.years).toBe(2);
      expect(operating.annex9.get(refKey(roomId, combo.sprengladung))?.inside).toBeCloseTo(1.25, RAW);
      expect(operating.annex9.get(refKey(roomId, combo.pist75))?.inside).toBeCloseTo(25, RAW);
      expect(operating.annex9.get(refKey(roomId, combo.stgw90))).toEqual({ inside: 605, outside: 100 });
    });

    it('{2025, 2026, 2028}: 2.5 / 3 kg exakt (1e-9), 50 / 3, 1 510 / 3, 200 / 3 – Anzeige separat mit drei Dezimalen', async () => {
      await military('2028-03-06', '08:00', '10:00', combo.stgw90, 300);
      const { operating } = await raw({ years: [2025, 2026, 2028] }, states.z1);
      expect(operating.years).toBe(3);
      // Raw precision — toBeCloseTo(0.8333, 3) would let the rounded 0.833 through.
      expect(operating.annex9.get(refKey(roomId, combo.sprengladung))?.inside).toBeCloseTo(2.5 / 3, RAW);
      expect(operating.annex9.get(refKey(roomId, combo.pist75))?.inside).toBeCloseTo(50 / 3, RAW);
      expect(operating.annex9.get(refKey(roomId, combo.stgw90))?.inside).toBeCloseTo(1510 / 3, RAW);
      expect(operating.annex9.get(refKey(roomId, combo.stgw90))?.outside).toBeCloseTo(200 / 3, RAW);
      expect(operating.annex7HalfDays.a.work).toBeCloseTo(1 / 3, RAW);
      expect(operating.annex7HalfDays.a.sunday).toBeCloseTo(1 / 3, RAW);

      // The DTO carries the same raw quantities; formatting to three decimals is the client's job.
      const dto = await assessment.assess(mockTenantId, areaId, { now: NOW, years: [2025, 2026, 2028] });
      expect(dto.period).toMatchObject({ years: 3, selectedYears: [2025, 2026, 2028] });
      const kg = dto.operatingData.find((r) => r.combinationId === combo.sprengladung);
      expect(kg?.inside).toBeCloseTo(2.5 / 3, RAW);
      expect((kg?.inside as number).toFixed(3)).toBe('0.833');
      expect(receiver(dto, 'E1').state).toBe('incomplete');
    });
  });

  it.todo('7 · zwei Zivil-Nutzungen im selben Vormittag (08:00–09:00 + 09:30–11:30) = 1 Werk-Halbtag → A7 32.5283; Variante 30 + 90 min → ½ → 29.5180');
});
