import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AREA_STATUS, AreaStatus } from '../entities';

/** One area as the API returns it (the generated client model `AreaResultDto`). */
export class AreaResultDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Bezeichnung' })
  name: string;

  @ApiProperty({ description: 'Koordinationsabschnitt-Nr.' })
  coordinationSectionNo: string;

  @ApiProperty({ description: 'Sachplan-Nr.', nullable: true, type: String })
  sectoralPlanNo: string | null;

  @ApiProperty({ enum: AREA_STATUS })
  quotaStatus: AreaStatus;

  @ApiProperty({ enum: AREA_STATUS })
  noiseStatus: AreaStatus;

  @ApiProperty({ description: 'Gesamtbeurteilung nach Anhang 7 (5.16)' })
  annex7Overall: boolean;

  @ApiProperty()
  enabled: boolean;
}

export class AreaCreateDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  @ApiProperty()
  name: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  @ApiProperty({ description: 'Koordinationsabschnitt-Nr.' })
  coordinationSectionNo: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @ApiPropertyOptional({ description: 'Sachplan-Nr.', nullable: true })
  sectoralPlanNo?: string | null;

  @IsOptional()
  @IsIn(AREA_STATUS)
  @ApiPropertyOptional({ enum: AREA_STATUS, default: 'none' })
  quotaStatus?: AreaStatus;

  @IsOptional()
  @IsIn(AREA_STATUS)
  @ApiPropertyOptional({ enum: AREA_STATUS, default: 'none' })
  noiseStatus?: AreaStatus;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ default: true })
  enabled?: boolean;
}

export class AreaUpdateDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @ApiPropertyOptional()
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @ApiPropertyOptional({ description: 'Koordinationsabschnitt-Nr.' })
  coordinationSectionNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @ApiPropertyOptional({ description: 'Sachplan-Nr.', nullable: true })
  sectoralPlanNo?: string | null;

  @IsOptional()
  @IsIn(AREA_STATUS)
  @ApiPropertyOptional({ enum: AREA_STATUS })
  quotaStatus?: AreaStatus;

  @IsOptional()
  @IsIn(AREA_STATUS)
  @ApiPropertyOptional({ enum: AREA_STATUS })
  noiseStatus?: AreaStatus;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  enabled?: boolean;
}

/** Counts for the entry page tiles. */
export class AreaSummaryDto {
  @ApiProperty() total: number;
  @ApiProperty() ok: number;
  @ApiProperty() warn: number;
  @ApiProperty() over: number;
  @ApiProperty() none: number;
  @ApiProperty({ description: 'Areas with warn/over on quota or noise' })
  attention: number;
}

/** Master-data counts for the "Datenverwaltung" tile. */
export class DashboardDto {
  @ApiProperty() areas: number;
  @ApiProperty() users: number;
  @ApiProperty({ description: 'Distinct weapons of the allowed room × weapon combinations' })
  weapons: number;
}
