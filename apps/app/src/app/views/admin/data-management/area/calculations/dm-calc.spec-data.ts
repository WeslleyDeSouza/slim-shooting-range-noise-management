import { signal } from '@angular/core';
import { convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import type {
  DeliveryDto,
  OperatingA7RowDto,
  OperatingA9RowDto,
  RoomSummaryDto,
  ShotYearDto,
  StateDetailsDto,
  StateImportDto,
  StateSummaryDto,
  UploadResultDto,
  WlrRowDto,
} from '@ui-slim/apiClient';

/**
 * Shared fixtures of the Jest specs of Datenverwaltung › Schiessplatz ›
 * Berechnungen (B1 5.18–5.21): the demo area Geissalp with two deliveries —
 * «Lieferung 2023» (Initiale Aufnahme = aktuell + MGDM, Sanierter Zustand)
 * and «Lieferung 2026» with an empty state (no model yet, B1 5.20).
 */

const TS = '2026-09-19T08:00:00.000Z';

export function state(overrides: Partial<StateSummaryDto> & Pick<StateSummaryDto, 'id' | 'name'>): StateSummaryDto {
  return {
    externalId: null,
    referenceYear: 2026,
    buildYearClass: 'mixed',
    isCurrent: false,
    isMgdm: false,
    hasModel: true,
    plantPartCount: 3,
    sourceCount: 12,
    pointCount: 6,
    wlrCount: 120,
    runCount: 0,
    ...overrides,
  };
}

export const INITIAL = state({ id: 's-initial', name: 'Initiale Aufnahme', externalId: '1104.020_1', referenceYear: 2023, isCurrent: true, isMgdm: true });
export const SANITISED = state({ id: 's-sanitised', name: 'Sanierter Zustand SPM Geissalp', externalId: '1104.020_2', referenceYear: 2026, buildYearClass: 'after1985' });
export const EMPTY_STATE = state({ id: 's-empty', name: 'Variante A', externalId: '1104.020_3', referenceYear: 2027, hasModel: false, plantPartCount: 0, sourceCount: 0, pointCount: 0, wlrCount: 0 });

export function delivery(overrides: Partial<DeliveryDto> & Pick<DeliveryDto, 'id' | 'name'>): DeliveryDto {
  const states = overrides.states ?? [];
  return {
    supplier: 'Büro XY',
    deliveredAt: '2023-05-10',
    description: null,
    fileName: null,
    stateCount: states.length,
    hasCurrent: states.some((s) => s.isCurrent),
    hasMgdm: states.some((s) => s.isMgdm),
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
    states,
  };
}

export const DELIVERY_2023 = delivery({ id: 'd-2023', name: 'Lieferung 2023', deliveredAt: '2023-05-10', fileName: 'geissalp_2023.gdb', description: 'Erstlieferung', states: [INITIAL, SANITISED] });
export const DELIVERY_2026 = delivery({ id: 'd-2026', name: 'Lieferung 2026', supplier: 'Büro Z', deliveredAt: '2026-09-01', states: [EMPTY_STATE] });
export const DELIVERIES: DeliveryDto[] = [DELIVERY_2023, DELIVERY_2026];

/** The flat list the facade exposes (`states` = every state with its delivery). */
export function flatStates(deliveries: DeliveryDto[]): (StateSummaryDto & { delivery: DeliveryDto })[] {
  return deliveries.flatMap((d) => d.states.map((s) => ({ ...s, delivery: d })));
}

// --- 5.21 Details ---------------------------------------------------------------

export const ROOM_A: RoomSummaryDto = { id: 'r-a', coordinationSectionNo: '1104.020.01', name: 'Stellungsrm A 1', plantPartCount: 1, sourceCount: 2, wlrCount: 4 };
export const ROOM_B: RoomSummaryDto = { id: 'r-b', coordinationSectionNo: '1104.020.06', name: 'Stellungsrm B 2', plantPartCount: 1, sourceCount: 1, wlrCount: 1 };
export const ROOM_EMPTY: RoomSummaryDto = { id: 'r-empty', coordinationSectionNo: null, name: 'NGST Schönenboden', plantPartCount: 0, sourceCount: 0, wlrCount: 0 };

function wlr(roomId: string, sourceId: string, point: string, timeGroup: 'day' | 'eve', lae: number): WlrRowDto {
  return { roomId, sourceId, point, timeGroup, lae, lafmax: lae + 10, laeMk: lae - 1, laeGk: null, laeDet: null, elevation: 0.5, egid: point === 'E1' ? '123456' : null, plantPartNo: '1104.020.01', weaponSystem: 'Stgw90' };
}

export const WLR: WlrRowDto[] = [
  wlr('r-a', 'A1_Stgw90', 'E1', 'day', 60.4),
  wlr('r-a', 'A1_Stgw90', 'E2', 'day', 55.1),
  wlr('r-a', 'A2_Pist75', 'E1', 'day', 48),
  wlr('r-a', 'A1_Stgw90', 'E1', 'eve', 58.3),
  wlr('r-b', 'B_Mg51', 'E1', 'day', 62),
];
export const A9: OperatingA9RowDto[] = [
  { roomId: 'r-a', sourceId: 'A1_Stgw90', plantPartNo: '1104.020.01', weaponSystem: 'Stgw90', combinationName: 'Stgw 90 · 5.6 mm', shotsInside: 20000, shotsOutside: 3000, estimated: false, year: 2025, remark: null },
  { roomId: 'r-b', sourceId: 'B_Mg51', plantPartNo: '1104.020.06', weaponSystem: 'Mg51', combinationName: null, shotsInside: 5000, shotsOutside: 0, estimated: true, year: null, remark: 'geschätzt' },
];
export const A7: OperatingA7RowDto[] = [
  { roomId: 'r-a', sourceId: 'A1_Stgw90', plantPartNo: '1104.020.01', weaponSystem: 'Stgw90', category: 'a', halfDaysWork: 40, halfDaysSunday: 2, shotsWork: 18000, shotsSunday: 500, estimated: false, year: 2025, remark: null },
];

export function details(stateSummary: StateSummaryDto = INITIAL): StateDetailsDto {
  return { state: stateSummary, rooms: [ROOM_EMPTY, ROOM_A, ROOM_B], wlr: WLR, a9: A9, a7: A7 };
}

// --- 5.20 Schusszahlen ------------------------------------------------------------

export const YEARS: ShotYearDto[] = [
  { year: 2026, usageCount: 75, shots: 412500, importedCount: 60 },
  { year: 2025, usageCount: 12, shots: 80000, importedCount: 0 },
];

// --- 5.19 Berechnungsdatei ---------------------------------------------------------

/** A minimal Berechnungsdatei as the FME workbench writes it (one Anlageteil on «Stellungsrm B 2»). */
export function stateFile(overrides: Partial<StateImportDto> = {}): StateImportDto {
  return {
    calculation: { name: 'Lieferung 2027', supplier: 'Büro Neu', deliveredAt: '2027-01-15', description: null },
    state: { externalId: '1104.020_9', name: 'Zustand Datei', referenceYear: 2027 },
    plantParts: [{ coordinationSectionNo: 'F.01', name: 'Anlageteil Datei', type: 'Schiessanlage (300m)', builtAfter1985: true, roomName: 'Stellungsrm B 2' }],
    sources: [{ sourceId: 'Q_F_1', plantPartNo: 'F.01', weaponSystem: 'Stgw90', a9: { shotsInside: 1000, shotsOutside: 100, year: 2026 } }],
    immissionPoints: [{ sonarmsId: 'H1', code: 'H1', address: 'Testweg 1', sensitivityLevel: 'II', mapX: 10, mapY: 10 }],
    wlr: [
      { point: 'H1', source: 'Q_F_1', timeGroup: 'day', lae: 60, lafmax: 70 },
      { point: 'H1', source: 'Q_F_1', timeGroup: 'eve', lae: 55, lafmax: 65 },
    ],
    ...overrides,
  } as StateImportDto;
}

export function uploadResult(overrides: Partial<UploadResultDto> = {}): UploadResultDto {
  return { rows: 2, applied: 2, replaced: 0, unknown: [], errors: [], warnings: [], ...overrides };
}

// --- Stubs ---------------------------------------------------------------------------

/** `DataCalculationsFacade` as the pages see it; every call resolves and can be asserted. */
export class CalcFacadeStub {
  readonly deliveriesSignal = signal<DeliveryDto[]>(DELIVERIES);
  readonly deliveries = this.deliveriesSignal;
  readonly states = signal(flatStates(DELIVERIES));
  readonly details = signal<StateDetailsDto | null>(null);
  readonly years = signal<ShotYearDto[]>(YEARS);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly importFindings = signal<string[]>([]);

  readonly load = jest.fn(async () => undefined);
  readonly loadDetails = jest.fn(async (_areaId: string, stateId: string) => {
    const s = this.states().find((x) => x.id === stateId);
    this.details.set(s ? details(s) : null);
  });
  readonly loadYears = jest.fn(async () => undefined);
  readonly createDelivery = jest.fn(async (_a: string, body: { name: string; supplier?: string; deliveredAt: string }) => delivery({ id: 'd-new', name: body.name, supplier: body.supplier ?? '', deliveredAt: body.deliveredAt }));
  readonly updateDelivery = jest.fn(async (_a: string, id: string, body: Partial<DeliveryDto>) => ({ ...(DELIVERIES.find((d) => d.id === id) as DeliveryDto), ...body }));
  readonly deleteDelivery = jest.fn(async () => true);
  readonly createState = jest.fn(async (_a: string, body: { name: string; referenceYear: number }) => state({ id: 's-new', name: body.name, referenceYear: body.referenceYear, externalId: '1104.020_4', hasModel: false }));
  readonly updateState = jest.fn(async (_a: string, id: string, body: Partial<StateSummaryDto>) => ({ ...(this.states().find((s) => s.id === id) as StateSummaryDto), ...body }));
  readonly setPointer = jest.fn(async (_a: string, id: string) => this.states().find((s) => s.id === id) ?? null);
  readonly validateImport = jest.fn(async () => ({ valid: true, findings: [], warnings: ['Waffe «Pist75» ohne Kombination'], counts: { plantParts: 1, sources: 1, points: 1, wlr: 2 } }));
  readonly importFile = jest.fn(async () => ({ calculationId: 'd-new', stateId: 's-imported', counts: { plantParts: 1, sources: 1, points: 1, wlr: 2 }, warnings: [] }));
  readonly uploadWlr = jest.fn(async () => uploadResult());
  readonly uploadOperatingData = jest.fn(async () => uploadResult({ rows: 3, applied: 2, unknown: ['Q_NIX'] }));
  readonly exportStates = jest.fn(async () => new Blob(['{}'], { type: 'application/json' }));
  readonly exportShots = jest.fn(async () => new Blob(['a;b'], { type: 'text/csv' }));
  readonly clearError = jest.fn();

  /** Replace the deliveries and the derived flat list (as a reload would). */
  setDeliveries(deliveries: DeliveryDto[]): void {
    this.deliveriesSignal.set(deliveries);
    this.states.set(flatStates(deliveries));
  }
}

export class AccessStub {
  readonly write = signal(true);
  readonly loaded = signal(true);
  canWrite = () => this.write;
  can = () => signal(true);
  load = jest.fn(async () => undefined);
}

/** `TranslateService` stub: keys come back as keys (the specs assert on keys). */
export const TRANSLATE_STUB = {
  translate: (key: string) => (key === 'common.yes' ? 'Ja' : key === 'common.no' ? 'Nein' : key),
  lang: 'de',
  sectionChanged$: of(null),
  languageChanged$: of(null),
};

/** The route of a page inside `area/:areaId/calculations/…` (the area id sits on the parent). */
export function routeStub(query: Record<string, string> = {}) {
  return {
    paramMap: of(convertToParamMap({ areaId: 'area-1' })),
    queryParamMap: of(convertToParamMap(query)),
    snapshot: { paramMap: convertToParamMap({ areaId: 'area-1' }), queryParamMap: convertToParamMap(query), data: {} },
    data: of({}),
    parent: null,
  };
}
