import { ApiProperty } from '@nestjs/swagger';
import { Entity, Index, JoinColumn, ManyToOne, OneToMany, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';
import { USAGE_CATEGORIES, UsageCategory } from '@slim/lsv';
import { AreaEntity, AreaRoomEntity } from '../../area/entities';
import { UsagePositionEntity } from './usage-position.entity';

/**
 * Nutzungskategorie (B1 5.11 «Nutzung», Tabelle 2): Militär, Zivil, Blaulicht,
 * SAT. Anhang 9 assesses all of them, Anhang 7 Zivil + SAT (see @slim/lsv).
 */
export const USAGE_TYPE = USAGE_CATEGORIES;
export type UsageType = UsageCategory;

/** Zivile Nutzungsart (B1 6.1.3, 11.2.2): mandatory when the category is «Zivil». */
export const CIVIL_USAGE_KIND = ['obligatory', 'field_shooting', 'other'] as const;
export type CivilUsageKind = (typeof CIVIL_USAGE_KIND)[number];

/** Where the row came from: typed in, the ELO interface (6.x) or an import (9.x). */
export const USAGE_SOURCE = ['manual', 'elo', 'import'] as const;
export type UsageSource = (typeof USAGE_SOURCE)[number];

/**
 * Schiessplatz-Nutzung (B1 5.11, 6.1.3, 7.4.2, Kap. 10.3): one unit shooting
 * from one Stellungsraum during one time slot of one day; the weapons shot
 * are its positions (`nutzung_position`, n × Kombination + Menge).
 *
 * The usage hangs on the permanent reference structure (Schiessplatz,
 * Stellungsraum, Kombination) and on **no** calculation state — slm 44: it
 * can be combined with any Zustand at calculation time. Physical table
 * `nutzung` (German database objects, B1 12.2 / slm 51).
 */
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

  @ApiProperty({ description: 'Benutzende Einheit, z. B. «Art Abt 10» (B1 6.1.3: max. 256 Zeichen)' })
  @DbPlatformColumn({ length: 256, nullable: false })
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

  @ApiProperty({ enum: CIVIL_USAGE_KIND, nullable: true, description: 'Zivile Nutzungsart (nur bei Kategorie Zivil)' })
  @DbPlatformColumn({ type: 'varchar', length: 16, nullable: true })
  civilUsageKind: CivilUsageKind | null;

  @ApiProperty({ nullable: true, description: 'Anzahl Personen, die geschossen haben (B1 6.1.3)' })
  @DbPlatformColumn({ type: 'int', nullable: true })
  personCount: number | null;

  @ApiProperty({ description: 'Erfasser (Anzeigename)' })
  @DbPlatformColumn({ length: 120, nullable: false, default: '' })
  recordedBy: string;

  @ApiProperty({ enum: USAGE_SOURCE })
  @DbPlatformColumn({ type: 'varchar', length: 10, nullable: false, default: 'manual' })
  source: UsageSource;

  @ApiProperty({ nullable: true, description: 'Externe Identität (z. B. ELO-Meldung), für Idempotenz' })
  @DbPlatformColumn({ type: 'varchar', length: 64, nullable: true })
  externalId: string | null;

  @ApiProperty({ nullable: true })
  @DbPlatformColumn({ type: 'text', nullable: true })
  note: string | null;

  @ManyToOne(() => AreaEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'areaId', referencedColumnName: 'id' },
  ])
  area: AreaEntity;

  /** Composite with the area: the room must belong to the same Schiessplatz. */
  @ManyToOne(() => AreaRoomEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'areaId', referencedColumnName: 'areaId' },
    { name: 'roomId', referencedColumnName: 'id' },
  ])
  room: AreaRoomEntity;

  @OneToMany(() => UsagePositionEntity, (position) => position.usage, { cascade: true })
  positions: UsagePositionEntity[];
}
