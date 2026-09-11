import { LogAction } from '../../core/logger';
import { AUTH_LOG_SECTION, AuditAuthLifecycleHook } from './auth-lifecycle.hooks';

describe('auth lifecycle audit hooks (auth-api ≥ 0.1.218)', () => {
  let createLog: ReturnType<typeof vi.fn>;
  let hook: AuditAuthLifecycleHook;

  beforeEach(() => {
    createLog = vi.fn().mockResolvedValue(undefined);
    // Tenant resolution is covered by auth-tenant.resolver.spec; here the
    // context's tenant (or the fallback 't1') is used as-is.
    const tenants = { forEvent: async (ctx: { tenantId?: unknown }) => [ctx.tenantId ? String(ctx.tenantId) : 't1'] };
    hook = new AuditAuthLifecycleHook({ createLog } as never, tenants as never);
  });

  const user = { userId: 'u1', email: 'slim@demo.ch', password: 'HASH-NEVER-LOGGED' };

  it('logs a login with method, device and origin', async () => {
    await hook.afterLogin({
      userId: 'u1',
      user,
      tenantId: 't1',
      method: 'two-factor',
      deviceUuId: 'dev-1',
      resetPasswordRequired: false,
      ipAddress: '10.0.0.7',
      userAgent: 'Mozilla/5.0',
      actor: { userId: 'u1', source: 'self' },
    } as never);

    expect(createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        userId: 'u1',
        section: AUTH_LOG_SECTION.login,
        action: LogAction.AUTH,
        refType: 'AUTH_USER',
        refId: 'u1',
        ip: '10.0.0.7',
        device: 'Mozilla/5.0',
        data: { method: 'two-factor', deviceUuId: 'dev-1', resetPasswordRequired: false, email: 'slim@demo.ch' },
      }),
    );
    expect(JSON.stringify(createLog.mock.calls[0][0])).not.toContain('HASH-NEVER-LOGGED');
  });

  it('logs a rejected attempt against an unknown account as a system entry with the reason', async () => {
    await hook.afterLoginFailed({
      identifier: 'nobody@demo.ch',
      method: 'password',
      reason: 'invalid-credentials',
      tenantId: 't1',
      ipAddress: '10.0.0.7',
    } as never);

    expect(createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        section: AUTH_LOG_SECTION.loginFailed,
        action: LogAction.ERROR,
        userId: null,
        isSystem: true,
        refId: undefined,
        ip: '10.0.0.7',
        data: { identifier: 'nobody@demo.ch', method: 'password', reason: 'invalid-credentials' },
      }),
    );
  });

  it('attributes a locked-account rejection to the account', async () => {
    await hook.afterLoginFailed({
      identifier: 'slim@demo.ch',
      userId: 'u1',
      user,
      method: 'password',
      reason: 'account-locked',
      tenantId: 't1',
    } as never);

    expect(createLog).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', isSystem: false, refId: 'u1', data: expect.objectContaining({ reason: 'account-locked' }) }),
    );
  });

  it('logs logout, token reuse and e-mail verification', async () => {
    await hook.afterLogout({ userId: 'u1', tenantId: 't1', deviceUuId: 'dev-1', sessionRevoked: true } as never);
    await hook.afterTokenReuseDetected({ userId: 'u1', user, tenantId: 't1', deviceUuId: 'dev-1', ipAddress: '1.2.3.4' } as never);
    await hook.afterEmailVerified({ userId: 'u1', user, tenantId: 't1' } as never);

    expect(createLog.mock.calls.map((c) => [c[0].section, c[0].action])).toEqual([
      [AUTH_LOG_SECTION.logout, LogAction.AUTH],
      [AUTH_LOG_SECTION.tokenReuse, LogAction.ERROR],
      [AUTH_LOG_SECTION.emailVerified, LogAction.UPDATE],
    ]);
    expect(createLog.mock.calls[1][0]).toMatchObject({ ip: '1.2.3.4', data: { deviceUuId: 'dev-1', email: 'slim@demo.ch' } });
  });

  it('never writes the reset token and records who changed a password', async () => {
    await hook.afterPasswordResetRequested({
      userId: 'u1',
      user,
      tenantId: 't1',
      resetToken: 'SECRET-RESET-TOKEN',
      domain: 'slim.example.ch',
    } as never);
    await hook.afterPasswordChanged({
      userId: 'u1',
      user,
      tenantId: 't1',
      operation: 'update',
      actor: { userId: 'admin-1', source: 'admin' },
    } as never);

    const [requested, changed] = createLog.mock.calls.map((c) => c[0]);
    expect(JSON.stringify(requested)).not.toContain('SECRET-RESET-TOKEN');
    expect(requested).toMatchObject({ section: AUTH_LOG_SECTION.passwordResetRequested, action: LogAction.MAIL, data: { domain: 'slim.example.ch' } });
    expect(changed).toMatchObject({
      section: AUTH_LOG_SECTION.passwordChanged,
      action: LogAction.UPDATE,
      userId: 'admin-1',
      refId: 'u1',
      data: { operation: 'update', source: 'admin' },
    });
  });

  it('falls back to the account when no actor is known', async () => {
    await hook.afterPasswordChanged({ userId: 'u1', user, tenantId: 't1', operation: 'reset' } as never);
    expect(createLog.mock.calls[0][0]).toMatchObject({ userId: 'u1', data: { operation: 'reset', source: null } });
  });
});
