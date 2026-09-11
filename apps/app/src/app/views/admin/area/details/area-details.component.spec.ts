import { signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { DataEmitter } from '@app-galaxy/sdk-ui';
import { TranslateService } from '@app-galaxy/translate-ui';
import type { AssessmentDto, ReceiverAssessmentDto } from '@ui-slim/apiClient';
import { AssessmentFacade } from '../../../../core/calculation/assessment.facade';
import { AreaDetailsComponent } from './area-details.component';

const CALC_INITIAL = {
  id: 'calc-initial',
  name: 'Initiale Aufnahme',
  supplier: 'Empa',
  deliveredAt: '2019-05-08',
  referenceYear: 2019,
  buildYearClass: 'mixed' as const,
  isCurrent: true,
  isMgdm: true,
  sourceCount: 16,
};
const CALC_SANITISED = { ...CALC_INITIAL, id: 'calc-saniert', name: 'Sanierter Zustand', deliveredAt: '2025-03-25', isCurrent: false, isMgdm: false };

function receiver(
  code: string,
  state: ReceiverAssessmentDto['state'],
  levels: [number | null, number | null, number | null, number | null],
  type: ReceiverAssessmentDto['type'] = 'facade',
): ReceiverAssessmentDto {
  const kinds = [
    [9, 'igw', 60],
    [9, 'pw', 55],
    [7, 'igw', 60],
    [7, 'pw', 55],
  ] as const;
  return {
    id: `id-${code}`,
    code,
    egid: type === 'facade' ? '123' : null,
    address: `${code} Strasse 1`,
    municipality: 'Sigriswil',
    type,
    sensitivityLevel: 'II',
    east: null,
    north: null,
    mapX: 30,
    mapY: 40,
    state,
    rows: kinds.map(([annex, limitKind, limit], i) => ({
      annex,
      limitKind,
      limit,
      applicable: true,
      level: levels[i],
      state: levels[i] === null ? 'none' : levels[i] > limit ? 'over' : levels[i] > limit - 5 ? 'warn' : 'ok',
      reserve: levels[i] === null ? null : Math.round((limit - levels[i]) * 10) / 10,
      deltaToCurrent: null,
    })),
  };
}

const RECEIVERS = [
  receiver('E1', 'over', [60.8, 52.1, 49.1, null]),
  receiver('E2', 'ok', [54.2, 48.0, 44.0, null]),
  receiver('E6', 'none', [null, null, null, null], 'reserve'),
];

function assessment(overrides: Partial<AssessmentDto> = {}): AssessmentDto {
  return {
    areaId: 'area-1',
    calculation: CALC_INITIAL,
    current: CALC_INITIAL,
    calculations: [CALC_INITIAL, CALC_SANITISED],
    period: { from: '2026-01-01', to: '2026-12-31', years: 1 },
    counts: { total: 3, ok: 1, warn: 0, over: 1, none: 1 },
    receivers: RECEIVERS,
    operatingData: [],
    calculatedAt: '2026-09-11T10:00:00.000Z',
    ...overrides,
  };
}

class FacadeStub {
  readonly assessment = signal<AssessmentDto | null>(assessment());
  readonly receivers = signal<ReceiverAssessmentDto[]>(RECEIVERS);
  readonly calculations = signal(assessment().calculations);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly load = jest.fn(async () => undefined);
  readonly select = jest.fn(async () => undefined);
}

describe('AreaDetailsComponent', () => {
  let fixture: ComponentFixture<AreaDetailsComponent>;
  let facade: FacadeStub;

  beforeEach(async () => {
    facade = new FacadeStub();
    await TestBed.configureTestingModule({
      imports: [AreaDetailsComponent],
      providers: [
        { provide: AssessmentFacade, useValue: facade },
        DataEmitter,
        {
          provide: TranslateService,
          useValue: {
            translate: (key: string) => key,
            sectionChanged$: of(null),
            languageChanged$: of(null),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            parent: {
              paramMap: of(convertToParamMap({ id: 'area-1' })),
              snapshot: { paramMap: convertToParamMap({ id: 'area-1' }) },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AreaDetailsComponent);
    fixture.detectChanges();
  });

  const el = <T extends Element = HTMLElement>(selector: string): T =>
    fixture.nativeElement.querySelector(selector) as T;
  const all = (selector: string): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll(selector));

  it('loads the assessment of the parent route area once', fakeAsync(() => {
    tick(20); // ComponentBase calls getData() after 10 ms
    expect(facade.load).toHaveBeenCalledTimes(1);
    expect(facade.load).toHaveBeenCalledWith('area-1', {});
  }));

  it('renders the counts and one pin per receiver', () => {
    const counts = all('[data-testid="details-counts"] .slim-stat__value').map((e) => e.textContent?.trim());
    expect(counts).toEqual(['3', '1', '0', '1', '1']);
    const pins = all('[data-testid="details-pin"]');
    expect(pins).toHaveLength(3);
    expect(pins[0].className).toContain('slim-map__pin--over');
    expect(pins[0].className).toContain('slim-map__pin--active'); // first receiver preselected
    expect(pins[2].className).toContain('slim-map__pin--none');
  });

  it('shows the selected receiver in the aside and switches on pin click', () => {
    // The translate stub returns the key, so read the code from the pin badge.
    expect(el('[data-testid="details-aside"] .details__pin').textContent).toContain('E1');
    expect(all('[data-testid="details-row"]')).toHaveLength(4);
    expect(all('[data-testid="details-row"]')[0].textContent).toContain('60.8');

    all('[data-testid="details-pin"]')[1].click();
    fixture.detectChanges();
    expect(el('[data-testid="details-aside"] .details__pin').textContent).toContain('E2');
    expect(all('[data-testid="details-row"]')[0].textContent).toContain('54.2');
    expect(all('[data-testid="details-pin"]')[1].className).toContain('slim-map__pin--active');
  });

  it('marks not applicable rows for a reserve point', () => {
    all('[data-testid="details-pin"]')[2].click();
    fixture.detectChanges();
    const rows = all('[data-testid="details-row"]');
    expect(rows.every((r) => r.textContent?.includes('details.not_applicable'))).toBe(true);
    expect(el('[data-testid="details-aside"]').textContent).toContain('details.receiver.egid_none');
  });

  it('toggles between map and list, list sorted worst first', () => {
    el<HTMLButtonElement>('[data-testid="details-list-toggle"]').click();
    fixture.detectChanges();
    expect(el('[data-testid="details-map"]')).toBeNull();
    const items = all('[data-testid="details-list-item"]');
    expect(items.map((i) => i.dataset['code'])).toEqual(['E1', 'E2', 'E6']);
    expect(items[0].dataset['state']).toBe('over');

    items[1].click();
    fixture.detectChanges();
    expect(el('[data-testid="details-aside"] .details__pin').textContent).toContain('E2');

    el<HTMLButtonElement>('[data-testid="details-map-toggle"]').click();
    fixture.detectChanges();
    expect(el('[data-testid="details-map"]')).not.toBeNull();
  });

  it('reloads with the chosen calculation state', fakeAsync(() => {
    tick(20);
    facade.load.mockClear();
    const select = el<HTMLSelectElement>('[data-testid="details-calc-select"]');
    select.value = CALC_SANITISED.id;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(facade.load).toHaveBeenCalledWith('area-1', { calculationId: CALC_SANITISED.id });
  }));

  it('shows the delta and the note when another state is viewed', () => {
    const other = assessment({
      calculation: CALC_SANITISED,
      receivers: RECEIVERS.map((r) => ({
        ...r,
        rows: r.rows.map((row) => ({ ...row, deltaToCurrent: row.level === null ? null : -4.4 })),
      })),
    });
    facade.assessment.set(other);
    facade.receivers.set(other.receivers);
    fixture.detectChanges();
    expect(el('.details__note').className).toContain('details__note--other');
    expect(all('[data-testid="details-delta"]').length).toBeGreaterThan(0);
    expect(all('[data-testid="details-delta"]')[0].textContent).toContain('-4.4');
    // The selection survived the reload.
    expect(el('[data-testid="details-aside"] .details__pin').textContent).toContain('E1');
  });

  it('explains a missing calculation basis', () => {
    facade.assessment.set(assessment({ calculation: null, current: null, calculations: [], receivers: [] }));
    facade.receivers.set([]);
    fixture.detectChanges();
    expect(el('[data-testid="details-map"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('details.no_calculation.text');
  });
});
