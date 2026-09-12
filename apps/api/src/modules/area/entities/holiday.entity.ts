import { ApiProperty } from '@nestjs/swagger';
import { Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';
import { AreaEntity } from './area.entity';

/**
 * Feiertag am Standort (B1 7.4.3 / 7.4.4: «die am Standort des Schiessplatzes
 * lokal gültigen Feiertage»), whole or half (`from`/`to` bound the free
 * hours). `areaId` null = valid for every Schiessplatz of the tenant
 * (national); otherwise local to one Schiessplatz. Maintained in the
 * extended configuration (5.28). Physical table `feiertag`.
 */
@Entity('feiertag')
@Index(['tenantId', 'areaId', 'date'])
export class HolidayEntity extends SlimBaseEntity {
  protected self = HolidayEntity;

  @ApiProperty({ nullable: true, description: 'Schiessplatz; leer = für alle Schiessplätze' })
  @DbPlatformColumn({ type: 'uuid', nullable: true })
  areaId: string | null;

  @ApiProperty({ description: 'Datum YYYY-MM-DD' })
  @DbPlatformColumn({ type: 'varchar', length: 10, nullable: false })
  date: string;

  @ApiProperty({ nullable: true, description: 'Halber Feiertag: frei ab HH:mm' })
  @DbPlatformColumn({ type: 'varchar', length: 5, nullable: true })
  from: string | null;

  @ApiProperty({ nullable: true, description: 'Halber Feiertag: frei bis HH:mm' })
  @DbPlatformColumn({ type: 'varchar', length: 5, nullable: true })
  to: string | null;

  @ApiProperty({ description: 'Bezeichnung, z. B. «Auffahrt»' })
  @DbPlatformColumn({ length: 120, nullable: false })
  name: string;

  @ManyToOne(() => AreaEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'areaId', referencedColumnName: 'id' },
  ])
  area: AreaEntity | null;
}
