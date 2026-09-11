# @ui-slim/design-system (ui-design-system)

Reusable, mobile-first design system for SLIM: SCSS tokens → CSS custom
properties (`--slim-*`), BEM components (`.slim-<block>__<el>--<mod>`),
light + dark theme, and an Angular `SlimThemeService` that changes mode and
brand colours at runtime.

The full guide lives in [`.claude/styleguide.md`](../../../.claude/styleguide.md).

## Use

```scss
// apps/app/src/styles.scss  (includePaths: libs/app/design-system/src/styles)
@use 'slim';

// any component stylesheet
@use 'slim/abstracts' as slim;
.app-thing { padding: slim.space(4); color: slim.color('text-2'); }
```

```ts
// app.config.ts
import { provideDesignSystem } from '@ui-slim/design-system';
providers: [provideDesignSystem({ colors: { all: { primary: '#dc0018' } } })];

// anywhere
inject(SlimThemeService).setMode('dark');
inject(SlimThemeService).setColors({ primary: '#0066cc' });
```

Styleguide page in the app: `/styleguide` (`apps/app/src/app/views/styleguide`).

## Layout

```
src/styles/slim.scss                 entry (full CSS)
src/styles/slim/abstracts/           tokens, functions, mixins (no CSS output)
src/styles/slim/base/                css-vars (runtime contract), reset, typography, utilities
src/styles/slim/components/          layout, navigation, button, card, form, feedback, data, overlay
src/styles/slim/bridge/              --bs-* mapping for ng-bootstrap widgets
src/lib/                             SlimThemeService, provideDesignSystem, <slim-theme-toggle>
```
