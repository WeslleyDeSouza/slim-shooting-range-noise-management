const { existsSync, readFileSync } = require('node:fs');
const { isAbsolute, join } = require('node:path');

// docker-compose.yml -> service app-db, container app-slim-db (MariaDB 11.8).
const COMPOSE_SERVICE = 'app-db';
const READY_TIMEOUT_MS = 90_000;
const READY_POLL_MS = 2_000;
const SQLITE_FILE = /\.(sqlite3?|db)$/i;

/**
 * Every server driver the API accepts (DB_TYPE goes straight to TypeORM).
 * mysql and mariadb share the mysql2 package; postgres uses pg. Both are in
 * package.json, so they resolve from the project's node_modules once the
 * dependency step ran.
 */
const DRIVERS = {
  mysql: { pkg: 'mysql2/promise', port: 3306, compose: true },
  mariadb: { pkg: 'mysql2/promise', port: 3306, compose: true },
  postgres: { pkg: 'pg', port: 5432, compose: false },
};

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
 * The sqlite filename comes from `.env`, else `.env.example`. Falling back from
 * a server, the existing DB_DATABASE is a schema name — only reuse it if it is a file.
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolved from setup/, so this finds the project's own node_modules. */
function loadDriver(driver) {
  const spec = DRIVERS[driver];
  if (!spec) return null;
  try {
    return require(spec.pkg);
  } catch {
    return null;
  }
}

function credentials(env) {
  const driver = clean(env['DB_TYPE']).toLowerCase();
  return {
    driver,
    host: clean(env['DB_HOST']) || '127.0.0.1',
    port: Number(clean(env['DB_PORT'])) || (DRIVERS[driver]?.port ?? 3306),
    user: clean(env['DB_USERNAME']),
    password: clean(env['DB_PASSWORD']),
    database: clean(env['DB_DATABASE']),
  };
}

/**
 * Open one connection, ping, close. `database` undefined means "server only" —
 * for postgres that maps to the `postgres` maintenance database, because pg
 * always needs *some* database to connect to.
 * Resolves `{ ok, code?, message? }` — never throws.
 */
async function tryConnect(lib, config) {
  if (config.driver === 'postgres') {
    const client = new lib.Client({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database || 'postgres',
      connectionTimeoutMillis: 5_000,
    });
    try {
      await client.connect();
      await client.query('select 1');
      return { ok: true };
    } catch (error) {
      return { ok: false, code: error.code, message: error.message };
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  let connection;
  try {
    connection = await lib.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      connectTimeout: 5_000,
    });
    await connection.ping();
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error.code, message: error.message };
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}

/** Does the named database exist? Throws only when the server itself is unreachable. */
async function databaseExists(lib, config) {
  if (config.driver === 'postgres') {
    const client = new lib.Client({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: 'postgres',
      connectionTimeoutMillis: 5_000,
    });
    await client.connect();
    try {
      const result = await client.query('select 1 from pg_database where datname = $1', [config.database]);
      return result.rowCount > 0;
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  const connection = await lib.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
  });
  try {
    const [rows] = await connection.query('SHOW DATABASES LIKE ?', [config.database]);
    return rows.length > 0;
  } finally {
    await connection.end().catch(() => undefined);
  }
}

async function createDatabase(lib, config) {
  // Identifiers cannot be parameterised; the name comes from .env, which the
  // developer wrote, so quoting it is the whole defence needed here.
  if (config.driver === 'postgres') {
    const client = new lib.Client({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: 'postgres',
    });
    await client.connect();
    try {
      await client.query(`CREATE DATABASE "${config.database.replace(/"/g, '""')}"`);
    } finally {
      await client.end().catch(() => undefined);
    }
    return;
  }

  const connection = await lib.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
  });
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database.replace(/`/g, '``')}\``);
  } finally {
    await connection.end().catch(() => undefined);
  }
}

/**
 * Reach the server without naming a database — that separates "server is down"
 * from "server is up, database was never created" — then create it if needed.
 * Throws when the server itself is unreachable, which is the signal to escalate.
 */
async function ensureDatabase(ctx, env) {
  const config = credentials(env);
  const lib = loadDriver(config.driver);
  if (!lib) throw new Error(`the ${DRIVERS[config.driver]?.pkg ?? config.driver} driver is not installed`);

  const reachable = await tryConnect(lib, { ...config, database: undefined });
  if (!reachable.ok) throw new Error(`${config.driver} is unreachable: ${reachable.code || reachable.message}`);

  if (await databaseExists(lib, config)) return false;

  await createDatabase(lib, config);
  ctx.log('heal', `created database ${config.database}`);
  return true;
}

/** @type {import('@app-galaxy/setup-api').StepDefinition} */
module.exports = {
  group: 'Workspace',
  title: 'Reach the database',
  description:
    'Confirm the driver from <code>.env</code> can actually be talked to: the SQLite file, or the MariaDB / MySQL / PostgreSQL server.',

  async check(ctx) {
    const env = await ctx.readEnv();
    const driver = clean(env['DB_TYPE']).toLowerCase();
    const database = clean(env['DB_DATABASE']);

    if (driver === 'sqlite') {
      const file = isAbsolute(database) ? database : join(ctx.projectDir, database);
      if (existsSync(file)) return { ok: true, note: `${database} exists` };
      if (clean(env['DB_SYNC']) === '1') return { ok: true, note: 'the API will create the file on first boot' };
      return { ok: false, note: `${database} is missing and DB_SYNC=0` };
    }

    if (!DRIVERS[driver]) return { ok: false, note: `unsupported DB_TYPE "${driver}"` };

    const lib = loadDriver(driver);
    if (!lib) {
      return { ok: false, note: `${DRIVERS[driver].pkg} is not installed — run the dependency step first` };
    }

    const config = credentials(env);
    const result = await tryConnect(lib, config);
    if (result.ok) {
      return { ok: true, note: `${driver} — ${config.user}@${config.host}:${config.port}/${config.database}` };
    }

    return { ok: false, note: `${result.code || 'connection failed'}: ${result.message}` };
  },

  async heal(ctx) {
    const env = await ctx.readEnv();
    const driver = clean(env['DB_TYPE']).toLowerCase();
    if (!DRIVERS[driver]) throw new Error(`nothing to heal for DB_TYPE "${driver}"`);

    await ensureDatabase(ctx, env);
  },

  async escalate(ctx) {
    const env = await ctx.readEnv();
    const config = credentials(env);
    const composable = Boolean(DRIVERS[config.driver]?.compose);

    const choices = [];
    if (composable) {
      choices.push({ id: 'docker', label: `Start the ${COMPOSE_SERVICE} container (MariaDB)`, kind: 'primary' });
    }
    choices.push(
      {
        id: 'credentials',
        label: 'Fix the credentials…',
        kind: composable ? 'line' : 'primary',
        view: 'form',
        viewData: {
          DB_TYPE: config.driver,
          DB_HOST: config.host,
          DB_DATABASE: config.database,
          DB_PORT: String(config.port),
          DB_USERNAME: config.user,
          DB_PASSWORD: config.password,
        },
      },
      { id: 'sqlite', label: 'Fall back to SQLite', kind: 'line' },
      { id: 'skip', label: 'Skip for now', kind: 'soft' },
    );

    return {
      title: `${config.driver} is not answering`,
      message:
        `Nothing is listening on <code>${config.host}:${config.port}</code>, or the credentials are wrong. ` +
        (composable
          ? `This repo ships a MariaDB container in <code>docker-compose.yml</code> — starting it changes no files and is usually the fastest way out. `
          : `There is no compose service for ${config.driver}; start your own server, or switch the driver. `) +
        `The other options rewrite <code>.env</code>, keeping a copy at <code>.env.backup</code>.`,
      docsUrl: composable ? 'https://docs.docker.com/compose/' : 'https://typeorm.io/data-source-options',
      choices,
    };
  },

  async onChoice(choiceId, payload, ctx) {
    if (choiceId === 'skip') return { skip: true };

    // Both branches replace values the user already has, and both were chosen
    // explicitly — writeEnv would otherwise report a conflict and change nothing.
    if (choiceId === 'sqlite') {
      const defaults = await sqliteDefaults(ctx);
      await ctx.writeEnv(defaults, { overwrite: true });
      ctx.log('ok', `switched to sqlite at ${defaults.DB_DATABASE} — a copy of .env is at .env.backup`);
      return;
    }

    if (choiceId === 'credentials' && payload) {
      const driver = DRIVERS[clean(payload.DB_TYPE)] ? clean(payload.DB_TYPE) : undefined;
      await ctx.writeEnv(
        {
          ...(driver ? { DB_TYPE: driver } : {}),
          DB_HOST: clean(payload.DB_HOST) || '127.0.0.1',
          DB_DATABASE: payload.DB_DATABASE,
          DB_PORT: payload.DB_PORT,
          DB_USERNAME: payload.DB_USERNAME,
          DB_PASSWORD: payload.DB_PASSWORD,
        },
        { overwrite: true },
      );
      ctx.log('ok', 'updated the database credentials');
      return;
    }

    if (choiceId === 'docker') {
      const up = await ctx.exec(`docker compose up -d ${COMPOSE_SERVICE}`, { cwd: ctx.projectDir });
      if (up.code !== 0) {
        ctx.log('warn', 'docker compose failed — is Docker Desktop running?');
        return;
      }

      // The container reports "started" long before the server accepts connections.
      const env = await ctx.readEnv();
      const config = credentials(env);
      const lib = loadDriver(config.driver);
      const deadline = Date.now() + READY_TIMEOUT_MS;

      ctx.log('info', 'waiting for the database server to accept connections…');
      while (lib && Date.now() < deadline) {
        const result = await tryConnect(lib, { ...config, database: undefined });
        if (result.ok) {
          ctx.log('ok', 'the database server is accepting connections');
          // The runner goes straight back to check() after onChoice — it does not
          // heal again — so create the database here or check() fails on a fresh volume.
          await ensureDatabase(ctx, env);
          return;
        }
        await sleep(READY_POLL_MS);
      }

      ctx.log('warn', `the database did not come up in time — check \`docker compose logs ${COMPOSE_SERVICE}\``);
    }
    // Returning nothing re-runs check().
  },
};
