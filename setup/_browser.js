/**
 * Shared browser helpers for the steps that drive the running app
 * (09-login, 10-permissions, 11-seed-data). Not a step: the runner only picks
 * up `NN-name.actions.js | .commands.js | .seeds.js`, so a leading underscore
 * and no suffix keep this file out of the timeline.
 */
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const PROJECT_JSON = 'apps/app/project.json';
const FALLBACK_PORT = 4200;

const LOGIN_PATH = '/auth/login';
// From apps/app/src/app/views/auth/login/login.page.html — the same selectors
// the e2e suite uses (apps/app-e2e/src/support/selectors.ts).
const LOGIN = {
  email: '#auth-email',
  password: '#auth-password',
  submit: '.auth-submit',
  tenant: '.auth-tenant',
};
// @app-galaxy/auth-ui writes this to localStorage once the API accepted the login.
const SESSION_KEY = 'app.session';

const NAV_TIMEOUT_MS = 30_000;
const LOGIN_TIMEOUT_MS = 20_000;
const SETTLE_TIMEOUT_MS = 15_000;

function clean(value) {
  return String(value ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
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

/** The demo user as tenant.mock.json declares it (the seed names it, the login uses it). */
function datasetUser(ctx) {
  try {
    const json = JSON.parse(readFileSync(join(ctx.projectDir, 'apps/api/src/mocks/tenant/tenant.mock.json'), 'utf8'));
    const user = json['SLIM Demo']?.users?.[0];
    return user ? { user: user.username, password: user.password } : null;
  } catch {
    return null;
  }
}

/** .env wins (the API seeds APP_DEFAULT_USER); the dataset is the fallback. */
async function credentials(ctx) {
  const env = await ctx.readEnv();
  const fallback = datasetUser(ctx) || { user: '', password: '' };
  return {
    user: clean(env['APP_DEFAULT_USER']) || fallback.user,
    password: clean(env['APP_DEFAULT_PASSWORD']) || fallback.password,
  };
}

function loadChromium() {
  try {
    return require('@playwright/test').chromium;
  } catch {
    return null;
  }
}

/**
 * Sign in as the demo user and let login -> tenant -> /admin settle.
 * Throws with a machine-readable `reason` attached.
 */
async function signIn(page, base, ctx) {
  const { user, password } = await credentials(ctx);
  if (!user || !password) {
    throw Object.assign(new Error('APP_DEFAULT_USER / APP_DEFAULT_PASSWORD are not set'), {
      reason: 'no-credentials',
    });
  }

  await page.goto(`${base}${LOGIN_PATH}`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
  await page.waitForSelector(LOGIN.email, { timeout: NAV_TIMEOUT_MS });
  await page.fill(LOGIN.email, user);
  await page.fill(LOGIN.password, password);
  await page.click(LOGIN.submit);

  try {
    await page.waitForFunction((key) => Boolean(window.localStorage.getItem(key)), SESSION_KEY, {
      timeout: LOGIN_TIMEOUT_MS,
    });
  } catch {
    throw Object.assign(new Error(`could not log in as ${user}`), { reason: 'login-failed' });
  }

  // With one tenant the chooser continues on its own; if it is still showing,
  // pick the seeded tenant. Navigating away during that redirect aborts it.
  const left = await page
    .waitForURL((current) => !/\/auth\//.test(current.pathname), { timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  if (!left) {
    const tenant = page.locator(LOGIN.tenant).first();
    if (await tenant.isVisible().catch(() => false)) await tenant.click().catch(() => undefined);
    await page
      .waitForURL((current) => !/\/auth\//.test(current.pathname), { timeout: SETTLE_TIMEOUT_MS })
      .catch(() => undefined);
  }
  await page.waitForLoadState('networkidle', { timeout: SETTLE_TIMEOUT_MS }).catch(() => undefined);

  return user;
}

/**
 * Open an admin screen and wait until it has settled into one of the states
 * the caller cares about. Resolves the first matching key of `states`
 * (selector map), or 'timeout'.
 */
async function openAndSettle(page, base, route, host, states, timeoutMs) {
  await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
  try {
    await page.waitForSelector(host, { timeout: timeoutMs });
  } catch {
    throw Object.assign(new Error(`${route} never rendered`), { reason: 'no-admin-ui' });
  }

  // Rows arrive a moment after the request settles, so wait for a decisive
  // state rather than counting straight away.
  const selectors = Object.values(states);
  const hit = await page
    .waitForFunction(
      (list) => list.some((css) => document.querySelector(css)),
      selectors,
      { timeout: timeoutMs },
    )
    .then(() => true)
    .catch(() => false);
  if (!hit) {
    // SETUP_DEBUG=1 prints where the page ended up, for tuning the selectors.
    if (process.env.SETUP_DEBUG) {
      const text = await page.evaluate(() => document.body.innerText.slice(0, 600)).catch(() => '');
      console.log('[setup:_browser] timeout at', page.url(), text);
    }
    return 'timeout';
  }

  for (const [key, css] of Object.entries(states)) {
    if ((await page.locator(css).count()) > 0) return key;
  }
  return 'timeout';
}

module.exports = {
  LOGIN_PATH,
  SESSION_KEY,
  NAV_TIMEOUT_MS,
  SETTLE_TIMEOUT_MS,
  clean,
  appPort,
  credentials,
  datasetUser,
  loadChromium,
  signIn,
  openAndSettle,
};
