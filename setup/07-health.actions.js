const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');

const GLOBAL_PREFIX = 'api'; // apps/api/src/main.ts -> setGlobalPrefix('api')
// apps/api/src/core/health-check/health.controller.ts
const ALIVE = 'alive'; // plain liveness, no indicators
const READY = 'ready'; // Terminus: TypeORM ping = the database check
const SERVE_ARGS = ['serve', 'api'];

const ALREADY_UP_MS = 3_000; // it may simply be running already
const BOOT_TIMEOUT_MS = 180_000; // a cold nx build is slow
const POLL_MS = 1_500;
const REQUEST_TIMEOUT_MS = 2_000;
const TAIL_LINES = 40;

/** Lines worth surfacing out of a very chatty build. */
const INTERESTING =
  /error|failed|exception|listening|started|successfully|nest|port/i;

function clean(value) {
  return String(value ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolves `{ ok, status?, body?, error? }` — never rejects.
 *
 * `agent: false` because this polls a booting server: Node's global agent keeps
 * sockets alive, and a pooled socket to a process that just died reports
 * ECONNRESET rather than the honest "not listening yet".
 */
function getJson(url) {
  return new Promise((resolve) => {
    const request = http.get(
      url,
      { timeout: REQUEST_TIMEOUT_MS, agent: false },
      (response) => {
        let raw = '';
        response.on('data', (chunk) => (raw += chunk));
        response.on('end', () => {
          let body;
          try {
            body = JSON.parse(raw);
          } catch {
            body = raw;
          }
          // Terminus answers 503 with a body describing which indicator is down.
          resolve({
            ok: response.statusCode >= 200 && response.statusCode < 300,
            status: response.statusCode,
            body,
          });
        });
      },
    );

    request.on('timeout', () => {
      request.destroy();
      resolve({ ok: false, error: 'timeout' });
    });
    request.on('error', (error) =>
      resolve({ ok: false, error: error.code || error.message }),
    );
  });
}

async function baseUrl(ctx) {
  const env = await ctx.readEnv();
  const port = Number(clean(env['API_PORT'])) || 3333;
  return `http://localhost:${port}/${GLOBAL_PREFIX}/health`;
}

/**
 * The wizard owns anything it starts.
 *
 * `nx serve api` is a tree of processes (nx -> node). Killing the direct
 * child leaves the server holding the port, so kill the whole tree: `taskkill /T`
 * on Windows, a process-group signal elsewhere.
 */
const server = { child: null, tail: [], cleanupBound: false };

function stopServer() {
  const child = server.child;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  try {
    if (process.platform === 'win32')
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
    else process.kill(-child.pid, 'SIGTERM');
  } catch {
    // already gone
  }
}

function bindCleanup() {
  if (server.cleanupBound) return;
  server.cleanupBound = true;
  // Runs in the Electron main process: tie the server's life to the wizard's.
  process.once('exit', stopServer);
  process.once('SIGINT', stopServer);
  process.once('SIGTERM', stopServer);
}

function startServer(ctx) {
  // Run nx's entrypoint on this Node binary rather than shelling out to `npx`.
  // `shell: true` would concatenate rather than escape argv (DEP0190), and on
  // Windows `npx` is a .cmd that cannot be spawned without a shell at all.
  let nxBin;
  try {
    nxBin = require.resolve('nx/bin/nx.js');
  } catch {
    throw new Error('nx is not installed — run the dependency step first');
  }

  const child = spawn(process.execPath, [nxBin, ...SERVE_ARGS], {
    cwd: ctx.projectDir,
    detached: process.platform !== 'win32', // own process group, so we can signal the whole tree
    stdio: ['ignore', 'pipe', 'pipe'],
    // Steps run inside Electron's main process, where `process.execPath` is
    // electron.exe, not node. Without this the child boots as an Electron app.
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  });

  server.child = child;
  server.tail = [];
  bindCleanup();

  const consume = (chunk) => {
    for (const line of String(chunk).split(/\r?\n/)) {
      const text = line.trim();
      if (!text) continue;

      server.tail.push(text);
      if (server.tail.length > TAIL_LINES) server.tail.shift();

      // Command output is escaped by the runner, so this is safe to forward.
      if (INTERESTING.test(text)) ctx.log('info', text.slice(0, 200));
    }
  };

  child.stdout.on('data', consume);
  child.stderr.on('data', consume);

  return child;
}

/** @type {import('@app-galaxy/setup-api').StepDefinition} */
module.exports = {
  group: 'health',
  title: 'Check API health',
  description:
    'Start <code>nx serve api</code> if it is not already up, then ask <code>/api/health/alive</code> and <code>/api/health/ready</code> whether it booted and can reach its database.',

  async check(ctx) {
    const base = await baseUrl(ctx);

    const alive = await getJson(`${base}/${ALIVE}`);
    if (!alive.ok) {
      return {
        ok: false,
        note: alive.error
          ? `API is not answering (${alive.error})`
          : `alive returned ${alive.status}`,
      };
    }

    const db = await getJson(`${base}/${READY}`);
    if (!db.ok)
      return {
        ok: false,
        note: `API is up but the database check failed (${db.status || db.error})`,
      };

    return { ok: true, note: 'alive and connected to the database' };
  },

  async heal(ctx) {
    const base = await baseUrl(ctx);

    // Something may already own the port — never start a second one.
    const deadline = Date.now() + ALREADY_UP_MS;
    while (Date.now() < deadline) {
      if ((await getJson(`${base}/${ALIVE}`)).ok) {
        ctx.log('heal', 'the API was already running');
        return;
      }
      await sleep(POLL_MS);
    }

    if (server.child && server.child.exitCode === null)
      throw new Error('the API was started but never answered');

    ctx.log(
      'heal',
      `starting \`nx ${SERVE_ARGS.join(' ')}\` — it will stop when the wizard closes`,
    );
    const child = startServer(ctx);

    let spawnError = null;
    child.once('error', (error) => (spawnError = error));

    const bootDeadline = Date.now() + BOOT_TIMEOUT_MS;
    while (Date.now() < bootDeadline) {
      if (spawnError)
        throw new Error(`could not start the API: ${spawnError.message}`);

      // A crashed build never answers; surface its own words rather than a timeout.
      if (child.exitCode !== null) {
        const reason = server.tail.slice(-8).join(' / ') || 'no output';
        throw new Error(
          `\`nx serve api\` exited with code ${child.exitCode}: ${reason}`,
        );
      }

      if ((await getJson(`${base}/${ALIVE}`)).ok) {
        ctx.log('heal', 'the API answered');
        return;
      }
      await sleep(POLL_MS);
    }

    stopServer();
    throw new Error(`the API did not answer within ${BOOT_TIMEOUT_MS / 1000}s`);
  },

  async escalate(ctx) {
    const base = await baseUrl(ctx);
    const full = await getJson(`${base}/${READY}`);
    const reachable = Boolean(full.status);

    const choices = [
      { id: 'retry', label: 'Check again', kind: 'primary' },
      { id: 'skip', label: 'Skip for now', kind: 'soft' },
    ];

    if (reachable) {
      choices.splice(1, 0, {
        id: 'report',
        label: 'Show the health report…',
        kind: 'line',
        view: 'report',
        viewData: { url: `${base}/${READY}`, status: full.status, body: full.body },
      });
    }

    const tail = server.tail.slice(-6).join('\n');

    return {
      title: reachable ? 'The API is unhealthy' : 'The API did not start',
      message: reachable
        ? `<code>${base}/${READY}</code> answered <code>${full.status}</code>. Open the report to see which indicator is down.`
        : 'The wizard tried to start it with <code>nx serve api</code> and it never answered. ' +
          (tail
            ? 'Its last output is in the log above. '
            : 'Run it in another terminal to see why, then check again. ') +
          'A database it cannot reach is the usual cause — see the previous step.',
      docsUrl: 'https://docs.nestjs.com/recipes/terminus',
      choices,
    };
  },

  async onChoice(choiceId, payload, ctx) {
    if (choiceId === 'skip') {
      stopServer();
      ctx.log(
        'warn',
        'Skipped the health check. Nothing was verified against a running API.',
      );
      return { skip: true };
    }
    // 'retry' and 'report' both return nothing, so the runner re-runs check().
  },
};
