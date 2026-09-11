import { test as setup } from '@playwright/test';

import { login } from './support/login';
import { STORAGE_STATE } from './support/storage';

/** Sign in once; the admin project starts from this session. */
setup('authenticate', async ({ page }) => {
  setup.setTimeout(300_000);
  await login(page);
  await page.context().storageState({ path: STORAGE_STATE });
});
