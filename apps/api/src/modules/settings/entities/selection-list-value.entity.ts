import { ApiProperty } from '@nestjs/swagger';
import { Entity, Index, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';

/**
 * Wert einer Auswahlliste (B1 5.3, slm 1): «neue Werte hinzufügen,
 * bestehende ändern oder inaktivieren». `listKey` names the list (e.g.
 * `spm_state`), `code` is the stable key stored on the records that use the
 * value; the labels are what the masks show. A value is never deleted — it
 * is set inactive, so records that carry it keep their meaning.
 *
 * Physical table `auswahlliste_wert` (German database objects, slm 51).
 */
@Entity('auswahlliste_wert')
@Unique(['tenantId', 'id'])
@Unique(['tenantId', 'listKey', 'code'])
@Index(['tenantId', 'listKey', 'sortOrder'])
export class SelectionListValueEntity extends SlimBaseEntity {
  protected self = SelectionListValueEntity;

  @ApiProperty({ description: 'Auswahlliste, z. B. «spm_state»' })
  @DbPlatformColumn({ name: 'liste', type: 'varchar', length: 40, nullable: false })
  listKey: string;

  @ApiProperty({ description: 'Stabiler Schlüssel des Werts' })
  @DbPlatformColumn({ type: 'varchar', length: 24, nullable: false })
  code: string;

  @ApiProperty({ description: 'Bezeichnung DE' })
  @DbPlatformColumn({ name: 'bezeichnung_de', type: 'varchar', length: 120, nullable: false })
  labelDe: string;

  @ApiProperty({ nullable: true, description: 'Bezeichnung FR' })
  @DbPlatformColumn({ name: 'bezeichnung_fr', type: 'varchar', length: 120, nullable: true })
  labelFr: string | null;

  @ApiProperty({ nullable: true, description: 'Bezeichnung IT' })
  @DbPlatformColumn({ name: 'bezeichnung_it', type: 'varchar', length: 120, nullable: true })
  labelIt: string | null;

  @ApiProperty({ nullable: true, description: 'Bezeichnung EN' })
  @DbPlatformColumn({ name: 'bezeichnung_en', type: 'varchar', length: 120, nullable: true })
  labelEn: string | null;

  @ApiProperty({ description: 'Reihenfolge in der Auswahl' })
  @DbPlatformColumn({ name: 'reihenfolge', type: 'int', nullable: false, default: 0 })
  sortOrder: number;

  @ApiProperty({ description: 'Aktiv — inaktive Werte werden nicht mehr zur Auswahl angeboten' })
  @DbPlatformColumn({ name: 'aktiv', type: 'boolean', nullable: false, default: true })
  enabled: boolean;
}
