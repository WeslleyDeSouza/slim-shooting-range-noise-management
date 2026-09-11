import { expect, test } from '@playwright/test';
import { credentials } from './support/credentials';
import { LOGIN, ROUTES } from './support/selectors';

// Own, empty session: this spec exercises the login itself.
test.use({ storageState: { cookies: [], origins: [] } });

test('redirects a visitor without session to the login', async ({ page }) => {
  await page.goto(ROUTES.area);
  await expect(page).toHaveURL(/\/auth\/login\?returnUrl=/);
  await expect(page.locator(LOGIN.email)).toBeVisible();
});

test('rejects wrong credentials with a message', async ({ page }) => {
  await page.goto(ROUTES.login);
  await page.fill(LOGIN.email, credentials().email);
  await page.fill(LOGIN.password, 'definitely-wrong');
  await page.click(LOGIN.submit);
  await expect(page.locator('.auth-form-err')).toBeVisible();
});

test('signs in with the demo user and lands in the admin', async ({ page }) => {
  await page.goto(ROUTES.login);
  await page.fill(LOGIN.email, credentials().email);
  await page.fill(LOGIN.password, credentials().password);
  await page.click(LOGIN.submit);

  await page
    .waitForURL((url) => !/\/auth\//.test(url.pathname), {
      timeout: 30_000,
    })
    .catch(async () => {
      const tenant = page.locator(LOGIN.tenant).first();
      if (await tenant.isVisible().catch(() => false)) await tenant.click();
      await page.waitForURL((url) => !/\/auth\//.test(url.pathname), {
        timeout: 30_000,
      });
    });
  await expect(page.locator('.slim-hello__name')).toBeVisible();
});
