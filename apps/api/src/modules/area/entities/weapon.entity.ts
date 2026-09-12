import { ApiProperty } from '@nestjs/swagger';
import { Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';
import { WeaponCategoryEntity } from './weapon-category.entity';

/** LSV Annex 7 weapon categories a–f (civil shooting); null = not assessable under Annex 7 (B1 5.24). */
export const ANNEX7_CATEGORY = ['a', 'b', 'c', 'd', 'e', 'f'] as const;
export type Annex7CategoryCode = (typeof ANNEX7_CATEGORY)[number];

/**
 * Waffe / Waffensystem (B1 5.24): master data with the Waffenkategorie
 * (grouping) and the Waffenkategorie nach Anhang 7 LSV (a–f, optional).
 * Übergeordnete Stammdaten (B1 Kap. 10). Physical table `waffe`.
 */
@Entity('waffe')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'nameDe'])
export class WeaponEntity extends SlimBaseEntity {
  protected self = WeaponEntity;

  @ApiProperty({ description: 'Bezeichnung DE, z. B. «Stgw 90»' })
  @DbPlatformColumn({ length: 120, nullable: false })
  nameDe: string;

  @ApiProperty({ description: 'Bezeichnung FR', nullable: true })
  @DbPlatformColumn({ type: 'varchar', length: 120, nullable: true })
  nameFr: string | null;

  @ApiProperty({ description: 'Bezeichnung IT', nullable: true })
  @DbPlatformColumn({ type: 'varchar', length: 120, nullable: true })
  nameIt: string | null;

  @ApiProperty({ description: 'Waffenkategorie (Gruppierung)' })
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  categoryId: string;

  @ApiProperty({ enum: ANNEX7_CATEGORY, nullable: true, description: 'Waffenkategorie nach Anhang 7 LSV (a–f)' })
  @DbPlatformColumn({ type: 'varchar', length: 1, nullable: true })
  annex7Category: Annex7CategoryCode | null;

  @ApiProperty()
  @DbPlatformColumn({ type: 'boolean', nullable: false, default: true })
  enabled: boolean;

  @ManyToOne(() => WeaponCategoryEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'categoryId', referencedColumnName: 'id' },
  ])
  category: WeaponCategoryEntity;
}
