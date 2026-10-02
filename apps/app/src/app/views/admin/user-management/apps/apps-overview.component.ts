import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { APP_ROUTES } from '@slim/shared';
import type { AppEntity } from '@ui-slim/apiClient';
import { TableExportComponent } from '../../../../common/table-export.component';
import { tableExport, TableExportData } from '../../../../core/table/table-export';
import { AppsFacade } from './_data/apps.facade';

const I18N = 'admin.apps';
/** Id of the table in the export: file name (date and extension are added) and logbook. */
const EXPORT_TABLE = 'apps';

/**
 * App-Katalog unter `/admin/apps` — die `app_app`-Zeilen, die Menü-
 * Sichtbarkeit und Berechtigungsvokabular steuern. UX-Kern: der
 * `hiddenInMenu`-Toggle direkt in der Zeile (wirkt sofort auf die
 * dynamische Sidebar) und übersetzte `menu.*`-Titel neben dem Roh-Key.
 */
@Component({
  selector: 'app-elo-apps-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink, TableExportComponent],
  templateUrl: './apps-overview.component.html',
  styleUrl: './apps-overview.component.scss',
})
export class EloAppsOverviewComponent extends ComponentBase {
  protected readonly prefix = I18N;
  protected readonly routes = APP_ROUTES;
  /** Row waiting for the confirm sheet. */
  readonly pendingDelete = signal<AppEntity | null>(null);
  protected readonly facade = inject(AppsFacade);
  private readonly translate = inject(TranslateService);

  readonly query = signal('');

  readonly filtered = computed(() => {
    const q = this.query().toLowerCase().trim();
    const rows = this.facade.apps();
    if (!q) {
      return rows;
    }
    return rows.filter((app) =>
      [app.title, this.label(app.title), app.path ?? '', app.roleKey ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  });

  /** The table as shown (search applied) for the Excel-/CSV-Export (B1 5.5.5, slm 3). */
  protected readonly exportSource = (): TableExportData => {
    const t = (key: string) => this.translate.translate(key) ?? key;
    return tableExport<AppEntity>({
      table: EXPORT_TABLE,
      title: t('menu.apps'),
      filters: [{ label: t(`${I18N}.search`), value: this.query().trim() }],
      columns: [
        { header: t(`${I18N}.col_title`), value: (app) => this.label(app.title) || null },
        // The raw `menu.*` key under the translated title.
        { header: t(`${I18N}.field_title`), value: (app) => app.title || null },
        { header: t(`${I18N}.col_path`), value: (app) => app.path || null },
        { header: t(`${I18N}.col_role_key`), value: (app) => app.roleKey || null },
        {
          header: t(`${I18N}.col_category`),
          value: (app) => this.facade.categoryTitle(app.categoryId),
        },
        { header: t(`${I18N}.col_order`), value: (app) => app.orderIdx },
        {
          header: t(`${I18N}.col_visible`),
          value: (app) => t(app.hiddenInMenu ? 'common.no' : 'common.yes'),
        },
      ],
      rows: this.filtered(),
    });
  };

  /** ComponentBase ruft dies beim Init und bei jedem DATA_RELOAD-Emit auf. */
  getData(): void {
    void this.facade.load();
  }

  onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  /** Sichtbar-Toggle = invertiertes `hiddenInMenu`, wirkt sofort. */
  async toggleHidden(app: AppEntity): Promise<void> {
    if (
      await this.facade.update(app.appId, {
        hiddenInMenu: !app.hiddenInMenu,
      })
    ) {
      await this.facade.load();
    }
  }

  /** Opens the confirm sheet; `confirmDelete()` does the work. */
  remove(app: AppEntity): void {
    this.pendingDelete.set(app);
  }

  async confirmDelete(): Promise<void> {
    const app = this.pendingDelete();
    if (!app) {
      return;
    }
    this.pendingDelete.set(null);
    if (await this.facade.remove(app.appId)) {
      await this.facade.load();
    }
  }

  label(title: string): string {
    if (!title?.includes('.')) {
      return title;
    }
    return this.translate.translate(title) ?? title;
  }
}
