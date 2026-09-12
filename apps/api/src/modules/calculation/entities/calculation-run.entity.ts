import { ApiProperty } from '@nestjs/swagger';
import { Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { DbPlatformColumn } from '@app-galaxy/core-api';
import { SlimBaseEntity } from '@api-slim/common';
import { AreaEntity } from '../../area/entities';
import { AreaCalculationEntity } from './area-calculation.entity';

/** Completeness of a run (Fachregel O8). */
export const RUN_COMPLETENESS = ['complete', 'incomplete'] as const;
export type RunCompleteness = (typeof RUN_COMPLETENESS)[number];

/**
 * Berechnungslauf (B1 5.10 «Immissionsberechnung durchführen und
 * abspeichern», C2 2.3 «Berechnungsstand»): the application of one Zustand
 * (the model) to a chosen usage period. Stored **immutable** with everything
 * needed to reproduce it later — the usages as a full copy (not ids: a usage
 * may be edited afterwards), the permanent references as they were
 * (Stellungsräume, Kombinationen with their Anhang-7 category and unit,
 * zulässige Zuordnungen, Kontingente), the parameters (holidays, limits,
 * thresholds, rounding, O8 release), the kernel version, the completeness
 * and the results per Immissionspunkt. Physical table `berechnungslauf`.
 */
@Entity('berechnungslauf')
@Unique(['tenantId', 'id'])
@Index(['tenantId', 'areaId', 'createdAt'])
export class CalculationRunEntity extends SlimBaseEntity {
  protected self = CalculationRunEntity;

  @ApiProperty()
  @DbPlatformColumn({ name: 'schiessplatz_id', type: 'uuid', nullable: false })
  areaId: string;

  @ApiProperty({ description: 'Zustand (Modell), auf den die Nutzungen angewendet wurden' })
  @DbPlatformColumn({ name: 'zustand_id', type: 'uuid', nullable: false })
  zustandId: string;

  @ApiProperty({ description: 'Betrachtungszeitraum von (YYYY-MM-DD)' })
  @DbPlatformColumn({ name: 'zeitraum_von', type: 'varchar', length: 10, nullable: false })
  periodFrom: string;

  @ApiProperty({ description: 'Betrachtungszeitraum bis (YYYY-MM-DD)' })
  @DbPlatformColumn({ name: 'zeitraum_bis', type: 'varchar', length: 10, nullable: false })
  periodTo: string;

  @ApiProperty({ description: 'Gewählte Jahre (JSON-Liste), leer = zusammenhängender Zeitraum' })
  @DbPlatformColumn({ name: 'jahre', type: 'text', nullable: false, default: '[]' })
  years: string;

  @ApiProperty({ description: 'Vollständige Kopie der verwendeten Nutzungen mit Positionen (JSON)' })
  @DbPlatformColumn({ name: 'nutzungen_kopie', type: 'text', nullable: false })
  usageSnapshot: string;

  @ApiProperty({ description: 'Kopie der Referenzstruktur: Stellungsräume, Kombinationen, Zuordnungen, Kontingente (JSON)' })
  @DbPlatformColumn({ name: 'referenz_kopie', type: 'text', nullable: false, default: '{}' })
  referenceSnapshot: string;

  @ApiProperty({ description: 'Parameter: Feiertage, Grenzwerte, Schwellen, Rundung, O8-Freigabe (JSON)' })
  @DbPlatformColumn({ name: 'parameter', type: 'text', nullable: false })
  parameters: string;

  @ApiProperty({ description: 'Version des Berechnungskerns (@slim/lsv)' })
  @DbPlatformColumn({ name: 'kern_version', length: 80, nullable: false })
  kernelVersion: string;

  @ApiProperty({ enum: RUN_COMPLETENESS })
  @DbPlatformColumn({ name: 'vollstaendigkeit', type: 'varchar', length: 12, nullable: false })
  completeness: RunCompleteness;

  @ApiProperty({ description: 'Ergebnis je Immissionspunkt (JSON: AssessmentDto)' })
  @DbPlatformColumn({ name: 'ergebnis', type: 'text', nullable: false })
  results: string;

  @ApiProperty({ description: 'Prüfsumme über Nutzungen, Referenzen, Parameter und Modell' })
  @DbPlatformColumn({ name: 'pruefsumme', length: 64, nullable: false, default: '' })
  checksum: string;

  @ApiProperty({ description: 'Ersteller' })
  @DbPlatformColumn({ name: 'ersteller', length: 120, nullable: false, default: '' })
  createdBy: string;

  @ApiProperty({ description: 'Archiviert (Läufe werden nie geändert oder gelöscht)' })
  @DbPlatformColumn({ name: 'archiviert', type: 'boolean', nullable: false, default: false })
  archived: boolean;

  @ManyToOne(() => AreaEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'schiessplatz_id', referencedColumnName: 'id' },
  ])
  area: AreaEntity;

  /** Composite with the area: a run can only apply a state of its own Schiessplatz. */
  @ManyToOne(() => AreaCalculationEntity, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'tenantId', referencedColumnName: 'tenantId' },
    { name: 'schiessplatz_id', referencedColumnName: 'areaId' },
    { name: 'zustand_id', referencedColumnName: 'id' },
  ])
  state: AreaCalculationEntity;
}
