import { LSV_EMPTY_LEVEL } from './types';

/** Energy of a level: 10^(L/10). */
const energy = (level: number): number => Math.pow(10, level / 10);

/** Level of an energy: 10·log10(E). */
const level = (e: number): number => 10 * Math.log10(e);

/**
 * GEMW — gewichtetes energetisches Mittel (B1.4 VBA `GEMW`, B1 7.6):
 * `10·log10( Σ g_i·10^(0.1·L_i) / Σ g_i )`.
 * Returns `LSV_EMPTY_LEVEL` (−99) when the lists are empty or every weight
 * is 0 — exactly what the B1.4 sheets print for a category without shots.
 * Throws on a length mismatch or a negative weight (a data error, never a
 * silent 0).
 */
export function gemw(weights: number[], levels: number[]): number {
  if (weights.length !== levels.length) {
    throw new Error(
      `gemw: ${weights.length} weights but ${levels.length} levels`,
    );
  }
  let sumWeights = 0;
  let sumEnergy = 0;
  for (let i = 0; i < weights.length; i += 1) {
    const g = weights[i];
    if (!(g >= 0)) throw new Error(`gemw: invalid weight ${g} at index ${i}`);
    sumWeights += g;
    if (g > 0) sumEnergy += g * energy(levels[i]);
  }
  if (sumWeights === 0) return LSV_EMPTY_LEVEL;
  return level(sumEnergy / sumWeights);
}

/**
 * ESM — energetische Summe (B1.4 VBA `esm`): `10·log10( Σ 10^(0.1·L_i) )`.
 * Entries at or below `LSV_EMPTY_LEVEL` and non-finite values carry no
 * energy and are skipped; without any contributing level the result is
 * `LSV_EMPTY_LEVEL`.
 */
export function esm(levels: number[]): number {
  let sum = 0;
  let any = false;
  for (const l of levels) {
    if (!Number.isFinite(l) || l <= LSV_EMPTY_LEVEL) continue;
    sum += energy(l);
    any = true;
  }
  return any ? level(sum) : LSV_EMPTY_LEVEL;
}

/**
 * Round a level half away from zero to `digits` decimals without the usual
 * binary-float artefacts (60.75 → 60.8, 2.675 → 2.7, −0.05 → −0.1). Uses the
 * shortest decimal representation of the value, so 1.005 (stored as
 * 1.00499…) still rounds to 1.01 as a human would expect.
 */
export function roundDb(value: number, digits = 1): number {
  if (!Number.isFinite(value)) return value;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  // Shift the decimal point in the string domain to avoid 1.005 * 100 = 100.49999.
  const shifted = Number(`${abs}e${digits}`);
  const rounded = Math.round(shifted);
  return sign * Number(`${rounded}e-${digits}`);
}
