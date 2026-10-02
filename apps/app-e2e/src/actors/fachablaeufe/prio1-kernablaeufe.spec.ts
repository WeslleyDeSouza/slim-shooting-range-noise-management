import type { APIResponse } from '@playwright/test';

import { ACTORS, FIXTURE_AREAS, tags } from '../support/actors';
import { expect, test, type ActorFixtures } from '../support/test';

/**
 * Fachabläufe Priorität 1 — vollständige Abläufe mit vorher festgelegtem Soll-Ergebnis
 * (readme.md, Abschnitt 7; Protokoll je Fall nach `protokoll-vorlage.md`).
 *
 * Jeder Fall trägt sein Drehbuch als Kommentar in der Reihenfolge
 *   Ausgangslage → Aktion → erwartetes Ergebnis (mit Herleitung) → tatsächliches Ergebnis → Beleg.
 * Die letzten beiden bleiben leer, bis der Fall gelaufen ist. Soll-Werte stammen aus Beilage B1.4
 * (`B14_CONTROL`, `libs/shared/lsv/src/lib/fixtures/b14-demo.fixture.ts`), aus der Handrechnung
 * `fixtures/platz-s.md` oder aus einer bestätigten Fachregel – nie aus der Anwendung.
 *
 * 1.6 und 1.7 laufen gegen den Demo-Datensatz; die übrigen Fälle sind Skelette (`test.fixme`) –
 * Skelette zählen nicht als bestanden.
 */
const { A, B, C, S } = FIXTURE_AREAS;

/** Ampelfarben und der Rahmen von «nicht beurteilbar» – «Keine Daten» trägt keine davon. */
const COLOURED = /slim-badge--(success|warning|danger|outline)/;

/** Meldung der Regel `area-scope` (apps/api/src/modules/area/scope/area-scope.rule.ts) in der 403-Antwort. */
const AREA_SCOPE_MESSAGE = 'Not assigned to this Schiessplatz';

type Api = ActorFixtures['apiAs'];

interface AreaRow {
  id: string;
  name: string;
  noiseStatus: string;
  noiseStatusReason: string | null;
  noiseStatusBasis: string | null;
}

interface UsageOverview {
  kpi: { totalShots: number; count: number };
  combinations: { roomId: string; combinationId: string; quantityUnit: string; enabled: boolean }[];
  usages: { id: string }[];
}

/** Antwort als JSON; ein anderer Status als 200 bricht mit dem Text der Antwort ab. */
async function jsonOf<T>(call: Promise<APIResponse>): Promise<T> {
  const res = await call;
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as T;
}

/** Die Schiessplätze, die der angemeldete Akteur sieht. */
function areasOf(apiAs: Api): Promise<AreaRow[]> {
  return jsonOf<AreaRow[]>(apiAs.get('/api/admin/area'));
}

test.describe('Prio 1 · Kernabläufe', () => {
  test.fixme(
    '1.1 Empa-Demodaten importieren und A7/A9 berechnen – Kontrollwerte B1.4, E8-Sonderfall ausdrücklich',
    { annotation: tags({ actor: 'A01', prio: 1, useCase: '4.9', slm: [19, 21, 31, 32, 33, 34] }) },
    async () => {
      // Ausgangslage: Platz «sonARMS Demo» (neu, ohne Zustand); Fixture-Dateien aus Beilage B1.4:
      //               WLR sonARMS_Demo_Day/_Eve (12 Empfangspunkte × 4 Quellen), Betriebsdaten A9
      //               (Tag/Abend 100/2, 20/1, 500/5, 888/12) und A7 (Kat. a: 5000/500/4000/1000, 27 Werk- + 1 Sonn-Halbtag).
      //               Nutzungen so erfasst, dass die Verteilung (7.5) je Quelle genau diese Mengen ergibt:
      //               eine Kombination je Quelle, je eine Nutzung Mo 08–11 (innerhalb) und So (ausserhalb).
      // Aktion:       als A01 Berechnung importieren (5.19: GDB/GeoJSON + WLR + Betriebsdaten), Zustand «aktuell»
      //               setzen (5.18), Details 5.12 öffnen, Zeitraum = Jahr der Nutzungen.
      // Soll (B1.4 Blatt A9X/A7X, docs/architecture/laermberechnung.md):
      //               A9 Lr: E1 60.7 · E2 51.8 · E3 46.6 · E4a 41.8 · E5b 61.8 · E9 52.9
      //               A7 Lr: E1 73.8 · E2 66.3 · E3 60.5 · E4a 53.1
      //               E8-Sonderfall: A9 14.5 (Formelblatt A9X; der sonARMS-Kernel A9p schreibt 14.3, weil er Quellen
      //               unter seiner Relevanzschwelle weglässt) und A7 28.1 (Formelblatt A7X summiert die 0-dB-Zellen der
      //               leeren Kategorien; der Kernel-Ausdruck A7p zeigt 28.0).
      //               Die Anwendung muss 14.5 / 28.1 zeigen: die Formelblätter sind gemäss FAQ 19 und 98 verbindlich,
      //               der Prüfer muss die Abweichung zum Kernel-Ausdruck kennen (vgl. faq-praezisierungen.spec.ts).
      //               Ampel je Punkt gegen die ES-Grenzwerte der B1.4-Punkte; Vergleich auf ganze dB.
      // Ist:          –
      // Beleg:        Playwright-Trace + GET …/calculation/assessment als JSON im Report.
    },
  );

  test.fixme(
    `1.2 dieselben Nutzungen mit zwei Berechnungsständen auswerten (${S.name}: Z1 57.1 / 38.1 → Z2 51.1 / 32.2, E2 nur in Z2)`,
    { annotation: tags({ actor: 'A01', prio: 1, useCase: '4.7', slm: [11, 43, 44] }) },
    async () => {
      // Ausgangslage: Testplatz S geseedet (TESTPLATZ_S_DATASET aus @api-slim/tests), Z1 aktuell, Nutzungen U1–U4 (2026).
      // Aktion:       Details → Zustand Z1 → E1 lesen; Zustand Z2 wählen → E1 und E2 lesen; zurück auf Z1.
      // Soll (platz-s.md Abschnitt 6):
      //               Z1: E1 A9 57.1 (orange, 57 vs IGW 60), A7 38.1 (grün); kein E2.
      //               Z2: E1 A9 51.1 (grün), A7 32.2 (Lri 32.14, mit den 0-dB-Zellen des A7X 32.16); E2 A9 57.1 (grün, ES III IGW 65).
      //               Delta E1 zu Z1: A9 −6.0 dB, A7 −5.9 dB (Anzeigewerte 32.2 − 38.1).
      //               Nutzungen (GET …/usage/overview) sind in beiden Sichten identisch – Nutzungen hängen am Platz,
      //               nicht am Zustand (slm 44); Quellen/Punkte kommen ausschliesslich aus dem gewählten Stand (slm 43).
      //               Q1b (Gewicht 0) in Z2 bekommt keine Schüsse, Q1a alles – Ergebnis unverändert 51.1 (Teil-Null-Regel).
      // Ist:          –
      // Beleg:        zwei Assessment-JSONs (calculationId Z1/Z2) + Screenshots der Details.
    },
  );

  test.fixme(
    `1.3 neuen Stand mit verschobenen Punkten importieren – alter Stand und seine Ergebnisse bleiben (${S.name})`,
    { annotation: tags({ actor: 'A01', prio: 1, useCase: '4.9', slm: [18, 19, 43] }) },
    async () => {
      // Ausgangslage: Testplatz S nur mit Berechnung B1/Z1; Soll-Werte Z1 protokolliert (57.1 / 38.1).
      // Aktion:       Berechnung B2 (Z2 mit E1 verschoben = −6 dB, E2 neu; Z3) importieren (5.19), Z2 als «aktuell» setzen.
      // Soll:         Z1 unverändert: Quellen Q1, Punkt E1 (Koordinaten alt), WLR 80.0, Ergebnis 57.1 / 38.1 (Zustandswahl Z1).
      //               Z2: eigene Punkte/Quellen (Q1a/Q1b, E1 neu, E2) – kein E2 in Z1, keine geänderte Koordinate in Z1
      //               (standbezogene Identität, datenmodel-anpassung.md Abschnitt 5). Übersicht 5.9 zeigt nun die Z2-Ampel (grün).
      //               «Genau ein Zustand aktuell» (slm 18): Z1 verliert das Flag automatisch; MGDM-Flag bleibt bei Z1, bis es gesetzt wird.
      // Ist:          –
      // Beleg:        GET states vor/nach; Assessment Z1 vor/nach byte-gleich (bis auf Zeitstempel).
    },
  );

  test.fixme(
    `1.4 Nutzung mit einer Kombination ohne passende Quelle berechnen – unvollständig, nie grün (${S.name}, Zeitraum 2025)`,
    { annotation: tags({ actor: 'A01', prio: 1, useCase: '4.7', slm: [32, 4] }) },
    async () => {
      // Ausgangslage: Testplatz S, Z1 aktuell; Zeitraum 2025 enthält nur U5 (pist75 50) und U6 (sprengladung 2.5 kg);
      //               Z1 hat keine Quelle für beide Kombinationen.
      // Aktion:       Details, Zeitraum 2025; Übersicht Schiessplätze; Export (falls vorhanden).
      // Soll (O8):    E1 state «incomplete», missingSources = 2 Einträge (Kombination · Zustand), keine Farbe in Details,
      //               Kontextleiste, Übersicht, Startseite («nicht beurteilbar» zählt nicht zu «eingehalten»); A9-Zeile ohne
      //               Pegel (kein Stgw90-Anteil 2025) – kein «grün, weil nichts gerechnet wurde».
      //               Simulation 5.13 zeigt das Badge «nicht beurteilbar» für E1.
      // Ist:          –
      // Beleg:        Assessment-JSON (counts.incomplete = 1), Screenshots Übersicht + Details.
    },
  );

  test.fixme(
    `1.5 alle Quellengewichte null (Z3) verweigern; einzelne null (Z2) mit definiertem Verhältnis (${S.name})`,
    { annotation: tags({ actor: 'A01', prio: 1, useCase: '4.7', slm: [32] }) },
    async () => {
      // Ausgangslage: Testplatz S, Zustände Z2 (Q1a 1000/0, Q1b 0/0) und Z3 (Q1a 0/0, Q1b 0/0), Zeitraum 2026.
      // Aktion:       Details mit Zustand Z3; danach Zustand Z2.
      // Soll (Fachregel O8, distribution.ts):
      //               Z3: Σ Gewichte = 0 → Verteilung verweigert (Default) → E1 und E2 «nicht beurteilbar», Warnung
      //               «zero-weights» sichtbar; KEINE Gleichverteilung ohne dokumentierte Freigabe (release).
      //               Z2: Q1a erhält 1 210 / 200 Schüsse, Q1b 0 → E1 51.1, E2 57.1 (platz-s.md 4); Kennzeichen «Teil-Null»
      //               darf angezeigt werden, ändert das Ergebnis nicht.
      //               Erst mit Ersatzregel (Freigabe KOMZ, Referenz + Datum) dürfte Z3 gleichverteilt rechnen – dann mit
      //               Kennzeichen «substituteRule» im DTO/Export.
      // Ist:          –
      // Beleg:        zwei Assessment-JSONs; Konfiguration der Ersatzregel (falls vorhanden) als Screenshot.
    },
  );

  test(
    '1.6 Platz ohne Berechnungsgrundlage öffnen (Interessent) – Nutzungen sichtbar, keine erfundene Lärmampel',
    { annotation: tags({ actor: 'A03', prio: 1, useCase: '4.6', slm: [4, 8, 9] }) },
    async ({ page, signInAs, apiAs }) => {
      // Ausgangslage: Platz C (Hinterrhein, 0 Berechnungen) – zusätzlich eine Nutzung auf C erfassen (als A01), damit
      //               «Nutzungsdaten bleiben sichtbar» prüfbar ist; Demo-Seed: 0 Nutzungen auf Hinterrhein.
      // Aktion:       als A03 Übersicht → Hinterrhein → Übersicht/Schusszahlen/Details/Simulation.
      // Soll (slm 4, 5.10): Schusszahlen listen die Nutzung und summieren; Details «keine Berechnungsgrundlage»;
      //               Ampel Lärm = «Keine Daten» (none) in Übersicht und Kontextleiste – nicht grün, nicht
      //               «nicht beurteilbar» (das ist O8 und setzt eine Grundlage voraus); Kontingent-Ampel unabhängig davon.
      //               Kein Platz ohne Berechnung trägt eine Lärmampel: sie kommt aus der Berechnung, nicht aus dem Seed.
      //               Simulation: Rollenmatrix B1 8.1.2 gibt dem Interessenten kein Recht (X) → API 403, nichts Erfundenes.
      // Nicht geprüft: Startseite – ihre Kennzahlen zählen je Platz die schlechtere der beiden Ampeln (Kontingent / Lärm),
      //               ein Lärm-Anteil allein ist dort nicht ablesbar.
      // Beleg:        Playwright-Trace; Antworten GET area, usage/overview, calculation/assessment.
      const year = new Date().getFullYear();
      const QUANTITY = 120;
      const UNIT = `Fachablauf 1.6 ${Date.now()}`;

      await signInAs('A01');
      const area = (await areasOf(apiAs)).find((a) => a.name === C.name);
      expect(area, `${C.name} fehlt im Demo-Datensatz`).toBeTruthy();
      const base = `/api/admin/area/${area?.id}`;
      expect(await jsonOf<unknown[]>(apiAs.get(`${base}/calculation`)), `${C.name} muss ohne Berechnung sein`).toEqual([]);
      const before = await jsonOf<UsageOverview>(apiAs.get(`${base}/usage/overview?year=${year}`));
      expect(before.usages, `${C.name} muss ${year} ohne Nutzung sein`).toHaveLength(0);
      const combination = before.combinations.find((c) => c.enabled && c.quantityUnit === 'shots');
      expect(combination, `${C.name} braucht eine zulässige Kombination in Schuss`).toBeTruthy();

      let usageId: string | undefined;
      try {
        const created = await apiAs.post(`${base}/usage`, {
          data: {
            roomId: combination?.roomId,
            unit: UNIT,
            date: `${year}-01-08`,
            timeFrom: '08:00',
            timeTo: '10:00',
            usageType: 'military',
            positions: [{ combinationId: combination?.combinationId, quantity: QUANTITY }],
          },
        });
        expect(created.status(), await created.text()).toBe(201);
        usageId = ((await created.json()) as { id: string }).id;

        await signInAs('A03');

        // Server: keine Lärmampel ohne Berechnung – für Hinterrhein und für jeden anderen Platz ohne Berechnung.
        const areas = await areasOf(apiAs);
        const c = areas.find((a) => a.id === area?.id);
        expect(c).toMatchObject({ noiseStatus: 'none', noiseStatusReason: 'no-calculation', noiseStatusBasis: null });
        for (const a of areas) {
          const states = await jsonOf<unknown[]>(apiAs.get(`/api/admin/area/${a.id}/calculation`));
          if (!states.length) expect(a.noiseStatus, `${a.name} hat keine Berechnung, trägt aber eine Lärmampel`).toBe('none');
        }

        // Server: die Nutzung bleibt sichtbar und wird summiert; beurteilt wird nichts.
        const overview = await jsonOf<UsageOverview>(apiAs.get(`${base}/usage/overview?year=${year}`));
        expect(overview.usages.map((u) => u.id)).toEqual([usageId]);
        expect(overview.kpi).toMatchObject({ totalShots: QUANTITY, count: 1 });
        const assessment = await jsonOf<{ calculation: unknown; receivers: unknown[] }>(apiAs.get(`${base}/calculation/assessment`));
        expect(assessment.calculation).toBeNull();
        expect(assessment.receivers).toEqual([]);
        expect((await apiAs.get(`${base}/calculation/simulation`)).status()).toBe(403);

        // Übersicht Schiessplätze: Lärmampel ohne Farbe, mit dem Grund.
        await page.goto('/admin/area');
        const noise = page.locator('[data-testid="area-row"]', { hasText: C.name }).locator('app-status-pill').nth(1).locator('.slim-badge');
        await expect(noise).toHaveText(/Keine (Daten|Berechnungsgrundlage)/);
        await expect(noise).toHaveAttribute('data-reason', 'no-calculation');
        await expect(noise).not.toHaveClass(COLOURED);

        // Kontextleiste und Übersicht des Platzes.
        await page.goto(`/admin/area/${area?.id}/overview`);
        const barNoise = page.locator('.area-ctx__status app-status-pill').nth(1).locator('.slim-badge');
        await expect(barNoise).toHaveText(/Keine (Daten|Berechnungsgrundlage)/);
        await expect(barNoise).not.toHaveClass(COLOURED);
        const summaryNoise = page.locator('[data-testid="summary-light-noise"] .slim-badge');
        await expect(summaryNoise).toHaveAttribute('data-reason', 'no-calculation');
        await expect(summaryNoise).not.toHaveClass(COLOURED);

        // Schusszahlen: die Nutzung steht in der Tabelle und in den Kennzahlen.
        await page.goto(`/admin/area/${area?.id}/shots`);
        const row = page.locator('[data-testid="shots-row"]');
        await expect(row).toHaveCount(1);
        await expect(row).toContainText(UNIT);
        await expect(row.locator('[data-testid="shots-quantity"]')).toContainText(String(QUANTITY));
        await expect(page.locator('[data-testid="shots-kpi-total"]')).toHaveText(String(QUANTITY));
        await expect(page.locator('[data-testid="shots-kpi-count"]')).toHaveText('1');

        // Details: Hinweis statt Beurteilung, keine Empfangspunkte, keine Zähler.
        await page.goto(`/admin/area/${area?.id}/details`);
        await expect(page.locator('.slim-empty__title')).toHaveText('Keine Berechnungsgrundlage');
        await expect(page.locator('[data-testid="details-counts"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="details-pin"]')).toHaveCount(0);

        // Simulation: nichts Erfundenes auf der Seite (das Recht fehlt, siehe 403 oben).
        await page.goto(`/admin/area/${area?.id}/simulation`);
        await expect(page.locator('[data-testid="area-tab-simulation"]')).toBeVisible();
        await expect(page.locator('[data-testid="sim-pin"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="sim-result-row"]')).toHaveCount(0);
      } finally {
        if (usageId) {
          await signInAs('A01');
          await apiAs.post(`${base}/usage/delete`, { data: { ids: [usageId] } });
        }
      }
    },
  );

  test(
    '1.7 Verantwortlicher für Platz A öffnet Platz B per URL und API – serverseitig verweigert',
    { annotation: tags({ actor: 'A02', prio: 1, useCase: '4.10', slm: [6, 8, 35], matrix: '5.9 W/R-O' }) },
    async ({ page, signInAs, apiAs }) => {
      // Ausgangslage: A02 = Geissalp/Thun; Id von Bière bekannt (als A01 gelesen).
      // Aktion:       als A02 alle Area-Routen mit {B} per URL; alle Area-Endpunkte mit {B} per apiAs (GET/POST/PATCH).
      // Soll:         API 403 aus der Regel `area-scope`, ohne Daten von Bière in der Antwort; Liste und Summary ohne B;
      //               UI ohne Datenfragmente (kein Name, keine Nummer von Bière im DOM), keine Seite des Platzes gerendert,
      //               keine erfolgreiche Anfrage mit der Id von B. Gegenprobe: der eigene Platz A antwortet 200.
      // Abweichungen vom ersten Drehbuch (Lauf 02.10.2026):
      //               1. Die Antwort trägt keinen Code `AREA_SCOPE`: der galaxy-RulesGuard gibt nur die Meldung der Regel
      //                  weiter («Not assigned to this Schiessplatz»). Geprüft wird die Meldung; ein maschinenlesbarer Code fehlt.
      //               2. Die Anwendung hat keine 403-Seite. Sie zeigt den Hinweis «Schiessplatz nicht gefunden … oder Sie
      //                  haben keinen Zugriff darauf» (`area-not-found`) und rendert die Seiten des Platzes nicht.
      // Beleg:        Playwright-Trace mit den 403-Antworten.
      await signInAs('A01');
      const all = await areasOf(apiAs);
      const own = all.find((a) => a.name === A.name);
      const foreign = all.find((a) => a.name === B.name);
      expect(own && foreign, `${A.name} und ${B.name} müssen im Demo-Datensatz sein`).toBeTruthy();

      await signInAs('A02');

      // Listen: nur die zugeordneten Plätze.
      const mine = await areasOf(apiAs);
      expect(mine.map((a) => a.name).sort()).toEqual([...(ACTORS.A02.areas ?? [])].sort());
      expect(await jsonOf<{ total: number }>(apiAs.get('/api/admin/area/summary'))).toMatchObject({ total: mine.length });

      // Gegenprobe: der eigene Platz ist erreichbar – die 403 unten kommen nicht aus einer kaputten Sitzung.
      expect((await apiAs.get(`/api/admin/area/${own?.id}`)).status()).toBe(200);
      expect((await apiAs.get(`/api/admin/area/${own?.id}/usage/overview`)).status()).toBe(200);

      // Fremder Platz: jeder Endpunkt mit der Id von B antwortet 403 mit der Meldung der Regel – auch die
      // schreibenden, bevor die Eingabe geprüft wird.
      const b = `/api/admin/area/${foreign?.id}`;
      const dm = `/api/admin/data/area/${foreign?.id}`;
      const scoped: [string, () => Promise<APIResponse>][] = [
        ['GET area', () => apiAs.get(b)],
        ['PATCH area', () => apiAs.patch(b, { data: { name: 'fremd' } })],
        ['GET usage/overview', () => apiAs.get(`${b}/usage/overview`)],
        ['POST usage', () => apiAs.post(`${b}/usage`, { data: {} })],
        ['POST usage/delete', () => apiAs.post(`${b}/usage/delete`, { data: { ids: [] } })],
        ['GET calculation', () => apiAs.get(`${b}/calculation`)],
        ['GET calculation/assessment', () => apiAs.get(`${b}/calculation/assessment`)],
        ['GET calculation/quota', () => apiAs.get(`${b}/calculation/quota`)],
        ['GET calculation/map', () => apiAs.get(`${b}/calculation/map`)],
        ['GET calculation/simulation', () => apiAs.get(`${b}/calculation/simulation`)],
        ['POST calculation/simulation', () => apiAs.post(`${b}/calculation/simulation`, { data: {} })],
        ['GET data/area', () => apiAs.get(dm)],
        ['GET data/area/weapon-assignment', () => apiAs.get(`${dm}/weapon-assignment`)],
      ];
      for (const [name, call] of scoped) {
        const res = await call();
        const body = await res.text();
        expect(res.status(), `${name}: ${body}`).toBe(403);
        expect(body, name).toContain(AREA_SCOPE_MESSAGE);
        expect(body, name).not.toContain(B.name);
      }
      // Berechnungen der Datenverwaltung: A02 hat das Recht gar nicht (Matrix 5.18–5.21 X) – 403, egal aus welchem Grund.
      expect((await apiAs.get(`${dm}/calculations`)).status()).toBe(403);

      // Oberfläche: Adresse mit der Id von B – Hinweis statt Seite, nichts von Bière im DOM, keine Antwort mit Daten.
      const leaked: string[] = [];
      page.on('response', (response) => {
        if (response.url().includes(String(foreign?.id)) && response.url().includes('/api/') && response.status() < 400) {
          leaked.push(`${response.status()} ${response.url()}`);
        }
      });
      const addresses = [
        ...['overview', 'shots', 'details', 'simulation', 'map'].map((p) => `/admin/area/${foreign?.id}/${p}`),
        ...['general/overview', 'general/master-data', 'weapon-assignment', 'calculations/overview'].map(
          (p) => `/admin/data-management/area/${foreign?.id}/${p}`,
        ),
      ];
      for (const address of addresses) {
        await page.goto(address);
        await expect(page.locator('[data-testid="area-not-found"]'), address).toBeVisible();
        await expect(page.locator('[data-testid="area-page"]'), address).toHaveCount(0);
        await expect(page.locator('body'), address).not.toContainText(B.name);
        await expect(page.locator('body'), address).not.toContainText(B.coordinationSectionNo);
      }
      expect(leaked).toEqual([]);
    },
  );

  test.fixme(
    '1.8 Fachseite und API ohne abgeschlossene MFA aufrufen – kein Zugriff vor vollständiger Anmeldung',
    { annotation: tags({ actor: 'T04', prio: 1, slm: [35, 56] }) },
    async () => {
      // Blockiert:    MFA ist in der Demo ausgeschaltet (Entscheid 02.10.2026) und wird über die galaxy-Auth-Bibliothek
      //               eingeschaltet; der Fall läuft erst auf einer Umgebung mit eingeschalteter MFA.
      // Ausgangslage: Konto mit 2FA (E2E_T04_*; MAIL_HOST für den Code, sonst Code aus dem Test-Postfach/DB-Stub –
      //               als Stub ausweisen). Kein storageState.
      // Aktion:       Login mit Passwort → Weiterleitung /auth/two-fa-login; OHNE Code: /admin/area aufrufen,
      //               GET /api/admin/area mit dem Zwischen-Token (falls eines ausgegeben wird) und ohne Token.
      // Soll:         Seite → Login/2FA-Seite (kein Rendering der Fachseite); API 401; erst nach Code → 200.
      //               Logbuch (slm 56): AUTH_LOGIN erst nach dem zweiten Faktor mit Methode «2FA».
      // Ist:          –
      // Beleg:        Trace, Logbuch-Export.
    },
  );
});
