import { MiddlewareCors, MiddlewareSecurityHeaders } from '@app-galaxy/core-api';
import express from 'express';
import request from 'supertest';
import { contentSecurityPolicy, securityHeaders } from './security-headers';

/** The middleware chain of `main.ts`, on a bare express app. */
function server(env: NodeJS.ProcessEnv = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(MiddlewareSecurityHeaders());
  app.use(MiddlewareCors({ customHeaders: securityHeaders(env) }));
  app.get('/', (_req, res) => res.type('html').send('<!doctype html><title>SLIM</title>'));
  app.get('/api/health/alive', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('security headers (scan of the demo instance, 02.10.2026)', () => {
  it('sends the five headers the scan missed on the app page', async () => {
    const res = await request(server()).get('/').expect(200);
    expect(res.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['permissions-policy']).toContain('camera=()');
    expect(res.headers['permissions-policy']).toContain('geolocation=()');
  });

  it('sends them on API responses and on the CORS preflight as well', async () => {
    const api = await request(server()).get('/api/health/alive').expect(200);
    expect(api.headers['x-content-type-options']).toBe('nosniff');
    expect(api.headers['content-security-policy']).toBeDefined();
    const preflight = await request(server()).options('/api/health/alive').set('Origin', 'https://example.org').expect(200);
    expect(preflight.headers['strict-transport-security']).toBeDefined();
    expect(preflight.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('keeps the credentials header of the galaxy CORS defaults and drops the product banner', async () => {
    const res = await request(server()).get('/api/health/alive');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('does not depend on the galaxy opt-in (API_CONFIG_HEADERS_SECURITY) and wins when that is set', async () => {
    const before = { security: process.env['API_CONFIG_HEADERS_SECURITY'], env: process.env['APP_ENV'] };
    process.env['API_CONFIG_HEADERS_SECURITY'] = '1';
    process.env['APP_ENV'] = 'production';
    try {
      const res = await request(server()).get('/');
      // The galaxy default policy does not know the map services; the SLIM policy is the one that is sent.
      expect(res.headers['content-security-policy']).toBe(contentSecurityPolicy({}));
    } finally {
      if (before.security === undefined) delete process.env['API_CONFIG_HEADERS_SECURITY'];
      else process.env['API_CONFIG_HEADERS_SECURITY'] = before.security;
      if (before.env === undefined) delete process.env['APP_ENV'];
      else process.env['APP_ENV'] = before.env;
    }
  });
});

describe('Content-Security-Policy', () => {
  const directive = (policy: string, name: string) => policy.split('; ').find((d) => d.startsWith(`${name} `));

  it('allows scripts from the own origin only — no inline scripts, no eval', () => {
    const policy = contentSecurityPolicy({});
    expect(directive(policy, 'script-src')).toBe("script-src 'self'");
    expect(policy).not.toContain('unsafe-eval');
    expect(directive(policy, 'object-src')).toBe("object-src 'none'");
    expect(directive(policy, 'frame-ancestors')).toBe("frame-ancestors 'self'");
    expect(directive(policy, 'base-uri')).toBe("base-uri 'self'");
  });

  it('lets the map viewer load the swisstopo background maps (tiles, styles, sprites)', () => {
    const policy = contentSecurityPolicy({});
    expect(directive(policy, 'connect-src')).toBe("connect-src 'self' https://*.geo.admin.ch");
    expect(directive(policy, 'img-src')).toBe("img-src 'self' data: blob: https://*.geo.admin.ch");
  });

  it('takes further map services and a complete replacement from the environment', () => {
    const more = contentSecurityPolicy({ API_SECURITY_CSP_MAP_SOURCES: 'https://*.geo.admin.ch https://maps.example.ch' });
    expect(directive(more, 'connect-src')).toBe("connect-src 'self' https://*.geo.admin.ch https://maps.example.ch");
    expect(contentSecurityPolicy({ API_SECURITY_CSP: "default-src 'none'" })).toBe("default-src 'none'");
    expect(securityHeaders({ API_SECURITY_CSP: "default-src 'none'" }).find((h) => h.key === 'Content-Security-Policy')?.value).toBe(
      "default-src 'none'",
    );
  });
});
