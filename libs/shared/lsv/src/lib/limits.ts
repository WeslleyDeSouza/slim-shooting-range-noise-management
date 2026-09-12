import {
  BuildYearClass,
  LimitKind,
  LimitSet,
  LsvAnnex,
  SensitivityLevel,
} from './types';

/**
 * Belastungsgrenzwerte Anhang 9 LSV Ziff. 2 (militärische Waffen-, Schiess- und
 * Übungsplätze), dB, per Empfindlichkeitsstufe: Planungswert / Immissionsgrenzwert /
 * Alarmwert (AW: 65 / 70 / 70 / 75).
 * Exported so the admin configuration (B1 5.28) can override them later.
 */
export const ANNEX9_LIMITS: Readonly<Record<SensitivityLevel, LimitSet>> = {
  I: { pw: 50, igw: 55, aw: 65 },
  II: { pw: 55, igw: 60, aw: 70 },
  III: { pw: 60, igw: 65, aw: 70 },
  IV: { pw: 65, igw: 70, aw: 75 },
};

/** Belastungsgrenzwerte Anhang 7 LSV (zivile Schiessanlagen), dB. */
export const ANNEX7_LIMITS: Readonly<Record<SensitivityLevel, LimitSet>> = {
  I: { pw: 50, igw: 55, aw: 65 },
  II: { pw: 55, igw: 60, aw: 75 },
  III: { pw: 60, igw: 65, aw: 75 },
  IV: { pw: 65, igw: 70, aw: 80 },
};

/** Limit set of an annex for an Empfindlichkeitsstufe (Art. 43 LSV). */
export function limits(annex: LsvAnnex, es: SensitivityLevel): LimitSet {
  const table = annex === 9 ? ANNEX9_LIMITS : ANNEX7_LIMITS;
  const set = table[es];
  if (!set) throw new Error(`unknown Empfindlichkeitsstufe "${es}"`);
  return { ...set };
}

/**
 * Which limits apply, by Baujahr der Anlageteile (B1 7.7): built before 1985
 * → Immissionsgrenzwert (Sanierung), after 1985 → Planungswert, mixed → both
 * (IGW over all rooms, PW over the rooms built after 1985).
 */
export function applicableLimits(
  buildYear: BuildYearClass,
): readonly LimitKind[] {
  switch (buildYear) {
    case 'before1985':
      return ['igw'];
    case 'after1985':
      return ['pw'];
    case 'mixed':
      return ['igw', 'pw'];
    default:
      throw new Error(`unknown build year class "${String(buildYear)}"`);
  }
}
