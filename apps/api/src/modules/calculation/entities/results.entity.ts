import { ApiProperty } from '@nestjs/swagger';
import { Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { PropagationEntity } from './propagation.entity';
import { StateObjectEntity } from './state-object.entity';

/**
 * Isophonen / Lärmbelastungskurven (B1.2 11.4.11, L1–L6): result lines of
 * the Ausbreitungsberechnung in 5 dB steps. Physical table `isophonen`.
 */
@Entity('isophonen')
@Unique(['tenantId', 'id'])
export class IsophoneEntity extends StateObjectEntity {
  protected self = IsophoneEntity;

  @ApiProperty()
  @DbPlatformColumn({ name: 'berechnung_id', type: 'uuid', nullable: false })
  propagationId: string;

  @ApiProperty({ description: 'L2 Lr der Isolinie [dBA]' })
  @DbPlatformColumn({ name: 'lr', type: 'int', nullable: false })
  lr: number;

  @ApiProperty({ description: 'L3 Berechnungshöhe über Terrain [m]' })
  @DbPlatformColumn({ name: 'hoehe', type: 'float', nullable: false, default: 4 })
  height: number;

  @ApiProperty({ nullable: true, description: 'L5 Auflösung der Rasterberechnung [m]' })
  @DbPlatformColumn({ name: 'aufloesung', type: 'int', nullable: true })
  resolution: number | null;

  @ApiProperty({ nullable: true, description: 'L6 Bemerkung' })
  @DbPlatformColumn({ name: 'bemerkung', type: 'varchar', length: 256, nullable: true })
  remark: string | null;

  @ManyToOne(() => PropagationEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'zustand_id', referencedColumnName: 'zustandId' },
    { name: 'berechnung_id', referencedColumnName: 'id' },
  ])
  propagation: PropagationEntity;
}

/**
 * Betroffenen-Analyse (B1.2 11.4.12, M1–M9): inhabitants above PW/IGW/AW
 * and in the 55/60 dBA bands, one row per Zustand (Abb. 43: 0..1).
 * Physical table `betroffene_analyse`.
 */
@Entity('betroffene_analyse')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'zustandId'])
export class AffectedAnalysisEntity extends StateObjectEntity {
  protected self = AffectedAnalysisEntity;

  @ApiProperty()
  @DbPlatformColumn({ name: 'berechnung_id', type: 'uuid', nullable: false })
  propagationId: string;

  @ApiProperty({ description: 'M1 Personen über PW und IGW' })
  @DbPlatformColumn({ name: 'pw_igw', type: 'int', nullable: false, default: 0 })
  personsPwIgw: number;

  @ApiProperty({ description: 'M2 Personen über IGW und AW' })
  @DbPlatformColumn({ name: 'igw_av', type: 'int', nullable: false, default: 0 })
  personsIgwAw: number;

  @ApiProperty({ description: 'M3 Personen über AW' })
  @DbPlatformColumn({ name: 'av', type: 'int', nullable: false, default: 0 })
  personsAw: number;

  @ApiProperty({ description: 'M4 Jahr der Betroffenenanalyse' })
  @DbPlatformColumn({ name: 'jahr', type: 'int', nullable: false })
  year: number;

  @ApiProperty({ nullable: true, description: 'M6 Bemerkung' })
  @DbPlatformColumn({ name: 'bemerkung', type: 'varchar', length: 256, nullable: true })
  remark: string | null;

  @ApiProperty({ description: 'M7 Anlagennummer SPM' })
  @DbPlatformColumn({ name: 'spm_nr', length: 20, nullable: false, default: '' })
  spmNo: string;

  @ApiProperty({ description: 'M8 Personen 55–<60 dBA' })
  @DbPlatformColumn({ name: 'pers_55db', type: 'int', nullable: false, default: 0 })
  persons55: number;

  @ApiProperty({ description: 'M9 Personen ≥ 60 dBA' })
  @DbPlatformColumn({ name: 'pers_60db', type: 'int', nullable: false, default: 0 })
  persons60: number;

  @ManyToOne(() => PropagationEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'zustand_id', referencedColumnName: 'zustandId' },
    { name: 'berechnung_id', referencedColumnName: 'id' },
  ])
  propagation: PropagationEntity;
}
