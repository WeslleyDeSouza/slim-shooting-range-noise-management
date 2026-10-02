import { expect, test } from '@playwright/test';

/**
 * Datenverwaltung › Schiessplatz › Zuordnung Waffen (B1 5.17, Abbildung 28;
 * slm 17) on the demo area 1104.020 Geissalp: 14 Stellungsräume, 17
 * zulässige Kombinationen, «Stellungsrm B 2» with Mg 51, Pist 75 and Stgw 90.
 * Signed in as the galaxy admin through the setup project. The mask is a
 * display (FAQ 52) — nothing is changed, so nothing has to be reverted.
 */
const DM = {
  overview: '/admin/data-management/area/overview',
  rowWeapons: '[data-testid="dma-action-weapons"]',
  crumb: '[data-testid="dmc-crumb-area"]',
  tabWeapons: '[data-testid="dmc-tab-weapons"]',
  tabGeneral: '[data-testid="dmc-tab-general"]',
  switchButton: '[data-testid="dmc-switch"]',
  switchSearch: '[data-testid="dmc-switch-search"]',
  switchPanel: '[data-testid="dmc-switch-panel"]',
  // 5.17
  title: '[data-testid="dwa-title"]',
  readonly: '[data-testid="dwa-readonly"]',
  roomsCount: '[data-testid="dwa-rooms-count"]',
  roomSearch: '[data-testid="dwa-room-search"]',
  room: '[data-testid="dwa-room"]',
  roomsFoot: '[data-testid="dwa-rooms-foot"]',
  detailTitle: '[data-testid="dwa-detail-title"]',
  roomNo: '[data-testid="dwa-room-no"]',
  count: '[data-testid="dwa-count"]',
  assignments: '[data-testid="dwa-assignments"]',
  row: '[data-testid="dwa-row"]',
  empty: '[data-testid="dwa-empty"]',
} as const;

test.describe('data management: Schiessplatz › Zuordnung Waffen', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(DM.overview);
    const row = page.locator('.slim-table tbody tr.slim-table__row', { hasText: 'Geissalp' });
    await expect(row).toHaveCount(1);
    await row.locator(DM.rowWeapons).click();
    await expect(page).toHaveURL(/\/admin\/data-management\/area\/[^/]+\/weapon-assignment/);
  });

  test('shows the Stellungsräume and the Zugeordneten Waffen of a room (slm 17, B1 Abbildung 28)', async ({ page }) => {
    await expect(page.locator(DM.crumb)).toContainText('1104.020 Geissalp');
    await expect(page.locator(DM.title)).toContainText('Zuordnung Waffen 1104.020 Geissalp');

    // 1 Stellungsraum-Tabelle: Koord.absch.-Nr., Bezeichnung, Aktiv — sorted by number.
    await expect(page.locator(DM.roomsCount)).toContainText('14');
    await expect(page.locator(DM.room)).toHaveCount(14);
    await expect(page.locator(`${DM.room} >> nth=0`)).toContainText('1104.020.01');
    await expect(page.locator(`${DM.room} >> nth=0`)).toContainText('Fendershuus, A 1 links');
    await expect(page.locator(`${DM.room} >> nth=0`)).toContainText('Ja');

    // 3 Zugeordnete Waffen: Waffenname für Erfassung, Waffe, Kaliber, Kategorie.
    await page.locator(DM.room, { hasText: 'Stellungsrm B 2' }).click();
    await expect(page).toHaveURL(/[?&]room=/);
    await expect(page.locator(DM.detailTitle)).toContainText('Stellungsrm B 2 – Zuordnungen');
    await expect(page.locator(DM.roomNo)).toHaveText(/1104\.020\.\d+/);
    await expect(page.locator(DM.count)).toContainText('3');
    for (const header of ['Waffenname für Erfassung', 'Waffe', 'Kaliber', 'Kategorie']) {
      await expect(page.locator(`${DM.assignments} thead`)).toContainText(header);
    }
    await expect(page.locator(DM.row)).toHaveCount(3);
    await expect(page.locator(DM.row).nth(0)).toContainText('Mg 51');
    await expect(page.locator(DM.row).nth(1)).toContainText('Pist 75');
    const stgw = page.locator(DM.row).nth(2);
    await expect(stgw).toContainText('Stgw 90 · 5.6 mm');
    await expect(stgw).toContainText('5.6 mm GP 90');
    await expect(stgw).toContainText('Handfeuerwaffen');
  });

  test('searches the rooms by number or name (Bedienelement 2) and keeps the room on reload', async ({ page }) => {
    await page.locator(DM.roomSearch).fill('Schönenboden');
    await expect(page.locator(DM.room)).toHaveCount(3);
    await expect(page.locator(DM.roomsFoot)).toContainText('3 von 14');
    await page.locator(DM.roomSearch).fill('1104.020.06');
    await expect(page.locator(DM.room)).toHaveCount(1);
    await page.locator(DM.room).first().click();
    await expect(page.locator(DM.detailTitle)).toContainText('1104.020.06');
    await page.locator(DM.roomSearch).fill('gibt es nicht');
    await expect(page.locator(DM.room)).toHaveCount(0);

    // Deep link: the chosen room is part of the URL.
    const detail = await page.locator(DM.detailTitle).innerText();
    await page.reload();
    await expect(page.locator(DM.detailTitle)).toHaveText(detail);
    await expect(page.locator(DM.room)).toHaveCount(14);
  });

  test('a room without assignments says so; the mask offers nothing to edit (FAQ 52)', async ({ page }) => {
    await page.locator(DM.room, { hasText: 'Seelihuus, B 1' }).click();
    await expect(page.locator(DM.row)).toHaveCount(0);
    await expect(page.locator(DM.empty)).toContainText('keine Waffen zugeordnet');

    await expect(page.locator(DM.readonly)).toContainText('nur einsehbar');
    const mask = page.locator('app-dm-area-weapons');
    await expect(mask.locator('form, select, textarea, input:not([type="search"]), button[type="submit"]')).toHaveCount(0);
  });

  test('follows the Schiessplatz of the context bar', async ({ page }) => {
    await page.locator(DM.switchButton).click();
    await page.locator(DM.switchSearch).fill('SP-BE-07'); // Sachplan-Nr. of Thun
    const item = page.locator(`${DM.switchPanel} .slim-menu__item`);
    await expect(item).toHaveCount(1);
    await item.click();
    await expect(page).toHaveURL(/\/weapon-assignment$/);
    await expect(page.locator(DM.crumb)).toContainText('3101.020 Thun');
    await expect(page.locator(DM.title)).toContainText('Zuordnung Waffen 3101.020 Thun');
    await expect(page.locator(DM.roomsCount)).toContainText('2');
    await expect(page.locator(DM.room)).toHaveCount(2);
  });
});
