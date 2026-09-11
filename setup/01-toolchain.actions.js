// NestJS 12 ships ESM-only; the API is loaded with Node's require(esm), which
// is stable from 22.12. Angular 22 accepts ^20.19 || ^22.12 || >= 24 — 22.12 is
// the lowest version both are happy with.
const MIN_NODE = { major: 22, minor: 12 };
const MIN_NPM_MAJOR = 10;

/** "v22.12.1" | "22.12.1" -> [22, 12, 1] */
function parseVersion(raw) {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(String(raw || ''));
  return match ? match.slice(1, 4).map(Number) : null;
}

/** @type {import('@app-galaxy/setup-api').StepDefinition} */
module.exports = {
  title: 'Check the toolchain',
  description:
    'Angular 22, NestJS 12 (ESM) and Nx 23 need Node <code>&gt;= 22.12</code> and npm <code>&gt;= 10</code>.',

  async check(ctx) {
    const node = await ctx.exec('node -v');
    if (node.code !== 0) return { ok: false, note: 'node is not on PATH' };

    const nodeVersion = parseVersion(node.stdout);
    if (!nodeVersion) return { ok: false, note: `cannot parse node version: ${node.stdout.trim()}` };

    const [major, minor] = nodeVersion;
    if (major < MIN_NODE.major || (major === MIN_NODE.major && minor < MIN_NODE.minor)) {
      return { ok: false, note: `node ${nodeVersion.join('.')} is older than ${MIN_NODE.major}.${MIN_NODE.minor}` };
    }

    const npm = await ctx.exec('npm -v');
    if (npm.code !== 0) return { ok: false, note: 'npm is not on PATH' };

    const npmVersion = parseVersion(npm.stdout);
    if (!npmVersion) return { ok: false, note: `cannot parse npm version: ${npm.stdout.trim()}` };
    if (npmVersion[0] < MIN_NPM_MAJOR) {
      return { ok: false, note: `npm ${npmVersion.join('.')} is older than ${MIN_NPM_MAJOR}` };
    }

    return { ok: true, note: `node ${nodeVersion.join('.')}, npm ${npmVersion.join('.')}` };
  },

  // Nothing to heal — a runtime cannot install itself. Throwing hands over to escalate().
  async heal(ctx) {
    ctx.log('attn', 'The toolchain has to be installed outside this wizard.');
    throw new Error('unsupported node/npm version');
  },

  async escalate() {
    return {
      title: 'Node or npm is too old',
      message:
        'Install Node <code>22.12</code> or newer — <code>nvm install 22</code> if you use nvm — then re-check. ' +
        'npm ships with Node, so it usually follows along. ' +
        'Older Node cannot load the ESM-only NestJS 12 packages the API is built on.',
      docsUrl: 'https://nodejs.org/en/download',
      choices: [
        { id: 'recheck', label: 'I installed it — check again', kind: 'primary' },
        { id: 'skip', label: 'Continue anyway', kind: 'soft' },
      ],
    };
  },

  async onChoice(choiceId, payload, ctx) {
    if (choiceId === 'skip') {
      ctx.log('warn', 'Continuing on an unsupported toolchain. Builds may fail in confusing ways.');
      return { skip: true };
    }
    // 'recheck' returns nothing, so the runner re-runs check().
  },
};
