import { ApiProperty } from '@nestjs/swagger';
import { Entity, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';

/** Unit of a quantity: shots (Stück) or kilograms of explosive (B1 6.2, 11.2.3). */
export const QUANTITY_UNIT = ['shots', 'kg'] as const;
export type QuantityUnit = (typeof QUANTITY_UNIT)[number];

/**
 * Kaliber / Munitionstyp (B1 5.23): DE/FR/IT name, ALN-Nr., SAP-Nr. The
 * `quantityUnit` says how a quantity of this calibre is entered — «Stück»
 * for ammunition, «kg» for explosives (B1 11.2.3 «basierend auf den
 * Stammdaten des Kalibers»). Übergeordnete Stammdaten. Physical table `kaliber`.
 */
@Entity('kaliber')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'nameDe'])
export class CaliberEntity extends SlimBaseEntity {
  protected self = CaliberEntity;

  @ApiProperty({ description: 'Bezeichnung DE, z. B. «5.6 mm GP 90»' })
  @DbPlatformColumn({ length: 120, nullable: false })
  nameDe: string;

  @ApiProperty({ description: 'Bezeichnung FR', nullable: true })
  @DbPlatformColumn({ type: 'varchar', length: 120, nullable: true })
  nameFr: string | null;

  @ApiProperty({ description: 'Bezeichnung IT', nullable: true })
  @DbPlatformColumn({ type: 'varchar', length: 120, nullable: true })
  nameIt: string | null;

  @ApiProperty({ description: 'ALN-Nr.', nullable: true })
  @DbPlatformColumn({ type: 'varchar', length: 40, nullable: true })
  alnNo: string | null;

  @ApiProperty({ description: 'SAP-Nr.', nullable: true })
  @DbPlatformColumn({ type: 'varchar', length: 40, nullable: true })
  sapNo: string | null;

  @ApiProperty({ enum: QUANTITY_UNIT, description: 'Einheit der Menge: Stück oder kg' })
  @DbPlatformColumn({ type: 'varchar', length: 5, nullable: false, default: 'shots' })
  quantityUnit: QuantityUnit;

  @ApiProperty()
  @DbPlatformColumn({ type: 'boolean', nullable: false, default: true })
  enabled: boolean;
}
