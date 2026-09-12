# Struktur der Benutzeroberfläche (Sitemap)

Quelle: Anforderungskatalog, _Abbildung 18 – Struktur Benutzeroberfläche (Sitemap)_.
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

Konventionen (wie ELO / alco-map):

- **Pfade sind englisch** und stehen zentral in `libs/shared/constants/src/lib/app-routes.constants.ts`
  (`ROUTE_SEGMENT` für den Router, `APP_ROUTES` für Links, Guards, Redirects). Dieselbe Konstante
  nutzt das Backend für den App-Katalog (`apps/api/src/mocks/main.mock-data.ts` →
  `API_APPS_MAPPING`, `API_CATEGORY_MAPPING`, `API_MOCK_DATA.customApps`).
- **`/auth/*`** = öffentliche Anmeldeseiten (`views/auth`, `app-auth-layout`), aus ELO / alco-map übernommen
  (Login, 2FA, Mandantenwahl, Passwort zurücksetzen, E-Mail bestätigen) — Backend ist `@app-galaxy/auth-api`.
- **`/admin/*`** = alles hinter dem Login (`views/admin`, `app-admin-layout` mit Topbar / Sidebar / Tabbar),
  Guard `adminGuard` in `app.routes.ts`, `returnUrl` beim Login.
- Angular-Views unter `apps/app/src/app/views/admin/<bereich>/`, NestJS-Module unter
  `apps/api/src/modules/<modul>/`. Menü-Texte aus `common.locale.json` → `menu.*`.
- Begriff **Area = Schiessplatz** (ELO-Namenskonvention) in Code, Routen und API.

| Sitemap                                                | Route                                                                                                     | View (apps/app)                            | Locale  | API-Modul                                | App-Id                       | Status      |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------- | ---------------------------------------- | ---------------------------- | ----------- |
| Anmeldung                                              | `/auth/login`, `/auth/two-fa-login`, `/auth/tenant-login`, `/auth/recover-password`, `/auth/verify-email` | `views/auth/*`                             | `auth`  | `@app-galaxy/auth-api`                   | –                            | umgesetzt   |
| Home                                                   | `/admin`                                                                                                  | `views/admin/home`                         | `home`  | `area` (summary, dashboard)              | –                            | umgesetzt   |
| Übersicht Schiessplätze                                | `/admin/area`                                                                                             | `views/admin/area/area-overview`           | `area`  | `area` (`GET admin/area`)                | 40 `ADMIN_AREA`              | umgesetzt   |
| Schiessplatz – Übersicht                               | `/admin/area/:id/overview`                                                                                | `views/admin/area/_context` (Kontextleiste) + Platzhalter | `area`  | `area`                                   | 40                           | Platzhalter (Kontextleiste umgesetzt) |
| Schiessplatz – Schusszahlen                            | `/admin/area/:id/shots`                                                                                   | `views/admin/area/shots`                   | `area`  | `usage` (`admin/area/:id/usage/*`)       | 40                           | umgesetzt   |
| Schiessplatz – Details                                 | `/admin/area/:id/details`                                                                                 | `views/admin/area/details`                 | `area`  | `calculation` (`…/calculation/assessment`) | 40                         | umgesetzt   |
| Schiessplatz – Simulation                              | `/admin/area/:id/simulation`                                                                              | `views/admin/area/simulation`              | `area`  | `calculation` (`…/calculation/simulation`) | 40                         | umgesetzt   |
| Datenverwaltung › Schiessplatz › «Schiessplätze verwalten» | `/admin/data-management/area/overview`                                                                    | `views/admin/data-management/area`         | `admin` | `area` (CRUD)                            | 41 `ADMIN_DATA_AREA`         | umgesetzt (5.14: Suche inkl. Sachplan-Nr., Filter Aktive/Inaktive/Alle, sortierbare Tabelle, Aktionen Allgemein / Waffen-Zuordnung / Berechnungen; kein «Neuer Schiessplatz») |
| … › Allgemein / Zuordnung Waffen / Berechnungen eines Schiessplatzes | `/admin/data-management/area/:areaId/{master-data,weapon-assignment,calculations}` (Ziele der Absprünge aus 5.14, `APP_ROUTES.admin.dataManagement.area.*Of(id)`) | dito | `admin` | `area` | 41 / 42 | Platzhalter |
| … › Stammdaten                                         | `/admin/data-management/area/master-data`                                                                 | dito                                       | `admin` | `area`                                   | 41                           | Platzhalter |
| … › Zuordnung Waffen                                   | `/admin/data-management/area/weapon-assignment`                                                           | dito                                       | `admin` | `area-weapon`                            | 41                           | Platzhalter |
| … › Berechnungen › Übersicht                           | `/admin/data-management/area/calculations/overview`                                                       | `views/admin/data-management/calculations` | `admin` | `calculation`                            | 42 `ADMIN_DATA_CALCULATIONS` | Platzhalter |
| … › Berechnungen › Import                              | `/admin/data-management/area/calculations/import`                                                         | dito                                       | `admin` | `calculation`                            | 42                           | Platzhalter |
| … › Berechnungen › Export                              | `/admin/data-management/area/calculations/export`                                                         | dito                                       | `admin` | `calculation`                            | 42                           | Platzhalter |
| … › Berechnungen › Details                             | `/admin/data-management/area/calculations/details`                                                        | dito                                       | `admin` | `calculation`                            | 42                           | Platzhalter |
| Waffen › Kaliber                                       | `/admin/data-management/weapons/caliber`                                                                  | `views/admin/data-management/weapons`      | `admin` | `weapon`                                 | 43 `ADMIN_DATA_WEAPONS`      | Platzhalter |
| Waffen › Waffe                                         | `/admin/data-management/weapons/weapon`                                                                   | dito                                       | `admin` | `weapon`                                 | 43                           | Platzhalter |
| Waffen › Waffenkategorie                               | `/admin/data-management/weapons/weapon-category`                                                          | dito                                       | `admin` | `weapon`                                 | 43                           | Platzhalter |
| Benutzerverwaltung › Benutzer                          | `/admin/data-management/users` (+ `create`, `edit/:id`)                                                 | `views/admin/user-management/users`        | `admin` | `@app-galaxy/auth-api` (AdminUsers)      | galaxy 1                     | umgesetzt (aus ELO) |
| Benutzerverwaltung › Rollen                            | `/admin/data-management/roles` (+ `create`, `edit/:id`)                                                 | `views/admin/user-management/roles`        | `admin` | `@app-galaxy/auth-api` (AdminService)    | galaxy 2                     | umgesetzt (aus ELO) |
| Benutzerverwaltung › Apps                              | `/admin/data-management/apps` (+ `create`, `edit/:id`)                                                  | `views/admin/user-management/apps`         | `admin` | `@app-galaxy/auth-api` (AdminAppsTenant) | galaxy 4                     | umgesetzt (aus ELO) |
| Logbuch (`slm 56`)                                     | `/admin/data-management/logs`                                                                             | `views/admin/logs`                         | `admin` | `core/logger` (`admin/logs/*`)           | 49 `ADMIN_LOGS`              | umgesetzt   |
| MGDM Export                                            | `/admin/data-management/mgdm-export`                                                                      | `views/admin/data-management/mgdm-export`  | `admin` | `mgdm-export`                            | 44 `ADMIN_DATA_MGDM_EXPORT`  | Platzhalter |
| Erweiterte Systemeinstellungen                         | `/admin/data-management/system`                                                                           | `views/admin/data-management/system`       | `admin` | `@app-galaxy/core-api` (TenantAppConfig) | 45 `ADMIN_DATA_SYSTEM`       | Platzhalter |
| Styleguide (Entwicklung)                               | `/styleguide`                                                                                             | `views/styleguide`                         | –       | –                                        | –                            | umgesetzt   |

Platzhalter rendern `views/admin/_placeholder` mit Breadcrumbs und Titel, damit
Navigation und Menü bereits jetzt vollständig sind (`views/admin/admin.routes.ts`).

## Navigation (app-admin-layout)

Aus dem Mock `_mocks/home/index.html` und dem ELO-Admin-Shell:

- **Kopfzeile** (alle Geräte): Brand mit Schweizer Kreuz, Organisation (ab Tablet),
  Sprache DE/FR/IT/EN (Desktop im Kopf, Mobile im Hauptmenü), Hell/Dunkel,
  Hauptmenü (Hilfe & Kontakt, Applikation/Version), Benutzermenü (Konto, Einstellungen,
  Mandant wechseln, Abmelden).
- **Seitenleiste** (Desktop ≥ 1024 px, kompakt, Gruppen einklappbar, Zustand je Browser): oben die Marke
  (Logo, SLIM + «Demo», Untertitel) auf Topbar-Höhe; Arbeitsbereich → Startseite, Lesezeichen (mit Stern
  markierte Schiessplätze); Schiessplätze → Übersicht Schiessplätze, Auswahl mit Autocomplete → Übersicht /
  Schusszahlen / Details / Simulation des gewählten Platzes (folgt der Route); Datenverwaltung → Schiessplatz,
  Waffen, MGDM Export, Erweiterte Systemeinstellungen; Benutzerverwaltung → Benutzer, Rollen, Logbuch, Apps.
  Einträge erscheinen nur mit App-Recht der Sitzung (`core/access/access.facade.ts`, `SLIM_APP_ID`).
- **Tabbar** (Mobile): Start, Schiessplatz, Daten, Benutzer.

## Seiten

### Anmeldung (`/auth`)

Übernommen aus ELO / alco-map, Design auf die SLIM-Tokens umgestellt (`auth-layout.component.scss`):
dunkles Marken-Panel auf Desktop, Karte mit Sprache und Hell/Dunkel. Ablauf: Login →
(2FA) → Mandant wählen → `returnUrl` oder `/admin`. Passwort-Reset per Mail-Link,
E-Mail-Bestätigung, erzwungener Passwortwechsel beim ersten Login. Demo-User im Dev:
`APP_DEFAULT_USER` / `APP_DEFAULT_PASSWORD` aus `.env` (Seed in `apps/api/src/mocks`).

### Home (Einstiegsseite)

Begrüssung nach Tageszeit, Name aus der Session, Datum und Anzahl berechtigter Schiessplätze;
Hinweis (Warnung), wenn Plätze «zu prüfen» oder «überschritten» sind, mit Absprung
in die gefilterte Übersicht; drei Kacheln: Schiessplatz-Nutzungen (Ampel-KPIs aus
`GET admin/area/summary`), Datenverwaltung (Zähler aus `GET admin/area/dashboard`),
Auswertungen (in Vorbereitung).

### Übersicht Schiessplätze (Kapitel 5.8 / 5.9)

Breadcrumbs, Titel, Jahresauswahl, Export; Suche (Name / Koordinationsabschnitt-Nr.)
und Statusfilter (Alle, nur Handlungsbedarf, Eingehalten, Zu prüfen, Überschritten,
Keine Daten); Hinweis «Nur berechtigte Schiessplätze»; Tabelle mit Bezeichnung,
Koordinationsabschnitt-Nr., Sachplan-Nr., Kontingent (Ampel), Lärmbelastung (Ampel),
Navigation (Übersicht, Schusszahlen); Zeilenklick öffnet die Schiessplatz-Übersicht;
Pager; Legende. Auf dem Smartphone wird die Tabelle zu Karten (`slim-table--stack`).
Daten: `GET admin/area` (mandantenbezogen, `AreaFacade`).

Ampel-Status (`AreaStatus`, aus dem API-DTO): `ok` Eingehalten · `warn` Zu prüfen ·
`over` Überschritten · `none` Keine Daten. «Handlungsbedarf» = `warn` oder `over` bei
Kontingent oder Lärm.

## Offene Punkte

1. Hierarchie von _Allgemein_ / _Berechnungen_ unter _Schiessplatz_ (aus der Einrückung
   der Abbildung abgeleitet).
2. _Kaliber/Waffe_ als Zwischenebene über Kaliber, Waffe, Waffenkategorie – oder eigener Eintrag?
3. Sachplan-Nr.: im Mock leer («—»); Herkunft und Pflichtfeld klären.
4. Ampel-Status: aktuell Spalten am Schiessplatz (`quotaStatus`, `noiseStatus`); sobald das
   Berechnungsmodul steht, werden sie daraus abgeleitet.
5. Benutzer / Systemeinstellungen: galaxy-Module (`@app-galaxy/auth-api`, `core-api`) sind
   im Backend bereits eingebunden; UI folgt.
