import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { APP_ROUTES } from '@slim/shared';
import type { RoleEntity } from '@ui-slim/apiClient';
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
  templateUrl: './roles-overview.component.html',
  styleUrl: './roles-overview.component.scss',
})
export class EloRolesOverviewComponent extends ComponentBase {
  protected readonly prefix = I18N;
  protected readonly routes = APP_ROUTES;
  /** Row waiting for the confirm sheet. */
  readonly pendingDelete = signal<RoleEntity | null>(null);
  protected readonly facade = inject(RolesFacade);

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

  /** Users assigned to the role (the list endpoint loads the relation). */
  userCount(role: RoleEntity): number {
    return (role as RoleEntity & { users?: unknown[] }).users?.length ?? 0;
  }

  /**
   * The four SLIM roles of B1 8.1.1 are seeded (`settings.slim`) and the
   * rights matrix lives in code — they are not deletable, like the galaxy
   * admin and default roles. Everything else a tenant creates is.
   */
  isSystemRole(role: RoleEntity): boolean {
    return !!(role.settings as { slim?: boolean } | undefined)?.slim;
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
