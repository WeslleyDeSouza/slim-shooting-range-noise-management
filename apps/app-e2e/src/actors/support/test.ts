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

import * as CryptoJS from 'crypto-js';

import { login, resetSession } from '../../support/login';
import { credentialsOf, type ActorId } from './actors';

/** localStorage keys of auth-ui: user token and tenant token, each wrapped in `{ value }`. */
const USER_TOKEN_KEY = 'utk';
const TENANT_TOKEN_KEY = 'ttk';

async function storedToken(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => {
    const raw = window.localStorage.getItem(k);
    if (!raw) return null;
    const value = (JSON.parse(raw) as { value?: unknown }).value;
    return typeof value === 'string' && value ? value : null;
  }, key);
}

/** Access token (JWT) of the signed-in actor. */
export async function accessToken(page: Page): Promise<string> {
  const token = await storedToken(page, USER_TOKEN_KEY);
  if (!token) throw new Error('no access token in the session — sign in first');
  return token;
}

/**
 * Replay token as `AuthHttpReplayAttackInterceptor` of `@app-galaxy/auth-ui`
 * builds it for every request of the app (header `X-TOKEN-ASGARD`); without
 * it the `ReplayGuard` refuses the call before any role is looked at.
 */
function replayToken(): string {
  const data = { userId: 'TOR', r2: Math.random(), ts: Date.now(), r1: Math.random(), r3: Math.random() };
  return `Tor ${CryptoJS.AES.encrypt(JSON.stringify(data), 'Tor').toString()}`;
}

/** The headers the app itself sends: bearer, tenant token, replay token. */
export async function sessionHeaders(page: Page): Promise<Record<string, string>> {
  const tenant = await storedToken(page, TENANT_TOKEN_KEY);
  return {
    Authorization: `Bearer ${await accessToken(page)}`,
    ...(tenant ? { 'x-token-tenant': tenant } : {}),
    'X-TOKEN-ASGARD': replayToken(),
  };
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
        headers: await sessionHeaders(page),
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
