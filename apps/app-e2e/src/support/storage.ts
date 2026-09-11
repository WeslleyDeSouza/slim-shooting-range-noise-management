/**
 * Where the `setup` project parks the authenticated session.
 *
 * Kept out of `auth.setup.ts` so `playwright.config.ts` can import the path
 * without pulling in a file that registers a test.
 */
export const STORAGE_STATE = 'apps/app-e2e/.auth/user.json';
