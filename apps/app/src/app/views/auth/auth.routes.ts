import type { Route } from '@angular/router';
import { ROUTE_SEGMENT as S } from '@slim/shared';
import { AuthLayoutComponent } from './auth-layout.component';
import { LoginPage } from './login/login.page';
import { TenantChooserPage } from './tenant-chooser/tenant-chooser.page';
import { TwoFaLoginPage } from './two-fa-login/two-fa-login.page';
import { RecoverPasswordPage } from './recover-password/recover-password.page';
import { VerifyEmailPage } from './verify-email/verify-email.page';

/**
 * The auth pages, mounted on `/auth` (ELO / alco-map). The child paths are
 * the galaxy auth-ui's own (login, tenant-login, recover-password,
 * verify-email) so the library's guards and redirects keep working.
 */
export const AUTH_REDESIGN_ROUTES: Route[] = [
  {
    path: '',
    component: AuthLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: S.login },
      { path: S.login, component: LoginPage },
      { path: S.twoFaLogin, component: TwoFaLoginPage },
      { path: S.tenantLogin, component: TenantChooserPage },
      { path: S.recoverPassword, component: RecoverPasswordPage },
      // The reset mail carries a DIRECT LINK (no manual code entry): the
      // token in the URL is verified on arrival and the page jumps straight
      // to the new-password step.
      { path: 'reset/:email/:token', component: RecoverPasswordPage },
      // Forced first-login reset (admin created the account with
      // `resetPassword`): no mail token — the server accepts `code: 'id'`
      // plus the userId while the account flag is set.
      { path: 'reset/:email/id/:userId', component: RecoverPasswordPage },
      { path: S.verifyEmail, component: VerifyEmailPage },
    ],
  },
];
