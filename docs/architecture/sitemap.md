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
| … › Schiessplatz-Kontext (Wechsler, Aktiv-Badge, Reiter Allgemein / Zuordnung Waffen / Berechnungen) | `/admin/data-management/area/:areaId/*` (Ziele der Absprünge aus 5.14, `APP_ROUTES.admin.dataManagement.area.*Of(id)`) | `views/admin/data-management/area/_context` | `admin` | `area` | 41 | umgesetzt (Suche über Bezeichnung / Koordinationsabschnitts-Nr. / Sachplan-Nr., Unterseite bleibt beim Wechsel erhalten) |
| … › Allgemein › Übersicht (5.15)                       | `/admin/data-management/area/:areaId/general/overview`                                                    | `views/admin/data-management/area/general/overview` | `admin` | `data-area` (`GET admin/data/area/:areaId`) | 41 | umgesetzt (`slm 14`, `slm 15`: Detailansicht inkl. Baujahr aus dem aktuellen Zustand, Stellungsraum-Tabelle mit Freitextsuche über Nr./Bezeichnung/Aktiv, Sortierung, Räume ohne Koordinationsabschnitts-Nr. zuletzt) |
| … › Allgemein › Stammdaten (5.16)                      | `/admin/data-management/area/:areaId/general/master-data`                                                 | `views/admin/data-management/area/general/master-data` | `admin` | `data-area` (`PATCH …`, `POST/PATCH …/quota`, `POST …/quota/:id/delete`) | 41 | umgesetzt (`slm 16`: Kerndaten, Aktiv, Berechnungsart Anhang 7, Klassierung, Stände, Plangenehmigung; Kontingente je Kombination mit Dialog, Löschschutz «ein Kontingent je Kombination», Hinweis auf zulässige Kombinationen ohne Kontingent; Guard für ungespeicherte Änderungen; Lesemodus ohne Schreibrecht) |
| … › Zuordnung Waffen eines Schiessplatzes (5.17)     | `/admin/data-management/area/:areaId/weapon-assignment`                                                   | Platzhalter im Kontext                     | `admin` | `area`                                   | 48                           | Platzhalter |
| … › Stammdaten (ohne Schiessplatz)                     | `/admin/data-management/area/master-data`                                                                 | dito                                       | `admin` | `area`                                   | 41                           | Platzhalter |
| … › Zuordnung Waffen                                   | `/admin/data-management/area/weapon-assignment`                                                           | dito                                       | `admin` | `area-weapon`                            | 41                           | Platzhalter |
| … › Berechnungen › Übersicht (5.18)                    | `/admin/data-management/area/:areaId/calculations/overview` (Ziel von `…/calculations`)                    | `views/admin/data-management/area/calculations` (Reiterleiste `dm-calc`, Seiten `overview` / `import` / `export` / `details`) | `admin` | `data-calculations` (`admin/data/area/:areaId/calculations/*`) | 42 `ADMIN_DATA_CALCULATIONS` | umgesetzt (`slm 18`: Tabelle der Immissionsberechnungen mit Suche, Detailansicht mit Bezeichnung / Lieferantin / Lieferdatum / Beschreibung / Berechnungsdatei, Zustände mit Zustand ID, RefJahr, Zeiger «aktuell» / «Stand MGDM» mit Bestätigung, Baujahr Anlageteile je Zustand; Löschen mit Löschschutz aktuell / MGDM / Berechnungsläufe; Guard für ungespeicherte Änderungen; Lesemodus) |
| … › Berechnungen › Import (5.19)                       | `/admin/data-management/area/:areaId/calculations/import`                                                 | dito                                       | `admin` | `data-calculations` (`POST …/import/validate`, `POST …/import`, `POST …/state/:id/{wlr,operating-data}`) | 42 | umgesetzt (`slm 19`, `slm 45`: Berechnungsdatei (validierte FGDB als JSON) wird im Browser strukturell geprüft, von der API ohne Schreiben validiert (Befunde / Warnungen / Zähler) und erst nach fehlerfreier Validierung importiert; je Zustand Upload WLR DAY / NIGHT (`.wlr`, Zeitgruppe aus dem Dateinamen) und Betriebsdaten Anhang 9 / 7 mit Ergebnis übernommen / ersetzt / unbekannt / Fehler) |
| … › Berechnungen › Export (5.20)                       | `/admin/data-management/area/:areaId/calculations/export`                                                 | dito                                       | `admin` | `data-calculations` (`POST …/export/states`, `GET/POST …/export/shots`, `POST …/state`) | 42 | umgesetzt (`slm 20`: Auswahl der Zustände → «Export GeoDB» als wieder importierbares JSON-Bündel (FGDB folgt mit GDAL), Kalenderjahre mit Schusszahlen → CSV, «Neuen Berechnungszustand anlegen» mit neuer Zustand ID `<KA-Nr>_<n>`, optional in neuer Immissionsberechnung) |
| … › Berechnungen › Details (5.21)                      | `/admin/data-management/area/:areaId/calculations/details?state=<id>`                                     | dito                                       | `admin` | `data-calculations` (`GET …/state/:id/details`) | 42 | umgesetzt (`slm 21`: Zustand wählen, Stellungsräume mit Suche, je Raum Reiter WLR DAY / WLR NIGHT (Empfänger, Gebäude, Quelle, Waffe, Elevation, LAE(MK/GK/Det), LAE, LAFmax), Betriebsdaten Anhang 9 / Anhang 7) |
| Waffen › Waffe/Kaliber (5.22)                          | `/admin/data-management/weapons/combination` (Ziel von `/weapons`)                                        | `views/admin/data-management/weapons` (eine Maske, vier Listen) | `admin` | `data-weapons` (`admin/data/weapons/*`) | 43 `ADMIN_DATA_WEAPONS` | umgesetzt (`slm 22`: Tabelle mit Filtern Kategorie / Waffe / Kaliber, Detail mit DE/FR/IT, Kaliber, Waffe, abgeleiteter Kategorie, Zuordnung sonARMS mit Vorschlägen aus den Berechnungsständen, Aktiv, Verwendung je Schiessplatz) |
| Waffen › Kaliber (5.23)                                | `/admin/data-management/weapons/caliber`                                                                  | dito                                       | `admin` | `data-weapons`                           | 43                           | umgesetzt (`slm 23`: DE/FR/IT, ALN-Nr., SAP-Nr., Einheit Stück/kg, Aktiv) |
| Waffen › Waffe (5.24)                                  | `/admin/data-management/weapons/weapon`                                                                   | dito                                       | `admin` | `data-weapons`                           | 43                           | umgesetzt (`slm 24`: Waffenkategorie, Waffenkategorie Anh. 7 LSV a–f oder «keine Zuordnung möglich») |
| Waffen › Waffenkategorie (5.25)                        | `/admin/data-management/weapons/weapon-category`                                                          | dito                                       | `admin` | `data-weapons`                           | 43                           | umgesetzt (`slm 25`: DE/FR/IT, Aktiv, Schlüssel) — gemeinsam: Suche, Sortierung, XLSX-Export, Löschen mit Bestätigung und Löschschutz (409 mit Anzahl Verwendungen → «Inaktiv setzen»), Guard für ungespeicherte Änderungen, Lesemodus ohne Schreibrecht |
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
  markierte Schiessplätze); Schiessplätze → «Alle Schiessplätze», Schiessplatz-Wechsler (Auswahlkarte mit Name,
  Nummer, Stern; Popover mit Suche, Favoriten und weiteren berechtigten Plätzen, Tastaturbedienung,
  `views/admin/_layout/area-switcher.component.ts`) → Übersicht / Schusszahlen / Details / Simulation des
  gewählten Platzes (folgt der Route, Simulation nur mit Recht 46); Datenverwaltung → Schiessplatz,
  Waffen, MGDM Export, Erweiterte Systemeinstellungen; Benutzerverwaltung → Benutzer, Rollen, Logbuch, Apps.
  Einträge erscheinen nur mit App-Recht der Sitzung (`core/access/access.facade.ts` über `GET admin/access`,
  `SLIM_APP_ID`); dieselbe Antwort schaltet die Masken der Datenverwaltung mit Recht `read` in den Lesemodus.
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

### Datenverwaltung › Schiessplatz › Allgemein (Kapitel 5.15 / 5.16)

Kontextleiste (Rückweg «Schiessplätze verwalten», Wechsler mit Suche, Aktiv-Badge, Reiter Allgemein · Zuordnung Waffen
· Berechnungen), darunter die Reiter Übersicht / Stammdaten. Übersicht: Detailansicht wie Abbildung 26 (Baujahr der
Anlageteile aus dem aktuell gültigen Zustand) und die Stellungsraum-Tabelle mit Freitextsuche, Sortierung und der
Anzahl Räume ohne Koordinationsabschnitts-Nr. Stammdaten: Formular mit Pflichtfeldern Bezeichnung und
Koordinationsabschnitts-Nr. (oder eigener Schlüssel), Aktiv, Berechnungsart Anhang 7, Klassierung und Stände (Codes in
`area-master-data.enums.ts`, Labels in `admin.dm_area_general.options.*`), gültige Plangenehmigung; Kontingente je
Kombination Waffe/Kaliber mit Dialog (zulässige Kombinationen zuerst, bereits belegte nicht wählbar, Grundlage =
Plangenehmigung), Löschen mit Bestätigung, Hinweis auf zulässige Kombinationen ohne Kontingent (Soll 0, B1 5.10). Jede
Kontingent-Änderung setzt die Kontingent-Ampel neu; alles wird protokolliert. Ohne Schreibrecht (App 41) ist die Maske
gesperrt und ein Hinweis erscheint.

### Datenverwaltung › Waffen (Kapitel 5.22–5.25)

Eine Maske mit vier Reitern (Zähler), links Tabelle (Suche über die Spalten und FR/IT, Filter Kategorie / Waffe /
Kaliber bei den Kombinationen, Sortierung), rechts das Detailformular (auf dem Telefon als Sheet): mehrsprachige
Bezeichnung, die Felder der Liste, Aktiv, bei Kombinationen Zuordnung sonARMS (Vorschläge = Waffensysteme der
importierten Schusslinien) und Verwendung je Schiessplatz, Erfassung / letzte Änderung. Neu, Speichern, Abbrechen,
Löschen mit Bestätigung; verwendete Einträge lehnt die API mit 409 und der Anzahl Verwendungen ab, die Maske bietet
«Inaktiv setzen» an. XLSX-Export mit einem Blatt je Liste.

### Datenverwaltung › Schiessplatz › Berechnungen (Kapitel 5.18–5.21)

Im Schiessplatz-Kontext die Reiterleiste Übersicht / Import / Export / Details (B1 Abbildung 29–35). Die Fachregeln
(Zeiger nur auf Zustände mit Modell, Löschschutz, Aufteilung der Details in vier Reiter, Strukturprüfung der
Berechnungsdatei, Zeitgruppe / Anhang aus dem Dateinamen) liegen in `core/data-calculations/calculations.logic.ts`
(reine Funktionen mit Unit-Tests); das Parsen der WLR- und Betriebsdaten-Dateien und das Export-Bündel in
`modules/data-calculations/calculation-files.service.ts` der API. Jede Mutation lädt die Übersicht neu, damit die
Zeiger nie veralten.

### Login mit Deep Link

`adminGuard` (und der Refresh-Interceptor der auth-ui) schicken einen Besucher ohne Sitzung nach
`/auth/login?returnUrl=<Seite>`. Die Login-Seite parkt das Ziel je Tab in `sessionStorage` (`views/auth/return-url.ts`,
llumi-Muster), der Mandanten-Wähler springt nach dem Login dorthin (`navigateByUrl`, Query-String und Fragment bleiben);
nur interne `/admin`-Pfade werden akzeptiert. Nachweis: `c08-sitemap.spec` (Projekt `criterias`).

## Offene Punkte

1. Hierarchie von _Allgemein_ / _Berechnungen_ unter _Schiessplatz_ (aus der Einrückung
   der Abbildung abgeleitet).
2. _Kaliber/Waffe_ als Zwischenebene über Kaliber, Waffe, Waffenkategorie – oder eigener Eintrag?
3. Sachplan-Nr.: im Mock leer («—»); Herkunft und Pflichtfeld klären.
4. Ampel-Status: aktuell Spalten am Schiessplatz (`quotaStatus`, `noiseStatus`); sobald das
   Berechnungsmodul steht, werden sie daraus abgeleitet.
5. Benutzer / Systemeinstellungen: galaxy-Module (`@app-galaxy/auth-api`, `core-api`) sind
   im Backend bereits eingebunden; UI folgt.
