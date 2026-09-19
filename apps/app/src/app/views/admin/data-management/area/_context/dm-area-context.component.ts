import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { APP_ROUTES, ROUTE_SEGMENT } from '@slim/shared';
import type { AreaResultDto } from '@ui-slim/apiClient';
import { AreaFacade } from '../../../../../core/area/area.facade';
import { areaIdSignal } from './area-id';

const I18N = 'admin.dm_area_ctx';

/**
 * Context of one Schiessplatz inside Datenverwaltung › Schiessplatz
 * (B1 Abbildungen 26/27, «Schiessplatz-Leiste»): breadcrumbs, the way back
 * to «Schiessplätze verwalten» (5.14), a switcher with search over
 * Bezeichnung / Koordinationsabschnitts-Nr. / Sachplan-Nr., the Aktiv badge
 * and the sub-navigation Allgemein (5.15/5.16) · Zuordnung Waffen (5.17) ·
 * Berechnungen (5.18). The pages render in the outlet and read `:areaId`
 * from this route.
 */
@Component({
  selector: 'app-dm-area-context',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  styleUrl: './dm-area-context.component.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeSwitcher()',
  },
  template: `
    <div class="dmc">
      <ol class="slim-breadcrumbs dmc__crumbs">
        <li class="slim-breadcrumbs__item">
          <a [routerLink]="routes.admin.home">{{ 'shell.home' | translate }}</a>
        </li>
        <li class="slim-breadcrumbs__item">
          <a [routerLink]="routes.admin.dataManagement.root">{{ 'menu.data_management' | translate }}</a>
        </li>
        <li class="slim-breadcrumbs__item">
          <a [routerLink]="routes.admin.dataManagement.area.overview">{{ 'menu.area' | translate }}</a>
        </li>
        <li class="slim-breadcrumbs__item slim-breadcrumbs__item--current" data-testid="dmc-crumb-area">
          {{ label() || '…' }}
        </li>
      </ol>

      <div class="dmc__bar">
        <a class="dmc__back" [routerLink]="routes.admin.dataManagement.area.overview" data-testid="dmc-back">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 2.5L4.5 8l5.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ prefix + '.back' | translate }}
        </a>

        <div class="dmc__area slim-dropdown" [class.slim-dropdown--open]="switcherOpen()">
          <button
            type="button"
            class="dmc__switch"
            [attr.aria-expanded]="switcherOpen()"
            [attr.aria-haspopup]="'listbox'"
            [attr.title]="prefix + '.switch' | translate"
            data-testid="dmc-switch"
            (click)="toggleSwitcher()"
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.6" />
              <path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
            <span class="dmc__no">{{ area()?.coordinationSectionNo ?? '…' }}</span>
            <span class="dmc__name">{{ area()?.name ?? '' }}</span>
            <small class="dmc__hint">· {{ prefix + '.switch_short' | translate }}</small>
            <svg class="dmc__chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
            </svg>
          </button>
          @if (switcherOpen()) {
            <div class="slim-menu dmc__menu" role="listbox" data-testid="dmc-switch-panel">
              <div class="slim-search dmc__search">
                <svg class="slim-search__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.6" />
                  <path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.6" />
                </svg>
                <input
                  #search
                  class="slim-search__input"
                  type="search"
                  autocomplete="off"
                  [placeholder]="prefix + '.search' | translate"
                  [attr.aria-label]="prefix + '.search' | translate"
                  [value]="query()"
                  (input)="query.set($any($event.target).value)"
                  data-testid="dmc-switch-search"
                />
              </div>
              @for (a of matches(); track a.id) {
                <a
                  class="slim-menu__item"
                  role="option"
                  [class.slim-menu__item--active]="a.id === areaId()"
                  [attr.aria-selected]="a.id === areaId()"
                  [routerLink]="sibling(a.id)"
                  [attr.data-testid]="'dmc-switch-item-' + a.id"
                  (click)="closeSwitcher()"
                >
                  <span class="dmc__no">{{ a.coordinationSectionNo }}</span>
                  <span class="dmc__item-name">{{ a.name }}</span>
                  @if (!a.enabled) {
                    <span class="slim-badge dmc__item-badge">{{ 'admin.dm_area.inactive' | translate }}</span>
                  }
                </a>
              } @empty {
                <div class="slim-menu__heading dmc__empty">{{ prefix + '.no_match' | translate }}</div>
              }
            </div>
          }
        </div>

        @if (area(); as a) {
          <span
            class="slim-badge dmc__state"
            [class.slim-badge--success]="a.enabled"
            data-testid="dmc-state"
            >{{ 'admin.dm_area.' + (a.enabled ? 'active' : 'inactive') | translate }}</span
          >
        }
      </div>

      <nav class="slim-subnav dmc__nav" [attr.aria-label]="prefix + '.nav' | translate">
        @for (tab of tabs(); track tab.id) {
          <a
            class="slim-subnav__tab"
            [routerLink]="tab.link"
            routerLinkActive="slim-subnav__tab--active"
            [attr.data-testid]="'dmc-tab-' + tab.id"
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path [attr.d]="tab.icon" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>{{ tab.key | translate }}</span>
          </a>
        }
      </nav>

      @if (error(); as message) {
        <div class="slim-alert slim-alert--danger slim-u-mb-4">
          <div class="slim-alert__body">{{ message | translate }}</div>
        </div>
      }

      <router-outlet />
    </div>
  `,
})
export class DmAreaContextComponent extends ComponentBase {
  private readonly facade = inject(AreaFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('search');

  protected readonly prefix = I18N;
  protected readonly routes = APP_ROUTES;
  protected readonly switcherOpen = signal(false);
  protected readonly query = signal('');

  readonly areaId = areaIdSignal(this.route);
  protected readonly areas = this.facade.areas;
  protected readonly error = this.facade.error;
  readonly area = computed<AreaResultDto | null>(() => this.areas().find((a) => a.id === this.areaId()) ?? null);
  protected readonly label = computed(() => {
    const a = this.area();
    return a ? `${a.coordinationSectionNo} ${a.name}` : '';
  });

  /** Search over Bezeichnung, Koordinationsabschnitts-Nr. and Sachplan-Nr. (B1 Abbildung 26 «wechseln»). */
  protected readonly matches = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.areas().filter(
      (a) =>
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.coordinationSectionNo.toLowerCase().includes(q) ||
        (a.sectoralPlanNo ?? '').toLowerCase().includes(q),
    );
  });

  protected readonly tabs = computed(() => {
    const id = this.areaId();
    return [
      { id: 'general', key: 'menu.area_general', link: APP_ROUTES.admin.dataManagement.area.generalOf(id), icon: ICON.layers },
      { id: 'weapons', key: 'menu.area_weapon_assignment', link: APP_ROUTES.admin.dataManagement.area.weaponAssignmentOf(id), icon: ICON.weapon },
      { id: 'calculations', key: 'menu.calculations', link: APP_ROUTES.admin.dataManagement.area.calculationsOf(id), icon: ICON.list },
    ];
  });

  /** Same sub page for another Schiessplatz (`…/area/<other>/<rest of the current path>`). */
  protected sibling(otherId: string): string {
    const current = this.router.url.split('?')[0];
    const marker = `/${ROUTE_SEGMENT.area}/${this.areaId()}`;
    const at = current.indexOf(marker);
    const rest = at >= 0 ? current.slice(at + marker.length) : `/${ROUTE_SEGMENT.general}/${ROUTE_SEGMENT.overview}`;
    return `${APP_ROUTES.admin.dataManagement.area.root}/${otherId}${rest}`;
  }

  protected toggleSwitcher(): void {
    this.switcherOpen.update((open) => !open);
    if (this.switcherOpen()) {
      this.query.set('');
      setTimeout(() => this.searchInput()?.nativeElement.focus());
    }
  }

  protected closeSwitcher(): void {
    this.switcherOpen.set(false);
  }

  protected onDocumentClick(event: Event): void {
    if (!this.switcherOpen()) return;
    if (!(event.target as HTMLElement).closest('.dmc__area')) this.switcherOpen.set(false);
  }

  /** ComponentBase: on init and on every DATA_RELOAD (tenant switch); the facade skips a call in flight. */
  override getData(): void {
    void this.facade.load();
  }
}

const ICON = {
  layers: 'M2 5l4-2 4 2 4-2v9l-4 2-4-2-4 2V5zM6 3v9M10 5v9',
  weapon: 'M2 10h9l3-3M6 10v3M9 10v3',
  list: 'M3 3h10M3 8h10M3 13h10M6 1.5v3M10 6.5v3M5 11.5v3',
} as const;
