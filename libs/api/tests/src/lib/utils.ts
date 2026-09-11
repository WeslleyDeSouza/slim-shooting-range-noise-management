import { TypeOrmModule } from '@nestjs/typeorm';
import type { DataSourceOptions } from 'typeorm';

/**
 * In-memory SQLite options for service tests. Stand-in for
 * `createTestSourceOptions` of @app-galaxy/core-api: once the galaxy
 * packages are added, swap this for that call and put the tenant/user
 * entities into the base list (see alco-map `libs/api/tests/utils.ts`).
 */
export const createTestSourceOptions = (
  entities: unknown[],
): DataSourceOptions => ({
  type: 'sqlite',
  database: ':memory:',
  dropSchema: true,
  synchronize: true,
  logging: false,
  entities: entities as never[],
});

/**
 * In-memory SQLite TypeORM setup for service tests (ELO pattern): the base
 * entities plus the entities under test, followed by the modules to import.
 */
export const testDbSetup = (
  mods: unknown[] = [],
  customEntities: unknown[] = [],
) => {
  const entities = [customEntities].flat(2) as never[];
  return [
    TypeOrmModule.forRoot(createTestSourceOptions(entities)),
    TypeOrmModule.forFeature(entities),
    ...(mods as never[]),
  ];
};
