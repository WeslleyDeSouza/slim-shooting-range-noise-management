import { Routes } from '@angular/router';
import { LocaleResolver } from '@app-galaxy/translate-ui';
import { PlaceholderData } from './views/placeholder/placeholder.component';

const placeholder = (
  path: string,
  data: PlaceholderData,
  children: Routes = [],
) => ({
  path,
  data,
  loadComponent: () =>
    import('./views/placeholder/placeholder.component').then(
      (c) => c.PlaceholderComponent,
    ),
  children,
});

/**
 * Route tree = docs/architecture/sitemap.md. Feature areas are lazy and load
 * their own locale section (`data.path` = section name, see
 * apps/app/public/assets/locales/<lang>/<section>.locale.json). Areas that
 * are not built yet render the placeholder so navigation and breadcrumbs
 * already work.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./views/shell/app-shell.component').then((c) => c.AppShellComponent),
    children: [
      // Home ---------------------------------------------------------------
      {
        path: '',
        pathMatch: 'full',
        data: { path: 'home' },
        resolve: LocaleResolver.default,
        loadComponent: () =>
          import('./views/home/home.component').then((c) => c.HomeComponent),
      },

      // Übersicht Schiessplätze -------------------------------------------
      {
        path: 'schiessplaetze',
        data: { path: 'ranges' },
        resolve: LocaleResolver.default,
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./views/ranges/ranges-overview.component').then(
                (c) => c.RangesOverviewComponent,
              ),
          },
          placeholder(':id/uebersicht', { title: 'menu.range_overview', crumbs: ['menu.ranges'] }),
          placeholder(':id/schusszahlen', { title: 'menu.range_shots', crumbs: ['menu.ranges'] }),
          placeholder(':id/details', { title: 'menu.range_details', crumbs: ['menu.ranges'] }),
          placeholder(':id/simulation', { title: 'menu.range_simulation', crumbs: ['menu.ranges'] }),
        ],
      },

      // Datenverwaltung ----------------------------------------------------
      {
        path: 'admin',
        data: { path: 'common' },
        resolve: LocaleResolver.default,
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'schiessplatz' },
          // Schiessplatz
          { path: 'schiessplatz', pathMatch: 'full', redirectTo: 'schiessplatz/uebersicht' },
          placeholder('schiessplatz/uebersicht', { title: 'menu.range_overview', crumbs: ['menu.data_management', 'menu.range', 'menu.range_general'] }),
          placeholder('schiessplatz/stammdaten', { title: 'menu.range_master_data', crumbs: ['menu.data_management', 'menu.range', 'menu.range_general'] }),
          placeholder('schiessplatz/zuordnung-waffen', { title: 'menu.range_weapon_assignment', crumbs: ['menu.data_management', 'menu.range', 'menu.range_general'] }),
          { path: 'schiessplatz/berechnungen', pathMatch: 'full', redirectTo: 'schiessplatz/berechnungen/uebersicht' },
          placeholder('schiessplatz/berechnungen/uebersicht', { title: 'menu.calculations_overview', crumbs: ['menu.data_management', 'menu.range', 'menu.calculations'] }),
          placeholder('schiessplatz/berechnungen/import', { title: 'menu.calculations_import', crumbs: ['menu.data_management', 'menu.range', 'menu.calculations'] }),
          placeholder('schiessplatz/berechnungen/export', { title: 'menu.calculations_export', crumbs: ['menu.data_management', 'menu.range', 'menu.calculations'] }),
          placeholder('schiessplatz/berechnungen/details', { title: 'menu.calculations_details', crumbs: ['menu.data_management', 'menu.range', 'menu.calculations'] }),
          // Waffen
          { path: 'waffen', pathMatch: 'full', redirectTo: 'waffen/waffe' },
          placeholder('waffen/kaliber', { title: 'menu.caliber', crumbs: ['menu.data_management', 'menu.weapons', 'menu.caliber_weapon'] }),
          placeholder('waffen/waffe', { title: 'menu.weapon', crumbs: ['menu.data_management', 'menu.weapons', 'menu.caliber_weapon'] }),
          placeholder('waffen/waffenkategorie', { title: 'menu.weapon_category', crumbs: ['menu.data_management', 'menu.weapons', 'menu.caliber_weapon'] }),
          // Benutzer, MGDM, System
          placeholder('benutzer', { title: 'menu.users', crumbs: ['menu.data_management'] }),
          placeholder('mgdm-export', { title: 'menu.mgdm_export', crumbs: ['menu.data_management'] }),
          placeholder('system', { title: 'menu.system_settings', crumbs: ['menu.data_management'] }),
        ],
      },

      // Catch-all: unknown URLs render the 404 page instead of a blank screen.
      {
        path: '**',
        loadComponent: () =>
          import('./views/404/404.component').then((c) => c.Error404Component),
      },
    ],
  },
  {
    // Living styleguide of the design system (libs/app/design-system), own shell.
    path: 'styleguide',
    loadComponent: () =>
      import('./views/styleguide/styleguide.component').then(
        (c) => c.StyleguideComponent,
      ),
  },
];
