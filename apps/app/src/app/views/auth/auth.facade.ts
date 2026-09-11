import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom, Subscription } from 'rxjs';
import {
  AUTH_CONSTANTS,
  AUTH_STORE,
  AUTH_UTILS,
  AuthLoginService,
  AuthResetService,
  AuthSessionService,
  AuthTenantLoginService,
} from '@app-galaxy/auth-ui';
import { DataEmitter, EDataEmitterAction } from '@app-galaxy/sdk-ui';
import { AuthService } from '@ui-slim/apiClient';
import { environment } from '../../../environments/environment';

export interface Tenant {
  tenantId?: string;
  id?: string;
  uuId?: string;
  name?: string;
  tenantName?: string;
  roles?: string;
  [key: string]: unknown;
}

/**
 * Thin orchestration layer over the `@app-galaxy/auth-ui` services for the
 * redesigned auth pages (replaces the MFE auth remote). No NgRx — the lib's
 * services do the HTTP work; this facade wires them to the pages and
 * persists the session via the SessionStore, adapted from `_mocks/auth`.
 */
@Injectable({ providedIn: 'root' })
export class AuthFacade {
  private loginService = inject(AuthLoginService);
  private resetService = inject(AuthResetService);
  private sessionService = inject(AuthSessionService);
  private tenantService = inject(AuthTenantLoginService);
  private store = inject(AUTH_STORE.SessionStore);
  private dataEmitter = inject(DataEmitter);
  private http = inject(HttpClient);
  private api = inject(AuthService);

  /** Device identifier provided by provideUuIdToken() (auth-ui). */
  private uuIdToken = inject(
    AUTH_CONSTANTS.Cookies.Tokens.DEVICE_UNIQUE_IDENTIFIER,
    { optional: true },
  ) as string | null;

  /** Resolve a valid device UUID (signin requires one). */
  private get uuId(): string {
    return (this.uuIdToken || AUTH_UTILS.setUuId()) as string;
  }

  isAuthenticated(): boolean {
    return this.sessionService.isStoredSessionValid();
  }

  /**
   * Credentials of a sign-in that is waiting for its second factor. Held in
   * memory only (never persisted) so the dedicated two-fa-login page can
   * verify the code and re-request one; cleared as soon as the session
   * exists or the user walks back to the login.
   */
  /**
   * Credentials waiting for the e-mail verification code: the server
   * validated them but demands a verified address first. Held in memory so
   * the verify page can sign in again right after the code is accepted.
   */
  readonly pendingVerification = signal<{
    email: string;
    password: string;
    encrypt?: boolean | null;
  } | null>(null);

  readonly pendingTwoFactor = signal<{
    email: string;
    password: string;
    encrypt?: boolean | null;
  } | null>(null);

  /**
   * Sign in. When the server demands a second factor (or a verified e-mail)
   * it answers WITHOUT tokens and flags the user object — in that case no
   * session is persisted and the caller shows the matching step.
   */
  async login(
    email: string,
    password: string,
    encrypt?: boolean | null,
  ): Promise<{
    twoFactorRequired?: boolean;
    emailVerificationRequired?: boolean;
    /**
     * Forced first-login reset: with this flag the server accepted ANY
     * password and expects a new one to be set (code 'id' + userId) before
     * the account is used.
     */
    resetPasswordRequired?: boolean;
    userId?: string;
  }> {
    const res = await firstValueFrom(
      this.loginService.signIn({ email, password, uuId: this.uuId }, !!encrypt),
    );
    const user = (res as { user?: Record<string, unknown> })?.user;
    if (user?.['twoFactorRequired']) {
      this.pendingTwoFactor.set({ email, password, encrypt });
      return { twoFactorRequired: true };
    }
    if (user?.['emailVerificationRequired']) {
      this.pendingVerification.set({ email, password, encrypt });
      return { emailVerificationRequired: true };
    }
    this.store.setSession((res as Record<string, unknown>) ?? {});
    if (user?.['resetPasswordRequired']) {
      return {
        resetPasswordRequired: true,
        userId: String(user['userId'] ?? ''),
      };
    }
    return {};
  }

  /**
   * Trades the mailed 2FA code for the real token pair (apiClient). Passes
   * the `resetPasswordRequired` flag through when the server includes it in
   * the verify response — the 2FA branch of signIn answers before the flag
   * is read, so this response is the only place it can survive the factor.
   */
  async verifyTwoFactor(
    email: string,
    code: string,
  ): Promise<{ resetPasswordRequired?: boolean; userId?: string }> {
    const res = await firstValueFrom(
      this.api.authVerifyTwoFactorLogin({
        body: {
          email,
          token: code,
          uuId: this.uuId,
          userAgent: navigator.userAgent,
        },
      }),
    );
    this.store.setSession((res as unknown as Record<string, unknown>) ?? {});
    this.pendingTwoFactor.set(null);
    const user = res?.user as Record<string, unknown> | undefined;
    if (user?.['resetPasswordRequired']) {
      return {
        resetPasswordRequired: true,
        userId: String(user['userId'] ?? ''),
      };
    }
    return {};
  }

  /** A fresh signIn mails a fresh 2FA code. */
  async resendTwoFactorCode(): Promise<void> {
    const pending = this.pendingTwoFactor();
    if (!pending) {
      return;
    }
    await firstValueFrom(
      this.loginService.signIn(
        {
          email: pending.email,
          password: pending.password,
          uuId: this.uuId,
        },
        !!pending.encrypt,
      ),
    );
  }

  requestPasswordReset(email: string): Promise<unknown> {
    return firstValueFrom(this.resetService.requestForgotPasswordToken(email));
  }

  /** `id` only matters for the forced flow (`code === 'id'`, see login()). */
  verifyResetCode(email: string, code: string, id?: string): Promise<unknown> {
    return firstValueFrom(
      this.resetService.verifyPasswordResetToken({ email, code, id }),
    );
  }

  setNewPassword(
    email: string,
    code: string,
    password: string,
    id?: string,
  ): Promise<unknown> {
    return firstValueFrom(
      this.resetService.updateNewPassword({ email, code, password, id }),
    );
  }

  /**
   * Generated client rather than the auth-ui service — same endpoint, typed
   * request and response. A 401 (invalid or expired link) reaches the page
   * instead of the login redirect thanks to `PublicAuthErrorInterceptor`.
   */
  async verifyEmail(
    email: string,
    token: string,
  ): Promise<{ verified: boolean }> {
    const result = await firstValueFrom(
      this.api.authVerifyEmail({ body: { email, token } }),
    );
    return { verified: !!result?.verified };
  }

  async resendVerification(email: string): Promise<{ result: number }> {
    const result = await firstValueFrom(
      this.api.authRequestEmailVerification({
        body: { email, domain: location.origin },
      }),
    );
    return { result: Number(result?.result ?? 0) };
  }

  /** Lists organisations (tenants) the signed-in user can access. */
  listTenants(): Promise<Tenant[]> {
    return firstValueFrom(this.tenantService.getTenants({ autoLogin: false }));
  }

  /** Resolve a tenant's id from any of the shapes the API returns. */
  tenantId(tenant: Tenant): string {
    return ((tenant.tenantId || tenant.uuId || tenant.id) ?? '') + '';
  }

  /** Resolve a tenant's display name (falls back to its id). */
  tenantName(tenant: Tenant): string {
    return tenant.tenantName || tenant.name || this.tenantId(tenant);
  }

  /**
   * Signs into a specific tenant; persists the tenant + its tokens exactly
   * as the galaxy tenant-chooser does. Without the structured setSession the
   * HTTP interceptor keeps sending the previous tenant's token and API
   * calls resolve the wrong tenant.
   */
  async selectTenant(tenant: Tenant): Promise<void> {
    const response = (await firstValueFrom(
      this.tenantService.signInToTenant(this.tenantId(tenant)),
    )) as {
      accessToken?: string;
      accessTenantToken?: string;
      appSettings?: unknown;
    };
    this.store.setSession({
      tenant,
      accessToken: response?.accessToken,
      appSettings: response?.appSettings,
      accessTenantToken: response?.accessTenantToken,
    });
    // Tell already-mounted pages/services to refetch for the new tenant.
    this.dataEmitter.emit(EDataEmitterAction.DATA_RELOAD);
  }

  /**
   * Subscribe to the galaxy global session emitter (fires 'tenant' /
   * 'user' / 'roles' on changes).
   */
  onSessionEvent(
    handler: (event: { event: string; data: unknown }) => void,
  ): Subscription {
    return this.store.eventEmitter.subscribe(handler);
  }

  /** The signed-in user's given name, for greetings. */
  currentUserFirstName(): string {
    const user = (
      this.sessionService.session as {
        user?: {
          firstName?: string | null;
          lastName?: string | null;
          email?: string | null;
        };
      } | null
    )?.user;
    if (!user) {
      return '';
    }
    const first = (user.firstName || '').trim();
    if (first) {
      return first;
    }
    const last = (user.lastName || '').trim();
    if (last) {
      return last.split(/\s+/)[0];
    }
    const local = (user.email || '').split('@')[0].trim();
    return local ? local.charAt(0).toUpperCase() + local.slice(1) : '';
  }

  /** The tenant the user is currently signed into (from the session). */
  currentTenant(): Tenant | null {
    const tenant = (this.sessionService.session as { tenant?: Tenant } | null)
      ?.tenant;
    return tenant ?? null;
  }

  isCurrentTenant(tenant: Tenant): boolean {
    const id = this.tenantId(tenant);
    const current = this.currentTenant();
    return !!id && !!current && id === this.tenantId(current);
  }

  /** Creates a new organisation (tenant) for the signed-in user. */
  createTenant(tenantName: string, tenantDomain?: string): Promise<Tenant> {
    return firstValueFrom(
      this.http.post<Tenant>(`${environment.auth.url}/tenant/register`, {
        tenantName,
        tenantDomain,
      }),
    );
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.sessionService.signOut());
    } catch {
      // ignore — clear locally regardless
    }
    this.sessionService.clearSession();
  }
}

/**
 * Maps an API/network error onto a message. Surfaces the real HTTP error
 * body (NestJS `{ message }` — string or string[]) so the user sees what
 * the server actually said; falls back to friendly text otherwise.
 *
 * `invalidCredentials` (optional) replaces the server's raw English
 * «Invalid credentials» (any 401) with a translated message — the server
 * text is not localized, the login page is.
 */
export function toAuthError(
  error: unknown,
  fallbacks: {
    network: string;
    generic: string;
    invalidCredentials?: string;
    accountLocked?: string;
  },
): string {
  const err = error as {
    status?: number;
    error?: { message?: string | string[] } | string;
    message?: string;
  };

  const body = err?.error;
  const bodyMessage =
    typeof body === 'string'
      ? body
      : String((body as { message?: string | string[] })?.message ?? '');
  // Account lockout (Si001 T7.4): the API answers 403 "Account temporarily
  // locked ..." before it even checks the password.
  if (
    fallbacks.accountLocked &&
    err?.status === 403 &&
    /locked/i.test(bodyMessage)
  ) {
    return fallbacks.accountLocked;
  }
  if (fallbacks.invalidCredentials) {
    if (err?.status === 401 || /invalid credentials/i.test(bodyMessage)) {
      return fallbacks.invalidCredentials;
    }
  }
  if (typeof body === 'string' && body.trim()) {
    return body;
  }
  if (body && typeof body === 'object') {
    const message = (body as { message?: string | string[] }).message;
    if (Array.isArray(message) && message.length) {
      return message.join(' · ');
    }
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  const message = err?.message || '';
  if (
    err?.status === 0 ||
    /network|failed|connection|unknown url/i.test(message)
  ) {
    return fallbacks.network;
  }
  return message || fallbacks.generic;
}
