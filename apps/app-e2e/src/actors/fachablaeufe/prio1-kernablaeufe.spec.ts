import { FIXTURE_AREAS, tags } from '../support/actors';
import { test } from '../support/test';

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
 * Skelett: alle Fälle `test.fixme`; Skelette zählen nicht als bestanden.
 */
const { S } = FIXTURE_AREAS;

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
      //               unter seiner Relevanzschwelle weglässt) und A7 28.0 (Kernel A7p; A7X summiert 0-dB-Zellen → 28.1).
      //               Die Anwendung muss 14.5 / 28.0 zeigen und der Prüfer muss die Abweichung zum Kernel kennen –
      //               Fachbestätigung E8 der Auftraggeberin ist Voraussetzung für «abgenommen» (Mitwirkung A1.1).
      //               Ampel je Punkt gegen die ES-Grenzwerte der B1.4-Punkte; Vergleich auf ganze dB.
      // Ist:          –
      // Beleg:        Playwright-Trace + GET …/calculation/assessment als JSON im Report.
    },
  );

  test.fixme(
    `1.2 dieselben Nutzungen mit zwei Berechnungsständen auswerten (${S.name}: Z1 57.1 / 38.1 → Z2 51.1 / 32.1, E2 nur in Z2)`,
    { annotation: tags({ actor: 'A01', prio: 1, useCase: '4.7', slm: [11, 43, 44] }) },
    async () => {
      // Ausgangslage: Testplatz S geseedet (fixtures/platz-s.dataset.json), Z1 aktuell, Nutzungen U1–U4 (2026).
      // Aktion:       Details → Zustand Z1 → E1 lesen; Zustand Z2 wählen → E1 und E2 lesen; zurück auf Z1.
      // Soll (platz-s.md Abschnitt 6):
      //               Z1: E1 A9 57.1 (orange, 57 vs IGW 60), A7 38.1 (grün); kein E2.
      //               Z2: E1 A9 51.1 (grün), A7 32.1; E2 A9 57.1 (grün, ES III IGW 65). Delta E1 zu Z1 = −6.0 dB.
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

  test.fixme(
    '1.6 Platz ohne Berechnungsgrundlage öffnen (Interessent) – Nutzungen sichtbar, keine erfundene Lärmampel',
    { annotation: tags({ actor: 'A03', prio: 1, useCase: '4.6', slm: [4, 8, 9] }) },
    async () => {
      // Ausgangslage: Platz C (Hinterrhein, 0 Berechnungen) – zusätzlich eine Nutzung auf C erfassen (als A01), damit
      //               «Nutzungsdaten bleiben sichtbar» prüfbar ist; Demo-Seed heute: 0 Nutzungen auf Hinterrhein.
      // Aktion:       als A03 Übersicht → Hinterrhein → Übersicht/Schusszahlen/Details/Simulation.
      // Soll (slm 4, 5.10): Schusszahlen listen die Nutzung und summieren; Details «keine Berechnungsgrundlage»;
      //               Ampel Lärm = «Keine Daten» (none) in Übersicht, Kontextleiste, Startseite – nicht grün, nicht
      //               «nicht beurteilbar» (das ist O8 und setzt eine Grundlage voraus); Kontingent-Ampel unabhängig davon.
      //               Bekannter Widerspruch im Demo-Seed (validierung-fachlich.md 4): Thun/Bière tragen Seed-Ampeln ohne
      //               Grundlage – für diesen Fall muss die Ampel aus der Berechnung kommen, nicht aus dem Seed.
      // Ist:          –
      // Beleg:        Screenshots + GET summary.
    },
  );

  test.fixme(
    '1.7 Verantwortlicher für Platz A öffnet Platz B per URL und API – serverseitig verweigert',
    { annotation: tags({ actor: 'A02', prio: 1, useCase: '4.10', slm: [6, 8, 35], matrix: '5.9 W/R-O' }) },
    async () => {
      // Ausgangslage: A02 = Geissalp/Thun; Id von Bière bekannt (als A01 gelesen).
      // Aktion:       als A02 alle Area-Routen mit {B} per URL; alle Area-Endpunkte mit {B} per apiAs (GET/POST/PATCH).
      // Soll:         UI 403-Seite ohne Datenfragmente (kein Name/keine KPI von Bière im DOM); API 403 mit Code AREA_SCOPE;
      //               Übersicht/Summary ohne B. Detailliert in a02-platzverantwortlicher/uc-4.10 (Fall «fremder Platz»).
      // Ist:          –
      // Beleg:        Network-Log der 403-Antworten, Screenshot der 403-Seite.
    },
  );

  test.fixme(
    '1.8 Fachseite und API ohne abgeschlossene MFA aufrufen – kein Zugriff vor vollständiger Anmeldung',
    { annotation: tags({ actor: 'T04', prio: 1, slm: [35, 56] }) },
    async () => {
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
