import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AUTH_CONSTANTS } from '@app-galaxy/auth-ui';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import { AuthFacade, toAuthError } from '../auth.facade';
import { setRememberSession } from '../remember-session';
import { rememberReturnUrl } from '../return-url';

const I18N = 'auth';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './login.page.html',
})
export class LoginPage implements OnInit {
  protected readonly prefix = I18N;
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);

  /** Mock/default credentials for dev (provided via provideAuth mock). */
  private readonly sampleUser = inject(
    AUTH_CONSTANTS.Mock.Credential.AUTH_MOCK_CREDENTIAL,
    { optional: true },
  ) as { email?: string; password?: string } | null;

  /** Whether credentials should be encrypted before sign-in. */
  private readonly hashCredentials = inject(
    AUTH_CONSTANTS.API.API_HASH_CREDENTIALS,
    { optional: true },
  ) as boolean | null;

  readonly showPassword = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly shake = signal(false);
  readonly capsLock = signal(false);
  /** On by default: administrators work here daily, on their own device. */
  readonly remember = signal(true);
  readonly success = signal(false);


  /** «Willkommen zurück» only for returning visitors (flagged locally). */
  protected readonly returning = ((): boolean => {
    try {
      const seen = localStorage.getItem('slim_visited') === '1';
      localStorage.setItem('slim_visited', '1');
      return seen;
    } catch {
      return false;
    }
  })();

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(3)]],
  });

  ngOnInit(): void {
    // Deep link that bounced into the login (guard / expired session): parked
    // per tab until the tenant chooser opens the app, so the 2FA / verify /
    // reset detours cannot lose it.
    rememberReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
    this.form.patchValue({
      email: this.sampleUser?.email || '',
      password: this.sampleUser?.password || '',
    });
  }

  private t(key: string): string {
    return this.translate.translate(`${I18N}.${key}`) ?? key;
  }

  fieldError(field: 'email' | 'password'): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || !!this.error());
  }

  onCaps(event: KeyboardEvent): void {
    this.capsLock.set(
      !!event.getModifierState && event.getModifierState('CapsLock'),
    );
  }

  firstName(): string {
    return this.auth.currentUserFirstName();
  }

  private triggerShake(): void {
    this.shake.set(false);
    requestAnimationFrame(() => this.shake.set(true));
    setTimeout(() => this.shake.set(false), 600);
  }

  async submit(): Promise<void> {
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set(this.t('invalid_form'));
      this.triggerShake();
      return;
    }
    this.loading.set(true);
    try {
      const { email, password } = this.form.getRawValue();
      // Recorded before the session is written, so the tab marker is in place
      // by the time anything persists.
      setRememberSession(this.remember());
      const result = await this.auth.login(
        email,
        password,
        this.hashCredentials,
      );
      if (result.twoFactorRequired) {
        // The server mailed a code and holds the tokens back — continue on
        // the dedicated 2FA page (own route, like the MFE remote).
        await this.router.navigate(['../two-fa-login'], {
          relativeTo: this.route,
          queryParamsHandling: 'preserve',
        });
        return;
      }
      if (result.emailVerificationRequired) {
        // The server mailed a verification CODE — continue on the verify
        // page, which offers the entry field and signs in again afterwards
        // (the credentials wait in `pendingVerification`).
        await this.router.navigate(['../verify-email'], {
          relativeTo: this.route,
          queryParams: { email, mode: 'code' },
        });
        return;
      }
      if (result.resetPasswordRequired && result.userId) {
        // First login of an admin-created account: the server accepted the
        // password but demands an own one — set it before continuing.
        await this.router.navigateByUrl(
          `/auth/reset/${encodeURIComponent(email)}/id/${result.userId}`,
        );
        return;
      }
      this.success.set(true);
      // Give the tick animation its moment, then continue to the tenant step.
      setTimeout(
        () =>
          this.router.navigate(['../tenant-login'], {
            relativeTo: this.route,
            queryParamsHandling: 'preserve',
          }),
        800,
      );
    } catch (error) {
      this.error.set(
        toAuthError(error, {
          network: this.t('error_network'),
          generic: this.t('error_generic'),
          invalidCredentials: this.t('error_invalid_credentials'),
          accountLocked: this.t('error_account_locked'),
        }),
      );
      this.triggerShake();
    } finally {
      this.loading.set(false);
    }
  }
}
