# API und App: Datenstruktur

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
│   └── health-check/        # /api/health, /alive, /ready (Terminus)
├── common/docs/             # Swagger (/docs) + Generierung von @ui-slim/apiClient
├── mocks/                   # API_APPS_MAPPING, API_CATEGORY_MAPPING, API_MOCK_DATA (Seed), E-Mail-Parser
└── modules/                 # Geschäftslogik-Module (siehe sitemap.md)
    └── area/                # Schiessplätze: entities/, dto/, controllers/, db/, service, mock-data, spec
```

#### Modul-Muster (wie ELO)

Jedes Modul unter `modules/<name>/` mit `controllers/`, `entities/`, `dto/`, `db/<name>.database.ts`,
`<name>.service.ts`, `<name>.module.ts`, `<name>.mock-data.ts`. Das Modul exportiert
`static DBOptions = { entities: [...] }`, das in `app.module.ts` in die TypeORM-Entity-Liste
gespreadet wird. Entities erben von `TenantBaseEntity` (`@app-galaxy/core-api`, mandantenbezogen).
Admin-Controller sind mit `AuthGuard('jwt')`, `TenantGuard`, `AppsRolesGuard(API_APPS_MAPPING.X)`
und `ReplayGuard` geschützt; `@GetTenantId()` liefert den Mandanten. DTOs mit
`class-validator`, Controller mit `@nestjs/swagger` dokumentiert → daraus entsteht der
Angular-Client (`npm run ng-swagger`).

Demo-Daten liegen **nur im Backend**: `API_MOCK_DATA.initMockData()` (nicht in Produktion)
seedet Mandant, Demo-User, App-Katalog + Rollen und ruft die `<modul>.mock-data.ts` auf.

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
| `libs/api/models`        | `@api-slim/models`       | Gemeinsame Entities / DTOs (`BaseEntity` mit Audit-Spalten)                 |
| `libs/api/tests`         | `@api-slim/tests`        | In-Memory-SQLite mit galaxy Tenant/User-Tabellen für Service-Tests (Vitest) |
| `libs/shared/constants`  | `@slim/shared`           | `APP_ROUTES` / `ROUTE_SEGMENT`, Sprachen, App-Konstanten (API + App)        |
| `libs/app/design-system` | `@ui-slim/design-system` | SCSS-Design-System + ThemeService                                           |
| `libs/app/generated`     | `@ui-slim/apiClient`     | Aus Swagger generierter Angular-Client (`npm run ng-swagger`)               |

## Domänenmodell

- **Area (Schiessplatz)** `area`: `name`, `coordinationSectionNo` (Koordinationsabschnitt-Nr.),
  `sectoralPlanNo` (Sachplan-Nr.), `quotaStatus` / `noiseStatus` (`ok | warn | over | none`),
  `enabled`, `tenantId`. Endpunkte `admin/area` (Liste, Summary, Dashboard, CRUD).
- **Schusszahlen** (`shots`): pro Schiessplatz und Jahr, pro Waffe/Kaliber — folgt.
- **Berechnung** (`calculation`): Import/Export der Lärmberechnung, Ergebnis je Schiessplatz
  (liefert künftig die Ampel) — folgt.
- **Waffe / Kaliber / Waffenkategorie** (`weapon`): Stammdaten — folgt.
- **Benutzer / Rollen / Mandanten**: galaxy (`@app-galaxy/auth-api`, `core-api`); App-Katalog
  und Rollen-Rechte über `API_APPS_MAPPING`.
- **MGDM Export**: Export nach dem minimalen Geodatenmodell — folgt.
