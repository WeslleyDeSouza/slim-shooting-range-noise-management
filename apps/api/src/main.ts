import './core/env-loader';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as http from 'node:http';

import { AppModule } from './app.module';
import { env } from './core';
import { setupSwagger } from './common/docs';
import {
  applyMiddlewareAppStripeDouble,
  resolveTrustProxy,
} from '@api-slim/common';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      origin: process.env['API_ACCESS_CONTROL_ORIGIN'] || '*',
      credentials: true,
    },
  });
  const server: http.Server = app.getHttpServer();

  app.set('trust proxy', resolveTrustProxy());

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      forbidUnknownValues: true,
      skipUndefinedProperties: true,
      skipNullProperties: true,
      transform: true,
    }),
  );

  // Coolify / proxy work-around: collapse a doubled `/api/api` prefix.
  app.use(applyMiddlewareAppStripeDouble());

  if (env.isSwaggerEnabled) {
    setupSwagger(app);
  }

  // Timeout handling (5min)
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
