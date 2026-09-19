import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
} from '@nestjs/common';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import {
  AppCategoryEntity,
  AppEntity,
  RoleEntity,
  RoleRightsEntity,
  UserRightsEntity,
} from '@app-galaxy/auth-api';
import { TenantGuard } from '@app-galaxy/core-api';
import { API_GLOBAL_PREFIX, createValidationPipe, rawQuery } from '@api-slim/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { mockTenantId, mockUserId } from './constants';
import { testDbSetup } from './utils';

/**
 * Request headers the HTTP specs use to say who is calling. Both default
 * to the mock user / tenant of `constants.ts`, so a plain request is the
 * signed-in demo user of the seeded tenant.
 */
export const TEST_AUTH_HEADER = {
  user: 'x-test-user-id',
  tenant: 'x-test-tenant-id',
} as const;

/** The signed-in test user as `@GetUser()` sees it («Erfasser» = «Test User»). */
export const TEST_USER = {
  userId: mockUserId,
  email: process.env['APP_DEFAULT_USER'] || 'user@mail.com',
  firstName: 'Test',
  lastName: 'User',
} as const;

/** Headers for a request on behalf of another user (or tenant): `.set(authHeaders(id))`. */
export function authHeaders(
  userId: string = mockUserId,
  tenantId: string = mockTenantId,
): Record<string, string> {
  return {
    [TEST_AUTH_HEADER.user]: userId,
    [TEST_AUTH_HEADER.tenant]: tenantId,
  };
}

/**
 * Stands in for the galaxy `AuthGuard('jwt')` and `TenantGuard`: those need
 * a signed JWT and a session row — library code tested upstream. The guard
 * puts the same fields on the request the real ones do (`user`, `_tenant`,
 * `_tenantId`, `tenantId`), so everything after it runs for real: the
 * galaxy `AppsRolesGuard` (app rights), `ReplayGuard` (switched off by
 * `API_AUTH_GUARD_REPLAY_DISABLED` in `vitest.setup.ts`, its own env
 * switch), `TenantIdOnRequestGuard` + `RulesGuard` (area scope «W/R-O»),
 * pipes, controllers and services.
 */
@Injectable()
export class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header = (name: string): string | undefined => {
      const value = request.headers?.[name];
      return Array.isArray(value) ? value[0] : value;
    };
    const userId = header(TEST_AUTH_HEADER.user) || mockUserId;
    const tenantId = header(TEST_AUTH_HEADER.tenant) || mockTenantId;
    request.user = {
      ...TEST_USER,
      userId,
      session: { tenantId, tId: tenantId },
    };
    request._tenant = { tenantId };
    request._company = request._tenant;
    request._tenantId = tenantId;
    request.tenantId = tenantId;
    return true;
  }
}

/** galaxy app / role tables the `AppsRolesGuard` reads (app rights per user). */
export const TestAuthDBOptions = {
  entities: [
    AppCategoryEntity,
    AppEntity,
    RoleEntity,
    RoleRightsEntity,
    UserRightsEntity,
  ],
};

export interface TestAppOptions {
  /** Feature modules under test (`[AreaModule, UsageModule, CalculationModule]`). */
  modules: unknown[];
  /** Their entities (`Module.DBOptions.entities`), on top of the galaxy tenant / user / role tables. */
  entities?: unknown[];
  /** Extra overrides on the testing module builder (`builder.overrideProvider(...)`). */
  configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
}

export interface TestApp {
  app: INestApplication;
  module: TestingModule;
  dataSource: DataSource;
  /** A supertest agent on the running app: `http().get('/api/admin/area')`. */
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
}

/**
 * Boots the feature modules as a real Nest HTTP application on the in-memory
 * SQLite database (same as `testDbSetup`) with the API's global prefix and
 * validation pipe, ready for supertest:
 *
 * ```ts
 * const api = await createTestApp({ modules: [AreaModule], entities: AreaModule.DBOptions.entities });
 * await api.http().get('/api/admin/area').expect(200);
 * await api.close();
 * ```
 */
export async function createTestApp(options: TestAppOptions): Promise<TestApp> {
  const guard = new TestAuthGuard();
  let builder = Test.createTestingModule({
    imports: testDbSetup(options.modules, [
      ...TestAuthDBOptions.entities,
      ...(options.entities ?? []),
    ]),
  })
    .overrideGuard(AuthGuard('jwt'))
    .useValue(guard)
    .overrideGuard(TenantGuard)
    .useValue(guard);
  if (options.configure) builder = options.configure(builder);

  const module = await builder.compile();
  const app = module.createNestApplication({ logger: false });
  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  app.useGlobalPipes(createValidationPipe());
  await app.init();

  return {
    app,
    module,
    dataSource: module.get(DataSource),
    http: () => request(app.getHttpServer()),
    close: () => app.close(),
  };
}

/**
 * Adds a further galaxy user (`auth_user`) for a request on their behalf,
 * e.g. to try a restricted role. `app_user_right` references the user, so a
 * made-up id cannot hold a role. Returns the user id.
 */
export async function insertTestUser(
  dataSource: DataSource,
  options: { userId?: string; email?: string } = {},
): Promise<string> {
  const userId = options.userId ?? randomUUID();
  await rawQuery(
    dataSource,
    'insert into auth_user (userId, email, host, password, pin, salt, authCreatedAt) values (?, ?, ?, ?, ?, ?, ?)',
    [
      userId,
      options.email ?? `${userId}@test.local`,
      'test.local',
      'test',
      '1234',
      '1234@test',
      new Date().getFullYear(),
    ],
  );
  return userId;
}

/** Gives a user an app role of the tenant (`app_user_right`), what the `AppsRolesGuard` checks. */
export async function assignAppRole(
  dataSource: DataSource,
  userId: string,
  roleId: number,
  tenantId: string = mockTenantId,
): Promise<void> {
  await rawQuery(
    dataSource,
    'insert into app_user_right (userId, tenantId, roleId) values (?, ?, ?)',
    [userId, tenantId, roleId],
  );
}
