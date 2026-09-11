import type { NextFunction, Request, Response } from 'express';

/**
 * Some reverse proxies (e.g. Coolify) double the global prefix (`/api/api`).
 * Collapse it so the Nest router sees the canonical URL; a bare `/api/api`
 * is mapped to the alive probe.
 */
export function replaceDoubleApiPrefix(url: string): string {
  if (url === '/api/api' || url === '/api/api/') return '/api/health/alive';
  return url.startsWith('/api/api/') ? url.substring('/api'.length) : url;
}

export function applyMiddlewareAppStripeDouble() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.url = replaceDoubleApiPrefix(req.url);
    next();
  };
}

/**
 * Number of reverse-proxy hops to trust when resolving the client IP.
 *
 * Parsed explicitly rather than with `+value` or `!!value`: every non-empty
 * string is truthy, so `API_TRUST_PROXY=false` would otherwise be read as
 * "trust", which is the unsafe direction (spoofable X-Forwarded-For).
 */
export function resolveTrustProxy(
  raw: string | undefined = process.env['API_TRUST_PROXY'],
): number {
  const value = (raw ?? '').trim().toLowerCase();

  if (!value) return 1; // default: exactly one proxy in front
  if (['false', 'off', 'no'].includes(value)) return 0;

  const hops = Number(value);
  return Number.isInteger(hops) && hops >= 0 ? hops : 1;
}

/** Parse a boolean-ish env value ("1", "true", "yes", "on"). */
export function envFlag(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}
