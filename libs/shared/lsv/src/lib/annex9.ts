import { esm, gemw } from './levels';
import { Annex9Result, Annex9Source, LSV_EMPTY_LEVEL } from './types';

/**
 * Reference time of Anhang 9: 52 weeks × 5 workdays × 12 hours, in seconds
 * (`10*LOG(52*5*12*60*60)` in B1.4 sheet A9X).
 */
export const ANNEX9_REFERENCE_SECONDS = 52 * 5 * 12 * 60 * 60;

/** Evening bonus of Anhang 9 (ausserhalb Werktag), dB. */
export const ANNEX9_EVENING_PENALTY = 5;

/** Constant term K of Anhang 9, dB. */
export const ANNEX9_CONSTANT = 15;

/**
 * Beurteilungspegel nach Anhang 9 LSV for one receiver (B1 7.6, B1.4 sheet
 * `sonARMS_Demo_A9X`):
 *
 *     LAE1 = GEMW(shotsDay, laeDay) + 10·log10(Σ shotsDay)
 *     LAE2 = GEMW(shotsEve, laeEve) + 10·log10(Σ shotsEve) + 5
 *     Lr   = ESM(LAE1, LAE2) − 10·log10(52·5·12·3600) + 15
 *
 * A period without shots yields `LSV_EMPTY_LEVEL` for its LAE and carries no
 * energy into Lr; without any shots at all Lr is `LSV_EMPTY_LEVEL`. Results
 * are unrounded — round for display with `roundDb`.
 */
export function annex9Level(sources: Annex9Source[]): Annex9Result {
  for (const s of sources) {
    if (!(s.shotsDay >= 0) || !(s.shotsEve >= 0)) {
      throw new Error(`annex9Level: invalid shots for source ${s.sourceId}`);
    }
  }
  const shotsDay = sources.map((s) => s.shotsDay);
  const shotsEve = sources.map((s) => s.shotsEve);
  const sumDay = shotsDay.reduce((a, b) => a + b, 0);
  const sumEve = shotsEve.reduce((a, b) => a + b, 0);

  const lae1 =
    sumDay > 0
      ? gemw(
          shotsDay,
          sources.map((s) => s.laeDay),
        ) +
        10 * Math.log10(sumDay)
      : LSV_EMPTY_LEVEL;
  const lae2 =
    sumEve > 0
      ? gemw(
          shotsEve,
          sources.map((s) => s.laeEve),
        ) +
        10 * Math.log10(sumEve) +
        ANNEX9_EVENING_PENALTY
      : LSV_EMPTY_LEVEL;

  const sum = esm([lae1, lae2]);
  const lr =
    sum === LSV_EMPTY_LEVEL
      ? LSV_EMPTY_LEVEL
      : sum - 10 * Math.log10(ANNEX9_REFERENCE_SECONDS) + ANNEX9_CONSTANT;

  return { lae1, lae2, lr };
}
