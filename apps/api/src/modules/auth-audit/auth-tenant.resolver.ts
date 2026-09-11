import { Injectable } from '@nestjs/common';
import { TenantEntity, TenantUserRoleEntity } from '@app-galaxy/core-api';
import { DataSource } from 'typeorm';

/**
 * Tenant of an authentication event. Login, failed login and password
 * events happen *before* a tenant is selected, so their hook context has no
 * `tenantId` — but the logbook is tenant-scoped (`logbuch.tenantId`),
 * and rows without a tenant would never show up in the Logbuch (slm 56).
 *
 * Resolution order: the context's tenant; else every tenant the account is
 * a member of (`tenant_user_role`); else — unknown account or no membership
 * — the only tenant of the installation, when there is exactly one (SLIM is
 * single-tenant per installation). Otherwise the row stays unscoped.
 */
@Injectable()
export class AuthTenantResolver {
  constructor(private readonly dataSource: DataSource) {}

  async forEvent(ctx: {
    tenantId?: string | number | null;
    userId?: string | null;
  }): Promise<string[]> {
    if (ctx.tenantId !== undefined && ctx.tenantId !== null && ctx.tenantId !== '') {
      return [String(ctx.tenantId)];
    }
    if (ctx.userId) {
      const rows = await this.dataSource
        .getRepository(TenantUserRoleEntity)
        .createQueryBuilder('m')
        .select('DISTINCT m.tenantId', 'tenantId')
        .where('m.userId = :userId', { userId: ctx.userId })
        .getRawMany<{ tenantId: string }>();
      const tenants = rows.map((r) => r.tenantId).filter(Boolean);
      if (tenants.length) return tenants;
    }
    const all = await this.dataSource
      .getRepository(TenantEntity)
      .createQueryBuilder('t')
      .select('t.tenantId', 'tenantId')
      .getRawMany<{ tenantId: string }>();
    return all.length === 1 ? [all[0].tenantId] : [''];
  }
}
