const { existsSync, mkdirSync, readFileSync, rmSync } = require('node:fs');
const { dirname, join } = require('node:path');
const { spawn } = require('node:child_process');

const CONFIG = 'apps/app-e2e/playwright.config.ts';

/**
 * The JSON reporter writes here instead of to stdout.
 *
 * `--reporter=json` prints the report to stdout, but the config pipes the API's
 * and the app's own stdout through the same stream (`webServer[].stdout`), so
 * the report comes back with a NestJS boot log wrapped around it and no longer
 * parses. `PLAYWRIGHT_JSON_OUTPUT_NAME` sends it to a file, away from the noise.
 */
const REPORT = 'dist/.playwright/setup-e2e-report.json';

const RUN_TIMEOUT_MS = 900_000; // the suite boots an API and an app, then drives a browser
const HEARTBEAT_MS = 10_000;

function elapsed(since) {
  return Math.round((Date.now() - since) / 1000);
}

/**
 * Path to Playwright's own CLI, so the suite runs on this Node binary.
 *
 * `require.resolve('@playwright/test/cli.js')` throws — the package's `exports`
 * map does not expose that subpath. `./package.json` is exported, so resolve that
 * and walk to the sibling. (Same trick as the login step.)
 */
function playwrightCli() {
  for (const pkg of ['@playwright/test', 'playwright-core']) {
    try {
      const cli = join(
        dirname(require.resolve(`${pkg}/package.json`)),
        'cli.js',
      );
      if (existsSync(cli)) return cli;
    } catch {
      // try the next one
    }
  }
  return null;
}

/** Every spec that did not pass, with the first line of its error. */
function failuresOf(report) {
  const failures = [];

  const walk = (suite) => {
    for (const spec of suite.specs || []) {
      if (spec.ok) continue;
      const error = (spec.tests || [])
        .flatMap((test) => test.results || [])
        .map((result) => result.error?.message || '')
        .find(Boolean);

      failures.push({
        title: [suite.title, spec.title].filter(Boolean).join(' › '),
        error: String(error || '')
          .replace(/\[\d+m/g, '') // the message carries the reporter's colour codes
          .split('\n')[0]
          .slice(0, 160),
      });
    }
    for (const child of suite.suites || []) walk(child);
  };

  for (const suite of report.suites || []) walk(suite);
  return failures;
}

/**
 * Run the suite and read its report back.
 *
 * Never throws for an ordinary failure: returns `{ ok, reason, ... }` so
 * escalate() can offer the right way out.
 */
async function runSuite(ctx) {
  const cli = playwrightCli();
  if (!cli)
    return {
      ok: false,
      reason: 'no-playwright',
      note: '@playwright/test is not installed',
    };

  const config = join(ctx.projectDir, CONFIG);
  if (!existsSync(config))
    return { ok: false, reason: 'no-config', note: `${CONFIG} does not exist` };

  const reportPath = join(ctx.projectDir, REPORT);
  mkdirSync(dirname(reportPath), { recursive: true });
  rmSync(reportPath, { force: true }); // never read a report from a previous run

  ctx.log(
    'info',
    'running the e2e suite — it reuses the API on 3333 and the app on 4200 when they are up, otherwise it starts both (tools/serve-api-e2e.js boots an in-memory SQLite API)',
  );

  const started = Date.now();
  let lastOutputAt = Date.now();
  let lastLine = '';
  let timedOut = false;

  const code = await new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [cli, 'test', `--config=${CONFIG}`, '--reporter=json'],
      {
        cwd: ctx.projectDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath },
      },
    );

    // Compiling the app takes minutes with nothing to show for it. Say so, or the
    // wizard looks hung.
    const heartbeat = setInterval(() => {
      if (Date.now() - lastOutputAt < HEARTBEAT_MS) return;
      ctx.log(
        'info',
        `still running (${elapsed(started)}s)${lastLine ? ` — ${lastLine}` : ''}`,
      );
    }, HEARTBEAT_MS);

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, RUN_TIMEOUT_MS);

    const consume = (chunk) => {
      lastOutputAt = Date.now();
      for (const raw of String(chunk).split(/[\r\n]+/)) {
        const line = raw.trim();
        // The webServers pipe their own boot logs through here; only keep the
        // lines that say something about progress.
        if (!line || line.startsWith('{') || line.startsWith('"')) continue;
        lastLine = line.replace(/\[\d+m/g, '').slice(0, 120);
      }
    };

    child.stdout.on('data', consume);
    child.stderr.on('data', consume);

    child.on('error', (error) => {
      clearInterval(heartbeat);
      clearTimeout(timer);
      ctx.log('warn', `could not start Playwright: ${error.message}`);
      resolve(null);
    });

    child.on('exit', (exitCode) => {
      clearInterval(heartbeat);
      clearTimeout(timer);
      resolve(exitCode);
    });
  });

  if (timedOut) {
    return {
      ok: false,
      reason: 'timeout',
      note: `the suite was still running after ${RUN_TIMEOUT_MS / 60_000} minutes`,
    };
  }

  if (!existsSync(reportPath)) {
    // No report at all means it never got as far as running a test — a missing
    // browser, a config error, or a webServer that never came up.
    return {
      ok: false,
      reason: /Executable doesn't exist|playwright install/i.test(lastLine)
        ? 'no-browser'
        : 'no-report',
      note: lastLine || 'Playwright produced no report',
    };
  }

  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch (error) {
    return {
      ok: false,
      reason: 'no-report',
      note: `the report could not be read: ${error.message}`,
    };
  }

  const stats = report.stats || {};
  const passed = stats.expected || 0;
  const failed = stats.unexpected || 0;
  const flaky = stats.flaky || 0;
  const skipped = stats.skipped || 0;
  const summary = `${passed} passed, ${failed} failed, ${flaky} flaky, ${skipped} skipped (${elapsed(started)}s)`;

  if (failed === 0 && passed > 0)
    return {
      ok: true,
      reason: null,
      note: summary,
      passed,
      failed,
      flaky,
      skipped,
    };

  return {
    ok: false,
    reason: passed + failed === 0 ? 'no-tests' : 'failing',
    note: summary,
    passed,
    failed,
    flaky,
    skipped,
    failures: failuresOf(report),
    exitCode: code,
  };
}

/** @type {import('@app-galaxy/setup-api').StepDefinition} */
module.exports = {
  // No parallel group: the e2e suite drives the same app/DB the seed step (11)
  // does — running them at once would corrupt each other's data. Runs after 11.
  title: 'Run the e2e tests',
  description:
    `Run the Playwright suite (<code>${CONFIG}</code>) against the app: the auth pages, ` +
    'the signed-in home, the area overview and the styleguide.',

  async check(ctx) {
    const result = await runSuite(ctx);
    module.exports._last = result;

    for (const failure of result.failures || []) {
      ctx.log(
        'warn',
        `${failure.title}${failure.error ? ` — ${failure.error}` : ''}`,
      );
    }

    if (result.ok) ctx.log('ok', result.note);
    return { ok: result.ok, note: result.note };
  },

  // A failing test is a bug in the app or in the test — never something to paper
  // over by re-running it. Hand straight to escalate().
  async heal() {
    const reason = module.exports._last?.reason;
    throw new Error(
      reason ? `cannot auto-heal: ${reason}` : 'cannot auto-heal',
    );
  },

  async escalate() {
    const last = module.exports._last || {};

    const failures = (last.failures || [])
      .slice(0, 8)
      .map(
        (failure) =>
          `<li><code>${failure.title}</code>${failure.error ? `<br><small>${failure.error}</small>` : ''}</li>`,
      )
      .join('');

    const messages = {
      'no-playwright':
        'Install it with <code>npm i -D @playwright/test</code>, then check again.',
      'no-browser':
        'Chromium is missing — the login step offers to install it.',
      'no-config': `<code>${CONFIG}</code> is missing, so there is no suite to run.`,
      'no-report':
        'Playwright never produced a report, so no test ran. Usually the API or the app did not come up — ' +
        'the earlier steps cover both.',
      'no-tests': 'The run finished without executing a single test.',
      timeout:
        'The suite did not finish in time. Run it yourself to see where it hangs.',
      failing:
        `<p>${last.note}</p>` +
        (failures ? `<ul>${failures}</ul>` : '') +
        '<p>Open the full report with <code>npx playwright show-report</code>.</p>',
    };

    return {
      title:
        last.reason === 'failing'
          ? 'Some e2e tests failed'
          : 'The e2e suite could not run',
      message:
        messages[last.reason] || last.note || 'The e2e run did not complete.',
      docsUrl: 'https://playwright.dev/docs/running-tests',
      choices: [
        { id: 'retry', label: 'Run again', kind: 'primary' },
        { id: 'skip', label: 'Skip for now', kind: 'soft' },
      ],
    };
  },

  async onChoice(choiceId, payload, ctx) {
    if (choiceId === 'skip') {
      ctx.log('warn', 'Skipped the e2e run.');
      return { skip: true };
    }
    // 'retry' returns nothing, so the runner re-runs check().
  },
};
