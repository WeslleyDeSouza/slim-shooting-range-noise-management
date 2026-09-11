import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import { AuthFacade, toAuthError } from '../auth.facade';

const I18N = 'auth';

/**
 * E-mail verification, two entries:
 *
 * 1. Link from the mail (`?email=…&token=…`): verified on arrival, as before.
 * 2. Redirect from the LOGIN (`?email=…`, no token): the server mailed a
 *    CODE and held the tokens back — this page offers the entry field. The
 *    login parked the credentials in `pendingVerification`, so a correct
 *    code continues straight into the app instead of bouncing to the login.
 */
@Component({
  selector: 'app-verify-email',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './verify-email.page.html',
})
export class VerifyEmailPage implements OnInit {
  protected readonly prefix = I18N;
  private readonly auth = inject(AuthFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);

  readonly state = signal<'checking' | 'enter-code' | 'verified' | 'failed'>(
    'checking',
  );
  readonly loading = signal(false);
  readonly error = signal('');
  readonly resent = signal(false);
  readonly email = signal('');

  readonly codeForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{4,8}$/)]],
  });

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    const email = params.get('email') ?? '';
    const token = params.get('token') ?? params.get('code') ?? '';
    this.email.set(email);
    if (email && params.get('mode') === 'code') {
      // Arrived from the login (`mode=code`): the code is in the mailbox.
      this.state.set('enter-code');
      return;
    }
    if (!email || !token) {
      this.state.set('failed');
      return;
    }
    try {
      const result = await this.auth.verifyEmail(email, token);
      if (result?.verified) {
        await this.continueAfterVerified();
      } else {
        this.state.set('failed');
      }
    } catch (error) {
      this.error.set(this.errorOf(error));
      this.state.set('failed');
    }
  }

  async submitCode(): Promise<void> {
    if (this.codeForm.invalid || this.loading()) {
      this.codeForm.markAllAsTouched();
      return;
    }
    this.error.set('');
    this.loading.set(true);
    try {
      const result = await this.auth.verifyEmail(
        this.email(),
        this.codeForm.getRawValue().code,
      );
      if (result?.verified) {
        await this.continueAfterVerified();
      } else {
        this.error.set(this.t('verify_code_invalid'));
      }
    } catch (error) {
      this.error.set(this.errorOf(error));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * With the login's parked credentials a fresh sign-in continues the normal
   * flow (2FA / forced password reset / tenant step); without them (mail
   * link opened directly) the success card offers the login link.
   */
  private async continueAfterVerified(): Promise<void> {
    const pending = this.auth.pendingVerification();
    if (!pending) {
      this.state.set('verified');
      return;
    }
    try {
      const result = await this.auth.login(
        pending.email,
        pending.password,
        pending.encrypt,
      );
      this.auth.pendingVerification.set(null);
      if (result.twoFactorRequired) {
        await this.router.navigate(['../two-fa-login'], {
          relativeTo: this.route,
          queryParamsHandling: 'preserve',
        });
        return;
      }
      if (result.resetPasswordRequired && result.userId) {
        await this.router.navigateByUrl(
          `/auth/reset/${encodeURIComponent(pending.email)}/id/${result.userId}`,
        );
        return;
      }
      await this.router.navigate(['../tenant-login'], {
        relativeTo: this.route,
      });
    } catch {
      // The re-login failed (e.g. session constraints) — the address is
      // verified either way, so fall back to the success card + login link.
      this.state.set('verified');
    }
  }

  private t(key: string): string {
    return this.translate.translate(`${I18N}.${key}`) ?? key;
  }

  private errorOf(error: unknown): string {
    return toAuthError(error, {
      network: this.t('error_network'),
      generic: this.t('error_generic'),
    });
  }

  async resend(): Promise<void> {
    if (!this.email()) {
      return;
    }
    try {
      await this.auth.resendVerification(this.email());
      this.resent.set(true);
    } catch (error) {
      this.error.set(this.errorOf(error));
    }
  }
}
