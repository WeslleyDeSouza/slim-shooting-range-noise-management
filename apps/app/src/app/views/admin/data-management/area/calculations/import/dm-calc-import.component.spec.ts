import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { DataEmitter } from '@app-galaxy/sdk-ui';
import { TranslateService } from '@app-galaxy/translate-ui';
import { AccessFacade } from '../../../../../../core/access/access.facade';
import { DataCalculationsFacade } from '../../../../../../core/data-calculations/data-calculations.facade';
import { AccessStub, CalcFacadeStub, DELIVERY_2023, DELIVERY_2026, TRANSLATE_STUB, routeStub, stateFile, uploadResult } from '../dm-calc.spec-data';
import { DmCalcImportComponent } from './dm-calc-import.component';

const WLR_TEXT = 'Empfänger\tGebäude\tQuelle\tWaffe\tElevation\tLAE(MK)\tLAE(GK)\tLAE(Det)\tLAE\tLAFmax\nH1\t\tQ_F_1\tStgw90\t0.1\t58\t50\t0\t58.5\t68';
const A9_TEXT = 'QuellenID;A9_M1;A9_M2;Schätzung;Jahr\nQ_F_1;2000;300;ja;2025';

describe('DmCalcImportComponent (5.19 Import Berechnung)', () => {
  let fixture: ComponentFixture<DmCalcImportComponent>;
  let component: DmCalcImportComponent;
  let facade: CalcFacadeStub;
  let access: AccessStub;

  beforeEach(async () => {
    facade = new CalcFacadeStub();
    access = new AccessStub();
    await TestBed.configureTestingModule({
      imports: [DmCalcImportComponent],
      providers: [
        provideRouter([]),
        { provide: DataCalculationsFacade, useValue: facade },
        { provide: AccessFacade, useValue: access },
        DataEmitter,
        { provide: TranslateService, useValue: TRANSLATE_STUB },
        { provide: ActivatedRoute, useValue: routeStub() },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DmCalcImportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const el = <T extends Element = HTMLElement>(selector: string): T => fixture.nativeElement.querySelector(selector) as T;
  const all = (selector: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(selector));
  const type = (selector: string, value: string) => {
    const input = el<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const readFile = (name: string, content: unknown) => {
    component.readFile(name, typeof content === 'string' ? content : JSON.stringify(content));
    fixture.detectChanges();
  };

  it('rejects a file that is not a Berechnungsdatei before anything is sent', () => {
    readFile('kaputt.json', '{not json');
    expect(el('[data-testid="dci-file-problems"]').textContent).toContain('file_problems.file.not_json');
    expect(el('[data-testid="dci-summary"]')).toBeNull();

    readFile('leer.json', { calculation: { name: 'x' }, state: {}, plantParts: [] });
    const problems = el('[data-testid="dci-file-problems"]').textContent ?? '';
    expect(problems).toContain('file.delivered_at');
    expect(problems).toContain('file.state_name');
    expect(problems).toContain('file.reference_year');
    expect(problems).toContain('file.sources_missing');
    expect(problems).toContain('file.plant_parts_empty');

    // A SLIM export bundle must carry exactly one state.
    readFile('bundle.json', { format: 'slim-state-export', states: [stateFile(), stateFile()] });
    expect(el('[data-testid="dci-file-problems"]').textContent).toContain('file.bundle_many');
    expect(facade.validateImport).not.toHaveBeenCalled();
  });

  it('reads a valid file, shows the summary, validates without writing and imports only after a clean validation', fakeAsync(() => {
    expect(el<HTMLButtonElement>('[data-testid="dci-validate"]')).toBeNull(); // no file, no buttons
    readFile('geissalp_2027.gdb.json', stateFile());
    const summary = el('[data-testid="dci-summary"]').textContent ?? '';
    expect(summary).toContain('Zustand Datei');
    expect(summary).toContain('1104.020_9');
    expect(summary).toContain('summary_counts');
    // The delivery fields are prefilled from the file and stay editable.
    expect(el<HTMLInputElement>('[data-testid="dci-name"]').value).toBe('Lieferung 2027');
    expect(el<HTMLInputElement>('[data-testid="dci-supplier"]').value).toBe('Büro Neu');
    expect(el<HTMLInputElement>('[data-testid="dci-delivered"]').value).toBe('2027-01-15');
    expect(el<HTMLButtonElement>('[data-testid="dci-import"]').disabled).toBe(true);

    type('[data-testid="dci-supplier"]', 'Büro Neu AG');
    el<HTMLButtonElement>('[data-testid="dci-validate"]').click();
    tick();
    fixture.detectChanges();
    expect(facade.validateImport).toHaveBeenCalledTimes(1);
    const [areaId, body] = facade.validateImport.mock.calls[0] as unknown as [string, { fileName: string; state: ReturnType<typeof stateFile> }];
    expect(areaId).toBe('area-1');
    expect(body.fileName).toBe('geissalp_2027.gdb.json');
    expect(body.state.calculation).toMatchObject({ name: 'Lieferung 2027', supplier: 'Büro Neu AG', deliveredAt: '2027-01-15', fileName: 'geissalp_2027.gdb.json' });
    expect(body.state.wlr).toHaveLength(2);
    expect(el('[data-testid="dci-validation-ok"]').textContent).toContain('validation_ok');
    expect(el('[data-testid="dci-validation-warnings"]').textContent).toContain('Pist75');
    expect(el<HTMLButtonElement>('[data-testid="dci-import"]').disabled).toBe(false);

    // Editing the delivery afterwards needs a new validation.
    type('[data-testid="dci-description"]', 'geändert');
    expect(el('[data-testid="dci-validation-ok"]')).toBeNull();
    expect(el<HTMLButtonElement>('[data-testid="dci-import"]').disabled).toBe(true);
    el<HTMLButtonElement>('[data-testid="dci-validate"]').click();
    tick();
    fixture.detectChanges();

    el<HTMLButtonElement>('[data-testid="dci-import"]').click();
    tick();
    fixture.detectChanges();
    expect(facade.importFile).toHaveBeenCalledTimes(1);
    const imported = (facade.importFile.mock.calls[0] as unknown as [string, { state: ReturnType<typeof stateFile> }])[1];
    expect(imported.state.calculation.description).toBe('geändert');
    expect(el('[data-testid="dci-toast"]').textContent).toContain('toast_imported');
    expect(el('[data-testid="dci-imported"]').textContent).toContain('imported_hint');
    // The mask is cleared for the next file and the new state is selected for the uploads.
    expect(el('[data-testid="dci-summary"]')).toBeNull();
    expect(facade.loadDetails).toHaveBeenLastCalledWith('area-1', 's-imported');
    tick(7000);
  }));

  it('shows the findings of a failed validation and keeps the import locked', fakeAsync(() => {
    facade.validateImport.mockResolvedValueOnce({ valid: false, findings: ['Stellungsraum «Fremd» unbekannt'], warnings: [], counts: { plantParts: 1, sources: 1, points: 1, wlr: 2 } });
    readFile('fremd.json', stateFile());
    el<HTMLButtonElement>('[data-testid="dci-validate"]').click();
    tick();
    fixture.detectChanges();
    expect(el('[data-testid="dci-validation-findings"]').textContent).toContain('Stellungsraum «Fremd» unbekannt');
    expect(el('[data-testid="dci-validation-ok"]')).toBeNull();
    expect(el<HTMLButtonElement>('[data-testid="dci-import"]').disabled).toBe(true);
    expect(facade.importFile).not.toHaveBeenCalled();
  }));

  it('shows the findings when the API refuses the import (400) and keeps the file', fakeAsync(() => {
    facade.importFile.mockImplementationOnce(async () => {
      facade.importFindings.set(['Kombination «Stgw90» nicht zugeordnet']);
      return null;
    });
    readFile('x.json', stateFile());
    el<HTMLButtonElement>('[data-testid="dci-validate"]').click();
    tick();
    fixture.detectChanges();
    el<HTMLButtonElement>('[data-testid="dci-import"]').click();
    tick();
    fixture.detectChanges();
    expect(el('[data-testid="dci-import-findings"]').textContent).toContain('Kombination «Stgw90» nicht zugeordnet');
    expect(el('[data-testid="dci-summary"]')).not.toBeNull();
    expect(el('[data-testid="dci-toast"]')).toBeNull();
  }));

  it('lists the states with the current one preselected and loads its counts for the four uploads', () => {
    expect(all('[data-testid="dci-state"]').map((r) => r.getAttribute('data-name'))).toEqual(['Initiale Aufnahme', 'Sanierter Zustand SPM Geissalp', 'Variante A']);
    expect(all('[data-testid="dci-state"]')[0].classList).toContain('slim-table__row--selected');
    expect(facade.loadDetails).toHaveBeenCalledWith('area-1', 's-initial');
    expect(el('[data-testid="dci-uploads"]').textContent).toContain('state_files_title');
    expect(all('[data-testid^="dci-upload-"]').filter((n) => !n.getAttribute('data-testid')?.startsWith('dci-upload-file-')).map((n) => n.getAttribute('data-testid'))).toEqual([
      'dci-upload-wlr_day',
      'dci-upload-wlr_night',
      'dci-upload-a9',
      'dci-upload-a7',
    ]);
    // Counts from the details of the selected state (4 day + 1 eve rows, 2 A9, 1 A7 in the fixtures).
    expect(el('[data-testid="dci-count-wlr_day"]').textContent).toContain('rows_count');
    expect(component['detailCounts']()).toEqual({ wlr_day: 4, wlr_night: 1, a9: 2, a7: 1 });
  });

  it('uploads a WLR file with the time group taken from its name (eve.wlr) and reports the result', fakeAsync(() => {
    component.upload('wlr_night', 'eve.wlr', WLR_TEXT);
    tick();
    fixture.detectChanges();
    expect(facade.uploadWlr).toHaveBeenCalledWith('area-1', 's-initial', { timeGroup: 'eve', text: WLR_TEXT, fileName: 'eve.wlr' });
    expect(el('[data-testid="dci-result-wlr_night"]').textContent).toContain('upload_result');
    expect(el('[data-testid="dci-toast"]').textContent).toContain('toast_uploaded');

    // A name that says nothing falls back to the slot; the select overrides both.
    component.upload('wlr_day', 'pegel.txt', WLR_TEXT);
    tick();
    expect(facade.uploadWlr).toHaveBeenLastCalledWith('area-1', 's-initial', expect.objectContaining({ timeGroup: 'day' }));
    component['setWlrGroup']('wlr_day', 'eve');
    component.upload('wlr_day', 'pegel.txt', WLR_TEXT);
    tick();
    expect(facade.uploadWlr).toHaveBeenLastCalledWith('area-1', 's-initial', expect.objectContaining({ timeGroup: 'eve' }));
    tick(7000);
  }));

  it('uploads Betriebsdaten Anhang 9 / 7 per QuellenID and shows unknown sources and errors', fakeAsync(() => {
    component.upload('a9', 'BetriebA9.txt', A9_TEXT);
    tick();
    fixture.detectChanges();
    expect(facade.uploadOperatingData).toHaveBeenCalledWith('area-1', 's-initial', { annex: 9, text: A9_TEXT, fileName: 'BetriebA9.txt' });
    const result = el('[data-testid="dci-result-a9"]');
    expect(result.querySelector('.slim-alert--warning')).not.toBeNull(); // one unknown QuellenID
    expect(result.textContent).toContain('upload_unknown');
    expect(result.textContent).toContain('Q_NIX');

    facade.uploadOperatingData.mockResolvedValueOnce(uploadResult({ rows: 0, applied: 0, errors: ['Spalte «Halbtag_Wo» fehlt in der Kopfzeile'] }));
    component.upload('a7', 'betrieb.csv', 'QuellenID;x\nQ;1');
    tick();
    fixture.detectChanges();
    expect(facade.uploadOperatingData).toHaveBeenLastCalledWith('area-1', 's-initial', expect.objectContaining({ annex: 7 }));
    expect(el('[data-testid="dci-result-a7"] .slim-alert--danger').textContent).toContain('Halbtag_Wo');
    tick(7000);
  }));

  it('refuses uploads on a state without model and in read-only mode', fakeAsync(() => {
    all('[data-testid="dci-state"]')[2].click(); // Variante A (empty)
    fixture.detectChanges();
    expect(el('[data-testid="dci-uploads"]').textContent).toContain('no_model_hint');
    expect((all('[data-testid^="dci-upload-file-"]') as HTMLInputElement[]).every((i) => i.disabled)).toBe(true);
    component.upload('a9', 'BetriebA9.txt', A9_TEXT);
    tick();
    expect(facade.uploadOperatingData).not.toHaveBeenCalled();

    access.write.set(false);
    fixture.detectChanges();
    all('[data-testid="dci-state"]')[0].click();
    fixture.detectChanges();
    expect(el<HTMLInputElement>('[data-testid="dci-file"]').disabled).toBe(true);
    component.upload('wlr_day', 'day.wlr', WLR_TEXT);
    tick();
    expect(facade.uploadWlr).not.toHaveBeenCalled();
  }));

  it('keeps the selected state while the list reloads and falls back to the current one when it disappears', () => {
    all('[data-testid="dci-state"]')[1].click();
    fixture.detectChanges();
    expect(facade.loadDetails).toHaveBeenLastCalledWith('area-1', 's-sanitised');
    facade.setDeliveries([DELIVERY_2023, DELIVERY_2026]);
    fixture.detectChanges();
    expect(all('[data-testid="dci-state"]')[1].classList).toContain('slim-table__row--selected');
    facade.setDeliveries([DELIVERY_2023]);
    fixture.detectChanges();
    expect(all('[data-testid="dci-state"]')[1].classList).toContain('slim-table__row--selected'); // still there
    facade.setDeliveries([{ ...DELIVERY_2023, states: [DELIVERY_2023.states[0]] }]);
    fixture.detectChanges();
    expect(facade.loadDetails).toHaveBeenLastCalledWith('area-1', 's-initial');
  });
});
