import type { Request } from 'express';

/**
 * The part of a request the resolution needs. Narrower than `Request` so tests
 * can hand in a plain object instead of casting a stub to the full type.
 */
export type ClientIpRequest = Pick<Request, 'headers'> & {
  ip?: string;
  socket?: { remoteAddress?: string };
};

/** Column limit of `core_log.ip` (and of `session.ipAddress`). */
const IP_MAX_LENGTH = 45;

/**
 * Optional header carrying the real client address, for setups where the hop
 * in front of us does not extend `X-Forwarded-For` but publishes its own
 * header (`X-Real-IP`, `CF-Connecting-IP`, a corporate proxy's custom name).
 * Only read when explicitly configured — an unconditional read would let any
 * client pick its own address.
 */
function configuredHeader(req: ClientIpRequest): string | undefined {
  const name = (process.env['API_CLIENT_IP_HEADER'] ?? '').trim().toLowerCase();
  if (!name) return undefined;

  const raw = req.headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.split(',')[0]?.trim() || undefined;
}

/** `::ffff:83.228.208.132` and `[::1]:443` are the same address as plain forms. */
function normalize(ip: string): string {
  const bare = ip.replace(/^\[|\]$/g, '');
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(bare);
  return (mapped ? mapped[1] : bare).slice(0, IP_MAX_LENGTH);
}

/**
 * The client address to record on logs and sessions.
 *
 * `req.ip` is the primary source: Express resolves it against the `trust proxy`
 * hop count from `main.ts`, so it yields the left-most address that our own
 * proxies did not add — unlike reading `X-Forwarded-For[0]` directly, which any
 * client can forge by sending the header itself.
 *
 * Note what this cannot do: when users reach the app through a proxy on THEIR
 * side, that proxy's egress address is the client as far as we are concerned.
 * Recovering the person behind it needs the proxy to forward the address, and
 * `API_CLIENT_IP_HEADER` to name the header it uses.
 */
export function resolveClientIp(req: ClientIpRequest): string | undefined {
  const candidate =
    configuredHeader(req) || req.ip || req.socket?.remoteAddress || '';

  return normalize(candidate) || undefined;
}

/**
 * Every address in the forwarding chain, left to right, for diagnosing which
 * hop we are actually seeing. Not persisted — used by the debug log below.
 */
export function forwardedChain(req: ClientIpRequest): string[] {
  const raw = req.headers['x-forwarded-for'];
  const value = Array.isArray(raw) ? raw.join(',') : raw;
  return (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}
