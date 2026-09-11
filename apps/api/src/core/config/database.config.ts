import type { TypeOrmModuleOptions } from '@nestjs/typeorm';

type DbType = 'sqlite' | 'mysql' | 'mariadb' | 'postgres';

/**
 * Picks the TypeORM driver from DB_TYPE (sqlite | mysql | mariadb | postgres),
 * mirroring `createSourceOptions` of @app-galaxy/core-api.
 */
export function createSourceOptions(): TypeOrmModuleOptions {
  const type = (process.env['DB_TYPE'] || 'sqlite') as DbType;

  if (type === 'sqlite') {
    return {
      type: 'sqlite',
      database: process.env['DB_DATABASE'] || 'local.database.sqlite',
    };
  }

  const defaultPort = type === 'postgres' ? 5432 : 3306;

  return {
    type,
    host: process.env['DB_HOST'] || 'localhost',
    port: +(process.env['DB_PORT'] || defaultPort),
    username: process.env['DB_USERNAME'],
    password: process.env['DB_PASSWORD'],
    database: process.env['DB_DATABASE'],
    extra: { connectionLimit: 40 },
  } as TypeOrmModuleOptions;
}
