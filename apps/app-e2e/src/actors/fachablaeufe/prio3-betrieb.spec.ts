import type { Page, Route } from '@playwright/test';

import { MAP_STYLES, MAP_TILES, mockMapTiles } from '../../support/map';
import { FIXTURE_AREAS, tags } from '../support/actors';
import { expect, test, type ActorFixtures } from '../support/test';

/**
 * Fachabläufe Priorität 3 — Betrieb: Last während einer Berechnung, Ausfall des Kartendienstes
 * (readme.md, Abschnitt 7; Protokoll nach `protokoll-vorlage.md`). Soll aus B1 12.5 (Antwortzeiten)
 * und B1 5.4 (GIS). 3.2 läuft gegen den Demo-Datensatz, bis auf den Hinweis bei einem Dienst ohne Antwort
 * (Befund am Fall); 3.1 ist ein Skelett (`test.fixme`) – Skelette zählen nicht als bestanden.
 */
const { A } = FIXTURE_AREAS;

const MAP = {
  viewer: '[data-testid="details-map"] [data-testid="map-viewer"]',
  pin: '[data-testid="details-pin"]',
  tilesFailed: '[data-testid="details-map"] [data-testid="map-tiles-failed"]',
  base: '[data-testid="map-base"]',
  baseItem: (id: string) => `[data-testid="map-base-${id}"]`,
  listToggle: '[data-testid="details-list-toggle"]',
  listItem: '[data-testid="details-list-item"]',
  aside: '[data-testid="details-aside"]',
  row: '[data-testid="details-row"]',
  calcSelect: '[data-testid="details-calc-select"]',
  delta: '[data-testid="details-delta"]',
} as const;

const SIM = {
  tab: '[data-testid="area-tab-simulation"]',
  row: '[data-testid="sim-row"]',
  edit: '[data-testid="sim-edit"]',
  scale: '[data-testid="sim-scale"][data-factor="1.5"]',
  run: '[data-testid="sim-run"]',
  resultRow: '[data-testid="sim-result-row"]',
} as const;

/** Text des Fehlerzustands (Locale `common.map.tiles_failed`). */
const NOTICE = 'Hintergrundkarte nicht erreichbar';
const CORS = { 'access-control-allow-origin': '*' };
/** 1 × 1 px PNG. */
const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/** Die Anfrage bleibt offen: weder Antwort noch Abbruch. */
const hang = (): Promise<void> => new Promise<void>(() => undefined);

/** Unbehandelte Ausnahmen der Seite; fehlgeschlagene Netzaufrufe des Kartendienstes zählen nicht dazu. */
function pageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Details von Platz A (Geissalp) als A01: Karte bereit, sechs Empfangspunkte. */
async function openDetails(page: Page, signInAs: ActorFixtures['signInAs'], apiAs: ActorFixtures['apiAs']): Promise<void> {
  await signInAs('A01');
  const res = await apiAs.get('/api/admin/area');
  expect(res.status()).toBe(200);
  const area = ((await res.json()) as { id: string; name: string }[]).find((a) => a.name === A.name);
  expect(area, `${A.name} fehlt im Demo-Datensatz`).toBeTruthy();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/admin/area/${area?.id}/details`);
  await expect(page.locator(MAP.viewer)).toHaveAttribute('data-status', 'ready');
  await expect(page.locator(MAP.pin)).toHaveCount(6);
}

/** Der Rest der Anwendung bleibt bedienbar: Liste, Pegel, Zustandswechsel, Simulation. */
async function expectUsable(page: Page): Promise<void> {
  // Empfangspunkt in der Liste wählen: Pegel und Grenzwert stehen im Detail.
  await page.locator(MAP.listToggle).click();
  await expect(page.locator(MAP.listItem)).toHaveCount(6);
  await page.locator(`${MAP.listItem}[data-code="E2"]`).click();
  await expect(page.locator(MAP.aside)).toContainText('E2');
  await expect(page.locator(MAP.row).first()).toContainText(/\d+\.\d dB/);

  // Zustand wechseln: die Pegel des anderen Zustands erscheinen mit der Differenz zum aktuellen.
  const select = page.locator(MAP.calcSelect);
  const current = await select.inputValue();
  const other = (await select.locator('option').evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value))).find((v) => v !== current);
  expect(other, 'Geissalp hat zwei Zustände').toBeTruthy();
  await select.selectOption(String(other));
  await expect(page.locator(MAP.delta).first()).toBeVisible();

  // Simulation ausführen.
  await page.locator(SIM.tab).click();
  await expect(page.locator(SIM.row).first()).toBeVisible();
  await page.locator(SIM.edit).click();
  await page.locator(SIM.scale).click();
  await page.locator(SIM.run).click();
  await expect(page.locator(SIM.resultRow)).toHaveCount(6);
}

test.describe('Prio 3 · Betrieb', () => {
  test.fixme(
    '3.1 zehn Benutzer arbeiten während einer Berechnung – Antwortzeiten eingehalten, niemand blockiert',
    { annotation: tags({ actor: 'A01', prio: 3, slm: [54] }) },
    async () => {
      // Ausgangslage: Geissalp mit 4 572 Nutzungen (validierung-technisch.md 1.1); 10 Sitzungen (A01 ×2, A02 ×3, A03 ×4, A05 ×1)
      //               als getrennte Browser-Kontexte; Umgebung, Datenmenge und Datum im Protokoll (checkliste.md, Qualität).
      // Aktion:       Kontext 1 startet die Beurteilung über drei Jahre (schwerste Anfrage); parallel laden die anderen Übersicht,
      //               Schusszahlen (Filter), Details, Simulation; Messung mit performance.now() pro Seite, inkl. Wartezeit und Netz.
      // Soll (B1 12.5): Suche Ø ≤ 2 s / max 5 s, Filter Ø 0.5 s / max 1 s, Details Ø 2 s / max 5 s, Berechnung Ø 5 s / max 10 s;
      //               kein Request der anderen Kontexte wartet auf die Berechnung (Zeitreihe zeigt keine Stufe während des Laufs).
      //               Ein Rechenkern-Benchmark ersetzt diesen Lasttest nicht (checkliste.md) – Ergebnis nicht linear hochrechnen.
      // Ist / Beleg:  Messtabelle (Median/Max je Seite) + k6-/Playwright-Report; Umgebung benennen.
    },
  );

  // 3.2 Kartendienst fällt aus – verständlicher Fehlerzustand, übrige Anwendung bleibt benutzbar.
  // Ausgangslage: Details Geissalp mit Karte (Swisstopo-Hintergrund, B1 5.4), angemeldet als A01.
  // Aktion:       page.route() auf die Kartendienst-URLs: (a) 503, (b) keine Antwort > 30 s, (c) Verbindungsabbruch nach der
  //               ersten Kachel. Danach Empfangspunkt in der Liste wählen, Zustand wechseln, Simulation ausführen.
  // Soll:         Karte zeigt einen klaren Fehlerzustand mit Text (kein Endlos-Spinner, kein weisser Block ohne Hinweis);
  //               Empfangspunkt-Liste (`details-list-toggle`) bleibt bedienbar, Pegel werden angezeigt, Simulation läuft;
  //               keine unbehandelte Ausnahme der Seite; nach Wiederherstellung lädt die Karte ohne Neuladen der Seite.
  //               Ein Stub (page.route) ist ein Stub – der Nachweis mit dem echten Dienst folgt auf dem Akzeptanzsystem.
  // Ist (Lauf 02.10.2026): (a) und (c) erfüllt; (b) bedienbar, aber ohne Hinweis (Befund am Fall). Wiederherstellung in (c):
  //               der Hinweis verschwindet, sobald eine Hintergrundkarte gewählt wird – von selbst lädt der Viewer nicht neu.
  test.describe('3.2 Kartendienst fällt aus (Stub)', () => {
    test(
      '3.2 (a) Kartendienst antwortet 503 – Hinweis auf der Karte, Liste, Zustandswechsel und Simulation laufen',
      { annotation: tags({ actor: 'S03', prio: 3, slm: [2, 50] }) },
      async ({ page, signInAs, apiAs }) => {
        const errors = pageErrors(page);
        const unavailable = (route: Route) => route.fulfill({ status: 503, headers: CORS, body: '' });
        await page.route(MAP_STYLES, unavailable);
        await page.route(MAP_TILES, unavailable);

        await openDetails(page, signInAs, apiAs);
        await expect(page.locator(MAP.tilesFailed)).toContainText(NOTICE);
        await expectUsable(page);
        expect(errors).toEqual([]);
      },
    );

    test(
      '3.2 (b) Kartendienst antwortet nicht – die Anwendung bleibt sofort bedienbar',
      { annotation: tags({ actor: 'S03', prio: 3, slm: [2, 50] }) },
      async ({ page, signInAs, apiAs }) => {
        const errors = pageErrors(page);
        await page.route(MAP_STYLES, hang);
        await page.route(MAP_TILES, hang);

        await openDetails(page, signInAs, apiAs);
        // Bedienbar ist die Anwendung sofort, nicht erst nach einem Zeitlimit des Kartendienstes.
        await page.locator(`${MAP.pin}[data-code="E2"]`).click();
        await expect(page.locator(MAP.aside)).toContainText('E2');
        await expectUsable(page);
        expect(errors).toEqual([]);
        await page.unrouteAll({ behavior: 'ignoreErrors' });
      },
    );

    test.fixme(
      '3.2 (b) Kartendienst antwortet nicht – nach 30 s steht ein Hinweis auf der Karte',
      { annotation: tags({ actor: 'S03', prio: 3, slm: [2, 50] }) },
      async ({ page, signInAs, apiAs }) => {
        // Befund (Lauf 02.10.2026): nicht erfüllt. Bleiben die Anfragen offen, meldet die Kartenbibliothek keinen Fehler,
        //               und der Viewer hat kein eigenes Zeitlimit: die Objekte stehen ohne Hintergrund da, der Hinweis
        //               «Hintergrundkarte nicht erreichbar» erscheint auch nach 40 s nicht («Block ohne Hinweis»).
        //               Der Fall ist ausführbar und bleibt `fixme`, bis der Viewer ein Zeitlimit hat.
        test.setTimeout(150_000);
        await page.route(MAP_STYLES, hang);
        await page.route(MAP_TILES, hang);

        await openDetails(page, signInAs, apiAs);
        await expect(page.locator(MAP.tilesFailed)).toContainText(NOTICE, { timeout: 40_000 });
        await page.unrouteAll({ behavior: 'ignoreErrors' });
      },
    );

    test(
      '3.2 (c) Verbindung bricht nach der ersten Kachel ab – Hinweis; nach Wiederherstellung lädt die Karte ohne Neuladen',
      { annotation: tags({ actor: 'S03', prio: 3, slm: [2, 50] }) },
      async ({ page, signInAs, apiAs }) => {
        const errors = pageErrors(page);
        await mockMapTiles(page);
        await openDetails(page, signInAs, apiAs);
        await expect(page.locator(MAP.tilesFailed)).toHaveCount(0);

        // Ausfall: die erste Kachel kommt noch an, jede weitere Anfrage bricht ab.
        let served = 0;
        const firstOnly = (route: Route) =>
          served++ === 0 ? route.fulfill({ status: 200, contentType: 'image/png', headers: CORS, body: TILE }) : route.abort('connectionreset');
        await page.route(MAP_TILES, firstOnly);
        // Die Landeskarte besteht aus Rasterkacheln (die Standardkarte des Stubs lädt keine).
        await page.locator(MAP.base).click();
        await page.locator(MAP.baseItem('topo')).click();
        await expect(page.locator(MAP.tilesFailed)).toContainText(NOTICE);
        expect(served).toBeGreaterThan(1);
        await page.locator(`${MAP.pin}[data-code="E2"]`).click();
        await expect(page.locator(MAP.aside)).toContainText('E2');

        // Wiederherstellung: der Dienst antwortet wieder; die Seite wird nicht neu geladen.
        await page.evaluate(() => ((window as unknown as { e2eNoReload?: boolean }).e2eNoReload = true));
        await page.unroute(MAP_TILES, firstOnly);
        const loaded = page.waitForResponse((response) => response.url().includes('ch.swisstopo.swissimage') && response.status() === 200);
        await page.locator(MAP.base).click();
        await page.locator(MAP.baseItem('imagery')).click();
        await loaded;
        await expect(page.locator(MAP.tilesFailed)).toHaveCount(0);
        expect(await page.evaluate(() => (window as unknown as { e2eNoReload?: boolean }).e2eNoReload)).toBe(true);
        expect(errors).toEqual([]);
      },
    );
  });
});
