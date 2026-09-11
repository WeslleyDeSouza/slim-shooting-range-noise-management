/**
 * Loads `.env` BEFORE any other module is evaluated. Libraries such as
 * `@app-galaxy/auth-api` read the JWT secret while their module file is
 * required, so a plain `env.load()` inside main.ts (after the hoisted imports)
 * is too late when the bundle is started with `node` or pm2. Nx injects the
 * file itself when serving, which is why this only shows up in production.
 *
 * Import this file first in `main.ts`.
 */
import * as path from 'path';

const load = (fileName: string) => {
  try {
    require('dotenv').config({
      path: path.resolve(process.cwd(), fileName),
      quiet: true,
    });
  } catch {
    // dotenv is optional at runtime — the host may already provide the env.
  }
};

load('.env');
load('.env.public');
