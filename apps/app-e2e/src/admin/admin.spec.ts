import { expect, test } from '@playwright/test';
import { skipWelcome } from '../support/login';
import { ROUTES, WELCOME } from '../support/selectors';

/** Signed-in pages (session from auth.setup.ts). */
test('shows the demo welcome banner once per session and opens the example area', async ({
  page,
}) => {
  await page.goto(ROUTES.home);

  const dialog = page.locator(WELCOME.dialog);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(
    /Demoversion|Demo version|démonstration|dimostrativa/i,
  );
  await page.locator(WELCOME.close).click();
  await expect(dialog).toBeHidden();

  // Dismissed for the browser session: a reload does not bring it back …
  await page.reload();
  await expect(page.locator('.slim-hello__name')).toBeVisible();
  await expect(dialog).toHaveCount(0);

  // … but a fresh session shows it again, and «Beispielplatz öffnen» opens the
  // prepared example Schiessplatz (Geissalp, 1104.020) on its shots page.
  await page.evaluate(
    (key) => window.sessionStorage.removeItem(key),
    WELCOME.seenKey,
  );
  await page.reload();
  await expect(dialog).toBeVisible();
  await page.locator(WELCOME.start).click();
  await expect(page).toHaveURL(/\/admin\/area\/[^/]+\/shots$/);
  await expect(page.locator('.area-ctx__name')).toContainText('Geissalp');
});

test.describe('entry page', () => {
  test.beforeEach(async ({ page }) => {
    await skipWelcome(page);
  });

  test('serves the entry page with the area KPIs from the API', async ({
    page,
  }) => {
    await page.goto(ROUTES.home);

    await expect(page).toHaveTitle(/SLIM/i);
    await expect(page.locator('.slim-hello__name')).toBeVisible();
    // Tile KPIs come from GET admin/area/summary (9 areas of the demo dataset).
    await expect(page.locator('.slim-tile__kpi').first()).toContainText('9');
  });

  test('switches the theme and keeps it', async ({ page }) => {
    await page.goto(ROUTES.home);
    const html = page.locator('html');

    // `getAttribute` does not retry: reading it right after the click raced
    // the toggle on CI (read «light», reload showed «dark»). Derive the
    // expected value from the state before the click and assert with retry.
    const before = await html.getAttribute('data-theme');
    const theme = before === 'dark' ? 'light' : 'dark';
    await page.getByRole('button', { name: /Design/ }).click();
    await expect(html).toHaveAttribute('data-theme', theme);

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', theme);
  });

  test('navigates to the area overview and filters it', async ({ page }) => {
    await page.goto(ROUTES.home);
    await page.locator('.slim-tile').first().click();

    await expect(page).toHaveURL(/\/admin\/area$/);
    await expect(page.locator('.slim-table tbody tr')).toHaveCount(9);

    await page.locator('.slim-search__input').fill('Thun');
    await expect(page.locator('.slim-table tbody tr')).toHaveCount(1);
  });

  test('switches the language', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(ROUTES.area);

    await page.getByRole('button', { name: 'FR', exact: true }).click();
    await expect(page.locator('.slim-page__title')).toHaveText(
      /Aperçu des places de tir/,
    );
    await page.getByRole('button', { name: 'DE', exact: true }).click();
  });
});

test('renders the styleguide', async ({ page }) => {
  await page.goto('/styleguide');

  await expect(page.locator('.slim-btn--primary').first()).toBeVisible();
  // Desktop viewport: sidebar visible, tabbar hidden (never both).
  await expect(page.locator('.slim-sidebar')).toBeVisible();
  await expect(page.locator('.slim-tabbar')).toBeHidden();
});
