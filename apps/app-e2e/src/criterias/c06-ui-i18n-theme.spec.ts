import { criteria, test } from './support/criteria';

/**
 * Benutzeroberfläche (B1 5.x Querschnitt, 12.x) — slm 50–52, Abnahmekriterium K6.
 *
 * Skeleton (see README.md): every case is `test.fixme` with its steps; make it
 * real by replacing the steps with assertions and dropping the fixme.
 */
test.describe('c06-ui-i18n-theme', () => {
  test.fixme(
    "switches DE / FR / IT / EN and keeps the choice after a reload",
    { annotation: criteria({"slm":[51]}) },
    async () => {
      // Language switch in the topbar; reload; page titles in the chosen language (area.locale.json).
    },
  );
  test.fixme(
    "keeps light / dark theme per user",
    { annotation: criteria({"slm":[50]}) },
    async () => {
      // Covered by admin.spec.ts «switches the theme and keeps it».
    },
  );
  test.fixme(
    "renders every area page at 375 px without horizontal scrolling",
    { annotation: criteria({"slm":[52],"acceptance":[6]}) },
    async () => {
      // Viewport 375×812: document.scrollingElement.scrollWidth === 375 on overview, shots, details, simulation; tabbar visible, sidebar hidden.
    },
  );
  test.fixme(
    "is keyboard operable and passes an axe scan on the main pages",
    { annotation: criteria({"slm":[52]}) },
    async () => {
      // Tab through the overview to the first row action; run @axe-core/playwright (to be added) with no serious violations.
    },
  );
  test.fixme(
    "offers context help within 2 s (slm 53)",
    { annotation: criteria({"slm":[53]}) },
    async () => {
      // Info icons carry titles today; the manual upload (5.28) is open.
    },
  );
});
