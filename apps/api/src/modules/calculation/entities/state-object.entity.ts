import { ApiProperty } from '@nestjs/swagger';
import { JoinColumn, ManyToOne } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';
import { AreaCalculationEntity } from './area-calculation.entity';

/**
 * Base of every hellblau object of B1 Kap. 10.2: it belongs to exactly one
 * Zustand (`zustandId`, cascade on delete) and may carry a geometry. The
 * geometry is stored as WKT text in LV95 (EPSG:2056, Z where the catalogue
 * asks for it). **Prototype state**: text WKT. Target: PostGIS `geometry`
 * with SRID 2056, dimension per class (PolylineZ, PolygonZ, PointZ),
 * `ST_IsValid` check on import, GiST index — parsers, serialisers and the
 * import validation change, the column name does not.
 */
export abstract class StateObjectEntity extends SlimBaseEntity {
  @ApiProperty({ description: 'Zustand, zu dem das Objekt gehört' })
  @DbPlatformColumn({ name: 'zustand_id', type: 'uuid', nullable: false })
  zustandId: string;

  @ApiProperty({ nullable: true, description: 'Geometrie als WKT (LV95, EPSG:2056)' })
  @DbPlatformColumn({ name: 'geometrie', type: 'text', nullable: true })
  geometry: string | null;

  @ManyToOne(() => AreaCalculationEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'zustand_id', referencedColumnName: 'id' },
  ])
  state: AreaCalculationEntity;
}
