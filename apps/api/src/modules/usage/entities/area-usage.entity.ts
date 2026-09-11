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

/** Unit of the quantity: shots (Stück) or kilograms of explosive (B1 6.2, 11.2.3). */
export const QUANTITY_UNIT = ['shots', 'kg'] as const;
export type QuantityUnit = (typeof QUANTITY_UNIT)[number];

/** DECIMAL comes back as a string from MySQL/PostgreSQL drivers — keep it a number in the entity. */
const decimalToNumber = { to: (v: number) => v, from: (v: string | number | null) => (v == null ? v : Number(v)) };
export type UsageSource = (typeof USAGE_SOURCE)[number];

/**
 * Schiessplatz-Nutzung (B1 5.11, 7.4.1): one unit shooting one weapon /
 * calibre from one Stellungsraum during one time slot. The raw material
 * of the noise calculation (7.4) and of the quota check (5.10).
 */
// Physical table name in German (B1 12.2 / slm 51); the class keeps its English name.
@Entity('nutzung')
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

  /** Menge als Dezimalzahl (B1 6.2/11.2.3): Anzahl Schuss oder kg Sprengstoff, 3 Dezimalen. */
  @ApiProperty({ description: 'Menge (Dezimalzahl): Anzahl Schuss oder kg Sprengstoff' })
  @DbPlatformColumn({ type: 'decimal', precision: 12, scale: 3, nullable: false, default: 0, transformer: decimalToNumber })
  shots: number;

  @ApiProperty({ enum: QUANTITY_UNIT, description: 'Einheit der Menge: Stück oder kg' })
  @DbPlatformColumn({ type: 'varchar', length: 5, nullable: false, default: 'shots' })
  quantityUnit: QuantityUnit;

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
