import {
  applyMiddlewareAppStripeDouble,
  envFlag,
  replaceDoubleApiPrefix,
  resolveTrustProxy,
} from './utils';

describe('replaceDoubleApiPrefix', () => {
  it('collapses /api/api and maps the bare prefix to the health check', () => {
    expect(replaceDoubleApiPrefix('/api/api/public/x')).toBe('/api/public/x');
    expect(replaceDoubleApiPrefix('/api/api')).toBe('/api/health/alive');
    expect(replaceDoubleApiPrefix('/api/public/x')).toBe('/api/public/x');
    expect(replaceDoubleApiPrefix('/docs')).toBe('/docs');
  });

  it('middleware rewrites req.url and calls next', () => {
    const next = vi.fn();
    const req = { url: '/api/api/x' } as never;
    applyMiddlewareAppStripeDouble()(req, {} as never, next);
    expect((req as { url: string }).url).toBe('/api/x');
    expect(next).toHaveBeenCalled();
  });
});

describe('resolveTrustProxy', () => {
  it.each([
    [undefined, 1],
    ['', 1],
    ['false', 0],
    ['OFF', 0],
    ['no', 0],
    ['2', 2],
    ['0', 0],
    ['-1', 1],
    ['abc', 1],
  ])('%p → %p', (raw, expected) => {
    expect(resolveTrustProxy(raw as string | undefined)).toBe(expected);
  });
});

describe('envFlag', () => {
  it('reads the usual truthy spellings and falls back otherwise', () => {
    expect(envFlag('1')).toBe(true);
    expect(envFlag(' TRUE ')).toBe(true);
    expect(envFlag('0')).toBe(false);
    expect(envFlag(undefined, true)).toBe(true);
    expect(envFlag('')).toBe(false);
  });
});
