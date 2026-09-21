import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { DataEmitter } from '@app-galaxy/sdk-ui';
import { TranslateService } from '@app-galaxy/translate-ui';
import { AccessFacade } from '../../../../../../core/access/access.facade';
import { DataCalculationsFacade } from '../../../../../../core/data-calculations/data-calculations.facade';
import { AccessStub, CalcFacadeStub, DELIVERY_2023, DELIVERY_2026, INITIAL, SANITISED, TRANSLATE_STUB, delivery, routeStub, state } from '../dm-calc.spec-data';
import { DmCalcOverviewComponent } from './dm-calc-overview.component';

describe('DmCalcOverviewComponent (5.18 Übersicht Berechnungen)', () => {
  let fixture: ComponentFixture<DmCalcOverviewComponent>;
  let component: DmCalcOverviewComponent;
  let facade: CalcFacadeStub;
  let access: AccessStub;

  beforeEach(async () => {
    facade = new CalcFacadeStub();
    access = new AccessStub();
    await TestBed.configureTestingModule({
      imports: [DmCalcOverviewComponent],
      providers: [
        provideRouter([]),
        { provide: DataCalculationsFacade, useValue: facade },
        { provide: AccessFacade, useValue: access },
        DataEmitter,
        { provide: TranslateService, useValue: TRANSLATE_STUB },
        { provide: ActivatedRoute, useValue: routeStub() },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DmCalcOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const el = <T extends Element = HTMLElement>(selector: string): T => fixture.nativeElement.querySelector(selector) as T;
  const all = (selector: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(selector));
  const rowNames = () => all('[data-testid="dco-row"]').map((r) => r.getAttribute('data-name'));
  const stateNames = () => all('[data-testid="dco-state"]').map((r) => r.getAttribute('data-name'));
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

  it('lists the deliveries newest first and opens the one that holds the current state (B1 Abbildung 29)', () => {
    expect(rowNames()).toEqual(['Lieferung 2026', 'Lieferung 2023']);
    expect(el('[data-testid="dco-count"]').textContent).toContain('count');
    // The second row (Lieferung 2023) carries the aktuell + MGDM flags.
    const flags = all('[data-testid="dco-row"]')[1].querySelectorAll('.dco__flag--on');
    expect(flags).toHaveLength(2);
    expect(all('[data-testid="dco-row"]')[0].querySelectorAll('.dco__flag--on')).toHaveLength(0);

    // Detail: the delivery with the current state is preselected and filled into the form.
    expect(el('[data-testid="dco-detail-title"]').textContent).toContain('Lieferung 2023');
    expect(el<HTMLInputElement>('[data-testid="dco-name"]').value).toBe('Lieferung 2023');
    expect(el<HTMLInputElement>('[data-testid="dco-supplier"]').value).toBe('Büro XY');
    expect(el<HTMLInputElement>('[data-testid="dco-delivered"]').value).toBe('2023-05-10');
    expect(el('[data-testid="dco-file"]').textContent).toContain('geissalp_2023.gdb');
    expect(stateNames()).toEqual(['Initiale Aufnahme', 'Sanierter Zustand SPM Geissalp']);
    expect(all('[data-testid="dco-state"]')[0].textContent).toContain('1104.020_1');
    expect(el<HTMLButtonElement>('[data-testid="dco-save"]').disabled).toBe(true);
  });

  it('searches over Bezeichnung, Lieferantin and the states (name / Zustand ID)', () => {
    type('[data-testid="dco-search"]', 'sanierter');
    expect(rowNames()).toEqual(['Lieferung 2023']);
    type('[data-testid="dco-search"]', '1104.020_3');
    expect(rowNames()).toEqual(['Lieferung 2026']);
    type('[data-testid="dco-search"]', 'büro z');
    expect(rowNames()).toEqual(['Lieferung 2026']);
    type('[data-testid="dco-search"]', 'nix');
    expect(rowNames()).toEqual([]);
    expect(el('.slim-empty__text').textContent).toContain('no_match');
  });

  it('pointer rule: the current state cannot be unchecked, the other state is set after a confirmation', fakeAsync(() => {
    const [initial, sanitised] = all('[data-testid="dco-state"]');
    const currentOfInitial = initial.querySelector<HTMLButtonElement>('[data-testid="dco-pointer-current"]') as HTMLButtonElement;
    const mgdmOfInitial = initial.querySelector<HTMLButtonElement>('[data-testid="dco-pointer-mgdm"]') as HTMLButtonElement;
    expect(currentOfInitial.disabled).toBe(true); // already aktuell → only another state can take it over
    expect(mgdmOfInitial.disabled).toBe(true);
    expect(currentOfInitial.classList).toContain('dco__pointer--on');

    const currentOfSanitised = sanitised.querySelector<HTMLButtonElement>('[data-testid="dco-pointer-current"]') as HTMLButtonElement;
    expect(currentOfSanitised.disabled).toBe(false);
    currentOfSanitised.click();
    fixture.detectChanges();
    const dialog = el('[data-testid="dco-pointer-dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain('pointer_title_current');
    expect(facade.setPointer).not.toHaveBeenCalled(); // nothing happens before the confirmation

    el<HTMLButtonElement>('[data-testid="dco-pointer-confirm"]').click();
    tick();
    fixture.detectChanges();
    expect(facade.setPointer).toHaveBeenCalledWith('area-1', 's-sanitised', 'current');
    expect(el('[data-testid="dco-pointer-dialog"]')).toBeNull();
    expect(el('[data-testid="dco-toast"]').textContent).toContain('toast_pointer_current');
    tick(6000);
  }));

  it('never lets a state without model become aktuell or MGDM (5.20 empty state)', () => {
    all('[data-testid="dco-row"]')[0].click(); // Lieferung 2026 with the empty state
    fixture.detectChanges();
    expect(stateNames()).toEqual(['Variante A']);
    const row = all('[data-testid="dco-state"]')[0];
    expect(row.textContent).toContain('state_no_model');
    expect(row.querySelector<HTMLButtonElement>('[data-testid="dco-pointer-current"]')?.disabled).toBe(true);
    expect(row.querySelector<HTMLButtonElement>('[data-testid="dco-pointer-mgdm"]')?.disabled).toBe(true);
  });

  it('changes the Baujahr Anlageteile of a state directly in the table', fakeAsync(() => {
    const selects = all('[data-testid="dco-build-year"]') as HTMLSelectElement[];
    expect(selects.map((s) => s.value)).toEqual(['mixed', 'after1985']);
    selects[1].value = 'before1985';
    selects[1].dispatchEvent(new Event('change'));
    tick();
    fixture.detectChanges();
    expect(facade.updateState).toHaveBeenCalledWith('area-1', 's-sanitised', { buildYearClass: 'before1985' });
    expect(el('[data-testid="dco-toast"]').textContent).toContain('toast_build_year');
    // Same value again → no call.
    selects[0].value = 'mixed';
    selects[0].dispatchEvent(new Event('change'));
    tick();
    expect(facade.updateState).toHaveBeenCalledTimes(1);
    tick(6000);
  }));

  it('edits the delivery: a blank Bezeichnung is refused, a valid form is saved with trimmed values', fakeAsync(() => {
    type('[data-testid="dco-name"]', '   ');
    expect(el('[data-testid="dco-dirty"]')).not.toBeNull();
    el<HTMLButtonElement>('[data-testid="dco-save"]').click();
    tick();
    fixture.detectChanges();
    expect(facade.updateDelivery).not.toHaveBeenCalled();
    expect(el('.slim-field--invalid')).not.toBeNull();

    type('[data-testid="dco-name"]', ' Lieferung 2023 rev. ');
    type('[data-testid="dco-description"]', 'Nachgereicht');
    el<HTMLButtonElement>('[data-testid="dco-save"]').click();
    tick();
    fixture.detectChanges();
    expect(facade.updateDelivery).toHaveBeenCalledWith('area-1', 'd-2023', { name: 'Lieferung 2023 rev.', supplier: 'Büro XY', deliveredAt: '2023-05-10', description: 'Nachgereicht' });
    expect(el('[data-testid="dco-toast"]').textContent).toContain('toast_saved');
    expect(el('[data-testid="dco-dirty"]')).toBeNull();
    tick(6000);
  }));

  it('creates a new Immissionsberechnung with today as Lieferdatum', fakeAsync(() => {
    el<HTMLButtonElement>('[data-testid="dco-new"]').click();
    tick();
    fixture.detectChanges();
    expect(el('[data-testid="dco-detail-title"]').textContent).toContain('detail_new');
    expect(el<HTMLInputElement>('[data-testid="dco-delivered"]').value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(el('[data-testid="dco-state"]')).toBeNull(); // no states yet
    type('[data-testid="dco-name"]', 'Lieferung 2027');
    type('[data-testid="dco-supplier"]', 'Büro Neu');
    el<HTMLButtonElement>('[data-testid="dco-save"]').click();
    tick();
    fixture.detectChanges();
    expect(facade.createDelivery).toHaveBeenCalledWith('area-1', expect.objectContaining({ name: 'Lieferung 2027', supplier: 'Büro Neu', description: null }));
    expect(el('[data-testid="dco-toast"]').textContent).toContain('toast_created');
    tick(6000);
  }));

  it('delete rule: the delivery with the current state is blocked, an unused one is deleted after a confirmation', fakeAsync(() => {
    el<HTMLButtonElement>('[data-testid="dco-delete"]').click(); // Lieferung 2023 (aktuell)
    fixture.detectChanges();
    expect(el('[data-testid="dco-delete-blocked"]').textContent).toContain('delete_blocked_current');
    expect(el('[data-testid="dco-delete-confirm"]')).toBeNull();
    el<HTMLButtonElement>('[data-testid="dco-delete-dialog"] .slim-sheet__backdrop').click();
    fixture.detectChanges();

    // A delivery whose states carry stored runs is blocked as well.
    facade.setDeliveries([DELIVERY_2023, delivery({ id: 'd-runs', name: 'Lieferung Läufe', deliveredAt: '2024-01-01', states: [state({ id: 's-runs', name: 'Mit Läufen', runCount: 3 })] })]);
    fixture.detectChanges();
    all('[data-testid="dco-row"]')[0].click();
    fixture.detectChanges();
    el<HTMLButtonElement>('[data-testid="dco-delete"]').click();
    fixture.detectChanges();
    expect(el('[data-testid="dco-delete-blocked"]').textContent).toContain('delete_blocked_runs');
    el<HTMLButtonElement>('[data-testid="dco-delete-dialog"] .slim-sheet__backdrop').click();
    fixture.detectChanges();

    facade.setDeliveries([DELIVERY_2023, DELIVERY_2026]);
    fixture.detectChanges();
    all('[data-testid="dco-row"]')[0].click(); // Lieferung 2026
    fixture.detectChanges();
    el<HTMLButtonElement>('[data-testid="dco-delete"]').click();
    fixture.detectChanges();
    expect(el('[data-testid="dco-delete-dialog"]').textContent).toContain('delete_text');
    el<HTMLButtonElement>('[data-testid="dco-delete-confirm"]').click();
    tick();
    fixture.detectChanges();
    expect(facade.deleteDelivery).toHaveBeenCalledWith('area-1', 'd-2026');
    expect(el('[data-testid="dco-delete-dialog"]')).toBeNull();
    expect(el('[data-testid="dco-toast"]').textContent).toContain('toast_deleted');
    expect(el('.dco__placeholder')).not.toBeNull(); // the deleted delivery is no longer shown
    tick(6000);
  }));

  it('guards unsaved edits when another delivery is chosen or the page is left', async () => {
    type('[data-testid="dco-description"]', 'ungespeichert');
    all('[data-testid="dco-row"]')[0].click();
    fixture.detectChanges();
    expect(el('[data-testid="dco-discard"]')).not.toBeNull();
    el<HTMLButtonElement>('[data-testid="dco-discard-keep"]').click();
    fixture.detectChanges();
    expect(el('[data-testid="dco-detail-title"]').textContent).toContain('Lieferung 2023');
    expect(el<HTMLTextAreaElement>('[data-testid="dco-description"]').value).toBe('ungespeichert');

    const leaving = component.canDeactivate() as Promise<boolean>;
    fixture.detectChanges();
    el<HTMLButtonElement>('[data-testid="dco-discard-confirm"]').click();
    await expect(leaving).resolves.toBe(true);
    fixture.detectChanges();
    expect(el<HTMLTextAreaElement>('[data-testid="dco-description"]').value).toBe('Erstlieferung');
    expect(component.canDeactivate()).toBe(true);
  });

  it('is read-only without the write right: no new / delete, pointers and form locked', () => {
    access.write.set(false);
    fixture.detectChanges();
    expect(el('[data-testid="dco-new"]')).toBeNull();
    expect(el('[data-testid="dco-delete"]')).toBeNull();
    expect(el('[data-testid="dco-actions"]')).toBeNull();
    expect(el<HTMLInputElement>('[data-testid="dco-name"]').disabled).toBe(true);
    expect((all('[data-testid="dco-pointer-current"]') as HTMLButtonElement[]).every((b) => b.disabled)).toBe(true);
    expect((all('[data-testid="dco-build-year"]') as HTMLSelectElement[]).every((s) => s.disabled)).toBe(true);
    // The details link stays: reading is allowed.
    expect(all('[data-testid="dco-state-details"]')).toHaveLength(2);
  });

  it('links every state to the Details page with its id as query parameter', () => {
    const links = all('[data-testid="dco-state-details"]') as HTMLAnchorElement[];
    expect(links[0].getAttribute('href')).toBe(`/admin/data-management/area/area-1/calculations/details?state=${INITIAL.id}`);
    expect(links[1].getAttribute('href')).toContain(`state=${SANITISED.id}`);
  });
});
