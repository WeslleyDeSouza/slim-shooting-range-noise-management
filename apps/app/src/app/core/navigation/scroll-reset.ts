import { DOCUMENT } from '@angular/common';
import { EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';
import { Router, Scroll } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Every navigation starts at the top of the page — instantly.
 *
 * The router does this itself (`withInMemoryScrolling({ scrollPositionRestoration: 'top' })`),
 * but for a normal navigation it calls `scrollTo` without `behavior: 'instant'`, so the
 * `scroll-behavior: smooth` of the design-system reset animates the way up — and the view
 * transition (`withViewTransitions`) running at the same time cuts that animation short: the
 * new page appears where the old one was scrolled to. This jumps to the top at once; the
 * smooth behaviour stays for what should glide: fragments (`anchorScrolling`, help topics).
 *
 * Back/forward (the router restores the position) and fragment links are left to the router;
 * so is a navigation with `scroll: 'manual'`.
 */
export function provideScrollReset(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const router = inject(Router);
    const window = inject(DOCUMENT).defaultView;
    router.events
      .pipe(filter((event): event is Scroll => event instanceof Scroll))
      .subscribe((event) => {
        if (event.position || event.anchor || event.scrollBehavior === 'manual') return;
        window?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      });
  });
}
