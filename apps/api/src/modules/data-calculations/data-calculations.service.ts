import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { LogAction, LoggerService } from '../../core/logger';
import { AreaEntity, AreaRoomEntity } from '../area/entities';
import { AreaService } from '../area/area.service';
import { AreaStatusService } from '../calculation/area-status.service';
import { CalculationService } from '../calculation/calculation.service';
import { ImportReportDto, ImportValidationDto, StateImportDto } from '../calculation/dto';
import {
  AreaCalculationEntity,
  AreaWlrEntity,
  CalculationRunEntity,
  ImmissionCalculationEntity,
  ImmissionPointEntity,
  PlantPartEntity,
  SourceDataA7Entity,
  SourceDataA9Entity,
  SourceLineEntity,
  TimeGroup,
} from '../calculation/entities';
import { ImportService } from '../calculation/import.service';
import { AreaUsageEntity } from '../usage/entities';
import { UsageService } from '../usage/usage.service';
import { CalculationFilesService, ShotCsvRow, StateBundle, StateExportModel } from './calculation-files.service';
import {
  CalculationsOverviewDto,
  DeliveryCreateDto,
  DeliveryDto,
  DeliveryUpdateDto,
  OperatingA7RowDto,
  OperatingA9RowDto,
  OperatingDataUploadDto,
  RoomSummaryDto,
  ShotYearsDto,
  StateCreateDto,
  StateDetailsDto,
  StateSummaryDto,
  StateUpdateDto,
  UploadResultDto,
  WlrRowDto,
  WlrUploadDto,
} from './dto';

/**
 * Datenverwaltung › Schiessplatz › Berechnungen (B1 5.18–5.21, `slm 18–21`):
 * the Immissionsberechnungen (deliveries) of a Schiessplatz with their
 * Zustände, the rules around them (exactly one «aktuell» / «MGDM» state,
 * no delete of a delivery that holds one of them or a stored run), the
 * WLR / Betriebsdaten uploads onto a state (5.19), the exports (5.20) and
 * the per-room details (5.21). Every change is written to the logbook and
 * refreshes the cached overview lights where the model changed.
 */
@Injectable()
export class DataCalculationsService {
  constructor(
    @InjectRepository(ImmissionCalculationEntity)
    private readonly deliveries: Repository<ImmissionCalculationEntity>,
    @InjectRepository(AreaCalculationEntity)
    private readonly states: Repository<AreaCalculationEntity>,
    @InjectRepository(PlantPartEntity)
    private readonly plantParts: Repository<PlantPartEntity>,
    @InjectRepository(SourceLineEntity)
    private readonly sources: Repository<SourceLineEntity>,
    @InjectRepository(SourceDataA9Entity)
    private readonly dataA9: Repository<SourceDataA9Entity>,
    @InjectRepository(SourceDataA7Entity)
    private readonly dataA7: Repository<SourceDataA7Entity>,
    @InjectRepository(ImmissionPointEntity)
    private readonly points: Repository<ImmissionPointEntity>,
    @InjectRepository(AreaWlrEntity)
    private readonly wlr: Repository<AreaWlrEntity>,
    @InjectRepository(CalculationRunEntity)
    private readonly runs: Repository<CalculationRunEntity>,
    @InjectRepository(AreaRoomEntity)
    private readonly rooms: Repository<AreaRoomEntity>,
    @InjectRepository(AreaUsageEntity)
    private readonly usages: Repository<AreaUsageEntity>,
    private readonly areas: AreaService,
    private readonly calculations: CalculationService,
    private readonly importer: ImportService,
    private readonly usageService: UsageService,
    private readonly status: AreaStatusService,
    private readonly files: CalculationFilesService,
    private readonly dataSource: DataSource,
    @Optional() private readonly logger?: LoggerService,
  ) {}

  // ---------------------------------------------------------------------------
  // 5.18 Übersicht
  // ---------------------------------------------------------------------------

  async overview(tenantId: string, areaId: string): Promise<CalculationsOverviewDto> {
    await this.areas.get(tenantId, areaId);
    const [deliveries, states] = await Promise.all([
      this.deliveries.find({ where: { tenantId, areaId, enabled: true }, order: { deliveredAt: 'ASC', name: 'ASC' } }),
      this.states.find({ where: { tenantId, areaId, enabled: true }, order: { referenceYear: 'ASC', name: 'ASC' } }),
    ]);
    const counts = await this.stateCounts(tenantId, states.map((s) => s.id));
    const byDelivery = new Map<string, StateSummaryDto[]>();
    for (const s of states) {
      const list = byDelivery.get(s.calculationId) ?? [];
      list.push(toStateDto(s, counts.get(s.id)));
      byDelivery.set(s.calculationId, list);
    }
    return {
      deliveries: deliveries.map((d) => toDeliveryDto(d, byDelivery.get(d.id) ?? [])),
      currentStateId: states.find((s) => s.isCurrent)?.id ?? null,
      mgdmStateId: states.find((s) => s.isMgdm)?.id ?? null,
    };
  }

  async createDelivery(tenantId: string, areaId: string, dto: DeliveryCreateDto, userId: string): Promise<DeliveryDto> {
    const area = await this.areas.get(tenantId, areaId);
    const name = dto.name.trim();
    if (await this.deliveries.exists({ where: { tenantId, areaId, name } })) {
      throw new ConflictException(`Immissionsberechnung «${name}» besteht auf diesem Schiessplatz bereits`);
    }
    const saved = await this.deliveries.save(
      this.deliveries.create({
        tenantId,
        areaId,
        name,
        supplier: dto.supplier?.trim() ?? '',
        deliveredAt: dto.deliveredAt,
        description: dto.description?.trim() || null,
        fileName: null,
        enabled: true,
      }),
    );
    await this.log(tenantId, userId, LogAction.CREATE, 'CALCULATION', saved.id, area, { name: saved.name, supplier: saved.supplier, deliveredAt: saved.deliveredAt });
    return toDeliveryDto(saved, []);
  }

  async updateDelivery(tenantId: string, areaId: string, id: string, dto: DeliveryUpdateDto, userId: string): Promise<DeliveryDto> {
    const area = await this.areas.get(tenantId, areaId);
    const delivery = await this.delivery(tenantId, areaId, id);
    const before = { name: delivery.name, supplier: delivery.supplier, deliveredAt: delivery.deliveredAt, description: delivery.description, fileName: delivery.fileName };
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (name !== delivery.name && (await this.deliveries.exists({ where: { tenantId, areaId, name } }))) {
        throw new ConflictException(`Immissionsberechnung «${name}» besteht auf diesem Schiessplatz bereits`);
      }
      delivery.name = name;
    }
    if (dto.supplier !== undefined) delivery.supplier = dto.supplier.trim();
    if (dto.deliveredAt !== undefined) delivery.deliveredAt = dto.deliveredAt;
    if (dto.description !== undefined) delivery.description = dto.description?.trim() || null;
    if (dto.fileName !== undefined) delivery.fileName = dto.fileName?.trim() || null;
    const saved = await this.deliveries.save(delivery);
    const after = { name: saved.name, supplier: saved.supplier, deliveredAt: saved.deliveredAt, description: saved.description, fileName: saved.fileName };
    await this.log(tenantId, userId, LogAction.UPDATE, 'CALCULATION', id, area, { name: saved.name, changes: diff(before, after) });
    const states = await this.states.find({ where: { tenantId, calculationId: id, enabled: true }, order: { referenceYear: 'ASC' } });
    const counts = await this.stateCounts(tenantId, states.map((s) => s.id));
    return toDeliveryDto(saved, states.map((s) => toStateDto(s, counts.get(s.id))));
  }

  /**
   * Removes a delivery with its states (soft: `enabled = false`, the model
   * rows stay for the audit). Refused while one of its states is the
   * «aktuell gültige» or «Stand MGDM» one, or carries a stored run.
   */
  async deleteDelivery(tenantId: string, areaId: string, id: string, userId: string): Promise<void> {
    const area = await this.areas.get(tenantId, areaId);
    const delivery = await this.delivery(tenantId, areaId, id);
    const states = await this.states.find({ where: { tenantId, calculationId: id, enabled: true } });
    const pointer = states.find((s) => s.isCurrent || s.isMgdm);
    if (pointer) {
      throw new ConflictException(`Zustand «${pointer.name}» ist ${pointer.isCurrent ? 'der aktuell gültige Zustand' : 'der Stand MGDM'} — zuerst einen anderen Zustand festlegen`);
    }
    const runCount = states.length ? await this.runs.count({ where: { tenantId, zustandId: In(states.map((s) => s.id)) } }) : 0;
    if (runCount) throw new ConflictException(`Auf den Zuständen dieser Lieferung liegen ${runCount} gespeicherte Berechnungsläufe`);
    await this.dataSource.transaction(async (em) => {
      if (states.length) await em.getRepository(AreaCalculationEntity).update({ tenantId, calculationId: id }, { enabled: false });
      await em.getRepository(ImmissionCalculationEntity).update({ tenantId, id }, { enabled: false });
    });
    await this.log(tenantId, userId, LogAction.DELETE, 'CALCULATION', id, area, { name: delivery.name, states: states.map((s) => s.name) });
  }

  /** 5.20 «Neuen Berechnungszustand anlegen»: an empty state in a delivery, to be filled by the contractor. */
  async createState(tenantId: string, areaId: string, dto: StateCreateDto, userId: string): Promise<StateSummaryDto> {
    const area = await this.areas.get(tenantId, areaId);
    const delivery = await this.delivery(tenantId, areaId, dto.calculationId);
    const name = dto.name.trim();
    if (await this.states.exists({ where: { tenantId, areaId, name } })) {
      throw new ConflictException(`Zustand «${name}» existiert bereits auf diesem Schiessplatz`);
    }
    const externalId = await this.nextExternalId(tenantId, area);
    const saved = await this.states.save(
      this.states.create({
        tenantId,
        areaId,
        calculationId: delivery.id,
        externalId,
        name,
        referenceYear: dto.referenceYear,
        buildYearClass: dto.buildYearClass ?? 'mixed',
        isCurrent: false,
        isMgdm: false,
        currentKey: null,
        mgdmKey: null,
        enabled: true,
      }),
    );
    await this.log(tenantId, userId, LogAction.CREATE, 'STATE', saved.id, area, { name: saved.name, externalId, delivery: delivery.name, referenceYear: saved.referenceYear });
    return toStateDto(saved, undefined);
  }

  /** 5.18: Bezeichnung, Referenzjahr and the Baujahr class of a state; a changed Baujahr changes the limits → lights refresh. */
  async updateState(tenantId: string, areaId: string, stateId: string, dto: StateUpdateDto, userId: string): Promise<StateSummaryDto> {
    const area = await this.areas.get(tenantId, areaId);
    const state = await this.state(tenantId, areaId, stateId);
    const before = { name: state.name, referenceYear: state.referenceYear, buildYearClass: state.buildYearClass };
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (name !== state.name && (await this.states.exists({ where: { tenantId, areaId, name } }))) {
        throw new ConflictException(`Zustand «${name}» existiert bereits auf diesem Schiessplatz`);
      }
      state.name = name;
    }
    if (dto.referenceYear !== undefined) state.referenceYear = dto.referenceYear;
    if (dto.buildYearClass !== undefined) state.buildYearClass = dto.buildYearClass;
    const saved = await this.states.save(state);
    const after = { name: saved.name, referenceYear: saved.referenceYear, buildYearClass: saved.buildYearClass };
    await this.log(tenantId, userId, LogAction.UPDATE, 'STATE', stateId, area, { name: saved.name, changes: diff(before, after) });
    if (before.buildYearClass !== after.buildYearClass && saved.isCurrent) await this.refresh(tenantId, areaId);
    const counts = await this.stateCounts(tenantId, [stateId]);
    return toStateDto(saved, counts.get(stateId));
  }

  /** 5.18: «Aktueller Zustand» / «Stand MGDM» — exactly one per Schiessplatz (CalculationService keeps the invariant). */
  async setPointer(tenantId: string, areaId: string, stateId: string, pointer: 'current' | 'mgdm', userId: string): Promise<StateSummaryDto> {
    const area = await this.areas.get(tenantId, areaId);
    const state = await this.calculations.setPointer(tenantId, areaId, stateId, pointer);
    await this.log(tenantId, userId, LogAction.UPDATE, 'STATE', stateId, area, { name: state.name, pointer });
    if (pointer === 'current') await this.refresh(tenantId, areaId);
    const counts = await this.stateCounts(tenantId, [stateId]);
    return toStateDto(state, counts.get(stateId));
  }

  // ---------------------------------------------------------------------------
  // 5.19 Import
  // ---------------------------------------------------------------------------

  validateImport(tenantId: string, areaId: string, dto: StateImportDto): Promise<ImportValidationDto> {
    return this.importer.validateState(tenantId, areaId, dto);
  }

  async importFile(tenantId: string, areaId: string, dto: StateImportDto, fileName: string | undefined, userId: string): Promise<ImportReportDto> {
    const area = await this.areas.get(tenantId, areaId);
    const report = await this.importer.importState(tenantId, areaId, { ...dto, calculation: { ...dto.calculation, fileName: fileName ?? dto.calculation.fileName ?? null } });
    if (fileName) await this.deliveries.update({ tenantId, id: report.calculationId }, { fileName });
    await this.log(tenantId, userId, LogAction.IMPORT, 'STATE', report.stateId, area, { delivery: dto.calculation.name, state: dto.state.name, fileName: fileName ?? null, counts: report.counts, warnings: report.warnings.length });
    await this.refresh(tenantId, areaId);
    return report;
  }

  /**
   * WLR upload onto a state: the rows of the file's Zeitgruppe replace the
   * stored ones. Structural errors of the file store nothing; unknown
   * Empfänger / Quellen are skipped and reported.
   */
  async uploadWlr(tenantId: string, areaId: string, stateId: string, dto: WlrUploadDto, userId: string): Promise<UploadResultDto> {
    const area = await this.areas.get(tenantId, areaId);
    const state = await this.state(tenantId, areaId, stateId);
    const parsed = this.files.parseWlr(dto.text, dto.timeGroup);
    if (parsed.errors.length) return { rows: parsed.rows.length + parsed.skipped, applied: 0, replaced: 0, unknown: [], errors: parsed.errors, warnings: [] };

    const [points, sources] = await Promise.all([
      this.points.find({ where: { tenantId, zustandId: state.id } }),
      this.sources.find({ where: { tenantId, zustandId: state.id } }),
    ]);
    const pointByKey = new Map(points.map((p) => [p.sonarmsId, p]));
    const sourceByKey = new Map(sources.map((s) => [s.sourceId, s]));
    const propagationId = points[0]?.propagationId;
    if (!propagationId) throw new BadRequestException('Der Zustand hat keine Immissionspunkte — zuerst die Berechnungsdatei importieren');

    const unknown: string[] = [];
    const rows: Partial<AreaWlrEntity>[] = [];
    for (const r of parsed.rows) {
      const point = pointByKey.get(r.point);
      const source = sourceByKey.get(r.source);
      if (!point || !source) {
        unknown.push(`${r.point} × ${r.source}: ${!point ? `Empfänger ${r.point} unbekannt` : `Quelle ${r.source} unbekannt`}`);
        continue;
      }
      rows.push({
        tenantId,
        zustandId: state.id,
        propagationId,
        immissionPointId: point.id,
        sourceLineId: source.id,
        timeGroup: dto.timeGroup,
        lae: r.lae,
        lafmax: r.lafmax,
        laeMk: r.laeMk ?? null,
        laeGk: r.laeGk ?? null,
        laeDet: r.laeDet ?? null,
        elevation: r.elevation ?? null,
      });
    }
    const replaced = await this.wlr.count({ where: { tenantId, zustandId: state.id, timeGroup: dto.timeGroup } });
    await this.dataSource.transaction(async (em) => {
      const repo = em.getRepository(AreaWlrEntity);
      await repo.delete({ tenantId, zustandId: state.id, timeGroup: dto.timeGroup });
      for (let i = 0; i < rows.length; i += 200) await repo.save(repo.create(rows.slice(i, i + 200)));
    });
    const warnings: string[] = [];
    if (dto.timeGroup === 'day') {
      const covered = new Set(rows.map((r) => `${r.immissionPointId}|${r.sourceLineId}`));
      for (const p of points) for (const s of sources) if (!covered.has(`${p.id}|${s.id}`)) warnings.push(`kein Tag-Pegel für ${p.sonarmsId} × ${s.sourceId}`);
    }
    await this.log(tenantId, userId, LogAction.IMPORT, 'STATE', state.id, area, { name: state.name, upload: 'wlr', timeGroup: dto.timeGroup, fileName: dto.fileName ?? null, applied: rows.length, replaced, unknown: unknown.length });
    if (state.isCurrent) await this.refresh(tenantId, areaId);
    return { rows: parsed.rows.length, applied: rows.length, replaced, unknown, errors: [], warnings };
  }

  /** Betriebsdaten upload onto a state: one record per QuellenID is created or replaced. */
  async uploadOperatingData(tenantId: string, areaId: string, stateId: string, dto: OperatingDataUploadDto, userId: string): Promise<UploadResultDto> {
    const area = await this.areas.get(tenantId, areaId);
    const state = await this.state(tenantId, areaId, stateId);
    const sources = await this.sources.find({ where: { tenantId, zustandId: state.id }, relations: { combination: { weapon: true } } });
    const sourceByKey = new Map(sources.map((s) => [s.sourceId, s]));
    const unknown: string[] = [];
    let applied = 0;
    let replaced = 0;

    if (dto.annex === 9) {
      const parsed = this.files.parseOperatingA9(dto.text);
      if (parsed.errors.length) return { rows: parsed.rows.length + parsed.skipped, applied: 0, replaced: 0, unknown: [], errors: parsed.errors, warnings: [] };
      await this.dataSource.transaction(async (em) => {
        const repo = em.getRepository(SourceDataA9Entity);
        for (const r of parsed.rows) {
          const source = sourceByKey.get(r.sourceId);
          if (!source) {
            unknown.push(`QuellenID ${r.sourceId} ist keine Schusslinie des Zustands`);
            continue;
          }
          const existing = await repo.findOne({ where: { tenantId, sourceLineId: source.id } });
          if (existing) replaced++;
          await repo.save(
            repo.create({
              ...(existing ?? { tenantId, zustandId: state.id, sourceLineId: source.id, planCategory: existing?.planCategory ?? source.combination?.weapon?.nameDe ?? '' }),
              shotsInside: r.data.shotsInside,
              shotsOutside: r.data.shotsOutside,
              estimated: r.data.estimated ?? false,
              year: r.data.year ?? null,
              remark: r.data.remark ?? null,
            }),
          );
          applied++;
        }
      });
    } else {
      const parsed = this.files.parseOperatingA7(dto.text);
      if (parsed.errors.length) return { rows: parsed.rows.length + parsed.skipped, applied: 0, replaced: 0, unknown: [], errors: parsed.errors, warnings: [] };
      const errors: string[] = [];
      await this.dataSource.transaction(async (em) => {
        const repo = em.getRepository(SourceDataA7Entity);
        for (const r of parsed.rows) {
          const source = sourceByKey.get(r.sourceId);
          if (!source) {
            unknown.push(`QuellenID ${r.sourceId} ist keine Schusslinie des Zustands`);
            continue;
          }
          const category = r.data.category ?? source.combination?.weapon?.annex7Category ?? null;
          if (!category) {
            errors.push(`QuellenID ${r.sourceId}: keine Waffenkategorie nach Anhang 7 — in der Datei angeben oder die Waffe zuordnen`);
            continue;
          }
          const existing = await repo.findOne({ where: { tenantId, sourceLineId: source.id } });
          if (existing) replaced++;
          await repo.save(
            repo.create({
              ...(existing ?? { tenantId, zustandId: state.id, sourceLineId: source.id, planCategory: source.combination?.weapon?.nameDe ?? '' }),
              category,
              halfDaysWork: r.data.halfDaysWork,
              halfDaysSunday: r.data.halfDaysSunday,
              shotsWork: r.data.shotsWork,
              shotsSunday: r.data.shotsSunday ?? null,
              estimated: r.data.estimated ?? false,
              year: r.data.year ?? null,
              remark: r.data.remark ?? null,
            }),
          );
          applied++;
        }
      });
      if (errors.length) {
        await this.log(tenantId, userId, LogAction.IMPORT, 'STATE', state.id, area, { name: state.name, upload: 'a7', fileName: dto.fileName ?? null, applied, errors: errors.length });
        if (state.isCurrent) await this.refresh(tenantId, areaId);
        return { rows: parsed.rows.length, applied, replaced, unknown, errors, warnings: [] };
      }
      await this.log(tenantId, userId, LogAction.IMPORT, 'STATE', state.id, area, { name: state.name, upload: 'a7', fileName: dto.fileName ?? null, applied, replaced, unknown: unknown.length });
      if (state.isCurrent) await this.refresh(tenantId, areaId);
      return { rows: parsed.rows.length, applied, replaced, unknown, errors: [], warnings: [] };
    }
    await this.log(tenantId, userId, LogAction.IMPORT, 'STATE', state.id, area, { name: state.name, upload: 'a9', fileName: dto.fileName ?? null, applied, replaced, unknown: unknown.length });
    if (state.isCurrent) await this.refresh(tenantId, areaId);
    return { rows: applied + unknown.length, applied, replaced, unknown, errors: [], warnings: [] };
  }

  // ---------------------------------------------------------------------------
  // 5.20 Export
  // ---------------------------------------------------------------------------

  async exportStates(tenantId: string, areaId: string, stateIds: string[], userId: string): Promise<StateBundle> {
    const area = await this.areas.get(tenantId, areaId);
    const states = await this.states.find({ where: { tenantId, areaId, id: In(stateIds), enabled: true }, relations: { calculation: true } });
    const missing = stateIds.filter((id) => !states.some((s) => s.id === id));
    if (missing.length) throw new NotFoundException(`Zustand ${missing[0]} nicht gefunden`);
    const models: StateExportModel[] = [];
    for (const state of states) models.push(await this.exportModel(tenantId, state));
    await this.log(tenantId, userId, LogAction.EXPORT, 'STATE', stateIds.join(','), area, { states: states.map((s) => s.name) });
    return this.files.stateBundle({ exportedAt: new Date(), area: { coordinationSectionNo: area.coordinationSectionNo, name: area.name }, states: models });
  }

  /** Kalenderjahre mit Schusszahlen (5.20 «Export Schusszahlen»-Tabelle). */
  async shotYears(tenantId: string, areaId: string): Promise<ShotYearsDto> {
    await this.areas.get(tenantId, areaId);
    const years = await this.usageService.years(tenantId, areaId);
    const out: ShotYearsDto = { years: [] };
    for (const year of years) {
      const usages = await this.usageService.listYear(tenantId, areaId, year);
      out.years.push({
        year,
        usageCount: usages.length,
        shots: Math.round(usages.reduce((sum, u) => sum + (u.positions ?? []).reduce((s, p) => s + Number(p.quantity), 0), 0) * 1000) / 1000,
        importedCount: usages.filter((u) => u.source !== 'manual').length,
      });
    }
    return out;
  }

  async exportShots(tenantId: string, areaId: string, years: number[], userId: string): Promise<string> {
    const area = await this.areas.get(tenantId, areaId);
    const rows: ShotCsvRow[] = [];
    const roomsById = new Map((await this.rooms.find({ where: { tenantId, areaId } })).map((r) => [r.id, r]));
    for (const year of [...years].sort()) {
      const usages = await this.usages.find({
        where: { tenantId, areaId },
        relations: { positions: { combination: true } },
        order: { date: 'ASC', timeFrom: 'ASC' },
      });
      for (const u of usages.filter((x) => x.date.startsWith(`${year}-`))) {
        const room = roomsById.get(u.roomId);
        for (const p of u.positions ?? []) {
          rows.push({
            date: u.date,
            timeFrom: u.timeFrom,
            timeTo: u.timeTo,
            roomName: room?.name ?? '',
            roomNo: room?.coordinationSectionNo ?? null,
            unit: u.unit,
            usageType: u.usageType,
            civilUsageKind: u.civilUsageKind,
            combinationName: p.combination?.nameDe ?? '',
            quantity: Number(p.quantity),
            quantityUnit: p.quantityUnit,
            personCount: u.personCount,
            recordedBy: u.recordedBy,
            source: u.source,
          });
        }
      }
    }
    await this.log(tenantId, userId, LogAction.EXPORT, 'USAGE_CSV', area.id, area, { years, rows: rows.length });
    return this.files.shotsCsv(rows);
  }

  // ---------------------------------------------------------------------------
  // 5.21 Details
  // ---------------------------------------------------------------------------

  async details(tenantId: string, areaId: string, stateId: string): Promise<StateDetailsDto> {
    await this.areas.get(tenantId, areaId);
    const state = await this.state(tenantId, areaId, stateId);
    const [rooms, parts, sources, points, wlr, counts] = await Promise.all([
      this.rooms.find({ where: { tenantId, areaId }, order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.plantParts.find({ where: { tenantId, zustandId: state.id } }),
      this.sources.find({ where: { tenantId, zustandId: state.id }, relations: { dataA9: true, dataA7: true, combination: true } }),
      this.points.find({ where: { tenantId, zustandId: state.id } }),
      this.wlr.find({ where: { tenantId, zustandId: state.id } }),
      this.stateCounts(tenantId, [stateId]),
    ]);
    const partById = new Map(parts.map((p) => [p.id, p]));
    const pointById = new Map(points.map((p) => [p.id, p]));
    const sourceById = new Map(sources.map((s) => [s.id, s]));
    const roomOf = (s: SourceLineEntity): string => partById.get(s.plantPartId)?.roomId ?? '';
    const partNoOf = (s: SourceLineEntity): string => partById.get(s.plantPartId)?.coordinationSectionNo ?? '';

    const wlrRows: WlrRowDto[] = wlr
      .map((w) => {
        const source = sourceById.get(w.sourceLineId);
        const point = pointById.get(w.immissionPointId);
        if (!source || !point) return null;
        return {
          roomId: roomOf(source),
          plantPartNo: partNoOf(source),
          point: point.code,
          egid: point.egid,
          sourceId: source.sourceId,
          weaponSystem: source.weaponSystem,
          timeGroup: w.timeGroup as TimeGroup,
          elevation: w.elevation,
          laeMk: w.laeMk,
          laeGk: w.laeGk,
          laeDet: w.laeDet,
          lae: w.lae,
          lafmax: w.lafmax,
        };
      })
      .filter((r): r is WlrRowDto => r !== null)
      .sort((a, b) => a.point.localeCompare(b.point, 'de-CH', { numeric: true }) || a.sourceId.localeCompare(b.sourceId, 'de-CH', { numeric: true }));

    const a9: OperatingA9RowDto[] = sources
      .filter((s) => s.dataA9)
      .map((s) => ({
        roomId: roomOf(s),
        plantPartNo: partNoOf(s),
        sourceId: s.sourceId,
        weaponSystem: s.weaponSystem,
        combinationName: s.combination?.nameDe ?? null,
        shotsInside: s.dataA9!.shotsInside,
        shotsOutside: s.dataA9!.shotsOutside,
        estimated: Boolean(s.dataA9!.estimated),
        year: s.dataA9!.year,
        remark: s.dataA9!.remark,
      }))
      .sort((a, b) => a.sourceId.localeCompare(b.sourceId, 'de-CH', { numeric: true }));

    const a7: OperatingA7RowDto[] = sources
      .filter((s) => s.dataA7)
      .map((s) => ({
        roomId: roomOf(s),
        plantPartNo: partNoOf(s),
        sourceId: s.sourceId,
        weaponSystem: s.weaponSystem,
        category: s.dataA7!.category,
        halfDaysWork: Number(s.dataA7!.halfDaysWork),
        halfDaysSunday: Number(s.dataA7!.halfDaysSunday),
        shotsWork: s.dataA7!.shotsWork,
        shotsSunday: s.dataA7!.shotsSunday,
        estimated: Boolean(s.dataA7!.estimated),
        year: s.dataA7!.year,
        remark: s.dataA7!.remark,
      }))
      .sort((a, b) => a.sourceId.localeCompare(b.sourceId, 'de-CH', { numeric: true }));

    const roomRows: RoomSummaryDto[] = rooms.map((r) => ({
      id: r.id,
      coordinationSectionNo: r.coordinationSectionNo,
      name: r.name,
      plantPartCount: parts.filter((p) => p.roomId === r.id).length,
      sourceCount: sources.filter((s) => roomOf(s) === r.id).length,
      wlrCount: wlrRows.filter((w) => w.roomId === r.id).length,
    }));

    return { state: toStateDto(state, counts.get(stateId)), rooms: roomRows, wlr: wlrRows, a9, a7 };
  }

  // ---------------------------------------------------------------------------

  private async exportModel(tenantId: string, state: AreaCalculationEntity): Promise<StateExportModel> {
    const [parts, sources, points, wlr, rooms] = await Promise.all([
      this.plantParts.find({ where: { tenantId, zustandId: state.id } }),
      this.sources.find({ where: { tenantId, zustandId: state.id }, relations: { dataA9: true, dataA7: true } }),
      this.points.find({ where: { tenantId, zustandId: state.id }, order: { sortOrder: 'ASC' } }),
      this.wlr.find({ where: { tenantId, zustandId: state.id } }),
      this.rooms.find({ where: { tenantId, areaId: state.areaId } }),
    ]);
    const roomName = new Map(rooms.map((r) => [r.id, r.name]));
    return {
      calculation: {
        name: state.calculation?.name ?? '',
        supplier: state.calculation?.supplier ?? '',
        deliveredAt: state.calculation?.deliveredAt ?? '',
        description: state.calculation?.description ?? null,
        fileName: state.calculation?.fileName ?? null,
      },
      state: { externalId: state.externalId, name: state.name, referenceYear: state.referenceYear, isCurrent: Boolean(state.isCurrent), isMgdm: Boolean(state.isMgdm) },
      plantParts: parts.map((p) => ({
        id: p.id,
        coordinationSectionNo: p.coordinationSectionNo,
        name: p.name,
        type: p.type,
        remark: p.remark,
        builtAfter1985: Boolean(p.builtAfter1985),
        geometry: p.geometry,
        roomName: roomName.get(p.roomId) ?? null,
      })),
      sources: sources.map((s) => ({
        id: s.id,
        sourceId: s.sourceId,
        plantPartId: s.plantPartId,
        weaponSystem: s.weaponSystem,
        remarkGeom: s.remarkGeom,
        geometry: s.geometry,
        a9: s.dataA9
          ? { shotsInside: s.dataA9.shotsInside, shotsOutside: s.dataA9.shotsOutside, estimated: Boolean(s.dataA9.estimated), year: s.dataA9.year, remark: s.dataA9.remark, planCategory: s.dataA9.planCategory }
          : null,
        a7: s.dataA7
          ? { category: s.dataA7.category, halfDaysWork: Number(s.dataA7.halfDaysWork), halfDaysSunday: Number(s.dataA7.halfDaysSunday), shotsWork: s.dataA7.shotsWork, shotsSunday: s.dataA7.shotsSunday, estimated: Boolean(s.dataA7.estimated), year: s.dataA7.year, remark: s.dataA7.remark, planCategory: s.dataA7.planCategory }
          : null,
      })),
      points: points.map((p) => ({
        id: p.id,
        sonarmsId: p.sonarmsId,
        code: p.code,
        egid: p.egid,
        egrid: p.egrid,
        address: p.address,
        municipality: p.municipality,
        type: p.type,
        sensitivityLevel: p.sensitivityLevel,
        east: p.east,
        north: p.north,
        height: p.height,
        mapX: p.mapX,
        mapY: p.mapY,
        sortOrder: p.sortOrder,
        geometry: p.geometry,
      })),
      wlr: wlr.map((w) => ({
        immissionPointId: w.immissionPointId,
        sourceLineId: w.sourceLineId,
        timeGroup: w.timeGroup as TimeGroup,
        lae: w.lae,
        lafmax: w.lafmax,
        laeMk: w.laeMk,
        laeGk: w.laeGk,
        laeDet: w.laeDet,
        elevation: w.elevation,
      })),
    };
  }

  /** Counts per state for the summaries (sources, points, WLR rows, plant parts, runs). */
  private async stateCounts(tenantId: string, stateIds: string[]): Promise<Map<string, StateCounts>> {
    const out = new Map<string, StateCounts>();
    if (!stateIds.length) return out;
    const where = { tenantId, zustandId: In(stateIds) };
    const [sources, points, wlr, parts, runs] = await Promise.all([
      this.sources.find({ where, select: ['zustandId'] }),
      this.points.find({ where, select: ['zustandId'] }),
      this.wlr.find({ where, select: ['zustandId'] }),
      this.plantParts.find({ where, select: ['zustandId'] }),
      this.runs.find({ where, select: ['zustandId'] }),
    ]);
    const bump = (key: keyof StateCounts, rows: { zustandId: string }[]) => {
      for (const r of rows) {
        const c = out.get(r.zustandId) ?? { sources: 0, points: 0, wlr: 0, plantParts: 0, runs: 0 };
        c[key]++;
        out.set(r.zustandId, c);
      }
    };
    bump('sources', sources);
    bump('points', points);
    bump('wlr', wlr);
    bump('plantParts', parts);
    bump('runs', runs);
    return out;
  }

  /** Next ZustandID of the Schiessplatz: `<Koord-Nr>_<n>` beyond every id already used (5.20 «neue ZustandsID»). */
  private async nextExternalId(tenantId: string, area: AreaEntity): Promise<string> {
    const rows = await this.states.find({ where: { tenantId, areaId: area.id }, select: ['externalId'] });
    const prefix = `${area.coordinationSectionNo}_`;
    let max = 0;
    for (const r of rows) {
      const m = r.externalId?.startsWith(prefix) ? /_(\d+)$/.exec(r.externalId) : null;
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `${prefix}${max + 1}`;
  }

  private async delivery(tenantId: string, areaId: string, id: string): Promise<ImmissionCalculationEntity> {
    const delivery = await this.deliveries.findOne({ where: { tenantId, areaId, id, enabled: true } });
    if (!delivery) throw new NotFoundException(`Immissionsberechnung ${id} nicht gefunden`);
    return delivery;
  }

  private async state(tenantId: string, areaId: string, id: string): Promise<AreaCalculationEntity> {
    const state = await this.states.findOne({ where: { tenantId, areaId, id, enabled: true }, relations: { calculation: true } });
    if (!state) throw new NotFoundException(`Zustand ${id} nicht gefunden`);
    return state;
  }

  private async refresh(tenantId: string, areaId: string): Promise<void> {
    try {
      await this.status.refresh(tenantId, areaId);
    } catch {
      // the lights are a cache; the next change or the boot catches up
    }
  }

  private log(tenantId: string, userId: string, action: LogAction, refType: string, refId: string, area: AreaEntity, data: Record<string, unknown>): Promise<unknown> {
    return Promise.resolve(
      this.logger?.createLog({ tenantId, userId, section: 'CALCULATION', action, refType, refId, message: area.coordinationSectionNo, data: { area: area.name, ...data } }),
    );
  }
}

interface StateCounts {
  sources: number;
  points: number;
  wlr: number;
  plantParts: number;
  runs: number;
}

function toStateDto(s: AreaCalculationEntity, counts: StateCounts | undefined): StateSummaryDto {
  const c = counts ?? { sources: 0, points: 0, wlr: 0, plantParts: 0, runs: 0 };
  return {
    id: s.id,
    externalId: s.externalId,
    name: s.name,
    referenceYear: s.referenceYear,
    buildYearClass: s.buildYearClass,
    isCurrent: Boolean(s.isCurrent),
    isMgdm: Boolean(s.isMgdm),
    sourceCount: c.sources,
    pointCount: c.points,
    wlrCount: c.wlr,
    plantPartCount: c.plantParts,
    runCount: c.runs,
    hasModel: c.sources + c.points + c.plantParts > 0,
  };
}

function toDeliveryDto(d: ImmissionCalculationEntity, states: StateSummaryDto[]): DeliveryDto {
  return {
    id: d.id,
    name: d.name,
    supplier: d.supplier,
    deliveredAt: d.deliveredAt,
    description: d.description ?? null,
    fileName: d.fileName ?? null,
    stateCount: states.length,
    hasCurrent: states.some((s) => s.isCurrent),
    hasMgdm: states.some((s) => s.isMgdm),
    states,
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt),
  };
}

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value ?? '');
}

function diff<T extends object>(before: T, after: T): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(before) as (keyof T)[]) {
    if (before[key] !== after[key]) out[String(key)] = { from: before[key] ?? null, to: after[key] ?? null };
  }
  return out;
}
