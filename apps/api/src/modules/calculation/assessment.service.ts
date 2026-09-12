import { BadRequestException, forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  annex7Level,
  annex9Level,
  applicableLimits,
  LSV_EMPTY_LEVEL,
  limits,
  LimitKind,
  NoiseState,
  noiseState,
  roundDb,
  worstState,
} from '@slim/lsv';
import { AreaService } from '../area/area.service';
import {
  AreaRoomEntity,
  HolidayEntity,
  RoomCombinationEntity,
  WeaponCombinationEntity,
} from '../area/entities';
import { AreaUsageEntity } from '../usage/entities';
import { UsageService } from '../usage/usage.service';
import { CalculationService, StateModel } from './calculation.service';
import {
  AssessmentDto,
  AssessmentRowDto,
  OperatingDataRowDto,
  ReceiverAssessmentDto,
  ReceiverDto,
  StateCountsDto,
} from './dto';
import { AreaCalculationEntity, ImmissionPointEntity } from './entities';
import {
  deriveOperatingData,
  DistributedShots,
  distributeOntoState,
  MissingSource,
  OperatingData,
  pointSources,
  ReferenceData,
  refKey,
} from './operating-data';

export interface AssessmentOptions {
  calculationId?: string;
  from?: string;
  to?: string;
  /** Representative years (B1 7.4.5), e.g. [2020, 2023, 2025]; wins over from/to. */
  years?: number[];
  now?: Date;
}

/** What one point's levels look like under one calculation state. */
interface PointLevels {
  annex9All: number | null;
  annex9New: number | null;
  annex7All: number | null;
  annex7New: number | null;
  /** Fachregel O8: shots of the period that this state could not attribute at this point. */
  missing: MissingSource[];
}

export const EMPTY_LEVELS: PointLevels = { annex9All: null, annex9New: null, annex7All: null, annex7New: null, missing: [] };

/**
 * 5.12 «Details»: the Beurteilungspegel of every Immissionspunkt of the
 * chosen Zustand, computed at request time from the usages of the period
 * (step 1, B1 7.4), spread onto the Schusslinien of that state (step 2,
 * 7.5), combined with its WLR-Pegel (step 3, 7.6) and compared with the LSV
 * limits per Empfindlichkeitsstufe and Baujahr (step 4, 7.7). Nothing is
 * stored here — a `CalculationRunService` run keeps a reproducible copy.
 */
@Injectable()
export class AssessmentService {
  constructor(
    @InjectRepository(AreaRoomEntity)
    private readonly rooms: Repository<AreaRoomEntity>,
    @InjectRepository(RoomCombinationEntity)
    private readonly assignments: Repository<RoomCombinationEntity>,
    @InjectRepository(WeaponCombinationEntity)
    private readonly combinations: Repository<WeaponCombinationEntity>,
    @InjectRepository(HolidayEntity)
    private readonly holidays: Repository<HolidayEntity>,
    private readonly areas: AreaService,
    @Inject(forwardRef(() => UsageService))
    private readonly usages: UsageService,
    private readonly calculations: CalculationService,
  ) {}

  /** The permanent references of an area the calculation works with. */
  async reference(tenantId: string, areaId: string): Promise<ReferenceData> {
    const area = await this.areas.get(tenantId, areaId);
    const [rooms, combinations, holidays] = await Promise.all([
      this.rooms.find({ where: { tenantId, areaId } }),
      this.combinations.find({ where: { tenantId }, relations: { weapon: true, caliber: true } }),
      this.holidays.find({ where: [{ tenantId, areaId }, { tenantId, areaId: IsNull() }] }),
    ]);
    return { area, rooms, combinations, holidays };
  }

  /** Usages of the chosen period (from/to or representative years). */
  async usagesOf(tenantId: string, areaId: string, period: ReturnType<typeof resolvePeriod>): Promise<AreaUsageEntity[]> {
    if (period.selectedYears.length) {
      const lists = await Promise.all(period.selectedYears.map((y) => this.usages.listYear(tenantId, areaId, y)));
      return lists.flat();
    }
    return this.usages.listRange(tenantId, areaId, period.from, period.to);
  }

  async assess(tenantId: string, areaId: string, options: AssessmentOptions = {}): Promise<AssessmentDto> {
    const now = options.now ?? new Date();
    const period = resolvePeriod(options.from, options.to, now, options.years);
    const reference = await this.reference(tenantId, areaId);
    const [{ all, selected, current }, usages, assignments] = await Promise.all([
      this.calculations.resolve(tenantId, areaId, options.calculationId),
      this.usagesOf(tenantId, areaId, period),
      this.assignments.find({ where: { tenantId, areaId } }),
    ]);
    const counts = await this.calculations.sourceCounts(tenantId, all.map((c) => c.id));
    const labelOf = labeller(reference, assignments);
    const operating = deriveOperatingData(reference, usages, period.years);

    const selectedModel = selected ? await this.calculations.loadModel(tenantId, selected) : null;
    const referenceModel = current && selected && current.id !== selected.id ? await this.calculations.loadModel(tenantId, current) : null;

    const own = selectedModel ? assessModel(operating, reference, selectedModel, labelOf) : new Map<string, PointLevels>();
    const other = referenceModel ? assessModel(operating, reference, referenceModel, labelOf) : null;
    // Points of different states are compared by their sonARMS_ID only (5.12 «Abweichung zum gültigen Zustand»).
    const referenceBySonarms = new Map<string, PointLevels>();
    if (other && referenceModel) for (const p of referenceModel.points) referenceBySonarms.set(p.sonarmsId, other.get(p.id) ?? EMPTY_LEVELS);

    const points = selectedModel?.points ?? [];
    const assessed = points.map((point) =>
      toAssessment(
        point,
        own.get(point.id) ?? EMPTY_LEVELS,
        referenceBySonarms.get(point.sonarmsId) ?? null,
        selected?.buildYearClass ?? null,
        current?.buildYearClass ?? null,
      ),
    );

    return {
      areaId,
      calculation: selected ? this.calculations.toDto(selected, counts.get(selected.id)) : null,
      current: current ? this.calculations.toDto(current, counts.get(current.id)) : null,
      calculations: all.map((c) => this.calculations.toDto(c, counts.get(c.id))),
      period: { from: period.from, to: period.to, years: period.years, selectedYears: period.selectedYears },
      counts: countStates(assessed.map((r) => r.state)),
      receivers: assessed,
      operatingData: operatingRows(operating, reference, assignments, selectedModel, labelOf),
      calculatedAt: now.toISOString(),
    };
  }
}

/** «Stellungsraum · Kombination» for the Prüfhinweis. */
export function labeller(reference: ReferenceData, assignments: RoomCombinationEntity[]) {
  const roomById = new Map(reference.rooms.map((r) => [r.id, r]));
  const combinationById = new Map(reference.combinations.map((c) => [c.id, c]));
  const entryName = new Map(assignments.map((a) => [refKey(a.roomId, a.combinationId), a.entryName]));
  return (roomId: string, combinationId: string): string =>
    `${roomById.get(roomId)?.name ?? '?'} · ${entryName.get(refKey(roomId, combinationId)) ?? combinationById.get(combinationId)?.nameDe ?? combinationId}`;
}

/** Levels of every point of one state (steps 2–3). */
export function assessModel(
  operating: OperatingData,
  reference: ReferenceData,
  model: StateModel,
  labelOf: (roomId: string, combinationId: string) => string,
): Map<string, PointLevels> {
  const distributed = distributeOntoState(operating, reference, model, labelOf);
  const newRooms = new Set(model.plantParts.filter((p) => p.builtAfter1985).map((p) => p.roomId));
  const halfDaysAll = operating.annex7HalfDays;
  const halfDaysNew = operating.annex7HalfDaysOf(newRooms);
  const out = new Map<string, PointLevels>();
  for (const point of model.points) out.set(point.id, computeLevels(point, model, distributed, halfDaysAll, halfDaysNew, labelOf));
  return out;
}

function computeLevels(
  point: ImmissionPointEntity,
  model: StateModel,
  distributed: DistributedShots,
  halfDaysAll: OperatingData['annex7HalfDays'],
  halfDaysNew: OperatingData['annex7HalfDays'],
  labelOf: (roomId: string, combinationId: string) => string,
): PointLevels {
  if (point.type === 'reserve') return EMPTY_LEVELS;
  const { annex9, annex7, missing } = pointSources(distributed, model, point.id, labelOf);
  const lr9 = (sources: typeof annex9) => (sources.length ? finite(annex9Level(sources).lr) : null);
  const lr7 = (sources: typeof annex7, hd: OperatingData['annex7HalfDays']) => (sources.length ? finite(annex7Level(sources, hd).lr) : null);
  return {
    annex9All: lr9(annex9),
    annex9New: lr9(annex9.filter((s) => s.isNew)),
    annex7All: lr7(annex7, halfDaysAll),
    // 7.4.5 «gemischt»: Quelldaten *und* Halbtage nur der Stellungsräume nach 1985.
    annex7New: lr7(annex7.filter((s) => s.isNew), halfDaysNew),
    missing: [...distributed.missing, ...missing],
  };
}

function finite(level: number): number | null {
  return Number.isFinite(level) && level > LSV_EMPTY_LEVEL ? level : null;
}

export function toReceiverDto(point: ImmissionPointEntity): ReceiverDto {
  return {
    id: point.id,
    sonarmsId: point.sonarmsId,
    code: point.code,
    egid: point.egid,
    address: point.address,
    municipality: point.municipality,
    type: point.type,
    sensitivityLevel: point.sensitivityLevel,
    east: point.east,
    north: point.north,
    height: point.height,
    mapX: point.mapX,
    mapY: point.mapY,
  };
}

/** The four rows of the detail table (Anhang 9 IGW/PW, Anhang 7 IGW/PW). */
function toAssessment(
  point: ImmissionPointEntity,
  own: PointLevels,
  reference: PointLevels | null,
  buildYear: AreaCalculationEntity['buildYearClass'] | null,
  referenceBuildYear: AreaCalculationEntity['buildYearClass'] | null,
): ReceiverAssessmentDto {
  const rows: AssessmentRowDto[] = [];
  const incomplete = own.missing.length > 0;
  for (const annex of [9, 7] as const) {
    const limitSet = limits(annex, point.sensitivityLevel);
    for (const kind of ['igw', 'pw'] as const) {
      const applicable = buildYear ? applicableLimits(buildYear).includes(kind) : false;
      const level = applicable ? pick(own, annex, kind, buildYear) : null;
      const referenceLevel =
        reference && referenceBuildYear && applicableLimits(referenceBuildYear).includes(kind)
          ? pick(reference, annex, kind, referenceBuildYear)
          : null;
      const rounded = level === null ? null : roundDb(level);
      const referenceRounded = referenceLevel === null ? null : roundDb(referenceLevel);
      rows.push({
        annex,
        limitKind: kind,
        limit: limitSet[kind],
        applicable,
        level: rounded,
        // The comparison rounds the raw level to whole dB itself (B1.2 10.4);
        // handing it the displayed 0.1-dB value would round twice (60.4997 →
        // 60.5 → 61 «überschritten» although the Beurteilungswert is 60).
        // O8: an applicable row of an incomplete point carries no colour.
        state: noiseState(level, limitSet[kind], undefined, undefined, { incomplete: applicable && incomplete }),
        reserve: rounded === null ? null : roundDb(limitSet[kind] - rounded),
        deltaToCurrent: rounded !== null && referenceRounded !== null ? roundDb(rounded - referenceRounded) : null,
      });
    }
  }
  const labels = [...new Set(own.missing.map((m) => m.label))].sort();
  return {
    ...toReceiverDto(point),
    state: worstState(rows.map((r) => r.state)),
    missingSources: labels,
    rows,
  };
}

/** Which of the four computed levels belongs to a row. */
function pick(levels: PointLevels, annex: 9 | 7, kind: LimitKind, buildYear: AreaCalculationEntity['buildYearClass']): number | null {
  // IGW: every source. PW: every source when the whole plant is new, only
  // the new rooms' sources (and their half-days) when it is mixed.
  const useNew = kind === 'pw' && buildYear === 'mixed';
  if (annex === 9) return useNew ? levels.annex9New : levels.annex9All;
  return useNew ? levels.annex7New : levels.annex7All;
}

export function countStates(states: NoiseState[]): StateCountsDto {
  const counts: StateCountsDto = { total: states.length, ok: 0, warn: 0, over: 0, none: 0, incomplete: 0 };
  for (const state of states) counts[state]++;
  return counts;
}

/** Transparency (7.4 / 7.5): the operating data per Stellungsraum × Kombination and the sources they were spread onto. */
function operatingRows(
  operating: OperatingData,
  reference: ReferenceData,
  assignments: RoomCombinationEntity[],
  model: StateModel | null,
  labelOf: (roomId: string, combinationId: string) => string,
): OperatingDataRowDto[] {
  const roomById = new Map(reference.rooms.map((r) => [r.id, r]));
  const distributed = model ? distributeOntoState(operating, reference, model, labelOf) : null;
  const sourcesOf = (roomId: string, combinationId: string): string[] => {
    if (!distributed || !model) return [];
    const ids: string[] = [];
    for (const [sourceId, shots] of distributed.bySource) if (shots.roomId === roomId && shots.combinationId === combinationId) ids.push(sourceId);
    return ids.map((id) => model.sources.find((s) => s.id === id)?.sourceId ?? id);
  };
  const rows: OperatingDataRowDto[] = [];
  for (const [key, shots] of operating.annex9) {
    const [roomId, combinationId] = key.split('|');
    rows.push({
      roomId,
      combinationId,
      roomName: roomById.get(roomId)?.name ?? '',
      combinationName: labelOf(roomId, combinationId).split(' · ').slice(1).join(' · '),
      inside: shots.inside,
      outside: shots.outside,
      civil: operating.annex7Shots.get(key) ?? 0,
      sources: sourcesOf(roomId, combinationId),
    });
  }
  void assignments;
  return rows.sort((a, b) => a.roomName.localeCompare(b.roomName) || a.combinationName.localeCompare(b.combinationName));
}

/**
 * Betrachtungszeitraum (B1 7.4.5): representative years (also non-adjacent)
 * or a free from/to range; default the whole current calendar year.
 * `years` = number of years the operating data are averaged over.
 */
export function resolvePeriod(from: string | undefined, to: string | undefined, now: Date, selectedYears: number[] = []) {
  if (selectedYears.length) {
    const unique = [...new Set(selectedYears)].sort((a, b) => a - b);
    if (unique.some((y) => !Number.isInteger(y) || y < 1900 || y > 2200)) throw new BadRequestException('Invalid years');
    return { from: `${unique[0]}-01-01`, to: `${unique[unique.length - 1]}-12-31`, years: unique.length, selectedYears: unique };
  }
  const year = now.toISOString().slice(0, 4);
  const end = to ?? `${year}-12-31`;
  const start = from ?? `${end.slice(0, 4)}-01-01`;
  const [a, b] = start <= end ? [start, end] : [end, start];
  const days = (Date.parse(b) - Date.parse(a)) / 86_400_000 + 1;
  return { from: a, to: b, years: Math.max(1, Math.round(days / 365.25)), selectedYears: [] as number[] };
}
