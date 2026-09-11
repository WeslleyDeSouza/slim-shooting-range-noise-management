import { Injectable } from '@nestjs/common';
import type {
  AfterEmailVerifiedContext,
  AfterEmailVerifiedHook,
  AfterLoginContext,
  AfterLoginFailedContext,
  AfterLoginFailedHook,
  AfterLoginHook,
  AfterLogoutContext,
  AfterLogoutHook,
  AfterPasswordChangedContext,
  AfterPasswordChangedHook,
  AfterPasswordResetRequestedContext,
  AfterPasswordResetRequestedHook,
  AfterTokenReuseDetectedContext,
  AfterTokenReuseDetectedHook,
  AuthRequestContextBase,
} from '@app-galaxy/auth-api';
import { LogAction, LoggerService } from '../../core/logger';
import { AuthTenantResolver } from './auth-tenant.resolver';

/**
 * Logbook sections of the authentication events (B1 `slm 56`: Login-
 * Logging). One section per event so the logbook can be filtered by it.
 */
export const AUTH_LOG_SECTION = {
  login: 'AUTH_LOGIN',
  loginFailed: 'AUTH_LOGIN_FAILED',
  logout: 'AUTH_LOGOUT',
  tokenReuse: 'AUTH_TOKEN_REUSE',
  passwordResetRequested: 'AUTH_PASSWORD_RESET_REQUESTED',
  passwordChanged: 'AUTH_PASSWORD_CHANGED',
  emailVerified: 'AUTH_EMAIL_VERIFIED',
} as const;

/**
 * Audit logging of the authentication lifecycle (`@app-galaxy/auth-api`
 * ≥ 0.1.218, `user/hooks/auth-lifecycle.*`): every login, every rejected
 * attempt with its reason, logouts, refresh-token reuse, password resets
 * and changes, e-mail verification. Hooks never abort the request — the
 * library swallows errors thrown here.
 *
 * Secrets never reach the logbook: `resetToken` and the password hash on
 * `ctx.user` are not read.
 *
 * The library still writes `AUTH_USER_LOGOUT` / `AUTH_USER_PASSWORD_RESET`
 * (reset-by-code path) through `AUTH_API_LOGGER`; the hook entries carry
 * the richer context (method, reason, operation, device), so the logbook
 * filters on the `AUTH_*` sections defined here.
 */
@Injectable()
export class AuditAuthLifecycleHook
  implements
    AfterLoginHook,
    AfterLoginFailedHook,
    AfterLogoutHook,
    AfterTokenReuseDetectedHook,
    AfterPasswordResetRequestedHook,
    AfterPasswordChangedHook,
    AfterEmailVerifiedHook
{
  constructor(
    private readonly loggerService: LoggerService,
    private readonly tenants: AuthTenantResolver,
  ) {}

  /**
   * Writes the entry once per tenant of the event (see AuthTenantResolver):
   * login-phase events carry no tenant themselves.
   */
  private async log(
    ctx: { tenantId?: string | number | null; userId?: string | null },
    entry: Omit<Parameters<LoggerService['createLog']>[0], 'tenantId'>,
  ): Promise<void> {
    for (const tenantId of await this.tenants.forEvent(ctx)) {
      await this.loggerService.createLog({ ...entry, tenantId });
    }
  }

  async afterLogin(ctx: AfterLoginContext): Promise<void> {
    await this.log(ctx, {
      ...origin(ctx),
      userId: ctx.userId,
      section: AUTH_LOG_SECTION.login,
      action: LogAction.AUTH,
      refType: 'AUTH_USER',
      refId: ctx.userId,
      data: {
        method: ctx.method,
        deviceUuId: ctx.deviceUuId,
        resetPasswordRequired: ctx.resetPasswordRequired,
        email: ctx.user?.email,
      },
    });
  }

  /**
   * Rejected attempts: the account may not exist (`userId` undefined), then
   * only the identifier the client used is kept. Reasons are the library's
   * `LoginFailureReason` — the logbook's «locked / too many attempts» rows
   * are what `slm 56` asks to be auditable.
   */
  async afterLoginFailed(ctx: AfterLoginFailedContext): Promise<void> {
    await this.log(ctx, {
      ...origin(ctx),
      userId: ctx.userId ?? null,
      isSystem: !ctx.userId,
      section: AUTH_LOG_SECTION.loginFailed,
      action: LogAction.ERROR,
      refType: 'AUTH_USER',
      refId: ctx.userId,
      data: { identifier: ctx.identifier, method: ctx.method, reason: ctx.reason },
    });
  }

  async afterLogout(ctx: AfterLogoutContext): Promise<void> {
    await this.log(ctx, {
      userId: ctx.userId,
      section: AUTH_LOG_SECTION.logout,
      action: LogAction.AUTH,
      refType: 'AUTH_USER',
      refId: ctx.userId,
      data: { deviceUuId: ctx.deviceUuId, sessionRevoked: ctx.sessionRevoked },
    });
  }

  /** A revoked refresh token used again: the library revoked the device's sessions. */
  async afterTokenReuseDetected(ctx: AfterTokenReuseDetectedContext): Promise<void> {
    await this.log(ctx, {
      ...origin(ctx),
      userId: ctx.userId,
      section: AUTH_LOG_SECTION.tokenReuse,
      action: LogAction.ERROR,
      refType: 'AUTH_USER',
      refId: ctx.userId,
      data: { deviceUuId: ctx.deviceUuId, email: ctx.user?.email },
    });
  }

  /** `ctx.resetToken` is deliberately not read. */
  async afterPasswordResetRequested(ctx: AfterPasswordResetRequestedContext): Promise<void> {
    await this.log(ctx, {
      userId: ctx.userId,
      section: AUTH_LOG_SECTION.passwordResetRequested,
      action: LogAction.MAIL,
      refType: 'AUTH_USER',
      refId: ctx.userId,
      data: { domain: ctx.domain ?? null },
    });
  }

  async afterPasswordChanged(ctx: AfterPasswordChangedContext): Promise<void> {
    await this.log(ctx, {
      userId: ctx.actor?.userId ?? ctx.userId,
      section: AUTH_LOG_SECTION.passwordChanged,
      action: LogAction.UPDATE,
      refType: 'AUTH_USER',
      refId: ctx.userId,
      data: { operation: ctx.operation, source: ctx.actor?.source ?? null },
    });
  }

  async afterEmailVerified(ctx: AfterEmailVerifiedContext): Promise<void> {
    await this.log(ctx, {
      userId: ctx.userId,
      section: AUTH_LOG_SECTION.emailVerified,
      action: LogAction.UPDATE,
      refType: 'AUTH_USER',
      refId: ctx.userId,
      data: { email: ctx.user?.email },
    });
  }
}

/** IP and user agent of request-bound events (the middleware context has none for the library's own calls). */
function origin(ctx: AuthRequestContextBase): { ip: string | null; device: string | null } {
  return { ip: ctx.ipAddress ?? null, device: ctx.userAgent ?? null };
}
