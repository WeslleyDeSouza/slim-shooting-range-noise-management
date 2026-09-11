# Struktur der Benutzeroberfläche (Sitemap)

Quelle: Anforderungskatalog, *Abbildung 18 – Struktur Benutzeroberfläche (Sitemap)*.
Die Einrückung der Abbildung wurde so gelesen; **offene Punkte** sind unten markiert
und mit dem Auftraggeber zu bestätigen.

```
Home
Übersicht Schiessplätze
├── Schiessplatz – Übersicht
├── Schiessplatz – Schusszahlen
├── Schiessplatz – Details
└── Schiessplatz – Simulation
Datenverwaltung
├── Schiessplatz
│   ├── Allgemein
│   │   ├── Übersicht
│   │   ├── Stammdaten
│   │   └── Zuordnung Waffen
│   └── Berechnungen
│       ├── Übersicht
│       ├── Import
│       ├── Export
│       └── Details
├── Waffen
│   └── Kaliber/Waffe
│       ├── Kaliber
│       ├── Waffe
│       └── Waffenkategorie
├── Benutzer
├── MGDM Export
└── Erweiterte Systemeinstellungen
```

## Umsetzung: Routen, Views, API-Module

Konvention wie im ELO-Projekt: fachliche Bereiche unter `/`, Verwaltung unter `/admin`.
Angular-Views liegen unter `apps/app/src/app/views/<bereich>/`, NestJS-Module unter
`apps/api/src/modules/<modul>/`. Menü-Texte kommen aus `common.locale.json` → `menu.*`.

| Sitemap | Route | View (apps/app) | Locale-Sektion | API-Modul (apps/api) | Status |
|---|---|---|---|---|---|
| Home | `/` | `views/home` | `home` | – (Kennzahlen aus `ranges`) | Mock-Daten |
| Übersicht Schiessplätze | `/schiessplaetze` | `views/ranges/ranges-overview` | `ranges` | `ranges` | Mock-Daten |
| Schiessplatz – Übersicht | `/schiessplaetze/:id/uebersicht` | `views/ranges/range-overview` | `ranges` | `ranges` | Platzhalter |
| Schiessplatz – Schusszahlen | `/schiessplaetze/:id/schusszahlen` | `views/ranges/range-shots` | `ranges` | `shots` | Platzhalter |
| Schiessplatz – Details | `/schiessplaetze/:id/details` | `views/ranges/range-details` | `ranges` | `ranges` | Platzhalter |
| Schiessplatz – Simulation | `/schiessplaetze/:id/simulation` | `views/ranges/range-simulation` | `ranges` | `simulation` | Platzhalter |
| Datenverwaltung › Schiessplatz › Allgemein › Übersicht | `/admin/schiessplatz/uebersicht` | `views/admin/range` | `admin` | `admin-range` | Platzhalter |
| … › Stammdaten | `/admin/schiessplatz/stammdaten` | `views/admin/range` | `admin` | `admin-range` | Platzhalter |
| … › Zuordnung Waffen | `/admin/schiessplatz/zuordnung-waffen` | `views/admin/range` | `admin` | `admin-range-weapon` | Platzhalter |
| … › Berechnungen › Übersicht | `/admin/schiessplatz/berechnungen/uebersicht` | `views/admin/calculations` | `admin` | `admin-calculation` | Platzhalter |
| … › Berechnungen › Import | `/admin/schiessplatz/berechnungen/import` | `views/admin/calculations` | `admin` | `admin-calculation` | Platzhalter |
| … › Berechnungen › Export | `/admin/schiessplatz/berechnungen/export` | `views/admin/calculations` | `admin` | `admin-calculation` | Platzhalter |
| … › Berechnungen › Details | `/admin/schiessplatz/berechnungen/details` | `views/admin/calculations` | `admin` | `admin-calculation` | Platzhalter |
| Waffen › Kaliber | `/admin/waffen/kaliber` | `views/admin/weapons` | `admin` | `admin-weapon` | Platzhalter |
| Waffen › Waffe | `/admin/waffen/waffe` | `views/admin/weapons` | `admin` | `admin-weapon` | Platzhalter |
| Waffen › Waffenkategorie | `/admin/waffen/waffenkategorie` | `views/admin/weapons` | `admin` | `admin-weapon` | Platzhalter |
| Benutzer | `/admin/benutzer` | `views/admin/users` | `admin` | `@app-galaxy/auth-api` (wie ELO) | Platzhalter |
| MGDM Export | `/admin/mgdm-export` | `views/admin/mgdm-export` | `admin` | `mgdm-export` | Platzhalter |
| Erweiterte Systemeinstellungen | `/admin/system` | `views/admin/system` | `admin` | `@app-galaxy/core-api` App-Config (wie ELO) | Platzhalter |
| Styleguide (Entwicklung) | `/styleguide` | `views/styleguide` | – | – | umgesetzt |

Platzhalter rendern `views/placeholder` mit Breadcrumbs und Titel, damit Navigation
und Menü bereits jetzt vollständig sind (`apps/app/src/app/app.routes.ts`).

## Navigation (Shell)

Aus dem Mock `_mocks/home/index.html` und dem ELO-Admin-Shell:

- **Kopfzeile** (alle Geräte): Brand mit Schweizer Kreuz, Organisation (ab Tablet),
  Sprache DE/FR/IT/EN (Desktop im Kopf, Mobile im Hauptmenü), Hell/Dunkel,
  Hauptmenü (Hilfe & Kontakt, Applikation/Version), Benutzermenü (Konto, Einstellungen, Abmelden).
- **Seitenleiste** (Desktop ≥ 1024 px): Arbeitsbereich → Startseite, Übersicht Schiessplätze;
  Datenverwaltung → Schiessplatz, Waffen, Benutzer, MGDM Export, Erweiterte Systemeinstellungen.
- **Tabbar** (Mobile): Start, Schiessplatz, Daten, Benutzer.

## Seiten

### Home (Einstiegsseite)

Begrüssung nach Tageszeit, Name, Datum und Anzahl berechtigter Schiessplätze;
Hinweis (Warnung), wenn Plätze «zu prüfen» oder «überschritten» sind, mit Absprung
in die gefilterte Übersicht; drei Kacheln: Schiessplatz-Nutzungen (Ampel-KPIs),
Datenverwaltung (Stammdaten-KPIs), Auswertungen (in Vorbereitung).

### Übersicht Schiessplätze (Kapitel 5.8 / 5.9)

Breadcrumbs, Titel, Jahresauswahl, Export; Suche (Name / Koordinationsabschnitt-Nr.)
und Statusfilter (Alle, nur Handlungsbedarf, Eingehalten, Zu prüfen, Überschritten,
Keine Daten); Hinweis «Nur berechtigte Schiessplätze»; Tabelle mit Bezeichnung,
Koordinationsabschnitt-Nr., Sachplan-Nr., Kontingent (Ampel), Lärmbelastung (Ampel),
Navigation (Übersicht, Schusszahlen); Zeilenklick öffnet die Schiessplatz-Übersicht;
Pager; Legende. Auf dem Smartphone wird die Tabelle zu Karten (`slim-table--stack`).

Ampel-Status (`RangeStatus`): `ok` Eingehalten · `warn` Zu prüfen · `over` Überschritten ·
`none` Keine Daten. «Handlungsbedarf» = `warn` oder `over` bei Kontingent oder Lärm.

## Offene Punkte

1. Hierarchie von *Allgemein* / *Berechnungen* unter *Schiessplatz* (aus der Einrückung
   der Abbildung abgeleitet).
2. *Kaliber/Waffe* als Zwischenebene über Kaliber, Waffe, Waffenkategorie – oder eigener Eintrag?
3. Sachplan-Nr.: im Mock leer («—»); Herkunft und Pflichtfeld klären.
4. Benutzer / Systemeinstellungen: Übernahme der ELO-Module (`@app-galaxy/auth-api`,
   `core-api`) oder eigene Umsetzung.
