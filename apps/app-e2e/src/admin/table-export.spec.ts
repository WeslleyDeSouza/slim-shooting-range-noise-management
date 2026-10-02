import { readFileSync } from 'node:fs';
import { Download, expect, Page, test } from '@playwright/test';
import * as ExcelJS from 'exceljs';
import { ROUTES } from '../support/selectors';

/**
 * Export of tables as Excel / CSV (B1 5.5.5, slm 3), the address of a single
 * Nutzung (B1 5.6, slm 5) and the sums per unit on the shots page — on the
 * demo data (Geissalp, 1104.020). Signed in through the setup project.
 */
const AREA = {
  row: '.slim-table tbody tr',
  search: '.slim-search__input',
} as const;

const SHOTS = {
  row: '[data-testid="shots-row"]',
  search: '[data-testid="shots-search"]',
  edit: '[data-testid="shots-edit"]',
  drawer: '[data-testid="shots-drawer"]',
  quantity: '[data-testid="shots-quantity"]',
  missing: '[data-testid="shots-usage-missing"]',
} as const;

/** Row of the column titles in an exported sheet (below the block of eight rows and the separator). */
const TITLE_ROW = 10;

/** Picks a format in the menu of an export button (opens the menu when it is shut) and returns the file. */
async function exportAs(page: Page, testId: string, format: 'xlsx' | 'csv'): Promise<Download> {
  const item = page.locator(`[data-testid="${testId}-${format}"]`);
  if (!(await item.isVisible())) await page.locator(`[data-testid="${testId}"]`).click();
  const download = page.waitForEvent('download');
  await item.click();
  return download;
}

async function sheetOf(download: Download): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(await download.path());
  return workbook.worksheets[0];
}

const valuesOf = (ws: ExcelJS.Worksheet, row: number): unknown[] => (ws.getRow(row).values as unknown[]).slice(1);

async function openShotsOfGeissalp(page: Page): Promise<void> {
  await page.goto(ROUTES.area);
  await expect(page.locator(AREA.row).first()).toContainText('Geissalp');
  await page.locator(AREA.row).first().locator('[data-testid="area-action-shots"]').click();
  await expect(page).toHaveURL(/\/admin\/area\/[^/]+\/shots$/);
  await expect.poll(() => page.locator(SHOTS.row).count()).toBeGreaterThan(10);
}

test.describe('export of tables', () => {
  test('exports the overview of the Schiessplätze as Excel: the rows shown, with the fixed block and titles', async ({ page }) => {
    await page.goto(ROUTES.area);
    await expect(page.locator(AREA.row)).toHaveCount(9);

    // The export follows the filter: one Schiessplatz is left.
    await page.locator(AREA.search).fill('Thun');
    await expect(page.locator(AREA.row)).toHaveCount(1);
    await page.locator('[data-testid="area-export"]').click();
    await expect(page.locator('[data-testid="area-export-scope"]')).toContainText('1 angezeigte Zeilen');

    const download = await exportAs(page, 'area-export', 'xlsx');
    expect(download.suggestedFilename()).toMatch(/^schiessplaetze_\d{4}-\d{2}-\d{2}\.xlsx$/);

    const ws = await sheetOf(download);
    expect(ws.getCell('A1').value).toBe('Übersicht Schiessplätze');
    expect(ws.getCell('B2').value).toBe('1 angezeigte Zeilen');
    expect([ws.getCell('A4').value, ws.getCell('B4').value]).toEqual(['Suche:', 'Thun']);
    expect(String(ws.getCell('B8').value)).not.toBe('-');
    expect(valuesOf(ws, TITLE_ROW).slice(0, 3)).toEqual(['Bezeichnung', 'Koordinationsabschnitt-Nr.', 'Sachplan-Nr.']);
    expect(valuesOf(ws, TITLE_ROW + 1)[0]).toBe('Thun');
    expect(ws.rowCount).toBe(TITLE_ROW + 1);
    // Fixed header: the block and the titles stay in place when scrolling.
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: TITLE_ROW });
  });

  test('exports the whole overview as CSV: one line per Schiessplatz', async ({ page }) => {
    await page.goto(ROUTES.area);
    await expect(page.locator(AREA.row)).toHaveCount(9);
    const download = await exportAs(page, 'area-export', 'csv');
    expect(download.suggestedFilename()).toMatch(/^schiessplaetze_\d{4}-\d{2}-\d{2}\.csv$/);

    const lines = readFileSync(await download.path(), 'utf8').replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0].split(';').slice(0, 2)).toEqual(['Bezeichnung', 'Koordinationsabschnitt-Nr.']);
    expect(lines).toHaveLength(10);
    expect(lines.some((line) => line.startsWith('Geissalp;1104.020;'))).toBe(true);
  });

  test('exports the marked usages of the shots page (B1 5.5.3)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openShotsOfGeissalp(page);

    const boxes = page.locator(`${SHOTS.row} input[type="checkbox"]:not([disabled])`);
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    await page.locator('[data-testid="shots-export"]').click();
    await expect(page.locator('[data-testid="shots-export-scope"]')).toContainText('2 ausgewählte Zeilen');
    const download = await exportAs(page, 'shots-export', 'xlsx');
    expect(download.suggestedFilename()).toMatch(/^schusszahlen_\d{4}-\d{2}-\d{2}\.xlsx$/);

    const ws = await sheetOf(download);
    expect(ws.getCell('B2').value).toBe('2 ausgewählte Zeilen');
    // The Schiessplatz stands next to the title.
    expect(JSON.stringify(ws.getCell('A1').value)).toContain('1104.020 Geissalp');
    const titles = valuesOf(ws, TITLE_ROW);
    expect(titles).toEqual(expect.arrayContaining(['Stellungsraum', 'Nutzungseinheit', 'Datum', 'Anzahl Schuss', 'Sprengstoff (kg)', 'Erfasser']));
    expect(ws.rowCount).toBe(TITLE_ROW + 2);
    // Quantities are numbers, one column per unit.
    expect(typeof ws.getRow(TITLE_ROW + 1).getCell(titles.indexOf('Anzahl Schuss') + 1).value).toBe('number');
  });
});

test.describe('a usage under its own address', () => {
  test('opens the drawer of the usage the address names, and the address follows the drawer', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openShotsOfGeissalp(page);

    const first = page.locator(SHOTS.row).first();
    await first.locator(SHOTS.edit).click();
    await expect(page.locator(SHOTS.drawer)).toBeVisible();
    await expect(page).toHaveURL(/\/shots\?usage=[0-9a-f-]{36}$/);
    const address = page.url();
    const unit = await page.locator(`${SHOTS.drawer} [formControlName="unit"]`).inputValue();
    expect(unit).not.toBe('');

    // Closing takes the usage out of the address again.
    await page.locator(`${SHOTS.drawer} .slim-sheet__close`).click();
    await expect(page.locator(SHOTS.drawer)).toHaveCount(0);
    await expect(page).toHaveURL(/\/shots$/);

    // The address alone opens the same usage (a link in a mail, a bookmark).
    await page.goto(address);
    await expect(page.locator(SHOTS.drawer)).toBeVisible();
    await expect(page.locator(`${SHOTS.drawer} [formControlName="unit"]`)).toHaveValue(unit);
  });

  test('says so when the address names a usage that does not exist', async ({ page }) => {
    await openShotsOfGeissalp(page);
    const base = page.url();
    await page.goto(`${base}?usage=11111111-1111-4111-8111-111111111111`);
    await expect(page.locator(SHOTS.missing)).toContainText('Diese Nutzung gibt es auf diesem Schiessplatz nicht');
    await expect(page.locator(SHOTS.drawer)).toHaveCount(0);
    await expect(page).toHaveURL(/\/shots$/);
  });
});

test.describe('sums per unit', () => {
  test('shows Sprengstoff in kg, never added to the shots', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openShotsOfGeissalp(page);

    // The demo year records Sprengladungen: a KPI of its own, in kg.
    await expect(page.locator('[data-testid="shots-kpi-kg"]')).toContainText('kg');

    await page.locator(SHOTS.search).fill('Sprengladung');
    await expect.poll(() => page.locator(SHOTS.row).count()).toBeGreaterThan(0);
    const quantity = page.locator(SHOTS.row).first().locator(SHOTS.quantity);
    await expect(quantity.locator('[data-unit="kg"]')).toContainText('kg');
    await expect(quantity.locator('[data-unit="shots"]')).toHaveCount(0);
    // The sum below the table names kg as well, and no shots for these rows.
    const foot = page.locator('[data-testid="shots-foot-sum"]');
    await expect(foot.locator('[data-unit="kg"]')).toContainText('kg');
    await expect(foot.locator('[data-unit="shots"]')).toHaveCount(0);
  });
});
