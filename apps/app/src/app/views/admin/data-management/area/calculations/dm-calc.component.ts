import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { APP_ROUTES, SLIM_APP_ID } from '@slim/shared';
import { AccessFacade } from '../../../../../core/access/access.facade';
import { DataCalculationsFacade } from '../../../../../core/data-calculations/data-calculations.facade';
import { areaIdSignal } from '../_context/area-id';

const I18N = 'admin.dm_calc';

/**
 * Datenverwaltung › Schiessplatz › Berechnungen: the tab bar Übersicht (5.18)
 * · Import (5.19) · Export (5.20) · Details (5.21) of B1 Abbildung 29–32,
 * the read-only notice for roles without the write right on app 42 and the
 * shared load of the overview (`DataCalculationsFacade`) the tabs work on.
 */
@Component({
  selector: 'app-dm-calc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  styleUrl: './dm-calc.component.scss',
  template: `
    <div class="dmcalc">
      <nav class="slim-tabs dmcalc__tabs" role="tablist" [attr.aria-label]="prefix + '.tabs' | translate">
        @for (tab of tabs(); track tab.id) {
          <a
            class="slim-tabs__tab"
            role="tab"
            [routerLink]="tab.link"
            routerLinkActive="slim-tabs__tab--active"
            #rla="routerLinkActive"
            [attr.aria-selected]="rla.isActive"
            [attr.data-testid]="'dmcalc-tab-' + tab.id"
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path [attr.d]="tab.icon" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            {{ tab.key | translate }}
          </a>
        }
      </nav>

      @if (readonly()) {
        <div class="slim-alert slim-alert--info dmcalc__notice" role="status" data-testid="dmcalc-readonly">
          <svg class="slim-alert__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.4" />
            <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" stroke-width="1.4" />
          </svg>
          <div class="slim-alert__body">{{ prefix + '.readonly' | translate }}</div>
        </div>
      }

      @if (error(); as message) {
        <div class="slim-alert slim-alert--danger dmcalc__notice" data-testid="dmcalc-error">
          <div class="slim-alert__body">{{ message | translate }}</div>
          <button type="button" class="slim-alert__close" [attr.aria-label]="'common.close' | translate" (click)="facade.clearError()">×</button>
        </div>
      }

      <router-outlet />
    </div>
  `,
})
export class DmCalcComponent extends ComponentBase {
  protected readonly facade = inject(DataCalculationsFacade);
  private readonly access = inject(AccessFacade);
  private readonly route = inject(ActivatedRoute);

  protected readonly prefix = I18N;
  readonly areaId = areaIdSignal(this.route);
  protected readonly error = this.facade.error;
  /** Write right on «Datenverwaltung › Berechnungen» (B1 8.1.2, app 42). */
  protected readonly canWrite = this.access.canWrite(SLIM_APP_ID.ADMIN_DATA_CALCULATIONS);
  protected readonly readonly = computed(() => this.access.loaded() && !this.canWrite());

  protected readonly tabs = computed(() => {
    const id = this.areaId();
    const r = APP_ROUTES.admin.dataManagement.area;
    return [
      { id: 'overview', key: 'menu.calculations_overview', link: r.calculationsOverviewOf(id), icon: ICON.eye },
      { id: 'import', key: 'menu.calculations_import', link: r.calculationsImportOf(id), icon: ICON.upload },
      { id: 'export', key: 'menu.calculations_export', link: r.calculationsExportOf(id), icon: ICON.download },
      { id: 'details', key: 'menu.calculations_details', link: r.calculationsDetailsOf(id), icon: ICON.info },
    ];
  });

  constructor() {
    super();
    // The switcher keeps this component and only changes `:areaId`.
    effect(() => {
      const id = this.areaId();
      untracked(() => {
        if (id && this.facade.areaId() && this.facade.areaId() !== id) void this.facade.load(id);
      });
    });
  }

  /** ComponentBase: on init and on every DATA_RELOAD. */
  override getData(): void {
    void this.facade.load(this.areaId());
    void this.access.load();
  }
}

const ICON = {
  eye: 'M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8zM8 6a2 2 0 100 4 2 2 0 000-4z',
  upload: 'M8 11V3M5 6l3-3 3 3M3 12v2h10v-2',
  download: 'M8 2v8M5 7l3 3 3-3M3 12v2h10v-2',
  info: 'M8 1.7a6.3 6.3 0 100 12.6A6.3 6.3 0 008 1.7zM8 7.2v4M8 5v.2',
} as const;
