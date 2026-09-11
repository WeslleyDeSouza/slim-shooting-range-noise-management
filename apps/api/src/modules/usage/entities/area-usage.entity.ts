import { ApiProperty } from '@nestjs/swagger';
import { Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';
import { USAGE_CATEGORIES, UsageCategory } from '@slim/lsv';
import { AreaEntity, AreaRoomEntity, AreaWeaponEntity } from '../../area/entities';

/**
 * Nutzungskategorie (B1 5.11 «Nutzung», Tabelle 2): Militär, Zivil, Blaulicht,
 * SAT. Anhang 9 assesses all of them, Anhang 7 Zivil + SAT (see @slim/lsv).
 */
export const USAGE_TYPE = USAGE_CATEGORIES;
export type UsageType = UsageCategory;

/** Where the row came from: typed in, the ELO interface (6.x) or an import (9.x). */
export const USAGE_SOURCE = ['manual', 'elo', 'import'] as const;
export type UsageSource = (typeof USAGE_SOURCE)[number];

/**
 * Schiessplatz-Nutzung (B1 5.11, 7.4.1): one unit shooting one weapon /
 * calibre from one Stellungsraum during one time slot. The raw material
 * of the noise calculation (7.4) and of the quota check (5.10).
 */
@Entity('area_usage')
@Unique(['tenantId', 'id'])
@Index(['tenantId', 'areaId', 'date'])
export class AreaUsageEntity extends SlimBaseEntity {
  protected self = AreaUsageEntity;

  @ApiProperty()
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  areaId: string;

  @ApiProperty()
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  roomId: string;

  /** The allowed room × weapon combination (= the noise source). */
  @ApiProperty()
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  weaponId: string;

  @ApiProperty({ description: 'Nutzungseinheit, z. B. «Art Abt 10»' })
  @DbPlatformColumn({ length: 120, nullable: false })
  unit: string;

  @ApiProperty({ description: 'Datum YYYY-MM-DD' })
  @DbPlatformColumn({ type: 'varchar', length: 10, nullable: false })
  date: string;

  @ApiProperty({ description: 'Von HH:mm' })
  @DbPlatformColumn({ type: 'varchar', length: 5, nullable: false })
  timeFrom: string;

  @ApiProperty({ description: 'Bis HH:mm' })
  @DbPlatformColumn({ type: 'varchar', length: 5, nullable: false })
  timeTo: string;

  @ApiProperty({ enum: USAGE_TYPE })
  @DbPlatformColumn({ type: 'varchar', length: 10, nullable: false })
  usageType: UsageType;

  @ApiProperty({ description: 'Anzahl Schuss' })
  @DbPlatformColumn({ type: 'int', nullable: false, default: 0 })
  shots: number;

  @ApiProperty({ description: 'Erfasser (Anzeigename)' })
  @DbPlatformColumn({ length: 120, nullable: false, default: '' })
  recordedBy: string;

  @ApiProperty({ enum: USAGE_SOURCE })
  @DbPlatformColumn({ type: 'varchar', length: 10, nullable: false, default: 'manual' })
  source: UsageSource;

  @ApiProperty({ nullable: true })
  @DbPlatformColumn({ type: 'text', nullable: true })
  note: string | null;

  @ManyToOne(() => AreaEntity, { onDelete: 'CASCADE' })
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

  @ManyToOne(() => AreaWeaponEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'weaponId', referencedColumnName: 'id' },
  ])
  weapon: AreaWeaponEntity;
}
