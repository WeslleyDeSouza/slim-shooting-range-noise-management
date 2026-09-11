import {
  env,
  createSourceOptions,
  ConfigModule as CoreConfigModule,
  TenantModule,
  TenantAdminModule,
  TenantAuthModuleWithRouting,
  TenantAdminModuleWithRouting,
  TenantAppConfigModule,
  TenantAppConfigWithRoutingModule,
  TenantAppPublicConfigWithRoutingModule,
  TenantAdminEmailWithRoutingModule,
} from '@app-galaxy/core-api';
import {
  AuthUserAdminWithRoutingModule,
  AuthUserSessionWithRoutingModule,
  AuthUserModule,
  AuthRoleWithRoutingModule,
  AuthRoleModule,
  AuthUserAdminSelfWithRoutingModule,
  AuthRoleAdminWithRoutingModule,
  AuthAppAdminWithRoutingModule,
  PasswordHistoryEntity,
} from '@app-galaxy/auth-api';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { HealthModule } from './core/health-check';
import { AuthThrottlerGuard } from './core/guards';
import { API_EMAIL_PARSER_PROVIDER, API_MOCK_DATA } from './mocks';
import { AreaModule } from './modules';

const isProd: boolean = env.isProd();

/**
 * Same backend base as ELO / alco-map: galaxy auth (users, roles, sessions,
 * 2FA, password reset) and tenants come from `@app-galaxy/*`, so the
 * generated Angular client (`@ui-slim/apiClient`) exposes the same auth
 * functions the copied auth pages expect. SLIM's own modules are added
 * below ("Own modules") — see docs/architecture/sitemap.md.
 */
@Module({
  imports: [
    CacheModule.register({ isGlobal: true }),
    // Rate limiting. AuthThrottlerGuard (APP_GUARD below) routes each request
    // to the throttler that owns its path prefix (/api/auth, /api/public).
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
    // Driver is picked at runtime from DB_TYPE (sqlite | mysql | mariadb | postgres).
    TypeOrmModule.forRoot(<TypeOrmModuleOptions>{
      ...createSourceOptions(process.env['APP_NAME']),
      logging: +(process.env['DB_LOG'] || process.env['LOG_DB'] || 0) >= 1,
      logger: 'simple-console',
      autoLoadEntities: false,
      synchronize: process.env['DB_SYNC'] === '1',
      ssl: false,
      extra: {
        connectionLimit: 20,
      },
      entities: [
        ...(<never[]>CoreConfigModule.dbSettings.entities),
        // User
        ...(<never[]>AuthUserModule.dbSettingsWithTemplate.entities),
        PasswordHistoryEntity,
        ...(<never[]>AuthRoleModule.dbSettings.entities),
        ...(<never[]>AuthUserAdminWithRoutingModule.dbSettings.entities),
        // Tenant
        ...(<never[]>TenantModule.dbSettings.entities),
        ...(<never[]>TenantAdminModule.dbSettings.entities),
        ...(<never[]>TenantAppConfigModule.dbSettings.entities),
        ...(<never[]>TenantAdminEmailWithRoutingModule.dbSettings.entities),
        // Own modules
        ...(<never[]>AreaModule.DBOptions.entities),
      ],
    }),

    CoreConfigModule,
    HealthModule,

    // Auth & admin section (galaxy)
    AuthRoleWithRoutingModule,
    AuthUserSessionWithRoutingModule,
    AuthUserAdminWithRoutingModule,
    AuthUserAdminSelfWithRoutingModule,
    AuthRoleAdminWithRoutingModule,
    AuthAppAdminWithRoutingModule,

    // Tenant (galaxy)
    TenantModule,
    TenantAuthModuleWithRouting,
    TenantAdminModuleWithRouting,
    TenantAppConfigWithRoutingModule,
    TenantAppPublicConfigWithRoutingModule,
    TenantAdminEmailWithRoutingModule,

    // Own modules (apps/api/src/modules)
    AreaModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthThrottlerGuard },
    API_EMAIL_PARSER_PROVIDER,
  ],
})
export class AppModule {
  constructor(protected dataSource: DataSource) {
    if (!isProd) {
      setTimeout(() => API_MOCK_DATA.initMockData(dataSource), 2000);
    }
  }
}
