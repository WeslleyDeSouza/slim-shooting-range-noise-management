import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';
import { config as loadEnv } from 'dotenv';

import { STORAGE_STATE } from './src/support/storage';

/**
 * Load the workspace env — for the specs (which user to sign in as, see
 * support/credentials.ts) and for the API, since `webServer` inherits this
 * process's env. `.env.example` is the fallback because CI has no `.env`;
 * dotenv never overwrites what is already in `process.env`.
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
  // Serial on purpose: the specs share one API instance and one session
  // (signing in again deletes the device's previous session rows).
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
    // Signs in once; the admin project starts from that session.
    // `login.spec.ts` opts back out with its own empty storageState.
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      testMatch: ['**/src/*.spec.ts'],
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
    // Acceptance criteria of the tender (docs/anforderungskatalog, `slm` ids),
    // kept apart from the page suite: `npx playwright test --project=criterias`.
    // Skeleton only for now (every case is `test.fixme`); the folder goes away
    // once the cases moved into the page specs or the criteria are proven.
    {
      name: 'criterias',
      testMatch: ['**/src/criterias/*.spec.ts'],
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
    // Use cases per actor (B1 4.x, `src/actors/readme.md`):
    // `npx playwright test --project=actors`. No shared session on purpose —
    // every case signs in as its actor (`signInAs`), T01 stays signed out.
    // Skeleton only for now (every case is `test.fixme`).
    {
      name: 'actors',
      testMatch: ['**/src/actors/**/*.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
    },
  ],
});
