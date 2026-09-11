import { computed, Injectable, signal } from '@angular/core';
import {
  needsAttention,
  RangeStatus,
  RangeSummary,
  ShootingRange,
} from './ranges.model';
import { MASTER_DATA_MOCK, RANGES_MOCK, USER_MOCK } from './ranges.mock';

/**
 * Shooting ranges the signed-in user is authorised for. Backed by mock data
 * until the API module exists (docs/architecture/sitemap.md → `ranges`).
 */
@Injectable({ providedIn: 'root' })
export class RangesService {
  readonly ranges = signal<ShootingRange[]>(RANGES_MOCK);
  readonly masterData = signal(MASTER_DATA_MOCK);
  readonly user = signal(USER_MOCK);

  /** Worst status per range: over > warn > ok > none. */
  readonly summary = computed<RangeSummary>(() => {
    const summary: RangeSummary = { total: 0, ok: 0, warn: 0, over: 0, none: 0 };
    for (const range of this.ranges()) {
      summary.total++;
      summary[worst(range.quota, range.noise)]++;
    }
    return summary;
  });

  readonly attention = computed(() => this.ranges().filter(needsAttention));
}

const ORDER: RangeStatus[] = ['none', 'ok', 'warn', 'over'];

export function worst(a: RangeStatus, b: RangeStatus): RangeStatus {
  return ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b;
}
