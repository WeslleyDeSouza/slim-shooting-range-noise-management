import { FIXTURE_AREAS, tags } from '../support/actors';
import { test } from '../support/test';

/**
 * A01 Fachspezialist KOMZ Lärm — B1 4.4 «Grundlagen Schiessplatznutzung entgegennehmen».
 *
 * Motivation (B1): die Grundlageninformationen für die Erfassung von Schiessplatz-
 * Nutzungen nach Anhang 7 und 9 LSV sind bereitgestellt. Inhalt: Anlageninformationen
 * erfassen und pflegen, Waffen/Kaliber den Stellungsräumen zuordnen, Schiessplatz-
 * Verantwortliche berechtigen — über die Datenverwaltung (B1 5.14–5.28; das Dokument
 * schreibt «5.13 bei 5.28», 5.13 ist die Simulation) und die initialen Importe (B1 9.2).
 * Mengen: 50–100 Änderungen pro Jahr → kein Lasttest, jede Änderung muss aber
 * persistiert und wieder lesbar sein.
 *
 * Abgrenzung: Berechnungen importieren/verwalten (5.18–5.21, 9.1) ist Anwendungsfall
 * 4.9 und bekommt seine eigene Datei (`uc-4.9-…`); hier wird nur geprüft, dass ein
 * Platz ohne Grundlage keine erfundene Beurteilung zeigt (B1 9.2, letzter Absatz).
 *
 * Rollenmatrix B1 8.1.2 für den Fachspezialisten (Quelle je Fall in `matrix`):
 *   5.14 R · 5.15 R · 5.16 R/W · 5.17 R/W · 5.22–5.25 R/W · 5.26 R/W · 5.28/Administration X.
 *
 * Skelett: jeder Fall ist `test.fixme` mit dem fachlichen Drehbuch (Vorbedingung /
 * Aktion / Erwartung / Negativfall) als Kommentar. Ein Fall wird echt, indem die
 * Schritte durch Assertions ersetzt werden und das `fixme` fällt — Skelette und
 * übersprungene Fälle zählen nicht als bestanden (readme.md, Abschnitt 6).
 *
 * Stand der Seiten (docs/architecture/sitemap.md): 5.14 umgesetzt (`dma-*`),
 * 5.15–5.17, 5.22–5.25, 5.28 Platzhalter, 5.26 aus ELO übernommen (ohne
 * Platzzuordnung im Formular), 9.2 kein Endpunkt. Selektoren der Platzhalterseiten
 * werden beim Umsetzen in `../../support/selectors.ts` ergänzt.
 */
/** Platz A (Geissalp): Grundlagen vorhanden · Platz B (Bière): fremd für A02 · Platz C (Hinterrhein): ohne Grundlage. */
const { A, B, C } = FIXTURE_AREAS;

test.describe('A01 · 4.4 Grundlagen Schiessplatznutzung entgegennehmen', () => {
  // Jeder Fall: `await signInAs('A01')` als erster Schritt; Negativfälle gegen die
  // API mit `apiAs.<verb>(path)` (Bearer der A01-Sitzung), siehe support/test.ts.

  test.describe('Einstieg in die Datenverwaltung (B1 5.7, 5.14)', () => {
    test.fixme(
      'Menü Datenverwaltung zeigt Schiessplatz, Waffen, Benutzer, MGDM Export, Erweiterte Systemeinstellungen',
      { annotation: tags({ actor: 'A01', useCase: '4.4', slm: [5, 13], matrix: '5.14 R' }) },
      async () => {
        // Vorbedingung: Sitzung A01.
        // Aktion: Seitenleiste (Desktop) bzw. Tab «Daten» (Mobile) öffnen.
        // Erwartung: die fünf Einträge aus der Sitemap (Abbildung 18) sind sichtbar und
        //            führen auf APP_ROUTES.admin.dataManagement.* (kein Hard-Coding von /admin/…).
        // Erwartung: «Erweiterte Systemeinstellungen» ist für A01 nicht bedienbar (Matrix X) –
        //            heute statisches Menü, die API antwortet 403 (berechtigungen.md, Abschnitt 5).
      },
    );

    test.fixme(
      'Übersicht Schiessplatz: Suche nach Bezeichnung, Koordinationsabschnitts-Nr. und Sachplan-Nr.',
      { annotation: tags({ actor: 'A01', useCase: '4.4', slm: [13], matrix: '5.14 R' }) },
      async () => {
        // Vorbedingung: Sitzung A01, Demo-Datensatz (9 Schiessplätze).
        // Aktion: /admin/data-management/area/overview öffnen (`dma-search`, `dma-count`, `dma-row-*`).
        // Erwartung: Tabelle mit Koordinationsabschnitts-Nr., Sachplan-Nr., Bezeichnung; sortierbar.
        // Erwartung: Suche «Geissalp» → 1 Zeile; «1104.020» → dieselbe Zeile; «SP-BE-11» → dieselbe Zeile;
        //            «SP-VD-03» → Bière; Plätze ohne Sachplan-Nr. (Gehren, Walenstadt, Bure, Hinterrhein)
        //            zeigen «—» und bleiben über Bezeichnung/Ko-Nr. findbar.
        // Erwartung: Navigation je Zeile → Areal (5.15), Zuordnung Waffen (5.17), Berechnungen (5.18)
        //            (`dma-action-*`, Ziele APP_ROUTES.admin.dataManagement.area.*Of(id)).
      },
    );

    test.fixme(
      'kein «Neuer Schiessplatz» für den Fachspezialisten – Anlegen ist Sache des DB-Administrators',
      { annotation: tags({ actor: 'A01', useCase: '4.4', slm: [13, 36], matrix: '5.14 R' }) },
      async () => {
        // Quelle: B1 5.14 «Genereller Hinweis» – nach dem initialen Import (9.2) keine Funktion
        //         zum Anlegen; im Bedarfsfall durch einen DB-Administrator nach Vorgabe von A01.
        // Erwartung UI: Übersicht zeigt den Hinweis statt einer Schaltfläche (`dma-no-create`).
        // Offen (Entscheid Auftraggeberin, hier nur festhalten): POST /api/admin/area existiert
        //        (AreaCreateDto) und ist mit «root» auf App 40 für A01 erlaubt. Entweder Endpunkt
        //        auf den Seed/DB-Admin beschränken oder den Hinweis in 5.14 als «UI-only» abnehmen.
        //        Bis zum Entscheid: `apiAs.post('/api/admin/area', …)` protokollieren, nicht bewerten.
      },
    );
  });

  test.describe('Anlageninformationen erfassen und pflegen (B1 5.15, 5.16)', () => {
    test.fixme(
      `Allgemein Übersicht ${A.name}: Detailinformationen und Stellungsraum-Tabelle mit Freitextsuche`,
      { annotation: tags({ actor: 'A01', useCase: '4.4', slm: [14, 15], matrix: '5.15 R' }) },
      async () => {
        // Vorbedingung: Sitzung A01, Platz A (Geissalp, 14 Stellungsräume).
        // Aktion: aus 5.14 nach «Areal» springen.
        // Erwartung: Formular (read-only) mit Bezeichnung, Koordinationsabschnitts-Nr. 1104.020,
        //            Sachplan-Nr. SP-BE-11, Aktiv, Gesamtbeurteilung Anhang 7 = nein.
        // Erwartung: Tabelle Stellungsräume: Koordinationsabschnitts-Nr. (z. B. 1104.020.01),
        //            Bezeichnung, Aktiv-Status; 14 Zeilen; Freitext «Neuhaus» filtert auf die
        //            Stellungsräume mit diesem Namen; Stellungsräume ohne Ko-Nr. (B1 5.15 Hinweis)
        //            werden ohne Fehler angezeigt – dafür einen Raum ohne Ko-Nr. im Fixture ergänzen.
      },
    );

    test.fixme(
      `Stammdaten ${B.name} bearbeiten: Kerndaten, Aktiv/Inaktiv, Gesamtbeurteilung nach Anhang 7`,
      { annotation: tags({ actor: 'A01', useCase: '4.4', slm: [16], matrix: '5.16 R/W' }) },
      async () => {
        // Vorbedingung: Sitzung A01, Platz B (Bière) – nicht Platz A, damit die Berechnungsfälle
        //               (4.7/4.9) unverändert bleiben.
        // Aktion: Stammdaten öffnen, Sachplan-Nr. ändern, Platz auf «Inaktiv» setzen, Speichern.
        // Erwartung sichtbar: Erfolgsmeldung, Werte im Formular; nach Reload unverändert.
        // Erwartung persistiert: GET /api/admin/area/{id} liefert die neuen Werte (`enabled: false`).
        // Erwartung fachlich: ein inaktiver Platz ist für die Erfassung von Nutzungen nicht
        //            freigegeben (B1 5.16) → Nutzung erfassen auf Platz B wird abgewiesen
        //            (UI: Schaltfläche/Hinweis; API: POST /api/admin/area/{id}/usage → 4xx).
        // Aktion: Gesamtbeurteilung nach Anhang 7 = ja setzen.
        // Erwartung: Flag persistiert (`annex7Overall`); die Details-Seite (5.12) beurteilt den
        //            Platz nach Anhang 7 statt Anhang 9 (Kontrollwerte B1.4 Annex 7 in c01).
        // Aufräumen: Werte zurücksetzen (Sperre/Flag), sonst kippen die Folgefälle.
        // Hinweis B1 5.16: Ko-Nr. ist nicht bei allen Anlagen vorhanden → eigener Schlüssel
        //         als Zeichenfolge muss erlaubt sein (Validierung nicht auf Muster «NNNN.NNN» festnageln).
      },
    );

    test.fixme(
      'Kontingente gemäss Plangenehmigung je Kombination Waffe/Kaliber pflegen',
      { annotation: tags({ actor: 'A01', useCase: '4.4', slm: [16], matrix: '5.16 R/W' }) },
      async () => {
        // Vorbedingung: Sitzung A01, Platz A; Kontingent «Stgw 90 – 5.6 mm» = 320 000 (Seed).
        // Aktion: Bereich «Kontingente gemäss Plangenehmigung» → Kontingent auf 200 000 ändern, Speichern.
        // Erwartung persistiert: nach Reload 200 000; Entität `area-quota` (Kontingent gilt für den
        //            gesamten Schiessplatz je Kombination, nicht je Stellungsraum – B1 5.16).
        // Erwartung fachlich: statischer Vergleich (5.10) rechnet mit dem neuen Kontingent –
        //            Übersicht Schiessplätze zeigt für Geissalp die Kontingent-Ampel neu
        //            (Regel: > 125 % rot, c02-traffic-lights).
        // Negativfall: Kontingent negativ oder nicht numerisch → Validierungsfehler, nichts gespeichert.
        // Aufräumen: 320 000 wiederherstellen.
      },
    );

    test.fixme(
      'Leserolle: Interessent (A03) und Verantwortlicher (A02) sehen die Stammdaten, ändern sie nicht',
      { annotation: tags({ actor: 'A01', useCase: '4.4', slm: [16, 35], matrix: ['5.16 R (A02)', '5.16 R (A03)'] }) },
      async () => {
        // Gegenprobe zum Schreibrecht von A01 – Fall gehört fachlich zu 4.4 (Berechtigung der Grundlagen).
        // Aktion: als A03 Stammdaten von Platz A öffnen → Formular read-only, kein Speichern;
        //         PATCH /api/admin/area/{A} mit A03-Sitzung → 403.
        // Aktion: als A02 (Platz A zugeordnet) dasselbe → read-only, PATCH → 403 (Matrix 5.16: R).
        // Erwartung: Frontend-Ausblenden allein reicht nicht – der 403 ist der Nachweis.
      },
    );
  });

  test.describe('Waffen-Stammdaten (B1 5.22–5.25)', () => {
    test.fixme(
      'Waffenkategorie anlegen, mehrsprachig bezeichnen, deaktivieren',
      { annotation: tags({ actor: 'A01', useCase: '4.4', slm: [25], matrix: '5.25 R/W' }) },
      async () => {
        // Aktion: /admin/data-management/weapons/weapon-category → «Hinzufügen»: Bezeichnung DE/FR/IT,
        //         Aktiv = ja → Speichern.
        // Erwartung: Zeile in der Tabelle (Bezeichnung + Aktiv-Status), Freitextfilter findet sie,
        //            Export enthält sie; nach Reload vorhanden.
        // Aktion: Aktiv = nein.
        // Erwartung: Kategorie wird in Auswahlfeldern (Waffe 5.24) nicht mehr angeboten, bestehende
        //            Waffen mit dieser Kategorie bleiben lesbar (keine kaskadierende Änderung).
        // Aufräumen: Kategorie löschen; Löschen einer verwendeten Kategorie muss abgewiesen werden.
      },
    );

    test.fixme(
      'Kaliber anlegen mit Bezeichnung DE/FR/IT, ALN-Nr., SAP-Nr., Aktiv-Status',
      { annotation: tags({ actor: 'A01', useCase: '4.4', slm: [23], matrix: '5.23 R/W' }) },
      async () => {
        // Aktion: /admin/data-management/weapons/caliber → «Hinzufügen» → alle Felder → Speichern.
        // Erwartung: Tabelle (Bezeichnung, SAP-Nr., Aktiv), Freitextfilter über SAP-Nr. findet den Eintrag,
        //            Export enthält ihn; nach Reload vorhanden.
        // Negativfall: Pflichtfeld Bezeichnung DE leer → Validierungsfehler; Doppelte SAP-Nr. → Hinweis
        //              (Eindeutigkeit gemäss Entscheid Auftraggeberin, nicht erfinden – als offen markieren).
      },
    );

    test.fixme(
      'Waffe anlegen mit Waffenkategorie und Zuordnung zur Kategorie nach Anhang 7 LSV',
      { annotation: tags({ actor: 'A01', useCase: '4.4', slm: [24], matrix: '5.24 R/W' }) },
      async () => {
        // Aktion: /admin/data-management/weapons/weapon → «Hinzufügen»: Bezeichnung DE/FR/IT, Waffenkategorie,
        //         Waffenkategorie Anh. 7 LSV (a/b/c/…), Aktiv → Speichern.
        // Erwartung: Tabelle zeigt Bezeichnung + Kategorie + Aktiv; nach Reload vorhanden.
        // Fachlich (B1 5.24 Hinweis): Waffe OHNE Anhang-7-Kategorie ist zulässig; Nutzungen mit einer
        //            solchen Waffe werden in der Anhang-7-Berechnung nicht berücksichtigt →
        //            Erwartung in 4.7 (Details Anhang 7) nachziehen, hier nur die Speicherung prüfen.
      },
    );

    test.fixme(
      'Kombination Waffe/Kaliber anlegen, Waffenname für die Erfassung, Zuordnung zur sonARMS-Waffenliste',
      { annotation: tags({ actor: 'A01', useCase: '4.4', slm: [22, 36], matrix: '5.22 R/W' }) },
      async () => {
        // Aktion: /admin/data-management/weapons (Waffe/Kaliber) → «Erstellen»: Bezeichnung DE/FR/IT
        //         (= Waffenname für die Erfassung), Kaliber, Waffe, Waffenkategorie, Aktiv → Speichern.
        // Erwartung: Tabelle (Bezeichnung, Waffe, Kaliber, Kategorie), Filter Kategorie/Waffe/Kaliber,
        //            Export; Detail zeigt «verwendet auf Schiessplätzen» (Ko-Nr., Bezeichnung) = leer.
        // Aktion: Zuordnung zur sonARMS-Waffenliste (Beilage B1.7, 195 Einträge) setzen.
        // Erwartung: sonARMS-ID persistiert; ohne Zuordnung kann die Kombination keiner WLR-/Betriebsdaten-
        //            Quelle zugeordnet werden (B1 5.22, Kap. 7) → Hinweis im Formular.
        // Negativfall: Kombination löschen, die auf einem Stellungsraum zugeordnet ist (5.17) oder in
        //              einer Nutzung vorkommt → abgewiesen; historische Nutzungen bleiben unverändert
        //              (datenmodel-anpassung.md, Abschnitt 4 «Historische Referenzen»).
      },
    );

    test.fixme(
      'Leserolle: A02/A03/A05 sehen die Waffen-Stammdaten, POST/PATCH/DELETE → 403',
      { annotation: tags({ actor: 'A01', useCase: '4.4', slm: [22, 23, 24, 25, 35], matrix: ['5.22–5.25 R (A02)', '5.22–5.25 R (A03)', '5.22–5.25 R (A05)'] }) },
      async () => {
        // Aktion: je Konto anmelden, die vier Seiten öffnen (Tabellen sichtbar, keine Bearbeitung),
        //         danach direkte API-Aufrufe auf App 43 (ADMIN_DATA_WEAPONS) → 403.
      },
    );
  });

  test.describe('Zuordnung Waffen/Kaliber zu Stellungsräumen (B1 5.17)', () => {
    test.fixme(
      'zugeordnete Kombinationen je Stellungsraum lesen und filtern',
      { annotation: tags({ actor: 'A01', useCase: '4.4', slm: [17], matrix: '5.17 R/W' }) },
      async () => {
        // Vorbedingung: Platz A, Stellungsraum «Stellungsrm Mw Neuhaus, B 3» mit Stgw 90 – 5.6 mm (Seed).
        // Aktion: aus 5.14 nach «Zuordnung Waffen» springen; Stellungsraum wählen.
        // Erwartung: obere Tabelle Stellungsräume (Ko-Nr., Bezeichnung, Aktiv) mit Suche nach Ko-Nr.
        //            oder Bezeichnung; untere Tabelle Kombinationen (Waffenname für Erfassung, Waffe,
        //            Kaliber, Kategorie) des gewählten Raums.
      },
    );

    test.fixme(
      'Kombination einem Stellungsraum zuordnen → Erfassung bietet sie an; entfernen → nicht mehr',
      { annotation: tags({ actor: 'A01', useCase: '4.4', slm: [17, 10], matrix: '5.17 R/W' }) },
      async () => {
        // Hinweis B1 5.17: initialer Import, danach wenige Änderungen; Pflege «im Bedarfsfall durch
        //         einen DB-Administrator nach Vorgabe von A01» – die Matrix gibt A01 dennoch R/W.
        //         Testvertrag: UI-Pflege durch A01 gemäss Matrix; Seed-Pflege bleibt Migration (9.2).
        // Aktion: Platz A, Stellungsraum X → Kombination «Pistole 12 – 9 mm» hinzufügen, Speichern.
        // Erwartung persistiert: `room-combination` vorhanden (Reload, GET).
        // Erwartung fachlich: Nutzung erfassen (5.11) auf Stellungsraum X bietet die Kombination an
        //            (nur zulässige Kombinationen – slm 10); ELO GET Anlageninformationen (S01, Kap. 6)
        //            liefert sie ebenfalls → Fall in integrations/elo referenzieren, hier nicht doppeln.
        // Aktion: Zuordnung entfernen.
        // Erwartung: Erfassung bietet sie nicht mehr an; bereits erfasste Nutzungen mit dieser
        //            Kombination bleiben sichtbar und rechnen weiter (keine nachträgliche Entwertung).
        // Negativfall: Kombination zuordnen, die auf «Inaktiv» steht → abgewiesen oder als inaktiv markiert
        //              (Entscheid dokumentieren).
      },
    );

    test.fixme(
      'W/R-O: A02 bearbeitet die Zuordnung nur auf Platz A, Platz B → 403; A03 → kein Zugriff',
      { annotation: tags({ actor: 'A01', useCase: '4.4', slm: [17, 35], matrix: ['5.17 W/R-O (A02)', '5.17 X (A03)'] }) },
      async () => {
        // Aktion: als A02 Zuordnung Platz A ändern → ok; Deep Link auf Platz B → 403 (Regel `area-scope`);
        //         PATCH/POST auf Platz B mit A02-Sitzung → 403.
        // Aktion: als A03 Seite öffnen → 403 / Hinweis; GET mit A03-Sitzung auf App 48 → 403.
      },
    );
  });

  test.describe('Berechtigung von Schiessplatz-Verantwortlichen (B1 5.26, 8.1.2)', () => {
    test.fixme(
      'A01 ordnet einem Verantwortlichen einen Schiessplatz zu – er sieht ihn in Liste, Deep Link und API',
      { annotation: tags({ actor: 'A01', useCase: '4.4', slm: [26, 35], matrix: '5.26 R/W' }) },
      async () => {
        // Vorbedingung: A02 ist Geissalp und Thun zugeordnet (Seed `schiessplatz_benutzer`).
        // Aktion: als A01 /admin/data-management/users → A02 bearbeiten → Platz B (Bière) zuordnen → Speichern.
        //         (Formularfeld «Schiessplätze» fehlt heute – berechtigungen.md, Abschnitt 5; Endpunkt
        //         `admin/user/:id/areas` vorgesehen. Bis dahin bleibt der Fall fixme.)
        // Erwartung: als A02 anmelden → Übersicht zeigt 3 Plätze; Deep Link /admin/area/{B}/shots lädt;
        //            GET /api/admin/area/{B} mit A02-Sitzung → 200.
        // Aktion: Zuordnung wieder entfernen.
        // Erwartung: als A02 (neue Sitzung) → 2 Plätze; Deep Link {B} → 403; GET {B} → 403.
        //            Objektzuordnung nach Rechteänderung gilt für die laufende Sitzung spätestens beim
        //            nächsten Request (Server prüft, nicht der Client).
      },
    );

    test.fixme(
      'A01 verwaltet Benutzer, aber keine Rollen, Apps oder Systemeinstellungen (Administration X)',
      { annotation: tags({ actor: 'A01', useCase: '4.4', slm: [26, 27, 35], matrix: ['5.26 R/W', 'Administration X', '5.28 X'] }) },
      async () => {
        // Aktion: als A01 /admin/data-management/users → Benutzer anlegen (Rolle Schiessplatz-Verantwortlicher,
        //         Platzzuordnung) → Speichern → Benutzer erscheint; Konto sperren → Login schlägt fehl (T03).
        // Aktion: /admin/data-management/roles, /apps, /system öffnen.
        // Erwartung: 403-Seite bzw. Hinweis; direkte API-Aufrufe (roleAdmin*, adminApps*, TenantAppConfig)
        //            mit A01-Sitzung → 403. Sperrdatum (5.28) kann A01 nicht setzen → A05-Fall.
        // Hinweis: A05 (Applikationsadministrator) bekommt für 5.26 nur R – A01 ist der einzige
        //          Fachakteur mit Schreibrecht auf Benutzer; keinen «vollen Admin» unterstellen.
      },
    );
  });

  test.describe('Initialer Datenimport (B1 9.2, slm 36)', () => {
    test.fixme(
      'Stammdaten-Import aus CSV: Schiessplätze, Stellungsräume, Waffen/Kaliber/Kategorien, sonARMS-Liste, Kombinationen, Zuordnungen',
      { annotation: tags({ actor: 'A01', useCase: '4.4', slm: [36], matrix: '5.14 R' }) },
      async () => {
        // Vorbedingung: Fixture `fixtures/stammdaten/*.csv` in der von der Auftraggeberin gelieferten
        //               Struktur (B1 9.2: CSV oder gängiges DB-Format; Referenz Beilage B1.6 Blatt
        //               Areal_Grundlagen mit 126 Plätzen / 766 Stellungsräumen, B1.7 Waffenliste 195 Einträge).
        //               Kein Endpunkt/keine Maske heute – Ausführungspfad (Wizard-Schritt, CLI, Maske)
        //               beim Umsetzen festlegen und hier eintragen.
        // Aktion: Import ausführen (durch A01 bzw. den dafür vorgesehenen Betriebsweg).
        // Erwartung: Mengen stimmen (Plätze, Räume, Waffen, Kaliber, Kategorien, sonARMS-Einträge,
        //            Kombinationen, Zuordnungen Kombination↔sonARMS und Kombination↔Stellungsraum);
        //            Stichprobe: Geissalp 1104.020 mit 14 Räumen, Stgw 90 – 5.6 mm ↔ sonARMS-ID.
        // Erwartung: Wiederholung desselben Imports erzeugt keine Duplikate (idempotent).
        // Negativfall: Stellungsraum mit unbekannter Schiessplatz-Ko-Nr. → Warnung mit Ko-Nr. und Abbruch
        //              des betroffenen Teils (slm 45 sinngemäss), keine Teildaten ohne Bezug.
        // Hinweis: historische Berechnungen/Nutzungen sind nicht Teil des Imports (B1 9.2).
      },
    );

    test.fixme(
      `ohne importierte Berechnungsgrundlage keine Beurteilung – ${C.name} zeigt «keine Daten», nichts Erfundenes`,
      { annotation: tags({ actor: 'A01', useCase: '4.4', slm: [36, 8, 9], matrix: '5.14 R' }) },
      async () => {
        // Quelle: B1 9.2 «Um Berechnungen auf einem Schiessplatz zu vollziehen, muss mindestens eine
        //         Berechnungsgrundlage importiert worden sein.» Import selbst = 4.9.
        // Vorbedingung: Platz C (Hinterrhein): 0 Berechnungen, 0 Nutzungen.
        // Aktion: Übersicht Schiessplätze → Hinterrhein; Details (5.12) öffnen.
        // Erwartung: Ampel Lärm = «Keine Daten» (`none`), Kontingent = «Keine Daten»; Details zeigen
        //            «nicht beurteilbar» statt Pegel; Simulation (5.13) nicht ausführbar mit Hinweis.
        // Erwartung: Startseite zählt Platz C nicht als «zu prüfen»/«überschritten».
        // Erwartung API: GET …/calculation/assessment für C → leeres/«none»-Ergebnis, kein 500.
      },
    );
  });

  test.describe('Persistenz und Nachvollziehbarkeit (Mengen 50–100 Änderungen/Jahr)', () => {
    test.fixme(
      'jede Grundlagenänderung überlebt Reload, Abmelden/Anmelden und ist über die API lesbar',
      { annotation: tags({ actor: 'A01', useCase: '4.4', slm: [16, 17, 22, 26] }) },
      async () => {
        // Sammelfall über die Fälle oben: nach jeder Änderung (Stammdaten, Kontingent, Kombination,
        // Zuordnung, Benutzer) Reload → Wert da; neue Sitzung → Wert da; GET → Wert da.
        // Kein Lasttest (Mengengerüst ist klein); Antwortzeiten der Masken laufen in c11-performance.
        // Offen: ob Grundlagenänderungen im Logbuch (slm 56) erscheinen – B1 verlangt das Logging
        //        für Anmeldungen; Audit der Stammdaten als Wunsch festhalten, nicht als Anforderung testen.
      },
    );
  });
});
