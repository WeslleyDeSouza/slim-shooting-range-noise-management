import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { DataEmitter } from '@app-galaxy/sdk-ui';
import { TranslateService } from '@app-galaxy/translate-ui';
import { AccessFacade } from '../../../../../../core/access/access.facade';
import { DataCalculationsFacade } from '../../../../../../core/data-calculations/data-calculations.facade';
import { AccessStub, CalcFacadeStub, TRANSLATE_STUB, routeStub } from '../dm-calc.spec-data';
import { DmCalcExportComponent } from './dm-calc-export.component';

describe('DmCalcExportComponent (5.20 Export)', () => {
  let fixture: ComponentFixture<DmCalcExportComponent>;
  let facade: CalcFacadeStub;
  let access: AccessStub;
  let clicked: string[];

  beforeEach(async () => {
    facade = new CalcFacadeStub();
    access = new AccessStub();
    clicked = [];
    // jsdom has no object URLs and no navigation: record the download names instead.
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:test';
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => undefined;
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.download);
    });
    await TestBed.configureTestingModule({
      imports: [DmCalcExportComponent],
      providers: [
        provideRouter([]),
        { provide: DataCalculationsFacade, useValue: facade },
        { provide: AccessFacade, useValue: access },
        DataEmitter,
        { provide: TranslateService, useValue: TRANSLATE_STUB },
        { provide: ActivatedRoute, useValue: routeStub() },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DmCalcExportComponent);
    fixture.detectChanges();
  });

  afterEach(() => jest.restoreAllMocks());

  const el = <T extends Element = HTMLElement>(selector: string): T => fixture.nativeElement.querySelector(selector) as T;
  const all = (selector: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(selector));
  const type = (selector: string, value: string) => {
    const input = el<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const pick = (selector: string, value: string) => {
    const select = el<HTMLSelectElement>(selector);
    select.value = value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  it('loads the Schusszahlen years and lists every state of the Schiessplatz with its delivery (B1 Abbildung 31)', async () => {
    await new Promise((resolve) => setTimeout(resolve, 20)); // ComponentBase calls getData() 10 ms after init
    expect(facade.loadYears).toHaveBeenCalledWith('area-1');
    const rows = all('[data-testid="dce-state"]');
    expect(rows.map((r) => r.getAttribute('data-name'))).toEqual(['Initiale Aufnahme', 'Sanierter Zustand SPM Geissalp', 'Variante A']);
    expect(rows[0].textContent).toContain('1104.020_1');
    expect(rows[0].textContent).toContain('Büro XY');
    expect(rows[0].textContent).toContain('10.05.2023');
    expect(rows[0].textContent?.match(/Ja/g)).toHaveLength(2); // aktuell + MGDM
    expect(rows[2].textContent).toContain('state_no_model');
    expect(el<HTMLButtonElement>('[data-testid="dce-export-states"]').disabled).toBe(true);
    expect(el<HTMLButtonElement>('[data-testid="dce-export-shots"]').disabled).toBe(true);

    const years = all('[data-testid="dce-year"]');
    expect(years.map((y) => y.getAttribute('data-year'))).toEqual(['2026', '2025']);
    expect(years[0].textContent).toContain('75');
    expect(years[0].textContent).toContain('412');
  });

  it('selects states one by one or all at once and exports the selection as a JSON bundle', fakeAsync(() => {
    all('[data-testid="dce-state"]')[1].click();
    fixture.detectChanges();
    expect(el('[data-testid="dce-states-selected"]').textContent).toContain('selected_count');
    expect(all('[data-testid="dce-state"]')[1].classList).toContain('slim-table__row--selected');
    expect(el<HTMLButtonElement>('[data-testid="dce-export-states"]').disabled).toBe(false);

    el<HTMLInputElement>('[data-testid="dce-select-all"]').click();
    fixture.detectChanges();
    expect(all('.slim-table__row--selected')).toHaveLength(3);
    expect(el<HTMLInputElement>('[data-testid="dce-select-all"]').checked).toBe(true);
    // Clicking the checkbox of a row toggles it without a second toggle from the row click.
    (all('[data-testid="dce-state-check"]')[0] as HTMLInputElement).click();
    fixture.detectChanges();
    expect(all('[data-testid="dce-state"]')[0].classList).not.toContain('slim-table__row--selected');
    expect(el<HTMLInputElement>('[data-testid="dce-select-all"]').checked).toBe(false);

    el<HTMLButtonElement>('[data-testid="dce-export-states"]').click();
    tick();
    fixture.detectChanges();
    expect(facade.exportStates).toHaveBeenCalledWith('area-1', ['s-sanitised', 's-empty']);
    expect(clicked[0]).toMatch(/^berechnungszustaende_\d{4}-\d{2}-\d{2}\.json$/);
    expect(el('[data-testid="dce-toast"]').textContent).toContain('toast_exported');
    tick(6000);
  }));

  it('exports the Schusszahlen of the chosen calendar years as CSV', fakeAsync(() => {
    all('[data-testid="dce-year"]')[1].click();
    all('[data-testid="dce-year"]')[0].click();
    fixture.detectChanges();
    expect(el('[data-testid="dce-years-selected"]').textContent).toContain('selected_count');
    el<HTMLButtonElement>('[data-testid="dce-export-shots"]').click();
    tick();
    fixture.detectChanges();
    expect(facade.exportShots).toHaveBeenCalledWith('area-1', [2025, 2026]);
    expect(clicked[0]).toBe('schusszahlen_2025-2026.csv');
    tick(6000);
  }));

  it('does not download anything when the export fails', fakeAsync(() => {
    facade.exportStates.mockResolvedValueOnce(null as unknown as Blob);
    all('[data-testid="dce-state"]')[0].click();
    fixture.detectChanges();
    el<HTMLButtonElement>('[data-testid="dce-export-states"]').click();
    tick();
    fixture.detectChanges();
    expect(clicked).toEqual([]);
    expect(el('[data-testid="dce-toast"]')).toBeNull();
  }));

  it('creates a new empty Berechnungszustand in an existing delivery (new ZustandID) and marks it for the export', fakeAsync(() => {
    el<HTMLButtonElement>('[data-testid="dce-new-state"]').click();
    fixture.detectChanges();
    expect(el('[data-testid="dce-state-dialog"]')).not.toBeNull();
    expect(el<HTMLSelectElement>('[data-testid="dce-state-delivery"]').value).toBe('d-2023');
    // Bezeichnung is required.
    el<HTMLButtonElement>('[data-testid="dce-state-save"]').click();
    tick();
    fixture.detectChanges();
    expect(facade.createState).not.toHaveBeenCalled();
    expect(el('.slim-field--invalid')).not.toBeNull();

    type('[data-testid="dce-state-name"]', ' Variante B ');
    type('[data-testid="dce-state-year"]', '2028');
    el<HTMLButtonElement>('[data-testid="dce-state-save"]').click();
    tick();
    fixture.detectChanges();
    expect(facade.createDelivery).not.toHaveBeenCalled();
    expect(facade.createState).toHaveBeenCalledWith('area-1', { calculationId: 'd-2023', name: 'Variante B', referenceYear: 2028, buildYearClass: 'mixed' });
    expect(el('[data-testid="dce-state-dialog"]')).toBeNull();
    expect(el('[data-testid="dce-toast"]').textContent).toContain('toast_state_created');
    expect(fixture.componentInstance['selectedStates']()).toEqual(['s-new']);
    tick(6000);
  }));

  it('creates the delivery first when «neue Immissionsberechnung» is chosen', fakeAsync(() => {
    el<HTMLButtonElement>('[data-testid="dce-new-state"]').click();
    fixture.detectChanges();
    pick('[data-testid="dce-state-delivery"]', '__new__');
    expect(el('[data-testid="dce-state-delivery-name"]')).not.toBeNull();
    type('[data-testid="dce-state-name"]', 'Variante C');
    el<HTMLButtonElement>('[data-testid="dce-state-save"]').click();
    tick();
    fixture.detectChanges();
    expect(facade.createDelivery).not.toHaveBeenCalled(); // the delivery name is required
    expect(el('.slim-field--invalid')).not.toBeNull();

    type('[data-testid="dce-state-delivery-name"]', 'Lieferung 2028');
    el<HTMLButtonElement>('[data-testid="dce-state-save"]').click();
    tick();
    fixture.detectChanges();
    expect(facade.createDelivery).toHaveBeenCalledWith('area-1', expect.objectContaining({ name: 'Lieferung 2028', supplier: '' }));
    expect(facade.createState).toHaveBeenCalledWith('area-1', expect.objectContaining({ calculationId: 'd-new', name: 'Variante C' }));
    tick(6000);
  }));

  it('hides the export and the new state without the write right', () => {
    access.write.set(false);
    fixture.detectChanges();
    expect(el('[data-testid="dce-new-state"]')).toBeNull();
    expect(el('[data-testid="dce-export-states"]')).toBeNull();
    expect(el('[data-testid="dce-export-shots"]')).toBeNull();
  });
});
