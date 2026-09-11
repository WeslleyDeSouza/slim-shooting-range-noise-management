import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { AppAutofocusDirective } from '../../../_common/autofocus.directive';
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
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, AppAutofocusDirective],
  templateUrl: './role-form.component.html',
  styleUrl: './role-form.component.scss',
})
export class EloRoleFormComponent extends ComponentBase {
  protected readonly prefix = I18N;
  protected readonly routes = APP_ROUTES;
  protected readonly facade = inject(RolesFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly saving = signal(false);
  /** Active tab of the form: general / apps / users (users only when editing). */
  readonly tab = signal<'general' | 'apps' | 'users'>('general');

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
