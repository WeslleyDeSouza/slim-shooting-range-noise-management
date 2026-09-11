import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthSessionService } from '@app-galaxy/auth-ui';
import { LocaleResolver } from '@app-galaxy/translate-ui';
import { APP_ROUTES, ROUTE_SEGMENT as S } from '@slim/shared';

/**
 * Everything under /admin needs a valid stored session; otherwise back to
 * the login with the requested page as returnUrl (ELO / alco-map pattern).
 */
export const adminGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  const session = inject(AuthSessionService);
  if (!session.isStoredSessionValid()) {
    const target =
      state?.url && state.url.startsWith(APP_ROUTES.admin.root)
        ? state.url
        : APP_ROUTES.admin.root;
    return router.createUrlTree([APP_ROUTES.auth.login], {
      queryParams: { returnUrl: target },
    });
  }
  return true;
};

/**
 * Top-level routes (segments from `ROUTE_SEGMENT`, @slim/shared):
 *   /auth/*      public auth pages (views/auth, app-auth-layout)
 *   /admin/*     everything behind the login (views/admin, app-admin-layout)
 *   /styleguide  living styleguide of the design system (development)
 * The route tree of /admin follows docs/architecture/sitemap.md.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: S.admin },
  {
    path: S.auth,
    data: { path: 'auth' },
    resolve: LocaleResolver.default,
    loadChildren: () =>
      import('./views/auth').then((mod) => mod.AUTH_REDESIGN_ROUTES),
  },
  {
    path: S.admin,
    data: { path: 'common' },
    resolve: LocaleResolver.default,
    canActivate: [adminGuard],
    loadChildren: () => import('./views/admin').then((mod) => mod.ADMIN_ROUTES),
  },
  {
    path: S.styleguide,
    loadComponent: () =>
      import('./views/styleguide/styleguide.component').then(
        (c) => c.StyleguideComponent,
      ),
  },
  {
    path: '**',
    data: { path: 'common' },
    resolve: LocaleResolver.default,
    loadComponent: () =>
      import('./views/404/404.component').then((c) => c.Error404Component),
  },
];
