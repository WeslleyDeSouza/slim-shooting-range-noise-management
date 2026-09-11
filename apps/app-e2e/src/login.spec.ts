import { expect, test } from '@playwright/test';

import { credentials } from './support/credentials';
import { currentUserId, hasSession, login } from './support/login';
import { LOGIN, ROUTES } from './support/selectors';

// This suite drives the login form itself, so it must start signed out —
// the `setup` project's storageState would short-circuit everything here.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('login', () => {
  test('redirects a visitor without session to the login', async ({ page }) => {
    await page.goto(ROUTES.area);
    await expect(page).toHaveURL(/\/auth\/login\?returnUrl=/);
    await expect(page.locator(LOGIN.email)).toBeVisible();
  });

  test('renders the login form', async ({ page }) => {
    await page.goto(ROUTES.login);

    await expect(page.locator(LOGIN.email)).toBeVisible();
    await expect(page.locator(LOGIN.password)).toBeVisible();
    await expect(page.locator(LOGIN.submit)).toBeVisible();
    expect(await hasSession(page)).toBe(false);
  });

  test('signs in the demo user and creates a session', async ({ page }) => {
    await login(page);

    expect(await hasSession(page)).toBe(true);
    await expect(page.locator(LOGIN.email)).toHaveCount(0);
    await expect(page.locator('.slim-hello__name')).toBeVisible();

    const userId = await currentUserId(page);
    expect(userId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  test('rejects a wrong password and creates no session', async ({ page }) => {
    const { email } = credentials();

    await page.goto(ROUTES.login);
    await page.waitForSelector(LOGIN.email);
    await page.fill(LOGIN.email, email);
    await page.fill(LOGIN.password, 'definitely-not-the-password');
    await page.click(LOGIN.submit);

    await expect(page.locator('.auth-form-err')).toBeVisible();
    // Never assert on the URL here: a real login redirects through
    // /auth/tenant-login, so "left /auth/login" would pass for a rejection too.
    await page.waitForTimeout(3_000);
    expect(await hasSession(page)).toBe(false);
    await expect(page.locator(LOGIN.email)).toBeVisible();
  });
});
