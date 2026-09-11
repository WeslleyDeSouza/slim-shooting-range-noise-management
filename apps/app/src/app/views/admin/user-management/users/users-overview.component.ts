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
import { AD_TABLE_STYLES } from '../../_common/table.styles';
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
  styles: [AD_TABLE_STYLES, `
    .ad-user-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .ad-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--ad-red, #d8232a);
      color: #fff;
      display: grid;
      place-items: center;
      font-size: 12px;
      font-weight: 700;
      flex: none;
    }
    .ad-role-chip {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--ad-bg-soft, #f1f2f4);
      border: 1px solid var(--ad-line);
      font-size: 11.5px;
      margin: 1px 4px 1px 0;
      white-space: nowrap;
    }
    .ad-lock-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 1px 8px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--ad-red, #d8232a) 10%, transparent);
      border: 1px solid var(--ad-red, #d8232a);
      color: var(--ad-red, #d8232a);
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
      margin-top: 2px;
    }
    .ad-u-toggle {
      height: 34px;
      padding: 0 14px;
      border-radius: 17px;
      border: 1px solid var(--ad-line-strong);
      background: var(--ad-card);
      font-size: 13px;
      font-weight: 500;
      color: var(--ad-gray-700);
      cursor: pointer;
      font-family: inherit;
      white-space: nowrap;
    }
    .ad-u-toggle[aria-pressed='true'] {
      background: var(--ad-ink);
      border-color: var(--ad-ink);
      color: var(--ad-card);
    }
    .ad-u-fold {
      border: 0;
      background: transparent;
      color: var(--ad-link);
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      white-space: nowrap;
    }
    .ad-u-group-row td {
      background: var(--ad-bg);
      padding: 0;
    }
    .ad-u-group-row button {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      border: 0;
      background: transparent;
      padding: 6px 14px;
      font-family: inherit;
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: var(--ad-gray-500);
      cursor: pointer;
      text-align: left;
    }
    .ad-u-group-row svg {
      transition: transform 0.15s;
    }
    .ad-u-group-row svg.open {
      transform: rotate(90deg);
    }
    .ad-u-group-count {
      display: inline-block;
      padding: 1px 8px;
      border-radius: 9px;
      background: var(--ad-card);
      border: 1px solid var(--ad-line);
      font-variant-numeric: tabular-nums;
      letter-spacing: 0;
      text-transform: none;
    }
  `],
  template: `
    <div class="ad-page">
      <div class="ad-toolbar">
        <div class="ad-search">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          <input
            type="text"
            [placeholder]="prefix + '.search' | translate"
            [value]="query()"
            (input)="onQuery($event)"
          />
        </div>
        <button
          type="button"
          class="ad-u-toggle"
          data-action="users.groupByLogin"
          [attr.aria-pressed]="groupByLoginMonth()"
          (click)="toggleGrouping()"
        >
          {{ prefix + '.group_by_login' | translate }}
        </button>
        @if (groupByLoginMonth()) {
          <button type="button" class="ad-u-fold" (click)="setAllCollapsed(true)">
            {{ prefix + '.collapse_all' | translate }}
          </button>
          <button type="button" class="ad-u-fold" (click)="setAllCollapsed(false)">
            {{ prefix + '.expand_all' | translate }}
          </button>
        }
        <div class="ad-grow"></div>
        <span class="ad-result-count">
          {{ prefix + '.count' | translate: { n: filtered().length } }}
        </span>
        <button
          type="button"
          class="ad-btn ad-btn--primary"
          data-action="users.create"
          routerLink="create"
        >
          ＋ {{ prefix + '.create' | translate }}
        </button>
      </div>

      @if (facade.error(); as message) {
        <div class="ad-note ad-note--error" role="alert">{{ message }}</div>
      }

      <div class="ad-table-wrap">
        <table class="ad-table">
          <thead>
            <tr>
              <th class="ad-sort" (click)="toggleSort('lastName')">
                {{ prefix + '.col_name' | translate }}{{ sortMark('lastName') }}
              </th>
              <th class="ad-sort" (click)="toggleSort('email')">
                {{ prefix + '.col_email' | translate }}{{ sortMark('email') }}
              </th>
              <th>{{ prefix + '.col_phone' | translate }}</th>
              <th>{{ prefix + '.col_roles' | translate }}</th>
              <th class="ad-sort" (click)="toggleSort('loginLast')">
                {{ prefix + '.col_login_last' | translate }}{{ sortMark('loginLast') }}
              </th>
              <th class="ad-sort" (click)="toggleSort('createdAt')">
                {{ prefix + '.col_created' | translate }}{{ sortMark('createdAt') }}
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (group of groups(); track group.key) {
              @if (groupByLoginMonth()) {
                <tr class="ad-u-group-row">
                  <td colspan="7">
                    <button type="button" (click)="toggleGroup(group.key)">
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 8 12"
                        fill="none"
                        [class.open]="!isCollapsed(group.key)"
                      >
                        <path
                          d="M1.5 1l5 5-5 5"
                          stroke="currentColor"
                          stroke-width="1.8"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                      {{ groupLabel(group) }}
                      <span class="ad-u-group-count">{{
                        group.users.length
                      }}</span>
                    </button>
                  </td>
                </tr>
              }
              @if (!isCollapsed(group.key)) {
              @for (user of group.users; track user.userId) {
              <tr>
                <td>
                  <div class="ad-user-cell">
                    <span class="ad-avatar">{{ initials(user) }}</span>
                    <div>
                      <b>{{ user.firstName }} {{ user.lastName }}</b>
                      @if (user.locked) {
                        <span class="ad-lock-chip" data-state="locked">
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" stroke-width="1.5"/></svg>
                          {{ prefix + '.locked_badge' | translate }}
                        </span>
                      }
                    </div>
                  </div>
                </td>
                <td>{{ user.email }}</td>
                <td>{{ user.phone || '—' }}</td>
                <td>
                  @for (role of user.roles; track role) {
                    <span class="ad-role-chip">{{ role }}</span>
                  } @empty {
                    —
                  }
                </td>
                <td>{{ user.loginLast ? (user.loginLast | date: 'dd.MM.yyyy HH:mm') : '—' }}</td>
                <td>{{ user.createdAt | date: 'dd.MM.yyyy' }}</td>
                <td class="r">
                  <div class="ad-row-actions">
                    @if (user.locked && facade.canUnlock()) {
                      <button
                        type="button"
                        class="ad-icon-btn"
                        data-action="users.unlock"
                        [attr.aria-label]="prefix + '.unlock' | translate"
                        [attr.title]="prefix + '.unlock' | translate"
                        (click)="unlock(user)"
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 7V5a3 3 0 015.8-1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                      </button>
                    }
                    <button
                      type="button"
                      class="ad-icon-btn"
                      data-action="users.edit"
                      [attr.aria-label]="prefix + '.edit' | translate"
                      [routerLink]="['edit', user.userId]"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M11.1 2.4a1.6 1.6 0 012.3 2.3L5.8 12.3l-3 .7.7-3 7.6-7.6z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
                    </button>
                    <button
                      type="button"
                      class="ad-icon-btn ad-icon-btn--danger"
                      data-action="users.delete"
                      [attr.aria-label]="prefix + '.delete' | translate"
                      (click)="remove(user)"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6.5 4V2.5h3V4M4.5 4l.7 9h5.6l.7-9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
              }
              }
            } @empty {
              @if (!facade.loading()) {
                <tr>
                  <td colspan="7" class="ad-empty">
                    {{ prefix + '.empty' | translate }}
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class EloUsersOverviewComponent extends ComponentBase {
  protected readonly prefix = I18N;
  protected readonly facade = inject(UsersFacade);
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

  async remove(user: AdminUser): Promise<void> {
    const question =
      this.translate.translate(`${I18N}.delete_confirm`, {
        name: `${user.firstName} ${user.lastName}`.trim() || user.email,
      }) ?? user.email;
    if (!confirm(question)) {
      return;
    }
    if (await this.facade.remove(user.userId)) {
      await this.facade.load();
    }
  }
}
