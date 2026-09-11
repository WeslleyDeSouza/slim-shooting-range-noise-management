import { Test, TestingModule } from '@nestjs/testing';
import { Column, DataSource, Entity } from 'typeorm';
import { BaseEntity } from '@api-slim/models';
import { testDbSetup } from './utils';

@Entity('test_note')
class NoteEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 64 })
  title!: string;
}

describe('testDbSetup (in-memory SQLite)', () => {
  let module: TestingModule;
  let dataSource: DataSource;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: testDbSetup([], [NoteEntity]),
    }).compile();
    dataSource = module.get(DataSource);
  });

  afterEach(async () => {
    await module.close();
  });

  it('creates the schema and persists an entity with audit columns', async () => {
    const repo = dataSource.getRepository(NoteEntity);
    const saved = await repo.save(repo.create({ title: 'hello' }));

    expect(saved.id).toBe(1);
    expect(saved.created).toBeInstanceOf(Date);
    expect(await repo.count()).toBe(1);
  });

  it('starts from an empty database for every test', async () => {
    expect(await dataSource.getRepository(NoteEntity).count()).toBe(0);
  });
});
