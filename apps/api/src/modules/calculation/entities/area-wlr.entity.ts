import { ApiProperty } from '@nestjs/swagger';
import { Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';
import { AreaWeaponEntity } from '../../area/entities';
import { AreaCalculationEntity } from './area-calculation.entity';
import { AreaReceiverEntity } from './area-receiver.entity';

/**
 * One line of the sonARMS result files (`*.wlr`, B1.4 «WLR Day/Eve»):
 * the single-shot levels a source produces at a receiver. `laeDay` /
 * `laeEve` feed Annex 9 (column LAE, day and evening time group),
 * `lafmaxDay` feeds Annex 7 (column LAFmax of the day file).
 */
// Physical table name in German (B1 12.2 / slm 51); the class keeps its English name.
@Entity('wlr_pegel')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'calculationId', 'receiverId', 'weaponId'])
@Index(['tenantId', 'calculationId'])
export class AreaWlrEntity extends SlimBaseEntity {
  protected self = AreaWlrEntity;

  @ApiProperty()
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  calculationId: string;

  @ApiProperty()
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  receiverId: string;

  /** The source (room × weapon, `AreaWeaponEntity.sourceId`). */
  @ApiProperty()
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  weaponId: string;

  @ApiProperty({ description: 'LAE Tag [dB]' })
  @DbPlatformColumn({ type: 'float', nullable: false })
  laeDay: number;

  @ApiProperty({ description: 'LAE Abend [dB]' })
  @DbPlatformColumn({ type: 'float', nullable: false })
  laeEve: number;

  @ApiProperty({ description: 'LAFmax Tag [dB]' })
  @DbPlatformColumn({ type: 'float', nullable: false })
  lafmaxDay: number;

  @ManyToOne(() => AreaCalculationEntity, (calc) => calc.wlr, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'calculationId', referencedColumnName: 'id' },
  ])
  calculation: AreaCalculationEntity;

  @ManyToOne(() => AreaReceiverEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'receiverId', referencedColumnName: 'id' },
  ])
  receiver: AreaReceiverEntity;

  @ManyToOne(() => AreaWeaponEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'weaponId', referencedColumnName: 'id' },
  ])
  weapon: AreaWeaponEntity;
}
