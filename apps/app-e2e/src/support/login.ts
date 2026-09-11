import { expect, type Page } from '@playwright/test';

import { credentials, type Credentials } from './credentials';
import {
  COLD_START_TIMEOUT_MS,
  LOGIN,
  ROUTES,
  SESSION_KEY,
  SESSION_TIMEOUT_MS,
} from './selectors';

/**
 * Sign in and wait until the session really exists (`app.session` is written
 * only after the API accepted the credentials), then let the tenant step
 * finish — with one tenant the chooser continues on its own.
 */
export async function login(
  page: Page,
  who: Credentials = credentials(),
): Promise<void> {
  await expect(async () => {
    await page.goto(ROUTES.login);
    await page.waitForSelector(LOGIN.email);
    await page.fill(LOGIN.email, who.email);
    await page.fill(LOGIN.password, who.password);
    await page.click(LOGIN.submit);
    await expect
      .poll(() => hasSession(page), {
        timeout: SESSION_TIMEOUT_MS,
        message: `no ${SESSION_KEY} was created — the API rejected ${who.email}`,
      })
      .toBe(true);
  }, `could not sign in as ${who.email}`).toPass({
    timeout: COLD_START_TIMEOUT_MS,
    intervals: [2_000],
  });

  const left = await page
    .waitForURL((url) => !/\/auth\//.test(url.pathname), { timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  if (!left) {
    const seeded = page.locator(LOGIN.tenant).first();
    if (await seeded.isVisible().catch(() => false)) {
      await seeded.click().catch(() => undefined);
    }
    await page
      .waitForURL((url) => !/\/auth\//.test(url.pathname), {
        timeout: SESSION_TIMEOUT_MS,
      })
      .catch(() => undefined);
  }
  await page.waitForLoadState('load').catch(() => undefined);
}

export async function resetSession(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.evaluate(() => window.localStorage.clear());
}

export function hasSession(page: Page): Promise<boolean> {
  return page.evaluate(
    (key) => window.localStorage.getItem(key) !== null,
    SESSION_KEY,
  );
}

/** userId of the stored session (auth-ui wraps the JSON in { value }). */
export async function currentUserId(page: Page): Promise<string> {
  const userId = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const outer = JSON.parse(raw) as { value?: unknown };
    const inner = (
      typeof outer.value === 'string' ? JSON.parse(outer.value) : outer.value
    ) as { user?: { userId?: string } } | undefined;
    return inner?.user?.userId ?? null;
  }, SESSION_KEY);
  return userId ?? '';
}
