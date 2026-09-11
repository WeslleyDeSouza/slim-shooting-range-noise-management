# app-e2e

Playwright suite (ELO pattern). `playwright.config.ts` starts the API
(`tools/serve-api-e2e.js`, in-memory SQLite, demo user seeded) and the app when
they are not already running on 3333 / 4200.

| Spec | What |
|---|---|
| `auth.setup.ts` | Signs in once; `chromium` project starts from that session (`.auth/user.json`) |
| `login.spec.ts` | Guard redirect, login form, demo sign-in, wrong password (own empty session) |
| `auth.spec.ts` | Copied from ELO: login card, recover password, verify e-mail, 2FA page |
| `admin.spec.ts` | Entry page KPIs, theme, area overview + filter, language, styleguide |

```bash
npx nx e2e app-e2e          # whole suite
cd apps/app-e2e && npx playwright test src/admin.spec.ts --project=chromium
```

Credentials: `E2E_USER` / `E2E_PASSWORD`, else `APP_DEFAULT_USER` / `APP_DEFAULT_PASSWORD`
from `.env`, else `slim@demo.ch` / `1234`. The 2FA resend test needs SMTP (`MAIL_HOST`).
