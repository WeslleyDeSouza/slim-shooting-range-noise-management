/**
 * Schritt 2 of the calculation (B1 7.5, `slm 32`): the shots of one
 * combination Stellungsraum × Waffe/Kaliber are spread over the sources
 * (Schusslinien) of the Zustand in proportion to the weights that come from
 * the Betriebsdaten of the noise model.
 *
 * Edge cases (review T02): a combination whose weights are all zero — the
 * model carries no operating data for it — is spread evenly and flagged,
 * so the import report / the assessment can show it; a single source gets
 * everything; a combination without any source yields nothing (the caller
 * treats it as "keine Berechnung"). Decimal quantities survive: shares are
 * rounded to three decimals and the rounding remainder goes to the largest
 * share, so the shares always add up to the input.
 */
export interface SourceWeight {
  sourceId: string;
  /** Non-negative weight, e.g. yearly shots of the source in the Betriebsdaten. */
  weight: number;
}

export interface DistributedShare {
  sourceId: string;
  shots: number;
}

export interface Distribution {
  shares: DistributedShare[];
  /** `zero-weights`: every weight was 0 → spread evenly (B1 7.5, Prüfbericht). */
  warning?: 'zero-weights';
}

const DECIMALS = 3;
const SCALE = 10 ** DECIMALS;

export function distributeShots(
  quantity: number,
  sources: readonly SourceWeight[],
): Distribution {
  if (!(quantity >= 0) || !Number.isFinite(quantity)) {
    throw new Error(`distributeShots: invalid quantity ${quantity}`);
  }
  for (const s of sources) {
    if (!(s.weight >= 0) || !Number.isFinite(s.weight)) {
      throw new Error(`distributeShots: invalid weight ${s.weight} of ${s.sourceId}`);
    }
  }
  if (sources.length === 0) return { shares: [] };
  if (sources.length === 1) return { shares: [{ sourceId: sources[0].sourceId, shots: quantity }] };

  const total = sources.reduce((sum, s) => sum + s.weight, 0);
  const zero = total === 0;
  const weights = zero ? sources.map(() => 1) : sources.map((s) => s.weight);
  const weightSum = zero ? sources.length : total;

  // Integer arithmetic in thousandths, remainder to the largest share.
  const units = Math.round(quantity * SCALE);
  const exact = weights.map((w) => (units * w) / weightSum);
  const floors = exact.map((e) => Math.floor(e));
  let remainder = units - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((e, i) => ({ i, frac: e - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i] += 1;
    remainder -= 1;
  }
  const shares = sources.map((s, i) => ({ sourceId: s.sourceId, shots: floors[i] / SCALE }));
  return zero ? { shares, warning: 'zero-weights' } : { shares };
}
