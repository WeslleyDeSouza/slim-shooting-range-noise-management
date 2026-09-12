import { ApiProperty } from '@nestjs/swagger';
import { Entity, OneToMany, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';
import { AreaRoomEntity } from './area-room.entity';
import { RoomCombinationEntity } from './room-combination.entity';

/** Traffic-light status of an area (quota / noise), see sitemap.md. */
/** Ampel incl. `incomplete` = «nicht beurteilbar» (Fachregel O8, see @slim/lsv NoiseState). */
export const AREA_STATUS = ['ok', 'warn', 'over', 'none', 'incomplete'] as const;
export type AreaStatus = (typeof AREA_STATUS)[number];

/**
 * Explains a traffic light (B1 5.9 / 5.10 — «keine Daten» has different
 * meanings): `no-calculation` (no current state) and `no-usages` (nothing
 * recorded in the period) accompany «none»; `no-quota` marks a computed
 * Kontingent light in which a shot combination has no Kontingent (Soll 0).
 */
export const AREA_STATUS_REASON = ['no-calculation', 'no-usages', 'no-quota'] as const;
export type AreaStatusReason = (typeof AREA_STATUS_REASON)[number];

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

  @ApiProperty({ enum: AREA_STATUS_REASON, nullable: true, description: 'Grund für «none» bei der Kontingent-Ampel' })
  @DbPlatformColumn({ type: 'varchar', length: 16, nullable: true })
  quotaStatusReason: AreaStatusReason | null;

  @ApiProperty({ enum: AREA_STATUS_REASON, nullable: true, description: 'Grund für «none» bei der Lärm-Ampel' })
  @DbPlatformColumn({ type: 'varchar', length: 16, nullable: true })
  noiseStatusReason: AreaStatusReason | null;

  @ApiProperty({ nullable: true, description: 'Berechnungsstand (Zustand), auf dem die Lärm-Ampel beruht' })
  @DbPlatformColumn({ type: 'varchar', length: 120, nullable: true })
  noiseStatusBasis: string | null;

  @ApiProperty({ nullable: true, description: 'Kalenderjahr, auf das sich beide Ampeln beziehen' })
  @DbPlatformColumn({ type: 'int', nullable: true })
  statusYear: number | null;

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

  @OneToMany(() => RoomCombinationEntity, (assignment) => assignment.area)
  combinations: RoomCombinationEntity[];
}
