import type { UserAdminResponseDto } from '@ui-slim/apiClient';

/**
 * Domain view of an admin-managed user for `/admin/users`. The list comes
 * from `userAdminGetUsersWithInfo`, which decorates the base user with the
 * role titles and the last login — both arrive loosely typed, hence the
 * defensive mapping here.
 */
export interface AdminUser {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatar: string;
  /** Role titles for the chips in the overview. */
  roles: string[];
  loginLast: string;
  createdAt: string;
  deleted: boolean;
  /** Forced new password at the next login (admin-set or fresh account). */
  resetPasswordRequired: boolean;
  /**
   * Account locked after too many failed password logins (Si001 T7.4). Only
   * the `usersWithInfo` list computes this; the single-user endpoint does not.
   */
  locked: boolean;
  /** Failed password logins since the last successful one or unlock. */
  loginAttempt: number;
}

/** The decorated row `usersWithInfo` actually delivers. */
type UserWithInfo = UserAdminResponseDto & {
  roleInfo?: { title?: string }[] | string[];
  roles?: { title?: string }[] | string[];
  loginLast?: string;
  createdAt?: string;
  deleted?: boolean;
  locked?: boolean;
  loginAttempt?: number;
  resetPasswordRequired?: boolean;
};

export function toAdminUser(dto: UserWithInfo): AdminUser {
  const rawRoles = dto.roleInfo ?? dto.roles ?? [];
  const roles = rawRoles
    .map((role: { title?: string } | string) =>
      typeof role === 'string' ? role : (role?.title ?? ''),
    )
    .filter(Boolean);
  return {
    userId: dto.userId,
    firstName: dto.firstName ?? '',
    lastName: dto.lastName ?? '',
    email: dto.email ?? '',
    phone: dto.phone ?? '',
    avatar: dto.avatar ?? '',
    roles,
    loginLast: dto.loginLast ?? '',
    createdAt: dto.createdAt ?? '',
    deleted: !!dto.deleted,
    resetPasswordRequired: !!dto.resetPasswordRequired,
    locked: !!dto.locked,
    loginAttempt: Number(dto.loginAttempt) || 0,
  };
}

/**
 * Role title that may lift an account lock besides roles with admin rights
 * (mirrors `API_AUTH_UNLOCK_ROLE_TITLE` of the API, Si001 T7.4).
 */
export const UNLOCK_ROLE_TITLE = 'VBS_ADMIN';

/** Client-side filter of the overview, pure for unit tests. */
export function filterAdminUsers(users: AdminUser[], query: string): AdminUser[] {
  const q = query.toLowerCase().trim();
  if (!q) {
    return users;
  }
  return users.filter((user) =>
    [user.firstName, user.lastName, user.email, user.phone, user.roles.join(' ')]
      .join(' ')
      .toLowerCase()
      .includes(q),
  );
}

/** «VW» aus «Vorname Wesname» — Avatar-Fallback der Liste. */
export function initialsOf(user: AdminUser): string {
  return `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() || '?';
}
