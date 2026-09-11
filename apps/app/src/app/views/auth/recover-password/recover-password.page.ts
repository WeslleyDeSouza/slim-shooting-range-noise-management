import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import { AuthFacade, toAuthError } from '../auth.facade';

const I18N = 'auth';

type RecoverStep = 'email' | 'sent' | 'verify' | 'password' | 'done';

/**
 * Password recovery in the ELO card design. The reset mail carries a DIRECT
 * LINK (`/auth/reset/:email/:token`) — there is no manual code entry:
 * request the mail, tell the user to open the link (neutral wording, no
 * account enumeration), and when the page is entered THROUGH the link the
 * token is verified on arrival and the flow jumps straight to the
 * new-password step.
 */
@Component({
  selector: 'app-recover-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './recover-password.page.html',
})
export class RecoverPasswordPage implements OnInit {
  protected readonly prefix = I18N;
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);

  readonly step = signal<RecoverStep>('email');
  /**
   * Forced first-login reset: entered via `/auth/reset/:email/id/:userId`
   * after a login on an account flagged with `resetPasswordRequired`. No
   * mail token — the server verifies `code: 'id'` + userId instead, and the
   * session from the login is already in place, so «done» continues to the
   * tenant step rather than back to the login.
   */
  readonly forced = signal(false);
  private userId = '';
  /** Sekunden bis «erneut senden» wieder erlaubt ist (Spam-Bremse). */
  readonly cooldown = signal(0);
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;
  readonly loading = signal(false);
  readonly error = signal('');
  readonly showPassword = signal(false);

  readonly emailForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly codeForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(4)]],
  });

  /**
   * IT-Grundschutz Si001 (D1/T7.1): at least 10 characters and three of four
   * character categories. The server (Galaxy lib) requires upper AND lower
   * case plus a digit or special character; the minimum length comes from
   * API_AUTH_PASSWORD_MIN_LENGTH=10. The rules here are the union of both, so
   * that whatever passes on the client never fails on the server.
   */
  readonly passwordForm = this.fb.nonNullable.group({
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(10),
        Validators.maxLength(55),
        Validators.pattern(/^(?=.*[A-Z])(?=.*[a-z])(?=.*[\d\W]).*$/),
      ],
    ],
  });

  private readonly passwordValue = toSignal(
    this.passwordForm.controls.password.valueChanges,
    { initialValue: '' },
  );

  /** One entry per requirement: gray until typing starts, then green/red. */
  readonly rules = computed(() => {
    const value = this.passwordValue() ?? '';
    const state = (ok: boolean): 'idle' | 'ok' | 'fail' =>
      value.length === 0 ? 'idle' : ok ? 'ok' : 'fail';
    return [
      { key: 'rule_length', state: state(value.length >= 10) },
      { key: 'rule_upper', state: state(/[A-Z]/.test(value)) },
      { key: 'rule_lower', state: state(/[a-z]/.test(value)) },
      {
        key: 'rule_digit_special',
        state: state(/\d/.test(value) || /\W/.test(value)),
      },
    ];
  });

  private t(key: string): string {
    return this.translate.translate(`${I18N}.${key}`) ?? key;
  }

  private async run(action: () => Promise<unknown>): Promise<boolean> {
    this.error.set('');
    this.loading.set(true);
    try {
      await action();
      return true;
    } catch (error) {
      this.error.set(
        toAuthError(error, {
          network: this.t('error_network'),
          generic: this.t('error_generic'),
        }),
      );
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  ngOnInit(): void {
    const email = this.route.snapshot.paramMap.get('email');
    const token = this.route.snapshot.paramMap.get('token');
    const userId = this.route.snapshot.paramMap.get('userId');
    if (email && userId) {
      this.forced.set(true);
      this.userId = userId;
      this.emailForm.patchValue({ email });
      this.codeForm.patchValue({ code: 'id' });
      void this.verifyLink();
      return;
    }
    if (email && token) {
      this.emailForm.patchValue({ email });
      this.codeForm.patchValue({ code: token });
      void this.verifyLink();
    }
  }

  /** Entry through the mail link: prove the token, then straight to step 3. */
  private async verifyLink(): Promise<void> {
    this.step.set('verify');
    const ok = await this.run(async () => {
      const res = (await this.auth.verifyResetCode(
        this.emailForm.getRawValue().email,
        this.codeForm.getRawValue().code,
        this.userId || undefined,
      )) as { userId?: string } | null;
      // The API answers an invalid token with 200 and an empty body — only
      // a payload carrying the userId proves the link is still good.
      if (!res?.userId) {
        throw { error: { message: this.t('recover_link_invalid') } };
      }
    });
    this.step.set(ok ? 'password' : 'email');
  }

  async requestCode(): Promise<void> {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }
    const ok = await this.run(() =>
      this.auth.requestPasswordReset(this.emailForm.getRawValue().email),
    );
    if (ok) {
      this.step.set('sent');
      this.startCooldown();
    }
  }

  /** 30 s Sperre nach jedem Versand. */
  private startCooldown(): void {
    this.cooldown.set(30);
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
    }
    this.cooldownTimer = setInterval(() => {
      const left = this.cooldown() - 1;
      this.cooldown.set(Math.max(0, left));
      if (left <= 0 && this.cooldownTimer) {
        clearInterval(this.cooldownTimer);
        this.cooldownTimer = null;
      }
    }, 1000);
  }

  async setPassword(): Promise<void> {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const ok = await this.run(async () => {
      const res = (await this.auth.setNewPassword(
        this.emailForm.getRawValue().email,
        this.codeForm.getRawValue().code,
        this.passwordForm.getRawValue().password,
        this.userId || undefined,
      )) as { userId?: string; valid?: boolean } | null;
      // Same 200-with-empty-body contract as the verify step: no userId
      // means the token expired between the steps.
      if (!res?.userId) {
        throw { error: { message: this.t('recover_link_invalid') } };
      }
    });
    if (ok) {
      this.step.set('done');
      // ABSOLUT: relativ zu `reset/:email/:token` ersetzt `../login` nur das
      // letzte URL-Segment (→ /auth/reset/<email>/login, noMatch).
      // Forced flow: the login already issued the session — continue into
      // the app instead of bouncing back to the login form.
      const target = this.forced() ? '/auth/tenant-login' : '/auth/login';
      setTimeout(() => this.router.navigateByUrl(target), 2200);
    }
  }
}
