import { ValidationPipe } from '@nestjs/common';

/** Global route prefix of the API (`/api/...`), shared by `main.ts` and the HTTP tests. */
export const API_GLOBAL_PREFIX = 'api';

/**
 * The global validation pipe of the API. One factory so the supertest HTTP
 * specs (`@api-slim/tests` → `createTestApp`) validate exactly like the
 * running server does; a change here is covered by those specs.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    forbidUnknownValues: true,
    skipUndefinedProperties: true,
    skipNullProperties: true,
  });
}
