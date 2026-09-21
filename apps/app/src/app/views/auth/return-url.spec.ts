import { rememberReturnUrl, sanitizeAdminReturnUrl, takeReturnUrl } from './return-url';

describe('return url after login (deep link round trip)', () => {
  beforeEach(() => sessionStorage.clear());

  it('accepts admin pages with their own query string and fragment', () => {
    expect(sanitizeAdminReturnUrl('/admin')).toBe('/admin');
    expect(sanitizeAdminReturnUrl('/admin/test-123')).toBe('/admin/test-123');
    expect(sanitizeAdminReturnUrl('/admin/data-management/area/x/calculations/details?state=1#top')).toBe('/admin/data-management/area/x/calculations/details?state=1#top');
  });

  it('rejects everything that is not an internal admin path', () => {
    expect(sanitizeAdminReturnUrl(null)).toBeNull();
    expect(sanitizeAdminReturnUrl('')).toBeNull();
    expect(sanitizeAdminReturnUrl('/')).toBeNull();
    expect(sanitizeAdminReturnUrl('/auth/login')).toBeNull(); // would loop
    expect(sanitizeAdminReturnUrl('/styleguide')).toBeNull(); // never behind the guard
    expect(sanitizeAdminReturnUrl('/administrator')).toBeNull(); // prefix trick
    expect(sanitizeAdminReturnUrl('//evil.example/admin')).toBeNull();
    expect(sanitizeAdminReturnUrl('https://evil.example/admin')).toBeNull();
    expect(sanitizeAdminReturnUrl('/\\evil.example')).toBeNull();
  });

  it('parks the target per tab and hands it out exactly once', () => {
    rememberReturnUrl('/admin/data-management/weapons/caliber');
    expect(sessionStorage.getItem('slim.returnUrl')).toBe('/admin/data-management/weapons/caliber');
    expect(takeReturnUrl()).toBe('/admin/data-management/weapons/caliber');
    expect(takeReturnUrl()).toBeNull();
  });

  it('clears a stale target when the login starts without a deep link', () => {
    rememberReturnUrl('/admin/area');
    rememberReturnUrl(null);
    expect(takeReturnUrl()).toBeNull();
    rememberReturnUrl('/admin/area');
    rememberReturnUrl('https://evil.example');
    expect(takeReturnUrl()).toBeNull();
  });

  it('never trusts what sits in the storage', () => {
    sessionStorage.setItem('slim.returnUrl', 'https://evil.example');
    expect(takeReturnUrl()).toBeNull();
  });
});
