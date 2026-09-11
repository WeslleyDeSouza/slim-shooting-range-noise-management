const { spawn } = require('child_process');
const path = require('path');

const env = {
  // Before the spread, so a developer's .env still wins.
  APP_DEFAULT_USER: 'slim@demo.ch',
  APP_DEFAULT_PASSWORD: '1234',
  PORT: process.env.PORT || '3333',
  API_PORT: process.env.API_PORT || process.env.PORT || '3333',

  ...process.env,

  // Forced, after the spread: the test environment must not be inherited.
  APP_ENV: 'development',
  APP_SECRET: 'test',
  API_SECRET: 'test',

  // In-memory schema for every run, so specs start from a clean state.
  DB_SYNC: '1',
  DB_TYPE: 'sqlite',
  DB_DATABASE: ':memory:',

  TZ: 'UTC',
};

const isWindows = process.platform === 'win32';
const cmd = isWindows ? 'npx.cmd' : 'npx';

const child = spawn(cmd, ['nx', 'serve', 'api'], {
  stdio: 'inherit',
  env,
  cwd: path.resolve(__dirname, '..'),
  shell: isWindows,
});

child.on('exit', (code) => process.exit(code));
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
