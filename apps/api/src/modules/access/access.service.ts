import { Injectable } from '@nestjs/common';
import { rawQuery } from '@api-slim/common';
import { DataSource } from 'typeorm';
import { APP_ACCESS, AppAccess, AppAccessDto } from './dto';

/** Higher wins when several roles grant a right on the same app. */
const RANK: Record<AppAccess, number> = { read: 1, write: 2, delete: 3, root: 4 };

/**
 * The app rights of the signed-in user in the current tenant (B1 8.1.2).
 * Same tables the galaxy `AppsRolesGuard` reads: the user's active roles
 * (`app_user_right` → `app_role`) and their rights (`app_role_right`). A
 * role with `hasAdminRights` opens every app of the catalogue as `root`.
 * The frontend uses the answer to hide menu entries and to switch the
 * masks to read-only; the guards of the API stay the authority.
 */
@Injectable()
export class AccessService {
  constructor(private readonly dataSource: DataSource) {}

  async mine(tenantId: string, userId: string): Promise<AppAccessDto[]> {
    const rows: { appId: number | null; access: string | null; admin: number | boolean | null }[] = await rawQuery(
      this.dataSource,
      `select r.appId as appId, r.access as access, ar.hasAdminRights as admin
         from app_user_right aur
         join app_role ar on ar.tenantId = aur.tenantId and ar.roleId = aur.roleId
         left join app_role_right r on r.tenantId = ar.tenantId and r.roleId = ar.roleId
        where aur.tenantId = ? and aur.userId = ?
          and (ar.state = 1 or ar.state is null or ar.state = 'true')`,
      [tenantId, userId],
    );
    const best = new Map<number, AppAccess>();
    const put = (appId: number, access: AppAccess) => {
      const current = best.get(appId);
      if (!current || RANK[access] > RANK[current]) best.set(appId, access);
    };
    let admin = false;
    for (const row of rows) {
      if (Number(row.admin)) admin = true;
      if (row.appId == null || !row.access) continue;
      const access = row.access as AppAccess;
      if (APP_ACCESS.includes(access)) put(Number(row.appId), access);
    }
    if (admin) {
      const apps: { appId: number }[] = await rawQuery(this.dataSource, 'select appId from app_app', []);
      for (const app of apps) put(Number(app.appId), 'root');
    }
    return [...best.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([appId, access]) => ({ appId, access }));
  }
}
