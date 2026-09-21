import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { DataEmitter } from '@app-galaxy/sdk-ui';
import { TranslateService } from '@app-galaxy/translate-ui';
import { AccessFacade } from '../../../../../../core/access/access.facade';
import { DataCalculationsFacade } from '../../../../../../core/data-calculations/data-calculations.facade';
import { AccessStub, CalcFacadeStub, DELIVERY_2023, TRANSLATE_STUB, routeStub } from '../dm-calc.spec-data';
import { DmCalcDetailsComponent } from './dm-calc-details.component';

describe('DmCalcDetailsComponent (5.21 Berechnungsdetails)', () => {
  let fixture: ComponentFixture<DmCalcDetailsComponent>;
  let facade: CalcFacadeStub;
  let navigate: jest.SpyInstance;

  async function setup(query: Record<string, string> = {}): Promise<void> {
    facade = new CalcFacadeStub();
    await TestBed.configureTestingModule({
      imports: [DmCalcDetailsComponent],
      providers: [
        provideRouter([]),
        { provide: DataCalculationsFacade, useValue: facade },
        { provide: AccessFacade, useValue: new AccessStub() },
        DataEmitter,
        { provide: TranslateService, useValue: TRANSLATE_STUB },
        { provide: ActivatedRoute, useValue: routeStub(query) },
      ],
    }).compileComponents();
    navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(DmCalcDetailsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const el = <T extends Element = HTMLElement>(selector: string): T => fixture.nativeElement.querySelector(selector) as T;
  const all = (selector: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(selector));
  const roomNames = () => all('[data-testid="dcd-room"]').map((r) => r.getAttribute('data-name'));
  const rowTexts = () => all('[data-testid="dcd-row"]').map((r) => Array.from(r.querySelectorAll('td')).map((td) => td.textContent?.trim()).join(' '));
  const tabTexts = () => all('[role="tab"]').map((t) => t.textContent?.replace(/\s+/g, ' ').replace('admin.dm_calc.', '').trim());

  it('opens with the current state and the first Stellungsraum that has sources (B1 Abbildung 32)', async () => {
    await setup();
    expect(el<HTMLSelectElement>('[data-testid="dcd-state"]').value).toBe('s-initial');
    expect(all('[data-testid="dcd-state"] option').map((o) => o.textContent?.trim())).toEqual([
      'Lieferung 2023 (10.05.2023), Initiale Aufnahme, 1104.020_1',
      'Lieferung 2023 (10.05.2023), Sanierter Zustand SPM Geissalp, 1104.020_2',
      'Lieferung 2026 (01.09.2026), Variante A, 1104.020_3',
    ]);
    expect(facade.loadDetails).toHaveBeenCalledWith('area-1', 's-initial');
    expect(roomNames()).toEqual(['NGST Schönenboden', 'Stellungsrm A 1', 'Stellungsrm B 2']);
    expect(all('[data-testid="dcd-room"]')[0].classList).toContain('dcd__room--empty');
    expect(all('[data-testid="dcd-room"]')[1].classList).toContain('slim-table__row--selected');
    expect(el('[data-testid="dcd-detail-title"]').textContent).toContain('detail_title');
    // Tabs with the counts of Stellungsrm A 1: 3 day, 1 eve, 1 A9, 1 A7.
    expect(tabTexts()).toEqual(['tab_wlr_day 3', 'tab_wlr_night 1', 'tab_a9 1', 'tab_a7 1']);
    expect(el('[data-testid="dcd-wlr"]')).not.toBeNull();
    expect(rowTexts()).toEqual([
      'E1 123456 A1_Stgw90 Stgw90 0.5 59.4 — — 60.4 70.4',
      'E2 — A1_Stgw90 Stgw90 0.5 54.1 — — 55.1 65.1',
      'E1 123456 A2_Pist75 Stgw90 0.5 47.0 — — 48.0 58.0',
    ]);
  });

  it('switches between WLR DAY / NIGHT, Anhang 9 and Anhang 7 of the chosen room', async () => {
    await setup();
    el<HTMLButtonElement>('[data-testid="dcd-tab-wlr_night"]').click();
    fixture.detectChanges();
    expect(rowTexts()).toEqual(['E1 123456 A1_Stgw90 Stgw90 0.5 57.3 — — 58.3 68.3']);

    el<HTMLButtonElement>('[data-testid="dcd-tab-a9"]').click();
    fixture.detectChanges();
    expect(el('[data-testid="dcd-a9"]')).not.toBeNull();
    expect(rowTexts()[0]).toContain('A1_Stgw90');
    expect(rowTexts()[0]).toContain('Stgw 90 · 5.6 mm');
    expect(rowTexts()[0]).toContain('20');

    el<HTMLButtonElement>('[data-testid="dcd-tab-a7"]').click();
    fixture.detectChanges();
    expect(el('[data-testid="dcd-a7"]')).not.toBeNull();
    expect(rowTexts()).toHaveLength(1);
    expect(rowTexts()[0]).toContain('40');

    // Another room: Stellungsrm B 2 has one day row, no eve, one estimated A9, no A7.
    all('[data-testid="dcd-room"]')[2].click();
    fixture.detectChanges();
    expect(el('[data-testid="dcd-detail-title"]').textContent).toContain('detail_title');
    expect(tabTexts()).toEqual(['tab_wlr_day 1', 'tab_wlr_night 0', 'tab_a9 1', 'tab_a7 0']);
    expect(el('.slim-empty__text').textContent).toContain('rows_empty');
    el<HTMLButtonElement>('[data-testid="dcd-tab-a9"]').click();
    fixture.detectChanges();
    expect(rowTexts()[0]).toContain('B_Mg51');
    expect(rowTexts()[0]).toContain('geschätzt');
  });

  it('filters the Stellungsräume by number or name', async () => {
    await setup();
    const search = el<HTMLInputElement>('[data-testid="dcd-room-search"]');
    search.value = '020.06';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(roomNames()).toEqual(['Stellungsrm B 2']);
    search.value = 'ngst';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(roomNames()).toEqual(['NGST Schönenboden']);
    search.value = 'xyz';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(roomNames()).toEqual([]);
    expect(el('[data-testid="dcd-rooms"] .slim-empty__text').textContent).toContain('rooms_no_match');
  });

  it('preselects the state of the query parameter (link from the Übersicht)', async () => {
    await setup({ state: 's-sanitised' });
    expect(el<HTMLSelectElement>('[data-testid="dcd-state"]').value).toBe('s-sanitised');
    expect(facade.loadDetails).toHaveBeenCalledWith('area-1', 's-sanitised');
    expect(facade.loadDetails).not.toHaveBeenCalledWith('area-1', 's-initial');
    expect(navigate).not.toHaveBeenCalled(); // the URL already says it
  });

  it('changes the state: loads its details, writes ?state= and resets the room to the first one with sources', async () => {
    await setup();
    all('[data-testid="dcd-room"]')[2].click();
    fixture.detectChanges();
    const select = el<HTMLSelectElement>('[data-testid="dcd-state"]');
    select.value = 's-sanitised';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(facade.loadDetails).toHaveBeenLastCalledWith('area-1', 's-sanitised');
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { state: 's-sanitised' }, queryParamsHandling: 'merge', replaceUrl: true }));
    // The rooms of the new state are the same ids here, so the chosen room survives; a state without them falls back.
    expect(all('[data-testid="dcd-room"]')[2].classList).toContain('slim-table__row--selected');

    facade.loadDetails.mockImplementationOnce(async () => facade.details.set({ state: DELIVERY_2023.states[1], rooms: [{ id: 'r-x', coordinationSectionNo: '1104.020.09', name: 'Neu', plantPartCount: 1, sourceCount: 1, wlrCount: 0 }], wlr: [], a9: [], a7: [] }));
    select.value = 's-initial';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // The details still belong to the other state (stale) → nothing is shown until the matching ones arrive.
    expect(roomNames()).toEqual([]);
  });

  it('shows the empty notice when the Schiessplatz has no states', async () => {
    await setup();
    facade.setDeliveries([]);
    fixture.detectChanges();
    expect(el('.slim-empty__text').textContent).toContain('states_empty');
    expect(el('[data-testid="dcd-rooms"]')).toBeNull();
  });
});
