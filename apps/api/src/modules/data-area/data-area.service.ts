import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LogAction, LoggerService } from '../../core/logger';
import { AreaService } from '../area/area.service';
import { AreaResultDto, AreaUpdateDto } from '../area/dto';
import {
  AreaEntity,
  AreaQuotaEntity,
  AreaRoomEntity,
  RoomCombinationEntity,
  WeaponCombinationEntity,
} from '../area/entities';
import { AreaStatusService } from '../calculation/area-status.service';
import { AreaCalculationEntity } from '../calculation/entities';
import {
  AreaGeneralDto,
  AreaQuotaDto,
  AreaQuotaInputDto,
  AreaQuotaUpdateDto,
  AreaRoomDto,
  QuotaCombinationOptionDto,
} from './dto';

/** Fields of the Stammdaten mask (5.16) whose change is written to the logbook as before/after. */
const MASTER_DATA_FIELDS: readonly (keyof AreaUpdateDto)[] = [
  'name',
  'coordinationSectionNo',
  'sectoralPlanNo',
  'enabled',
  'annex7Overall',
  'classification',
  'recalculationState',
  'remediationProjectState',
  'spmState',
  'noiseRemediationState',
  'projectState',
  'planningApproval',
];

/**
 * Datenverwaltung › Schiessplatz › Allgemein (B1 5.15 «Übersicht», 5.16
 * «Stammdaten», `slm 14–16`): the read model of one Schiessplatz with its
 * Stellungsräume and Kontingente, the Stammdaten update and the CRUD of the
 * Kontingente gemäss Plangenehmigung. A Kontingent is the Soll of the
 * quota traffic light (5.10), so every change refreshes the cached lights.
 * Every mutation is written to the logbook (slm 56).
 */
@Injectable()
export class DataAreaService {
  constructor(
    @InjectRepository(AreaRoomEntity)
    private readonly rooms: Repository<AreaRoomEntity>,
    @InjectRepository(AreaQuotaEntity)
    private readonly quotas: Repository<AreaQuotaEntity>,
    @InjectRepository(RoomCombinationEntity)
    private readonly assignments: Repository<RoomCombinationEntity>,
    @InjectRepository(WeaponCombinationEntity)
    private readonly combinations: Repository<WeaponCombinationEntity>,
    @InjectRepository(AreaCalculationEntity)
    private readonly states: Repository<AreaCalculationEntity>,
    private readonly areas: AreaService,
    private readonly status: AreaStatusService,
    // Global CoreLoggerModule in the app; the service specs run without it.
    @Optional() private readonly logger?: LoggerService,
  ) {}

  /** 5.15 + 5.16 read model. */
  async general(tenantId: string, areaId: string): Promise<AreaGeneralDto> {
    const area = await this.areas.get(tenantId, areaId);
    const [rooms, current, quotas, assignments, combinations] = await Promise.all([
      this.rooms.find({ where: { tenantId, areaId }, order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.states.findOne({ where: { tenantId, areaId, isCurrent: true } }),
      this.quotaRows(tenantId, areaId),
      this.assignments.find({ where: { tenantId, areaId }, select: ['combinationId'] }),
      this.combinations.find({
        where: { tenantId },
        relations: { weapon: true, caliber: true },
        order: { nameDe: 'ASC' },
      }),
    ]);
    const assigned = new Set(assignments.map((a) => a.combinationId));
    const withQuota = new Set(quotas.map((q) => q.combinationId));
    return {
      area: toAreaDto(area),
      buildYearClass: current?.buildYearClass ?? null,
      currentStateName: current?.name ?? null,
      rooms: rooms.map(toRoomDto),
      quotas: quotas.map((q) => toQuotaDto(q, assigned.has(q.combinationId))),
      combinations: combinations.map<QuotaCombinationOptionDto>((c) => ({
        id: c.id,
        name: c.nameDe,
        weapon: c.weapon.nameDe,
        caliber: c.caliber.nameDe,
        quantityUnit: c.caliber.quantityUnit,
        enabled: Boolean(c.enabled),
        assigned: assigned.has(c.id),
        hasQuota: withQuota.has(c.id),
      })),
    };
  }

  /** 5.16 Stammdaten: the changed fields are logged as before/after. */
  async updateMasterData(
    tenantId: string,
    areaId: string,
    dto: AreaUpdateDto,
    userId: string,
  ): Promise<AreaResultDto> {
    const before = await this.areas.get(tenantId, areaId);
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const field of MASTER_DATA_FIELDS) {
      if (dto[field] === undefined) continue;
      if (before[field] === dto[field]) continue;
      changes[field] = { from: before[field] ?? null, to: dto[field] ?? null };
    }
    if (dto.coordinationSectionNo && dto.coordinationSectionNo !== before.coordinationSectionNo) {
      const clash = await this.areas
        .list(tenantId)
        .then((all) => all.find((a) => a.id !== areaId && a.coordinationSectionNo === dto.coordinationSectionNo));
      if (clash) throw new ConflictException(`Koordinationsabschnitts-Nr. ${dto.coordinationSectionNo} ist bereits vergeben (${clash.name})`);
    }
    const area = await this.areas.update(tenantId, areaId, dto);
    if (Object.keys(changes).length) {
      await this.logger?.createLog({
        tenantId,
        userId,
        section: 'AREA',
        action: LogAction.UPDATE,
        refType: 'AREA',
        refId: areaId,
        message: area.coordinationSectionNo,
        data: { name: area.name, changes },
      });
    }
    return toAreaDto(area);
  }

  async createQuota(tenantId: string, areaId: string, dto: AreaQuotaInputDto, userId: string): Promise<AreaQuotaDto> {
    const area = await this.areas.get(tenantId, areaId);
    const combination = await this.combination(tenantId, dto.combinationId);
    const existing = await this.quotas.findOne({ where: { tenantId, areaId, combinationId: combination.id } });
    if (existing) {
      throw new ConflictException(`Für ${combination.nameDe} besteht auf diesem Schiessplatz bereits ein Kontingent`);
    }
    const saved = await this.quotas.save(
      this.quotas.create({
        tenantId,
        areaId,
        combinationId: combination.id,
        shotsPerYear: dto.shotsPerYear,
        basis: dto.basis?.trim() || area.planningApproval || null,
      }),
    );
    await this.logger?.createLog({
      tenantId,
      userId,
      section: 'AREA',
      action: LogAction.CREATE,
      refType: 'QUOTA',
      refId: saved.id,
      message: area.coordinationSectionNo,
      data: { area: area.name, combination: combination.nameDe, shotsPerYear: saved.shotsPerYear, basis: saved.basis },
    });
    await this.refreshStatus(tenantId, areaId);
    return this.quotaDto(tenantId, areaId, saved.id);
  }

  async updateQuota(
    tenantId: string,
    areaId: string,
    id: string,
    dto: AreaQuotaUpdateDto,
    userId: string,
  ): Promise<AreaQuotaDto> {
    const area = await this.areas.get(tenantId, areaId);
    const quota = await this.quota(tenantId, areaId, id);
    const before = { combinationId: quota.combinationId, shotsPerYear: Number(quota.shotsPerYear), basis: quota.basis };
    if (dto.combinationId && dto.combinationId !== quota.combinationId) {
      const combination = await this.combination(tenantId, dto.combinationId);
      const clash = await this.quotas.findOne({ where: { tenantId, areaId, combinationId: combination.id } });
      if (clash) throw new ConflictException(`Für ${combination.nameDe} besteht auf diesem Schiessplatz bereits ein Kontingent`);
      quota.combinationId = combination.id;
    }
    if (dto.shotsPerYear !== undefined) quota.shotsPerYear = dto.shotsPerYear;
    if (dto.basis !== undefined) quota.basis = dto.basis?.trim() || null;
    const saved = await this.quotas.save(quota);
    await this.logger?.createLog({
      tenantId,
      userId,
      section: 'AREA',
      action: LogAction.UPDATE,
      refType: 'QUOTA',
      refId: saved.id,
      message: area.coordinationSectionNo,
      data: {
        area: area.name,
        before,
        after: { combinationId: saved.combinationId, shotsPerYear: Number(saved.shotsPerYear), basis: saved.basis },
      },
    });
    await this.refreshStatus(tenantId, areaId);
    return this.quotaDto(tenantId, areaId, saved.id);
  }

  async deleteQuota(tenantId: string, areaId: string, id: string, userId: string): Promise<void> {
    const area = await this.areas.get(tenantId, areaId);
    const quota = await this.quota(tenantId, areaId, id, true);
    await this.quotas.softRemove(quota);
    await this.logger?.createLog({
      tenantId,
      userId,
      section: 'AREA',
      action: LogAction.DELETE,
      refType: 'QUOTA',
      refId: id,
      message: area.coordinationSectionNo,
      data: { area: area.name, combination: quota.combination?.nameDe, shotsPerYear: Number(quota.shotsPerYear) },
    });
    await this.refreshStatus(tenantId, areaId);
  }

  // ---------------------------------------------------------------------------

  private async quotaRows(tenantId: string, areaId: string): Promise<AreaQuotaEntity[]> {
    return this.quotas.find({
      where: { tenantId, areaId },
      relations: { combination: { weapon: true, caliber: true } },
      order: { combination: { nameDe: 'ASC' } },
    });
  }

  private async quotaDto(tenantId: string, areaId: string, id: string): Promise<AreaQuotaDto> {
    const quota = await this.quota(tenantId, areaId, id, true);
    const assigned = await this.assignments.exists({ where: { tenantId, areaId, combinationId: quota.combinationId } });
    return toQuotaDto(quota, assigned);
  }

  private async quota(tenantId: string, areaId: string, id: string, withCombination = false): Promise<AreaQuotaEntity> {
    const quota = await this.quotas.findOne({
      where: { tenantId, areaId, id },
      relations: withCombination ? { combination: { weapon: true, caliber: true } } : undefined,
    });
    if (!quota) throw new NotFoundException(`Kontingent ${id} nicht gefunden`);
    return quota;
  }

  private async combination(tenantId: string, id: string): Promise<WeaponCombinationEntity> {
    const combination = await this.combinations.findOne({ where: { tenantId, id }, relations: { weapon: true, caliber: true } });
    if (!combination) throw new NotFoundException(`Kombination Waffe/Kaliber ${id} nicht gefunden`);
    return combination;
  }

  /** The overview lights are a cache; a failed refresh never fails the mutation. */
  private async refreshStatus(tenantId: string, areaId: string): Promise<void> {
    try {
      await this.status.refresh(tenantId, areaId);
    } catch {
      // the boot / next change catches up
    }
  }
}

function toAreaDto(area: AreaEntity): AreaResultDto {
  return {
    id: area.id,
    name: area.name,
    coordinationSectionNo: area.coordinationSectionNo,
    sectoralPlanNo: area.sectoralPlanNo,
    quotaStatus: area.quotaStatus,
    noiseStatus: area.noiseStatus,
    quotaStatusReason: area.quotaStatusReason,
    noiseStatusReason: area.noiseStatusReason,
    noiseStatusBasis: area.noiseStatusBasis,
    statusYear: area.statusYear,
    annex7Overall: Boolean(area.annex7Overall),
    enabled: Boolean(area.enabled),
    classification: area.classification ?? null,
    recalculationState: area.recalculationState ?? null,
    remediationProjectState: area.remediationProjectState ?? null,
    spmState: area.spmState ?? null,
    noiseRemediationState: area.noiseRemediationState ?? null,
    projectState: area.projectState ?? null,
    planningApproval: area.planningApproval ?? null,
  };
}

function toRoomDto(room: AreaRoomEntity): AreaRoomDto {
  return {
    id: room.id,
    coordinationSectionNo: room.coordinationSectionNo,
    name: room.name,
    groupName: room.groupName,
    sortOrder: room.sortOrder,
    enabled: Boolean(room.enabled),
  };
}

function toQuotaDto(quota: AreaQuotaEntity, assigned: boolean): AreaQuotaDto {
  return {
    id: quota.id,
    combinationId: quota.combinationId,
    name: quota.combination.nameDe,
    weapon: quota.combination.weapon.nameDe,
    caliber: quota.combination.caliber.nameDe,
    quantityUnit: quota.combination.caliber.quantityUnit,
    shotsPerYear: Number(quota.shotsPerYear),
    basis: quota.basis,
    assigned,
    updatedAt: toIso(quota.updatedAt),
  };
}

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value ?? '');
}
