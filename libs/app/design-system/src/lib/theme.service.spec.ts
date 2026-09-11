import { TestBed } from '@angular/core/testing';
import { SLIM_THEME_CONFIG, SLIM_THEME_DEFAULTS } from './theme.config';
import { hexToRgbTriplet, SlimThemeService, toCssName } from './theme.service';

function mockMatchMedia(dark: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: dark,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });
}

describe('SlimThemeService', () => {
  const root = () => document.documentElement;

  beforeEach(() => {
    localStorage.clear();
    root().removeAttribute('data-theme');
    root().removeAttribute('data-bs-theme');
    root().removeAttribute('style');
    mockMatchMedia(false);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SLIM_THEME_CONFIG,
          useValue: { ...SLIM_THEME_DEFAULTS, storageKey: 'test.theme' },
        },
      ],
    });
  });

  it('defaults to light and ignores the OS until system mode is chosen', () => {
    mockMatchMedia(true);
    const service = TestBed.inject(SlimThemeService);
    TestBed.tick();

    expect(service.mode()).toBe('light');
    expect(root().getAttribute('data-theme')).toBe('light');

    service.setMode('system');
    TestBed.tick();
    expect(service.mode()).toBe('system');
    expect(service.resolved()).toBe('dark');
    expect(root().hasAttribute('data-theme')).toBe(false);
    expect(root().getAttribute('data-bs-theme')).toBe('dark');
  });

  it('persists an explicit mode and writes the attributes', () => {
    const service = TestBed.inject(SlimThemeService);
    service.setMode('dark');
    TestBed.tick();

    expect(root().getAttribute('data-theme')).toBe('dark');
    expect(root().getAttribute('data-bs-theme')).toBe('dark');
    expect(localStorage.getItem('test.theme')).toBe('dark');

    service.toggle();
    TestBed.tick();
    expect(root().getAttribute('data-theme')).toBe('light');
  });

  it('restores the stored mode on start', () => {
    localStorage.setItem('test.theme', 'dark');
    const service = TestBed.inject(SlimThemeService);
    expect(service.mode()).toBe('dark');
  });

  it('applies runtime colours as custom properties (with rgb triplet)', () => {
    const service = TestBed.inject(SlimThemeService);
    service.setColors({ primary: '#0066cc', primaryContrast: 'white' });
    TestBed.tick();

    expect(root().style.getPropertyValue('--slim-color-primary')).toBe(
      '#0066cc',
    );
    expect(root().style.getPropertyValue('--slim-color-primary-rgb')).toBe(
      '0, 102, 204',
    );
    expect(root().style.getPropertyValue('--slim-color-primary-contrast')).toBe(
      'white',
    );
    expect(
      root().style.getPropertyValue('--slim-color-primary-contrast-rgb'),
    ).toBe('');

    service.resetColors();
    TestBed.tick();
    expect(root().style.getPropertyValue('--slim-color-primary')).toBe('');
  });

  it('applies scheme-specific colours only for the resolved scheme', () => {
    const service = TestBed.inject(SlimThemeService);
    service.setColors({ light: { bg: '#ffffff' }, dark: { bg: '#000000' } });
    service.setMode('light');
    TestBed.tick();
    expect(root().style.getPropertyValue('--slim-color-bg')).toBe('#ffffff');

    service.setMode('dark');
    TestBed.tick();
    expect(root().style.getPropertyValue('--slim-color-bg')).toBe('#000000');
  });
});

describe('helpers', () => {
  it('maps camelCase keys to css names', () => {
    expect(toCssName('primary')).toBe('primary');
    expect(toCssName('primaryContrast')).toBe('primary-contrast');
    expect(toCssName('surface2')).toBe('surface-2');
    expect(toCssName('lineStrong')).toBe('line-strong');
  });

  it('converts hex colours to rgb triplets', () => {
    expect(hexToRgbTriplet('#dc0018')).toBe('220, 0, 24');
    expect(hexToRgbTriplet('#fff')).toBe('255, 255, 255');
    expect(hexToRgbTriplet('rgb(1,2,3)')).toBeNull();
  });
});
