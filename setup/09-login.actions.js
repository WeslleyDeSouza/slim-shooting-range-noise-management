const { existsSync } = require('node:fs');
const { dirname, join } = require('node:path');
const { spawn } = require('node:child_process');
const { LOGIN_PATH, SESSION_KEY, appPort, credentials, loadChromium } = require('./_browser');

// From apps/app/src/app/views/auth/login/login.page.html — the same selectors
// the e2e suite uses (apps/app-e2e/src/support/selectors.ts).
const EMAIL = '#auth-email';
const PASSWORD = '#auth-password';
const SUBMIT = '.auth-submit';
// The tenant chooser: with one seeded tenant it continues on its own, but a
// slow API can leave it on screen — clicking the entry is harmless either way.
const TENANT = '.auth-tenant';
const ERROR = '.auth-form-err, [role="alert"]';

const NAV_TIMEOUT_MS = 30_000;
const FORM_TIMEOUT_MS = 20_000;
const LOGIN_TIMEOUT_MS = 20_000;
const SETTLE_TIMEOUT_MS = 15_000;
const INSTALL_TIMEOUT_MS = 300_000;
const HEARTBEAT_MS = 5_000;

const BROWSER_MISSING = /Executable doesn't exist|please run.*playwright install/i;

/**
 * Path to Playwright's own CLI, so `install chromium` runs on this Node binary.
 *
 * `require.resolve('@playwright/test/cli.js')` throws: the package's `exports`
 * map does not expose that subpath. `./package.json` is exported, so resolve
 * that and walk to the sibling.
 */
function playwrightCli() {
  for (const pkg of ['@playwright/test', 'playwright-core']) {
    try {
      const cli = join(dirname(require.resolve(`${pkg}/package.json`)), 'cli.js');
      if (existsSync(cli)) return cli;
    } catch {
      // try the next one
    }
  }
  return null;
}

/** Seconds since `since`, for progress lines. */
function elapsed(since) {
  return Math.round((Date.now() - since) / 1000);
}

/** The percentage in a progress line, or null if the line is not one. */
function percentOf(line) {
  const match = /(\d{1,3})%/.exec(line);
  return match ? Number(match[1]) : null;
}

/**
 * Download and unpack the Chromium build Playwright pins.
 *
 * The installer is *silent* between finishing the download and finishing the
 * unpack, and the download bar is the last thing it prints — so the wizard sits
 * on "100%" for the whole extraction with no output and looks hung. It is not:
 * unpacking a few hundred MB simply takes a while. Hence the heartbeat, which
 * keeps reporting for as long as the child is quiet.
 *
 * Progress bars redraw with `\r` many times a second, so they are logged once
 * per 25% rather than once per frame.
 */
async function installChromium(ctx) {
  const cli = playwrightCli();
  if (!cli) {
    ctx.log('warn', 'could not find Playwright’s CLI — run `npx playwright install chromium` yourself');
    return;
  }

  ctx.log('info', 'installing Chromium for Playwright — a few hundred MB, this takes a minute or two');
  ctx.log('info', `running: ${cli} install chromium`);

  const started = Date.now();
  let lastOutputAt = Date.now();
  let lastLine = '';
  let lastBucket = -1;
  let timedOut = false;

  const code = await new Promise((resolve) => {
    // Playwright's own CLI, on this Node binary — no shell, no npx.
    const child = spawn(process.execPath, [cli, 'install', 'chromium'], {
      cwd: ctx.projectDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    const heartbeat = setInterval(() => {
      if (Date.now() - lastOutputAt < HEARTBEAT_MS) return; // it is still talking
      const tail = lastLine ? ` — last output: ${lastLine}` : '';
      ctx.log('info', `still working (${elapsed(started)}s)${tail}`);
    }, HEARTBEAT_MS);

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, INSTALL_TIMEOUT_MS);

    const consume = (chunk) => {
      lastOutputAt = Date.now();

      for (const raw of String(chunk).split(/[\r\n]+/)) {
        const line = raw.trim();
        if (!line) continue;
        lastLine = line.slice(0, 120);

        const percent = percentOf(line);
        if (percent === null) {
          ctx.log('info', line.slice(0, 160));
          continue;
        }

        const bucket = Math.floor(percent / 25);
        if (bucket <= lastBucket) continue;
        lastBucket = bucket;
        ctx.log('info', `downloading… ${percent}%`);
        if (percent >= 100) ctx.log('info', 'download done — unpacking the archive (this is the quiet part)');
      }
    };

    child.stdout.on('data', consume);
    child.stderr.on('data', consume);

    child.on('error', (error) => {
      clearInterval(heartbeat);
      clearTimeout(timer);
      ctx.log('warn', `could not start the installer: ${error.message}`);
      resolve(null);
    });

    child.on('exit', (exitCode) => {
      clearInterval(heartbeat);
      clearTimeout(timer);
      resolve(exitCode);
    });
  });

  if (timedOut) {
    ctx.log(
      'warn',
      `the installer was still running after ${INSTALL_TIMEOUT_MS / 1000}s and was stopped — run \`npx playwright install chromium\` yourself`,
    );
    return;
  }

  if (code === 0) {
    ctx.log('ok', `Chromium installed (${elapsed(started)}s)`);
    return;
  }

  ctx.log('warn', `the installer exited with code ${code} — last output: ${lastLine || '(none)'}`);
  ctx.log('warn', 'run `npx playwright install chromium` yourself to see the full error');
}

/**
 * Drives a real browser through the login form.
 *
 * Returns `{ ok, note, reason }`. `reason` is a machine-readable cause so
 * escalate() can offer the right way out; never throws for an ordinary failure.
 */
async function attemptLogin(ctx) {
  const chromium = loadChromium();
  if (!chromium) return { ok: false, reason: 'no-playwright', note: '@playwright/test is not installed' };

  const port = appPort(ctx);
  const { user, password } = await credentials(ctx);
  if (!user || !password) {
    return { ok: false, reason: 'no-credentials', note: 'APP_DEFAULT_USER / APP_DEFAULT_PASSWORD are not set in .env' };
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    if (BROWSER_MISSING.test(error.message)) {
      return { ok: false, reason: 'no-browser', note: 'the Chromium build Playwright expects is not installed' };
    }
    return { ok: false, reason: 'launch-failed', note: error.message.split('\n')[0] };
  }

  const consoleErrors = [];

  try {
    const page = await browser.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200));
    });

    const url = `http://localhost:${port}${LOGIN_PATH}`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    } catch {
      return { ok: false, reason: 'no-frontend', note: `could not open ${url}` };
    }

    // A stored session bounces straight to /admin; a guard may redirect too.
    try {
      await page.waitForSelector(EMAIL, { timeout: FORM_TIMEOUT_MS });
    } catch {
      return {
        ok: false,
        reason: 'no-form',
        note: `no login form at ${LOGIN_PATH} — the app is at ${new URL(page.url()).pathname}`,
        consoleErrors,
      };
    }

    await page.fill(EMAIL, user);
    await page.fill(PASSWORD, password);
    await page.click(SUBMIT);

    // Do NOT treat "the URL changed" as success: login bounces through the
    // tenant chooser on the way to /admin, so any URL check fires on the
    // redirect and passes even when no session was ever created. The session
    // key is the only honest signal.
    try {
      await page.waitForFunction((key) => Boolean(window.localStorage.getItem(key)), SESSION_KEY, {
        timeout: LOGIN_TIMEOUT_MS,
      });
    } catch {
      const shown = (await page.locator(ERROR).allTextContents())
        .map((text) => text.trim())
        .filter(Boolean)
        .join('; ');

      return {
        ok: false,
        reason: 'rejected',
        note: shown ? `login rejected: ${shown.slice(0, 160)}` : 'no session was created after submitting',
        consoleErrors,
      };
    }

    // Let the tenant step finish. With one tenant it continues on its own; if
    // the chooser is still showing, pick the seeded tenant.
    const left = await page
      .waitForURL((current) => !/\/auth\//.test(current.pathname), { timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    if (!left) {
      const tenant = page.locator(TENANT).first();
      if (await tenant.isVisible().catch(() => false)) await tenant.click().catch(() => undefined);
      await page
        .waitForURL((current) => !/\/auth\//.test(current.pathname), { timeout: SETTLE_TIMEOUT_MS })
        .catch(() => undefined);
    }
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    const landed = new URL(page.url()).pathname;
    ctx.log('ok', `logged in as ${user} — session created, landed on ${landed}`);
    return { ok: true, note: `${user} reached ${landed}` };
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/** @type {import('@app-galaxy/setup-api').StepDefinition} */
module.exports = {
  title: 'Check the login',
  description: `Drive a real Chromium through <code>${LOGIN_PATH}</code> with the demo user from <code>.env</code>.`,

  async check(ctx) {
    const result = await attemptLogin(ctx);
    // Stash the cause so escalate() can offer the right remedy.
    module.exports._last = result;

    for (const line of result.consoleErrors || []) ctx.log('warn', `console: ${line}`);

    return result.ok ? { ok: true, note: result.note } : { ok: false, note: result.note };
  },

  // Nothing here can be fixed silently: a missing browser is a 150MB download and
  // a rejected password is not ours to guess. Hand straight to escalate().
  async heal() {
    const reason = module.exports._last?.reason;
    throw new Error(reason ? `cannot auto-heal: ${reason}` : 'cannot auto-heal');
  },

  async escalate(ctx) {
    const last = module.exports._last || {};
    const { user } = await credentials(ctx);
    const port = appPort(ctx);

    const choices = [{ id: 'retry', label: 'Check again', kind: 'primary' }];

    if (last.reason === 'no-browser') {
      choices.unshift({ id: 'install-browser', label: 'Install Chromium for Playwright', kind: 'primary' });
      choices[1].kind = 'line';
    }

    choices.push({ id: 'skip', label: 'Skip for now', kind: 'soft' });

    const messages = {
      'no-playwright': 'Install it with <code>npm i -D @playwright/test</code>, then check again.',
      'no-browser':
        'Playwright ships a pinned Chromium build and the one it wants is missing. ' +
        'Installing downloads it (a few hundred MB) into your user profile — nothing in this repo changes.',
      'no-credentials': 'Set <code>APP_DEFAULT_USER</code> and <code>APP_DEFAULT_PASSWORD</code> in <code>.env</code>.',
      'no-frontend': `Nothing served <code>${LOGIN_PATH}</code> on port <code>${port}</code>. The previous step starts it.`,
      'no-form': 'The page loaded but the login form never appeared — a route guard may have redirected it.',
      rejected:
        `The form was submitted as <code>${user}</code> and the app stayed on the login page. ` +
        'Either the credentials are wrong or the API rejected them — the previous steps prove the API is up. ' +
        'The demo user is seeded by the API in non-production only (<code>APP_ENV</code> in <code>.env</code>).',
    };

    return {
      title: last.reason === 'rejected' ? 'The login was rejected' : 'The login could not be checked',
      message: messages[last.reason] || last.note || 'The login check did not complete.',
      docsUrl: 'https://playwright.dev/docs/browsers',
      choices,
    };
  },

  async onChoice(choiceId, payload, ctx) {
    if (choiceId === 'skip') {
      ctx.log('warn', 'Skipped the login check.');
      return { skip: true };
    }

    if (choiceId === 'install-browser') await installChromium(ctx);
    // Returning nothing re-runs check().
  },
};
