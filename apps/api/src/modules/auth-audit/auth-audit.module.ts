import { Module } from '@nestjs/common';
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
} from '@app-galaxy/auth-api';
import {
  AuditAppLifecycleHook,
  AuditRoleLifecycleHook,
  AuditUserLifecycleHook,
} from './auth-audit.hooks';
import { AuditAuthLifecycleHook } from './auth-lifecycle.hooks';

/**
 * Registers the audit-log lifecycle hooks (see auth-audit.hooks.ts). The
 * `provideAfter*` helpers stamp the event markers onto the hook classes; the
 * library's global `LifecycleHooksModule` discovers and runs them — nothing
 * else to wire.
 */
@Module({
  providers: [
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
})
export class AuthAuditModule {}
