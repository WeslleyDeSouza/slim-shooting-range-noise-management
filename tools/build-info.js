/*
 * Stamps the app with the build it is made from: version of package.json,
 * short commit hash and commit date. Writes
 * apps/app/src/environments/build-info.ts, which the admin layout shows in
 * the sidebar footer («armasuisse · SLIM 0.0.1 / Stand 02.10.2026 12:11 · a7d1ec7»).
 *
 * Run by the CI build before `nx build app` (.github/workflows/build-and-deploy.yml).
 * The committed file is the unstamped default of local development — do not
 * commit the output of this script.
 *
 *   node tools/build-info.js            write the file
 *   node tools/build-info.js --print    print what would be written
 *   node tools/build-info.js --out f    write to another path
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const target = path.join(root, 'apps/app/src/environments/build-info.ts');

function git(args) {
  try {
    return execSync(`git ${args}`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null;
  } catch {
    return null;
  }
}

const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
// GITHUB_SHA is the commit the workflow runs for; git is the fallback outside of GitHub Actions.
const sha = process.env.GITHUB_SHA || git('rev-parse HEAD');
const info = {
  version,
  commit: sha ? sha.slice(0, 7) : null,
  committedAt: sha ? git(`show -s --format=%cI ${sha}`) : null,
};

const source = fs.readFileSync(target, 'utf8');
const marker = 'export const BUILD_INFO: BuildInfo = ';
const at = source.indexOf(marker);
if (at < 0) throw new Error(`build-info: «${marker}» not found in ${target}`);
const literal = (value) => (value === null ? 'null' : `'${String(value).replace(/'/g, "\\'")}'`);
const stamped =
  `${source.slice(0, at)}${marker}{\n` +
  `  version: ${literal(info.version)},\n` +
  `  commit: ${literal(info.commit)},\n` +
  `  committedAt: ${literal(info.committedAt)},\n` +
  '};\n';

const args = process.argv.slice(2);
if (args.includes('--print')) {
  process.stdout.write(stamped);
} else {
  const out = args.includes('--out') ? path.resolve(args[args.indexOf('--out') + 1]) : target;
  fs.writeFileSync(out, stamped);
  console.log(`build-info: SLIM ${info.version} · ${info.commit ?? 'no commit'} · ${info.committedAt ?? 'no date'} → ${path.relative(root, out)}`);
}
