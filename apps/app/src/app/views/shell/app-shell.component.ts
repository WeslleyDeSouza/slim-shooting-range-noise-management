import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { SlimThemeToggleComponent } from '@ui-slim/design-system';
import { LanguageSwitchComponent } from '../../common/language-switch.component';
import { RangesService } from '../../core/ranges/ranges.service';

interface NavItem {
  key: string;
  link: string;
  icon: string;
  exact?: boolean;
}

/**
 * Application shell (mock `_mocks/home/index.html`, ELO admin-shell pattern):
 * topbar with brand, organisation, language, theme, main menu and account
 * menu; sidebar on desktop, tabbar on phones; routed content in the middle.
 * Navigation follows docs/architecture/sitemap.md.
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslatePipe,
    SlimThemeToggleComponent,
    LanguageSwitchComponent,
  ],
  host: { '(document:click)': 'onDocumentClick($event)' },
  template: `
    <div class="slim-shell">
      <!-- Topbar: general controls ------------------------------------ -->
      <header class="slim-topbar slim-shell__topbar">
        <a class="slim-topbar__brand" routerLink="/" [attr.title]="'shell.home' | translate">
          <span class="slim-topbar__mark" aria-hidden="true"></span>
          <span class="slim-topbar__brand-text">
            <b>{{ 'app.title' | translate }}</b>
            <span>{{ 'app.subtitle' | translate }}</span>
          </span>
        </a>
        <div class="slim-topbar__org">
          <b>{{ 'shell.org' | translate }}</b>{{ 'shell.org_sub' | translate }}
        </div>

        <div class="slim-topbar__actions">
          <span class="slim-u-desktop-only"><app-language-switch /></span>
          <slim-theme-toggle />

          <div class="slim-dropdown" [class.slim-dropdown--open]="openMenu() === 'main'">
            <button
              type="button"
              class="slim-topbar__iconbtn"
              [attr.aria-label]="'shell.main_menu' | translate"
              [attr.aria-expanded]="openMenu() === 'main'"
              (click)="toggle('main')"
            >
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            </button>
            <div class="slim-dropdown__panel">
              <div class="slim-menu">
                <div class="slim-menu__heading">{{ 'shell.help' | translate }}</div>
                <button type="button" class="slim-menu__item">
                  <svg class="slim-menu__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 2.5h7l2 2v9h-9v-11z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M6 8h4M6 10.5h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                  <span class="shell__menu-text">{{ 'shell.manual' | translate }}<small>{{ 'shell.manual_sub' | translate }}</small></span>
                </button>
                <button type="button" class="slim-menu__item">
                  <svg class="slim-menu__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="5.5" r="2.6" stroke="currentColor" stroke-width="1.4"/><path d="M2.8 13.5c.5-2.6 2.6-4 5.2-4s4.7 1.4 5.2 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                  <span class="shell__menu-text">{{ 'shell.specialist' | translate }}<small>{{ 'shell.specialist_sub' | translate }}</small></span>
                </button>
                <button type="button" class="slim-menu__item">
                  <svg class="slim-menu__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M2 6l6 3.5L14 6" stroke="currentColor" stroke-width="1.4"/></svg>
                  <span class="shell__menu-text">{{ 'shell.sysadmin' | translate }}<small>slim-support&#64;example.admin.ch</small></span>
                </button>
                <div class="slim-menu__divider"></div>
                <div class="slim-menu__heading">{{ 'shell.application' | translate }}</div>
                <div class="slim-menu__item shell__menu-static">
                  <svg class="slim-menu__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/><path d="M8 7v4M8 5v.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                  <span class="shell__menu-text">{{ 'shell.version' | translate }}<small>SLIM {{ version }}</small></span>
                </div>
                <div class="slim-menu__divider slim-u-mobile-only"></div>
                <div class="slim-menu__heading slim-u-mobile-only">{{ 'common.language' | translate }}</div>
                <div class="shell__menu-lang slim-u-mobile-only"><app-language-switch /></div>
              </div>
            </div>
          </div>

          <div class="slim-dropdown" [class.slim-dropdown--open]="openMenu() === 'user'">
            <button
              type="button"
              class="slim-topbar__user"
              [attr.aria-label]="'shell.account' | translate"
              [attr.aria-expanded]="openMenu() === 'user'"
              (click)="toggle('user')"
            >
              <span class="slim-avatar slim-avatar--sm shell__avatar">{{ user().initials }}</span>
              <span class="slim-topbar__user-name">{{ user().name }}</span>
              <svg class="slim-u-desktop-only" width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
            </button>
            <div class="slim-dropdown__panel">
              <div class="slim-menu">
                <div class="slim-menu__heading">{{ 'shell.signed_in_as' | translate }}</div>
                <div class="shell__menu-user">
                  <b>{{ user().name }}</b>
                  <span class="slim-text--muted slim-text--xs">
                    {{ 'shell.permission' | translate }} · {{ 'shell.ranges_count' | translate: { n: summary().total } }}
                  </span>
                </div>
                <div class="slim-menu__divider"></div>
                <button type="button" class="slim-menu__item">{{ 'shell.account_overview' | translate }}</button>
                <button type="button" class="slim-menu__item">{{ 'shell.settings' | translate }}</button>
                <div class="slim-menu__divider"></div>
                <button type="button" class="slim-menu__item slim-menu__item--danger">{{ 'shell.sign_out' | translate }}</button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- Sidebar (desktop) --------------------------------------------- -->
      <aside class="slim-sidebar slim-shell__sidebar">
        <nav class="slim-sidebar__section" [attr.aria-label]="'shell.workspace' | translate">
          <div class="slim-sidebar__heading">{{ 'shell.workspace' | translate }}</div>
          @for (item of workspace; track item.key) {
            <a
              class="slim-sidebar__link"
              [routerLink]="item.link"
              routerLinkActive="slim-sidebar__link--active"
              [routerLinkActiveOptions]="{ exact: !!item.exact }"
            >
              <svg class="slim-sidebar__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path [attr.d]="item.icon" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              {{ item.key | translate }}
            </a>
          }
        </nav>
        <nav class="slim-sidebar__section" [attr.aria-label]="'menu.data_management' | translate">
          <div class="slim-sidebar__heading">{{ 'menu.data_management' | translate }}</div>
          @for (item of dataManagement; track item.key) {
            <a class="slim-sidebar__link" [routerLink]="item.link" routerLinkActive="slim-sidebar__link--active">
              <svg class="slim-sidebar__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path [attr.d]="item.icon" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              {{ item.key | translate }}
            </a>
          }
        </nav>
        <div class="slim-sidebar__footer slim-text--muted slim-text--xs">
          {{ 'shell.org' | translate }} · SLIM {{ version }}
        </div>
      </aside>

      <!-- Content ------------------------------------------------------- -->
      <main class="slim-shell__main">
        <router-outlet />
      </main>

      <!-- Tabbar (phones) ------------------------------------------------ -->
      <nav class="slim-tabbar slim-shell__tabbar" [attr.aria-label]="'shell.main_menu' | translate">
        @for (item of tabs; track item.key) {
          <a
            class="slim-tabbar__item"
            [routerLink]="item.link"
            routerLinkActive="slim-tabbar__item--active"
            [routerLinkActiveOptions]="{ exact: !!item.exact }"
          >
            <svg class="slim-tabbar__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path [attr.d]="item.icon" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="slim-tabbar__label">{{ item.key | translate }}</span>
          </a>
        }
      </nav>
    </div>
  `,
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  private readonly rangesService = inject(RangesService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly version = '0.0.1';
  protected readonly user = this.rangesService.user;
  protected readonly summary = this.rangesService.summary;
  protected readonly openMenu = signal<'main' | 'user' | null>(null);

  protected readonly workspace: NavItem[] = [
    { key: 'shell.home', link: '/', exact: true, icon: ICON.home },
    { key: 'menu.ranges', link: '/schiessplaetze', icon: ICON.target },
  ];

  protected readonly dataManagement: NavItem[] = [
    { key: 'menu.range', link: '/admin/schiessplatz', icon: ICON.database },
    { key: 'menu.weapons', link: '/admin/waffen', icon: ICON.weapon },
    { key: 'menu.users', link: '/admin/benutzer', icon: ICON.users },
    { key: 'menu.mgdm_export', link: '/admin/mgdm-export', icon: ICON.export },
    { key: 'menu.system_settings', link: '/admin/system', icon: ICON.settings },
  ];

  protected readonly tabs: NavItem[] = [
    { key: 'shell.home', link: '/', exact: true, icon: ICON.home },
    { key: 'menu.range', link: '/schiessplaetze', icon: ICON.target },
    { key: 'shell.data', link: '/admin/schiessplatz', icon: ICON.database },
    { key: 'menu.users', link: '/admin/benutzer', icon: ICON.users },
  ];

  protected readonly hasOpenMenu = computed(() => this.openMenu() !== null);

  protected toggle(menu: 'main' | 'user'): void {
    this.openMenu.update((open) => (open === menu ? null : menu));
  }

  protected onDocumentClick(event: Event): void {
    if (!this.openMenu()) return;
    const target = event.target as HTMLElement;
    if (!target.closest('.slim-dropdown')) this.openMenu.set(null);
  }
}

/** 16×16 outline icon paths (mock set). */
const ICON = {
  home: 'M2 7.5L8 2.5l6 5V13a1 1 0 01-1 1h-3.5v-4h-3v4H3a1 1 0 01-1-1V7.5z',
  target: 'M8 2a6 6 0 100 12A6 6 0 008 2zm0 3a3 3 0 100 6 3 3 0 000-6z',
  chart: 'M2.5 13.5h11M4 11V7M8 11V4M12 11V8.5',
  database: 'M2.5 4c0-1.1 2.5-2 5.5-2s5.5.9 5.5 2-2.5 2-5.5 2-5.5-.9-5.5-2zm0 0v8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V4M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2',
  weapon: 'M2 9l7-7 2 2-7 7H2V9zm7-4l2 2M4 12l-2 2',
  users: 'M6 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm-4 6c.4-2.3 2-3.5 4-3.5s3.6 1.2 4 3.5M11 8.5a2 2 0 100-4M14 14c-.3-1.7-1.3-2.8-2.7-3.2',
  export: 'M8 2v8M8 10l-3-3M8 10l3-3M2.5 13.5h11',
  settings: 'M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4',
  doc: 'M3.5 2.5h7l2 2v9h-9v-11z',
} as const;
