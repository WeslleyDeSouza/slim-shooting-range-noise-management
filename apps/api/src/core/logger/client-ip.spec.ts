import { ClientIpRequest, forwardedChain, resolveClientIp } from './client-ip';

function request(init: {
  ip?: string;
  headers?: ClientIpRequest['headers'];
  remoteAddress?: string;
}): ClientIpRequest {
  return {
    ip: init.ip,
    headers: init.headers ?? {},
    socket: { remoteAddress: init.remoteAddress },
  };
}

describe('resolveClientIp', () => {
  const header = 'API_CLIENT_IP_HEADER';

  afterEach(() => {
    delete process.env[header];
  });

  it('takes the address Express resolved against the trusted hop count', () => {
    const req = request({
      ip: '83.228.208.132',
      headers: { 'x-forwarded-for': '9.9.9.9, 83.228.208.132' },
    });

    expect(resolveClientIp(req)).toBe('83.228.208.132');
  });

  it('ignores a forged X-Forwarded-For that Express did not trust', () => {
    const req = request({
      ip: '203.0.113.7',
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });

    expect(resolveClientIp(req)).toBe('203.0.113.7');
  });

  it('prefers the configured header when the proxy publishes one', () => {
    process.env[header] = 'X-Real-IP';
    const req = request({
      ip: '10.0.0.1',
      headers: { 'x-real-ip': '198.51.100.23' },
    });

    expect(resolveClientIp(req)).toBe('198.51.100.23');
  });

  it('falls back to req.ip when the configured header is absent', () => {
    process.env[header] = 'x-real-ip';

    expect(resolveClientIp(request({ ip: '198.51.100.9' }))).toBe('198.51.100.9');
  });

  it('unwraps IPv4-mapped IPv6 addresses', () => {
    expect(resolveClientIp(request({ ip: '::ffff:83.228.208.132' }))).toBe(
      '83.228.208.132',
    );
  });

  it('falls back to the socket address and stays inside the column limit', () => {
    expect(resolveClientIp(request({ remoteAddress: '::1' }))).toBe('::1');
    expect(resolveClientIp(request({}))).toBeUndefined();
    expect(resolveClientIp(request({ ip: 'x'.repeat(60) }))).toHaveLength(45);
  });
});

describe('forwardedChain', () => {
  it('lists every hop left to right', () => {
    const req = request({
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8 ,  9.10.11.12' },
    });

    expect(forwardedChain(req)).toEqual(['1.2.3.4', '5.6.7.8', '9.10.11.12']);
  });

  it('is empty without the header', () => {
    expect(forwardedChain(request({}))).toEqual([]);
  });
});
