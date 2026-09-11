import { ApiProperty } from '@nestjs/swagger';
import {
  BeforeInsert,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { DbPlatformColumn, TenantBaseEntity } from '@app-galaxy/core-api';

/** Traffic-light status of an area (quota / noise), see sitemap.md. */
export const AREA_STATUS = ['ok', 'warn', 'over', 'none'] as const;
export type AreaStatus = (typeof AREA_STATUS)[number];

/**
 * Area (Schiessplatz) — ELO naming. Tenant-scoped like every galaxy entity.
 * Status columns are the evaluated result of the latest calculation; they
 * will be derived from the calculation module once it exists.
 */
@Entity('area')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'coordinationSectionNo'])
export class AreaEntity extends TenantBaseEntity {
  protected self = AreaEntity;

  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Bezeichnung' })
  @DbPlatformColumn({ length: 120, nullable: false })
  name: string;

  @ApiProperty({ description: 'Koordinationsabschnitt-Nr.' })
  @DbPlatformColumn({ length: 20, nullable: false })
  coordinationSectionNo: string;

  @ApiProperty({ description: 'Sachplan-Nr.', nullable: true })
  @DbPlatformColumn({ type: 'varchar', length: 40, nullable: true })
  sectoralPlanNo: string | null;

  @ApiProperty({ enum: AREA_STATUS, description: 'Kontingent-Einhaltung' })
  @DbPlatformColumn({
    type: 'varchar',
    length: 8,
    nullable: false,
    default: 'none',
  })
  quotaStatus: AreaStatus;

  @ApiProperty({ enum: AREA_STATUS, description: 'Lärmbelastung' })
  @DbPlatformColumn({
    type: 'varchar',
    length: 8,
    nullable: false,
    default: 'none',
  })
  noiseStatus: AreaStatus;

  @ApiProperty()
  @DbPlatformColumn({ type: 'boolean', nullable: false, default: true })
  enabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  @BeforeInsert()
  protected async beforeInsert(): Promise<void> {
    // nothing yet (TenantBaseEntity contract)
  }
}
