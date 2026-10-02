import { Pipe, PipeTransform } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import { labelOf, SelectionListsFacade } from '../../../../core/settings/selection-lists.facade';
import { fakeSelectionLists, testListValue } from '../../../../core/settings/selection-lists.testing';
import { TableExportComponent } from '../../../../common/table-export.component';
import { TableExportData } from '../../../../core/table/table-export';
import { TableExportFacade } from '../../../../core/table/table-export.facade';
import { DmSelectionListsComponent } from './dm-selection-lists.component';

@Pipe({ name: 'translate' })
class TranslateStubPipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('DmSelectionListsComponent — Pflege der Auswahllisten (B1 5.3, slm 1)', () => {
  let fixture: ComponentFixture<DmSelectionListsComponent>;
  let lists: ReturnType<typeof fakeSelectionLists>;
  let exportFacade: { download: jest.Mock };

  async function setup(readonly = false): Promise<void> {
    lists = fakeSelectionLists();
    exportFacade = { download: jest.fn().mockResolvedValue(true) };
    await TestBed.configureTestingModule({
      imports: [DmSelectionListsComponent],
      providers: [
        { provide: SelectionListsFacade, useValue: lists },
        { provide: TableExportFacade, useValue: exportFacade },
        { provide: TranslateService, useValue: { translate: (key: string) => key, lang: 'de' } },
      ],
    })
      .overrideComponent(TableExportComponent, { remove: { imports: [TranslatePipe] }, add: { imports: [TranslateStubPipe] } })
      .overrideComponent(DmSelectionListsComponent, { remove: { imports: [TranslatePipe] }, add: { imports: [TranslateStubPipe] } })
      .compileComponents();
    fixture = TestBed.createComponent(DmSelectionListsComponent);
    fixture.componentRef.setInput('readonly', readonly);
    await settle();
  }

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  }

  const el = <T extends Element = HTMLElement>(testId: string): T => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as T;
  const rows = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('[data-testid="dlist-row"]'));
  const codes = () => rows().map((r) => r.getAttribute('data-code'));
  const type = (testId: string, value: string) => {
    const input = el<HTMLInputElement>(testId);
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const choose = async (key: string) => {
    const select = el<HTMLSelectElement>('dlist-list');
    select.value = key;
    select.dispatchEvent(new Event('change'));
    await settle();
  };

  it('shows the values of the chosen list with their labels and status', async () => {
    await setup();
    expect(Array.from(el<HTMLSelectElement>('dlist-list').options).map((o) => o.value)).toEqual([
      'classification',
      'recalculation_state',
      'remediation_project_state',
      'spm_state',
      'noise_remediation_state',
      'project_state',
      'civil_usage_kind',
    ]);
    expect(codes()).toEqual(['open', 'in_progress', 'completed']);
    expect(rows()[0].textContent).toContain('open (DE)');
    expect(rows()[0].textContent).toContain('open (FR)');
    expect(rows()[0].querySelector('[data-testid="dlist-status"]')?.textContent).toContain('admin.dm_lists.active');

    await choose('civil_usage_kind');
    expect(codes()).toEqual(['obligatory', 'field_shooting', 'other']);
  });

  it('adds a value: the German label is mandatory, the other languages optional', async () => {
    await setup();
    el<HTMLButtonElement>('dlist-add').click();
    await settle();
    el<HTMLFormElement>('dlist-form').dispatchEvent(new Event('submit'));
    await settle();
    expect(lists.calls).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('.slim-field--invalid')).not.toBeNull();

    type('dlist-label-de', '  Sistiert ');
    type('dlist-label-fr', 'Suspendu');
    el<HTMLFormElement>('dlist-form').dispatchEvent(new Event('submit'));
    await settle();
    expect(lists.calls).toEqual([{ kind: 'create', key: 'spm_state', body: { labelDe: 'Sistiert', labelFr: 'Suspendu', labelIt: null, labelEn: null } }]);
    expect(el('dlist-form')).toBeNull();
    expect(rows()).toHaveLength(4);
    expect(rows()[3].textContent).toContain('Sistiert');
  });

  it('changes the labels of a value', async () => {
    await setup();
    rows()[1].querySelector<HTMLButtonElement>('[data-testid="dlist-edit"]')?.click();
    await settle();
    expect(el<HTMLInputElement>('dlist-label-de').value).toBe('in_progress (DE)');
    type('dlist-label-de', 'In Arbeit');
    type('dlist-label-it', 'In elaborazione');
    el<HTMLFormElement>('dlist-form').dispatchEvent(new Event('submit'));
    await settle();
    expect(lists.calls).toEqual([
      { kind: 'update', key: 'spm_state', code: 'in_progress', body: { labelDe: 'In Arbeit', labelFr: 'in_progress (FR)', labelIt: 'In elaborazione', labelEn: null } },
    ]);
    expect(rows()[1].textContent).toContain('In Arbeit');
  });

  it('sets a value inactive and active again, but never the last active one', async () => {
    await setup();
    const toggle = (i: number) => rows()[i].querySelector<HTMLButtonElement>('[data-testid="dlist-toggle"]') as HTMLButtonElement;
    toggle(0).click();
    await settle();
    expect(lists.calls[0]).toEqual({ kind: 'update', key: 'spm_state', code: 'open', body: { enabled: false } });
    expect(rows()[0].querySelector('[data-testid="dlist-status"]')?.textContent).toContain('admin.dm_lists.inactive');
    expect(toggle(0).textContent).toContain('admin.dm_lists.activate');

    toggle(1).click();
    await settle();
    // One active value is left: its switch is disabled.
    expect(toggle(2).disabled).toBe(true);
    toggle(0).click();
    await settle();
    expect(lists.calls[2]).toEqual({ kind: 'update', key: 'spm_state', code: 'open', body: { enabled: true } });
    expect(toggle(2).disabled).toBe(false);
  });

  it('moves a value: the two neighbours swap their positions', async () => {
    await setup();
    expect(rows()[0].querySelector<HTMLButtonElement>('[data-testid="dlist-up"]')?.disabled).toBe(true);
    expect(rows()[2].querySelector<HTMLButtonElement>('[data-testid="dlist-down"]')?.disabled).toBe(true);
    rows()[2].querySelector<HTMLButtonElement>('[data-testid="dlist-up"]')?.click();
    await settle();
    expect(lists.calls).toEqual([
      { kind: 'update', key: 'spm_state', code: 'completed', body: { sortOrder: 2 } },
      { kind: 'update', key: 'spm_state', code: 'in_progress', body: { sortOrder: 3 } },
    ]);
    expect(codes()).toEqual(['open', 'completed', 'in_progress']);
  });

  it('sorts the values by a column, keeps the order of the list fixed meanwhile and exports the marked values (B1 5.5.2, 5.5.3)', async () => {
    await setup();
    expect(codes()).toEqual(['open', 'in_progress', 'completed']);
    const title = el('dlist-sort-de').querySelector('button') as HTMLButtonElement;
    title.click();
    fixture.detectChanges();
    expect(codes()).toEqual(['completed', 'in_progress', 'open']);
    // The order shown is not the order of the list: it cannot be changed now.
    expect(rows()[1].querySelector<HTMLButtonElement>('[data-testid="dlist-up"]')?.disabled).toBe(true);
    expect(rows()[1].querySelector<HTMLButtonElement>('[data-testid="dlist-down"]')?.disabled).toBe(true);

    rows()[0].querySelector<HTMLInputElement>('[data-testid="dlist-select"]')?.click();
    rows()[2].querySelector<HTMLInputElement>('[data-testid="dlist-select"]')?.click();
    fixture.detectChanges();
    el<HTMLButtonElement>('dlist-export').click();
    fixture.detectChanges();
    el<HTMLButtonElement>('dlist-export-csv').click();
    await settle();
    const data = exportFacade.download.mock.calls[0][0] as TableExportData;
    expect(data.selection).toBe(true);
    expect(data.rows.map((row) => row[0])).toEqual(['completed (DE)', 'open (DE)']);

    // Descending, then back to the order of the list: it can be changed again.
    title.click();
    title.click();
    fixture.detectChanges();
    expect(codes()).toEqual(['open', 'in_progress', 'completed']);
    expect(rows()[1].querySelector<HTMLButtonElement>('[data-testid="dlist-up"]')?.disabled).toBe(false);
  });

  it('exports the values of the chosen list in their order (B1 5.5.5)', async () => {
    await setup();
    await choose('civil_usage_kind');
    el<HTMLButtonElement>('dlist-export').click();
    fixture.detectChanges();
    el<HTMLButtonElement>('dlist-export-xlsx').click();
    await settle();
    const data = exportFacade.download.mock.calls[0][0] as TableExportData;
    expect(exportFacade.download).toHaveBeenCalledWith(data, 'xlsx');
    expect(data.table).toBe('auswahlliste');
    expect(data.subtitle).toBe('admin.dm_lists.lists.civil_usage_kind');
    expect(data.header).toEqual(['admin.dm_lists.label_de', 'admin.dm_lists.label_fr', 'admin.dm_lists.label_it', 'admin.dm_lists.label_en', 'admin.dm_lists.status']);
    expect(data.rows.map((row) => row[0])).toEqual(['obligatory (DE)', 'field_shooting (DE)', 'other (DE)']);
    expect(data.rows[0][4]).toBe('admin.dm_lists.active');
  });

  it('offers the export also without the right to write', async () => {
    await setup(true);
    expect(el('dlist-export')).not.toBeNull();
    expect(el('dlist-add')).toBeNull();
  });

  it('only shows the lists without the right to write', async () => {
    await setup(true);
    expect(rows()).toHaveLength(3);
    expect(el('dlist-add')).toBeNull();
    expect(el('dlist-edit')).toBeNull();
    expect(el('dlist-toggle')).toBeNull();
  });
});

describe('labelOf — label of a list value in the language of the user', () => {
  const value = testListValue('open', { labelDe: 'Offen', labelFr: 'Ouvert', labelIt: null, labelEn: '' });

  it('takes the label of the language and falls back to German', () => {
    expect(labelOf(value, 'de')).toBe('Offen');
    expect(labelOf(value, 'fr')).toBe('Ouvert');
    expect(labelOf(value, 'it')).toBe('Offen');
    expect(labelOf(value, 'en')).toBe('Offen');
    expect(labelOf(value, null)).toBe('Offen');
  });
});
