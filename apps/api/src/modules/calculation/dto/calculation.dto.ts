import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { AREA_STATUS, AreaStatus } from '../../area/entities';
import {
  BUILD_YEAR_CLASS,
  BuildYearClassCode,
  RECEIVER_TYPE,
  ReceiverType,
  SENSITIVITY_LEVEL,
  SensitivityLevelCode,
} from '../entities';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Which LSV annex / limit a row is assessed against. */
export const LSV_ANNEX = [9, 7] as const;
export const LIMIT_KIND = ['igw', 'pw'] as const;
export type LimitKindCode = (typeof LIMIT_KIND)[number];

/** A calculation state (Berechnungsgrundlage) as the pages show it. */
export class CalculationDto {
  @ApiProperty() id: string;
  @ApiProperty({ description: 'Bezeichnung des Zustands' }) name: string;
  @ApiProperty({ description: 'Immissionsberechnung (Lieferung), zu der der Zustand gehört' }) calculationId: string;
  @ApiProperty() calculationName: string;
  @ApiProperty() supplier: string;
  @ApiProperty({ description: 'YYYY-MM-DD' }) deliveredAt: string;
  @ApiProperty() referenceYear: number;
  @ApiProperty({ enum: BUILD_YEAR_CLASS }) buildYearClass: BuildYearClassCode;
  @ApiProperty() isCurrent: boolean;
  @ApiProperty() isMgdm: boolean;
  @ApiProperty({ description: 'Sources with levels in this state' }) sourceCount: number;
}

export class PeriodDto {
  @ApiProperty({ description: 'YYYY-MM-DD' }) from: string;
  @ApiProperty({ description: 'YYYY-MM-DD' }) to: string;
  @ApiProperty({ description: 'Calendar years the shot counts are averaged over' })
  years: number;
}

export class StateCountsDto {
  @ApiProperty() total: number;
  @ApiProperty() ok: number;
  @ApiProperty() warn: number;
  @ApiProperty() over: number;
  @ApiProperty() none: number;
}

/** One assessment line of a receiver (annex × limit kind). */
export class AssessmentRowDto {
  @ApiProperty({ enum: LSV_ANNEX, description: '9 = militärisch, 7 = zivil' }) annex: 9 | 7;
  @ApiProperty({ enum: LIMIT_KIND }) limitKind: LimitKindCode;
  @ApiProperty({ description: 'Grenzwert [dB] für die Empfindlichkeitsstufe' }) limit: number;
  @ApiProperty({ description: 'Whether this limit applies (Baujahr rule 7.7)' }) applicable: boolean;
  @ApiProperty({ nullable: true, type: Number, description: 'Beurteilungspegel Lr [dB], null = nicht anwendbar / keine Daten' })
  level: number | null;
  @ApiProperty({ enum: AREA_STATUS }) state: AreaStatus;
  @ApiProperty({ nullable: true, type: Number, description: 'Grenzwert − Lr [dB]' })
  reserve: number | null;
  @ApiProperty({ nullable: true, type: Number, description: 'Lr − Lr of the current state [dB] when another state is viewed' })
  deltaToCurrent: number | null;
}

export class ReceiverDto {
  @ApiProperty() id: string;
  @ApiProperty() code: string;
  @ApiProperty({ nullable: true, type: String }) egid: string | null;
  @ApiProperty() address: string;
  @ApiProperty({ nullable: true, type: String }) municipality: string | null;
  @ApiProperty({ enum: RECEIVER_TYPE }) type: ReceiverType;
  @ApiProperty({ enum: SENSITIVITY_LEVEL }) sensitivityLevel: SensitivityLevelCode;
  @ApiProperty({ nullable: true, type: Number }) east: number | null;
  @ApiProperty({ nullable: true, type: Number }) north: number | null;
  @ApiProperty() mapX: number;
  @ApiProperty() mapY: number;
}

export class ReceiverAssessmentDto extends ReceiverDto {
  @ApiProperty({ enum: AREA_STATUS, description: 'Worst applicable row' }) state: AreaStatus;
  @ApiProperty({ type: AssessmentRowDto, isArray: true }) rows: AssessmentRowDto[];
}

/** Annex 9 operating data derived from the usages (transparency, 7.4). */
export class OperatingDataRowDto {
  @ApiProperty() weaponId: string;
  @ApiProperty() sourceId: string;
  @ApiProperty() roomName: string;
  @ApiProperty() weaponName: string;
  @ApiProperty({ description: 'Schuss innerhalb Werktag / Jahr' }) inside: number;
  @ApiProperty({ description: 'Schuss ausserhalb Werktag / Jahr' }) outside: number;
}

/** 5.12 «Details»: every receiver assessed against the limits. */
export class AssessmentDto {
  @ApiProperty() areaId: string;
  @ApiProperty({ type: CalculationDto, nullable: true }) calculation: CalculationDto | null;
  @ApiProperty({ type: CalculationDto, nullable: true }) current: CalculationDto | null;
  @ApiProperty({ type: CalculationDto, isArray: true }) calculations: CalculationDto[];
  @ApiProperty({ type: PeriodDto }) period: PeriodDto;
  @ApiProperty({ type: StateCountsDto }) counts: StateCountsDto;
  @ApiProperty({ type: ReceiverAssessmentDto, isArray: true }) receivers: ReceiverAssessmentDto[];
  @ApiProperty({ type: OperatingDataRowDto, isArray: true }) operatingData: OperatingDataRowDto[];
  @ApiProperty({ description: 'ISO timestamp of this calculation run' }) calculatedAt: string;
}

/** One editable line of the simulation table (room × weapon). */
export class SimulationRowDto {
  @ApiProperty() weaponId: string;
  @ApiProperty() sourceId: string;
  @ApiProperty() roomId: string;
  @ApiProperty() roomName: string;
  @ApiProperty({ nullable: true, type: String }) roomNo: string | null;
  @ApiProperty() weapon: string;
  @ApiProperty() caliber: string;
  @ApiProperty() weaponName: string;
  @ApiProperty({ description: 'Ist: Schuss innerhalb Werktag im Jahr' }) inside: number;
  @ApiProperty({ description: 'Ist: Schuss ausserhalb Werktag im Jahr' }) outside: number;
  @ApiProperty({ description: 'Whether the current state has levels for this source' }) hasLevels: boolean;
}

export class SimulationReceiverDto extends ReceiverDto {
  @ApiProperty({ enum: LIMIT_KIND }) limitKind: LimitKindCode;
  @ApiProperty() limit: number;
  @ApiProperty({ nullable: true, type: Number, description: 'Ist-Pegel Lr Anhang 9 [dB]' }) current: number | null;
  @ApiProperty({ enum: AREA_STATUS }) currentState: AreaStatus;
}

/** 5.13 «Simulation»: the starting point of a run. */
export class SimulationBaseDto {
  @ApiProperty() areaId: string;
  @ApiProperty() year: number;
  @ApiProperty({ type: CalculationDto, nullable: true }) calculation: CalculationDto | null;
  @ApiProperty({ type: SimulationRowDto, isArray: true }) rows: SimulationRowDto[];
  @ApiProperty({ type: SimulationReceiverDto, isArray: true }) receivers: SimulationReceiverDto[];
}

export class SimulationRunRowDto {
  @IsUUID()
  @ApiProperty()
  weaponId: string;

  @IsInt()
  @Min(0)
  @Max(100_000_000)
  @ApiProperty({ minimum: 0 })
  inside: number;

  @IsInt()
  @Min(0)
  @Max(100_000_000)
  @ApiProperty({ minimum: 0 })
  outside: number;
}

export class SimulationRunDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  @ApiProperty({ description: 'Year whose usages are the Ist' })
  year: number;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({ description: 'Calculation state; default: the current one' })
  calculationId?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SimulationRunRowDto)
  @ApiProperty({ type: SimulationRunRowDto, isArray: true })
  rows: SimulationRunRowDto[];
}

export class SimulationResultReceiverDto extends SimulationReceiverDto {
  @ApiProperty({ nullable: true, type: Number, description: 'Simulierter Lr [dB]' }) simulated: number | null;
  @ApiProperty({ enum: AREA_STATUS }) simulatedState: AreaStatus;
  @ApiProperty({ nullable: true, type: Number, description: 'simulated − current [dB]' }) delta: number | null;
}

export class SimulationTotalsDto {
  @ApiProperty() inside: number;
  @ApiProperty() outside: number;
  @ApiProperty() baseInside: number;
  @ApiProperty() baseOutside: number;
}

export class SimulationResultDto {
  @ApiProperty() areaId: string;
  @ApiProperty() year: number;
  @ApiProperty({ type: CalculationDto, nullable: true }) calculation: CalculationDto | null;
  @ApiProperty({ type: SimulationResultReceiverDto, isArray: true }) receivers: SimulationResultReceiverDto[];
  @ApiProperty({ type: StateCountsDto }) counts: StateCountsDto;
  @ApiProperty({ type: SimulationTotalsDto }) totals: SimulationTotalsDto;
  @ApiProperty({ description: 'ISO timestamp of the run' }) calculatedAt: string;
}

/** Query of the assessment endpoint. */
export class AssessmentQueryDto {
  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({ description: 'Calculation state; default: the current one' })
  calculationId?: string;

  @IsOptional()
  @Matches(DATE)
  @ApiPropertyOptional({ description: 'YYYY-MM-DD, default: 1 January of this year' })
  from?: string;

  @IsOptional()
  @Matches(DATE)
  @ApiPropertyOptional({ description: 'YYYY-MM-DD, default: today' })
  to?: string;
}
