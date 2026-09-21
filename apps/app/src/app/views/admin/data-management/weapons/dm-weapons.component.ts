import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { map } from 'rxjs';
import { ComponentBase, EDataEmitterAction } from '@app-galaxy/sdk-ui';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import { APP_ROUTES, SLIM_APP_ID } from '@slim/shared';
import type { CaliberDto, WeaponCategoryDto, WeaponCombinationDto, WeaponDto } from '@ui-slim/apiClient';
import { AccessFacade } from '../../../../core/access/access.facade';
import {
  DataWeaponsFacade,
  WeaponInputByKind,
  WeaponKind,
  WeaponRecord,
  WeaponUpdateByKind,
} from '../../../../core/data-weapons/data-weapons.facade';
import { HasUnsavedChanges } from '../../_common/unsaved-changes.guard';
import { highlight, Highlighted } from '../area/general/overview/dm-area-general-overview.component';
import { notBlank } from '../area/general/master-data/dm-area-master-data.component';

const I18N = 'admin.dm_weapons';
const TOAST_MS = 5000;

/** LSV Anhang 7 Ziffer 1 Abs. 2: Waffenkategorien a–f (labels in `annex7.<code>`). */
export const ANNEX7_CODES = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

/** Order of the tabs = order of B1 5.22–5.25. */
export const WEAPON_KINDS: WeaponKind[] = ['combination', 'caliber', 'weapon', 'category'];

/** Column of the table of one kind: what to read from the row, and whether it is a yes/no. */
export interface WeaponColumn {
  key: string;
  label: string;
  value: (row: WeaponRecord) => string | boolean;
  kind?: 'text' | 'flag' | 'number';
}

export const COLUMNS: Record<WeaponKind, WeaponColumn[]> = {
  combination: [
    { key: 'nameDe', label: 'col_name', value: (r) => (r as WeaponCombinationDto).nameDe },
    { key: 'weaponName', label: 'col_weapon', value: (r) => (r as WeaponCombinationDto).weaponName },
    { key: 'caliberName', label: 'col_caliber', value: (r) => (r as WeaponCombinationDto).caliberName },
    { key: 'categoryName', label: 'col_category', value: (r) => (r as WeaponCombinationDto).categoryName },
    { key: 'enabled', label: 'col_active', value: (r) => r.enabled, kind: 'flag' },
  ],
  caliber: [
    { key: 'nameDe', label: 'col_name', value: (r) => (r as CaliberDto).nameDe },
    { key: 'alnNo', label: 'col_aln', value: (r) => (r as CaliberDto).alnNo ?? '', kind: 'number' },
    { key: 'sapNo', label: 'col_sap', value: (r) => (r as CaliberDto).sapNo ?? '', kind: 'number' },
    { key: 'enabled', label: 'col_active', value: (r) => r.enabled, kind: 'flag' },
  ],
  weapon: [
    { key: 'nameDe', label: 'col_name', value: (r) => (r as WeaponDto).nameDe },
    { key: 'categoryName', label: 'col_category', value: (r) => (r as WeaponDto).categoryName },
    { key: 'annex7Category', label: 'col_annex7', value: (r) => (r as WeaponDto).annex7Category ?? '' },
    { key: 'enabled', label: 'col_active', value: (r) => r.enabled, kind: 'flag' },
  ],
  category: [
    { key: 'nameDe', label: 'col_name', value: (r) => (r as WeaponCategoryDto).nameDe },
    { key: 'weaponCount', label: 'col_weapon_count', value: (r) => String((r as WeaponCategoryDto).weaponCount), kind: 'number' },
    { key: 'enabled', label: 'col_active', value: (r) => r.enabled, kind: 'flag' },
  ],
};

/** Filter selects of the combination list (B1 5.22: Kategorie, Waffe, Kaliber). */
type CombinationFilter = 'categoryName' | 'weaponName' | 'caliberName';
const COMBINATION_FILTERS: { key: CombinationFilter; label: string }[] = [
  { key: 'categoryName', label: 'col_category' },
  { key: 'weaponName', label: 'col_weapon' },
  { key: 'caliberName', label: 'col_caliber' },
];

interface Row {
  record: WeaponRecord;
  cells: (Highlighted | boolean)[];
}

interface Toast {
  key: string;
  params?: Record<string, unknown>;
}

/**
 * Datenverwaltung › Waffen (B1 5.22 Waffe/Kaliber, 5.23 Kaliber, 5.24 Waffe,
 * 5.25 Waffenkategorie; `slm 22–25`; mock `_mocks/data-management/weapon.html`):
 * one mask for the four lists. Left the table (search over the shown columns
 * and the FR/IT names, filters Kategorie / Waffe / Kaliber for the
 * combinations, sortable), right the detail form of the selected or new
 * record (mehrsprachige Bezeichnung, the fields of the kind, Aktiv, for a
 * combination the sonARMS mapping and the «Verwendung» on the Schiessplätze,
 * Erfassung / letzte Änderung). Export as XLSX, delete with confirmation and
 * the referential guard of the API (409 → offer «Inaktiv setzen»). Roles
 * without the write right (app 43) see the form disabled.
 */
@Component({
  selector: 'app-dm-weapons',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, RouterLinkActive, TranslatePipe, DatePipe],
  templateUrl: './dm-weapons.component.html',
  styleUrl: './dm-weapons.component.scss',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class DmWeaponsComponent extends ComponentBase implements HasUnsavedChanges {
  private readonly facade = inject(DataWeaponsFacade);
  private readonly access = inject(AccessFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly prefix = I18N;
  protected readonly routes = APP_ROUTES;
  protected readonly kinds = WEAPON_KINDS;
  protected readonly annex7Codes = ANNEX7_CODES;
  protected readonly combinationFilters = COMBINATION_FILTERS;

  /** Which of the four lists this route shows (`data.kind`). */
  readonly kind = toSignal(this.route.data.pipe(map((d) => (d['kind'] as WeaponKind) ?? 'combination')), {
    initialValue: (this.route.snapshot.data['kind'] as WeaponKind) ?? 'combination',
  });

  protected readonly data = this.facade.data;
  protected readonly loaded = this.facade.loaded;
  protected readonly loading = this.facade.loading;
  protected readonly saving = this.facade.saving;
  protected readonly error = this.facade.error;
  protected readonly inUse = this.facade.inUse;
  protected readonly canWrite = this.access.canWrite(SLIM_APP_ID.ADMIN_DATA_WEAPONS);
  protected readonly readonly = computed(() => !this.canWrite());

  protected readonly tabs = computed(() =>
    WEAPON_KINDS.map((k) => ({
      kind: k,
      link: this.linkOf(k),
      count: this.facade.rows(k).length,
    })),
  );

  protected readonly columns = computed(() => COLUMNS[this.kind()]);

  // --- Table ---------------------------------------------------------------------

  protected readonly query = signal('');
  protected readonly sortKey = signal('nameDe');
  protected readonly sortAsc = signal(true);
  protected readonly filters = signal<Record<CombinationFilter, string>>({ categoryName: '', weaponName: '', caliberName: '' });

  /** Distinct values of the three combination filters, from the data. */
  protected readonly filterOptions = computed<Record<CombinationFilter, string[]>>(() => {
    const rows = this.facade.combinations();
    const distinct = (pick: (r: WeaponCombinationDto) => string) =>
      [...new Set(rows.map(pick).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de-CH'));
    return {
      categoryName: distinct((r) => r.categoryName),
      weaponName: distinct((r) => r.weaponName),
      caliberName: distinct((r) => r.caliberName),
    };
  });

  protected readonly rows = computed<Row[]>(() => {
    const kind = this.kind();
    const columns = COLUMNS[kind];
    const q = this.query().trim().toLowerCase();
    const yes = (this.translate.translate('common.yes') ?? 'ja').toLowerCase();
    const no = (this.translate.translate('common.no') ?? 'nein').toLowerCase();
    const filters = this.filters();
    const key = this.sortKey();
    const dir = this.sortAsc() ? 1 : -1;
    const column = columns.find((c) => c.key === key) ?? columns[0];
    const text = (v: string | boolean) => (typeof v === 'boolean' ? (v ? yes : no) : v.toLowerCase());

    return this.facade
      .rows(kind)
      .filter((r) => {
        if (kind === 'combination') {
          const k = r as WeaponCombinationDto;
          if (filters.categoryName && k.categoryName !== filters.categoryName) return false;
          if (filters.weaponName && k.weaponName !== filters.weaponName) return false;
          if (filters.caliberName && k.caliberName !== filters.caliberName) return false;
        }
        if (!q) return true;
        const extra = [r.nameFr ?? '', r.nameIt ?? '', (r as WeaponCombinationDto).sonarmsId ?? ''];
        return [...columns.map((c) => text(c.value(r))), ...extra.map((e) => e.toLowerCase())].some((t) => t.includes(q));
      })
      .sort((a, b) => {
        const x = column.value(a);
        const y = column.value(b);
        if (typeof x === 'boolean' || typeof y === 'boolean') return (Number(y) - Number(x)) * dir;
        return x.localeCompare(y, 'de-CH', { numeric: true }) * dir;
      })
      .map((record) => ({
        record,
        cells: columns.map((c) => {
          const v = c.value(record);
          return typeof v === 'boolean' ? v : highlight(v, q);
        }),
      }));
  });

  protected sortBy(key: string): void {
    if (this.sortKey() === key) {
      this.sortAsc.update((asc) => !asc);
    } else {
      this.sortKey.set(key);
      this.sortAsc.set(true);
    }
  }

  protected setFilter(key: CombinationFilter, value: string): void {
    this.filters.update((f) => ({ ...f, [key]: value }));
  }

  protected clearQuery(input: HTMLInputElement): void {
    this.query.set('');
    input.focus();
  }

  // --- Detail -------------------------------------------------------------------

  /** Selected record, or `'new'` while a record is being created, or null. */
  protected readonly selection = signal<WeaponRecord | 'new' | null>(null);
  protected readonly selected = computed<WeaponRecord | null>(() => {
    const s = this.selection();
    if (!s || s === 'new') return null;
    // Always the fresh row of the store (counts, updatedAt) — the selection only remembers the id.
    return this.facade.rows(this.kind()).find((r) => r.id === s.id) ?? null;
  });
  protected readonly isNew = computed(() => this.selection() === 'new');
  protected readonly detailOpen = computed(() => this.selection() !== null);
  /** Combination selected: its «Verwendung» (Schiessplätze) for the detail. */
  protected readonly selectedCombination = computed(() =>
    this.kind() === 'combination' ? (this.selected() as WeaponCombinationDto | null) : null,
  );

  readonly form = new FormGroup({
    nameDe: new FormControl('', { nonNullable: true, validators: [notBlank, Validators.maxLength(160)] }),
    nameFr: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(160)] }),
    nameIt: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(160)] }),
    enabled: new FormControl<'yes' | 'no'>('yes', { nonNullable: true }),
    // combination
    weaponId: new FormControl('', { nonNullable: true }),
    caliberId: new FormControl('', { nonNullable: true }),
    sonarmsId: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(120)] }),
    // caliber
    alnNo: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(40)] }),
    sapNo: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(40)] }),
    quantityUnit: new FormControl<'shots' | 'kg'>('shots', { nonNullable: true }),
    // weapon
    categoryId: new FormControl('', { nonNullable: true }),
    annex7Category: new FormControl('', { nonNullable: true }),
  });

  protected readonly dirty = signal(false);
  private submitted = signal(false);
  protected readonly confirmDiscard = signal(false);
  private discardResolver: ((leave: boolean) => void) | null = null;
  protected readonly pendingDelete = signal<WeaponRecord | null>(null);
  protected readonly toast = signal<Toast | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly weaponIdValue = toSignal(this.form.controls.weaponId.valueChanges, { initialValue: '' });
  /** Waffenkategorie of a combination follows the chosen Waffe (read-only, B1 5.22). */
  protected readonly derivedCategory = computed(() => {
    const id = this.weaponIdValue();
    return this.facade.weapons().find((w) => w.id === id)?.categoryName ?? '';
  });

  constructor() {
    super();
    // A tab switch resets table state and closes the detail.
    effect(() => {
      this.kind();
      untracked(() => {
        this.query.set('');
        this.sortKey.set('nameDe');
        this.sortAsc.set(true);
        this.filters.set({ categoryName: '', weaponName: '', caliberName: '' });
        this.selection.set(null);
        this.facade.clearError();
      });
    });
    // Required fields depend on the kind (B1 5.22–5.25).
    effect(() => {
      const kind = this.kind();
      untracked(() => this.applyValidators(kind));
    });
    // Fill the form from the selection; never over unsaved edits of the same record.
    effect(() => {
      const selection = this.selection();
      const selected = this.selected();
      untracked(() => {
        if (selection === 'new') return;
        if (selected && !this.dirty()) this.fill(selected);
      });
    });
    effect(() => {
      const readonly = this.readonly();
      untracked(() => (readonly ? this.form.disable({ emitEvent: false }) : this.form.enable({ emitEvent: false })));
    });
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.dirty.set(this.form.dirty));
    this.destroyRef.onDestroy(() => this.dismissToast());
  }

  /** ComponentBase: on init and on every DATA_RELOAD (tenant switch). */
  override getData(): void {
    void this.facade.load();
    void this.access.load();
  }

  protected linkOf(kind: WeaponKind): string {
    const w = APP_ROUTES.admin.dataManagement.weapons;
    return { combination: w.combination, caliber: w.caliber, weapon: w.weapon, category: w.category }[kind];
  }

  protected async select(record: WeaponRecord): Promise<void> {
    if (this.selected()?.id === record.id) return;
    if (this.dirty() && !(await this.askDiscard())) return;
    this.facade.clearError();
    this.submitted.set(false);
    this.selection.set(record);
    this.fill(record);
  }

  protected async newRecord(): Promise<void> {
    if (this.readonly()) return;
    if (this.dirty() && !(await this.askDiscard())) return;
    this.facade.clearError();
    this.submitted.set(false);
    this.selection.set('new');
    this.fill(null);
  }

  protected async closeDetail(): Promise<void> {
    if (this.dirty() && !(await this.askDiscard())) return;
    this.selection.set(null);
    this.fill(null);
  }

  protected invalid(control: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.touched || this.submitted());
  }

  protected async save(): Promise<void> {
    this.submitted.set(true);
    if (this.form.invalid || this.readonly() || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const kind = this.kind();
    const v = this.form.getRawValue();
    const base = {
      nameDe: v.nameDe.trim(),
      nameFr: v.nameFr.trim() || null,
      nameIt: v.nameIt.trim() || null,
      enabled: v.enabled === 'yes',
    };
    const body = {
      combination: { ...base, weaponId: v.weaponId, caliberId: v.caliberId, sonarmsId: v.sonarmsId.trim() || null },
      caliber: { ...base, alnNo: v.alnNo.trim() || null, sapNo: v.sapNo.trim() || null, quantityUnit: v.quantityUnit },
      weapon: { ...base, categoryId: v.categoryId, annex7Category: (v.annex7Category || null) as WeaponDto['annex7Category'] },
      category: base,
    }[kind] as WeaponInputByKind[typeof kind] & WeaponUpdateByKind[typeof kind];

    const current = this.selected();
    const saved = current ? await this.facade.updateRecord(kind, current.id, body) : await this.facade.createRecord(kind, body);
    if (!saved) return;
    this.selection.set(saved);
    this.fill(saved);
    this.submitted.set(false);
    this.showToast({ key: `${I18N}.${current ? 'toast_updated' : 'toast_created'}`, params: { kind: this.kindLabel(kind, true) } });
    this.emit(EDataEmitterAction.DATA_RELOAD);
  }

  protected async cancelEdit(): Promise<void> {
    if (this.dirty() && !(await this.askDiscard())) return;
    if (this.isNew()) {
      this.selection.set(null);
      this.fill(null);
    } else {
      const current = this.selected();
      if (current) this.fill(current);
    }
  }

  protected askDelete(record: WeaponRecord): void {
    if (this.readonly()) return;
    this.facade.clearError();
    this.pendingDelete.set(record);
  }

  protected async confirmDelete(): Promise<void> {
    const record = this.pendingDelete();
    if (!record) return;
    const ok = await this.facade.deleteRecord(this.kind(), record.id);
    if (!ok) return; // 409 «in use» stays in the dialog with the alternative
    this.pendingDelete.set(null);
    if (this.selected()?.id === record.id) {
      this.selection.set(null);
      this.fill(null);
    }
    this.showToast({ key: `${I18N}.toast_deleted`, params: { kind: this.kindLabel(this.kind(), true), name: record.nameDe } });
    this.emit(EDataEmitterAction.DATA_RELOAD);
  }

  /** Alternative to a refused delete: set the record inactive (keeps every reference valid). */
  protected async deactivateInstead(): Promise<void> {
    const record = this.pendingDelete();
    if (!record) return;
    const saved = await this.facade.updateRecord(this.kind(), record.id, { enabled: false } as WeaponUpdateByKind[WeaponKind]);
    this.pendingDelete.set(null);
    if (!saved) return;
    if (this.selected()?.id === record.id) this.fill(saved);
    this.showToast({ key: `${I18N}.toast_deactivated`, params: { name: record.nameDe } });
    this.emit(EDataEmitterAction.DATA_RELOAD);
  }

  protected cancelDelete(): void {
    this.pendingDelete.set(null);
    this.facade.clearError();
  }

  protected async exportXlsx(): Promise<void> {
    const blob = await this.facade.exportXlsx(this.translate.lang || 'de');
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waffen_stammdaten_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast({ key: `${I18N}.toast_exported` });
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (!this.dirty()) return true;
    return this.askDiscard();
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty()) event.preventDefault();
  }

  protected resolveDiscard(leave: boolean): void {
    this.confirmDiscard.set(false);
    const resolve = this.discardResolver;
    this.discardResolver = null;
    if (leave) {
      this.form.markAsPristine();
      this.dirty.set(false);
    }
    resolve?.(leave);
  }

  private askDiscard(): Promise<boolean> {
    this.confirmDiscard.set(true);
    return new Promise<boolean>((resolve) => (this.discardResolver = resolve));
  }

  protected kindLabel(kind: WeaponKind, singular = false): string {
    return this.translate.translate(`${I18N}.kind_${kind}${singular ? '_one' : ''}`) ?? kind;
  }

  protected showToast(toast: Toast): void {
    this.toast.set(toast);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), TOAST_MS);
  }

  protected dismissToast(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = null;
    this.toast.set(null);
  }

  private applyValidators(kind: WeaponKind): void {
    const c = this.form.controls;
    const required = (control: FormControl<string>, on: boolean) => {
      control.setValidators(on ? [Validators.required] : []);
      control.updateValueAndValidity({ emitEvent: false });
    };
    required(c.weaponId, kind === 'combination');
    required(c.caliberId, kind === 'combination');
    required(c.categoryId, kind === 'weapon');
    // B1 5.23 / mock: ALN- and SAP-Nr. are part of the Kaliber record.
    c.alnNo.setValidators(kind === 'caliber' ? [Validators.required, Validators.maxLength(40)] : [Validators.maxLength(40)]);
    c.sapNo.setValidators(kind === 'caliber' ? [Validators.required, Validators.maxLength(40)] : [Validators.maxLength(40)]);
    c.alnNo.updateValueAndValidity({ emitEvent: false });
    c.sapNo.updateValueAndValidity({ emitEvent: false });
  }

  private fill(record: WeaponRecord | null): void {
    const k = record as Partial<WeaponCombinationDto & CaliberDto & WeaponDto & WeaponCategoryDto> | null;
    this.form.reset(
      {
        nameDe: k?.nameDe ?? '',
        nameFr: k?.nameFr ?? '',
        nameIt: k?.nameIt ?? '',
        enabled: k ? (k.enabled ? 'yes' : 'no') : 'yes',
        weaponId: k?.weaponId ?? '',
        caliberId: k?.caliberId ?? '',
        sonarmsId: k?.sonarmsId ?? '',
        alnNo: k?.alnNo ?? '',
        sapNo: k?.sapNo ?? '',
        quantityUnit: k?.quantityUnit ?? 'shots',
        categoryId: k?.categoryId ?? '',
        annex7Category: k?.annex7Category ?? '',
      },
      { emitEvent: false },
    );
    // `emitEvent: false` keeps the dirty subscription quiet; the derived signals need one tick.
    this.form.controls.weaponId.updateValueAndValidity();
    this.form.markAsPristine();
    this.dirty.set(false);
  }
}
