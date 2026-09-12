import { ApiProperty } from '@nestjs/swagger';
import { Entity, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';

/**
 * Waffenkategorie (B1 5.25): a maintainable pick list (slm 1) that groups
 * the weapons for the entry form and the reports. `code` is the stable key
 * the code and the demo dataset refer to (e.g. `handguns`); the titles are
 * the DE/FR/IT labels the masks show.
 *
 * Übergeordnete Stammdaten (B1 Kap. 10): not part of any calculation state.
 * Physical table `waffenkategorie` (German database objects, B1 12.2 / slm 51).
 */
@Entity('waffenkategorie')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'code'])
export class WeaponCategoryEntity extends SlimBaseEntity {
  protected self = WeaponCategoryEntity;

  @ApiProperty({ description: 'Stabiler Schlüssel, z. B. «handguns»' })
  @DbPlatformColumn({ length: 40, nullable: false })
  code: string;

  @ApiProperty({ description: 'Bezeichnung DE' })
  @DbPlatformColumn({ length: 120, nullable: false })
  nameDe: string;

  @ApiProperty({ description: 'Bezeichnung FR', nullable: true })
  @DbPlatformColumn({ type: 'varchar', length: 120, nullable: true })
  nameFr: string | null;

  @ApiProperty({ description: 'Bezeichnung IT', nullable: true })
  @DbPlatformColumn({ type: 'varchar', length: 120, nullable: true })
  nameIt: string | null;

  @ApiProperty()
  @DbPlatformColumn({ type: 'int', nullable: false, default: 0 })
  sortOrder: number;

  @ApiProperty({ description: 'Aktiv (inaktive Werte bleiben für alte Nutzungen referenzierbar)' })
  @DbPlatformColumn({ type: 'boolean', nullable: false, default: true })
  enabled: boolean;
}
