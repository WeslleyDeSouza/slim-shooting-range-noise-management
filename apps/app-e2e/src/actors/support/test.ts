/**
 * `test` of the actor suite: the plain Playwright test plus two fixtures
 * that make «Akteur, Rolle und Platzzuordnung benennen» (readme.md, 6.1)
 * and «für verbotene Aktionen auch direkte API-Aufrufe prüfen» a one-liner.
 *
 * The suite starts without storageState (playwright.config.ts, project
 * `actors`): every case signs in as its actor, T01 stays signed out.
 */
import {
  test as base,
  expect,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from '@playwright/test';

import { login, resetSession } from '../../support/login';
import { SESSION_KEY } from '../../support/selectors';
import { credentialsOf, type ActorId } from './actors';

/** Access token of the stored session (auth-ui wraps the JSON in { value }). */
export async function accessToken(page: Page): Promise<string> {
  const token = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const outer = JSON.parse(raw) as { value?: unknown };
    const inner = (
      typeof outer.value === 'string' ? JSON.parse(outer.value) : outer.value
    ) as { accessToken?: string } | undefined;
    return inner?.accessToken ?? null;
  }, SESSION_KEY);
  if (!token) throw new Error('no access token in the session — sign in first');
  return token;
}

/**
 * Direct API call with the session of the page's actor — the negative
 * cases must prove the server refuses, not only that the button is hidden.
 *
 *   const res = await api(page, request).patch(`/api/admin/area/${id}`, { data: { enabled: false } });
 *   expect(res.status()).toBe(403);
 */
export function api(page: Page, request: APIRequestContext) {
  const call =
    (method: 'get' | 'post' | 'patch' | 'delete') =>
    async (path: string, options: { data?: unknown } = {}): Promise<APIResponse> =>
      request[method](path, {
        ...options,
        headers: { Authorization: `Bearer ${await accessToken(page)}` },
        // The assertions read the status themselves.
        failOnStatusCode: false,
      });
  return { get: call('get'), post: call('post'), patch: call('patch'), delete: call('delete') };
}

export interface ActorFixtures {
  /** Signs the page in as the actor (fresh session each call). */
  signInAs: (id: ActorId) => Promise<void>;
  /** `api(page, request)` bound to this test's page. */
  apiAs: ReturnType<typeof api>;
}

export const test = base.extend<ActorFixtures>({
  signInAs: async ({ page }, use) => {
    await use(async (id) => {
      await resetSession(page).catch(() => undefined);
      await login(page, credentialsOf(id));
    });
  },
  apiAs: async ({ page, request }, use) => {
    await use(api(page, request));
  },
});

export { expect };
