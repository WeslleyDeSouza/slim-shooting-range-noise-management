import { Injectable } from '@nestjs/common';
import type {
  AfterAppCreatedContext,
  AfterAppCreatedHook,
  AfterAppDeletedContext,
  AfterAppDeletedHook,
  AfterAppUpdatedContext,
  AfterAppUpdatedHook,
  AfterRoleCreatedContext,
  AfterRoleCreatedHook,
  AfterRoleDeletedContext,
  AfterRoleDeletedHook,
  AfterRoleUpdatedContext,
  AfterRoleUpdatedHook,
  AfterRoleUserAssignedContext,
  AfterRoleUserAssignedHook,
  AfterRoleUserUnassignedContext,
  AfterRoleUserUnassignedHook,
  AfterUserCreatedContext,
  AfterUserCreatedHook,
  AfterUserDeletedContext,
  AfterUserDeletedHook,
  AfterUserUpdatedContext,
  AfterUserUpdatedHook,
  LifecycleContextBase,
} from '@app-galaxy/auth-api';
import { LogAction, LoggerService } from '../../core/logger';

/**
 * Audit logging of the auth administration (users, roles, apps) into the
 * logbook (`core_log_user`), via the `@app-galaxy/auth-api` lifecycle hooks.
 *
 * The library's ADMIN endpoints already write `AUTH_USER_CREATED/UPDATED/
 * DELETED` through the wired `AUTH_API_LOGGER` — the user hook therefore
 * skips `actor.source === 'admin'` and only covers the paths that were dark
 * so far (self-service profile changes, signup, host code calling services
 * directly). Roles and apps had no logging at all; their hooks log every
 * source.
 */

/** Shared shape of every log entry the hooks write. */
function baseLog(ctx: LifecycleContextBase) {
  return {
    tenantId: String(ctx.tenantId ?? ''),
    userId: ctx.actor?.userId ?? null,
  };
}

@Injectable()
export class AuditUserLifecycleHook
  implements AfterUserCreatedHook, AfterUserUpdatedHook, AfterUserDeletedHook
{
  constructor(private readonly loggerService: LoggerService) {}

  /** Admin writes are logged by the library controller — skip those here. */
  private skip(ctx: LifecycleContextBase): boolean {
    return ctx.actor?.source === 'admin';
  }

  async afterUserCreated(ctx: AfterUserCreatedContext): Promise<void> {
    if (this.skip(ctx)) return;
    await this.loggerService.createLog({
      ...baseLog(ctx),
      section: 'AUTH_USER',
      action: LogAction.CREATE,
      refType: 'AUTH_USER',
      refId: ctx.userId,
      data: { source: ctx.actor?.source },
    });
  }

  async afterUserUpdated(ctx: AfterUserUpdatedContext): Promise<void> {
    if (this.skip(ctx)) return;
    await this.loggerService.createLog({
      ...baseLog(ctx),
      section: 'AUTH_USER',
      action: LogAction.UPDATE,
      refType: 'AUTH_USER',
      refId: ctx.userId,
      data: { source: ctx.actor?.source, changedFields: ctx.changedFields },
    });
  }

  async afterUserDeleted(ctx: AfterUserDeletedContext): Promise<void> {
    if (this.skip(ctx)) return;
    await this.loggerService.createLog({
      ...baseLog(ctx),
      section: 'AUTH_USER',
      action: LogAction.DELETE,
      refType: 'AUTH_USER',
      refId: ctx.userId,
      data: { source: ctx.actor?.source, softDeleted: ctx.softDeleted },
    });
  }
}

@Injectable()
export class AuditRoleLifecycleHook
  implements
    AfterRoleCreatedHook,
    AfterRoleUpdatedHook,
    AfterRoleDeletedHook,
    AfterRoleUserAssignedHook,
    AfterRoleUserUnassignedHook
{
  constructor(private readonly loggerService: LoggerService) {}

  async afterRoleCreated(ctx: AfterRoleCreatedContext): Promise<void> {
    await this.loggerService.createLog({
      ...baseLog(ctx),
      section: 'AUTH_ROLE',
      action: LogAction.CREATE,
      refType: 'AUTH_ROLE',
      refId: String(ctx.roleId),
      data: { title: ctx.role?.title },
    });
  }

  async afterRoleUpdated(ctx: AfterRoleUpdatedContext): Promise<void> {
    await this.loggerService.createLog({
      ...baseLog(ctx),
      section: 'AUTH_ROLE',
      action: LogAction.UPDATE,
      refType: 'AUTH_ROLE',
      refId: String(ctx.roleId),
      data: {
        title: ctx.role?.title,
        changedFields: ctx.changedFields,
        assignedUserIds: ctx.assignedUserIds,
        unassignedUserIds: ctx.unassignedUserIds,
      },
    });
  }

  async afterRoleDeleted(ctx: AfterRoleDeletedContext): Promise<void> {
    await this.loggerService.createLog({
      ...baseLog(ctx),
      section: 'AUTH_ROLE',
      action: LogAction.DELETE,
      refType: 'AUTH_ROLE',
      refId: String(ctx.roleId),
      data: {
        title: ctx.role?.title,
        unassignedUserIds: ctx.unassignedUserIds,
      },
    });
  }

  async afterRoleUserAssigned(
    ctx: AfterRoleUserAssignedContext,
  ): Promise<void> {
    await this.loggerService.createLog({
      ...baseLog(ctx),
      section: 'AUTH_ROLE',
      action: LogAction.UPDATE,
      refType: 'ROLE_ASSIGNMENT',
      refId: `${ctx.roleId}:${ctx.userId}`,
      data: {
        roleId: ctx.roleId,
        title: ctx.role?.title,
        targetUserId: ctx.userId,
        assigned: true,
      },
    });
  }

  async afterRoleUserUnassigned(
    ctx: AfterRoleUserUnassignedContext,
  ): Promise<void> {
    await this.loggerService.createLog({
      ...baseLog(ctx),
      section: 'AUTH_ROLE',
      action: LogAction.UPDATE,
      refType: 'ROLE_ASSIGNMENT',
      refId: `${ctx.roleId}:${ctx.userId}`,
      data: {
        roleId: ctx.roleId,
        title: ctx.role?.title,
        targetUserId: ctx.userId,
        assigned: false,
      },
    });
  }
}

@Injectable()
export class AuditAppLifecycleHook
  implements AfterAppCreatedHook, AfterAppUpdatedHook, AfterAppDeletedHook
{
  constructor(private readonly loggerService: LoggerService) {}

  async afterAppCreated(ctx: AfterAppCreatedContext): Promise<void> {
    await this.loggerService.createLog({
      ...baseLog(ctx),
      section: 'AUTH_APP',
      action: LogAction.CREATE,
      refType: 'AUTH_APP',
      refId: String(ctx.appId),
      data: { title: ctx.app?.title, path: ctx.app?.path },
    });
  }

  async afterAppUpdated(ctx: AfterAppUpdatedContext): Promise<void> {
    await this.loggerService.createLog({
      ...baseLog(ctx),
      section: 'AUTH_APP',
      action: LogAction.UPDATE,
      refType: 'AUTH_APP',
      refId: String(ctx.appId),
      data: {
        title: ctx.app?.title,
        path: ctx.app?.path,
        changedFields: ctx.changedFields,
      },
    });
  }

  async afterAppDeleted(ctx: AfterAppDeletedContext): Promise<void> {
    await this.loggerService.createLog({
      ...baseLog(ctx),
      section: 'AUTH_APP',
      action: LogAction.DELETE,
      refType: 'AUTH_APP',
      refId: String(ctx.appId),
      data: { title: ctx.app?.title, path: ctx.app?.path },
    });
  }
}
