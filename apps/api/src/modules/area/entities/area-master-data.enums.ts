/**
 * Auswahllisten der Schiessplatz-Stammdaten (B1 5.16, Abbildung 27
 * «Detailansicht Schiessplatzverwaltung»): Klassierung und die Stände des
 * Sanierungsverlaufs. The codes are the stable keys stored in `schiessplatz`
 * and sent through the API; the labels live in the app's locale files
 * (`admin.dm_area_general.options.*`). Dependency-free so DTOs, entity and
 * the demo dataset can share them.
 */

/** Klassierung: Platz hinsichtlich Lärm unproblematisch / problematisch / mit Sanierungsbedarf. */
export const AREA_CLASSIFICATION = ['unproblematic', 'problematic', 'remediation_needed'] as const;
export type AreaClassification = (typeof AREA_CLASSIFICATION)[number];

/** Stand Neuberechnung: nicht erforderlich / im Gange / abgeschlossen. */
export const RECALCULATION_STATE = ['not_required', 'in_progress', 'completed'] as const;
export type RecalculationState = (typeof RECALCULATION_STATE)[number];

/** Bearbeitungsstand Sanierungsprojekt: nicht gestartet / Lösungsstrategie Konzeptphase / Projektierung / Umsetzung / abgeschlossen. */
export const REMEDIATION_PROJECT_STATE = ['not_started', 'concept', 'design', 'implementation', 'completed'] as const;
export type RemediationProjectState = (typeof REMEDIATION_PROJECT_STATE)[number];

/** Stand SPM (Sachplan Militär): offen / in Bearbeitung / abgeschlossen. */
export const SPM_STATE = ['open', 'in_progress', 'completed'] as const;
export type SpmState = (typeof SPM_STATE)[number];

/** Stand Lärmsanierung: Neubeurteilung nötig / Beurteilung erfolgt / saniert. */
export const NOISE_REMEDIATION_STATE = ['reassessment_needed', 'assessed', 'remediated'] as const;
export type NoiseRemediationState = (typeof NOISE_REMEDIATION_STATE)[number];

/** Stand Projekt: nicht gestartet / laufend / abgeschlossen. */
export const PROJECT_STATE = ['not_started', 'ongoing', 'completed'] as const;
export type ProjectState = (typeof PROJECT_STATE)[number];
