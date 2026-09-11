import { Injectable, NestMiddleware } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import type { NextFunction, Request, Response } from 'express';
import { forwardedChain, resolveClientIp } from './client-ip';

export interface RequestOrigin {
  ip?: string;
  device?: string;
}

/**
 * Per-request origin (IP + user agent), readable from anywhere on the same
 * async chain — most importantly from `LoggerService.createLog`.
 *
 * This is how EVERY log entry gets its `ip`/`device` without threading the
 * request object through dozens of controller → service → logger calls; a
 * caller that does pass explicit values still wins.
 */
export const REQUEST_ORIGIN = new AsyncLocalStorage<RequestOrigin>();

function debugEnabled(): boolean {
  const raw = (process.env['API_CLIENT_IP_DEBUG'] ?? '').trim().toLowerCase();
  return !!raw && !['0', 'false', 'off', 'no'].includes(raw);
}

@Injectable()
export class RequestOriginMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    // Same resolution as the auth session's `req.ip`, so a login and the
    // requests that follow it never disagree about who the client was.
    const ip = resolveClientIp(req);

    // The auth-api reads `req.ip` straight off the request when it stores a
    // session, and the rate limiter counts against it. Shadow the Express
    // getter so a configured `API_CLIENT_IP_HEADER` reaches those too instead
    // of only the logbook — without it, sessions and logs would disagree.
    if (ip && ip !== req.ip) {
      Object.defineProperty(req, 'ip', {
        value: ip,
        configurable: true,
        enumerable: true,
      });
    }
    const device = ((req.headers['user-agent'] as string) || '').slice(0, 120);

    if (debugEnabled()) {
      console.info('[client-ip]', {
        resolved: ip,
        reqIp: req.ip,
        forwarded: forwardedChain(req),
        realIp: req.headers['x-real-ip'],
        socket: req.socket?.remoteAddress,
        trustProxy: req.app?.get('trust proxy'),
        path: req.originalUrl,
      });
    }

    REQUEST_ORIGIN.run({ ip, device: device || undefined }, () => next());
  }
}
