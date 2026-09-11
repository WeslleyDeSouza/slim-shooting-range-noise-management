import { ApiProperty } from '@nestjs/swagger';
import { Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';
import { AreaEntity } from './area.entity';
import { AreaRoomEntity } from './area-room.entity';

/** Weapon categories as the usage form groups them (B1 5.11, 5.24). */
export const WEAPON_CATEGORY = [
  'artillery',
  'air_defence',
  'handguns',
  'mortar',
] as const;
export type WeaponCategory = (typeof WEAPON_CATEGORY)[number];

/** LSV Annex 7 weapon categories a–f (civil shooting). */
export const ANNEX7_CATEGORY = ['a', 'b', 'c', 'd', 'e', 'f'] as const;
export type Annex7CategoryCode = (typeof ANNEX7_CATEGORY)[number];

/**
 * Allowed combination Stellungsraum × Waffe/Kaliber (B1 5.17 «Zuordnung
 * Waffen»). One row is also one **source** of the noise model: `sourceId`
 * is the sonARMS QuellenID the WLR levels of a calculation refer to.
 */
@Entity('area_weapon')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'areaId', 'sourceId'])
export class AreaWeaponEntity extends SlimBaseEntity {
  protected self = AreaWeaponEntity;

  @ApiProperty()
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  areaId: string;

  @ApiProperty()
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  roomId: string;

  @ApiProperty({ description: 'Waffenname für die Erfassung, z. B. «Pz Hb 74 · 15.5 cm»' })
  @DbPlatformColumn({ length: 120, nullable: false })
  weaponName: string;

  @ApiProperty({ description: 'Waffe, z. B. «Pz Hb 74»' })
  @DbPlatformColumn({ length: 60, nullable: false })
  weapon: string;

  @ApiProperty({ description: 'Kaliber / Munitionstyp, z. B. «15.5 cm Spr Gr»' })
  @DbPlatformColumn({ length: 60, nullable: false })
  caliber: string;

  @ApiProperty({ enum: WEAPON_CATEGORY })
  @DbPlatformColumn({ type: 'varchar', length: 16, nullable: false })
  category: WeaponCategory;

  @ApiProperty({ enum: ANNEX7_CATEGORY, nullable: true, description: 'Waffenkategorie Anhang 7 (zivil)' })
  @DbPlatformColumn({ type: 'varchar', length: 1, nullable: true })
  annex7Category: Annex7CategoryCode | null;

  @ApiProperty({ description: 'QuellenID der Berechnungsgrundlage (sonARMS)' })
  @DbPlatformColumn({ length: 80, nullable: false })
  sourceId: string;

  @ApiProperty({ description: 'Kontingent gemäss Plangenehmigung (Schuss/Jahr)', nullable: true })
  @DbPlatformColumn({ type: 'int', nullable: true })
  quota: number | null;

  @ApiProperty()
  @DbPlatformColumn({ type: 'boolean', nullable: false, default: true })
  enabled: boolean;

  @ManyToOne(() => AreaEntity, (area) => area.weapons, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'areaId', referencedColumnName: 'id' },
  ])
  area: AreaEntity;

  @ManyToOne(() => AreaRoomEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'roomId', referencedColumnName: 'id' },
  ])
  room: AreaRoomEntity;
}
