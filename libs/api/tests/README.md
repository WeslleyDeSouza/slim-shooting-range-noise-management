# @api-slim/tests

In-memory SQLite TypeORM setup for API tests (ELO / alco-map pattern).

## Service tests

```ts
import { Test } from '@nestjs/testing';
import { testDbSetup, mockTenantId } from '@api-slim/tests';

const module = await Test.createTestingModule({
  imports: testDbSetup([MyModule], MyModule.DBOptions.entities),
}).compile();
```

## HTTP tests (supertest)

`createTestApp` boots the feature modules as a real Nest application on the
same in-memory database, with the API's global prefix and the validation pipe
of `main.ts` (`createValidationPipe()` from `@api-slim/common`), and hands out
a supertest agent:

```ts
import { assignAppRole, authHeaders, createTestApp, insertTestUser, mockUserId, testDbSeedBeforeEach } from '@api-slim/tests';

const api = await createTestApp({ modules: [AreaModule], entities: AreaModule.DBOptions.entities });
await testDbSeedBeforeEach(api.dataSource);          // tenant + demo user
// seed apps + roles (TestMockUserMock.fill.Apps, fillSlimRoles), then:
await assignAppRole(api.dataSource, mockUserId, SLIM_ROLE.SPECIALIST);

await api.http().get('/api/admin/area').expect(200);
const other = await insertTestUser(api.dataSource);   // a further user for a restricted role
await api.http().get('/api/admin/area').set(authHeaders(other)).expect(403);
await api.close();
```

What is real and what is replaced:

| Guard / step | In the HTTP specs |
| --- | --- |
| `AuthGuard('jwt')`, galaxy `TenantGuard` | replaced by `TestAuthGuard`: user + tenant from the headers `x-test-user-id` / `x-test-tenant-id` (`authHeaders()`), default = demo user + tenant of `constants.ts` |
| galaxy `AppsRolesGuard(appId)` | real — reads `app_user_right` / `app_role_right`, so seed roles and assign one (`assignAppRole`) |
| galaxy `ReplayGuard` | real, switched off by its own env switch `API_AUTH_GUARD_REPLAY_DISABLED` (`apps/api/vitest.setup.ts`) |
| `TenantIdOnRequestGuard`, `RulesGuard` (area scope) | real |
| `ValidationPipe`, `ParseUUIDPipe`, controllers, services | real |

Specs under `libs/api/**` are picked up by `npx nx test api`; the controller
specs alone run with `npm run test:api:http`.
