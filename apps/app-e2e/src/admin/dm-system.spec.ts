import { expect, test, type Page } from '@playwright/test';
import { mockMapTiles } from '../support/map';
import { ROUTES } from '../support/selectors';

/**
 * Datenverwaltung › Erweiterte Konfiguration (B1 5.28, Abbildung 40, slm 27;
 * FAQ 166) and what it does elsewhere: the Sperrdatum freezes the
 * Schusszahlenerfassung, the thresholds move the Ampel of the Empfangspunkte,
 * the Benutzerhandbuch and the contacts appear in the main menu (B1 5.9).
 * Signed in through the setup project as the demo user (all rights). Every
 * test puts back what it changed — the other specs rely on the defaults.
 */
const SYS = {
  route: '/admin/data-management/system',
  title: '[data-testid="dsys-title"]',
  lock: '[data-testid="dsys-lock"]',
  lockClear: '[data-testid="dsys-lock-clear"]',
  quotaGreen: '[data-testid="dsys-quota-green"]',
  quotaOrange: '[data-testid="dsys-quota-orange"]',
  noiseGreen: '[data-testid="dsys-noise-green"]',
  noiseOrange: '[data-testid="dsys-noise-orange"]',
  noiseError: '[data-testid="dsys-noise-error"]',
  defaults: '[data-testid="dsys-defaults"]',
  save: '[data-testid="dsys-save"]',
  toast: '[data-testid="dsys-toast"]',
  manualFile: '[data-testid="dsys-manual-file"]',
  manualDownload: '[data-testid="dsys-manual-download"]',
  manualRemove: '[data-testid="dsys-manual-remove"]',
  manualNone: '[data-testid="dsys-manual-none"]',
  manualError: '[data-testid="dsys-manual-error"]',
  specialistName: '[data-testid="dsys-specialist-name"]',
  specialistEmail: '[data-testid="dsys-specialist-email"]',
  menu: '.slim-topbar__iconbtn[aria-label="Hauptmenü"]',
  menuManual: '[data-testid="menu-manual"]',
  menuManualNone: '[data-testid="menu-manual-none"]',
  menuSpecialist: '[data-testid="menu-contact-specialist"]',
} as const;

const YEAR = new Date().getFullYear();
const PDF = Buffer.from('%PDF-1.4\n% SLIM Benutzerhandbuch (e2e)\n%%EOF\n', 'latin1');

async function open(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(SYS.route);
  await expect(page.locator(SYS.title)).toHaveText('Erweiterte Konfiguration');
  await expect(page.locator(SYS.quotaGreen)).toBeEnabled();
}

async function save(page: Page): Promise<void> {
  await page.locator(SYS.save).click();
  await expect(page.locator(SYS.toast)).toContainText('Erweiterte Konfiguration gespeichert');
}

/** First Schiessplatz of the overview (1104.020 Geissalp) on the given tab. */
async function openGeissalp(page: Page, tab: 'shots' | 'details'): Promise<void> {
  await page.goto(ROUTES.area);
  await page.locator('.slim-table tbody tr.slim-table__row').first().click();
  await page.locator(`[data-testid="area-tab-${tab}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/${tab}$`));
}

test.describe.configure({ mode: 'serial' });

test.describe('erweiterte Konfiguration (5.28)', () => {
  test('shows the thresholds of B1 5.10: Kontingent in percent, Empfangspunkte in dB', async ({ page }) => {
    await open(page);
    await expect(page.locator(SYS.quotaGreen)).toHaveValue('100');
    await expect(page.locator(SYS.quotaOrange)).toHaveValue('125');
    await expect(page.locator('[data-testid="dsys-quota"]')).toContainText('% des Solls');
    await expect(page.locator(SYS.noiseGreen)).toHaveValue('-5');
    await expect(page.locator(SYS.noiseOrange)).toHaveValue('0');
    await expect(page.locator('[data-testid="dsys-noise"]')).toContainText('dB Abweichung');
    await expect(page.locator(SYS.save)).toBeDisabled();

    // «orange» below «grün» is refused before anything is sent.
    await page.locator(SYS.noiseOrange).fill('-8');
    await page.locator(SYS.save).click();
    await expect(page.locator(SYS.noiseError)).toContainText('darf nicht unter dem Schwellenwert «grün» liegen');
  });

  test('freezes the Schusszahlenerfassung up to the Sperrdatum and opens it again', async ({ page }) => {
    await open(page);
    await page.locator(SYS.lock).fill(`${YEAR}-01-31`);
    await save(page);

    try {
      await openGeissalp(page, 'shots');
      await expect(page.locator('[data-testid="shots-lock-notice"]')).toContainText(`bis und mit 31.01.${YEAR} gesperrt`);
      // January usages of the demo are frozen: a lock instead of edit / delete.
      const january = page.locator('[data-testid="shots-row"][data-locked="true"]');
      await expect(january.first()).toBeVisible();
      await expect(january.first().locator('[data-testid="shots-locked"]')).toBeVisible();
      await expect(january.first().locator('[data-testid="shots-edit"]')).toHaveCount(0);
      await expect(january.first().locator('input[type="checkbox"]')).toBeDisabled();
      // A usage after the Sperrdatum is still editable.
      await expect(page.locator('[data-testid="shots-row"]:not([data-locked]) [data-testid="shots-edit"]').first()).toBeVisible();

      // The entry form does not offer a date in the locked period.
      await page.locator('[data-testid="shots-new"]').click();
      await expect(page.locator('#shots-date')).toHaveAttribute('min', `${YEAR}-02-01`);
      await page.locator('#shots-date').fill(`${YEAR}-01-15`);
      await page.locator('[data-testid="shots-save"]').click();
      await expect(page.locator('[data-testid="shots-date-error"]')).toContainText('gesperrten Periode');
    } finally {
      await open(page);
      await page.locator(SYS.lockClear).click();
      await save(page);
    }
    await openGeissalp(page, 'shots');
    await expect(page.locator('[data-testid="shots-lock-notice"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="shots-row"][data-locked="true"]')).toHaveCount(0);
  });

  test('moves the Ampel of the Empfangspunkte with the dB thresholds and back with «Standard»', async ({ page }) => {
    await mockMapTiles(page);
    await openGeissalp(page, 'details');
    const over = page.locator('[data-testid="details-pin"].slim-map__pin--over');
    await expect(page.locator('[data-testid="details-pin"]')).toHaveCount(6);
    const before = await over.count();
    expect(before).toBeGreaterThan(0);

    await open(page);
    await page.locator(SYS.noiseOrange).fill('10');
    await save(page);
    try {
      // Orange up to +10 dB: no Empfangspunkt of the demo is red any more, and the Schiessplatz neither.
      await openGeissalp(page, 'details');
      await expect(page.locator('[data-testid="details-pin"]')).toHaveCount(6);
      await expect(over).toHaveCount(0);
      await expect(page.locator('[data-testid="details-pin"].slim-map__pin--warn').first()).toBeVisible();
    } finally {
      await open(page);
      await page.locator(SYS.defaults).click();
      await expect(page.locator(SYS.noiseOrange)).toHaveValue('0');
      await save(page);
    }
    await openGeissalp(page, 'details');
    await expect(over).toHaveCount(before);
  });

  test('offers the uploaded Benutzerhandbuch and the contacts in the main menu (5.9)', async ({ page }) => {
    await open(page);
    await expect(page.locator(SYS.manualNone)).toBeVisible();
    await page.locator(SYS.menu).click();
    await expect(page.locator(SYS.menuManualNone)).toContainText('Kein Handbuch hinterlegt');
    await page.keyboard.press('Escape');

    // Only a PDF is accepted.
    await page.locator(SYS.manualFile).setInputFiles({ name: 'Handbuch.txt', mimeType: 'text/plain', buffer: Buffer.from('kein PDF') });
    await expect(page.locator(SYS.manualError)).toContainText('muss ein PDF-Dokument sein');

    await page.locator(SYS.manualFile).setInputFiles({ name: 'Benutzerhandbuch SLIM.pdf', mimeType: 'application/pdf', buffer: PDF });
    await expect(page.locator(SYS.manualDownload)).toHaveText('Benutzerhandbuch SLIM.pdf');
    await page.locator(SYS.specialistName).fill('KOMZ Lärm');
    await page.locator(SYS.specialistEmail).fill('laerm@example.org');
    await save(page);

    try {
      // Any other page (the entry page would greet with the welcome banner of the demo).
      await page.goto(ROUTES.area);
      await page.locator(SYS.menu).click();
      await expect(page.locator(SYS.menuSpecialist)).toContainText('KOMZ Lärm');
      await expect(page.locator(`${SYS.menuSpecialist} a`)).toHaveAttribute('href', 'mailto:laerm@example.org');
      const download = page.waitForEvent('download');
      await page.locator(SYS.menuManual).click();
      const file = await download;
      expect(file.suggestedFilename()).toBe('Benutzerhandbuch SLIM.pdf');
    } finally {
      await open(page);
      await page.locator(SYS.manualRemove).click();
      await expect(page.locator(SYS.manualNone)).toBeVisible();
      await page.locator(SYS.specialistName).fill('');
      await page.locator(SYS.specialistEmail).fill('');
      await save(page);
    }
  });
});
