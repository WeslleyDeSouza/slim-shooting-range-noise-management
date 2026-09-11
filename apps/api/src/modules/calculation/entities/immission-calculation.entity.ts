import { ApiProperty } from '@nestjs/swagger';
import { Entity, JoinColumn, ManyToOne, OneToMany, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';
import { AreaEntity } from '../../area/entities';
import { AreaCalculationEntity } from './area-calculation.entity';

/**
 * Immissionsberechnung (B1 5.18 «Berechnungen», Kapitel 10): one delivery
 * of the noise model by the supplier (Bezeichnung, Lieferantin, Lieferdatum)
 * with one or more Zustände (AreaCalculationEntity). The hierarchy is
 * Schiessplatz → Immissionsberechnung → Zustand; the receivers, sources and
 * WLR levels hang on the Zustand.
 *
 * Physical table `immissionsberechnung` — database objects are German
 * (B1 12.2, slm 51); the class names of the code stay English.
 */
@Entity('immissionsberechnung')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'areaId', 'name'])
export class ImmissionCalculationEntity extends SlimBaseEntity {
  protected self = ImmissionCalculationEntity;

  @ApiProperty()
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  areaId: string;

  @ApiProperty({ description: 'Bezeichnung der Berechnung' })
  @DbPlatformColumn({ length: 120, nullable: false })
  name: string;

  @ApiProperty({ description: 'Lieferantin (z. B. Empa)' })
  @DbPlatformColumn({ length: 80, nullable: false, default: '' })
  supplier: string;

  @ApiProperty({ description: 'Lieferdatum YYYY-MM-DD' })
  @DbPlatformColumn({ type: 'varchar', length: 10, nullable: false })
  deliveredAt: string;

  @ApiProperty()
  @DbPlatformColumn({ type: 'boolean', nullable: false, default: true })
  enabled: boolean;

  @ManyToOne(() => AreaEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'areaId', referencedColumnName: 'id' },
  ])
  area: AreaEntity;

  @OneToMany(() => AreaCalculationEntity, (state) => state.calculation)
  states: AreaCalculationEntity[];
}
