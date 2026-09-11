import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { mockTenantId, testDbSeedBeforeEach, testDbSetup } from '@api-slim/tests';
import { parseMinutes, weekday } from '@slim/lsv';
import { AreaModule } from '../../modules/area/area.module';
import { AreaEntity } from '../../modules/area/entities';
import { CalculationModule } from '../../modules/calculation/calculation.module';
import { AreaWlrEntity } from '../../modules/calculation/entities';
import { AreaUsageEntity } from '../../modules/usage/entities';
import { UsageModule } from '../../modules/usage/usage.module';
import { seedDemoDataset } from './demo-dataset.seed';
import { DemoSeedMarkerEntity } from './demo-seed-marker.entity';
import { DEFAULT_DATASET_KEY, fillPlaceholders, loadDataset, loadRawDatasets } from './tenant-dataset';

const NOW = new Date(2026, 8, 11); // 11 September 2026

describe('fillPlaceholders', () => {
  it('rolls the year', () => {
    expect(fillPlaceholders('{{year}}-10-05', NOW)).toBe('2026-10-05');
    expect(fillPlaceholders('{{year+1}}-03-19', NOW)).toBe('2027-03-19');
    expect(fillPlaceholders('Jahr {{year-1}}', NOW)).toBe('Jahr 2025');
  });

  it('rolls whole months back, across the turn of the year', () => {
    expect(fillPlaceholders('{{ym-0}}-10', NOW)).toBe('2026-09-10');
    expect(fillPlaceholders('{{ym-8}}-10', NOW)).toBe('2026-01-10');
    expect(fillPlaceholders('{{ym-11}}-10', NOW)).toBe('2025-10-10');
  });

  it('leaves everything else alone', () => {
    expect(fillPlaceholders('Geissalp', NOW)).toBe('Geissalp');
  });
});

describe('the SLIM Demo dataset', () => {
  const dataset = loadDataset(DEFAULT_DATASET_KEY, NOW);
  const geissalp = dataset.areas[0];

  it('is what the demo promises', () => {
    expect(dataset.identifier).toBe('SLIM_DEMO');
    expect(dataset.users[0]).toMatchObject({ username: 'slim@demo.ch', password: '1234', role: 'admin' });
    expect(dataset.users.map((u) => u.role)).toEqual(['admin', 'slim_specialist', 'slim_range_owner', 'slim_interested', 'slim_admin']);
    expect(dataset.users.find((u) => u.role === 'slim_range_owner')?.areas).toEqual(['Geissalp', 'Thun']);
    expect(dataset.areas).toHaveLength(9);
    expect(geissalp.coordinationSectionNo).toBe('1104.020');
    expect(geissalp.rooms).toHaveLength(14);
    expect(geissalp.weapons).toHaveLength(16);
    expect(geissalp.receivers.map((r) => r.code)).toEqual(['E1', 'E2', 'E3', 'E4', 'E5', 'E6']);
    expect(geissalp.calculations.map((c) => c.isCurrent)).toEqual([true, false]);
    expect(geissalp.calculations.filter((c) => c.isMgdm)).toHaveLength(1);
    expect(geissalp.usages.length).toBeGreaterThan(60);
  });

  it('rolls every usage date to the seed year', () => {
    const raw = loadRawDatasets()[DEFAULT_DATASET_KEY].areas[0];
    expect(raw.usages.every((u) => u.date.startsWith('{{year'))).toBe(true);
    const years = new Set(geissalp.usages.map((u) => u.date.slice(0, 4)));
    expect([...years].sort()).toEqual(['2025', '2026']);
  });

  it('references only rooms, sources and receivers it defines', () => {
    for (const area of dataset.areas) {
      const rooms = new Set(area.rooms.map((r) => r.name));
      const sources = new Map(area.weapons.map((w) => [w.sourceId, w]));
      const receivers = new Set(area.receivers.map((r) => r.code));
      expect(sources.size, `${area.name}: duplicate sourceId`).toBe(area.weapons.length);
      for (const w of area.weapons) expect(rooms.has(w.room), `${area.name}: weapon room ${w.room}`).toBe(true);
      for (const u of area.usages) {
        expect(rooms.has(u.room), `${area.name}: usage room ${u.room}`).toBe(true);
        const weapon = sources.get(u.source);
        expect(weapon, `${area.name}: usage source ${u.source}`).toBeDefined();
        // The usage's room must be the room of the combination (5.17).
        expect(weapon?.room).toBe(u.room);
        expect(parseMinutes(u.to)).toBeGreaterThan(parseMinutes(u.from));
        expect(() => weekday(u.date)).not.toThrow();
        expect(u.shots).toBeGreaterThan(0);
        if (u.usageType === 'civil' || u.usageType === 'sat') expect(weapon?.annex7Category).not.toBeNull();
      }
      for (const c of area.calculations) {
        for (const row of c.wlr) {
          expect(receivers.has(row.receiver), `${c.name}: receiver ${row.receiver}`).toBe(true);
          expect(sources.has(row.source), `${c.name}: source ${row.source}`).toBe(true);
        }
        // One row per receiver × source, reserve points excepted.
        const assessed = area.receivers.filter((r) => r.type === 'facade').length;
        expect(c.wlr).toHaveLength(assessed * area.weapons.length);
      }
    }
  });

  it('has civil usages from the ELO interface and military ones outside the workday', () => {
    const civil = geissalp.usages.filter((u) => u.usageType === 'civil');
    expect(civil.length).toBeGreaterThan(5);
    expect(civil.every((u) => u.source_kind === 'elo')).toBe(true);
    const weekend = geissalp.usages.filter((u) => [0, 6].includes(weekday(u.date)));
    expect(weekend.length).toBeGreaterThan(5);
  });
});

describe('seedDemoDataset', () => {
  let module: TestingModule;
  let dataSource: DataSource;

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
    await testDbSeedBeforeEach(dataSource);
  });

  afterEach(async () => {
    await module.close();
  });

  it('writes the dataset once and skips while the marker matches', async () => {
    const first = await seedDemoDataset(dataSource, mockTenantId, { now: NOW });
    expect(first.skipped).toBe(false);
    expect(first).toMatchObject({ year: 2026, areas: 9, receivers: 6, calculations: 2 });
    expect(first.wlr).toBe(2 * 5 * 16);
    expect(first.usages).toBeGreaterThan(60);

    const second = await seedDemoDataset(dataSource, mockTenantId, { now: NOW });
    expect(second.skipped).toBe(true);

    expect(await dataSource.getRepository(AreaEntity).count({ where: { tenantId: mockTenantId } })).toBe(9);
    expect(await dataSource.getRepository(AreaWlrEntity).count({ where: { tenantId: mockTenantId } })).toBe(160);
    const marker = await dataSource.getRepository(DemoSeedMarkerEntity).findOneByOrFail({ tenantId: mockTenantId });
    expect(marker).toMatchObject({ datasetKey: DEFAULT_DATASET_KEY, version: 4, year: 2026 });
  });

  it('rewrites the demo when the year turns, without duplicating rows', async () => {
    await seedDemoDataset(dataSource, mockTenantId, { now: NOW });
    const usages = dataSource.getRepository(AreaUsageEntity);
    const before = await usages.count({ where: { tenantId: mockTenantId } });

    const next = await seedDemoDataset(dataSource, mockTenantId, { now: new Date(2027, 0, 5) });
    expect(next.skipped).toBe(false);
    expect(next.year).toBe(2027);
    expect(await usages.count({ where: { tenantId: mockTenantId } })).toBe(before);
    const dates = (await usages.find({ where: { tenantId: mockTenantId } })).map((u) => u.date.slice(0, 4));
    expect(new Set(dates)).toEqual(new Set(['2026', '2027']));
  });

  it('force rewrites even when the marker matches', async () => {
    await seedDemoDataset(dataSource, mockTenantId, { now: NOW });
    const forced = await seedDemoDataset(dataSource, mockTenantId, { now: NOW, force: true });
    expect(forced.skipped).toBe(false);
    expect(await dataSource.getRepository(AreaEntity).count({ where: { tenantId: mockTenantId } })).toBe(9);
  });

  it('leaves other tenants alone', async () => {
    await seedDemoDataset(dataSource, mockTenantId, { now: NOW });
    expect(await dataSource.getRepository(AreaEntity).count({ where: { tenantId: 'other' } })).toBe(0);
  });
});
