import {
  ANNEX7_CATEGORIES,
  Annex7Category,
  Annex7HalfDays,
  Annex9Source,
  Annex7Source,
  CalendarOptions,
  annex7HalfDays,
  countsForAnnex7,
  distributeShots,
  splitAnnex9,
  UsageSlot,
} from '@slim/lsv';
import {
  AreaEntity,
  AreaRoomEntity,
  HolidayEntity,
  WeaponCombinationEntity,
} from '../area/entities';
import { AreaUsageEntity } from '../usage/entities';
import { StateModel } from './calculation.service';

/** Key of one permanent reference pair: Stellungsraum × Kombination. */
export const refKey = (roomId: string, combinationId: string): string => `${roomId}|${combinationId}`;

/** Betriebsdaten (B1 7.4) of the period per Stellungsraum × Kombination, before any state is involved. */
export interface OperatingData {
  /** Anhang 9: shots inside / outside the workday, averaged per year. */
  annex9: Map<string, { inside: number; outside: number }>;
  /** Anhang 7: shots of the civil usages (Zivil + SAT, or all with the flag), averaged per year. */
  annex7Shots: Map<string, number>;
  /** Anhang 7: Schiesshalbtage per Waffenkategorie over the whole Schiessplatz, averaged per year. */
  annex7HalfDays: Annex7HalfDays;
  /** Same, restricted to the given rooms (7.4.5: «gemischt» → Quelldaten nur der Stellungsräume nach 1985). */
  annex7HalfDaysOf(roomIds: ReadonlySet<string>): Annex7HalfDays;
  years: number;
}

/** The permanent references the operating data refer to. */
export interface ReferenceData {
  area: Pick<AreaEntity, 'id' | 'annex7Overall' | 'coordinationSectionNo'>;
  rooms: AreaRoomEntity[];
  combinations: WeaponCombinationEntity[];
  holidays: HolidayEntity[];
}

/** Feiertage of the Schiessplatz (tenant-wide + local) as the kernel expects them. */
export function calendarOf(holidays: HolidayEntity[]): CalendarOptions {
  return {
    holidays: holidays.map((h) =>
      h.from || h.to ? { date: h.date, from: h.from ?? undefined, to: h.to ?? undefined } : h.date,
    ),
  };
}

/**
 * Step 1 (B1 7.4): derive the LSV operating data from the usages of the
 * period. Anhang 9 takes every Nutzungskategorie and splits each position's
 * quantity into inside / outside the workday (Mo–Fr 07–19, Sa/So and the
 * site's holidays outside, half holidays proportionally); Anhang 7 takes
 * Zivil + SAT (every category with the «Gesamtbeurteilung» flag), only
 * combinations whose weapon has an Anhang-7 category, and counts the
 * Schiesshalbtage per category and calendar day. Quantities stay decimal.
 */
export function deriveOperatingData(
  reference: ReferenceData,
  usages: AreaUsageEntity[],
  years: number,
): OperatingData {
  const calendar = calendarOf(reference.holidays);
  const combinationById = new Map(reference.combinations.map((c) => [c.id, c]));
  const annex9 = new Map<string, { inside: number; outside: number }>();
  const annex7Shots = new Map<string, number>();
  const categorised: (UsageSlot & { category: Annex7Category; roomId: string })[] = [];

  for (const usage of usages) {
    const civil = countsForAnnex7(usage.usageType, Boolean(reference.area.annex7Overall));
    for (const position of usage.positions ?? []) {
      const key = refKey(usage.roomId, position.combinationId);
      const split = splitAnnex9({ date: usage.date, from: usage.timeFrom, to: usage.timeTo, shots: position.quantity }, calendar);
      const entry = annex9.get(key) ?? { inside: 0, outside: 0 };
      entry.inside += split.inside;
      entry.outside += split.outside;
      annex9.set(key, entry);

      const category = combinationById.get(position.combinationId)?.weapon?.annex7Category ?? null;
      if (civil && category) {
        annex7Shots.set(key, (annex7Shots.get(key) ?? 0) + position.quantity);
        categorised.push({ date: usage.date, from: usage.timeFrom, to: usage.timeTo, shots: position.quantity, category, roomId: usage.roomId });
      }
    }
  }

  // Ø pro Jahr (7.4.5) — decimal quantities keep their precision (3 decimals).
  const avg = (v: number) => (years > 1 ? Math.round((v / years) * 1000) / 1000 : v);
  for (const entry of annex9.values()) {
    entry.inside = avg(entry.inside);
    entry.outside = avg(entry.outside);
  }
  for (const [key, shots] of annex7Shots) annex7Shots.set(key, avg(shots));

  const halfDaysOf = (slots: typeof categorised): Annex7HalfDays => {
    const hd = annex7HalfDays(slots, calendar);
    if (years > 1) {
      for (const c of ANNEX7_CATEGORIES) hd[c] = { work: hd[c].work / years, sunday: hd[c].sunday / years };
    }
    return hd;
  };

  return {
    annex9,
    annex7Shots,
    annex7HalfDays: halfDaysOf(categorised),
    annex7HalfDaysOf: (roomIds) => halfDaysOf(categorised.filter((s) => roomIds.has(s.roomId))),
    years,
  };
}

/** Why a combination's shots could not be attributed to a source of the state (Fachregel O8). */
export interface MissingSource {
  roomId: string;
  combinationId: string;
  label: string;
  reason: 'no-source' | 'zero-weights' | 'no-level';
}

/** Step 2 result: shots per Schusslinie of the state, plus what could not be attributed. */
export interface DistributedShots {
  /** source line id → shots inside / outside (Anhang 9) and civil shots (Anhang 7). */
  bySource: Map<string, { inside: number; outside: number; civil: number; category: Annex7Category | null; isNew: boolean; roomId: string; combinationId: string }>;
  missing: MissingSource[];
}

/**
 * Step 2 (B1 7.5, slm 32): map every Stellungsraum × Kombination with shots
 * onto the Schusslinien of the chosen state (Anlageteil of that room ×
 * source with that combination) and spread the shots in proportion to the
 * Quelldaten of the model — Anhang 9 inside by A9_M1, outside by A9_M2,
 * Anhang 7 by the civil shots of the source. A combination with exactly one
 * source gets everything; several sources with Σ weights = 0 are refused
 * (O8 default), a combination without any source is reported — in both
 * cases the shots are never dropped silently: the receiver becomes «nicht
 * beurteilbar».
 */
export function distributeOntoState(
  operating: OperatingData,
  reference: ReferenceData,
  model: StateModel,
  labelOf: (roomId: string, combinationId: string) => string,
): DistributedShots {
  const partById = new Map(model.plantParts.map((p) => [p.id, p]));
  const sourcesByRef = new Map<string, typeof model.sources>();
  for (const source of model.sources) {
    if (!source.combinationId) continue;
    const part = partById.get(source.plantPartId);
    if (!part) continue;
    const key = refKey(part.roomId, source.combinationId);
    sourcesByRef.set(key, [...(sourcesByRef.get(key) ?? []), source]);
  }

  const bySource: DistributedShots['bySource'] = new Map();
  const missing: MissingSource[] = [];
  const entry = (source: (typeof model.sources)[number]) => {
    let e = bySource.get(source.id);
    if (!e) {
      const part = partById.get(source.plantPartId);
      e = {
        inside: 0,
        outside: 0,
        civil: 0,
        category: source.dataA7?.category ?? source.combination?.weapon?.annex7Category ?? null,
        isNew: Boolean(part?.builtAfter1985),
        roomId: part?.roomId ?? '',
        combinationId: source.combinationId ?? '',
      };
      bySource.set(source.id, e);
    }
    return e;
  };

  const spread = (
    key: string,
    quantity: number,
    weightOf: (s: (typeof model.sources)[number]) => number,
    apply: (s: (typeof model.sources)[number], shots: number) => void,
  ): void => {
    if (!(quantity > 0)) return;
    const [roomId, combinationId] = key.split('|');
    const sources = sourcesByRef.get(key) ?? [];
    if (!sources.length) {
      missing.push({ roomId, combinationId, label: labelOf(roomId, combinationId), reason: 'no-source' });
      return;
    }
    if (sources.length === 1) {
      apply(sources[0], quantity);
      return;
    }
    const result = distributeShots(quantity, sources.map((s) => ({ sourceId: s.id, weight: weightOf(s) })));
    if (result.refused) {
      missing.push({ roomId, combinationId, label: labelOf(roomId, combinationId), reason: 'zero-weights' });
      return;
    }
    for (const share of result.shares) {
      const source = sources.find((s) => s.id === share.sourceId);
      if (source && share.shots > 0) apply(source, share.shots);
    }
  };

  for (const [key, shots] of operating.annex9) {
    spread(key, shots.inside, (s) => s.dataA9?.shotsInside ?? 0, (s, n) => { entry(s).inside += n; });
    spread(key, shots.outside, (s) => s.dataA9?.shotsOutside ?? 0, (s, n) => { entry(s).outside += n; });
  }
  for (const [key, shots] of operating.annex7Shots) {
    spread(key, shots, (s) => (s.dataA7?.shotsWork ?? 0) + (s.dataA7?.shotsSunday ?? 0), (s, n) => { entry(s).civil += n; });
  }

  // Deduplicate: a pair may be reported for inside, outside and civil.
  const seen = new Set<string>();
  const unique = missing.filter((m) => {
    const k = `${m.roomId}|${m.combinationId}|${m.reason}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { bySource, missing: unique };
}

/** Kernel inputs of one point (Anhang 9 and 7), from the distributed shots and the WLR rows of that point. */
export function pointSources(
  distributed: DistributedShots,
  model: StateModel,
  pointId: string,
  labelOf: (roomId: string, combinationId: string) => string,
): { annex9: (Annex9Source & { isNew: boolean })[]; annex7: (Annex7Source & { isNew: boolean })[]; missing: MissingSource[] } {
  const levels = model.wlr.get(pointId) ?? new Map();
  const annex9: (Annex9Source & { isNew: boolean })[] = [];
  const annex7: (Annex7Source & { isNew: boolean })[] = [];
  const missing: MissingSource[] = [];
  for (const [sourceId, shots] of distributed.bySource) {
    const row = levels.get(sourceId);
    if (!row?.day) {
      if (shots.inside + shots.outside + shots.civil > 0) {
        missing.push({ roomId: shots.roomId, combinationId: shots.combinationId, label: labelOf(shots.roomId, shots.combinationId), reason: 'no-level' });
      }
      continue;
    }
    if (shots.inside + shots.outside > 0) {
      annex9.push({ sourceId, shotsDay: shots.inside, shotsEve: shots.outside, laeDay: row.day.lae, laeEve: row.eve?.lae ?? row.day.lae, isNew: shots.isNew });
    }
    if (shots.civil > 0 && shots.category) {
      annex7.push({ sourceId, category: shots.category, shots: shots.civil, lafmaxDay: row.day.lafmax, isNew: shots.isNew });
    }
  }
  return { annex9, annex7, missing };
}
