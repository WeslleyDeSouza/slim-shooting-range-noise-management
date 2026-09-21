import { ACCOUNTS, criteria, expect, test } from './support/criteria';
import { LOGIN } from '../support/selectors';

/**
 * Sitemap und Deep Links (B1 5.7, docs/architecture/sitemap.md) — slm 5, 6, 7, Abnahmekriterium K4.
 *
 * Skeleton (see README.md): every case is `test.fixme` with its steps; make it
 * real by replacing the steps with assertions and dropping the fixme.
 */
test.describe('c08-sitemap', () => {
  test.fixme(
    "every route of APP_ROUTES is reachable and renders a page title",
    { annotation: criteria({"acceptance":[4]}) },
    async () => {
      // Iterate APP_ROUTES (functions with the Geissalp id); expect .slim-page__title visible and no 404 component.
    },
  );
  test.describe('deep link without session', () => {
    // These drive the login form, so they start signed out (the setup project's storageState would short-circuit them).
    test.use({ storageState: { cookies: [], origins: [] } });

    for (const deepLink of ['/admin/data-management/weapons/caliber', '/admin/test-123']) {
      test(
        `${deepLink}: redirects to the login and comes back after signing in`,
        { annotation: criteria({ slm: [5, 6] }) },
        async ({ page }) => {
          await page.goto(deepLink);
          await expect(page).toHaveURL(`/auth/login?returnUrl=${encodeURIComponent(deepLink)}`);
          await page.fill(LOGIN.email, ACCOUNTS.admin.email);
          await page.fill(LOGIN.password, ACCOUNTS.admin.password);
          await page.click(LOGIN.submit);
          // The single tenant of the demo continues on its own; the parked deep link wins over /admin.
          await expect(page).toHaveURL(deepLink, { timeout: 20_000 });
          await expect(page.locator('app-admin-layout')).toBeVisible();
        },
      );
    }
  });
  test.fixme(
    "the entry page shows the counts of the tenant",
    { annotation: criteria({"slm":[7]}) },
    async () => {
      // Covered by admin.spec.ts (9 areas); extend with the users/weapons tiles.
    },
  );
});
