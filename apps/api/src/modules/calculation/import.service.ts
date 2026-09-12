import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  Annex7CategoryCode,
  AreaEntity,
  AreaRoomEntity,
  WeaponCombinationEntity,
} from '../area/entities';
import {
  ImportPlantPartObjectDto,
  ImportReportDto,
  StateImportDto,
} from './dto/import.dto';
import {
  AffectedAnalysisEntity,
  AreaCalculationEntity,
  AreaWlrEntity,
  BuildingEntity,
  BuildYearClassCode,
  HighScreenEntity,
  ImmissionCalculationEntity,
  ImmissionPointEntity,
  IsophoneEntity,
  MeasureAreaEntity,
  MeasureOperationalEntity,
  MeasurePointEntity,
  MeasureSsfEntity,
  ObstacleEntity,
  PlantPartEntity,
  PropagationEntity,
  ShootingHouseEntity,
  SourceDataA7Entity,
  SourceDataA9Entity,
  SourceLineEntity,
  StudyPerimeterEntity,
} from './entities';

/**
 * The import aborts with the findings that make the state unusable (B1
 * 5.19: «mindestens eine Warnung … und der Import abgebrochen»). Nothing is
 * written in that case.
 */
export class ImportAbortedException extends BadRequestException {
  constructor(readonly findings: string[]) {
    super({ message: 'Import abgebrochen', findings });
  }
}

/**
 * Import of a Berechnungszustand (B1 5.19, 9.1, 10.4 / slm 45): stages the
 * whole delivery in memory, resolves every Anlageteil to an übergeordneter
 * Stellungsraum of the same Schiessplatz (by Koordinationsabschnittsnummer,
 * else by name; historical rooms count), every source to a Kombination (by
 * the sonARMS weapon name) and every WLR row to its point and source, checks
 * the consistency, and only then writes the complete state in **one**
 * transaction. An unknown Stellungsraum, a duplicate id or a dangling WLR
 * reference aborts; a source without a matching Kombination is a warning
 * (its shots cannot be attributed later — Fachregel O8 shows that).
 *
 * The import never creates a permanent reference (Stellungsraum,
 * Kombination): those are maintained in the master data process, then the
 * import is repeated. Works on a plain DataSource so the demo seed can use it.
 */
@Injectable()
export class ImportService {
  constructor(private readonly dataSource: DataSource) {}

  async importState(tenantId: string, areaId: string, dto: StateImportDto): Promise<ImportReportDto> {
    const area = await this.dataSource.getRepository(AreaEntity).findOne({ where: { tenantId, id: areaId } });
    if (!area) throw new NotFoundException(`Area ${areaId} not found`);

    // --- staging: permanent references --------------------------------------
    const rooms = await this.dataSource.getRepository(AreaRoomEntity).find({ where: { tenantId, areaId } });
    const roomByNo = new Map<string, AreaRoomEntity>();
    const roomByName = new Map<string, AreaRoomEntity>();
    for (const room of rooms) {
      if (room.coordinationSectionNo) roomByNo.set(room.coordinationSectionNo, room);
      roomByName.set(room.name, room);
    }
    const combinations = await this.dataSource.getRepository(WeaponCombinationEntity).find({ where: { tenantId }, relations: { weapon: true } });
    const combinationBySonarms = new Map<string, WeaponCombinationEntity>();
    for (const c of combinations) if (c.sonarmsId) combinationBySonarms.set(c.sonarmsId, c);

    const findings: string[] = [];
    const warnings: string[] = [];

    // --- plant parts → rooms (slm 45) ---------------------------------------
    const partRoom = new Map<string, AreaRoomEntity>();
    for (const part of dto.plantParts) {
      if (partRoom.has(part.coordinationSectionNo)) {
        findings.push(`Anlageteil ${part.coordinationSectionNo} ist doppelt`);
        continue;
      }
      const room = roomByNo.get(part.coordinationSectionNo) ?? (part.roomName ? roomByName.get(part.roomName) : undefined);
      if (!room) {
        findings.push(`Unbekannter Stellungsraum: Anlageteil ${part.coordinationSectionNo} «${part.name}» hat keinen übergeordneten Stellungsraum auf ${area.coordinationSectionNo} ${area.name}`);
        continue;
      }
      partRoom.set(part.coordinationSectionNo, room);
    }

    // --- sources → plant parts and combinations -----------------------------
    const sourceIds = new Set<string>();
    const sourceCombination = new Map<string, WeaponCombinationEntity | null>();
    for (const source of dto.sources) {
      if (sourceIds.has(source.sourceId)) findings.push(`QuellenID ${source.sourceId} ist doppelt`);
      sourceIds.add(source.sourceId);
      if (!partRoom.has(source.plantPartNo) && !dto.plantParts.some((p) => p.coordinationSectionNo === source.plantPartNo)) {
        findings.push(`Quelle ${source.sourceId}: Anlageteil ${source.plantPartNo} ist nicht in der Lieferung`);
      }
      const combination = combinationBySonarms.get(source.weaponSystem) ?? null;
      if (!combination) warnings.push(`Quelle ${source.sourceId}: Waffensystem «${source.weaponSystem}» ist keiner Kombination Waffe/Kaliber zugeordnet (sonARMS-ID fehlt in den Stammdaten)`);
      sourceCombination.set(source.sourceId, combination);
    }

    // --- points, buildings, WLR -----------------------------------------------
    const pointIds = new Set<string>();
    for (const point of dto.immissionPoints) {
      if (pointIds.has(point.sonarmsId)) findings.push(`Immissionspunkt ${point.sonarmsId} ist doppelt`);
      pointIds.add(point.sonarmsId);
    }
    const wlrKeys = new Set<string>();
    for (const row of dto.wlr) {
      if (!pointIds.has(row.point)) findings.push(`WLR: Empfänger ${row.point} ist kein Immissionspunkt der Lieferung`);
      if (!sourceIds.has(row.source)) findings.push(`WLR: Quelle ${row.source} ist keine Schusslinie der Lieferung`);
      const key = `${row.point}|${row.source}|${row.timeGroup}`;
      if (wlrKeys.has(key)) findings.push(`WLR: ${row.point} × ${row.source} (${row.timeGroup}) ist doppelt`);
      wlrKeys.add(key);
    }
    for (const point of dto.immissionPoints) {
      for (const source of dto.sources) {
        if (!wlrKeys.has(`${point.sonarmsId}|${source.sourceId}|day`)) {
          warnings.push(`WLR: kein Tag-Pegel für ${point.sonarmsId} × ${source.sourceId} – Schüsse dieser Quelle sind an diesem Punkt nicht beurteilbar`);
        }
      }
    }

    // --- state identity ------------------------------------------------------
    const states = this.dataSource.getRepository(AreaCalculationEntity);
    if (await states.findOne({ where: { tenantId, areaId, name: dto.state.name } })) {
      findings.push(`Zustand «${dto.state.name}» existiert bereits auf diesem Schiessplatz`);
    }

    if (findings.length) throw new ImportAbortedException(findings);

    // --- write everything in one transaction ---------------------------------
    return this.dataSource.transaction(async (em) => {
      const calcRepo = em.getRepository(ImmissionCalculationEntity);
      let calculation = await calcRepo.findOne({ where: { tenantId, areaId, name: dto.calculation.name } });
      if (!calculation) {
        calculation = await calcRepo.save(
          calcRepo.create({
            tenantId,
            areaId,
            name: dto.calculation.name,
            supplier: dto.calculation.supplier ?? '',
            deliveredAt: dto.calculation.deliveredAt,
            fgdbStateMpv: dto.calculation.fgdbStateMpv ?? null,
            fgdbStateIst: dto.calculation.fgdbStateIst ?? null,
            mpvMeasures: dto.calculation.mpvMeasures ?? null,
            istObstacles: dto.calculation.istObstacles ?? null,
            istHighScreens: dto.calculation.istHighScreens ?? null,
            immissionPointCount: dto.calculation.immissionPointCount ?? null,
            civilUse: dto.calculation.civilUse ?? null,
            shootingHousePresent: dto.calculation.shootingHousePresent ?? null,
            enabled: true,
          }),
        );
      } else if (dto.state.externalId) {
        const clash = await em.getRepository(AreaCalculationEntity).findOne({
          where: { tenantId, calculationId: calculation.id, externalId: dto.state.externalId },
        });
        if (clash) throw new ImportAbortedException([`ZustandID ${dto.state.externalId} existiert in dieser Immissionsberechnung bereits`]);
      }

      const stateRepo = em.getRepository(AreaCalculationEntity);
      const isCurrent = Boolean(dto.state.isCurrent);
      const isMgdm = Boolean(dto.state.isMgdm);
      // Exactly one current / MGDM state per area: clear the others first (same transaction).
      if (isCurrent) await stateRepo.update({ tenantId, areaId }, { isCurrent: false, currentKey: null });
      if (isMgdm) await stateRepo.update({ tenantId, areaId }, { isMgdm: false, mgdmKey: null });

      const state = await stateRepo.save(
        stateRepo.create({
          tenantId,
          areaId,
          calculationId: calculation.id,
          externalId: dto.state.externalId ?? null,
          name: dto.state.name,
          referenceYear: dto.state.referenceYear,
          buildYearClass: buildYearClassOf(dto.plantParts.map((p) => p.builtAfter1985)),
          isCurrent,
          isMgdm,
          currentKey: isCurrent ? areaId : null,
          mgdmKey: isMgdm ? areaId : null,
          enabled: true,
        }),
      );

      const propagation = await em.getRepository(PropagationEntity).save(
        em.getRepository(PropagationEntity).create({
          tenantId,
          zustandId: state.id,
          geometry: null,
          model: dto.propagation?.model ?? '',
          modelVersion: dto.propagation?.modelVersion ?? '',
          heightModel: dto.propagation?.heightModel ?? null,
          buildingDataset: dto.propagation?.buildingDataset ?? null,
          meteoIncluded: dto.propagation?.meteoIncluded ?? false,
          meteoCount: dto.propagation?.meteoCount ?? null,
          meteoData: dto.propagation?.meteoData ?? null,
          reflectionIncluded: dto.propagation?.reflectionIncluded ?? false,
          forestIncluded: dto.propagation?.forestIncluded ?? false,
          primarySurfaces: dto.propagation?.primarySurfaces ?? '',
          remark: dto.propagation?.remark ?? null,
        }),
      );

      if (dto.perimeter) {
        await em.getRepository(StudyPerimeterEntity).save(
          em.getRepository(StudyPerimeterEntity).create({
            tenantId,
            zustandId: state.id,
            geometry: dto.perimeter.geometry ?? null,
            name: dto.perimeter.name,
            spmNo: dto.perimeter.spmNo ?? '',
            coordinationSectionNo: dto.perimeter.coordinationSectionNo ?? area.coordinationSectionNo,
          }),
        );
      }

      const partRepo = em.getRepository(PlantPartEntity);
      const parts = await partRepo.save(
        dto.plantParts.map((part) =>
          partRepo.create({
            tenantId,
            zustandId: state.id,
            areaId,
            roomId: (partRoom.get(part.coordinationSectionNo) as AreaRoomEntity).id,
            coordinationSectionNo: part.coordinationSectionNo,
            name: part.name,
            type: part.type ?? '',
            remark: part.remark ?? null,
            builtAfter1985: part.builtAfter1985,
            geometry: part.geometry ?? null,
          }),
        ),
      );
      const partByNo = new Map(parts.map((p) => [p.coordinationSectionNo, p]));

      const sourceRepo = em.getRepository(SourceLineEntity);
      const sources = await sourceRepo.save(
        dto.sources.map((s) =>
          sourceRepo.create({
            tenantId,
            zustandId: state.id,
            plantPartId: (partByNo.get(s.plantPartNo) as PlantPartEntity).id,
            combinationId: sourceCombination.get(s.sourceId)?.id ?? null,
            sourceId: s.sourceId,
            weaponSystem: s.weaponSystem,
            remarkGeom: s.remarkGeom ?? null,
            geometry: s.geometry ?? null,
          }),
        ),
      );
      const sourceByExt = new Map(sources.map((s) => [s.sourceId, s]));
      const a9Repo = em.getRepository(SourceDataA9Entity);
      const a7Repo = em.getRepository(SourceDataA7Entity);
      for (const s of dto.sources) {
        const line = sourceByExt.get(s.sourceId) as SourceLineEntity;
        if (s.a9) {
          await a9Repo.save(
            a9Repo.create({
              tenantId,
              zustandId: state.id,
              geometry: null,
              sourceLineId: line.id,
              shotsInside: s.a9.shotsInside,
              shotsOutside: s.a9.shotsOutside,
              estimated: s.a9.estimated ?? false,
              year: s.a9.year ?? null,
              remark: s.a9.remark ?? null,
              planCategory: s.a9.planCategory ?? '',
            }),
          );
        }
        if (s.a7) {
          const category = sourceCombination.get(s.sourceId)?.weapon?.annex7Category ?? annex7CategoryOf(s.weaponSystem);
          if (!category) {
            warnings.push(`Quelle ${s.sourceId}: zivile Quelldaten ohne Waffenkategorie nach Anhang 7 (D2 «${s.weaponSystem}») – für Anhang 7 nicht verwendbar`);
          }
          await a7Repo.save(
            a7Repo.create({
              tenantId,
              zustandId: state.id,
              geometry: null,
              sourceLineId: line.id,
              category: category ?? 'a',
              halfDaysWork: s.a7.halfDaysWork,
              halfDaysSunday: s.a7.halfDaysSunday,
              shotsWork: s.a7.shotsWork,
              shotsSunday: s.a7.shotsSunday ?? null,
              estimated: s.a7.estimated ?? false,
              year: s.a7.year ?? null,
              remark: s.a7.remark ?? null,
              planCategory: s.a7.planCategory ?? '',
            }),
          );
        }
      }

      const buildingRepo = em.getRepository(BuildingEntity);
      const buildingByEgid = new Map<string, BuildingEntity>();
      let buildingCount = 0;
      for (const b of dto.buildings ?? []) {
        const saved = await buildingRepo.save(
          buildingRepo.create({
            tenantId,
            zustandId: state.id,
            propagationId: propagation.id,
            egid: b.egid ?? null,
            address: b.address ?? null,
            surfaceType: b.surfaceType ?? '',
            assessment: b.assessment ?? '',
            persons: b.persons ?? 0,
            remark: b.remark ?? null,
            geometry: b.geometry ?? null,
          }),
        );
        buildingCount++;
        if (saved.egid) buildingByEgid.set(saved.egid, saved);
      }

      const pointRepo = em.getRepository(ImmissionPointEntity);
      const points = await pointRepo.save(
        dto.immissionPoints.map((p, i) =>
          pointRepo.create({
            tenantId,
            zustandId: state.id,
            propagationId: propagation.id,
            buildingId: p.egid ? (buildingByEgid.get(p.egid)?.id ?? null) : null,
            sonarmsId: p.sonarmsId,
            code: p.code ?? p.sonarmsId,
            egid: p.egid ?? null,
            egrid: p.egrid ?? null,
            address: p.address ?? '',
            municipality: p.municipality ?? null,
            pointNo: p.pointNo ?? null,
            deliveredLr: p.deliveredLr ?? null,
            operation: p.operation ?? '',
            type: p.type ?? 'facade',
            deliveredAssessment: p.deliveredAssessment ?? '',
            remark: p.remark ?? null,
            sensitivityLevel: p.sensitivityLevel,
            east: p.east ?? null,
            north: p.north ?? null,
            height: p.height ?? null,
            mapX: p.mapX ?? 50,
            mapY: p.mapY ?? 50,
            sortOrder: p.sortOrder ?? i,
            geometry: p.geometry ?? null,
          }),
        ),
      );
      const pointByExt = new Map(points.map((p) => [p.sonarmsId, p]));

      const wlrRepo = em.getRepository(AreaWlrEntity);
      const wlrRows = dto.wlr.map((row) =>
        wlrRepo.create({
          tenantId,
          zustandId: state.id,
          propagationId: propagation.id,
          sourceLineId: (sourceByExt.get(row.source) as SourceLineEntity).id,
          immissionPointId: (pointByExt.get(row.point) as ImmissionPointEntity).id,
          timeGroup: row.timeGroup,
          lae: row.lae,
          lafmax: row.lafmax,
          laeMk: row.laeMk ?? null,
          laeGk: row.laeGk ?? null,
          laeDet: row.laeDet ?? null,
          elevation: row.elevation ?? null,
          geometry: null,
        }),
      );
      // Chunked: SQLite limits the variables of one INSERT.
      for (let i = 0; i < wlrRows.length; i += 200) await wlrRepo.save(wlrRows.slice(i, i + 200));

      let otherObjects = 0;
      otherObjects += await this.writePlantPartObjects(em, ObstacleEntity, tenantId, state.id, dto.obstacles, partByNo, warnings, (o) => ({
        surfaceType: o.surfaceType ?? '',
        obstacleType: o.measureType ?? '',
        remark: o.remark ?? null,
      }));
      otherObjects += await this.writePlantPartObjects(em, HighScreenEntity, tenantId, state.id, dto.highScreens, partByNo, warnings, (o) => ({
        bottomHeight: o.bottomHeight ?? 0,
        surfaceType: o.surfaceType ?? '',
        remark: o.remark ?? null,
      }));
      otherObjects += await this.writePlantPartObjects(em, ShootingHouseEntity, tenantId, state.id, dto.shootingHouses, partByNo, warnings, (o) => ({
        houseHeight: num(o.attributes?.['houseHeight']),
        houseDepth: num(o.attributes?.['houseDepth']),
        ridgeDistance: num(o.attributes?.['ridgeDistance']),
        ridgeHeight: num(o.attributes?.['ridgeHeight']),
        leftScreenLength: num(o.attributes?.['leftScreenLength']),
        leftScreenHeight: num(o.attributes?.['leftScreenHeight']),
        rightScreenLength: num(o.attributes?.['rightScreenLength']),
        rightScreenHeight: num(o.attributes?.['rightScreenHeight']),
        houseMaterial: str(o.attributes?.['houseMaterial']),
        leftScreenMaterial: str(o.attributes?.['leftScreenMaterial']),
        rightScreenMaterial: str(o.attributes?.['rightScreenMaterial']),
        remark: o.remark ?? null,
      }));
      otherObjects += await this.writePlantPartObjects(em, MeasurePointEntity, tenantId, state.id, dto.measuresPoint, partByNo, warnings, (o) => ({
        remark: o.remark ?? '',
        measureType: o.measureType ?? '',
      }));
      otherObjects += await this.writePlantPartObjects(em, MeasureAreaEntity, tenantId, state.id, dto.measuresArea, partByNo, warnings, (o) => ({
        remark: o.remark ?? '',
        width: numOrNull(o.attributes?.['width']),
        length: numOrNull(o.attributes?.['length']),
        height: numOrNull(o.attributes?.['height']),
        spacingAcross: numOrNull(o.attributes?.['spacingAcross']),
        spacingAlong: numOrNull(o.attributes?.['spacingAlong']),
        depth: numOrNull(o.attributes?.['depth']),
        measureType: o.measureType ?? '',
      }));
      otherObjects += await this.writePlantPartObjects(em, MeasureOperationalEntity, tenantId, state.id, dto.measuresOperational, partByNo, warnings, (o) => ({
        measureType: o.measureType ?? '',
      }));

      const ssfRepo = em.getRepository(MeasureSsfEntity);
      for (const m of dto.measuresSsf ?? []) {
        await ssfRepo.save(
          ssfRepo.create({
            tenantId,
            zustandId: state.id,
            geometry: null,
            buildingId: m.egid ? (buildingByEgid.get(m.egid)?.id ?? null) : null,
            egid: m.egid ?? null,
            coordinationSectionNo: m.coordinationSectionNo ?? '',
            measureType: m.measureType ?? '',
          }),
        );
        otherObjects++;
      }
      const isoRepo = em.getRepository(IsophoneEntity);
      for (const iso of dto.isophones ?? []) {
        await isoRepo.save(
          isoRepo.create({
            tenantId,
            zustandId: state.id,
            propagationId: propagation.id,
            geometry: iso.geometry ?? null,
            lr: iso.lr,
            height: iso.height ?? 4,
            resolution: iso.resolution ?? null,
            remark: iso.remark ?? null,
          }),
        );
        otherObjects++;
      }
      if (dto.affectedAnalysis) {
        const repo = em.getRepository(AffectedAnalysisEntity);
        await repo.save(
          repo.create({
            tenantId,
            zustandId: state.id,
            propagationId: propagation.id,
            geometry: null,
            personsPwIgw: dto.affectedAnalysis.personsPwIgw,
            personsIgwAw: dto.affectedAnalysis.personsIgwAw,
            personsAw: dto.affectedAnalysis.personsAw,
            year: dto.affectedAnalysis.year,
            remark: dto.affectedAnalysis.remark ?? null,
            spmNo: dto.affectedAnalysis.spmNo ?? '',
            persons55: dto.affectedAnalysis.persons55 ?? 0,
            persons60: dto.affectedAnalysis.persons60 ?? 0,
          }),
        );
        otherObjects++;
      }

      return {
        calculationId: calculation.id,
        stateId: state.id,
        warnings,
        counts: {
          plantParts: parts.length,
          sources: sources.length,
          buildings: buildingCount,
          immissionPoints: points.length,
          wlr: wlrRows.length,
          otherObjects,
        },
      };
    });
  }

  private async writePlantPartObjects<T extends { plantPartId: string | null; coordinationSectionNo: string }>(
    em: EntityManager,
    entity: new () => T,
    tenantId: string,
    zustandId: string,
    objects: ImportPlantPartObjectDto[] | undefined,
    partByNo: Map<string, PlantPartEntity>,
    warnings: string[],
    fields: (o: ImportPlantPartObjectDto) => Partial<T>,
  ): Promise<number> {
    if (!objects?.length) return 0;
    const repo = em.getRepository(entity);
    for (const o of objects) {
      const no = o.coordinationSectionNo ?? '';
      const part = partByNo.get(no) ?? null;
      if (no && !part) warnings.push(`${entity.name.replace('Entity', '')}: Anlageteil ${no} ist nicht in der Lieferung`);
      await repo.save(
        repo.create({
          tenantId,
          zustandId,
          geometry: o.geometry ?? null,
          plantPartId: part?.id ?? null,
          coordinationSectionNo: no,
          ...fields(o),
        } as never),
      );
    }
    return objects.length;
  }
}

/**
 * D2 «Waffensystem zivil (gemäss Anhang 7)» codelist → category a–f
 * (B1.2 11.4.18): the civil weapon system of the FGDB *is* the LSV category.
 */
export function annex7CategoryOf(weaponSystem: string): Annex7CategoryCode | null {
  const s = weaponSystem.toLowerCase();
  if (/^[a-f]$/.test(s)) return s as Annex7CategoryCode;
  if (s.startsWith('sturmgewehr')) return 'a';
  if (s.startsWith('faustfeuerwaffen mit zentral')) return 'b';
  if (s.startsWith('faustfeuerwaffen mit rand')) return 'c';
  if (s.startsWith('handfeuerwaffen mit rand')) return 'd';
  if (s.startsWith('jagdgewehr')) return 'e';
  if (s.startsWith('schrotflint')) return 'f';
  return null;
}

/** 5.18: Baujahr over the whole Schiessplatz, derived from the Anlageteile of the state. */
export function buildYearClassOf(builtAfter1985: boolean[]): BuildYearClassCode {
  if (!builtAfter1985.length) return 'mixed';
  if (builtAfter1985.every(Boolean)) return 'after1985';
  if (builtAfter1985.every((b) => !b)) return 'before1985';
  return 'mixed';
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const numOrNull = (v: unknown): number | null => (v == null || v === '' ? null : num(v));
const str = (v: unknown): string | null => (v == null ? null : String(v));
