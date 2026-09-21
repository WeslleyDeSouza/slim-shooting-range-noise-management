import { expect, test } from '@playwright/test';

/**
 * Datenverwaltung › Schiessplatz › Allgemein (B1 5.15 Übersicht, 5.16
 * Stammdaten; slm 14–16) on the demo area 1104.020 Geissalp. Signed in as
 * the galaxy admin through the setup project (write right on app 41).
 * Every change of this spec is reverted at the end of its test.
 */
const DM = {
  overview: '/admin/data-management/area/overview',
  rowGeneral: '[data-testid="dma-action-general"]',
  // context bar
  crumb: '[data-testid="dmc-crumb-area"]',
  switchButton: '[data-testid="dmc-switch"]',
  switchSearch: '[data-testid="dmc-switch-search"]',
  switchPanel: '[data-testid="dmc-switch-panel"]',
  tabGeneral: '[data-testid="dmc-tab-general"]',
  // tabs of Allgemein
  tabOverview: '[data-testid="dmg-tab-overview"]',
  tabMasterData: '[data-testid="dmg-tab-master-data"]',
  // 5.15
  title: '[data-testid="dmo-title"]',
  field: (key: string) => `[data-testid="dmo-field-${key}"]`,
  roomsCount: '[data-testid="dmo-rooms-count"]',
  roomsSearch: '[data-testid="dmo-rooms-search"]',
  roomRow: '[data-testid="dmo-room-row"]',
  roomsFoot: '[data-testid="dmo-rooms-foot"]',
  edit: '[data-testid="dmo-edit"]',
  // 5.16
  masterTitle: '[data-testid="dmm-title"]',
  name: '[data-testid="dmm-name"]',
  projectState: '[data-testid="dmm-project_state"]',
  dirty: '[data-testid="dmm-dirty"]',
  save: '[data-testid="dmm-save"]',
  toast: '[data-testid="dmm-toast"]',
  discard: '[data-testid="dmm-discard"]',
  discardKeep: '[data-testid="dmm-discard-keep"]',
  discardConfirm: '[data-testid="dmm-discard-confirm"]',
  quotaRow: '[data-testid="dmm-quota-row"]',
  quotaCount: '[data-testid="dmm-quota-count"]',
  quotaMissing: '[data-testid="dmm-quota-missing"]',
  quotaDialog: '[data-testid="dmm-quota-dialog"]',
  quotaCombination: '[data-testid="dmm-quota-combination"]',
  quotaShots: '[data-testid="dmm-quota-shots"]',
  quotaBasis: '[data-testid="dmm-quota-basis"]',
  quotaSave: '[data-testid="dmm-quota-save"]',
  quotaDelete: '[data-testid="dmm-quota-delete"]',
  quotaDeleteConfirm: '[data-testid="dmm-quota-delete-confirm"]',
} as const;

test.describe('data management: Schiessplatz › Allgemein', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(DM.overview);
    // «Allgemein» of the row 1104.020 Geissalp opens the Übersicht tab (5.15); the list is sorted by name.
    const row = page.locator('.slim-table tbody tr.slim-table__row', { hasText: 'Geissalp' });
    await expect(row).toHaveCount(1);
    await row.locator(DM.rowGeneral).click();
    await expect(page).toHaveURL(/\/admin\/data-management\/area\/[^/]+\/general\/overview$/);
  });

  test('shows the Detailansicht and the searchable Stellungsraum table (slm 14, slm 15)', async ({ page }) => {
    await expect(page.locator(DM.crumb)).toContainText('1104.020 Geissalp');
    await expect(page.locator(DM.title)).toContainText('Schiessplatzverwaltung 1104.020 Geissalp');
    await expect(page.locator(DM.field('coordination_no'))).toHaveText(/1104\.020/);
    await expect(page.locator(DM.field('classification'))).toContainText('unproblematisch');
    await expect(page.locator(DM.field('build_year'))).toContainText('Gemischt');
    await expect(page.locator(DM.field('spm_state'))).toContainText('Abgeschlossen');

    // 14 rooms of the demo, two without a Koordinationsabschnitts-Nr. (B1 5.15 hint).
    await expect(page.locator(DM.roomsCount)).toContainText('14');
    await expect(page.locator(DM.roomRow)).toHaveCount(14);
    await expect(page.locator(DM.roomsFoot)).toContainText('2 ohne Koordinationsabschnitts-Nr.');
    await expect(page.locator(`${DM.roomRow}[data-room-no=""]`)).toHaveCount(2);

    // Free-text search over number, name and Aktiv.
    await page.locator(DM.roomsSearch).fill('Schönenboden');
    await expect(page.locator(DM.roomRow)).toHaveCount(3);
    await page.locator(DM.roomsSearch).fill('1104.020.13');
    await expect(page.locator(DM.roomRow)).toHaveCount(1);
    await expect(page.locator(DM.roomRow).first()).toContainText('NGST Schönenboden D unten');
    await page.locator(DM.roomsSearch).fill('');
    await expect(page.locator(DM.roomRow)).toHaveCount(14);
  });

  test('switches the Schiessplatz from the context bar and keeps the page', async ({ page }) => {
    await page.locator(DM.switchButton).click();
    await expect(page.locator(DM.switchPanel)).toBeVisible();
    await page.locator(DM.switchSearch).fill('SP-BE-07'); // Sachplan-Nr. of Thun
    const item = page.locator(`${DM.switchPanel} .slim-menu__item`);
    await expect(item).toHaveCount(1);
    await expect(item).toContainText('Thun');
    await item.click();
    await expect(page).toHaveURL(/\/general\/overview$/);
    await expect(page.locator(DM.crumb)).toContainText('3101.020 Thun');
    await expect(page.locator(DM.roomsCount)).toContainText('2');
  });

  test('edits the Stammdaten with dirty tracking, saves and reverts (slm 16)', async ({ page }) => {
    await page.locator(DM.edit).click();
    await expect(page).toHaveURL(/\/general\/master-data$/);
    await expect(page.locator(DM.masterTitle)).toContainText('Stammdaten 1104.020 Geissalp');
    await expect(page.locator(DM.name)).toHaveValue('Geissalp');
    await expect(page.locator(DM.save)).toBeDisabled();

    // Change «Stand Projekt» → dirty badge, save, toast, the overview shows it.
    await expect(page.locator(DM.projectState)).toHaveValue('not_started');
    await page.locator(DM.projectState).selectOption('ongoing');
    await expect(page.locator(DM.dirty)).toBeVisible();
    await page.locator(DM.save).click();
    await expect(page.locator(DM.toast)).toContainText('Stammdaten gespeichert');
    await expect(page.locator(DM.dirty)).toHaveCount(0);
    await page.locator(DM.tabOverview).click();
    await expect(page.locator(DM.field('project_state'))).toContainText('Laufend');

    // Unsaved edits are guarded when leaving the tab.
    await page.locator(DM.tabMasterData).click();
    await page.locator(DM.projectState).selectOption('not_started');
    await page.locator(DM.tabOverview).click();
    await expect(page.locator(DM.discard)).toBeVisible();
    await page.locator(DM.discardKeep).click();
    await expect(page).toHaveURL(/\/general\/master-data$/);
    await expect(page.locator(DM.projectState)).toHaveValue('not_started');

    // Revert for the next run.
    await page.locator(DM.save).click();
    await expect(page.locator(DM.toast)).toContainText('Stammdaten gespeichert');
    await page.reload();
    await expect(page.locator(DM.projectState)).toHaveValue('not_started');
  });

  test('records and deletes a Kontingent for a combination without one (5.16, Soll 0 rule)', async ({ page }) => {
    await page.locator(DM.tabMasterData).click();
    await expect(page.locator(DM.quotaRow).first()).toBeVisible();
    const before = await page.locator(DM.quotaRow).count();
    expect(before).toBeGreaterThan(5);

    // The demo assigns the Sprengladung on Geissalp without a Kontingent → flagged.
    const missing = page.locator(DM.quotaMissing);
    await expect(missing).toBeVisible();
    const chip = missing.locator('.slim-chip', { hasText: 'Sprengladung' });
    await chip.click();
    await expect(page.locator(DM.quotaDialog)).toBeVisible();
    await expect(page.locator(DM.quotaCombination)).not.toHaveValue('');
    // Combinations that already have a quota are not offered.
    const options = await page.locator(`${DM.quotaCombination} option`).allTextContents();
    expect(options.some((o) => o.includes('Stgw 90'))).toBe(false);
    // The basis proposes the Plangenehmigung of the Schiessplatz.
    await expect(page.locator(DM.quotaBasis)).toHaveAttribute('placeholder', /Plangenehmigung vom 13\.02\.2023/);

    await page.locator(DM.quotaShots).fill('12.5');
    await page.locator(DM.quotaSave).click();
    await expect(page.locator(DM.quotaDialog)).toHaveCount(0);
    await expect(page.locator(DM.toast)).toContainText('Kontingent erfasst');
    await expect(page.locator(DM.quotaRow)).toHaveCount(before + 1);
    const row = page.locator(DM.quotaRow, { hasText: 'Sprengladung' });
    await expect(row).toContainText('12.5');
    await expect(row).toContainText('kg');
    await expect(row).toContainText('Plangenehmigung vom 13.02.2023');
    await expect(missing).toHaveCount(0);

    // Delete it again (confirmation, toast, flag returns).
    await row.locator(DM.quotaDelete).click();
    await page.locator(DM.quotaDeleteConfirm).click();
    await expect(page.locator(DM.toast)).toContainText('gelöscht');
    await expect(page.locator(DM.quotaRow)).toHaveCount(before);
    await expect(missing).toBeVisible();
  });
});
