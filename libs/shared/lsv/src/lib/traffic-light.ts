import { roundDb } from './levels';
import { LSV_EMPTY_LEVEL, NoiseState, QuotaState } from './types';

/** Default band below the limit that shows orange (B1 5.10). */
export const NOISE_WARN_BAND_DB = 5;

/** Default tolerance of the quota traffic light: orange up to 125 % (B1 5.10). */
export const QUOTA_WARN_FACTOR = 1.25;

const RANK: Record<NoiseState, number> = { none: 0, ok: 1, warn: 2, over: 3 };

/**
 * How the Beurteilungspegel is rounded before it meets the limit.
 * `whole` = Projekthandbuch B1.2 Kap. 10.4 (mathematical rounding to whole
 * dB: 60.4 → 60 eingehalten, 60.5 → 61 überschritten), `tenth` = as
 * displayed with one decimal, `none` = unrounded.
 */
export type NoiseRounding = 'whole' | 'tenth' | 'none';
export const NOISE_ROUNDING_DEFAULT: NoiseRounding = 'whole';

/** The level as it enters the limit comparison. */
export function assessedLevel(level: number, rounding: NoiseRounding = NOISE_ROUNDING_DEFAULT): number {
  if (rounding === 'whole') return roundDb(level, 0);
  if (rounding === 'tenth') return roundDb(level, 1);
  return level;
}

/**
 * Ampel Lärmbelastung (B1 5.10, 7.7) for one level against one limit:
 * red when `Lr > limit`, orange when `Lr > limit − warnBand`, else green;
 * `none` without a usable level. `Lr` is the level rounded as the
 * Projekthandbuch prescribes (`rounding`, default whole dB), so 60.4 dB
 * against 60 dB is eingehalten and 60.5 dB überschritten.
 */
export function noiseState(
  level: number | null | undefined,
  limit: number,
  warnBand = NOISE_WARN_BAND_DB,
  rounding: NoiseRounding = NOISE_ROUNDING_DEFAULT,
): NoiseState {
  if (level == null || !Number.isFinite(level) || level <= LSV_EMPTY_LEVEL) {
    return 'none';
  }
  const lr = assessedLevel(level, rounding);
  if (lr > limit) return 'over';
  if (lr > limit - warnBand) return 'warn';
  return 'ok';
}

/** Aggregation (B1 5.10): red as soon as one is red, else orange, else green. */
export function worstState(states: readonly NoiseState[]): NoiseState {
  let worst: NoiseState = 'none';
  for (const s of states) if (RANK[s] > RANK[worst]) worst = s;
  return worst;
}

/**
 * Ampel Kontingent Plangenehmigung (B1 5.10): green when `actual ≤ target`,
 * orange up to `target · warnFactor`, red above; `none` without a target.
 * A target of 0 (weapon without quota) is red as soon as anything was shot.
 */
export function quotaState(
  actual: number,
  target: number | null | undefined,
  warnFactor = QUOTA_WARN_FACTOR,
): QuotaState {
  if (target == null || !Number.isFinite(target)) return 'none';
  if (actual <= target) return 'ok';
  if (actual <= target * warnFactor) return 'warn';
  return 'over';
}
