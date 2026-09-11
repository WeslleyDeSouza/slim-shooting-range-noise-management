import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@app-galaxy/translate-ui';
import {
  AdminService,
  AdminUsersService,
  AuthService,
  AdminTenantUserService,
} from '@ui-slim/apiClient';
import type { RoleEntity } from '@ui-slim/apiClient';
import { AdminUser, UNLOCK_ROLE_TITLE, toAdminUser } from './user.model';

/**
 * Signals facade of the user administration (`/admin/users`), entirely on
 * the generated clients: list via `userAdminGetUsersWithInfo`, CRUD via
 * `AdminUsersService`, role assignment via the `roleAdminUserRights*`
 * operations and the password-reset mail via the public auth endpoint.
 */
@Injectable()
export class UsersFacade {
  private readonly api = inject(AdminUsersService);
  private readonly roleApi = inject(AdminService);
  private readonly authApi = inject(AuthService);
  private readonly tenantUserApi = inject(AdminTenantUserService);
  private readonly translate = inject(TranslateService);

  readonly loading = signal(false);
  readonly users = signal<AdminUser[]>([]);
  readonly roles = signal<RoleEntity[]>([]);
  readonly error = signal<string | null>(null);

  /**
   * Soft-deleted account occupying the entered email address, restorable by
   * the caller. The API only discloses the `userId` when that account belongs
   * to the caller's tenant; every other collision leaves this empty.
   */
  readonly restorableUserId = signal<string | null>(null);

  /** Role ids of the SIGNED-IN admin, see `loadMyRoles`. */
  readonly myRoleIds = signal<ReadonlySet<number>>(new Set());

  /**
   * Whether the signed-in admin may lift an account lock (Si001 T7.4): a role
   * with admin rights («Superadmin») or the VBS_ADMIN role. Fail-closed until
   * both the tenant roles and the own assignments are loaded; the API enforces
   * the same rule.
   */
  readonly canUnlock = computed(() => {
    const mine = this.myRoleIds();
    return this.roles().some(
      (role) =>
        role.roleId !== undefined &&
        mine.has(role.roleId) &&
        (!!role.hasAdminRights || role.title === UNLOCK_ROLE_TITLE),
    );
  });

  async loadMyRoles(userId: string): Promise<void> {
    if (!userId) {
      return;
    }
    this.myRoleIds.set(new Set(await this.rolesOf(userId)));
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const rows = (await firstValueFrom(
        this.api.userAdminGetUsersWithInfo({
          loginInfo: true,
          roleInfo: true,
          additionalInfos: '',
        }),
      )) as unknown as Parameters<typeof toAdminUser>[0][];
      this.users.set((rows ?? []).map(toAdminUser));
    } catch (error) {
      this.error.set(this.messageOf(error, this.t('error_load')));
    } finally {
      this.loading.set(false);
    }
  }

  /** All roles of the tenant — the checkboxes of the form. */
  async loadRoles(): Promise<void> {
    try {
      const roles = await firstValueFrom(this.roleApi.roleAdminGetRoles());
      this.roles.set((roles as RoleEntity[]) ?? []);
    } catch {
      this.roles.set([]);
    }
  }

  async get(userId: string): Promise<AdminUser | null> {
    try {
      const dto = await firstValueFrom(this.api.userAdminGetUser({ userId }));
      return dto ? toAdminUser(dto as never) : null;
    } catch (error) {
      this.error.set(this.messageOf(error, this.t('error_load_one')));
      return null;
    }
  }

  /** Role ids currently assigned to the user. */
  async rolesOf(userId: string): Promise<number[]> {
    try {
      const roles = (await firstValueFrom(
        this.roleApi.roleAdminUserRightsGetUserRoles({ userId }),
      )) as { roleId?: number }[];
      return (roles ?? [])
        .map((role) => role.roleId)
        .filter((id): id is number => id !== undefined);
    } catch {
      return [];
    }
  }

  async create(input: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    /** Require a new password on the first login (server default: off). */
    resetPassword?: boolean;
  }): Promise<AdminUser | null> {
    this.error.set(null);
    this.restorableUserId.set(null);
    try {
      const created = (await firstValueFrom(
        this.api.userAdminCreateUser({ body: input as never }),
      )) as { userId?: string } | null;
      if (!created?.userId) {
        return null;
      }
      // Der neue Benutzer gehört sofort zum Mandanten (wie im alten Admin).
      await firstValueFrom(
        this.tenantUserApi.tenantAdminUserAssignUser({
          userId: created.userId,
          userAuthYear: new Date().getFullYear(),
        }),
      ).catch(() => undefined);
      return { ...(created as never as AdminUser) };
    } catch (error) {
      const conflict = this.conflictOf(error);
      // `USER_SOFT_DELETED` only arrives for an account of the caller's own
      // tenant, and then carries the `userId` needed to restore it. Every
      // other collision stays detail-free on purpose: it may well be an
      // active account of a foreign tenant.
      if (conflict?.code === 'USER_SOFT_DELETED' && conflict.userId) {
        this.restorableUserId.set(conflict.userId);
        this.error.set(this.t('restore_hint'));
        return null;
      }
      if (conflict) {
        this.error.set(this.t('error_email_taken'));
        return null;
      }
      this.error.set(this.messageOf(error, this.t('error_create')));
      return null;
    }
  }

  /**
   * Restores a soft-deleted account. The server only lifts the deletion:
   * previous roles are not granted again, a password change is enforced and
   * all older sessions are dropped.
   */
  async restore(userId: string): Promise<boolean> {
    this.error.set(null);
    try {
      await firstValueFrom(this.api.userAdminRestoreUser({ userId }));
      this.restorableUserId.set(null);
      return true;
    } catch (error) {
      this.error.set(this.messageOf(error, this.t('error_restore')));
      return false;
    }
  }

  async update(
    userId: string,
    input: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      /** Force (true) or lift (false) the new-password demand at next login. */
      resetPassword?: boolean;
    },
  ): Promise<boolean> {
    this.error.set(null);
    try {
      await firstValueFrom(
        this.api.userAdminUpdateUser({ userId, body: input as never }),
      );
      return true;
    } catch (error) {
      this.error.set(this.messageOf(error, this.t('error_save')));
      return false;
    }
  }

  async remove(userId: string): Promise<boolean> {
    this.error.set(null);
    try {
      await firstValueFrom(this.api.userAdminDeleteUser({ userId }));
      return true;
    } catch (error) {
      this.error.set(this.messageOf(error, this.t('error_delete')));
      return false;
    }
  }

  async assignRole(userId: string, roleId: number): Promise<boolean> {
    try {
      await firstValueFrom(
        this.roleApi.roleAdminUserRightsAssignRole({
          body: { userId, roleId } as never,
        }),
      );
      return true;
    } catch (error) {
      this.error.set(this.messageOf(error, this.t('error_role')));
      return false;
    }
  }

  async unassignRole(userId: string, roleId: number): Promise<boolean> {
    try {
      await firstValueFrom(
        this.roleApi.roleAdminUserRightsUnassignRole({
          body: { userId, roleId } as never,
        }),
      );
      return true;
    } catch (error) {
      this.error.set(this.messageOf(error, this.t('error_role')));
      return false;
    }
  }

  /**
   * Lock state of one account. `userAdminGetUser` returns the raw entity
   * without the computed `locked` flag, so the decorated list is asked
   * instead; `null` when the user is not in it.
   */
  async lockState(
    userId: string,
  ): Promise<Pick<AdminUser, 'locked' | 'loginAttempt'> | null> {
    try {
      const rows = (await firstValueFrom(
        this.api.userAdminGetUsersWithInfo({
          loginInfo: true,
          roleInfo: false,
          additionalInfos: '',
        }),
      )) as unknown as Parameters<typeof toAdminUser>[0][];
      const row = (rows ?? []).find((entry) => entry.userId === userId);
      if (!row) {
        return null;
      }
      const user = toAdminUser(row);
      return { locked: user.locked, loginAttempt: user.loginAttempt };
    } catch {
      return null;
    }
  }

  /**
   * Lifts the account lock (Si001 T7.4, manual unlock mode) and resets the
   * failed-attempt counters; the API logs it as `AUTH_USER_UNLOCKED`.
   */
  async unlock(userId: string): Promise<boolean> {
    this.error.set(null);
    try {
      await firstValueFrom(this.api.userAdminUnlockUser({ userId }));
      this.users.update((users) =>
        users.map((user) =>
          user.userId === userId
            ? { ...user, locked: false, loginAttempt: 0 }
            : user,
        ),
      );
      return true;
    } catch (error) {
      this.error.set(this.messageOf(error, this.t('error_unlock')));
      return false;
    }
  }

  /** Sends the password-reset mail (same flow as «Passwort vergessen»). */
  async sendPasswordReset(email: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.authApi.authRequestPasswordToken({ body: { email } as never }),
      );
      return true;
    } catch (error) {
      this.error.set(this.messageOf(error, this.t('error_reset')));
      return false;
    }
  }

  /** i18n lookup with the key itself as last-resort fallback. */
  private t(key: string): string {
    return this.translate.translate(`admin.users.${key}`) ?? key;
  }

  /** Conflict payload of a 409, `null` for every other error. */
  private conflictOf(
    error: unknown,
  ): { code?: string; userId?: string } | null {
    const response = error as {
      status?: number;
      error?: { code?: string; userId?: string };
    };
    return response?.status === 409 ? (response.error ?? {}) : null;
  }

  private messageOf(error: unknown, fallback: string): string {
    const message = (error as { error?: { message?: unknown } })?.error?.message;
    return typeof message === 'string' && message ? message : fallback;
  }
}
