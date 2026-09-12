import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { countsForAnnex7 } from '@slim/lsv';
import {
  AreaQuotaEntity,
  AreaRoomEntity,
  RoomCombinationEntity,
  WeaponCombinationEntity,
} from '../area/entities';
import { AreaService } from '../area/area.service';
import { AreaStatusService } from '../calculation/area-status.service';
import {
  UsageCombinationDto,
  UsageCreateDto,
  UsageKpiDto,
  UsageOverviewDto,
  UsagePositionInputDto,
  UsageResultDto,
  UsageUpdateDto,
} from './dto';
import { AreaUsageEntity, UsagePositionEntity } from './entities';

/** Fields the caller may set; the rest is derived or audit. */
type UsageInput = UsageCreateDto & { recordedBy: string; source?: AreaUsageEntity['source'] };

/**
 * Schiessplatz-Nutzungen (B1 5.11, 6.1.3): a usage with n positions
 * (Kombination + Menge) on the permanent reference structure — no state is
 * involved (slm 44). Everything is scoped by tenant + area; the area must
 * exist for the tenant (AreaService.get throws 404 otherwise).
 */
@Injectable()
export class UsageService {
  constructor(
    @InjectRepository(AreaUsageEntity)
    private readonly repo: Repository<AreaUsageEntity>,
    @InjectRepository(UsagePositionEntity)
    private readonly positions: Repository<UsagePositionEntity>,
    @InjectRepository(AreaRoomEntity)
    private readonly rooms: Repository<AreaRoomEntity>,
    @InjectRepository(RoomCombinationEntity)
    private readonly assignments: Repository<RoomCombinationEntity>,
    @InjectRepository(WeaponCombinationEntity)
    private readonly combinations: Repository<WeaponCombinationEntity>,
    @InjectRepository(AreaQuotaEntity)
    private readonly quotas: Repository<AreaQuotaEntity>,
    private readonly areas: AreaService,
    @Optional() @Inject(forwardRef(() => AreaStatusService))
    private readonly status?: AreaStatusService,
  ) {}

  /** The overview lights are a cache of the calculation: refresh them after every change (5.9/5.10). */
  private async refreshStatus(tenantId: string, areaId: string): Promise<void> {
    if (!this.status) return;
    try {
      await this.status.refresh(tenantId, areaId);
    } catch {
      // A failed refresh never fails the mutation; the boot / next change catches up.
    }
  }

  /** Usages of one calendar year, newest first; rooms and allowed combinations of the area. */
  async overview(tenantId: string, areaId: string, year: number): Promise<UsageOverviewDto> {
    await this.areas.get(tenantId, areaId);
    const [rooms, combinations, usages, years] = await Promise.all([
      this.rooms.find({ where: { tenantId, areaId }, order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.combinationsOf(tenantId, areaId),
      this.listYear(tenantId, areaId, year),
      this.years(tenantId, areaId),
    ]);

    const byRoom = new Map<string, { count: number; shots: number }>();
    for (const usage of usages) {
      const entry = byRoom.get(usage.roomId) ?? { count: 0, shots: 0 };
      entry.count++;
      entry.shots += total(usage);
      byRoom.set(usage.roomId, entry);
    }
    const roomById = new Map(rooms.map((r) => [r.id, r]));
    const combinationById = new Map(combinations.map((c) => [c.combinationId, c]));

    return {
      kpi: this.kpi(year, usages, years),
      rooms: rooms.map((room) => ({
        id: room.id,
        coordinationSectionNo: room.coordinationSectionNo,
        name: room.name,
        groupName: room.groupName,
        enabled: Boolean(room.enabled),
        usageCount: byRoom.get(room.id)?.count ?? 0,
        shots: byRoom.get(room.id)?.shots ?? 0,
      })),
      combinations,
      usages: usages.map((usage) => toUsageDto(usage, roomById.get(usage.roomId), combinationById)),
    };
  }

  /** Zulässige Kombinationen je Stellungsraum (5.17) with the area's Kontingente (5.16). */
  async combinationsOf(tenantId: string, areaId: string): Promise<UsageCombinationDto[]> {
    const [assignments, quotas] = await Promise.all([
      this.assignments.find({
        where: { tenantId, areaId },
        relations: { combination: { weapon: { category: true }, caliber: true } },
        order: { entryName: 'ASC' },
      }),
      this.quotas.find({ where: { tenantId, areaId } }),
    ]);
    const quotaByCombination = new Map(quotas.map((q) => [q.combinationId, q.shotsPerYear]));
    return assignments.map((a) => ({
      combinationId: a.combinationId,
      roomId: a.roomId,
      entryName: a.entryName,
      name: a.combination.nameDe,
      weapon: a.combination.weapon.nameDe,
      caliber: a.combination.caliber.nameDe,
      category: a.combination.weapon.category.code,
      categoryName: a.combination.weapon.category.nameDe,
      annex7Category: a.combination.weapon.annex7Category,
      quantityUnit: a.combination.caliber.quantityUnit,
      quota: quotaByCombination.get(a.combinationId) ?? null,
      enabled: Boolean(a.enabled),
    }));
  }

  listYear(tenantId: string, areaId: string, year: number): Promise<AreaUsageEntity[]> {
    return this.listRange(tenantId, areaId, `${year}-01-01`, `${year}-12-31`);
  }

  /** Usages with `from <= date <= to` (both YYYY-MM-DD, inclusive), positions loaded. */
  listRange(tenantId: string, areaId: string, from: string, to: string): Promise<AreaUsageEntity[]> {
    return this.repo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.positions', 'p')
      .where('u.tenantId = :tenantId', { tenantId })
      .andWhere('u.areaId = :areaId', { areaId })
      .andWhere('u.date >= :from', { from })
      .andWhere('u.date <= :to', { to })
      .orderBy('u.date', 'DESC')
      .addOrderBy('u.timeFrom', 'DESC')
      .getMany();
  }

  async years(tenantId: string, areaId: string): Promise<number[]> {
    const rows: { y: string }[] = await this.repo
      .createQueryBuilder('u')
      .select('substr(u.date, 1, 4)', 'y')
      .where('u.tenantId = :tenantId', { tenantId })
      .andWhere('u.areaId = :areaId', { areaId })
      .groupBy('substr(u.date, 1, 4)')
      .orderBy('y', 'DESC')
      .getRawMany();
    return rows.map((r) => Number(r.y)).filter((y) => Number.isFinite(y));
  }

  async get(tenantId: string, areaId: string, id: string): Promise<AreaUsageEntity> {
    const usage = await this.repo.findOne({ where: { tenantId, areaId, id }, relations: { positions: true } });
    if (!usage) throw new NotFoundException(`Usage ${id} not found`);
    return usage;
  }

  async create(tenantId: string, areaId: string, input: UsageInput): Promise<UsageResultDto> {
    await this.areas.get(tenantId, areaId);
    const { room, positions } = await this.validate(tenantId, areaId, input);
    if (input.externalId) {
      // Idempotent for the ELO interface: the same external id is the same Nutzung.
      const existing = await this.repo.findOne({ where: { tenantId, areaId, externalId: input.externalId }, relations: { positions: true } });
      if (existing) return this.toDto(tenantId, areaId, existing);
    }
    const saved = await this.repo.save(
      this.repo.create({
        tenantId,
        areaId,
        roomId: room.id,
        unit: input.unit.trim(),
        date: input.date,
        timeFrom: input.timeFrom,
        timeTo: input.timeTo,
        usageType: input.usageType,
        civilUsageKind: input.usageType === 'civil' ? (input.civilUsageKind ?? null) : null,
        personCount: input.personCount ?? null,
        recordedBy: input.recordedBy,
        source: input.source ?? 'manual',
        externalId: input.externalId ?? null,
        note: input.note?.trim() || null,
      }),
    );
    await this.positions.save(positions.map((p) => this.positions.create({ ...p, tenantId, areaId, usageId: saved.id })));
    await this.refreshStatus(tenantId, areaId);
    return this.toDto(tenantId, areaId, await this.get(tenantId, areaId, saved.id));
  }

  async update(tenantId: string, areaId: string, id: string, dto: UsageUpdateDto): Promise<UsageResultDto> {
    const usage = await this.get(tenantId, areaId, id);
    const merged: UsageCreateDto = {
      roomId: dto.roomId ?? usage.roomId,
      unit: dto.unit ?? usage.unit,
      date: dto.date ?? usage.date,
      timeFrom: dto.timeFrom ?? usage.timeFrom,
      timeTo: dto.timeTo ?? usage.timeTo,
      usageType: dto.usageType ?? usage.usageType,
      civilUsageKind: dto.civilUsageKind === undefined ? usage.civilUsageKind : dto.civilUsageKind,
      personCount: dto.personCount === undefined ? usage.personCount : dto.personCount,
      positions: dto.positions ?? usage.positions.map((p) => ({ combinationId: p.combinationId, quantity: p.quantity, quantityUnit: p.quantityUnit })),
      note: dto.note === undefined ? usage.note : dto.note,
    };
    const { room, positions } = await this.validate(tenantId, areaId, merged, { allowDisabled: !dto.positions && !dto.roomId });
    Object.assign(usage, {
      roomId: room.id,
      unit: merged.unit.trim(),
      date: merged.date,
      timeFrom: merged.timeFrom,
      timeTo: merged.timeTo,
      usageType: merged.usageType,
      civilUsageKind: merged.usageType === 'civil' ? (merged.civilUsageKind ?? null) : null,
      personCount: merged.personCount ?? null,
      note: merged.note?.trim() || null,
    });
    await this.repo.save({ ...usage, positions: undefined });
    if (dto.positions) {
      await this.positions.delete({ tenantId, usageId: usage.id });
      await this.positions.save(positions.map((p) => this.positions.create({ ...p, tenantId, areaId, usageId: usage.id })));
    }
    await this.refreshStatus(tenantId, areaId);
    return this.toDto(tenantId, areaId, await this.get(tenantId, areaId, id));
  }

  /** Soft delete, so the toast's "Rückgängig" can bring the rows back. */
  async remove(tenantId: string, areaId: string, ids: string[]): Promise<string[]> {
    const rows = await this.repo.find({ where: { tenantId, areaId, id: In(ids) } });
    if (rows.length) await this.repo.softRemove(rows);
    if (rows.length) await this.refreshStatus(tenantId, areaId);
    return rows.map((r) => r.id);
  }

  async restore(tenantId: string, areaId: string, ids: string[]): Promise<string[]> {
    const rows = await this.repo.find({ where: { tenantId, areaId, id: In(ids) }, withDeleted: true });
    const deleted = rows.filter((r) => r.deletedAt);
    if (deleted.length) await this.repo.recover(deleted);
    if (deleted.length) await this.refreshStatus(tenantId, areaId);
    return deleted.map((r) => r.id);
  }

  /**
   * The room must belong to the area, every position's combination must be
   * allowed for the room (5.17, an enabled assignment for new entries — a
   * historical usage keeps its now-disabled combination), the slot must be
   * a real interval of one day and the civil kind is mandatory for «Zivil».
   */
  private async validate(
    tenantId: string,
    areaId: string,
    input: UsageCreateDto,
    options: { allowDisabled?: boolean } = {},
  ): Promise<{ room: AreaRoomEntity; positions: Pick<UsagePositionEntity, 'combinationId' | 'quantity' | 'quantityUnit'>[] }> {
    const room = await this.rooms.findOne({ where: { tenantId, areaId, id: input.roomId } });
    if (!room) throw new BadRequestException('Unknown room for this area');
    if (!room.enabled && !options.allowDisabled) throw new BadRequestException('Room is inactive (historical)');
    if (input.timeTo <= input.timeFrom) throw new BadRequestException('timeTo must be after timeFrom');
    if (Number.isNaN(Date.parse(input.date))) throw new BadRequestException('Invalid date');
    if (input.usageType === 'civil' && !input.civilUsageKind) throw new BadRequestException('civilUsageKind is required for civil usages');
    if (!input.positions?.length) throw new BadRequestException('At least one position is required');

    const ids = [...new Set(input.positions.map((p) => p.combinationId))];
    if (ids.length !== input.positions.length) throw new BadRequestException('A combination may appear only once per usage');
    const [assignments, combinations] = await Promise.all([
      this.assignments.find({ where: { tenantId, areaId, roomId: room.id, combinationId: In(ids) } }),
      this.combinations.find({ where: { tenantId, id: In(ids) }, relations: { caliber: true } }),
    ]);
    const assigned = new Map(assignments.map((a) => [a.combinationId, a]));
    const combinationById = new Map(combinations.map((c) => [c.id, c]));
    const positions = input.positions.map((p: UsagePositionInputDto) => {
      const assignment = assigned.get(p.combinationId);
      const combination = combinationById.get(p.combinationId);
      if (!assignment || !combination) throw new BadRequestException(`Combination ${p.combinationId} is not assigned to this room`);
      if (!assignment.enabled && !options.allowDisabled) throw new BadRequestException(`Combination ${combination.nameDe} is no longer allowed for this room`);
      return { combinationId: p.combinationId, quantity: p.quantity, quantityUnit: p.quantityUnit ?? combination.caliber.quantityUnit };
    });
    return { room, positions };
  }

  private async toDto(tenantId: string, areaId: string, usage: AreaUsageEntity): Promise<UsageResultDto> {
    const [room, combinations] = await Promise.all([
      this.rooms.findOne({ where: { tenantId, id: usage.roomId } }),
      this.combinationsOf(tenantId, areaId),
    ]);
    return toUsageDto(usage, room ?? undefined, new Map(combinations.map((c) => [c.combinationId, c])));
  }

  private kpi(year: number, usages: AreaUsageEntity[], years: number[]): UsageKpiDto {
    const totalShots = usages.reduce((sum, u) => sum + total(u), 0);
    // «Zivilanteil»: the categories assessed under Anhang 7 (Zivil, SAT).
    const civil = usages.filter((u) => countsForAnnex7(u.usageType, false)).reduce((sum, u) => sum + total(u), 0);
    const lastDate = usages.reduce<string | null>((last, u) => (!last || u.date > last ? u.date : last), null);
    return {
      year,
      totalShots,
      count: usages.length,
      civilSharePercent: totalShots ? Math.round((civil / totalShots) * 100) : 0,
      lastDate,
      years: years.includes(year) ? years : [year, ...years].sort((a, b) => b - a),
    };
  }
}

/** Sum of the positions' quantities (units, whatever the unit). */
export function total(usage: AreaUsageEntity): number {
  return (usage.positions ?? []).reduce((sum, p) => sum + Number(p.quantity), 0);
}

export function toUsageDto(
  usage: AreaUsageEntity,
  room: AreaRoomEntity | undefined,
  combinations: Map<string, UsageCombinationDto>,
): UsageResultDto {
  const positions = (usage.positions ?? []).map((p) => {
    const c = combinations.get(p.combinationId);
    return {
      id: p.id,
      combinationId: p.combinationId,
      name: c?.entryName ?? c?.name ?? '',
      weapon: c?.weapon ?? '',
      caliber: c?.caliber ?? '',
      category: c?.category ?? '',
      quantity: Number(p.quantity),
      quantityUnit: p.quantityUnit,
    };
  });
  const units = new Set(positions.map((p) => p.quantityUnit));
  return {
    id: usage.id,
    areaId: usage.areaId,
    roomId: usage.roomId,
    roomName: room?.name ?? '',
    unit: usage.unit,
    date: usage.date,
    timeFrom: usage.timeFrom,
    timeTo: usage.timeTo,
    usageType: usage.usageType,
    civilUsageKind: usage.civilUsageKind ?? null,
    personCount: usage.personCount ?? null,
    positions,
    weaponName: positions.map((p) => p.name).join(', '),
    category: positions[0]?.category ?? '',
    shots: positions.reduce((s, p) => s + p.quantity, 0),
    quantityUnit: units.size === 1 ? ([...units][0] as 'shots' | 'kg') : units.size === 0 ? 'shots' : 'mixed',
    recordedBy: usage.recordedBy,
    source: usage.source,
    externalId: usage.externalId ?? null,
    note: usage.note,
    updatedAt: (usage.updatedAt instanceof Date ? usage.updatedAt : new Date(usage.updatedAt ?? Date.now())).toISOString(),
  };
}
