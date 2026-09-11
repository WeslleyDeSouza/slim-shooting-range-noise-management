import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { mockTenantId, testDbSeedBeforeEach, testDbSetup } from '@api-slim/tests';
import { AreaModule } from '../area/area.module';
import { AreaService } from '../area/area.service';
import { UsageModule } from '../usage/usage.module';
import { DemoSeedMarkerEntity } from '../../mocks/tenant/demo-seed-marker.entity';
import { seedDemoDataset } from '../../mocks/tenant/demo-dataset.seed';
import { AssessmentService, resolvePeriod } from './assessment.service';
import { CalculationModule } from './calculation.module';
import { AssessmentDto, ReceiverAssessmentDto } from './dto';

/** The demo year the dataset was tuned for (weekday pattern of the usages). */
const NOW = new Date(2026, 11, 31);
const PERIOD = { from: '2026-01-01', to: '2026-12-31', now: NOW };

/** Values of the UI mock `_mocks/area/detail.index.html` the dataset reproduces. */
const EXPECTED = {
  initial: { E1: [60.8, 49.1], E2: [54.2, 44.0], E3: [58.6, 47.5], E4: [52.3, 41.8], E5: [61.9, 50.4] },
  saniert: { E1: [56.4, 46.6], E2: [51.9, 42.3], E3: [57.2, 45.9], E4: [50.1, 40.2], E5: [60.7, 49.2] },
} as const;

function row(receiver: ReceiverAssessmentDto, annex: 9 | 7, kind: 'igw' | 'pw') {
  const found = receiver.rows.find((r) => r.annex === annex && r.limitKind === kind);
  if (!found) throw new Error(`no row ${annex}/${kind}`);
  return found;
}

describe('AssessmentService (5.12 Details)', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let service: AssessmentService;
  let geissalpId: string;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: testDbSetup(
        [AreaModule, UsageModule, CalculationModule],
        [
          ...AreaModule.DBOptions.entities,
          ...UsageModule.DBOptions.entities,
          ...CalculationModule.DBOptions.entities,
          DemoSeedMarkerEntity,
        ] as never[],
      ),
    }).compile();
    dataSource = module.get(DataSource);
    service = module.get(AssessmentService);
    await testDbSeedBeforeEach(dataSource);
    await seedDemoDataset(dataSource, mockTenantId, { now: NOW });
    const areas = await module.get(AreaService).list(mockTenantId);
    geissalpId = areas.find((a) => a.coordinationSectionNo === '1104.020')?.id as string;
  });

  afterAll(async () => {
    await module.close();
  });

  let result: AssessmentDto;

  it('assesses the current state (initial 2019) against the LSV limits', async () => {
    result = await service.assess(mockTenantId, geissalpId, PERIOD);
    expect(result.calculation?.name).toBe('Initiale Aufnahme Areal Geissalp');
    expect(result.current?.id).toBe(result.calculation?.id);
    expect(result.calculations).toHaveLength(2);
    expect(result.calculation?.sourceCount).toBe(16);
    expect(result.period).toEqual({ from: '2026-01-01', to: '2026-12-31', years: 1 });
    expect(result.receivers.map((r) => r.code)).toEqual(['E1', 'E2', 'E3', 'E4', 'E5', 'E6']);

    for (const [code, [a9, a7]] of Object.entries(EXPECTED.initial)) {
      const receiver = result.receivers.find((r) => r.code === code) as ReceiverAssessmentDto;
      expect(row(receiver, 9, 'igw').level, `${code} Anhang 9`).toBe(a9);
      expect(row(receiver, 7, 'igw').level, `${code} Anhang 7`).toBe(a7);
    }
  });

  it('applies the limits of the Empfindlichkeitsstufe and the traffic-light rule', () => {
    const e1 = result.receivers.find((r) => r.code === 'E1') as ReceiverAssessmentDto; // ES II, 60.8 dB
    expect(row(e1, 9, 'igw')).toMatchObject({ limit: 60, state: 'over', reserve: -0.8, applicable: true });
    const e3 = result.receivers.find((r) => r.code === 'E3') as ReceiverAssessmentDto; // ES II, 58.6 dB
    expect(row(e3, 9, 'igw')).toMatchObject({ limit: 60, state: 'warn', reserve: 1.4 });
    const e4 = result.receivers.find((r) => r.code === 'E4') as ReceiverAssessmentDto; // ES III, 52.3 dB
    expect(row(e4, 9, 'igw')).toMatchObject({ limit: 65, state: 'ok' });
    expect(row(e4, 7, 'igw')).toMatchObject({ limit: 65, state: 'ok' });
    const e2 = result.receivers.find((r) => r.code === 'E2') as ReceiverAssessmentDto; // ES II, 54.2 dB
    expect(row(e2, 9, 'igw').state).toBe('ok');
    expect(e1.state).toBe('over');
    // E2 is green on the IGW but its Planungswert row (new rooms only, 55 dB)
    // is orange → the point is orange: the worst applicable row wins.
    expect(e2.state).toBe('warn');
    expect(row(e2, 9, 'pw').state).toBe('warn');
    expect(result.counts).toEqual({ total: 6, ok: 1, warn: 2, over: 2, none: 1 });
  });

  it('assesses the Planungswert only for the rooms built after 1985 (mixed plant)', () => {
    const e1 = result.receivers.find((r) => r.code === 'E1') as ReceiverAssessmentDto;
    const pw = row(e1, 9, 'pw');
    expect(pw.applicable).toBe(true);
    expect(pw.limit).toBe(55);
    // Only Neuhaus B 3 and Salzmatt C 3 count: fewer sources → lower than the IGW level.
    expect(pw.level).not.toBeNull();
    expect(pw.level as number).toBeLessThan(row(e1, 9, 'igw').level as number);
    // Civil shooting happens on B 2 (old) only → no Annex 7 PW level.
    expect(row(e1, 7, 'pw')).toMatchObject({ applicable: true, level: null, state: 'none' });
  });

  it('leaves a reserve point without levels', () => {
    const e6 = result.receivers.find((r) => r.code === 'E6') as ReceiverAssessmentDto;
    expect(e6.type).toBe('reserve');
    expect(e6.state).toBe('none');
    expect(e6.rows.every((r) => r.level === null && r.state === 'none')).toBe(true);
  });

  it('exposes the Annex 9 operating data it used', () => {
    expect(result.operatingData.length).toBeGreaterThan(5);
    const total = result.operatingData.reduce((s, r) => s + r.inside + r.outside, 0);
    expect(total).toBeGreaterThan(10_000);
    expect(result.operatingData.some((r) => r.outside > 0)).toBe(true);
  });

  it('views another state and reports the delta to the current one', async () => {
    const saniert = result.calculations.find((c) => !c.isCurrent);
    const other = await service.assess(mockTenantId, geissalpId, { ...PERIOD, calculationId: saniert?.id });
    expect(other.calculation?.id).toBe(saniert?.id);
    expect(other.current?.isCurrent).toBe(true);
    for (const [code, [a9, a7]] of Object.entries(EXPECTED.saniert)) {
      const receiver = other.receivers.find((r) => r.code === code) as ReceiverAssessmentDto;
      expect(row(receiver, 9, 'igw').level, `${code} Anhang 9`).toBe(a9);
      expect(row(receiver, 7, 'igw').level, `${code} Anhang 7`).toBe(a7);
      const delta = row(receiver, 9, 'igw').deltaToCurrent as number;
      expect(delta).toBeCloseTo(a9 - EXPECTED.initial[code as 'E1'][0], 5);
    }
    const e1 = other.receivers.find((r) => r.code === 'E1') as ReceiverAssessmentDto;
    expect(e1.state).toBe('warn');
    // Deltas are only reported against a *different* state.
    expect(row(result.receivers[0], 9, 'igw').deltaToCurrent).toBeNull();
  });

  it('has no levels for a period without usages', async () => {
    const empty = await service.assess(mockTenantId, geissalpId, { from: '2020-01-01', to: '2020-12-31', now: NOW });
    expect(empty.counts.none).toBe(6);
    expect(empty.operatingData).toEqual([]);
  });

  it('averages the shots over several years', async () => {
    const two = await service.assess(mockTenantId, geissalpId, { from: '2025-01-01', to: '2026-12-31', now: NOW });
    expect(two.period.years).toBe(2);
    const one = result.operatingData.reduce((s, r) => s + r.inside + r.outside, 0);
    const avg = two.operatingData.reduce((s, r) => s + r.inside + r.outside, 0);
    expect(avg).toBeLessThan(one);
    expect(avg).toBeGreaterThan(one / 2 - 10);
  });

  it('rejects an unknown calculation state and an unknown area', async () => {
    await expect(service.assess(mockTenantId, geissalpId, { ...PERIOD, calculationId: '11111111-1111-1111-1111-111111111111' })).rejects.toThrow(/not found/);
    await expect(service.assess(mockTenantId, '11111111-1111-1111-1111-111111111111', PERIOD)).rejects.toThrow(/not found/);
  });

  it('assesses an area without calculation states as "none"', async () => {
    const areas = await module.get(AreaService).list(mockTenantId);
    const thun = areas.find((a) => a.name === 'Thun') as { id: string };
    const none = await service.assess(mockTenantId, thun.id, PERIOD);
    expect(none.calculation).toBeNull();
    expect(none.receivers).toEqual([]);
    expect(none.counts.total).toBe(0);
  });
});

describe('resolvePeriod', () => {
  const now = new Date(Date.UTC(2026, 8, 11));

  it('defaults to the whole current year', () => {
    expect(resolvePeriod(undefined, undefined, now)).toEqual({ from: '2026-01-01', to: '2026-12-31', years: 1 });
    expect(resolvePeriod(undefined, '2026-09-11', now)).toEqual({ from: '2026-01-01', to: '2026-09-11', years: 1 });
  });

  it('orders the bounds and counts whole years', () => {
    expect(resolvePeriod('2026-12-31', '2024-01-01', now)).toEqual({ from: '2024-01-01', to: '2026-12-31', years: 3 });
    expect(resolvePeriod('2026-01-01', '2026-03-31', now).years).toBe(1);
  });
});
