import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ANNEX7_CATEGORIES,
  Annex7Category,
  Annex7HalfDays,
  Annex7Source,
  Annex9Source,
  annex7HalfDays,
  annex7Level,
  annex9Level,
  applicableLimits,
  LSV_EMPTY_LEVEL,
  limits,
  LimitKind,
  NoiseState,
  noiseState,
  roundDb,
  splitAnnex9,
  worstState,
} from '@slim/lsv';
import { AreaService } from '../area/area.service';
import { AreaEntity, AreaRoomEntity, AreaWeaponEntity } from '../area/entities';
import { AreaUsageEntity } from '../usage/entities';
import { UsageService } from '../usage/usage.service';
import { CalculationService, WlrIndex } from './calculation.service';
import {
  AssessmentDto,
  AssessmentRowDto,
  OperatingDataRowDto,
  ReceiverAssessmentDto,
  ReceiverDto,
  StateCountsDto,
} from './dto';
import { AreaCalculationEntity, AreaReceiverEntity } from './entities';

/** Annex 9 operating data per source: shots inside / outside the workday, per year. */
export type Annex9OperatingData = Map<string, { inside: number; outside: number }>;

export interface AssessmentOptions {
  calculationId?: string;
  from?: string;
  to?: string;
  now?: Date;
}

/** What one receiver's levels look like under one calculation state. */
interface ReceiverLevels {
  annex9All: number | null;
  annex9New: number | null;
  annex7All: number | null;
  annex7New: number | null;
}

/**
 * 5.12 «Details»: the Beurteilungspegel of every receiver, computed from
 * the usages of the period (step 1, B1 7.4), the sonARMS levels of a
 * calculation state (step 3, 7.6) and compared with the LSV limits per
 * Empfindlichkeitsstufe and Baujahr (step 4, 7.7). Nothing is stored — the
 * tender asks for a dynamic calculation, and it takes milliseconds here.
 *
 * Step 2 (distribution on sources, 7.5) is the identity in the prototype:
 * one allowed room × weapon combination is one source.
 */
@Injectable()
export class AssessmentService {
  constructor(
    @InjectRepository(AreaRoomEntity)
    private readonly rooms: Repository<AreaRoomEntity>,
    @InjectRepository(AreaWeaponEntity)
    private readonly weapons: Repository<AreaWeaponEntity>,
    private readonly areas: AreaService,
    private readonly usages: UsageService,
    private readonly calculations: CalculationService,
  ) {}

  async assess(
    tenantId: string,
    areaId: string,
    options: AssessmentOptions = {},
  ): Promise<AssessmentDto> {
    const now = options.now ?? new Date();
    const area = await this.areas.get(tenantId, areaId);
    const period = resolvePeriod(options.from, options.to, now);

    const [{ all, selected, current }, receivers, rooms, weapons, usages] =
      await Promise.all([
        this.calculations.resolve(tenantId, areaId, options.calculationId),
        this.calculations.listReceivers(tenantId, areaId),
        this.rooms.find({ where: { tenantId, areaId } }),
        this.weapons.find({ where: { tenantId, areaId } }),
        this.usages.listRange(tenantId, areaId, period.from, period.to),
      ]);
    const counts = await this.calculations.sourceCounts(tenantId, all.map((c) => c.id));

    const context = buildContext(area, rooms, weapons, usages, period.years);
    const selectedLevels = selected ? await this.calculations.levels(tenantId, selected.id) : null;
    const currentLevels =
      current && selected && current.id !== selected.id
        ? await this.calculations.levels(tenantId, current.id)
        : null;

    const assessed = receivers.map((receiver) => {
      const own = selected
        ? computeLevels(receiver, selectedLevels as WlrIndex, context)
        : EMPTY_LEVELS;
      const reference =
        currentLevels && current ? computeLevels(receiver, currentLevels, context) : null;
      return toAssessment(receiver, own, reference, selected?.buildYearClass ?? null, current?.buildYearClass ?? null);
    });

    return {
      areaId,
      calculation: selected ? this.calculations.toDto(selected, counts.get(selected.id)) : null,
      current: current ? this.calculations.toDto(current, counts.get(current.id)) : null,
      calculations: all.map((c) => this.calculations.toDto(c, counts.get(c.id))),
      period,
      counts: countStates(assessed.map((r) => r.state)),
      receivers: assessed,
      operatingData: operatingRows(context, rooms, weapons),
      calculatedAt: now.toISOString(),
    };
  }
}

export const EMPTY_LEVELS: ReceiverLevels = {
  annex9All: null,
  annex9New: null,
  annex7All: null,
  annex7New: null,
};

/** Everything derived from the usages once, shared by all receivers. */
export interface AssessmentContext {
  annex9: Annex9OperatingData;
  /** Annex 7 shots per source (civil usages, or all with the 5.16 flag). */
  annex7Shots: Map<string, number>;
  annex7HalfDays: Annex7HalfDays;
  weaponById: Map<string, AreaWeaponEntity>;
  roomById: Map<string, AreaRoomEntity>;
}

export function buildContext(
  area: Pick<AreaEntity, 'annex7Overall'>,
  rooms: AreaRoomEntity[],
  weapons: AreaWeaponEntity[],
  usages: AreaUsageEntity[],
  years: number,
): AssessmentContext {
  const weaponById = new Map(weapons.map((w) => [w.id, w]));
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  // Annex 9: military shooting, split into inside / outside the workday (7.4.5).
  const annex9: Annex9OperatingData = new Map();
  for (const usage of usages) {
    if (usage.usageType !== 'military') continue;
    const split = splitAnnex9(slot(usage));
    const entry = annex9.get(usage.weaponId) ?? { inside: 0, outside: 0 };
    entry.inside += split.inside;
    entry.outside += split.outside;
    annex9.set(usage.weaponId, entry);
  }

  // Annex 7: civil shooting (every usage with the «Gesamtbeurteilung» flag).
  const civil = usages.filter((u) => area.annex7Overall || u.usageType === 'civil');
  const annex7Shots = new Map<string, number>();
  const categorised: (ReturnType<typeof slot> & { category: Annex7Category })[] = [];
  for (const usage of civil) {
    const weapon = weaponById.get(usage.weaponId);
    if (!weapon?.annex7Category) continue;
    annex7Shots.set(usage.weaponId, (annex7Shots.get(usage.weaponId) ?? 0) + usage.shots);
    categorised.push({ ...slot(usage), category: weapon.annex7Category });
  }
  const halfDays = annex7HalfDays(categorised);

  // Average per year over the period (7.4: Ø pro Jahr).
  if (years > 1) {
    for (const entry of annex9.values()) {
      entry.inside = Math.round(entry.inside / years);
      entry.outside = Math.round(entry.outside / years);
    }
    for (const [id, shots] of annex7Shots) annex7Shots.set(id, Math.round(shots / years));
    for (const category of ANNEX7_CATEGORIES) {
      halfDays[category] = {
        work: halfDays[category].work / years,
        sunday: halfDays[category].sunday / years,
      };
    }
  }

  return { annex9, annex7Shots, annex7HalfDays: halfDays, weaponById, roomById };
}

function slot(usage: AreaUsageEntity) {
  return { date: usage.date, from: usage.timeFrom, to: usage.timeTo, shots: usage.shots };
}

/**
 * Lr of one receiver under one state: Annex 9 and 7, each once over all
 * sources (→ IGW) and once over the sources of rooms built after 1985
 * (→ PW of a mixed plant, 7.7).
 */
export function computeLevels(
  receiver: AreaReceiverEntity,
  levels: WlrIndex,
  context: AssessmentContext,
): ReceiverLevels {
  if (receiver.type === 'reserve') return EMPTY_LEVELS;
  const perSource = levels.get(receiver.id);
  if (!perSource || perSource.size === 0) return EMPTY_LEVELS;

  const isNew = (weaponId: string): boolean => {
    const weapon = context.weaponById.get(weaponId);
    const room = weapon ? context.roomById.get(weapon.roomId) : undefined;
    return Boolean(room?.builtAfter1985);
  };

  const annex9Sources: Annex9Source[] = [];
  for (const [weaponId, row] of perSource) {
    const shots = context.annex9.get(weaponId);
    if (!shots || (shots.inside === 0 && shots.outside === 0)) continue;
    annex9Sources.push({
      sourceId: weaponId,
      shotsDay: shots.inside,
      shotsEve: shots.outside,
      laeDay: row.laeDay,
      laeEve: row.laeEve,
    });
  }

  const annex7Sources: Annex7Source[] = [];
  for (const [weaponId, row] of perSource) {
    const shots = context.annex7Shots.get(weaponId);
    const category = context.weaponById.get(weaponId)?.annex7Category;
    if (!shots || !category) continue;
    annex7Sources.push({ sourceId: weaponId, category, shots, lafmaxDay: row.lafmaxDay });
  }

  const lr9 = (sources: Annex9Source[]) =>
    sources.length ? finite(annex9Level(sources).lr) : null;
  const lr7 = (sources: Annex7Source[]) =>
    sources.length ? finite(annex7Level(sources, context.annex7HalfDays).lr) : null;

  return {
    annex9All: lr9(annex9Sources),
    annex9New: lr9(annex9Sources.filter((s) => isNew(s.sourceId))),
    annex7All: lr7(annex7Sources),
    annex7New: lr7(annex7Sources.filter((s) => isNew(s.sourceId))),
  };
}

function finite(level: number): number | null {
  return Number.isFinite(level) && level > LSV_EMPTY_LEVEL ? level : null;
}

export function toReceiverDto(receiver: AreaReceiverEntity): ReceiverDto {
  return {
    id: receiver.id,
    code: receiver.code,
    egid: receiver.egid,
    address: receiver.address,
    municipality: receiver.municipality,
    type: receiver.type,
    sensitivityLevel: receiver.sensitivityLevel,
    east: receiver.east,
    north: receiver.north,
    mapX: receiver.mapX,
    mapY: receiver.mapY,
  };
}

/** The four rows of the detail table (Anhang 9 IGW/PW, Anhang 7 IGW/PW). */
function toAssessment(
  receiver: AreaReceiverEntity,
  own: ReceiverLevels,
  reference: ReceiverLevels | null,
  buildYear: AreaCalculationEntity['buildYearClass'] | null,
  referenceBuildYear: AreaCalculationEntity['buildYearClass'] | null,
): ReceiverAssessmentDto {
  const rows: AssessmentRowDto[] = [];
  for (const annex of [9, 7] as const) {
    const limitSet = limits(annex, receiver.sensitivityLevel);
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
        state: noiseState(rounded, limitSet[kind]),
        reserve: rounded === null ? null : roundDb(limitSet[kind] - rounded),
        deltaToCurrent:
          rounded !== null && referenceRounded !== null ? roundDb(rounded - referenceRounded) : null,
      });
    }
  }
  return {
    ...toReceiverDto(receiver),
    state: worstState(rows.map((r) => r.state)),
    rows,
  };
}

/** Which of the four computed levels belongs to a row. */
function pick(
  levels: ReceiverLevels,
  annex: 9 | 7,
  kind: LimitKind,
  buildYear: AreaCalculationEntity['buildYearClass'],
): number | null {
  // IGW: every source. PW: every source when the whole plant is new, only
  // the new rooms' sources when it is mixed.
  const useNew = kind === 'pw' && buildYear === 'mixed';
  if (annex === 9) return useNew ? levels.annex9New : levels.annex9All;
  return useNew ? levels.annex7New : levels.annex7All;
}

export function countStates(states: NoiseState[]): StateCountsDto {
  const counts: StateCountsDto = { total: states.length, ok: 0, warn: 0, over: 0, none: 0 };
  for (const state of states) counts[state]++;
  return counts;
}

function operatingRows(
  context: AssessmentContext,
  rooms: AreaRoomEntity[],
  weapons: AreaWeaponEntity[],
): OperatingDataRowDto[] {
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  return weapons
    .filter((w) => context.annex9.has(w.id))
    .map((w) => {
      const shots = context.annex9.get(w.id) as { inside: number; outside: number };
      return {
        weaponId: w.id,
        sourceId: w.sourceId,
        roomName: roomById.get(w.roomId)?.name ?? '',
        weaponName: w.weaponName,
        inside: shots.inside,
        outside: shots.outside,
      };
    })
    .sort((a, b) => a.roomName.localeCompare(b.roomName) || a.weaponName.localeCompare(b.weaponName));
}

/**
 * Default: the whole current calendar year (B1 7.4 assesses annual operating
 * data; the simulation uses the same year). `years` = whole years for the average.
 */
export function resolvePeriod(from: string | undefined, to: string | undefined, now: Date) {
  const year = now.toISOString().slice(0, 4);
  const end = to ?? `${year}-12-31`;
  const start = from ?? `${end.slice(0, 4)}-01-01`;
  const [a, b] = start <= end ? [start, end] : [end, start];
  const days = (Date.parse(b) - Date.parse(a)) / 86_400_000 + 1;
  return { from: a, to: b, years: Math.max(1, Math.round(days / 365.25)) };
}
