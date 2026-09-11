import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthLoggerFn, AuthLoggerHooks } from '@app-galaxy/auth-api';
import DBOptions from './db/logger.database';
import { LoggerService } from './logger.service';
import { LogAction } from './dto/log-action.enum';
import { AdminLogController } from './controllers/admin-log.controller';

/**
 * Logbook (`logbuch`, ELO pattern): every entry says who did what,
 * where (IP / device from `RequestOriginMiddleware`) and when. Fed by the
 * galaxy auth API (logins, sign-ups, password resets, admin user writes via
 * `AUTH_API_LOGGER`), by the auth-audit lifecycle hooks (roles, apps,
 * self-service) and by our own services through `LoggerService.createLog`.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature(DBOptions.entities)],
  controllers: [AdminLogController],
  providers: [
    LoggerService,
    // Bridges the auth-api's optional logger into the logbook. MUST live in
    // a global module: the auth-api controllers resolve the token in their
    // own DI context, where plain AppModule providers are invisible — the
    // AUTH_USER_* logs (created/updated/deleted, signup, logout, password
    // reset) would silently never fire with the provider in AppModule.
    {
      provide: AuthLoggerHooks.AUTH_API_LOGGER,
      useFactory: (loggerService: LoggerService) => {
        const logger: AuthLoggerFn = async (options) => {
          await loggerService.createLog({
            tenantId: String(options.tenantId),
            userId: options.userId,
            section: options.section,
            action: options.action as LogAction,
            refType: options.refType,
            refId: options.refId,
            data: options.data,
          });
        };
        return logger;
      },
      inject: [LoggerService],
    },
  ],
  exports: [LoggerService, AuthLoggerHooks.AUTH_API_LOGGER],
})
export class CoreLoggerModule {
  static DBOptions = DBOptions;
}
