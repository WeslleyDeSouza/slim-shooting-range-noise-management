import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import {
  mockTenantId,
  testDbSeedBeforeEach,
  testDbSetup,
} from '@api-slim/tests';
import { seedDemoDataset } from '../../mocks/tenant/demo-dataset.seed';
import { DemoSeedMarkerEntity } from '../../mocks/tenant/demo-seed-marker.entity';
import { AreaStatusService } from '../calculation/area-status.service';
import { CalculationModule } from '../calculation/calculation.module';
import { UsageModule } from '../usage/usage.module';
import { AreaModule } from './area.module';
import { AreaService, needsAttention, worstStatus } from './area.service';
import { AreaEntity } from './entities';

const NOW = new Date(2026, 11, 31);

describe('AreaService', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let service: AreaService;

  beforeEach(async () => {
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
    service = module.get(AreaService);
    await testDbSeedBeforeEach(dataSource);
  });

  afterEach(async () => {
    await dataSource
      .getRepository(AreaEntity)
      .delete({ tenantId: mockTenantId });
    await module.close();
  });

  it('seeds the demo areas once and lists them per tenant', async () => {
    await seedDemoDataset(dataSource, mockTenantId, { now: NOW });
    await seedDemoDataset(dataSource, mockTenantId, { now: NOW });

    const areas = await service.list(mockTenantId);
    expect(areas.length).toBe(9);
    expect(areas[0].coordinationSectionNo).toBe('1104.020');
    expect(areas[0].name).toBe('Geissalp');
    expect(await service.list('other-tenant')).toEqual([]);
  });

  it('summarises the traffic-light status computed from usages and states (5.9/5.10)', async () => {
    await seedDemoDataset(dataSource, mockTenantId, { now: NOW });
    // Fresh seed: the lights are a cache and start empty.
    expect(await service.summary(mockTenantId)).toMatchObject({ total: 9, none: 9 });
    await module.get(AreaStatusService).refreshAll(mockTenantId, NOW);
    const areas = await service.list(mockTenantId);
    const geissalp = areas.find((a) => a.name === 'Geissalp');
    // Noise: E1 is over the IGW of the current state. Quota: the Sprengladung has no Kontingent → Soll 0 → red (B1 5.10),
    // and the light says so («no-quota») instead of a bare red.
    expect(geissalp).toMatchObject({
      noiseStatus: 'over',
      noiseStatusReason: null,
      noiseStatusBasis: 'Initiale Aufnahme Areal Geissalp',
      quotaStatus: 'over',
      quotaStatusReason: 'no-quota',
      statusYear: NOW.getFullYear(),
    });
    // No state → no noise light («no-calculation»); the light areas have quotas for everything they shoot → green.
    const thun = areas.find((a) => a.name === 'Thun');
    expect(thun).toMatchObject({ noiseStatus: 'none', noiseStatusReason: 'no-calculation', quotaStatus: 'ok', quotaStatusReason: null });
    // Kontingente without any usage in the three years: nothing to compare → no light, never green by default.
    const hinterrhein = areas.find((a) => a.name === 'Hinterrhein');
    expect(hinterrhein).toMatchObject({ noiseStatus: 'none', quotaStatus: 'none', quotaStatusReason: 'no-usages' });
    const summary = await service.summary(mockTenantId);
    expect(summary.total).toBe(9);
    expect(summary.over).toBe(1);
    expect(summary.attention).toBe(1);
  });

  it('creates, updates and soft-deletes an area', async () => {
    const created = await service.create(mockTenantId, {
      name: 'Test',
      coordinationSectionNo: '9999.999',
    });
    expect(created.quotaStatus).toBe('none');

    const updated = await service.update(mockTenantId, created.id, {
      sectoralPlanNo: 'SP-TEST',
    });
    expect(updated.sectoralPlanNo).toBe('SP-TEST');

    await service.remove(mockTenantId, created.id);
    await expect(service.get(mockTenantId, created.id)).rejects.toThrow();
  });

  it('status helpers', () => {
    expect(worstStatus('ok', 'over')).toBe('over');
    expect(worstStatus('none', 'ok')).toBe('ok');
    expect(needsAttention({ quotaStatus: 'ok', noiseStatus: 'warn' })).toBe(
      true,
    );
    expect(needsAttention({ quotaStatus: 'ok', noiseStatus: 'none' })).toBe(
      false,
    );
  });
});
