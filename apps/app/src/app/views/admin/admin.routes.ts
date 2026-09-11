import type { Route, Routes } from '@angular/router';
import { LocaleResolver } from '@app-galaxy/translate-ui';
import { ROUTE_SEGMENT as S } from '@slim/shared';
import { PlaceholderData } from './_placeholder/placeholder.component';

const placeholder = (path: string, data: PlaceholderData): Route => ({
  path,
  data,
  loadComponent: () =>
    import('./_placeholder/placeholder.component').then(
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
          placeholder(`:id/${S.overview}`, {
            title: 'menu.area_overview',
            crumbs: ['menu.areas'],
          }),
          placeholder(`:id/${S.shots}`, {
            title: 'menu.area_shots',
            crumbs: ['menu.areas'],
          }),
          placeholder(`:id/${S.details}`, {
            title: 'menu.area_details',
            crumbs: ['menu.areas'],
          }),
          placeholder(`:id/${S.simulation}`, {
            title: 'menu.area_simulation',
            crumbs: ['menu.areas'],
          }),
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
          placeholder(S.users, { title: 'menu.users', crumbs: DM }),
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
