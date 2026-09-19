import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { APP_ROUTES, SLIM_APP_ID } from '@slim/shared';
import { AccessFacade } from '../../../../../core/access/access.facade';
import { DataAreaFacade } from '../../../../../core/data-area/data-area.facade';
import { areaIdSignal } from '../_context/area-id';

const I18N = 'admin.dm_area_general';

/**
 * Datenverwaltung › Schiessplatz › Allgemein: the tab bar Übersicht (5.15) ·
 * Stammdaten (5.16) of B1 Abbildung 26/27, the read-only notice for roles
 * without the write right on app 41 and the shared load of the read model
 * (`DataAreaFacade`) both tabs render from.
 */
@Component({
  selector: 'app-dm-area-general',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  styleUrl: './dm-area-general.component.scss',
  template: `
    <div class="dmg">
      <nav class="slim-tabs dmg__tabs" role="tablist" [attr.aria-label]="prefix + '.tabs' | translate">
        @for (tab of tabs(); track tab.id) {
          <a
            class="slim-tabs__tab"
            role="tab"
            [routerLink]="tab.link"
            routerLinkActive="slim-tabs__tab--active"
            #rla="routerLinkActive"
            [attr.aria-selected]="rla.isActive"
            [attr.data-testid]="'dmg-tab-' + tab.id"
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path [attr.d]="tab.icon" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            {{ tab.key | translate }}
          </a>
        }
      </nav>

      @if (readonly()) {
        <div class="slim-alert slim-alert--info dmg__readonly" role="status" data-testid="dmg-readonly">
          <svg class="slim-alert__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.4" />
            <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" stroke-width="1.4" />
          </svg>
          <div class="slim-alert__body">{{ prefix + '.readonly' | translate }}</div>
        </div>
      }

      @if (error(); as message) {
        <div class="slim-alert slim-alert--danger dmg__error" data-testid="dmg-error">
          <div class="slim-alert__body">{{ message | translate }}</div>
          <button type="button" class="slim-alert__close" [attr.aria-label]="'common.close' | translate" (click)="facade.clearError()">×</button>
        </div>
      }

      <router-outlet />
    </div>
  `,
})
export class DmAreaGeneralComponent extends ComponentBase {
  protected readonly facade = inject(DataAreaFacade);
  private readonly access = inject(AccessFacade);
  private readonly route = inject(ActivatedRoute);

  protected readonly prefix = I18N;
  readonly areaId = areaIdSignal(this.route);
  protected readonly error = this.facade.error;
  /** Write right on «Datenverwaltung › Schiessplatz» (B1 8.1.2, app 41); read-only until known. */
  protected readonly canWrite = this.access.canWrite(SLIM_APP_ID.ADMIN_DATA_AREA);
  protected readonly readonly = computed(() => this.access.loaded() && !this.canWrite());

  protected readonly tabs = computed(() => {
    const id = this.areaId();
    return [
      { id: 'overview', key: 'menu.area_overview', link: APP_ROUTES.admin.dataManagement.area.generalOf(id), icon: ICON.eye },
      { id: 'master-data', key: 'menu.area_master_data', link: APP_ROUTES.admin.dataManagement.area.masterDataOf(id), icon: ICON.db },
    ];
  });

  /** ComponentBase: on init and on every DATA_RELOAD (tenant switch, saves of the tabs). */
  override getData(): void {
    void this.facade.load(this.areaId());
    void this.access.load();
  }
}

const ICON = {
  eye: 'M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8zM8 6a2 2 0 100 4 2 2 0 000-4z',
  db: 'M2.5 4c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2-2.5-2-5.5-2-5.5.9-5.5 2zM2.5 4v8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V4M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2',
} as const;
