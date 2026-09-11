import { toAuthError } from './auth.facade';

const fallbacks = { network: 'NETZ', generic: 'GENERISCH' };

describe('toAuthError', () => {
  it('surfaces a string error body', () => {
    expect(toAuthError({ error: 'Konto gesperrt' }, fallbacks)).toBe(
      'Konto gesperrt',
    );
  });

  it('surfaces a NestJS message string', () => {
    expect(
      toAuthError({ error: { message: 'Invalid credentials' } }, fallbacks),
    ).toBe('Invalid credentials');
  });

  it('joins a NestJS message array', () => {
    expect(
      toAuthError({ error: { message: ['a', 'b'] } }, fallbacks),
    ).toBe('a · b');
  });

  it('maps status 0 onto the network fallback', () => {
    expect(toAuthError({ status: 0, message: 'Http failure' }, fallbacks)).toBe(
      'NETZ',
    );
  });

  it('falls back to the generic message', () => {
    expect(toAuthError({}, fallbacks)).toBe('GENERISCH');
  });
});
