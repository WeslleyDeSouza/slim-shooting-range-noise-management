# Umsetzungsstand Prototyp SLIM

**Stand:** 12.09.2026, nachmittags · **Zweck:** Grundlage für die nächste Sitzung – was läuft, was fehlt,
was zu entscheiden ist. Lesehilfe zu den Beilagen: [index.md](index.md); Roadmap:
[../projects/prototyp-roadmap.md](../projects/prototyp-roadmap.md).

## 1. Kurzfassung

Der Kernablauf des Fachkonzepts ist im Prototyp durchgängig lauffähig – für den Demo-Schiessplatz
**1104.020 Geissalp**:

```
Nutzungen erfassen (5.11)  →  Betriebsdaten (7.4)  →  Beurteilungspegel Anhang 9/7 (7.6)
      →  Grenzwertvergleich und Ampel (7.7, 5.10)  →  Details je Empfangspunkt (5.12)
      →  Simulation «was wäre wenn» (5.13)
```

Die Berechnung folgt den Formeln aus Beilage B1.4 und reproduziert deren Kontrollwerte
(alle 12 Empfangspunkte, Anhang 9 und 7). Alles ist mandantenfähig, mehrsprachig (DE/FR/IT/EN),
mobile first, hinter dem galaxy-Login (MFA-fähig) und per Setup-Wizard installierbar.

**Neu seit 11.09.:** Das Datenmodell entspricht jetzt B1 Kap. 10 (Muss-Anforderung, Abb. 43) – übergeordnete
Referenzstruktur, zustandsunabhängige Nutzungen mit n Positionen, Zustandsebene mit Quelldaten/WLR je Zeitgruppe,
FGDB-Import mit Abbruch nach `slm 45`, Zeiger «aktuell»/«MGDM», gespeicherter Berechnungslauf, Ampeln als Cache
aus der Berechnung; Kernel-Korrekturen (Halbtag-Grenze 12:00, Alarmwerte Anhang 9, Feiertage) und der Nachweis
der Rechenfälle durch die Kette ([nachweis-rechenfaelle.md](nachweis-rechenfaelle.md)). Willkommensbanner der Demo.

> **Nach dem Update lokal:** Das Schema hat sich geändert (neue Tabellen, deutsche Spalten in der Zustandsebene). Bei einer bestehenden
> SQLite-Entwicklungsdatenbank die API stoppen, `local.database.sqlite` löschen und neu starten – der Seed baut
> den Demo-Datensatz wieder auf. Sonst meldet TypeORM beim Start
> `SQLITE_CONSTRAINT: NOT NULL constraint failed: temporary_…` (Sync gegen das alte Schema).

## 2. Umgesetzt (verifiziert durch Tests)

| Bereich | Was läuft | Nachweis |
|---|---|---|
| Anmeldung, Mandant, Rollen | Login, 2FA, Mandantenwahl, Passwort zurücksetzen, App-Katalog + Admin-Rolle (`API_APPS_MAPPING`) | e2e `auth.spec`, `login.spec`; Setup-Schritte 09/10 |
| Startseite, Übersicht Schiessplätze (5.8/5.9) | Kacheln mit Kennzahlen, Tabelle mit Kontingent- und Lärm-Ampel, Suche, Filter «Handlungsbedarf» | e2e `admin.spec` |
| Schiessplatz-Kontext | Kontextleiste mit Zurück, Schiessplatz-Wechsler, Ampeln, Reiter Übersicht · Schusszahlen · Details · Simulation | `views/admin/area/_context` |
| Menü | Sidebar/Tabbar mit den Gruppen Arbeitsbereich, Datenverwaltung, **Benutzerverwaltung** (Benutzer, Rollen, Apps) | `views/admin/_layout` |
| **Schusszahlen (5.11)** | Stellungsräume mit Zählern, Nutzungstabelle (Filter Jahr/Datum/Freitext/Nutzung/Kategorie, Sortierung, Gruppierung, Mehrfachauswahl), Erfassen/Bearbeiten im Drawer: **n Positionen** (Kombination Waffe/Kaliber + Menge, Einheit aus dem Kaliber, nur zulässige Kombinationen des Stellungsraums), Viertelstundenraster, Personenzahl, Art der zivilen Nutzung (Pflicht bei Zivil), Löschen mit «Rückgängig», ELO-Kennzeichnung, Idempotenz über `externalId` | API `usage.service.spec` (10 Tests), Jest + e2e `area-shots.spec` |
| **Lärmberechnung (7.4–7.7)** | `@slim/lsv`: GEMW/ESM, Anhang 9 (LAE1/LAE2/Lr), Anhang 7 (Li/Lri/Lr, Halbtage mit **Grenze 12:00**, B1 7.4.3), Werktag-Split Mo–Fr 07–19 Uhr, Feiertage ganz/halb aus `feiertag`, Grenzwerte je Empfindlichkeitsstufe (**Alarmwerte Anhang 9 korrigiert**: ES III 70, ES IV 75), Baujahr-Regel (IGW/PW/gemischt, je Anlageteil des Zustands), Ampel-Regeln (Lärm −5 dB, Kontingent 125 %, Soll 0) | Unit-Tests gegen B1.4 (`libs/shared/lsv`), Rechenfälle Testplatz S (`rechenfaelle.spec`, 25); [laermberechnung.md](../architecture/laermberechnung.md), [nachweis-rechenfaelle.md](nachweis-rechenfaelle.md) |
| **Details Empfangspunkte (5.12)** | Beurteilung je Immissionspunkt: 4 Zeilen (Anh. 9 IGW/PW, Anh. 7 IGW/PW) mit Pegel, Reserve, Ampel; schematische Karte mit Pins, Listenansicht, Wechsel der Berechnungsgrundlage mit Abweichung zum aktuellen Zustand (Vergleich über sonARMS-ID), Betrachtungszeitraum bzw. repräsentative Jahre (`years=`), Typ Fassade/Freifeld/Baulinie | API `assessment.service.spec` (17 Tests), Jest + e2e `area-details.spec` |
| **Simulation (5.13)** | Tabelle Stellungsraum × Kombination mit «innerhalb/ausserhalb Werktag» (aus den Nutzungen des Jahres, Mengen mit 3 Dezimalen), Werte überschreiben, Schnellfaktoren, Berechnung nach Anhang 9 über dieselbe Verteilung 7.5, Resultat je Immissionspunkt mit Differenz und Ampelwechsel, Karte mit Ist-Schatten | API `simulation.service.spec` (×10 = +10 dB, Abend +5 dB, …), Jest + e2e `area-simulation.spec` |
| **Datenmodell B1 Kap. 10 (Muss)** | Drei Ebenen wie Abb. 43: **übergeordnet** `schiessplatz`, `stellungsraum`, `waffe`/`kaliber`/`waffenkategorie`, `waffe_kaliber_kombination`, `stellungsraum_kombination`, `kontingent`, `feiertag`; **Nutzungen** `nutzung` + `nutzung_position` ohne Zustandsbezug (`slm 44`); **Zustandsebene** `immissionsberechnung` → `zustand` → `zustand_anlageteil` (→ Stellungsraum, Baujahr je Zustand), `schusslinie` + `quelldaten_anhang9/7` (optional je Quelle), `untersuchungsperimeter`, `ausbreitungsberechnung`, `gebaeude`, `immissionspunkt`, `wlr_pegel` je Zeitgruppe, `isophonen`, `betroffene_analyse`, `hindernis`, `hochblende`, `schuetzenhaus`, `massnahmen_*`; `berechnungslauf`. Deutsche Tabellen; deutsche Spalten in der Zustandsebene und im Berechnungslauf, Referenzstruktur und Nutzungen noch mit englischen Spalten (B1 12.2, siehe unten). Zustandskonsistenz per Composite-FK `(tenantId, zustand_id, …)` – keine Verknüpfung über Zustände oder Schiessplätze hinweg; «genau ein aktueller / MGDM-Zustand» als Unique-Index (`aktuell_schluessel`/`mgdm_schluessel`). Geometrien im Prototyp als Text (SQLite), Ziel PostGIS. ERD automatisch (`docs/architecture/uml.mmd`, `/erd`) | `state-isolation.spec` (10 Tests: zwei Zustände mit gleichen externen IDs, unterschiedlicher Geometrie/Pegel, Änderung am neuen lässt alten Zustand und gespeicherten Lauf unverändert), [datenstruktur.md](../architecture/datenstruktur.md), [validierung-fachlich.md](validierung-fachlich.md) §7 |
| **Import Berechnungsgrundlage (5.19, `slm 45`)** | `POST admin/area/:areaId/calculation/import` (`ImportService`, Rolle Datenverwaltung Berechnungen): Staging-Prüfungen, unbekannter Stellungsraum oder doppelter Anlageteil → `ImportAbortedException` mit Befunden, **nichts wird geschrieben**; eine Transaktion; Quellen werden über die sonARMS-ID mit den Kombinationen verknüpft (Warnung bei fehlender Zuordnung); Seed und Tests laufen über denselben Import | `state-isolation.spec`, `import.service` (Seed) |
| **Zeiger aktuell / MGDM (5.18)** | `PATCH …/calculation/:stateId/pointer` setzt je Schiessplatz genau einen aktuellen bzw. MGDM-Zustand (DB-Regel), Ampeln werden danach neu berechnet | `calculation.service`, `state-isolation.spec` |
| **Berechnungslauf** | `POST/GET …/calculation/run`: eingefrorener Lauf mit Zeitraum/Jahren, Kopie der Nutzungen, Referenz-Snapshot (Feiertage, Zuordnungen, Kontingente, Fachentscheide), Parametern, `kern_version`, Vollständigkeit (O8), Ergebnis und Prüfsumme – spätere Änderungen an Nutzungen oder Zuständen verändern den Lauf nicht | `calculation-run.service`, `state-isolation.spec` |
| **Ampeln aus der Berechnung, mit Grund** | `AreaStatusService`: `quotaStatus`/`noiseStatus` der Übersicht sind ein Cache aus Nutzungen, Kontingenten und Beurteilung des **als «aktuell» markierten** Zustands, nach Mutation/Import/Zeigerwechsel und beim Start neu gesetzt; über die API nicht schreibbar. Jede Ampel trägt ihren Grund (`quotaStatusReason`/`noiseStatusReason`): `no-calculation` (kein aktueller Zustand), `no-usages` (keine Nutzungen im Jahr und den zwei Vorjahren → grau, **nie grün als Vorgabe**), `no-quota` (beschossene Kombination ohne Kontingent → Soll 0 nach B1 5.10, Ampel bleibt berechnet rot); dazu `noiseStatusBasis` (Zustand) und `statusYear`. UI: «Keine Berechnungsgrundlage» / «Keine Nutzungen erfasst» statt «Keine Daten», Tooltip mit Regel, Grund und Grundlage | `area-status.service.spec` (6 Fälle: kein Kontingent, eine Kombination ohne Kontingent, Kontingent 0, Nutzung nur im Vorjahr → Dreijahresmittel, keine Nutzungen, kein aktueller Zustand), `area.service.spec`, Jest `status-pill.component.spec` |
| Demo-Datensatz v5 | `tenant.mock.json` (llumi-Muster): 9 Schiessplätze, Waffenliste B1.7 als Stammdaten, Geissalp mit 14 Stellungsräumen, zulässigen Kombinationen, Kontingenten, Feiertagskalender, 2 Zuständen (initial 2019 = aktuell, saniert 2025) mit Anlageteilen, Schusslinien + Quelldaten (inkl. Sprengladung), 6 Immissionspunkten, WLR je Zeitgruppe; Nutzungen mit Positionen, jährlich rollend; Zustände werden über den Import geschrieben | `tenant-dataset.spec`, Generator tunt die Pegel mit demselben Kalender |
| API-Client, Doku | Angular-Client und Modelle werden bei jedem API-Start aus Swagger generiert; Swagger UI `/api/docs` | `libs/app/generated` |
| Benutzerverwaltung (5.26, 8.1) | Benutzer/Rollen/Apps-Masken aus ELO über die galaxy-Admin-API; vier SLIM-Rollen mit der Rechte-Matrix 8.1.2 als Seed (ein Demo-Konto je Rolle); Guards prüfen R/W/X pro Bereich; «W/R-O» über galaxy Rules (`area-scope`) + `schiessplatz_benutzer`; 2FA vorhanden (erfüllt «MFA oder AGOV») | API `area-scope.spec` (6 Tests); [berechtigungen.md](../architecture/berechtigungen.md) |
| Verteilung auf Quellen / Fachregel O8 (B1 7.5, `slm 32`, Review T02) | Gewichte aus den **Quelldaten des Zustands** (Anhang 9: Zahl × Halbtage, Anhang 7 je Kategorie), `distributeShots` im Kern: Verweigern als Standard bei Σ Gewichte = 0, Ersatzregel Gleichverteilung nur mit dokumentierter Freigabe (`release`); Gründe `no-source` / `zero-weights` / `no-level` durchgängig bis zur Anzeige; Ampel-Status `incomplete` = «nicht beurteilbar» (keine Farbe, Teilpegel sichtbar, `missingSources`, Zähler, Legende, Pin-Schraffur, Prüfhinweis in der Detailmaske), auch im Berechnungslauf und in der Übersichts-Ampel | `distribution.spec`, `traffic-light.spec`, `assessment.service.spec` (O8), `rechenfaelle.spec` Fall 0/7 |
| Rundungsregel Grenzwertvergleich (B1.2 10.4) | `noiseState` vergleicht den auf ganze dB gerundeten Pegel (60.4 → 60 eingehalten, 60.5 → 61 überschritten), Modus konfigurierbar; Anzeige weiterhin mit einer Dezimale | `traffic-light.spec` (60.4/60.5, 55.4/55.5, Grenzfälle) |
| Metamorphe Tests je Anhang | Anhang 9: ×10 Schuss = +10 dB; Anhang 7: ×10 Schuss bei gleichen Halbtagen = +3 dB (3·log M) | `annex9.spec`, `annex7.spec` |
| Dezimalmengen (B1 6.2/11.2.3) | `nutzung_position.quantity` DECIMAL(12,3) + `quantityUnit` aus dem Kaliber (Stück/kg); DTO-Validierung 3 Dezimalen; Werktag-Split und Jahresmittel ohne vorzeitige Rundung; Formular mit Einheit und Schrittweite 0.001 | `operating-data.spec`, `usage.service.spec`, `rechenfaelle.spec` Fall 6 |
| Hierarchie Immissionsberechnung → Zustand (B1 5.18) | Neue Entity `immissionsberechnung` (Bezeichnung, Lieferantin, Lieferdatum) mit 1:n Zuständen; `CalculationDto` trägt `calculationId`/`calculationName`; Seed legt je Zustand eine Lieferung an (`calculation`-Feld im Datensatz gruppiert) | `calculation.service`, ERD `uml.mmd` |
| Deutsche Datenbankobjekte (B1 12.2, `slm 51`) | Alle physischen Tabellen deutsch. Spalten deutsch in der **Zustandsebene** (`modules/calculation`: `zustand_id`, `quellen_id`, `zeitgruppe`, `koord_nr`, …) und im `berechnungslauf` über `DbPlatformColumn({ name })`; die Spalten von `schiessplatz`, `stellungsraum`, `waffe`/`kaliber`/Kombinationen, `kontingent`, `feiertag`, `nutzung`, `nutzung_position` sind **noch englisch** (nächster Schritt, gleiches Muster). Klassen/Properties im Code bleiben englisch | ERD, `datenstruktur.md` |
| PostgreSQL/PostGIS | `docker-compose` Service `app-postgis` (17-3.5), `.env.example`-Block, Roh-SQL treiberneutral (`rawQuery`, `$n`-Platzhalter). **Blockiert** durch `@app-galaxy/*`: `DbPlatformColumn`/`DbAuthAwareColumn` mappen MySQL-Typen nicht für Postgres (`double`, `datetime`, `longtext` → «Data type "double" … not supported by "postgres"»). Nötige Bibliotheksänderung: Postgres-Map `double → double precision, datetime → timestamp, longtext → text, tinyint → smallint` in beiden Helpern | Boot-Test gegen `postgis/postgis:17-3.5` am 11.09.2026 |
| GDAL-Roundtrip B1.2 | **Offen**: Beilage B1.2 (FGDB-Schema) liegt nicht im Repo und GDAL ist lokal nicht installiert; Vorschlag: `ghcr.io/osgeo/gdal`-Container + Beispiel-FGDB der Auftraggeberin | – |
| Nutzungskategorien (B1 Tabelle 2) und Feiertage | `USAGE_TYPE` = Militär, Zivil, Blaulicht, SAT; Anhang 9 rechnet alle Kategorien, Anhang 7 Zivil + SAT (`countsForAnnex7`, alle bei «Gesamtbeurteilung»); Feiertage je Schiessplatz ganz oder halb aus der Tabelle `feiertag` (`{ date, from/to }`) in `splitAnnex9` / `annex7HalfDays` – durchgängig von der Datenbank bis in den Kern | `libs/shared/lsv` (`operating-data.spec`), `rechenfaelle.spec` Fall 3 |
| Datenverwaltung › Schiessplatz › Übersicht 5.14 (`slm 13`) | Mock `_mocks/data-management/area.index.html` umgesetzt: Suche über Bezeichnung, Koordinationsabschnitt- und Sachplan-Nr., sortierbare Spalten, Aktiv-Badge, Absprünge Allgemein / Zuordnung Waffen / Berechnungen je Zeile (Ziel-Routen `…/area/:areaId/…`, heute Platzhalter); kein «Neuer Schiessplatz» | `views/admin/data-management/area/dm-area-overview` |
| Login-Logging / Logbuch (`slm 56`) | Logbuch `logbuch` aus ELO übernommen, Maske «Logbuch» unter Datenverwaltung mit Filtern und XLSX-Export; mit `@app-galaxy/auth-api` 0.1.218 alle Auth-Ereignisse über Hooks: Login (Methode), fehlgeschlagener Login (Grund), Logout, Token-Wiederverwendung, Passwort-Reset/-Änderung, E-Mail-Verifikation | API `client-ip.spec`, `auth-audit.hooks.spec`; `views/admin/logs` |
| Übersicht Schiessplätze (5.9), Rückmeldung 12.09. | Getrennte Filter «Kontingent» und «Lärmbelastung» plus Schalter «Nur Handlungsbedarf» (statt «Status: Alle»); Erklärung zur Jahresauswahl; Tooltips und zugängliche Namen der vier Aktionen; Platzname öffnet die Beurteilung (Details); Legende mit Erklärung je Ampel; Logbuch-Eintrag `READ` beim Öffnen eines Schiessplatzes | `views/admin/area/area-overview.component.ts`, `admin-area.controller.ts` |
| Schiessplätze verwalten (5.14), Rückmeldung 12.09. | Titel «Schiessplätze verwalten» (klar getrennt von der fachlichen Übersicht), Untertitel ohne «abspringen», kurzer Hinweis «Neue Schiessplätze werden durch die Datenbankadministration angelegt» unter dem Titel (kein Import legt Schiessplätze an, `slm 45`), Spalten Bezeichnung → Koordinationsabschnitt-Nr. → Sachplan-Nr., Spalte «Aktionen» mit beschrifteten Schaltflächen Allgemein / Waffen-Zuordnung / Berechnungen (Tooltip + `aria-label`), Filter Aktive / Inaktive / Alle | `views/admin/data-management/area/dm-area-overview.component.ts` |
| Shell: Sidebar, Menü nach Rechten, Demo-Kennzeichen | Marke (Logo, SLIM, Untertitel) oben in der Sidebar auf Topbar-Höhe, in der Topbar nur auf Telefonbreite; dauerhaftes «Demo»-Badge neben SLIM; kompakte Sidebar mit einklappbaren Gruppen (Zustand je Browser gemerkt): **Arbeitsbereich** (Startseite, Lesezeichen = mit Stern markierte Schiessplätze), **Schiessplätze** (Übersicht aller, Auswahl mit Autocomplete → Übersicht / Schusszahlen / Details / Simulation des gewählten Platzes, folgt der aktuellen Route), **Datenverwaltung**, **Benutzerverwaltung**; Menüeinträge nur mit App-Recht (`AccessFacade` über `GET admin/apps/app/user/:userId`, `SLIM_APP_ID`/`GALAXY_APP_ID` in `@slim/shared`; «Apps» nur Applikationsadministrator*in). Lesezeichen und Gruppen liegen im `localStorage` (Demo), Ziel: galaxy-Benutzereinstellungen | `views/admin/_layout/admin-layout.component.ts`, `core/access/access.facade.ts` |
| Willkommensbanner Demo | Nach jeder Anmeldung auf der Startseite: Banner 950 × 250 (`assets/images/header_welcome.png`), «Demoversion», Einordnung von SLIM, Hinweis Prototyp + Disclaimer («keine freigegebenen fachlichen Beurteilungen»), «Demo starten →» öffnet direkt die Schusszahlen von 1104.020 Geissalp; «Später» schliesst. Bewusst nur je Browser-Sitzung gemerkt (`sessionStorage`), **noch nicht** in den galaxy-Benutzereinstellungen | `views/admin/home/welcome-dialog.component.ts`, e2e `admin.spec` |
| Setup-Wizard | `npm run setup`: 12 Schritte (Toolchain, .env, Registry, Abhängigkeiten, DB SQLite/MariaDB/MySQL/PostgreSQL, Workspace, API, Frontend, Login, Rechte, Demo-Daten, e2e) | live durchgespielt, 12/12 grün |
| Architektur-Doku (A2) | Gesamtarchitektur, Deployment/Sicherheit, UI-Ansichten – nur Ist-Zustand | [gesamtarchitektur.md](../architecture/gesamtarchitektur.md), [deployment-sicherheit.md](../architecture/deployment-sicherheit.md), [ui-ansichten.md](../architecture/ui-ansichten.md) |
| Lösungskonzept (C2) v0.2 | Entwurf v0.1 auf den Prototyp-Stand gebracht: Ist-Skizzen (Gesamtarchitektur, Datenmodell, Berechtigungskette, Deployment, Berechnungsfluss) und Screenshots eingebettet, Zielzustand verbindlich, Prototyp-Belege je Kapitel, Matrix mit Status P/Z/O; Seitenbudget A2 (15 + 2, Summary ½ Seite) eingehalten | [C2-Loesungskonzept-SLIM.md](C2-Loesungskonzept-SLIM.md) → `npm run docs:docx -- docs/anforderungskatalog/C2-Loesungskonzept-SLIM.md --pages` erzeugt die `.docx` und meldet die Seitenzahl je Kapitel |

Testbilanz (12.09.2026, je Kategorie, nicht summiert):

| Kategorie | Stand |
|---|---|
| API Vitest (`npx nx test api`, 24 Dateien) | **246 bestanden** – Kern `@slim/lsv` gegen B1.4, Rechenfälle Testplatz S (25), Zustandsisolation (10), Assessment (17), Ampeln mit Grund (6), Simulation, Nutzungen (10), Berechtigungen, Logbuch, Datensatz |
| Angular Jest (`npx nx test app`, 10 Suiten) | **67 bestanden** |
| Playwright Seiten-Suite (`npx nx e2e app-e2e`) | 34 Fälle (Auth, Admin inkl. Willkommensbanner, drei Schiessplatz-Seiten) – Selektoren auf das Positions-Formular nachgeführt, **in diesem Stand nicht ausgeführt** |
| Playwright `criterias` | 57 `test.fixme`-Skelette, kein Nachweis |
| Lint (`api`, `app`, `app-e2e`) | grün |

### Screenshots

Die Bilder der vier Schiessplatz-Seiten liegen unter `docs/architecture/images/` (Übersicht, Schusszahlen,
Details, Simulation, Details auf Telefonbreite) und sind in [ui-ansichten.md](../architecture/ui-ansichten.md)
eingebunden.

## 3. Bewusste Vereinfachungen im Prototyp

| Thema | Prototyp | Zielbild (B1) |
|---|---|---|
| Karte | Schematische SVG-Karte mit Pins (Prozent-Koordinaten), LV95 pro Empfangspunkt gespeichert | GIS-Viewer swisstopo, Zoom, PDF (`slm 2`) |
| Verteilung auf Quellen (7.5) | Schusslinien je Zustand mit Quelldaten Anhang 9/7 als Gewichte; Zuordnung Kombination ↔ Schusslinie über die sonARMS-ID | identisch; zusätzlich Fachentscheid-Freigabe der Ersatzregel in einer Maske |
| Betrachtungszeitraum | Zeitraum oder repräsentative Jahre (`years=`), Ø ohne vorzeitige Rundung | Auswahl der 3 Jahre in der Maske (heute nur API) |
| Feiertage | Kalender je Schiessplatz (`feiertag`) im Seed, keine Pflegemaske | Pflege in der Datenverwaltung |
| Berechnungsgrundlage | Import über API (JSON-Staging aus dem Datensatz), zwei Zustände im Seed; kein FGDB-Parser, keine Upload-Maske | FGDB/WLR/Betriebsdaten-Upload (5.19), Masken 5.18–5.21 |
| Geometrien | Text (WKT/JSON) in SQLite, Karte schematisch | PostGIS `geometry`, GIS-Viewer |
| Fachentscheide | Freigabe der Ersatzregel als Parameter (`release`) im Berechnungslauf gespeichert | eigene Entität mit Person, Datum, Begründung |
| Rollen | Vier Rollen mit Matrix und Demo-Konten; «W/R-O» erzwungen (API); Menü nach App-Rechten der Sitzung, Schaltflächen in den Masken noch statisch | CASL im Frontend (wie ELO) für Schaltflächen und Lese-Modus, Zuordnung Schiessplätze im Benutzerformular |
| Schiessplatz – Übersicht (5.10) | Ampeln in Kontextleiste (aus Seed), Seite selbst Platzhalter | Kontingent-Tabelle Soll/Ist/Ø 3 Jahre, Karte |
| Grenzwerte | LSV-Tabellen als Konstante (`ANNEX9_LIMITS`, `ANNEX7_LIMITS`) | Konfigurierbar (5.28) |
| Export | Buttons vorhanden, deaktiviert | Excel/PDF (`slm 3`, `slm 39`–`41`) |
| Benutzerverwaltung | Masken aus ELO, auf das Design System umgestellt; Rollen tragen Schlüssel (`settings.key`) + Flag «nur eigene Schiessplätze», Systemrollen nicht löschbar, Benutzerzahl je Rolle | CASL im Frontend, Zuordnung Schiessplätze im Benutzerformular |

## 4. Offen / nächste Schritte (Vorschlag)

1. **Schiessplatz – Übersicht (5.10)** mit Kontingent-Tabelle (Soll aus `kontingent`, Ist aus den
   Nutzungen, Ø 3 Jahre) und Karte; die Ampeln kommen bereits aus `AreaStatusService`.
2. **Datenverwaltung** (5.15–5.17, 5.22–5.25; 5.14 ist umgesetzt): Masken für Schiessplatz, Stellungsräume,
   Zuordnung Waffen, Waffen-Stammdaten; Seed aus B1.6/B1.7 (echte 126 Schiessplätze).
3. **ELO-Schnittstelle** (Kap. 6): `GET Anlageninformationen`, `POST Schiessplatznutzung` – Datenmodell
   ist bereit (`source = 'elo'`).
4. **Berechnungen verwalten** (5.18–5.21): Masken für Import (FGDB/WLR-Parser, heute JSON-Staging),
   Zeiger «aktuell»/«MGDM», Berechnungsläufe und Fachentscheide – die API-Endpunkte bestehen.
5. **GIS-Karte** (swisstopo, LV95) an Stelle der schematischen Karte; Vollansicht.
6. **Produktion**: Auslieferung des Frontends fehlt heute (das Docker-Image kopiert `dist/app`,
   aber niemand serviert es) – nginx oder Static-Serving in der API festlegen; Hosting, Backup,
   Monitoring gemäss [deployment-sicherheit.md](../architecture/deployment-sicherheit.md).
7. **Rechte im Frontend** (CASL wie in ELO): Schaltflächen und Lese-Modus aus den App-Rechten
   der Session (das Menü filtert bereits, `core/access`); Zuordnung Schiessplätze im Benutzerformular;
   Rollen-e2e je Demo-Konto ([berechtigungen.md](../architecture/berechtigungen.md), Abschnitt 5).
8. Entscheidungen des Auftraggebers (index.md, Abschnitt 10): Feiertagskalender, drei Referenzjahre,
   Grenzwert-Konfiguration, Rollen-Zuschnitt, GIS-Format.
9. **Willkommensbanner, Lesezeichen und Sidebar-Zustand** je Benutzer in den galaxy-Benutzereinstellungen
   merken (heute Sitzung bzw. Browser); PostgreSQL/PostGIS-Betrieb sobald `@app-galaxy/*` die Postgres-Typen mappt.
10. **Karte**: Details und Simulation zeichnen je eine eigene schematische SVG-Karte (`slim-map`, Prozent-
    Koordinaten) – keine gemeinsame Komponente, kein GIS. Nächster Schritt: eine `app-area-map`-Komponente
    (`views/admin/area/_components`) für beide Seiten, danach der swisstopo-Viewer (`slm 2`).

### Kriterien-Nachweise

`apps/app-e2e/src/criterias/` (Playwright-Projekt `criterias`) sammelt je kritischem Kriterium
(`slm`, Abnahmekriterien K1–K7) einen Testfall – heute als Skelett mit den Schritten, die
noch zu automatisieren sind (57 `test.fixme`, siehe README dort). Die Rechenfälle durch die Kette
sind in [nachweis-rechenfaelle.md](nachweis-rechenfaelle.md) belegt (Testplatz S, Handrechnung).

## 5. Demo-Pfad für die Sitzung

1. `npm run setup` (oder `npm run all`), Anmeldung `slim@demo.ch / 1234` (weitere Konten je Rolle:
   `fachspezialist@`, `schiessplatz@` (nur Geissalp, Thun), `interessent@`, `appadmin@demo.ch`).
2. Willkommensbanner → «Demo starten» öffnet direkt die Schusszahlen von **Geissalp** (oder: Startseite →
   Übersicht Schiessplätze mit Ampeln → Geissalp).
3. Reiter **Schusszahlen**: Nutzung erfassen (z. B. Stellungsrm Mw Neuhaus, Position Pz Hb 74 · 200 Schuss,
   zweite Position hinzufügen) – Löschen – Rückgängig.
4. Reiter **Details**: E1 ist rot (60.8 dB > IGW 60), Wechsel auf «Sanierter Zustand 2025» → 56.4 dB,
   Abweichung −4.4 dB; E6 ohne Berechnung.
5. Reiter **Simulation**: «Werte überschreiben», −20 % → Simulation ausführen → E1 wird orange;
   ×10 (mehrfach +50 %) → alle rot.
6. Benutzerverwaltung: Benutzer → `schiessplatz@demo.ch` öffnen (Rolle Schiessplatz-Verantwortlicher);
   mit diesem Konto anmelden → Übersicht zeigt nur Geissalp und Thun, Bière antwortet 403.
7. `/api/docs` (Swagger: Import, Zeiger, Berechnungslauf unter `calculation`) und `/erd` (Datenmodell
   nach B1 Kap. 10) zeigen die generierte Dokumentation.
