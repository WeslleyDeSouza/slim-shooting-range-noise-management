import { LogAction } from '../../core/logger';
import {
  AuditAppLifecycleHook,
  AuditRoleLifecycleHook,
  AuditUserLifecycleHook,
} from './auth-audit.hooks';

describe('auth-audit lifecycle hooks', () => {
  let createLog: ReturnType<typeof vi.fn>;
  const logger = () => ({ createLog }) as never;

  beforeEach(() => {
    createLog = vi.fn().mockResolvedValue(undefined);
  });

  const actor = { userId: 'admin-1', source: 'self' as const };

  describe('user hook', () => {
    it('skips admin writes — the library controller already logs those', async () => {
      const hook = new AuditUserLifecycleHook(logger());
      await hook.afterUserDeleted({
        userId: 'u1',
        tenantId: 't1',
        softDeleted: true,
        actor: { userId: 'admin-1', source: 'admin' },
      } as never);

      expect(createLog).not.toHaveBeenCalled();
    });

    it('logs self-service changes with the changed fields', async () => {
      const hook = new AuditUserLifecycleHook(logger());
      await hook.afterUserUpdated({
        userId: 'u1',
        tenantId: 't1',
        actor,
        changedFields: ['firstName', 'phone'],
      } as never);

      expect(createLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          userId: 'admin-1',
          section: 'AUTH_USER',
          action: LogAction.UPDATE,
          refType: 'AUTH_USER',
          refId: 'u1',
          data: { source: 'self', changedFields: ['firstName', 'phone'] },
        }),
      );
    });
  });

  describe('role hook', () => {
    it('logs an assignment with role and target user', async () => {
      const hook = new AuditRoleLifecycleHook(logger());
      await hook.afterRoleUserAssigned({
        roleId: 7,
        tenantId: 't1',
        userId: 'u2',
        role: { title: 'VBS_ADMIN' },
        actor: { userId: 'admin-1', source: 'admin' },
      } as never);

      expect(createLog).toHaveBeenCalledWith(
        expect.objectContaining({
          section: 'AUTH_ROLE',
          action: LogAction.UPDATE,
          refType: 'ROLE_ASSIGNMENT',
          refId: '7:u2',
          data: expect.objectContaining({
            roleId: 7,
            title: 'VBS_ADMIN',
            targetUserId: 'u2',
            assigned: true,
          }),
        }),
      );
    });

    it('logs a deletion with the removed assignments', async () => {
      const hook = new AuditRoleLifecycleHook(logger());
      await hook.afterRoleDeleted({
        roleId: 7,
        tenantId: 't1',
        role: { title: 'VBS_ADMIN' },
        unassignedUserIds: ['u2', 'u3'],
        actor: { userId: 'admin-1', source: 'admin' },
      } as never);

      expect(createLog).toHaveBeenCalledWith(
        expect.objectContaining({
          section: 'AUTH_ROLE',
          action: LogAction.DELETE,
          refId: '7',
          data: { title: 'VBS_ADMIN', unassignedUserIds: ['u2', 'u3'] },
        }),
      );
    });
  });

  describe('app hook', () => {
    it('logs updates with the changed fields', async () => {
      const hook = new AuditAppLifecycleHook(logger());
      await hook.afterAppUpdated({
        appId: 31,
        tenantId: 't1',
        app: { title: 'menu.unit', path: '/admin/units' },
        changedFields: ['hiddenInMenu'],
        actor: { userId: 'admin-1', source: 'admin' },
      } as never);

      expect(createLog).toHaveBeenCalledWith(
        expect.objectContaining({
          section: 'AUTH_APP',
          action: LogAction.UPDATE,
          refType: 'AUTH_APP',
          refId: '31',
          data: {
            title: 'menu.unit',
            path: '/admin/units',
            changedFields: ['hiddenInMenu'],
          },
        }),
      );
    });
  });
});
