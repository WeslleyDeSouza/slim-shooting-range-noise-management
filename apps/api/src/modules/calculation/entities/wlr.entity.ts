import { ApiProperty } from '@nestjs/swagger';
import { Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { ImmissionPointEntity } from './immission-point.entity';
import { PropagationEntity } from './propagation.entity';
import { SourceLineEntity } from './source-line.entity';
import { StateObjectEntity } from './state-object.entity';

/** Zeitgruppe of a WLR file: Tag (Mo–Fr 07–19) or Abend (ausserhalb). */
export const TIME_GROUP = ['day', 'eve'] as const;
export type TimeGroup = (typeof TIME_GROUP)[number];

/**
 * WLR-Pegel (B1 5.21, 7.6; B1.4 `.wlr`: Empfänger | Gebäude | Quelle |
 * Waffe | Elevation | LAE(MK) | LAE(GK) | LAE(Det) | LAE | LAFmax, one file
 * per Zeitgruppe): the single-shot levels of one Schusslinie at one
 * Immissionspunkt for one Zeitgruppe, computed by sonARMS. Belongs to the
 * Ausbreitungsberechnung of its Zustand; the composite keys on
 * `(tenantId, zustandId, …)` make a source of state A and a point of state
 * B impossible to link. Physical table `wlr_pegel`.
 */
@Entity('wlr_pegel')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'sourceLineId', 'immissionPointId', 'timeGroup'])
@Index(['tenantId', 'zustandId'])
export class AreaWlrEntity extends StateObjectEntity {
  protected self = AreaWlrEntity;

  @ApiProperty()
  @DbPlatformColumn({ name: 'berechnung_id', type: 'uuid', nullable: false })
  propagationId: string;

  @ApiProperty()
  @DbPlatformColumn({ name: 'schusslinie_id', type: 'uuid', nullable: false })
  sourceLineId: string;

  @ApiProperty()
  @DbPlatformColumn({ name: 'immissionspunkt_id', type: 'uuid', nullable: false })
  immissionPointId: string;

  @ApiProperty({ enum: TIME_GROUP })
  @DbPlatformColumn({ name: 'zeitgruppe', type: 'varchar', length: 3, nullable: false })
  timeGroup: TimeGroup;

  @ApiProperty({ description: 'LAE [dB] (Schallereignispegel, Anhang 9)' })
  @DbPlatformColumn({ name: 'lae', type: 'float', nullable: false })
  lae: number;

  @ApiProperty({ description: 'LAFmax [dB] (Anhang 7)' })
  @DbPlatformColumn({ name: 'lafmax', type: 'float', nullable: false })
  lafmax: number;

  @ApiProperty({ nullable: true, description: 'LAE(MK) Mündungsknall [dB]' })
  @DbPlatformColumn({ name: 'lae_mk', type: 'float', nullable: true })
  laeMk: number | null;

  @ApiProperty({ nullable: true, description: 'LAE(GK) Geschossknall [dB]' })
  @DbPlatformColumn({ name: 'lae_gk', type: 'float', nullable: true })
  laeGk: number | null;

  @ApiProperty({ nullable: true, description: 'LAE(Det) Detonation [dB]' })
  @DbPlatformColumn({ name: 'lae_det', type: 'float', nullable: true })
  laeDet: number | null;

  @ApiProperty({ nullable: true, description: 'Elevation [°]' })
  @DbPlatformColumn({ name: 'elevation', type: 'float', nullable: true })
  elevation: number | null;

  @ManyToOne(() => PropagationEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'zustand_id', referencedColumnName: 'zustandId' },
    { name: 'berechnung_id', referencedColumnName: 'id' },
  ])
  propagation: PropagationEntity;

  @ManyToOne(() => SourceLineEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'zustand_id', referencedColumnName: 'zustandId' },
    { name: 'schusslinie_id', referencedColumnName: 'id' },
  ])
  sourceLine: SourceLineEntity;

  @ManyToOne(() => ImmissionPointEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'zustand_id', referencedColumnName: 'zustandId' },
    { name: 'immissionspunkt_id', referencedColumnName: 'id' },
  ])
  immissionPoint: ImmissionPointEntity;
}
