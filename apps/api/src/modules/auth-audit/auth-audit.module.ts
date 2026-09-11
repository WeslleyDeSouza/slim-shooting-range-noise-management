import { Global, Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  provideAfterAppCreated,
  provideAfterAppDeleted,
  provideAfterAppUpdated,
  provideAfterEmailVerified,
  provideAfterLogin,
  provideAfterLoginFailed,
  provideAfterLogout,
  provideAfterPasswordChanged,
  provideAfterPasswordResetRequested,
  provideAfterTokenReuseDetected,
  provideAfterRoleCreated,
  provideAfterRoleDeleted,
  provideAfterRoleUpdated,
  provideAfterRoleUserAssigned,
  provideAfterRoleUserUnassigned,
  provideAfterUserCreated,
  provideAfterUserDeleted,
  provideAfterUserUpdated,
  UserAdminHooks,
} from '@app-galaxy/auth-api';
import {
  AuditAppLifecycleHook,
  AuditRoleLifecycleHook,
  AuditUserLifecycleHook,
} from './auth-audit.hooks';
import { AuditAuthLifecycleHook } from './auth-lifecycle.hooks';
import { AuthTenantResolver } from './auth-tenant.resolver';
import { afterUserLoadHook } from './user-load.hook';

/**
 * Registers the audit-log lifecycle hooks (see auth-audit.hooks.ts). The
 * `provideAfter*` helpers stamp the event markers onto the hook classes; the
 * library's global `LifecycleHooksModule` discovers and runs them — nothing
 * else to wire. Global because of the AFTER_USER_LOAD hook: the auth-api
 * controllers resolve that token in their own DI context.
 */
@Global()
@Module({
  providers: [
    AuthTenantResolver,
    // Users list (5.26): adds `createdAt`, which the library's toJSON() drops.
    {
      provide: UserAdminHooks.AUTH_API_HOOK_AFTER_USER_LOAD,
      useFactory: afterUserLoadHook,
      inject: [DataSource],
    },
    provideAfterUserCreated(AuditUserLifecycleHook),
    provideAfterUserUpdated(AuditUserLifecycleHook),
    provideAfterUserDeleted(AuditUserLifecycleHook),
    provideAfterRoleCreated(AuditRoleLifecycleHook),
    provideAfterRoleUpdated(AuditRoleLifecycleHook),
    provideAfterRoleDeleted(AuditRoleLifecycleHook),
    provideAfterRoleUserAssigned(AuditRoleLifecycleHook),
    provideAfterRoleUserUnassigned(AuditRoleLifecycleHook),
    provideAfterAppCreated(AuditAppLifecycleHook),
    provideAfterAppUpdated(AuditAppLifecycleHook),
    provideAfterAppDeleted(AuditAppLifecycleHook),
    // Authentication events (auth-api ≥ 0.1.218, see auth-lifecycle.hooks.ts)
    provideAfterLogin(AuditAuthLifecycleHook),
    provideAfterLoginFailed(AuditAuthLifecycleHook),
    provideAfterLogout(AuditAuthLifecycleHook),
    provideAfterTokenReuseDetected(AuditAuthLifecycleHook),
    provideAfterPasswordResetRequested(AuditAuthLifecycleHook),
    provideAfterPasswordChanged(AuditAuthLifecycleHook),
    provideAfterEmailVerified(AuditAuthLifecycleHook),
  ],
  exports: [UserAdminHooks.AUTH_API_HOOK_AFTER_USER_LOAD],
})
export class AuthAuditModule {}
