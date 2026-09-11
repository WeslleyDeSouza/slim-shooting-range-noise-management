import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';
import { config as loadEnv } from 'dotenv';

/**
 * Load the workspace env for the specs and for the API, since `webServer`
 * inherits this process's env. `.env.example` is the fallback because CI has
 * no `.env`; dotenv never overwrites what is already in `process.env`.
 */
const envFile = existsSync(join(workspaceRoot, '.env'))
  ? '.env'
  : '.env.example';
loadEnv({ path: join(workspaceRoot, envFile) });

const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';
const isCI = !!process.env['CI'];

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  retries: isCI ? 2 : 1,
  // Serial on purpose: the specs share one API instance and its state.
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  maxFailures: isCI ? 10 : 0,
  reporter: isCI ? [['list'], ['html']] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    actionTimeout: 15000,
  },
  webServer: [
    {
      command: 'node tools/serve-api-e2e.js',
      url: 'http://localhost:3333/api/health/alive',
      reuseExistingServer: !isCI,
      cwd: workspaceRoot,
      timeout: 180000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npx nx serve app',
      url: 'http://localhost:4200',
      reuseExistingServer: !isCI,
      cwd: workspaceRoot,
      timeout: 300000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
