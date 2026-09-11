import type { Route, Routes } from '@angular/router';
import { LocaleResolver } from '@app-galaxy/translate-ui';
import { ROUTE_SEGMENT as S } from '@slim/shared';
import { PlaceholderData } from './_components/placeholder.component';
import { AppsFacade } from './user-management/apps/_data/apps.facade';
import { EloAppsOverviewComponent } from './user-management/apps/apps-overview.component';
import { EloAppFormComponent } from './user-management/apps/form/app-form.component';
import { RolesFacade } from './user-management/roles/_data/roles.facade';
import { EloRolesOverviewComponent } from './user-management/roles/roles-overview.component';
import { EloRoleFormComponent } from './user-management/roles/form/role-form.component';
import { LogsFacade } from './logs/_data/logs.facade';
import { UsersFacade } from './user-management/users/_data/users.facade';
import { EloUsersOverviewComponent } from './user-management/users/users-overview.component';
import { EloUserFormComponent } from './user-management/users/form/user-form.component';

const placeholder = (path: string, data: PlaceholderData): Route => ({
  path,
  data,
  loadComponent: () =>
    import('./_components/placeholder.component').then(
      (c) => c.PlaceholderComponent,
    ),
});

const DM = ['menu.data_management'];
const DM_AREA = [...DM, 'menu.area', 'menu.area_general'];
const DM_CALC = [...DM, 'menu.area', 'menu.calculations'];
const DM_WEAPONS = [...DM, 'menu.weapons', 'menu.caliber_weapon'];

/**
 * Pages behind the login (mounted at /admin by app.routes.ts, guarded there).
 * Segments come from `ROUTE_SEGMENT` (@slim/shared) so router, links and the
 * API app catalogue agree; tree = docs/architecture/sitemap.md. Feature
 * areas are lazy and load their own locale section (`data.path`). Entries
 * that are not built yet render the placeholder so navigation and
 * breadcrumbs already work.
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./_layout/admin-layout.component').then(
        (c) => c.AdminLayoutComponent,
      ),
    children: [
      // Home ---------------------------------------------------------------
      {
        path: '',
        pathMatch: 'full',
        data: { path: 'home' },
        resolve: LocaleResolver.default,
        loadComponent: () =>
          import('./home/home.component').then((c) => c.HomeComponent),
      },

      // Übersicht Schiessplätze -------------------------------------------
      {
        path: S.area,
        data: { path: 'area' },
        resolve: LocaleResolver.default,
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./area/area-overview.component').then(
                (c) => c.AreaOverviewComponent,
              ),
          },
          // One Schiessplatz: context bar (switcher, traffic lights, tabs)
          // around the pages of the mocks _mocks/area/*.
          {
            path: ':id',
            loadComponent: () =>
              import('./area/_context/area-context.component').then(
                (c) => c.AreaContextComponent,
              ),
            children: [
              { path: '', pathMatch: 'full', redirectTo: S.overview },
              placeholder(S.overview, {
                title: 'menu.area_overview',
                crumbs: ['menu.areas'],
              }),
              {
                path: S.shots,
                loadComponent: () =>
                  import('./area/shots/area-shots.component').then(
                    (c) => c.AreaShotsComponent,
                  ),
              },
              {
                path: S.details,
                loadComponent: () =>
                  import('./area/details/area-details.component').then(
                    (c) => c.AreaDetailsComponent,
                  ),
              },
              {
                path: S.simulation,
                loadComponent: () =>
                  import('./area/simulation/area-simulation.component').then(
                    (c) => c.AreaSimulationComponent,
                  ),
              },
            ],
          },
        ],
      },

      // Datenverwaltung ----------------------------------------------------
      {
        path: S.dataManagement,
        children: [
          { path: '', pathMatch: 'full', redirectTo: S.area },
          // Schiessplatz › Allgemein
          {
            path: S.area,
            pathMatch: 'full',
            redirectTo: `${S.area}/${S.overview}`,
          },
          placeholder(`${S.area}/${S.overview}`, {
            title: 'menu.area_overview',
            crumbs: DM_AREA,
          }),
          placeholder(`${S.area}/${S.masterData}`, {
            title: 'menu.area_master_data',
            crumbs: DM_AREA,
          }),
          placeholder(`${S.area}/${S.weaponAssignment}`, {
            title: 'menu.area_weapon_assignment',
            crumbs: DM_AREA,
          }),
          // Schiessplatz › Berechnungen
          {
            path: `${S.area}/${S.calculations}`,
            pathMatch: 'full',
            redirectTo: `${S.area}/${S.calculations}/${S.overview}`,
          },
          placeholder(`${S.area}/${S.calculations}/${S.overview}`, {
            title: 'menu.calculations_overview',
            crumbs: DM_CALC,
          }),
          placeholder(`${S.area}/${S.calculations}/${S.import}`, {
            title: 'menu.calculations_import',
            crumbs: DM_CALC,
          }),
          placeholder(`${S.area}/${S.calculations}/${S.export}`, {
            title: 'menu.calculations_export',
            crumbs: DM_CALC,
          }),
          placeholder(`${S.area}/${S.calculations}/${S.details}`, {
            title: 'menu.calculations_details',
            crumbs: DM_CALC,
          }),
          // Waffen
          {
            path: S.weapons,
            pathMatch: 'full',
            redirectTo: `${S.weapons}/${S.weapon}`,
          },
          placeholder(`${S.weapons}/${S.caliber}`, {
            title: 'menu.caliber',
            crumbs: DM_WEAPONS,
          }),
          placeholder(`${S.weapons}/${S.weapon}`, {
            title: 'menu.weapon',
            crumbs: DM_WEAPONS,
          }),
          placeholder(`${S.weapons}/${S.weaponCategory}`, {
            title: 'menu.weapon_category',
            crumbs: DM_WEAPONS,
          }),
          // Benutzer, MGDM, System
          // Benutzerverwaltung (5.26): users, roles and the app catalogue —
          // ELO's native screens over the galaxy admin API (views/admin/user-management).
          {
            path: S.users,
            data: { path: 'admin' },
            resolve: LocaleResolver.default,
            providers: [UsersFacade],
            children: [
              { path: '', component: EloUsersOverviewComponent },
              { path: S.create, component: EloUserFormComponent },
              { path: `${S.edit}/:id`, component: EloUserFormComponent },
            ],
          },
          {
            path: S.roles,
            data: { path: 'admin' },
            resolve: LocaleResolver.default,
            providers: [RolesFacade],
            children: [
              { path: '', component: EloRolesOverviewComponent },
              { path: S.create, component: EloRoleFormComponent },
              { path: `${S.edit}/:id`, component: EloRoleFormComponent },
            ],
          },
          {
            path: S.apps,
            data: { path: 'admin' },
            resolve: LocaleResolver.default,
            providers: [AppsFacade],
            children: [
              { path: '', component: EloAppsOverviewComponent },
              { path: S.create, component: EloAppFormComponent },
              { path: `${S.edit}/:id`, component: EloAppFormComponent },
            ],
          },
          // Logbuch (slm 56): the tenant's audit log (views/admin/logs).
          {
            path: S.logs,
            data: { path: 'admin' },
            resolve: LocaleResolver.default,
            providers: [LogsFacade],
            loadComponent: () => import('./logs/logs.component').then((c) => c.AppLogsComponent),
          },
          placeholder(S.mgdmExport, { title: 'menu.mgdm_export', crumbs: DM }),
          placeholder(S.system, { title: 'menu.system_settings', crumbs: DM }),
        ],
      },

      // Catch-all inside the layout
      {
        path: '**',
        loadComponent: () =>
          import('../404/404.component').then((c) => c.Error404Component),
      },
    ],
  },
];
