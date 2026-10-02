import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { AREA_STATUS, AREA_STATUS_REASON, AreaStatus, AreaStatusReason, QUANTITY_UNIT, QuantityUnit } from '../../area/entities';

/** Colours of one comparison against the Kontingent (B1 5.10). */
export const QUOTA_STATE = ['ok', 'warn', 'over'] as const;
export type QuotaState = (typeof QUOTA_STATE)[number];

export class QuotaOverviewQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1990)
  @Max(2200)
  @ApiPropertyOptional({ description: 'Kalenderjahr des Vergleichs; Standard: das laufende Jahr' })
  year?: number;
}

/** One Waffe/Kaliber of the «Übersicht Kontingente gemäss Plangenehmigung» (B1 5.10, Bedienelement 3). */
export class QuotaRowDto {
  @ApiProperty({ description: 'Id der Kombination Waffe/Kaliber (uuid)' })
  combinationId: string;

  @ApiProperty({ description: 'Bezeichnung der Kombination, z. B. «Stgw 90 · 5.6 mm»' })
  name: string;

  @ApiProperty({ enum: QUANTITY_UNIT, description: 'Einheit der Mengen dieser Zeile aus dem Kaliber: Stück (shots) oder Kilogramm (kg)' })
  quantityUnit: QuantityUnit;

  @ApiProperty({ description: 'Soll: Kontingent pro Jahr gemäss Plangenehmigung; 0, wenn für die Kombination kein Kontingent erfasst ist (B1 5.10)' })
  target: number;

  @ApiProperty({ description: 'Für die Kombination ist ein Kontingent erfasst; false = Nutzungen ohne Kontingent, das Soll gilt als 0' })
  hasQuota: boolean;

  @ApiProperty({ nullable: true, type: String, description: 'Herkunft des Kontingents: Plangenehmigung oder Sanierungsbericht' })
  basis: string | null;

  @ApiProperty({ description: 'Ist des gewählten Jahres: Summe der erfassten Mengen' })
  current: number;

  @ApiProperty({ enum: QUOTA_STATE, description: 'Ampel «Vergleich laufendes Jahr»: Ist des Jahres gegen das Soll' })
  currentState: QuotaState;

  @ApiProperty({ description: 'Ist im Durchschnitt des gewählten Jahres und der zwei Jahre davor (drei Dezimalen)' })
  average: number;

  @ApiProperty({ enum: QUOTA_STATE, description: 'Ampel «Vergleich Ø über 3 Jahre»: Durchschnitt gegen das Soll' })
  averageState: QuotaState;
}

/** Kontingentvergleich eines Schiessplatzes (B1 5.10): die Zeilen der Tabelle und die Ampel, die daraus folgt. */
export class QuotaOverviewDto {
  @ApiProperty({ description: 'Kalenderjahr des Vergleichs' })
  year: number;

  @ApiProperty({ description: 'Erstes Jahr des Dreijahresmittels (Jahr − 2)' })
  fromYear: number;

  @ApiProperty({ type: Number, isArray: true, description: 'Jahre zur Auswahl: das laufende Jahr und die Jahre mit erfassten Nutzungen, absteigend' })
  years: number[];

  @ApiProperty({ description: 'Schwellenwert grün in Prozent des Solls (B1 5.28): Ist bis und mit diesem Wert ist eingehalten' })
  greenMaxPercent: number;

  @ApiProperty({ description: 'Schwellenwert orange in Prozent des Solls (B1 5.28): darüber ist die Zeile rot' })
  orangeMaxPercent: number;

  @ApiProperty({ enum: AREA_STATUS, description: 'Ampel «Einhaltung Kontingent»: die schlechteste Farbe aller Zeilen; none ohne Nutzungen im Zeitraum' })
  status: AreaStatus;

  @ApiProperty({ enum: AREA_STATUS_REASON, nullable: true, description: 'Grund für grau (no-usages) oder für rot wegen Nutzungen ohne Kontingent (no-quota)' })
  reason: AreaStatusReason | null;

  @ApiProperty({ type: QuotaRowDto, isArray: true, description: 'Eine Zeile je Kombination mit Kontingent oder mit Nutzungen im Zeitraum, nach Bezeichnung sortiert' })
  rows: QuotaRowDto[];
}
