import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { Repository } from 'typeorm';
import { AreaQuotaEntity, RoomCombinationEntity } from '../area/entities';
import { ANNEX7_LIMITS, ANNEX9_LIMITS, NOISE_ROUNDING_DEFAULT, NOISE_WARN_BAND_DB, QUOTA_WARN_FACTOR } from '@slim/lsv';
import { AssessmentInputs, AssessmentOptions, AssessmentService } from './assessment.service';
import { CalculationRunDto } from './dto';
import { CalculationRunEntity } from './entities';

/** Version of the calculation kernel a run was computed with (bumped with every formula change). */
export const KERNEL_VERSION = '@slim/lsv 1.3.0 (Zeitanteile, gemischte Simulation, A7-Konsistenz)';

/**
 * Berechnungslauf (B1 5.10 «Durchführen und Abspeichern von Immissions-
 * berechnungen»): applies a Zustand to a usage period through the
 * `AssessmentService` and stores the result **immutably** with a full copy
 * of the usages it used, the parameters and the kernel version — a later
 * edit of a usage never changes what a run reported. Runs are never updated
 * or deleted; `archive` only hides them.
 */
@Injectable()
export class CalculationRunService {
  constructor(
    @InjectRepository(CalculationRunEntity)
    private readonly runs: Repository<CalculationRunEntity>,
    @InjectRepository(RoomCombinationEntity)
    private readonly assignments: Repository<RoomCombinationEntity>,
    @InjectRepository(AreaQuotaEntity)
    private readonly quotas: Repository<AreaQuotaEntity>,
    private readonly assessment: AssessmentService,
  ) {}

  async run(tenantId: string, areaId: string, options: AssessmentOptions, createdBy: string): Promise<CalculationRunDto> {
    let captured: AssessmentInputs | undefined;
    // These are detached query results, retained from the assessment itself.
    // A subsequent database update cannot change these in-memory inputs.
    const result = await this.assessment.assess(tenantId, areaId, options, (inputs) => { captured = inputs; });
    if (!captured) throw new Error('Assessment inputs were not captured');
    if (!result.calculation) throw new NotFoundException('No calculation state to run on');
    const { reference, usages, assignments, model, referenceModel } = captured;
    const period = { from: result.period.from, to: result.period.to, selectedYears: result.period.selectedYears, years: result.period.years };
    const snapshot = usages.map((u) => ({
      id: u.id,
      roomId: u.roomId,
      date: u.date,
      timeFrom: u.timeFrom,
      timeTo: u.timeTo,
      usageType: u.usageType,
      civilUsageKind: u.civilUsageKind,
      unit: u.unit,
      personCount: u.personCount,
      source: u.source,
      positions: (u.positions ?? []).map((p) => ({ id: p.id, combinationId: p.combinationId, quantity: p.quantity, quantityUnit: p.quantityUnit })),
    }));
    const parameters = {
      holidays: reference.holidays.map((h) => ({ date: h.date, from: h.from, to: h.to, name: h.name, areaId: h.areaId })),
      limits: { annex9: ANNEX9_LIMITS, annex7: ANNEX7_LIMITS },
      thresholds: { noiseWarnBandDb: NOISE_WARN_BAND_DB, quotaWarnFactor: QUOTA_WARN_FACTOR },
      rounding: NOISE_ROUNDING_DEFAULT,
      annex7Overall: Boolean(reference.area.annex7Overall),
      o8: { onZeroWeights: 'refuse', release: null },
    };
    const quotas = await this.quotas.find({ where: { tenantId, areaId } });
    const referenceSnapshot = {
      state: model ? { ...model, wlr: [...model.wlr].map(([point, values]) => [point, [...values]]) } : null,
      comparisonState: referenceModel ? { ...referenceModel, wlr: [...referenceModel.wlr].map(([point, values]) => [point, [...values]]) } : null,
      rooms: reference.rooms.map((r) => ({ id: r.id, coordinationSectionNo: r.coordinationSectionNo, name: r.name, enabled: r.enabled })),
      combinations: reference.combinations.map((c) => ({
        id: c.id,
        name: c.nameDe,
        sonarmsId: c.sonarmsId,
        weapon: c.weapon?.nameDe,
        annex7Category: c.weapon?.annex7Category ?? null,
        caliber: c.caliber?.nameDe,
        quantityUnit: c.caliber?.quantityUnit,
      })),
      assignments: assignments.map((a) => ({ roomId: a.roomId, combinationId: a.combinationId, entryName: a.entryName, enabled: a.enabled })),
      quotas: quotas.map((q) => ({ combinationId: q.combinationId, shotsPerYear: q.shotsPerYear, basis: q.basis })),
    };
    const completeness = result.counts.incomplete > 0 ? 'incomplete' : 'complete';
    const checksum = createHash('sha256')
      .update(JSON.stringify({ state: result.calculation.id, period, snapshot, referenceSnapshot, parameters, result, kernel: KERNEL_VERSION }))
      .digest('hex');
    const saved = await this.runs.save(
      this.runs.create({
        tenantId,
        areaId,
        zustandId: result.calculation.id,
        periodFrom: period.from,
        periodTo: period.to,
        years: JSON.stringify(period.selectedYears),
        usageSnapshot: JSON.stringify(snapshot),
        referenceSnapshot: JSON.stringify(referenceSnapshot),
        parameters: JSON.stringify(parameters),
        kernelVersion: KERNEL_VERSION,
        completeness,
        results: JSON.stringify(result),
        checksum,
        createdBy,
        archived: false,
      }),
    );
    return this.toDto(saved, true);
  }

  async list(tenantId: string, areaId: string): Promise<CalculationRunDto[]> {
    const rows = await this.runs.find({ where: { tenantId, areaId, archived: false }, order: { createdAt: 'DESC' } });
    return rows.map((r) => this.toDto(r, false));
  }

  async get(tenantId: string, areaId: string, id: string): Promise<CalculationRunDto> {
    const row = await this.runs.findOne({ where: { tenantId, areaId, id } });
    if (!row) throw new NotFoundException(`Run ${id} not found`);
    return this.toDto(row, true);
  }

  /** Runs are immutable; archiving only hides them from the list. */
  async archive(tenantId: string, areaId: string, id: string): Promise<void> {
    const row = await this.runs.findOne({ where: { tenantId, areaId, id } });
    if (!row) throw new NotFoundException(`Run ${id} not found`);
    await this.runs.update({ tenantId, id }, { archived: true });
  }

  private toDto(row: CalculationRunEntity, withResults: boolean): CalculationRunDto {
    const snapshot = JSON.parse(row.usageSnapshot) as unknown[];
    return {
      id: row.id,
      areaId: row.areaId,
      calculationId: row.zustandId,
      periodFrom: row.periodFrom,
      periodTo: row.periodTo,
      years: JSON.parse(row.years) as number[],
      usageCount: snapshot.length,
      kernelVersion: row.kernelVersion,
      completeness: row.completeness,
      checksum: row.checksum,
      createdBy: row.createdBy,
      createdAt: (row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt)).toISOString(),
      results: withResults ? JSON.parse(row.results) : null,
    };
  }
}
