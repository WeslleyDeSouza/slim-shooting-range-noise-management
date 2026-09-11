import { ApiProperty } from '@nestjs/swagger';
import { Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';
import { AreaEntity } from '../../area/entities';

/** Empfindlichkeitsstufe (Art. 43 LSV). */
export const SENSITIVITY_LEVEL = ['I', 'II', 'III', 'IV'] as const;
export type SensitivityLevelCode = (typeof SENSITIVITY_LEVEL)[number];

/** Fassadenpunkt (a building) or Reservepunkt (empty parcel, no assessment). */
export const RECEIVER_TYPE = ['facade', 'reserve'] as const;
export type ReceiverType = (typeof RECEIVER_TYPE)[number];

/**
 * Empfangspunkt (B1 5.12, 7.6): where the Beurteilungspegel is assessed.
 * Coordinates: LV95 for the GIS map, plus a position on the schematic map
 * of the prototype (percent of width / height).
 */
// Physical table name in German (B1 12.2 / slm 51); the class keeps its English name.
@Entity('empfangspunkt')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'areaId', 'code'])
export class AreaReceiverEntity extends SlimBaseEntity {
  protected self = AreaReceiverEntity;

  @ApiProperty()
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  areaId: string;

  @ApiProperty({ description: 'Empfangspunkt-Nr., z. B. «E1»' })
  @DbPlatformColumn({ length: 20, nullable: false })
  code: string;

  @ApiProperty({ description: 'EGID des Gebäudes', nullable: true })
  @DbPlatformColumn({ type: 'varchar', length: 20, nullable: true })
  egid: string | null;

  @ApiProperty({ description: 'Adresse' })
  @DbPlatformColumn({ length: 160, nullable: false, default: '' })
  address: string;

  @ApiProperty({ description: 'Gemeinde', nullable: true })
  @DbPlatformColumn({ type: 'varchar', length: 80, nullable: true })
  municipality: string | null;

  @ApiProperty({ enum: RECEIVER_TYPE })
  @DbPlatformColumn({ type: 'varchar', length: 10, nullable: false, default: 'facade' })
  type: ReceiverType;

  @ApiProperty({ enum: SENSITIVITY_LEVEL, description: 'Empfindlichkeitsstufe' })
  @DbPlatformColumn({ type: 'varchar', length: 3, nullable: false, default: 'II' })
  sensitivityLevel: SensitivityLevelCode;

  @ApiProperty({ description: 'LV95 Ost', nullable: true })
  @DbPlatformColumn({ type: 'float', nullable: true })
  east: number | null;

  @ApiProperty({ description: 'LV95 Nord', nullable: true })
  @DbPlatformColumn({ type: 'float', nullable: true })
  north: number | null;

  @ApiProperty({ description: 'Position auf der schematischen Karte, % der Breite' })
  @DbPlatformColumn({ type: 'float', nullable: false, default: 50 })
  mapX: number;

  @ApiProperty({ description: 'Position auf der schematischen Karte, % der Höhe' })
  @DbPlatformColumn({ type: 'float', nullable: false, default: 50 })
  mapY: number;

  @ApiProperty()
  @DbPlatformColumn({ type: 'int', nullable: false, default: 0 })
  sortOrder: number;

  @ApiProperty()
  @DbPlatformColumn({ type: 'boolean', nullable: false, default: true })
  enabled: boolean;

  @ManyToOne(() => AreaEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'areaId', referencedColumnName: 'id' },
  ])
  area: AreaEntity;
}
