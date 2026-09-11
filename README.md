# SLIM – Schiesslärmimmissions-Management

Nx monorepo with an Angular 22 PWA frontend and a NestJS 12 API, structured like
`pwa-elo-shot-counting`.

> [!NOTE]
> Packages from the `@app-galaxy` scope need an `.npmrc` with a valid npm token.

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

`.env` is loaded by `apps/api/src/core/env-loader.ts` (imported first in
`main.ts`) so library modules that read secrets at import time see it.

## Database

Default is SQLite (`local.database.sqlite`, `DB_SYNC=1`). For MariaDB run
`docker compose up -d` and switch the `DB_*` variables in `.env`.

## Production

`dockerfile` + `ecosystem.config.js` (pm2) serve `dist/apps/api` and
`dist/apps/app`, same as the reference project.
