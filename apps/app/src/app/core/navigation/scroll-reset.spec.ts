import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  RouterOutlet,
  withDisabledInitialNavigation,
  withInMemoryScrolling,
} from '@angular/router';

import { provideScrollReset } from './scroll-reset';

@Component({ template: '' })
class PageComponent {}

@Component({ selector: 'app-scroll-reset-root', imports: [RouterOutlet], template: '<router-outlet />' })
class RootComponent {}

/** The router emits its `Scroll` event a tick after `NavigationEnd` (setTimeout / rAF). */
const scrollTick = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('provideScrollReset', () => {
  let scrollTo: jest.Mock;
  let router: Router;
  let host: HTMLElement;

  beforeEach(() => {
    scrollTo = jest.fn();
    Object.defineProperty(window, 'scrollTo', { value: scrollTo, writable: true, configurable: true });
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'a', component: PageComponent },
            { path: 'b', component: PageComponent },
          ],
          withDisabledInitialNavigation(),
          withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
        ),
        provideScrollReset(),
      ],
    });
    // The router starts its scroller only once an application is bootstrapped (bootstrap listener).
    host = document.createElement('app-scroll-reset-root');
    document.body.appendChild(host);
    TestBed.inject(ApplicationRef).bootstrap(RootComponent);
    router = TestBed.inject(Router);
  });

  afterEach(() => host.remove());

  it('jumps to the top instantly after a navigation', async () => {
    await router.navigateByUrl('/a');
    await scrollTick();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
  });

  it('leaves a navigation with a fragment to the router (anchor scrolling)', async () => {
    await router.navigateByUrl('/a');
    await scrollTick();
    scrollTo.mockClear();
    await router.navigateByUrl('/b#topic');
    await scrollTick();
    expect(scrollTo).not.toHaveBeenCalledWith(expect.objectContaining({ behavior: 'instant' }));
  });
});
