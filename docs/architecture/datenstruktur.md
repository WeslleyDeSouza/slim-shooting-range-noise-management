# API und App: Datenstruktur

> Physische Tabellen sind deutsch (B1 12.2, `slm 51`) und folgen dem fachlichen Datenmodell B1 Kap. 10 (Abb. 43): übergeordnete Referenzstruktur `schiessplatz`, `stellungsraum`, `waffe`, `kaliber`, `waffenkategorie`, `waffe_kaliber_kombination`, `stellungsraum_kombination`, `kontingent`, `feiertag`; Nutzungen `nutzung`, `nutzung_position` (ohne Zustandsbezug, `slm 44`); Zustandsebene `immissionsberechnung` → `zustand` → `zustand_anlageteil`, `schusslinie`, `quelldaten_anhang9`, `quelldaten_anhang7`, `untersuchungsperimeter`, `ausbreitungsberechnung`, `gebaeude`, `immissionspunkt`, `wlr_pegel`, `isophonen`, `betroffene_analyse`, `hindernis`, `hochblende`, `schuetzenhaus`, `massnahmen_*`; dazu `berechnungslauf`, `schiessplatz_benutzer`, `logbuch`, `demo_datensatz`. Spalten sind deutsch in der Zustandsebene und im `berechnungslauf` (`ZustandAnlageteil.coordinationSectionNo` → Spalte `koord_nr`, Mapping in `DbPlatformColumn({ name })`); die Spalten der Referenzstruktur und der Nutzungen sind noch englisch (nächster Schritt, gleiches Muster). Die Klassen und Properties im Code bleiben englisch. Die galaxy-Tabellen (`auth_user`, `app_role`, `tenant_user_role`, …) kommen aus der Bibliothek.

## Ordnerstruktur & Architektur

Nx-Workspace, gleicher Aufbau wie `pwa-elo-shot-counting` (ELO) und `alco-map`.

### Backend (apps/api) – NestJS 12

```
apps/api/src/
├── main.ts                  # Bootstrap: env-loader, galaxy CORS/Security, Swagger, ValidationPipe, trust proxy
├── app.module.ts            # galaxy Auth/Tenant-Module + eigene Module; TypeORM-Entities (autoLoadEntities aus)
├── core/
│   ├── env-loader.ts        # lädt .env VOR allen Imports
│   ├── guards/              # AuthThrottlerGuard (/api/auth, /api/public)
│   ├── health-check/        # /api/health, /alive, /ready (Terminus)
│   └── logger/              # Logbuch core_log_user (slm 56): LoggerService, AUTH_API_LOGGER-Brücke, RequestOriginMiddleware (IP/Gerät), admin/logs
├── common/docs/             # Swagger (/api/docs) + Generierung von @ui-slim/apiClient, ERD (/erd → docs/architecture/uml.mmd)
├── mocks/                   # API_APPS_MAPPING, API_CATEGORY_MAPPING, API_MOCK_DATA (Seed), E-Mail-Parser
│   └── tenant/              # «SLIM Demo»-Datensatz: tenant.mock.json, tenant-dataset.ts, demo-dataset.seed.ts, Marker-Entity
└── modules/                 # Geschäftslogik-Module (siehe sitemap.md)
    ├── area/                # Referenzstruktur: Schiessplätze, Stellungsräume, Waffen/Kaliber/Kombinationen, Kontingente, Feiertage
    ├── data-area/           # Datenverwaltung › Schiessplatz › Allgemein (5.15/5.16): Lesemodell, Stammdaten-Update, Kontingent-CRUD (keine eigenen Tabellen)
    ├── data-weapons/        # Datenverwaltung › Waffen (5.22–5.25): CRUD mit Löschschutz, XLSX-Export (keine eigenen Tabellen)
    ├── data-calculations/   # Datenverwaltung › Schiessplatz › Berechnungen (5.18–5.21): Lieferungen / Zustände, Validierung + Import, WLR- und Betriebsdaten-Upload, Exporte, Details (Parser in calculation-files.service.ts)
    ├── access/              # GET admin/access: App-Rechte der Sitzung aus den galaxy-Tabellen
    ├── usage/               # Schiessplatz-Nutzungen (5.11): overview / create / update / delete / restore
    ├── calculation/         # Zustandsebene (FGDB-Objekte, Quelldaten, WLR), Import 5.19, Zeiger aktuell/MGDM, AssessmentService (5.12), SimulationService (5.13), Berechnungslauf, AreaStatusService
    └── auth-audit/          # galaxy Lifecycle-Hooks (Benutzer/Rollen/Apps) → Logbuch
```

#### Modul-Muster (wie ELO)

Jedes Modul unter `modules/<name>/` mit `controllers/`, `entities/`, `dto/`, `db/<name>.database.ts`,
`<name>.service.ts`, `<name>.module.ts`. Das Modul exportiert
`static DBOptions = { entities: [...] }`, das in `app.module.ts` in die TypeORM-Entity-Liste
gespreadet wird. Entities erben von `SlimBaseEntity` (`@api-slim/common`, `base.entity.ts`: uuid `id`,
Audit-Spalten, Soft-Delete), das seinerseits die galaxy `TenantBaseEntity` (`tenantId`, `self`,
`setLastEntryId*`) erweitert.
Admin-Controller sind mit `AuthGuard('jwt')`, `TenantGuard`, `AppsRolesGuard(API_APPS_MAPPING.X)`
und `ReplayGuard` geschützt; `@GetTenantId()` liefert den Mandanten. DTOs mit
`class-validator`, Controller mit `@nestjs/swagger` dokumentiert → daraus entsteht der
Angular-Client (`npm run ng-swagger`).

Demo-Daten liegen **nur im Backend**: `API_MOCK_DATA.initMockData()` (nicht in Produktion)
seedet Mandant, Demo-User, App-Katalog + Rollen und schreibt danach den Datensatz
`mocks/tenant/tenant.mock.json` («SLIM Demo», llumi-Muster): Schiessplätze mit Stellungsräumen,
zulässigen Waffen (= Quellen), Empfangspunkten, Berechnungszuständen (WLR-Pegel) und den
Nutzungen des laufenden Jahres (`{{year}}`-Platzhalter). Ein Marker (`demo_datensatz`) merkt sich
Version und Jahr; Jahreswechsel, Versionssprung oder `DEMO_RESEED=1` schreiben den Mandanten neu,
`DEMO_SEED=0` lässt ihn in Ruhe; mit `APP_ENV=production` wird nur bei explizitem `DEMO_SEED=1` geseedet (gehostete Demo-Instanz). Generator: `tools/tenant-dataset.generator.ts`.

### Frontend (apps/app) – Angular 22

```
apps/app/src/
├── main.ts / bootstrap.ts   # Locale de-CH, galaxy auth-ui Store (einzige NgRx-Stelle), Interceptor
├── index.html               # Theme vor dem ersten Paint (localStorage slim.theme)
├── styles.scss              # @use 'slim' (Design System)
├── app/
│   ├── app.config.ts        # Router, HttpClient, provideTranslate, provideAuth, ApiConfiguration, provideDesignSystem
│   ├── app.routes.ts        # /auth, /admin (adminGuard), /styleguide, 404 – Segmente aus ROUTE_SEGMENT
│   ├── common/              # Wiederverwendbare App-Komponenten (Sprache, Status-Pill)
│   ├── core/
│   │   ├── store/signal-store.ts   # SignalStore<State>: select() / patch() – Basis der Facades
│   │   └── area/area.facade.ts     # AreaFacade über AdminAreaService (@ui-slim/apiClient)
│   └── views/
│       ├── auth/            # Anmeldeseiten (app-auth-layout), aus ELO / alco-map
│       ├── admin/           # Alles hinter dem Login
│       │   ├── _layout/     # app-admin-layout: Topbar, Sidebar, Tabbar
│       │   ├── _placeholder # Platzhalter für noch nicht umgesetzte Sitemap-Einträge
│       │   ├── home/        # Einstiegsseite
│       │   └── area/        # Übersicht Schiessplätze
│       ├── styleguide/      # Living Styleguide des Design Systems
│       └── 404/
└── public/assets/locales/<lang>/<section>.locale.json   # i18n (siehe i18n.md)
```

Muster: Seite `extends ComponentBase` (`@app-galaxy/sdk-ui`) und lädt in `getData()` über die
Facade; die Facade hält den Zustand als Signale (`SignalStore`) und ruft den generierten
Client. Kein NgRx im App-Code, keine Mocks, keine handgeschriebenen API-Modelle.

### Libs

| Lib                      | Alias                    | Inhalt                                                                      |
| ------------------------ | ------------------------ | --------------------------------------------------------------------------- |
| `libs/api/common`        | `@api-slim/common`       | Nest-Helfer (Proxy-Prefix, Trust-Proxy, env-Flags)                          |
| `libs/api/models`        | `@api-slim/models`       | Gemeinsame DTOs                                                             |
| `libs/shared/lsv`        | `@slim/lsv`              | Lärmberechnung LSV Anhang 7/9 (B1 Kap. 7, B1.4): GEMW/ESM, Betriebsdaten, Grenzwerte, Ampel — dependency-frei, Tests = Kontrollwerte |
| `libs/api/tests`         | `@api-slim/tests`        | In-Memory-SQLite mit galaxy Tenant/User-Tabellen für Service-Tests (Vitest) |
| `libs/shared/constants`  | `@slim/shared`           | `APP_ROUTES` / `ROUTE_SEGMENT`, Sprachen, App-Konstanten (API + App)        |
| `libs/app/design-system` | `@ui-slim/design-system` | SCSS-Design-System + ThemeService                                           |
| `libs/app/generated`     | `@ui-slim/apiClient`     | Aus Swagger generierter Angular-Client (`npm run ng-swagger`)               |

## Domänenmodell

Drei Ebenen wie in B1 Kap. 10 (Abb. 43); vollständiges ERD: [uml.mmd](uml.mmd) (`/erd`, bei jedem API-Start neu).

### Übergeordnete Referenzstruktur (zustandsunabhängig)

- **Schiessplatz** `schiessplatz`: `name`, `coordinationSectionNo` (Koordinationsabschnitt-Nr. oder eigener Schlüssel), `sectoralPlanNo`,
  Stammdaten 5.16 `classification`, `recalculationState`, `remediationProjectState`, `spmState`, `noiseRemediationState`,
  `projectState` (Codes in `entities/area-master-data.enums.ts`), `planningApproval` (gültige Plangenehmigung),
  (Sachplan-Nr.), `enabled`; `quotaStatus` / `noiseStatus` (`ok | warn | over | incomplete | none`) sind nur ein
  **Cache** der `AreaStatusService`-Berechnung (nach Mutation, Import, Zeigerwechsel und beim Start neu gesetzt,
  nicht schreibbar über die API). Endpunkte `admin/area` (Liste, Summary, Dashboard, CRUD).
- **Stellungsraum** `stellungsraum`: `areaId`, `coordinationSectionNo`, `name`, `groupName`, `sortOrder`, `enabled`;
  kein Baujahr mehr – das steht je Zustand am `zustand_anlageteil`.
- **Waffe / Kaliber / Waffenkategorie** `waffe`, `kaliber`, `waffenkategorie` (B1.7): `kaliber.quantityUnit`
  (`shots | kg`) bestimmt die Einheit der Mengen; `waffe.annex7Category` (`a`–`f`) die Kategorie nach Anhang 7.
- **Kombination Waffe/Kaliber** `waffe_kaliber_kombination`: `sonarmsId` (Schlüssel zur Schusslinie), Namen DE/FR/IT.
- **Zulässige Kombination je Stellungsraum** `stellungsraum_kombination` (5.17): `roomId`, `combinationId`, `entryName`
  (Waffenname für die Erfassung), `enabled`; Composite-FK `(tenantId, areaId, roomId)` – ein fremder Stellungsraum
  ist nicht zuordenbar.
- **Kontingent** `kontingent`: je Schiessplatz × Kombination `shotsPerYear`, `basis` (Plangenehmigung).
- **Feiertag** `feiertag`: je Schiessplatz `date`, optional `from`/`to` (halber Feiertag), wird an Anhang 9/7 übergeben.

### Nutzungen (Betriebsdaten, ohne Zustandsbezug – `slm 44`)

- **Schiessplatz-Nutzung** `nutzung` (5.11): `roomId`, `unit`, `date`, `timeFrom`/`timeTo` (Viertelstundenraster),
  `usageType` (`military | civil | blue_light | sat`), `civilUsageKind` (Pflicht bei Zivil), `personCount`,
  `recordedBy`, `source` (`manual | elo | import`), `externalId` (ELO-Idempotenz), `note`; Soft-Delete für «Rückgängig».
- **Position** `nutzung_position`: n je Nutzung, `combinationId` + `quantity` DECIMAL(12,3) + `quantityUnit`
  (aus dem Kaliber), `from`/`to`.
- Endpunkte `admin/area/:areaId/usage/{overview,restore}`, CRUD; nur Kombinationen des Stellungsraums sind zulässig.

### Zustandsebene (alles gehört einem `zustand`)

- **Immissionsberechnung** `immissionsberechnung` (5.18, Lieferung): `name`, `supplier`, `deliveredAt`, `description`,
  `fileName` (Name der importierten Berechnungsdatei); Löschen = `enabled = false`, nur ohne aktuellen / MGDM-Zustand
  und ohne Berechnungsläufe.
- **Zustand** `zustand` (ZustandsID): `calculationId`, `name`, `referenceYear`, `buildYearClass`, `isCurrent`, `isMgdm`;
  «genau ein aktueller / ein MGDM-Zustand je Schiessplatz» erzwingen die Unique-Indizes `uq_zustand_aktuell` /
  `uq_zustand_mgdm` über die Markerspalten `aktuell_schluessel` / `mgdm_schluessel` (= `schiessplatz_id` oder NULL).
- **Anlageteil** `zustand_anlageteil`: Sicht des Zustands auf einen Stellungsraum (`stellungsraum_id`, Baujahr nach 1985,
  Typ, Bez. SPL-Dossier); der Import bricht ab, wenn ein Anlageteil keinen übergeordneten Stellungsraum hat (`slm 45`).
- **Schusslinie** `schusslinie` (= Quelle, sonARMS QuellenID) mit `quelldaten_anhang9` (`a9_m1`/`a9_m2`, Zahl/Halbtage
  Werktag–Sonntag) und `quelldaten_anhang7` (Kategorie, Zahl, Halbtage) – beide optional je Quelle (Abb. 43); die
  Quelldaten liefern die Gewichte der Verteilung B1 7.5.
- **Immissionspunkt** `immissionspunkt` (5.12): `code`, `sonarmsId`, `egid`, `egrid`, Adresse, Gemeinde, `es` (ES I–IV),
  `typ` (Fassade/Freifeld/Baulinie), `ost`/`nord`/`hoehe` (LV95), `karte_x`/`karte_y` (schematische Karte), `gebaeude_id`.
- **WLR-Pegel** `wlr_pegel`: je Zustand × Immissionspunkt × Schusslinie × **Zeitgruppe** `lae` (Anhang 9, Tag/Abend)
  bzw. `lafmax` (Anhang 7), dazu die Detailpegel `lae_det/gk/mk`, `elevation`.
- **Untersuchungsperimeter, Ausbreitungsberechnung, Gebäude, Isophonen, Betroffenen-Analyse, Hindernis, Hochblende,
  Schützenhaus, Massnahmen (Punkt/Fläche/Betrieb/SSF)**: importierte FGDB-Objekte je Zustand; Geometrien als Text
  (Prototyp, SQLite) – Ziel PostGIS `geometry`.
- Alle Zustandsobjekte referenzieren über Composite-FKs `(tenantId, zustand_id, …)`: eine Schusslinie von Zustand A
  kann keinen Immissionspunkt von Zustand B treffen (`state-isolation.spec`).

### Berechnung

- **Beurteilung / Simulation** (5.12/5.13): `AssessmentService` und `SimulationService` rechnen in-process mit
  `@slim/lsv` aus Nutzungen + Quelldaten + WLR des gewählten Zustands
  (`admin/area/:areaId/calculation/{assessment,simulation}`, `years=` für repräsentative Jahre); nichts wird persistiert.
- **Berechnungslauf** `berechnungslauf` (`POST …/calculation/run`): friert einen Lauf ein – Zeitraum/Jahre,
  Kopie der Nutzungen (`nutzungen_kopie`), Referenz-Snapshot (`referenz_kopie`: Feiertage, Zuordnungen, Kontingente,
  Fachentscheide), Parameter, `kern_version`, Vollständigkeit (O8), Ergebnis, Prüfsumme, Ersteller.
- **Benutzer / Rollen / Mandanten**: galaxy (`@app-galaxy/auth-api`, `core-api`); App-Katalog
  und Rollen-Rechte über `API_APPS_MAPPING`.
- **MGDM Export**: Export nach dem minimalen Geodatenmodell — folgt.
