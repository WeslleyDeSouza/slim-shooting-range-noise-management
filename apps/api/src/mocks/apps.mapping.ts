import { SLIM_APP_ID } from '@slim/shared';

/**
 * App and category ids of this installation — in their own file so the
 * role seed (roles.mock-data.ts) and the catalogue (main.mock-data.ts) can
 * both import them without a circular import.
 *
 * The app ids themselves live in `@slim/shared` (`SLIM_APP_ID`) because the
 * frontend menu filters by the same numbers; `API_APPS_MAPPING` stays the
 * name the guards and the catalogue use.
 */
export const API_APPS_MAPPING = SLIM_APP_ID;
export type API_APPS_MAPPING = SLIM_APP_ID;

/** Category ids (galaxy `app_category`), start at 8 to stay clear of defaults. */
export enum API_CATEGORY_MAPPING {
  WORKSPACE = 8,
  DATA_MANAGEMENT = 9,
}
