import { ApiProperty } from '@nestjs/swagger';
import { Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { PlantPartEntity } from './plant-part.entity';
import { StateObjectEntity } from './state-object.entity';

/**
 * Base of the objects that hang on an Anlageteil of the state (Abb. 43:
 * Schützenhaus, Hindernis, Hochblende, Massnahmen). The FGDB links them by
 * Koordinationsabschnittsnummer; the import resolves that to the Anlageteil
 * of the same Zustand (composite key), the number stays for the roundtrip.
 */
export abstract class PlantPartObjectEntity extends StateObjectEntity {
  @ApiProperty({ nullable: true, description: 'Anlageteil dieses Zustands (aus Koord_Nr aufgelöst)' })
  @DbPlatformColumn({ name: 'anlageteil_id', type: 'uuid', nullable: true })
  plantPartId: string | null;

  @ApiProperty({ description: 'Koordinationsabschnittsnummer des Anlageteils' })
  @DbPlatformColumn({ name: 'koord_nr', length: 20, nullable: false, default: '' })
  coordinationSectionNo: string;

  @ManyToOne(() => PlantPartEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'zustand_id', referencedColumnName: 'zustandId' },
    { name: 'anlageteil_id', referencedColumnName: 'id' },
  ])
  plantPart: PlantPartEntity | null;
}

/** Hindernis (LSW oder Damm) (B1.2 11.4.5, E1–E6). Physical table `hindernis`. */
@Entity('hindernis')
@Unique(['tenantId', 'id'])
export class ObstacleEntity extends PlantPartObjectEntity {
  protected self = ObstacleEntity;

  @ApiProperty({ description: 'E3 Oberflächentyp (Codeliste)' })
  @DbPlatformColumn({ name: 'surface_type', length: 40, nullable: false, default: '' })
  surfaceType: string;

  @ApiProperty({ description: 'E4 Typ der Massnahme (Codeliste: Lärmschutzwand, -damm, mobile Wand, …)' })
  @DbPlatformColumn({ name: 'typ_hindernis', length: 60, nullable: false, default: '' })
  obstacleType: string;

  @ApiProperty({ nullable: true, description: 'E6 Bemerkung' })
  @DbPlatformColumn({ name: 'bemerkung', type: 'varchar', length: 256, nullable: true })
  remark: string | null;
}

/** Hochblende (B1.2 11.4.6, F1–F6). Physical table `hochblende`. */
@Entity('hochblende')
@Unique(['tenantId', 'id'])
export class HighScreenEntity extends PlantPartObjectEntity {
  protected self = HighScreenEntity;

  @ApiProperty({ description: 'F3 Höhe Unterkante über Meer [m]' })
  @DbPlatformColumn({ name: 'hoehe_unterkante', type: 'float', nullable: false, default: 0 })
  bottomHeight: number;

  @ApiProperty({ description: 'F4 Oberflächentyp (Codeliste)' })
  @DbPlatformColumn({ name: 'surface_type', length: 40, nullable: false, default: '' })
  surfaceType: string;

  @ApiProperty({ nullable: true, description: 'F6 Bemerkung' })
  @DbPlatformColumn({ name: 'bemerkung', type: 'varchar', length: 256, nullable: true })
  remark: string | null;
}

/** Schützenhaus (B1.2 11.4.7, G1–G15). Physical table `schuetzenhaus`. */
@Entity('schuetzenhaus')
@Unique(['tenantId', 'id'])
export class ShootingHouseEntity extends PlantPartObjectEntity {
  protected self = ShootingHouseEntity;

  @ApiProperty({ description: 'G4 Höhe Hauskubus über Meer [m]' })
  @DbPlatformColumn({ name: 'haus_hoehe', type: 'float', nullable: false, default: 0 })
  houseHeight: number;

  @ApiProperty({ description: 'G5 Tiefe Hauskubus [m]' })
  @DbPlatformColumn({ name: 'haus_tiefe', type: 'float', nullable: false, default: 0 })
  houseDepth: number;

  @ApiProperty({ description: 'G6 First-Abstand [m]' })
  @DbPlatformColumn({ name: 'first_abstand', type: 'float', nullable: false, default: 0 })
  ridgeDistance: number;

  @ApiProperty({ description: 'G7 First-Höhe über Meer [m]' })
  @DbPlatformColumn({ name: 'first_hoehe', type: 'float', nullable: false, default: 0 })
  ridgeHeight: number;

  @ApiProperty({ description: 'G8 Linke Blende Länge [m]' })
  @DbPlatformColumn({ name: 'bl_li_laenge', type: 'float', nullable: false, default: 0 })
  leftScreenLength: number;

  @ApiProperty({ description: 'G9 Linke Blende Höhe über Meer [m]' })
  @DbPlatformColumn({ name: 'bl_li_hoehe', type: 'float', nullable: false, default: 0 })
  leftScreenHeight: number;

  @ApiProperty({ description: 'G10 Rechte Blende Länge [m]' })
  @DbPlatformColumn({ name: 'bl_re_laenge', type: 'float', nullable: false, default: 0 })
  rightScreenLength: number;

  @ApiProperty({ description: 'G11 Rechte Blende Höhe über Meer [m]' })
  @DbPlatformColumn({ name: 'bl_re_hoehe', type: 'float', nullable: false, default: 0 })
  rightScreenHeight: number;

  @ApiProperty({ nullable: true, description: 'G12 Materialisierung Schützenhaus (Codeliste)' })
  @DbPlatformColumn({ name: 'haus_mat', type: 'varchar', length: 40, nullable: true })
  houseMaterial: string | null;

  @ApiProperty({ nullable: true, description: 'G13 Materialisierung linke Blende (Codeliste)' })
  @DbPlatformColumn({ name: 'bl_li_mat', type: 'varchar', length: 40, nullable: true })
  leftScreenMaterial: string | null;

  @ApiProperty({ nullable: true, description: 'G14 Materialisierung rechte Blende (Codeliste)' })
  @DbPlatformColumn({ name: 'bl_re_mat', type: 'varchar', length: 40, nullable: true })
  rightScreenMaterial: string | null;

  @ApiProperty({ nullable: true, description: 'G15 Bemerkung' })
  @DbPlatformColumn({ name: 'bemerkung', type: 'varchar', length: 256, nullable: true })
  remark: string | null;
}
