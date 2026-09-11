import { ApiProperty } from '@nestjs/swagger';
import { Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';
import { AreaEntity } from './area.entity';

/**
 * Stellungsraum of an area (B1 5.15): where a unit shoots from. Sources of
 * the noise model (sonARMS) hang off room × weapon (`AreaWeaponEntity`).
 * `builtAfter1985` drives which LSV limit applies (7.7: Planungswert for
 * new plant parts, Immissionsgrenzwert for the rest).
 */
@Entity('area_room')
@Unique(['tenantId', 'id'])
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

  @ApiProperty({ description: 'Anlageteil nach 1985 erstellt (Planungswert gilt)' })
  @DbPlatformColumn({ type: 'boolean', nullable: false, default: false })
  builtAfter1985: boolean;

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
