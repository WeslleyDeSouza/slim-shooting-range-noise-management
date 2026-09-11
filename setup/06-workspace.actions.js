const { datasetUser } = require('./_browser');

const REQUIRED_PROJECTS = ['api', 'app'];

function clean(value) {
  return String(value ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
}

/** @type {import('@app-galaxy/setup-api').StepDefinition} */
module.exports = {
  group: 'Workspace',
  title: 'Verify the Nx workspace',
  description:
    'Resolve the project graph so <code>npm run all</code> has something to serve.',

  async check(ctx) {
    const result = await ctx.exec('npx nx show projects --json', {
      cwd: ctx.projectDir,
    });
    if (result.code !== 0)
      return { ok: false, note: 'nx could not read the workspace' };

    let projects;
    try {
      // Nx prints the daemon banner before the JSON on a cold start.
      const json = result.stdout.slice(result.stdout.indexOf('['));
      projects = JSON.parse(json);
    } catch {
      return {
        ok: false,
        note: 'nx returned output that is not a project list',
      };
    }

    const missing = REQUIRED_PROJECTS.filter(
      (name) => !projects.includes(name),
    );
    if (missing.length)
      return { ok: false, note: `nx cannot see ${missing.join(', ')}` };

    const env = await ctx.readEnv();
    const apiPort = Number(clean(env['API_PORT'])) || 3333;
    ctx.log('info', `api      http://localhost:${apiPort}/api`);
    ctx.log('info', `swagger  http://localhost:${apiPort}/api/docs`);
    ctx.log('info', 'app      http://localhost:4200');
    ctx.log(
      'info',
      `demo     ${clean(env['APP_DEFAULT_USER']) || datasetUser(ctx)?.user || 'slim@demo.ch'} / ${clean(env['APP_DEFAULT_PASSWORD']) || datasetUser(ctx)?.password || '1234'}`,
    );
    ctx.log('info', 'the API regenerates the client (libs/app/generated -> @ui-slim/apiClient) on every start');
    ctx.log('ok', 'run `npm run all` to serve both.');

    return { ok: true, note: `${projects.length} projects` };
  },

  async heal(ctx) {
    // A half-written cache from an interrupted install is the usual cause.
    const result = await ctx.exec('npx nx reset', { cwd: ctx.projectDir });
    if (result.code !== 0) throw new Error('nx reset failed');
    ctx.log('heal', 'cleared the nx cache and daemon');
  },

  async escalate() {
    return {
      title: 'Nx cannot read the workspace',
      message:
        'The project graph did not resolve even after <code>nx reset</code>. ' +
        'A stale <code>node_modules</code> is the usual culprit — delete it and re-run the dependency step.',
      docsUrl: 'https://nx.dev/troubleshooting/troubleshoot-nx-install-issues',
      choices: [
        { id: 'recheck', label: 'Check again', kind: 'primary' },
        { id: 'skip', label: 'Skip for now', kind: 'soft' },
      ],
    };
  },

  async onChoice(choiceId) {
    if (choiceId === 'skip') return { skip: true };
    // 'recheck' returns nothing, so the runner re-runs check().
  },
};
