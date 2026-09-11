/**
 * «Angemeldet bleiben».
 *
 * The auth library always persists the session to `localStorage`, which
 * survives closing the browser. When the visitor turns the toggle off we want
 * the opposite: the session should end with the tab.
 *
 * `sessionStorage` is per tab and is wiped when the tab closes, so a marker
 * placed there is proof that this is still the same tab that signed in. On
 * start-up a stored session without that marker can only come from a tab that
 * has since been closed — so it gets dropped before anything reads it.
 */
const REMEMBER_KEY = 'slim.remember';
const TAB_MARKER_KEY = 'slim.session.tab';

/** Session keys written by auth-ui's SessionStoreHelper. */
const SESSION_KEYS = ['app.session', 'utk', 'ttk'];

/** Records the choice made on the login form. */
export function setRememberSession(remember: boolean): void {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
    if (remember) {
      sessionStorage.removeItem(TAB_MARKER_KEY);
    } else {
      sessionStorage.setItem(TAB_MARKER_KEY, '1');
    }
  } catch {
    // Private mode without storage — nothing to remember either way.
  }
}

/**
 * Drops a session that was not meant to outlive its tab. Call this BEFORE
 * bootstrapping so no service has read the session yet.
 */
export function enforceRememberSession(): void {
  try {
    const remembered = localStorage.getItem(REMEMBER_KEY) !== '0';
    if (remembered || sessionStorage.getItem(TAB_MARKER_KEY) === '1') {
      return;
    }
    for (const key of SESSION_KEYS) {
      localStorage.removeItem(key);
    }
    localStorage.removeItem(REMEMBER_KEY);
  } catch {
    // See above.
  }
}
