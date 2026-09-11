const { appPort, loadChromium, signIn, openAndSettle, SETTLE_TIMEOUT_MS } = require('./_browser');

/**
 * SLIM has no roles UI of its own: users, roles and the app catalogue come from
 * the galaxy tables, and `apps/api/src/mocks/main.mock-data.ts` seeds them on
 * every non-production boot (tenant, demo user, `API_APPS_MAPPING` apps, the
 * admin role with every SLIM app, and the role/user link).
 *
 * So instead of editing a role, this step proves the seed landed: signed in as
 * the demo user, the admin shell must render (`adminGuard`) and the area
 * overview must get data back (`AppsRolesGuard(API_APPS_MAPPING.ADMIN_AREA)`).
 * A forbidden API call surfaces as the page's error alert.
 */
const ADMIN_PATH = '/admin';
const AREA_PATH = '/admin/area';

// apps/app/src/app/views/admin/_layout + area/area-overview.component.ts
const ADMIN_SHELL = 'app-admin-layout';
const AREA_HOST = 'app-area-overview';
const AREA_STATES = {
  rows: '.slim-table tbody tr.slim-table__row',
  empty: '.slim-empty',
  error: '.slim-alert--danger',
};

const RENDER_TIMEOUT_MS = 45_000;

/** @type {import('@app-galaxy/setup-api').StepDefinition} */
module.exports = {
  title: 'Check the demo user permissions',
  description:
    'Sign in as the demo user and make sure the seeded admin role lets it through the ' +
    '<code>/admin</code> guard and the area API (<code>API_APPS_MAPPING.ADMIN_AREA</code>).',

  async check(ctx) {
    const chromium = loadChromium();
    if (!chromium) {
      module.exports._last = { reason: 'no-playwright' };
      return { ok: false, note: '@playwright/test is not installed' };
    }

    const base = `http://localhost:${appPort(ctx)}`;
    const browser = await chromium.launch({ headless: true }).catch((error) => error);
    if (browser instanceof Error) {
      module.exports._last = { reason: 'no-browser' };
      return { ok: false, note: 'Chromium is not installed — the login step can install it' };
    }

    try {
      const page = await browser.newPage();
      const user = await signIn(page, base, ctx);

      // 1) adminGuard: a session without the admin apps is bounced back to /auth.
      await page.goto(`${base}${ADMIN_PATH}`, { waitUntil: 'domcontentloaded' });
      const shell = await page
        .waitForSelector(ADMIN_SHELL, { timeout: RENDER_TIMEOUT_MS })
        .then(() => true)
        .catch(() => false);
      if (!shell || /\/auth\//.test(new URL(page.url()).pathname)) {
        module.exports._last = { reason: 'guard-rejected', user };
        return { ok: false, note: `${user} is signed in but ${ADMIN_PATH} redirected to ${new URL(page.url()).pathname}` };
      }

      // 2) AppsRolesGuard on the API: the overview either lists areas, says the
      //    list is empty, or shows the error the API answered with.
      const state = await openAndSettle(page, base, AREA_PATH, AREA_HOST, AREA_STATES, RENDER_TIMEOUT_MS);
      if (state === 'error') {
        const shown = (await page.locator(AREA_STATES.error).allTextContents()).map((t) => t.trim()).join('; ');
        module.exports._last = { reason: 'api-forbidden', user, shown };
        return { ok: false, note: `the area API rejected ${user}: ${shown.slice(0, 160) || 'error shown'}` };
      }
      if (state === 'timeout') {
        module.exports._last = { reason: 'no-admin-ui', user };
        return { ok: false, note: `${AREA_PATH} rendered but never settled — is the API answering?` };
      }

      const rows = await page.locator(AREA_STATES.rows).count();
      module.exports._last = { reason: null, user, rows };
      return { ok: true, note: `${user} passes the admin guard and the area API (${rows} areas visible)` };
    } catch (error) {
      module.exports._last = { reason: error.reason || 'failed' };
      return { ok: false, note: error.message.split('\n')[0] };
    } finally {
      await browser.close().catch(() => undefined);
    }
  },

  // The role is written by the API's own seed, not by us. A missing role means
  // the seed did not run (production env) or the database predates the apps —
  // both are the developer's decision to fix. Hand straight to escalate().
  async heal() {
    const reason = module.exports._last?.reason;
    throw new Error(reason ? `cannot auto-heal: ${reason}` : 'cannot auto-heal');
  },

  async escalate(ctx) {
    const last = module.exports._last || {};
    const port = appPort(ctx);

    const seedHint =
      'The admin role and its apps are seeded by <code>API_MOCK_DATA.initMockData</code> a couple of seconds after the API boots, ' +
      'in every environment except <code>APP_ENV=production</code>. Check <code>.env</code>, restart the API, wait a few seconds and check again. ' +
      'A database seeded by an older build may lack the newer apps — with SQLite, delete the <code>.sqlite</code> file and restart to reseed.';

    const messages = {
      'no-playwright': 'Install it with <code>npm i -D @playwright/test</code>, then check again.',
      'no-browser': 'Chromium is missing. The login step offers to install it.',
      'no-credentials': 'Set <code>APP_DEFAULT_USER</code> and <code>APP_DEFAULT_PASSWORD</code> in <code>.env</code>.',
      'login-failed': 'The demo user could not log in — the login step covers that.',
      'guard-rejected': `<code>${ADMIN_PATH}</code> sent the signed-in user back to the auth pages, so the session carries none of the SLIM apps. ${seedHint}`,
      'api-forbidden': `The area overview rendered but the API refused the request${last.shown ? ` (<em>${last.shown.slice(0, 120)}</em>)` : ''}. ${seedHint}`,
      'no-admin-ui': `The admin screens never settled on port <code>${port}</code>. Is the frontend still running and its <code>/api</code> proxy reaching the API?`,
    };

    return {
      title: last.reason === 'guard-rejected' || last.reason === 'api-forbidden' ? 'The demo user lacks the SLIM apps' : 'The permissions could not be checked',
      message: messages[last.reason] || 'The permission check did not complete.',
      docsUrl: 'https://playwright.dev/docs/selectors',
      choices: [
        { id: 'retry', label: 'Check again', kind: 'primary' },
        { id: 'skip', label: 'Skip for now', kind: 'soft' },
      ],
    };
  },

  async onChoice(choiceId, payload, ctx) {
    if (choiceId === 'skip') {
      ctx.log('warn', 'Skipped the permission check.');
      return { skip: true };
    }
    // 'retry' returns nothing, so the runner re-runs check().
  },
};
