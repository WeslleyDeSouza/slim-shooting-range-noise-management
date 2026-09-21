import type {
  DeliveryDto,
  OperatingA7RowDto,
  OperatingA9RowDto,
  RoomSummaryDto,
  StateDetailsDto,
  StateImportDto,
  StateSummaryDto,
  WlrRowDto,
} from '@ui-slim/apiClient';

/**
 * Business rules of Datenverwaltung › Schiessplatz › Berechnungen (B1
 * 5.18–5.21) that the pages need on the client — pure functions, no
 * Angular, no HTTP, so every rule has a unit test:
 *
 * - which state may be set as «aktuell» / «MGDM» and what a click means,
 * - whether a delivery may be deleted (the API decides finally, the mask
 *   explains beforehand),
 * - the four detail tabs of a Stellungsraum (5.21) from the state details,
 * - the structural check of an uploaded Berechnungsdatei before it goes to
 *   the API (5.19), and the summary the mask shows for it,
 * - the export selection (5.20) with its «nothing chosen» / «all» helpers.
 */

// ---------------------------------------------------------------------------
// 5.18 Pointers and delete rules
// ---------------------------------------------------------------------------

export type Pointer = 'current' | 'mgdm';

/** A pointer checkbox is never unchecked directly: the user picks another state instead (exactly one per Schiessplatz). */
export function pointerClickAllowed(state: Pick<StateSummaryDto, 'isCurrent' | 'isMgdm' | 'hasModel'>, pointer: Pointer): boolean {
  if (!state.hasModel) return false; // an empty state (5.20) cannot carry the assessment
  return pointer === 'current' ? !state.isCurrent : !state.isMgdm;
}

/** Why a delivery cannot be deleted (null = may be deleted); mirrors the API rule of 5.18. */
export function deliveryDeleteBlocker(delivery: Pick<DeliveryDto, 'states'>): 'current' | 'mgdm' | 'runs' | null {
  if (delivery.states.some((s) => s.isCurrent)) return 'current';
  if (delivery.states.some((s) => s.isMgdm)) return 'mgdm';
  if (delivery.states.some((s) => s.runCount > 0)) return 'runs';
  return null;
}

/** Deliveries newest first, states by reference year inside (B1 Abbildung 29 lists the newest delivery last; the mask shows the newest on top). */
export function sortDeliveries(deliveries: DeliveryDto[]): DeliveryDto[] {
  return [...deliveries].sort((a, b) => b.deliveredAt.localeCompare(a.deliveredAt) || a.name.localeCompare(b.name, 'de-CH'));
}

/** Free text over Bezeichnung, Lieferantin, Beschreibung, Datei and the states' names / ZustandIDs. */
export function filterDeliveries(deliveries: DeliveryDto[], query: string): DeliveryDto[] {
  const q = query.trim().toLowerCase();
  if (!q) return deliveries;
  return deliveries.filter((d) =>
    [d.name, d.supplier, d.description ?? '', d.fileName ?? '', ...d.states.flatMap((s) => [s.name, s.externalId ?? ''])]
      .some((t) => t.toLowerCase().includes(q)),
  );
}

// ---------------------------------------------------------------------------
// 5.21 Details per Stellungsraum
// ---------------------------------------------------------------------------

export type DetailTab = 'wlr_day' | 'wlr_night' | 'a9' | 'a7';
export const DETAIL_TABS: readonly DetailTab[] = ['wlr_day', 'wlr_night', 'a9', 'a7'];

export interface RoomDetailRows {
  wlrDay: WlrRowDto[];
  wlrNight: WlrRowDto[];
  a9: OperatingA9RowDto[];
  a7: OperatingA7RowDto[];
}

/** The rows of one Stellungsraum, split into the four tabs of B1 Abbildung 32–35; null room = every row of the state. */
export function roomDetailRows(details: Pick<StateDetailsDto, 'wlr' | 'a9' | 'a7'>, roomId: string | null): RoomDetailRows {
  const of = <T extends { roomId: string }>(rows: T[]) => (roomId ? rows.filter((r) => r.roomId === roomId) : rows);
  const wlr = of(details.wlr);
  return {
    wlrDay: wlr.filter((w) => w.timeGroup === 'day'),
    wlrNight: wlr.filter((w) => w.timeGroup === 'eve'),
    a9: of(details.a9),
    a7: of(details.a7),
  };
}

/** Count per tab for the tab badges. */
export function detailTabCounts(rows: RoomDetailRows): Record<DetailTab, number> {
  return { wlr_day: rows.wlrDay.length, wlr_night: rows.wlrNight.length, a9: rows.a9.length, a7: rows.a7.length };
}

/** Rooms that have data in the state first, in the order of the Schiessplatz; free text over Nr. and Bezeichnung. */
export function filterRooms(rooms: RoomSummaryDto[], query: string): RoomSummaryDto[] {
  const q = query.trim().toLowerCase();
  return rooms.filter((r) => !q || r.name.toLowerCase().includes(q) || (r.coordinationSectionNo ?? '').toLowerCase().includes(q));
}

/** The room the details open with: the first one that has sources, else the first room. */
export function initialRoom(rooms: RoomSummaryDto[]): RoomSummaryDto | null {
  return rooms.find((r) => r.sourceCount > 0) ?? rooms[0] ?? null;
}

// ---------------------------------------------------------------------------
// 5.19 Berechnungsdatei (JSON) on the client
// ---------------------------------------------------------------------------

export interface StateFileCheck {
  ok: boolean;
  /** Structural problems the mask shows before anything is sent. */
  problems: string[];
  /** The parsed file when `ok`. */
  state: StateImportDto | null;
  summary: StateFileSummary | null;
}

export interface StateFileSummary {
  deliveryName: string;
  supplier: string;
  deliveredAt: string;
  stateName: string;
  externalId: string | null;
  referenceYear: number;
  plantParts: number;
  sources: number;
  immissionPoints: number;
  wlr: number;
  wlrDay: number;
  wlrNight: number;
}

/**
 * Reads an uploaded JSON file. Accepts a single `StateImportDto` or an
 * export bundle of SLIM (`format: 'slim-state-export'`) with exactly one
 * state; a bundle with several states must be split by the user (the mask
 * says which state to pick). Only the structure is checked here — the
 * references (Stellungsräume, Kombinationen) are the API's staging (5.19).
 */
export function checkStateFile(text: string): StateFileCheck {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, problems: ['file.not_json'], state: null, summary: null };
  }
  let candidate: unknown = json;
  if (isRecord(json) && json['format'] === 'slim-state-export') {
    const states = Array.isArray(json['states']) ? (json['states'] as unknown[]) : [];
    if (states.length !== 1) return { ok: false, problems: [states.length ? 'file.bundle_many' : 'file.bundle_empty'], state: null, summary: null };
    candidate = states[0];
  }
  if (!isRecord(candidate)) return { ok: false, problems: ['file.not_object'], state: null, summary: null };

  const problems: string[] = [];
  const calc = candidate['calculation'];
  const state = candidate['state'];
  if (!isRecord(calc) || typeof calc['name'] !== 'string' || !calc['name']) problems.push('file.calculation_name');
  if (!isRecord(calc) || !/^\d{4}-\d{2}-\d{2}$/.test(String(calc['deliveredAt'] ?? ''))) problems.push('file.delivered_at');
  if (!isRecord(state) || typeof state['name'] !== 'string' || !state['name']) problems.push('file.state_name');
  if (!isRecord(state) || !Number.isInteger(state['referenceYear'])) problems.push('file.reference_year');
  for (const key of ['plantParts', 'sources', 'immissionPoints', 'wlr'] as const) {
    if (!Array.isArray(candidate[key])) problems.push(`file.${key}_missing`);
  }
  if (Array.isArray(candidate['plantParts']) && candidate['plantParts'].length === 0) problems.push('file.plant_parts_empty');
  if (problems.length) return { ok: false, problems, state: null, summary: null };

  const dto = candidate as unknown as StateImportDto;
  return {
    ok: true,
    problems: [],
    state: dto,
    summary: {
      deliveryName: dto.calculation.name,
      supplier: dto.calculation.supplier ?? '',
      deliveredAt: dto.calculation.deliveredAt,
      stateName: dto.state.name,
      externalId: dto.state.externalId ?? null,
      referenceYear: dto.state.referenceYear,
      plantParts: dto.plantParts.length,
      sources: dto.sources.length,
      immissionPoints: dto.immissionPoints.length,
      wlr: dto.wlr.length,
      wlrDay: dto.wlr.filter((w) => w.timeGroup === 'day').length,
      wlrNight: dto.wlr.filter((w) => w.timeGroup === 'eve').length,
    },
  };
}

/** The time group a WLR file belongs to, from its name (`day.wlr`, `…_NIGHT.wlr`, `eve.wlr`); null when the name says nothing. */
export function timeGroupFromFileName(fileName: string): 'day' | 'eve' | null {
  const n = fileName.toLowerCase();
  if (/(^|[^a-z])(eve|night|nacht|abend)([^a-z]|$)/.test(n)) return 'eve';
  if (/(^|[^a-z])(day|tag)([^a-z]|$)/.test(n)) return 'day';
  return null;
}

/** The Anhang a Betriebsdaten file belongs to, from its name (`BetriebA9.txt`, `…_BD7.csv`); null when unclear. */
export function annexFromFileName(fileName: string): 9 | 7 | null {
  const n = fileName.toLowerCase();
  if (/a9|bd9|anhang ?9|annex ?9/.test(n)) return 9;
  if (/a7|bd7|anhang ?7|annex ?7/.test(n)) return 7;
  return null;
}

// ---------------------------------------------------------------------------
// 5.20 Export selection
// ---------------------------------------------------------------------------

export function toggleSelection<T>(selected: readonly T[], id: T): T[] {
  return selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
}

/** File name of a Blob download for the export (mirrors the API's `fileName` header when present). */
export function downloadName(headers: { get(name: string): string | null } | null, fallback: string): string {
  const fromHeader = headers?.get('fileName');
  return fromHeader && fromHeader.trim() ? fromHeader.trim() : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
