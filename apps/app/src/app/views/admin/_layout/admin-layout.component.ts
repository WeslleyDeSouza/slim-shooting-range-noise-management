import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import { SlimThemeToggleComponent } from '@ui-slim/design-system';
import { APP_ROUTES, GALAXY_APP_ID, ROUTE_SEGMENT, SLIM_APP_ID } from '@slim/shared';
import type { AreaResultDto } from '@ui-slim/apiClient';
import { LanguageSwitchComponent } from '../../../common/language-switch.component';
import { AccessFacade } from '../../../core/access/access.facade';
import { AreaSwitcherComponent } from './area-switcher.component';
import { AreaFacade } from '../../../core/area/area.facade';
import { AuthFacade } from '../../auth/auth.facade';
import { resetWelcome } from '../home/welcome-dialog.component';

interface NavItem {
  key: string;
  link: string;
  icon: string;
  exact?: boolean;
  /** App the entry needs a right for (B1 8.1.2); entries without one are always shown. */
  app?: number;
}

/** One page of a Schiessplatz (link takes the area id). */
interface AreaPage {
  id: string;
  key: string;
  link: (id: string) => string;
  icon: string;
  app?: number;
}

/**
 * Application shell for everything behind the login (mock
 * `_mocks/home/index.html`, ELO admin-shell pattern): topbar with brand,
 * organisation, language, theme, main menu and account menu; sidebar on
 * desktop, tabbar on phones; routed content in the middle. Navigation
 * follows docs/architecture/sitemap.md.
 */
@Component({
  selector: 'app-admin-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslatePipe,
    SlimThemeToggleComponent,
    LanguageSwitchComponent,
    AreaSwitcherComponent,
  ],
  host: { '(document:click)': 'onDocumentClick($event)' },
  template: `
    <div class="slim-shell">
      <!-- Topbar: general controls ------------------------------------ -->
      <header class="slim-topbar slim-shell__topbar">
        <a
          class="slim-topbar__brand slim-u-mobile-only"
          [routerLink]="routes.admin.home"
          [attr.title]="'shell.home' | translate"
        >
          <span class="slim-topbar__mark" aria-hidden="true"></span>
          <span class="slim-topbar__brand-text">
            <b
              >{{ 'app.title' | translate }}
              <span class="slim-badge slim-badge--outline admin-layout__demo" data-testid="shell-demo">{{ 'shell.demo' | translate }}</span></b
            >
            <span>{{ 'app.subtitle' | translate }}</span>
          </span>
        </a>
        <div class="slim-topbar__org">
          <b>{{ 'shell.org' | translate }}</b
          >{{ 'shell.org_sub' | translate }}
        </div>

        <div class="slim-topbar__actions">
          <span class="slim-u-desktop-only"><app-language-switch /></span>
          <slim-theme-toggle />

          <div
            class="slim-dropdown"
            [class.slim-dropdown--open]="openMenu() === 'main'"
          >
            <button
              type="button"
              class="slim-topbar__iconbtn"
              [attr.aria-label]="'shell.main_menu' | translate"
              [attr.aria-expanded]="openMenu() === 'main'"
              (click)="toggle('main')"
            >
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M2 4h12M2 8h12M2 12h12"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
              </svg>
            </button>
            <div class="slim-dropdown__panel">
              <div class="slim-menu">
                <div class="slim-menu__heading">
                  {{ 'shell.help' | translate }}
                </div>
                <button type="button" class="slim-menu__item">
                  <svg
                    class="slim-menu__icon"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M3.5 2.5h7l2 2v9h-9v-11z"
                      stroke="currentColor"
                      stroke-width="1.4"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M6 8h4M6 10.5h4"
                      stroke="currentColor"
                      stroke-width="1.4"
                      stroke-linecap="round"
                    />
                  </svg>
                  <span class="admin-layout__menu-text"
                    >{{ 'shell.manual' | translate
                    }}<small>{{ 'shell.manual_sub' | translate }}</small></span
                  >
                </button>
                <button type="button" class="slim-menu__item">
                  <svg
                    class="slim-menu__icon"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="8"
                      cy="5.5"
                      r="2.6"
                      stroke="currentColor"
                      stroke-width="1.4"
                    />
                    <path
                      d="M2.8 13.5c.5-2.6 2.6-4 5.2-4s4.7 1.4 5.2 4"
                      stroke="currentColor"
                      stroke-width="1.4"
                      stroke-linecap="round"
                    />
                  </svg>
                  <span class="admin-layout__menu-text"
                    >{{ 'shell.specialist' | translate
                    }}<small>{{
                      'shell.specialist_sub' | translate
                    }}</small></span
                  >
                </button>
                <button type="button" class="slim-menu__item">
                  <svg
                    class="slim-menu__icon"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <rect
                      x="2"
                      y="3"
                      width="12"
                      height="10"
                      rx="1.5"
                      stroke="currentColor"
                      stroke-width="1.4"
                    />
                    <path
                      d="M2 6l6 3.5L14 6"
                      stroke="currentColor"
                      stroke-width="1.4"
                    />
                  </svg>
                  <span class="admin-layout__menu-text"
                    >{{ 'shell.sysadmin' | translate
                    }}<small>slim-support&#64;example.admin.ch</small></span
                  >
                </button>
                <div class="slim-menu__divider"></div>
                <div class="slim-menu__heading">
                  {{ 'shell.application' | translate }}
                </div>
                <div class="slim-menu__item admin-layout__menu-static">
                  <svg
                    class="slim-menu__icon"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="8"
                      cy="8"
                      r="6"
                      stroke="currentColor"
                      stroke-width="1.4"
                    />
                    <path
                      d="M8 7v4M8 5v.2"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                    />
                  </svg>
                  <span class="admin-layout__menu-text"
                    >{{ 'shell.version' | translate
                    }}<small>SLIM {{ version }}</small></span
                  >
                </div>
                <div class="slim-menu__divider slim-u-mobile-only"></div>
                <div class="slim-menu__heading slim-u-mobile-only">
                  {{ 'common.language' | translate }}
                </div>
                <div class="admin-layout__menu-lang slim-u-mobile-only">
                  <app-language-switch />
                </div>
              </div>
            </div>
          </div>

          <div
            class="slim-dropdown"
            [class.slim-dropdown--open]="openMenu() === 'user'"
          >
            <button
              type="button"
              class="slim-topbar__user"
              [attr.aria-label]="'shell.account' | translate"
              [attr.aria-expanded]="openMenu() === 'user'"
              (click)="toggle('user')"
            >
              <span class="slim-avatar slim-avatar--sm admin-layout__avatar">{{
                initials()
              }}</span>
              <span class="slim-topbar__user-name">{{ userName() }}</span>
              <svg
                class="slim-u-desktop-only"
                width="11"
                height="11"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 6l5 5 5-5"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                />
              </svg>
            </button>
            <div class="slim-dropdown__panel">
              <div class="slim-menu">
                <div class="slim-menu__heading">
                  {{ 'shell.signed_in_as' | translate }}
                </div>
                <div class="admin-layout__menu-user">
                  <b>{{ userName() }}</b>
                  <span class="slim-text--muted slim-text--xs">
                    @if (tenantName()) {
                      {{ tenantName() }} ·
                    }
                    {{
                      'shell.areas_count' | translate: { n: summary().total }
                    }}
                  </span>
                </div>
                <div class="slim-menu__divider"></div>
                <button type="button" class="slim-menu__item">
                  {{ 'shell.account_overview' | translate }}
                </button>
                <button type="button" class="slim-menu__item">
                  {{ 'shell.settings' | translate }}
                </button>
                <a
                  class="slim-menu__item"
                  [routerLink]="routes.auth.tenantLogin"
                  >{{ 'shell.switch_tenant' | translate }}</a
                >
                <div class="slim-menu__divider"></div>
                <button
                  type="button"
                  class="slim-menu__item slim-menu__item--danger"
                  data-testid="shell-sign-out"
                  (click)="signOut()"
                >
                  {{ 'shell.sign_out' | translate }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- Sidebar (desktop) --------------------------------------------- -->
      <aside class="slim-sidebar slim-shell__sidebar admin-layout__sidebar">
        <a
          class="slim-sidebar__brand admin-layout__brand"
          [routerLink]="routes.admin.home"
          [attr.title]="'shell.home' | translate"
          data-testid="sidebar-brand"
        >
          <span class="slim-topbar__mark" aria-hidden="true"></span>
          <span class="slim-topbar__brand-text admin-layout__brand-text">
            <b
              >{{ 'app.title' | translate }}
              <span class="slim-badge slim-badge--outline admin-layout__demo" data-testid="shell-demo">{{ 'shell.demo' | translate }}</span></b
            >
            <span>{{ 'app.subtitle' | translate }}</span>
          </span>
        </a>
        <nav
          class="slim-sidebar__section"
          [attr.aria-label]="'shell.workspace' | translate"
        >
          <div class="slim-sidebar__heading">
            {{ 'shell.workspace' | translate }}
          </div>
          @for (item of visibleWorkspace(); track item.key) {
            <a
              class="slim-sidebar__link"
              [routerLink]="item.link"
              routerLinkActive="slim-sidebar__link--active"
              [routerLinkActiveOptions]="{ exact: !!item.exact }"
            >
              <svg
                class="slim-sidebar__icon"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  [attr.d]="item.icon"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              {{ item.key | translate }}
            </a>
          }

          <!-- Lesezeichen: Schiessplätze the user starred (per browser and tenant) -->
          @if (canAreas()) {
            <button
              type="button"
              class="admin-layout__sub-toggle"
              [attr.aria-expanded]="bookmarksOpen()"
              (click)="toggleGroup('bookmarks')"
              data-testid="sidebar-bookmarks-toggle"
            >
              <svg class="slim-sidebar__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path [attr.d]="starIcon" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
              </svg>
              <span class="admin-layout__sub-toggle-label">{{ 'shell.bookmarks' | translate }}</span>
              <svg class="admin-layout__chevron" [class.admin-layout__chevron--open]="bookmarksOpen()" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            @if (bookmarksOpen()) {
              @for (a of bookmarkedAreas(); track a.id) {
                <a
                  class="slim-sidebar__link admin-layout__sub"
                  [routerLink]="routes.admin.area.details(a.id)"
                  routerLinkActive="slim-sidebar__link--active"
                  [attr.title]="labelOf(a)"
                  data-testid="sidebar-bookmark"
                >
                  {{ a.name }}
                </a>
              } @empty {
                <p class="admin-layout__group-hint slim-text--muted" data-testid="sidebar-bookmarks-empty">{{ 'shell.bookmarks_empty' | translate }}</p>
              }
            }
          }
        </nav>

        <!-- Schiessplätze: all, pick one (autocomplete), then its four pages -->
        @if (canAreas()) {
          <nav
            class="slim-sidebar__section admin-layout__group"
            [attr.aria-label]="'shell.area_group' | translate"
            data-testid="sidebar-area-group"
          >
            <button
              type="button"
              class="slim-sidebar__heading admin-layout__group-toggle"
              [attr.aria-expanded]="areaGroupOpen()"
              (click)="toggleGroup('areas')"
            >
              <span>{{ 'shell.area_group' | translate }}</span>
              <svg class="admin-layout__chevron" [class.admin-layout__chevron--open]="areaGroupOpen()" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            @if (areaGroupOpen()) {
              <a
                class="slim-sidebar__link"
                [routerLink]="routes.admin.area.root"
                routerLinkActive="slim-sidebar__link--active"
                [routerLinkActiveOptions]="{ exact: true }"
                data-testid="sidebar-areas-all"
              >
                <svg class="slim-sidebar__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path [attr.d]="listIcon" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                {{ 'menu.areas_all' | translate }}
              </a>
              <app-area-switcher
                class="admin-layout__switcher"
                [areas]="areas()"
                [selected]="activeArea()"
                [favoriteIds]="bookmarkIds()"
                (pick)="pickArea($event)"
                (favoriteToggle)="toggleBookmark($event)"
              />
              @if (activeArea(); as a) {
                @for (page of visibleAreaPages(); track page.key) {
                  <a
                    class="slim-sidebar__link admin-layout__sub"
                    [routerLink]="page.link(a.id)"
                    routerLinkActive="slim-sidebar__link--active"
                    [attr.data-testid]="'sidebar-area-' + page.id"
                  >
                    <svg class="slim-sidebar__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path [attr.d]="page.icon" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    {{ page.key | translate }}
                  </a>
                }
              }
            }
          </nav>
        }

        <nav
          class="slim-sidebar__section"
          [attr.aria-label]="'menu.data_management' | translate"
        >
          <button
            type="button"
            class="slim-sidebar__heading admin-layout__group-toggle"
            [attr.aria-expanded]="dataOpen()"
            (click)="toggleGroup('data')"
            data-testid="sidebar-data-toggle"
          >
            <span>{{ 'menu.data_management' | translate }}</span>
            <svg class="admin-layout__chevron" [class.admin-layout__chevron--open]="dataOpen()" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
          </button>
          @if (dataOpen()) {
            @for (item of visibleDataManagement(); track item.key) {
              <a
                class="slim-sidebar__link"
                [routerLink]="item.link"
                routerLinkActive="slim-sidebar__link--active"
              >
                <svg
                  class="slim-sidebar__icon"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    [attr.d]="item.icon"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                {{ item.key | translate }}
              </a>
            }
          }
        </nav>
        @if (visibleUserManagement().length) {
        <nav
          class="slim-sidebar__section"
          [attr.aria-label]="'menu.user_management' | translate"
        >
          <button
            type="button"
            class="slim-sidebar__heading admin-layout__group-toggle"
            [attr.aria-expanded]="usersOpen()"
            (click)="toggleGroup('users')"
            data-testid="sidebar-users-toggle"
          >
            <span>{{ 'menu.user_management' | translate }}</span>
            <svg class="admin-layout__chevron" [class.admin-layout__chevron--open]="usersOpen()" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
          </button>
          @if (usersOpen()) {
            @for (item of visibleUserManagement(); track item.key) {
              <a
                class="slim-sidebar__link"
                [routerLink]="item.link"
                routerLinkActive="slim-sidebar__link--active"
              >
                <svg
                  class="slim-sidebar__icon"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    [attr.d]="item.icon"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                {{ item.key | translate }}
              </a>
            }
          }
        </nav>
        }
        <div class="slim-sidebar__footer slim-text--muted slim-text--xs">
          {{ 'shell.org' | translate }} · SLIM {{ version }}
        </div>
      </aside>

      <!-- Content ------------------------------------------------------- -->
      <main class="slim-shell__main">
        <router-outlet />
      </main>

      <!-- Tabbar (phones) ------------------------------------------------ -->
      <nav
        class="slim-tabbar slim-shell__tabbar"
        [attr.aria-label]="'shell.main_menu' | translate"
      >
        @for (item of visibleTabs(); track item.key) {
          <a
            class="slim-tabbar__item"
            [routerLink]="item.link"
            routerLinkActive="slim-tabbar__item--active"
            [routerLinkActiveOptions]="{ exact: !!item.exact }"
          >
            <svg
              class="slim-tabbar__icon"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                [attr.d]="item.icon"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span class="slim-tabbar__label">{{ item.key | translate }}</span>
          </a>
        }
      </nav>
    </div>
  `,
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent extends ComponentBase {
  private readonly area = inject(AreaFacade);
  private readonly access = inject(AccessFacade);
  private readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly routes = APP_ROUTES;
  protected readonly version = '0.0.1';
  protected readonly summary = this.area.summary;
  protected readonly openMenu = signal<'main' | 'user' | null>(null);

  /** Display name from the galaxy session (first name, else e-mail local part). */
  protected readonly userName = computed(
    () =>
      this.auth.currentUserName() ||
      this.translate.translate('shell.user') ||
      '',
  );
  protected readonly initials = computed(() => initialsOf(this.userName()));
  protected readonly tenantName = computed(() => {
    const tenant = this.auth.currentTenant();
    return tenant ? this.auth.tenantName(tenant) : '';
  });

  /** Arbeitsbereich: Startseite (+ the Lesezeichen block); the Schiessplätze have their own group. */
  protected readonly workspace: NavItem[] = [
    {
      key: 'shell.home',
      link: APP_ROUTES.admin.home,
      exact: true,
      icon: ICON.home,
    },
  ];

  protected readonly dataManagement: NavItem[] = [
    {
      key: 'menu.area',
      link: APP_ROUTES.admin.dataManagement.area.root,
      icon: ICON.database,
      app: SLIM_APP_ID.ADMIN_DATA_AREA,
    },
    {
      key: 'menu.weapons',
      link: APP_ROUTES.admin.dataManagement.weapons.root,
      icon: ICON.weapon,
      app: SLIM_APP_ID.ADMIN_DATA_WEAPONS,
    },
    {
      key: 'menu.mgdm_export',
      link: APP_ROUTES.admin.dataManagement.mgdmExport,
      icon: ICON.export,
      app: SLIM_APP_ID.ADMIN_DATA_MGDM_EXPORT,
    },
    {
      key: 'menu.system_settings',
      link: APP_ROUTES.admin.dataManagement.system,
      icon: ICON.settings,
      app: SLIM_APP_ID.ADMIN_DATA_SYSTEM,
    },
  ];

  /**
   * Benutzerverwaltung (B1 5.26 / 8.1): users, roles, logbook, app
   * catalogue. «Apps» is platform administration (galaxy app catalogue) and
   * only the Applikationsadministrator*in has a right for it.
   */
  protected readonly userManagement: NavItem[] = [
    {
      key: 'menu.users',
      link: APP_ROUTES.admin.dataManagement.users,
      icon: ICON.users,
      app: GALAXY_APP_ID.ADMIN_USER_LIST,
    },
    {
      key: 'menu.roles',
      link: APP_ROUTES.admin.dataManagement.roles,
      icon: ICON.shield,
      app: GALAXY_APP_ID.ADMIN_ROLE_LIST,
    },
    {
      key: 'menu.logs',
      link: APP_ROUTES.admin.dataManagement.logs,
      icon: ICON.log,
      app: SLIM_APP_ID.ADMIN_LOGS,
    },
    {
      key: 'menu.apps',
      link: APP_ROUTES.admin.dataManagement.apps,
      icon: ICON.apps,
      app: GALAXY_APP_ID.ADMIN_APPS_LIST,
    },
  ];

  protected readonly tabs: NavItem[] = [
    {
      key: 'shell.home',
      link: APP_ROUTES.admin.home,
      exact: true,
      icon: ICON.home,
    },
    { key: 'menu.area', link: APP_ROUTES.admin.area.root, icon: ICON.target, app: SLIM_APP_ID.ADMIN_AREA },
    {
      key: 'shell.data',
      link: APP_ROUTES.admin.dataManagement.root,
      icon: ICON.database,
      app: SLIM_APP_ID.ADMIN_DATA_AREA,
    },
    {
      key: 'menu.users',
      link: APP_ROUTES.admin.dataManagement.users,
      icon: ICON.users,
      app: GALAXY_APP_ID.ADMIN_USER_LIST,
    },
  ];

  /** The four pages of one Schiessplatz (sidebar group «Schiessplätze»); Simulation needs its own right. */
  protected readonly areaPages: AreaPage[] = [
    { id: 'overview', key: 'menu.area_overview', link: APP_ROUTES.admin.area.overview, icon: ICON.home },
    { id: 'shots', key: 'menu.area_shots', link: APP_ROUTES.admin.area.shots, icon: ICON.target },
    { id: 'details', key: 'menu.area_details', link: APP_ROUTES.admin.area.details, icon: ICON.info },
    { id: 'simulation', key: 'menu.area_simulation', link: APP_ROUTES.admin.area.simulation, icon: ICON.chart, app: SLIM_APP_ID.ADMIN_AREA_SIMULATION },
  ];
  protected readonly visibleAreaPages = this.visible(this.areaPages);
  protected readonly starIcon = ICON.star;
  protected readonly listIcon = ICON.list;

  protected readonly areas = this.area.areas;
  protected readonly canAreas = this.access.can(SLIM_APP_ID.ADMIN_AREA);

  /** Schiessplatz of the current URL (`/admin/area/:id/…`), else ''. */
  private readonly routeAreaId = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
      map((url) => areaIdOf(url)),
    ),
    { initialValue: areaIdOf(this.router.url) },
  );
  /** Picked in the sidebar; the route wins whenever it names a Schiessplatz. */
  private readonly pickedAreaId = linkedSignal<string, string>({
    source: this.routeAreaId,
    computation: (fromRoute, previous) => fromRoute || previous?.value || '',
  });
  protected readonly activeArea = computed<AreaResultDto | null>(() => {
    const id = this.pickedAreaId();
    return (id && this.areas().find((a) => a.id === id)) || null;
  });
  // Open/closed state of the collapsible groups, remembered per browser.
  private readonly groups = signal<SidebarGroups>(readGroups());
  protected readonly areaGroupOpen = computed(() => this.groups().areas);
  protected readonly bookmarksOpen = computed(() => this.groups().bookmarks);
  protected readonly dataOpen = computed(() => this.groups().data);
  protected readonly usersOpen = computed(() => this.groups().users);

  protected toggleGroup(group: keyof SidebarGroups): void {
    const next = { ...this.groups(), [group]: !this.groups()[group] };
    this.groups.set(next);
    writeGroups(next);
  }
  protected labelOf(a: AreaResultDto): string {
    return `${a.coordinationSectionNo} ${a.name}`;
  }

  /**
   * A range was chosen in the switcher: keep the current sub page when one
   * is open and allowed, otherwise the first allowed page (Übersicht). The
   * router runs the pages' own guards, so nothing here bypasses them.
   */
  protected pickArea(id: string): void {
    if (!this.areas().some((a) => a.id === id)) return;
    this.pickedAreaId.set(id);
    const allowed = this.visibleAreaPages();
    const fromRoute = this.routeAreaId();
    const current = fromRoute ? allowed.find((p) => this.router.url.split('?')[0].startsWith(p.link(fromRoute))) : undefined;
    const target = current ?? allowed[0] ?? this.areaPages[0];
    void this.router.navigateByUrl(target.link(id));
  }

  // Lesezeichen (bookmarks): starred Schiessplätze, kept per browser and
  // tenant in localStorage — demo scope; product: galaxy user settings.
  protected readonly bookmarkIds = signal<string[]>(readBookmarks(this.bookmarkKey()));
  protected readonly bookmarkedAreas = computed(() => {
    const ids = this.bookmarkIds();
    return ids.map((id) => this.areas().find((a) => a.id === id)).filter((a): a is AreaResultDto => !!a);
  });

  protected isBookmarked(id: string): boolean {
    return this.bookmarkIds().includes(id);
  }

  protected toggleBookmark(id: string): void {
    const next = this.isBookmarked(id) ? this.bookmarkIds().filter((x) => x !== id) : [...this.bookmarkIds(), id];
    this.bookmarkIds.set(next);
    writeBookmarks(this.bookmarkKey(), next);
  }

  private bookmarkKey(): string {
    const tenant = this.auth.currentTenant();
    const id = tenant ? this.auth.tenantId(tenant) : '';
    return `slim.bookmarks.${id || 'default'}`;
  }

  // Menu entries the signed-in user has a right for (B1 8.1.2). Until the
  // rights are loaded everything is shown; the API guards remain authoritative.
  protected readonly visibleWorkspace = this.visible(this.workspace);
  protected readonly visibleDataManagement = this.visible(this.dataManagement);
  protected readonly visibleUserManagement = this.visible(this.userManagement);
  protected readonly visibleTabs = this.visible(this.tabs);

  private visible<T extends { app?: number }>(items: T[]) {
    return computed(() => {
      const loaded = this.access.loaded();
      const apps = this.access.appIds();
      return items.filter((item) => item.app == null || !loaded || apps.includes(item.app));
    });
  }

  /** ComponentBase calls this on init and on every DATA_RELOAD emit (tenant switch). */
  override getData(): void {
    void this.access.load();
    // The Schiessplatz picker and the bookmarks need the list; the facade deduplicates loads.
    void this.area.load();
  }

  protected toggle(menu: 'main' | 'user'): void {
    this.openMenu.update((open) => (open === menu ? null : menu));
  }

  protected onDocumentClick(event: Event): void {
    if (!this.openMenu()) return;
    const target = event.target as HTMLElement;
    if (!target.closest('.slim-dropdown')) this.openMenu.set(null);
  }

  protected async signOut(): Promise<void> {
    this.openMenu.set(null);
    // The API call may fail (expired token, offline) — the local session is
    // cleared either way so the user always lands on a clean login.
    await this.auth.logout();
    this.access.reset();
    // The welcome dialog greets every login (demo), not only every tab.
    resetWelcome();
    await this.router.navigateByUrl(APP_ROUTES.auth.login);
  }
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

/** 16×16 outline icon paths (mock set). */
const ICON = {
  star: 'M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6L8 1.8z',
  list: 'M3 4h10M3 8h10M3 12h10',
  info: 'M8 1.7a6.3 6.3 0 100 12.6A6.3 6.3 0 008 1.7zM8 7.2v4M8 5v.2',
  home: 'M2 7.5L8 2.5l6 5V13a1 1 0 01-1 1h-3.5v-4h-3v4H3a1 1 0 01-1-1V7.5z',
  target: 'M8 2a6 6 0 100 12A6 6 0 008 2zm0 3a3 3 0 100 6 3 3 0 000-6z',
  chart: 'M2.5 13.5h11M4 11V7M8 11V4M12 11V8.5',
  database:
    'M2.5 4c0-1.1 2.5-2 5.5-2s5.5.9 5.5 2-2.5 2-5.5 2-5.5-.9-5.5-2zm0 0v8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V4M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2',
  weapon: 'M2 9l7-7 2 2-7 7H2V9zm7-4l2 2M4 12l-2 2',
  users:
    'M6 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm-4 6c.4-2.3 2-3.5 4-3.5s3.6 1.2 4 3.5M11 8.5a2 2 0 100-4M14 14c-.3-1.7-1.3-2.8-2.7-3.2',
  export: 'M8 2v8M8 10l-3-3M8 10l3-3M2.5 13.5h11',
  log: 'M4 2.5h8a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1v-9a1 1 0 011-1zM5.5 6h5M5.5 8.5h5M5.5 11h3',
  shield: 'M8 1.5l5.5 2v4c0 3.2-2.3 5.6-5.5 7-3.2-1.4-5.5-3.8-5.5-7v-4l5.5-2zM5.5 8l1.8 1.8L10.5 6',
  apps: 'M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z',
  settings:
    'M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4',
} as const;

const AREA_URL = new RegExp(`^/${ROUTE_SEGMENT.admin}/${ROUTE_SEGMENT.area}/([^/?#]+)/`);

function areaIdOf(url: string): string {
  return AREA_URL.exec(url)?.[1] ?? '';
}

function readBookmarks(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeBookmarks(key: string, ids: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // storage blocked: bookmarks live for the page only
  }
}

/** Collapsible sidebar groups (all open by default). */
interface SidebarGroups {
  areas: boolean;
  bookmarks: boolean;
  data: boolean;
  users: boolean;
}
const GROUPS_KEY = 'slim.sidebar.groups';
const GROUPS_DEFAULT: SidebarGroups = { areas: true, bookmarks: true, data: true, users: true };

function readGroups(): SidebarGroups {
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<SidebarGroups>) : {};
    return { ...GROUPS_DEFAULT, ...parsed };
  } catch {
    return GROUPS_DEFAULT;
  }
}

function writeGroups(groups: SidebarGroups): void {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  } catch {
    // storage blocked: the state lives for the page only
  }
}
