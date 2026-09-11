import { ApiProperty } from '@nestjs/swagger';
import { Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';
import { AreaEntity } from './area.entity';

/**
 * Assignment user ↔ Schiessplatz for the «W/R-O» right of B1 8.1.2 (only
 * the assigned areas of a Schiessplatz-Verantwortlicher). Evaluated by the
 * `area-scope` rule (galaxy RulesGuard) for every `admin/area/:areaId/*`
 * request of a user whose role carries `settings.ownAreasOnly`.
 */
@Entity('area_user')
@Unique(['tenantId', 'areaId', 'userId'])
@Index(['tenantId', 'userId'])
export class AreaUserEntity extends SlimBaseEntity {
  protected self = AreaUserEntity;

  @ApiProperty()
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  areaId: string;

  @ApiProperty({ description: 'galaxy auth_user.userId' })
  @DbPlatformColumn({ type: 'varchar', length: 64, nullable: false })
  userId: string;

  @ManyToOne(() => AreaEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'areaId', referencedColumnName: 'id' },
  ])
  area: AreaEntity;
}
