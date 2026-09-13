import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { mockTenantId, testDbSeedBeforeEach, testDbSetup, TESTPLATZ_S, TESTPLATZ_S_DATASET } from '@api-slim/tests';
import { AreaModule } from '../area/area.module';
import { AreaService } from '../area/area.service';
import { AreaEntity, AreaQuotaEntity, AreaRoomEntity, WeaponCombinationEntity } from '../area/entities';
import { UsageModule } from '../usage/usage.module';
import { UsageService } from '../usage/usage.service';
import { AreaUsageEntity } from '../usage/entities';
import { DemoSeedMarkerEntity } from '../../mocks/tenant/demo-seed-marker.entity';
import { seedDemoDataset } from '../../mocks/tenant/demo-dataset.seed';
import type { TenantDataset } from '../../mocks/tenant/tenant-dataset';
import { AssessmentService } from './assessment.service';
import { AreaStatusService } from './area-status.service';
import { CalculationModule } from './calculation.module';
import { CalculationService } from './calculation.service';
import { AreaCalculationEntity } from './entities';

/**
 * Traffic lights of the overview (B1 5.9 / 5.10) with their reasons, on
 * «Testplatz S» (`@api-slim/tests`): Kontingent = Ist of the year and the
 * three-year mean per combination, a shot combination without Kontingent
 * counts with Soll 0 (red at the first shot, reason `no-quota`); no usage
 * in the window → grey `no-usages`, never green by default. Noise: grey
 * `no-calculation` without a current state, `no-usages` with a state but
 * nothing recorded; otherwise the worst Immissionspunkt.
 */
const NOW = new Date(2026, 11, 31);

describe('AreaStatusService (Ampeln mit Grund, Testplatz S)', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let service: AreaStatusService;
  let usageService: UsageService;
  let calculations: CalculationService;
  let areas: Repository<AreaEntity>;
  let quotas: Repository<AreaQuotaEntity>;
  let usages: Repository<AreaUsageEntity>;

  let areaId: string;
  let roomId: string;
  let combo: Record<'stgw90' | 'pist75' | 'sprengladung', string>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: testDbSetup(
        [AreaModule, UsageModule, CalculationModule],
        [...AreaModule.DBOptions.entities, ...UsageModule.DBOptions.entities, ...CalculationModule.DBOptions.entities, DemoSeedMarkerEntity] as never[],
      ),
    }).compile();
    dataSource = module.get(DataSource);
    service = module.get(AreaStatusService);
    usageService = module.get(UsageService);
    calculations = module.get(CalculationService);
    areas = dataSource.getRepository(AreaEntity);
    quotas = dataSource.getRepository(AreaQuotaEntity);
    usages = dataSource.getRepository(AreaUsageEntity);
    await testDbSeedBeforeEach(dataSource);
  });

  afterAll(async () => {
    await module.close();
  });

  // Fresh fixture per case, then every usage removed: each case records exactly what it needs.
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
    await usages.delete({ tenantId: mockTenantId, areaId });
  });

  const shoot = (date: string, combinationId: string, quantity: number) =>
    usageService.create(mockTenantId, areaId, {
      roomId, unit: 'Test', date, timeFrom: '08:00', timeTo: '10:00', usageType: 'military', personCount: 10, recordedBy: 'status-spec',
      positions: [{ combinationId, quantity }],
    });
  const setQuotas = async (rows: { combinationId: string; shotsPerYear: number }[]) => {
    await quotas.delete({ tenantId: mockTenantId, areaId });
    await quotas.save(rows.map((r) => quotas.create({ tenantId: mockTenantId, areaId, combinationId: r.combinationId, shotsPerYear: r.shotsPerYear, basis: 'Test' })));
  };
  const stored = () => areas.findOneByOrFail({ tenantId: mockTenantId, id: areaId });

  it('invalidates cached colours if recalculation fails', async () => {
    await areas.update({ id: areaId }, { noiseStatus: 'ok', quotaStatus: 'ok', statusYear: 2025 });
    const spy = vi.spyOn(module.get(AssessmentService), 'assess').mockRejectedValueOnce(new Error('calculation unavailable'));
    try {
      await expect(service.refresh(mockTenantId, areaId, NOW)).rejects.toThrow('calculation unavailable');
      expect(await stored()).toMatchObject({ noiseStatus: 'incomplete', quotaStatus: 'incomplete', statusYear: null });
    } finally { spy.mockRestore(); }
  });

  it('refreshes year-dependent cached statuses for the new year', async () => {
    await service.refresh(mockTenantId, areaId, NOW);
    expect((await stored()).statusYear).toBe(2026);
    // Already 2027 in Switzerland, while a server running in UTC is in 2026.
    await service.refresh(mockTenantId, areaId, new Date('2026-12-31T23:00:00Z'));
    expect((await stored()).statusYear).toBe(2027);
  });

  it('no Kontingent at all, positive usage → over + no-quota (Soll 0, B1 5.10)', async () => {
    await setQuotas([]);
    await shoot('2026-03-02', combo.stgw90, 100);
    const result = await service.refresh(mockTenantId, areaId, NOW);
    expect(result).toMatchObject({ quotaStatus: 'over', quotaStatusReason: 'no-quota', statusYear: 2026 });
    // The light is a cache on the Schiessplatz row.
    expect(await stored()).toMatchObject({ quotaStatus: 'over', quotaStatusReason: 'no-quota' });
  });

  it('one of several shot combinations without Kontingent → over + no-quota, the others within', async () => {
    await setQuotas([{ combinationId: combo.stgw90, shotsPerYear: 2000 }]);
    await shoot('2026-03-02', combo.stgw90, 100); // within its 2000
    await shoot('2026-03-03', combo.pist75, 10); // no Kontingent → Soll 0
    const result = await service.refresh(mockTenantId, areaId, NOW);
    expect(result).toMatchObject({ quotaStatus: 'over', quotaStatusReason: 'no-quota' });
  });

  it('explicit Kontingent 0 with positive usage → over, no «no-quota» (the Soll exists and is 0)', async () => {
    await setQuotas([{ combinationId: combo.stgw90, shotsPerYear: 2000 }, { combinationId: combo.pist75, shotsPerYear: 0 }]);
    await shoot('2026-03-02', combo.stgw90, 100);
    await shoot('2026-03-03', combo.pist75, 1);
    const result = await service.refresh(mockTenantId, areaId, NOW);
    expect(result).toMatchObject({ quotaStatus: 'over', quotaStatusReason: null });
  });

  it('usage only in a previous year → the three-year mean counts (warn), the current year alone would be green', async () => {
    await setQuotas([{ combinationId: combo.stgw90, shotsPerYear: 2000 }]);
    await shoot('2024-05-06', combo.stgw90, 7000); // Ø 2024–2026 = 2333.3 > 2000 and ≤ 2500 (125 %)
    const result = await service.refresh(mockTenantId, areaId, NOW);
    expect(result).toMatchObject({ quotaStatus: 'warn', quotaStatusReason: null });
    // Outside the window (year − 3) the usage no longer counts: nothing recorded → grey.
    await usages.delete({ tenantId: mockTenantId, areaId });
    await shoot('2023-05-08', combo.stgw90, 7000);
    expect(await service.refresh(mockTenantId, areaId, NOW)).toMatchObject({ quotaStatus: 'none', quotaStatusReason: 'no-usages' });
  });

  it('no usage records at all → none + no-usages for Kontingent, and for noise with the state named as basis', async () => {
    await setQuotas([{ combinationId: combo.stgw90, shotsPerYear: 2000 }]);
    const result = await service.refresh(mockTenantId, areaId, NOW);
    expect(result).toMatchObject({
      quotaStatus: 'none',
      quotaStatusReason: 'no-usages',
      noiseStatus: 'none',
      noiseStatusReason: 'no-usages',
      noiseStatusBasis: TESTPLATZ_S.states.z1,
    });
  });

  it('no current state → noise none + no-calculation; with usages and a state the light is computed', async () => {
    await shoot('2026-03-02', combo.stgw90, 1200);
    const computed = await service.refresh(mockTenantId, areaId, NOW);
    expect(['ok', 'warn', 'over', 'incomplete']).toContain(computed.noiseStatus);
    expect(computed.noiseStatusReason).toBeNull();
    expect(computed.noiseStatusBasis).toBe(TESTPLATZ_S.states.z1);

    // Drop the «aktuell» pointer: no state to compute with.
    await dataSource.getRepository(AreaCalculationEntity).update({ tenantId: mockTenantId, areaId }, { isCurrent: false, currentKey: null });
    expect(await calculations.list(mockTenantId, areaId).then((all) => all.some((s) => s.isCurrent))).toBe(false);
    const result = await service.refresh(mockTenantId, areaId, NOW);
    expect(result).toMatchObject({ noiseStatus: 'none', noiseStatusReason: 'no-calculation', noiseStatusBasis: null });
  });
});
