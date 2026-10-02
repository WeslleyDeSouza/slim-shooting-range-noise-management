import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DataEmitter } from '@app-galaxy/sdk-ui';
import { TranslateService } from '@app-galaxy/translate-ui';
import type { AreaGeneralDto, AreaRoomDto } from '@ui-slim/apiClient';
import { AccessFacade } from '../../../../../../core/access/access.facade';
import { DataAreaFacade } from '../../../../../../core/data-area/data-area.facade';
import { DmAreaGeneralOverviewComponent, highlight } from './dm-area-general-overview.component';
import { SelectionListsFacade } from '../../../../../../core/settings/selection-lists.facade';
import { fakeSelectionLists } from '../../../../../../core/settings/selection-lists.testing';
import { TableExportData } from '../../../../../../core/table/table-export';
import { TableExportFacade } from '../../../../../../core/table/table-export.facade';

function room(no: string | null, name: string, enabled = true, sortOrder = 0): AreaRoomDto {
  return { id: `room-${name}`, coordinationSectionNo: no, name, groupName: null, sortOrder, enabled };
}

/** Geissalp as B1 Abbildung 26 shows it: rooms with and without a number, one inactive. */
const ROOMS: AreaRoomDto[] = [
  room('1104.020.01', 'Zielrm / Stellungsrm Fendershuus, A 1 links'),
  room('1104.020.06', 'Stellungsrm B 2', true, 1),
  room('1104.020.07', 'Stellungsrm C 2', false, 2),
  room(null, 'Stellungsrm Mw Schönenboden, D', true, 3),
  room(null, 'NGST Schönenboden D oben', false, 4),
];

function general(overrides: Partial<AreaGeneralDto['area']> = {}): AreaGeneralDto {
  return {
    area: {
      id: 'area-1',
      name: 'Geissalp',
      coordinationSectionNo: '1104.020',
      sectoralPlanNo: null,
      quotaStatus: 'ok',
      noiseStatus: 'ok',
      quotaStatusReason: null,
      noiseStatusReason: null,
      noiseStatusBasis: null,
      statusYear: 2026,
      annex7Overall: false,
      enabled: true,
      classification: 'unproblematic',
      recalculationState: 'in_progress',
      remediationProjectState: 'concept',
      spmState: 'completed',
      noiseRemediationState: 'reassessment_needed',
      projectState: null,
      planningApproval: 'Militärische Plangenehmigung vom 13.02.2023',
      ...overrides,
    },
    buildYearClass: 'mixed',
    currentStateName: 'Initiale Aufnahme',
    rooms: ROOMS,
    quotas: [],
    combinations: [],
  };
}

class FacadeStub {
  readonly general = signal<AreaGeneralDto | null>(general());
  readonly area = signal(general().area);
  readonly rooms = signal<AreaRoomDto[]>(ROOMS);
  readonly loading = signal(false);
  readonly load = jest.fn(async () => undefined);
}

class AccessStub {
  readonly write = signal(true);
  readonly loaded = signal(true);
  canWrite = () => this.write;
  can = () => signal(true);
  load = jest.fn(async () => undefined);
}

describe('DmAreaGeneralOverviewComponent (5.15)', () => {
  let fixture: ComponentFixture<DmAreaGeneralOverviewComponent>;
  let facade: FacadeStub;
  /** What the export button hands to the API. */
  const exportFacade = { download: jest.fn().mockResolvedValue(true) };
  let access: AccessStub;

  beforeEach(async () => {
    facade = new FacadeStub();
    access = new AccessStub();
    await TestBed.configureTestingModule({
      imports: [DmAreaGeneralOverviewComponent],
      providers: [
        provideRouter([]),
        { provide: DataAreaFacade, useValue: facade },
        { provide: TableExportFacade, useValue: exportFacade },
        { provide: AccessFacade, useValue: access },
        { provide: SelectionListsFacade, useValue: fakeSelectionLists() },
        DataEmitter,
        {
          provide: TranslateService,
          useValue: {
            translate: (key: string) => (key === 'common.yes' ? 'Ja' : key === 'common.no' ? 'Nein' : key),
            sectionChanged$: of(null),
            languageChanged$: of(null),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ areaId: 'area-1' })),
            snapshot: { paramMap: convertToParamMap({ areaId: 'area-1' }), data: {} },
            data: of({}),
            parent: null,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DmAreaGeneralOverviewComponent);
    fixture.detectChanges();
  });

  const el = <T extends Element = HTMLElement>(selector: string): T => fixture.nativeElement.querySelector(selector) as T;
  const all = (selector: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(selector));
  /** Cells of a row: 0 = box of the multi-selection, 1 = number, 2 = name. */
  const rowNames = () => all('[data-testid="dmo-room-row"]').map((r) => r.querySelectorAll('td')[2].textContent?.trim().split('\n')[0].trim());

  it('shows the Detailansicht of the Schiessplatz with every field of B1 Abbildung 26', () => {
    expect(el('[data-testid="dmo-name"]').textContent).toContain('Geissalp');
    expect(el('[data-testid="dmo-field-coordination_no"]').textContent).toContain('1104.020');
    // No Sachplan-Nr. → «nicht im Sachplan Militär», never an empty cell.
    expect(el('[data-testid="dmo-field-sectoral_plan_no"]').textContent).toContain('not_in_sectoral_plan');
    expect(el('[data-testid="dmo-field-classification"]').textContent).toContain('unproblematic (DE)'); // label of the Auswahlliste (slm 1)
    // Baujahr comes from the current calculation state, read-only.
    expect(el('[data-testid="dmo-field-build_year"]').textContent).toContain('options.build_year.mixed');
    expect(el('[data-testid="dmo-field-spm_state"]').textContent).toContain('completed (DE)');
    // A state that is not maintained yet says so instead of showing nothing.
    expect(el('[data-testid="dmo-field-project_state"]').textContent).toContain('not_set');
    expect(el('[data-testid="dmo-active-badge"]').textContent).toContain('active');
  });

  it('lists the Stellungsräume by number with the rooms without a number last and the count of them (slm 15)', () => {
    expect(all('[data-testid="dmo-room-row"]')).toHaveLength(5);
    const names = rowNames();
    expect(names[0]).toBe('Zielrm / Stellungsrm Fendershuus, A 1 links');
    expect(names.slice(-2)).toEqual(['Stellungsrm Mw Schönenboden, D', 'NGST Schönenboden D oben']);
    expect(el('[data-testid="dmo-rooms-count"]').textContent).toContain('rooms_count');
    expect(el('[data-testid="dmo-rooms-foot"]').textContent).toContain('rooms_without_number');
    // Rooms without a Koordinationsabschnitts-Nr. show a dash, not an empty cell (B1 5.15 hint).
    const withoutNo = all('[data-testid="dmo-room-row"][data-room-no=""]');
    expect(withoutNo).toHaveLength(2);
    expect(withoutNo[0].querySelectorAll('td')[1].textContent?.trim()).toBe('—');
  });

  it('filters the table by free text over number, name and Aktiv (slm 15)', () => {
    const input = el<HTMLInputElement>('[data-testid="dmo-rooms-search"]');
    input.value = 'schönenboden';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(all('[data-testid="dmo-room-row"]')).toHaveLength(2);
    expect(all('mark.dmo__mark').some((m) => m.textContent === 'Schönenboden')).toBe(true);

    input.value = '1104.020.06';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(rowNames()).toEqual(['Stellungsrm B 2']);

    // The Aktiv column is searchable by its label.
    input.value = 'nein';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(rowNames()).toEqual(['Stellungsrm C 2', 'NGST Schönenboden D oben']);

    input.value = 'gibt es nicht';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(all('[data-testid="dmo-room-row"]')).toHaveLength(0);
    expect(el('.slim-empty__text').textContent).toContain('rooms_no_match');
  });

  it('sorts by name and toggles the direction of the number column, rooms without a number stay last', () => {
    const headers = all('th button.dmo__sort');
    headers[1].click(); // Bezeichnung ascending
    fixture.detectChanges();
    expect(rowNames()[0]).toBe('NGST Schönenboden D oben');
    headers[0].click(); // Koordinationsabschnitts-Nr. ascending again
    fixture.detectChanges();
    expect(rowNames()[0]).toBe('Zielrm / Stellungsrm Fendershuus, A 1 links');
    headers[0].click(); // descending
    fixture.detectChanges();
    expect(rowNames()[0]).toBe('Stellungsrm C 2');
    expect(rowNames().slice(-2)).toEqual(['Stellungsrm Mw Schönenboden, D', 'NGST Schönenboden D oben']);
  });

  it('exports the Stellungsräume as shown, or only the marked rows (B1 5.5.3, 5.5.5)', async () => {
    const exported = async (): Promise<TableExportData> => {
      exportFacade.download.mockClear();
      el('[data-testid="dmo-export"]').click();
      fixture.detectChanges();
      el('[data-testid="dmo-export-csv"]').click();
      for (let i = 0; i < 3; i++) await Promise.resolve();
      fixture.detectChanges();
      return exportFacade.download.mock.calls[0][0] as TableExportData;
    };
    const shown = await exported();
    expect(shown.table).toBe('stellungsraeume');
    expect(shown.selection).toBe(false);
    expect(shown.rows.map((row) => row[1])).toEqual(rowNames());

    // Two rows marked with Shift from the first to the second.
    const boxes = all('[data-testid="dmo-select"]');
    boxes[0].click();
    boxes[1].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    fixture.detectChanges();
    const marked = await exported();
    expect(marked.selection).toBe(true);
    expect(marked.rows.map((row) => row[1])).toEqual(rowNames().slice(0, 2));
  });

  it('offers «Stammdaten bearbeiten» with the write right and «anzeigen» without', () => {
    expect(el('[data-testid="dmo-edit"]').textContent).toContain('edit_master_data');
    access.write.set(false);
    fixture.detectChanges();
    expect(el('[data-testid="dmo-edit"]').textContent).toContain('show_master_data');
    expect(el<HTMLAnchorElement>('[data-testid="dmo-edit"]').getAttribute('href')).toBe('/admin/data-management/area/area-1/general/master-data');
  });

  it('splits a search hit for highlighting without innerHTML', () => {
    expect(highlight('Stellungsrm B 2', 'b 2')).toEqual({ pre: 'Stellungsrm ', match: 'B 2', post: '' });
    expect(highlight('Stellungsrm B 2', '')).toEqual({ pre: 'Stellungsrm B 2', match: '', post: '' });
    expect(highlight('Stellungsrm B 2', 'xyz')).toEqual({ pre: 'Stellungsrm B 2', match: '', post: '' });
  });
});
