import { UserEntity, type AfterUserLoadHookFn } from '@app-galaxy/auth-api';
import { DataSource } from 'typeorm';

/**
 * `AUTH_API_HOOK_AFTER_USER_LOAD`: the users list of the galaxy admin API
 * serialises users with `toJSON()`, which drops `createdAt`. The user
 * administration (5.26) shows «Erstellt am», so the hook reads the column
 * for the listed accounts in one query and adds it to every row.
 */
export function afterUserLoadHook(dataSource: DataSource): AfterUserLoadHookFn {
  return async (users) => {
    const ids = users.map((u) => u['userId']).filter((id): id is string => typeof id === 'string');
    if (!ids.length) return users;
    const rows: { userId: string; createdAt: string | Date | null }[] = await dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('u')
      .select(['u.userId AS userId', 'u.createdAt AS createdAt'])
      .where('u.userId IN (:...ids)', { ids })
      .getRawMany();
    const createdAt = new Map(rows.map((r) => [r.userId, r.createdAt]));
    for (const user of users) {
      user['createdAt'] = createdAt.get(user['userId'] as string) ?? null;
    }
    return users;
  };
}
