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
import { APP_ROUTES, parseRoleSettings } from '@slim/shared';
import type { RoleEntity } from '@ui-slim/apiClient';
import { TableExportComponent } from '../../../../common/table-export.component';
import { TableSelectComponent, TableSelectRowDirective } from '../../../../common/table-select.component';
import { TableSortHeaderComponent } from '../../../../common/table-sort-header.component';
import { tableExport, TableExportData } from '../../../../core/table/table-export';
import { TableSelection } from '../../../../core/table/table-selection';
import { SortValue, TableSort } from '../../../../core/table/table-sort';
import { RolesFacade } from './_data/roles.facade';

const I18N = 'admin.roles';
/** Id of the table in the export: file name (date and extension are added) and logbook. */
const EXPORT_TABLE = 'rollen';

/**
 * Rollenverwaltung unter `/admin/roles` — ersetzt den Rollen-Screen des
 * Shell-Remotes: Titel, Status, Admin-Rechte-Badge, Anzahl freigeschalteter
 * Apps. Die Berechtigungs-Matrix lebt im Formular.
 */
type RoleSortKey = 'title' | 'flags' | 'apps' | 'users' | 'state';

@Component({
  selector: 'app-elo-roles-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink, TableExportComponent, TableSelectComponent, TableSelectRowDirective, TableSortHeaderComponent],
  templateUrl: './roles-overview.component.html',
  styleUrl: './roles-overview.component.scss',
})
export class EloRolesOverviewComponent extends ComponentBase {
  protected readonly prefix = I18N;
  protected readonly routes = APP_ROUTES;
  /** Row waiting for the confirm sheet. */
  readonly pendingDelete = signal<RoleEntity | null>(null);
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

  protected readonly sort = new TableSort<RoleSortKey>();
  protected readonly selection = new TableSelection();
  /** What the columns are sorted by (B1 5.5.2); «Eigenschaften» by its badges in the order of the cell. */
  private readonly sortValues: Record<RoleSortKey, (role: RoleEntity) => SortValue> = {
    title: (role) => role.title,
    flags: (role) => [role.hasAdminRights, role.isDefault, this.isSystemRole(role), role.sensitiveDataDisplay].map((flag) => (flag ? '0' : '1')).join(''),
    apps: (role) => role.apps?.length ?? 0,
    users: (role) => this.userCount(role),
    state: (role) => !!role.state,
  };
  /** The roles as shown: search applied, then in the order of the chosen column. */
  protected readonly rows = computed(() => this.sort.apply(this.filtered(), this.sortValues));
  protected readonly shownIds = computed(() => this.rows().map((role) => String(role.roleId)));

  /** The table as shown (search and sorting applied), or the marked rows, for the Excel-/CSV-Export (B1 5.5.5, slm 3). */
  protected readonly exportSource = (): TableExportData => {
    const t = (key: string) => this.translate.translate(key) ?? key;
    const picked = this.selection.pick(this.rows(), (role) => String(role.roleId));
    // The badges of the column «Eigenschaften», in the order of the cell.
    const flags = (role: RoleEntity) =>
      [
        role.hasAdminRights ? 'flag_admin' : null,
        role.isDefault ? 'flag_default' : null,
        this.isSystemRole(role) ? 'flag_system' : null,
        role.sensitiveDataDisplay ? 'flag_sensitive' : null,
      ]
        .filter((flag): flag is string => !!flag)
        .map((flag) => t(`${I18N}.${flag}`))
        .join(', ');
    return tableExport<RoleEntity>({
      table: EXPORT_TABLE,
      title: t('menu.roles'),
      filters: [{ label: t(`${I18N}.search`), value: this.query().trim() }],
      columns: [
        { header: t(`${I18N}.col_title`), value: (role) => role.title || null },
        // The technical key under the title.
        { header: t(`${I18N}.key`), value: (role) => this.roleKey(role) || null },
        { header: t(`${I18N}.col_flags`), value: (role) => flags(role) || null },
        { header: t(`${I18N}.col_apps`), value: (role) => role.apps?.length || 0 },
        { header: t(`${I18N}.col_users`), value: (role) => this.userCount(role) },
        {
          header: t(`${I18N}.col_state`),
          value: (role) => t(role.state ? 'common.yes' : 'common.no'),
        },
      ],
      rows: picked.rows,
      selection: picked.selection,
    });
  };

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

  /** Users assigned to the role (the list endpoint loads the relation). */
  userCount(role: RoleEntity): number {
    return (role as RoleEntity & { users?: unknown[] }).users?.length ?? 0;
  }

  /**
   * The four SLIM roles of B1 8.1.1 are seeded (`settings.slim`) and the
   * rights matrix lives in code — they are not deletable, like the galaxy
   * admin and default roles. Everything else a tenant creates is.
   */
  /** Technical key (`settings.key`) used by the backend rules and, later, CASL. */
  roleKey(role: RoleEntity): string {
    return parseRoleSettings(role.settings).key ?? '';
  }

  isSystemRole(role: RoleEntity): boolean {
    return !!parseRoleSettings(role.settings).slim;
  }

  canDelete(role: RoleEntity): boolean {
    return !this.isSystemRole(role) && !role.hasAdminRights && !role.isDefault && this.userCount(role) === 0;
  }

  /** Opens the confirm sheet; `confirmDelete()` does the work. */
  remove(role: RoleEntity): void {
    if (!this.canDelete(role)) return;
    this.pendingDelete.set(role);
  }

  async confirmDelete(): Promise<void> {
    const role = this.pendingDelete();
    if (!role) {
      return;
    }
    this.pendingDelete.set(null);
    if (await this.facade.remove(role.roleId)) {
      await this.facade.load();
    }
  }
}
