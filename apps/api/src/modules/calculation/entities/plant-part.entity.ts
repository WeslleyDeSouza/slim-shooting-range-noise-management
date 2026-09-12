import { ApiProperty } from '@nestjs/swagger';
import { Entity, JoinColumn, ManyToOne, OneToMany, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { AreaRoomEntity } from '../../area/entities';
import { AreaCalculationEntity } from './area-calculation.entity';
import { SourceLineEntity } from './source-line.entity';
import { StateObjectEntity } from './state-object.entity';

/**
 * Anlageteil eines Zustands (B1.2 11.4.2 `anlageteile`, B1–B7; Abb. 43
 * «Stellungsraum (Anlageteil, Schiessanlage, Shootingrange)»): the model's
 * picture of a Stellungsraum at the time of the calculation — geometry,
 * Schiessanlagentyp, Baujahr. Every Anlageteil is mapped to exactly one
 * übergeordneter Stellungsraum of the same Schiessplatz (slm 45; the
 * composite key `tenantId, areaId, roomId` makes a room of another area
 * impossible). Physical table `zustand_anlageteil`.
 */
@Entity('zustand_anlageteil')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'zustandId', 'id'])
export class PlantPartEntity extends StateObjectEntity {
  protected self = PlantPartEntity;

  @ApiProperty()
  @DbPlatformColumn({ name: 'schiessplatz_id', type: 'uuid', nullable: false })
  areaId: string;

  @ApiProperty({ description: 'Übergeordneter Stellungsraum (Referenzzuordnung beim Import)' })
  @DbPlatformColumn({ name: 'stellungsraum_id', type: 'uuid', nullable: false })
  roomId: string;

  @ApiProperty({ description: 'B2 Koordinationsabschnittsnummer des Anlageteils' })
  @DbPlatformColumn({ name: 'koord_nr', length: 20, nullable: false, default: '' })
  coordinationSectionNo: string;

  @ApiProperty({ description: 'B3 Bezeichnung gemäss SplDossier' })
  @DbPlatformColumn({ name: 'bez_spldossier', length: 256, nullable: false })
  name: string;

  @ApiProperty({ description: 'B4 Schiessanlagentyp (Codeliste)' })
  @DbPlatformColumn({ name: 'typ', length: 80, nullable: false, default: '' })
  type: string;

  @ApiProperty({ nullable: true, description: 'B5 Bemerkung' })
  @DbPlatformColumn({ name: 'bemerkung', type: 'varchar', length: 256, nullable: true })
  remark: string | null;

  @ApiProperty({ description: 'B6 Baujahr: nach 1.1.1985 erstellt (Planungswert gilt, B1 7.7)' })
  @DbPlatformColumn({ name: 'baujahr_nach_1985', type: 'boolean', nullable: false, default: false })
  builtAfter1985: boolean;

  @ManyToOne(() => AreaRoomEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'schiessplatz_id', referencedColumnName: 'areaId' },
    { name: 'stellungsraum_id', referencedColumnName: 'id' },
  ])
  room: AreaRoomEntity;

  /** Second key onto the state through the area: the state must belong to the same Schiessplatz as the room. */
  @ManyToOne(() => AreaCalculationEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'schiessplatz_id', referencedColumnName: 'areaId' },
    { name: 'zustand_id', referencedColumnName: 'id' },
  ])
  stateOfArea: AreaCalculationEntity;

  @OneToMany(() => SourceLineEntity, (source) => source.plantPart)
  sources: SourceLineEntity[];
}
