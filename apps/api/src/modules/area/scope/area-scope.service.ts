import { Injectable } from '@nestjs/common';
import { rawQuery } from '@api-slim/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { parseRoleSettings } from '@slim/shared';
import { AreaUserEntity } from '../entities/area-user.entity';

/** Role setting that turns a role into a «W/R-O» role (B1 8.1.2), see `SlimRoleSettings` (@slim/shared). */
export const OWN_AREAS_ONLY = 'ownAreasOnly';

/**
 * Which Schiessplätze a user may see and edit.
 *
 * `null` = unrestricted: none of the user's active roles carries
 * `settings.ownAreasOnly` (Fachspezialist, Interessent, Administrator — the
 * open system of B1 8.1). Otherwise the ids assigned in `schiessplatz_benutzer`.
 */
@Injectable()
export class AreaScopeService {
  constructor(
    @InjectRepository(AreaUserEntity)
    private readonly assignments: Repository<AreaUserEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async isRestricted(tenantId: string, userId: string): Promise<boolean> {
    const rows: { settings: string | null }[] = await rawQuery(this.dataSource,
      `select ar.settings as settings
         from app_user_right aur
         join app_role ar on ar.tenantId = aur.tenantId and ar.roleId = aur.roleId
        where aur.tenantId = ? and aur.userId = ?
          and (ar.state = 1 or ar.state is null or ar.state = 'true')`,
      [tenantId, userId],
    );
    if (!rows.length) return false;
    // Any unrestricted role opens everything (roles add up, they never narrow).
    return rows.every((row) => ownAreasOnly(row.settings));
  }

  async allowedAreaIds(tenantId: string, userId: string): Promise<string[] | null> {
    if (!(await this.isRestricted(tenantId, userId))) return null;
    const rows = await this.assignments.find({ where: { tenantId, userId }, select: ['areaId'] });
    return rows.map((r) => r.areaId);
  }

  async canAccess(tenantId: string, userId: string, areaId: string): Promise<boolean> {
    const allowed = await this.allowedAreaIds(tenantId, userId);
    return allowed === null || allowed.includes(areaId);
  }

  /** Assign / unassign (user administration, seed). */
  async assign(tenantId: string, userId: string, areaIds: string[]): Promise<void> {
    await this.assignments.delete({ tenantId, userId });
    if (areaIds.length) {
      await this.assignments.save(areaIds.map((areaId) => this.assignments.create({ tenantId, userId, areaId })));
    }
  }
}

function ownAreasOnly(settings: string | null | Record<string, unknown>): boolean {
  return Boolean(parseRoleSettings(settings)[OWN_AREAS_ONLY]);
}
