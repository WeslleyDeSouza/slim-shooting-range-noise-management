import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CalculationDto } from './dto';
import {
  AreaCalculationEntity,
  AreaWlrEntity,
  ImmissionPointEntity,
  PlantPartEntity,
  SourceLineEntity,
  TimeGroup,
} from './entities';

/** Levels of one source line at one point, per Zeitgruppe. */
export interface PointSourceLevels {
  day?: { lae: number; lafmax: number };
  eve?: { lae: number; lafmax: number };
}

/** WLR index of one state: point id → source line id → levels. */
export type WlrIndex = Map<string, Map<string, PointSourceLevels>>;

/**
 * Everything the calculation needs of one Zustand — its own Anlageteile,
 * Schusslinien (with Quelldaten and Kombination), Immissionspunkte and
 * WLR-Pegel. Loaded once per request; nothing of another state is in it.
 */
export interface StateModel {
  state: AreaCalculationEntity;
  plantParts: PlantPartEntity[];
  sources: SourceLineEntity[];
  points: ImmissionPointEntity[];
  wlr: WlrIndex;
}

/**
 * Berechnungsgrundlagen (B1 5.18) of an area: the delivered states with
 * their model data. States are created by the `ImportService` (5.19); this
 * service reads them and switches the «aktuell gültig» / «Stand MGDM»
 * pointers (exactly one each per Schiessplatz, in one transaction).
 */
@Injectable()
export class CalculationService {
  constructor(
    @InjectRepository(AreaCalculationEntity)
    private readonly states: Repository<AreaCalculationEntity>,
    @InjectRepository(PlantPartEntity)
    private readonly plantParts: Repository<PlantPartEntity>,
    @InjectRepository(SourceLineEntity)
    private readonly sources: Repository<SourceLineEntity>,
    @InjectRepository(ImmissionPointEntity)
    private readonly points: Repository<ImmissionPointEntity>,
    @InjectRepository(AreaWlrEntity)
    private readonly wlr: Repository<AreaWlrEntity>,
    private readonly dataSource: DataSource,
  ) {}

  list(tenantId: string, areaId: string): Promise<AreaCalculationEntity[]> {
    return this.states.find({
      where: { tenantId, areaId, enabled: true },
      relations: { calculation: true },
      order: { calculation: { deliveredAt: 'ASC' }, referenceYear: 'ASC' },
    });
  }

  /** The requested state, else the current one, else null (area without calculation). */
  async resolve(
    tenantId: string,
    areaId: string,
    calculationId?: string,
  ): Promise<{ all: AreaCalculationEntity[]; selected: AreaCalculationEntity | null; current: AreaCalculationEntity | null }> {
    const all = await this.list(tenantId, areaId);
    const current = all.find((c) => c.isCurrent) ?? all[all.length - 1] ?? null;
    if (!calculationId) return { all, selected: current, current };
    const selected = all.find((c) => c.id === calculationId);
    if (!selected) throw new NotFoundException(`Calculation ${calculationId} not found`);
    return { all, selected, current };
  }

  /** The complete model of one state. */
  async loadModel(tenantId: string, state: AreaCalculationEntity): Promise<StateModel> {
    const [plantParts, sources, points, rows] = await Promise.all([
      this.plantParts.find({ where: { tenantId, zustandId: state.id } }),
      this.sources.find({ where: { tenantId, zustandId: state.id }, relations: { dataA9: true, dataA7: true, combination: { weapon: true } } }),
      this.points.find({ where: { tenantId, zustandId: state.id }, order: { sortOrder: 'ASC', code: 'ASC' } }),
      this.wlr.find({ where: { tenantId, zustandId: state.id } }),
    ]);
    const wlr: WlrIndex = new Map();
    for (const row of rows) {
      const perPoint = wlr.get(row.immissionPointId) ?? new Map<string, PointSourceLevels>();
      const levels = perPoint.get(row.sourceLineId) ?? {};
      levels[row.timeGroup as TimeGroup] = { lae: row.lae, lafmax: row.lafmax };
      perPoint.set(row.sourceLineId, levels);
      wlr.set(row.immissionPointId, perPoint);
    }
    return { state, plantParts, sources, points, wlr };
  }

  /** Number of Schusslinien per state (for the state selector). */
  async sourceCounts(tenantId: string, stateIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (!stateIds.length) return counts;
    const rows = await this.sources.find({ where: { tenantId, zustandId: In(stateIds) }, select: ['zustandId'] });
    for (const row of rows) counts.set(row.zustandId, (counts.get(row.zustandId) ?? 0) + 1);
    return counts;
  }

  /**
   * 5.18: set the «aktuell gültig» and/or «Stand MGDM» pointer of an area to
   * one state. The other states lose the flag in the same transaction, so
   * there is never more or less than one.
   */
  async setPointer(tenantId: string, areaId: string, stateId: string, pointer: 'current' | 'mgdm'): Promise<AreaCalculationEntity> {
    const state = await this.states.findOne({ where: { tenantId, areaId, id: stateId, enabled: true } });
    if (!state) throw new NotFoundException(`Calculation ${stateId} not found`);
    const flag = pointer === 'current' ? 'isCurrent' : 'isMgdm';
    const key = pointer === 'current' ? 'currentKey' : 'mgdmKey';
    await this.dataSource.transaction(async (em) => {
      const repo = em.getRepository(AreaCalculationEntity);
      await repo.update({ tenantId, areaId }, { [flag]: false, [key]: null });
      // The unique index on (tenantId, key) makes a second current/MGDM state impossible.
      await repo.update({ tenantId, areaId, id: stateId }, { [flag]: true, [key]: areaId });
    });
    const updated = await this.states.findOne({ where: { tenantId, id: stateId } });
    if (!updated) throw new BadRequestException('State vanished while switching the pointer');
    return updated;
  }

  toDto(calc: AreaCalculationEntity, sourceCount = 0): CalculationDto {
    return {
      id: calc.id,
      externalId: calc.externalId,
      name: calc.name,
      calculationId: calc.calculationId,
      calculationName: calc.calculation?.name ?? '',
      supplier: calc.calculation?.supplier ?? '',
      deliveredAt: calc.calculation?.deliveredAt ?? '',
      referenceYear: calc.referenceYear,
      buildYearClass: calc.buildYearClass,
      // SQLite hands booleans back as 0/1.
      isCurrent: Boolean(calc.isCurrent),
      isMgdm: Boolean(calc.isMgdm),
      sourceCount,
    };
  }
}
