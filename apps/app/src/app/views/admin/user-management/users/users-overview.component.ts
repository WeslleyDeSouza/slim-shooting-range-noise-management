import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import { AUTH_STORE } from '@app-galaxy/auth-ui';
import { APP_ROUTES } from '@slim/shared';
import { UsersFacade } from './_data/users.facade';
import { AdminUser, filterAdminUsers, initialsOf } from './_data/user.model';

const I18N = 'admin.users';

/**
 * Ein Abschnitt der Gruppierung «nach letztem Login».
 *
 * Die jüngste Vergangenheit wird feiner aufgeteilt als die ältere: wer heute
 * da war, ist eine andere Aussage als wer diesen Monat da war. Weiter zurück
 * reichen Monate.
 */
interface UserLoginGroup {
  key: string;
  /** Sortierwert, absteigend. Ohne Login der kleinste, damit «Nie» hinten steht. */
  rank: number;
  /** Monatsanfang, nur bei den Monatsabschnitten gesetzt. */
  date: Date | null;
  /** Fester Textschlüssel für Heute, Gestern, Diese Woche und Nie. */
  labelKey?: string;
  users: AdminUser[];
}

/** Start des Tages, damit Vergleiche nicht an der Uhrzeit scheitern. */
function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

/**
 * Montag der laufenden Woche.
 *
 * `getDay()` zählt ab Sonntag; in der Schweiz beginnt die Woche am Montag,
 * deshalb die Verschiebung.
 */
function startOfWeek(value: Date): Date {
  const day = startOfDay(value);
  const offset = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - offset);
  return day;
}

/**
 * Benutzerverwaltung unter `/admin/users` — ersetzt den Benutzer-Screen des
 * Shell-Remotes. Spalten nach der bisherigen Konfiguration (Name, E-Mail,
 * Telefon, Rollen-Chips, letzter Login, erstellt), UX-Aufwertung: Avatar-
 * Initialen, Rollen als Chips, Suche über alle Felder.
 */
@Component({
  selector: 'app-elo-users-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink, DatePipe],
  templateUrl: './users-overview.component.html',
  styleUrl: './users-overview.component.scss',
})
export class EloUsersOverviewComponent extends ComponentBase {
  protected readonly prefix = I18N;
  protected readonly routes = APP_ROUTES;
  protected readonly facade = inject(UsersFacade);
  /** Row waiting for the confirm sheet. */
  readonly pendingDelete = signal<AdminUser | null>(null);
  private readonly translate = inject(TranslateService);
  private readonly sessionStore = inject(AUTH_STORE.SessionStore);

  readonly query = signal('');
  // Newest login first by default; users without a login sort to the end.
  readonly sortColumn = signal<'lastName' | 'email' | 'loginLast' | 'createdAt'>('loginLast');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly initials = initialsOf;

  readonly filtered = computed(() => {
    const rows = filterAdminUsers(this.facade.users(), this.query());
    const column = this.sortColumn();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[column] ?? '';
      const bv = b[column] ?? '';
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  });

  /**
   * Grouping by the month of the last login, like the previous user screen:
   * newest month first, users who never signed in as the last bucket.
   */
  readonly groupByLoginMonth = signal(false);
  readonly collapsedGroups = signal<Record<string, boolean>>({});

  readonly groups = computed<UserLoginGroup[]>(() => {
    const users = this.filtered();
    if (!this.groupByLoginMonth()) {
      return users.length
        ? [{ key: '__all__', rank: 0, date: null, users }]
        : [];
    }
    const now = new Date();
    const today = startOfDay(now);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekStart = startOfWeek(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const buckets = new Map<string, UserLoginGroup>();
    for (const user of users) {
      const login = user.loginLast ? new Date(user.loginLast) : null;
      const valid = login && !isNaN(login.getTime()) ? login : null;
      const bucket = this.bucketFor(valid, {
        today,
        yesterday,
        weekStart,
        monthStart,
      });

      let group = buckets.get(bucket.key);
      if (!group) {
        group = { ...bucket, users: [] };
        buckets.set(bucket.key, group);
      }
      group.users.push(user);
    }

    return [...buckets.values()].sort((a, b) => b.rank - a.rank);
  });

  /**
   * Ordnet einen Login seinem Abschnitt zu.
   *
   * `rank` ist der Zeitstempel des Abschnitts; die festen Abschnitte liegen
   * damit automatisch vor den Monaten, und «Nie» hat den kleinsten Wert.
   * «Diese Woche» meint den Rest der Woche, also ohne heute und gestern.
   */
  private bucketFor(
    login: Date | null,
    marks: { today: Date; yesterday: Date; weekStart: Date; monthStart: Date },
  ): Omit<UserLoginGroup, 'users'> {
    if (!login) {
      return { key: '__never__', rank: -1, date: null, labelKey: 'group_never' };
    }

    const day = startOfDay(login);

    if (day.getTime() >= marks.today.getTime()) {
      return {
        key: '__today__',
        rank: marks.today.getTime(),
        date: null,
        labelKey: 'group_today',
      };
    }
    if (day.getTime() >= marks.yesterday.getTime()) {
      return {
        key: '__yesterday__',
        rank: marks.yesterday.getTime(),
        date: null,
        labelKey: 'group_yesterday',
      };
    }
    if (day.getTime() >= marks.weekStart.getTime()) {
      return {
        key: '__week__',
        rank: marks.weekStart.getTime(),
        date: null,
        labelKey: 'group_this_week',
      };
    }

    const month = new Date(login.getFullYear(), login.getMonth(), 1);
    return {
      key: `${login.getFullYear()}-${String(login.getMonth() + 1).padStart(2, '0')}`,
      rank: month.getTime(),
      date: month,
    };
  }

  toggleGrouping(): void {
    this.groupByLoginMonth.update((current) => !current);
    this.collapsedGroups.set({});
  }

  toggleGroup(key: string): void {
    this.collapsedGroups.update((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  isCollapsed(key: string): boolean {
    return this.groupByLoginMonth() && !!this.collapsedGroups()[key];
  }

  setAllCollapsed(collapsed: boolean): void {
    this.collapsedGroups.set(
      collapsed
        ? Object.fromEntries(this.groups().map((group) => [group.key, true]))
        : {},
    );
  }

  groupLabel(group: UserLoginGroup): string {
    if (group.labelKey) {
      return this.t(group.labelKey);
    }
    if (!group.date) {
      return this.t('group_never');
    }
    return group.date.toLocaleDateString(this.translate.lang || 'de', {
      month: 'long',
      year: 'numeric',
    });
  }

  private t(key: string): string {
    return this.translate.translate(`${I18N}.${key}`) ?? key;
  }

  /** ComponentBase ruft dies beim Init und bei jedem DATA_RELOAD-Emit auf. */
  getData(): void {
    void this.facade.load();
    // Who may unlock (Si001 T7.4) depends on the own roles; fail-closed.
    void this.facade.loadRoles();
    void this.facade.loadMyRoles(
      String(this.sessionStore.changed()?.user?.userId ?? ''),
    );
  }

  onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  toggleSort(column: 'lastName' | 'email' | 'loginLast' | 'createdAt'): void {
    if (this.sortColumn() === column) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(column);
      this.sortDir.set('asc');
    }
  }

  sortMark(column: string): string {
    if (this.sortColumn() !== column) {
      return '';
    }
    return this.sortDir() === 'asc' ? ' ↑' : ' ↓';
  }

  /** Lifts the lock in place; the facade updates the row on success. */
  async unlock(user: AdminUser): Promise<void> {
    await this.facade.unlock(user.userId);
  }

  displayName(user: AdminUser): string {
    return `${user.firstName} ${user.lastName}`.trim() || user.email;
  }

  /** Opens the confirm sheet; `confirmDelete()` does the work. */
  remove(user: AdminUser): void {
    this.pendingDelete.set(user);
  }

  async confirmDelete(): Promise<void> {
    const user = this.pendingDelete();
    if (!user) {
      return;
    }
    this.pendingDelete.set(null);
    if (await this.facade.remove(user.userId)) {
      await this.facade.load();
    }
  }
}
