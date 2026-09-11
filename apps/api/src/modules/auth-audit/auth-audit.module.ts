import { Module } from '@nestjs/common';
import {
  provideAfterAppCreated,
  provideAfterAppDeleted,
  provideAfterAppUpdated,
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
  ],
})
export class AuthAuditModule {}
