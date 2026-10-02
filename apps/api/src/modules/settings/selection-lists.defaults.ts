/**
 * Auswahllisten (B1 5.3, slm 1) and the values they start with: what the
 * masks offered before the lists became maintainable, with the labels of
 * the four languages. A tenant that has changed nothing reads these; the
 * first change of a list copies them into the table `auswahlliste_wert`.
 *
 * Not in here, on purpose: lists whose codes drive the calculation or are
 * fixed by the LSV (Nutzungsart, Empfindlichkeitsstufe, Anhang-7-Kategorie,
 * Baujahr-Klasse, Einheit) and the master data with masks of their own
 * (Waffenkategorie, Waffe, Kaliber — B1 5.22–5.25).
 */
export interface SelectionListDefault {
  code: string;
  labelDe: string;
  labelFr: string;
  labelIt: string;
  labelEn: string;
}

export const SELECTION_LIST_DEFAULTS = {
  classification: [
    { code: 'unproblematic', labelDe: "Platz hinsichtlich Lärms unproblematisch", labelFr: "Place sans problème de bruit", labelIt: "Piazza senza problemi di rumore", labelEn: "Range unproblematic regarding noise" },
    { code: 'problematic', labelDe: "Platz hinsichtlich Lärms problematisch", labelFr: "Place problématique en matière de bruit", labelIt: "Piazza problematica dal punto di vista del rumore", labelEn: "Range problematic regarding noise" },
    { code: 'remediation_needed', labelDe: "Platz mit Sanierungsbedarf", labelFr: "Place nécessitant un assainissement", labelIt: "Piazza con necessità di risanamento", labelEn: "Range in need of remediation" },
  ],
  recalculation_state: [
    { code: 'not_required', labelDe: "Nicht erforderlich", labelFr: "Non nécessaire", labelIt: "Non necessario", labelEn: "Not required" },
    { code: 'in_progress', labelDe: "Neuberechnung im Gange", labelFr: "Nouveau calcul en cours", labelIt: "Nuovo calcolo in corso", labelEn: "Recalculation in progress" },
    { code: 'completed', labelDe: "Neuberechnung abgeschlossen", labelFr: "Nouveau calcul terminé", labelIt: "Nuovo calcolo concluso", labelEn: "Recalculation completed" },
  ],
  remediation_project_state: [
    { code: 'not_started', labelDe: "Nicht gestartet", labelFr: "Non commencé", labelIt: "Non avviato", labelEn: "Not started" },
    { code: 'concept', labelDe: "Erarbeitung Lösungsstrategie Konzeptphase", labelFr: "Élaboration de la stratégie de solution, phase de concept", labelIt: "Elaborazione della strategia di soluzione, fase concettuale", labelEn: "Solution strategy, concept phase" },
    { code: 'design', labelDe: "Projektierung", labelFr: "Étude de projet", labelIt: "Progettazione", labelEn: "Design" },
    { code: 'implementation', labelDe: "Umsetzung", labelFr: "Mise en œuvre", labelIt: "Attuazione", labelEn: "Implementation" },
    { code: 'completed', labelDe: "Abgeschlossen", labelFr: "Terminé", labelIt: "Concluso", labelEn: "Completed" },
  ],
  spm_state: [
    { code: 'open', labelDe: "Offen", labelFr: "Ouvert", labelIt: "Aperto", labelEn: "Open" },
    { code: 'in_progress', labelDe: "In Bearbeitung", labelFr: "En cours", labelIt: "In elaborazione", labelEn: "In progress" },
    { code: 'completed', labelDe: "Abgeschlossen", labelFr: "Terminé", labelIt: "Concluso", labelEn: "Completed" },
  ],
  noise_remediation_state: [
    { code: 'reassessment_needed', labelDe: "Neubeurteilung nötig", labelFr: "Nouvelle évaluation nécessaire", labelIt: "Nuova valutazione necessaria", labelEn: "Reassessment needed" },
    { code: 'assessed', labelDe: "Beurteilung erfolgt", labelFr: "Évaluation effectuée", labelIt: "Valutazione effettuata", labelEn: "Assessed" },
    { code: 'remediated', labelDe: "Saniert", labelFr: "Assaini", labelIt: "Risanato", labelEn: "Remediated" },
  ],
  project_state: [
    { code: 'not_started', labelDe: "Nicht gestartet", labelFr: "Non commencé", labelIt: "Non avviato", labelEn: "Not started" },
    { code: 'ongoing', labelDe: "Laufend", labelFr: "En cours", labelIt: "In corso", labelEn: "Ongoing" },
    { code: 'completed', labelDe: "Abgeschlossen", labelFr: "Terminé", labelIt: "Concluso", labelEn: "Completed" },
  ],
  civil_usage_kind: [
    { code: 'obligatory', labelDe: "Obligatorisches Schiessen", labelFr: "Tir obligatoire", labelIt: "Tiro obbligatorio", labelEn: "Compulsory shooting" },
    { code: 'field_shooting', labelDe: "Feldschiessen", labelFr: "Tir en campagne", labelIt: "Tiro in campagna", labelEn: "Field shooting" },
    { code: 'other', labelDe: "Anderes", labelFr: "Autre", labelIt: "Altro", labelEn: "Other" },
  ],
} as const satisfies Record<string, readonly SelectionListDefault[]>;

export type SelectionListKey = keyof typeof SELECTION_LIST_DEFAULTS;
export const SELECTION_LIST_KEYS = Object.keys(SELECTION_LIST_DEFAULTS) as SelectionListKey[];

/** Longest code a list can store (width of the column that holds the chosen value). */
export const SELECTION_LIST_CODE_LENGTH: Record<SelectionListKey, number> = {
  classification: 24,
  recalculation_state: 24,
  remediation_project_state: 24,
  spm_state: 24,
  noise_remediation_state: 24,
  project_state: 24,
  civil_usage_kind: 16,
};
