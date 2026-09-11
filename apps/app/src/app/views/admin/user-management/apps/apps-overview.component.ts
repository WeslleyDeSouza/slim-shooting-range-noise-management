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
import type { AppEntity } from '@ui-slim/apiClient';
import { AD_TABLE_STYLES } from '../../_common/table.styles';
import { AppsFacade } from './_data/apps.facade';

const I18N = 'admin.apps';

/**
 * App-Katalog unter `/admin/apps` — die `app_app`-Zeilen, die Menü-
 * Sichtbarkeit und Berechtigungsvokabular steuern. UX-Kern: der
 * `hiddenInMenu`-Toggle direkt in der Zeile (wirkt sofort auf die
 * dynamische Sidebar) und übersetzte `menu.*`-Titel neben dem Roh-Key.
 */
@Component({
  selector: 'app-elo-apps-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink],
  styles: [AD_TABLE_STYLES, `
    .ad-key {
      font-family: ui-monospace, Consolas, monospace;
      font-size: 11.5px;
      color: var(--ad-gray-500, #6b7280);
    }
    .ad-path {
      font-family: ui-monospace, Consolas, monospace;
      font-size: 12px;
    }
  `],
  template: `
    <div class="ad-page">
      <div class="ad-toolbar">
        <div class="ad-search">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <input
            type="text"
            [placeholder]="prefix + '.search' | translate"
            [value]="query()"
            (input)="onQuery($event)"
          />
        </div>
        <div class="ad-grow"></div>
        <span class="ad-result-count">
          {{ prefix + '.count' | translate: { n: filtered().length } }}
        </span>
        <button
          type="button"
          class="ad-btn ad-btn--primary"
          data-action="apps.create"
          routerLink="create"
        >
          ＋ {{ prefix + '.create' | translate }}
        </button>
      </div>

      <div class="ad-note">{{ prefix + '.hidden_hint' | translate }}</div>

      @if (facade.error(); as message) {
        <div class="ad-note ad-note--error" role="alert">{{ message }}</div>
      }

      <div class="ad-table-wrap">
        <table class="ad-table">
          <thead>
            <tr>
              <th>{{ prefix + '.col_title' | translate }}</th>
              <th>{{ prefix + '.col_path' | translate }}</th>
              <th>{{ prefix + '.col_role_key' | translate }}</th>
              <th>{{ prefix + '.col_category' | translate }}</th>
              <th class="c">{{ prefix + '.col_order' | translate }}</th>
              <th class="c">{{ prefix + '.col_visible' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (app of filtered(); track app.appId) {
              <tr>
                <td>
                  <b>{{ label(app.title) }}</b>
                  <small class="ad-key">{{ app.title }}</small>
                </td>
                <td class="ad-path">{{ app.path || '—' }}</td>
                <td class="ad-key">{{ app.roleKey || '—' }}</td>
                <td>{{ facade.categoryTitle(app.categoryId) }}</td>
                <td class="c">{{ app.orderIdx }}</td>
                <td class="c">
                  <button
                    type="button"
                    class="ad-toggle"
                    data-action="apps.toggleVisible"
                    [attr.aria-pressed]="!app.hiddenInMenu"
                    [attr.aria-label]="prefix + '.col_visible' | translate"
                    (click)="toggleHidden(app)"
                  ></button>
                </td>
                <td class="r">
                  <div class="ad-row-actions">
                    <button
                      type="button"
                      class="ad-icon-btn"
                      [attr.aria-label]="prefix + '.edit' | translate"
                      [routerLink]="['edit', app.appId]"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M11.1 2.4a1.6 1.6 0 012.3 2.3L5.8 12.3l-3 .7.7-3 7.6-7.6z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
                    </button>
                    <button
                      type="button"
                      class="ad-icon-btn ad-icon-btn--danger"
                      data-action="apps.delete"
                      [attr.aria-label]="prefix + '.delete' | translate"
                      (click)="remove(app)"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6.5 4V2.5h3V4M4.5 4l.7 9h5.6l.7-9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            } @empty {
              @if (!facade.loading()) {
                <tr>
                  <td colspan="7" class="ad-empty">{{ prefix + '.empty' | translate }}</td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class EloAppsOverviewComponent extends ComponentBase {
  protected readonly prefix = I18N;
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

  async remove(app: AppEntity): Promise<void> {
    const question =
      this.translate.translate(`${I18N}.delete_confirm`, {
        name: this.label(app.title),
      }) ?? app.title;
    if (!confirm(question)) {
      return;
    }
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
