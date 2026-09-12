import { ApiProperty } from '@nestjs/swagger';
import { Entity, JoinColumn, ManyToOne, OneToOne, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { WeaponCombinationEntity } from '../../area/entities';
import { PlantPartEntity } from './plant-part.entity';
import { SourceDataA7Entity, SourceDataA9Entity } from './source-data.entity';
import { StateObjectEntity } from './state-object.entity';

/**
 * Schusslinie / Quelle sonARMS (B1 7.5.1, B1.2 11.4.3–11.4.4 C1–C4 / D1–D4;
 * Abb. 43 «Schusslinie (Fireline)»): a line from firing point to target of
 * one weapon system at one Anlageteil of a Zustand. `sourceId` is the
 * QuellenID (Anlageteil_Waffentyp_m|z|b_KoordNr_Nr) the WLR and operating
 * data files refer to; `combinationId` is the permanent Kombination the
 * import matched via the sonARMS weapon name (null = not matched → the
 * combination's shots cannot be attributed, O8).
 *
 * A combination may own several source lines in one state (B1 7.5: shots
 * are spread in proportion to the Quelldaten). Physical table `schusslinie`.
 */
@Entity('schusslinie')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'zustandId', 'id'])
@Unique(['tenantId', 'zustandId', 'sourceId'])
export class SourceLineEntity extends StateObjectEntity {
  protected self = SourceLineEntity;

  @ApiProperty({ description: 'Anlageteil dieses Zustands' })
  @DbPlatformColumn({ name: 'anlageteil_id', type: 'uuid', nullable: false })
  plantPartId: string;

  @ApiProperty({ nullable: true, description: 'Zugeordnete Kombination Waffe/Kaliber (übergeordnet)' })
  @DbPlatformColumn({ name: 'kombination_id', type: 'uuid', nullable: true })
  combinationId: string | null;

  @ApiProperty({ description: 'C3/D3 QuellenID' })
  @DbPlatformColumn({ name: 'quellen_id', length: 256, nullable: false })
  sourceId: string;

  @ApiProperty({ description: 'C2/D2 Waffensystem (Codeliste, Name der Waffendatenbank)' })
  @DbPlatformColumn({ name: 'waffensystem', length: 120, nullable: false, default: '' })
  weaponSystem: string;

  @ApiProperty({ nullable: true, description: 'C4/D4 BemerkGeom (abweichende ID im sonARMS-Projekt)' })
  @DbPlatformColumn({ name: 'bemerk_geom', type: 'varchar', length: 256, nullable: true })
  remarkGeom: string | null;

  @ManyToOne(() => PlantPartEntity, (part) => part.sources, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'zustand_id', referencedColumnName: 'zustandId' },
    { name: 'anlageteil_id', referencedColumnName: 'id' },
  ])
  plantPart: PlantPartEntity;

  @ManyToOne(() => WeaponCombinationEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'kombination_id', referencedColumnName: 'id' },
  ])
  combination: WeaponCombinationEntity | null;

  @OneToOne(() => SourceDataA9Entity, (data) => data.source)
  dataA9: SourceDataA9Entity | null;

  @OneToOne(() => SourceDataA7Entity, (data) => data.source)
  dataA7: SourceDataA7Entity | null;
}
