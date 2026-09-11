const { appPort, loadChromium, signIn, openAndSettle } = require('./_browser');

/**
 * Demo data lives in the API, not in the frontend: `AREA_MOCK_DATA.fill`
 * (apps/api/src/modules/area/area.mock-data.ts) writes the demo areas
 * (Schiessplätze) for the seeded tenant on every non-production boot, and only
 * when the tenant has none yet. The generated client (`@ui-slim/apiClient`)
 * then serves them to the app — so the wizard checks what the app shows, and
 * expects exactly what the e2e suite expects.
 */
const AREA_PATH = '/admin/area';
const HOME_PATH = '/admin';

// apps/app/src/app/views/admin/{area/area-overview,home/home}.component.ts
const AREA_HOST = 'app-area-overview';
const AREA_STATES = {
  rows: '.slim-table tbody tr.slim-table__row',
  empty: '.slim-empty',
  error: '.slim-alert--danger',
};
const HOME_HOST = 'app-home';
const HOME_STATES = {
  kpi: '.slim-tile__kpi',
  error: '.slim-alert--danger',
};

/** apps/api/src/modules/area/area.mock-data.ts seeds this many demo areas. */
const SEEDED_AREAS = 8;

const RENDER_TIMEOUT_MS = 45_000;

/** @type {import('@app-galaxy/setup-api').StepDefinition} */
module.exports = {
  // No parallel group: this drives the running app/DB with its own browser, and
  // the e2e step (12) does the same on the same database — they must run in order.
  title: 'Check the demo data',
  description:
    'Walk the admin screens and make sure the API seeded its demo areas (Schiessplätze) ' +
    'and the home tiles show their KPIs.',

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
      await signIn(page, base, ctx);

      const areaState = await openAndSettle(page, base, AREA_PATH, AREA_HOST, AREA_STATES, RENDER_TIMEOUT_MS);
      if (areaState === 'error' || areaState === 'timeout') {
        module.exports._last = { reason: areaState === 'error' ? 'api-error' : 'no-admin-ui' };
        return {
          ok: false,
          note: areaState === 'error' ? 'the area overview shows an API error' : `${AREA_PATH} never settled`,
        };
      }
      const areas = await page.locator(AREA_STATES.rows).count();

      const homeState = await openAndSettle(page, base, HOME_PATH, HOME_HOST, HOME_STATES, RENDER_TIMEOUT_MS);
      const kpis = homeState === 'kpi' ? await page.locator(HOME_STATES.kpi).count() : 0;

      const summary = `${areas} areas, ${kpis} home KPIs`;
      if (areas < 1) {
        module.exports._last = { reason: 'missing-data', areas, kpis };
        return { ok: false, note: `no areas — ${summary}` };
      }
      if (areas < SEEDED_AREAS) {
        // Not a failure: someone may have deleted demo rows on purpose. But the
        // e2e suite asserts on the seeded count, so say so.
        ctx.log('warn', `only ${areas} of the ${SEEDED_AREAS} seeded demo areas are left — the e2e step expects ${SEEDED_AREAS}`);
      }

      module.exports._last = { reason: null, areas, kpis };
      return { ok: true, note: summary };
    } catch (error) {
      module.exports._last = { reason: error.reason || 'failed' };
      return { ok: false, note: error.message.split('\n')[0] };
    } finally {
      await browser.close().catch(() => undefined);
    }
  },

  // The seed is the API's job and runs on boot; the wizard has no create form
  // to drive (the area overview is read-only in the prototype) and the API's
  // replay guard keeps it from posting raw requests. Hand to escalate().
  async heal() {
    const reason = module.exports._last?.reason;
    throw new Error(reason ? `cannot auto-heal: ${reason}` : 'cannot auto-heal');
  },

  async escalate(ctx) {
    const last = module.exports._last || {};
    const port = appPort(ctx);

    const messages = {
      'no-playwright': 'Install it with <code>npm i -D @playwright/test</code>, then check again.',
      'no-browser': 'Chromium is missing. The login step offers to install it.',
      'no-credentials': 'Set <code>APP_DEFAULT_USER</code> and <code>APP_DEFAULT_PASSWORD</code> in <code>.env</code>.',
      'login-failed': 'The demo user could not log in — the login step covers that.',
      'no-admin-ui': `The admin screens never settled on port <code>${port}</code>. Is the frontend still running?`,
      'api-error': 'The area overview shows an API error — the permission step covers the guards, the health step the database.',
      'missing-data':
        'The tenant has no areas. <code>AREA_MOCK_DATA.fill</code> runs a couple of seconds after the API boots, ' +
        'in every environment except <code>APP_ENV=production</code>, and only when the tenant has no areas yet. ' +
        'Check <code>.env</code>, restart the API, wait a few seconds and check again. ' +
        'With SQLite, deleting the <code>.sqlite</code> file and restarting reseeds everything.',
    };

    return {
      title: last.reason === 'missing-data' ? 'Demo data is missing' : 'The demo data could not be checked',
      message: messages[last.reason] || 'The demo-data check did not complete.',
      choices: [
        { id: 'retry', label: 'Check again', kind: 'primary' },
        { id: 'skip', label: 'Skip for now', kind: 'soft' },
      ],
    };
  },

  async onChoice(choiceId, payload, ctx) {
    if (choiceId === 'skip') {
      ctx.log('warn', 'Skipped the demo-data check.');
      return { skip: true };
    }
    // 'retry' returns nothing, so the runner re-runs check().
  },
};
