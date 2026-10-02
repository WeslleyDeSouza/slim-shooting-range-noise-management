import { ApiProperty } from '@nestjs/swagger';

/** Metadata of the uploaded Benutzerhandbuch (the file itself: `GET admin/settings/manual`). */
export class ManualInfoDto {
  @ApiProperty({ description: 'Dateiname wie hochgeladen, z. B. «Benutzerhandbuch SLIM.pdf»' })
  fileName: string;

  @ApiProperty({ description: 'Grösse in Bytes' })
  size: number;

  @ApiProperty({ description: 'Zeitpunkt des Uploads (ISO 8601)' })
  uploadedAt: string;
}

/**
 * Erweiterte Konfiguration (B1 5.28) as every signed-in user of the tenant
 * reads it: the app needs the Sperrdatum in the entry form, the thresholds
 * for the legends, the colours for the Ampel and the contacts and the
 * Benutzerhandbuch for the main menu (B1 5.9). Thresholds are always filled
 * (defaults of B1 5.10 when nothing is configured); colours and contacts are
 * null when not set.
 */
export class SystemSettingsDto {
  @ApiProperty({ nullable: true, type: String, description: 'Sperrdatum der Schusszahlenerfassung (YYYY-MM-DD): Nutzungen mit Datum bis und mit diesem Tag können nicht erfasst, geändert oder gelöscht werden; null = keine Sperre' })
  usageLockDate: string | null;

  @ApiProperty({ description: 'Ampel «Einhaltung Kontingent Plangenehmigung»: grün, wenn Ist ≤ … % des Solls (Standard 100)' })
  quotaGreenMaxPercent: number;

  @ApiProperty({ description: 'Ampel «Einhaltung Kontingent Plangenehmigung»: orange, wenn Ist ≤ … % des Solls, darüber rot (Standard 125)' })
  quotaOrangeMaxPercent: number;

  @ApiProperty({ description: 'Ampel «Lärmbelastung» der Empfangspunkte: grün, wenn Beurteilungspegel − Grenzwert ≤ … dB (Standard −5)' })
  noiseGreenMaxDb: number;

  @ApiProperty({ description: 'Ampel «Lärmbelastung» der Empfangspunkte: orange, wenn Beurteilungspegel − Grenzwert ≤ … dB, darüber rot (Standard 0)' })
  noiseOrangeMaxDb: number;

  @ApiProperty({ nullable: true, type: String, description: 'Ampelfarbe «eingehalten» als #rrggbb; null = Standardfarbe des Designs' })
  colorOk: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Ampelfarbe «zu prüfen» als #rrggbb; null = Standardfarbe des Designs' })
  colorWarn: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Ampelfarbe «überschritten» als #rrggbb; null = Standardfarbe des Designs' })
  colorOver: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Fachverantwortliche/r (Hauptmenü, B1 5.9): Name oder Stelle' })
  specialistName: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Fachverantwortliche/r: Telefonnummer' })
  specialistPhone: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Fachverantwortliche/r: E-Mail-Adresse' })
  specialistEmail: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Systemadministration (Hauptmenü, B1 5.9): Name oder Stelle' })
  sysadminName: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Systemadministration: Telefonnummer' })
  sysadminPhone: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Systemadministration: E-Mail-Adresse' })
  sysadminEmail: string | null;

  @ApiProperty({ type: ManualInfoDto, nullable: true, description: 'Hochgeladenes Benutzerhandbuch (PDF); null = keines hinterlegt' })
  manual: ManualInfoDto | null;
}
