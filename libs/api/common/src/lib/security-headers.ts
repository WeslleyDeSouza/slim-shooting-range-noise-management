/** A response header as `MiddlewareCors({ customHeaders })` of `@app-galaxy/core-api` takes it. */
export interface HttpHeader {
  key: string;
  value: string;
}

/**
 * Hosts of the background maps of the map viewer (`@ui-slim/map`,
 * `apps/app/public/assets/config/map.config.json`): swisstopo vector tiles
 * (`vectortiles*.geo.admin.ch`) and WMTS (`wmts.geo.admin.ch`). An
 * administrator who adds a map service to that file adds its host here with
 * `API_SECURITY_CSP_MAP_SOURCES` (space separated).
 */
export const DEFAULT_MAP_SOURCES = 'https://*.geo.admin.ch';

/** Browser features the app does not use: switched off for the page and everything it embeds. */
const PERMISSIONS_POLICY = [
  'accelerometer',
  'autoplay',
  'camera',
  'display-capture',
  'geolocation',
  'gyroscope',
  'magnetometer',
  'microphone',
  'midi',
  'payment',
  'usb',
]
  .map((feature) => `${feature}=()`)
  .join(', ');

/**
 * Content-Security-Policy of the app the API serves (`dist/app`): scripts
 * only from the own origin (no inline scripts — `index.html` loads
 * `theme-init.js`, the production build does not inline critical CSS),
 * styles from the own origin plus the `<style>` elements Angular writes for
 * its components, images and requests additionally from the map services.
 * `API_SECURITY_CSP` replaces the whole policy.
 */
export function contentSecurityPolicy(env: NodeJS.ProcessEnv = process.env): string {
  const override = env['API_SECURITY_CSP']?.trim();
  if (override) return override;
  const maps = env['API_SECURITY_CSP_MAP_SOURCES']?.trim() || DEFAULT_MAP_SOURCES;
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${maps}`,
    "font-src 'self' data:",
    `connect-src 'self' ${maps}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ');
}

/**
 * The security headers of every response (app and API), passed to the
 * galaxy CORS middleware as `customHeaders` — that replaces its defaults, so
 * `Access-Control-Allow-Credentials` is repeated here and the
 * `X-powered-by` banner is gone. Unlike `MiddlewareSecurityHeaders` of the
 * galaxy these do not depend on `API_CONFIG_HEADERS_SECURITY` / `APP_ENV`.
 *
 * `Strict-Transport-Security` is sent on every response; browsers ignore it
 * over plain HTTP (local development).
 */
export function securityHeaders(env: NodeJS.ProcessEnv = process.env): HttpHeader[] {
  return [
    { key: 'Access-Control-Allow-Credentials', value: 'true' },
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(env) },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
  ];
}
