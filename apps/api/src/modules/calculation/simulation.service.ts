import { BadRequestException, forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { annex9Level, applicableLimits, LSV_EMPTY_LEVEL, limits, noiseState, roundDb, worstState } from '@slim/lsv';
import { RoomCombinationEntity } from '../area/entities';
import { UsageService } from '../usage/usage.service';
import { AssessmentService, countStates, labeller, toReceiverDto } from './assessment.service';
import { CalculationService, StateModel } from './calculation.service';
import {
  AssessmentRowDto,
  SimulationBaseDto,
  SimulationReceiverDto,
  SimulationResultDto,
  SimulationRowDto,
  SimulationRunDto,
} from './dto';
import { AreaCalculationEntity, ImmissionPointEntity } from './entities';
import { deriveOperatingData, distributeOntoState, OperatingData, pointSources, ReferenceData, refKey } from './operating-data';

/**
 * 5.13 «Simulation»: the year's shot counts per Stellungsraum × zulässige
 * Kombination (inside / outside the workday after 7.4.5) are the Ist; the
 * user overwrites them and the Beurteilungspegel after Annex 9 is recomputed
 * against the chosen state — through the same distribution onto its
 * Schusslinien as the assessment. A sandbox: nothing is written.
 */
@Injectable()
export class SimulationService {
  constructor(
    @InjectRepository(RoomCombinationEntity)
    private readonly assignments: Repository<RoomCombinationEntity>,
    private readonly assessment: AssessmentService,
    @Inject(forwardRef(() => UsageService))
    private readonly usages: UsageService,
    private readonly calculations: CalculationService,
  ) {}

  async base(tenantId: string, areaId: string, year: number, calculationId?: string): Promise<SimulationBaseDto> {
    const { calculation, rows, receivers, sourceCount } = await this.load(tenantId, areaId, year, calculationId);
    return {
      areaId,
      year,
      calculation: calculation ? this.calculations.toDto(calculation, sourceCount) : null,
      rows,
      receivers: receivers.map((r) => r.base),
    };
  }

  async run(tenantId: string, areaId: string, dto: SimulationRunDto): Promise<SimulationResultDto> {
    const { calculation, rows, receivers, model, reference, operating, labelOf, sourceCount } = await this.load(tenantId, areaId, dto.year, dto.calculationId);
    const known = new Set(rows.map((r) => refKey(r.roomId, r.combinationId)));
    const unknown = dto.rows.filter((r) => !known.has(refKey(r.roomId, r.combinationId)));
    if (unknown.length) {
      throw new BadRequestException(`Unknown combinations: ${unknown.map((r) => `${r.roomId}/${r.combinationId}`).join(', ')}`);
    }

    // Rows the client did not send keep their Ist values.
    const simulated: OperatingData = {
      ...operating,
      annex9: new Map([...operating.annex9].map(([key, value]) => [key, { ...value }])),
      // Simulation assesses A9 only; historical A7 quantities must not keep O8 warnings alive.
      annex7Shots: new Map(),
    };
    for (const row of dto.rows) simulated.annex9.set(refKey(row.roomId, row.combinationId), { inside: row.inside, outside: row.outside });

    const result = receivers.map(({ entity, base }) => {
      const { raw, incomplete } = model ? evaluate(entity, model, simulated, reference, labelOf) : { raw: null, incomplete: false };
      // State from the raw level (whole-dB rounding happens in noiseState), display rounded separately.
      const simulatedRows = model ? assessmentRows(entity, model, simulated, reference, labelOf) : [];
      const simulatedState = worstState(simulatedRows.map((r) => r.state));
      const level = raw === null ? null : roundDb(raw);
      return {
        ...base,
        incomplete,
        simulatedRows,
        simulated: level,
        simulatedState,
        delta: level !== null && base.current !== null ? roundDb(level - base.current) : null,
      };
    });

    const sum = (data: OperatingData, key: 'inside' | 'outside') => [...data.annex9.values()].reduce((t, s) => t + s[key], 0);
    return {
      areaId,
      year: dto.year,
      calculation: calculation ? this.calculations.toDto(calculation, sourceCount) : null,
      receivers: result,
      counts: countStates(result.map((r) => r.simulatedState)),
      totals: {
        inside: sum(simulated, 'inside'),
        outside: sum(simulated, 'outside'),
        baseInside: sum(operating, 'inside'),
        baseOutside: sum(operating, 'outside'),
      },
      calculatedAt: new Date().toISOString(),
    };
  }

  private async load(tenantId: string, areaId: string, year: number, calculationId?: string) {
    const reference = await this.assessment.reference(tenantId, areaId);
    const [{ selected }, usages, assignments] = await Promise.all([
      this.calculations.resolve(tenantId, areaId, calculationId),
      this.usages.listYear(tenantId, areaId, year),
      this.assignments.find({ where: { tenantId, areaId, enabled: true } }),
    ]);
    const model = selected ? await this.calculations.loadModel(tenantId, selected) : null;
    const sourceCount = model?.sources.length ?? 0;
    const operating = deriveOperatingData(reference, usages, 1);
    const labelOf = labeller(reference, assignments);
    const roomById = new Map(reference.rooms.map((r) => [r.id, r]));
    const combinationById = new Map(reference.combinations.map((c) => [c.id, c]));

    // Which Stellungsraum × Kombination pairs have at least one Schusslinie in the state.
    const partById = new Map((model?.plantParts ?? []).map((p) => [p.id, p]));
    const withSources = new Set<string>();
    for (const s of model?.sources ?? []) {
      const part = partById.get(s.plantPartId);
      if (part && s.combinationId) withSources.add(refKey(part.roomId, s.combinationId));
    }

    const rows: SimulationRowDto[] = assignments
      .map((a) => {
        const combination = combinationById.get(a.combinationId);
        const room = roomById.get(a.roomId);
        const key = refKey(a.roomId, a.combinationId);
        return {
          roomId: a.roomId,
          combinationId: a.combinationId,
          roomName: room?.name ?? '',
          roomNo: room?.coordinationSectionNo ?? null,
          weapon: combination?.weapon?.nameDe ?? '',
          caliber: combination?.caliber?.nameDe ?? '',
          weaponName: a.entryName,
          inside: operating.annex9.get(key)?.inside ?? 0,
          outside: operating.annex9.get(key)?.outside ?? 0,
          hasLevels: withSources.has(key),
        };
      })
      .sort((a, b) => a.roomName.localeCompare(b.roomName) || a.weapon.localeCompare(b.weapon));

    const receivers = (model?.points ?? []).map((entity) => ({
      entity,
      base: toSimulationReceiver(entity, selected, model as StateModel, operating, reference, labelOf),
    }));
    return { calculation: selected, rows, receivers, model, reference, operating, labelOf, sourceCount };
  }
}

/** Ist: Annex 9 Lr against the limit that applies to the plant (IGW unless all new). */
function toSimulationReceiver(
  point: ImmissionPointEntity,
  calculation: AreaCalculationEntity | null,
  model: StateModel,
  operating: OperatingData,
  reference: ReferenceData,
  labelOf: (roomId: string, combinationId: string) => string,
): SimulationReceiverDto {
  const kinds = calculation ? applicableLimits(calculation.buildYearClass) : ['igw' as const];
  const limitKind = kinds.includes('igw') ? 'igw' : 'pw';
  const limit = limits(9, point.sensitivityLevel)[limitKind];
  const { raw, incomplete } = evaluate(point, model, operating, reference, labelOf);
  const rows = assessmentRows(point, model, operating, reference, labelOf);
  return {
    ...toReceiverDto(point),
    assessmentRows: rows,
    limitKind,
    limit,
    current: raw === null ? null : roundDb(raw),
    incomplete,
    // Whole-dB comparison from the raw level (B1.2 10.4), never from the displayed value.
    currentState: worstState(rows.map((r) => r.state)),
  };
}

/** Raw (unrounded) Annex 9 Lr of a point for the given operating data, null without data. */
function evaluate(
  point: ImmissionPointEntity,
  model: StateModel,
  operating: OperatingData,
  reference: ReferenceData,
  labelOf: (roomId: string, combinationId: string) => string,
  newOnly = false,
): { raw: number | null; incomplete: boolean } {
  if (point.type === 'reserve') return { raw: null, incomplete: false };
  const distributed = distributeOntoState({ ...operating, annex7Shots: new Map() }, reference, model, labelOf);
  const { annex9, missing } = pointSources(distributed, model, point.id, labelOf);
  const incomplete = distributed.missing.length > 0 || missing.length > 0;
  const sources = newOnly ? annex9.filter((s) => s.isNew) : annex9;
  const level = sources.length ? annex9Level(sources).lr : LSV_EMPTY_LEVEL;
  const raw = Number.isFinite(level) && level > LSV_EMPTY_LEVEL ? level : null;
  return { raw, incomplete };
}

/** Both IGW overall and PW of new parts remain visible in mixed plants. */
function assessmentRows(point: ImmissionPointEntity, model: StateModel, operating: OperatingData, reference: ReferenceData, labelOf: (roomId: string, combinationId: string) => string): AssessmentRowDto[] {
  return applicableLimits(model.state.buildYearClass).map((kind) => {
    const { raw, incomplete } = evaluate(point, model, operating, reference, labelOf, kind === 'pw' && model.state.buildYearClass === 'mixed');
    const limit = limits(9, point.sensitivityLevel)[kind];
    const level = raw === null ? null : roundDb(raw);
    return { annex: 9, limitKind: kind, limit, applicable: true, level,
      state: noiseState(raw, limit, undefined, undefined, { incomplete }),
      reserve: level === null ? null : roundDb(limit - level), deltaToCurrent: null };
  });
}
