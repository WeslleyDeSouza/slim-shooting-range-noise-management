import { roundDb } from './levels';
import { LSV_EMPTY_LEVEL, NoiseState, QuotaState } from './types';

/** Default band below the limit that shows orange (B1 5.10). */
export const NOISE_WARN_BAND_DB = 5;

/** Default tolerance of the quota traffic light: orange up to 125 % (B1 5.10). */
export const QUOTA_WARN_FACTOR = 1.25;

const RANK: Record<NoiseState, number> = { none: 0, ok: 1, warn: 2, over: 3 };

/**
 * Ampel Lärmbelastung (B1 5.10, 7.7) for one level against one limit:
 * red when `Lr > limit`, orange when `Lr > limit − warnBand`, else green;
 * `none` without a usable level. The comparison uses the level rounded to
 * one decimal — the way it is printed — so 60.04 dB against 60 dB reads as
 * 60.0 and is not "over".
 */
export function noiseState(
  level: number | null | undefined,
  limit: number,
  warnBand = NOISE_WARN_BAND_DB,
): NoiseState {
  if (level == null || !Number.isFinite(level) || level <= LSV_EMPTY_LEVEL) {
    return 'none';
  }
  const lr = roundDb(level, 1);
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
