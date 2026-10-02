import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import type { SelectionListValueDto } from '@ui-slim/apiClient';
import { TableExportComponent } from '../../../../common/table-export.component';
import { SelectionListKey, SelectionListsFacade } from '../../../../core/settings/selection-lists.facade';
import { tableExport, TableExportData } from '../../../../core/table/table-export';

const I18N = 'admin.dm_lists';
/** Id of the table in the export: file name (date and extension are added) and logbook. */
const EXPORT_TABLE = 'auswahlliste';

/** The lists in the order of the masks that use them. */
export const SELECTION_LISTS: readonly SelectionListKey[] = [
  'classification',
  'recalculation_state',
  'remediation_project_state',
  'spm_state',
  'noise_remediation_state',
  'project_state',
  'civil_usage_kind',
];

/**
 * Pflege der Auswahllisten (B1 5.3, slm 1): «neue Werte hinzufügen,
 * bestehende ändern oder inaktivieren». One list at a time: its values with
 * the labels in DE / FR / IT / EN, a switch for active / inactive and the
 * arrows for the position; a form adds or edits a value. Values are never
 * deleted — an inactive value stays readable on the records that use it.
 * Part of the erweiterte Konfiguration (app 45); data: SelectionListsFacade.
 */
@Component({
  selector: 'app-dm-selection-lists',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe, TableExportComponent],
  templateUrl: './dm-selection-lists.component.html',
  styleUrl: './dm-selection-lists.component.scss',
})
export class DmSelectionListsComponent {
  private readonly facade = inject(SelectionListsFacade);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);

  /** Without the right to write the lists are shown, not changed. */
  readonly readonly = input(false);

  protected readonly prefix = I18N;
  protected readonly keys = SELECTION_LISTS;
  protected readonly selected = signal<SelectionListKey>('spm_state');
  protected readonly values = computed(() => {
    this.facade.lists(); // re-evaluate when the lists change
    return this.facade.values(this.selected());
  });
  /** The values of the chosen list in their order, for the Excel-/CSV-Export (B1 5.5.5, slm 3). */
  protected readonly exportSource = (): TableExportData => {
    const t = (key: string) => this.translate.translate(key) ?? key;
    return tableExport<SelectionListValueDto>({
      table: EXPORT_TABLE,
      title: t(`${I18N}.title`),
      subtitle: t(`${I18N}.lists.${this.selected()}`),
      filters: [{ label: t(`${I18N}.list`), value: t(`${I18N}.lists.${this.selected()}`) }],
      columns: [
        { header: t(`${I18N}.label_de`), value: (v) => v.labelDe },
        { header: t(`${I18N}.label_fr`), value: (v) => v.labelFr },
        { header: t(`${I18N}.label_it`), value: (v) => v.labelIt },
        { header: t(`${I18N}.label_en`), value: (v) => v.labelEn },
        { header: t(`${I18N}.status`), value: (v) => t(v.enabled ? `${I18N}.active` : `${I18N}.inactive`) },
      ],
      rows: this.values(),
    });
  };
  protected readonly saving = this.facade.saving;
  protected readonly error = this.facade.error;

  /** Code of the value being edited, `''` for a new value, null when the form is closed. */
  protected readonly editing = signal<string | null>(null);
  protected readonly submitted = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    labelDe: ['', [Validators.required, Validators.maxLength(120)]],
    labelFr: ['', Validators.maxLength(120)],
    labelIt: ['', Validators.maxLength(120)],
    labelEn: ['', Validators.maxLength(120)],
  });

  protected select(key: string): void {
    this.selected.set(key as SelectionListKey);
    this.close();
  }

  protected add(): void {
    if (this.readonly()) return;
    this.form.reset({ labelDe: '', labelFr: '', labelIt: '', labelEn: '' });
    this.submitted.set(false);
    this.editing.set('');
  }

  protected edit(value: SelectionListValueDto): void {
    if (this.readonly()) return;
    this.form.reset({ labelDe: value.labelDe, labelFr: value.labelFr ?? '', labelIt: value.labelIt ?? '', labelEn: value.labelEn ?? '' });
    this.submitted.set(false);
    this.editing.set(value.code);
  }

  protected close(): void {
    this.editing.set(null);
    this.submitted.set(false);
  }

  protected async save(): Promise<void> {
    const code = this.editing();
    if (code === null || this.readonly() || this.saving()) return;
    this.submitted.set(true);
    if (this.form.invalid || !this.form.controls.labelDe.value.trim()) return;
    const v = this.form.getRawValue();
    const body = { labelDe: v.labelDe.trim(), labelFr: v.labelFr.trim() || null, labelIt: v.labelIt.trim() || null, labelEn: v.labelEn.trim() || null };
    const ok = code === '' ? await this.facade.create(this.selected(), body) : await this.facade.updateValue(this.selected(), code, body);
    if (ok) this.close();
  }

  /** Active ↔ inactive. */
  protected async toggle(value: SelectionListValueDto): Promise<void> {
    if (this.readonly() || this.saving()) return;
    await this.facade.updateValue(this.selected(), value.code, { enabled: !value.enabled });
  }

  /** The last active value of a list cannot be set inactive. */
  protected isLastActive(value: SelectionListValueDto): boolean {
    return value.enabled && this.values().filter((v) => v.enabled).length <= 1;
  }

  /** Moves a value one position up (−1) or down (+1): the two neighbours swap their positions. */
  protected async move(value: SelectionListValueDto, direction: -1 | 1): Promise<void> {
    if (this.readonly() || this.saving()) return;
    const list = this.values();
    const index = list.findIndex((v) => v.code === value.code);
    const other = list[index + direction];
    if (!other) return;
    const key = this.selected();
    // Positions may be equal (built-in defaults are 1…n, but a tie is possible): make them distinct while swapping.
    const [a, b] = other.sortOrder === value.sortOrder ? [value.sortOrder + direction, value.sortOrder] : [other.sortOrder, value.sortOrder];
    if (await this.facade.updateValue(key, value.code, { sortOrder: Math.max(0, a) })) {
      await this.facade.updateValue(key, other.code, { sortOrder: Math.max(0, b) });
    }
  }
}
