import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { mockTenantId, testDbSeedBeforeEach, testDbSetup } from '@api-slim/tests';
import { AreaModule } from '../area/area.module';
import { AreaService } from '../area/area.service';
import { UsageModule } from '../usage/usage.module';
import { DemoSeedMarkerEntity } from '../../mocks/tenant/demo-seed-marker.entity';
import { seedDemoDataset } from '../../mocks/tenant/demo-dataset.seed';
import { AssessmentService } from './assessment.service';
import { CalculationModule } from './calculation.module';
import { SimulationBaseDto } from './dto';
import { SimulationService } from './simulation.service';

const NOW = new Date(2026, 11, 31);
const YEAR = 2026;

describe('SimulationService (5.13 Simulation)', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let service: SimulationService;
  let geissalpId: string;
  let base: SimulationBaseDto;

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
    service = module.get(SimulationService);
    await testDbSeedBeforeEach(dataSource);
    await seedDemoDataset(dataSource, mockTenantId, { now: NOW });
    const areas = await module.get(AreaService).list(mockTenantId);
    geissalpId = areas.find((a) => a.coordinationSectionNo === '1104.020')?.id as string;
    base = await service.base(mockTenantId, geissalpId, YEAR);
  });

  afterAll(async () => {
    await module.close();
  });

  it('starts from the year\'s military shot counts per room × weapon (7.4.5)', async () => {
    expect(base.calculation?.isCurrent).toBe(true);
    expect(base.rows).toHaveLength(16);
    expect(base.rows.every((r) => r.hasLevels)).toBe(true);
    const shot = base.rows.filter((r) => r.inside + r.outside > 0);
    expect(shot.length).toBeGreaterThan(8);
    // The Pist 75 is shot by the Schützenverein (civil, Saturdays) and the
    // Kantonspolizei (Blaulicht, weekday mornings): annex 9 counts both.
    const pistol = base.rows.find((r) => r.weapon === 'Pist 75');
    expect(pistol?.inside).toBeGreaterThan(0);
    expect(pistol?.outside).toBeGreaterThan(0);
    // Same operating data as the assessment uses.
    const assessment = await module
      .get(AssessmentService)
      .assess(mockTenantId, geissalpId, { from: `${YEAR}-01-01`, to: `${YEAR}-12-31`, now: NOW });
    for (const op of assessment.operatingData) {
      expect(base.rows.find((r) => r.weaponId === op.weaponId)).toMatchObject({ inside: op.inside, outside: op.outside });
    }
    // Ist levels equal the assessment's Annex 9 IGW levels.
    for (const receiver of base.receivers) {
      const assessed = assessment.receivers.find((r) => r.id === receiver.id);
      const igw = assessed?.rows.find((r) => r.annex === 9 && r.limitKind === 'igw');
      expect(receiver.current).toBe(igw?.level ?? null);
      expect(receiver.currentState).toBe(igw?.state);
      expect(receiver.limitKind).toBe('igw');
    }
  });

  it('reproduces the Ist when the values are unchanged', async () => {
    const result = await service.run(mockTenantId, geissalpId, {
      year: YEAR,
      rows: base.rows.map((r) => ({ weaponId: r.weaponId, inside: r.inside, outside: r.outside })),
    });
    for (const receiver of result.receivers) {
      expect(receiver.simulated).toBe(receiver.current);
      expect(receiver.delta).toBe(receiver.current === null ? null : 0);
      expect(receiver.simulatedState).toBe(receiver.currentState);
    }
    expect(result.totals.inside).toBe(result.totals.baseInside);
    expect(result.totals.outside).toBe(result.totals.baseOutside);
    expect(result.counts.total).toBe(6);
  });

  it('raises every level by 10 dB when all shots are multiplied by ten', async () => {
    const result = await service.run(mockTenantId, geissalpId, {
      year: YEAR,
      rows: base.rows.map((r) => ({ weaponId: r.weaponId, inside: r.inside * 10, outside: r.outside * 10 })),
    });
    for (const receiver of result.receivers.filter((r) => r.current !== null)) {
      expect(receiver.delta).toBeCloseTo(10, 0);
      expect(Math.abs((receiver.delta as number) - 10)).toBeLessThanOrEqual(0.1);
    }
    // E4 (ES III, limit 65) stays orange at 62.3 dB; the ES II points go red.
    expect(result.counts).toMatchObject({ over: 4, warn: 1, none: 1 });
    expect(result.totals.inside).toBe(result.totals.baseInside * 10);
  });

  it('halving the shots lowers the level by about 3 dB and can turn the light', async () => {
    const result = await service.run(mockTenantId, geissalpId, {
      year: YEAR,
      rows: base.rows.map((r) => ({ weaponId: r.weaponId, inside: Math.round(r.inside / 2), outside: Math.round(r.outside / 2) })),
    });
    const e1 = result.receivers.find((r) => r.code === 'E1');
    expect(e1?.currentState).toBe('over');
    expect(e1?.delta).toBeCloseTo(-3, 0);
    expect(e1?.simulatedState).toBe('warn');
  });

  it('moving shots into the evening weighs them 5 dB more', async () => {
    const day = await service.run(mockTenantId, geissalpId, {
      year: YEAR,
      rows: base.rows.map((r) => ({ weaponId: r.weaponId, inside: r.inside + r.outside, outside: 0 })),
    });
    const eve = await service.run(mockTenantId, geissalpId, {
      year: YEAR,
      rows: base.rows.map((r) => ({ weaponId: r.weaponId, inside: 0, outside: r.inside + r.outside })),
    });
    for (const receiver of day.receivers.filter((r) => r.simulated !== null)) {
      const other = eve.receivers.find((r) => r.id === receiver.id);
      // LAE_eve ≈ LAE_day + 0.2 in the dataset, plus the +5 dB of Annex 9.
      expect((other?.simulated as number) - (receiver.simulated as number)).toBeCloseTo(5.2, 0);
    }
  });

  it('yields no level at all without shots', async () => {
    const result = await service.run(mockTenantId, geissalpId, {
      year: YEAR,
      rows: base.rows.map((r) => ({ weaponId: r.weaponId, inside: 0, outside: 0 })),
    });
    expect(result.receivers.every((r) => r.simulated === null && r.simulatedState === 'none')).toBe(true);
    expect(result.counts.none).toBe(6);
  });

  it('keeps the Ist for rows the client did not send', async () => {
    const one = base.rows.find((r) => r.inside > 0) as SimulationBaseDto['rows'][number];
    const result = await service.run(mockTenantId, geissalpId, {
      year: YEAR,
      rows: [{ weaponId: one.weaponId, inside: one.inside, outside: one.outside }],
    });
    expect(result.receivers.every((r) => r.simulated === r.current)).toBe(true);
  });

  it('rejects sources that do not belong to the area', async () => {
    await expect(
      service.run(mockTenantId, geissalpId, {
        year: YEAR,
        rows: [{ weaponId: '11111111-1111-1111-1111-111111111111', inside: 1, outside: 0 }],
      }),
    ).rejects.toThrow(/Unknown sources/);
  });

  it('can simulate on another calculation state', async () => {
    const saniert = base.calculation && (await module.get(AssessmentService).assess(mockTenantId, geissalpId, { now: NOW })).calculations.find((c) => !c.isCurrent);
    const other = await service.base(mockTenantId, geissalpId, YEAR, saniert?.id);
    expect(other.calculation?.id).toBe(saniert?.id);
    const e1 = other.receivers.find((r) => r.code === 'E1');
    expect(e1?.current).toBe(56.4);
  });

  it('has nothing to simulate for an area without calculation', async () => {
    const areas = await module.get(AreaService).list(mockTenantId);
    const thun = areas.find((a) => a.name === 'Thun') as { id: string };
    const none = await service.base(mockTenantId, thun.id, YEAR);
    expect(none.calculation).toBeNull();
    expect(none.rows).toHaveLength(3);
    expect(none.rows.every((r) => !r.hasLevels)).toBe(true);
    expect(none.receivers).toEqual([]);
  });
});
