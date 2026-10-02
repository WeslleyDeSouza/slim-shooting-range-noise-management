import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pipe, PipeTransform, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataEmitter } from '@app-galaxy/sdk-ui';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import type { ManualInfoDto, SystemSettingsDto } from '@ui-slim/apiClient';
import { AccessFacade } from '../../../../core/access/access.facade';
import { SelectionListsFacade } from '../../../../core/settings/selection-lists.facade';
import { fakeSelectionLists } from '../../../../core/settings/selection-lists.testing';
import { SettingsFacade } from '../../../../core/settings/settings.facade';
import { AMPEL_DEFAULT_COLORS, DmSystemComponent, THRESHOLD_DEFAULTS } from './dm-system.component';

/** Keys pass through; interpolation like the real pipe. */
@Pipe({ name: 'translate' })
class TranslateStubPipe implements PipeTransform {
  transform(key: string, params?: Record<string, unknown>): string {
    return Object.entries(params ?? {}).reduce((t, [k, v]) => `${t} ${k}=${v}`, key);
  }
}

const DEFAULTS: SystemSettingsDto = {
  usageLockDate: null,
  ...THRESHOLD_DEFAULTS,
  colorOk: null,
  colorWarn: null,
  colorOver: null,
  specialistName: null,
  specialistPhone: null,
  specialistEmail: null,
  sysadminName: null,
  sysadminPhone: null,
  sysadminEmail: null,
  manual: null,
};

function mockFacade(initial: SystemSettingsDto = DEFAULTS) {
  const settings = signal<SystemSettingsDto | null>(initial);
  const manual = signal<ManualInfoDto | null>(initial.manual);
  return {
    settings,
    manual,
    loading: signal(false),
    saving: signal(false),
    error: signal<string | null>(null),
    load: jest.fn().mockResolvedValue(undefined),
    save: jest.fn(async (body: Record<string, unknown>) => {
      settings.update((s) => ({ ...(s as SystemSettingsDto), ...body }) as SystemSettingsDto);
      return true;
    }),
    uploadManual: jest.fn(async (file: File) => {
      manual.set({ fileName: file.name, size: file.size, uploadedAt: '2026-10-02T12:00:00.000Z' });
      return true;
    }),
    removeManual: jest.fn(async () => {
      manual.set(null);
      return true;
    }),
    manualFile: jest.fn().mockResolvedValue(new Blob(['%PDF-'])),
  };
}

describe('DmSystemComponent — Erweiterte Konfiguration (B1 5.28, slm 27)', () => {
  let fixture: ComponentFixture<DmSystemComponent>;
  let facade: ReturnType<typeof mockFacade>;
  let canWrite: ReturnType<typeof signal<boolean>>;

  async function setup(options: { settings?: SystemSettingsDto; write?: boolean } = {}): Promise<void> {
    facade = mockFacade(options.settings ?? DEFAULTS);
    canWrite = signal(options.write ?? true);
    await TestBed.configureTestingModule({
      imports: [DmSystemComponent],
      providers: [
        { provide: SettingsFacade, useValue: facade },
        { provide: SelectionListsFacade, useValue: fakeSelectionLists() },
        { provide: AccessFacade, useValue: { canWrite: () => canWrite, load: jest.fn() } },
        DataEmitter,
      ],
    })
      .overrideComponent(DmSystemComponent, { remove: { imports: [TranslatePipe] }, add: { imports: [TranslateStubPipe] } })
      .compileComponents();
    fixture = TestBed.createComponent(DmSystemComponent);
    await settle();
  }

  /** Not `whenStable()`: the toast keeps a timer open for seconds. */
  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    fixture.detectChanges();
  }

  const el = <T extends Element = HTMLElement>(testId: string): T => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as T;
  const type = (testId: string, value: string) => {
    const input = el<HTMLInputElement>(testId);
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const submit = async () => {
    el<HTMLFormElement>('dsys-form').dispatchEvent(new Event('submit'));
    await settle();
  };

  it('shows the thresholds of B1 5.10 while nothing is configured: Kontingent in percent, Empfangspunkte in dB (FAQ 166)', async () => {
    await setup();
    expect(el<HTMLInputElement>('dsys-quota-green').value).toBe('100');
    expect(el<HTMLInputElement>('dsys-quota-orange').value).toBe('125');
    expect(el('dsys-quota-red').textContent?.trim()).toBe('125');
    expect(el('dsys-quota').textContent).toContain('admin.dm_system.thresholds.percent_of_target');
    expect(el<HTMLInputElement>('dsys-noise-green').value).toBe('-5');
    expect(el<HTMLInputElement>('dsys-noise-orange').value).toBe('0');
    expect(el('dsys-noise-red').textContent?.trim()).toBe('0');
    expect(el('dsys-noise').textContent).toContain('admin.dm_system.thresholds.db_deviation');
    expect(el<HTMLInputElement>('dsys-lock').value).toBe('');
    expect(el('dsys-manual-none')).not.toBeNull();
    expect(el<HTMLButtonElement>('dsys-save').disabled).toBe(true);
  });

  it('saves the Sperrdatum, the thresholds and the contacts', async () => {
    await setup();
    type('dsys-lock', '2025-12-31');
    type('dsys-quota-orange', '110');
    type('dsys-noise-green', '-3');
    type('dsys-specialist-name', '  KOMZ Lärm ');
    type('dsys-sysadmin-email', 'betrieb@example.org');
    await settle();
    expect(el('dsys-dirty')).not.toBeNull();
    expect(el('dsys-quota-red').textContent?.trim()).toBe('110');
    await submit();

    expect(facade.save).toHaveBeenCalledWith({
      usageLockDate: '2025-12-31',
      quotaGreenMaxPercent: 100,
      quotaOrangeMaxPercent: 110,
      noiseGreenMaxDb: -3,
      noiseOrangeMaxDb: 0,
      colorOk: null,
      colorWarn: null,
      colorOver: null,
      specialistName: 'KOMZ Lärm',
      specialistPhone: null,
      specialistEmail: null,
      sysadminName: null,
      sysadminPhone: null,
      sysadminEmail: 'betrieb@example.org',
    });
    expect(el('dsys-toast').textContent).toContain('admin.dm_system.toast_saved');
    expect(el('dsys-dirty')).toBeNull();
    expect(fixture.componentInstance.canDeactivate()).toBe(true);
  });

  it('refuses «orange» below «grün» and values out of range', async () => {
    await setup();
    type('dsys-quota-green', '130');
    await submit();
    expect(el('dsys-quota-error').textContent).toContain('admin.dm_system.errors.order');
    expect(facade.save).not.toHaveBeenCalled();

    type('dsys-quota-green', '0');
    await submit();
    expect(el('dsys-quota-error').textContent).toContain('admin.dm_system.errors.quota_range');

    type('dsys-quota-green', '100');
    type('dsys-noise-orange', '-8');
    await submit();
    expect(el('dsys-noise-error').textContent).toContain('admin.dm_system.errors.order');
    expect(facade.save).not.toHaveBeenCalled();
  });

  it('sets own Ampel colours and goes back to the colours of the design', async () => {
    await setup({ settings: { ...DEFAULTS, colorOver: '#aa0000' } });
    // No own colour: the field shows the colour of the design and says «Standard».
    expect(el<HTMLInputElement>('dsys-colorOk').value).toBe(AMPEL_DEFAULT_COLORS.colorOk);
    expect(el('dsys-colorOk-value').textContent).toContain('admin.dm_system.colors.default');
    expect(el('dsys-colorOver-value').textContent?.trim()).toBe('#aa0000');

    type('dsys-colorOk', '#00AA55');
    el<HTMLButtonElement>('dsys-colorOver-reset').click();
    await settle();
    expect(el('dsys-colorOk-value').textContent?.trim()).toBe('#00aa55');
    await submit();
    expect(facade.save).toHaveBeenCalledWith(expect.objectContaining({ colorOk: '#00aa55', colorWarn: null, colorOver: null }));
  });

  it('puts the defaults back with «Standard wiederherstellen»', async () => {
    await setup({ settings: { ...DEFAULTS, quotaOrangeMaxPercent: 150, noiseGreenMaxDb: -2, colorWarn: '#ff8800' } });
    expect(el<HTMLInputElement>('dsys-quota-orange').value).toBe('150');
    el<HTMLButtonElement>('dsys-defaults').click();
    await settle();
    expect(el<HTMLInputElement>('dsys-quota-orange').value).toBe('125');
    expect(el<HTMLInputElement>('dsys-noise-green').value).toBe('-5');
    await submit();
    expect(facade.save).toHaveBeenCalledWith(expect.objectContaining({ ...THRESHOLD_DEFAULTS, colorWarn: null }));
  });

  it('uploads a PDF as Benutzerhandbuch, refuses other files, and removes it', async () => {
    await setup();
    const pick = async (file: File) => {
      const input = el<HTMLInputElement>('dsys-manual-file');
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change'));
      await settle();
    };
    await pick(new File(['hello'], 'Handbuch.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
    expect(el('dsys-manual-error').textContent).toContain('admin.dm_system.manual_not_pdf');
    expect(facade.uploadManual).not.toHaveBeenCalled();

    await pick(new File(['%PDF-1.4'], 'Benutzerhandbuch SLIM.pdf', { type: 'application/pdf' }));
    expect(facade.uploadManual).toHaveBeenCalledTimes(1);
    expect(el('dsys-manual-error')).toBeNull();
    expect(el('dsys-manual-download').textContent).toContain('Benutzerhandbuch SLIM.pdf');
    expect(el('dsys-toast').textContent).toContain('admin.dm_system.toast_manual_uploaded');

    el<HTMLButtonElement>('dsys-manual-remove').click();
    await settle();
    expect(facade.removeManual).toHaveBeenCalled();
    expect(el('dsys-manual-none')).not.toBeNull();
  });

  it('redraws the mask when the settings arrive after it was rendered: «Sperre aufheben» appears with the Sperrdatum', async () => {
    await setup();
    expect(el('dsys-lock-clear')).toBeNull();
    // The answer of the API comes later than the first rendering (found by the e2e test of the Sperrdatum).
    facade.settings.set({ ...DEFAULTS, usageLockDate: '2025-12-31' });
    await settle();
    expect(el<HTMLInputElement>('dsys-lock').value).toBe('2025-12-31');
    expect(el('dsys-lock-clear')).not.toBeNull();
  });

  it('is read-only without the right to write', async () => {
    await setup({ write: false, settings: { ...DEFAULTS, usageLockDate: '2025-12-31' } });
    expect(el('dsys-readonly')).not.toBeNull();
    expect(el<HTMLInputElement>('dsys-lock').disabled).toBe(true);
    expect(el<HTMLInputElement>('dsys-quota-green').disabled).toBe(true);
    expect(el('dsys-actions')).toBeNull();
    expect(el('dsys-manual-file')).toBeNull();
    expect(el('dsys-defaults')).toBeNull();
  });

  it('asks before leaving with unsaved changes', async () => {
    await setup();
    type('dsys-lock', '2025-12-31');
    await settle();
    const leaving = fixture.componentInstance.canDeactivate() as Promise<boolean>;
    await settle();
    expect(el('dsys-discard')).not.toBeNull();
    el<HTMLButtonElement>('dsys-discard-keep').click();
    expect(await leaving).toBe(false);
  });
});

describe('Ampel default colours', () => {
  it('are the success / warning / danger tokens of the design (light theme)', () => {
    const tokens = readFileSync(join(__dirname, '../../../../../../../../libs/app/design-system/src/styles/slim/abstracts/_tokens.scss'), 'utf8');
    const light = tokens.slice(tokens.indexOf('$colors-light'), tokens.indexOf('$colors-dark'));
    const token = (name: string) => new RegExp(`'${name}':\\s*(#[0-9a-fA-F]{6})`).exec(light)?.[1]?.toLowerCase();
    expect(token('success')).toBe(AMPEL_DEFAULT_COLORS.colorOk);
    expect(token('warning')).toBe(AMPEL_DEFAULT_COLORS.colorWarn);
    expect(token('danger')).toBe(AMPEL_DEFAULT_COLORS.colorOver);
  });
});
