import { FIXTURE_AREAS, tags } from '../support/actors';
import { test } from '../support/test';

/**
 * A05 Applikationsadministrator*in — B1 8.1 (Rolle aus technischer Sicht), 5.26/5.28, slm 1, 27, 35, 56.
 *
 * Kein eigener Anwendungsfall in B1 4.x (readme 1: nicht in den Kontextgrafiken). Aufgaben aus der
 * Matrix: Administration der Applikation (R/W) – erweiterte Konfiguration (Sperrdatum, Handbuch,
 * Ampel-Schwellen und -Farben), Rollen/Apps, Auswahllisten (slm 1). Überall sonst nur R, auch auf
 * Benutzer (5.26 R!) und Nutzungen; Simulation und Berechnungen X.
 *
 * Zwei Punkte aus dem readme gegen die Matrix prüfen, bevor ein Fall echt wird (hier als «Offen»):
 *   – «Konten sperren»: 5.26 ist für A05 nur R; Sperren wäre Administration – Entscheid Auftraggeberin.
 *   – «Platzzuordnungen verwalten»: gehört zu 5.26 (A01 R/W, A02 W/R-O), nicht zu A05.
 * Keine vollständigen Fachrechte unterstellen: A05 ist nicht `slim@demo.ch` (galaxy-Admin).
 *
 * Fixture: `appadmin@demo.ch` (Rolle `slim_admin`).
 * Skelett: alle Fälle `test.fixme` mit Drehbuch; Skelette zählen nicht als bestanden.
 */
const { A, B } = FIXTURE_AREAS;

test.describe('A05 · Administration und erweiterte Konfiguration', () => {
  test.describe('Erweiterte Konfiguration (B1 5.28, slm 27)', () => {
    test.fixme(
      'Sperrdatum der Schusszahlenerfassung setzen – Nutzungen vor dem Datum werden für alle abgewiesen',
      { annotation: tags({ actor: 'A05', slm: [27, 10], matrix: '5.28 R/W' }) },
      async () => {
        // Aktion: signInAs('A05'); /admin/data-management/system → Sperrdatum = 31.12. des Vorjahres → Speichern.
        // Erwartung persistiert: Reload; TenantAppConfig (galaxy) enthält den Wert.
        // Erwartung fachlich (als A01 und A02, zweiter Kontext): Nutzung mit Datum vor dem 01.01. →
        //            UI-Hinweis, POST /api/admin/area/{A}/usage → 4xx; Datum danach → ok. ELO (S01) → 400.
        // Erwartung: bestehende ältere Nutzungen bleiben sichtbar und rechnen weiter (Sperre gilt der Erfassung).
        // Aufräumen: Sperrdatum zurück.
      },
    );

    test.fixme(
      'Benutzerhandbuch (PDF) hochladen – erscheint im Hauptmenü für jede Rolle',
      { annotation: tags({ actor: 'A05', slm: [27, 53], matrix: '5.28 R/W' }) },
      async () => {
        // Aktion: fixtures/handbuch.pdf hochladen → Speichern.
        // Erwartung: Hauptmenü (Hilfe & Kontakt) zeigt «Benutzerhandbuch»; als A03 (T-Kontext) Download 200
        //            mit content-type application/pdf; ohne Sitzung (T01) → 401/Login (readme 3: Downloads).
      },
    );

    test.fixme(
      'Ampel-Schwellenwerte und Farben (Plangenehmigung, Empfangspunkte) ändern – Übersicht und Karte färben neu',
      { annotation: tags({ actor: 'A05', slm: [27, 8, 9], matrix: '5.28 R/W' }) },
      async () => {
        // Vorbedingung: Standard (Kontingent > 125 % rot, > 100 % orange; Lärm > GW rot, > GW−5 orange – c02).
        // Aktion: Schwelle Kontingent «orange ab» 100 % → 80 %; Farbe Rot → anderes Token → Speichern.
        // Erwartung: Übersicht Schiessplätze (als A03) zeigt Geissalp gemäss neuer Schwelle; Karte 5.10
        //            färbt Empfangspunkte gemäss Empfangspunkt-Schwellen; Legende zeigt die neuen Werte.
        // Erwartung: Farben nur aus den Design-Tokens (kein freies Hex) oder – falls frei – Kontrast geprüft (slm 50).
        // Aufräumen: Standard wiederherstellen (sonst kippen c02 und die Ampel-Fälle der anderen Akteure).
      },
    );

    test.fixme(
      'Auswahllistenwerte pflegen: hinzufügen, ändern, inaktivieren (slm 1)',
      { annotation: tags({ actor: 'A05', slm: [1], matrix: 'Administration R/W' }) },
      async () => {
        // Aktion: z. B. zivile Nutzungsart «Anderes» → «Andere Anlässe»; neuer Wert; Wert inaktivieren.
        // Erwartung: Erfassungsdialog (5.11) bietet aktive Werte an, inaktive nicht; bestehende Nutzungen mit
        //            dem inaktiven Wert zeigen ihn weiterhin (keine Datenänderung).
        // Offen: welche Listen konkret pflegbar sind (Nutzungskategorie? Baujahrklasse?) – aus B1 5.3/Auftraggeberin.
      },
    );
  });

  test.describe('Rollen, Apps und Rechteentzug (B1 8.1.2 Administration R/W, slm 35)', () => {
    test.fixme(
      'Rollen bearbeiten: Recht einer Rolle ändern wirkt sofort auf die Benutzer der Rolle',
      { annotation: tags({ actor: 'A05', slm: [35], matrix: 'Administration R/W' }) },
      async () => {
        // Vorbedingung: A02 in zweitem Kontext angemeldet, kann Nutzung auf Platz A bearbeiten.
        // Aktion: als A05 /admin/data-management/roles → Rolle Schiessplatz-Verantwortlicher → App 40 von root
        //         auf read → Speichern (`role-key` bleibt `slim_range_owner`, System-Rolle nicht löschbar).
        // Erwartung: A02 PATCH …/usage/{id} → 403 ohne Neuanmeldung (Server liest Rechte je Request oder
        //            invalidiert die Sitzung – festhalten, welches Konzept gilt); UI zeigt Lese-Modus.
        // Erwartung Logbuch (slm 56): Rollenänderung mit Akteur A05 protokolliert (auth-audit.hooks.ts).
        // Aufräumen: Recht zurück auf root.
      },
    );

    test.fixme(
      '«Nur eigene Schiessplätze» (W/R-O) an einer Rolle ein-/ausschalten',
      { annotation: tags({ actor: 'A05', slm: [35], matrix: 'Administration R/W' }) },
      async () => {
        // Aktion: Rolle Schiessplatz-Verantwortlicher → `role-own-areas` aus → A02 sieht alle 9 Plätze,
        //         GET /api/admin/area/{B} → 200; wieder ein → 2 Plätze, {B} → 403.
        // Aufräumen: Flag wieder setzen.
      },
    );

    test.fixme(
      'Apps (Bereiche) verwalten und System-Rollen schützen',
      { annotation: tags({ actor: 'A05', slm: [35], matrix: 'Administration R/W' }) },
      async () => {
        // Aktion: /admin/data-management/apps → Katalog (API_APPS_MAPPING 40–49 + galaxy 1/2/4) sichtbar;
        //         reine Rechte-Apps (46, 47, 48) ohne Menüeintrag markiert.
        // Negativfall: System-Rolle löschen → abgewiesen (`roles-delete-dialog` nicht angeboten / API 4xx).
      },
    );

    test.fixme(
      'Konto sperren / entsperren und Login-Sperre nach Fehlversuchen (T03) – Zuständigkeit gemäss Matrix klären',
      { annotation: tags({ actor: 'A05', slm: [35, 56], matrix: ['5.26 R', 'Administration R/W'] }) },
      async () => {
        // Offen: Matrix gibt A05 auf Benutzer nur R. Sperren = Administration? Bis zum Entscheid: Fall bei A01
        //        (5.26 R/W) ausführen und hier nur den Negativfall halten: A05 PATCH Benutzer → 403 (falls R).
        // T03-Teil: 5 falsche Passwörter für ein Testkonto → Login gesperrt (Logbuch AUTH_LOGIN_FAILED,
        //           Grund account-locked / too-many-attempts); Entsperren durch die berechtigte Rolle → Login ok.
      },
    );
  });

  test.describe('Lesen, nicht schreiben – Fachbereiche (B1 8.1.2)', () => {
    test.fixme(
      `Nutzungen ${A.name} lesbar, nicht änderbar; Stammdaten, Zuordnung, Waffen, Berechnungen, Benutzer nur lesen`,
      { annotation: tags({ actor: 'A05', slm: [10, 16, 17, 18, 22, 26, 35], matrix: ['5.11 R', '5.16 R', '5.17 R', '5.18–5.21 R', '5.22–5.25 R', '5.26 R'] }) },
      async () => {
        // Erwartung: alle Seiten laden (auch Berechnungen 5.18–5.21 – A05 hat dort R, A02/A03 nicht);
        //            keine Bearbeitung; API: POST/PATCH auf Apps 40, 41, 48, 42, 43, 1 → 403; GET → 200.
        // Erwartung: /admin/data-management/logs (Logbuch, App 49) – Zuständigkeit nicht in der Matrix;
        //            berechtigungen.md ordnet es der Administration zu → als A05 lesbar, als A03 403 (protokollieren).
      },
    );

    test.fixme(
      `keine Simulation, keine Immissionsberechnung – auch nicht auf ${B.name}`,
      { annotation: tags({ actor: 'A05', slm: [12, 35], matrix: ['Simulation X', 'Immissionsberechnung X'] }) },
      async () => {
        // Aktion: /admin/area/{A}/simulation und /{B}/simulation → 403; POST …/calculation/simulation → 403.
        // Hinweis: A05 ist nicht objektbeschränkt (kein W/R-O) – der 403 kommt aus der fehlenden App 46, nicht
        //          aus area-scope; beide Fehlercodes/Meldungen unterscheiden und protokollieren.
      },
    );
  });
});
