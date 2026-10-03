import { readFileSync } from 'node:fs';
import { expect, Page, test } from '@playwright/test';
import { mockMapTiles } from '../support/map';
import { ROUTES } from '../support/selectors';

/**
 * Table functions of B1 5.5 (slm 3) in the masks: sorting by a column
 * (5.5.2), marking several rows with the box, Ctrl and Shift (5.5.3), and the
 * export of the marked rows (5.5.5). Demo area 1104.020 Geissalp; signed in
 * through the setup project.
 */
const BOM = String.fromCharCode(0xfeff);

/** Exports the table behind the button as CSV: the scope the menu names and the lines of the file. */
async function exportCsv(page: Page, testId: string): Promise<{ scope: string; fileName: string; lines: string[][] }> {
  const button = page.locator(`[data-testid="${testId}"]`);
  await button.scrollIntoViewIfNeeded();
  await button.click();
  // The menu is rendered after the click; its scope line comes with the same render.
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  const scope =(await page.locator(`[data-testid="${testId}-scope"]`).textContent())?.trim() ?? '';
  const download = page.waitForEvent('download');
  await page.locator(`[data-testid="${testId}-csv"]`).click();
  const file = await download;
  const lines = readFileSync(await file.path(), 'utf8').replace(BOM, '').trim().split(/\r?\n/).map((line) => line.split(';'));
  return { scope, fileName: file.suggestedFilename(), lines: lines.slice(1) };
}

/** The id of the demo area, read from the address of its details page. */
async function geissalpId(page: Page): Promise<string> {
  await page.goto(ROUTES.area);
  const row = page.locator('[data-testid="area-row"]', { hasText: 'Geissalp' });
  await row.locator('[data-testid="area-action-details"]').click();
  await expect(page).toHaveURL(/\/admin\/area\/[^/]+\/details$/);
  return page.url().split('/admin/area/')[1].split('/')[0];
}

test.describe('table functions: sorting, multi-selection, export of the selection (B1 5.5)', () => {
  test.beforeEach(async ({ page }) => {
    await mockMapTiles(page);
    await page.setViewportSize({ width: 1280, height: 1000 });
  });

  test('Übersicht Schiessplätze: sorts by a column, marks rows with box, Ctrl and Shift, exports the marked rows', async ({ page }) => {
    await page.goto(ROUTES.area);
    const rows = page.locator('[data-testid="area-row"]');
    await expect.poll(() => rows.count()).toBeGreaterThan(3);
    const names = () => rows.locator('.area__name').allTextContents();
    const sorted = (list: string[], direction: 1 | -1) => [...list].sort((a, b) => a.localeCompare(b, 'de-CH', { numeric: true, sensitivity: 'base' }) * direction);

    // 5.5.2: ascending, descending, then the order of the mask again.
    const initial = await names();
    const title = page.locator('[data-testid="area-sort-name"]');
    await title.locator('button').click();
    await expect(title).toHaveAttribute('aria-sort', 'ascending');
    expect(await names()).toEqual(sorted(initial, 1));
    await title.locator('button').click();
    await expect(title).toHaveAttribute('aria-sort', 'descending');
    expect(await names()).toEqual(sorted(initial, -1));

    // 5.5.3: the box of the first row, Shift + click on the box of the third one: three rows.
    const boxes = page.locator('[data-testid="area-select"]');
    await boxes.nth(0).click();
    await boxes.nth(2).click({ modifiers: ['Shift'] });
    await expect(page.locator('[data-testid="area-selected"]')).toContainText('3');
    // Ctrl + click on the second row unmarks it and does not open the Schiessplatz.
    await rows.nth(1).locator('td').nth(2).click({ modifiers: ['Control'] });
    await expect(page).toHaveURL(new RegExp(`${ROUTES.area}(\\?.*)?$`));
    await expect(page.locator('[data-testid="area-selected"]')).toContainText('2');
    await expect(rows.nth(0)).toHaveClass(/slim-table__row--selected/);
    await expect(rows.nth(1)).not.toHaveClass(/slim-table__row--selected/);

    // 5.5.5: the file holds the two marked rows, in the order shown.
    const shown = await names();
    const file = await exportCsv(page, 'area-export');
    expect(file.scope).toContain('2');
    expect(file.fileName).toMatch(/^schiessplaetze_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(file.lines.map((line) => line[0])).toEqual([shown[0], shown[2]]);

    // A plain click still opens the Schiessplatz.
    await rows.nth(1).locator('td').nth(2).click();
    await expect(page).toHaveURL(/\/admin\/area\/[^/]+\/details$/);
  });

  test('Datenverwaltung: Stellungsräume and Kontingente — marked rows only, sorted as shown', async ({ page }) => {
    const id = await geissalpId(page);

    await page.goto(`/admin/data-management/area/${id}/general/overview`);
    const rooms = page.locator('[data-testid="dmo-room-row"]');
    await expect.poll(() => rooms.count()).toBeGreaterThan(5);
    const boxes = page.locator('[data-testid="dmo-select"]');
    await boxes.nth(1).click();
    await boxes.nth(4).click({ modifiers: ['Shift'] });
    await expect(page.locator('[data-testid="dmo-room-row"].slim-table__row--selected')).toHaveCount(4);
    const roomFile = await exportCsv(page, 'dmo-export');
    expect(roomFile.lines).toHaveLength(4);

    await page.goto(`/admin/data-management/area/${id}/general/master-data`);
    const quotas = page.locator('[data-testid="dmm-quota-row"]');
    await expect.poll(() => quotas.count()).toBeGreaterThan(3);
    // Maximale Schusszahl descending: the file follows the table.
    const max = page.locator('[data-testid="dmm-sort-max"]');
    await max.locator('button').click();
    await max.locator('button').click();
    await expect(max).toHaveAttribute('aria-sort', 'descending');
    const quotaFile = await exportCsv(page, 'dmm-export');
    const amounts = quotaFile.lines.map((line) => Number(line[1]));
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
    expect(quotaFile.lines).toHaveLength(await quotas.count());
  });

  test('Berechnungen: sorts the Details and exports the table of the open tab', async ({ page }) => {
    const id = await geissalpId(page);
    await page.goto(`/admin/data-management/area/${id}/calculations/details`);
    const rows = page.locator('[data-testid="dcd-row"]');
    await expect.poll(() => rows.count()).toBeGreaterThan(2);

    const lae = page.locator('[data-testid="dcd-wlr-sort-lae"]');
    await lae.locator('button').click();
    await expect(lae).toHaveAttribute('aria-sort', 'ascending');
    const file = await exportCsv(page, 'dcd-export');
    expect(file.fileName).toMatch(/^berechnung_wlr_day_/);
    expect(file.lines).toHaveLength(await rows.count());
    const levels = file.lines.map((line) => Number(line[8]));
    expect(levels).toEqual([...levels].sort((a, b) => a - b));

    // Two marked levels: the file holds these two, and the menu says so.
    const boxes = page.locator('[data-testid="dcd-select"]');
    await boxes.nth(0).click();
    await boxes.nth(1).click();
    const marked = await exportCsv(page, 'dcd-export');
    expect(marked.scope).toContain('ausgewählte');
    expect(marked.lines.map((line) => Number(line[8]))).toEqual(levels.slice(0, 2));

    // Another tab is another table with its own file; the marks do not carry over.
    await page.locator('[data-testid="dcd-tab-a9"]').click();
    await expect(page.locator('[data-testid="dcd-a9"]')).toBeVisible();
    const a9 = await exportCsv(page, 'dcd-export');
    expect(a9.fileName).toMatch(/^betriebsdaten_anhang9_/);
    expect(a9.scope).toContain('angezeigte');
    expect(a9.lines).toHaveLength(await rows.count());
  });
});
