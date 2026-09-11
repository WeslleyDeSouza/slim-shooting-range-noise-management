import { enforceRememberSession, setRememberSession } from './remember-session';

/** What auth-ui persists; enforceRememberSession() drops exactly these. */
function seedSession(): void {
  localStorage.setItem('app.session', '{"valid":true}');
  localStorage.setItem('utk', 'user-token');
  localStorage.setItem('ttk', 'tenant-token');
}

describe('remember session', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keeps a remembered session across a new tab', () => {
    seedSession();
    setRememberSession(true);

    // A new tab starts with an empty sessionStorage.
    sessionStorage.clear();
    enforceRememberSession();

    expect(localStorage.getItem('app.session')).not.toBeNull();
  });

  it('keeps a non-remembered session alive inside the same tab', () => {
    seedSession();
    setRememberSession(false);

    enforceRememberSession();

    expect(localStorage.getItem('app.session')).not.toBeNull();
    expect(localStorage.getItem('utk')).toBe('user-token');
  });

  it('drops a non-remembered session once its tab is gone', () => {
    seedSession();
    setRememberSession(false);

    // Closing the tab wipes sessionStorage — the marker goes with it.
    sessionStorage.clear();
    enforceRememberSession();

    expect(localStorage.getItem('app.session')).toBeNull();
    expect(localStorage.getItem('utk')).toBeNull();
    expect(localStorage.getItem('ttk')).toBeNull();
  });

  it('leaves a session alone when nothing was ever recorded', () => {
    seedSession();

    enforceRememberSession();

    expect(localStorage.getItem('app.session')).not.toBeNull();
  });
});
