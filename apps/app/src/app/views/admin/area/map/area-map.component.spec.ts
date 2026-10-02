import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DataEmitter } from '@app-galaxy/sdk-ui';
import { TranslateService } from '@app-galaxy/translate-ui';
import type { AssessmentDto, MapPlantPartDto, ReceiverAssessmentDto } from '@ui-slim/apiClient';
import { FakeMap, provideFakeMap } from '@ui-slim/map';
import { AreaFacade } from '../../../../core/area/area.facade';
import { AssessmentFacade } from '../../../../core/calculation/assessment.facade';
import { MapFacade } from '../../../../core/calculation/map.facade';
import { AreaMapComponent } from './area-map.component';

const CALCULATION = { id: 'calc-saniert', name: 'Sanierter Zustand' };

function receiver(code: string, state: ReceiverAssessmentDto['state'], east: number | null, north: number | null): ReceiverAssessmentDto {
  return {
    id: `id-${code}`,
    code,
    address: `${code} Strasse 1`,
    sensitivityLevel: 'II',
    east,
    north,
    state,
    rows: [
      { annex: 9, limitKind: 'igw', limit: 60, applicable: true, level: 60.8, state: 'over', reserve: -0.8, deltaToCurrent: null },
      { annex: 9, limitKind: 'pw', limit: 55, applicable: false, level: null, state: 'none', reserve: null, deltaToCurrent: null },
    ],
  } as unknown as ReceiverAssessmentDto;
}

const RECEIVERS = [receiver('E1', 'over', 2618180, 1176916), receiver('E2', 'ok', 2618836, 1176894)];

class AssessmentStub {
  readonly assessment = signal<AssessmentDto | null>({ calculation: CALCULATION } as unknown as AssessmentDto);
  readonly receivers = signal<ReceiverAssessmentDto[]>(RECEIVERS);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly load = jest.fn(async () => undefined);
}

class MapStub {
  readonly plantParts = signal<MapPlantPartDto[]>([]);
  readonly load = jest.fn(async () => undefined);
}

describe('AreaMapComponent — Vollansicht der Karte (slm 2, B1 5.10)', () => {
  let fixture: ComponentFixture<AreaMapComponent>;
  let facade: AssessmentStub;
  let maps: MapStub;
  let fakeMap: FakeMap;

  async function setup(query: Record<string, string> = { state: 'calc-saniert' }): Promise<void> {
    facade = new AssessmentStub();
    maps = new MapStub();
    fakeMap = provideFakeMap();
    const paramMap = convertToParamMap({ id: 'area-1' });
    const queryParamMap = convertToParamMap(query);
    await TestBed.configureTestingModule({
      imports: [AreaMapComponent],
      providers: [
        provideRouter([]),
        { provide: AssessmentFacade, useValue: facade },
        { provide: MapFacade, useValue: maps },
        { provide: AreaFacade, useValue: { byId: () => ({ id: 'area-1', name: 'Geissalp', coordinationSectionNo: '1104.020' }) } },
        ...fakeMap.providers,
        DataEmitter,
        { provide: TranslateService, useValue: { translate: (key: string) => key, sectionChanged$: of(null), languageChanged$: of(null) } },
        {
          provide: ActivatedRoute,
          useValue: {
            parent: { paramMap: of(paramMap), snapshot: { paramMap } },
            queryParamMap: of(queryParamMap),
            snapshot: { queryParamMap },
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AreaMapComponent);
    await settle();
    // ComponentBase schedules getData() shortly after init.
    await new Promise((resolve) => setTimeout(resolve, 30));
    await settle();
  }

  async function settle(): Promise<void> {
    for (let i = 0; i < 4; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  }

  const el = <T extends Element = HTMLElement>(testId: string): T => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as T;
  const all = (testId: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(`[data-testid="${testId}"]`));

  it('loads the assessment of the state of the link and the Anlagenteile of that state', async () => {
    await setup();
    expect(facade.load).toHaveBeenCalledWith('area-1', { calculationId: 'calc-saniert' });
    expect(maps.load).toHaveBeenCalledWith('area-1', 'calc-saniert');
    expect(el('amap-state').textContent).toContain('map_page.state');
  });

  it('opens on the current state when the link names none', async () => {
    await setup({});
    expect(facade.load).toHaveBeenCalledWith('area-1', {});
  });

  it('shows the Empfangspunkte on the map and the assessment of the chosen one next to it', async () => {
    await setup();
    expect(all('amap-pin').map((p) => p.textContent?.trim())).toEqual(['E1', 'E2']);
    expect(fakeMap.engine?.pins.map((p) => [p.east, p.north])).toEqual([
      [2618180, 1176916],
      [2618836, 1176894],
    ]);
    expect(el('amap-info').textContent).toContain('map_page.select_hint');

    all('amap-pin')[0].click();
    await settle();
    expect(el('amap-info').textContent).toContain('E1 Strasse 1');
    // Only the applicable limits are listed.
    const rows = all('amap-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('60 dB');
    expect(rows[0].textContent).toContain('60.8 dB');
  });

  it('links back to the Details of the Schiessplatz', async () => {
    await setup();
    expect(el<HTMLAnchorElement>('amap-back').getAttribute('href')).toBe('/admin/area/area-1/details');
  });

  it('says so when the state has no coordinates to show', async () => {
    await setup();
    facade.receivers.set([receiver('E1', 'over', null, null)]);
    await settle();
    expect(el('amap-map')).toBeNull();
    expect(el('amap-empty').textContent).toContain('map_page.no_data');
  });
});
