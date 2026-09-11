import { ApiProperty } from '@nestjs/swagger';
import { Entity, JoinColumn, ManyToOne, OneToMany, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';
import { AreaEntity } from '../../area/entities';
import { AreaWlrEntity } from './area-wlr.entity';

/** Baujahr der Anlagenteile (B1 5.18): which LSV limit applies (7.7). */
export const BUILD_YEAR_CLASS = ['before1985', 'after1985', 'mixed'] as const;
export type BuildYearClassCode = (typeof BUILD_YEAR_CLASS)[number];

/**
 * Berechnungsgrundlage / Zustand (B1 5.18 «Berechnungen»): one delivered
 * noise model state of an area (e.g. «Initiale Aufnahme 2019», «Sanierter
 * Zustand 2025»). Its WLR rows carry the sonARMS levels per receiver ×
 * source that the assessment (5.12) and the simulation (5.13) plug the
 * shot counts into. Exactly one state per area is the current one and
 * exactly one is the MGDM state (both may be the same).
 */
@Entity('area_calculation')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'areaId', 'name'])
export class AreaCalculationEntity extends SlimBaseEntity {
  protected self = AreaCalculationEntity;

  @ApiProperty()
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  areaId: string;

  @ApiProperty({ description: 'Bezeichnung des Zustands' })
  @DbPlatformColumn({ length: 120, nullable: false })
  name: string;

  @ApiProperty({ description: 'Lieferantin (z. B. Empa)' })
  @DbPlatformColumn({ length: 80, nullable: false, default: '' })
  supplier: string;

  @ApiProperty({ description: 'Lieferdatum YYYY-MM-DD' })
  @DbPlatformColumn({ type: 'varchar', length: 10, nullable: false })
  deliveredAt: string;

  @ApiProperty({ description: 'Referenzjahr' })
  @DbPlatformColumn({ type: 'int', nullable: false })
  referenceYear: number;

  @ApiProperty({ enum: BUILD_YEAR_CLASS, description: 'Baujahr der Anlagenteile' })
  @DbPlatformColumn({ type: 'varchar', length: 12, nullable: false, default: 'mixed' })
  buildYearClass: BuildYearClassCode;

  @ApiProperty({ description: 'Aktuell gültiger Zustand' })
  @DbPlatformColumn({ type: 'boolean', nullable: false, default: false })
  isCurrent: boolean;

  @ApiProperty({ description: 'Stand MGDM' })
  @DbPlatformColumn({ type: 'boolean', nullable: false, default: false })
  isMgdm: boolean;

  @ApiProperty()
  @DbPlatformColumn({ type: 'boolean', nullable: false, default: true })
  enabled: boolean;

  @ManyToOne(() => AreaEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'areaId', referencedColumnName: 'id' },
  ])
  area: AreaEntity;

  @OneToMany(() => AreaWlrEntity, (row) => row.calculation)
  wlr: AreaWlrEntity[];
}
