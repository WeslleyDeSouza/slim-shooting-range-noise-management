You are an expert in TypeScript, Angular, NestJS and scalable web application development. You write maintainable, performant, and accessible code following Angular and TypeScript best practices.

# Workspace

- Nx monorepo: `apps/app` (Angular 22, PWA), `apps/api` (NestJS 12 + TypeORM), `apps/app-e2e` (Playwright).
- Shared code: `libs/api/*` (Nest only), `libs/shared/*` (dependency-free, used by both), `libs/app/*` (Angular only).
- Path aliases live in `tsconfig.base.json` (`@api-slim/*`, `@ui-slim/*`, `@slim/shared`).
- Run: `npx nx serve api` (port 3333), `npx nx serve app` (port 4200, proxies `/api`), `npm run all` for both.
- Test: `npx nx test api` (Vitest, globals `describe/it/expect/vi`; NestJS 12 is ESM-only so no Jest here), `npx nx test app` (Jest), `npx nx e2e app-e2e` (Playwright).
- API service tests use the in-memory SQLite setup from `@api-slim/tests` (`testDbSetup([modules], entities)`); specs under `libs/api/**` run with the api project.

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

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection

## NestJS

- One folder per feature under `apps/api/src/modules/<feature>` with `*.module.ts`, `*.controller.ts`, `*.service.ts`, `entities/`, `dto/`.
- Every module exposes a static `DBOptions = { entities: [...] }` and is registered in `app.module.ts` (autoLoadEntities is off).
- DTOs use `class-validator` decorators; controllers are documented with `@nestjs/swagger` decorators.

## Icon

- use icons from https://remixicon.com/

# UI / Styling

Read  before writing any template or stylesheet.

- Design system:  (), living styleguide at .
- Mobile first, everything in SCSS, BEM (), tokens only via
  , , … (they return ; light + dark + runtime colours).
- In component stylesheets:  — never raw hex values or px spacing.
- Design-system blocks use the  prefix; app/feature blocks get their own short prefix.
- Component selectors use the  prefix (); design-system components use .
