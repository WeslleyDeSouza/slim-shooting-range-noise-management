import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { mockTenantId, testDbSeedBeforeEach, testDbSetup } from '@api-slim/tests';
import { AreaModule } from '../area/area.module';
import { AreaService } from '../area/area.service';
import { CalculationModule } from '../calculation/calculation.module';
import { DemoSeedMarkerEntity } from '../../mocks/tenant/demo-seed-marker.entity';
import { seedDemoDataset } from '../../mocks/tenant/demo-dataset.seed';
import { UsageCombinationDto, UsageOverviewDto } from './dto';
import { UsageModule } from './usage.module';
import { UsageService } from './usage.service';

const NOW = new Date(2026, 11, 31);
const YEAR = 2026;

describe('UsageService (5.11 Schusszahlen, B1 6.1.3 Nutzung + Positionen)', () => {
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

  /** The Stgw 90 of a room that allows several combinations (military, Stück). */
  const combo = (): UsageCombinationDto =>
    overview.combinations.find(
      (c) => c.weapon === 'Stgw 90' && c.quantityUnit === 'shots' && overview.combinations.filter((x) => x.roomId === c.roomId).length > 1,
    ) as UsageCombinationDto;

  it('lists rooms with counts, the allowed combinations and the year\'s usages', () => {
    expect(overview.rooms).toHaveLength(14);
    expect(overview.rooms.map((r) => r.groupName)).toContain('NGST');
    expect(overview.combinations).toHaveLength(17);
    expect(overview.usages.length).toBeGreaterThan(60);
    expect(overview.usages.every((u) => u.date.startsWith(`${YEAR}-`))).toBe(true);
    // Newest first.
    const dates = overview.usages.map((u) => u.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    // Room counters add up to the list.
    expect(overview.rooms.reduce((s, r) => s + r.usageCount, 0)).toBe(overview.usages.length);
    expect(overview.usages.every((u) => u.roomName && u.positions.length > 0 && u.weaponName)).toBe(true);
    // Some usages carry several positions (n × Kombination + Menge).
    expect(overview.usages.filter((u) => u.positions.length > 1).length).toBeGreaterThan(3);
    // The combination tells the entry which unit the quantity is in (Stück / kg).
    expect(overview.combinations.some((c) => c.quantityUnit === 'kg')).toBe(true);
    expect(overview.usages.some((u) => u.quantityUnit === 'kg' && u.shots === 12.5)).toBe(true);
    // Persons and the civil kind travel with the usage (B1 6.1.3).
    expect(overview.usages.some((u) => u.usageType === 'civil' && u.civilUsageKind !== null)).toBe(true);
    expect(overview.usages.every((u) => u.personCount !== null)).toBe(true);
  });

  it('computes the KPIs', () => {
    const { kpi } = overview;
    expect(kpi.year).toBe(YEAR);
    expect(kpi.count).toBe(overview.usages.length);
    expect(kpi.totalShots).toBeCloseTo(overview.usages.reduce((s, u) => s + u.shots, 0), 3);
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

  it('creates a usage with several positions for allowed combinations of the room', async () => {
    const first = combo();
    const second = overview.combinations.find((c) => c.roomId === first.roomId && c.combinationId !== first.combinationId) as UsageCombinationDto;
    const created = await service.create(mockTenantId, geissalpId, {
      roomId: first.roomId,
      unit: '  Inf Bat 12 ',
      date: `${YEAR}-04-01`,
      timeFrom: '08:00',
      timeTo: '11:30',
      usageType: 'military',
      personCount: 42,
      positions: [
        { combinationId: first.combinationId, quantity: 250 },
        { combinationId: second.combinationId, quantity: 30.5 },
      ],
      recordedBy: 'Hans Muster',
    });
    expect(created).toMatchObject({ unit: 'Inf Bat 12', shots: 280.5, source: 'manual', recordedBy: 'Hans Muster', personCount: 42 });
    expect(created.positions.map((p) => p.quantity)).toEqual([250, 30.5]);
    expect(created.weaponName).toContain(first.entryName);
    const after = await service.overview(mockTenantId, geissalpId, YEAR);
    expect(after.usages.length).toBe(overview.usages.length + 1);
    overview = after;
  });

  it('is idempotent for an external id (ELO)', async () => {
    const c = combo();
    const dto = {
      roomId: c.roomId, unit: 'ELO-Test', date: `${YEAR}-04-02`, timeFrom: '08:00', timeTo: '09:00', usageType: 'military' as const,
      positions: [{ combinationId: c.combinationId, quantity: 10 }], recordedBy: 'ELO', externalId: 'ELO-2026-TEST-1', source: 'elo' as const,
    };
    const a = await service.create(mockTenantId, geissalpId, dto);
    const b = await service.create(mockTenantId, geissalpId, dto);
    expect(b.id).toBe(a.id);
    expect(a.source).toBe('elo');
    await service.remove(mockTenantId, geissalpId, [a.id]);
  });

  it('rejects a combination that is not assigned to the room', async () => {
    const c = combo();
    const otherRoom = overview.rooms.find((r) => r.id !== c.roomId && !overview.combinations.some((x) => x.roomId === r.id && x.combinationId === c.combinationId)) as { id: string };
    await expect(
      service.create(mockTenantId, geissalpId, {
        roomId: otherRoom.id, unit: 'K1', date: `${YEAR}-04-01`, timeFrom: '08:00', timeTo: '11:30', usageType: 'military',
        positions: [{ combinationId: c.combinationId, quantity: 10 }], recordedBy: 'x',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an empty or reversed time slot, a civil usage without kind and an empty position list', async () => {
    const c = combo();
    const base = { roomId: c.roomId, unit: 'K1', date: `${YEAR}-04-01`, usageType: 'military' as const, positions: [{ combinationId: c.combinationId, quantity: 10 }], recordedBy: 'x' };
    await expect(service.create(mockTenantId, geissalpId, { ...base, timeFrom: '11:00', timeTo: '11:00' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(mockTenantId, geissalpId, { ...base, timeFrom: '12:00', timeTo: '11:00' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(mockTenantId, geissalpId, { ...base, timeFrom: '08:00', timeTo: '11:00', usageType: 'civil' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(mockTenantId, geissalpId, { ...base, timeFrom: '08:00', timeTo: '11:00', positions: [] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates, deletes and restores', async () => {
    const usage = overview.usages.find((u) => u.unit === 'Inf Bat 12' && u.shots === 280.5) as UsageOverviewDto['usages'][number];
    const updated = await service.update(mockTenantId, geissalpId, usage.id, {
      positions: [{ combinationId: usage.positions[0].combinationId, quantity: 300 }],
      note: ' Nachtschiessen ',
    });
    expect(updated).toMatchObject({ shots: 300, note: 'Nachtschiessen' });
    expect(updated.positions).toHaveLength(1);

    const removed = await service.remove(mockTenantId, geissalpId, [usage.id, '11111111-1111-1111-1111-111111111111']);
    expect(removed).toEqual([usage.id]);
    await expect(service.get(mockTenantId, geissalpId, usage.id)).rejects.toBeInstanceOf(NotFoundException);

    const restored = await service.restore(mockTenantId, geissalpId, [usage.id]);
    expect(restored).toEqual([usage.id]);
    expect((await service.get(mockTenantId, geissalpId, usage.id)).positions[0].quantity).toBe(300);
    // Restoring twice is a no-op.
    expect(await service.restore(mockTenantId, geissalpId, [usage.id])).toEqual([]);
  });

  it('keeps a historical usage valid when its assignment is disabled later (slm 44)', async () => {
    const c = combo();
    const created = await service.create(mockTenantId, geissalpId, {
      roomId: c.roomId, unit: 'Alt', date: `${YEAR}-03-03`, timeFrom: '08:00', timeTo: '09:00', usageType: 'military',
      positions: [{ combinationId: c.combinationId, quantity: 5 }], recordedBy: 'x',
    });
    await dataSource.query('update stellungsraum_kombination set enabled = 0 where tenantId = ? and roomId = ? and combinationId = ?', [mockTenantId, c.roomId, c.combinationId]);
    try {
      // The old usage still reads and can be corrected (note) …
      const updated = await service.update(mockTenantId, geissalpId, created.id, { note: 'korrigiert' });
      expect(updated.note).toBe('korrigiert');
      // … but the combination is no longer accepted for a new entry.
      await expect(
        service.create(mockTenantId, geissalpId, {
          roomId: c.roomId, unit: 'Neu', date: `${YEAR}-03-04`, timeFrom: '08:00', timeTo: '09:00', usageType: 'military',
          positions: [{ combinationId: c.combinationId, quantity: 5 }], recordedBy: 'x',
        }),
      ).rejects.toThrow(/no longer allowed/);
    } finally {
      await dataSource.query('update stellungsraum_kombination set enabled = 1 where tenantId = ? and roomId = ? and combinationId = ?', [mockTenantId, c.roomId, c.combinationId]);
      await service.remove(mockTenantId, geissalpId, [created.id]);
    }
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
