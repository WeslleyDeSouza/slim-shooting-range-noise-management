import './core/env-loader';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  env,
  MiddlewareCors,
  MiddlewareSecurityHeaders,
} from '@app-galaxy/core-api';
import * as http from 'node:http';

import { AppModule } from './app.module';
import { setupMermaidUml, setupSwagger } from './common/docs';
import { applyMiddlewareAppStripeDouble, resolveTrustProxy } from '@api-slim/common';

env.load();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const server: http.Server = app.getHttpServer();

  // Behind a reverse proxy the client IP comes from X-Forwarded-For; the
  // number of trusted hops is API_TRUST_PROXY (0 when exposed directly).
  app.set('trust proxy', resolveTrustProxy());

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      forbidUnknownValues: true,
      skipUndefinedProperties: true,
      skipNullProperties: true,
    }),
  );

  // Coolify / proxy work-around: collapse a doubled `/api/api` prefix.
  app.use(applyMiddlewareAppStripeDouble());
  app.use(MiddlewareCors());
  app.use(MiddlewareSecurityHeaders());

  if (env.isSwaggerEnabled) {
    setupSwagger(app);
    // ERD of the live schema → /erd and docs/architecture/uml.mmd (dev only)
    void setupMermaidUml(app).catch((error) =>
      Logger.warn(`ERD generation failed: ${error?.message ?? error}`, 'Uml'),
    );
  }

  // Timeout handling (5 min)
  server.setTimeout(300000);
  server.keepAliveTimeout = 300000;
  server.headersTimeout = 300000;

  const port: number = +(
    process.env['API_PORT'] ||
    process.env['PORT'] ||
    3333
  );

  await app.listen(port);

  env.logApplicationStartUpInfo(Logger, { globalPrefix, port });
}

bootstrap();
