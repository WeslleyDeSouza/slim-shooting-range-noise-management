import { ApiProperty } from '@nestjs/swagger';
import { Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';
import { QUANTITY_UNIT, QuantityUnit, WeaponCombinationEntity } from '../../area/entities';
import { AreaUsageEntity } from './area-usage.entity';

/** DECIMAL comes back as a string from MySQL/PostgreSQL drivers — keep it a number in the entity. */
export const decimalToNumber = {
  to: (v: number) => v,
  from: (v: string | number | null) => (v == null ? v : Number(v)),
};

/**
 * Position of a Schiessplatz-Nutzung (B1 6.1.3 «{Identifikation Kaliber +
 * Identifikation Waffensystem + Anzahl Schuss}», Kap. 10 «Anzahl Schuss»):
 * one combination Waffe/Kaliber with its quantity — a decimal (kg of
 * explosive) or a count (Stück). Refers to the permanent combination, never
 * to a source or a state (slm 44). Physical table `nutzung_position`.
 */
@Entity('nutzung_position')
@Unique(['tenantId', 'id'])
@Index(['tenantId', 'areaId'])
export class UsagePositionEntity extends SlimBaseEntity {
  protected self = UsagePositionEntity;

  @ApiProperty()
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  usageId: string;

  /** Denormalised for the yearly queries of the calculation (usage → area). */
  @ApiProperty()
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  areaId: string;

  @ApiProperty()
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  combinationId: string;

  @ApiProperty({ description: 'Menge als Dezimalzahl (3 Dezimalen): Anzahl Schuss oder kg Sprengstoff' })
  @DbPlatformColumn({ type: 'decimal', precision: 12, scale: 3, nullable: false, default: 0, transformer: decimalToNumber })
  quantity: number;

  @ApiProperty({ enum: QUANTITY_UNIT })
  @DbPlatformColumn({ type: 'varchar', length: 5, nullable: false, default: 'shots' })
  quantityUnit: QuantityUnit;

  @ManyToOne(() => AreaUsageEntity, (usage) => usage.positions, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'usageId', referencedColumnName: 'id' },
  ])
  usage: AreaUsageEntity;

  @ManyToOne(() => WeaponCombinationEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'combinationId', referencedColumnName: 'id' },
  ])
  combination: WeaponCombinationEntity;
}
