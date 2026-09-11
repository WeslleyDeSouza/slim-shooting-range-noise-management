import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { mockTenantId, mockUserId, testDbSeedBeforeEach, testDbSetup } from '@api-slim/tests';
import { TenantUserRoleEntity } from '@app-galaxy/core-api';
import { AuthTenantResolver } from './auth-tenant.resolver';

describe('AuthTenantResolver (tenant of login-phase log entries)', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let resolver: AuthTenantResolver;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: testDbSetup([], []),
      providers: [AuthTenantResolver],
    }).compile();
    await module.init();
    dataSource = module.get(DataSource);
    resolver = module.get(AuthTenantResolver);
    await testDbSeedBeforeEach(dataSource);
    // Membership of the mock user (the demo seed writes the same row).
    const membership = dataSource.getRepository(TenantUserRoleEntity);
    await membership.save(
      membership.create({ tenantId: mockTenantId, userId: mockUserId, roles: 'root', userCreatedAt: 2026 } as Partial<TenantUserRoleEntity>),
    );
  });

  afterAll(async () => {
    await module.close();
  });

  it('keeps the tenant of the context when the event carries one', async () => {
    expect(await resolver.forEvent({ tenantId: 'ctx-tenant', userId: mockUserId })).toEqual(['ctx-tenant']);
  });

  it('takes the memberships of the account for a login without tenant', async () => {
    expect(await resolver.forEvent({ tenantId: null, userId: mockUserId })).toEqual([mockTenantId]);
  });

  it('falls back to the only tenant of the installation for unknown accounts', async () => {
    expect(await resolver.forEvent({ userId: null })).toEqual([mockTenantId]);
    expect(await resolver.forEvent({ userId: 'nobody' })).toEqual([mockTenantId]);
  });

  it('leaves the row unscoped when several tenants exist and none matches (runs last)', async () => {
    // Copy the mock tenant row under a second id — the column set is galaxy's.
    const cols = ((await dataSource.query('pragma table_info(tenant)')) as { name: string }[])
      .map((c) => c.name)
      .filter((c) => !['tenantId', 'workspaceName'].includes(c));
    await dataSource.query(
      `insert into tenant (tenantId, workspaceName, ${cols.join(', ')}) select 'second', 'second', ${cols.join(', ')} from tenant where tenantId = ?`,
      [mockTenantId],
    );
    expect(await resolver.forEvent({ userId: 'nobody' })).toEqual(['']);
    // A member still resolves to its own tenant.
    expect(await resolver.forEvent({ userId: mockUserId })).toEqual([mockTenantId]);
  });
});
