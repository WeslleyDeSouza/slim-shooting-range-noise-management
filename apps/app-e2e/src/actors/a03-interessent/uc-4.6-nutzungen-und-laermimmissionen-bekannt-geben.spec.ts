import { FIXTURE_AREAS, tags } from '../support/actors';
import { test } from '../support/test';

/**
 * A03 Interessent Schiessplatznutzung und Lärmentwicklung — B1 4.6 «Schiessplatznutzungen
 * und Lärmimmissionen bekannt geben».
 *
 * B1 4.2.2: steht für alle VBS-internen Personen, die Informationen zu Nutzungen und Lärm
 * brauchen (GS VBS, armasuisse Immobilien, Armeestab). 4.6: je Schiessplatz statischer
 * Vergleich mit den genehmigten Kontingenten (MPV) und dynamische Lärmberechnung für das
 * laufende Jahr gegenüber den Grenzwerten. Mengen: mehrmals jährlich je Platz (~120).
 *
 * Rollenmatrix B1 8.1.2 (offenes System, aber der Interessent hat nirgends Schreibrecht):
 *   5.8 R · 5.9–5.12 R · Immissionsberechnung X · Simulation X · 5.14/5.15/5.16 R ·
 *   5.17 X · 5.18–5.21 X · 5.22–5.25 R · 5.26 X · Administration X.
 * Exporte: die Matrix kennt keine Export-Zeile. Tabellen-Export (slm 3) gehört zur jeweiligen
 * Seite und folgt deren Leserecht; Berechnungs-/Schusszahlen-Export (5.20) verlangt Schreibrecht
 * und ist damit X. Nicht aus dem Leserecht ableiten, sondern je Fall so protokollieren.
 *
 * Fixture: `interessent@demo.ch`, keine Platzzuordnung nötig (kein W/R-O).
 * Skelett: alle Fälle `test.fixme` mit Drehbuch; Skelette zählen nicht als bestanden.
 */
const { A, C } = FIXTURE_AREAS;

test.describe('A03 · 4.6 Schiessplatznutzungen und Lärmimmissionen bekannt geben', () => {
  test.describe('Selbständig informieren (B1 5.8–5.10, 5.12)', () => {
    test.fixme(
      'Startseite und Übersicht: alle Schiessplätze mit Ampel Lärm und Kontingent, Filter «Handlungsbedarf»',
      { annotation: tags({ actor: 'A03', useCase: '4.6', slm: [7, 8], matrix: '5.9 R' }) },
      async () => {
        // Aktion: signInAs('A03'); Startseite → KPIs (Eingehalten / Zu prüfen / Überschritten / Keine Daten).
        // Erwartung: Übersicht listet alle 9 Plätze (offenes System, keine Einschränkung), Statusfilter,
        //            Suche nach Bezeichnung und Ko-Nr.; Legende der Ampel.
        // Erwartung: Zeilenklick → Übersicht (5.10); Navigation → Schusszahlen (5.11) lesend.
      },
    );

    test.fixme(
      `statischer Vergleich ${A.name}: Kontingent Plangenehmigung je Kombination gegen Jahressumme`,
      { annotation: tags({ actor: 'A03', useCase: '4.6', slm: [9, 16], matrix: '5.10 R' }) },
      async () => {
        // Aktion: /admin/area/{A}/overview → Bereich Kontingentvergleich.
        // Erwartung: je Kombination Kontingent (Seed: Stgw 90 – 5.6 mm = 320 000), Ist (laufendes Jahr),
        //            Ausschöpfung in %, Ampel (> 125 % rot, > 100 % orange – c02); Summe über den Platz.
        // Erwartung: Werte stimmen mit GET …/usage/overview (Summen) und den Kontingenten (5.16) überein.
      },
    );

    test.fixme(
      `dynamische Lärmbelastung ${A.name}: Details je Empfangspunkt mit Beurteilungspegel vs. Grenzwert`,
      { annotation: tags({ actor: 'A03', useCase: '4.6', slm: [11, 33, 34], matrix: '5.12 R' }) },
      async () => {
        // Aktion: /admin/area/{A}/details → Empfangspunkt E1 wählen (Karte oder Liste, `details-list-item`).
        // Erwartung: Beurteilungspegel Anhang 9 gegen Planungs-/Immissionsgrenzwert nach Baujahr-Regel
        //            (gemischte Baujahre → strengerer Wert, B1 7.7); Delta und Ampel; Reservepunkt ohne
        //            Berechnung wird als «nicht berechnet» gezeigt (E6 im Seed).
        // Erwartung: Zustandswahl (`details-calc-select`) nur zwischen vorhandenen Ständen; laufendes Jahr
        //            als Periode; Werte identisch mit denen, die A01 sieht (kein rollenabhängiges Rechnen).
      },
    );

    test.fixme(
      `${C.name} ohne Grundlage: keine erfundene Ampel, Hinweis statt Pegel`,
      { annotation: tags({ actor: 'A03', useCase: '4.6', slm: [4, 8], matrix: '5.10 R' }) },
      async () => {
        // Erwartung: Übersicht Ampel «Keine Daten»; Übersicht/Details von Hinterrhein bauen auf (slm 4),
        //            zeigen «keine Berechnungsgrundlage»; keine 500 in der Konsole/Network.
      },
    );

    test.fixme(
      'Deep Links auf lesbare Entitäten funktionieren, Sprache/Theme bleiben nach Reload (slm 5/6, 50)',
      { annotation: tags({ actor: 'A03', useCase: '4.6', slm: [5, 6, 50], matrix: '5.9 R' }) },
      async () => {
        // Aktion: URLs aus APP_ROUTES.admin.area.* und dataManagement.area.overview direkt aufrufen.
        // Erwartung: Seite lädt mit Breadcrumbs; FR wählen → Reload → FR; Dark → Reload → Dark.
      },
    );
  });

  test.describe('Lesen in der Datenverwaltung (B1 5.14–5.16, 5.22–5.25)', () => {
    test.fixme(
      'Schiessplatz-Übersicht, Areal und Stammdaten lesbar, Waffen-Stammdaten lesbar – alles ohne Bearbeitung',
      { annotation: tags({ actor: 'A03', useCase: '4.6', slm: [13, 14, 16, 22], matrix: ['5.14 R', '5.15 R', '5.16 R', '5.22–5.25 R'] }) },
      async () => {
        // Erwartung: Seiten laden; Formulare read-only; keine Schaltflächen Speichern/Löschen/Hinzufügen
        //            (heute statisch → mindestens API: PATCH /api/admin/area/{A} → 403, POST Waffen → 403).
        // Erwartung: Tabellen-Export (slm 3) auf diesen Seiten erlaubt – ist Teil des Leserechts; protokollieren.
      },
    );
  });

  test.describe('Verweigerte Aktionen – serverseitig (B1 8.1.2)', () => {
    test.fixme(
      'keine Nutzung erfassen, ändern oder löschen: UI ohne Schaltflächen, API → 403',
      { annotation: tags({ actor: 'A03', useCase: '4.6', slm: [10, 35], matrix: '5.11 R' }) },
      async () => {
        // Aktion: /admin/area/{A}/shots → `shots-new`, `shots-edit`, `shots-delete` nicht vorhanden (CASL offen);
        //         apiAs.post('/api/admin/area/{A}/usage', …) → 403; patch → 403; post …/usage/delete → 403.
        // Erwartung: Lesen (`GET …/usage/overview`) → 200 – der Unterschied zwischen R und W ist der Nachweis.
      },
    );

    test.fixme(
      'keine Simulation, keine Immissionsberechnung speichern (Matrix X, nicht aus dem Leserecht ableiten)',
      { annotation: tags({ actor: 'A03', useCase: '4.6', slm: [12, 35], matrix: ['Simulation X', 'Immissionsberechnung X'] }) },
      async () => {
        // Aktion: /admin/area/{A}/simulation → 403/Hinweis; GET+POST …/calculation/simulation → 403 (App 46 fehlt).
        // Aktion: App 47 (Berechnung speichern) → 403.
      },
    );

    test.fixme(
      'keine Zuordnung Waffen, keine Berechnungen, keine Benutzer, keine Administration, kein Berechnungs-Export',
      { annotation: tags({ actor: 'A03', useCase: '4.6', slm: [17, 18, 20, 26, 35], matrix: ['5.17 X', '5.18–5.21 X', '5.26 X', 'Administration X'] }) },
      async () => {
        // Aktion: die Routen /admin/data-management/area/{A}/weapon-assignment, …/calculations,
        //         /admin/data-management/users, /roles, /apps, /system, /mgdm-export aufrufen.
        // Erwartung: 403-Seite; API der Apps 48, 42, 1, 2, 4, 45, 44 mit A03-Sitzung → 403.
        // Erwartung: Export 5.20 (GeoDB/CSV) nicht erreichbar – als «X gemäss Schreibrecht 5.20» protokollieren.
      },
    );
  });
});
