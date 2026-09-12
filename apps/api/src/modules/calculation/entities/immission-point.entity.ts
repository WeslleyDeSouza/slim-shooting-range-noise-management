import { ApiProperty } from '@nestjs/swagger';
import { Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { BuildingEntity } from './building.entity';
import { PropagationEntity } from './propagation.entity';
import { StateObjectEntity } from './state-object.entity';

/** Empfindlichkeitsstufe (Art. 43 LSV; H12 as 1–4). */
export const SENSITIVITY_LEVEL = ['I', 'II', 'III', 'IV'] as const;
export type SensitivityLevelCode = (typeof SENSITIVITY_LEVEL)[number];

/**
 * H8 Typ des Ermittlungspunktes (Codeliste): Fassadenpunkt (Art. 39 Abs. 1),
 * Freifeldpunkt (Abs. 2), Baulinienpunkt (Abs. 3); `reserve` = unüberbaute
 * Parzelle ohne Beurteilung in SLIM (kept for the schematic map).
 */
export const RECEIVER_TYPE = ['facade', 'free_field', 'building_line', 'reserve'] as const;
export type ReceiverType = (typeof RECEIVER_TYPE)[number];

/**
 * Immissionspunkt / Empfangspunkt (B1.2 11.4.8 `immissionspunkt`, H1–H13;
 * B1 5.12, 7.6): where the Beurteilungspegel is computed. Belongs to the
 * Ausbreitungsberechnung of its Zustand — position, height, ES and the
 * delivered Lr are state-specific and never shared between states. The
 * `sonarmsId` (H13) is the external identity the WLR files use and the only
 * key by which points of different states are compared (5.12 «Abweichung
 * zum gültigen Zustand»). Physical table `immissionspunkt`.
 */
@Entity('immissionspunkt')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'zustandId', 'id'])
@Unique(['tenantId', 'zustandId', 'sonarmsId'])
export class ImmissionPointEntity extends StateObjectEntity {
  protected self = ImmissionPointEntity;

  @ApiProperty()
  @DbPlatformColumn({ name: 'berechnung_id', type: 'uuid', nullable: false })
  propagationId: string;

  @ApiProperty({ nullable: true, description: 'Gebäude (H2 EGID → gebaeude)' })
  @DbPlatformColumn({ name: 'gebaeude_id', type: 'uuid', nullable: true })
  buildingId: string | null;

  @ApiProperty({ description: 'H13 sonARMS_ID: eindeutige ID im sonARMS-Projekt (Empfänger der WLR-Datei)' })
  @DbPlatformColumn({ name: 'sonarms_id', length: 30, nullable: false })
  sonarmsId: string;

  @ApiProperty({ description: 'Anzeigecode, z. B. «E1»' })
  @DbPlatformColumn({ name: 'code', length: 20, nullable: false })
  code: string;

  @ApiProperty({ nullable: true, description: 'H2 EGID' })
  @DbPlatformColumn({ name: 'egid', type: 'varchar', length: 20, nullable: true })
  egid: string | null;

  @ApiProperty({ nullable: true, description: 'H3 EGRID («nicht in eGRIS» wenn keine)' })
  @DbPlatformColumn({ name: 'egrid', type: 'varchar', length: 14, nullable: true })
  egrid: string | null;

  @ApiProperty({ description: 'H4 Adresse' })
  @DbPlatformColumn({ name: 'adresse', length: 100, nullable: false, default: '' })
  address: string;

  @ApiProperty({ nullable: true, description: 'Gemeinde' })
  @DbPlatformColumn({ name: 'gemeinde', type: 'varchar', length: 80, nullable: true })
  municipality: string | null;

  @ApiProperty({ nullable: true, description: 'H5 EPNr: Nummer des Punkts am Gebäude' })
  @DbPlatformColumn({ name: 'ep_nr', type: 'int', nullable: true })
  pointNo: number | null;

  @ApiProperty({ nullable: true, description: 'H6 Lr [dBA] gemäss Lieferung (Kataster)' })
  @DbPlatformColumn({ name: 'lr', type: 'float', nullable: true })
  deliveredLr: number | null;

  @ApiProperty({ description: 'H7 Beurteilung Betriebsraum (Codeliste)' })
  @DbPlatformColumn({ name: 'betrieb', length: 30, nullable: false, default: '' })
  operation: string;

  @ApiProperty({ enum: RECEIVER_TYPE, description: 'H8 Typ des Ermittlungspunktes' })
  @DbPlatformColumn({ name: 'typ', type: 'varchar', length: 14, nullable: false, default: 'facade' })
  type: ReceiverType;

  @ApiProperty({ description: 'H9 Beurteilung gemäss Lieferung (Codeliste)' })
  @DbPlatformColumn({ name: 'beurteilung', length: 30, nullable: false, default: '' })
  deliveredAssessment: string;

  @ApiProperty({ nullable: true, description: 'H11 Bemerkung' })
  @DbPlatformColumn({ name: 'bemerkung', type: 'varchar', length: 256, nullable: true })
  remark: string | null;

  @ApiProperty({ enum: SENSITIVITY_LEVEL, description: 'H12 Empfindlichkeitsstufe' })
  @DbPlatformColumn({ name: 'es', type: 'varchar', length: 3, nullable: false, default: 'II' })
  sensitivityLevel: SensitivityLevelCode;

  @ApiProperty({ nullable: true, description: 'LV95 Ost (H1 Geometrie)' })
  @DbPlatformColumn({ name: 'ost', type: 'float', nullable: true })
  east: number | null;

  @ApiProperty({ nullable: true, description: 'LV95 Nord (H1 Geometrie)' })
  @DbPlatformColumn({ name: 'nord', type: 'float', nullable: true })
  north: number | null;

  @ApiProperty({ nullable: true, description: 'Höhe über Meer (H1 Z)' })
  @DbPlatformColumn({ name: 'hoehe', type: 'float', nullable: true })
  height: number | null;

  @ApiProperty({ description: 'Position auf der schematischen Karte, % der Breite' })
  @DbPlatformColumn({ name: 'karte_x', type: 'float', nullable: false, default: 50 })
  mapX: number;

  @ApiProperty({ description: 'Position auf der schematischen Karte, % der Höhe' })
  @DbPlatformColumn({ name: 'karte_y', type: 'float', nullable: false, default: 50 })
  mapY: number;

  @ApiProperty()
  @DbPlatformColumn({ name: 'sortierung', type: 'int', nullable: false, default: 0 })
  sortOrder: number;

  @ManyToOne(() => PropagationEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'zustand_id', referencedColumnName: 'zustandId' },
    { name: 'berechnung_id', referencedColumnName: 'id' },
  ])
  propagation: PropagationEntity;

  /** Same state enforced through the composite key of the building. */
  @ManyToOne(() => BuildingEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'zustand_id', referencedColumnName: 'zustandId' },
    { name: 'gebaeude_id', referencedColumnName: 'id' },
  ])
  building: BuildingEntity | null;
}
