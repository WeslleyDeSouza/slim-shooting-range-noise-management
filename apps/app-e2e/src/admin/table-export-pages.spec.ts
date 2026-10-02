import { readFileSync } from 'node:fs';
import { expect, Page, test } from '@playwright/test';
import { mockMapTiles } from '../support/map';
import { ROUTES } from '../support/selectors';

/**
 * Every table with an «Exportieren» button writes a file that holds the
 * table (B1 5.5.5, slm 3): the column titles and one line per row shown.
 * Demo area 1104.020 Geissalp; signed in through the setup project.
 */
const BOM = String.fromCharCode(0xfeff);

interface Exported {
  fileName: string;
  /** Column titles. */
  header: string[];
  /** Number of data lines. */
  rows: number;
}

/** Exports the table behind the button as CSV and reads the file. */
async function exportCsv(page: Page, testId: string): Promise<Exported> {
  const button = page.locator(`[data-testid="${testId}"]`);
  await expect(button).toBeEnabled();
  await button.scrollIntoViewIfNeeded();
  await button.click();
  const download = page.waitForEvent('download');
  await page.locator(`[data-testid="${testId}-csv"]`).click();
  const file = await download;
  const lines = readFileSync(await file.path(), 'utf8').replace(BOM, '').trim().split(/\r?\n/);
  return { fileName: file.suggestedFilename(), header: lines[0].split(';'), rows: lines.length - 1 };
}

/** The id of the demo area, read from the address of its overview page. */
async function geissalpId(page: Page): Promise<string> {
  await page.goto(ROUTES.area);
  await expect(page.locator('.slim-table tbody tr').first()).toContainText('Geissalp');
  await page.locator('.slim-table tbody tr').first().locator('[data-testid="area-action-details"]').click();
  await expect(page).toHaveURL(/\/admin\/area\/[^/]+\/details$/);
  return page.url().split('/admin/area/')[1].split('/')[0];
}

test.describe('export of the tables of every mask', () => {
  test.beforeEach(async ({ page }) => {
    await mockMapTiles(page);
    await page.setViewportSize({ width: 1280, height: 1000 });
  });

  test('Details and Simulation of a Schiessplatz', async ({ page }) => {
    const id = await geissalpId(page);

    // Details: one line per Empfangspunkt and comparison.
    await expect(page.locator('[data-testid="details-export"]')).toBeEnabled();
    const details = await exportCsv(page, 'details-export');
    expect(details.fileName).toMatch(/^empfangspunkte_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(details.header).toEqual(expect.arrayContaining(['Empfangspunkt-Nr.', 'Grenzwert', 'Pegel', 'Reserve']));
    expect(details.rows).toBeGreaterThan(5);

    // Simulation: the Schusszahlen the simulation runs with.
    await page.goto(`/admin/area/${id}/simulation`);
    await expect.poll(() => page.locator('[data-testid="sim-row"]').count()).toBeGreaterThan(3);
    const simulation = await exportCsv(page, 'sim-export');
    expect(simulation.fileName).toMatch(/^simulation_schusszahlen_/);
    expect(simulation.rows).toBe(await page.locator('[data-testid="sim-row"]').count());
    expect(simulation.header).toEqual(expect.arrayContaining(['Stellungsraum', 'Innerhalb Werktag (Ist)', 'Innerhalb Werktag (Simulation)']));
  });

  test('Datenverwaltung: Schiessplätze, Stellungsräume, Kontingente, Zuordnung Waffen', async ({ page }) => {
    const id = await geissalpId(page);

    await page.goto('/admin/data-management/area/overview');
    await expect(page.locator('.slim-table tbody tr').first()).toBeVisible();
    const areas = await exportCsv(page, 'dma-export');
    expect(areas.fileName).toMatch(/\.csv$/);
    expect(areas.rows).toBe(await page.locator('.slim-table tbody tr.slim-table__row').count());

    await page.goto(`/admin/data-management/area/${id}/general/overview`);
    const rooms = await exportCsv(page, 'dmo-export');
    expect(rooms.rows).toBeGreaterThan(5);
    expect(rooms.header.length).toBeGreaterThan(2);

    await page.goto(`/admin/data-management/area/${id}/general/master-data`);
    const quotas = await exportCsv(page, 'dmm-export');
    expect(quotas.rows).toBeGreaterThan(3);

    await page.goto(`/admin/data-management/area/${id}/weapon-assignment`);
    const assignments = await exportCsv(page, 'dwa-export');
    expect(assignments.rows).toBeGreaterThan(5);
  });

  test('Benutzerverwaltung and Auswahllisten', async ({ page }) => {
    await page.goto('/admin/data-management/users');
    const users = await exportCsv(page, 'users-export');
    expect(users.rows).toBeGreaterThan(3);
    // What the table shows, never credentials or internal ids.
    expect(users.header.join(';').toLowerCase()).not.toMatch(/passwor|hash|token/);

    await page.goto('/admin/data-management/roles');
    const roles = await exportCsv(page, 'roles-export');
    expect(roles.rows).toBeGreaterThan(3);

    await page.goto('/admin/data-management/apps');
    const apps = await exportCsv(page, 'apps-export');
    expect(apps.rows).toBeGreaterThan(3);

    await page.goto('/admin/data-management/system');
    const lists = await exportCsv(page, 'dlist-export');
    expect(lists.fileName).toMatch(/^auswahlliste_/);
    expect(lists.header).toEqual(['Bezeichnung DE', 'Bezeichnung FR', 'Bezeichnung IT', 'Bezeichnung EN', 'Status']);
    expect(lists.rows).toBe(await page.locator('[data-testid="dlist-row"]').count());
  });
});
