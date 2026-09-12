import { ApiProperty } from '@nestjs/swagger';
import { Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { BuildingEntity } from './building.entity';
import { PlantPartObjectEntity } from './obstacles.entity';
import { StateObjectEntity } from './state-object.entity';

/**
 * Punkt-Massnahme (Lägerblenden, Schiesstunnel) (B1.2 11.4.13, N1–N5): a
 * source-side measure at the start point of a Schusslinie. Abb. 43
 * «Punkt Massnahme». Physical table `massnahmen_punkt`.
 */
@Entity('massnahmen_punkt')
@Unique(['tenantId', 'id'])
export class MeasurePointEntity extends PlantPartObjectEntity {
  protected self = MeasurePointEntity;

  @ApiProperty({ description: 'N4 Beschreibung der Massnahme' })
  @DbPlatformColumn({ name: 'bemerkung', length: 256, nullable: false, default: '' })
  remark: string;

  @ApiProperty({ description: 'N5 Typ der Massnahme (Codeliste)' })
  @DbPlatformColumn({ name: 'massn_typ', length: 60, nullable: false, default: '' })
  measureType: string;
}

/**
 * Flächen-Massnahme (Rasterdecken) (B1.2 11.4.14, P1–P11). Abb. 43
 * «Flächen Massnahme». Physical table `massnahmen_flaeche`.
 */
@Entity('massnahmen_flaeche')
@Unique(['tenantId', 'id'])
export class MeasureAreaEntity extends PlantPartObjectEntity {
  protected self = MeasureAreaEntity;

  @ApiProperty({ description: 'P4 Beschreibung der Massnahme' })
  @DbPlatformColumn({ name: 'bemerkung', length: 256, nullable: false, default: '' })
  remark: string;

  @ApiProperty({ nullable: true, description: 'P5 Breite [m]' })
  @DbPlatformColumn({ name: 'breite', type: 'float', nullable: true })
  width: number | null;

  @ApiProperty({ nullable: true, description: 'P6 Länge [m]' })
  @DbPlatformColumn({ name: 'laenge', type: 'float', nullable: true })
  length: number | null;

  @ApiProperty({ nullable: true, description: 'P7 Höhe [m]' })
  @DbPlatformColumn({ name: 'hoehe', type: 'float', nullable: true })
  height: number | null;

  @ApiProperty({ nullable: true, description: 'P8 Abstand Lamellen quer [m]' })
  @DbPlatformColumn({ name: 'abstand_quer', type: 'float', nullable: true })
  spacingAcross: number | null;

  @ApiProperty({ nullable: true, description: 'P9 Abstand Lamellen längs [m]' })
  @DbPlatformColumn({ name: 'abstand_laengs', type: 'float', nullable: true })
  spacingAlong: number | null;

  @ApiProperty({ nullable: true, description: 'P10 Tiefe der Lamellen [m]' })
  @DbPlatformColumn({ name: 'tiefe', type: 'float', nullable: true })
  depth: number | null;

  @ApiProperty({ description: 'P11 Typ der Massnahme (Codeliste)' })
  @DbPlatformColumn({ name: 'massn_typ', length: 60, nullable: false, default: '' })
  measureType: string;
}

/**
 * Betriebliche Massnahme (B1.2 11.4.16, R1–R3): organisational measure per
 * Anlageteil (Reduktion Schusszahlen, Verlegung, …). Physical table `massnahmen_betrieb`.
 */
@Entity('massnahmen_betrieb')
@Unique(['tenantId', 'id'])
export class MeasureOperationalEntity extends PlantPartObjectEntity {
  protected self = MeasureOperationalEntity;

  @ApiProperty({ description: 'R2 Typ der Massnahme (Codeliste)' })
  @DbPlatformColumn({ name: 'massn_typ', length: 80, nullable: false, default: '' })
  measureType: string;
}

/**
 * SSF-Massnahme (Schallschutzfenster) (B1.2 11.4.15, Q1–Q4): receiver-side
 * measure at a building of the state. Physical table `massnahmen_ssf`.
 */
@Entity('massnahmen_ssf')
@Unique(['tenantId', 'id'])
export class MeasureSsfEntity extends StateObjectEntity {
  protected self = MeasureSsfEntity;

  @ApiProperty({ nullable: true, description: 'Gebäude dieses Zustands (aus Q1 EGID aufgelöst)' })
  @DbPlatformColumn({ name: 'gebaeude_id', type: 'uuid', nullable: true })
  buildingId: string | null;

  @ApiProperty({ nullable: true, description: 'Q1 EGID' })
  @DbPlatformColumn({ name: 'egid', type: 'varchar', length: 20, nullable: true })
  egid: string | null;

  @ApiProperty({ description: 'Q3 Koordinationsabschnittsnummer des Anlageteils' })
  @DbPlatformColumn({ name: 'koord_nr', length: 20, nullable: false, default: '' })
  coordinationSectionNo: string;

  @ApiProperty({ description: 'Q4 Typ der Massnahme (Codeliste)' })
  @DbPlatformColumn({ name: 'massn_typ', length: 60, nullable: false, default: '' })
  measureType: string;

  @ManyToOne(() => BuildingEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'zustand_id', referencedColumnName: 'zustandId' },
    { name: 'gebaeude_id', referencedColumnName: 'id' },
  ])
  building: BuildingEntity | null;
}
