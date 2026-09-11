const { copyFileSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const REGISTRY = 'https://nexus-repository.revolvit.ch/repository/npm_hosted/';
const REGISTRY_HOST = '//nexus-repository.revolvit.ch/repository/npm_hosted/';
const SCOPE = '@app-galaxy';

function clean(value) {
  return String(value ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
}

function readNpmrc(ctx) {
  return ctx.exists('.npmrc') ? readFileSync(join(ctx.projectDir, '.npmrc'), 'utf8') : '';
}

function hasToken(contents) {
  const match = /_authToken\s*=\s*(\S+)/.exec(contents);
  return Boolean(match && match[1]);
}

function render(token) {
  return [
    `${REGISTRY_HOST}:_authToken=${token}`,
    `${SCOPE}:registry=${REGISTRY}`,
    'legacy-peer-deps=true',
    '',
  ].join('\n');
}

/** A backup is itself a file we did not write. Never land on one that exists. */
function backupPath(ctx) {
  if (!ctx.exists('.npmrc.backup')) return '.npmrc.backup';
  for (let n = 1; n < 100; n += 1) {
    if (!ctx.exists(`.npmrc.backup.${n}`)) return `.npmrc.backup.${n}`;
  }
  throw new Error('too many .npmrc backups — clean them up first');
}

/** Mirrors writeEnv's contract: back the old file up before replacing it. */
function writeNpmrc(ctx, token) {
  const target = join(ctx.projectDir, '.npmrc');
  if (ctx.exists('.npmrc')) {
    const backup = backupPath(ctx);
    copyFileSync(target, join(ctx.projectDir, backup));
    ctx.log('warn', `kept a copy of the old .npmrc at ${backup}`);
  }
  writeFileSync(target, render(token), 'utf8');

  const gitignore = ctx.exists('.gitignore') ? readFileSync(join(ctx.projectDir, '.gitignore'), 'utf8') : '';
  if (!/^\.npmrc\s*$/m.test(gitignore)) {
    ctx.log('warn', '.npmrc is not in .gitignore — the token will be committed.');
  }
}

/** @type {import('@app-galaxy/setup-api').StepDefinition} */
module.exports = {
  title: 'Authenticate the private registry',
  description: `The <code>${SCOPE}</code> packages live on a private Nexus. <code>npm install</code> fails without a token.`,

  async check(ctx) {
    const npmrc = readNpmrc(ctx);
    if (!npmrc) return { ok: false, note: '.npmrc is missing' };
    if (!npmrc.includes(`${SCOPE}:registry=`)) return { ok: false, note: `no registry mapped for ${SCOPE}` };
    if (!hasToken(npmrc)) return { ok: false, note: 'no _authToken in .npmrc' };

    return { ok: true, note: `${SCOPE} points at the Nexus registry` };
  },

  async heal(ctx) {
    // An existing .npmrc is someone's deliberate configuration. If it is merely
    // incomplete, say so and let the user decide — do not rewrite it from under them.
    if (ctx.exists('.npmrc')) throw new Error('.npmrc exists but is incomplete');

    const token = clean((await ctx.readEnv())['NPM_TOKEN']);
    if (!token) throw new Error('NPM_TOKEN is not set in .env');

    writeNpmrc(ctx, token);
    ctx.log('heal', 'wrote .npmrc from NPM_TOKEN');
  },

  async escalate(ctx) {
    const npmrc = readNpmrc(ctx);
    const rewriting = npmrc
      ? 'An <code>.npmrc</code> already exists but has no usable token. Replacing it keeps a copy at <code>.npmrc.backup</code>. '
      : '';

    return {
      title: 'A registry token is needed',
      message:
        `${rewriting}Packages under <code>${SCOPE}</code> are not on the public npm registry. ` +
        'Grab a token from Nexus (<em>Sign in → your profile → NPM tokens</em>) and paste it in.',
      docsUrl: 'https://nexus-repository.revolvit.ch/',
      choices: [
        {
          id: 'token',
          label: npmrc ? 'Replace it with a token…' : 'Paste a token…',
          kind: 'primary',
          view: 'token',
          viewData: { scope: SCOPE, registry: REGISTRY, replacing: Boolean(npmrc) },
        },
        { id: 'skip', label: 'Skip — I will not install packages', kind: 'soft' },
      ],
    };
  },

  async onChoice(choiceId, payload, ctx) {
    if (choiceId === 'skip') {
      ctx.log('warn', 'Skipping registry auth. The dependency step will fail.');
      return { skip: true };
    }

    if (choiceId === 'token' && payload && payload.token) {
      const token = clean(payload.token);
      writeNpmrc(ctx, token);
      // The user just handed us this token, so it wins over a stale NPM_TOKEN.
      await ctx.writeEnv({ NPM_TOKEN: token }, { overwrite: true });
      ctx.log('ok', 'stored the token in .npmrc and .env');
    }
    // Returning nothing re-runs check().
  },
};
