import { expect, test } from '@playwright/test';

/** Smoke test: the shell renders and the API answers through the proxy. */
test('serves the entry page with the API status', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/SLIM/i);
  await expect(page.locator('app-root')).toBeAttached();
  await expect(page.locator('.slim-hello__name')).toBeVisible();
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

test('navigates to the ranges overview and filters it', async ({ page }) => {
  await page.goto('/');
  await page.locator('.slim-tile').first().click();

  await expect(page).toHaveURL(/\/schiessplaetze$/);
  await expect(page.locator('.slim-table tbody tr')).toHaveCount(8);

  await page.locator('.slim-search__input').fill('Thun');
  await expect(page.locator('.slim-table tbody tr')).toHaveCount(1);
});

test('switches the language', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/schiessplaetze');

  await page.getByRole('button', { name: 'FR' }).click();
  await expect(page.locator('.slim-page__title')).toHaveText(
    /Aperçu des places de tir/,
  );
});

test('renders the styleguide', async ({ page }) => {
  await page.goto('/styleguide');

  await expect(page.locator('.slim-btn--primary').first()).toBeVisible();
  await expect(page.locator('.slim-tabbar')).toBeVisible();
});
