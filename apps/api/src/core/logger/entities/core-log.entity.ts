import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Index,
  BeforeInsert,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DbPlatformColumn, TenantBaseEntity } from '@app-galaxy/core-api';
import { LogAction } from '../dto/log-action.enum';
import { UserEntity } from '@app-galaxy/auth-api';

@Entity('core_log_user')
@Index(['tenantId'])
@Index(['tenantId', 'section', 'action'])
export class CoreLogEntity extends TenantBaseEntity {
  self = CoreLogEntity;

  @PrimaryGeneratedColumn('uuid')
  logId: string;

  // Who created the log: either a user (uuid) or the system
  @DbPlatformColumn({ type: 'uuid', nullable: true })
  userId: string | null;

  @DbPlatformColumn({ type: 'boolean', default: false })
  isSystem: boolean;

  @DbPlatformColumn({ type: 'varchar', length: 100 })
  section: string;

  @DbPlatformColumn({ type: 'varchar', length: 100 })
  action: LogAction;

  @DbPlatformColumn({ type: 'varchar', length: 50, nullable: true })
  refType: string;

  @DbPlatformColumn({ type: 'varchar', length: 64, nullable: true })
  refId: string;

  @DbPlatformColumn({ type: 'varchar', length: 20, nullable: true })
  message: string;

  // free-form data, JSON stored as text for portability
  @DbPlatformColumn({ type: 'text', nullable: true })
  data: string | null;

  // Audit context (redesign logbook): request origin, filled when available
  @DbPlatformColumn({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  @DbPlatformColumn({ type: 'varchar', length: 120, nullable: true })
  device: string | null;

  // Set by the ORM, not by a column default: with `DEFAULT CURRENT_TIMESTAMP`
  // TypeORM still writes the (undefined) property into the INSERT, so on
  // SQLite every entry ended up with `createdAt = NULL` — the logbook then
  // showed nothing for any date range.
  // No explicit type: `timestamp` is a MySQL type SQLite rejects outright, and
  // TypeORM picks the right one per driver on its own.
  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @BeforeInsert()
  async beforeInsert(): Promise<void> {
    // TenantBaseEntity contract; nothing to derive for log rows.
  }
}
