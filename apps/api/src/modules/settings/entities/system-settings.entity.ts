import { ApiProperty } from '@nestjs/swagger';
import { Entity, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';

/**
 * Erweiterte Konfiguration (B1 5.28, slm 27): the application-wide settings
 * of one tenant — one row. Every column is nullable: an empty column means
 * «default» (`SETTINGS_DEFAULTS` in settings.service.ts), so a tenant
 * without a row behaves like B1 5.10 describes it.
 *
 * Schwellenwerte (FAQ 166): the Kontingent-Ampel in percent of the Soll,
 * the Empfangspunkt-Ampel in dB deviation from the limit. Contact details
 * are not part of Abbildung 40; B1 5.9 asks for them in the main menu, so
 * they are kept here where the Applikationsadministrator maintains them.
 *
 * Physical table `systemeinstellung` (German database objects, slm 51).
 */
@Entity('systemeinstellung')
@Unique(['tenantId', 'id'])
export class SystemSettingsEntity extends SlimBaseEntity {
  protected self = SystemSettingsEntity;

  @ApiProperty({ nullable: true, description: 'Sperrdatum der Schusszahlenerfassung (YYYY-MM-DD): Nutzungen bis und mit diesem Datum sind gesperrt' })
  @DbPlatformColumn({ name: 'sperrdatum_nutzungen', type: 'varchar', length: 10, nullable: true })
  usageLockDate: string | null;

  @ApiProperty({ nullable: true, description: 'Kontingent-Ampel: grün bis und mit … % des Solls' })
  @DbPlatformColumn({ name: 'kontingent_gruen_bis_prozent', type: 'float', nullable: true })
  quotaGreenMaxPercent: number | null;

  @ApiProperty({ nullable: true, description: 'Kontingent-Ampel: orange bis und mit … % des Solls, darüber rot' })
  @DbPlatformColumn({ name: 'kontingent_orange_bis_prozent', type: 'float', nullable: true })
  quotaOrangeMaxPercent: number | null;

  @ApiProperty({ nullable: true, description: 'Empfangspunkt-Ampel: grün bis und mit … dB Abweichung vom Grenzwert' })
  @DbPlatformColumn({ name: 'laerm_gruen_bis_db', type: 'float', nullable: true })
  noiseGreenMaxDb: number | null;

  @ApiProperty({ nullable: true, description: 'Empfangspunkt-Ampel: orange bis und mit … dB Abweichung vom Grenzwert, darüber rot' })
  @DbPlatformColumn({ name: 'laerm_orange_bis_db', type: 'float', nullable: true })
  noiseOrangeMaxDb: number | null;

  @ApiProperty({ nullable: true, description: 'Ampelfarbe grün (#rrggbb)' })
  @DbPlatformColumn({ name: 'farbe_gruen', type: 'varchar', length: 7, nullable: true })
  colorOk: string | null;

  @ApiProperty({ nullable: true, description: 'Ampelfarbe orange (#rrggbb)' })
  @DbPlatformColumn({ name: 'farbe_orange', type: 'varchar', length: 7, nullable: true })
  colorWarn: string | null;

  @ApiProperty({ nullable: true, description: 'Ampelfarbe rot (#rrggbb)' })
  @DbPlatformColumn({ name: 'farbe_rot', type: 'varchar', length: 7, nullable: true })
  colorOver: string | null;

  @ApiProperty({ nullable: true, description: 'Fachverantwortliche/r: Name oder Stelle' })
  @DbPlatformColumn({ name: 'fachkontakt_name', type: 'varchar', length: 200, nullable: true })
  specialistName: string | null;

  @ApiProperty({ nullable: true, description: 'Fachverantwortliche/r: Telefon' })
  @DbPlatformColumn({ name: 'fachkontakt_telefon', type: 'varchar', length: 60, nullable: true })
  specialistPhone: string | null;

  @ApiProperty({ nullable: true, description: 'Fachverantwortliche/r: E-Mail' })
  @DbPlatformColumn({ name: 'fachkontakt_email', type: 'varchar', length: 200, nullable: true })
  specialistEmail: string | null;

  @ApiProperty({ nullable: true, description: 'Systemadministration: Name oder Stelle' })
  @DbPlatformColumn({ name: 'systemkontakt_name', type: 'varchar', length: 200, nullable: true })
  sysadminName: string | null;

  @ApiProperty({ nullable: true, description: 'Systemadministration: Telefon' })
  @DbPlatformColumn({ name: 'systemkontakt_telefon', type: 'varchar', length: 60, nullable: true })
  sysadminPhone: string | null;

  @ApiProperty({ nullable: true, description: 'Systemadministration: E-Mail' })
  @DbPlatformColumn({ name: 'systemkontakt_email', type: 'varchar', length: 200, nullable: true })
  sysadminEmail: string | null;
}
