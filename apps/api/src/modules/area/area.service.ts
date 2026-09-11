import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  AreaCreateDto,
  AreaSummaryDto,
  AreaUpdateDto,
  DashboardDto,
} from './dto';
import { AreaEntity, AreaStatus } from './entities';

const ORDER: AreaStatus[] = ['none', 'ok', 'warn', 'over'];

/** Worst status of two: over > warn > ok > none. */
export function worstStatus(a: AreaStatus, b: AreaStatus): AreaStatus {
  return ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b;
}

export function needsAttention(
  area: Pick<AreaEntity, 'quotaStatus' | 'noiseStatus'>,
): boolean {
  return (
    ['warn', 'over'].includes(area.quotaStatus) ||
    ['warn', 'over'].includes(area.noiseStatus)
  );
}

@Injectable()
export class AreaService {
  constructor(
    @InjectRepository(AreaEntity)
    protected readonly repo: Repository<AreaEntity>,
    protected readonly dataSource: DataSource,
  ) {}

  list(tenantId: string): Promise<AreaEntity[]> {
    return this.repo.find({
      where: { tenantId },
      order: { coordinationSectionNo: 'ASC' },
    });
  }

  async get(tenantId: string, id: string): Promise<AreaEntity> {
    const area = await this.repo.findOne({ where: { tenantId, id } });
    if (!area) throw new NotFoundException(`Area ${id} not found`);
    return area;
  }

  create(tenantId: string, dto: AreaCreateDto): Promise<AreaEntity> {
    return this.repo.save(
      this.repo.create({
        tenantId,
        quotaStatus: 'none',
        noiseStatus: 'none',
        enabled: true,
        ...dto,
      }),
    );
  }

  async update(
    tenantId: string,
    id: string,
    dto: AreaUpdateDto,
  ): Promise<AreaEntity> {
    const area = await this.get(tenantId, id);
    Object.assign(area, dto);
    return this.repo.save(area);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const area = await this.get(tenantId, id);
    await this.repo.softRemove(area);
  }

  async summary(tenantId: string): Promise<AreaSummaryDto> {
    const summary: AreaSummaryDto = {
      total: 0,
      ok: 0,
      warn: 0,
      over: 0,
      none: 0,
      attention: 0,
    };
    for (const area of await this.list(tenantId)) {
      summary.total++;
      summary[worstStatus(area.quotaStatus, area.noiseStatus)]++;
      if (needsAttention(area)) summary.attention++;
    }
    return summary;
  }

  async dashboard(tenantId: string): Promise<DashboardDto> {
    const areas = await this.repo.count({ where: { tenantId } });
    // Users of this tenant (galaxy tables). No weapons module yet → null.
    const [row] = await this.dataSource.query(
      'select count(distinct userId) as n from tenant_user_role where tenantId = ?',
      [tenantId],
    );
    return { areas, users: Number(row?.n ?? 0), weapons: null };
  }
}
