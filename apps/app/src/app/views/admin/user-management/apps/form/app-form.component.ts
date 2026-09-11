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
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { ComponentBase } from '@app-galaxy/sdk-ui';
import type { AppEntity } from '@ui-slim/apiClient';
import { ELO_FORM_STYLES } from '../../../_common/form.styles';
import { EloAutofocusDirective } from '../../../_common/autofocus.directive';
import { AppsFacade } from '../_data/apps.facade';

const I18N = 'admin.apps';
const OVERVIEW = APP_ROUTES.admin.dataManagement.apps;

/**
 * Katalog-Formular (`/admin/apps/create` bzw. `edit/:id`): Titel als
 * i18n-Key, Pfad, roleKey (Berechtigungsvokabular), Kategorie, Reihenfolge
 * und der Sichtbarkeits-Schalter (`hiddenInMenu` invertiert).
 */
@Component({
  selector: 'app-elo-app-form',
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
        <div class="elo-grid2">
          <div class="elo-field" [class.elo-field--err]="invalid('title')">
            <label for="elo-a-title">
              {{ prefix + '.field_title' | translate }} <span class="elo-req">*</span>
            </label>
            <input id="elo-a-title" type="text" eloAutofocus formControlName="title" />
            <div class="elo-hint">{{ prefix + '.field_title_hint' | translate }}</div>
          </div>
          <div class="elo-field" [class.elo-field--err]="invalid('path')">
            <label for="elo-a-path">
              {{ prefix + '.field_path' | translate }} <span class="elo-req">*</span>
            </label>
            <input id="elo-a-path" type="text" formControlName="path" />
          </div>
        </div>
        <div class="elo-grid2">
          <div class="elo-field">
            <label for="elo-a-rolekey">{{ prefix + '.field_role_key' | translate }}</label>
            <input id="elo-a-rolekey" type="text" formControlName="roleKey" />
            <div class="elo-hint">{{ prefix + '.field_role_key_hint' | translate }}</div>
          </div>
          <div class="elo-field">
            <label for="elo-a-category">{{ prefix + '.field_category' | translate }}</label>
            <select id="elo-a-category" formControlName="categoryId">
              @for (category of facade.categories(); track category.categoryId) {
                <option [value]="category.categoryId">
                  {{ facade.categoryTitle(category.categoryId) }}
                </option>
              }
            </select>
          </div>
        </div>
        <div class="elo-grid2">
          <div class="elo-field">
            <label for="elo-a-order">{{ prefix + '.field_order' | translate }}</label>
            <input id="elo-a-order" type="number" formControlName="orderIdx" />
          </div>
          <div class="elo-field">
            <label for="elo-a-icon">{{ prefix + '.field_icon' | translate }}</label>
            <input id="elo-a-icon" type="text" formControlName="icon" />
            <div class="elo-hint">{{ prefix + '.field_icon_hint' | translate }}</div>
          </div>
        </div>
      </div>

      <div class="elo-card">
        <h2>{{ prefix + '.section_visibility' | translate }}</h2>
        <div class="elo-toggle-row">
          <button
            type="button"
            class="elo-toggle"
            [attr.aria-pressed]="form.controls.visible.value"
            [attr.aria-label]="prefix + '.visible' | translate"
            (click)="form.controls.visible.setValue(!form.controls.visible.value)"
          ></button>
          <div>
            <b>{{ prefix + '.visible' | translate }}</b>
            <span class="elo-hint">{{ prefix + '.visible_hint' | translate }}</span>
          </div>
        </div>
      </div>

      <div class="elo-actions">
        <div class="elo-actions__inner">
          <div class="elo-dirty"></div>
          <button type="button" class="elo-btn elo-btn--ghost" (click)="cancel()">
            {{ prefix + '.cancel' | translate }}
          </button>
          <button
            type="submit"
            class="elo-btn elo-btn--primary"
            data-action="apps.save"
            [disabled]="saving()"
          >
            {{ prefix + '.save' | translate }}
          </button>
        </div>
      </div>
    </form>
  `,
})
export class EloAppFormComponent extends ComponentBase {
  protected readonly prefix = I18N;
  protected readonly facade = inject(AppsFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly saving = signal(false);
  readonly current = signal<AppEntity | null>(null);
  readonly isEdit = computed(() => !!this.current());

  private submitted = false;

  readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    path: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\/.+/)],
    }),
    roleKey: new FormControl('', { nonNullable: true }),
    categoryId: new FormControl<number>(1, { nonNullable: true }),
    orderIdx: new FormControl<number>(1, { nonNullable: true }),
    icon: new FormControl('', { nonNullable: true }),
    visible: new FormControl(true, { nonNullable: true }),
  });

  /** ComponentBase ruft dies beim Init und bei jedem DATA_RELOAD-Emit auf. */
  getData(): void {
    void this.loadData();
  }

  private async loadData(): Promise<void> {
    await this.facade.load();
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }
    const app = await this.facade.get(Number(id));
    if (!app) {
      void this.router.navigateByUrl(OVERVIEW);
      return;
    }
    this.current.set(app);
    this.form.patchValue({
      title: app.title,
      path: app.path ?? '',
      roleKey: app.roleKey ?? '',
      categoryId: app.categoryId,
      orderIdx: app.orderIdx,
      icon: app.icon ?? '',
      visible: !app.hiddenInMenu,
    });
  }

  invalid(field: 'title' | 'path'): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.submitted);
  }

  async save(): Promise<void> {
    this.submitted = true;
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const value = this.form.getRawValue();
    const body: Partial<AppEntity> = {
      title: value.title.trim(),
      path: value.path.trim(),
      roleKey: value.roleKey.trim() || undefined,
      categoryId: Number(value.categoryId),
      orderIdx: Number(value.orderIdx) || 1,
      icon: value.icon.trim() || undefined,
      hiddenInMenu: !value.visible,
      domain: this.current()?.domain ?? 'business',
    };

    const current = this.current();
    const ok = current
      ? await this.facade.update(current.appId, body)
      : await this.facade.create(body);
    this.saving.set(false);
    if (ok) {
      void this.router.navigateByUrl(OVERVIEW);
    }
  }

  cancel(): void {
    void this.router.navigateByUrl(OVERVIEW);
  }
}
