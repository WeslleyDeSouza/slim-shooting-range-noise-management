import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { map } from 'rxjs';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { APP_ROUTES } from '@slim/shared';
import { StatusPillComponent } from '../../../../common/status-pill.component';
import { AreaFacade } from '../../../../core/area/area.facade';

/**
 * Context of one Schiessplatz (`/admin/area/:id/*`, mocks `_mocks/area/*`):
 * back link, area switcher, traffic lights and the sub-navigation
 * Übersicht · Schusszahlen · Details · Simulation; the pages render in the
 * outlet. The area comes from the AreaFacade (list already loaded by the
 * overview, else fetched here).
 */
@Component({
  selector: 'app-area-context',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, StatusPillComponent],
  styleUrl: './area-context.component.scss',
  template: `
    <div class="area-ctx">
      <div class="area-ctx__bar">
        <a class="area-ctx__back" [routerLink]="routes.admin.area.root">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 2.5L4.5 8l5.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ 'context.all_areas' | translate }}
        </a>

        <div class="area-ctx__area slim-dropdown" [class.slim-dropdown--open]="switcherOpen()">
          <button
            type="button"
            class="area-ctx__switch"
            [attr.aria-expanded]="switcherOpen()"
            [attr.title]="'context.switch' | translate"
            (click)="switcherOpen.set(!switcherOpen())"
          >
            <span class="area-ctx__no">{{ area()?.coordinationSectionNo ?? '…' }}</span>
            <span class="area-ctx__name">{{ area()?.name ?? '' }}</span>
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
            </svg>
          </button>
          @if (switcherOpen()) {
            <div class="slim-menu area-ctx__menu" role="menu">
              @for (a of areas(); track a.id) {
                <a
                  class="slim-menu__item"
                  role="menuitem"
                  [class.slim-menu__item--active]="a.id === areaId()"
                  [routerLink]="sibling(a.id)"
                  (click)="switcherOpen.set(false)"
                >
                  <span class="area-ctx__no">{{ a.coordinationSectionNo }}</span>
                  {{ a.name }}
                </a>
              }
            </div>
          }
        </div>

        @if (area(); as a) {
          <div class="area-ctx__status">
            <app-status-pill [status]="a.quotaStatus" />
            <app-status-pill [status]="a.noiseStatus" />
          </div>
        }
      </div>

      <nav class="slim-subnav area-ctx__nav" [attr.aria-label]="'context.nav' | translate">
        @for (tab of tabs(); track tab.key) {
          <a
            class="slim-subnav__tab"
            [routerLink]="tab.link"
            routerLinkActive="slim-subnav__tab--active"
            [attr.data-testid]="'area-tab-' + tab.id"
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path [attr.d]="tab.icon" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>{{ tab.key | translate }}</span>
          </a>
        }
      </nav>

      @if (error()) {
        <div class="slim-alert slim-alert--danger slim-u-mb-4">
          <div class="slim-alert__body">{{ error() | translate }}</div>
        </div>
      }

      <router-outlet />
    </div>
  `,
  host: { '(document:click)': 'onDocumentClick($event)' },
})
export class AreaContextComponent extends ComponentBase {
  private readonly facade = inject(AreaFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly routes = APP_ROUTES;
  protected readonly switcherOpen = signal(false);

  readonly areaId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('id') ?? '',
  });

  protected readonly areas = this.facade.areas;
  protected readonly error = this.facade.error;
  readonly area = computed(() => this.facade.areas().find((a) => a.id === this.areaId()) ?? null);

  protected readonly tabs = computed(() => {
    const id = this.areaId();
    return [
      { id: 'overview', key: 'menu.area_overview', link: APP_ROUTES.admin.area.overview(id), icon: ICON.home },
      { id: 'shots', key: 'menu.area_shots', link: APP_ROUTES.admin.area.shots(id), icon: ICON.target },
      { id: 'details', key: 'menu.area_details', link: APP_ROUTES.admin.area.details(id), icon: ICON.info },
      { id: 'simulation', key: 'menu.area_simulation', link: APP_ROUTES.admin.area.simulation(id), icon: ICON.chart },
    ];
  });

  /** Same page for another area (`/admin/area/<other>/<current tab>`). */
  protected sibling(otherId: string): string {
    const current = this.router.url.split('?')[0];
    const tab = current.split('/').pop() ?? 'overview';
    return `${APP_ROUTES.admin.area.root}/${otherId}/${tab}`;
  }

  protected onDocumentClick(event: Event): void {
    if (!this.switcherOpen()) return;
    if (!(event.target as HTMLElement).closest('.area-ctx__area')) this.switcherOpen.set(false);
  }

  /** ComponentBase: on init and on every DATA_RELOAD (e.g. tenant switch). */
  override getData(): void {
    if (!this.facade.loaded()) void this.facade.load();
  }
}

const ICON = {
  home: 'M2 7.5L8 2.5l6 5V13a1 1 0 01-1 1h-3.5v-4h-3v4H3a1 1 0 01-1-1V7.5z',
  target: 'M8 2a6 6 0 100 12A6 6 0 008 2zm0 3a3 3 0 100 6 3 3 0 000-6z',
  info: 'M8 1.7a6.3 6.3 0 100 12.6A6.3 6.3 0 008 1.7zM8 7.2v4M8 5v.2',
  chart: 'M2 12l4-5 3 3 5-6',
} as const;
