import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoreLogEntity } from './entities/core-log.entity';
import { REQUEST_ORIGIN } from './request-origin.middleware';
import { LogAction } from './dto/log-action.enum';

export type CreateLogInput = {
  tenantId: string;
  userId?: string | null;
  isSystem?: boolean;
  section: string;
  action: LogAction;
  message?: string;
  refType?: string;
  refId?: string;
  data?: unknown;
  /** Request origin, filled by callers that have the request at hand. */
  ip?: string | null;
  device?: string | null;
};

export type LogQuery = {
  tenantId: string;
  q?: string;
  section?: string;
  action?: LogAction;
  /** Multiple actions (redesign logbook chips); wins over `action`. */
  actions?: string[];
  /** Only system entries (no user attached). */
  system?: boolean;
  userId?: string;
  userName?: string;
  refId?: string;
  from?: string | Date;
  to?: string | Date;
  page?: number;
  limit?: number;
};

@Injectable()
export class LoggerService {
  constructor(
    @InjectRepository(CoreLogEntity)
    private readonly logRepo: Repository<CoreLogEntity>
  ) {}

  async createLog(input: CreateLogInput): Promise<CoreLogEntity | undefined> {
    const payLoad = {
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      isSystem: input.isSystem ?? !input.userId,
      section: input.section,
      action: input.action,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      data: input.data !== undefined ? JSON.stringify(input.data) : null,
      // Explicit values win; otherwise the per-request context set by
      // RequestOriginMiddleware fills them for every caller at once.
      ip: input.ip ?? REQUEST_ORIGIN.getStore()?.ip ?? null,
      device: input.device ?? REQUEST_ORIGIN.getStore()?.device ?? null,
    };
    const entity = this.logRepo.create(payLoad);

    return this.logRepo.save(entity).catch((e) => {
      console.error(payLoad, e.message);
      return undefined;
    });
  }

  async queryLogs(query: LogQuery) {
    const qb = this.logRepo
      .createQueryBuilder('log')
      .select([
        'log.logId',
        'log.message',
        'log.refType',
        'log.action',
        'log.section',
        'log.refId',
        'log.createdAt',
        'log.data',
        'log.isSystem',
        'log.ip',
        'log.device',
        'user.userId',
        'user.firstName',
        'user.lastName',
        'user.avatar',
      ])
      .leftJoin('log.user', 'user')
      .where('log.tenantId = :tenantId', { tenantId: query.tenantId });

    if (query.section)
      qb.andWhere('log.section = :section', { section: query.section });
    if (query.actions?.length) {
      qb.andWhere('log.action IN (:...actions)', { actions: query.actions });
    } else if (query.action) {
      qb.andWhere('log.action = :action', { action: query.action });
    }
    if (query.system) {
      qb.andWhere('(log.userId IS NULL OR log.isSystem = :isSystem)', {
        isSystem: true,
      });
    }
    if (query.userId)
      qb.andWhere('log.userId = :userId', { userId: query.userId });

    if (query.q) {
      qb.andWhere(
        '(log.section LIKE :q OR log.action LIKE :q OR log.data LIKE :q)',
        {
          q: `%${query.q}%`,
        },
      );
    }

    if (query.userName) {
      qb.andWhere(
        '(user.firstName LIKE :userName OR user.lastName LIKE :userName)',
        {
          userName: `%${query.userName}%`,
        },
      );
    }

    if (query.refId) {
      qb.andWhere('log.refId LIKE :refId', {
        refId: `%${query.refId}%`,
      });
    }

    if (query.from)
      qb.andWhere('log.createdAt >= :from', { from: new Date(query.from) });

    if (query.to)
      qb.andWhere('log.createdAt <= :to', { to: new Date(query.to) });

    const page = Math.max(1, +(query.page ?? 1));
    const limit = Math.min(200, Math.max(1, +(query.limit ?? 50)));

    qb.orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  /**
   * Filter facets of the redesign logbook: distinct sections, involved
   * users and per-action counts, optionally limited to a date range.
   */
  async getFacets(tenantId: string, from?: string, to?: string) {
    const base = () => {
      const qb = this.logRepo
        .createQueryBuilder('log')
        .where('log.tenantId = :tenantId', { tenantId });
      if (from) {
        qb.andWhere('log.createdAt >= :from', { from: new Date(from) });
      }
      if (to) {
        qb.andWhere('log.createdAt <= :to', { to: new Date(to) });
      }
      return qb;
    };

    const [sections, actions, users, total] = await Promise.all([
      base()
        .select('log.section', 'section')
        .groupBy('log.section')
        .orderBy('log.section', 'ASC')
        .getRawMany<{ section: string }>(),
      base()
        .select('log.action', 'action')
        .addSelect('COUNT(*)', 'count')
        .groupBy('log.action')
        .getRawMany<{ action: string; count: string }>(),
      base()
        .leftJoin('log.user', 'user')
        .select('log.userId', 'userId')
        .addSelect('MAX(log.isSystem)', 'isSystem')
        .addSelect('user.firstName', 'firstName')
        .addSelect('user.lastName', 'lastName')
        .groupBy('log.userId')
        .addGroupBy('user.firstName')
        .addGroupBy('user.lastName')
        .getRawMany<{
          userId: string | null;
          isSystem: number;
          firstName: string | null;
          lastName: string | null;
        }>(),
      base().getCount(),
    ]);

    return {
      total,
      sections: sections.map((row) => row.section).filter(Boolean),
      actionCounts: Object.fromEntries(
        actions.map((row) => [row.action, Number(row.count)]),
      ),
      users: users.map((row) => ({
        userId: row.userId,
        name:
          [row.firstName, row.lastName].filter(Boolean).join(' ') ||
          (row.userId ? row.userId : 'System'),
        isSystem: !row.userId || !!Number(row.isSystem),
      })),
    };
  }
}
