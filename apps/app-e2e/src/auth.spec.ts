import { expect, test } from '@playwright/test';

import { credentials } from './support/credentials';
import { hasSession } from './support/login';

/**
 * The auth pages (`views/auth`), which replaced the galaxy auth remote on
 * `/auth`. These screens are ours, but every label goes through `| translate`,
 * so anchor on ids and the `auth-` structure classes.
 *
 * Two API contracts the flows lean on (from `@app-galaxy/auth-api`):
 * - `request-pass-token` answers 200 for unknown e-mails too (enumeration
 *   guard) and only then skips the mail — which makes the e-mail step
 *   deterministically testable without a mailbox.
 * - `verify-pass-code` answers an INVALID code with 200 and an empty body;
 *   the page must read the missing `userId` as failure, not the HTTP status.
 */
const AUTH = {
  brand: '.auth-brand',
  email: '#auth-email',
  password: '#auth-password',
  submit: 'form button[type="submit"]',
  error: '.auth-form-err',
  success: '.auth-success',
  tenantButton: '.auth-tenant',
  recoverLink: 'a[href*="recover-password"]',
  recoverEmail: '#auth-rec-email',
  recoverCode: '#auth-rec-code',
  backLink: '.auth-card-foot a',
} as const;

// These suites drive the auth screens themselves, so they must start signed
// out — the `setup` project's storageState would short-circuit everything.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('auth: login', () => {
  test('renders the login card and the brand panel', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page.locator(AUTH.brand)).toBeVisible();
    await expect(page.locator(AUTH.email)).toBeVisible();
    await expect(page.locator(AUTH.password)).toBeVisible();
    await expect(page.locator(AUTH.submit)).toBeVisible();
    expect(await hasSession(page)).toBe(false);
  });

  test('rejects a wrong password with the error banner and no session', async ({
    page,
  }) => {
    const { email } = credentials();

    await page.goto('/auth/login');
    await page.waitForSelector(AUTH.email);
    await page.fill(AUTH.email, email);
    await page.fill(AUTH.password, 'definitely-not-the-password');
    await page.click(AUTH.submit);

    await expect(page.locator(AUTH.error)).toBeVisible();
    expect(page.url()).toContain('/auth/login');
    expect(await hasSession(page)).toBe(false);
  });

  test('signs in, walks tick + tenant step and lands on the entry page', async ({
    page,
  }) => {
    const { email, password } = credentials();

    await page.goto('/auth/login');
    await page.waitForSelector(AUTH.email);
    await page.fill(AUTH.email, email);
    await page.fill(AUTH.password, password);
    await page.click(AUTH.submit);

    // Success step (animated tick), then the 1.8s handover to tenant-login.
    await expect(page.locator(AUTH.success)).toBeVisible();
    await page.waitForURL(/\/auth\/tenant-login/);

    // With exactly one tenant the chooser auto-continues WITHOUT rendering
    // any buttons — only click when selectable tenants actually appear.
    const tenant = page.locator(AUTH.tenantButton);
    try {
      await tenant.first().waitFor({ state: 'visible', timeout: 5_000 });
      await tenant.first().click();
    } catch {
      // Auto-continued (0/1 tenant) — nothing to click.
    }

    await page.waitForURL(/\/admin\/dashboard/, { timeout: 60_000 });
    expect(await hasSession(page)).toBe(true);
  });
});

test.describe('auth: recover password', () => {
  test('advances to the sent note — the mail carries a link, not a code', async ({
    page,
  }) => {
    await page.goto('/auth/login');
    await page.click(AUTH.recoverLink);
    await page.waitForSelector(AUTH.recoverEmail);

    // Unknown address: the API still answers success (enumeration guard) but
    // sends no mail — the flow must advance to the sent note either way, and
    // there is NO code input (the mail contains a direct link).
    await page.fill(AUTH.recoverEmail, 'e2e-nobody@example.com');
    await page.click(AUTH.submit);
    await expect(page.locator('h2')).toContainText(/E-Mail|Email|E-mail/);
    await expect(page.locator(AUTH.recoverCode)).toHaveCount(0);
  });

  test('a bogus reset link reports the invalid token in place', async ({
    page,
  }) => {
    // The mail link enters here; a dead token must fall back to the email
    // step with a visible error instead of a router noMatchError.
    await page.goto('/auth/reset/e2e-nobody@example.com/deadbeef00');
    await expect(page.locator(AUTH.error)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(AUTH.recoverEmail)).toBeVisible();
  });
});

test.describe('auth: verify e-mail', () => {
  test('shows the failed state when the link carries no token', async ({
    page,
  }) => {
    await page.goto('/auth/verify-email');

    // Only the failed branch renders the card-foot back link to the login.
    await expect(page.locator(AUTH.backLink)).toBeVisible();
    await expect(page.locator(AUTH.success)).toHaveCount(0);
  });

  test('shows the failed state for a bogus verification link', async ({
    page,
  }) => {
    await page.goto(
      '/auth/verify-email?email=e2e-nobody%40example.com&token=bogus-token',
    );

    await expect(page.locator(AUTH.backLink)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(AUTH.success)).toHaveCount(0);
  });
});

test.describe('auth: 2fa', () => {
  /**
   * The step lives on `/auth/two-fa-login`. In the live flow the login
   * navigates here once the server answers `twoFactorRequired` (flag
   * `APP_AUTH_2FA_ENABLED`); these tests use the page's `?email=` deep link
   * instead, so they run — and stay meaningful — with the flag off too. The
   * happy path needs the mailed code and stays a manual check.
   *
   * `verify-2fa-login` itself is always live: a wrong code is a real 401
   * («Invalid verification code»), which the card must absorb as a banner.
   */
  const OTP = {
    boxes: '.auth-otp input',
    verify: '[data-action="auth.verifyOtp"]',
    cooldownNote: '.auth-ok-note',
  } as const;

  const pageUrl = () =>
    `/auth/two-fa-login?email=${encodeURIComponent(credentials().email)}`;

  test('renders the six code boxes and masks the e-mail', async ({ page }) => {
    await page.goto(pageUrl());

    await expect(page.locator(OTP.boxes)).toHaveCount(6);
    // «el***@…», never the full address.
    const email = credentials().email;
    await expect(page.locator('.auth-sub')).toContainText('*');
    await expect(page.locator('.auth-sub')).not.toContainText(email);
  });

  test('redirects to the login when nothing is pending', async ({ page }) => {
    // No `?email=`, no in-memory login state: there is nothing to verify.
    await page.goto('/auth/two-fa-login');

    await page.waitForURL(/\/auth\/login/, { timeout: 15_000 });
  });

  test('an incomplete code complains locally', async ({ page }) => {
    await page.goto(pageUrl());
    await page.waitForSelector(OTP.boxes);

    await page.locator(OTP.boxes).first().fill('1');
    await page.click(OTP.verify);

    await expect(page.locator(AUTH.error)).toBeVisible();
    expect(page.url()).toContain('/auth/two-fa-login');
  });

  test('pasting the whole code fills all six boxes', async ({ page }) => {
    await page.goto(pageUrl());
    await page.waitForSelector(OTP.boxes);

    // The input handler splits any multi-digit value across the boxes —
    // same path a real clipboard paste takes.
    await page.locator(OTP.boxes).first().fill('123456');

    const boxes = page.locator(OTP.boxes);
    for (let i = 0; i < 6; i++) {
      await expect(boxes.nth(i)).toHaveValue(String(i + 1));
    }
  });

  test('a wrong code shows the banner, clears the boxes, no session', async ({
    page,
  }) => {
    await page.goto(pageUrl());
    await page.waitForSelector(OTP.boxes);

    await page.locator(OTP.boxes).first().fill('000000');
    await page.click(OTP.verify);

    await expect(page.locator(AUTH.error)).toBeVisible({ timeout: 15_000 });
    // The card resets for the next attempt instead of keeping the reject.
    await expect(page.locator(OTP.boxes).first()).toHaveValue('');
    expect(page.url()).toContain('/auth/two-fa-login');
    expect(await hasSession(page)).toBe(false);
  });

  test('resend starts the 60 s cooldown and blocks itself', async ({
    page,
  }) => {
    await page.goto(pageUrl());
    await page.waitForSelector(OTP.boxes);

    // Deep-link path: resend goes through the verification mail, which
    // answers 200 for known addresses — the cooldown note must appear.
    const resend = page.locator('.auth-row .auth-link').last();
    await resend.click();

    await expect(page.locator(OTP.cooldownNote)).toBeVisible({
      timeout: 15_000,
    });
    await expect(resend).toBeDisabled();
  });

  test('back returns to the login card', async ({ page }) => {
    await page.goto(pageUrl());
    await page.waitForSelector(OTP.boxes);

    await page.locator('.auth-row .auth-link').first().click();
    await page.waitForURL(/\/auth\/login/, { timeout: 15_000 });
    await expect(page.locator(AUTH.email)).toBeVisible();
  });
});
