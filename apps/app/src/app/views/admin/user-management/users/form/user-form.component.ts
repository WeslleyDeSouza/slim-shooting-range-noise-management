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
import { AUTH_STORE } from '@app-galaxy/auth-ui';
import { ELO_FORM_STYLES } from '../../../_common/form.styles';
import { EloAutofocusDirective } from '../../../_common/autofocus.directive';
import { UsersFacade } from '../_data/users.facade';
import { AdminUser } from '../_data/user.model';

const I18N = 'admin.users';
const OVERVIEW = APP_ROUTES.admin.dataManagement.users;

/**
 * Benutzer-Formular (`/admin/users/create` bzw. `edit/:id`): Grunddaten,
 * Rollen als Draft-Checkboxen (persistiert erst beim Speichern, Muster wie
 * die Koordinationsstellen-Zuweisung) und im Edit die Passwort-Reset-Mail
 * als Aktion — der Link-Flow der Auth-Seiten übernimmt den Rest.
 */
@Component({
  selector: 'app-elo-user-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe, EloAutofocusDirective],
  styles: [
    ELO_FORM_STYLES,
    `
      .elo-grid2 {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0 16px;
      }
      @media (min-width: 720px) {
        .elo-grid2 {
          grid-template-columns: 1fr 1fr;
        }
      }
      .elo-role-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 12px;
        border: 1px solid var(--elo-line, #e3e5e8);
        border-radius: 8px;
        margin-bottom: 8px;
        cursor: pointer;
      }
      .elo-role-row input {
        accent-color: var(--elo-red, #d8232a);
      }
      .elo-role-row--locked {
        opacity: 0.55;
        cursor: default;
      }
      .elo-role-row small {
        color: var(--elo-gray-500, #6b7280);
        margin-left: auto;
      }
      .elo-reset-note {
        font-size: 13px;
        color: var(--elo-gray-500, #6b7280);
        margin-top: 8px;
      }
      .elo-restore {
        font-weight: 400;
      }
      .elo-restore p {
        margin: 0 0 10px;
      }
      .elo-lock {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        padding: 12px 14px;
        border: 1px solid var(--elo-red, #d8232a);
        border-radius: 8px;
        margin-bottom: 14px;
      }
      .elo-lock__text {
        flex: 1 1 240px;
      }
      .elo-lock__text b {
        display: block;
        margin-bottom: 2px;
      }
      .elo-lock__text span {
        font-size: 13px;
        color: var(--elo-gray-500, #6b7280);
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
        <span>{{ current()?.email }}</span>
      </div>
    </div>

    @if (facade.error(); as message) {
      <div class="elo-alert" [class.elo-alert--warn]="facade.restorableUserId()">
        {{ message }}
      </div>
    }
    @if (facade.restorableUserId(); as restorableId) {
      <div class="elo-alert elo-alert--warn elo-restore">
        <p>{{ prefix + '.restore_consequences' | translate }}</p>
        <button
          type="button"
          class="elo-btn elo-btn--primary"
          [disabled]="saving()"
          (click)="restore(restorableId)"
        >
          {{ prefix + '.restore_action' | translate }}
        </button>
      </div>
    }
    @if (notice(); as message) {
      <div class="elo-alert elo-alert--ok" role="status">{{ message }}</div>
    }

    <form [formGroup]="form" (ngSubmit)="save()">
      <div class="elo-card">
        <h2>{{ prefix + '.section_base' | translate }}</h2>
        <div class="elo-grid2">
          <div class="elo-field" [class.elo-field--err]="invalid('firstName')">
            <label for="elo-u-first">
              {{ prefix + '.first_name' | translate }} <span class="elo-req">*</span>
            </label>
            <input id="elo-u-first" type="text" eloAutofocus formControlName="firstName" />
          </div>
          <div class="elo-field" [class.elo-field--err]="invalid('lastName')">
            <label for="elo-u-last">
              {{ prefix + '.last_name' | translate }} <span class="elo-req">*</span>
            </label>
            <input id="elo-u-last" type="text" formControlName="lastName" />
          </div>
        </div>
        <div class="elo-grid2">
          <div class="elo-field" [class.elo-field--err]="invalid('email')">
            <label for="elo-u-email">
              {{ prefix + '.email' | translate }} <span class="elo-req">*</span>
            </label>
            <input id="elo-u-email" type="email" formControlName="email" />
            @if (invalid('email')) {
              <div class="elo-error-msg">{{ prefix + '.email_error' | translate }}</div>
            }
          </div>
          <div class="elo-field">
            <label for="elo-u-phone">{{ prefix + '.phone' | translate }}</label>
            <input id="elo-u-phone" type="tel" formControlName="phone" />
          </div>
        </div>
        @if (!isEdit()) {
          <div class="elo-hint">
            {{ prefix + '.create_reset_hint' | translate }}
          </div>
        }
      </div>

      <div class="elo-card">
        <h2>{{ prefix + '.section_roles' | translate }}</h2>
        @for (role of facade.roles(); track role.roleId) {
          <label
            class="elo-role-row"
            [class.elo-role-row--locked]="roleLocked(role)"
          >
            <input
              type="checkbox"
              [checked]="draftRoles().has(role.roleId)"
              [disabled]="roleLocked(role)"
              (change)="toggleRole(role.roleId)"
            />
            <b>{{ role.title }}</b>
            @if (roleLocked(role)) {
              <small>{{ prefix + '.role_locked_hint' | translate }}</small>
            } @else if (role.hasAdminRights) {
              <small>{{ prefix + '.role_admin_hint' | translate }}</small>
            }
          </label>
        } @empty {
          <div class="elo-hint">{{ prefix + '.roles_empty' | translate }}</div>
        }
      </div>

      @if (isEdit()) {
        <div class="elo-card">
          <h2>{{ prefix + '.section_security' | translate }}</h2>
          @if (locked()) {
            <div class="elo-lock" role="alert">
              <div class="elo-lock__text">
                <b>{{ prefix + '.locked_title' | translate }}</b>
                <span>
                  {{ prefix + '.locked_hint' | translate: { n: loginAttempt() } }}
                </span>
              </div>
              @if (facade.canUnlock()) {
                <button
                  type="button"
                  class="elo-btn elo-btn--primary"
                  data-action="users.unlock"
                  [disabled]="saving()"
                  (click)="unlock()"
                >
                  {{ prefix + '.unlock' | translate }}
                </button>
              } @else {
                <small>{{ prefix + '.unlock_forbidden' | translate }}</small>
              }
            </div>
          }
          <div class="elo-toggle-row">
            <button
              type="button"
              class="elo-toggle"
              data-action="users.forceReset"
              [attr.aria-pressed]="forceReset()"
              [attr.aria-label]="prefix + '.force_reset' | translate"
              (click)="forceReset.set(!forceReset())"
            ></button>
            <div>
              <b>{{ prefix + '.force_reset' | translate }}</b>
              <span class="elo-hint">
                {{ prefix + '.force_reset_hint' | translate }}
              </span>
            </div>
          </div>
          <button
            type="button"
            class="elo-btn elo-btn--ghost"
            data-action="users.sendReset"
            [disabled]="resetSent()"
            (click)="sendReset()"
          >
            {{ prefix + '.send_reset' | translate }}
          </button>
          <div class="elo-reset-note">{{ prefix + '.send_reset_hint' | translate }}</div>
        </div>
      }

      <div class="elo-actions">
        <div class="elo-actions__inner">
          <div class="elo-dirty">
            @if (assignmentDirty()) {
              {{ prefix + '.unsaved_roles' | translate }}
            }
          </div>
          <button type="button" class="elo-btn elo-btn--ghost" (click)="cancel()">
            {{ prefix + '.cancel' | translate }}
          </button>
          <button
            type="submit"
            class="elo-btn elo-btn--primary"
            data-action="users.save"
            [disabled]="saving()"
          >
            {{ prefix + '.save' | translate }}
          </button>
        </div>
      </div>
    </form>
  `,
})
export class EloUserFormComponent extends ComponentBase {
  protected readonly prefix = I18N;
  protected readonly facade = inject(UsersFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly saving = signal(false);
  readonly resetSent = signal(false);
  /** «Beim nächsten Login neues Passwort verlangen» — draft vs. server. */
  readonly forceReset = signal(false);
  private savedForceReset = false;
  readonly notice = signal('');
  readonly current = signal<AdminUser | null>(null);
  readonly isEdit = computed(() => !!this.current());
  /** Lock state (Si001 T7.4), loaded separately from the decorated list. */
  readonly locked = signal(false);
  readonly loginAttempt = signal(0);

  private readonly sessionStore = inject(AUTH_STORE.SessionStore);

  /**
   * Rollen des ANGEMELDETEN Admins — nur wer selbst eine Rolle mit
   * Admin-Rechten hat («Superadmin»), darf solche Rollen vergeben oder
   * entziehen. Fail-closed: bis die eigenen Rollen geladen sind, gelten
   * Admin-Rollen als gesperrt.
   */
  readonly isSuperadmin = computed(() => {
    const mine = this.facade.myRoleIds();
    return this.facade
      .roles()
      .some(
        (role) =>
          role.roleId !== undefined &&
          mine.has(role.roleId) &&
          !!role.hasAdminRights,
      );
  });

  roleLocked(role: { hasAdminRights?: boolean }): boolean {
    return !!role.hasAdminRights && !this.isSuperadmin();
  }

  /** Draft der Rollen-Zuweisung; persistiert erst beim Speichern. */
  readonly draftRoles = signal<ReadonlySet<number>>(new Set());
  private savedRoles: ReadonlySet<number> = new Set();
  readonly assignmentDirty = computed(() => {
    const draft = this.draftRoles();
    if (draft.size !== this.savedRoles.size) {
      return true;
    }
    return [...draft].some((id) => !this.savedRoles.has(id));
  });

  private submitted = false;

  readonly form = new FormGroup({
    firstName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    lastName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    phone: new FormControl('', { nonNullable: true }),
  });

  /** ComponentBase ruft dies beim Init und bei jedem DATA_RELOAD-Emit auf. */
  getData(): void {
    void this.loadData();
  }

  private async loadData(): Promise<void> {
    void this.facade.loadRoles();
    const myUserId = String(this.sessionStore.changed()?.user?.userId ?? '');
    void this.facade.loadMyRoles(myUserId);
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }
    const user = await this.facade.get(id);
    if (!user) {
      void this.router.navigateByUrl(OVERVIEW);
      return;
    }
    this.current.set(user);
    this.form.patchValue(user);
    this.savedForceReset = user.resetPasswordRequired;
    this.forceReset.set(user.resetPasswordRequired);
    void this.facade.lockState(id).then((state) => {
      this.locked.set(!!state?.locked);
      this.loginAttempt.set(state?.loginAttempt ?? 0);
    });
    const roles = new Set(await this.facade.rolesOf(id));
    this.savedRoles = roles;
    this.draftRoles.set(new Set(roles));
  }

  invalid(field: 'firstName' | 'lastName' | 'email'): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.submitted);
  }

  toggleRole(roleId: number | undefined): void {
    if (roleId === undefined) {
      return;
    }
    const role = this.facade.roles().find((entry) => entry.roleId === roleId);
    if (role && this.roleLocked(role)) {
      return;
    }
    this.draftRoles.update((current) => {
      const next = new Set(current);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  }

  async save(): Promise<void> {
    this.submitted = true;
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const value = this.form.getRawValue();
    const base = {
      firstName: value.firstName.trim(),
      lastName: value.lastName.trim(),
      email: value.email.trim(),
      phone: value.phone.trim() || undefined,
    };

    const current = this.current();
    let userId = current?.userId ?? '';
    let ok = true;
    if (current) {
      // The flag only travels when the admin flipped it — sending `false`
      // on every save would silently lift a pending forced reset.
      ok = await this.facade.update(
        current.userId,
        this.forceReset() === this.savedForceReset
          ? base
          : { ...base, resetPassword: this.forceReset() },
      );
    } else {
      // Always on: the create endpoint auto-generates the password, and the
      // person must set their own at the first login (the form says so).
      const created = await this.facade.create({
        ...base,
        resetPassword: true,
      });
      ok = !!created;
      userId = (created as AdminUser | null)?.userId ?? '';
    }

    if (ok && userId) {
      ok = await this.persistRoles(userId);
    }
    this.saving.set(false);
    if (ok) {
      void this.router.navigateByUrl(OVERVIEW);
    }
  }

  /**
   * Restores the soft-deleted account that occupies the entered email address
   * and applies what was typed into the form to it.
   *
   * Deliberately a separate click instead of an automatic fallback of `save()`:
   * reviving an account is a different act than creating one, and the admin
   * has to see the consequences (no roles back, forced password change) before
   * it happens. The roles picked in the form are assigned afterwards, so the
   * result matches what the form promised.
   */
  async restore(userId: string): Promise<void> {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);

    const value = this.form.getRawValue();
    let ok = await this.facade.restore(userId);
    if (ok) {
      ok = await this.facade.update(userId, {
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim(),
        email: value.email.trim(),
        phone: value.phone.trim() || undefined,
      });
    }
    if (ok) {
      ok = await this.persistRoles(userId);
    }

    this.saving.set(false);
    if (ok) {
      void this.router.navigateByUrl(OVERVIEW);
    }
  }

  /** Diff of the role draft against the saved state. */
  private async persistRoles(userId: string): Promise<boolean> {
    const draft = this.draftRoles();
    const added = [...draft].filter((id) => !this.savedRoles.has(id));
    const removed = [...this.savedRoles].filter((id) => !draft.has(id));
    const results = await Promise.all([
      ...added.map((roleId) => this.facade.assignRole(userId, roleId)),
      ...removed.map((roleId) => this.facade.unassignRole(userId, roleId)),
    ]);
    return results.every(Boolean);
  }

  async sendReset(): Promise<void> {
    const email = this.current()?.email;
    if (!email) {
      return;
    }
    if (await this.facade.sendPasswordReset(email)) {
      this.resetSent.set(true);
      this.notice.set(
        this.translate.translate(`${I18N}.reset_sent`, { email }) ?? email,
      );
    }
  }

  /** Lifts the account lock; the person can sign in again right away. */
  async unlock(): Promise<void> {
    const userId = this.current()?.userId;
    if (!userId || this.saving()) {
      return;
    }
    this.saving.set(true);
    const ok = await this.facade.unlock(userId);
    this.saving.set(false);
    if (ok) {
      this.locked.set(false);
      this.loginAttempt.set(0);
      this.notice.set(this.translate.translate(`${I18N}.unlocked`) ?? '');
    }
  }

  cancel(): void {
    void this.router.navigateByUrl(OVERVIEW);
  }
}
