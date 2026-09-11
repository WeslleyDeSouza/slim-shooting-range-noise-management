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
import type { RoleEntity } from '@ui-slim/apiClient';
import { AD_TABLE_STYLES } from '../../_common/table.styles';
import { RolesFacade } from './_data/roles.facade';

const I18N = 'admin.roles';

/**
 * Rollenverwaltung unter `/admin/roles` — ersetzt den Rollen-Screen des
 * Shell-Remotes: Titel, Status, Admin-Rechte-Badge, Anzahl freigeschalteter
 * Apps. Die Berechtigungs-Matrix lebt im Formular.
 */
@Component({
  selector: 'app-elo-roles-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink],
  styles: [AD_TABLE_STYLES, `
    .ad-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11.5px;
      border: 1px solid var(--ad-line);
      background: var(--ad-bg-soft, #f1f2f4);
    }
    .ad-badge--admin {
      background: var(--ad-red, #d8232a);
      border-color: var(--ad-red, #d8232a);
      color: #fff;
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
          data-action="roles.create"
          routerLink="create"
        >
          ＋ {{ prefix + '.create' | translate }}
        </button>
      </div>

      @if (facade.error(); as message) {
        <div class="ad-note ad-note--error" role="alert">{{ message }}</div>
      }

      <div class="ad-table-wrap">
        <table class="ad-table">
          <thead>
            <tr>
              <th>{{ prefix + '.col_title' | translate }}</th>
              <th>{{ prefix + '.col_flags' | translate }}</th>
              <th class="c">{{ prefix + '.col_apps' | translate }}</th>
              <th class="c">{{ prefix + '.col_state' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (role of filtered(); track role.roleId) {
              <tr>
                <td><b>{{ role.title }}</b></td>
                <td>
                  @if (role.hasAdminRights) {
                    <span class="ad-badge ad-badge--admin">{{ prefix + '.flag_admin' | translate }}</span>
                  }
                  @if (role.isDefault) {
                    <span class="ad-badge">{{ prefix + '.flag_default' | translate }}</span>
                  }
                  @if (role.sensitiveDataDisplay) {
                    <span class="ad-badge">{{ prefix + '.flag_sensitive' | translate }}</span>
                  }
                </td>
                <td class="c">{{ role.apps.length || 0 }}</td>
                <td class="c">
                  <button
                    type="button"
                    class="ad-toggle"
                    [attr.aria-pressed]="!!role.state"
                    [attr.aria-label]="prefix + '.col_state' | translate"
                    (click)="toggleState(role)"
                  ></button>
                </td>
                <td class="r">
                  <div class="ad-row-actions">
                    <button
                      type="button"
                      class="ad-icon-btn"
                      [attr.aria-label]="prefix + '.edit' | translate"
                      [routerLink]="['edit', role.roleId]"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M11.1 2.4a1.6 1.6 0 012.3 2.3L5.8 12.3l-3 .7.7-3 7.6-7.6z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
                    </button>
                    <button
                      type="button"
                      class="ad-icon-btn ad-icon-btn--danger"
                      data-action="roles.delete"
                      [attr.aria-label]="prefix + '.delete' | translate"
                      (click)="remove(role)"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6.5 4V2.5h3V4M4.5 4l.7 9h5.6l.7-9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            } @empty {
              @if (!facade.loading()) {
                <tr>
                  <td colspan="5" class="ad-empty">{{ prefix + '.empty' | translate }}</td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class EloRolesOverviewComponent extends ComponentBase {
  protected readonly prefix = I18N;
  protected readonly facade = inject(RolesFacade);
  private readonly translate = inject(TranslateService);

  readonly query = signal('');

  readonly filtered = computed(() => {
    const q = this.query().toLowerCase().trim();
    const rows = this.facade.roles();
    if (!q) {
      return rows;
    }
    return rows.filter((role) => (role.title ?? '').toLowerCase().includes(q));
  });

  /** ComponentBase ruft dies beim Init und bei jedem DATA_RELOAD-Emit auf. */
  getData(): void {
    void this.facade.load();
  }

  onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  async toggleState(role: RoleEntity): Promise<void> {
    if (
      await this.facade.update(role.roleId, {
        title: role.title,
        type: role.type,
        state: !role.state,
      })
    ) {
      await this.facade.load();
    }
  }

  async remove(role: RoleEntity): Promise<void> {
    const question =
      this.translate.translate(`${I18N}.delete_confirm`, {
        name: role.title ?? `${role.roleId}`,
      }) ?? role.title ?? '';
    if (!confirm(question)) {
      return;
    }
    if (await this.facade.remove(role.roleId)) {
      await this.facade.load();
    }
  }
}
