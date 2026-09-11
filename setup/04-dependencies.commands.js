/** @type {import('@app-galaxy/setup-api').CommandsModule} */
module.exports = {
  title: 'Install dependencies',
  description: 'Pull every package into <code>node_modules</code>.',

  // The lockfile marker proves an install finished; the private package proves it
  // resolved the Nexus registry rather than falling back to a stale tree.
  check: [
    'node -e "require(\'fs\').accessSync(\'node_modules/.package-lock.json\')"',
    'node -e "require(\'fs\').accessSync(\'node_modules/@app-galaxy/core-api/package.json\')"',
  ],

  heal: 'npm install --legacy-peer-deps',
};
