import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';

/**
 * Path prefixes that are rate limited, mapped to the throttler that guards
 * them. The keys must match the throttler names registered in
 * `ThrottlerModule.forRoot` (app.module).
 *
 * Everything else stays unthrottled: the admin API is already behind JWT plus
 * a per-endpoint role guard and the ReplayGuard, so the exposure that needs a
 * rate limit is the part reachable without a session (same as ELO / alco-map).
 */
export const THROTTLED_PREFIXES = {
  auth: '/api/auth',
  public: '/api/public',
} as const;

export type ThrottledGroup = keyof typeof THROTTLED_PREFIXES;

@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  /** Which throttler owns this request, if any. */
  protected groupOf(context: ExecutionContext): ThrottledGroup | undefined {
    const request = context.switchToHttp().getRequest();
    const url: string = request.originalUrl || request.url || '';
    const path = url.split('?')[0];
    return (Object.keys(THROTTLED_PREFIXES) as ThrottledGroup[]).find((group) =>
      path.startsWith(THROTTLED_PREFIXES[group]),
    );
  }

  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    return !this.groupOf(context);
  }

  /**
   * `canActivate` runs every registered throttler against every request that
   * `shouldSkip` let through; each throttler only counts its own prefix.
   */
  protected override async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    if (requestProps.throttler.name !== this.groupOf(requestProps.context)) {
      return true;
    }
    return super.handleRequest(requestProps);
  }
}
