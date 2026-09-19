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
    // B1 5.15: rooms without a Koordinationsabschnitts-Nr. exist (the states' Anlageteile keep their own number).
    expect(geissalp.rooms.filter((r) => r.coordinationSectionNo === null)).toHaveLength(2);
    // Stammdaten of 5.16 as Abbildung 26/27 shows them for Geissalp.
    expect(geissalp).toMatchObject({ classification: 'unproblematic', spmState: 'completed', planningApproval: 'Militärische Plangenehmigung vom 13.02.2023' });
    expect(dataset.areas.find((a) => a.name === 'Hinterrhein')?.enabled).toBe(false);
    expect(geissalp.roomCombinations).toHaveLength(17);
    expect(dataset.masterData.combinations.length).toBeGreaterThan(10);
    const states = geissalp.calculations.flatMap((c) => c.states);
    expect(states.map((s) => s.isCurrent)).toEqual([true, false]);
    expect(states.filter((s) => s.isMgdm)).toHaveLength(1);
    for (const s of states) expect(s.immissionPoints.map((r) => r.code)).toEqual(['E1', 'E2', 'E3', 'E4', 'E5', 'E6']);
    expect(geissalp.usages.length).toBeGreaterThan(60);
    expect(dataset.holidays?.length).toBeGreaterThan(3);
  });

  it('rolls every usage date to the seed year', () => {
    const raw = loadRawDatasets()[DEFAULT_DATASET_KEY].areas[0];
    expect(raw.usages.every((u) => u.date.startsWith('{{year'))).toBe(true);
    const years = new Set(geissalp.usages.map((u) => u.date.slice(0, 4)));
    expect([...years].sort()).toEqual(['2025', '2026']);
  });

  it('references only rooms, combinations, plant parts, sources and points it defines (B1 Kap. 10)', () => {
    const combinations = new Map(dataset.masterData.combinations.map((c) => [c.key, c]));
    const weapons = new Map(dataset.masterData.weapons.map((w) => [w.key, w]));
    for (const area of dataset.areas) {
      const rooms = new Set(area.rooms.map((r) => r.name));
      const allowed = new Set(area.roomCombinations.map((rc) => `${rc.room}|${rc.combination}`));
      for (const rc of area.roomCombinations) {
        expect(rooms.has(rc.room), `${area.name}: assignment room ${rc.room}`).toBe(true);
        expect(combinations.has(rc.combination), `${area.name}: assignment combination ${rc.combination}`).toBe(true);
      }
      for (const u of area.usages) {
        expect(rooms.has(u.room), `${area.name}: usage room ${u.room}`).toBe(true);
        expect(u.positions.length).toBeGreaterThan(0);
        for (const p of u.positions) {
          // The position's combination must be allowed for the usage's room (5.17).
          expect(allowed.has(`${u.room}|${p.combination}`), `${area.name}: ${u.room} × ${p.combination}`).toBe(true);
          expect(p.quantity).toBeGreaterThan(0);
          const weapon = weapons.get(combinations.get(p.combination)?.weapon as string);
          if (u.usageType === 'civil' || u.usageType === 'sat') expect(weapon?.annex7Category).not.toBeNull();
        }
        expect(parseMinutes(u.to)).toBeGreaterThan(parseMinutes(u.from));
        expect(() => weekday(u.date)).not.toThrow();
        if (u.usageType === 'civil') expect(u.civilUsageKind).toBeTruthy();
        // Usages reference no state and no source (slm 44).
        expect(Object.keys(u)).not.toContain('source');
      }
      for (const c of area.calculations) {
        for (const s of c.states) {
          const parts = new Set(s.plantParts.map((p) => p.coordinationSectionNo));
          const sources = new Set(s.sources.map((x) => x.sourceId));
          const points = new Set(s.immissionPoints.map((p) => p.sonarmsId));
          expect(sources.size, `${s.name}: duplicate sourceId`).toBe(s.sources.length);
          for (const p of s.plantParts) expect(rooms.has(p.room), `${s.name}: plant part room ${p.room}`).toBe(true);
          for (const src of s.sources) {
            expect(parts.has(src.plantPart), `${s.name}: source plant part ${src.plantPart}`).toBe(true);
            expect(dataset.masterData.combinations.some((k) => k.sonarmsId === src.weaponSystem), `${s.name}: weapon system ${src.weaponSystem}`).toBe(true);
          }
          for (const row of s.wlr) {
            expect(points.has(row.point), `${s.name}: point ${row.point}`).toBe(true);
            expect(sources.has(row.source), `${s.name}: source ${row.source}`).toBe(true);
          }
          // Day and evening rows per assessed point × source, reserve points excepted.
          const assessed = s.immissionPoints.filter((r) => r.type !== 'reserve').length;
          expect(s.wlr).toHaveLength(2 * assessed * s.sources.length);
        }
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
    expect(first).toMatchObject({ year: 2026, areas: 9, receivers: 12, calculations: 2, sources: 17 + 18 });
    expect(first.wlr).toBe(2 * 5 * 17 + 2 * 5 * 18);
    expect(first.usages).toBeGreaterThan(60);

    const second = await seedDemoDataset(dataSource, mockTenantId, { now: NOW });
    expect(second.skipped).toBe(true);

    expect(await dataSource.getRepository(AreaEntity).count({ where: { tenantId: mockTenantId } })).toBe(9);
    expect(await dataSource.getRepository(AreaWlrEntity).count({ where: { tenantId: mockTenantId } })).toBe(350);
    const marker = await dataSource.getRepository(DemoSeedMarkerEntity).findOneByOrFail({ tenantId: mockTenantId });
    expect(marker).toMatchObject({ datasetKey: DEFAULT_DATASET_KEY, version: 6, year: 2026 });
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
