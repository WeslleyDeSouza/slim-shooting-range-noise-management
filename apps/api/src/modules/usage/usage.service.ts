import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { countsForAnnex7 } from '@slim/lsv';
import { AreaRoomEntity, AreaWeaponEntity } from '../area/entities';
import { AreaService } from '../area/area.service';
import {
  UsageCreateDto,
  UsageKpiDto,
  UsageOverviewDto,
  UsageResultDto,
  UsageUpdateDto,
  UsageWeaponDto,
} from './dto';
import { AreaUsageEntity } from './entities';

/** Fields the caller may set; the rest is derived or audit. */
type UsageInput = UsageCreateDto & { recordedBy: string };

/**
 * Schiessplatz-Nutzungen (B1 5.11): the shots page and the source data of
 * the noise calculation. Everything is scoped by tenant + area; the area
 * must exist for the tenant (AreaService.get throws 404 otherwise).
 */
@Injectable()
export class UsageService {
  constructor(
    @InjectRepository(AreaUsageEntity)
    private readonly repo: Repository<AreaUsageEntity>,
    @InjectRepository(AreaRoomEntity)
    private readonly rooms: Repository<AreaRoomEntity>,
    @InjectRepository(AreaWeaponEntity)
    private readonly weapons: Repository<AreaWeaponEntity>,
    private readonly areas: AreaService,
  ) {}

  /** Usages of one calendar year, newest first; rooms and weapons of the area. */
  async overview(
    tenantId: string,
    areaId: string,
    year: number,
  ): Promise<UsageOverviewDto> {
    await this.areas.get(tenantId, areaId);
    const [rooms, weapons, usages, years] = await Promise.all([
      this.rooms.find({
        where: { tenantId, areaId, enabled: true },
        order: { sortOrder: 'ASC', name: 'ASC' },
      }),
      this.weapons.find({
        where: { tenantId, areaId, enabled: true },
        order: { category: 'ASC', weaponName: 'ASC' },
      }),
      this.listYear(tenantId, areaId, year),
      this.years(tenantId, areaId),
    ]);

    const byRoom = new Map<string, { count: number; shots: number }>();
    for (const usage of usages) {
      const entry = byRoom.get(usage.roomId) ?? { count: 0, shots: 0 };
      entry.count++;
      entry.shots += usage.shots;
      byRoom.set(usage.roomId, entry);
    }

    const weaponById = new Map(weapons.map((w) => [w.id, w]));
    const roomById = new Map(rooms.map((r) => [r.id, r]));

    return {
      kpi: this.kpi(year, usages, years),
      rooms: rooms.map((room) => ({
        id: room.id,
        coordinationSectionNo: room.coordinationSectionNo,
        name: room.name,
        groupName: room.groupName,
        builtAfter1985: Boolean(room.builtAfter1985),
        usageCount: byRoom.get(room.id)?.count ?? 0,
        shots: byRoom.get(room.id)?.shots ?? 0,
      })),
      weapons: weapons.map(toWeaponDto),
      usages: usages.map((usage) =>
        toUsageDto(usage, roomById.get(usage.roomId), weaponById.get(usage.weaponId)),
      ),
    };
  }

  listYear(
    tenantId: string,
    areaId: string,
    year: number,
  ): Promise<AreaUsageEntity[]> {
    return this.listRange(tenantId, areaId, `${year}-01-01`, `${year}-12-31`);
  }

  /** Usages with `from <= date <= to` (both YYYY-MM-DD, inclusive). */
  listRange(
    tenantId: string,
    areaId: string,
    from: string,
    to: string,
  ): Promise<AreaUsageEntity[]> {
    return this.repo
      .createQueryBuilder('u')
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
    const usage = await this.repo.findOne({ where: { tenantId, areaId, id } });
    if (!usage) throw new NotFoundException(`Usage ${id} not found`);
    return usage;
  }

  async create(
    tenantId: string,
    areaId: string,
    input: UsageInput,
  ): Promise<UsageResultDto> {
    await this.areas.get(tenantId, areaId);
    const { room, weapon } = await this.validate(tenantId, areaId, input);
    const saved = await this.repo.save(
      this.repo.create({
        tenantId,
        areaId,
        roomId: room.id,
        weaponId: weapon.id,
        unit: input.unit.trim(),
        date: input.date,
        timeFrom: input.timeFrom,
        timeTo: input.timeTo,
        usageType: input.usageType,
        shots: input.shots,
        quantityUnit: input.quantityUnit ?? 'shots',
        recordedBy: input.recordedBy,
        source: 'manual',
        note: input.note?.trim() || null,
      }),
    );
    return toUsageDto(saved, room, weapon);
  }

  async update(
    tenantId: string,
    areaId: string,
    id: string,
    dto: UsageUpdateDto,
  ): Promise<UsageResultDto> {
    const usage = await this.get(tenantId, areaId, id);
    const merged = { ...usage, ...dto };
    const { room, weapon } = await this.validate(tenantId, areaId, merged);
    Object.assign(usage, {
      roomId: room.id,
      weaponId: weapon.id,
      unit: merged.unit.trim(),
      date: merged.date,
      timeFrom: merged.timeFrom,
      timeTo: merged.timeTo,
      usageType: merged.usageType,
      shots: merged.shots,
      quantityUnit: merged.quantityUnit ?? usage.quantityUnit,
      note: merged.note?.trim() || null,
    });
    const saved = await this.repo.save(usage);
    return toUsageDto(saved, room, weapon);
  }

  /** Soft delete, so the toast's "Rückgängig" can bring the rows back. */
  async remove(tenantId: string, areaId: string, ids: string[]): Promise<string[]> {
    const rows = await this.repo.find({ where: { tenantId, areaId, id: In(ids) } });
    if (rows.length) await this.repo.softRemove(rows);
    return rows.map((r) => r.id);
  }

  async restore(tenantId: string, areaId: string, ids: string[]): Promise<string[]> {
    const rows = await this.repo.find({
      where: { tenantId, areaId, id: In(ids) },
      withDeleted: true,
    });
    const deleted = rows.filter((r) => r.deletedAt);
    if (deleted.length) await this.repo.recover(deleted);
    return deleted.map((r) => r.id);
  }

  /**
   * Room and weapon must belong to the area, the weapon to the room
   * (5.17 allowed combinations), and the slot must be a real interval.
   */
  private async validate(
    tenantId: string,
    areaId: string,
    input: Pick<UsageCreateDto, 'roomId' | 'weaponId' | 'timeFrom' | 'timeTo' | 'date'>,
  ): Promise<{ room: AreaRoomEntity; weapon: AreaWeaponEntity }> {
    const [room, weapon] = await Promise.all([
      this.rooms.findOne({ where: { tenantId, areaId, id: input.roomId } }),
      this.weapons.findOne({ where: { tenantId, areaId, id: input.weaponId } }),
    ]);
    if (!room) throw new BadRequestException('Unknown room for this area');
    if (!weapon) throw new BadRequestException('Unknown weapon for this area');
    if (weapon.roomId !== room.id) {
      throw new BadRequestException('Weapon is not assigned to this room');
    }
    if (input.timeTo <= input.timeFrom) {
      throw new BadRequestException('timeTo must be after timeFrom');
    }
    if (Number.isNaN(Date.parse(input.date))) {
      throw new BadRequestException('Invalid date');
    }
    return { room, weapon };
  }

  private kpi(year: number, usages: AreaUsageEntity[], years: number[]): UsageKpiDto {
    const totalShots = usages.reduce((sum, u) => sum + u.shots, 0);
    // «Zivilanteil»: the categories assessed under Anhang 7 (Zivil, SAT).
    const civil = usages
      .filter((u) => countsForAnnex7(u.usageType, false))
      .reduce((sum, u) => sum + u.shots, 0);
    const lastDate = usages.reduce<string | null>(
      (last, u) => (!last || u.date > last ? u.date : last),
      null,
    );
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

export function toWeaponDto(weapon: AreaWeaponEntity): UsageWeaponDto {
  return {
    id: weapon.id,
    roomId: weapon.roomId,
    weaponName: weapon.weaponName,
    weapon: weapon.weapon,
    caliber: weapon.caliber,
    category: weapon.category,
    annex7Category: weapon.annex7Category,
    quota: weapon.quota,
  };
}

export function toUsageDto(
  usage: AreaUsageEntity,
  room?: AreaRoomEntity,
  weapon?: AreaWeaponEntity,
): UsageResultDto {
  return {
    id: usage.id,
    areaId: usage.areaId,
    roomId: usage.roomId,
    roomName: room?.name ?? '',
    weaponId: usage.weaponId,
    weaponName: weapon?.weaponName ?? '',
    category: weapon?.category ?? 'handguns',
    unit: usage.unit,
    date: usage.date,
    timeFrom: usage.timeFrom,
    timeTo: usage.timeTo,
    usageType: usage.usageType,
    shots: usage.shots,
    quantityUnit: usage.quantityUnit,
    recordedBy: usage.recordedBy,
    source: usage.source,
    note: usage.note,
    updatedAt: (usage.updatedAt instanceof Date
      ? usage.updatedAt
      : new Date(usage.updatedAt ?? Date.now())
    ).toISOString(),
  };
}
