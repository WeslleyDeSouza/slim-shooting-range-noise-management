import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Changes of the Erweiterte Konfiguration (B1 5.28). Every field is
 * optional: only what is sent changes. `null` resets a field to its default
 * (no Sperrdatum, the threshold of B1 5.10, the colour of the design, no
 * contact detail).
 */
export class SystemSettingsUpdateDto {
  @IsOptional()
  @Matches(DATE)
  @ApiPropertyOptional({ nullable: true, type: String, example: '2025-12-31', description: 'Sperrdatum der Schusszahlenerfassung (YYYY-MM-DD): Nutzungen bis und mit diesem Datum können nicht mehr erfasst, geändert oder gelöscht werden; null hebt die Sperre auf' })
  usageLockDate?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(1000)
  @ApiPropertyOptional({ nullable: true, type: Number, example: 100, description: 'Kontingent-Ampel: grün, wenn Ist ≤ … % des Solls; null = Standard 100 %' })
  quotaGreenMaxPercent?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(1)
  @Max(1000)
  @ApiPropertyOptional({ nullable: true, type: Number, example: 125, description: 'Kontingent-Ampel: orange, wenn Ist ≤ … % des Solls, darüber rot; null = Standard 125 %; nicht kleiner als der Schwellenwert «grün»' })
  quotaOrangeMaxPercent?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(-50)
  @Max(50)
  @ApiPropertyOptional({ nullable: true, type: Number, example: -5, description: 'Empfangspunkt-Ampel: grün, wenn Beurteilungspegel − Grenzwert ≤ … dB; null = Standard −5 dB' })
  noiseGreenMaxDb?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(-50)
  @Max(50)
  @ApiPropertyOptional({ nullable: true, type: Number, example: 0, description: 'Empfangspunkt-Ampel: orange, wenn Beurteilungspegel − Grenzwert ≤ … dB, darüber rot; null = Standard 0 dB; nicht kleiner als der Schwellenwert «grün»' })
  noiseOrangeMaxDb?: number | null;

  @IsOptional()
  @Matches(COLOR)
  @ApiPropertyOptional({ nullable: true, type: String, example: '#1e7a3c', description: 'Ampelfarbe «eingehalten» als #rrggbb; null = Standardfarbe des Designs' })
  colorOk?: string | null;

  @IsOptional()
  @Matches(COLOR)
  @ApiPropertyOptional({ nullable: true, type: String, example: '#8a6100', description: 'Ampelfarbe «zu prüfen» als #rrggbb; null = Standardfarbe des Designs' })
  colorWarn?: string | null;

  @IsOptional()
  @Matches(COLOR)
  @ApiPropertyOptional({ nullable: true, type: String, example: '#c71624', description: 'Ampelfarbe «überschritten» als #rrggbb; null = Standardfarbe des Designs' })
  colorOver?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Fachverantwortliche/r: Name oder Stelle (Hauptmenü, B1 5.9)' })
  specialistName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Fachverantwortliche/r: Telefonnummer' })
  specialistPhone?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Fachverantwortliche/r: E-Mail-Adresse' })
  specialistEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Systemadministration: Name oder Stelle (Hauptmenü, B1 5.9)' })
  sysadminName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Systemadministration: Telefonnummer' })
  sysadminPhone?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Systemadministration: E-Mail-Adresse' })
  sysadminEmail?: string | null;
}
