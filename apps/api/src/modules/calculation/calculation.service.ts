import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalculationDto } from './dto';
import {
  AreaCalculationEntity,
  AreaReceiverEntity,
  AreaWlrEntity,
} from './entities';

/** Levels of one calculation state, by receiver id, then by weapon (source) id. */
export type WlrIndex = Map<string, Map<string, AreaWlrEntity>>;

/**
 * Berechnungsgrundlagen (B1 5.18) of an area: the delivered states with
 * their sonARMS levels, and the receivers. Read side only — states are
 * created by the import (5.19), which is not part of the prototype.
 */
@Injectable()
export class CalculationService {
  constructor(
    @InjectRepository(AreaCalculationEntity)
    private readonly calculations: Repository<AreaCalculationEntity>,
    @InjectRepository(AreaReceiverEntity)
    private readonly receivers: Repository<AreaReceiverEntity>,
    @InjectRepository(AreaWlrEntity)
    private readonly wlr: Repository<AreaWlrEntity>,
  ) {}

  list(tenantId: string, areaId: string): Promise<AreaCalculationEntity[]> {
    return this.calculations.find({
      where: { tenantId, areaId, enabled: true },
      order: { deliveredAt: 'ASC' },
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

  listReceivers(tenantId: string, areaId: string): Promise<AreaReceiverEntity[]> {
    return this.receivers.find({
      where: { tenantId, areaId, enabled: true },
      order: { sortOrder: 'ASC', code: 'ASC' },
    });
  }

  async levels(tenantId: string, calculationId: string): Promise<WlrIndex> {
    const rows = await this.wlr.find({ where: { tenantId, calculationId } });
    const index: WlrIndex = new Map();
    for (const row of rows) {
      const perReceiver = index.get(row.receiverId) ?? new Map<string, AreaWlrEntity>();
      perReceiver.set(row.weaponId, row);
      index.set(row.receiverId, perReceiver);
    }
    return index;
  }

  async sourceCounts(tenantId: string, calculationIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (!calculationIds.length) return counts;
    const rows: { calculationId: string; n: string }[] = await this.wlr
      .createQueryBuilder('w')
      .select('w.calculationId', 'calculationId')
      .addSelect('count(distinct w.weaponId)', 'n')
      .where('w.tenantId = :tenantId', { tenantId })
      .andWhere('w.calculationId in (:...ids)', { ids: calculationIds })
      .groupBy('w.calculationId')
      .getRawMany();
    for (const row of rows) counts.set(row.calculationId, Number(row.n));
    return counts;
  }

  toDto(calc: AreaCalculationEntity, sourceCount = 0): CalculationDto {
    return {
      id: calc.id,
      name: calc.name,
      supplier: calc.supplier,
      deliveredAt: calc.deliveredAt,
      referenceYear: calc.referenceYear,
      buildYearClass: calc.buildYearClass,
      isCurrent: calc.isCurrent,
      isMgdm: calc.isMgdm,
      sourceCount,
    };
  }
}
