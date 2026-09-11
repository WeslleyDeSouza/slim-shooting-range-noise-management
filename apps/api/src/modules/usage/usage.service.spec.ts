import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { mockTenantId, testDbSeedBeforeEach, testDbSetup } from '@api-slim/tests';
import { AreaModule } from '../area/area.module';
import { AreaService } from '../area/area.service';
import { CalculationModule } from '../calculation/calculation.module';
import { DemoSeedMarkerEntity } from '../../mocks/tenant/demo-seed-marker.entity';
import { seedDemoDataset } from '../../mocks/tenant/demo-dataset.seed';
import { UsageOverviewDto } from './dto';
import { UsageModule } from './usage.module';
import { UsageService } from './usage.service';

const NOW = new Date(2026, 11, 31);
const YEAR = 2026;

describe('UsageService (5.11 Schusszahlen)', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let service: UsageService;
  let geissalpId: string;
  let overview: UsageOverviewDto;

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
    service = module.get(UsageService);
    await testDbSeedBeforeEach(dataSource);
    await seedDemoDataset(dataSource, mockTenantId, { now: NOW });
    const areas = await module.get(AreaService).list(mockTenantId);
    geissalpId = areas.find((a) => a.coordinationSectionNo === '1104.020')?.id as string;
    overview = await service.overview(mockTenantId, geissalpId, YEAR);
  });

  afterAll(async () => {
    await module.close();
  });

  it('lists rooms with counts, the allowed weapons and the year\'s usages', () => {
    expect(overview.rooms).toHaveLength(14);
    expect(overview.rooms.map((r) => r.groupName)).toContain('NGST');
    expect(overview.weapons).toHaveLength(16);
    expect(overview.usages.length).toBeGreaterThan(60);
    expect(overview.usages.every((u) => u.date.startsWith(`${YEAR}-`))).toBe(true);
    // Newest first.
    const dates = overview.usages.map((u) => u.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    // Room counters add up to the list.
    expect(overview.rooms.reduce((s, r) => s + r.usageCount, 0)).toBe(overview.usages.length);
    expect(overview.usages.every((u) => u.roomName && u.weaponName)).toBe(true);
  });

  it('computes the KPIs', () => {
    const { kpi } = overview;
    expect(kpi.year).toBe(YEAR);
    expect(kpi.count).toBe(overview.usages.length);
    expect(kpi.totalShots).toBe(overview.usages.reduce((s, u) => s + u.shots, 0));
    expect(kpi.civilSharePercent).toBeGreaterThan(5);
    expect(kpi.civilSharePercent).toBeLessThan(60);
    expect(kpi.lastDate).toBe(overview.usages[0].date);
    expect(kpi.years).toEqual([2026, 2025]);
  });

  it('serves last year and an empty year', async () => {
    const last = await service.overview(mockTenantId, geissalpId, 2025);
    expect(last.usages).toHaveLength(3);
    const empty = await service.overview(mockTenantId, geissalpId, 2019);
    expect(empty.usages).toEqual([]);
    expect(empty.kpi).toMatchObject({ count: 0, totalShots: 0, civilSharePercent: 0, lastDate: null });
    expect(empty.kpi.years).toEqual([2026, 2025, 2019]);
  });

  it('creates a usage for an allowed room × weapon combination', async () => {
    const weapon = overview.weapons[0];
    const created = await service.create(mockTenantId, geissalpId, {
      roomId: weapon.roomId,
      weaponId: weapon.id,
      unit: '  Inf Bat 12 ',
      date: `${YEAR}-04-01`,
      timeFrom: '08:00',
      timeTo: '11:30',
      usageType: 'military',
      shots: 250,
      recordedBy: 'Hans Muster',
    });
    expect(created).toMatchObject({ unit: 'Inf Bat 12', shots: 250, source: 'manual', recordedBy: 'Hans Muster', weaponName: weapon.weaponName });
    const after = await service.overview(mockTenantId, geissalpId, YEAR);
    expect(after.usages.length).toBe(overview.usages.length + 1);
    overview = after;
  });

  it('rejects a weapon that is not assigned to the room', async () => {
    const weapon = overview.weapons[0];
    const otherRoom = overview.rooms.find((r) => r.id !== weapon.roomId) as { id: string };
    await expect(
      service.create(mockTenantId, geissalpId, {
        roomId: otherRoom.id,
        weaponId: weapon.id,
        unit: 'K1',
        date: `${YEAR}-04-01`,
        timeFrom: '08:00',
        timeTo: '11:30',
        usageType: 'military',
        shots: 10,
        recordedBy: 'x',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an empty or reversed time slot', async () => {
    const weapon = overview.weapons[0];
    const base = { roomId: weapon.roomId, weaponId: weapon.id, unit: 'K1', date: `${YEAR}-04-01`, usageType: 'military' as const, shots: 10, recordedBy: 'x' };
    await expect(service.create(mockTenantId, geissalpId, { ...base, timeFrom: '11:00', timeTo: '11:00' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(mockTenantId, geissalpId, { ...base, timeFrom: '12:00', timeTo: '11:00' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates, deletes and restores', async () => {
    const usage = overview.usages.find((u) => u.unit === 'Inf Bat 12' && u.shots === 250) as UsageOverviewDto['usages'][number];
    const updated = await service.update(mockTenantId, geissalpId, usage.id, { shots: 300, note: ' Nachtschiessen ' });
    expect(updated).toMatchObject({ shots: 300, note: 'Nachtschiessen' });

    const removed = await service.remove(mockTenantId, geissalpId, [usage.id, '11111111-1111-1111-1111-111111111111']);
    expect(removed).toEqual([usage.id]);
    await expect(service.get(mockTenantId, geissalpId, usage.id)).rejects.toBeInstanceOf(NotFoundException);

    const restored = await service.restore(mockTenantId, geissalpId, [usage.id]);
    expect(restored).toEqual([usage.id]);
    expect((await service.get(mockTenantId, geissalpId, usage.id)).shots).toBe(300);
    // Restoring twice is a no-op.
    expect(await service.restore(mockTenantId, geissalpId, [usage.id])).toEqual([]);
  });

  it('is scoped by tenant and area', async () => {
    await expect(service.overview('other-tenant', geissalpId, YEAR)).rejects.toBeInstanceOf(NotFoundException);
    const areas = await module.get(AreaService).list(mockTenantId);
    const thun = areas.find((a) => a.name === 'Thun') as { id: string };
    const other = await service.overview(mockTenantId, thun.id, YEAR);
    expect(other.usages).toHaveLength(3);
    expect(other.rooms).toHaveLength(2);
  });
});
