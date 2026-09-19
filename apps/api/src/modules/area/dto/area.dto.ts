import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  AREA_CLASSIFICATION,
  AREA_STATUS,
  AREA_STATUS_REASON,
  AreaClassification,
  AreaStatus,
  AreaStatusReason,
  NOISE_REMEDIATION_STATE,
  NoiseRemediationState,
  PROJECT_STATE,
  ProjectState,
  RECALCULATION_STATE,
  RecalculationState,
  REMEDIATION_PROJECT_STATE,
  RemediationProjectState,
  SPM_STATE,
  SpmState,
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
  @ApiProperty({ enum: AREA_CLASSIFICATION, nullable: true, type: String, description: 'Klassierung' })
  classification: AreaClassification | null;

  @ApiProperty({ enum: RECALCULATION_STATE, nullable: true, type: String, description: 'Stand Neuberechnung' })
  recalculationState: RecalculationState | null;

  @ApiProperty({ enum: REMEDIATION_PROJECT_STATE, nullable: true, type: String, description: 'Bearbeitungsstand Sanierungsprojekt' })
  remediationProjectState: RemediationProjectState | null;

  @ApiProperty({ enum: SPM_STATE, nullable: true, type: String, description: 'Stand SPM' })
  spmState: SpmState | null;

  @ApiProperty({ enum: NOISE_REMEDIATION_STATE, nullable: true, type: String, description: 'Stand Lärmsanierung' })
  noiseRemediationState: NoiseRemediationState | null;

  @ApiProperty({ enum: PROJECT_STATE, nullable: true, type: String, description: 'Stand Projekt' })
  projectState: ProjectState | null;

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
  @IsIn(AREA_CLASSIFICATION)
  @ApiPropertyOptional({ enum: AREA_CLASSIFICATION, nullable: true })
  classification?: AreaClassification | null;

  @IsOptional()
  @IsIn(RECALCULATION_STATE)
  @ApiPropertyOptional({ enum: RECALCULATION_STATE, nullable: true })
  recalculationState?: RecalculationState | null;

  @IsOptional()
  @IsIn(REMEDIATION_PROJECT_STATE)
  @ApiPropertyOptional({ enum: REMEDIATION_PROJECT_STATE, nullable: true })
  remediationProjectState?: RemediationProjectState | null;

  @IsOptional()
  @IsIn(SPM_STATE)
  @ApiPropertyOptional({ enum: SPM_STATE, nullable: true })
  spmState?: SpmState | null;

  @IsOptional()
  @IsIn(NOISE_REMEDIATION_STATE)
  @ApiPropertyOptional({ enum: NOISE_REMEDIATION_STATE, nullable: true })
  noiseRemediationState?: NoiseRemediationState | null;

  @IsOptional()
  @IsIn(PROJECT_STATE)
  @ApiPropertyOptional({ enum: PROJECT_STATE, nullable: true })
  projectState?: ProjectState | null;

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
