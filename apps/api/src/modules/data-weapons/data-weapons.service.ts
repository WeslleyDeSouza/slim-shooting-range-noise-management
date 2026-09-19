import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LogAction, LoggerService } from '../../core/logger';
import {
  AreaEntity,
  AreaQuotaEntity,
  CaliberEntity,
  RoomCombinationEntity,
  WeaponCategoryEntity,
  WeaponCombinationEntity,
  WeaponEntity,
} from '../area/entities';
import { SourceLineEntity } from '../calculation/entities';
import { UsagePositionEntity } from '../usage/entities';
import {
  CaliberDto,
  CaliberInputDto,
  CaliberUpdateDto,
  WeaponCategoryDto,
  WeaponCategoryInputDto,
  WeaponCategoryUpdateDto,
  WeaponCombinationDto,
  WeaponCombinationInputDto,
  WeaponCombinationUpdateDto,
  WeaponDto,
  WeaponInputDto,
  WeaponMasterDataDto,
  WeaponUpdateDto,
} from './dto';

/** Logbook reference types of the four master-data kinds. */
export const WEAPON_REF = {
  category: 'WEAPON_CATEGORY',
  weapon: 'WEAPON',
  caliber: 'CALIBER',
  combination: 'WEAPON_COMBINATION',
} as const;

/**
 * A record that is still referenced must not be deleted (FK RESTRICT would
 * refuse it anyway); the answer carries the count so the mask can suggest
 * «Inaktiv setzen» instead (B1 5.22–5.25 list «Löschen» as an action).
 */
export class InUseException extends ConflictException {
  constructor(kind: keyof typeof WEAPON_REF, inUse: number) {
    super({ statusCode: 409, message: `${kind}-in-use`, kind, inUse });
  }
}

/**
 * Datenverwaltung › Waffen (B1 5.22–5.25, `slm 22–25`): the übergeordneten
 * Stammdaten Waffenkategorie, Waffe, Kaliber and Kombination Waffe/Kaliber
 * (with the sonARMS mapping the import of a Zustand relies on, Kap. 7).
 * Tenant-wide, no area scope. Every mutation goes to the logbook.
 *
 * Deleting: only a record nothing references may go (409 with the count
 * otherwise, the mask offers «Inaktiv setzen»). It is then removed for
 * real: a soft-deleted row would keep its unique name / weapon × caliber
 * pair blocked forever (ELO worked around that by renaming the row); the
 * logbook keeps who deleted what.
 */
@Injectable()
export class DataWeaponsService {
  constructor(
    @InjectRepository(WeaponCategoryEntity)
    private readonly categories: Repository<WeaponCategoryEntity>,
    @InjectRepository(WeaponEntity)
    private readonly weapons: Repository<WeaponEntity>,
    @InjectRepository(CaliberEntity)
    private readonly calibers: Repository<CaliberEntity>,
    @InjectRepository(WeaponCombinationEntity)
    private readonly combinations: Repository<WeaponCombinationEntity>,
    @InjectRepository(RoomCombinationEntity)
    private readonly assignments: Repository<RoomCombinationEntity>,
    @InjectRepository(AreaQuotaEntity)
    private readonly quotas: Repository<AreaQuotaEntity>,
    @InjectRepository(UsagePositionEntity)
    private readonly positions: Repository<UsagePositionEntity>,
    @InjectRepository(SourceLineEntity)
    private readonly sources: Repository<SourceLineEntity>,
    @InjectRepository(AreaEntity)
    private readonly areas: Repository<AreaEntity>,
    @Optional() private readonly logger?: LoggerService,
  ) {}

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async list(tenantId: string): Promise<WeaponMasterDataDto> {
    const [categories, weapons, calibers, combinations, assignments, quotas, positions, sources, areas] = await Promise.all([
      this.categories.find({ where: { tenantId }, order: { sortOrder: 'ASC', nameDe: 'ASC' } }),
      this.weapons.find({ where: { tenantId }, order: { nameDe: 'ASC' } }),
      this.calibers.find({ where: { tenantId }, order: { nameDe: 'ASC' } }),
      this.combinations.find({ where: { tenantId }, order: { nameDe: 'ASC' } }),
      this.assignments.find({ where: { tenantId }, select: ['areaId', 'combinationId'] }),
      this.quotas.find({ where: { tenantId }, select: ['combinationId'] }),
      this.positions.find({ where: { tenantId }, select: ['combinationId'] }),
      this.sources.find({ where: { tenantId }, select: ['combinationId', 'weaponSystem'] }),
      this.areas.find({ where: { tenantId }, select: ['id', 'coordinationSectionNo', 'name'] }),
    ]);
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const weaponById = new Map(weapons.map((w) => [w.id, w]));
    const caliberById = new Map(calibers.map((c) => [c.id, c]));
    const areaById = new Map(areas.map((a) => [a.id, a]));

    const count = <T>(rows: T[], key: keyof T): Map<string, number> => {
      const m = new Map<string, number>();
      for (const r of rows) {
        const id = r[key] as unknown as string | null;
        if (id) m.set(id, (m.get(id) ?? 0) + 1);
      }
      return m;
    };
    const weaponsPerCategory = count(weapons, 'categoryId');
    const combinationsPerWeapon = count(combinations, 'weaponId');
    const combinationsPerCaliber = count(combinations, 'caliberId');
    const quotasPerCombination = count(quotas, 'combinationId');
    const positionsPerCombination = count(positions, 'combinationId');
    const sourcesPerCombination = count(sources, 'combinationId');
    const areasPerCombination = new Map<string, Set<string>>();
    for (const a of assignments) {
      if (!areasPerCombination.has(a.combinationId)) areasPerCombination.set(a.combinationId, new Set());
      areasPerCombination.get(a.combinationId)?.add(a.areaId);
    }

    const sonarms = new Set<string>();
    for (const s of sources) if (s.weaponSystem) sonarms.add(s.weaponSystem);
    for (const c of combinations) if (c.sonarmsId) sonarms.add(c.sonarmsId);

    return {
      categories: categories.map((c) => toCategoryDto(c, weaponsPerCategory.get(c.id) ?? 0)),
      weapons: weapons.map((w) => toWeaponDto(w, categoryById.get(w.categoryId), combinationsPerWeapon.get(w.id) ?? 0)),
      calibers: calibers.map((c) => toCaliberDto(c, combinationsPerCaliber.get(c.id) ?? 0)),
      combinations: combinations.map((k) => {
        const weapon = weaponById.get(k.weaponId);
        const areaIds = [...(areasPerCombination.get(k.id) ?? [])];
        const usage = {
          areas: areaIds
            .map((id) => areaById.get(id))
            .filter((a): a is AreaEntity => !!a)
            .sort((a, b) => a.coordinationSectionNo.localeCompare(b.coordinationSectionNo, 'de-CH', { numeric: true }))
            .map((a) => ({ id: a.id, coordinationSectionNo: a.coordinationSectionNo, name: a.name })),
          assignmentCount: assignments.filter((a) => a.combinationId === k.id).length,
          usageCount: positionsPerCombination.get(k.id) ?? 0,
          quotaCount: quotasPerCombination.get(k.id) ?? 0,
          sourceCount: sourcesPerCombination.get(k.id) ?? 0,
        };
        return toCombinationDto(k, weapon, caliberById.get(k.caliberId), weapon ? categoryById.get(weapon.categoryId) : undefined, usage);
      }),
      sonarmsOptions: [...sonarms].sort((a, b) => a.localeCompare(b, 'de-CH')),
    };
  }

  // ---------------------------------------------------------------------------
  // Waffenkategorie (5.25)
  // ---------------------------------------------------------------------------

  async createCategory(tenantId: string, dto: WeaponCategoryInputDto, userId: string): Promise<WeaponCategoryDto> {
    const nameDe = dto.nameDe.trim();
    await this.assertFree(this.categories, tenantId, { nameDe }, `Waffenkategorie «${nameDe}» besteht bereits`);
    const code = dto.code ?? (await this.freeCode(tenantId, slug(nameDe)));
    await this.assertFree(this.categories, tenantId, { code }, `Schlüssel «${code}» ist bereits vergeben`);
    const last = await this.categories.maximum('sortOrder', { tenantId });
    const saved = await this.categories.save(
      this.categories.create({
        tenantId,
        code,
        nameDe,
        nameFr: dto.nameFr?.trim() || null,
        nameIt: dto.nameIt?.trim() || null,
        sortOrder: dto.sortOrder ?? (last ?? -1) + 1,
        enabled: dto.enabled ?? true,
      }),
    );
    await this.log(tenantId, userId, LogAction.CREATE, 'category', saved.id, { nameDe: saved.nameDe, code: saved.code });
    return toCategoryDto(saved, 0);
  }

  async updateCategory(tenantId: string, id: string, dto: WeaponCategoryUpdateDto, userId: string): Promise<WeaponCategoryDto> {
    const row = await this.one(this.categories, tenantId, id, 'Waffenkategorie');
    const before = { ...row };
    if (dto.nameDe !== undefined) {
      const nameDe = dto.nameDe.trim();
      if (nameDe !== row.nameDe) await this.assertFree(this.categories, tenantId, { nameDe }, `Waffenkategorie «${nameDe}» besteht bereits`, id);
      row.nameDe = nameDe;
    }
    if (dto.code !== undefined && dto.code !== row.code) {
      await this.assertFree(this.categories, tenantId, { code: dto.code }, `Schlüssel «${dto.code}» ist bereits vergeben`, id);
      row.code = dto.code;
    }
    if (dto.nameFr !== undefined) row.nameFr = dto.nameFr?.trim() || null;
    if (dto.nameIt !== undefined) row.nameIt = dto.nameIt?.trim() || null;
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;
    if (dto.enabled !== undefined) row.enabled = dto.enabled;
    const saved = await this.categories.save(row);
    await this.log(tenantId, userId, LogAction.UPDATE, 'category', id, { nameDe: saved.nameDe, changes: diff(before, saved, ['nameDe', 'nameFr', 'nameIt', 'code', 'sortOrder', 'enabled']) });
    return toCategoryDto(saved, await this.weapons.count({ where: { tenantId, categoryId: id } }));
  }

  async deleteCategory(tenantId: string, id: string, userId: string): Promise<void> {
    const row = await this.one(this.categories, tenantId, id, 'Waffenkategorie');
    const inUse = await this.weapons.count({ where: { tenantId, categoryId: id } });
    if (inUse) throw new InUseException('category', inUse);
    await this.categories.remove(row);
    await this.log(tenantId, userId, LogAction.DELETE, 'category', id, { nameDe: row.nameDe, code: row.code });
  }

  // ---------------------------------------------------------------------------
  // Waffe (5.24)
  // ---------------------------------------------------------------------------

  async createWeapon(tenantId: string, dto: WeaponInputDto, userId: string): Promise<WeaponDto> {
    const nameDe = dto.nameDe.trim();
    await this.assertFree(this.weapons, tenantId, { nameDe }, `Waffe «${nameDe}» besteht bereits`);
    const category = await this.one(this.categories, tenantId, dto.categoryId, 'Waffenkategorie');
    const saved = await this.weapons.save(
      this.weapons.create({
        tenantId,
        nameDe,
        nameFr: dto.nameFr?.trim() || null,
        nameIt: dto.nameIt?.trim() || null,
        categoryId: category.id,
        annex7Category: dto.annex7Category ?? null,
        enabled: dto.enabled ?? true,
      }),
    );
    await this.log(tenantId, userId, LogAction.CREATE, 'weapon', saved.id, { nameDe: saved.nameDe, category: category.nameDe, annex7Category: saved.annex7Category });
    return toWeaponDto(saved, category, 0);
  }

  async updateWeapon(tenantId: string, id: string, dto: WeaponUpdateDto, userId: string): Promise<WeaponDto> {
    const row = await this.one(this.weapons, tenantId, id, 'Waffe');
    const before = { ...row };
    if (dto.nameDe !== undefined) {
      const nameDe = dto.nameDe.trim();
      if (nameDe !== row.nameDe) await this.assertFree(this.weapons, tenantId, { nameDe }, `Waffe «${nameDe}» besteht bereits`, id);
      row.nameDe = nameDe;
    }
    if (dto.categoryId !== undefined && dto.categoryId !== row.categoryId) {
      await this.one(this.categories, tenantId, dto.categoryId, 'Waffenkategorie');
      row.categoryId = dto.categoryId;
    }
    if (dto.nameFr !== undefined) row.nameFr = dto.nameFr?.trim() || null;
    if (dto.nameIt !== undefined) row.nameIt = dto.nameIt?.trim() || null;
    if (dto.annex7Category !== undefined) row.annex7Category = dto.annex7Category;
    if (dto.enabled !== undefined) row.enabled = dto.enabled;
    const saved = await this.weapons.save(row);
    const category = await this.one(this.categories, tenantId, saved.categoryId, 'Waffenkategorie');
    await this.log(tenantId, userId, LogAction.UPDATE, 'weapon', id, { nameDe: saved.nameDe, changes: diff(before, saved, ['nameDe', 'nameFr', 'nameIt', 'categoryId', 'annex7Category', 'enabled']) });
    return toWeaponDto(saved, category, await this.combinations.count({ where: { tenantId, weaponId: id } }));
  }

  async deleteWeapon(tenantId: string, id: string, userId: string): Promise<void> {
    const row = await this.one(this.weapons, tenantId, id, 'Waffe');
    const inUse = await this.combinations.count({ where: { tenantId, weaponId: id } });
    if (inUse) throw new InUseException('weapon', inUse);
    await this.weapons.remove(row);
    await this.log(tenantId, userId, LogAction.DELETE, 'weapon', id, { nameDe: row.nameDe });
  }

  // ---------------------------------------------------------------------------
  // Kaliber (5.23)
  // ---------------------------------------------------------------------------

  async createCaliber(tenantId: string, dto: CaliberInputDto, userId: string): Promise<CaliberDto> {
    const nameDe = dto.nameDe.trim();
    await this.assertFree(this.calibers, tenantId, { nameDe }, `Kaliber «${nameDe}» besteht bereits`);
    const saved = await this.calibers.save(
      this.calibers.create({
        tenantId,
        nameDe,
        nameFr: dto.nameFr?.trim() || null,
        nameIt: dto.nameIt?.trim() || null,
        alnNo: dto.alnNo?.trim() || null,
        sapNo: dto.sapNo?.trim() || null,
        quantityUnit: dto.quantityUnit ?? 'shots',
        enabled: dto.enabled ?? true,
      }),
    );
    await this.log(tenantId, userId, LogAction.CREATE, 'caliber', saved.id, { nameDe: saved.nameDe, alnNo: saved.alnNo, sapNo: saved.sapNo });
    return toCaliberDto(saved, 0);
  }

  async updateCaliber(tenantId: string, id: string, dto: CaliberUpdateDto, userId: string): Promise<CaliberDto> {
    const row = await this.one(this.calibers, tenantId, id, 'Kaliber');
    const before = { ...row };
    if (dto.nameDe !== undefined) {
      const nameDe = dto.nameDe.trim();
      if (nameDe !== row.nameDe) await this.assertFree(this.calibers, tenantId, { nameDe }, `Kaliber «${nameDe}» besteht bereits`, id);
      row.nameDe = nameDe;
    }
    if (dto.nameFr !== undefined) row.nameFr = dto.nameFr?.trim() || null;
    if (dto.nameIt !== undefined) row.nameIt = dto.nameIt?.trim() || null;
    if (dto.alnNo !== undefined) row.alnNo = dto.alnNo?.trim() || null;
    if (dto.sapNo !== undefined) row.sapNo = dto.sapNo?.trim() || null;
    if (dto.quantityUnit !== undefined) row.quantityUnit = dto.quantityUnit;
    if (dto.enabled !== undefined) row.enabled = dto.enabled;
    const saved = await this.calibers.save(row);
    await this.log(tenantId, userId, LogAction.UPDATE, 'caliber', id, { nameDe: saved.nameDe, changes: diff(before, saved, ['nameDe', 'nameFr', 'nameIt', 'alnNo', 'sapNo', 'quantityUnit', 'enabled']) });
    return toCaliberDto(saved, await this.combinations.count({ where: { tenantId, caliberId: id } }));
  }

  async deleteCaliber(tenantId: string, id: string, userId: string): Promise<void> {
    const row = await this.one(this.calibers, tenantId, id, 'Kaliber');
    const inUse = await this.combinations.count({ where: { tenantId, caliberId: id } });
    if (inUse) throw new InUseException('caliber', inUse);
    await this.calibers.remove(row);
    await this.log(tenantId, userId, LogAction.DELETE, 'caliber', id, { nameDe: row.nameDe });
  }

  // ---------------------------------------------------------------------------
  // Kombination Waffe/Kaliber (5.22)
  // ---------------------------------------------------------------------------

  async createCombination(tenantId: string, dto: WeaponCombinationInputDto, userId: string): Promise<WeaponCombinationDto> {
    const weapon = await this.one(this.weapons, tenantId, dto.weaponId, 'Waffe');
    const caliber = await this.one(this.calibers, tenantId, dto.caliberId, 'Kaliber');
    const pair = await this.combinations.findOne({ where: { tenantId, weaponId: weapon.id, caliberId: caliber.id } });
    if (pair) throw new ConflictException(`Die Kombination ${weapon.nameDe} × ${caliber.nameDe} besteht bereits («${pair.nameDe}»)`);
    const nameDe = dto.nameDe?.trim() || `${weapon.nameDe} · ${caliber.nameDe}`;
    const saved = await this.combinations.save(
      this.combinations.create({
        tenantId,
        weaponId: weapon.id,
        caliberId: caliber.id,
        nameDe,
        nameFr: dto.nameFr?.trim() || null,
        nameIt: dto.nameIt?.trim() || null,
        sonarmsId: dto.sonarmsId?.trim() || null,
        enabled: dto.enabled ?? true,
      }),
    );
    await this.log(tenantId, userId, LogAction.CREATE, 'combination', saved.id, { nameDe: saved.nameDe, weapon: weapon.nameDe, caliber: caliber.nameDe, sonarmsId: saved.sonarmsId });
    const category = await this.one(this.categories, tenantId, weapon.categoryId, 'Waffenkategorie');
    return toCombinationDto(saved, weapon, caliber, category, { areas: [], assignmentCount: 0, usageCount: 0, quotaCount: 0, sourceCount: 0 });
  }

  async updateCombination(tenantId: string, id: string, dto: WeaponCombinationUpdateDto, userId: string): Promise<WeaponCombinationDto> {
    const row = await this.one(this.combinations, tenantId, id, 'Kombination Waffe/Kaliber');
    const before = { ...row };
    const weaponId = dto.weaponId ?? row.weaponId;
    const caliberId = dto.caliberId ?? row.caliberId;
    const weapon = await this.one(this.weapons, tenantId, weaponId, 'Waffe');
    const caliber = await this.one(this.calibers, tenantId, caliberId, 'Kaliber');
    if (weaponId !== row.weaponId || caliberId !== row.caliberId) {
      const pair = await this.combinations.findOne({ where: { tenantId, weaponId, caliberId } });
      if (pair && pair.id !== id) throw new ConflictException(`Die Kombination ${weapon.nameDe} × ${caliber.nameDe} besteht bereits («${pair.nameDe}»)`);
      row.weaponId = weaponId;
      row.caliberId = caliberId;
    }
    if (dto.nameDe !== undefined) row.nameDe = dto.nameDe.trim() || `${weapon.nameDe} · ${caliber.nameDe}`;
    if (dto.nameFr !== undefined) row.nameFr = dto.nameFr?.trim() || null;
    if (dto.nameIt !== undefined) row.nameIt = dto.nameIt?.trim() || null;
    if (dto.sonarmsId !== undefined) row.sonarmsId = dto.sonarmsId?.trim() || null;
    if (dto.enabled !== undefined) row.enabled = dto.enabled;
    const saved = await this.combinations.save(row);
    await this.log(tenantId, userId, LogAction.UPDATE, 'combination', id, { nameDe: saved.nameDe, changes: diff(before, saved, ['nameDe', 'nameFr', 'nameIt', 'weaponId', 'caliberId', 'sonarmsId', 'enabled']) });
    const category = await this.one(this.categories, tenantId, weapon.categoryId, 'Waffenkategorie');
    return toCombinationDto(saved, weapon, caliber, category, await this.combinationUsage(tenantId, id));
  }

  async deleteCombination(tenantId: string, id: string, userId: string): Promise<void> {
    const row = await this.one(this.combinations, tenantId, id, 'Kombination Waffe/Kaliber');
    const usage = await this.combinationUsage(tenantId, id);
    const inUse = usage.assignmentCount + usage.usageCount + usage.quotaCount + usage.sourceCount;
    if (inUse) throw new InUseException('combination', inUse);
    await this.combinations.remove(row);
    await this.log(tenantId, userId, LogAction.DELETE, 'combination', id, { nameDe: row.nameDe });
  }

  // ---------------------------------------------------------------------------

  private async combinationUsage(tenantId: string, combinationId: string): Promise<CombinationUsage> {
    const [assignments, usageCount, quotaCount, sourceCount] = await Promise.all([
      this.assignments.find({ where: { tenantId, combinationId }, select: ['areaId'] }),
      this.positions.count({ where: { tenantId, combinationId } }),
      this.quotas.count({ where: { tenantId, combinationId } }),
      this.sources.count({ where: { tenantId, combinationId } }),
    ]);
    const areaIds = [...new Set(assignments.map((a) => a.areaId))];
    const areas = areaIds.length ? await this.areas.find({ where: { tenantId, id: In(areaIds) }, select: ['id', 'coordinationSectionNo', 'name'] }) : [];
    return {
      areas: areas
        .sort((a, b) => a.coordinationSectionNo.localeCompare(b.coordinationSectionNo, 'de-CH', { numeric: true }))
        .map((a) => ({ id: a.id, coordinationSectionNo: a.coordinationSectionNo, name: a.name })),
      assignmentCount: assignments.length,
      usageCount,
      quotaCount,
      sourceCount,
    };
  }

  private async one<T extends { id: string }>(repo: Repository<T>, tenantId: string, id: string, label: string): Promise<T> {
    const row = await repo.findOne({ where: { tenantId, id } as never });
    if (!row) throw new NotFoundException(`${label} ${id} nicht gefunden`);
    return row;
  }

  private async assertFree<T extends { id: string }>(
    repo: Repository<T>,
    tenantId: string,
    where: Record<string, unknown>,
    message: string,
    exceptId?: string,
  ): Promise<void> {
    const clash = await repo.findOne({ where: { tenantId, ...where } as never });
    if (clash && clash.id !== exceptId) throw new ConflictException(message);
  }

  private async freeCode(tenantId: string, base: string): Promise<string> {
    let code = base || 'category';
    for (let n = 2; await this.categories.exists({ where: { tenantId, code } }); n++) code = `${base}_${n}`.slice(0, 40);
    return code;
  }

  private log(tenantId: string, userId: string, action: LogAction, kind: keyof typeof WEAPON_REF, refId: string, data: Record<string, unknown>): Promise<unknown> {
    return Promise.resolve(
      this.logger?.createLog({ tenantId, userId, section: 'WEAPON', action, refType: WEAPON_REF[kind], refId, data }),
    );
  }
}

interface CombinationUsage {
  areas: { id: string; coordinationSectionNo: string; name: string }[];
  assignmentCount: number;
  usageCount: number;
  quotaCount: number;
  sourceCount: number;
}

/** «Sturmgewehre und Handfeuerwaffen» → `sturmgewehre_und_handfeuerwaffen`. */
export function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function diff<T extends object>(before: T, after: T, fields: (keyof T)[]): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const f of fields) {
    if (before[f] !== after[f]) out[String(f)] = { from: before[f] ?? null, to: after[f] ?? null };
  }
  return out;
}

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value ?? '');
}

function toCategoryDto(c: WeaponCategoryEntity, weaponCount: number): WeaponCategoryDto {
  return {
    id: c.id,
    code: c.code,
    nameDe: c.nameDe,
    nameFr: c.nameFr,
    nameIt: c.nameIt,
    sortOrder: c.sortOrder,
    enabled: Boolean(c.enabled),
    weaponCount,
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
  };
}

function toWeaponDto(w: WeaponEntity, category: WeaponCategoryEntity | undefined, combinationCount: number): WeaponDto {
  return {
    id: w.id,
    nameDe: w.nameDe,
    nameFr: w.nameFr,
    nameIt: w.nameIt,
    categoryId: w.categoryId,
    categoryName: category?.nameDe ?? '',
    annex7Category: w.annex7Category,
    enabled: Boolean(w.enabled),
    combinationCount,
    createdAt: iso(w.createdAt),
    updatedAt: iso(w.updatedAt),
  };
}

function toCaliberDto(c: CaliberEntity, combinationCount: number): CaliberDto {
  return {
    id: c.id,
    nameDe: c.nameDe,
    nameFr: c.nameFr,
    nameIt: c.nameIt,
    alnNo: c.alnNo,
    sapNo: c.sapNo,
    quantityUnit: c.quantityUnit,
    enabled: Boolean(c.enabled),
    combinationCount,
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
  };
}

function toCombinationDto(
  k: WeaponCombinationEntity,
  weapon: WeaponEntity | undefined,
  caliber: CaliberEntity | undefined,
  category: WeaponCategoryEntity | undefined,
  usage: CombinationUsage,
): WeaponCombinationDto {
  return {
    id: k.id,
    nameDe: k.nameDe,
    nameFr: k.nameFr,
    nameIt: k.nameIt,
    weaponId: k.weaponId,
    weaponName: weapon?.nameDe ?? '',
    caliberId: k.caliberId,
    caliberName: caliber?.nameDe ?? '',
    categoryId: weapon?.categoryId ?? '',
    categoryName: category?.nameDe ?? '',
    sonarmsId: k.sonarmsId,
    enabled: Boolean(k.enabled),
    areas: usage.areas,
    usageCount: usage.usageCount,
    quotaCount: usage.quotaCount,
    sourceCount: usage.sourceCount,
    inUse: usage.assignmentCount + usage.usageCount + usage.quotaCount + usage.sourceCount,
    createdAt: iso(k.createdAt),
    updatedAt: iso(k.updatedAt),
  };
}
