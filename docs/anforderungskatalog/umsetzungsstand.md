# Umsetzungsstand Prototyp SLIM

**Stand:** 11.09.2026, abends · **Zweck:** Grundlage für die nächste Sitzung – was läuft, was fehlt,
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

## 2. Umgesetzt (verifiziert durch Tests)

| Bereich | Was läuft | Nachweis |
|---|---|---|
| Anmeldung, Mandant, Rollen | Login, 2FA, Mandantenwahl, Passwort zurücksetzen, App-Katalog + Admin-Rolle (`API_APPS_MAPPING`) | e2e `auth.spec`, `login.spec`; Setup-Schritte 09/10 |
| Startseite, Übersicht Schiessplätze (5.8/5.9) | Kacheln mit Kennzahlen, Tabelle mit Kontingent- und Lärm-Ampel, Suche, Filter «Handlungsbedarf» | e2e `admin.spec` |
| Schiessplatz-Kontext | Kontextleiste mit Zurück, Schiessplatz-Wechsler, Ampeln, Reiter Übersicht · Schusszahlen · Details · Simulation | `views/admin/area/_context` |
| Menü | Sidebar/Tabbar mit den Gruppen Arbeitsbereich, Datenverwaltung, **Benutzerverwaltung** (Benutzer, Rollen, Apps) | `views/admin/_layout` |
| **Schusszahlen (5.11)** | Stellungsräume mit Zählern, Nutzungstabelle (Filter Jahr/Datum/Freitext/Nutzung/Kategorie, Sortierung, Gruppierung, Mehrfachauswahl), Erfassen/Bearbeiten im Drawer (nur zulässige Kombinationen Stellungsraum × Waffe), Löschen mit «Rückgängig», ELO-Kennzeichnung | API `usage.service.spec` (11 Tests), Jest + e2e `area-shots.spec` |
| **Lärmberechnung (7.4–7.7)** | `@slim/lsv`: GEMW/ESM, Anhang 9 (LAE1/LAE2/Lr), Anhang 7 (Li/Lri/Lr, Halbtage), Werktag-Split Mo–Fr 07–19 Uhr, Grenzwerte je Empfindlichkeitsstufe, Baujahr-Regel (IGW/PW/gemischt), Ampel-Regeln (Lärm −5 dB, Kontingent 125 %) | 95 Unit-Tests gegen B1.4 (`libs/shared/lsv`); [laermberechnung.md](../architecture/laermberechnung.md) |
| **Details Empfangspunkte (5.12)** | Beurteilung je Empfangspunkt: 4 Zeilen (Anh. 9 IGW/PW, Anh. 7 IGW/PW) mit Pegel, Reserve, Ampel; schematische Karte mit Pins, Listenansicht, Wechsel der Berechnungsgrundlage mit Abweichung zum gültigen Zustand, Betrachtungszeitraum | API `assessment.service.spec` (12 Tests), Jest + e2e `area-details.spec` |
| **Simulation (5.13)** | Tabelle Stellungsraum × Waffe mit «innerhalb/ausserhalb Werktag» (aus den Nutzungen des Jahres), Werte überschreiben, Schnellfaktoren, Berechnung nach Anhang 9, Resultat je Empfangspunkt mit Differenz und Ampelwechsel, Karte mit Ist-Schatten | API `simulation.service.spec` (10 Tests: ×10 = +10 dB, Abend +5 dB, …), Jest + e2e `area-simulation.spec` |
| Datenmodell | `area`, `stellungsraum`, `stellungsraum_waffe` (= Quelle, mit Kontingent), `nutzung`, `zustand`, `empfangspunkt`, `wlr_pegel`; ERD automatisch generiert (`docs/architecture/uml.mmd`, `/erd`) | `tenant-dataset.spec`, [datenstruktur.md](../architecture/datenstruktur.md) |
| Demo-Datensatz | `tenant.mock.json` (llumi-Muster): 9 Schiessplätze, Geissalp mit 14 Stellungsräumen, 16 Quellen, 6 Empfangspunkten, 2 Berechnungszuständen (initial 2019 = gültig, saniert 2025), 72 Nutzungen; jährlich rollend, Regenerierung per Generator | `tenant-dataset.spec` (7 Tests) |
| API-Client, Doku | Angular-Client und Modelle werden bei jedem API-Start aus Swagger generiert; Swagger UI `/api/docs` | `libs/app/generated` |
| Benutzerverwaltung (5.26, 8.1) | Benutzer/Rollen/Apps-Masken aus ELO über die galaxy-Admin-API; vier SLIM-Rollen mit der Rechte-Matrix 8.1.2 als Seed (ein Demo-Konto je Rolle); Guards prüfen R/W/X pro Bereich; «W/R-O» über galaxy Rules (`area-scope`) + `schiessplatz_benutzer`; 2FA vorhanden (erfüllt «MFA oder AGOV») | API `area-scope.spec` (6 Tests); [berechtigungen.md](../architecture/berechtigungen.md) |
| Verteilung auf Quellen / Fachregel O8 (B1 7.5, `slm 32`, Review T02) | `distributeShots` im Kern: Verweigern als Standard bei Σ Gewichte = 0, Ersatzregel Gleichverteilung nur mit dokumentierter Freigabe (`release`), `no-source`-Warnung; Ampel-Status `incomplete` = «nicht beurteilbar» (keine Farbe, Teilpegel sichtbar, `missingSources`, Zähler, Legende, Pin-Schraffur, Prüfhinweis in der Detailmaske); Assessment markiert Empfangspunkte, deren Nutzungen der Zustand nicht belegt | `distribution.spec` (7), `traffic-light.spec`, `assessment.service.spec` (O8), Live-Check |
| Rundungsregel Grenzwertvergleich (B1.2 10.4) | `noiseState` vergleicht den auf ganze dB gerundeten Pegel (60.4 → 60 eingehalten, 60.5 → 61 überschritten), Modus konfigurierbar; Anzeige weiterhin mit einer Dezimale | `traffic-light.spec` (60.4/60.5, 55.4/55.5, Grenzfälle) |
| Metamorphe Tests je Anhang | Anhang 9: ×10 Schuss = +10 dB; Anhang 7: ×10 Schuss bei gleichen Halbtagen = +3 dB (3·log M) | `annex9.spec`, `annex7.spec` |
| Dezimalmengen (B1 6.2/11.2.3) | `nutzung.shots` DECIMAL(12,3) + `quantityUnit` (Stück/kg); DTO-Validierung 3 Dezimalen; Werktag-Split behält die Präzision der Eingabe; Formular mit Einheit und Schrittweite 0.001/0.1 kg | `operating-data.spec`, `usage.service.spec`, Live-Check Formular |
| Hierarchie Immissionsberechnung → Zustand (B1 5.18) | Neue Entity `immissionsberechnung` (Bezeichnung, Lieferantin, Lieferdatum) mit 1:n Zuständen; `CalculationDto` trägt `calculationId`/`calculationName`; Seed legt je Zustand eine Lieferung an (`calculation`-Feld im Datensatz gruppiert) | `calculation.service`, ERD `uml.mmd` |
| Deutsche Datenbankobjekte (B1 12.2, `slm 51`) | Physische Tabellen deutsch (`schiessplatz`, `stellungsraum`, `stellungsraum_waffe`, `nutzung`, `zustand`, `empfangspunkt`, `wlr_pegel`, `schiessplatz_benutzer`, `logbuch`, `demo_datensatz`); Spalten noch englisch (nächster Schritt) | ERD, `datenstruktur.md` |
| PostgreSQL/PostGIS | `docker-compose` Service `app-postgis` (17-3.5), `.env.example`-Block, Roh-SQL treiberneutral (`rawQuery`, `$n`-Platzhalter). **Blockiert** durch `@app-galaxy/*`: `DbPlatformColumn`/`DbAuthAwareColumn` mappen MySQL-Typen nicht für Postgres (`double`, `datetime`, `longtext` → «Data type "double" … not supported by "postgres"»). Nötige Bibliotheksänderung: Postgres-Map `double → double precision, datetime → timestamp, longtext → text, tinyint → smallint` in beiden Helpern | Boot-Test gegen `postgis/postgis:17-3.5` am 11.09.2026 |
| GDAL-Roundtrip B1.2 | **Offen**: Beilage B1.2 (FGDB-Schema) liegt nicht im Repo und GDAL ist lokal nicht installiert; Vorschlag: `ghcr.io/osgeo/gdal`-Container + Beispiel-FGDB der Auftraggeberin | – |
| Nutzungskategorien (B1 Tabelle 2) und halbe Feiertage | `USAGE_TYPE` = Militär, Zivil, Blaulicht, SAT; Anhang 9 rechnet alle Kategorien, Anhang 7 Zivil + SAT (`countsForAnnex7`, alle bei «Gesamtbeurteilung»); Feiertage je Standort ganz oder halb (`{ date, from/to }`) in `splitAnnex9` / `annex7HalfDays`; Demo-Datensatz v4 mit Blaulicht-/SAT-Nutzungen neu getunt | `libs/shared/lsv` (`operating-data.spec`), `assessment.service.spec`, `simulation.service.spec` |
| Datenverwaltung › Schiessplatz › Übersicht 5.14 (`slm 13`) | Mock `_mocks/data-management/area.index.html` umgesetzt: Suche über Bezeichnung, Koordinationsabschnitt- und Sachplan-Nr., sortierbare Spalten, Aktiv-Badge, Absprünge Allgemein / Zuordnung Waffen / Berechnungen je Zeile (Ziel-Routen `…/area/:areaId/…`, heute Platzhalter); kein «Neuer Schiessplatz» | `views/admin/data-management/area/dm-area-overview` |
| Login-Logging / Logbuch (`slm 56`) | Logbuch `logbuch` aus ELO übernommen, Maske «Logbuch» unter Datenverwaltung mit Filtern und XLSX-Export; mit `@app-galaxy/auth-api` 0.1.218 alle Auth-Ereignisse über Hooks: Login (Methode), fehlgeschlagener Login (Grund), Logout, Token-Wiederverwendung, Passwort-Reset/-Änderung, E-Mail-Verifikation | API `client-ip.spec`, `auth-audit.hooks.spec`; `views/admin/logs` |
| Setup-Wizard | `npm run setup`: 12 Schritte (Toolchain, .env, Registry, Abhängigkeiten, DB SQLite/MariaDB/MySQL/PostgreSQL, Workspace, API, Frontend, Login, Rechte, Demo-Daten, e2e) | live durchgespielt, 12/12 grün |
| Architektur-Doku (A2) | Gesamtarchitektur, Deployment/Sicherheit, UI-Ansichten – nur Ist-Zustand | [gesamtarchitektur.md](../architecture/gesamtarchitektur.md), [deployment-sicherheit.md](../architecture/deployment-sicherheit.md), [ui-ansichten.md](../architecture/ui-ansichten.md) |
| Lösungskonzept (C2) v0.2 | Entwurf v0.1 auf den Prototyp-Stand gebracht: Ist-Skizzen (Gesamtarchitektur, Datenmodell, Berechtigungskette, Deployment, Berechnungsfluss) und Screenshots eingebettet, Zielzustand verbindlich, Prototyp-Belege je Kapitel, Matrix mit Status P/Z/O; Seitenbudget A2 (15 + 2, Summary ½ Seite) eingehalten | [C2-Loesungskonzept-SLIM.md](C2-Loesungskonzept-SLIM.md) → `npm run docs:docx -- docs/anforderungskatalog/C2-Loesungskonzept-SLIM.md --pages` erzeugt die `.docx` und meldet die Seitenzahl je Kapitel |

Testbilanz: API 180 Vitest-Tests (inkl. 95 Berechnung, 6 Berechtigungen, Logbuch), 63 Angular Jest-Tests
(Seiten, Facades), Playwright-Suite 32 Fälle (Auth, Admin, drei Schiessplatz-Seiten) grün.

### Screenshots

Die Bilder der vier Schiessplatz-Seiten liegen unter `docs/architecture/images/` (Übersicht, Schusszahlen,
Details, Simulation, Details auf Telefonbreite) und sind in [ui-ansichten.md](../architecture/ui-ansichten.md)
eingebunden.

## 3. Bewusste Vereinfachungen im Prototyp

| Thema | Prototyp | Zielbild (B1) |
|---|---|---|
| Karte | Schematische SVG-Karte mit Pins (Prozent-Koordinaten), LV95 pro Empfangspunkt gespeichert | GIS-Viewer swisstopo, Zoom, PDF (`slm 2`) |
| Verteilung auf Quellen (7.5) | 1 Quelle = 1 zulässige Kombination Stellungsraum × Waffe | Verteilung auf Schusslinien im Verhältnis der Betriebsdaten der Grundlage |
| Betrachtungszeitraum | Summe des Zeitraums, Ø bei mehreren Jahren | 3 wählbare repräsentative Jahre |
| Feiertage | Parameter vorhanden, kein Kalender hinterlegt | Feiertage am Standort (Anhang 7/9) |
| Berechnungsgrundlage | Zwei Zustände im Seed; kein Upload | Import FGDB/WLR/Betriebsdaten (5.19), Verwaltung (5.18–5.21) |
| Rollen | Vier Rollen mit Matrix und Demo-Konten; «W/R-O» erzwungen (API); Menü/Schaltflächen im Frontend noch statisch | CASL im Frontend (wie ELO), Zuordnung Schiessplätze im Benutzerformular |
| Schiessplatz – Übersicht (5.10) | Ampeln in Kontextleiste (aus Seed), Seite selbst Platzhalter | Kontingent-Tabelle Soll/Ist/Ø 3 Jahre, Karte |
| Grenzwerte | LSV-Tabellen als Konstante (`ANNEX9_LIMITS`, `ANNEX7_LIMITS`) | Konfigurierbar (5.28) |
| Export | Buttons vorhanden, deaktiviert | Excel/PDF (`slm 3`, `slm 39`–`41`) |
| Benutzerverwaltung | Masken aus ELO, auf das Design System umgestellt; Rollen tragen Schlüssel (`settings.key`) + Flag «nur eigene Schiessplätze», Systemrollen nicht löschbar, Benutzerzahl je Rolle | CASL im Frontend, Zuordnung Schiessplätze im Benutzerformular |

## 4. Offen / nächste Schritte (Vorschlag)

1. **Schiessplatz – Übersicht (5.10)** mit Kontingent-Tabelle (Soll aus `area_weapon.quota`, Ist aus
   Nutzungen) und Ampel-Aggregation; `noiseStatus`/`quotaStatus` der Übersicht aus der Berechnung
   statt aus dem Seed.
2. **Datenverwaltung** (5.15–5.17, 5.22–5.25; 5.14 ist umgesetzt): Masken für Schiessplatz, Stellungsräume,
   Zuordnung Waffen, Waffen-Stammdaten; Seed aus B1.6/B1.7 (echte 126 Schiessplätze).
3. **ELO-Schnittstelle** (Kap. 6): `GET Anlageninformationen`, `POST Schiessplatznutzung` – Datenmodell
   ist bereit (`source = 'elo'`).
4. **Berechnungen verwalten** (5.18–5.21) mit Upload WLR/Betriebsdaten (Parser in `@slim/lsv`
   ergänzen) und «aktueller Zustand» / «Stand MGDM».
5. **GIS-Karte** (swisstopo, LV95) an Stelle der schematischen Karte; Vollansicht.
6. **Produktion**: Auslieferung des Frontends fehlt heute (das Docker-Image kopiert `dist/app`,
   aber niemand serviert es) – nginx oder Static-Serving in der API festlegen; Hosting, Backup,
   Monitoring gemäss [deployment-sicherheit.md](../architecture/deployment-sicherheit.md).
7. **Rechte im Frontend** (CASL wie in ELO): Menü, Schaltflächen und Lese-Modus aus den App-Rechten
   der Session; Zuordnung Schiessplätze im Benutzerformular; Rollen-e2e je Demo-Konto
   ([berechtigungen.md](../architecture/berechtigungen.md), Abschnitt 5).
8. Entscheidungen des Auftraggebers (index.md, Abschnitt 10): Feiertagskalender, drei Referenzjahre,
   Grenzwert-Konfiguration, Rollen-Zuschnitt, GIS-Format.

### Kriterien-Nachweise

`apps/app-e2e/src/criterias/` (Playwright-Projekt `criterias`) sammelt je kritischem Kriterium
(`slm`, Abnahmekriterien K1–K7) einen Testfall – heute als Skelett mit den Schritten, die
noch zu automatisieren sind (46 Fälle in 11 Dateien, siehe README dort).

## 5. Demo-Pfad für die Sitzung

1. `npm run setup` (oder `npm run all`), Anmeldung `slim@demo.ch / 1234` (weitere Konten je Rolle:
   `fachspezialist@`, `schiessplatz@` (nur Geissalp, Thun), `interessent@`, `appadmin@demo.ch`).
2. Startseite → Übersicht Schiessplätze (Ampeln) → **Geissalp**.
3. Reiter **Schusszahlen**: Nutzung erfassen (z. B. Stellungsrm Mw Neuhaus, Pz Hb 74, 200 Schuss,
   Nachtschiessen) – Löschen – Rückgängig.
4. Reiter **Details**: E1 ist rot (60.8 dB > IGW 60), Wechsel auf «Sanierter Zustand 2025» → 56.4 dB,
   Abweichung −4.4 dB; E6 ohne Berechnung.
5. Reiter **Simulation**: «Werte überschreiben», −20 % → Simulation ausführen → E1 wird orange;
   ×10 (mehrfach +50 %) → alle rot.
6. Benutzerverwaltung: Benutzer → `schiessplatz@demo.ch` öffnen (Rolle Schiessplatz-Verantwortlicher);
   mit diesem Konto anmelden → Übersicht zeigt nur Geissalp und Thun, Bière antwortet 403.
7. `/api/docs` (Swagger) und `/erd` (Datenmodell) zeigen die generierte Dokumentation.
