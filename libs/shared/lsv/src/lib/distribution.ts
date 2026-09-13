/**
 * Schritt 2 of the calculation (B1 7.5, `slm 32`): the shots of one
 * combination Stellungsraum × Waffe/Kaliber are spread over the sources
 * (Schusslinien) of the Zustand in proportion to the weights that come from
 * the Betriebsdaten of the noise model.
 *
 * Zero total weight is refused unless an explicitly released substitute rule
 * is supplied. Derived quantities retain floating-point precision; rounding
 * belongs to presentation, never to the source distribution.
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
  /**
   * `zero-weights`: every weight of the combination was 0 — the model
   * carries no operating data for it; refused by default or explicitly spread evenly,
   * see DistributionOptions. `no-source`: the combination has no source in
   * the Zustand, nothing could be distributed — the quantity must be shown
   * as «nicht zuordenbar», never silently dropped (it would understate Lr).
   * Both are assumptions to flag in the Prüfbericht, the Berechnungsstand
   * and at the affected receivers (Fachregel O8).
   */
  warning?: 'zero-weights' | 'no-source';
  /** `true` when the distribution was withheld (default for Σ weights = 0). */
  refused?: boolean;
  /** `true` when the released Ersatzregel (even split) was applied — shown in the result. */
  substituteRule?: boolean;
  /** The documented release the Ersatzregel was applied under (carried into the Berechnungsstand). */
  release?: SubstituteRuleRelease;
}

/** Documented decision of the KOMZ Lärm that releases the Ersatzregel (Entscheidungslog). */
export interface SubstituteRuleRelease {
  /** Reference of the decision, e.g. «Entscheidungslog O8, KOMZ Lärm». */
  reference: string;
  /** Date of the decision, YYYY-MM-DD. */
  date: string;
}

export interface DistributionOptions {
  /**
   * Behaviour when every weight is 0 (Fachregel O8): `refuse` (default) —
   * no invented distribution, the combination is not computed and the
   * affected receivers become «nicht beurteilbar»; `equal` is the
   * Ersatzregel released by the KOMZ Lärm (decision log): even split, result
   * flagged `substituteRule`.
   */
  onZeroWeights?: 'refuse' | 'equal';
  /**
   * Required with `equal`: the parameter alone proves no release — the
   * even split is only applied together with the reference to the decision.
   */
  release?: SubstituteRuleRelease;
}

export function distributeShots(
  quantity: number,
  sources: readonly SourceWeight[],
  options: DistributionOptions = {},
): Distribution {
  if (!(quantity >= 0) || !Number.isFinite(quantity)) {
    throw new Error(`distributeShots: invalid quantity ${quantity}`);
  }
  for (const s of sources) {
    if (!(s.weight >= 0) || !Number.isFinite(s.weight)) {
      throw new Error(`distributeShots: invalid weight ${s.weight} of ${s.sourceId}`);
    }
  }
  if (sources.length === 0) {
    return quantity > 0 ? { shares: [], warning: 'no-source' } : { shares: [] };
  }
  const total = sources.reduce((sum, s) => sum + s.weight, 0);
  const zero = total === 0;
  const useSubstitute = options.onZeroWeights === 'equal';
  if (useSubstitute && !(options.release?.reference && options.release?.date)) {
    throw new Error('distributeShots: the Ersatzregel (equal split) needs the documented release of the KOMZ Lärm (options.release)');
  }
  if (zero && !useSubstitute) {
    return { shares: sources.map((s) => ({ sourceId: s.sourceId, shots: 0 })), warning: 'zero-weights', refused: true };
  }
  if (sources.length === 1) {
    const share = { shares: [{ sourceId: sources[0].sourceId, shots: quantity }] };
    return zero ? { ...share, warning: 'zero-weights', substituteRule: true, release: options.release } : share;
  }

  const weights = zero ? sources.map(() => 1) : sources.map((s) => s.weight);
  const weightSum = zero ? sources.length : total;

  // Preserve derived annual averages, including quantities below 0.001.
  const shares = sources.map((s, i) => ({ sourceId: s.sourceId, shots: quantity * (weights[i] / weightSum) }));
  // Correct only floating-point summation error on the largest positive share.
  const largest = weights.reduce((best, w, i) => w > weights[best] ? i : best, 0);
  shares[largest].shots += quantity - shares.reduce((sum, s) => sum + s.shots, 0);
  return zero ? { shares, warning: 'zero-weights', substituteRule: true, release: options.release } : { shares };
}
