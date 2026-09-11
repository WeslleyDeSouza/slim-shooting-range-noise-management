import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TranslateService } from '@app-galaxy/translate-ui';
import {
  AdminService,
  AdminTenantUserService,
  AdminUsersService,
  AuthService,
} from '@ui-slim/apiClient';
import { UsersFacade } from './users.facade';

describe('UsersFacade', () => {
  let facade: UsersFacade;
  let api: {
    userAdminCreateUser: jest.Mock;
    userAdminRestoreUser: jest.Mock;
    userAdminUpdateUser: jest.Mock;
  };
  let tenantUserApi: { tenantAdminUserAssignUser: jest.Mock };

  const conflict = (body: unknown) => ({ status: 409, error: body });

  beforeEach(() => {
    api = {
      userAdminCreateUser: jest.fn(),
      userAdminRestoreUser: jest.fn().mockReturnValue(of({})),
      userAdminUpdateUser: jest.fn().mockReturnValue(of({})),
    };
    tenantUserApi = {
      tenantAdminUserAssignUser: jest.fn().mockReturnValue(of({})),
    };

    TestBed.configureTestingModule({
      providers: [
        UsersFacade,
        { provide: AdminUsersService, useValue: api },
        { provide: AdminTenantUserService, useValue: tenantUserApi },
        { provide: AdminService, useValue: {} },
        { provide: AuthService, useValue: {} },
        {
          provide: TranslateService,
          useValue: { translate: (key: string) => key },
        },
      ],
    });

    facade = TestBed.inject(UsersFacade);
  });

  const input = {
    firstName: 'Anna',
    lastName: 'Muster',
    email: 'anna@example.ch',
  };

  it('assigns the new user to the tenant right after creating it', async () => {
    api.userAdminCreateUser.mockReturnValue(of({ userId: 'u1' }));

    const created = await facade.create(input);

    expect(created?.userId).toBe('u1');
    expect(tenantUserApi.tenantAdminUserAssignUser).toHaveBeenCalledWith({
      userId: 'u1',
      userAuthYear: new Date().getFullYear(),
    });
    expect(facade.restorableUserId()).toBeNull();
  });

  // The userId only travels for an account of the caller's own tenant, so it
  // is the one case where offering a restore is safe.
  it('offers a restore for a soft-deleted account of the own tenant', async () => {
    api.userAdminCreateUser.mockReturnValue(
      throwError(() =>
        conflict({ code: 'USER_SOFT_DELETED', userId: 'u-deleted' }),
      ),
    );

    const created = await facade.create(input);

    expect(created).toBeNull();
    expect(facade.restorableUserId()).toBe('u-deleted');
    expect(facade.error()).toBe('admin.users.restore_hint');
  });

  it('keeps a plain collision detail-free', async () => {
    api.userAdminCreateUser.mockReturnValue(
      throwError(() => conflict({ code: 'USER_EMAIL_EXISTS' })),
    );

    await facade.create(input);

    expect(facade.restorableUserId()).toBeNull();
    expect(facade.error()).toBe('admin.users.error_email_taken');
  });

  it('does not offer a restore when the conflict carries no userId', async () => {
    api.userAdminCreateUser.mockReturnValue(
      throwError(() => conflict({ code: 'USER_SOFT_DELETED' })),
    );

    await facade.create(input);

    expect(facade.restorableUserId()).toBeNull();
    expect(facade.error()).toBe('admin.users.error_email_taken');
  });

  it('reports any other failure as a create error', async () => {
    api.userAdminCreateUser.mockReturnValue(
      throwError(() => ({ status: 500, error: { message: 'boom' } })),
    );

    await facade.create(input);

    expect(facade.restorableUserId()).toBeNull();
    expect(facade.error()).toBe('boom');
  });

  it('clears a previous restore offer on the next attempt', async () => {
    api.userAdminCreateUser.mockReturnValueOnce(
      throwError(() => conflict({ code: 'USER_SOFT_DELETED', userId: 'u1' })),
    );
    await facade.create(input);
    expect(facade.restorableUserId()).toBe('u1');

    api.userAdminCreateUser.mockReturnValueOnce(of({ userId: 'u2' }));
    await facade.create(input);

    expect(facade.restorableUserId()).toBeNull();
  });

  describe('restore', () => {
    it('calls the restore endpoint and drops the offer', async () => {
      facade.restorableUserId.set('u-deleted');

      await expect(facade.restore('u-deleted')).resolves.toBe(true);

      expect(api.userAdminRestoreUser).toHaveBeenCalledWith({
        userId: 'u-deleted',
      });
      expect(facade.restorableUserId()).toBeNull();
    });

    it('keeps the offer when the restore fails', async () => {
      facade.restorableUserId.set('u-deleted');
      api.userAdminRestoreUser.mockReturnValue(
        throwError(() => ({ status: 500, error: {} })),
      );

      await expect(facade.restore('u-deleted')).resolves.toBe(false);

      expect(facade.restorableUserId()).toBe('u-deleted');
      expect(facade.error()).toBe('admin.users.error_restore');
    });
  });
});
