import { isStaticIndexPath } from './core-static-file.middleware.fn';

const page = (url: string) => isStaticIndexPath({ url });

describe('isStaticIndexPath — which requests get index.html', () => {
  it('serves the pages of the app', () => {
    expect(page('/')).toBe(true);
    expect(page('/index.html')).toBe(true);
    expect(page('/admin/area')).toBe(true);
    expect(page('/admin/area/3728e3a9-4e6b-416d-a13f-e844a3a9fe2c/map?state=abc')).toBe(true);
  });

  it('serves addresses that carry an e-mail address (links of the auth mails)', () => {
    // Found by running the e2e suite against the production build: these answered 404.
    expect(page('/auth/reset/e2e-nobody@example.com/deadbeef00')).toBe(true);
    expect(page('/auth/two-fa-login?email=slim%40demo.ch')).toBe(true);
    expect(page('/auth/verify-email/user@example.admin.ch')).toBe(true);
    expect(page('/auth/login?returnUrl=/admin/area?file=report.pdf')).toBe(true);
  });

  it('leaves the API, the API docs and the assets alone', () => {
    expect(page('/api/admin/area')).toBe(false);
    expect(page('/api/auth/login')).toBe(false);
    expect(page('/docs')).toBe(false);
    expect(page('/assets/config/map.config.json')).toBe(false);
    expect(page('/assets/locales/de/common.locale.json')).toBe(false);
  });

  it('leaves the files of the build to the static file server', () => {
    for (const file of ['/main-4GXPPWU3.js', '/styles-L7SSWE5Y.css', '/theme-init.js', '/favicon.ico', '/manifest.webmanifest', '/ngsw.json', '/chunk-51ooRDnL.js?v=1']) {
      expect(page(file)).toBe(false);
    }
  });
});
