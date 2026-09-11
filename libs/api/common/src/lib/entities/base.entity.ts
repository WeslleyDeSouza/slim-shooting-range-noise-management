import { ApiProperty } from '@nestjs/swagger';
import {
  BeforeInsert,
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantBaseEntity } from '@app-galaxy/core-api';

/**
 * Base of every SLIM entity. Extends the galaxy `TenantBaseEntity` (the
 * `tenantId` column the TenantGuard / `@GetTenantId()` rely on, `self`,
 * `setLastEntryId*`, class-transformer `toJSON`) and adds what all our
 * tables share: a uuid primary key and the audit columns. Concrete entities
 * still declare `protected self = TheEntity` and may override
 * `beforeInsert()`.
 */
export abstract class SlimBaseEntity extends TenantBaseEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  @BeforeInsert()
  protected async beforeInsert(): Promise<void> {
    // TenantBaseEntity contract; hook for numbering (setLastEntryId) etc.
  }
}
