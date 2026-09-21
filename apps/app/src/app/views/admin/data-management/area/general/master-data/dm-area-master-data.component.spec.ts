import { signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { DataEmitter } from '@app-galaxy/sdk-ui';
import { TranslateService } from '@app-galaxy/translate-ui';
import type { AreaGeneralDto, AreaQuotaDto, AreaResultDto, QuotaCombinationOptionDto } from '@ui-slim/apiClient';
import { AccessFacade } from '../../../../../../core/access/access.facade';
import { DataAreaFacade } from '../../../../../../core/data-area/data-area.facade';
import { DmAreaMasterDataComponent } from './dm-area-master-data.component';

const AREA: AreaResultDto = {
  id: 'area-1',
  name: 'Geissalp',
  coordinationSectionNo: '1104.020',
  sectoralPlanNo: 'SP-BE-11',
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
  projectState: 'not_started',
  planningApproval: 'Militärische Plangenehmigung vom 13.02.2023',
};

function option(id: string, name: string, assigned: boolean, hasQuota: boolean, unit: 'shots' | 'kg' = 'shots'): QuotaCombinationOptionDto {
  return { id, name, weapon: name.split(' · ')[0], caliber: name.split(' · ')[1] ?? '', quantityUnit: unit, enabled: true, assigned, hasQuota };
}

const COMBINATIONS: QuotaCombinationOptionDto[] = [
  option('k-stgw', 'Stgw 90 · 5.6 mm', true, true),
  option('k-pist', 'Pist 75 · 9 mm', true, false),
  option('k-mw', '8.1 cm Mw 87', true, false),
  option('k-flab', 'Flab Kan 63/90 · 35 mm', false, false),
  option('k-spreng', 'Sprengladung · kg', false, false, 'kg'),
];

const QUOTAS: AreaQuotaDto[] = [
  {
    id: 'q-stgw',
    combinationId: 'k-stgw',
    name: 'Stgw 90 · 5.6 mm',
    weapon: 'Stgw 90',
    caliber: '5.6 mm GP 90',
    quantityUnit: 'shots',
    shotsPerYear: 320000,
    basis: 'Plangenehmigung 2019',
    assigned: true,
    updatedAt: '2026-09-19T08:00:00.000Z',
  },
];

class FacadeStub {
  readonly general = signal<AreaGeneralDto | null>({ area: AREA, buildYearClass: 'mixed', currentStateName: 'Initial', rooms: [], quotas: QUOTAS, combinations: COMBINATIONS });
  readonly area = signal<AreaResultDto | null>(AREA);
  readonly quotas = signal<AreaQuotaDto[]>(QUOTAS);
  readonly combinations = signal<QuotaCombinationOptionDto[]>(COMBINATIONS);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly load = jest.fn(async () => undefined);
  readonly updateArea = jest.fn(async (_id: string, body: Partial<AreaResultDto>) => ({ ...AREA, ...body }) as AreaResultDto);
  readonly createQuota = jest.fn(async () => QUOTAS[0]);
  readonly updateQuota = jest.fn(async () => QUOTAS[0]);
  readonly deleteQuota = jest.fn(async () => true);
  readonly clearError = jest.fn();
}

class AccessStub {
  readonly write = signal(true);
  readonly loaded = signal(true);
  canWrite = () => this.write;
  can = () => signal(true);
  load = jest.fn(async () => undefined);
}

describe('DmAreaMasterDataComponent (5.16)', () => {
  let fixture: ComponentFixture<DmAreaMasterDataComponent>;
  let component: DmAreaMasterDataComponent;
  let facade: FacadeStub;
  let access: AccessStub;
  let router: Router;

  beforeEach(async () => {
    facade = new FacadeStub();
    access = new AccessStub();
    await TestBed.configureTestingModule({
      imports: [DmAreaMasterDataComponent],
      providers: [
        provideRouter([]),
        { provide: DataAreaFacade, useValue: facade },
        { provide: AccessFacade, useValue: access },
        DataEmitter,
        {
          provide: TranslateService,
          useValue: { translate: (key: string) => key, sectionChanged$: of(null), languageChanged$: of(null) },
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
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(DmAreaMasterDataComponent);
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

  it('fills the form from the read model (B1 Abbildung 27) and starts clean', () => {
    expect(el<HTMLInputElement>('[data-testid="dmm-name"]').value).toBe('Geissalp');
    expect(el<HTMLInputElement>('[data-testid="dmm-no"]').value).toBe('1104.020');
    expect(el<HTMLInputElement>('[data-testid="dmm-active-yes"]').checked).toBe(true);
    expect(el<HTMLInputElement>('[data-testid="dmm-annex7"]').checked).toBe(false);
    expect(el<HTMLSelectElement>('[data-testid="dmm-classification"]').value).toBe('unproblematic');
    expect(el<HTMLSelectElement>('[data-testid="dmm-spm_state"]').value).toBe('completed');
    expect(el<HTMLInputElement>('[data-testid="dmm-pg"]').value).toBe('Militärische Plangenehmigung vom 13.02.2023');
    expect(el('[data-testid="dmm-dirty"]')).toBeNull();
    expect(el<HTMLButtonElement>('[data-testid="dmm-save"]').disabled).toBe(true);
    expect(component.canDeactivate()).toBe(true);
  });

  it('requires Bezeichnung and Koordinationsabschnitts-Nr. (or an own key) before saving', async () => {
    type('[data-testid="dmm-name"]', '');
    type('[data-testid="dmm-no"]', '   ');
    await component['save']();
    fixture.detectChanges();
    expect(facade.updateArea).not.toHaveBeenCalled();
    expect(all('.slim-field--invalid')).toHaveLength(2);
  });

  it('saves the Stammdaten as the API expects them, shows the logged toast and reloads the pages', fakeAsync(() => {
    const emitter = TestBed.inject(DataEmitter);
    const emitted = jest.spyOn(emitter, 'emit');
    type('[data-testid="dmm-name"]', 'Geissalp Nord');
    const select = el<HTMLSelectElement>('[data-testid="dmm-classification"]');
    select.value = 'problematic';
    select.dispatchEvent(new Event('change'));
    el<HTMLInputElement>('[data-testid="dmm-annex7"]').click();
    fixture.detectChanges();
    expect(el('[data-testid="dmm-dirty"]')).not.toBeNull();
    expect(component.canDeactivate()).not.toBe(true);

    el<HTMLButtonElement>('[data-testid="dmm-save"]').click();
    tick();
    fixture.detectChanges();

    expect(facade.updateArea).toHaveBeenCalledWith(
      'area-1',
      expect.objectContaining({ name: 'Geissalp Nord', coordinationSectionNo: '1104.020', classification: 'problematic', annex7Overall: true, enabled: true, planningApproval: 'Militärische Plangenehmigung vom 13.02.2023' }),
    );
    expect(el('[data-testid="dmm-toast"]').textContent).toContain('toast_saved');
    expect(el('[data-testid="dmm-dirty"]')).toBeNull();
    expect(emitted).toHaveBeenCalled();
    tick(6000);
  }));

  it('sends null for a cleared pick list and Sachplan-Nr. (nicht im Sachplan Militär)', fakeAsync(() => {
    type('[data-testid="dmm-sp"]', '');
    const select = el<HTMLSelectElement>('[data-testid="dmm-spm_state"]');
    select.value = '';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    el<HTMLButtonElement>('[data-testid="dmm-save"]').click();
    tick();
    expect(facade.updateArea).toHaveBeenCalledWith('area-1', expect.objectContaining({ sectoralPlanNo: null, spmState: null }));
    tick(6000);
  }));

  it('asks before leaving with unsaved edits and restores the values on «Verwerfen»', async () => {
    type('[data-testid="dmm-name"]', 'Anders');
    const leaving = component.canDeactivate() as Promise<boolean>;
    fixture.detectChanges();
    expect(el('[data-testid="dmm-discard"]')).not.toBeNull();
    el<HTMLButtonElement>('[data-testid="dmm-discard-confirm"]').click();
    fixture.detectChanges();
    await expect(leaving).resolves.toBe(true);
    expect(el<HTMLInputElement>('[data-testid="dmm-name"]').value).toBe('Geissalp');
    expect(component.canDeactivate()).toBe(true);
  });

  it('keeps editing when the user says so', async () => {
    type('[data-testid="dmm-name"]', 'Anders');
    const leaving = component.canDeactivate() as Promise<boolean>;
    fixture.detectChanges();
    el<HTMLButtonElement>('[data-testid="dmm-discard-keep"]').click();
    await expect(leaving).resolves.toBe(false);
    expect(el<HTMLInputElement>('[data-testid="dmm-name"]').value).toBe('Anders');
  });

  it('lists the Kontingente and flags allowed combinations without one (Soll 0, B1 5.10)', () => {
    expect(all('[data-testid="dmm-quota-row"]')).toHaveLength(1);
    expect(el('[data-testid="dmm-quota-row"]').textContent).toContain('Stgw 90 · 5.6 mm');
    expect(el('[data-testid="dmm-quota-row"]').textContent).toContain('320');
    const missing = el('[data-testid="dmm-quota-missing"]');
    expect(missing).not.toBeNull();
    // Pist 75 and Mw 87 are allowed but have no quota; Flab is not allowed → not flagged.
    expect(missing.querySelectorAll('.slim-chip')).toHaveLength(2);
    expect(missing.textContent).toContain('Pist 75');
    expect(missing.textContent).not.toContain('Flab');
  });

  it('opens the quota dialog from a missing combination, offers only combinations without a quota and creates it', fakeAsync(() => {
    el<HTMLButtonElement>('[data-testid="dmm-quota-missing"] .slim-chip').click();
    fixture.detectChanges();
    expect(el('[data-testid="dmm-quota-dialog"]')).not.toBeNull();
    const select = el<HTMLSelectElement>('[data-testid="dmm-quota-combination"]');
    expect(select.value).toBe('k-pist');
    const offered = Array.from(select.options).map((o) => o.value).filter(Boolean);
    expect(offered).not.toContain('k-stgw'); // already has a quota
    expect(offered).toEqual(['k-pist', 'k-mw', 'k-flab', 'k-spreng']); // allowed first
    // The basis field proposes the Plangenehmigung of the Schiessplatz.
    expect(el<HTMLInputElement>('[data-testid="dmm-quota-basis"]').placeholder).toContain('Militärische Plangenehmigung');

    // Validation: amount > 0.
    el<HTMLButtonElement>('[data-testid="dmm-quota-save"]').click();
    tick();
    fixture.detectChanges();
    expect(facade.createQuota).not.toHaveBeenCalled();
    expect(el('[data-testid="dmm-quota-dialog"] .slim-field--invalid')).not.toBeNull();

    type('[data-testid="dmm-quota-shots"]', '20000');
    el<HTMLButtonElement>('[data-testid="dmm-quota-save"]').click();
    tick();
    fixture.detectChanges();
    expect(facade.createQuota).toHaveBeenCalledWith('area-1', { combinationId: 'k-pist', shotsPerYear: 20000, basis: null });
    expect(el('[data-testid="dmm-quota-dialog"]')).toBeNull();
    expect(el('[data-testid="dmm-toast"]').textContent).toContain('toast_quota_created');
    tick(6000);
  }));

  it('edits an existing quota keeping its combination selectable and deletes after confirmation', fakeAsync(() => {
    el<HTMLButtonElement>('[data-testid="dmm-quota-edit"]').click();
    fixture.detectChanges();
    const select = el<HTMLSelectElement>('[data-testid="dmm-quota-combination"]');
    expect(select.value).toBe('k-stgw');
    expect(el<HTMLInputElement>('[data-testid="dmm-quota-shots"]').value).toBe('320000');
    type('[data-testid="dmm-quota-shots"]', '300000');
    el<HTMLButtonElement>('[data-testid="dmm-quota-save"]').click();
    tick();
    fixture.detectChanges();
    expect(facade.updateQuota).toHaveBeenCalledWith('area-1', 'q-stgw', { combinationId: 'k-stgw', shotsPerYear: 300000, basis: 'Plangenehmigung 2019' });

    el<HTMLButtonElement>('[data-testid="dmm-quota-delete"]').click();
    fixture.detectChanges();
    expect(el('[data-testid="dmm-quota-delete-dialog"]').textContent).toContain('Stgw 90 · 5.6 mm');
    el<HTMLButtonElement>('[data-testid="dmm-quota-delete-confirm"]').click();
    tick();
    fixture.detectChanges();
    expect(facade.deleteQuota).toHaveBeenCalledWith('area-1', 'q-stgw');
    expect(el('[data-testid="dmm-toast"]').textContent).toContain('toast_quota_deleted');
    tick(6000);
  }));

  it('is read-only without the write right: form disabled, no actions, no quota buttons', () => {
    access.write.set(false);
    fixture.detectChanges();
    expect(el<HTMLInputElement>('[data-testid="dmm-name"]').disabled).toBe(true);
    expect(el('[data-testid="dmm-actions"]')).toBeNull();
    expect(el('[data-testid="dmm-quota-new"]')).toBeNull();
    expect(el('[data-testid="dmm-quota-edit"]')).toBeNull();
    expect(el('[data-testid="dmm-quota-missing"]')).toBeNull();
  });
});
