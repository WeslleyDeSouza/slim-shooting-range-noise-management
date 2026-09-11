try {
  const path = require('path');
  require('dotenv').config({ path: path.join(__dirname, '.env') });
  require('dotenv').config({ path: path.join(__dirname, '.env.public') });
} catch (e) {}

const APPS = [
  {
    name: 'api-base',
    script: 'dist/api/main.js',
    watch: ['dist/api/**/*'],
    ignore_watch: ['*.ts', '*.log', 'node_modules', 'temp'],
    io: {},
    env: { ...process.env },
    restart_delay: 5000,
    post_update: ['yarn'],
    watch_options: {
      usePolling: true,
      alwaysStat: true,
    },
    node_args: '--max-old-space-size=8192',
    instances: process.env['API_CLUSTER_INSTANCES'] || 1,
    exec_mode: process.env['API_CLUSTER_EXEC_MODE'] || 'cluster',
    min_uptime: '1m',
  },
];

process.env['--only'] =
  process.env['--only'] ||
  process.env['only'] ||
  process.env['PM2_APP_NAME'] ||
  process.env['ONLY'] ||
  undefined;

if (process.env['--only'] === 'undefined') delete process.env['--only'];

if (process.env['--only']) console.info('Starting', process.env['--only']);

const filterApps = (apps) =>
  process.env['--only']
    ? apps.filter((app) => app.name.includes(process.env['--only']))
    : apps;

module.exports = {
  apps: filterApps(APPS),
  deploy: {
    production: {
      user: 'root',
      host: [process.env['FTP_HOST']],
      ref: 'origin/master',
      repo: 'git@github.com:Username/repository.git',
      path: '/var/www/app/APP_NAME',
      'post-deploy': 'npm install',
    },
  },
};
