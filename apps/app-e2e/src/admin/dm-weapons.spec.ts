import { expect, test } from '@playwright/test';

/**
 * Datenverwaltung › Waffen (B1 5.22–5.25, slm 22–25): the four master-data
 * lists over the demo tenant (Waffenliste B1.7). Signed in as the galaxy
 * admin (root on app 43). Records created here are deleted again.
 */
const W = {
  root: '/admin/data-management/weapons',
  tab: (kind: string) => `[data-testid="dmw-tab-${kind}"]`,
  title: '[data-testid="dmw-title"]',
  search: '[data-testid="dmw-search"]',
  filterWeapon: '[data-testid="dmw-filter-weaponName"]',
  row: '[data-testid="dmw-row"]',
  rowDelete: '[data-testid="dmw-row-delete"]',
  count: '[data-testid="dmw-count"]',
  newButton: '[data-testid="dmw-new"]',
  exportButton: '[data-testid="dmw-export"]',
  detailTitle: '[data-testid="dmw-detail-title"]',
  nameDe: '[data-testid="dmw-name-de"]',
  nameFr: '[data-testid="dmw-name-fr"]',
  weapon: '[data-testid="dmw-weapon"]',
  caliber: '[data-testid="dmw-caliber"]',
  sonarms: '[data-testid="dmw-sonarms"]',
  derivedCategory: '[data-testid="dmw-derived-category"]',
  usage: '[data-testid="dmw-usage"]',
  aln: '[data-testid="dmw-aln"]',
  sap: '[data-testid="dmw-sap"]',
  annex7: '[data-testid="dmw-annex7"]',
  dirty: '[data-testid="dmw-dirty"]',
  save: '[data-testid="dmw-save"]',
  cancel: '[data-testid="dmw-cancel"]',
  toast: '[data-testid="dmw-toast"]',
  deleteDialog: '[data-testid="dmw-delete-dialog"]',
  deleteConfirm: '[data-testid="dmw-delete-confirm"]',
  inUse: '[data-testid="dmw-in-use"]',
  deactivate: '[data-testid="dmw-deactivate"]',
  discard: '[data-testid="dmw-discard"]',
  discardConfirm: '[data-testid="dmw-discard-confirm"]',
  meta: '[data-testid="dmw-meta"]',
} as const;

const STAMP = Date.now();

/** Count in a tab badge («Kaliber 9» → 9); the demo counts drift when an earlier run left records behind. */
async function tabCount(page: import('@playwright/test').Page, kind: string): Promise<number> {
  const text = (await page.locator(W.tab(kind)).textContent()) ?? '';
  return Number(text.trim().match(/(\d+)\s*$/)?.[1] ?? 0);
}

test.describe('data management: Waffen', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(W.root);
    // The menu entry opens the first list of B1: Waffe/Kaliber (5.22).
    await expect(page).toHaveURL(/\/weapons\/combination$/);
    await expect(page.locator(W.row).first()).toBeVisible();
  });

  test('lists the combinations with filters, opens the detail with the Verwendung (5.22)', async ({ page }) => {
    await expect(page.locator(W.title)).toContainText('Waffen/ Kaliber');
    // The demo ships 11 combinations, 9 calibers, 11 weapons, 4 categories (B1.7 Waffenliste).
    const combinations = await tabCount(page, 'combination');
    expect(combinations).toBeGreaterThanOrEqual(11);
    expect(await tabCount(page, 'caliber')).toBeGreaterThanOrEqual(9);
    expect(await tabCount(page, 'weapon')).toBeGreaterThanOrEqual(11);
    expect(await tabCount(page, 'category')).toBeGreaterThanOrEqual(4);
    await expect(page.locator(W.row)).toHaveCount(combinations);

    await page.locator(W.search).fill('stgw');
    await expect(page.locator(W.row)).toHaveCount(1);
    await page.locator(W.search).fill('');
    await page.locator(W.filterWeapon).selectOption('Mg 51');
    await expect(page.locator(W.row)).toHaveCount(1);
    await expect(page.locator(W.count)).toContainText(`1 von ${combinations}`);
    await page.locator(W.filterWeapon).selectOption('');

    const stgw = page.locator(W.row, { hasText: 'Stgw 90 · 5.6 mm' });
    await stgw.click();
    await expect(page.locator(W.detailTitle)).toContainText('Stgw 90 · 5.6 mm');
    await expect(page.locator(W.sonarms)).toHaveValue('Stgw90');
    await expect(page.locator(W.derivedCategory)).toContainText('Handfeuerwaffen');
    // Verwendung: the Stgw 90 is allowed on Geissalp and on the light demo areas.
    await expect(page.locator(`${W.usage} tbody tr`).first()).toContainText('Geissalp');
    expect(await page.locator(`${W.usage} tbody tr`).count()).toBeGreaterThan(5);
    await expect(page.locator(W.meta)).toContainText('Erfassung');
    await expect(page.locator(W.save)).toBeDisabled();
  });

  test('refuses to delete a used combination and offers «Inaktiv setzen» instead', async ({ page }) => {
    await page.locator(W.row, { hasText: 'Stgw 90 · 5.6 mm' }).locator(W.rowDelete).click();
    await expect(page.locator(W.deleteDialog)).toContainText('Stgw 90 · 5.6 mm');
    await page.locator(W.deleteConfirm).click();
    await expect(page.locator(W.inUse)).toBeVisible();
    await expect(page.locator(W.inUse)).toContainText('wird noch');
    await expect(page.locator(W.deactivate)).toBeVisible();
    await expect(page.locator(W.deleteConfirm)).toHaveCount(0);
    // Leave it active for the other specs.
    await page.locator(`${W.deleteDialog} .slim-btn`, { hasText: 'Abbrechen' }).click();
    await expect(page.locator(W.deleteDialog)).toHaveCount(0);
    await expect(page.locator(W.row, { hasText: 'Stgw 90 · 5.6 mm' })).toHaveCount(1);
  });

  test('creates, edits and deletes a Kaliber with ALN- and SAP-Nr. (5.23)', async ({ page }) => {
    await page.locator(W.tab('caliber')).click();
    await expect(page).toHaveURL(/\/weapons\/caliber$/);
    const calibers = await tabCount(page, 'caliber');
    await expect(page.locator(W.row)).toHaveCount(calibers);

    await page.locator(W.newButton).click();
    await expect(page.locator(W.detailTitle)).toContainText('Neue Kaliber');
    const name = `E2E Kaliber ${STAMP}`;
    await page.locator(W.nameDe).fill(name);
    // ALN and SAP are required for a Kaliber.
    await page.locator(W.save).click();
    await expect(page.locator('.slim-field--invalid')).toHaveCount(2);
    await page.locator(W.aln).fill('999-0001');
    await page.locator(W.sap).fill('2999.0001');
    await page.locator(W.save).click();
    await expect(page.locator(W.toast)).toContainText('Kaliber erfasst');
    await expect(page.locator(W.row)).toHaveCount(calibers + 1);
    expect(await tabCount(page, 'caliber')).toBe(calibers + 1);

    // Edit the FR name of the new record; the dirty badge shows and clears.
    await page.locator(W.nameFr).fill('Calibre E2E');
    await expect(page.locator(W.dirty)).toBeVisible();
    await page.locator(W.save).click();
    await expect(page.locator(W.toast)).toContainText('Kaliber gespeichert');
    await expect(page.locator(W.dirty)).toHaveCount(0);

    // Unsaved edits are guarded when another row is picked.
    await page.locator(W.nameFr).fill('Verworfen');
    await page.locator(W.row, { hasText: '5.6 mm GP 90' }).click();
    await expect(page.locator(W.discard)).toBeVisible();
    await page.locator(W.discardConfirm).click();
    await expect(page.locator(W.detailTitle)).toContainText('5.6 mm GP 90');

    // Unused → deletable.
    await page.locator(W.row, { hasText: name }).locator(W.rowDelete).click();
    await page.locator(W.deleteConfirm).click();
    await expect(page.locator(W.toast)).toContainText('gelöscht');
    await expect(page.locator(W.row)).toHaveCount(calibers);
  });

  test('maintains a Waffe with its Anhang 7 category and a Waffenkategorie (5.24, 5.25)', async ({ page }) => {
    await page.locator(W.tab('category')).click();
    const categories = await tabCount(page, 'category');
    await page.locator(W.newButton).click();
    const category = `E2E Kategorie ${STAMP}`;
    await page.locator(W.nameDe).fill(category);
    await page.locator(W.save).click();
    await expect(page.locator(W.toast)).toContainText('Waffenkategorie erfasst');
    await expect(page.locator(W.row, { hasText: category })).toBeVisible();

    await page.locator(W.tab('weapon')).click();
    await page.locator(W.newButton).click();
    const weapon = `E2E Waffe ${STAMP}`;
    await page.locator(W.nameDe).fill(weapon);
    await page.locator('[data-testid="dmw-category"]').selectOption({ label: category });
    await page.locator(W.annex7).selectOption('a');
    await page.locator(W.save).click();
    await expect(page.locator(W.toast)).toContainText('Waffe erfasst');
    const row = page.locator(W.row, { hasText: weapon });
    await expect(row).toContainText(category);
    await expect(row).toContainText('a');

    // The category is now in use → refused, the weapon must go first.
    await page.locator(W.tab('category')).click();
    await page.locator(W.row, { hasText: category }).locator(W.rowDelete).click();
    await page.locator(W.deleteConfirm).click();
    await expect(page.locator(W.inUse)).toContainText('1-mal');
    await page.locator(`${W.deleteDialog} .slim-btn`, { hasText: 'Abbrechen' }).click();

    await page.locator(W.tab('weapon')).click();
    await page.locator(W.row, { hasText: weapon }).locator(W.rowDelete).click();
    await page.locator(W.deleteConfirm).click();
    await expect(page.locator(W.toast)).toContainText('gelöscht');

    await page.locator(W.tab('category')).click();
    await page.locator(W.row, { hasText: category }).locator(W.rowDelete).click();
    await page.locator(W.deleteConfirm).click();
    await expect(page.locator(W.toast)).toContainText('gelöscht');
    await expect(page.locator(W.row)).toHaveCount(categories);
  });

  test('exports the lists as XLSX', async ({ page }) => {
    const download = page.waitForEvent('download');
    await page.locator(W.exportButton).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^waffen_stammdaten_\d{4}-\d{2}-\d{2}\.xlsx$/);
    await expect(page.locator(W.toast)).toContainText('Export');
  });
});
