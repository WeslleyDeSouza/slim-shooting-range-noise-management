import type { LoggerService } from '@nestjs/common';

/**
 * Small env facade (stand-in for `env` from @app-galaxy/core-api). The
 * `.env` file itself is loaded by `core/env-loader.ts`, which main.ts imports
 * first; this only exposes the flags the bootstrap needs.
 */
class Env {
  get appEnv(): string {
    return process.env['APP_ENV'] || 'development';
  }

  isProd(): boolean {
    return this.appEnv === 'production';
  }

  isTest(): boolean {
    return this.appEnv === 'test';
  }

  get isSwaggerEnabled(): boolean {
    return process.env['API_SWAGGER_ENABLED'] === '1';
  }

  logApplicationStartUpInfo(
    logger: { log: LoggerService['log'] },
    info: { globalPrefix: string; port: number },
  ): void {
    const name = process.env['APP_NAME'] || 'api';
    logger.log(
      `${name} [${this.appEnv}] running on http://localhost:${info.port}/${info.globalPrefix}`,
    );
    if (this.isSwaggerEnabled) {
      logger.log(
        `Swagger: http://localhost:${info.port}/${info.globalPrefix}/docs`,
      );
    }
  }
}

export const env = new Env();
