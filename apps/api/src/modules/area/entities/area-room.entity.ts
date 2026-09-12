import { ApiProperty } from '@nestjs/swagger';
import { Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';
import { AreaEntity } from './area.entity';

/**
 * Übergeordneter Stellungsraum of a Schiessplatz (B1 5.15, Kap. 10.1): the
 * permanent, time-independent reference every usage and every state's
 * Anlageteil points to — including rooms that no longer exist (`enabled`
 * false keeps them referenceable). State-specific properties (geometry,
 * Baujahr, sources) live on the Anlageteil of a Zustand, not here.
 */
// Physical table name in German (B1 12.2 / slm 51); the class keeps its English name.
@Entity('stellungsraum')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'areaId', 'id'])
@Unique(['tenantId', 'areaId', 'name'])
export class AreaRoomEntity extends SlimBaseEntity {
  protected self = AreaRoomEntity;

  @ApiProperty()
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  areaId: string;

  @ApiProperty({ description: 'Koordinationsabschnitt-Nr. (optional)', nullable: true })
  @DbPlatformColumn({ type: 'varchar', length: 20, nullable: true })
  coordinationSectionNo: string | null;

  @ApiProperty({ description: 'Bezeichnung' })
  @DbPlatformColumn({ length: 120, nullable: false })
  name: string;

  @ApiProperty({ description: 'Gruppe (Zielräume, Stellungsräume, NGST …)', nullable: true })
  @DbPlatformColumn({ type: 'varchar', length: 60, nullable: true })
  groupName: string | null;

  @ApiProperty()
  @DbPlatformColumn({ type: 'int', nullable: false, default: 0 })
  sortOrder: number;

  @ApiProperty()
  @DbPlatformColumn({ type: 'boolean', nullable: false, default: true })
  enabled: boolean;

  @ManyToOne(() => AreaEntity, (area) => area.rooms, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'areaId', referencedColumnName: 'id' },
  ])
  area: AreaEntity;
}
