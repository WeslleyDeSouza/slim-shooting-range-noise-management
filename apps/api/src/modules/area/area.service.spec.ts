import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import {
  mockTenantId,
  testDbSeedBeforeEach,
  testDbSetup,
} from '@api-slim/tests';
import { seedDemoDataset } from '../../mocks/tenant/demo-dataset.seed';
import { DemoSeedMarkerEntity } from '../../mocks/tenant/demo-seed-marker.entity';
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

  it('summarises the traffic-light status', async () => {
    await seedDemoDataset(dataSource, mockTenantId, { now: NOW });
    const summary = await service.summary(mockTenantId);
    expect(summary).toEqual({
      total: 9,
      ok: 3,
      warn: 2,
      over: 3,
      none: 1,
      attention: 5,
    });
  });

  it('creates, updates and soft-deletes an area', async () => {
    const created = await service.create(mockTenantId, {
      name: 'Test',
      coordinationSectionNo: '9999.999',
    });
    expect(created.quotaStatus).toBe('none');

    const updated = await service.update(mockTenantId, created.id, {
      noiseStatus: 'over',
    });
    expect(updated.noiseStatus).toBe('over');

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
