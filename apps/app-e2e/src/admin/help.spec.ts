import { expect, test, type Page } from '@playwright/test';
import { mockMapTiles } from '../support/map';
import { ROUTES } from '../support/selectors';

/**
 * Benutzerdokumentation und kontextsensitive Hilfe (B1 12.4, slm 53): one
 * help button on every page (also F1) that explains the page that is open
 * within two seconds, and the online help with every topic on one page.
 * Signed in through the setup project.
 */
const HELP = {
  button: '[data-testid="help-button"]',
  drawer: '[data-testid="help-drawer"]',
  topic: '[data-testid="help-topic"]',
  general: '[data-testid="help-general"]',
  close: '[data-testid="help-close"]',
  online: '[data-testid="help-online"]',
  page: '[data-testid="ohelp-title"]',
  pageTopic: '[data-testid="ohelp-topic"]',
  toc: '[data-testid="ohelp-toc-link"]',
  menu: '.slim-topbar__iconbtn[aria-label="Hauptmenü"]',
  menuOnline: '[data-testid="menu-online-help"]',
} as const;

/** Opens the help with the button and returns the time until the topic is visible. */
async function openHelp(page: Page): Promise<number> {
  const started = Date.now();
  await page.locator(HELP.button).click();
  await expect(page.locator(HELP.topic)).toBeVisible();
  return Date.now() - started;
}

test.describe('help (slm 53)', () => {
  test('explains the page that is open — each page its own topic, within two seconds', async ({ page }) => {
    await mockMapTiles(page);
    await page.goto(ROUTES.area);
    expect(await openHelp(page)).toBeLessThan(2000);
    await expect(page.locator(HELP.topic)).toHaveAttribute('data-topic', 'areas');
    await expect(page.locator(HELP.topic)).toContainText('Übersicht Schiessplätze');
    await expect(page.locator(`${HELP.topic} li`)).toHaveCount(6);
    // The general operation follows the help of the page.
    await expect(page.locator(HELP.general)).toContainText('Allgemeine Bedienung');
    await page.locator(HELP.close).click();
    await expect(page.locator(HELP.drawer)).toHaveCount(0);

    // Another page, another topic.
    await page.locator('.slim-table tbody tr.slim-table__row').first().click();
    await expect(page).toHaveURL(/\/details$/);
    expect(await openHelp(page)).toBeLessThan(2000);
    await expect(page.locator(HELP.topic)).toHaveAttribute('data-topic', 'details');
    await expect(page.locator(HELP.topic)).toContainText('Empfangspunkt');
    await page.keyboard.press('Escape');
    await expect(page.locator(HELP.drawer)).toHaveCount(0);

    await page.locator('[data-testid="area-tab-shots"]').click();
    await expect(page).toHaveURL(/\/shots$/);
    await openHelp(page);
    await expect(page.locator(HELP.topic)).toHaveAttribute('data-topic', 'shots');
    await expect(page.locator(HELP.topic)).toContainText('Sperrdatum');
  });

  test('opens with F1 and leads to the same topic of the online help', async ({ page }) => {
    await page.goto('/admin/data-management/system');
    await expect(page.locator('[data-testid="dsys-title"]')).toBeVisible();
    await page.keyboard.press('F1');
    await expect(page.locator(HELP.topic)).toHaveAttribute('data-topic', 'system');
    await expect(page.locator(HELP.topic)).toContainText('Erweiterte Konfiguration');

    await page.locator(HELP.online).click();
    await expect(page).toHaveURL(/\/admin\/help#system$/);
    await expect(page.locator(HELP.drawer)).toHaveCount(0);
    await expect(page.locator(HELP.page)).toHaveText('Online-Hilfe');
    await expect(page.locator(`${HELP.pageTopic}#system`)).toBeInViewport();
  });

  test('offers the whole online help from the main menu: every topic, with a table of contents', async ({ page }) => {
    await page.goto(ROUTES.area);
    await page.locator(HELP.menu).click();
    await page.locator(HELP.menuOnline).click();
    await expect(page).toHaveURL(/\/admin\/help$/);
    await expect(page.locator(HELP.pageTopic)).toHaveCount(16);
    await expect(page.locator(HELP.toc)).toHaveCount(16);
    await expect(page.locator(HELP.pageTopic).first()).toContainText('Allgemeine Bedienung');
    // No untranslated key on the page.
    await expect(page.getByText(/help\.(topics|ui)\./)).toHaveCount(0);

    await page.locator(HELP.toc).filter({ hasText: 'Karte' }).first().click();
    await expect(page).toHaveURL(/\/admin\/help#map$/);
    await expect(page.locator(`${HELP.pageTopic}#map`)).toBeInViewport();

    // On the online help itself the button shows the general help.
    await openHelp(page);
    await expect(page.locator(HELP.topic)).toHaveAttribute('data-topic', 'general');
  });

  test('speaks the language of the user', async ({ page }) => {
    await page.goto(ROUTES.area);
    await page.getByRole('button', { name: 'FR', exact: true }).click();
    await openHelp(page);
    await expect(page.locator(HELP.topic)).toContainText('Vue d’ensemble des places de tir');
    await page.locator(HELP.close).click();
    await page.getByRole('button', { name: 'DE', exact: true }).click();
  });
});
