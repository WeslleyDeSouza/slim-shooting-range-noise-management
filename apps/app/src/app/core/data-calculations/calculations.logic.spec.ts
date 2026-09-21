import type { DeliveryDto, OperatingA7RowDto, OperatingA9RowDto, RoomSummaryDto, StateSummaryDto, WlrRowDto } from '@ui-slim/apiClient';
import {
  annexFromFileName,
  checkStateFile,
  deliveryDeleteBlocker,
  detailTabCounts,
  downloadName,
  filterDeliveries,
  filterRooms,
  initialRoom,
  pointerClickAllowed,
  roomDetailRows,
  sortDeliveries,
  timeGroupFromFileName,
  toggleSelection,
} from './calculations.logic';

function state(overrides: Partial<StateSummaryDto> = {}): StateSummaryDto {
  return {
    id: 's', externalId: '02218_1', name: 'Initial', referenceYear: 2019, buildYearClass: 'mixed', isCurrent: false, isMgdm: false,
    sourceCount: 17, pointCount: 6, wlrCount: 170, plantPartCount: 14, runCount: 0, hasModel: true, ...overrides,
  };
}

function delivery(overrides: Partial<DeliveryDto> = {}): DeliveryDto {
  return {
    id: 'd', name: 'Lärmsanierung Geissalp', supplier: 'Empa', deliveredAt: '2025-03-25', description: null, fileName: 'geissalp.gdb',
    stateCount: 1, hasCurrent: false, hasMgdm: false, states: [state()], createdAt: '', updatedAt: '', ...overrides,
  };
}

describe('calculations.logic (B1 5.18–5.21)', () => {
  describe('pointerClickAllowed (5.18: genau ein aktueller / MGDM-Zustand)', () => {
    it('allows choosing a state that is not yet the pointer, never unchecking the current one', () => {
      expect(pointerClickAllowed(state({ isCurrent: false }), 'current')).toBe(true);
      expect(pointerClickAllowed(state({ isCurrent: true }), 'current')).toBe(false);
      expect(pointerClickAllowed(state({ isMgdm: false }), 'mgdm')).toBe(true);
      expect(pointerClickAllowed(state({ isMgdm: true }), 'mgdm')).toBe(false);
    });

    it('refuses an empty state (5.20) — it has no model to assess with', () => {
      expect(pointerClickAllowed(state({ hasModel: false }), 'current')).toBe(false);
      expect(pointerClickAllowed(state({ hasModel: false }), 'mgdm')).toBe(false);
    });
  });

  describe('deliveryDeleteBlocker', () => {
    it('names the rule that blocks a delete, in the order the API checks', () => {
      expect(deliveryDeleteBlocker(delivery({ states: [state({ isCurrent: true, isMgdm: true })] }))).toBe('current');
      expect(deliveryDeleteBlocker(delivery({ states: [state({ isMgdm: true })] }))).toBe('mgdm');
      expect(deliveryDeleteBlocker(delivery({ states: [state({ runCount: 2 })] }))).toBe('runs');
      expect(deliveryDeleteBlocker(delivery({ states: [state(), state({ id: 't' })] }))).toBeNull();
      expect(deliveryDeleteBlocker(delivery({ states: [] }))).toBeNull();
    });
  });

  describe('sortDeliveries / filterDeliveries', () => {
    const a = delivery({ id: 'a', name: 'Alt', deliveredAt: '2019-05-08', supplier: 'Muster-Ingenieure' });
    const b = delivery({ id: 'b', name: 'Neu', deliveredAt: '2025-03-25', supplier: 'Ingenieurbüro XY', states: [state({ name: 'Sanierter Zustand', externalId: '02218_2' })] });

    it('shows the newest delivery first', () => {
      expect(sortDeliveries([a, b]).map((d) => d.id)).toEqual(['b', 'a']);
    });

    it('searches Bezeichnung, Lieferantin, Datei and the states', () => {
      expect(filterDeliveries([a, b], 'muster').map((d) => d.id)).toEqual(['a']);
      expect(filterDeliveries([a, b], 'sanierter').map((d) => d.id)).toEqual(['b']);
      expect(filterDeliveries([a, b], '02218_2').map((d) => d.id)).toEqual(['b']);
      expect(filterDeliveries([a, b], 'gdb').map((d) => d.id)).toEqual(['a', 'b']);
      expect(filterDeliveries([a, b], '  ')).toEqual([a, b]);
      expect(filterDeliveries([a, b], 'nichts')).toEqual([]);
    });
  });

  describe('roomDetailRows / detailTabCounts / filterRooms / initialRoom (5.21)', () => {
    const wlr = (roomId: string, timeGroup: 'day' | 'eve', point: string): WlrRowDto => ({
      roomId, plantPartNo: 'x', point, egid: null, sourceId: 'Q', weaponSystem: 'Stgw90', timeGroup, elevation: null, laeMk: null, laeGk: null, laeDet: null, lae: 60, lafmax: 70,
    });
    const a9 = (roomId: string): OperatingA9RowDto => ({ roomId, plantPartNo: 'x', sourceId: 'Q', weaponSystem: 'Stgw90', combinationName: null, shotsInside: 1, shotsOutside: 0, estimated: false, year: null, remark: null });
    const a7 = (roomId: string): OperatingA7RowDto => ({ roomId, plantPartNo: 'x', sourceId: 'Q', weaponSystem: 'Stgw90', category: 'a', halfDaysWork: 1, halfDaysSunday: 0, shotsWork: 1, shotsSunday: null, estimated: false, year: null, remark: null });
    const details = {
      wlr: [wlr('r1', 'day', 'E1'), wlr('r1', 'eve', 'E1'), wlr('r2', 'day', 'E2')],
      a9: [a9('r1'), a9('r2')],
      a7: [a7('r2')],
    };

    it('splits the rows of one room into the four tabs', () => {
      const rows = roomDetailRows(details, 'r1');
      expect(rows.wlrDay.map((w) => w.point)).toEqual(['E1']);
      expect(rows.wlrNight.map((w) => w.point)).toEqual(['E1']);
      expect(rows.a9).toHaveLength(1);
      expect(rows.a7).toHaveLength(0);
      expect(detailTabCounts(rows)).toEqual({ wlr_day: 1, wlr_night: 1, a9: 1, a7: 0 });
    });

    it('returns every row of the state when no room is chosen', () => {
      expect(detailTabCounts(roomDetailRows(details, null))).toEqual({ wlr_day: 2, wlr_night: 1, a9: 2, a7: 1 });
    });

    const rooms: RoomSummaryDto[] = [
      { id: 'r0', coordinationSectionNo: '1104.020.01', name: 'Zielrm A 1', plantPartCount: 1, sourceCount: 0, wlrCount: 0 },
      { id: 'r1', coordinationSectionNo: '1104.020.06', name: 'Stellungsrm B 2', plantPartCount: 1, sourceCount: 2, wlrCount: 20 },
      { id: 'r2', coordinationSectionNo: null, name: 'NGST oben', plantPartCount: 0, sourceCount: 0, wlrCount: 0 },
    ];

    it('opens with the first room that has sources and searches by number or name', () => {
      expect(initialRoom(rooms)?.id).toBe('r1');
      expect(initialRoom([rooms[0]])?.id).toBe('r0');
      expect(initialRoom([])).toBeNull();
      expect(filterRooms(rooms, '020.06').map((r) => r.id)).toEqual(['r1']);
      expect(filterRooms(rooms, 'ngst').map((r) => r.id)).toEqual(['r2']);
      expect(filterRooms(rooms, '')).toHaveLength(3);
    });
  });

  describe('checkStateFile (5.19 Berechnungsdatei)', () => {
    const good = {
      calculation: { name: 'Lieferung', supplier: 'Büro', deliveredAt: '2026-09-19' },
      state: { name: 'Zustand', referenceYear: 2026, externalId: '02218_3' },
      plantParts: [{ coordinationSectionNo: '1104.020.01', name: 'A1', builtAfter1985: false }],
      sources: [{ sourceId: 'Q1', plantPartNo: '1104.020.01', weaponSystem: 'Stgw90' }],
      immissionPoints: [{ sonarmsId: 'E1', address: 'x', sensitivityLevel: 'II' }],
      wlr: [{ point: 'E1', source: 'Q1', timeGroup: 'day', lae: 60, lafmax: 70 }, { point: 'E1', source: 'Q1', timeGroup: 'eve', lae: 55, lafmax: 65 }],
    };

    it('accepts a StateImportDto and summarises it for the mask', () => {
      const check = checkStateFile(JSON.stringify(good));
      expect(check.ok).toBe(true);
      expect(check.summary).toEqual({
        deliveryName: 'Lieferung', supplier: 'Büro', deliveredAt: '2026-09-19', stateName: 'Zustand', externalId: '02218_3', referenceYear: 2026,
        plantParts: 1, sources: 1, immissionPoints: 1, wlr: 2, wlrDay: 1, wlrNight: 1,
      });
      expect(check.state?.calculation.name).toBe('Lieferung');
    });

    it('accepts an export bundle of SLIM with exactly one state, refuses several', () => {
      const one = checkStateFile(JSON.stringify({ format: 'slim-state-export', version: 1, states: [good] }));
      expect(one.ok).toBe(true);
      expect(checkStateFile(JSON.stringify({ format: 'slim-state-export', states: [good, good] })).problems).toEqual(['file.bundle_many']);
      expect(checkStateFile(JSON.stringify({ format: 'slim-state-export', states: [] })).problems).toEqual(['file.bundle_empty']);
    });

    it('names every structural problem instead of the first one', () => {
      const bad = checkStateFile(JSON.stringify({ calculation: { name: '', deliveredAt: '19.09.2026' }, state: { referenceYear: 'x' }, plantParts: [], sources: 'nope' }));
      expect(bad.ok).toBe(false);
      expect(bad.problems).toEqual([
        'file.calculation_name', 'file.delivered_at', 'file.state_name', 'file.reference_year',
        'file.sources_missing', 'file.immissionPoints_missing', 'file.wlr_missing', 'file.plant_parts_empty',
      ]);
      expect(checkStateFile('{not json').problems).toEqual(['file.not_json']);
      expect(checkStateFile('[1,2]').problems).toEqual(['file.not_object']);
    });
  });

  describe('file name hints (5.19 WLR / Betriebsdaten)', () => {
    it('reads the time group and the annex from the file name', () => {
      expect(timeGroupFromFileName('day.wlr')).toBe('day');
      expect(timeGroupFromFileName('SPM_11040.20_NIGHT.WLR')).toBe('eve');
      expect(timeGroupFromFileName('eve.wlr')).toBe('eve');
      expect(timeGroupFromFileName('Geissalp_Tag.txt')).toBe('day');
      expect(timeGroupFromFileName('pegel.wlr')).toBeNull();
      expect(annexFromFileName('BetriebA9.txt')).toBe(9);
      expect(annexFromFileName('SPM_11040.20_BD7.csv')).toBe(7);
      expect(annexFromFileName('daten.csv')).toBeNull();
    });
  });

  describe('export helpers (5.20)', () => {
    it('toggles a selection and picks the download name from the header', () => {
      expect(toggleSelection(['a'], 'b')).toEqual(['a', 'b']);
      expect(toggleSelection(['a', 'b'], 'a')).toEqual(['b']);
      expect(downloadName({ get: () => 'export.json' }, 'fallback.json')).toBe('export.json');
      expect(downloadName({ get: () => '  ' }, 'fallback.json')).toBe('fallback.json');
      expect(downloadName(null, 'fallback.json')).toBe('fallback.json');
    });
  });
});
