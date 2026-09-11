import type { Route } from '@angular/router';
import { AuthLayoutComponent } from './auth-layout.component';
import { LoginPage } from './login/login.page';
import { TenantChooserPage } from './tenant-chooser/tenant-chooser.page';
import { TwoFaLoginPage } from './two-fa-login/two-fa-login.page';
import { RecoverPasswordPage } from './recover-password/recover-password.page';
import { VerifyEmailPage } from './verify-email/verify-email.page';

/**
 * The auth pages, mounted on `/auth` in place of the MFE auth remote
 * (`loadAuthMod()`). The child paths are the remote's own (login,
 * tenant-login, recover-password, verify-email) so existing links, guards
 * and redirects keep working unchanged.
 */
export const AUTH_REDESIGN_ROUTES: Route[] = [
  {
    path: '',
    component: AuthLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'login' },
      { path: 'login', component: LoginPage },
      { path: 'two-fa-login', component: TwoFaLoginPage },
      { path: 'tenant-login', component: TenantChooserPage },
      { path: 'recover-password', component: RecoverPasswordPage },
      // The reset mail carries a DIRECT LINK (no manual code entry): the
      // token in the URL is verified on arrival and the page jumps straight
      // to the new-password step.
      { path: 'reset/:email/:token', component: RecoverPasswordPage },
      // Forced first-login reset (admin created the account with
      // `resetPassword`): no mail token — the server accepts `code: 'id'`
      // plus the userId while the account flag is set.
      { path: 'reset/:email/id/:userId', component: RecoverPasswordPage },
      { path: 'verify-email', component: VerifyEmailPage },
    ],
  },
];
