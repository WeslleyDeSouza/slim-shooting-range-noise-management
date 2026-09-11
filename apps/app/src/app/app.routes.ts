import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./views/home/home.component').then((c) => c.HomeComponent),
  },
  {
    // Catch-all: unknown URLs render the 404 page instead of a blank screen.
    path: '**',
    loadComponent: () =>
      import('./views/404/404.component').then((c) => c.Error404Component),
  },
];
