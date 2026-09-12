# Roadmap Prototyp SLIM – Umsetzung und Validierung der Kriterien

**Ziel:** ein lauffähiger Prototyp, der die Zuschlagskriterien des Lösungskonzepts (Beilage A2, Z2)
und die relevanten Anforderungen `slm 1`–`slm 57` (Beilage B1) **vorführbar** abdeckt – nicht
Produktionsreife, sondern Beweis von Architektur, Fachlogik und UX.
**Grundlagen:** [`../anforderungskatalog/index.md`](../anforderungskatalog/index.md) (Lesehilfe,
Formeln, Prioritäten) · [`../architecture/sitemap.md`](../architecture/sitemap.md) (Routen) ·
[`../architecture/datenstruktur.md`](../architecture/datenstruktur.md) · ELO-Referenz
`C:\Users\User\Projects\alco\pwa-elo-shot-counting`.
**Erstellt:** 11.09.2026 · **Nachgeführt:** 12.09.2026 (Abnahmestand in Abschnitt 1a, Status in Abschnitt 3
nach jedem Sprint aktualisieren). Detailstand: [`../anforderungskatalog/umsetzungsstand.md`](../anforderungskatalog/umsetzungsstand.md).

---

## 1. Was «Prototyp fertig» heisst (Abnahmekriterien)

| # | Kriterium | Nachweis |
|---|---|---|
| 1 | Jedes Kapitel von Beilage A2 ist mit einem laufenden Teil des Prototyps belegbar (Architektur, Schnittstellen, Lärmberechnung, UX, NFA). | Demo-Skript in Abschnitt 5 durchspielbar, ohne Mock-Daten im Frontend |
| 2 | Die Berechnungsengine reproduziert die Kontrollwerte aus Beilage B1.4 (Anh. 9: E1 = 60.7 dB, E2 = 51.8, E3 = 46.6, E4a = 41.8; Anh. 7: E1 = 73.8, E2 = 66.3, E3 = 60.5, E4a = 53.1). | Vitest-Spec `calculation` grün, Toleranz ± 0.05 dB |
| 3 | ELO ↔ SLIM: eine in ELO erfasste Nutzung landet über `POST` in SLIM und verändert die Ampel. | E2E-Test über beide Projekte oder manuelle Demo |
| 4 | Alle Sitemap-Seiten sind erreichbar; die in Abschnitt 3 als «Prototyp» markierten sind fachlich umgesetzt, der Rest als Platzhalter mit Breadcrumbs. | `admin.spec.ts` + Screenshots |
| 5 | Rollen aus B1 8.1 wirken: Interessent sieht nur, Verantwortlicher nur eigene Plätze, Admin die Konfiguration. | E2E mit drei Seed-Benutzern |
| 6 | DE / FR / IT umschaltbar, Light/Dark, responsive bis 375 px. | Styleguide + E2E |
| 7 | Build, Lint, Unit- und E2E-Tests grün; `docs/` nachgeführt. | CI |

Die Matrix in Abschnitt 6 hält pro `slm` fest, ob und wodurch sie im Prototyp belegt ist.

### 1a. Abnahmestand je Kriterium (Stand 12.09.2026)

Dieselbe Lesart wie beim Esli-Abnahmeplan: **implementiert → mit Demo-Daten geprüft → mit
Auftraggeber-Daten geprüft → vom Auftraggeber bestätigt**. Legende: ✅ erfüllt · ◐ teilweise ·
☐ offen · – noch nicht relevant.

| # | Kriterium | implementiert | mit Demo-Daten geprüft | mit Auftraggeber-Daten geprüft | vom Auftraggeber bestätigt | Bemerkung |
|---|---|:---:|:---:|:---:|:---:|---|
| 1 | Jedes A2-Kapitel belegbar | ◐ | ◐ | – | ☐ | C2 v0.2 mit Prototyp-Belegen je Kapitel; Schnittstellen (ELO) und GIS nur konzeptionell. 9 `[OFFEN]`-Entscheide der Firma. |
| 2 | Kontrollwerte B1.4 reproduziert | ✅ | ✅ | ✅ | ☐ | 95 Kernel-Tests, alle 12 Empfangspunkte Anh. 9/7 (Toleranz ± 0.05 dB); B1.4 *sind* Auftraggeber-Daten. Rundung 10.4, ×10-Tests, O8 (`incomplete`). |
| 3 | ELO ↔ SLIM Nutzung per POST | ☐ | ☐ | ☐ | ☐ | Datenmodell bereit (`source = 'elo'`), Endpunkte nicht gebaut (Sprint 2). |
| 4 | Sitemap erreichbar, Kern fachlich, Rest Platzhalter | ✅ | ✅ | – | ☐ | `admin.spec` + drei Schiessplatz-Specs; 5.10, 5.15–5.17, 5.18–5.25, 5.28 sind Platzhalter mit Breadcrumbs. |
| 5 | Rollen B1 8.1 wirken | ◐ | ◐ | – | ☐ | Vier Rollen + Matrix als Seed, W/R-O in der API erzwungen (`area-scope.spec`); Frontend-Rechte (CASL) und e2e je Demo-Konto fehlen. |
| 6 | DE/FR/IT, Light/Dark, 375 px | ✅ | ✅ | – | ☐ | de/fr/it/en, Styleguide, e2e Sprache/Theme, Telefon-Screenshots. |
| 7 | Build, Lint, Tests grün, docs nachgeführt | ✅ | ✅ | – | ☐ | CI (`build-and-deploy.yml`): Vitest 197, Jest 63, Playwright 32; Kriterien-Nachweise `criterias/` noch Skelett. |

«Mit Auftraggeber-Daten geprüft» wird mit dem Seed aus B1.6/B1.7 (126 Schiessplätze, Waffenliste)
und dem ersten realen WLR-/Betriebsdaten-Import gefüllt (Sprint 1 und 3); «bestätigt» in der
Sitzung mit KOMZ Lärm anhand des Demo-Skripts (Abschnitt 5).

---

## 2. Meilensteine

Annahme: ein Entwickler, ca. **3 Tage pro Woche**, Sprints von zwei Wochen. Bei anderer
Kapazität verschieben sich M2–M6 proportional; M1 ist erreicht.

| Meilenstein | Termin | Inhalt | Ergebnis |
|---|---|---|---|
| **M1** Fundament | **erreicht 11.09.2026** | Nx-Workspace, galaxy Auth (MFA-fähig), Design System, i18n, Admin-Layout, Sitemap-Routen, Area-Modul mit Seed, generierter API-Client, E2E-Suite, Setup-Wizard | Login → Startseite → Übersicht Schiessplätze mit Ampeln läuft |
| **M1b** Kernablauf vorgezogen | **erreicht 11.09.2026** | Berechnungsengine `@slim/lsv` (Kontrollwerte B1.4), Datenmodell Stellungsräume/Quellen/Nutzungen/Empfangspunkte/WLR, Demo-Datensatz `tenant.mock.json`, Masken Schusszahlen 5.11, Details 5.12, Simulation 5.13 (schematische Karte) | «Nutzungen erfassen → Pegel → Ampel → Simulation» läuft für Geissalp; Stand: `docs/anforderungskatalog/umsetzungsstand.md` |
| **M2** Stammdaten und Nutzungen | **Fr 25.09.2026** | Sprint 1: Datenmodell komplett, Seed aus B1.6/B1.7, Datenverwaltung Schiessplatz + Waffen, Schusszahlen-Maske, Excel-Import | Echte 126 Schiessplätze, Nutzungen erfassbar |
| **M3** ELO-Schnittstelle | **Fr 02.10.2026** | Sprint 2 (1 Woche): `GET`/`POST` nach B1 Kapitel 6 in SLIM, Client in ELO, Validierungen, Vertragstest | Nutzung aus ELO erscheint in SLIM |
| **M4** Berechnungsengine | **Fr 16.10.2026** | Sprint 3: Parser WLR/Betriebsdaten, Betriebsdaten-Ableitung (7.4), Verteilung (7.5), Lr nach Anh. 7/9 (7.6), Grenzwerte (7.7), Berechnungen verwalten (5.18–5.21) | Kontrollwerte B1.4 reproduziert, Lärm-Ampel echt |
| **M5** Schiessplatz-Detail, GIS, Simulation | **Fr 30.10.2026** | Sprint 4: Übersicht 5.10 mit Kontingent-Tabelle und Karte (swisstopo, LV95, Empfangspunkte), Details 5.12, Simulation 5.13, erweiterte Konfiguration 5.28 | Vollständiger Kernablauf «Einhaltung prüfen» |
| **M6** Validierung und Lösungskonzept | **Fr 13.11.2026** | Sprint 5: Rollen-E2E, Tabellenkomponente mit Filter/Export, Performance-Messung nach 12.5, Barrierefreiheits-Check, Screenshots, Lösungskonzept-Text (A2, max. 15 Seiten) | **Prototyp abnahmereif, Angebot schreibbar** |

### Kritischer Pfad

```
M1 ─► Datenmodell (S1) ─┬─► ELO-Schnittstelle (S2) ─────────────────┐
                        ├─► Nutzungen + Excel-Import (S1) ─► Betriebsdaten 7.4 (S3) ─► Lr 7.6 (S3) ─► Ampel/Karte/Simulation (S4) ─► Validierung (S5)
                        └─► Berechnungsgrundlage-Import WLR/Betriebsdaten (S3) ─┘
```

Der längste Strang ist **Nutzungen → Betriebsdaten → Beurteilungspegel → Karte**. Die
Schnittstelle (S2) und die Waffen-Stammdaten laufen parallel dazu. Externe Abhängigkeiten:
swisstopo-Kartendienste (öffentlich, kein Blocker), FGDB-Format (bewusst ausserhalb des
Prototyps, Abschnitt 4).

---

## 3. Arbeitspakete pro Sprint

Status: ☐ offen · ◐ teilweise / in Arbeit · ☑ erledigt (Stand 12.09.2026; Details in
`umsetzungsstand.md`). Aufwand in Personentagen (PT), grob – bei ◐ ist der Restaufwand kleiner.

### Sprint 1 – Stammdaten und Nutzungen (M2, 6 PT)

| # | Arbeitspaket | slm | PT | Status |
|---|---|---|---:|---|
| 1.1 | Datenmodell nach B1 Kap. 10: `Schiessplatz` (bestehend `area`) erweitern um Sachplan-Nr., Aktiv, Flag «Gesamtbeurteilung Anh. 7», Stand SPM/MPV/Projekt; neue Entities `Stellungsraum`, `Waffe`, `Kaliber`, `Waffenkategorie` (+ Anh.-7-Kategorie a–f), `KombinationWaffeKaliber` (+ sonARMS-Id), `StellungsraumKombination`, `Kontingent` | 42, 16, 22–25 | 1.5 | ◐ (`schiessplatz`, `stellungsraum`, `stellungsraum_waffe` mit Kontingent vorhanden; Lookups Waffe/Kaliber/Kategorie fehlen) |
| 1.2 | Seed aus Beilage B1.6 «Areal_Grundlagen» (126 Areale / 766 Stellungsräume), «Waffen mil/ziv» und B1.7 Waffenliste (195 sonARMS-IDs); Importskript = späterer initialer Import (`slm 36`) | 36 | 1 | ☐ (heute Demo-Datensatz `tenant.mock.json`, nicht B1.6/B1.7) |
| 1.3 | Datenverwaltung Schiessplatz: Übersicht 5.14, Allgemein 5.15, Stammdaten 5.16 (Kontingente pro Waffe/Kaliber), Zuordnung Waffen 5.17 | 13–17 | 1.5 | ◐ (5.14 Übersicht umgesetzt; 5.15–5.17 Platzhalter) |
| 1.4 | Datenverwaltung Waffen: Waffe/Kaliber 5.22, Kaliber 5.23, Waffe 5.24, Waffenkategorie 5.25 (CRUD, DE/FR/IT-Felder, Aktiv) | 22–25 | 1 | ☐ |
| 1.5 | `Schiessplatznutzung` + `NutzungPosition`; Maske 5.11 (Stellungsraum-Liste, Tabelle, Filter Default laufendes Jahr, Neu/Bearbeiten/Löschen); berechnete Hilfsattribute vorbereiten | 10 | 1 | ☑ (Maske 5.11 inkl. Rückgängig, Dezimalmengen, ELO-Kennzeichnung) |
| 1.6 | Excel-Import nach B1.6 «Erfassung» (Areal, Stellungsraum, Nutzungseinheit, Datum, Zeitraum, Waffenspalten) mit Fehlerbericht | 37 | 0.5 (ExcelJS aus ELO) | ☐ |
| 1.7 | Sperrdatum Schusszahlenerfassung als globale Konfiguration (Teil von 5.28) | 27 | 0.5 | ☐ |

### Sprint 2 – ELO-Schnittstelle (M3, 3 PT)

| # | Arbeitspaket | slm | PT | Status |
|---|---|---|---:|---|
| 2.1 | SLIM `GET /api/public/elo/areas` (oder `integration/elo`): Schiessplätze → Stellungsräume → zulässige Waffenkategorien → Kombinationen mit DE/FR/IT, zustandslos, API-Key/JWT | 28, 30 | 0.5 | ☐ |
| 2.2 | SLIM `POST …/usages`: genau eine Nutzung, Validierung (ISO-Datum, hh:mm auf Viertelstunde, Ende > Start, Feldlängen 20/256, Kombination für Stellungsraum zulässig, Sperrdatum), Statuscodes 201/400/404/500 | 29, 30 | 1 | ☐ |
| 2.3 | ELO als Client: Mapping Areal-Kategorie/Areal → Schiessplatz/Stellungsraum, `userType` → Nutzungskategorie, neues Feld «Anzahl Personen», Viertelstunden-Validierung, Übermittlung beim Abschluss der Meldung, Fehler-Retry | 28–30 | 1 | ☐ |
| 2.4 | Vertragstest: Swagger-Spec als Schnittstellendokumentation, Supertest-Spec für GET/POST, Demo-Ablauf ELO → SLIM | 28 | 0.5 | ☐ |

### Sprint 3 – Berechnungsengine (M4, 6 PT)

| # | Arbeitspaket | slm | PT | Status |
|---|---|---|---:|---|
| 3.1 | Entities `Berechnung`, `Zustand` (ZustandsID, RefJahr, Baujahr vor/nach 1985/gemischt, Flags aktuell / Stand MGDM), `Quelle`, `Immissionspunkt` (x, y, h, Empfindlichkeitsstufe, Gebäude), `WlrEintrag` (Day/Eve: Empfänger, Quelle, Waffe, LAE, LAFmax), `BetriebsdatenA9` (Tag/Abend), `BetriebsdatenA7` (WKa–WKf, Werk-/Sonnhalbtage) | 18, 43 | 1 | ◐ (`immissionsberechnung`, `zustand`, `empfangspunkt`, `wlr_pegel` vorhanden; Betriebsdaten-Entities fehlen) |
| 3.2 | Parser für `.wlr` (Kopf + Tabelle), Betriebsdaten A9/A7 (`//`-Kommentare, `END`), Resultatdateien A9p/A7p (Empfangspunkte mit Koordinaten) aus B1.4; Upload + strukturelle Validierung + Zuordnung zu Stellungsräumen, Abbruch bei unbekanntem Stellungsraum | 19, 45 | 1 | ☐ |
| 3.3 | Betriebsdaten aus Nutzungen (7.4): Anh. 9 Split innerhalb/ausserhalb Werktag (Mo–Fr 07–19, Sa/So/Feiertag, halbe Feiertage anteilig), Anh. 7 Schiesshalbtage pro Waffenkategorie (Mo–Sa, Sonn-/Feiertage), Betrachtungszeitraum 3 wählbare Jahre oder frei, Flag «Gesamtbeurteilung Anh. 7»; Feiertagskalender pro Standort (Kanton) | 31 | 1.5 | ◐ (Werktag-Split, ganze/halbe Feiertage, Nutzungskategorien im Kernel; 3 Referenzjahre und Feiertagskalender je Standort offen) |
| 3.4 | Verteilung auf Quellen (7.5) im Verhältnis der Betriebsdaten der Berechnungsgrundlage | 32 | 0.5 | ◐ (1:1 Quelle = Stellungsraum × Waffe; `distributeShots` mit O8-Regel; Schusslinien offen) |
| 3.5 | Beurteilungspegel (7.6): `gemw`, `esm`, Lr Anh. 9 und Anh. 7 exakt nach den Excel-Formeln; Unit-Tests gegen die Kontrollwerte aus B1.4 | 33 | 1 | ☑ (95 Tests gegen B1.4, metamorphe ×10-Tests) |
| 3.6 | Grenzwertvergleich (7.7): PW/IGW je Empfindlichkeitsstufe (Tabelle LSV Anh. 7/9 als Konfiguration) und Baujahr; Ampel pro Empfangspunkt und Aggregation auf den Schiessplatz; `noiseStatus` des Area-Moduls wird daraus abgeleitet | 34 | 0.5 | ☑ (Rundung ganze dB, Baujahr-Regel, `incomplete`; Grenzwerte noch Konstante) |
| 3.7 | Masken Berechnungen 5.18 (Übersicht, aktueller Zustand / Stand MGDM), 5.19 (Import), 5.21 (Details je Stellungsraum); Export 5.20 nur Schusszahlen-CSV | 18–21 | 0.5 | ☐ |

### Sprint 4 – Schiessplatz-Detail, GIS, Simulation (M5, 5 PT)

| # | Arbeitspaket | slm | PT | Status |
|---|---|---|---:|---|
| 4.1 | Kartenkomponente im Design System: swisstopo Light/Imagery Base Map, LV95-Koordinatenanzeige, Massstab, Zoomstufen, Layer-Konfiguration als JSON, Marker mit Popup, Vollansicht in neuem Tab, PDF-Export (Basisvariante) | 2 | 1.5 | ☐ |
| 4.2 | Schiessplatz – Übersicht 5.10: Beurteilung Lärmbelastung (beide Ampeln, Regelwerk), Stand SPM/MPV/Projekt, Kontingent-Tabelle (Soll, Ist laufendes Jahr, Ist Ø 3 Jahre, Farben 100 %/125 %), Karte mit Empfangspunkten; `quotaStatus` wird berechnet statt gespeichert | 9, 8 | 1 | ☐ |
| 4.3 | Schiessplatz – Details 5.12: Karte + Detailbereich pro Empfangspunkt (Lr vs. PW/IGW je Anhang) | 11 | 0.5 | ☑ (schematische Karte; GIS in 4.1) |
| 4.4 | Simulation 5.13: Tabelle Stellungsraum × Kombination mit Schuss innerhalb/ausserhalb Werktag, überschreiben, zurücksetzen, «Simulation ausführen» (Anh. 9) → Karte | 12 | 1 | ☑ |
| 4.5 | Erweiterte Konfiguration 5.28 komplett: Handbuch-Upload (PDF, im Hauptmenü verlinkt), Ampel-Schwellenwerte und -Farben (Plangenehmigung, Empfangspunkte) | 27, 53 | 0.5 | ☐ |
| 4.6 | Startseite mit echten Zahlen (Anzahl Plätze nach Ampel, Datenverwaltung-Zähler inkl. Waffen) und Hinweis «Handlungsbedarf» | 7 | 0.5 | ◐ (Kacheln mit Zählern aus dem Seed, Ampel-Zahlen noch nicht aus der Berechnung) |

### Sprint 5 – Validierung und Lösungskonzept (M6, 5 PT)

| # | Arbeitspaket | slm | PT | Status |
|---|---|---|---:|---|
| 5.1 | Tabellenkomponente: Textsuche, Sortierung, Mehrfachselektion, Spaltenfilter (Text/Zahl/Datum/Diskret inkl. leer), CSV/Excel-Export mit aktiven Filtern, persistente Einstellungen pro Benutzer | 3, 50 | 1.5 | ◐ (Nutzungstabelle: Filter/Sortierung/Gruppierung/Mehrfachauswahl; generische Komponente + Export offen) |
| 5.2 | Rollen nach 8.1.2 als galaxy-Apps/Rollen: vier Seed-Benutzer, Rechte pro Schiessplatz (W/R-O), Ausblenden nicht autorisierter Funktionen; E2E pro Rolle | 26, 35, 50 | 1 | ◐ (Seed + Demo-Konten, W/R-O in der API; Frontend-Rechte und e2e je Rolle offen) |
| 5.3 | Benutzerverwaltung 5.26 auf Basis der galaxy-Admin-Seiten aus ELO (Users/Roles/Apps) | 26 | 0.5 | ☑ (Masken aus ELO, Rollen-Keys, Logbuch) |
| 5.4 | Performance-Messung nach 12.5 (Suche, Filter, Details, Berechnung) mit k6 aus ELO; Berechnung in Worker/Queue, falls > 5 s | 54 | 0.5 | ◐ (Kernel-Benchmark ≈ 92 ms bei Zielvolumen; k6-Messung der Masken offen) |
| 5.5 | Exporte: Nutzungen im Format B1.6 (`slm 40`), Gesamtstatistik MPV (`slm 41`), DB-Views für MGDM/ImmoGIS auf PostGIS (`slm 38`) | 38–41 | 0.5 | ☐ |
| 5.6 | Barrierefreiheit-Check (axe, Tastaturbedienung), kontextsensitive Hilfe (Tooltips/Info-Panels aus Locale-Dateien), Handbuch-Gerüst | 52, 53 | 0.5 | ☐ |
| 5.7 | Lösungskonzept nach A2 (max. 15 Seiten): Architektur-Schema, Stack, Sicherheit, Deployment, Schnittstellen, Lärmberechnung, UX, NFA mit Referenz auf die `slm`-Matrix; Screenshots und Demo-Video | – | 1 | ◐ (C2 v0.2 mit Skizzen und Screenshots, Seitenbudget eingehalten; Demo-Video und Firmenentscheide offen) |

Summe Sprints 1–5: **25 PT** (ohne M1).

---

## 4. Bewusst ausserhalb des Prototyps

| Thema | Grund | Im Lösungskonzept |
|---|---|---|
| FGDB-Import/-Export (ESRI File-GeoDB) | Format beim Auftraggeber noch offen (GeoPackage/INTERLIS), Validierung läuft extern über FME | Konzept: Import über GeoPackage/GeoJSON-Konverter (FME oder GDAL), Datenmodell ist bereit (Zustand/Quelle/Immissionspunkt) |
| MGDM-Export (5.27) | In B1 explizit Platzhalter, Bereitstellung über DB-Views | Views in 5.5 zeigen den Weg |
| ELO-Ablösung per QR-Code (Kap. 11, KANN) | Bereits als ELO-Wizard `/w` produktiv | Verweis auf ELO, Option offerieren |
| Gebäude, Isophonen, Perimeter auf der Karte | In B1 «optional zu offerieren» | als Option, Layer-Konfiguration vorhanden |
| Backup-Monitoring, Break-Glass-Admin, AGOV | Betriebsthemen (`slm 56`, `slm 57`) | Konzept aus ELO Si001 übernehmen |
| Mehrere Anlagen pro Schiessplatz (7.3) | fachlich beim Auftraggeber offen | als Annahme dokumentieren: eine Anlage pro Schiessplatz |

---

## 5. Demo-Skript (Abnahme M6)

1. Login als Fachspezialist KOMZ Lärm (MFA-Code aus Mail), Mandant wählen.
2. Startseite: Hinweis «3 Schiessplätze brauchen Aufmerksamkeit», Kacheln mit echten Zahlen.
3. Übersicht Schiessplätze: Suche «Bière», Statusfilter «Nur Handlungsbedarf», Export CSV.
4. Schiessplatz Bière – Übersicht: Kontingent-Tabelle (rot bei 125 %), Karte mit Empfangspunkten, Popup E1 mit Lr und Grenzwert.
5. Schusszahlen: Nutzung erfassen (Viertelstunden, Kombination nur aus zulässiger Liste), Ampel ändert sich.
6. ELO: dieselbe Meldung im Wizard erfassen, in SLIM erscheint sie in der Tabelle.
7. Datenverwaltung – Berechnungen: WLR-Day/Eve und Betriebsdaten der Demo hochladen, Zustand als aktuell setzen, Details je Stellungsraum, Lr E1 = 60.7 dB.
8. Simulation: Schusszahlen verdoppeln, ausführen, Empfangspunkt E1 wird rot.
9. Sprache FR, Dark Mode, Smartphone-Ansicht (Tabbar, Tabelle als Karten).
10. Login als Interessent: nur Lesen; als Verantwortlicher Thun: nur Thun sichtbar; als Admin: erweiterte Konfiguration mit Schwellenwerten.

---

## 6. Nachweis-Matrix `slm` → Prototyp

Status: ☑ M1 erledigt · S1–S5 = geplanter Sprint · LK = nur im Lösungskonzept beschrieben.

Die Playwright-Nachweise je Kriterium werden in `apps/app-e2e/src/criterias/` gesammelt
(Skelett, Annotation `slm` / `acceptance`; Projekt `criterias`, siehe dortiges README).

| slm | Kurzinhalt | Nachweis |
|---|---|---|
| 1 | Auswahllisten durch Admin pflegbar | S1 (Lookup-Entities mit Aktiv) |
| 2 | GIS-Viewer (Massstab, Zoom, LV95, Hintergrundkarten, PDF) | S4 |
| 3 | Tabellenfunktionen inkl. Export | S5 |
| 4 | Ansichten ohne Berechnungsgrundlage | ☑ (`none`-Status; Details/Simulation zeigen Leerzustand ohne Zustand) |
| 5, 6 | Deep Links mit Berechtigungsprüfung | ☑ (`APP_ROUTES`, `adminGuard`) + S5 Rollen |
| 7 | Startseite | ☑ + S4 (echte Zahlen) |
| 8 | Übersicht Schiessplätze mit Ampeln, nur berechtigte | ☑ (Seed-Status) → S4 (berechnet), S5 (Rechte) |
| 9 | Schiessplatz-Übersicht (Lärm, Kontingent, Karte) | S4 |
| 10 | Schusszahlen anzeigen/erfassen/bearbeiten | ☑ Maske 5.11 (Erfassen/Bearbeiten/Löschen mit Rückgängig) · S1 Excel-Import |
| 11 | Details Empfangspunkte | ☑ Maske 5.12 (schematische Karte) · S4 GIS |
| 12 | Simulation | ☑ Maske 5.13 |
| 13–15 | Datenverwaltung Schiessplatz Übersicht/Allgemein/Stellungsräume | S1 |
| 16 | Stammdaten + Kontingente | S1 |
| 17 | Zuordnung Waffen | ☑ Datenmodell `stellungsraum_waffe` (Seed) · S1 Maske |
| 18 | Berechnungen und Zustände, aktueller Stand / MGDM | ☑ Datenmodell `zustand` (isCurrent/isMgdm) · S3 Maske |
| 19 | Import GDB + WLR + Betriebsdaten | S3 (WLR/Betriebsdaten), GDB = LK |
| 20 | Export GeoDB + CSV | S3 (CSV), GeoDB = LK |
| 21 | Berechnungsdetails je Stellungsraum | S3 |
| 22–25 | Waffe/Kaliber, Kaliber, Waffe, Waffenkategorie | S1 |
| 26 | Benutzerverwaltung rollenbasiert | S5 |
| 27 | Erweiterte Konfiguration | S1 (Sperrdatum) + S4 |
| 28–30 | ELO-Schnittstelle | S2 |
| 31 | Betriebsdaten aus Nutzungen | ☑ `@slim/lsv` (Werktag-Split, Halbtage) |
| 32 | Verteilung auf Quellen | ☑ 1:1 (Quelle = Stellungsraum × Waffe) · S3 Schusslinien |
| 33 | Beurteilungspegel Anh. 7/9 | ☑ Kontrollwerte B1.4 (95 Tests) |
| 34 | Grenzwertvergleich und Einfärbung | ☑ ES/Baujahr-Regel, Ampel |
| 35 | Vier Rollen, MFA/AGOV | ☑ MFA (galaxy) + S5 Rollen; AGOV = LK |
| 36 | Initialer Stammdatenimport | ☑ Demo-Datensatz `tenant.mock.json` · S1 B1.6/B1.7 |
| 37 | Excel-Import Schusszahlen | S1 |
| 38 | Relationale DB mit Geometrie, Views | S5 (PostGIS, Views) |
| 39–41 | Exporte CSV, Nutzungen, Gesamtstatistik | S5 |
| 42–44 | Datenmodell entkoppelt | ☑ Entities + ERD (`uml.mmd`) · S1 Rest |
| 45 | Import bricht bei unbekanntem Stellungsraum ab | S3 |
| 46–49 | ELO-Ablösung QR (KANN) | LK (ELO-Wizard) |
| 50 | UI-Konzept, persistente Einstellungen, Rollen-GUI | ☑ Design System + S5 |
| 51 | DE/FR/IT, Browser-Default, persistent | ☑ (de/fr/it/en) |
| 52 | Ergonomie, Barrierefreiheit | S5 Check |
| 53 | Handbuch, kontextsensitive Hilfe ≤ 2 s | S4 Upload + S5 Hilfe |
| 54 | Performance bis 10 Nutzer, Ressourcen-Isolation | S5 Messung |
| 55 | Wartbare Architektur, Admin-Konfiguration | ☑ (Nx, Facades, Konfig-Entities) |
| 56 | MFA, Autorisierung, Login-Logging, Break-Glass | ☑ MFA/Logging (galaxy), Break-Glass = LK |
| 57 | Backup-Überwachung | LK (aus ELO Si001) |
