import { ApiProperty } from '@nestjs/swagger';
import { Entity, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';

/**
 * Benutzerhandbuch (B1 5.28 Element 2, 5.9, slm 53): the PDF the
 * Applikationsadministrator uploads and every user opens from the main
 * menu. One document per tenant — an upload replaces the previous one. The
 * file lives in the database (no shared file system between the containers);
 * `content` is not selected by default, the metadata is enough for the menu.
 *
 * Physical table `benutzerhandbuch` (German database objects, slm 51).
 */
@Entity('benutzerhandbuch')
@Unique(['tenantId', 'id'])
export class UserManualEntity extends SlimBaseEntity {
  protected self = UserManualEntity;

  @ApiProperty({ description: 'Dateiname wie hochgeladen' })
  @DbPlatformColumn({ name: 'dateiname', type: 'varchar', length: 200, nullable: false })
  fileName: string;

  @ApiProperty({ description: 'Grösse in Bytes' })
  @DbPlatformColumn({ name: 'groesse', type: 'int', nullable: false })
  size: number;

  @ApiProperty({ nullable: true, description: 'Benutzer, der das Dokument hochgeladen hat' })
  @DbPlatformColumn({ name: 'hochgeladen_von', type: 'varchar', length: 36, nullable: true })
  uploadedBy: string | null;

  /** The PDF itself. */
  @DbPlatformColumn({ name: 'inhalt', type: 'longblob', nullable: false, select: false })
  content: Buffer;
}
