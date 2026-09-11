# Umsetzungsstand Prototyp SLIM

**Stand:** 11.09.2026 · **Zweck:** Grundlage für die nächste Sitzung – was läuft, was fehlt,
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
| **Schusszahlen (5.11)** | Stellungsräume mit Zählern, Nutzungstabelle (Filter Jahr/Datum/Freitext/Nutzung/Kategorie, Sortierung, Gruppierung, Mehrfachauswahl), Erfassen/Bearbeiten im Drawer (nur zulässige Kombinationen Stellungsraum × Waffe), Löschen mit «Rückgängig», ELO-Kennzeichnung | API `usage.service.spec` (11 Tests), Jest + e2e `area-shots.spec` |
| **Lärmberechnung (7.4–7.7)** | `@slim/lsv`: GEMW/ESM, Anhang 9 (LAE1/LAE2/Lr), Anhang 7 (Li/Lri/Lr, Halbtage), Werktag-Split Mo–Fr 07–19 Uhr, Grenzwerte je Empfindlichkeitsstufe, Baujahr-Regel (IGW/PW/gemischt), Ampel-Regeln (Lärm −5 dB, Kontingent 125 %) | 95 Unit-Tests gegen B1.4 (`libs/shared/lsv`); [laermberechnung.md](../architecture/laermberechnung.md) |
| **Details Empfangspunkte (5.12)** | Beurteilung je Empfangspunkt: 4 Zeilen (Anh. 9 IGW/PW, Anh. 7 IGW/PW) mit Pegel, Reserve, Ampel; schematische Karte mit Pins, Listenansicht, Wechsel der Berechnungsgrundlage mit Abweichung zum gültigen Zustand, Betrachtungszeitraum | API `assessment.service.spec` (12 Tests), Jest + e2e `area-details.spec` |
| **Simulation (5.13)** | Tabelle Stellungsraum × Waffe mit «innerhalb/ausserhalb Werktag» (aus den Nutzungen des Jahres), Werte überschreiben, Schnellfaktoren, Berechnung nach Anhang 9, Resultat je Empfangspunkt mit Differenz und Ampelwechsel, Karte mit Ist-Schatten | API `simulation.service.spec` (10 Tests: ×10 = +10 dB, Abend +5 dB, …), Jest + e2e `area-simulation.spec` |
| Datenmodell | `area`, `area_room`, `area_weapon` (= Quelle, mit Kontingent), `area_usage`, `area_calculation`, `area_receiver`, `area_wlr`; ERD automatisch generiert (`docs/architecture/uml.mmd`, `/erd`) | `tenant-dataset.spec`, [datenstruktur.md](../architecture/datenstruktur.md) |
| Demo-Datensatz | `tenant.mock.json` (llumi-Muster): 9 Schiessplätze, Geissalp mit 14 Stellungsräumen, 16 Quellen, 6 Empfangspunkten, 2 Berechnungszuständen (initial 2019 = gültig, saniert 2025), 72 Nutzungen; jährlich rollend, Regenerierung per Generator | `tenant-dataset.spec` (7 Tests) |
| API-Client, Doku | Angular-Client und Modelle werden bei jedem API-Start aus Swagger generiert; Swagger UI `/api/docs` | `libs/app/generated` |
| Setup-Wizard | `npm run setup`: 12 Schritte (Toolchain, .env, Registry, Abhängigkeiten, DB SQLite/MariaDB/MySQL/PostgreSQL, Workspace, API, Frontend, Login, Rechte, Demo-Daten, e2e) | live durchgespielt, 12/12 grün |
| Architektur-Doku (A2) | Gesamtarchitektur, Deployment/Sicherheit, UI-Ansichten – nur Ist-Zustand | [gesamtarchitektur.md](../architecture/gesamtarchitektur.md), [deployment-sicherheit.md](../architecture/deployment-sicherheit.md), [ui-ansichten.md](../architecture/ui-ansichten.md) |

Testbilanz: API 155 Vitest-Tests (inkl. 95 Berechnung), Angular Jest-Tests der Seiten und
Facades, Playwright-Suite (Auth, Admin, drei Schiessplatz-Seiten).

## 3. Bewusste Vereinfachungen im Prototyp

| Thema | Prototyp | Zielbild (B1) |
|---|---|---|
| Karte | Schematische SVG-Karte mit Pins (Prozent-Koordinaten), LV95 pro Empfangspunkt gespeichert | GIS-Viewer swisstopo, Zoom, PDF (`slm 2`) |
| Verteilung auf Quellen (7.5) | 1 Quelle = 1 zulässige Kombination Stellungsraum × Waffe | Verteilung auf Schusslinien im Verhältnis der Betriebsdaten der Grundlage |
| Betrachtungszeitraum | Summe des Zeitraums, Ø bei mehreren Jahren | 3 wählbare repräsentative Jahre |
| Feiertage | Parameter vorhanden, kein Kalender hinterlegt | Feiertage am Standort (Anhang 7/9) |
| Berechnungsgrundlage | Zwei Zustände im Seed; kein Upload | Import FGDB/WLR/Betriebsdaten (5.19), Verwaltung (5.18–5.21) |
| Rollen | Admin-Rolle mit allen Apps; Lese-Modus in der Maske vorbereitet | Vier Rollen, Schiessplatz-Verantwortlicher nur eigene Plätze |
| Schiessplatz – Übersicht (5.10) | Ampeln in Kontextleiste (aus Seed), Seite selbst Platzhalter | Kontingent-Tabelle Soll/Ist/Ø 3 Jahre, Karte |
| Grenzwerte | LSV-Tabellen als Konstante (`ANNEX9_LIMITS`, `ANNEX7_LIMITS`) | Konfigurierbar (5.28) |
| Export | Buttons vorhanden, deaktiviert | Excel/PDF (`slm 3`, `slm 39`–`41`) |

## 4. Offen / nächste Schritte (Vorschlag)

1. **Schiessplatz – Übersicht (5.10)** mit Kontingent-Tabelle (Soll aus `area_weapon.quota`, Ist aus
   Nutzungen) und Ampel-Aggregation; `noiseStatus`/`quotaStatus` der Übersicht aus der Berechnung
   statt aus dem Seed.
2. **Datenverwaltung** (5.14–5.17, 5.22–5.25): Masken für Schiessplatz, Stellungsräume,
   Zuordnung Waffen, Waffen-Stammdaten; Seed aus B1.6/B1.7 (echte 126 Schiessplätze).
3. **ELO-Schnittstelle** (Kap. 6): `GET Anlageninformationen`, `POST Schiessplatznutzung` – Datenmodell
   ist bereit (`source = 'elo'`).
4. **Berechnungen verwalten** (5.18–5.21) mit Upload WLR/Betriebsdaten (Parser in `@slim/lsv`
   ergänzen) und «aktueller Zustand» / «Stand MGDM».
5. **GIS-Karte** (swisstopo, LV95) an Stelle der schematischen Karte; Vollansicht.
6. **Produktion**: Auslieferung des Frontends fehlt heute (das Docker-Image kopiert `dist/app`,
   aber niemand serviert es) – nginx oder Static-Serving in der API festlegen; Hosting, Backup,
   Monitoring gemäss [deployment-sicherheit.md](../architecture/deployment-sicherheit.md).
7. Entscheidungen des Auftraggebers (index.md, Abschnitt 10): Feiertagskalender, drei Referenzjahre,
   Grenzwert-Konfiguration, Rollen-Zuschnitt, GIS-Format.

## 5. Demo-Pfad für die Sitzung

1. `npm run setup` (oder `npm run all`), Anmeldung `slim@demo.ch / 1234`.
2. Startseite → Übersicht Schiessplätze (Ampeln) → **Geissalp**.
3. Reiter **Schusszahlen**: Nutzung erfassen (z. B. Stellungsrm Mw Neuhaus, Pz Hb 74, 200 Schuss,
   Nachtschiessen) – Löschen – Rückgängig.
4. Reiter **Details**: E1 ist rot (60.8 dB > IGW 60), Wechsel auf «Sanierter Zustand 2025» → 56.4 dB,
   Abweichung −4.4 dB; E6 ohne Berechnung.
5. Reiter **Simulation**: «Werte überschreiben», −20 % → Simulation ausführen → E1 wird orange;
   ×10 (mehrfach +50 %) → alle rot.
6. `/api/docs` (Swagger) und `/erd` (Datenmodell) zeigen die generierte Dokumentation.
