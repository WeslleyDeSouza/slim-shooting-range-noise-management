# @api-slim/tests

In-memory SQLite TypeORM setup for API service tests (ELO / alco-map pattern).

```ts
import { Test } from '@nestjs/testing';
import { testDbSetup, mockTenantId } from '@api-slim/tests';

const module = await Test.createTestingModule({
  imports: testDbSetup([MyModule], MyModule.DBOptions.entities),
}).compile();
```

Specs under `libs/api/**` are picked up by `npx nx test api`.
