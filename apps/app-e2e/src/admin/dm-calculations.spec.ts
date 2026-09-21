import { expect, test, type Page } from '@playwright/test';

/**
 * Datenverwaltung › Schiessplatz › Berechnungen (B1 5.18 Übersicht, 5.19
 * Import, 5.20 Export, 5.21 Details; slm 18–21) on the demo area 1104.020
 * Geissalp: one delivery «Lärmsanierungsprojekt Geissalp (LBK_02218)» with
 * the states «Initiale Aufnahme Areal Geissalp» (aktuell + MGDM) and
 * «Sanierter Zustand SPM Geissalp». Signed in as the galaxy admin (root on
 * app 42). The tests run in order: the import creates a delivery that the
 * later tests use and the last one deletes; pointer moves are reverted.
 */
const DM = {
  overview: '/admin/data-management/area/overview',
  rowCalculations: '[data-testid="dma-action-calculations"]',
  tab: (id: string) => `[data-testid="dmcalc-tab-${id}"]`,
  // 5.18
  title: '[data-testid="dco-title"]',
  search: '[data-testid="dco-search"]',
  count: '[data-testid="dco-count"]',
  row: '[data-testid="dco-row"]',
  detailTitle: '[data-testid="dco-detail-title"]',
  name: '[data-testid="dco-name"]',
  supplier: '[data-testid="dco-supplier"]',
  file: '[data-testid="dco-file"]',
  state: '[data-testid="dco-state"]',
  pointerCurrent: '[data-testid="dco-pointer-current"]',
  pointerMgdm: '[data-testid="dco-pointer-mgdm"]',
  pointerDialog: '[data-testid="dco-pointer-dialog"]',
  pointerConfirm: '[data-testid="dco-pointer-confirm"]',
  buildYear: '[data-testid="dco-build-year"]',
  stateDetails: '[data-testid="dco-state-details"]',
  delete: '[data-testid="dco-delete"]',
  deleteDialog: '[data-testid="dco-delete-dialog"]',
  deleteBlocked: '[data-testid="dco-delete-blocked"]',
  deleteConfirm: '[data-testid="dco-delete-confirm"]',
  toast: '[data-testid="dco-toast"]',
  // 5.19
  importTitle: '[data-testid="dci-title"]',
  importFile: '[data-testid="dci-file"]',
  importSummary: '[data-testid="dci-summary"]',
  importName: '[data-testid="dci-name"]',
  importSupplier: '[data-testid="dci-supplier"]',
  validate: '[data-testid="dci-validate"]',
  validationOk: '[data-testid="dci-validation-ok"]',
  validationFindings: '[data-testid="dci-validation-findings"]',
  importButton: '[data-testid="dci-import"]',
  imported: '[data-testid="dci-imported"]',
  importToast: '[data-testid="dci-toast"]',
  importState: '[data-testid="dci-state"]',
  uploadFile: (kind: string) => `[data-testid="dci-upload-file-${kind}"]`,
  uploadResult: (kind: string) => `[data-testid="dci-result-${kind}"]`,
  uploadCount: (kind: string) => `[data-testid="dci-count-${kind}"]`,
  // 5.20
  exportTitle: '[data-testid="dce-title"]',
  exportState: '[data-testid="dce-state"]',
  exportStateCheck: '[data-testid="dce-state-check"]',
  exportStates: '[data-testid="dce-export-states"]',
  exportYear: '[data-testid="dce-year"]',
  exportYearCheck: '[data-testid="dce-year-check"]',
  exportShots: '[data-testid="dce-export-shots"]',
  newState: '[data-testid="dce-new-state"]',
  newStateDialog: '[data-testid="dce-state-dialog"]',
  newStateDelivery: '[data-testid="dce-state-delivery"]',
  newStateName: '[data-testid="dce-state-name"]',
  newStateYear: '[data-testid="dce-state-year"]',
  newStateSave: '[data-testid="dce-state-save"]',
  exportToast: '[data-testid="dce-toast"]',
  // 5.21
  detailsTitle: '[data-testid="dcd-title"]',
  detailsState: '[data-testid="dcd-state"]',
  room: '[data-testid="dcd-room"]',
  roomSearch: '[data-testid="dcd-room-search"]',
  detailsDetailTitle: '[data-testid="dcd-detail-title"]',
  detailsTab: (id: string) => `[data-testid="dcd-tab-${id}"]`,
  detailsRow: '[data-testid="dcd-row"]',
} as const;

const STAMP = Date.now();
const DELIVERY = `E2E Lieferung ${STAMP}`;
const STATE = `E2E Zustand ${STAMP}`;
const VARIANT = `E2E Variante ${STAMP}`;
const SOURCE = `Q_E2E_${STAMP}`;
const DEMO_DELIVERY = 'Lärmsanierungsprojekt Geissalp (LBK_02218)';
const INITIAL = 'Initiale Aufnahme Areal Geissalp';
const SANITISED = 'Sanierter Zustand SPM Geissalp';

/** A minimal Berechnungsdatei (validated FGDB as JSON): one Anlageteil on the demo room «Stellungsrm B 2». */
function stateFile(roomName = 'Stellungsrm B 2'): Buffer {
  return Buffer.from(
    JSON.stringify({
      calculation: { name: DELIVERY, supplier: 'Büro E2E', deliveredAt: '2026-09-19', description: 'Playwright' },
      state: { externalId: `E2E_${STAMP}`, name: STATE, referenceYear: 2027 },
      plantParts: [{ coordinationSectionNo: 'E2E.01', name: 'Anlageteil E2E', type: 'Schiessanlage (300m)', builtAfter1985: true, roomName }],
      sources: [{ sourceId: SOURCE, plantPartNo: 'E2E.01', weaponSystem: 'Stgw90', a9: { shotsInside: 1000, shotsOutside: 100, year: 2026 } }],
      immissionPoints: [{ sonarmsId: 'E2E_H1', code: 'E2E_H1', address: 'Testweg 1', sensitivityLevel: 'II', mapX: 10, mapY: 10 }],
      wlr: [{ point: 'E2E_H1', source: SOURCE, timeGroup: 'day', lae: 60, lafmax: 70 }],
    }),
    'utf-8',
  );
}

const WLR_NIGHT = Buffer.from(`Empfänger\tGebäude\tQuelle\tWaffe\tElevation\tLAE(MK)\tLAE(GK)\tLAE(Det)\tLAE\tLAFmax\nE2E_H1\t\t${SOURCE}\tStgw90\t0.1\t58\t50\t0\t58.5\t68\nH_NIX\t\t${SOURCE}\tStgw90\t\t\t\t\t50\t60`, 'utf-8');
const A9 = Buffer.from(`QuellenID;A9_M1;A9_M2;Schätzung;Jahr\n${SOURCE};2000;300;ja;2025`, 'utf-8');

async function openCalculations(page: Page): Promise<void> {
  await page.goto(DM.overview);
  const row = page.locator('.slim-table tbody tr.slim-table__row', { hasText: 'Geissalp' });
  await expect(row).toHaveCount(1);
  await row.locator(DM.rowCalculations).click();
  await expect(page).toHaveURL(/\/admin\/data-management\/area\/[^/]+\/calculations\/overview$/);
  await expect(page.locator(DM.row).first()).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test.describe('data management: Schiessplatz › Berechnungen', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openCalculations(page);
  });

  test('lists the deliveries with their states and pointers, searches, and blocks the delete of the current one (5.18)', async ({ page }) => {
    await expect(page.locator(DM.title)).toContainText('Übersicht Berechnungen');
    const demo = page.locator(DM.row, { hasText: DEMO_DELIVERY });
    await expect(demo).toHaveCount(1);
    await expect(demo).toContainText('Empa');
    await expect(demo).toContainText('25.03.2025');
    await expect(demo.locator('.dco__flag--on')).toHaveCount(2); // aktuell + MGDM live in this delivery

    // Detail of the delivery with the current state (preselected).
    await expect(page.locator(DM.detailTitle)).toContainText(DEMO_DELIVERY);
    await expect(page.locator(DM.name)).toHaveValue(DEMO_DELIVERY);
    await expect(page.locator(DM.supplier)).toHaveValue('Empa');
    await expect(page.locator(DM.file)).toContainText('keine Datei');
    await expect(page.locator(DM.state)).toHaveCount(2);
    const initial = page.locator(DM.state, { hasText: INITIAL });
    await expect(initial).toContainText('02218_1');
    await expect(initial.locator(DM.pointerCurrent)).toBeDisabled(); // already aktuell — only another state can take it over
    await expect(initial.locator(DM.pointerCurrent)).toHaveAttribute('aria-pressed', 'true');
    await expect(initial.locator(DM.pointerMgdm)).toHaveAttribute('aria-pressed', 'true');
    const sanitised = page.locator(DM.state, { hasText: SANITISED });
    await expect(sanitised.locator(DM.pointerCurrent)).toBeEnabled();
    await expect(sanitised.locator(DM.pointerCurrent)).toHaveAttribute('aria-pressed', 'false');

    // Search over the states of a delivery.
    await page.locator(DM.search).fill('02218_2');
    await expect(page.locator(DM.row)).toHaveCount(1);
    await page.locator(DM.search).fill('gibt es nicht');
    await expect(page.locator(DM.row)).toHaveCount(0);
    await expect(page.locator(DM.count)).toContainText('0 von');
    await page.locator(DM.search).fill('');

    // Delete is refused while a state of the delivery is the current one.
    await page.locator(DM.delete).click();
    await expect(page.locator(DM.deleteBlocked)).toContainText('aktuell gültige Zustand');
    await expect(page.locator(DM.deleteConfirm)).toHaveCount(0);
    await page.locator(`${DM.deleteDialog} .slim-btn`, { hasText: 'Abbrechen' }).click();
    await expect(page.locator(DM.deleteDialog)).toHaveCount(0);
  });

  test('moves the «aktuell» pointer after a confirmation and back again; edits the Baujahr per state (5.18)', async ({ page }) => {
    const initial = page.locator(DM.state, { hasText: INITIAL });
    const sanitised = page.locator(DM.state, { hasText: SANITISED });
    await sanitised.locator(DM.pointerCurrent).click();
    await expect(page.locator(DM.pointerDialog)).toContainText('Aktuellen Zustand festlegen?');
    await expect(page.locator(DM.pointerDialog)).toContainText(SANITISED);
    await page.locator(DM.pointerConfirm).click();
    await expect(page.locator(DM.toast)).toContainText('ist jetzt der aktuelle Zustand');
    await expect(sanitised.locator(DM.pointerCurrent)).toHaveAttribute('aria-pressed', 'true');
    await expect(initial.locator(DM.pointerCurrent)).toHaveAttribute('aria-pressed', 'false');
    await expect(initial.locator(DM.pointerCurrent)).toBeEnabled();
    // MGDM stays where it was: the two pointers are independent.
    await expect(initial.locator(DM.pointerMgdm)).toHaveAttribute('aria-pressed', 'true');

    // Back to the demo default.
    await initial.locator(DM.pointerCurrent).click();
    await page.locator(DM.pointerConfirm).click();
    await expect(page.locator(DM.toast)).toContainText(`«${INITIAL}» ist jetzt der aktuelle Zustand`);
    await expect(initial.locator(DM.pointerCurrent)).toHaveAttribute('aria-pressed', 'true');

    // Baujahr Anlageteile of a state, changed inline and restored.
    const select = sanitised.locator(DM.buildYear);
    const before = await select.inputValue();
    const other = before === 'before1985' ? 'after1985' : 'before1985';
    await select.selectOption(other);
    await expect(page.locator(DM.toast)).toContainText(`Baujahr Anlageteile von «${SANITISED}» gespeichert`);
    await expect(select).toHaveValue(other);
    await select.selectOption(before);
    await expect(select).toHaveValue(before);
  });

  test('validates a Berechnungsdatei, refuses an unknown Stellungsraum, imports the file and loads WLR / Betriebsdaten (5.19)', async ({ page }) => {
    await page.locator(DM.tab('import')).click();
    await expect(page).toHaveURL(/\/calculations\/import$/);
    await expect(page.locator(DM.importTitle)).toContainText('Import Berechnung');
    // Relative: an earlier run may have left its own E2E delivery in the e2e database.
    const statesBefore = await page.locator(DM.importState).count();
    expect(statesBefore).toBeGreaterThanOrEqual(2);

    // 1 A file with an unknown Stellungsraum: the validation reports it, the import stays locked.
    await page.locator(DM.importFile).setInputFiles({ name: 'fremd.json', mimeType: 'application/json', buffer: stateFile('Stellungsrm gibt es nicht') });
    await expect(page.locator(DM.importSummary)).toContainText(STATE);
    await page.locator(DM.validate).click();
    await expect(page.locator(DM.validationFindings)).toBeVisible();
    await expect(page.locator(DM.validationFindings)).toContainText('Unbekannter Stellungsraum');
    await expect(page.locator(DM.importButton)).toBeDisabled();

    // 2 The valid file: prefilled delivery fields, clean validation, import.
    await page.locator(DM.importFile).setInputFiles({ name: 'geissalp_e2e.gdb.json', mimeType: 'application/json', buffer: stateFile() });
    await expect(page.locator(DM.importName)).toHaveValue(DELIVERY);
    await expect(page.locator(DM.importSupplier)).toHaveValue('Büro E2E');
    await expect(page.locator(DM.importSummary)).toContainText('1 Anlageteile · 1 Schusslinien · 1 Immissionspunkte');
    await page.locator(DM.validate).click();
    await expect(page.locator(DM.validationOk)).toContainText('gültig');
    await expect(page.locator(DM.importButton)).toBeEnabled();
    await page.locator(DM.importButton).click();
    await expect(page.locator(DM.importToast)).toContainText(`Zustand «${STATE}» importiert (1 Schusslinien, 1 WLR-Zeilen)`);
    await expect(page.locator(DM.imported)).toContainText(STATE);
    await expect(page.locator(DM.importSummary)).toHaveCount(0); // mask cleared for the next file

    // 3 The imported state is selected on the right; its counts show the imported day level.
    await expect(page.locator(DM.importState)).toHaveCount(statesBefore + 1);
    const row = page.locator(DM.importState, { hasText: STATE });
    await expect(row).toHaveCount(1);
    await expect(row).toHaveClass(/slim-table__row--selected/);
    await expect(page.locator(DM.uploadCount('wlr_day'))).toContainText('1 Zeilen');
    await expect(page.locator(DM.uploadCount('wlr_night'))).toContainText('0 Zeilen');

    // 4 WLR NIGHT (time group from the file name) with one unknown receiver.
    await page.locator(DM.uploadFile('wlr_night')).setInputFiles({ name: 'eve.wlr', mimeType: 'text/plain', buffer: WLR_NIGHT });
    await expect(page.locator(DM.uploadResult('wlr_night'))).toContainText('eve.wlr: 1 von 2 Zeilen übernommen, 0 ersetzt');
    await expect(page.locator(DM.uploadResult('wlr_night'))).toContainText('1 Zeilen mit unbekannter Quelle oder unbekanntem Empfänger');
    await expect(page.locator(DM.uploadCount('wlr_night'))).toContainText('1 Zeilen');

    // 5 Betriebsdaten Anhang 9 per QuellenID.
    await page.locator(DM.uploadFile('a9')).setInputFiles({ name: 'BetriebA9.txt', mimeType: 'text/plain', buffer: A9 });
    await expect(page.locator(DM.uploadResult('a9'))).toContainText('BetriebA9.txt: 1 von 1 Zeilen übernommen');
    await expect(page.locator(DM.uploadCount('a9'))).toContainText('1 Zeilen');

    // 6 The overview now lists the new delivery with the file name and the state.
    await page.locator(DM.tab('overview')).click();
    const delivery = page.locator(DM.row, { hasText: DELIVERY });
    await expect(delivery).toHaveCount(1);
    await expect(delivery).toContainText('Büro E2E');
    await delivery.click();
    await expect(page.locator(DM.file)).toContainText('geissalp_e2e.gdb.json');
    await expect(page.locator(DM.state, { hasText: STATE })).toContainText(`E2E_${STAMP}`);
  });

  test('shows the WLR levels and the Betriebsdaten of the imported state per Stellungsraum (5.21)', async ({ page }) => {
    const delivery = page.locator(DM.row, { hasText: DELIVERY });
    await delivery.click();
    await page.locator(DM.state, { hasText: STATE }).locator(DM.stateDetails).click();
    await expect(page).toHaveURL(/\/calculations\/details\?state=/);
    await expect(page.locator(DM.detailsTitle)).toContainText('Berechnungsdetails');
    const selected = page.locator(`${DM.detailsState} option:checked`);
    await expect(selected).toContainText(STATE);

    // The room with the imported Anlageteil is opened first (the other rooms carry no data in this state).
    await expect(page.locator(DM.detailsDetailTitle)).toContainText('Stellungsrm B 2');
    const rooms = page.locator(DM.room);
    expect(await rooms.count()).toBeGreaterThan(10);
    await expect(page.locator(DM.room, { hasText: 'Stellungsrm B 2' })).toHaveClass(/slim-table__row--selected/);
    await expect(page.locator(DM.room, { hasText: 'Stellungsrm B 2' })).toContainText('1'); // one source
    await expect(page.locator(DM.detailsTab('wlr_day'))).toContainText('1');
    await expect(page.locator(DM.detailsTab('wlr_night'))).toContainText('1');
    await expect(page.locator(DM.detailsTab('a9'))).toContainText('1');
    await expect(page.locator(DM.detailsTab('a7'))).toContainText('0');

    const day = page.locator(DM.detailsRow);
    await expect(day).toHaveCount(1);
    await expect(day).toContainText('E2E_H1');
    await expect(day).toContainText(SOURCE);
    await expect(day).toContainText('60.0');
    await page.locator(DM.detailsTab('wlr_night')).click();
    await expect(page.locator(DM.detailsRow)).toContainText('58.5');
    await page.locator(DM.detailsTab('a9')).click();
    const a9 = page.locator(DM.detailsRow);
    await expect(a9).toContainText(SOURCE);
    await expect(a9).toContainText('2’000'); // the uploaded Anhang 9 replaced the 1000 of the file
    await expect(a9).toContainText('Ja'); // Schätzung
    await page.locator(DM.detailsTab('a7')).click();
    await expect(page.locator('.dcd__detail .slim-empty__text')).toContainText('Keine Daten');

    // Another room of the same state has nothing; the search narrows the list.
    await page.locator(DM.roomSearch).fill('A 1 links');
    await expect(rooms).toHaveCount(1);
    await rooms.first().click();
    await expect(page.locator(DM.detailsTab('wlr_day'))).toContainText('0');

    // The demo state shows its 350 WLR rows spread over the rooms.
    const demoOption = page.locator(`${DM.detailsState} option`, { hasText: INITIAL });
    await page.locator(DM.detailsState).selectOption((await demoOption.getAttribute('value')) as string);
    await page.locator(DM.roomSearch).fill('');
    await expect(page.locator(DM.room).first()).toBeVisible();
    await page.locator(DM.room, { hasText: 'A 1 links' }).click();
    await page.locator(DM.detailsTab('wlr_day')).click();
    await expect.poll(() => page.locator(DM.detailsRow).count(), { timeout: 10_000 }).toBeGreaterThan(1);
  });

  test('exports the chosen states as JSON bundle and the Schusszahlen as CSV; creates an empty state with a new ZustandID (5.20)', async ({ page }) => {
    await page.locator(DM.tab('export')).click();
    await expect(page).toHaveURL(/\/calculations\/export$/);
    await expect(page.locator(DM.exportTitle)).toContainText('Export');
    await expect(page.locator(DM.exportStates)).toBeDisabled();
    const e2eState = page.locator(DM.exportState, { hasText: STATE });
    await expect(e2eState).toContainText('Büro E2E');
    await e2eState.locator(DM.exportStateCheck).check();
    await expect(page.locator(DM.exportStates)).toBeEnabled();
    const bundle = page.waitForEvent('download');
    await page.locator(DM.exportStates).click();
    const bundleFile = await bundle;
    expect(bundleFile.suggestedFilename()).toMatch(/^berechnungszustaende_\d{4}-\d{2}-\d{2}\.json$/);
    await expect(page.locator(DM.exportToast)).toContainText('Export gestartet (1 gewählt)');

    // Schusszahlen of the calendar year with the demo usages.
    const year = page.locator(DM.exportYear, { hasText: String(new Date().getFullYear()) });
    await expect(year).toHaveCount(1);
    await expect(page.locator(DM.exportShots)).toBeDisabled();
    await year.locator(DM.exportYearCheck).check();
    const csv = page.waitForEvent('download');
    await page.locator(DM.exportShots).click();
    expect((await csv).suggestedFilename()).toBe(`schusszahlen_${new Date().getFullYear()}.csv`);

    // A new empty Berechnungszustand in the E2E delivery: ZustandID from the Koordinationsabschnitt.
    await page.locator(DM.newState).click();
    await expect(page.locator(DM.newStateDialog)).toBeVisible();
    await page.locator(DM.newStateDelivery).selectOption({ label: DELIVERY });
    await page.locator(DM.newStateSave).click();
    await expect(page.locator(`${DM.newStateDialog} .slim-field--invalid`)).toHaveCount(1); // Bezeichnung required
    await page.locator(DM.newStateName).fill(VARIANT);
    await page.locator(DM.newStateYear).fill('2028');
    await page.locator(DM.newStateSave).click();
    await expect(page.locator(DM.exportToast)).toContainText(`Zustand «${VARIANT}» angelegt (Zustand ID 1104.020_`);
    const variant = page.locator(DM.exportState, { hasText: VARIANT });
    await expect(variant).toContainText('ohne Modell');
    await expect(variant).toHaveClass(/slim-table__row--selected/); // marked for the export right away
  });

  test('deletes the E2E delivery with its two states (5.18)', async ({ page }) => {
    const delivery = page.locator(DM.row, { hasText: DELIVERY });
    await delivery.click();
    await expect(page.locator(DM.state)).toHaveCount(2);
    // The empty state can never become aktuell / MGDM.
    await expect(page.locator(DM.state, { hasText: VARIANT }).locator(DM.pointerCurrent)).toBeDisabled();
    await page.locator(DM.delete).click();
    await expect(page.locator(DM.deleteDialog)).toContainText(`«${DELIVERY}» mit 2 Zuständen wird gelöscht`);
    await page.locator(DM.deleteConfirm).click();
    await expect(page.locator(DM.toast)).toContainText(`Berechnung «${DELIVERY}» gelöscht`);
    await expect(page.locator(DM.row, { hasText: DELIVERY })).toHaveCount(0);
    await expect(page.locator(DM.row, { hasText: DEMO_DELIVERY })).toHaveCount(1);
  });
});
