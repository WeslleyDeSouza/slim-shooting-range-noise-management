# SLIM – Schiesslärmimmissions-Management

Nx monorepo with an Angular 22 PWA frontend and a NestJS 12 API, structured like
`pwa-elo-shot-counting`.

> [!NOTE]
> Packages from the `@app-galaxy` scope come from a private Nexus registry. The committed `.npmrc` only maps the scope; the token goes into your user-level `~/.npmrc` (`npm run setup`, step 03, writes it there) — never into the project file, GitHub push protection rejects committed tokens. CI reads it from the `NPM_TOKEN` secret (`.github/workflows/build-and-deploy.yml`).

## Layout

| Path                    | What                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| `apps/app`              | Angular 22 application (standalone, PWA, SCSS, Jest)                                               |
| `apps/app-e2e`          | Playwright end-to-end tests                                                                        |
| `apps/api`              | NestJS 12 API (TypeORM, Swagger, Terminus, Throttler)                                              |
| `libs/api/common`       | `api-common` → `@api-slim/common` – Nest helpers (proxy, prefix, env flags)                        |
| `libs/api/models`       | `api-models` → `@api-slim/models` – shared entities / DTOs                                         |
| `libs/api/tests`        | `api-tests` → `@api-slim/tests` – in-memory SQLite setup for API service tests (Vitest)            |
| `libs/shared/constants` | `shared-constants` → `@slim/shared` – dependency-free constants (api + app)                        |
| `libs/app/generated`    | `api-client` → `@ui-slim/apiClient` – Angular client generated from Swagger (`npm run ng-swagger`) |
| `tools/`                | Swagger generator, e2e API launcher                                                                |

All libs are Nx projects generated with `nx g @nx/nest:library`, `nx g @nx/js:library`
and `nx g @nx/angular:library` (project.json, eslint, tsconfig per lib). Add a new one
the same way, e.g. `npx nx g @nx/nest:library libs/api/<name> --importPath=@api-slim/<name> --unitTestRunner=none`.

## Getting started

### Guided setup (recommended)

```bash
npm run setup
```

Opens the setup wizard (`@app-galaxy/setup-api`), which walks the steps in
[`setup/`](setup) and, where it can, fixes what it finds:

| Step        | Checks                                                                                  |
| ----------- | --------------------------------------------------------------------------------------- |
| `01` – `03` | Toolchain (Node ≥ 22.12), `.env` from `.env.example`, `~/.npmrc` token for `@app-galaxy` |
| `04` – `06` | Dependencies, database (SQLite / MariaDB / MySQL / PostgreSQL), Nx workspace          |
| `07` – `08` | API health (`/api/health/alive`, `/api/health/ready`), frontend + `/api` proxy         |
| `09` – `10` | Demo login (`slim@demo.ch`), seeded admin role behind the `/admin` guards               |
| `11`        | Demo data seeded by the API (8 areas / Schiessplätze, home KPIs)                        |
| `12`        | The Playwright e2e suite                                                                |

`npm run setup:debug` docks the wizard as a sidebar and writes a report to
`setup/reports/` (gitignored). `setup/SETUP_FOLDER.md` explains how steps are
written. The manual route below does the same thing by hand.

### Manual

```bash
cp .env.example .env
npm install --legacy-peer-deps
npm run all            # api on :3333, app on :4200 (proxies /api)
```

Individually:

```bash
npx nx serve api
npx nx serve app
npx nx build api && npx nx build app
npx nx test api && npx nx test app
npx nx e2e app-e2e
npx nx lint app
```

Swagger UI: http://localhost:3333/api/docs (when `API_SWAGGER_ENABLED=1`).
ERD of the live schema: http://localhost:3333/erd (Mermaid, also written to
`docs/architecture/uml.mmd`; dev only).

## Demo dataset

`apps/api/src/mocks/tenant/tenant.mock.json` («SLIM Demo», llumi pattern) holds the
demo tenant: nine areas, Geissalp with rooms, allowed weapons (= noise sources),
receivers, two calculation states and a year of usages. The API writes it on
every non-production start, rolled to the current year (`DEMO_RESEED=1` forces a
rewrite, `DEMO_SEED=0` skips it). Regenerate the file with the generator, which
tunes the sonARMS levels to the UI mock targets:

```bash
npx ts-node -T -O '{"module":"commonjs","moduleResolution":"node10","esModuleInterop":true,"ignoreDeprecations":"6.0"}' tools/tenant-dataset.generator.ts
```

### Demo accounts (password `1234`)

| Account | Role (B1 8.1.1) | Sees |
| --- | --- | --- |
| `slim@demo.ch` | galaxy admin | everything (e2e, setup wizard) |
| `fachspezialist@demo.ch` | Fachspezialist KOMZ Lärm | everything but administration |
| `schiessplatz@demo.ch` | Schiessplatz-Verantwortlicher | only Geissalp and Thun (`area_user`) |
| `interessent@demo.ch` | Interessent Schiessplatznutzung | read only, no simulation |
| `appadmin@demo.ch` | Applikationsadministrator*in | administration, read elsewhere |

Roles and rights: `docs/architecture/berechtigungen.md`.

## API client & models (generated)

The backend is the source of truth. With `API_SWAGGER_ENABLED=1` (non-production) the
API writes `config/api-gateway-swagger-spec.json` on start and runs `npm run ng-swagger`,
which generates `libs/app/generated/src/core` (`@ui-slim/apiClient`: models, services).
Never hand-write API types in the app; import them from `@ui-slim/apiClient`. On a fresh
clone run the API once or `npm run ng-swagger` from the committed spec.

## i18n

`de` is the source, `fr` / `it` / `en` are generated with `npm run translate` (Transmart,
needs `OPEN_API_KEY`) and reviewed. Sections per feature under
`apps/app/public/assets/locales/<lang>/`, see `docs/architecture/i18n.md`.

## Docs

`docs/README.md` (index) · `docs/architecture/sitemap.md` (UI structure, routes, modules) ·
`docs/architecture/datenstruktur.md` · `docs/architecture/i18n.md` · `docs/projects/design-system.md`.
Styling rules for development: `.claude/styleguide.md`, living styleguide at `/styleguide`.

## Tests

```bash
npm test                 # api: Vitest (NestJS 12 default) · app: Jest
npm run test:api:http    # only the supertest HTTP specs of the API controllers
npx nx e2e app-e2e       # Playwright; starts API (tools/serve-api-e2e.js) and app if not running
```

NestJS 12 ships ESM-only packages. At runtime the CommonJS bundle loads them
through Node's `require(esm)` (Node ≥ 22.12; Node 22 prints an
`ExperimentalWarning`, Node 24 in the `dockerfile` does not). Jest cannot do
that on Node < 24.9, so the API tests run on **Vitest** exactly like a
`nest new` v12 project and like alco-map: `apps/api/vitest.config.mts` (OXC
with legacy decorators + metadata, tsconfig paths, globals such as `vi`).
Specs under `libs/api/**` run with the api project; `@api-slim/tests` provides
the in-memory SQLite setup for service tests. The Angular app keeps Jest with
`jest-preset-angular`.

**HTTP specs (supertest).** Every admin controller has a
`controllers/*.controller.spec.ts` that boots the feature modules as a real
Nest application (`createTestApp` from `@api-slim/tests`: in-memory SQLite,
global prefix and the same `ValidationPipe` as `main.ts`) and drives it with
[supertest](https://github.com/ladjs/supertest). `AuthGuard('jwt')` and the
galaxy `TenantGuard` are replaced by a header-driven `TestAuthGuard`
(`x-test-user-id` / `x-test-tenant-id`, default: demo user + tenant); the
`ReplayGuard` stays in the chain but is switched off with its own env switch
(`API_AUTH_GUARD_REPLAY_DISABLED`, set in `apps/api/vitest.setup.ts`). The
`AppsRolesGuard` (app rights per role), the `area-scope` rule (W/R-O), pipes,
controllers and services run for real, so the specs cover status codes, DTO
validation and the B1 8.1.2 rights matrix end to end.

`.env` is loaded by `apps/api/src/core/env-loader.ts` (imported first in
`main.ts`) so library modules that read secrets at import time see it.

## CI/CD (GitHub Actions)

`.github/workflows/build-and-deploy.yml` mirrors ELO: **install** (npm cache, `nx affected`) → **tests** (lint, API build + `ng-swagger`, Vitest + Jest), **e2e** (Playwright, chromium only: `ng-swagger` from the committed spec, then `nx e2e app-e2e` with `CI=true` — the config starts the e2e API on in-memory SQLite and `nx serve app` itself; the html report and traces are uploaded as artifact `playwright-report`) and **build** (API, app production, service worker → artifact `nXdist`) → **deploy** (only `master`, environment `production`, gated on tests + e2e: Docker image from `dockerfile` pushed to the registry as `latest` only, like ELO — the Nexus docker repository allows redeploying no other tag; the commit is in the image labels). Linux baselines for the visual specs are recorded on demand (Actions → run workflow → `record_visual`) and downloaded from the artifact `visual-baselines-linux`. Secrets: `NPM_TOKEN`, optional `NX_CLOUD_ACCESS_TOKEN`, `REGISTRY_URL`, `REGISTRY_URL_PATH`, `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`. The npm token reaches the Docker build only as BuildKit secret `npm_token` (locally: `docker build --secret id=npm_token,env=NPM_TOKEN .`) and is removed from `.npmrc` again after `npm install`; the image declares no secret ARG/ENV.

## Database

Local default is MariaDB 11.8 like production: `docker compose up -d app-db` (host port 3307, next to
the ELO container on 3306) and the `DB_*` block in `.env`. `DB_SYNC=1` syncs the schema, the demo seed
runs once. SQLite stays the docker-free fallback and the test/e2e engine, but it does not enforce what
MariaDB rejects (`ON DELETE SET NULL` on composite keys, varchar lengths) — boot against MariaDB before
shipping entity or seed changes. `app-postgis` in the compose file is the PostGIS target.

## Production

`dockerfile` + `ecosystem.config.js` (pm2) serve `dist/apps/api` and
`dist/apps/app`, same as the reference project.
