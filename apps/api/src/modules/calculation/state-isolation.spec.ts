import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { mockTenantId, testDbSeedBeforeEach, testDbSetup } from '@api-slim/tests';
import { AreaModule } from '../area/area.module';
import { AreaService } from '../area/area.service';
import { AreaRoomEntity, WeaponCombinationEntity } from '../area/entities';
import { UsageModule } from '../usage/usage.module';
import { UsagePositionEntity } from '../usage/entities';
import { UsageService } from '../usage/usage.service';
import { DemoSeedMarkerEntity } from '../../mocks/tenant/demo-seed-marker.entity';
import { seedDemoDataset } from '../../mocks/tenant/demo-dataset.seed';
import { AssessmentService } from './assessment.service';
import { CalculationRunService } from './calculation-run.service';
import { CalculationModule } from './calculation.module';
import { CalculationService } from './calculation.service';
import { ReceiverAssessmentDto, StateImportDto } from './dto';
import { CalculationRunEntity, AreaCalculationEntity, AreaWlrEntity, ImmissionPointEntity, PlantPartEntity, SourceLineEntity } from './entities';
import { ImportAbortedException, ImportService } from './import.service';

const NOW = new Date(2026, 11, 31);
const PERIOD = { from: '2026-01-01', to: '2026-12-31', now: NOW };

function row(receiver: ReceiverAssessmentDto, annex: 9 | 7, kind: 'igw' | 'pw') {
  return receiver.rows.find((r) => r.annex === annex && r.limitKind === kind) as ReceiverAssessmentDto['rows'][number];
}

/**
 * B1 Kap. 10, slm 42–45: the decisive proof of the separation between the
 * permanent reference structure, the usages and the calculation states.
 * Two states of the same Schiessplatz share every external id (QuellenID,
 * sonARMS_ID, Koord_Nr) but carry different geometries and levels; both are
 * computed and stored as runs; then the newer state is changed — the older
 * state, its assessment and its stored run must not move by a single digit.
 */
describe('State isolation (B1 Kap. 10, slm 42–45)', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let importer: ImportService;
  let assessment: AssessmentService;
  let runs: CalculationRunService;
  let calculations: CalculationService;
  let geissalpId: string;
  let thunId: string;
  let stateA: string;
  let stateB: string;

  /** A small delivery: two Anlageteile, three Schusslinien (one combination split 70/30), two points, day + eve WLR. */
  function delivery(name: string, externalId: string, variant: 'A' | 'B'): StateImportDto {
    const shift = variant === 'A' ? 0 : 3; // state B is 3 dB louder everywhere and its point E1 sits elsewhere
    const wlr = (point: string, source: string, base: number) => [
      { point, source, timeGroup: 'day' as const, lae: base + shift, lafmax: base + 9 + shift },
      { point, source, timeGroup: 'eve' as const, lae: base + 0.2 + shift, lafmax: base + 9.2 + shift },
    ];
    return {
      calculation: { name: 'Isolationstest', supplier: 'Test', deliveredAt: '2026-09-12' },
      state: { externalId, name, referenceYear: variant === 'A' ? 2024 : 2026, isCurrent: variant === 'A', isMgdm: variant === 'A' },
      propagation: { model: 'sonX', modelVersion: `Kernel ${variant}` },
      perimeter: { name: 'Geissalp', spmNo: '02218', coordinationSectionNo: '1104.020', geometry: variant === 'A' ? 'POLYGON((0 0,1 0,1 1,0 0))' : 'POLYGON((0 0,2 0,2 2,0 0))' },
      plantParts: [
        { coordinationSectionNo: '1104.020.05', name: 'Stellungsrm Mw Neuhaus, B 3', type: 'Bogenschuss-Schiessanlage', builtAfter1985: true, geometry: variant === 'A' ? 'POLYGON((10 10,11 10,11 11,10 10))' : 'POLYGON((10 10,12 10,12 12,10 10))' },
        { coordinationSectionNo: '1104.020.07', name: 'Stellungsrm B 2', type: 'Schiessanlage (300m)', builtAfter1985: false },
      ],
      sources: [
        { sourceId: 'B3_Stgw90_m_1104.020_1', plantPartNo: '1104.020.05', weaponSystem: 'Stgw90', a9: { shotsInside: 7000, shotsOutside: 700 }, a7: null },
        { sourceId: 'B3_Stgw90_m_1104.020_2', plantPartNo: '1104.020.05', weaponSystem: 'Stgw90', a9: { shotsInside: 3000, shotsOutside: 300 }, a7: null },
        { sourceId: 'B2_Stgw90_z_1104.020_1', plantPartNo: '1104.020.07', weaponSystem: 'Stgw90', a9: { shotsInside: 5000, shotsOutside: 500 }, a7: { halfDaysWork: 27, halfDaysSunday: 1, shotsWork: 9000, shotsSunday: 500 } },
      ],
      buildings: [{ egid: '2314077', address: 'Laberhusstrasse 4', persons: 4 }],
      immissionPoints: [
        { sonarmsId: 'E1', code: 'E1', egid: '2314077', address: 'Laberhusstrasse 4', sensitivityLevel: 'II', east: variant === 'A' ? 2618180 : 2618200, north: 1176916, height: 4, mapX: 37.5, mapY: 49 },
        { sonarmsId: 'E2', code: 'E2', egid: null, address: 'Lattigenweg 12', sensitivityLevel: 'III', east: 2618836, north: 1176894, height: 4, mapX: 71.7, mapY: 50.4 },
      ],
      wlr: [
        ...wlr('E1', 'B3_Stgw90_m_1104.020_1', 70),
        ...wlr('E1', 'B3_Stgw90_m_1104.020_2', 68),
        ...wlr('E1', 'B2_Stgw90_z_1104.020_1', 66),
        ...wlr('E2', 'B3_Stgw90_m_1104.020_1', 64),
        ...wlr('E2', 'B3_Stgw90_m_1104.020_2', 63),
        ...wlr('E2', 'B2_Stgw90_z_1104.020_1', 67),
      ],
      obstacles: [{ coordinationSectionNo: '1104.020.05', measureType: 'Lärmschutzwand', surfaceType: 'hoch absorbierend', geometry: 'LINESTRING Z (0 0 500, 1 1 505)' }],
      measuresOperational: [{ coordinationSectionNo: '1104.020.07', measureType: 'Reduktion Schusszahlen' }],
    };
  }

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: testDbSetup(
        [AreaModule, UsageModule, CalculationModule],
        [...AreaModule.DBOptions.entities, ...UsageModule.DBOptions.entities, ...CalculationModule.DBOptions.entities, DemoSeedMarkerEntity] as never[],
      ),
    }).compile();
    dataSource = module.get(DataSource);
    importer = module.get(ImportService);
    assessment = module.get(AssessmentService);
    runs = module.get(CalculationRunService);
    calculations = module.get(CalculationService);
    await testDbSeedBeforeEach(dataSource);
    await seedDemoDataset(dataSource, mockTenantId, { now: NOW });
    const areas = await module.get(AreaService).list(mockTenantId);
    geissalpId = areas.find((a) => a.name === 'Geissalp')?.id as string;
    thunId = areas.find((a) => a.name === 'Thun')?.id as string;
  });

  afterAll(async () => {
    await module.close();
  });

  it('rejects an explicit A7 category conflicting with the weapon master data', async () => {
    const input = delivery('Invalid A7', '02218_98', 'A');
    const civil = input.sources.find(s => s.a7);
    if (!civil?.a7) throw new Error('Missing fixture');
    civil.a7.category = 'b';
    const before = await dataSource.getRepository(AreaCalculationEntity).count();
    await expect(importer.importState(mockTenantId, geissalpId, input)).rejects.toThrow(/Import abgebrochen/);
    expect(await dataSource.getRepository(AreaCalculationEntity).count()).toBe(before);
  });

  it('stores the exact inputs used even if a usage changes before the run is persisted', async () => {
    const repo = dataSource.getRepository(UsagePositionEntity);
    const victim = await repo.findOneByOrFail({ tenantId: mockTenantId, areaId: geissalpId });
    const original = assessment.assess.bind(assessment);
    const spy = vi.spyOn(assessment, 'assess').mockImplementationOnce(async (...args) => {
      const result = await original(...args);
      await repo.update({ id: victim.id }, { quantity: Number(victim.quantity) + 100 });
      return result;
    });
    try {
      const run = await runs.run(mockTenantId, geissalpId, PERIOD, 'concurrency-test');
      const stored = await dataSource.getRepository(CalculationRunEntity).findOneByOrFail({ id: run.id });
      const snapshot = JSON.parse(stored.usageSnapshot) as { positions: { id: string; quantity: number }[] }[];
      expect(snapshot.flatMap(u => u.positions).find(p => p.id === victim.id)?.quantity).toBe(Number(victim.quantity));
      expect(Number((await repo.findOneByOrFail({ id: victim.id })).quantity)).toBe(Number(victim.quantity) + 100);
      expect(JSON.parse(stored.referenceSnapshot).state.wlr.length).toBeGreaterThan(0);
    } finally {
      spy.mockRestore();
      await repo.update({ id: victim.id }, { quantity: victim.quantity });
    }
  });

  it('imports two states with the same external ids but different properties, both independent (slm 43)', async () => {
    const a = await importer.importState(mockTenantId, geissalpId, delivery('Iso A', '02218_9', 'A'));
    const b = await importer.importState(mockTenantId, geissalpId, delivery('Iso B', '02218_10', 'B'));
    stateA = a.stateId;
    stateB = b.stateId;
    expect(a.calculationId).toBe(b.calculationId); // same delivery, two states
    expect(a.counts).toMatchObject({ plantParts: 2, sources: 3, buildings: 1, immissionPoints: 2, wlr: 12, otherObjects: 2 });
    expect(a.warnings).toEqual([]);

    const points = dataSource.getRepository(ImmissionPointEntity);
    const e1A = await points.findOneByOrFail({ tenantId: mockTenantId, zustandId: stateA, sonarmsId: 'E1' });
    const e1B = await points.findOneByOrFail({ tenantId: mockTenantId, zustandId: stateB, sonarmsId: 'E1' });
    expect(e1A.id).not.toBe(e1B.id);
    expect(e1A.east).toBe(2618180);
    expect(e1B.east).toBe(2618200);
    const parts = dataSource.getRepository(PlantPartEntity);
    const partA = await parts.findOneByOrFail({ tenantId: mockTenantId, zustandId: stateA, coordinationSectionNo: '1104.020.05' });
    const partB = await parts.findOneByOrFail({ tenantId: mockTenantId, zustandId: stateB, coordinationSectionNo: '1104.020.05' });
    expect(partA.geometry).not.toBe(partB.geometry);
    // Both map to the same übergeordneter Stellungsraum (slm 45).
    expect(partA.roomId).toBe(partB.roomId);
    const room = await dataSource.getRepository(AreaRoomEntity).findOneByOrFail({ tenantId: mockTenantId, id: partA.roomId });
    expect(room.name).toBe('Stellungsrm Mw Neuhaus, B 3');
  });

  it('computes both states from the same usages and stores reproducible runs (slm 44)', async () => {
    const resA = await assessment.assess(mockTenantId, geissalpId, { ...PERIOD, calculationId: stateA });
    const resB = await assessment.assess(mockTenantId, geissalpId, { ...PERIOD, calculationId: stateB });
    const e1A = resA.receivers.find((r) => r.code === 'E1') as ReceiverAssessmentDto;
    const e1B = resB.receivers.find((r) => r.code === 'E1') as ReceiverAssessmentDto;
    expect(row(e1A, 9, 'igw').level).not.toBeNull();
    // State B is 3 dB louder with the same usages.
    expect((row(e1B, 9, 'igw').level as number) - (row(e1A, 9, 'igw').level as number)).toBeCloseTo(3, 1);
    // The 70/30 split of B 3 × Stgw 90 is visible in the operating data of both states.
    const split = resA.operatingData.find((r) => r.sources.length === 2);
    expect(split?.sources.sort()).toEqual(['B3_Stgw90_m_1104.020_1', 'B3_Stgw90_m_1104.020_2']);
    // Shots of combinations this small state does not know are reported (O8), never dropped.
    expect(e1A.missingSources.length).toBeGreaterThan(0);
    expect(e1A.state).toBe('incomplete');

    const runA = await runs.run(mockTenantId, geissalpId, { ...PERIOD, calculationId: stateA }, 'test');
    expect(runA.completeness).toBe('incomplete');
    expect(runA.usageCount).toBeGreaterThan(60);
    expect(runA.checksum).toHaveLength(64);
    const stored = await runs.get(mockTenantId, geissalpId, runA.id);
    expect(row(stored.results?.receivers.find((r) => r.code === 'E1') as ReceiverAssessmentDto, 9, 'igw').level).toBe(row(e1A, 9, 'igw').level);
  });

  it('changing the newer state leaves the older state, its assessment and its stored run untouched', async () => {
    const before = await assessment.assess(mockTenantId, geissalpId, { ...PERIOD, calculationId: stateA });
    const runBefore = (await runs.list(mockTenantId, geissalpId))[0];
    const snapshotA = JSON.stringify(await dataSource.getRepository(AreaWlrEntity).find({ where: { tenantId: mockTenantId, zustandId: stateA }, order: { id: 'ASC' } }));

    // Mutate state B: louder levels, moved point, a source dropped.
    await dataSource.getRepository(AreaWlrEntity).createQueryBuilder().update().set({ lae: () => 'lae + 10' }).where('tenantId = :t and zustand_id = :z', { t: mockTenantId, z: stateB }).execute();
    await dataSource.getRepository(ImmissionPointEntity).update({ tenantId: mockTenantId, zustandId: stateB, sonarmsId: 'E1' }, { east: 2619000 });
    const dropped = await dataSource.getRepository(SourceLineEntity).findOneByOrFail({ tenantId: mockTenantId, zustandId: stateB, sourceId: 'B3_Stgw90_m_1104.020_2' });
    await dataSource.getRepository(SourceLineEntity).remove(dropped);

    const after = await assessment.assess(mockTenantId, geissalpId, { ...PERIOD, calculationId: stateA });
    expect(after.receivers.map((r) => [r.code, r.east, row(r, 9, 'igw').level, row(r, 7, 'igw').level, r.state]))
      .toEqual(before.receivers.map((r) => [r.code, r.east, row(r, 9, 'igw').level, row(r, 7, 'igw').level, r.state]));
    expect(after.operatingData).toEqual(before.operatingData);
    const snapshotAfter = JSON.stringify(await dataSource.getRepository(AreaWlrEntity).find({ where: { tenantId: mockTenantId, zustandId: stateA }, order: { id: 'ASC' } }));
    expect(snapshotAfter).toBe(snapshotA);
    const runAfter = await runs.get(mockTenantId, geissalpId, runBefore.id);
    expect(runAfter.checksum).toBe(runBefore.checksum);
    expect(JSON.stringify(runAfter.results)).toBe(JSON.stringify((await runs.get(mockTenantId, geissalpId, runBefore.id)).results));

    // State B itself did change.
    const resB = await assessment.assess(mockTenantId, geissalpId, { ...PERIOD, calculationId: stateB });
    expect(resB.receivers.find((r) => r.code === 'E1')?.east).toBe(2619000);
    expect(resB.calculation?.sourceCount).toBe(2);
  });

  it('a usage edited after a run does not change what the run reported', async () => {
    const usages = module.get(UsageService);
    const runBefore = (await runs.list(mockTenantId, geissalpId))[0];
    const detail = await runs.get(mockTenantId, geissalpId, runBefore.id);
    const overview = await usages.overview(mockTenantId, geissalpId, 2026);
    const victim = overview.usages.find((u) => u.usageType === 'military' && u.positions.length === 1) as (typeof overview.usages)[number];
    await usages.update(mockTenantId, geissalpId, victim.id, { positions: [{ combinationId: victim.positions[0].combinationId, quantity: victim.positions[0].quantity * 50 }] });
    try {
      const again = await runs.get(mockTenantId, geissalpId, runBefore.id);
      expect(again.checksum).toBe(detail.checksum);
      expect(JSON.stringify(again.results)).toBe(JSON.stringify(detail.results));
      // A fresh assessment does see the change.
      const fresh = await assessment.assess(mockTenantId, geissalpId, { ...PERIOD, calculationId: stateA });
      expect(fresh.operatingData.reduce((s, r) => s + r.inside + r.outside, 0)).toBeGreaterThan(detail.results?.operatingData.reduce((s, r) => s + r.inside + r.outside, 0) as number);
    } finally {
      await usages.update(mockTenantId, geissalpId, victim.id, { positions: [{ combinationId: victim.positions[0].combinationId, quantity: victim.positions[0].quantity }] });
    }
  });

  it('refuses a WLR row that links a source of state A to a point of state B (composite keys)', async () => {
    const sourceA = await dataSource.getRepository(SourceLineEntity).findOneByOrFail({ tenantId: mockTenantId, zustandId: stateA, sourceId: 'B3_Stgw90_m_1104.020_1' });
    const pointB = await dataSource.getRepository(ImmissionPointEntity).findOneByOrFail({ tenantId: mockTenantId, zustandId: stateB, sonarmsId: 'E2' });
    const wlr = dataSource.getRepository(AreaWlrEntity);
    await expect(
      wlr.save(wlr.create({ tenantId: mockTenantId, zustandId: stateA, propagationId: pointB.propagationId, sourceLineId: sourceA.id, immissionPointId: pointB.id, timeGroup: 'day', lae: 1, lafmax: 1, geometry: null })),
    ).rejects.toThrow(/FOREIGN KEY|constraint/i);
  });

  it('refuses an Anlageteil that points at a Stellungsraum of another Schiessplatz', async () => {
    const thunRoom = await dataSource.getRepository(AreaRoomEntity).findOneByOrFail({ tenantId: mockTenantId, areaId: thunId, name: 'Stellungsraum 1' });
    const parts = dataSource.getRepository(PlantPartEntity);
    await expect(
      parts.save(parts.create({ tenantId: mockTenantId, zustandId: stateA, areaId: geissalpId, roomId: thunRoom.id, coordinationSectionNo: 'x', name: 'x', type: '', remark: null, builtAfter1985: false, geometry: null })),
    ).rejects.toThrow(/FOREIGN KEY|constraint/i);
  });

  it('aborts the import with a warning for an unknown Stellungsraum and writes nothing (slm 45)', async () => {
    const dto = delivery('Iso C', '02218_11', 'A');
    dto.state.isCurrent = false;
    dto.state.isMgdm = false;
    dto.plantParts.push({ coordinationSectionNo: '1104.020.99', name: 'Neuer Stand 99', type: '', builtAfter1985: true });
    dto.sources.push({ sourceId: 'X99', plantPartNo: '1104.020.99', weaponSystem: 'Stgw90', a9: { shotsInside: 1, shotsOutside: 0 } });
    const statesBefore = await dataSource.getRepository(AreaCalculationEntity).count({ where: { tenantId: mockTenantId } });
    const partsBefore = await dataSource.getRepository(PlantPartEntity).count({ where: { tenantId: mockTenantId } });
    await expect(importer.importState(mockTenantId, geissalpId, dto)).rejects.toBeInstanceOf(ImportAbortedException);
    try {
      await importer.importState(mockTenantId, geissalpId, dto);
    } catch (e) {
      expect((e as ImportAbortedException).findings.join(' ')).toMatch(/Unbekannter Stellungsraum: Anlageteil 1104\.020\.99/);
    }
    expect(await dataSource.getRepository(AreaCalculationEntity).count({ where: { tenantId: mockTenantId } })).toBe(statesBefore);
    expect(await dataSource.getRepository(PlantPartEntity).count({ where: { tenantId: mockTenantId } })).toBe(partsBefore);
  });

  it('maps an Anlageteil to a historical (inactive) Stellungsraum and warns about an unmatched weapon system', async () => {
    const rooms = dataSource.getRepository(AreaRoomEntity);
    const old = await rooms.findOneByOrFail({ tenantId: mockTenantId, areaId: geissalpId, coordinationSectionNo: '1104.020.13' });
    await rooms.update({ tenantId: mockTenantId, id: old.id }, { enabled: false });
    const dto = delivery('Iso D', '02218_12', 'A');
    dto.state.isCurrent = false;
    dto.state.isMgdm = false;
    dto.plantParts.push({ coordinationSectionNo: '1104.020.13', name: 'NGST Schönenboden D unten', type: '', builtAfter1985: false });
    dto.sources.push({ sourceId: 'D_Unknown_m_1104.020_9', plantPartNo: '1104.020.13', weaponSystem: 'Laser 3000', a9: { shotsInside: 1, shotsOutside: 0 } });
    try {
      const report = await importer.importState(mockTenantId, geissalpId, dto);
      expect(report.counts.plantParts).toBe(3);
      expect(report.warnings.some((w) => w.includes('Laser 3000'))).toBe(true);
      const part = await dataSource.getRepository(PlantPartEntity).findOneByOrFail({ tenantId: mockTenantId, zustandId: report.stateId, coordinationSectionNo: '1104.020.13' });
      expect(part.roomId).toBe(old.id);
    } finally {
      await rooms.update({ tenantId: mockTenantId, id: old.id }, { enabled: true });
    }
  });

  it('keeps exactly one current and one MGDM state per Schiessplatz, enforced by the database', async () => {
    const states = dataSource.getRepository(AreaCalculationEntity);
    const current = await states.find({ where: { tenantId: mockTenantId, areaId: geissalpId, isCurrent: true } });
    expect(current).toHaveLength(1);
    expect(current[0].id).toBe(stateA);
    // Service switch: B becomes current, A loses it.
    await calculations.setPointer(mockTenantId, geissalpId, stateB, 'current');
    expect((await states.find({ where: { tenantId: mockTenantId, areaId: geissalpId, isCurrent: true } })).map((s) => s.id)).toEqual([stateB]);
    // Direct write of a second current marker is refused by the unique index.
    await expect(states.update({ tenantId: mockTenantId, id: stateA }, { isCurrent: true, currentKey: geissalpId })).rejects.toThrow(/UNIQUE|constraint/i);
    // Another Schiessplatz is unaffected (its own marker key).
    expect(await states.count({ where: { tenantId: mockTenantId, areaId: thunId, isCurrent: true } })).toBe(0);
  });

  it('a combination may own several sources in one state and one in another (7.5)', async () => {
    const stgw = await dataSource.getRepository(WeaponCombinationEntity).findOneByOrFail({ tenantId: mockTenantId, sonarmsId: 'Stgw90' });
    const inA = await dataSource.getRepository(SourceLineEntity).count({ where: { tenantId: mockTenantId, zustandId: stateA, combinationId: stgw.id } });
    const inB = await dataSource.getRepository(SourceLineEntity).count({ where: { tenantId: mockTenantId, zustandId: stateB, combinationId: stgw.id } });
    expect(inA).toBe(3);
    expect(inB).toBe(2);
  });
});
