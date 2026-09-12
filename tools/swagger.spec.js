/**
 * Writes `config/api-gateway-swagger-spec.json` without a running server:
 * boots the API once against an in-memory SQLite (no demo seed, no client
 * generation, no listen), lets `setupSwagger` write the spec, and exits.
 * Use it before `npm run ng-swagger` when the API is not running:
 *
 *   node tools/swagger.spec.js && npm run ng-swagger
 */
const { spawn } = require('child_process');
const path = require('path');

const env = {
  ...process.env,
  APP_ENV: 'development',
  APP_SECRET: 'spec',
  API_SECRET: 'spec',
  API_AUTH_TEMPLATE_USE_EMAIL_TABLE: 'true',
  API_SWAGGER_ENABLED: '1',
  API_SWAGGER_GENERATE_CLIENT: '0',
  API_SWAGGER_SPEC_ONLY: '1',
  DEMO_SEED: '0',
  AREA_STATUS_REFRESH_ON_BOOT: '0',
  DB_SYNC: '1',
  DB_TYPE: 'sqlite',
  DB_DATABASE: ':memory:',
  API_PORT: process.env.API_SPEC_PORT || '3999',
  PORT: process.env.API_SPEC_PORT || '3999',
  TZ: 'UTC',
};

const isWindows = process.platform === 'win32';
const child = spawn(isWindows ? 'npx.cmd' : 'npx', ['nx', 'serve', 'api', '--skip-nx-cache'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env,
  cwd: path.resolve(__dirname, '..'),
  shell: isWindows,
});

const timeout = setTimeout(() => {
  console.error('swagger.spec: timed out waiting for the spec');
  child.kill();
  process.exit(1);
}, 240_000);

function watch(chunk) {
  const text = chunk.toString();
  process.stdout.write(text);
  if (text.includes('Spec written to')) {
    clearTimeout(timeout);
    setTimeout(() => {
      child.kill();
      process.exit(0);
    }, 500);
  }
}
child.stdout.on('data', watch);
child.stderr.on('data', watch);
child.on('exit', (code) => {
  clearTimeout(timeout);
  process.exit(code ?? 1);
});
