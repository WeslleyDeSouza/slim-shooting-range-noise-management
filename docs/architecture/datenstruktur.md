# API und App: Datenstruktur

> Physische Tabellennamen sind deutsch (B1 12.2, `slm 51`): `schiessplatz`, `stellungsraum`, `stellungsraum_waffe`, `nutzung`, `immissionsberechnung`, `zustand`, `empfangspunkt`, `wlr_pegel`, `schiessplatz_benutzer`, `logbuch`, `demo_datensatz`. Die Klassen im Code (`AreaEntity`, `AreaUsageEntity`, …) und die Spaltennamen bleiben englisch – Spalten sind der nächste Schritt (Entity-`name`-Mapping). Die galaxy-Tabellen (`auth_user`, `app_role`, `tenant_user_role`, …) kommen aus der Bibliothek.

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
    ├── area/                # Schiessplätze, Stellungsräume, Zuordnung Waffen (= Quellen): entities/, dto/, controllers/, db/, service, spec
    ├── usage/               # Schiessplatz-Nutzungen (5.11): overview / create / update / delete / restore
    ├── calculation/         # Berechnungsgrundlagen, Empfangspunkte, WLR-Pegel; AssessmentService (5.12), SimulationService (5.13)
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
`DEMO_SEED=0` lässt ihn in Ruhe. Generator: `tools/tenant-dataset.generator.ts`.

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

- **Area (Schiessplatz)** `area`: `name`, `coordinationSectionNo` (Koordinationsabschnitt-Nr.),
  `sectoralPlanNo` (Sachplan-Nr.), `quotaStatus` / `noiseStatus` (`ok | warn | over | none`),
  `enabled`, `tenantId`. Endpunkte `admin/area` (Liste, Summary, Dashboard, CRUD).
- **Stellungsraum** `stellungsraum`: `areaId`, `coordinationSectionNo` (optional), `name`, `groupName`,
  `builtAfter1985` (Planungswert gilt), `sortOrder`, `enabled`.
- **Zuordnung Waffen / Quelle** `stellungsraum_waffe` (5.17): `areaId`, `roomId`, `weaponName` (Erfassung), `weapon`,
  `caliber`, `category` (`artillery | air_defence | handguns | mortar`), `annex7Category` (`a`–`f`, zivil),
  `sourceId` (sonARMS QuellenID), `quota` (Kontingent Plangenehmigung).
- **Schiessplatz-Nutzung** `nutzung` (5.11): `roomId`, `weaponId` (zulässige Kombination), `unit`, `date`,
  `timeFrom`/`timeTo`, `usageType` (`military | civil`), `shots`, `recordedBy`, `source` (`manual | elo | import`),
  `note`; Soft-Delete für «Rückgängig». Endpunkte `admin/area/:areaId/usage/{overview,restore}`, CRUD.
- **Immissionsberechnung** `immissionsberechnung` (5.18, Lieferung): `name`, `supplier`, `deliveredAt`; Hierarchie Schiessplatz → Immissionsberechnung → Zustand.
- **Zustand** `zustand` (5.18, ZustandsID): `calculationId` (→ Immissionsberechnung), `name`, `referenceYear`,
  `buildYearClass` (`before1985 | after1985 | mixed`), `isCurrent`, `isMgdm`.
- **Empfangspunkt** `empfangspunkt` (5.12): `code`, `egid`, `address`, `municipality`, `type` (`facade | reserve`),
  `sensitivityLevel` (ES I–IV), `east`/`north` (LV95), `mapX`/`mapY` (schematische Karte).
- **WLR-Pegel** `wlr_pegel`: je Zustand × Empfangspunkt × Quelle `laeDay`, `laeEve` (Anhang 9), `lafmaxDay` (Anhang 7).
- **Beurteilung / Simulation**: nicht persistiert, `AssessmentService` und `SimulationService` rechnen mit
  `@slim/lsv` aus Nutzungen + WLR (`admin/area/:areaId/calculation/{assessment,simulation}`).
- **Waffe / Kaliber / Waffenkategorie** (Datenverwaltung, 5.22–5.25): Stammdaten-Masken — folgt (heute über `stellungsraum_waffe`).
- **Benutzer / Rollen / Mandanten**: galaxy (`@app-galaxy/auth-api`, `core-api`); App-Katalog
  und Rollen-Rechte über `API_APPS_MAPPING`.
- **MGDM Export**: Export nach dem minimalen Geodatenmodell — folgt.
