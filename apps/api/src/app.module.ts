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
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { HealthModule } from './core/health-check';
import { CoreLoggerModule, RequestOriginMiddleware } from './core/logger';
import { AuthAuditModule } from './modules/auth-audit/auth-audit.module';
import { AuthThrottlerGuard } from './core/guards';
import { API_EMAIL_PARSER_PROVIDER, API_MOCK_DATA, DemoSeedMarkerEntity } from './mocks';
import {
  AccessModule,
  AreaModule,
  CalculationModule,
  DataAreaModule,
  DataCalculationsModule,
  DataWeaponsModule,
  UsageModule,
} from './modules';
import { AreaStatusService } from './modules/calculation/area-status.service';

const isProd: boolean = env.isProd();

/**
 * pm2 cluster mode boots every instance at once; with DB_SYNC=1 they would all
 * run the schema sync (and the demo seed) against the same database and race
 * each other («errno 121 Duplicate key on write or update» on MariaDB until the
 * retries settle). Only the first instance (NODE_APP_INSTANCE=0, or none in
 * fork mode / `nx serve`) syncs and seeds; the others just connect.
 */
const isPrimaryInstance = (process.env['NODE_APP_INSTANCE'] ?? '0') === '0';

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
      synchronize: process.env['DB_SYNC'] === '1' && isPrimaryInstance,
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
        ...(<never[]>CoreLoggerModule.DBOptions.entities),
        ...(<never[]>AreaModule.DBOptions.entities),
        ...(<never[]>UsageModule.DBOptions.entities),
        ...(<never[]>CalculationModule.DBOptions.entities),
        ...(<never[]>DataAreaModule.DBOptions.entities),
        ...(<never[]>DataWeaponsModule.DBOptions.entities),
        ...(<never[]>DataCalculationsModule.DBOptions.entities),
        ...(<never[]>AccessModule.DBOptions.entities),
        // Demo dataset marker (mocks/tenant), harmless in production
        DemoSeedMarkerEntity,
      ],
    }),

    CoreConfigModule,
    HealthModule,
    // Logbook (logbuch) + AUTH_API_LOGGER bridge, global (slm 56)
    CoreLoggerModule,

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
    UsageModule,
    CalculationModule,
    // Datenverwaltung (5.15/5.16 Schiessplatz Allgemein, 5.22–5.25 Waffen) + app rights of the session
    DataAreaModule,
    DataWeaponsModule,
    DataCalculationsModule,
    AccessModule,
    // Audit hooks of the galaxy user / role / app lifecycle → logbook
    AuthAuditModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthThrottlerGuard },
    API_EMAIL_PARSER_PROVIDER,
  ],
})
export class AppModule implements NestModule {
  constructor(
    protected dataSource: DataSource,
    private readonly areaStatus: AreaStatusService,
  ) {
    if (!isProd && isPrimaryInstance) {
      // The seed runs after CalculationModule.onApplicationBootstrap has already
      // refreshed the overview lights: on a fresh database they would stay «none»
      // until the midnight cron, so refresh once more when the dataset was written.
      setTimeout(() => {
        void API_MOCK_DATA.initMockData(dataSource)
          .then(async ({ seeded, tenantId }) => {
            if (seeded) {
              await this.areaStatus.refreshAll(tenantId);
              console.log('[seed] overview statuses refreshed');
            }
          })
          .catch((error) => console.warn(`[seed] status refresh failed: ${error?.message ?? error}`));
      }, 2000);
    }
  }

  configure(consumer: MiddlewareConsumer): void {
    // Log entries carry who acted from where: IP + user agent, provided as
    // async-local context so every LoggerService caller gets them for free.
    consumer.apply(RequestOriginMiddleware).forRoutes('*');
  }
}
