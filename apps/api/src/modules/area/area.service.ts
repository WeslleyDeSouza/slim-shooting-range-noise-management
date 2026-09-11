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
import { AreaScopeService } from './scope/area-scope.service';

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

/** SQLite hands booleans back as 0/1; the DTO promises real booleans. */
function normalise(area: AreaEntity): AreaEntity {
  area.enabled = Boolean(area.enabled);
  area.annex7Overall = Boolean(area.annex7Overall);
  return area;
}

@Injectable()
export class AreaService {
  constructor(
    @InjectRepository(AreaEntity)
    protected readonly repo: Repository<AreaEntity>,
    protected readonly dataSource: DataSource,
    protected readonly scope: AreaScopeService,
  ) {}

  /**
   * All areas of the tenant; with `userId` only the ones the user may see
   * («W/R-O» roles, B1 8.1.2 — AreaScopeService).
   */
  async list(tenantId: string, userId?: string): Promise<AreaEntity[]> {
    const areas = await this.repo.find({
      where: { tenantId },
      order: { coordinationSectionNo: 'ASC' },
    });
    const allowed = userId ? await this.scope.allowedAreaIds(tenantId, userId) : null;
    return areas.filter((a) => allowed === null || allowed.includes(a.id)).map(normalise);
  }

  async get(tenantId: string, id: string): Promise<AreaEntity> {
    const area = await this.repo.findOne({ where: { tenantId, id } });
    if (!area) throw new NotFoundException(`Area ${id} not found`);
    return normalise(area);
  }

  create(tenantId: string, dto: AreaCreateDto): Promise<AreaEntity> {
    return this.repo.save(
      this.repo.create({
        tenantId,
        quotaStatus: 'none',
        noiseStatus: 'none',
        annex7Overall: false,
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

  async summary(tenantId: string, userId?: string): Promise<AreaSummaryDto> {
    const summary: AreaSummaryDto = {
      total: 0,
      ok: 0,
      warn: 0,
      over: 0,
      none: 0,
      attention: 0,
    };
    for (const area of await this.list(tenantId, userId)) {
      summary.total++;
      summary[worstStatus(area.quotaStatus, area.noiseStatus)]++;
      if (needsAttention(area)) summary.attention++;
    }
    return summary;
  }

  async dashboard(tenantId: string): Promise<DashboardDto> {
    const areas = await this.repo.count({ where: { tenantId } });
    // Users of this tenant (galaxy tables); distinct weapons of the allowed
    // room × weapon combinations (5.17).
    const [[row], [weaponRow]] = await Promise.all([
      this.dataSource.query(
        'select count(distinct userId) as n from tenant_user_role where tenantId = ?',
        [tenantId],
      ),
      this.dataSource.query(
        'select count(distinct weapon) as n from area_weapon where tenantId = ? and deletedAt is null',
        [tenantId],
      ),
    ]);
    return {
      areas,
      users: Number(row?.n ?? 0),
      weapons: Number(weaponRow?.n ?? 0),
    };
  }
}
