import { ApiProperty } from '@nestjs/swagger';
import { Entity, OneToMany, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';
import { AreaRoomEntity } from './area-room.entity';
import { AreaWeaponEntity } from './area-weapon.entity';

/** Traffic-light status of an area (quota / noise), see sitemap.md. */
/** Ampel incl. `incomplete` = «nicht beurteilbar» (Fachregel O8, see @slim/lsv NoiseState). */
export const AREA_STATUS = ['ok', 'warn', 'over', 'none', 'incomplete'] as const;
export type AreaStatus = (typeof AREA_STATUS)[number];

/**
 * Area (Schiessplatz) — ELO naming. Tenant-scoped like every galaxy entity.
 * Status columns are the evaluated result of the latest calculation; they
 * are refreshed by the calculation module (assessment) and seeded for the
 * demo tenant.
 */
// Physical table name in German (B1 12.2 / slm 51); the class keeps its English name.
@Entity('schiessplatz')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'coordinationSectionNo'])
export class AreaEntity extends SlimBaseEntity {
  protected self = AreaEntity;

  @ApiProperty({ description: 'Bezeichnung' })
  @DbPlatformColumn({ length: 120, nullable: false })
  name: string;

  @ApiProperty({ description: 'Koordinationsabschnitt-Nr.' })
  @DbPlatformColumn({ length: 20, nullable: false })
  coordinationSectionNo: string;

  @ApiProperty({ description: 'Sachplan-Nr.', nullable: true })
  @DbPlatformColumn({ type: 'varchar', length: 40, nullable: true })
  sectoralPlanNo: string | null;

  @ApiProperty({ enum: AREA_STATUS, description: 'Kontingent-Einhaltung' })
  @DbPlatformColumn({
    type: 'varchar',
    length: 8,
    nullable: false,
    default: 'none',
  })
  quotaStatus: AreaStatus;

  @ApiProperty({ enum: AREA_STATUS, description: 'Lärmbelastung' })
  @DbPlatformColumn({
    type: 'varchar',
    length: 8,
    nullable: false,
    default: 'none',
  })
  noiseStatus: AreaStatus;

  /**
   * B1 5.16 flag «Gesamtbeurteilung nach Anhang 7»: assess every usage
   * (not only the civil ones) under Annex 7 as well.
   */
  @ApiProperty({ description: 'Gesamtbeurteilung nach Anhang 7' })
  @DbPlatformColumn({ type: 'boolean', nullable: false, default: false })
  annex7Overall: boolean;

  @ApiProperty()
  @DbPlatformColumn({ type: 'boolean', nullable: false, default: true })
  enabled: boolean;

  @OneToMany(() => AreaRoomEntity, (room) => room.area)
  rooms: AreaRoomEntity[];

  @OneToMany(() => AreaWeaponEntity, (weapon) => weapon.area)
  weapons: AreaWeaponEntity[];
}
