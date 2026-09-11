import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@app-galaxy/translate-ui';
import { AdminService, AdminUsersService } from '@ui-slim/apiClient';
import type { AppSimpleDto, CreateRoleDto, RoleEntity } from '@ui-slim/apiClient';

/** Zugriffsstufen einer App in einer Rolle ('' = kein Zugriff). */
export const ROLE_ACCESS_LEVELS = ['', 'read', 'write', 'delete', 'root'] as const;
export type RoleAccess = (typeof ROLE_ACCESS_LEVELS)[number];

/**
 * Signals facade of the role administration (`/admin/roles`) on the
 * generated `AdminService` (`roleAdmin*`): CRUD, the app catalog for the
 * permission matrix and the user assignment per role.
 */

/** Ein Benutzer, wie ihn die Rollenmaske zum Zuweisen braucht. */
export interface RoleUserOption {
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class RolesFacade {
  private readonly api = inject(AdminService);
  private readonly translate = inject(TranslateService);
  private readonly userApi = inject(AdminUsersService);

  readonly loading = signal(false);
  readonly roles = signal<RoleEntity[]>([]);
  readonly apps = signal<AppSimpleDto[]>([]);
  readonly error = signal<string | null>(null);
  readonly users = signal<RoleUserOption[]>([]);

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const roles = await firstValueFrom(this.api.roleAdminGetRoles());
      this.roles.set((roles as RoleEntity[]) ?? []);
    } catch (error) {
      this.error.set(this.messageOf(error, this.t('error_load')));
    } finally {
      this.loading.set(false);
    }
  }

  /** Der App-Katalog — die Zeilen der Berechtigungs-Matrix. */
  async loadApps(): Promise<void> {
    try {
      const apps = await firstValueFrom(this.api.roleAdminGetApps({ domain: 'business' }));
      this.apps.set((apps as AppSimpleDto[]) ?? []);
    } catch {
      this.apps.set([]);
    }
  }

  async get(roleId: number): Promise<RoleEntity | null> {
    try {
      const role = await firstValueFrom(
        this.api.roleAdminGetRoleById({ roleId }),
      );
      return (role as RoleEntity) ?? null;
    } catch (error) {
      this.error.set(this.messageOf(error, this.t('error_load_one')));
      return null;
    }
  }

  async create(body: CreateRoleDto): Promise<RoleEntity | null> {
    this.error.set(null);
    try {
      const role = await firstValueFrom(this.api.roleAdminCreateRole({ body }));
      return (role as RoleEntity) ?? null;
    } catch (error) {
      this.error.set(this.messageOf(error, this.t('error_create')));
      return null;
    }
  }

  async update(roleId: number, body: CreateRoleDto): Promise<boolean> {
    this.error.set(null);
    try {
      await firstValueFrom(
        this.api.roleAdminUpdateRole({ roleId, body } as never),
      );
      return true;
    } catch (error) {
      this.error.set(this.messageOf(error, this.t('error_save')));
      return false;
    }
  }

  async remove(roleId: number): Promise<boolean> {
    this.error.set(null);
    try {
      await firstValueFrom(this.api.roleAdminDeleteRole({ roleId }));
      return true;
    } catch (error) {
      this.error.set(this.messageOf(error, this.t('error_delete')));
      return false;
    }
  }

  /**
   * Alle Benutzer des Mandanten, fuer die Zuweisung in der Rollenmaske.
   *
   * Bewusst dieselbe Quelle wie die Benutzerliste: eine zweite, schlankere
   * Abfrage wuerde frueher oder spaeter andere Namen anzeigen als dort.
   */
  async loadUsers(): Promise<void> {
    try {
      const rows = (await firstValueFrom(
        this.userApi.userAdminGetUsersWithInfo({
          loginInfo: false,
          roleInfo: false,
          additionalInfos: '',
        }),
      )) as unknown as RoleUserOption[];
      this.users.set(
        (rows ?? []).map((row) => ({
          userId: row.userId,
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
        })),
      );
    } catch {
      this.users.set([]);
    }
  }

  /** UserIds, die der Rolle zugewiesen sind. */
  async usersOf(roleId: number): Promise<string[]> {
    try {
      const users = (await firstValueFrom(
        this.api.roleAdminUserRightsGetRoleUsers({ roleId }),
      )) as { userId?: string }[];
      return (users ?? [])
        .map((user) => user.userId)
        .filter((id): id is string => !!id);
    } catch {
      return [];
    }
  }

  async assignUser(roleId: number, userId: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.api.roleAdminUserRightsAssignRole({ body: { roleId, userId } }),
      );
      return true;
    } catch (error) {
      this.error.set(this.messageOf(error, this.t('error_assign')));
      return false;
    }
  }

  async unassignUser(roleId: number, userId: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.api.roleAdminUserRightsUnassignRole({
          body: { roleId, userId } as never,
        }),
      );
      return true;
    } catch (error) {
      this.error.set(this.messageOf(error, this.t('error_assign')));
      return false;
    }
  }

  /** i18n lookup with the key itself as last-resort fallback. */
  private t(key: string): string {
    return this.translate.translate(`admin.roles.${key}`) ?? key;
  }

  private messageOf(error: unknown, fallback: string): string {
    const message = (error as { error?: { message?: unknown } })?.error?.message;
    return typeof message === 'string' && message ? message : fallback;
  }
}
