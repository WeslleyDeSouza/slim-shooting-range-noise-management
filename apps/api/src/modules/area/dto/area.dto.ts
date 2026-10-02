import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  AREA_STATUS,
  AREA_STATUS_REASON,
  AreaStatus,
  AreaStatusReason,
} from '../entities';

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

  @ApiProperty({ enum: AREA_STATUS, description: 'Kontingent-Ampel: aus Nutzungen und Kontingenten berechnet (Cache, nach jeder Änderung neu)' })
  quotaStatus: AreaStatus;

  @ApiProperty({ enum: AREA_STATUS, description: 'Lärm-Ampel: schlechtester Immissionspunkt des gültigen Zustands im laufenden Jahr (Cache, nach jeder Änderung neu)' })
  noiseStatus: AreaStatus;

  @ApiProperty({ enum: AREA_STATUS_REASON, nullable: true, type: String, description: 'Erklärung zur Kontingent-Ampel: no-usages (keine Nutzungen im Jahr und den zwei Vorjahren → none), no-quota (mindestens eine beschossene Kombination ohne Kontingent → Soll 0 nach B1 5.10, Ampel bleibt berechnet)' })
  quotaStatusReason: AreaStatusReason | null;

  @ApiProperty({ enum: AREA_STATUS_REASON, nullable: true, type: String, description: 'Warum die Lärm-Ampel «none» zeigt: no-calculation (kein Berechnungsstand), no-usages (Stand vorhanden, keine Nutzungen im Jahr)' })
  noiseStatusReason: AreaStatusReason | null;

  @ApiProperty({ nullable: true, type: String, description: 'Bezeichnung des gültigen Berechnungsstands, auf dem die Lärm-Ampel beruht' })
  noiseStatusBasis: string | null;

  @ApiProperty({ nullable: true, type: Number, description: 'Kalenderjahr der Ampeln (laufendes Jahr beim letzten Neuberechnen)' })
  statusYear: number | null;

  @ApiProperty({ description: 'Gesamtbeurteilung nach Anhang 7 (5.16)' })
  annex7Overall: boolean;

  @ApiProperty()
  enabled: boolean;

  // Stammdaten (5.16)
  @ApiProperty({ nullable: true, type: String, description: 'Schlüssel aus der Auswahlliste «classification» — Klassierung' })
  classification: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Schlüssel aus der Auswahlliste «recalculation_state» — Stand Neuberechnung' })
  recalculationState: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Schlüssel aus der Auswahlliste «remediation_project_state» — Bearbeitungsstand Sanierungsprojekt' })
  remediationProjectState: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Schlüssel aus der Auswahlliste «spm_state» — Stand SPM' })
  spmState: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Schlüssel aus der Auswahlliste «noise_remediation_state» — Stand Lärmsanierung' })
  noiseRemediationState: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Schlüssel aus der Auswahlliste «project_state» — Stand Projekt' })
  projectState: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Gültige Plangenehmigung' })
  planningApproval: string | null;
}

/** Stammdaten fields of 5.16 that create and update share (all optional, null clears). */
export class AreaMasterDataDto {
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ description: 'Gesamtbeurteilung nach Anhang 7 LSV (5.16 «Berechnungsart»)' })
  annex7Overall?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Klassierung: Schlüssel eines aktiven Werts der Auswahlliste «classification» (slm 1)' })
  classification?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Stand Neuberechnung: Schlüssel eines aktiven Werts der Auswahlliste «recalculation_state»' })
  recalculationState?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Bearbeitungsstand Sanierungsprojekt: Schlüssel eines aktiven Werts der Auswahlliste «remediation_project_state»' })
  remediationProjectState?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Stand SPM: Schlüssel eines aktiven Werts der Auswahlliste «spm_state»' })
  spmState?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Stand Lärmsanierung: Schlüssel eines aktiven Werts der Auswahlliste «noise_remediation_state»' })
  noiseRemediationState?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Stand Projekt: Schlüssel eines aktiven Werts der Auswahlliste «project_state»' })
  projectState?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @ApiPropertyOptional({ description: 'Gültige Plangenehmigung', nullable: true })
  planningApproval?: string | null;
}

export class AreaCreateDto extends AreaMasterDataDto {
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
  @IsBoolean()
  @ApiPropertyOptional({ default: true })
  enabled?: boolean;
}

export class AreaUpdateDto extends AreaMasterDataDto {
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  @ApiPropertyOptional()
  name?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  @ApiPropertyOptional({ description: 'Koordinationsabschnitt-Nr. (oder eigener Schlüssel, 5.16)' })
  coordinationSectionNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @ApiPropertyOptional({ description: 'Sachplan-Nr.', nullable: true })
  sectoralPlanNo?: string | null;

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
