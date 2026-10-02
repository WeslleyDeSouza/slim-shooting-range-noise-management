import { Body, Controller, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { TABLE_EXPORT_ROUTE, tableExportBodyParser } from './table-export-body';

@Controller()
class EchoController {
  /** Stands for the table export: answers with the number of rows it received. */
  @Post(TABLE_EXPORT_ROUTE)
  rows(@Body() body: { rows?: unknown[] }): { rows: number } {
    return { rows: body?.rows?.length ?? -1 };
  }

  /** Stands for every other route, e.g. the sign-in. */
  @Post('auth/signin')
  signin(@Body() body: { email?: string }): { email: string | null } {
    return { email: body?.email ?? null };
  }
}

@Module({ controllers: [EchoController] })
class EchoModule {}

/** About 300 kB of JSON: more than the default limit of 100 kB. */
const LARGE = { rows: Array.from({ length: 3000 }, (_, i) => [`Zeile ${i}`, 'x'.repeat(80), i]) };

/**
 * The larger body limit of the table export, wired as in `main.ts`: it must
 * not take the JSON parser away from the other routes (found by the e2e
 * sign-in: Nest skips its own parser when a middleware is named `jsonParser`).
 */
describe('tableExportBodyParser — larger body for the table export only', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(EchoModule, { logger: false });
    app.setGlobalPrefix('api');
    app.use(`/api/${TABLE_EXPORT_ROUTE}`, tableExportBodyParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('is not named like the parser Nest looks for', () => {
    expect(tableExportBodyParser().name).not.toBe('jsonParser');
  });

  it('lets the table export receive a body above the default limit', async () => {
    const res = await request(app.getHttpServer()).post(`/api/${TABLE_EXPORT_ROUTE}`).send(LARGE).expect(201);
    expect(res.body).toEqual({ rows: 3000 });
  });

  it('leaves the body of every other route parsed (sign-in)', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/signin').send({ email: 'slim@demo.ch' }).expect(201);
    expect(res.body).toEqual({ email: 'slim@demo.ch' });
  });

  it('keeps the default limit on every other route', async () => {
    await request(app.getHttpServer()).post('/api/auth/signin').send(LARGE).expect(413);
  });
});
