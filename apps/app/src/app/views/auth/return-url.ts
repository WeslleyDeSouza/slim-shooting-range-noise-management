import { AUTH_UTILS } from '@app-galaxy/auth-ui';
import { APP_ROUTES } from '@slim/shared';

/**
 * Deep link that bounced into the login (llumi pattern).
 *
 * `adminGuard` and the auth-ui refresh interceptor send a visitor without a
 * valid session to `/auth/login?returnUrl=<page>`. The login can run through
 * several pages (2FA, e-mail verification, forced password reset, tenant
 * chooser) and not every hop carries the query string along — so the login
 * page parks the target in `sessionStorage` (per tab) and the tenant chooser
 * takes it back once the session is complete.
 *
 * Only app-internal admin paths are honoured: `AUTH_UTILS.sanitizeReturnUrl`
 * rejects external URLs, `//host` tricks and `/auth/*` loops, and the admin
 * rule keeps a visitor out of pages the guard never protected.
 */
const RETURN_URL_KEY = 'slim.returnUrl';

/** The URL as a redirect target, or null when it must not be used. */
export function sanitizeAdminReturnUrl(url: string | null | undefined): string | null {
  const target = AUTH_UTILS.sanitizeReturnUrl(url);
  if (!target) return null;
  const root = APP_ROUTES.admin.root;
  return target === root || target.startsWith(`${root}/`) || target.startsWith(`${root}?`) ? target : null;
}

/** Parks the `returnUrl` of the login page; a missing or invalid one clears a stale entry. */
export function rememberReturnUrl(url: string | null | undefined): void {
  const target = sanitizeAdminReturnUrl(url);
  try {
    if (target) sessionStorage.setItem(RETURN_URL_KEY, target);
    else sessionStorage.removeItem(RETURN_URL_KEY);
  } catch {
    // Storage blocked (private mode): the login lands on the admin home.
  }
}

/** One-shot read of the parked URL (removed on read). */
export function takeReturnUrl(): string | null {
  try {
    const url = sessionStorage.getItem(RETURN_URL_KEY);
    sessionStorage.removeItem(RETURN_URL_KEY);
    return sanitizeAdminReturnUrl(url);
  } catch {
    return null;
  }
}
