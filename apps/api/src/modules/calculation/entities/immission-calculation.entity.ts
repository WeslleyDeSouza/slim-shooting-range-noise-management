import { ApiProperty } from '@nestjs/swagger';
import { Entity, JoinColumn, ManyToOne, OneToMany, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';
import { AreaEntity } from '../../area/entities';
import { AreaCalculationEntity } from './area-calculation.entity';

/**
 * Immissionsberechnung (B1 5.18 «Berechnungen»): one delivery of an
 * engineering office (Bezeichnung, Lieferantin, Lieferdatum) that contains
 * 1..n Zustände (`zustand`). Carries the delivery-wide FGDB `metadaten`
 * (B1.2 11.4.17, S1–S10): which external ZustandID is the MPV / IST state
 * of the delivery, and the flags about its content. The SLIM-wide pointers
 * «aktuell gültig» / «Stand MGDM» live on the Zustand (5.18).
 *
 * Physical table `immissionsberechnung` (German database objects, B1 12.2 / slm 51).
 */
@Entity('immissionsberechnung')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'areaId', 'id'])
@Unique(['tenantId', 'areaId', 'name'])
export class ImmissionCalculationEntity extends SlimBaseEntity {
  protected self = ImmissionCalculationEntity;

  @ApiProperty()
  @DbPlatformColumn({ name: 'schiessplatz_id', type: 'uuid', nullable: false })
  areaId: string;

  @ApiProperty({ description: 'Bezeichnung der Berechnung' })
  @DbPlatformColumn({ name: 'bezeichnung', length: 120, nullable: false })
  name: string;

  @ApiProperty({ description: 'Lieferantin / bearbeitendes Büro (S10 Visum)' })
  @DbPlatformColumn({ name: 'visum', length: 80, nullable: false, default: '' })
  supplier: string;

  @ApiProperty({ nullable: true, description: 'Beschreibung der Lieferung (5.18 Detailansicht)' })
  @DbPlatformColumn({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty({ nullable: true, description: 'Berechnungsdatei (Name der importierten FGDB / JSON-Datei, 5.18 / 5.19)' })
  @DbPlatformColumn({ type: 'varchar', length: 200, nullable: true })
  fileName: string | null;

  @ApiProperty({ description: 'Lieferdatum YYYY-MM-DD (S9)' })
  @DbPlatformColumn({ name: 'lieferdatum', type: 'varchar', length: 10, nullable: false })
  deliveredAt: string;

  @ApiProperty({ nullable: true, description: 'S1 ZustandMPV: externe ZustandID des MPV-Stands der Lieferung' })
  @DbPlatformColumn({ name: 'zustand_mpv', type: 'varchar', length: 20, nullable: true })
  fgdbStateMpv: string | null;

  @ApiProperty({ nullable: true, description: 'S2 ZustandIST: externe ZustandID des IST-Zustands der Lieferung' })
  @DbPlatformColumn({ name: 'zustand_ist', type: 'varchar', length: 20, nullable: true })
  fgdbStateIst: string | null;

  @ApiProperty({ nullable: true, description: 'S3 Massnahmen in MPV' })
  @DbPlatformColumn({ name: 'mpv_massnahmen', type: 'boolean', nullable: true })
  mpvMeasures: boolean | null;

  @ApiProperty({ nullable: true, description: 'S4 Hindernisse im IST' })
  @DbPlatformColumn({ name: 'ist_hindernisse', type: 'boolean', nullable: true })
  istObstacles: boolean | null;

  @ApiProperty({ nullable: true, description: 'S5 Hochblenden im IST' })
  @DbPlatformColumn({ name: 'ist_hochblenden', type: 'boolean', nullable: true })
  istHighScreens: boolean | null;

  @ApiProperty({ nullable: true, description: 'S6 Anzahl erfasster Immissionspunkte' })
  @DbPlatformColumn({ name: 'anz_immi_pkte', type: 'int', nullable: true })
  immissionPointCount: number | null;

  @ApiProperty({ nullable: true, description: 'S7 Zivile Nutzung' })
  @DbPlatformColumn({ name: 'nutzung_zivil', type: 'boolean', nullable: true })
  civilUse: boolean | null;

  @ApiProperty({ nullable: true, description: 'S8 Schützenhaus vorhanden' })
  @DbPlatformColumn({ name: 'haus_vorhanden', type: 'boolean', nullable: true })
  shootingHousePresent: boolean | null;

  @ApiProperty()
  @DbPlatformColumn({ name: 'aktiv', type: 'boolean', nullable: false, default: true })
  enabled: boolean;

  @ManyToOne(() => AreaEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'schiessplatz_id', referencedColumnName: 'id' },
  ])
  area: AreaEntity;

  @OneToMany(() => AreaCalculationEntity, (state) => state.calculation)
  states: AreaCalculationEntity[];
}
