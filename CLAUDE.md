You are an expert in TypeScript, Angular, NestJS and scalable web application development. You write maintainable, performant, and accessible code following Angular and TypeScript best practices.

# Workspace

- Nx monorepo: `apps/app` (Angular 22, PWA), `apps/api` (NestJS 12 + TypeORM + `@app-galaxy/*` auth/tenant), `apps/app-e2e` (Playwright).
- App structure: `views/auth` (public auth pages, `app-auth-layout`), `views/admin` (everything behind the login, `app-admin-layout`), `views/styleguide`. Sitemap + routes: `docs/architecture/sitemap.md`.
- Shared code: `libs/api/*` (Nest only), `libs/shared/*` (dependency-free, used by both), `libs/app/*` (Angular only).
- Path aliases live in `tsconfig.base.json` (`@api-slim/*`, `@ui-slim/*`, `@slim/shared`).
- Run: `npx nx serve api` (port 3333), `npx nx serve app` (port 4200, proxies `/api`), `npm run all` for both.
- Test: `npx nx test api` (Vitest, globals `describe/it/expect/vi`; NestJS 12 is ESM-only so no Jest here), `npx nx test app` (Jest), `npx nx e2e app-e2e` (Playwright).
- `setup/` holds the `@app-galaxy/setup-api` wizard steps (`npm run setup`, ELO pattern): plain CommonJS `NN-name.actions.js` with `check/heal/escalate/onChoice`, optional `NN-name.view.<name>.html`; `_browser.js` is a shared helper (no step suffix, so the runner ignores it). Steps 09–11 drive the running app with Playwright using the same selectors as `apps/app-e2e/src/support/selectors.ts` — keep them in sync when the login page or the area overview changes.
- API service tests use the in-memory SQLite setup from `@api-slim/tests` (`testDbSetup([modules], entities)`); specs under `libs/api/**` run with the api project.
- Every admin controller has a supertest HTTP spec (`modules/<name>/controllers/*.controller.spec.ts`, `npm run test:api:http`): `createTestApp({ modules, entities })` from `@api-slim/tests` boots the modules as a real Nest app (global prefix + `createValidationPipe()` from `@api-slim/common`, shared with `main.ts`), `api.http().get('/api/admin/area')...`. JWT/tenant guards are replaced by the header-driven `TestAuthGuard` (`authHeaders(userId, tenantId)`), the `ReplayGuard` is off via `API_AUTH_GUARD_REPLAY_DISABLED` (vitest.setup.ts); `AppsRolesGuard` + area-scope rule run for real — seed apps/roles (`TestMockUserMock.fill.Apps`, `fillSlimRoles`) and give users a role with `assignAppRole` (`insertTestUser` for extra users). Add such a spec for every new controller.
- Every SLIM entity extends `SlimBaseEntity` (`@api-slim/common`, `libs/api/common/src/lib/entities/base.entity.ts`) which extends the galaxy `TenantBaseEntity`: uuid `id`, `tenantId`, `createdAt/updatedAt/deletedAt`; declare `protected self = TheEntity`. Backend modules: `apps/api/src/modules/<name>/{entities,dto,controllers,db}` + `<name>.service.ts` + `<name>.module.ts` with `static DBOptions`, registered in `app.module.ts` (entities list + imports). Controllers: `admin/area/:areaId/<resource>`, guards `AuthGuard('jwt'), TenantGuard, AppsRolesGuard(API_APPS_MAPPING.X), ReplayGuard`, `@GetTenantId()` / `@GetUser()`.
- Demo data is the «SLIM Demo» dataset `apps/api/src/mocks/tenant/tenant.mock.json` (llumi pattern: `tenant-dataset.ts` types + `{{year}}` placeholders, `demo-dataset.seed.ts` with the `slim_demo_seed` marker, rewritten on year/version change or `DEMO_RESEED=1`; `DEMO_SEED=0` disables). Regenerate with `npx ts-node -T -O '{"module":"commonjs","moduleResolution":"node10","esModuleInterop":true,"ignoreDeprecations":"6.0"}' tools/tenant-dataset.generator.ts` (it tunes the WLR levels to the mock targets). API specs seed it with `seedDemoDataset(dataSource, mockTenantId, { now: new Date(2026, 11, 31) })` — the 2026 weekday pattern is what the expected levels were tuned for.
- Noise calculation lives in `@slim/lsv` (`libs/shared/lsv`, dependency-free, B1 chapter 7 / B1.4 formulas, tests = tender control values). The API computes assessment (5.12) and simulation (5.13) in-process (`modules/calculation`), nothing is persisted; see `docs/architecture/laermberechnung.md`.
- The API writes `docs/architecture/uml.mmd` (Mermaid ERD, `typeorm-erd`) and serves `/erd` on every non-production start (`common/docs/main.uml.ts`); `config/api-gateway-swagger-spec.json` + `@ui-slim/apiClient` are regenerated the same way. Never edit generated files.
- Feature pages: facade + `SignalStore` in `apps/app/src/app/core/<feature>/`, pages under `views/admin/area/<page>/` extend `ComponentBase` and load in `getData()`; the area pages sit inside `views/admin/area/_context` (context bar), so they read the area id from `route.parent!.paramMap`. Locale keys per page in the `area` section (`shots.*`, `details.*`, `simulation.*`, `context.*`).

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.
  - Avoid the CommonModule

## Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- DO NOT use `ngStyle`, use `style` bindings instead

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables

## Data loading, state and facades (ELO pattern — NO NgRx)

- Do NOT use `@ngrx/*` in app code (eslint blocks it). `@ngrx/store` is installed only because
  `@app-galaxy/auth-ui` needs it internally (`provideStore` in `bootstrap.ts`, nothing else).
- State lives in a **facade per feature** (`apps/app/src/app/core/<feature>/<feature>.facade.ts`) that extends
  `SignalStore<State>` (`core/store/signal-store.ts`): `select()` for derived signals, `patch()` for updates.
  The facade calls the generated API client (`@ui-slim/apiClient`) and exposes signals; pages never call HTTP.
- Pages that load data **extend `ComponentBase` from `@app-galaxy/sdk-ui`** and implement `getData()`.
  ComponentBase calls it on init and on every `DATA_RELOAD` emit (tenant switch, saves). Do NOT load data in
  `ngOnInit()` / constructors:
  ```ts
  export class AreaOverviewComponent extends ComponentBase {
    private readonly area = inject(AreaFacade);
    /** ComponentBase calls this on init and on every DATA_RELOAD emit. */
    override getData(): void {
      void this.area.load();
    }
  }
  ```
  After a mutation, `this.emit(EDataEmitterAction.DATA_RELOAD)` refreshes every mounted page.
- Forms extend `ComponentFormBase` (same lib): `save` / `delete` / `cancel` outputs, `getId()`.
- Routes and links: never hard-code `/admin/...`. Use `ROUTE_SEGMENT` (router config) and `APP_ROUTES`
  (links, guards, redirects) from `@slim/shared`; the API app catalogue (`apps/api/src/mocks`) uses the same constant.
- Demo data lives ONLY in the API (`apps/api/src/mocks`, `modules/<feature>/<feature>.mock-data.ts`, seeded in
  non-production). The app has no mock data and no hand-written models.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection

## API contract: models and client are GENERATED from the backend (ELO pattern)

- The backend is the single source of truth. Every DTO / entity shape the app needs is
  declared in NestJS (`class-validator` + `@nestjs/swagger` decorators on DTOs and controllers).
- When the API starts outside production (`API_SWAGGER_ENABLED=1`), `apps/api/src/common/docs/main.swagger.ts`
  writes `config/api-gateway-swagger-spec.json` and runs `npm run ng-swagger`
  (`tools/swagger.generator.js`, ng-openapi-gen) → `libs/app/generated/src/core` = `@ui-slim/apiClient`
  (models, services, `ApiConfiguration`). `src/core` is git-ignored; the spec is committed.
- **Never hand-write API interfaces, DTO types or HTTP calls in the app.** Import models and
  services from `@ui-slim/apiClient` (`import type { AreaResultDto } from '@ui-slim/apiClient'`,
  `inject(AdminAreaService).adminAreaList()`), wrap them in facades under `apps/app/src/app/core`.
- Changing the API contract = change the DTO/controller in `apps/api`, restart the API (or
  `npm run ng-swagger` from the committed spec), then use the regenerated types.
- No mock data and no model files in the app: demo data is seeded by the API (`apps/api/src/mocks`).

## Documentation

- `docs/README.md` is the index (structure like ELO: architecture / projects / userstories / anforderungskatalog).
- The UI structure (sitemap, routes, views, API modules) is `docs/architecture/sitemap.md`; keep it in sync with `app.routes.ts`.
- i18n rules: `docs/architecture/i18n.md` — no hard-coded UI texts, sections per feature, `de` is the source, `npm run translate` for fr/it/en.

## NestJS

- One folder per feature under `apps/api/src/modules/<feature>` with `*.module.ts`, `*.controller.ts`, `*.service.ts`, `entities/`, `dto/`.
- Every module exposes a static `DBOptions = { entities: [...] }` and is registered in `app.module.ts` (autoLoadEntities is off).
- DTOs use `class-validator` decorators; controllers are documented with `@nestjs/swagger` decorators.

## Icon

- use icons from https://remixicon.com/

# UI / Styling

Read `.claude/styleguide.md` before writing any template or stylesheet.

- Design system: `libs/app/design-system` (`@ui-slim/design-system`), living styleguide at `/styleguide`.
- Mobile first, everything in SCSS, BEM (`.block__element--modifier`), tokens only via
  `slim.color()`, `slim.space()`, … (they return `var(--slim-*)`; light + dark + runtime colours).
- In component stylesheets: `@use 'slim/abstracts' as slim;` — never raw hex values or px spacing.
- Design-system blocks use the `slim-` prefix; app/feature blocks get their own short prefix.
- Component selectors use the `app` prefix (`app-*`); design-system components use `slim-*`.
- Page structure follows the mock `_mocks/home/index.html` and the ELO admin shell: `views/admin/_layout` (app-admin-layout: topbar, sidebar, tabbar),
  `slim-page` with breadcrumbs + header + body, cards / tiles / tables from the design system.
- All UI text via `translate` pipe with keys from `apps/app/public/assets/locales/<lang>/<section>.locale.json`.
