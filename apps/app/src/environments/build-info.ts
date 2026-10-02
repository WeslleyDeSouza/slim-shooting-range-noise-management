/** Which build is running: shown in the sidebar footer and in the «Version» entry of the main menu. */
export interface BuildInfo {
  /** `version` of package.json. */
  version: string;
  /** Short hash of the commit the build was made from; null = unstamped local development. */
  commit: string | null;
  /** Date of that commit (ISO 8601). */
  committedAt: string | null;
}

/**
 * This committed file is the default of local development (no stamp). The CI
 * build overwrites it with `node tools/build-info.js` right before
 * `nx build app` — do not commit a stamped copy.
 */
export const BUILD_INFO: BuildInfo = {
  version: '0.0.1',
  commit: null,
  committedAt: null,
};
