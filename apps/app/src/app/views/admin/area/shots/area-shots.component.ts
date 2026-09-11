import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import type {
  UsageCreateDto,
  UsageResultDto,
  UsageRoomDto,
  UsageWeaponDto,
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

/** The four weapon categories of the usage form (5.11), API order. */
export const WEAPON_CATEGORIES = [
  'artillery',
  'air_defence',
  'handguns',
  'mortar',
] as const;

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

/** Reactive-form group validator: «Bis» must be after «Von». */
function timeRangeValidator(group: {
  get(name: string): { value: unknown } | null;
}): ValidationErrors | null {
  const from = group.get('timeFrom')?.value as string;
  const to = group.get('timeTo')?.value as string;
  return from && to && to <= from ? { timeRange: true } : null;
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

  protected readonly categories = WEAPON_CATEGORIES;
  protected readonly types = ['military', 'civil'] as const;

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
  protected readonly weapons = this.facade.weapons;
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

  protected readonly form = this.fb.nonNullable.group(
    {
      roomId: ['', Validators.required],
      unit: ['', [Validators.required, Validators.maxLength(120)]],
      date: ['', Validators.required],
      timeFrom: ['', Validators.required],
      timeTo: ['', Validators.required],
      usageType: ['military' as UsageCreateDto['usageType'], Validators.required],
      category: ['', Validators.required],
      weaponId: ['', Validators.required],
      shots: [0, [Validators.required, Validators.min(1)]],
      note: [''],
    },
    { validators: timeRangeValidator },
  );

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly dirty = signal(false);

  protected readonly formValueRoom = computed(() => this.formValue()?.roomId ?? '');
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

  protected readonly roomWeapons = computed(() => {
    const roomId = this.formValue()?.roomId ?? '';
    return this.weapons().filter((w) => w.roomId === roomId);
  });
  protected readonly formCategories = computed(() =>
    WEAPON_CATEGORIES.filter((c) => this.roomWeapons().some((w) => w.category === c)),
  );
  protected readonly formWeapons = computed<UsageWeaponDto[]>(() => {
    const category = this.formValue()?.category ?? '';
    return this.roomWeapons().filter((w) => !category || w.category === category);
  });
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
    // Category / weapon depend on the room: keep the selects consistent.
    this.form.controls.roomId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.form.controls.category.setValue('', { emitEvent: true });
      this.form.controls.weaponId.setValue('');
    });
    this.form.controls.category.valueChanges.pipe(takeUntilDestroyed()).subscribe((category) => {
      const weapon = this.weapons().find((w) => w.id === this.form.controls.weaponId.value);
      if (weapon && weapon.category !== category) this.form.controls.weaponId.setValue('');
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
    this.form.reset({
      roomId: usage?.roomId ?? this.room() ?? '',
      unit: usage?.unit ?? '',
      date: usage?.date ?? '',
      timeFrom: usage?.timeFrom ?? '',
      timeTo: usage?.timeTo ?? '',
      usageType: usage?.usageType ?? 'military',
      category: usage?.category ?? '',
      weaponId: usage?.weaponId ?? '',
      shots: usage?.shots ?? 0,
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

  protected step(delta: number): void {
    const current = Number(this.form.controls.shots.value) || 0;
    this.form.controls.shots.setValue(Math.max(0, current + delta));
  }

  protected invalid(control: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[control];
    return this.submitted() && c.invalid;
  }

  protected async save(): Promise<void> {
    this.submitted.set(true);
    if (this.form.invalid || this.readonly()) return;
    const v = this.form.getRawValue();
    const dto: UsageCreateDto = {
      roomId: v.roomId,
      weaponId: v.weaponId,
      unit: v.unit.trim(),
      date: v.date,
      timeFrom: v.timeFrom,
      timeTo: v.timeTo,
      usageType: v.usageType,
      shots: Number(v.shots),
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
