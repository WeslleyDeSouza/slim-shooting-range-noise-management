import { FIXTURE_AREAS, tags } from '../support/actors';
import { expect, test } from '../support/test';

/**
 * Präzisierungen aus dem Frageforum (docs/anforderungskatalog/FAQ-Export.md, Stand 02.10.2026),
 * die das Verhalten der Anwendung festlegen. Anders als die übrigen Fachabläufe sind diese
 * Fälle keine Skelette: sie laufen gegen den Demo-Datensatz und räumen hinter sich auf.
 *
 * Soll-Werte stammen aus der FAQ-Antwort bzw. aus der Handrechnung im Kommentar des Falls –
 * nie aus der Anwendung.
 */
const { A } = FIXTURE_AREAS;

/** `ADMIN_DATA_AREA_WEAPONS` (libs/shared/constants, B1 5.17 «Zuordnung Waffen»). */
const APP_WEAPON_ASSIGNMENT = 48;
const ROOM = 'Stellungsrm B 2';
const COMBINATION = 'Stgw 90';
/** Jahr ohne Nutzungen im Demo-Datensatz – der Zeitraum enthält nur die Nutzung dieses Falls. */
const YEAR = 2020;

interface AccessRow {
  appId: number;
  access: string;
}

test.describe('FAQ-Präzisierungen', () => {
  test(
    'FAQ 52 · Zuordnung Waffen 5.17 ist Anzeige: A01 und A02 lesen, A03 hat kein Recht',
    { annotation: tags({ actor: 'A01', prio: 1, useCase: '8.1', slm: [17, 35] }) },
    async ({ page, signInAs, apiAs }) => {
      // Ausgangslage: Rollen-Seed (roles.mock-data.ts), Demo-Konten je Rolle.
      // Aktion:       je Akteur anmelden, GET /api/admin/access lesen (das Recht, nach dem Menü und Masken schalten).
      // Soll (FAQ 52): Die Pflegefunktion im UI entfällt, slm 17 ist eine Anzeige; B1 8.1.2 wird für 5.17
      //               von R/W auf R angepasst. Fachspezialist und Schiessplatz-Verantwortlicher: `read`,
      //               Interessent: kein Recht (X, unverändert).
      const rightOf = async (): Promise<string | undefined> => {
        const res = await apiAs.get('/api/admin/access');
        expect(res.status()).toBe(200);
        return ((await res.json()) as AccessRow[]).find((r) => r.appId === APP_WEAPON_ASSIGNMENT)?.access;
      };

      await signInAs('A01');
      expect(await rightOf()).toBe('read');

      // Die Seite 5.17 bleibt für die lesende Rolle erreichbar und bietet nichts zum Speichern an.
      const areas = (await (await apiAs.get('/api/admin/area')).json()) as { id: string; name: string }[];
      const area = areas.find((a) => a.name === A.name);
      expect(area, `${A.name} fehlt im Demo-Datensatz`).toBeTruthy();
      await page.goto(`/admin/data-management/area/${area?.id}/weapon-assignment`);
      await expect(page).toHaveURL(/\/weapon-assignment$/);
      await expect(page.locator('button[type="submit"]')).toHaveCount(0);

      await signInAs('A02');
      expect(await rightOf()).toBe('read');

      await signInAs('A03');
      expect(await rightOf()).toBeUndefined();
    },
  );

  test(
    `FAQ 19 / 98 · Anhang 7 nach Formelblatt A7X: leiser Empfangspunkt zeigt 28.1, nicht 28.0 (${A.name}, Zeitraum ${YEAR})`,
    { annotation: tags({ actor: 'A01', prio: 1, useCase: '4.7', slm: [33, 34] }) },
    async ({ signInAs, apiAs }) => {
      // Ausgangslage: Geissalp, Stellungsraum «Stellungsrm B 2» mit zulässiger Kombination Stgw 90 (Kategorie a).
      // Aktion:       als A01 einen Zustand importieren (5.19): eine Quelle Stgw90 auf B 2, ein Empfangspunkt,
      //               WLR Tag LAE 60.0 / LAFmax 66.03; eine zivile Nutzung Mo 16.03.2020 08:00–10:15, 100 Schuss;
      //               Beurteilung 5.12 für diesen Zustand und das Jahr 2020 lesen.
      // Soll (Handrechnung, B1 7.6 / Beilage B1.4 Blatt A7X):
      //               Halbtage: 135 min am Vormittag > 2 h → Wh = 1, Sh = 0; M = 100.
      //               Lri(a) = 66.03 + 10·log10(1) + 3·log10(100) − 44 = 28.03
      //               Lr     = 10·log10(10^2.803 + 5·10^0) = 10·log10(635.33 + 5) = 28.064 → Anzeige 28.1
      //               (A7X summiert die fünf leeren Kategorien b–f mit je 0 dB; der Kernel-Ausdruck A7p
      //               liesse sie weg → 28.0. Verbindlich ist A7X, FAQ 19 und 98.)
      //               Anhang 9 derselben Nutzung (innerhalb Werktag): LAE1 = 60 + 10·log10(100) = 80.0,
      //               Lr = 80.0 − 70.5046 + 15 = 24.4954 → 24.5.
      const stamp = Date.now();
      const point = `A7X_${stamp}`;
      const source = `Q_A7X_${stamp}`;

      await signInAs('A01');
      const areas = (await (await apiAs.get('/api/admin/area')).json()) as { id: string; name: string }[];
      const area = areas.find((a) => a.name === A.name);
      expect(area, `${A.name} fehlt im Demo-Datensatz`).toBeTruthy();
      const base = `/api/admin/area/${area?.id}`;

      const overview = (await (await apiAs.get(`${base}/usage/overview?year=${YEAR}`)).json()) as {
        rooms: { id: string; name: string }[];
        combinations: { roomId: string; combinationId: string; entryName: string; annex7Category: string | null }[];
        usages: unknown[];
      };
      expect(overview.usages, `${YEAR} muss im Demo-Datensatz leer sein`).toHaveLength(0);
      const room = overview.rooms.find((r) => r.name === ROOM);
      const combination = overview.combinations.find((c) => c.roomId === room?.id && c.entryName.startsWith(COMBINATION));
      expect(combination?.annex7Category).toBe('a');

      let deliveryId: string | undefined;
      let usageId: string | undefined;
      try {
        const imported = await apiAs.post(`${base}/calculation/import`, {
          data: {
            calculation: { name: `E2E A7X ${stamp}`, supplier: 'Büro E2E', deliveredAt: '2026-10-02', description: 'Playwright, FAQ 19 / 98' },
            state: { externalId: `A7X_${String(stamp).slice(-8)}`, name: `E2E A7X Zustand ${stamp}`, referenceYear: YEAR },
            plantParts: [{ coordinationSectionNo: 'A7X.01', name: 'Anlageteil A7X', type: 'Schiessanlage (300m)', builtAfter1985: false, roomName: ROOM }],
            sources: [
              {
                sourceId: source,
                plantPartNo: 'A7X.01',
                weaponSystem: 'Stgw90',
                a9: { shotsInside: 1000, shotsOutside: 0, year: YEAR },
                a7: { category: 'a', halfDaysWork: 1, halfDaysSunday: 0, shotsWork: 100, year: YEAR },
              },
            ],
            immissionPoints: [{ sonarmsId: point, code: 'A7X', address: 'Testweg 7', sensitivityLevel: 'II', mapX: 20, mapY: 20 }],
            wlr: [{ point, source, timeGroup: 'day', lae: 60, lafmax: 66.03 }],
          },
        });
        expect(imported.status(), await imported.text()).toBe(201);
        const report = (await imported.json()) as { calculationId: string; stateId: string };
        deliveryId = report.calculationId;

        const created = await apiAs.post(`${base}/usage`, {
          data: {
            roomId: room?.id,
            unit: 'Schützenverein E2E',
            date: `${YEAR}-03-16`,
            timeFrom: '08:00',
            timeTo: '10:15',
            usageType: 'civil',
            civilUsageKind: 'other',
            positions: [{ combinationId: combination?.combinationId, quantity: 100 }],
          },
        });
        expect(created.status(), await created.text()).toBe(201);
        usageId = ((await created.json()) as { id: string }).id;

        const res = await apiAs.get(`${base}/calculation/assessment?calculationId=${report.stateId}&years=${YEAR}`);
        expect(res.status(), await res.text()).toBe(200);
        const assessment = (await res.json()) as {
          receivers: { code: string; missingSources: string[]; rows: { annex: number; limitKind: string; applicable: boolean; level: number | null; state: string }[] }[];
        };
        expect(assessment.receivers).toHaveLength(1);
        const [receiver] = assessment.receivers;
        expect(receiver.missingSources).toEqual([]);
        const row = (annex: number) => receiver.rows.find((r) => r.annex === annex && r.limitKind === 'igw');
        expect(row(7)).toMatchObject({ applicable: true, level: 28.1, state: 'ok' });
        expect(row(9)).toMatchObject({ applicable: true, level: 24.5, state: 'ok' });
      } finally {
        if (usageId) await apiAs.post(`${base}/usage/delete`, { data: { ids: [usageId] } });
        if (deliveryId) await apiAs.delete(`/api/admin/data/area/${area?.id}/calculations/delivery/${deliveryId}`);
      }
    },
  );
});
