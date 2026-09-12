import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import type {
  UsageCombinationDto,
  UsageCreateDto,
  UsageResultDto,
  UsageRoomDto,
} from '@ui-slim/apiClient';
import { AreaFacade } from '../../../../core/area/area.facade';
import { UsageFacade } from '../../../../core/usage/usage.facade';

/** Sortable columns of the table. */
export type ShotsSortKey =
  | 'room'
  | 'unit'
  | 'date'
  | 'usageType'
  | 'category'
  | 'weapon'
  | 'shots'
  | 'recordedBy';

/** The weapon categories of the usage form (5.11): codes of the Waffenkategorie master data. */
export const WEAPON_CATEGORIES = [
  'artillery',
  'air_defence',
  'handguns',
  'mortar',
] as const;

/** Zivile Nutzungsart (B1 6.1.3, 11.2.2), API enum CIVIL_USAGE_KIND. */
export const CIVIL_USAGE_KINDS = ['obligatory', 'field_shooting', 'other'] as const;

/** HH:mm on the quarter hour (B1 6.2.3 / 7.4.1). */
const QUARTER_HOUR = /^([01]\d|2[0-3]):(00|15|30|45)$/;
function quarterHourValidator(control: AbstractControl): ValidationErrors | null {
  const v = control.value as string;
  return !v || QUARTER_HOUR.test(v) ? null : { quarterHour: true };
}

/** Menge als Dezimalzahl (B1 6.2 / 11.2.3): > 0, up to three decimals. */
const QUANTITY = /^\d+([.,]\d{1,3})?$/;

/** Controls of one position line of the form. */
interface PositionForm {
  category: FormControl<string>;
  combinationId: FormControl<string>;
  quantity: FormControl<number>;
}

/** A row of the table: either a room heading (grouped view) or a usage. */
export type ShotsRow =
  | { kind: 'group'; roomName: string; shots: number }
  | { kind: 'usage'; usage: UsageResultDto };

interface Toast {
  key: string;
  params?: Record<string, unknown>;
  /** Ids to restore when «Rückgängig» is pressed. */
  undo?: string[];
}

const TOAST_MS = 6000;
const QUICK_TIMES = {
  morning: ['08:00', '11:30'],
  afternoon: ['13:30', '17:00'],
  night: ['19:00', '22:00'],
} as const;

/** Reactive-form group validator: «Bis» must be after «Von»; «Zivil» needs its Nutzungsart. */
function usageFormValidator(group: {
  get(name: string): { value: unknown } | null;
}): ValidationErrors | null {
  const from = group.get('timeFrom')?.value as string;
  const to = group.get('timeTo')?.value as string;
  const errors: ValidationErrors = {};
  if (from && to && to <= from) errors['timeRange'] = true;
  if (group.get('usageType')?.value === 'civil' && !group.get('civilUsageKind')?.value) errors['civilKind'] = true;
  return Object.keys(errors).length ? errors : null;
}

/**
 * «Schiessplatz – Schusszahlen» (B1 5.11, mock `_mocks/area/index.html`):
 * KPIs, Stellungsräume with counts, the year's usages with filters, sorting,
 * bulk delete + undo, and the create / edit drawer. Renders inside the area
 * context (`AreaContextComponent`), data from `UsageFacade`.
 */
@Component({
  selector: 'app-area-shots',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe, DecimalPipe, DatePipe],
  templateUrl: './area-shots.component.html',
  styleUrl: './area-shots.component.scss',
})
export class AreaShotsComponent extends ComponentBase {
  private readonly facade = inject(UsageFacade);
  private readonly areaFacade = inject(AreaFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly categories = WEAPON_CATEGORIES;
  /** Nutzungskategorien of B1 Tabelle 2 (API enum USAGE_TYPE). */
  protected readonly types = ['military', 'civil', 'blue_light', 'sat'] as const;
  protected readonly civilKinds = CIVIL_USAGE_KINDS;

  /** The area id is a param of the parent route (`/admin/area/:id/shots`). */
  readonly areaId = toSignal(
    (this.route.parent ?? this.route).paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: (this.route.parent ?? this.route).snapshot.paramMap.get('id') ?? '' },
  );

  /**
   * Write access. Always true for now; the role of the signed-in user for
   * this Schiessplatz (Schiessplatz-Verantwortlicher W/R, Interessent R)
   * will come from the session once the roles module exists (B1 8.1).
   */
  protected readonly readonly = signal(false);

  protected readonly year = signal(new Date().getFullYear());
  protected readonly area = computed(() => this.areaFacade.byId(this.areaId()) ?? null);
  protected readonly areaLabel = computed(() => {
    const a = this.area();
    return a ? `${a.coordinationSectionNo} ${a.name}` : '';
  });

  // Facade state ---------------------------------------------------------
  protected readonly kpi = this.facade.kpi;
  protected readonly rooms = this.facade.rooms;
  /** Zulässige Kombinationen je Stellungsraum (5.17) with their unit and quota. */
  protected readonly combinations = this.facade.combinations;
  protected readonly usages = this.facade.usages;
  protected readonly loading = this.facade.loading;
  protected readonly saving = this.facade.saving;
  protected readonly error = this.facade.error;
  protected readonly years = computed(() => {
    const list = this.kpi()?.years ?? [];
    return list.includes(this.year()) ? list : [this.year(), ...list];
  });

  // Filters --------------------------------------------------------------
  protected readonly room = signal('');
  protected readonly query = signal('');
  protected readonly dateFrom = linkedSignal(() => `${this.year()}-01-01`);
  protected readonly dateTo = linkedSignal(() => `${this.year()}-12-31`);
  protected readonly typeFilter = signal<ReadonlySet<string>>(new Set());
  protected readonly categoryFilter = signal<ReadonlySet<string>>(new Set());
  protected readonly sort = signal<{ key: ShotsSortKey; asc: boolean }>({ key: 'date', asc: false });
  protected readonly selected = signal<ReadonlySet<string>>(new Set());

  /** Rooms grouped by `groupName` for the list and the form select. */
  protected readonly roomGroups = computed(() => {
    const groups = new Map<string, UsageRoomDto[]>();
    for (const r of this.rooms()) {
      const key = r.groupName ?? '';
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    return [...groups.entries()].map(([name, rooms]) => ({ name, rooms }));
  });

  protected readonly roomName = computed(
    () => this.rooms().find((r) => r.id === this.room())?.name ?? '',
  );

  protected readonly filtered = computed<UsageResultDto[]>(() => {
    const room = this.room();
    const q = this.query().trim().toLowerCase();
    const from = this.dateFrom();
    const to = this.dateTo();
    const types = this.typeFilter();
    const cats = this.categoryFilter();
    const { key, asc } = this.sort();

    const list = this.usages().filter(
      (u) =>
        (!room || u.roomId === room) &&
        (!from || u.date >= from) &&
        (!to || u.date <= to) &&
        (!types.size || types.has(u.usageType)) &&
        (!cats.size || cats.has(u.category)) &&
        (!q ||
          [u.unit, u.weaponName, u.recordedBy, u.roomName]
            .join(' ')
            .toLowerCase()
            .includes(q)),
    );
    const dir = asc ? 1 : -1;
    return [...list].sort((a, b) => compare(a, b, key) * dir);
  });

  /** Table rows: grouped by room when sorted by room without a room filter. */
  protected readonly rows = computed<ShotsRow[]>(() => {
    const list = this.filtered();
    if (this.room() || this.sort().key !== 'room') {
      return list.map((usage) => ({ kind: 'usage', usage }));
    }
    const sums = new Map<string, number>();
    for (const u of list) sums.set(u.roomName, (sums.get(u.roomName) ?? 0) + u.shots);
    const rows: ShotsRow[] = [];
    let last: string | null = null;
    for (const usage of list) {
      if (usage.roomName !== last) {
        last = usage.roomName;
        rows.push({ kind: 'group', roomName: usage.roomName, shots: sums.get(usage.roomName) ?? 0 });
      }
      rows.push({ kind: 'usage', usage });
    }
    return rows;
  });

  protected readonly displayedShots = computed(() =>
    this.filtered().reduce((sum, u) => sum + u.shots, 0),
  );
  protected readonly allSelected = computed(() => {
    const list = this.filtered();
    const sel = this.selected();
    return list.length > 0 && list.every((u) => sel.has(u.id));
  });
  protected readonly units = computed(() =>
    [...new Set(this.usages().map((u) => u.unit))].sort((a, b) => a.localeCompare(b)),
  );

  // Drawer / form --------------------------------------------------------
  protected readonly drawerOpen = signal(false);
  protected readonly editId = signal<string | null>(null);
  protected readonly editing = computed(() => this.usages().find((u) => u.id === this.editId()) ?? null);
  protected readonly confirmDiscard = signal(false);
  protected readonly submitted = signal(false);

  /**
   * One Nutzung = header + n positions (B1 6.1.3, 7.4.2): Stellungsraum,
   * Einheit, Datum, Zeitraum (Viertelstunden), Kategorie, zivile Nutzungsart,
   * Anzahl Personen, and per position a zulässige Kombination with its Menge.
   */
  protected readonly form = this.fb.nonNullable.group(
    {
      roomId: ['', Validators.required],
      unit: ['', [Validators.required, Validators.maxLength(256)]],
      date: ['', Validators.required],
      timeFrom: ['', [Validators.required, quarterHourValidator]],
      timeTo: ['', [Validators.required, quarterHourValidator]],
      usageType: ['military' as UsageCreateDto['usageType'], Validators.required],
      civilUsageKind: ['' as '' | UsageCreateDto['civilUsageKind']],
      personCount: [null as number | null, [Validators.min(0), Validators.max(100000)]],
      positions: this.fb.array<FormGroup<PositionForm>>([], [Validators.required, Validators.minLength(1)]),
      note: [''],
    },
    { validators: usageFormValidator },
  );

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly dirty = signal(false);

  protected readonly formValueRoom = computed(() => this.formValue()?.roomId ?? '');
  protected readonly formIsCivil = computed(() => this.formValue()?.usageType === 'civil');
  protected get positions(): FormArray<FormGroup<PositionForm>> {
    return this.form.controls.positions;
  }
  /** Sortable column headers: sort key + translation key. */
  protected readonly columns: readonly (readonly [ShotsSortKey, string])[] = [
    ['room', 'shots.columns.room'],
    ['unit', 'shots.columns.unit'],
    ['date', 'shots.columns.period'],
    ['usageType', 'shots.columns.type'],
    ['category', 'shots.columns.category'],
    ['weapon', 'shots.columns.weapon'],
    ['shots', 'shots.columns.shots'],
    ['recordedBy', 'shots.columns.recorded_by'],
  ];

  /** Combinations allowed for the selected room, active ones only for new entries (5.17). */
  protected readonly roomCombinations = computed<UsageCombinationDto[]>(() => {
    const roomId = this.formValue()?.roomId ?? '';
    return this.combinations().filter((c) => c.roomId === roomId && (c.enabled || Boolean(this.editId())));
  });
  /** Waffenkategorien the room allows (guided pick: category first, then the combination, B1 11.2.3). */
  protected readonly formCategories = computed(() =>
    [...new Set(this.roomCombinations().map((c) => c.category))].sort(),
  );
  /** Combinations a position may pick: the room's, minus those other positions already use. */
  protected combinationsFor(index: number): UsageCombinationDto[] {
    const category = this.positions.at(index)?.controls.category.value ?? '';
    const taken = new Set(this.positions.controls.map((g, i) => (i === index ? '' : g.controls.combinationId.value)));
    return this.roomCombinations().filter((c) => (!category || c.category === category) && !taken.has(c.combinationId));
  }
  protected unitOf(index: number): 'shots' | 'kg' {
    const id = this.positions.at(index)?.controls.combinationId.value;
    return this.combinations().find((c) => c.combinationId === id)?.quantityUnit ?? 'shots';
  }
  protected readonly duration = computed(() => {
    const v = this.formValue();
    const minutes = minutesBetween(v?.timeFrom ?? '', v?.timeTo ?? '');
    return minutes > 0 ? { h: Math.floor(minutes / 60), m: minutes % 60 } : null;
  });

  // Delete / toast -------------------------------------------------------
  protected readonly pendingDelete = signal<UsageResultDto[]>([]);
  protected readonly pendingShots = computed(() =>
    this.pendingDelete().reduce((sum, u) => sum + u.shots, 0),
  );
  protected readonly toast = signal<Toast | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    // Reload when the area or the year changes (the facade returns one year).
    effect(() => {
      this.areaId();
      this.year();
      untracked(() => this.getData());
    });
    // The positions depend on the room: a room change clears their combinations.
    this.form.controls.roomId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      for (const g of this.positions.controls) {
        g.controls.category.setValue('');
        g.controls.combinationId.setValue('');
      }
    });
    // «Zivile Nutzungsart» only exists for «Zivil» (B1 11.2.2).
    this.form.controls.usageType.valueChanges.pipe(takeUntilDestroyed()).subscribe((type) => {
      if (type !== 'civil') this.form.controls.civilUsageKind.setValue('');
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.drawerOpen()) this.dirty.set(true);
    });
  }

  /** ComponentBase calls this on init and on every DATA_RELOAD emit. */
  override getData(): void {
    const id = this.areaId();
    if (id) void this.facade.load(id, this.year());
  }

  // Filters --------------------------------------------------------------
  protected setYear(value: string): void {
    this.year.set(Number(value));
    this.selected.set(new Set());
  }

  protected selectRoom(id: string): void {
    this.room.set(id);
  }

  protected toggleType(type: string): void {
    this.typeFilter.update((set) => toggled(set, type));
  }

  protected toggleCategory(category: string): void {
    this.categoryFilter.update((set) => toggled(set, category));
  }

  protected resetFilters(): void {
    this.room.set('');
    this.query.set('');
    this.dateFrom.set(`${this.year()}-01-01`);
    this.dateTo.set(`${this.year()}-12-31`);
    this.typeFilter.set(new Set());
    this.categoryFilter.set(new Set());
  }

  protected sortBy(key: ShotsSortKey): void {
    this.sort.update((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: true }));
  }

  // Selection ------------------------------------------------------------
  protected toggleSelect(id: string, on: boolean): void {
    this.selected.update((set) => {
      const next = new Set(set);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  protected toggleAll(on: boolean): void {
    this.selected.update((set) => {
      const next = new Set(set);
      for (const u of this.filtered()) {
        if (on) next.add(u.id);
        else next.delete(u.id);
      }
      return next;
    });
  }

  protected clearSelection(): void {
    this.selected.set(new Set());
  }

  // Drawer ---------------------------------------------------------------
  protected openForm(usage?: UsageResultDto): void {
    if (this.readonly() && !usage) return;
    this.editId.set(usage?.id ?? null);
    this.submitted.set(false);
    this.confirmDiscard.set(false);
    this.positions.clear();
    for (const p of usage?.positions ?? [{ category: '', combinationId: '', quantity: 0 }]) {
      this.positions.push(this.positionGroup(p.category, p.combinationId, p.quantity));
    }
    this.form.reset({
      roomId: usage?.roomId ?? this.room() ?? '',
      unit: usage?.unit ?? '',
      date: usage?.date ?? '',
      timeFrom: usage?.timeFrom ?? '',
      timeTo: usage?.timeTo ?? '',
      usageType: usage?.usageType ?? 'military',
      civilUsageKind: usage?.civilUsageKind ?? '',
      personCount: usage?.personCount ?? null,
      positions: this.positions.getRawValue(),
      note: usage?.note ?? '',
    });
    if (this.readonly()) this.form.disable();
    else this.form.enable();
    this.dirty.set(false);
    this.drawerOpen.set(true);
  }

  protected requestClose(): void {
    if (this.dirty() && !this.readonly()) {
      this.confirmDiscard.set(true);
      return;
    }
    this.closeForm();
  }

  protected closeForm(): void {
    this.confirmDiscard.set(false);
    this.drawerOpen.set(false);
    this.dirty.set(false);
  }

  protected setDate(offsetDays: number): void {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    this.form.controls.date.setValue(toIsoDate(d));
  }

  protected setTime(slot: keyof typeof QUICK_TIMES): void {
    const [from, to] = QUICK_TIMES[slot];
    this.form.controls.timeFrom.setValue(from);
    this.form.controls.timeTo.setValue(to);
  }

  private positionGroup(category = '', combinationId = '', quantity = 0): FormGroup<PositionForm> {
    const group = this.fb.nonNullable.group({
      category: [category],
      combinationId: [combinationId, Validators.required],
      quantity: [quantity, [Validators.required, Validators.min(0.001), Validators.pattern(QUANTITY)]],
    });
    // Built outside the constructor (openForm / addPosition): pass the DestroyRef explicitly.
    group.controls.category.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((c) => {
      const chosen = this.combinations().find((x) => x.combinationId === group.controls.combinationId.value);
      if (chosen && c && chosen.category !== c) group.controls.combinationId.setValue('');
    });
    return group;
  }

  /** Multi-Eintrag (B1 11.2.3): another Waffe/Kaliber line of the same Nutzung. */
  protected addPosition(): void {
    if (this.readonly()) return;
    this.positions.push(this.positionGroup());
    this.dirty.set(true);
  }

  protected removePosition(index: number): void {
    if (this.readonly() || this.positions.length <= 1) return;
    this.positions.removeAt(index);
    this.dirty.set(true);
  }

  /** Stepper per position: 50 shots, or 0.1 kg when the quantity is explosive. */
  protected step(index: number, direction: -1 | 1): void {
    const control = this.positions.at(index)?.controls.quantity;
    if (!control) return;
    const delta = direction * (this.unitOf(index) === 'kg' ? 0.1 : 50);
    const current = Number(String(control.value).replace(',', '.')) || 0;
    control.setValue(Math.max(0, Math.round((current + delta) * 1000) / 1000));
  }

  protected invalid(control: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[control];
    return this.submitted() && c.invalid;
  }

  protected invalidPosition(index: number, control: keyof PositionForm): boolean {
    const c = this.positions.at(index)?.controls[control];
    return this.submitted() && Boolean(c?.invalid);
  }

  protected async save(): Promise<void> {
    this.submitted.set(true);
    if (this.form.invalid || this.readonly()) return;
    const v = this.form.getRawValue();
    const dto: UsageCreateDto = {
      roomId: v.roomId,
      unit: v.unit.trim(),
      date: v.date,
      timeFrom: v.timeFrom,
      timeTo: v.timeTo,
      usageType: v.usageType,
      civilUsageKind: v.usageType === 'civil' && v.civilUsageKind ? v.civilUsageKind : null,
      personCount: v.personCount === null || v.personCount === undefined || (v.personCount as unknown) === '' ? null : Number(v.personCount),
      positions: v.positions.map((p) => ({
        combinationId: p.combinationId,
        quantity: Number(String(p.quantity).replace(',', '.')),
      })),
      note: v.note?.trim() || null,
    };
    const id = this.editId();
    const result = id ? await this.facade.updateUsage(id, dto) : await this.facade.create(dto);
    if (!result) return; // facade.error() is shown in the drawer
    this.closeForm();
    this.showToast({ key: id ? 'shots.toast.updated' : 'shots.toast.created' });
  }

  // Delete ---------------------------------------------------------------
  protected askDelete(ids: string[]): void {
    if (this.readonly() || !ids.length) return;
    this.pendingDelete.set(this.usages().filter((u) => ids.includes(u.id)));
  }

  protected cancelDelete(): void {
    this.pendingDelete.set([]);
  }

  protected async confirmDelete(): Promise<void> {
    const ids = this.pendingDelete().map((u) => u.id);
    this.pendingDelete.set([]);
    const removed = await this.facade.remove(ids);
    this.selected.update((set) => {
      const next = new Set(set);
      for (const id of removed) next.delete(id);
      return next;
    });
    if (removed.length) {
      this.showToast({ key: 'shots.toast.deleted', params: { n: removed.length }, undo: removed });
    }
  }

  protected async undo(): Promise<void> {
    const ids = this.toast()?.undo ?? [];
    this.dismissToast();
    if (ids.length) await this.facade.restore(ids);
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

  protected rowId(_index: number, row: ShotsRow): string {
    return row.kind === 'usage' ? row.usage.id : `group:${row.roomName}`;
  }
}

function toggled(set: ReadonlySet<string>, value: string): ReadonlySet<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function compare(a: UsageResultDto, b: UsageResultDto, key: ShotsSortKey): number {
  switch (key) {
    case 'room':
      return a.roomName.localeCompare(b.roomName) || dateOrder(a, b);
    case 'unit':
      return a.unit.localeCompare(b.unit) || dateOrder(a, b);
    case 'date':
      return dateOrder(a, b);
    case 'usageType':
      return a.usageType.localeCompare(b.usageType) || dateOrder(a, b);
    case 'category':
      return a.category.localeCompare(b.category) || dateOrder(a, b);
    case 'weapon':
      return a.weaponName.localeCompare(b.weaponName) || dateOrder(a, b);
    case 'shots':
      return a.shots - b.shots || dateOrder(a, b);
    case 'recordedBy':
      return a.recordedBy.localeCompare(b.recordedBy) || dateOrder(a, b);
  }
}

function dateOrder(a: UsageResultDto, b: UsageResultDto): number {
  return `${a.date} ${a.timeFrom}`.localeCompare(`${b.date} ${b.timeFrom}`);
}

/** Minutes between two `HH:mm` strings, 0 when incomplete. */
export function minutesBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  return th * 60 + tm - (fh * 60 + fm);
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
