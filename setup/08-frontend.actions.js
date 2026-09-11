const http = require('node:http');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const PROJECT_JSON = 'apps/app/project.json';
const FALLBACK_PORT = 4200;
const SERVE_ARGS = ['serve', 'app'];

const ALREADY_UP_MS = 3_000;
// A cold Angular build is slow; be generous.
const BOOT_TIMEOUT_MS = 300_000;
const POLL_MS = 2_000;
const REQUEST_TIMEOUT_MS = 5_000;
const TAIL_LINES = 40;

const INTERESTING = /error|failed|exception|listening|watch mode|bundle|compiled|generated|already in use/i;
const PORT_IN_USE = /(already in use|EADDRINUSE)/i;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolves `{ ok, status?, body?, contentType?, error? }` — never rejects.
 *
 * `agent: false` because this polls a server that may be restarting: Node's
 * global agent keeps sockets alive, and a pooled socket to a dead process
 * reports ECONNRESET rather than the honest "not listening yet".
 */
function get(url) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: REQUEST_TIMEOUT_MS, agent: false }, (response) => {
      let raw = '';
      response.on('data', (chunk) => (raw += chunk));
      response.on('end', () =>
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 300,
          status: response.statusCode,
          contentType: response.headers['content-type'] || '',
          body: raw,
        })
      );
    });

    request.on('timeout', () => {
      request.destroy();
      resolve({ ok: false, error: 'timeout' });
    });
    request.on('error', (error) => resolve({ ok: false, error: error.code || error.message }));
  });
}

/** The port belongs to the workspace, not to this script. */
function appPort(ctx) {
  try {
    const targets = JSON.parse(readFileSync(join(ctx.projectDir, PROJECT_JSON), 'utf8')).targets || {};
    const port = targets['serve']?.options?.port ?? targets['serve-static']?.options?.port;
    if (Number.isInteger(port) && port > 0) return port;
  } catch {
    // fall through
  }
  return FALLBACK_PORT;
}

/** An open port proves nothing — some other process could own it. The shell does. */
function isAppShell(body) {
  return body.includes('<app-root');
}

/**
 * PIDs listening on `port`. A port can have two owners — one per address family —
 * and `nx serve` dies if either is taken.
 *
 * Never match on netstat's state column: it is localised ("ABHÖREN" on a German
 * Windows), so `=== 'LISTENING'` silently finds nothing. A listening socket is
 * identified by its wildcard foreign address instead.
 */
function portOwners(port) {
  const pids = new Set();

  try {
    if (process.platform === 'win32') {
      const result = spawnSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' });
      for (const line of (result.stdout || '').split(/\r?\n/)) {
        const parts = line.trim().split(/\s+/);
        // Proto  Local           Foreign        State(localised)  PID
        if (parts.length < 5 || parts[0] !== 'TCP') continue;
        if (!parts[1].endsWith(`:${port}`)) continue;
        if (parts[2] !== '0.0.0.0:0' && parts[2] !== '[::]:0') continue;

        const pid = parts[parts.length - 1];
        if (/^\d+$/.test(pid) && Number(pid) > 0) pids.add(Number(pid));
      }
    } else {
      const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
      for (const pid of (result.stdout || '').trim().split(/\s+/)) {
        if (/^\d+$/.test(pid)) pids.add(Number(pid));
      }
    }
  } catch {
    // no netstat/lsof — just do not offer the button
  }

  return [...pids];
}

function killTree(pid) {
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(pid), '/T', '/F']);
    else process.kill(pid, 'SIGTERM');
    return true;
  } catch {
    return false;
  }
}

/** The wizard owns anything it starts. See 07-health for why the whole tree is killed. */
const server = { child: null, tail: [], cleanupBound: false };

function stopServer() {
  const child = server.child;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  killTree(child.pid);
}

function bindCleanup() {
  if (server.cleanupBound) return;
  server.cleanupBound = true;
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

      if (INTERESTING.test(text)) ctx.log('info', text.slice(0, 200));
    }
  };

  child.stdout.on('data', consume);
  child.stderr.on('data', consume);

  return child;
}

/** Probe once; `{ up: true }` only when the Angular shell answers. */
async function probe(port) {
  const root = await get(`http://localhost:${port}/`);
  return { up: root.ok && isAppShell(root.body), root };
}

/** Spawn the dev server and wait for the shell. Throws with the server's own words. */
async function startAndWait(ctx, port) {
  ctx.log('heal', `starting \`nx ${SERVE_ARGS.join(' ')}\` — it will stop when the wizard closes`);
  const child = startServer(ctx);

  let spawnError = null;
  child.once('error', (error) => (spawnError = error));

  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (spawnError) throw new Error(`could not start the dev server: ${spawnError.message}`);

    if (child.exitCode !== null) {
      const reason = server.tail.slice(-8).join(' / ') || 'no output';
      throw new Error(`\`nx serve app\` exited with code ${child.exitCode}: ${reason}`);
    }

    if ((await probe(port)).up) {
      ctx.log('heal', 'the dev server answered');
      return;
    }
    await sleep(POLL_MS);
  }

  stopServer();
  throw new Error(`the dev server did not answer within ${BOOT_TIMEOUT_MS / 1000}s`);
}

/** @type {import('@app-galaxy/setup-api').StepDefinition} */
module.exports = {
  // Same group as the API health check — independent, so the runner fires them
  // in parallel (needs @app-galaxy/setup-api with group/parallel support).
  group: 'health',
  title: 'Check the frontend',
  description:
    'Start <code>nx serve app</code> if needed, ask for the app shell, and prove its <code>/api</code> proxy reaches the API.',

  async check(ctx) {
    const port = appPort(ctx);
    const { up, root } = await probe(port);

    if (!root.ok) {
      return { ok: false, note: root.error ? `nothing on port ${port} (${root.error})` : `/ returned ${root.status}` };
    }
    if (!up) return { ok: false, note: `something answers on ${port}, but it is not the Angular app` };

    // proxy.conf.json maps /api to the API. The dev server serves the SPA shell
    // for unknown paths, so a 200 alone proves nothing — demand JSON back.
    const proxied = await get(`http://localhost:${port}/api/health/alive`);
    if (proxied.ok && /application\/json/i.test(proxied.contentType)) {
      ctx.log('ok', 'the /api proxy reaches the API');
    } else if (proxied.ok) {
      ctx.log('warn', 'the /api proxy returned the app shell, not the API — check proxy.conf.json');
    } else {
      ctx.log('warn', `the /api proxy did not reach the API (${proxied.status || proxied.error})`);
    }

    return { ok: true, note: `serving the app shell on ${port}` };
  },

  async heal(ctx) {
    const port = appPort(ctx);

    // Something may already own the port — never start a second one.
    const deadline = Date.now() + ALREADY_UP_MS;
    while (Date.now() < deadline) {
      if ((await probe(port)).up) {
        ctx.log('heal', 'the dev server was already running');
        return;
      }
      await sleep(POLL_MS);
    }

    // A foreign process on the port makes `nx serve` die instantly with
    // "Port 4200 is already in use". Stopping it is the user's call, not ours.
    const owners = portOwners(port);
    if (owners.length) throw new Error(`port ${port} is held by PID ${owners.join(', ')}`);

    await startAndWait(ctx, port);
  },

  async escalate(ctx) {
    const port = appPort(ctx);
    const tail = server.tail.slice(-8).join('\n');
    const blocked = PORT_IN_USE.test(tail);
    const owners = portOwners(port);
    const label = owners.length > 1 ? `PIDs ${owners.join(', ')}` : `PID ${owners[0]}`;

    const choices = [{ id: 'retry', label: 'Check again', kind: 'primary' }];

    if (owners.length) {
      choices.push({
        id: 'free-port',
        label: `Stop the process on ${port} (${label})`,
        kind: 'line',
      });
    }

    choices.push({ id: 'skip', label: 'Skip for now', kind: 'soft' });

    const why = owners.length
      ? `Port <code>${port}</code> is held by <strong>${label}</strong>, which is not serving the Angular app. ` +
        (blocked ? 'That is why <code>nx serve app</code> exited immediately. ' : '') +
        'Stopping it kills that process and every child it owns — make sure it is not something you need.'
      : `Nothing is serving the app shell on <code>${port}</code>. ` +
        (tail
          ? 'The wizard tried <code>nx serve app</code>; its last output is in the log above. '
          : 'Start it with <code>npx nx serve app</code> in another terminal, then check again. ') +
        'The first build takes a while.';

    return {
      title: owners.length ? `Port ${port} is already in use` : 'The frontend is not running',
      message: why,
      docsUrl: 'https://nx.dev/nx-api/angular',
      choices,
    };
  },

  async onChoice(choiceId, payload, ctx) {
    if (choiceId === 'skip') {
      stopServer();
      ctx.log('warn', 'Skipped the frontend check.');
      return { skip: true };
    }

    if (choiceId === 'free-port') {
      const port = appPort(ctx);
      const owners = portOwners(port);

      if (!owners.length) {
        ctx.log('info', `port ${port} is already free`);
      }
      for (const owner of owners) {
        if (killTree(owner)) ctx.log('heal', `stopped PID ${owner}`);
        else {
          ctx.log('warn', `could not stop PID ${owner} — you may need elevated rights`);
          return;
        }
      }
      if (owners.length) await sleep(POLL_MS); // let the socket actually close

      // The runner goes straight to check() after onChoice; it does not heal
      // again. Freeing the port accomplishes nothing unless we then start it.
      await startAndWait(ctx, port);
    }
    // 'retry' returns nothing, so the runner re-runs check().
  },
};
