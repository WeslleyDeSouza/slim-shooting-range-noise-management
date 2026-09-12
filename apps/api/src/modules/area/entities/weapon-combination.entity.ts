import { ApiProperty } from '@nestjs/swagger';
import { Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';
import { CaliberEntity } from './caliber.entity';
import { WeaponEntity } from './weapon.entity';

/**
 * Kombination Waffe / Kaliber (B1 5.22, Kap. 10 «Kombination Waffe/
 * Munitionstyp»): the permanent identity a usage position and a room
 * assignment refer to. Carries the mapping to the sonARMS weapon list
 * (B1.7, `sonarmsId`) the import uses to match the sources of a state.
 *
 * A combination is **not** a source of the noise model: within a state it
 * may be spread over several Schusslinien (B1 7.5). Physical table
 * `waffe_kaliber_kombination`.
 */
@Entity('waffe_kaliber_kombination')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'weaponId', 'caliberId'])
export class WeaponCombinationEntity extends SlimBaseEntity {
  protected self = WeaponCombinationEntity;

  @ApiProperty()
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  weaponId: string;

  @ApiProperty()
  @DbPlatformColumn({ type: 'uuid', nullable: false })
  caliberId: string;

  @ApiProperty({ description: 'Bezeichnung DE, z. B. «Stgw 90 · 5.6 mm»' })
  @DbPlatformColumn({ length: 160, nullable: false })
  nameDe: string;

  @ApiProperty({ description: 'Bezeichnung FR', nullable: true })
  @DbPlatformColumn({ type: 'varchar', length: 160, nullable: true })
  nameFr: string | null;

  @ApiProperty({ description: 'Bezeichnung IT', nullable: true })
  @DbPlatformColumn({ type: 'varchar', length: 160, nullable: true })
  nameIt: string | null;

  @ApiProperty({ description: 'sonARMS-Waffe (Bezeichnung «Name» der Waffendatenbank, B1.7)', nullable: true })
  @DbPlatformColumn({ type: 'varchar', length: 120, nullable: true })
  sonarmsId: string | null;

  @ApiProperty()
  @DbPlatformColumn({ type: 'boolean', nullable: false, default: true })
  enabled: boolean;

  @ManyToOne(() => WeaponEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'weaponId', referencedColumnName: 'id' },
  ])
  weapon: WeaponEntity;

  @ManyToOne(() => CaliberEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'caliberId', referencedColumnName: 'id' },
  ])
  caliber: CaliberEntity;
}
