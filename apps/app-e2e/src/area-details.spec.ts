import { expect, test } from '@playwright/test';
import { ROUTES } from './support/selectors';

/**
 * Schiessplatz – Details · Empfangspunkte (B1 5.12). Signed in via the
 * setup project; data is the demo dataset (Geissalp: 6 receivers, two
 * calculation states, E1 over the IGW on the initial state).
 */
const DETAILS = {
  tab: '[data-testid="area-tab-details"]',
  select: '[data-testid="details-calc-select"]',
  map: '[data-testid="details-map"]',
  pin: '[data-testid="details-pin"]',
  listToggle: '[data-testid="details-list-toggle"]',
  listItem: '[data-testid="details-list-item"]',
  aside: '[data-testid="details-aside"]',
  row: '[data-testid="details-row"]',
  delta: '[data-testid="details-delta"]',
  counts: '[data-testid="details-counts"]',
} as const;

test.beforeEach(async ({ page }) => {
  await page.goto(ROUTES.area);
  // First row of the overview is 1104.020 Geissalp (sorted by number).
  await page.locator('.slim-table tbody tr.slim-table__row').first().click();
  await page.locator(DETAILS.tab).click();
  await expect(page).toHaveURL(/\/admin\/area\/[^/]+\/details$/);
  await expect(page.locator(DETAILS.map)).toBeVisible();
});

test('shows every receiver on the map with the counts', async ({ page }) => {
  await expect(page.locator(DETAILS.pin)).toHaveCount(6);
  await expect(page.locator(`${DETAILS.counts} .slim-stat__value`).first()).toHaveText('6');
});

test('assesses the selected receiver against the limits', async ({ page }) => {
  await page.locator(`${DETAILS.pin}[data-code="E1"]`).click();
  const aside = page.locator(DETAILS.aside);
  await expect(aside).toContainText('E1');
  await expect(aside.locator(DETAILS.row)).toHaveCount(4);
  await expect(aside.locator(DETAILS.row).first()).toContainText('60 dB');
  await expect(aside.locator(DETAILS.row).first()).toContainText('60.8');
});

test('switches the calculation state and shows the delta', async ({ page }) => {
  await page.locator(`${DETAILS.pin}[data-code="E1"]`).click();
  const firstRow = page.locator(DETAILS.aside).locator(DETAILS.row).first();
  await expect(firstRow).toContainText('60.8');

  const select = page.locator(DETAILS.select);
  const options = await select.locator('option').all();
  expect(options.length).toBe(2);
  await select.selectOption({ index: 1 });

  await expect(firstRow).toContainText('56.4');
  await expect(page.locator(DETAILS.delta).first()).toBeVisible();
  await expect(page.locator(DETAILS.delta).first()).toContainText('-4.4');
});

test('lists the receivers worst first', async ({ page }) => {
  await page.locator(DETAILS.listToggle).click();
  await expect(page.locator(DETAILS.map)).toHaveCount(0);
  const items = page.locator(DETAILS.listItem);
  await expect(items).toHaveCount(6);
  await expect(items.first()).toHaveAttribute('data-state', 'over');
  await expect(items.last()).toHaveAttribute('data-state', 'none');
});
