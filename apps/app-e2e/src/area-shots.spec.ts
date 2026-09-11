import { expect, test } from '@playwright/test';
import { ROUTES } from './support/selectors';

/**
 * «Schiessplatz – Schusszahlen» (5.11) of the demo area 1104.020 Geissalp
 * (the first row of the overview; seeded by apps/api/src/mocks/tenant).
 * Signed in through the setup project.
 */
const SHOTS = {
  kpis: '[data-testid="shots-kpis"]',
  row: '[data-testid="shots-row"]',
  room: '[data-testid="shots-room"]',
  search: '[data-testid="shots-search"]',
  srcElo: '[data-testid="shots-src-elo"]',
  newButton: '[data-testid="shots-new"]',
  drawer: '[data-testid="shots-drawer"]',
  save: '[data-testid="shots-save"]',
  toast: '[data-testid="shots-toast"]',
  undo: '[data-testid="shots-toast-undo"]',
  deleteConfirm: '[data-testid="shots-delete-confirm"]',
} as const;

const UNIT = `E2E Nutzung ${Date.now()}`;

test.describe('area: shot counts', () => {
  test('lists, filters, records, deletes and restores usages', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });

    // Overview → «Schusszahlen» of the first area (Geissalp).
    await page.goto(ROUTES.area);
    await expect(page.locator('.slim-table tbody tr').first()).toContainText('Geissalp');
    await page.locator('.slim-table tbody tr').first().locator('.slim-row-actions a').nth(1).click();
    await expect(page).toHaveURL(/\/admin\/area\/[^/]+\/shots$/);

    // KPIs and the year's usages.
    await expect(page.locator(SHOTS.kpis)).toBeVisible();
    await expect.poll(() => page.locator(SHOTS.row).count()).toBeGreaterThan(10);
    const total = await page.locator(SHOTS.row).count();

    // The room list narrows the table.
    const rooms = page.locator(SHOTS.room);
    await expect.poll(() => rooms.count()).toBeGreaterThan(5);
    await rooms.filter({ hasText: 'Stellungsrm B 2' }).click();
    // The table re-renders after the click; poll instead of reading at once.
    await expect.poll(() => page.locator(SHOTS.row).count()).toBeLessThan(total);
    const inRoom = await page.locator(SHOTS.row).count();
    expect(inRoom).toBeGreaterThan(0);
    await rooms.first().click(); // Alle Stellungsräume
    await expect(page.locator(SHOTS.row)).toHaveCount(total);

    // Search: the Schützenverein rows are civil and come from ELO.
    await page.locator(SHOTS.search).fill('Schützenverein');
    await expect.poll(() => page.locator(SHOTS.row).count()).toBeGreaterThan(0);
    const civil = await page.locator(SHOTS.row).count();
    await expect(page.locator(SHOTS.srcElo)).toHaveCount(civil);
    await page.locator(SHOTS.search).fill('');
    await expect(page.locator(SHOTS.row)).toHaveCount(total);

    // Create a usage through the drawer.
    await page.locator(SHOTS.newButton).click();
    const drawer = page.locator(SHOTS.drawer);
    await expect(drawer).toBeVisible();
    await drawer.locator('#shots-room').selectOption({ index: 1 });
    await drawer.locator('#shots-unit').fill(UNIT);
    await drawer.getByRole('button', { name: /Heute|Today|Aujourd|Oggi/ }).click();
    await drawer.getByRole('button', { name: /Vormittag|Morning|Matin|Mattina/ }).click();
    // First category of the chosen room, then its first weapon.
    await drawer.locator('#shots-category').selectOption({ index: 1 });
    await drawer.locator('#shots-weapon').selectOption({ index: 1 });
    await drawer.locator('#shots-shots').fill('100');
    await drawer.locator(SHOTS.save).click();
    await expect(page.locator(SHOTS.toast)).toBeVisible();
    await expect(drawer).toBeHidden();
    await expect(page.locator(SHOTS.row)).toHaveCount(total + 1);

    // Delete it again via the row action, then undo.
    const created = page.locator(SHOTS.row).filter({ hasText: UNIT });
    await expect(created).toHaveCount(1);
    await created.locator('[data-testid="shots-delete"]').click();
    await page.locator(SHOTS.deleteConfirm).click();
    await expect(page.locator(SHOTS.row)).toHaveCount(total);
    await page.locator(SHOTS.undo).click();
    await expect(page.locator(SHOTS.row)).toHaveCount(total + 1);

    // Leave the data as we found it.
    await created.locator('[data-testid="shots-delete"]').click();
    await page.locator(SHOTS.deleteConfirm).click();
    await expect(page.locator(SHOTS.row)).toHaveCount(total);
  });
});
