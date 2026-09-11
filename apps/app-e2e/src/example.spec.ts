import { expect, test } from '@playwright/test';

/** Smoke test: the shell renders and the API answers through the proxy. */
test('serves the application shell', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/SLIM/i);
  await expect(page.locator('app-root')).toBeAttached();
  await expect(page.locator('.slim-home__status .badge')).toHaveText('online');
});
