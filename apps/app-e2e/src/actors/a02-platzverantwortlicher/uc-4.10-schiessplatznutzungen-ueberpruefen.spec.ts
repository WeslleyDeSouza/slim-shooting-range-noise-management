import { ACTORS, FIXTURE_AREAS, tags } from '../support/actors';
import { test } from '../support/test';

/**
 * A02 Schiessplatz-Verantwortlicher — B1 4.10 «Schiessplatznutzungen überprüfen»
 * (plus die Leseseite von 4.7 «Einhaltung Belastungsgrenzwerte» für die eigenen Plätze).
 *
 * B1 4.2.4: organisatorisch für einen oder mehrere Schiessplätze verantwortlich, sorgt dafür,
 * dass die Nutzer die Schusszahlen korrekt erfassen, verfolgt die Lärmentwicklung. 4.10:
 * Prüfung und Korrektur erfasster Nutzungen, Simulation der Auswirkungen, Verwaltungs-
 * handlungen, damit Nutzer erfassen können (z. B. zulässige Waffen/Kaliber je Stellungsraum).
 * Mengen: 10–20 Überprüfungen pro Platz und Jahr.
 *
 * Rollenmatrix B1 8.1.2 (W/R-O = nur zugeordnete Schiessplätze, Regel `area-scope`):
 *   5.9–5.12 W/R-O · Immissionsberechnung 5.10 X · Simulation W/R-O · 5.14/5.15/5.16 R ·
 *   5.17 W/R-O · 5.18–5.21 X · 5.22–5.25 R · 5.26 W/R-O · Administration X.
 *
 * Fixture: A02 = `schiessplatz@demo.ch`, zugeordnet Geissalp (Platz A) und Thun; Bière (Platz B)
 * ist fremd. T05 («Verantwortlicher für Platz A, nicht B») ist damit heute dasselbe Konto –
 * die Objekt-Negativfälle stehen hier und werden aus t-identitaeten/ referenziert.
 *
 * Skelett: alle Fälle `test.fixme` mit Drehbuch; Skelette zählen nicht als bestanden.
 */
const { A, B, C } = FIXTURE_AREAS;
const own = ACTORS.A02.areas ?? [];

test.describe('A02 · 4.10 Schiessplatznutzungen überprüfen', () => {
  test.describe('Sichtbarkeit der zugeordneten Plätze (B1 5.8, 5.9, slm 8)', () => {
    test.fixme(
      `Übersicht Schiessplätze zeigt nur ${own.join(' und ')} – Hinweis «Nur berechtigte Schiessplätze» ist echt`,
      { annotation: tags({ actor: 'A02', useCase: '4.10', slm: [7, 8, 35], matrix: '5.9 W/R-O' }) },
      async () => {
        // Aktion: signInAs('A02'); Startseite → Zähler «berechtigte Schiessplätze» = 2; Übersicht öffnen.
        // Erwartung: genau 2 Zeilen (Geissalp, Thun), Suche «Bière» → 0 Zeilen, kein Hinweis auf B.
        // Erwartung API: GET /api/admin/area → 2 Einträge; GET /api/admin/area/summary zählt nur diese.
      },
    );

    test.fixme(
      `fremder Platz ${B.name}: Deep Link → 403, API → 403 (Liste, Deep Link, API – readme 1/A02)`,
      { annotation: tags({ actor: 'A02', useCase: '4.10', slm: [6, 8, 35], matrix: '5.9 W/R-O' }) },
      async () => {
        // Vorbedingung: Id von Platz B als A01 ermittelt (GET /api/admin/area) und zwischengespeichert.
        // Aktion: als A02 /admin/area/{B}/shots, /details, /simulation, /admin/data-management/area/{B}/… aufrufen.
        // Erwartung: 403-Seite (kein leeres Rendering, kein Redirect auf Login); slm 6: Berechtigung
        //            wird beim URL-Aufruf geprüft.
        // Erwartung API (A02-Sitzung): GET/PATCH /api/admin/area/{B}, GET …/{B}/usage/overview,
        //            POST …/{B}/usage, GET …/{B}/calculation/assessment, POST …/{B}/calculation/simulation → 403
        //            (`AREA_SCOPE`, area-scope.rule.ts). Kein 404 – die Existenz darf, der Inhalt darf nicht.
      },
    );

    test.fixme(
      'Objektzuordnung nach Rechteänderung: Entzug von Thun wirkt beim nächsten Request, nicht erst nach Logout',
      { annotation: tags({ actor: 'A02', useCase: '4.10', slm: [26, 35], matrix: '5.26 W/R-O' }) },
      async () => {
        // Vorbedingung: A02 angemeldet, Thun sichtbar. Als A01 (zweiter Kontext) die Zuordnung Thun entfernen
        //               (Endpunkt admin/user/:id/areas – noch offen, berechtigungen.md Abschnitt 5).
        // Erwartung: A02 ohne Neuanmeldung → Übersicht 1 Platz; GET /api/admin/area/{Thun} → 403.
        // Aufräumen: Zuordnung wiederherstellen.
        // Gegenprobe: zusätzliche Rolle ohne `ownAreasOnly` hebt die Einschränkung auf (offenes System,
        //             AreaScopeService.allowedAreaIds → null) – als A01 zuweisen, prüfen, entfernen.
      },
    );
  });

  test.describe('Nutzungen prüfen und korrigieren (B1 5.11, slm 10)', () => {
    test.fixme(
      `Schusszahlen ${A.name}: Filter Default laufendes Jahr, Stellungsraum-Auswahl, Freitext, Erfasser:in`,
      { annotation: tags({ actor: 'A02', useCase: '4.10', slm: [3, 10], matrix: '5.11 W/R-O' }) },
      async () => {
        // Aktion: /admin/area/{A}/shots (`shots-year`, `shots-room`, `shots-search`, `shots-row`).
        // Erwartung: Jahr = laufendes Kalenderjahr; Spalten Stellungsraum, Nutzungseinheit, Zeitraum,
        //            Art der Nutzung, Kategorie, Waffe/Kaliber, Anzahl Schuss, Erfasser:in; Herkunft ELO
        //            als Badge (`shots-src-elo`); Zeilen aus dem Seed (Geissalp: 77 Nutzungen über die Jahre).
        // Erwartung: Stellungsraum wählen filtert die Tabelle; KPI-Summen (`shots-kpi-*`) folgen dem Filter.
        // Erwartung slm 3: Sortierung, Mehrfachselektion (`shots-bulk`), Excel-/CSV-Export vorhanden.
      },
    );

    test.fixme(
      'offensichtlich fehlerhafte Nutzung korrigieren: Anzahl Schuss und Zeitraum ändern, Änderung bleibt',
      { annotation: tags({ actor: 'A02', useCase: '4.10', slm: [10], matrix: '5.11 W/R-O' }) },
      async () => {
        // Aktion: Zeile öffnen (`shots-edit`), Anzahl Schuss 1'000 → 100, Endzeit 12:00 → 11:45, Speichern.
        // Erwartung sichtbar: Toast, Zeile aktualisiert; nach Reload gleich.
        // Erwartung persistiert: GET …/{A}/usage/overview enthält den neuen Wert; PATCH war 200.
        // Erwartung fachlich: Details (5.12) und Ampel (5.9) reagieren auf die geänderte Menge (c02).
        // Negativfall: Endzeit vor Startzeit → Validierung; Zeit nicht im Viertelstundenraster → Validierung;
        //              Datum vor dem Sperrdatum (5.28) → abgewiesen mit Hinweis.
        // Aufräumen: Werte zurück.
      },
    );

    test.fixme(
      'Nutzung neu erfassen mit mehreren Waffen-/Kaliber-Positionen und Dezimalmenge (kg)',
      { annotation: tags({ actor: 'A02', useCase: '4.10', slm: [10, 17], matrix: '5.11 W/R-O' }) },
      async () => {
        // Aktion: `shots-new` → Stellungsraum wählen → nur zulässige Kombinationen des Raums (5.17) im
        //         Auswahlfeld; zwei Positionen (Stgw 90 – 5.6 mm: 240; Sprengstoff: 2.5 kg); Speichern.
        // Erwartung: Nutzung mit 2 Positionen sichtbar, Einheit «Stück» bzw. «kg» je Kaliber, Erfasser:in = A02.
        // Erwartung: Menge bleibt dezimal (kein Runden auf ganze Einheiten – datenmodel-anpassung.md, Abschnitt 4).
        // Negativfall: Kombination, die dem Raum nicht zugeordnet ist, per API senden → 400/422.
      },
    );

    test.fixme(
      'Nutzung löschen und rückgängig machen – nichts geht verloren, Löschen ist «W» (kein separates Recht)',
      { annotation: tags({ actor: 'A02', useCase: '4.10', slm: [10], matrix: '5.11 W/R-O' }) },
      async () => {
        // Aktion: Zeile markieren → `shots-delete` → `shots-delete-confirm` (Dialog; im Test nicht per
        //         window.confirm!) → Toast mit `shots-toast-undo` → Rückgängig.
        // Erwartung: Zeile weg, nach Undo wieder da; API: POST …/usage/delete → 200, POST …/usage/restore → 200
        //            (Löschen als POST, weil «W» das Löschen einer Nutzung einschliesst – berechtigungen.md, 1).
        // Erwartung: Soft-Delete (`deletedAt`) – Zeile bleibt in der Datenbank, Export enthält sie nicht.
      },
    );
  });

  test.describe('Lärmentwicklung verfolgen (B1 4.7 lesend, 5.10, 5.12)', () => {
    test.fixme(
      `Übersicht und Details ${A.name}: Ampel, Kontingentvergleich, Empfangspunkte gegen Grenzwerte`,
      { annotation: tags({ actor: 'A02', useCase: '4.7', slm: [9, 11], matrix: '5.10/5.12 W/R-O' }) },
      async () => {
        // Aktion: /admin/area/{A}/overview und /details (`details-list-item`, `details-calc-select`).
        // Erwartung: aktuell gültiger Zustand vorbelegt («Initiale Aufnahme Areal Geissalp»), Umschalten auf
        //            «Sanierter Zustand» ändert die Pegel (Kontrollwerte in c01: E1 60.8 / 56.4).
        // Erwartung: unvollständige Beurteilung («nicht beurteilbar», O8) wird als solche angezeigt
        //            (`details-incomplete`, `details-count-incomplete`), nicht als «eingehalten».
        // Negativfall: «Berechnung speichern» (App 47) existiert für A02 nicht → Schaltfläche fehlt, Endpunkt 403
        //              (Matrix: Durchführen/Abspeichern von Immissionsberechnungen X).
      },
    );

    test.fixme(
      `${C.name} ohne Berechnungsgrundlage (wäre A02 zugeordnet): Schusszahlen summieren trotzdem, Ampel «Keine Daten»`,
      { annotation: tags({ actor: 'A02', useCase: '4.10', slm: [4, 10], matrix: '5.11 W/R-O' }) },
      async () => {
        // Vorbedingung: A01 ordnet A02 vorübergehend Hinterrhein zu (oder Fixture-Variante mit Zuordnung).
        // Erwartung slm 4: Schusszahlen-Seite baut auf, Erfassen funktioniert, KPIs summieren;
        //            Details/Simulation zeigen «keine Berechnungsgrundlage» ohne Fehlerseite.
        // Aufräumen: Zuordnung entfernen.
      },
    );
  });

  test.describe('Simulation (B1 5.13, slm 12)', () => {
    test.fixme(
      `Simulation ${A.name}: Ist-Werte aus 7.4.5, überschreiben, ausführen, zurücksetzen – nichts wird persistiert`,
      { annotation: tags({ actor: 'A02', useCase: '4.10', slm: [12], matrix: 'Simulation W/R-O' }) },
      async () => {
        // Aktion: /admin/area/{A}/simulation (`sim-row`, `sim-edit`, `sim-run`, `sim-reset`, `sim-state`).
        // Erwartung: Tabelle Stellungsraum × Kombination mit Schuss innerhalb/ausserhalb Werktag (laufendes Jahr);
        //            ×10 auf einer Quelle → +10 dB am nächsten Empfangspunkt (c04); Zurücksetzen = Ist-Werte.
        // Erwartung: nach Reload sind die überschriebenen Werte weg; Nutzungen unverändert (GET overview).
        // Negativfall fremder Platz: POST …/{B}/calculation/simulation → 403.
      },
    );
  });

  test.describe('Verwaltungshandlungen für die Erfassung (B1 4.10, 5.17)', () => {
    test.fixme(
      `Zuordnung Waffen ${A.name} bearbeiten (W/R-O) – ${B.name} 403; Stammdaten und Waffen nur lesen`,
      { annotation: tags({ actor: 'A02', useCase: '4.10', slm: [16, 17, 22], matrix: ['5.17 W/R-O', '5.16 R', '5.22–5.25 R'] }) },
      async () => {
        // Aktion: /admin/data-management/area/{A}/weapon-assignment → Kombination hinzufügen → Speichern → ok;
        //         dieselbe Aktion auf {B} → 403 (UI und API, App 48 + area-scope).
        // Aktion: Stammdaten {A} (5.16) → Formular read-only; PATCH /api/admin/area/{A} → 403 (App 41: read).
        // Aktion: Waffen-Seiten (5.22–5.25) → Tabellen sichtbar, keine Schaltflächen; POST → 403 (App 43: read).
        // Aktion: Berechnungen {A} (5.18–5.21) → 403 (App 42: keine Zeile).
      },
    );

    test.fixme(
      'Benutzer der eigenen Plätze verwalten (5.26 W/R-O) – keine Benutzer fremder Plätze, keine Rollen',
      { annotation: tags({ actor: 'A02', useCase: '4.10', slm: [26, 35], matrix: ['5.26 W/R-O', 'Administration X'] }) },
      async () => {
        // Offen: was «W/R-O» auf Benutzer konkret heisst (Benutzer, die eigenen Plätzen zugeordnet sind?) –
        //        mit der Auftraggeberin klären, bevor der Fall echt wird; heute galaxy App 1 = write ohne Objektfilter.
        // Aktion: /admin/data-management/users → Benutzer für Platz A anlegen → ok; Zuordnung Platz B setzen → abgewiesen.
        // Aktion: /roles, /apps, /system → 403; roleAdmin* API → 403.
      },
    );
  });
});
