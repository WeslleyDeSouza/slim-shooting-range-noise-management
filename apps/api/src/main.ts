import './core/env-loader';
import { Logger } from '@nestjs/common';
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
import {
  API_GLOBAL_PREFIX,
  applyMiddlewareAppStripeDouble,
  createValidationPipe,
  resolveTrustProxy,
  securityHeaders,
} from '@api-slim/common';
import { DataSource } from "typeorm";
import { staticFileMiddleware, TABLE_EXPORT_ROUTE, tableExportBodyParser } from "./core";

env.load();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const server: http.Server = app.getHttpServer();

  // Behind a reverse proxy the client IP comes from X-Forwarded-For; the
  // number of trusted hops is API_TRUST_PROXY (0 when exposed directly).
  app.set('trust proxy', resolveTrustProxy());

  // Prefix + validation pipe are shared with the supertest HTTP specs
  // (`createTestApp` in @api-slim/tests), so the tests see the real pipeline.
  const globalPrefix = API_GLOBAL_PREFIX;
  app.setGlobalPrefix(globalPrefix);
  app.useGlobalPipes(createValidationPipe());

  const dataSource = app.get(DataSource);

  // No product banner in the responses (express default and the galaxy CORS default).
  app.disable('x-powered-by');

  // Coolify WorkAround
  app.use(applyMiddlewareAppStripeDouble());
  // Security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Permissions-Policy) on every
  // response, also the CORS preflight: SLIM's own list goes in as custom headers of the CORS middleware and
  // is therefore set last — it does not depend on the galaxy opt-in (API_CONFIG_HEADERS_SECURITY) and wins
  // over the galaxy defaults when that is set. See `securityHeaders()` in @api-slim/common.
  app.use(MiddlewareSecurityHeaders());
  app.use(MiddlewareCors({ customHeaders: securityHeaders() }));
  app.use(staticFileMiddleware(dataSource));
  // The table export receives the rows of a mask (B1 5.5.5): only this route takes a larger body than the
  // default of 100 kB (see `tableExportBodyParser` for why it is wired this way).
  app.use(`/${globalPrefix}/${TABLE_EXPORT_ROUTE}`, tableExportBodyParser());

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
