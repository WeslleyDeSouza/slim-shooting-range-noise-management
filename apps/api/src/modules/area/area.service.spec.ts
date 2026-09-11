import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import {
  mockTenantId,
  testDbSeedBeforeEach,
  testDbSetup,
} from '@api-slim/tests';
import { AreaModule } from './area.module';
import { AREA_DEMO, AREA_MOCK_DATA } from './area.mock-data';
import { AreaService, needsAttention, worstStatus } from './area.service';
import { AreaEntity } from './entities';

describe('AreaService', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let service: AreaService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: testDbSetup(
        [AreaModule],
        AreaModule.DBOptions.entities as never[],
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
    await AREA_MOCK_DATA.fill(dataSource, mockTenantId);
    await AREA_MOCK_DATA.fill(dataSource, mockTenantId);

    const areas = await service.list(mockTenantId);
    expect(areas.length).toBe(AREA_DEMO.length);
    expect(areas[0].coordinationSectionNo).toBe('1202.230');
    expect(await service.list('other-tenant')).toEqual([]);
  });

  it('summarises the traffic-light status', async () => {
    await AREA_MOCK_DATA.fill(dataSource, mockTenantId);
    const summary = await service.summary(mockTenantId);
    expect(summary).toEqual({
      total: 8,
      ok: 3,
      warn: 2,
      over: 2,
      none: 1,
      attention: 4,
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
