const { randomBytes } = require('node:crypto');
const { copyFileSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

// apps/api/src/app.module.ts hands DB_TYPE straight to TypeORM; the drivers
// (sqlite3, mysql2 for mysql/mariadb, pg) are all in package.json.
// docker-compose.yml ships MariaDB.
const SUPPORTED_DRIVERS = ['sqlite', 'mysql', 'mariadb', 'postgres'];
const SERVER_DRIVERS = ['mysql', 'mariadb', 'postgres'];
const DEFAULT_PORT = { mysql: '3306', mariadb: '3306', postgres: '5432' };
const SQLITE_FILE = /\.(sqlite3?|db)$/i;
const DEFAULT_DATABASE = 'app-slim';

/** dotenv keeps `'sqlite'` quoted in some readers, bare in others. */
function clean(value) {
  return String(value ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
}

function parseEnvFile(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (match) out[match[1]] = clean(match[2]);
  }
  return out;
}

/**
 * The sqlite filename is the project's to declare, not ours to invent: prefer what
 * `.env` already holds, then `.env.example`. A server schema name is not a filename,
 * so an existing DB_DATABASE only carries over when it looks like a sqlite file.
 */
async function sqliteDefaults(ctx) {
  const current = clean((await ctx.readEnv())['DB_DATABASE']);
  const example = ctx.exists('.env.example')
    ? parseEnvFile(readFileSync(join(ctx.projectDir, '.env.example'), 'utf8'))
    : {};
  const declared = clean(example['DB_DATABASE']);

  let database = 'local.database.sqlite';
  if (SQLITE_FILE.test(current)) database = current;
  else if (SQLITE_FILE.test(declared)) database = declared;

  return { DB_TYPE: 'sqlite', DB_DATABASE: database, DB_SYNC: '1' };
}

/** writeEnv reports conflicts rather than clobbering. Surface them instead of forcing. */
async function writeAndReport(ctx, values, opts) {
  const result = (await ctx.writeEnv(values, opts)) || {};
  for (const conflict of result.conflicts || []) {
    ctx.log('attn', `${conflict.key} already holds "${conflict.existing}" — not replacing it with "${conflict.incoming}"`);
  }
  return result;
}

/** @type {import('@app-galaxy/setup-api').StepDefinition} */
module.exports = {
  title: 'Set up environment',
  description:
    'Create the root <code>.env</code> from <code>.env.example</code> and pick a database driver.',

  async check(ctx) {
    if (!ctx.exists('.env')) return { ok: false, note: '.env is missing' };

    const env = await ctx.readEnv();
    if (!clean(env['APP_SECRET'])) return { ok: false, note: 'APP_SECRET is empty' };

    const driver = clean(env['DB_TYPE']).toLowerCase();
    if (!SUPPORTED_DRIVERS.includes(driver)) {
      return { ok: false, note: `DB_TYPE must be one of ${SUPPORTED_DRIVERS.join(', ')}, got "${driver || '(empty)'}"` };
    }

    if (!clean(env['DB_DATABASE'])) return { ok: false, note: 'DB_DATABASE is empty' };

    if (SERVER_DRIVERS.includes(driver)) {
      const missing = ['DB_USERNAME'].filter((key) => !clean(env[key]));
      if (missing.length) return { ok: false, note: `${driver} needs ${missing.join(', ')}` };
    }

    // The demo account is what the login, permission and seed steps sign in with.
    const missingDemo = ['APP_DEFAULT_USER', 'APP_DEFAULT_PASSWORD'].filter((key) => !clean(env[key]));
    if (missingDemo.length) return { ok: false, note: `${missingDemo.join(', ')} not set` };

    return { ok: true, note: `${driver} — ${clean(env['DB_DATABASE'])}` };
  },

  async heal(ctx) {
    // Never truncate a .env someone else wrote.
    if (!ctx.exists('.env')) {
      if (!ctx.exists('.env.example')) throw new Error('.env.example is missing — nothing to copy from');
      copyFileSync(join(ctx.projectDir, '.env.example'), join(ctx.projectDir, '.env'));
      ctx.log('heal', 'copied .env.example to .env');
    }

    const env = await ctx.readEnv();

    // A secret can be invented.
    if (!clean(env['APP_SECRET'])) {
      await writeAndReport(ctx, { APP_SECRET: randomBytes(32).toString('hex') });
      ctx.log('heal', 'generated a fresh APP_SECRET');
    }

    // A database cannot. Only fill DB_TYPE when it is genuinely absent — an
    // unsupported value is the user's, and check() will escalate it.
    if (!clean(env['DB_TYPE'])) {
      const defaults = await sqliteDefaults(ctx);
      await writeAndReport(ctx, defaults);
      ctx.log('heal', `defaulted DB_TYPE to sqlite at ${defaults.DB_DATABASE}`);
    }

    // The demo user the API seeds in non-production (apps/api/src/mocks).
    const demo = {};
    if (!clean(env['APP_DEFAULT_USER'])) demo.APP_DEFAULT_USER = 'slim@demo.ch';
    if (!clean(env['APP_DEFAULT_PASSWORD'])) demo.APP_DEFAULT_PASSWORD = '1234';
    if (Object.keys(demo).length) {
      await writeAndReport(ctx, demo);
      ctx.log('heal', `set the demo account (${Object.keys(demo).join(', ')})`);
    }
  },

  async escalate(ctx) {
    const env = ctx.exists('.env') ? await ctx.readEnv() : {};
    const existing = clean(env['DB_TYPE']);

    const replacing = existing
      ? `<code>DB_TYPE</code> currently reads <code>${existing}</code>, which this project cannot use. ` +
        'Replacing it keeps a copy at <code>.env.backup</code>.'
      : '';

    return {
      title: existing ? `Replace DB_TYPE (${existing})?` : 'Which database?',
      message:
        `${replacing} SQLite needs no server and is the default for development. ` +
        'A server (MariaDB, MySQL or PostgreSQL) is what production runs — it needs to be reachable, ' +
        'or use the MariaDB container in <code>docker-compose.yml</code>.',
      docsUrl: 'https://typeorm.io/data-source-options',
      choices: [
        { id: 'sqlite', label: 'Use SQLite', kind: 'primary' },
        {
          id: 'server',
          label: 'Configure a database server…',
          kind: 'line',
          view: 'form',
          viewData: {
            DB_TYPE: SERVER_DRIVERS.includes(existing.toLowerCase()) ? existing.toLowerCase() : 'mariadb',
            DB_HOST: clean(env['DB_HOST']) || '127.0.0.1',
            DB_DATABASE: SQLITE_FILE.test(clean(env['DB_DATABASE'])) ? DEFAULT_DATABASE : clean(env['DB_DATABASE']) || DEFAULT_DATABASE,
            DB_PORT: clean(env['DB_PORT']) || DEFAULT_PORT[existing.toLowerCase()] || '3306',
            DB_USERNAME: clean(env['DB_USERNAME']) || 'root',
            DB_PASSWORD: clean(env['DB_PASSWORD']) || 'root',
          },
        },
        { id: 'skip', label: 'Skip for now', kind: 'soft' },
      ],
    };
  },

  async onChoice(choiceId, payload, ctx) {
    if (choiceId === 'skip') return { skip: true };

    // These branches were chosen explicitly, so overwriting is what the user asked for.
    if (choiceId === 'sqlite') {
      const defaults = await sqliteDefaults(ctx);
      await ctx.writeEnv(defaults, { overwrite: true });
      ctx.log('ok', `using sqlite at ${defaults.DB_DATABASE}`);
      return;
    }

    if (choiceId === 'server' && payload) {
      const driver = SERVER_DRIVERS.includes(clean(payload.DB_TYPE)) ? clean(payload.DB_TYPE) : 'mariadb';
      await ctx.writeEnv(
        {
          DB_TYPE: driver,
          DB_HOST: clean(payload.DB_HOST) || '127.0.0.1',
          DB_DATABASE: payload.DB_DATABASE,
          DB_PORT: payload.DB_PORT,
          DB_USERNAME: payload.DB_USERNAME,
          DB_PASSWORD: payload.DB_PASSWORD,
          DB_SYNC: payload.DB_SYNC ? '1' : '0',
        },
        { overwrite: true }
      );
      ctx.log('ok', `using ${driver} at ${payload.DB_USERNAME}@${clean(payload.DB_HOST) || '127.0.0.1'}:${payload.DB_PORT}`);
    }
    // Returning nothing re-runs check().
  },
};
