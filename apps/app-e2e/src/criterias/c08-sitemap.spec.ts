import { criteria, test } from './support/criteria';

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
  test.fixme(
    "a deep link without session redirects to the login and comes back after signing in",
    { annotation: criteria({"slm":[5,6]}) },
    async () => {
      // Covered partly by login.spec.ts «redirects a visitor without session»; add the returnUrl round trip.
    },
  );
  test.fixme(
    "the entry page shows the counts of the tenant",
    { annotation: criteria({"slm":[7]}) },
    async () => {
      // Covered by admin.spec.ts (9 areas); extend with the users/weapons tiles.
    },
  );
});
