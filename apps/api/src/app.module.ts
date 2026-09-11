import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

import { createSourceOptions, env, HealthModule } from './core';

const isProd: boolean = env.isProd();

@Module({
  imports: [
    CacheModule.register({ isGlobal: true }),
    // Rate limiting for /api/auth and /api/public style endpoints.
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'auth',
          ttl: 60000,
          limit: +(process.env['API_RATE_LIMIT_AUTH'] || 20),
        },
        {
          name: 'public',
          ttl: 60000,
          limit: +(process.env['API_RATE_LIMIT_PUBLIC'] || 60),
        },
      ],
    }),
    ScheduleModule.forRoot(),
    // Driver is picked at runtime from DB_TYPE (see core/config).
    TypeOrmModule.forRoot(<TypeOrmModuleOptions>{
      ...createSourceOptions(),
      logging: +(process.env['DB_LOG'] || 0) >= 1,
      logger: 'simple-console',
      autoLoadEntities: false,
      synchronize: process.env['DB_SYNC'] === '1',
      entities: [
        // Spread every feature module's `DBOptions.entities` here.
      ],
    }),

    HealthModule,

    // Feature modules (apps/api/src/modules)
  ].flat(2),
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {
  static readonly isProd = isProd;
}
