import { expect, test } from '@playwright/test';
import { ROUTES } from '../support/selectors';

/**
 * «Schiessplatz – Simulation» (5.13) on the demo area 1104.020 Geissalp
 * (dataset: 16 room × weapon combinations, 6 receivers). Signed in via
 * auth.setup.ts. Nothing is written by the simulation, so the spec leaves the
 * database as it found it.
 */
const SIM = {
  edit: '[data-testid="sim-edit"]',
  reset: '[data-testid="sim-reset"]',
  run: '[data-testid="sim-run"]',
  row: '[data-testid="sim-row"]',
  inside: '[data-testid="sim-inside"]',
  scale: '[data-testid="sim-scale"]',
  resultRow: '[data-testid="sim-result-row"]',
  pin: '[data-testid="sim-pin"]',
  state: '[data-testid="sim-state"]',
  ghost: '.slim-map__ghost',
} as const;

test.describe('area simulation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ROUTES.area);
    // First row of the overview = Geissalp (lowest Koordinationsabschnitt-Nr.);
    // a row click opens the assessment (Details) since the feedback of 12.09.
    await page.locator('.slim-table tbody tr').first().click();
    await expect(page).toHaveURL(/\/admin\/area\/[^/]+\/details$/);
    await page.locator('[data-testid="area-tab-simulation"]').click();
    await expect(page).toHaveURL(/\/simulation$/);
    await expect(page.locator(SIM.row)).toHaveCount(16);
  });

  test('starts from the Ist with the run disabled', async ({ page }) => {
    await expect(page.locator(SIM.run)).toBeDisabled();
    await expect(page.locator(SIM.reset)).toBeDisabled();
    await expect(page.locator(SIM.inside).first()).toBeDisabled();
    await expect(page.locator(SIM.pin)).toHaveCount(6);
    await expect(page.locator(SIM.ghost)).toHaveCount(0);
    await expect(page.locator(SIM.resultRow)).toHaveCount(0);
  });

  test('scales the values, runs the simulation and resets', async ({ page }) => {
    await page.locator(SIM.edit).click();
    await expect(page.locator(SIM.inside).first()).toBeEnabled();
    const before = await page.locator(SIM.inside).first().inputValue();

    await page.locator(`${SIM.scale}[data-factor="1.5"]`).click();
    await expect(page.locator(SIM.run)).toBeEnabled();
    await expect(page.locator(SIM.state)).toContainText(/geändert|changed|modifi/);
    await expect(page.locator(SIM.inside).first()).not.toHaveValue(before);
    await expect(page.locator('.slim-input--changed').first()).toBeVisible();

    await page.locator(SIM.run).click();
    await expect(page.locator(SIM.resultRow)).toHaveCount(6);
    await expect(page.locator(SIM.ghost).first()).toBeVisible();
    // More shots → at least one receiver gets louder.
    await expect(page.locator(`${SIM.resultRow} .sim__d--up`).first()).toBeVisible();
    await expect(page.locator(SIM.state)).toContainText(/aktuell|up to date|à jour|aggiornata/);

    await page.locator(SIM.reset).click();
    await expect(page.locator(SIM.resultRow)).toHaveCount(0);
    await expect(page.locator(SIM.ghost)).toHaveCount(0);
    await expect(page.locator(SIM.inside).first()).toHaveValue(before);
    await expect(page.locator(SIM.run)).toBeDisabled();
  });

  test('a typed value marks the result stale until it is run again', async ({ page }) => {
    await page.locator(SIM.edit).click();
    await page.locator(`${SIM.scale}[data-factor="1.2"]`).click();
    await page.locator(SIM.run).click();
    await expect(page.locator(SIM.resultRow)).toHaveCount(6);

    const input = page.locator(SIM.inside).first();
    await input.fill('999');
    await input.dispatchEvent('change');
    await expect(page.locator(SIM.state)).toContainText(/veraltet|outdated|obsol/);

    await page.locator(SIM.run).click();
    await expect(page.locator(SIM.state)).toContainText(/aktuell|up to date|à jour|aggiornata/);
  });

  test('shows the popover of a receiver pin', async ({ page }) => {
    await page.locator(`${SIM.pin}[data-code="E1"]`).click();
    await expect(page.locator('.slim-map__pop')).toBeVisible();
    await expect(page.locator('.slim-map__pop')).toContainText('E1');
    await expect(page.locator('.slim-map__pop')).toContainText('dB');
  });
});
