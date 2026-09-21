import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import process from 'node:process';
import { join } from 'path';

const isLocalEnv = !!process.env['APP_ENV_LOCAL'];
export const fileStaticPath =
  process.env['APP_DIST_PATH'] ||
  join(
    ...[
      __dirname,
      '..',
      '..',
      isLocalEnv ? 'apps' : undefined,
      'app',
      'browser',
    ].filter((hasValue) => !!hasValue)
  );

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: fileStaticPath,
      exclude: ['/api/{*splat}'],
    }),
  ],
})
export class CoreStaticFileModule {
  constructor() {
    console.info('Serving files from:', fileStaticPath);
  }
}
