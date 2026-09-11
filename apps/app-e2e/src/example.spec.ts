import { expect, test } from '@playwright/test';

/** Smoke test: the shell renders and the API answers through the proxy. */
test('serves the application shell', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/SLIM/i);
  await expect(page.locator('app-root')).toBeAttached();
  await expect(page.locator('.slim-home__status .slim-badge')).toHaveText(
    /online/,
  );
});

test('switches the theme and keeps it', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');

  await page.getByRole('button', { name: /Design/ }).click();
  const theme = await html.getAttribute('data-theme');
  expect(['light', 'dark']).toContain(theme);

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', theme as string);
});

test('renders the styleguide', async ({ page }) => {
  await page.goto('/styleguide');

  await expect(page.locator('.slim-btn--primary').first()).toBeVisible();
  await expect(page.locator('.slim-tabbar')).toBeVisible();
});
