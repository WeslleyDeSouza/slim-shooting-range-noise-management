import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import {
  SLIM_THEME_CONFIG,
  SLIM_THEME_DEFAULTS,
  SlimThemeConfig,
} from './theme.config';
import { SlimThemeService } from './theme.service';

/**
 * Registers the design system runtime.
 *
 *   providers: [provideDesignSystem({ colors: { all: { primary: '#dc0018' } } })]
 *
 * The theme service is created on app start so the stored mode and the
 * configured colours are applied before the first view renders.
 */
export function provideDesignSystem(
  config: Partial<SlimThemeConfig> = {},
): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: SLIM_THEME_CONFIG,
      useValue: { ...SLIM_THEME_DEFAULTS, ...config },
    },
    provideAppInitializer(() => {
      inject(SlimThemeService);
    }),
  ]);
}
