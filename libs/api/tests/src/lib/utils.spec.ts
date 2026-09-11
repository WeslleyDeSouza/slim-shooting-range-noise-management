import { Test, TestingModule } from '@nestjs/testing';
import { Column, DataSource, Entity } from 'typeorm';
import { BaseEntity } from '@api-slim/models';
import { mockTenantId } from './constants';
import { testDbSeedBeforeEach, testDbSetup } from './utils';

@Entity('test_note')
class NoteEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 64 })
  title!: string;
}

describe('testDbSetup (in-memory SQLite with galaxy tenant/user tables)', () => {
  let module: TestingModule;
  let dataSource: DataSource;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: testDbSetup([], [NoteEntity]),
    }).compile();
    dataSource = module.get(DataSource);
    await testDbSeedBeforeEach(dataSource);
  });

  afterEach(async () => {
    await module.close();
  });

  it('seeds the mock tenant and persists an own entity', async () => {
    const tenants = await dataSource.query(
      'select tenantId from tenant where tenantId = ?',
      [mockTenantId],
    );
    expect(tenants.length).toBe(1);

    const repo = dataSource.getRepository(NoteEntity);
    const saved = await repo.save(repo.create({ title: 'hello' }));
    expect(saved.id).toBe(1);
    expect(saved.created).toBeInstanceOf(Date);
  });
});
