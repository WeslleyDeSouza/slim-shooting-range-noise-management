import { formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import { APP_ROUTES } from '@slim/shared';
import type { LogItemDto } from '@ui-slim/apiClient';
import { LogsFacade, SYSTEM_USER } from './_data/logs.facade';

const I18N = 'admin.logs';

/** Chip order (ELO mock); only actions present in the facets are shown. */
const ACTION_ORDER = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'GET',
  'READ',
  'MAIL',
  'AUTH',
  'EXPORT',
  'IMPORT',
  'TOGGLE',
  'BACKUP',
  'ERROR',
];

/** Badge modifier per action (design-system states). */
const ACTION_BADGE: Record<string, string> = {
  CREATE: 'slim-badge--success',
  UPDATE: 'slim-badge--info',
  DELETE: 'slim-badge--danger',
  ERROR: 'slim-badge--danger',
  AUTH: 'slim-badge--warning',
  TOGGLE: 'slim-badge--warning',
  EXPORT: 'slim-badge--info',
  IMPORT: 'slim-badge--info',
};

export type LogRange = 'all' | 'today' | '7' | '30';
export type Severity = 'crit' | 'warn' | null;

export interface LogView {
  item: LogItemDto;
  day: string;
  dayLabel: string;
  time: string;
  severity: Severity;
  title: string;
  sub: string;
  userName: string;
  initials: string;
  isSystem: boolean;
  ref: string;
  diff: [string, string, string][];
  details: [string, string][];
  rawJson: string;
}

export interface DayGroup {
  day: string;
  label: string;
  entries: LogView[];
}

/**
 * Logbook (`slm 56`, ELO pattern): stats row, full-text search + section /
 * user / range filters, action chips with counts, day-grouped append-only
 * list with severity markers, XLSX export (built and logged by the API) and
 * a detail drawer (Wer/Wann/Wo, old→new diff, details, raw JSON). Filters
 * run server-side through `admin/logs/list`; the drawer content is derived
 * from the stored `data` JSON (`changes: {field: {old, new}}` → diff table).
 */
@Component({
  selector: 'app-logs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink],
  host: {
    '(document:keydown.escape)': 'closeDrawer()',
  },
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.scss',
})
export class AppLogsComponent extends ComponentBase {
  protected readonly prefix = I18N;
  protected readonly routes = APP_ROUTES;
  protected readonly systemUser = SYSTEM_USER;
  protected readonly facade = inject(LogsFacade);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);

  readonly query = signal('');
  readonly section = signal('');
  readonly user = signal('');
  readonly range = signal<LogRange>('today');
  readonly actionFilter = signal<ReadonlySet<string>>(new Set<string>());
  readonly selected = signal<LogView | null>(null);
  readonly exporting = signal(false);
  readonly exportError = signal(false);

  private queryTimer: ReturnType<typeof setTimeout> | null = null;

  /** ComponentBase calls this on init and on every DATA_RELOAD emit. */
  override getData(): void {
    // Facets share the range filter so the chip counts match the list.
    this.facade.loadFacets(this.fromDate());
    this.reload();
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.translate(`${I18N}.${key}`, params) ?? key;
  }

  nf(value: number): string {
    return formatNumber(value, this.locale, '1.0-0');
  }

  badgeClass(action: string): string {
    return ACTION_BADGE[action] ?? '';
  }

  /* ============ Filters ============ */

  private fromDate(): string | undefined {
    const range = this.range();
    if (range === 'all') return undefined;
    const date = new Date();
    if (range !== 'today') date.setDate(date.getDate() - Number(range));
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
  }

  private reload(): void {
    this.facade.load({
      q: this.query().trim() || undefined,
      section: this.section() || undefined,
      user: this.user() || undefined,
      actions: [...this.actionFilter()],
      from: this.fromDate(),
    });
  }

  onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    if (this.queryTimer) clearTimeout(this.queryTimer);
    this.queryTimer = setTimeout(() => this.reload(), 300);
  }

  onSection(event: Event): void {
    this.section.set((event.target as HTMLSelectElement).value);
    this.reload();
  }

  onUser(event: Event): void {
    this.user.set((event.target as HTMLSelectElement).value);
    this.reload();
  }

  onRange(event: Event): void {
    this.range.set((event.target as HTMLSelectElement).value as LogRange);
    this.facade.loadFacets(this.fromDate());
    this.reload();
  }

  toggleAction(action: string): void {
    const next = new Set(this.actionFilter());
    if (next.has(action)) next.delete(action);
    else next.add(action);
    this.actionFilter.set(next);
    this.reload();
  }

  hasActiveFilters(): boolean {
    return (
      this.actionFilter().size > 0 ||
      !!this.query().trim() ||
      !!this.section() ||
      !!this.user()
    );
  }

  clearFilters(): void {
    this.query.set('');
    this.section.set('');
    this.user.set('');
    this.range.set('all');
    this.actionFilter.set(new Set());
    this.facade.loadFacets(this.fromDate());
    this.reload();
  }

  readonly actionChips = computed(() => {
    const counts = this.facade.facets()?.actionCounts ?? {};
    return ACTION_ORDER.filter((action) => counts[action] > 0).map((action) => ({
      action,
      count: counts[action],
    }));
  });

  /* ============ View model ============ */

  readonly entries = computed<LogView[]>(() =>
    this.facade.items().map((item) => this.toView(item)),
  );

  readonly dayGroups = computed<DayGroup[]>(() => {
    const groups: DayGroup[] = [];
    for (const entry of this.entries()) {
      const last = groups[groups.length - 1];
      if (last && last.day === entry.day) last.entries.push(entry);
      else groups.push({ day: entry.day, label: entry.dayLabel, entries: [entry] });
    }
    return groups;
  });

  readonly writeCount = computed(
    () =>
      this.entries().filter((entry) =>
        ['CREATE', 'UPDATE', 'DELETE', 'IMPORT'].includes(entry.item.action),
      ).length,
  );

  readonly userCount = computed(
    () => new Set(this.entries().map((entry) => entry.userName)).size,
  );

  readonly severityCount = computed(
    () => this.entries().filter((entry) => !!entry.severity).length,
  );

  private toView(item: LogItemDto): LogView {
    const created = new Date(item.createdAt);
    const valid = !isNaN(created.getTime());
    const day = valid ? created.toISOString().slice(0, 10) : '';
    const data = parseData(item);
    const user = item.user as { firstName?: string; lastName?: string } | null;
    const isSystem = !!item.isSystem || !user;
    const userName = isSystem
      ? this.t('system')
      : [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '—';
    const actionLabel = this.t(`action_${item.action.toLowerCase()}`);
    const ref = [item.refType, item.refId].filter(Boolean).join('/') || '—';

    return {
      item,
      day,
      dayLabel: this.dayLabel(day),
      time: valid ? `${pad(created.getHours())}:${pad(created.getMinutes())}` : '',
      severity: severityOf(item, data),
      title: item.message?.trim() || `${actionLabel} · ${item.section}`,
      sub: [ref !== '—' ? ref : null, item.section].filter(Boolean).join(' · '),
      userName,
      initials: isSystem ? 'SYS' : initialsOf(userName),
      isSystem,
      ref,
      diff: diffOf(data),
      details: detailsOf(data),
      rawJson: JSON.stringify(data ?? item.data ?? {}, null, 2),
    };
  }

  private dayLabel(day: string): string {
    if (!day) return '—';
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const [y, m, d] = day.split('-');
    const formatted = `${+d}.${+m}.${y}`;
    if (day === today) return `${this.t('today')} · ${formatted}`;
    if (day === yesterday) return `${this.t('yesterday')} · ${formatted}`;
    return formatted;
  }

  /* ============ Drawer ============ */

  openDrawer(entry: LogView): void {
    this.selected.set(entry);
  }

  closeDrawer(): void {
    this.selected.set(null);
  }

  copyJson(): void {
    const selected = this.selected();
    if (selected && navigator.clipboard) {
      void navigator.clipboard.writeText(selected.rawJson);
    }
  }

  /** «Verwandte Einträge»: filters the list by the entry's reference. */
  showRelated(entry: LogView): void {
    this.closeDrawer();
    this.clearFilters();
    this.query.set(entry.item.refId ?? '');
    this.reload();
  }

  /* ============ Export ============ */

  /** Server-built XLSX with the active filters; the API logs the export. */
  async exportXlsx(): Promise<void> {
    this.exporting.set(true);
    this.exportError.set(false);
    try {
      const blob = await this.facade.exportXlsx(this.translate.lang);
      const stamp = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `logbuch_export_${stamp}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      this.exportError.set(true);
    } finally {
      this.exporting.set(false);
    }
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function parseData(item: LogItemDto): Record<string, unknown> | null {
  const raw = item.data;
  if (!raw) return null;
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(raw));
    return typeof parsed === 'object' && parsed ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Severity markers: deletions and errors are critical, failed auth attempts
 * and toggles are warnings.
 */
export function severityOf(item: LogItemDto, data: Record<string, unknown> | null): Severity {
  if (item.action === 'DELETE' || item.action === 'ERROR') return 'crit';
  if (item.action === 'AUTH') {
    const result = (data as { result?: string } | null)?.result;
    return result && result !== 'ok' ? 'warn' : null;
  }
  if (item.action === 'TOGGLE') return 'warn';
  return null;
}

/** `data.changes: {field: {old, new}}` → diff rows for the drawer. */
export function diffOf(data: Record<string, unknown> | null): [string, string, string][] {
  const changes = (data as { changes?: Record<string, unknown> } | null)?.changes;
  if (!changes || typeof changes !== 'object') return [];
  const rows: [string, string, string][] = [];
  for (const [field, change] of Object.entries(changes)) {
    if (change && typeof change === 'object' && 'old' in change) {
      const typed = change as { old?: unknown; new?: unknown };
      rows.push([field, short(typed.old), short(typed.new)]);
    }
  }
  return rows;
}

/** First-level scalars of the data payload → detail rows. */
export function detailsOf(data: Record<string, unknown> | null): [string, string][] {
  if (!data) return [];
  const rows: [string, string][] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === 'changes') continue;
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      rows.push([key, short(value)]);
    }
    if (rows.length >= 10) break;
  }
  return rows;
}

function short(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}
