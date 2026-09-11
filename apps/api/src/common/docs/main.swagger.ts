import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { exec } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** Committed spec; source for the generated Angular client (ELO pattern). */
export const SWAGGER_SPEC_FILE = 'config/api-gateway-swagger-spec.json';

/**
 * Swagger UI at /api/docs. Outside production the OpenAPI document is also
 * written to `config/api-gateway-swagger-spec.json` and the Angular client
 * (`libs/app/generated`, `@ui-slim/apiClient`) is regenerated with
 * `npm run ng-swagger` — so every DTO / controller change reaches the app
 * as typed models and services without hand-written interfaces.
 */
export function setupSwagger(app: INestApplication, path = 'docs'): void {
  const config = new DocumentBuilder()
    .setTitle(process.env['APP_NAME'] || 'SLIM API')
    .setDescription('Schiesslärmimmissions-Management – REST API')
    .setVersion(process.env['npm_package_version'] || '0.0.1')
    .addBearerAuth({
      description: 'Bearer <JWT>',
      name: 'Authorization',
      bearerFormat: 'Bearer',
      scheme: 'Bearer',
      type: 'http',
      in: 'Header',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(path, app, document, {
    jsonDocumentUrl: `${path}-json`,
    swaggerOptions: { docExpansion: 'none', persistAuthorization: true },
  });

  if (process.env['APP_ENV'] === 'production') return;
  if (process.env['API_SWAGGER_GENERATE_CLIENT'] === '0') return;

  const logger = new Logger('Swagger');
  try {
    const file = resolve(process.cwd(), SWAGGER_SPEC_FILE);
    mkdirSync(dirname(file), { recursive: true });
    // Strip the "Controller" suffix so generated service names read
    // `RangesService`, not `RangesControllerService`.
    writeFileSync(file, JSON.stringify(document).replace(/Controller/g, ''));
    logger.log(
      `Spec written to ${SWAGGER_SPEC_FILE}, generating @ui-slim/apiClient …`,
    );

    exec(
      'npm run ng-swagger',
      { cwd: process.cwd() },
      (error, _stdout, stderr) => {
        if (error)
          logger.error(`ng-swagger failed: ${stderr || error.message}`);
        else
          logger.log(
            '@ui-slim/apiClient regenerated (libs/app/generated/src/core)',
          );
      },
    );
  } catch (e) {
    logger.error(`Could not write swagger spec: ${(e as Error).message}`);
  }
}
