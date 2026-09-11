# API und App: Datenstruktur

## Ordnerstruktur & Architektur

Nx-Workspace, gleicher Aufbau wie `pwa-elo-shot-counting` (ELO).

### Backend (apps/api) – NestJS 12

```
apps/api/src/
├── main.ts                  # Bootstrap: env-loader, Swagger, ValidationPipe, trust proxy
├── app.module.ts            # Registriert alle Module + TypeORM-Entities (autoLoadEntities aus)
├── core/                    # Kern-Funktionalitäten
│   ├── env-loader.ts        # lädt .env VOR allen Imports
│   ├── config/              # env-Facade, DB-Optionen (DB_TYPE sqlite|mysql|mariadb|postgres)
│   └── health-check/        # /api/health, /alive, /ready (Terminus)
├── common/
│   └── docs/                # Swagger-Setup (/api/docs)
└── modules/                 # Geschäftslogik-Module (siehe sitemap.md)
```

#### Modul-Muster (wie ELO)

Jedes Modul unter `modules/<name>/` mit `controllers/`, `services/`, `entities/`,
`dto/`, `<name>.module.ts`. Das Modul exportiert `static DBOptions = { entities: [...] }`,
das in `app.module.ts` in die TypeORM-Entity-Liste gespreadet wird. DTOs mit
`class-validator`, Controller mit `@nestjs/swagger` dokumentiert.

### Frontend (apps/app) – Angular 22

```
apps/app/src/
├── main.ts / bootstrap.ts   # Locale de-CH, NgRx Store, Bootstrap der App
├── index.html               # Theme vor dem ersten Paint (localStorage slim.theme)
├── styles.scss              # @use 'slim' (Design System)
├── app/
│   ├── app.config.ts        # Router, HttpClient, provideTranslate, provideDesignSystem
│   ├── app.routes.ts        # Routen = Sitemap (Shell + lazy Views + Platzhalter)
│   ├── common/              # Wiederverwendbare App-Komponenten (Sprache, Status-Pill)
│   ├── core/                # Services / Modelle (ranges …), später API-Client
│   └── views/
│       ├── shell/           # App-Shell: Topbar, Sidebar, Tabbar
│       ├── home/            # Einstiegsseite
│       ├── ranges/          # Übersicht Schiessplätze (+ Detailseiten)
│       ├── placeholder/     # Platzhalter für noch nicht umgesetzte Sitemap-Einträge
│       ├── styleguide/      # Living Styleguide des Design Systems
│       └── 404/
└── public/assets/locales/<lang>/<section>.locale.json   # i18n (siehe i18n.md)
```

### Libs

| Lib | Alias | Inhalt |
|---|---|---|
| `libs/api/common` | `@api-slim/common` | Nest-Helfer (Proxy-Prefix, Trust-Proxy, env-Flags) |
| `libs/api/models` | `@api-slim/models` | Gemeinsame Entities / DTOs (`BaseEntity` mit Audit-Spalten) |
| `libs/api/tests` | `@api-slim/tests` | In-Memory-SQLite-Setup für Service-Tests (Vitest) |
| `libs/shared/constants` | `@slim/shared` | Konstanten ohne Framework-Abhängigkeit (API + App) |
| `libs/app/design-system` | `@ui-slim/design-system` | SCSS-Design-System + ThemeService |
| `libs/app/generated` | `@ui-slim/apiClient` | Aus Swagger generierter Angular-Client (`npm run ng-swagger`) |

## Domänenmodell (Entwurf)

Aus Mock und Sitemap abgeleitet, wird mit dem Anforderungskatalog verfeinert:

- **Schiessplatz** (`range`): Bezeichnung, Koordinationsabschnitt-Nr., Sachplan-Nr.,
  Stammdaten, zugeordnete Waffen, Berechtigungen (Benutzer ↔ Schiessplatz).
- **Schusszahlen** (`shots`): pro Schiessplatz und Jahr, pro Waffe/Kaliber.
- **Berechnung** (`calculation`): Import/Export der Lärmberechnung, Ergebnis je Schiessplatz
  (Ampel Kontingent / Lärmbelastung).
- **Waffe / Kaliber / Waffenkategorie** (`weapon`): Stammdaten.
- **Benutzer / Rollen**: wie ELO über `@app-galaxy/auth-api` (Mandant, Rollen, Sessions).
- **MGDM Export**: Export nach dem minimalen Geodatenmodell.

Ampel-Status siehe [sitemap.md](sitemap.md) (`ok | warn | over | none`).
