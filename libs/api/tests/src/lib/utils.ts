import {
  createTestSourceOptions,
  TenantEntity,
  TenantUserRoleEntity,
  TenantUserRoleStructureEntity,
  TestMockTenantMock,
} from '@app-galaxy/core-api';
import { UserEntity, SessionEntity } from '@app-galaxy/auth-api';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { mockUserId } from './constants';

const TenantDBOptionWithUser = {
  entities: [
    TenantEntity,
    UserEntity,
    SessionEntity,
    TenantUserRoleEntity,
    TenantUserRoleStructureEntity,
  ],
};

const config: DataSourceOptions = createTestSourceOptions({
  entities: TenantDBOptionWithUser.entities,
  logger: 'simple-console',
  logging: false,
});

/**
 * In-memory SQLite TypeORM setup for service tests (ELO / alco-map pattern):
 * galaxy tenant/user tables plus the entities under test.
 */
export const testDbSetup = (
  mods?: unknown[],
  customEntities: unknown[] = [],
) => {
  return [
    TypeOrmModule.forRoot(config),
    TypeOrmModule.forFeature(
      [config.entities as unknown[], customEntities].flat(2) as never[],
    ),
    ...((mods as never[]) || []),
  ];
};

export const testDbSeedBeforeEach = async (
  datasource: DataSource = new DataSource(config),
) => {
  await TestMockTenantMock.fill.All(datasource);

  await datasource.query(
    'insert into auth_user (userId, email, host,password, pin, salt, authCreatedAt)' +
      'values (?,?,?,?,?,?,?)',
    [
      mockUserId,
      process.env['APP_DEFAULT_USER'] || 'user@mail.com',
      (process.env['APP_DEFAULT_USER'] || 'user@mail.com').split('@')[1],
      process.env['APP_DEFAULT_PASSWORD'] || 'user@mail.com',
      '1234',
      '1234@test',
      new Date().getFullYear(),
    ],
  );
};
