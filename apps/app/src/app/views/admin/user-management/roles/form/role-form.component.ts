import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { APP_ROUTES } from '@slim/shared';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import type { RoleEntity } from '@ui-slim/apiClient';
import { ELO_FORM_STYLES } from '../../../_common/form.styles';
import { EloAutofocusDirective } from '../../../_common/autofocus.directive';
import {
  ROLE_ACCESS_LEVELS,
  RoleAccess,
  RoleUserOption,
  RolesFacade,
} from '../_data/roles.facade';

const I18N = 'admin.roles';

/** So viele Vorschlaege zeigt die Benutzerzuweisung hoechstens auf einmal. */
const MAX_USER_SUGGESTIONS = 12;
const OVERVIEW = APP_ROUTES.admin.dataManagement.roles;

/**
 * Rollen-Formular mit der Berechtigungs-Matrix: pro App eine Zugriffsstufe
 * (kein Zugriff / lesen / schreiben / löschen / root), Schnellaktionen
 * «alle root» / «alle entfernen», Gruppierung nach App-Kategorie. Alles ist
 * ein Draft und wird erst beim Speichern übertragen (CreateRoleDto trägt
 * die Matrix als `apps`-Liste mit).
 */
@Component({
  selector: 'app-elo-role-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe, EloAutofocusDirective],
  styles: [
    ELO_FORM_STYLES,
    `
      .elo-matrix-head {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
        flex-wrap: wrap;
      }
      .elo-matrix-head .elo-grow {
        flex: 1;
      }
      .elo-btn-sm {
        height: 30px;
        padding: 0 12px;
        border: 1px solid var(--elo-line, #e3e5e8);
        border-radius: 7px;
        background: transparent;
        font: inherit;
        font-size: 12.5px;
        cursor: pointer;
      }
      .elo-app-cat {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--elo-gray-500, #6b7280);
        margin: 14px 0 6px;
      }
      .elo-app-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 7px 10px;
        border: 1px solid var(--elo-line, #e3e5e8);
        border-radius: 8px;
        margin-bottom: 6px;
      }
      .elo-app-row--on {
        border-color: var(--elo-red, #d8232a);
      }
      .elo-app-row b {
        flex: 1;
        font-weight: 500;
      }
      .elo-app-row select {
        height: 32px;
        border: 1px solid var(--elo-line, #e3e5e8);
        border-radius: 7px;
        padding: 0 8px;
        font: inherit;
        font-size: 13px;
        background: var(--elo-card, #fff);
      }
    `,
  ],
  template: `
    <div class="elo-form__head">
      <button
        type="button"
        class="elo-form__back"
        [attr.aria-label]="prefix + '.cancel' | translate"
        (click)="cancel()"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <div class="elo-form__crumb">
        <b>{{ prefix + (isEdit() ? '.title_edit' : '.title_create') | translate }}</b>
        <span>{{ current()?.title }}</span>
      </div>
    </div>

    @if (facade.error(); as message) {
      <div class="elo-alert">{{ message }}</div>
    }

    <form [formGroup]="form" (ngSubmit)="save()">
      <div class="elo-card">
        <h2>{{ prefix + '.section_base' | translate }}</h2>
        <div class="elo-field" [class.elo-field--err]="invalidTitle()">
          <label for="elo-r-title">
            {{ prefix + '.name' | translate }} <span class="elo-req">*</span>
          </label>
          <input id="elo-r-title" type="text" eloAutofocus formControlName="title" />
          @if (invalidTitle()) {
            <div class="elo-error-msg">{{ prefix + '.name_error' | translate }}</div>
          }
        </div>
        <div class="elo-toggle-row">
          <button
            type="button"
            class="elo-toggle"
            [attr.aria-pressed]="form.controls.state.value"
            [attr.aria-label]="prefix + '.state' | translate"
            (click)="form.controls.state.setValue(!form.controls.state.value)"
          ></button>
          <div><b>{{ prefix + '.state' | translate }}</b></div>
        </div>
        <div class="elo-toggle-row">
          <button
            type="button"
            class="elo-toggle"
            [attr.aria-pressed]="form.controls.hasAdminRights.value"
            [attr.aria-label]="prefix + '.admin_rights' | translate"
            (click)="form.controls.hasAdminRights.setValue(!form.controls.hasAdminRights.value)"
          ></button>
          <div>
            <b>{{ prefix + '.admin_rights' | translate }}</b>
            <span class="elo-hint">{{ prefix + '.admin_rights_hint' | translate }}</span>
          </div>
        </div>
        <div class="elo-toggle-row">
          <button
            type="button"
            class="elo-toggle"
            [attr.aria-pressed]="form.controls.sensitiveDataDisplay.value"
            [attr.aria-label]="prefix + '.sensitive' | translate"
            (click)="form.controls.sensitiveDataDisplay.setValue(!form.controls.sensitiveDataDisplay.value)"
          ></button>
          <div>
            <b>{{ prefix + '.sensitive' | translate }}</b>
            <span class="elo-hint">{{ prefix + '.sensitive_hint' | translate }}</span>
          </div>
        </div>
      </div>

      <div class="elo-card">
        <h2>{{ prefix + '.section_apps' | translate }}</h2>
        <div class="elo-matrix-head">
          <span class="elo-hint">
            {{ prefix + '.apps_hint' | translate: { granted: grantedCount(), total: facade.apps().length } }}
          </span>
          <span class="elo-grow"></span>
          <button type="button" class="elo-btn-sm" data-action="roles.allRoot" (click)="setAll('root')">
            {{ prefix + '.apps_all_root' | translate }}
          </button>
          <button type="button" class="elo-btn-sm" data-action="roles.allOff" (click)="setAll('')">
            {{ prefix + '.apps_all_off' | translate }}
          </button>
        </div>
        @for (group of groupedApps(); track group.name) {
          <div class="elo-app-cat">{{ group.name }}</div>
          @for (app of group.apps; track app.appId) {
            <div class="elo-app-row" [class.elo-app-row--on]="!!accessOf(app.appId)">
              <b>{{ app.title }}</b>
              <select
                [value]="accessOf(app.appId)"
                (change)="setAccess(app.appId, $event)"
                [attr.aria-label]="app.title"
              >
                @for (level of accessLevels; track level) {
                  <option [value]="level">
                    {{ prefix + '.access_' + (level || 'none') | translate }}
                  </option>
                }
              </select>
            </div>
          }
        }
      </div>

      @if (isEdit()) {
        <div class="elo-card">
          <h2>{{ prefix + '.section_users' | translate }}</h2>
          <div class="elo-matrix-head">
            <span class="elo-hint">
              {{
                prefix + '.users_hint'
                  | translate: { assigned: assignedUsers().length }
              }}
            </span>
          </div>

          <div class="elo-user-assign">
            <label class="elo-field">
              <span>{{ prefix + '.users_search' | translate }}</span>
              <input
                type="search"
                [value]="userQuery()"
                (input)="onUserQuery($event)"
                [attr.placeholder]="prefix + '.users_search' | translate"
              />
            </label>
          </div>

          @if (assignedUsers().length) {
            <div class="elo-app-cat">
              {{ prefix + '.users_assigned' | translate }}
            </div>
            @for (user of assignedUsers(); track user.userId) {
              <div class="elo-app-row elo-app-row--on">
                <b>{{ userLabel(user) }}</b>
                <button
                  type="button"
                  class="elo-btn-sm"
                  [disabled]="userBusy()"
                  (click)="unassign(user.userId)"
                >
                  {{ prefix + '.users_remove' | translate }}
                </button>
              </div>
            }
          } @else {
            <p class="elo-hint">{{ prefix + '.users_none' | translate }}</p>
          }

          @if (candidates().length) {
            <div class="elo-app-cat">
              {{ prefix + '.users_available' | translate }}
            </div>
            @for (user of candidates(); track user.userId) {
              <div class="elo-app-row">
                <b>{{ userLabel(user) }}</b>
                <button
                  type="button"
                  class="elo-btn-sm"
                  [disabled]="userBusy()"
                  (click)="assign(user.userId)"
                >
                  {{ prefix + '.users_add' | translate }}
                </button>
              </div>
            }
          } @else if (userQuery().trim()) {
            <p class="elo-hint">{{ prefix + '.users_no_match' | translate }}</p>
          }
        </div>
      }

      <div class="elo-actions">
        <div class="elo-actions__inner">
          <div class="elo-dirty"></div>
          <button type="button" class="elo-btn elo-btn--ghost" (click)="cancel()">
            {{ prefix + '.cancel' | translate }}
          </button>
          <button
            type="submit"
            class="elo-btn elo-btn--primary"
            data-action="roles.save"
            [disabled]="saving()"
          >
            {{ prefix + '.save' | translate }}
          </button>
        </div>
      </div>
    </form>
  `,
})
export class EloRoleFormComponent extends ComponentBase {
  protected readonly prefix = I18N;
  protected readonly facade = inject(RolesFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly saving = signal(false);

  /**
   * Zuweisungen wirken sofort, nicht erst beim Speichern.
   *
   * Sie laufen über eigene Endpunkte; sie im Formular zwischenzuspeichern
   * hiesse, zwei Speicherwege mit unterschiedlichem Verhalten
   * nebeneinanderzustellen.
   */
  readonly userBusy = signal(false);
  readonly userQuery = signal('');
  readonly assignedIds = signal<ReadonlySet<string>>(new Set<string>());
  readonly current = signal<RoleEntity | null>(null);
  readonly isEdit = computed(() => !!this.current());
  readonly accessLevels = ROLE_ACCESS_LEVELS;

  readonly assignedUsers = computed(() => {
    const ids = this.assignedIds();
    return this.facade
      .users()
      .filter((user) => ids.has(user.userId))
      .sort((a, b) => this.userLabel(a).localeCompare(this.userLabel(b)));
  });

  /** Höchstens so viele Vorschläge; die volle Liste gehört nach /admin/users. */
  readonly candidates = computed(() => {
    const ids = this.assignedIds();
    const needle = this.userQuery().trim().toLowerCase();
    return this.facade
      .users()
      .filter((user) => !ids.has(user.userId))
      .filter(
        (user) => !needle || this.userLabel(user).toLowerCase().includes(needle),
      )
      .slice(0, MAX_USER_SUGGESTIONS);
  });

  /** Draft der Matrix: appId -> Zugriffsstufe. */
  readonly access = signal<ReadonlyMap<number, RoleAccess>>(new Map());

  readonly grantedCount = computed(
    () => [...this.access().values()].filter(Boolean).length,
  );

  /** Katalog gruppiert nach Kategorie, i18n-Titel übersetzt. */
  readonly groupedApps = computed(() => {
    const groups = new Map<string, { appId: number; title: string }[]>();
    for (const app of this.facade.apps()) {
      const category = app.categoryName || app.baseCategoryName || '—';
      const list = groups.get(category) ?? [];
      list.push({ appId: app.appId, title: this.label(app.title) });
      groups.set(category, list);
    }
    return [...groups.entries()].map(([name, apps]) => ({
      name: this.label(name),
      apps,
    }));
  });

  private submitted = false;

  readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      // Server-DTO: max. 20 Zeichen — ohne den Validator scheitert der
      // Save sonst still am 400.
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(20),
      ],
    }),
    state: new FormControl(true, { nonNullable: true }),
    hasAdminRights: new FormControl(false, { nonNullable: true }),
    sensitiveDataDisplay: new FormControl(false, { nonNullable: true }),
  });

  /** ComponentBase ruft dies beim Init und bei jedem DATA_RELOAD-Emit auf. */
  getData(): void {
    void this.loadData();
  }

  private async loadData(): Promise<void> {
    void this.facade.loadApps();
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }
    const role = await this.facade.get(Number(id));
    if (!role) {
      void this.router.navigateByUrl(OVERVIEW);
      return;
    }
    this.current.set(role);
    this.form.patchValue({
      title: role.title ?? '',
      state: !!role.state,
      hasAdminRights: !!role.hasAdminRights,
      sensitiveDataDisplay: !!role.sensitiveDataDisplay,
    });
    this.access.set(
      new Map(
        (role.apps ?? []).map((right) => [
          right.appId,
          (right.access ?? '') as RoleAccess,
        ]),
      ),
    );

    // Benutzerliste und Zuweisungen erst im Bearbeiten-Fall: eine Rolle, die
    // es noch nicht gibt, kann niemanden zugewiesen haben.
    void this.facade.loadUsers();
    this.assignedIds.set(new Set(await this.facade.usersOf(role.roleId)));
  }

  invalidTitle(): boolean {
    const control = this.form.controls.title;
    return control.invalid && (control.touched || this.submitted);
  }

  accessOf(appId: number): RoleAccess {
    return this.access().get(appId) ?? '';
  }

  setAccess(appId: number, event: Event): void {
    const value = (event.target as HTMLSelectElement).value as RoleAccess;
    this.access.update((current) => {
      const next = new Map(current);
      if (value) {
        next.set(appId, value);
      } else {
        next.delete(appId);
      }
      return next;
    });
  }

  setAll(level: RoleAccess): void {
    this.access.set(
      new Map(
        level
          ? this.facade.apps().map((app) => [app.appId, level])
          : [],
      ),
    );
  }

  async save(): Promise<void> {
    this.submitted = true;
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const value = this.form.getRawValue();
    const body = {
      title: value.title.trim(),
      state: value.state,
      hasAdminRights: value.hasAdminRights,
      sensitiveDataDisplay: value.sensitiveDataDisplay,
      type: (this.current()?.type ?? 'business') as 'business',
      apps: [...this.access().entries()]
        .filter(([, access]) => !!access)
        .map(([appId, access]) => ({ appId, access })),
    };

    const current = this.current();
    const ok = current
      ? await this.facade.update(current.roleId, body)
      : !!(await this.facade.create(body));
    this.saving.set(false);
    if (ok) {
      void this.router.navigateByUrl(OVERVIEW);
    }
  }

  onUserQuery(event: Event): void {
    this.userQuery.set((event.target as HTMLInputElement).value);
  }

  userLabel(user: RoleUserOption): string {
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return name ? `${name} · ${user.email ?? ''}`.trim() : (user.email ?? user.userId);
  }

  async assign(userId: string): Promise<void> {
    const roleId = this.current()?.roleId;
    if (!roleId) return;
    this.userBusy.set(true);
    if (await this.facade.assignUser(roleId, userId)) {
      this.assignedIds.update((ids) => new Set([...ids, userId]));
    }
    this.userBusy.set(false);
  }

  async unassign(userId: string): Promise<void> {
    const roleId = this.current()?.roleId;
    if (!roleId) return;
    this.userBusy.set(true);
    if (await this.facade.unassignUser(roleId, userId)) {
      this.assignedIds.update((ids) => {
        const next = new Set(ids);
        next.delete(userId);
        return next;
      });
    }
    this.userBusy.set(false);
  }

  cancel(): void {
    void this.router.navigateByUrl(OVERVIEW);
  }

  /** Übersetzt i18n-Keys (menu.*) — Rohtexte bleiben unverändert. */
  private label(value: string): string {
    if (!value?.includes('.')) {
      return value;
    }
    return this.translate.translate(value) ?? value;
  }
}
