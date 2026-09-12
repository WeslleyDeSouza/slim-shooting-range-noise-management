import { ApiProperty } from '@nestjs/swagger';
import { Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { PropagationEntity } from './propagation.entity';
import { StateObjectEntity } from './state-object.entity';

/**
 * Gebäude (B1.2 11.4.9, J1–J8): the building an Immissionspunkt sits on,
 * 3-D footprint, EGID (or address), assessment and inhabitants. Belongs to
 * the Ausbreitungsberechnung of its Zustand. Physical table `gebaeude`.
 */
@Entity('gebaeude')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'zustandId', 'id'])
export class BuildingEntity extends StateObjectEntity {
  protected self = BuildingEntity;

  @ApiProperty()
  @DbPlatformColumn({ name: 'berechnung_id', type: 'uuid', nullable: false })
  propagationId: string;

  @ApiProperty({ nullable: true, description: 'J4 EGID' })
  @DbPlatformColumn({ name: 'egid', type: 'varchar', length: 20, nullable: true })
  egid: string | null;

  @ApiProperty({ nullable: true, description: 'J5 Adresse (nur ohne EGID)' })
  @DbPlatformColumn({ name: 'adresse', type: 'varchar', length: 256, nullable: true })
  address: string | null;

  @ApiProperty({ description: 'J3 Oberflächentyp / Materialisierung (Codeliste)' })
  @DbPlatformColumn({ name: 'surface_type', length: 40, nullable: false, default: '' })
  surfaceType: string;

  @ApiProperty({ description: 'J6 Gesamt-Beurteilung (Codeliste: >AW, >IGW, AW, …)' })
  @DbPlatformColumn({ name: 'beurteilung', length: 40, nullable: false, default: '' })
  assessment: string;

  @ApiProperty({ description: 'J7 Personen wohnhaft im Gebäude' })
  @DbPlatformColumn({ name: 'personen', type: 'int', nullable: false, default: 0 })
  persons: number;

  @ApiProperty({ nullable: true, description: 'J8 Bemerkung' })
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
