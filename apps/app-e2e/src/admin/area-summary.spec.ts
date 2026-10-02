import { expect, Page, test } from '@playwright/test';
import { mockMapTiles } from '../support/map';
import { ROUTES } from '../support/selectors';

/**
 * «Schiessplatz-Nutzungen – Übersicht» (B1 5.10, slm 9) of the demo area
 * 1104.020 Geissalp: assessment with both lights, Stand SPM / MPV / Projekt,
 * comparison with the Kontingente and the map of the Empfangspunkte.
 * Signed in through the setup project.
 */
const SUM = {
  page: '[data-testid="summary"]',
  quotaLight: '[data-testid="summary-light-quota"] .slim-badge',
  noiseLight: '[data-testid="summary-light-noise"] .slim-badge',
  row: '[data-testid="summary-quota-row"]',
  year: '[data-testid="summary-year"]',
  rule: '[data-testid="summary-quota-rule"]',
  map: '[data-testid="summary-map"]',
  pin: '[data-testid="summary-pin"]',
  point: '[data-testid="summary-point"]',
  popup: '[data-testid="map-popup"]',
} as const;

/** The colour of a light, read from its badge. */
const COLOUR: Record<string, string> = { 'slim-badge--success': 'ok', 'slim-badge--warning': 'warn', 'slim-badge--danger': 'over' };

async function colourOf(page: Page, selector: string): Promise<string> {
  const classes = (await page.locator(selector).first().getAttribute('class')) ?? '';
  return Object.entries(COLOUR).find(([name]) => classes.includes(name))?.[1] ?? 'none';
}

async function openSummaryOfGeissalp(page: Page): Promise<void> {
  await mockMapTiles(page);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(ROUTES.area);
  await expect(page.locator('.slim-table tbody tr').first()).toContainText('Geissalp');
  await page.locator('.slim-table tbody tr').first().locator('[data-testid="area-action-overview"]').click();
  await expect(page).toHaveURL(/\/admin\/area\/[^/]+\/overview$/);
  await expect(page.locator(SUM.page)).toBeVisible();
}

test.describe('area: overview (5.10)', () => {
  test('shows the assessment, the Stand and the comparison with the Kontingente', async ({ page }) => {
    await openSummaryOfGeissalp(page);

    // 1 Beurteilung: Klassierung and both lights.
    await expect(page.locator('[data-testid="summary-assessment"]')).toContainText('Einhaltung Kontingent Plangenehmigung');
    await expect(page.locator('[data-testid="summary-assessment"]')).toContainText('Aktuelle Lärmbelastung');
    await expect(page.locator(SUM.quotaLight)).toBeVisible();
    await expect(page.locator(SUM.noiseLight)).toBeVisible();

    // 2 Stand SPM / MPV / Projekt from the Stammdaten.
    await expect(page.locator('[data-testid="summary-stand"]')).toContainText('Stand SPM');
    await expect(page.locator('[data-testid^="summary-stand-"]')).toHaveCount(5);

    // 3 Kontingente: one row per Waffe/Kaliber, each comparison with its colour.
    await expect.poll(() => page.locator(SUM.row).count()).toBeGreaterThan(3);
    const states = await page.locator(SUM.row).evaluateAll((rows) =>
      rows.flatMap((row) => [row.getAttribute('data-current'), row.getAttribute('data-average')]),
    );
    expect(states.every((state) => state === 'ok' || state === 'warn' || state === 'over')).toBe(true);
    // The light takes the worst colour of the table (B1 5.10: red before orange before green).
    const worst = states.includes('over') ? 'over' : states.includes('warn') ? 'warn' : 'ok';
    expect(await colourOf(page, SUM.quotaLight)).toBe(worst);
    // The thresholds of the erweiterte Konfiguration are named.
    await expect(page.locator(SUM.rule)).toContainText('100 %');
    await expect(page.locator(SUM.rule)).toContainText('125 %');

    // The light is the same one the list of the Schiessplätze shows.
    await page.goto(ROUTES.area);
    // Cells of a row: box of the multi-selection, Bezeichnung, the two numbers, then the Kontingent light.
    const listLight = page.locator('.slim-table tbody tr').first().locator('td').nth(4).locator('.slim-badge');
    await expect(listLight).toBeVisible();
    expect(await colourOf(page, '.slim-table tbody tr:first-child td:nth-child(5) .slim-badge')).toBe(worst);
  });

  test('compares another year and exports the table', async ({ page }) => {
    await openSummaryOfGeissalp(page);
    await expect.poll(() => page.locator(SUM.row).count()).toBeGreaterThan(3);
    const thisYear = new Date().getFullYear();
    await expect(page.locator(SUM.year)).toHaveValue(String(thisYear));
    const before = await page.locator(SUM.row).first().innerText();

    // The demo data holds only a few usages in the previous year: the Ist values change.
    await page.locator(SUM.year).selectOption(String(thisYear - 1));
    await expect(page.locator('[data-testid="summary-quota"] thead')).toContainText(String(thisYear - 1));
    await expect.poll(async () => page.locator(SUM.row).first().innerText()).not.toBe(before);

    await page.locator('[data-testid="summary-export"]').click();
    const download = page.waitForEvent('download');
    await page.locator('[data-testid="summary-export-csv"]').click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^kontingente_vergleich_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  test('shows the Empfangspunkte on the map with limit and level in a pop-up', async ({ page }) => {
    await openSummaryOfGeissalp(page);
    await page.locator(SUM.map).scrollIntoViewIfNeeded();
    await expect(page.locator(`${SUM.map} [data-testid="map-viewer"]`)).toHaveAttribute('data-status', 'ready', { timeout: 20_000 });
    await expect.poll(() => page.locator(SUM.pin).count()).toBeGreaterThan(3);
    // The list below names the same points.
    expect(await page.locator(SUM.point).count()).toBeGreaterThanOrEqual(await page.locator(SUM.pin).count());

    await page.locator(SUM.pin).first().click();
    const popup = page.locator(SUM.popup);
    await expect(popup).toBeVisible();
    // Grenzwert and Pegel after Anhang 9 (B1 5.10).
    await expect(popup.locator('[data-annex="9"]').first()).toContainText('Anhang 9');
    await expect(popup.locator('[data-annex="9"]').first()).toContainText('dB');

    // «Vollansicht» leads to the map of this Schiessplatz.
    await expect(page.locator(`${SUM.map} [data-testid="map-fullscreen"]`)).toHaveAttribute('href', /\/admin\/area\/[^/]+\/map\?state=/);
  });
});
