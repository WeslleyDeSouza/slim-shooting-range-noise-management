import { expect, test, type Page } from '@playwright/test';

import { skipWelcome } from '../support/login';
import { LOGIN, ROUTES } from '../support/selectors';
import { SCREENSHOT } from './visual.config';

/**
 * Pixel baselines of the home screens: login, entry page and the living
 * styleguide. A page that renders but has lost its design tokens (colours,
 * radii, spacing) passes every functional test and only shows up here.
 *
 * Baselines live in `home.visual.spec.ts-snapshots`, one per browser and
 * platform. After an intended design change regenerate and commit them:
 *
 *   npx playwright test --config apps/app-e2e/playwright.config.ts --project=visual --update-snapshots
 *
 * Content that varies between runs (greeting by time of day, user name,
 * KPI numbers) is masked, so the comparison is about the chrome of the page.
 */

// Prepared, not armed: the design is still moving. Remove this line and run
// `--update-snapshots` once to record the baselines.
test.skip(true, 'visual baselines not recorded yet');

/** Fonts still swapping in would shift every glyph by a pixel. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  // No `networkidle` (flaky by design, lint rule playwright/no-networkidle):
  // the specs assert on a visible element first, so only the font swap is left.
}

test.describe('visual: signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('/auth/login', async ({ page }) => {
    await page.goto(ROUTES.login);
    await expect(page.locator(LOGIN.email)).toBeVisible();
    await settle(page);

    // The fact block on the left rotates every few seconds on a JS timer,
    // which `animations: 'disabled'` cannot freeze.
    await expect(page).toHaveScreenshot('login.png', {
      ...SCREENSHOT,
      mask: [page.locator('.auth-facts'), page.locator('.auth-fact-dots')],
    });
  });
});

test.describe('visual: signed in', () => {
  test.beforeEach(async ({ page }) => {
    await skipWelcome(page);
    // Pin the theme: the toggle persists a choice in localStorage and a
    // previous spec may have left dark mode behind.
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('slim.theme', 'light');
      } catch {
        // storage blocked: the default theme applies
      }
    });
  });

  test('/admin entry page', async ({ page }) => {
    await page.goto(ROUTES.home);
    await expect(page.locator('.slim-hello__name')).toBeVisible();
    await expect(page.locator('.slim-tile__kpi').first()).not.toBeEmpty();
    await settle(page);

    await expect(page).toHaveScreenshot('entry.png', {
      ...SCREENSHOT,
      mask: [
        page.locator('.slim-hello__greet'),
        page.locator('.slim-hello__name'),
        page.locator('.slim-hello__sub'),
        page.locator('.slim-tile__kpi'),
      ],
    });
  });

  test('/styleguide', async ({ page }) => {
    await page.goto('/styleguide');
    await expect(page.locator('.slim-card__title').first()).toBeVisible();
    await settle(page);

    await expect(page).toHaveScreenshot('styleguide.png', {
      ...SCREENSHOT,
      fullPage: true,
    });
  });
});
