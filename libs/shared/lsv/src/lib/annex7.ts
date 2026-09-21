import { esm, gemw } from './levels';
import {
  ANNEX7_CATEGORIES,
  Annex7Category,
  Annex7HalfDays,
  Annex7Result,
  Annex7Source,
  LSV_EMPTY_LEVEL,
} from './types';

/** Constant term of Anhang 7, dB (`−44` in B1.4 sheet A7X). */
export const ANNEX7_CONSTANT = 44;

/** Weight of a Sunday/holiday half-day against a workday half-day. */
export const ANNEX7_SUNDAY_WEIGHT = 3;

/**
 * Beurteilungspegel nach Anhang 7 LSV for one receiver (B1 7.6, B1.4 sheet
 * `sonARMS_Demo_A7X`), per Waffenkategorie k:
 *
 *     Li_k  = GEMW(shots_k, LAFmax_day)
 *     Lri_k = Li_k + 10·log10(Wh_k + 3·Sh_k) + 3·log10(Σ shots_k) − 44
 *     Lr    = ESM(Lri_a … Lri_f)
 *
 * A category without shots has `Li = Lri = LSV_EMPTY_LEVEL` and adds no
 * energy (`emptyCategories: 'skip'`, the default — the sonARMS kernel A7p).
 * The B1.4 formula sheet A7X instead writes 0 dB into those Lri cells and
 * sums them, which lifts a very quiet receiver by a few hundredths — E8:
 * 28.08 instead of 28.05. `emptyCategories: 'zero'` reproduces that sheet
 * (FAQ 19 names A7X the binding template); which reading applies is the
 * Fachstelle's decision and a parameter here, not a code change.
 * A category with shots but `Wh + 3·Sh = 0` has no assessable time and is
 * treated as empty as well, rather than producing −∞.
 */
export interface Annex7Options {
  /** How categories without shots enter the energetic sum over a–f. */
  emptyCategories?: 'skip' | 'zero';
}

export function annex7Level(
  sources: Annex7Source[],
  halfDays: Annex7HalfDays,
  options: Annex7Options = {},
): Annex7Result {
  const emptyAsZero = options.emptyCategories === 'zero';
  for (const s of sources) {
    if (!(s.shots >= 0)) {
      throw new Error(`annex7Level: invalid shots for source ${s.sourceId}`);
    }
  }
  const li = {} as Record<Annex7Category, number>;
  const lri = {} as Record<Annex7Category, number>;

  for (const k of ANNEX7_CATEGORIES) {
    const ofCategory = sources.filter((s) => s.category === k);
    const shots = ofCategory.map((s) => s.shots);
    const sumShots = shots.reduce((a, b) => a + b, 0);
    const level =
      sumShots > 0
        ? gemw(
            shots,
            ofCategory.map((s) => s.lafmaxDay),
          )
        : LSV_EMPTY_LEVEL;
    li[k] = level;

    const hd = halfDays[k] ?? { work: 0, sunday: 0 };
    const time = hd.work + ANNEX7_SUNDAY_WEIGHT * hd.sunday;
    lri[k] =
      level === LSV_EMPTY_LEVEL || time <= 0
        ? LSV_EMPTY_LEVEL
        : level +
          10 * Math.log10(time) +
          3 * Math.log10(sumShots) -
          ANNEX7_CONSTANT;
  }

  const terms = ANNEX7_CATEGORIES.map((k) =>
    emptyAsZero && lri[k] === LSV_EMPTY_LEVEL ? 0 : lri[k],
  );
  return { li, lri, lr: esm(terms) };
}
