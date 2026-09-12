import { ApiProperty } from '@nestjs/swagger';
import { Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';
import { AreaEntity } from './area.entity';
import { WeaponCombinationEntity } from './weapon-combination.entity';

/**
 * Kontingent gemäss Plangenehmigung (B1 5.16): shots per year allowed for a
 * combination Waffe/Kaliber on the whole Schiessplatz — the Soll of the
 * quota traffic light (5.10). A combination without a row has Soll 0 and is
 * red as soon as it is shot (B1 5.10). Physical table `kontingent`.
 */
@Entity('kontingent')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'areaId', 'combinationId'])
export class AreaQuotaEntity extends SlimBaseEntity {
  protected self = AreaQuotaEntity;

  @ApiProperty()
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  areaId: string;

  @ApiProperty()
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  combinationId: string;

  @ApiProperty({ description: 'Schuss pro Jahr gemäss Plangenehmigung (oder Sanierungsbericht)' })
  @DbPlatformColumn({ type: 'decimal', precision: 12, scale: 3, nullable: false, default: 0, transformer: { to: (v: number) => v, from: (v: string | number | null) => (v == null ? v : Number(v)) } })
  shotsPerYear: number;

  @ApiProperty({ description: 'Herkunft: Plangenehmigung oder Sanierungsbericht (ohne Plangenehmigung)', nullable: true })
  @DbPlatformColumn({ type: 'varchar', length: 120, nullable: true })
  basis: string | null;

  @ManyToOne(() => AreaEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'areaId', referencedColumnName: 'id' },
  ])
  area: AreaEntity;

  @ManyToOne(() => WeaponCombinationEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'combinationId', referencedColumnName: 'id' },
  ])
  combination: WeaponCombinationEntity;
}
