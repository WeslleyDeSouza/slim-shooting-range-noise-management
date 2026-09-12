import { ApiProperty } from '@nestjs/swagger';
import { Entity, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { StateObjectEntity } from './state-object.entity';

/**
 * Untersuchungsperimeter (B1.2 11.4.1, A1–A4): the whole investigated plant
 * incl. the perimeter of the noise calculation, one per Zustand (Abb. 43).
 * Physical table `untersuchungsperimeter`.
 */
@Entity('untersuchungsperimeter')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'zustandId'])
export class StudyPerimeterEntity extends StateObjectEntity {
  protected self = StudyPerimeterEntity;

  @ApiProperty({ description: 'A2 Name des Schiessplatzes' })
  @DbPlatformColumn({ name: 'name', length: 256, nullable: false })
  name: string;

  @ApiProperty({ description: 'A3 Anlagennummer SPM' })
  @DbPlatformColumn({ name: 'nr_spm', length: 20, nullable: false, default: '' })
  spmNo: string;

  @ApiProperty({ description: 'A4 Koordinationsabschnittsnummer der Anlage' })
  @DbPlatformColumn({ name: 'koord_nr', length: 20, nullable: false, default: '' })
  coordinationSectionNo: string;
}
