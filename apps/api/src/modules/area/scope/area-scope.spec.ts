import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppCategoryEntity, AppEntity, RoleEntity, RoleRightsEntity, TestMockUserMock, UserRightsEntity } from '@app-galaxy/auth-api';
import { API_MOCK_DATA } from '../../../mocks/main.mock-data';
import { RuleEngineService } from '@app-galaxy/core-api';
import { mockTenantId, mockUserId, testDbSeedBeforeEach, testDbSetup } from '@api-slim/tests';
import { CalculationModule } from '../../calculation/calculation.module';
import { DemoSeedMarkerEntity } from '../../../mocks/tenant/demo-seed-marker.entity';
import { seedDemoDataset } from '../../../mocks/tenant/demo-dataset.seed';
import { fillSlimRoles, SLIM_ROLE } from '../../../mocks/roles.mock-data';
import { UsageModule } from '../../usage/usage.module';
import { AreaModule } from '../area.module';
import { AreaService } from '../area.service';
import { AreaScopeRule } from './area-scope.rule';
import { AreaScopeService } from './area-scope.service';

const NOW = new Date(2026, 11, 31);
/** The dataset's Schiessplatz-Verantwortlicher (Geissalp + Thun). */
const RANGE_OWNER_EMAIL = 'schiessplatz@demo.ch';

async function assignRole(dataSource: DataSource, userId: string, roleId: number): Promise<void> {
  await dataSource.query('insert into app_user_right (userId, tenantId, roleId) values (?, ?, ?)', [
    userId,
    mockTenantId,
    roleId,
  ]);
}

describe('AreaScope (B1 8.1.2 «W/R-O», galaxy rule)', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let scope: AreaScopeService;
  let rule: AreaScopeRule;
  let areas: AreaService;
  let geissalpId: string;
  let thunId: string;
  let bièreId: string;
  let rangeOwnerId: string;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: testDbSetup(
        [AreaModule, UsageModule, CalculationModule],
        [
          ...AreaModule.DBOptions.entities,
          ...UsageModule.DBOptions.entities,
          ...CalculationModule.DBOptions.entities,
          DemoSeedMarkerEntity,
          AppCategoryEntity,
          AppEntity,
          RoleEntity,
          RoleRightsEntity,
          UserRightsEntity,
        ] as never[],
      ),
    }).compile();
    await module.init();
    dataSource = module.get(DataSource);
    scope = module.get(AreaScopeService);
    rule = module.get(AreaScopeRule);
    areas = module.get(AreaService);
    await testDbSeedBeforeEach(dataSource);
    // Same order as the boot seed: apps, roles, then the dataset (users reference the roles).
    await TestMockUserMock.fill.Apps(dataSource, API_MOCK_DATA.customApps as never, API_MOCK_DATA.customCategories as never);
    await fillSlimRoles(dataSource, mockTenantId);
    await seedDemoDataset(dataSource, mockTenantId, { now: NOW });
    const all = await areas.list(mockTenantId);
    geissalpId = all.find((a) => a.name === 'Geissalp')?.id as string;
    thunId = all.find((a) => a.name === 'Thun')?.id as string;
    bièreId = all.find((a) => a.name === 'Bière')?.id as string;
    const [owner] = await dataSource.query('select userId from auth_user where email = ?', [RANGE_OWNER_EMAIL]);
    rangeOwnerId = owner.userId;
  });

  afterAll(async () => {
    await module.close();
  });

  it('seeds the four roles with their rights', async () => {
    const roles: { roleId: number; title: string; settings: string }[] = await dataSource.query(
      'select roleId, title, settings from app_role where tenantId = ? and roleId >= 10 order by roleId',
      [mockTenantId],
    );
    expect(roles.map((r) => r.title)).toEqual([
      'Fachspezialist KOMZ',
      'Platzverantwortliche',
      'Interessent',
      'Applikationsadmin',
    ]);
    expect(JSON.parse(roles[1].settings)).toMatchObject({ key: 'slim_range_owner', ownAreasOnly: true, slim: true });
    expect(roles.map((r) => JSON.parse(r.settings).key)).toEqual(['slim_specialist', 'slim_range_owner', 'slim_interested', 'slim_admin']);
    const rights: { n: string }[] = await dataSource.query(
      'select count(*) as n from app_role_right where tenantId = ? and roleId = ?',
      [mockTenantId, SLIM_ROLE.INTERESTED],
    );
    expect(Number(rights[0].n)).toBe(3); // area read, data area read, weapons read
    // Idempotent.
    await fillSlimRoles(dataSource, mockTenantId);
    const again: { n: string }[] = await dataSource.query('select count(*) as n from app_role where tenantId = ? and roleId >= 10', [mockTenantId]);
    expect(Number(again[0].n)).toBe(4);
  });

  it('leaves users without a W/R-O role unrestricted', async () => {
    await assignRole(dataSource, mockUserId, SLIM_ROLE.SPECIALIST);
    expect(await scope.isRestricted(mockTenantId, mockUserId)).toBe(false);
    expect(await scope.allowedAreaIds(mockTenantId, mockUserId)).toBeNull();
    expect((await areas.list(mockTenantId, mockUserId)).length).toBe(9);
    const result = await rule.validate({
      user: { userId: mockUserId, tenantId: mockTenantId },
      action: 'GET',
      params: { areaId: thunId },
    });
    expect(result.isValid).toBe(true);
  });

  it('restricts the seeded Schiessplatz-Verantwortlicher to Geissalp and Thun', async () => {
    expect(await scope.isRestricted(mockTenantId, rangeOwnerId)).toBe(true);
    expect((await scope.allowedAreaIds(mockTenantId, rangeOwnerId))?.sort()).toEqual([geissalpId, thunId].sort());
    const visible = await areas.list(mockTenantId, rangeOwnerId);
    expect(visible.map((a) => a.name)).toEqual(['Geissalp', 'Thun']);
    expect((await areas.summary(mockTenantId, rangeOwnerId)).total).toBe(2);

    const own = await rule.validate({ user: { userId: rangeOwnerId, tenantId: mockTenantId }, action: 'GET', params: { areaId: geissalpId } });
    expect(own.isValid).toBe(true);
    const foreign = await rule.validate({ user: { userId: rangeOwnerId, tenantId: mockTenantId }, action: 'POST', params: { id: bièreId } });
    expect(foreign).toMatchObject({ isValid: false, errorCode: 'AREA_SCOPE' });
    // Without an area in the route the rule passes (lists are filtered instead).
    expect((await rule.validate({ user: { userId: rangeOwnerId, tenantId: mockTenantId }, action: 'GET', params: {} })).isValid).toBe(true);
  });

  it('re-assigning replaces the list', async () => {
    await scope.assign(mockTenantId, rangeOwnerId, [geissalpId]);
    expect(await scope.allowedAreaIds(mockTenantId, rangeOwnerId)).toEqual([geissalpId]);
    await scope.assign(mockTenantId, rangeOwnerId, [geissalpId, thunId]);
  });

  it('opens up again when an unrestricted role is added', async () => {
    await assignRole(dataSource, rangeOwnerId, SLIM_ROLE.INTERESTED);
    expect(await scope.isRestricted(mockTenantId, rangeOwnerId)).toBe(false);
    expect((await areas.list(mockTenantId, rangeOwnerId)).length).toBe(9);
  });

  it('is registered with the galaxy rule engine', () => {
    const engine = module.get(RuleEngineService);
    expect(engine.getRegisteredRules()).toContain('area-scope');
  });
});
