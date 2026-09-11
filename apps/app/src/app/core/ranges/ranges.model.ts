/** Traffic-light status of a shooting range (quota / noise). */
export type RangeStatus = 'ok' | 'warn' | 'over' | 'none';

export interface ShootingRange {
  id: string;
  name: string;
  /** Koordinationsabschnitt-Nr. */
  ka: string;
  /** Sachplan-Nr. (optional) */
  sp: string | null;
  quota: RangeStatus;
  noise: RangeStatus;
}

export interface RangeSummary {
  total: number;
  ok: number;
  warn: number;
  over: number;
  none: number;
}

export const NEEDS_ATTENTION: readonly RangeStatus[] = ['warn', 'over'];

export function needsAttention(range: ShootingRange): boolean {
  return (
    NEEDS_ATTENTION.includes(range.quota) || NEEDS_ATTENTION.includes(range.noise)
  );
}
