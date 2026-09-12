import { ApiProperty } from '@nestjs/swagger';
import { Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';
import { AreaEntity } from './area.entity';
import { AreaRoomEntity } from './area-room.entity';
import { WeaponCombinationEntity } from './weapon-combination.entity';

/**
 * Zulässige Kombination Waffe/Kaliber je Stellungsraum (B1 5.17 «Zuordnung
 * Waffen», Kap. 10 «Zulässige Kombination»): which combination may be entered
 * for which room, with the «Waffenname für die Erfassung» (a group label
 * for the Schiessplatz-Nutzer). Übergeordnete Stammdaten — it carries no
 * source of the noise model; the sources belong to the states.
 *
 * Disabling an assignment stops new entries; historical usages keep
 * referring to the combination itself (`nutzung_position`). Physical table
 * `stellungsraum_kombination`.
 */
@Entity('stellungsraum_kombination')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'roomId', 'combinationId'])
export class RoomCombinationEntity extends SlimBaseEntity {
  protected self = RoomCombinationEntity;

  @ApiProperty()
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  areaId: string;

  @ApiProperty()
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  roomId: string;

  @ApiProperty()
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  combinationId: string;

  @ApiProperty({ description: 'Waffenname für die Erfassung, z. B. «Pz Hb 74 · 15.5 cm»' })
  @DbPlatformColumn({ length: 120, nullable: false })
  entryName: string;

  @ApiProperty()
  @DbPlatformColumn({ type: 'boolean', nullable: false, default: true })
  enabled: boolean;

  @ManyToOne(() => AreaEntity, (area) => area.combinations, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'areaId', referencedColumnName: 'id' },
  ])
  area: AreaEntity;

  /** Composite key with the area: a room of another Schiessplatz cannot be assigned. */
  @ManyToOne(() => AreaRoomEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'areaId', referencedColumnName: 'areaId' },
    { name: 'roomId', referencedColumnName: 'id' },
  ])
  room: AreaRoomEntity;

  @ManyToOne(() => WeaponCombinationEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'combinationId', referencedColumnName: 'id' },
  ])
  combination: WeaponCombinationEntity;
}
