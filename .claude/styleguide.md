# SLIM Styling Guide

Design system: `libs/app/design-system` (`@ui-slim/design-system`).
Living styleguide: run the app and open `/styleguide`.

## Principles

1. **Mobile first.** Write the phone layout, then add `@include slim.mq('md')` /
   `mq('lg')` for larger screens. Never `max-width` queries except for the rare
   mobile-only case (`mq-down`).
2. **Everything is SCSS.** No inline `style=""`, no CSS-in-TS, no Tailwind-style
   utility soup. Component styles live in the component's `.scss` file.
3. **Tokens only, never raw values.** Colours, spacing, radii, shadows, sizes and
   type come from the token functions. They return CSS custom properties
   (`var(--slim-*)`), which is what makes runtime theming and light/dark work.
4. **BEM.** `.block__element--modifier`. Blocks of the design system use the
   `slim-` prefix; app / feature blocks use a short prefix of their own
   (`.app-…`, `.sg-…`, `.report-…`). Nested SCSS with `&__` and `&--`.
5. **Light and dark are both first class.** Everything that has a colour must
   look right in both. Check `/styleguide` in both modes before finishing.

## Where things live

```
libs/app/design-system/src/styles/
  slim.scss                    entry: @use 'slim';           (full CSS)
  slim/abstracts/_tokens.scss  the source of truth (SCSS maps)
  slim/abstracts/_functions    color() space() radius() shadow() font-size() size() z()
  slim/abstracts/_mixins       mq() mq-down() hover elem() mod() focus-visible truncate surface control-base …
  slim/base/_css-vars.scss     emits --slim-* (light + dark) — the runtime contract
  slim/components/*.scss       BEM components
  slim/bridge/_bootstrap.scss  --bs-* mapping for ng-bootstrap widgets
libs/app/design-system/src/lib/
  theme.service.ts             SlimThemeService: mode + runtime colours
  provide-design-system.ts     provideDesignSystem(config)
  theme-toggle.component.ts    <slim-theme-toggle>
.claude/styleguide.md          this file
```

`apps/app/project.json` → `stylePreprocessorOptions.includePaths` contains
`libs/app/design-system/src/styles`, so `@use 'slim'` / `@use 'slim/abstracts'`
resolve from any stylesheet.

## Writing component styles

```scss
// report-card.component.scss
@use 'slim/abstracts' as slim;   // functions + mixins, NO css output

:host { display: block; }

.report-card {
  @include slim.surface;                         // bg, border, radius, shadow
  padding: slim.space(4);
  color: slim.color('text-2');

  &__title {
    font-size: slim.font-size('lg');
    font-weight: slim.font-weight('semibold');
    @include slim.truncate;
  }

  &__meta {
    color: slim.color('text-3');
    font-size: slim.font-size('sm');
  }

  &--urgent {
    border-left: 4px solid slim.color('danger');
  }

  @include slim.mq('md') {                       // tablet and up
    display: grid;
    grid-template-columns: 1fr auto;
  }

  @include slim.hover {                          // pointer devices only
    box-shadow: slim.shadow('md');
  }
}
```

Rules of thumb:

- Prefer the design-system blocks in the template (`slim-btn`, `slim-card`,
  `slim-field` …) and add app BEM classes only for layout / feature specifics.
- One block per component; elements are flat (`&__title`, never `&__a__b`).
- Modifiers describe state or variant (`--active`, `--compact`), not looks
  (`--red`).
- No `!important`, no id selectors, no element selectors deeper than one level.
- No `::ng-deep`. To restyle a design-system block inside a component, wrap it
  in an app element and set the block's custom properties or add a modifier
  in the design system itself.
- Touch targets ≥ 44px (`size('touch')`), inputs ≥ 16px font on phones
  (`control-base` does this).
- Motion: use `transition('fast'|'base')`; the reset honours
  `prefers-reduced-motion`.

## Token reference

| Function              | Returns                   | Examples                                                          |
| --------------------- | ------------------------- | ----------------------------------------------------------------- |
| `color($name)`        | `var(--slim-color-$name)` | `primary`, `primary-strong`, `primary-contrast`, `ink`, `text-2/3/4`, `line`, `line-strong`, `bg`, `surface`, `surface-2`, `success`, `warning`, `danger`, `info`, `link`, `focus`, `scrim` |
| derived colours       | via `color-mix()`         | `primary-hover`, `primary-subtle`, `primary-muted`, `<state>-subtle`, `<state>-muted`, `hover`, `active`, `disabled`, `disabled-bg` |
| `alpha($name, .2)`    | `rgba(var(--…-rgb), .2)`  | translucent variant of any base colour                            |
| `space($step)`        | `var(--slim-space-$step)` | `0 1 2 3 4 5 6 8 10 12 16` → 0 4 8 12 16 20 24 32 40 48 64 px      |
| `radius($k)`          | `var(--slim-radius-$k)`   | `sm 4` `md 6` `lg 10` `xl 16` `pill`                               |
| `shadow($k)`          | `var(--slim-shadow-$k)`   | `sm` `md` `lg` (theme-dependent)                                   |
| `font-size($k)`       | `var(--slim-font-size-$k)`| `xs sm md lg xl 2xl 3xl` (11 / 13 / 15 / 17 / 20 / 24 / 30 px)     |
| `font-weight($k)`     | `var(--slim-font-weight-$k)` | `regular medium semibold bold`                                 |
| `size($k)`            | `var(--slim-size-$k)`     | `topbar-h 56` `tabbar-h 58` `sidebar-w 264` `control-h 40` `control-h-sm 32` `control-h-lg 48` `touch 44` `container 1200` `container-narrow 720` |
| `z($layer)`           | number (build time)       | `base raised sticky sidebar topbar scrim sheet toast`             |
| `transition($speed)`  | `var(--slim-transition-…)`| `fast` 120ms, `base` 200ms                                        |

Breakpoints (min-width): `sm 480` · `md 768` · `lg 1024` · `xl 1280`.
Mobile = below `lg` (topbar + tabbar); desktop = `lg` and up (sidebar).

## Colour scheme (from pwa-elo-shot-counting redesign)

| Token          | Light     | Dark      | Use                                   |
| -------------- | --------- | --------- | ------------------------------------- |
| primary        | `#dc0018` | `#dc0018` | brand, primary actions, active nav    |
| primary-strong | `#b00013` | `#f0334a` | hover / pressed                       |
| ink            | `#17181c` | `#f1f2f4` | body text                             |
| text-2 / 3 / 4 | `#3e434c` `#6b7280` `#9aa1ab` | `#c6cad2` `#9aa1ab` `#6b7280` | secondary, muted, placeholder |
| line / strong  | `#e2e4e9` `#c9cdd4` | `#2e333b` `#3d434d` | borders                    |
| bg / surface   | `#f4f5f7` `#ffffff` | `#14161a` `#1d2025` | page / cards               |
| success        | `#1e7a3c` | `#46b56b` |                                       |
| warning        | `#8a6100` | `#d9a93f` |                                       |
| danger         | `#c71624` | `#f0475a` |                                       |
| info / link    | `#006699` | `#58a6d6` |                                       |

Font: `'Helvetica Now', 'Helvetica Neue', Helvetica, 'Segoe UI', Arial, sans-serif`,
15px base, line-height 1.5. Radii 6px (controls) / 10px (cards).

## Theme mechanics

- `<html data-theme="light|dark">` is set by `SlimThemeService`; without the
  attribute (`system`) the CSS follows `prefers-color-scheme`.
- `index.html` applies the stored choice (`localStorage['slim.theme']`) in an
  inline script before first paint, so there is no flash.
- `data-bs-theme` is mirrored for ng-bootstrap widgets.
- Runtime brand colours: `SlimThemeService.setColors({ primary: '#0066cc' })`
  writes `--slim-color-primary` (+ `-rgb`) on `<html>`. Derived shades follow via
  `color-mix()`. Per-scheme values: `setColors({ light: {…}, dark: {…} })`.
  Configure on start with `provideDesignSystem({ colors: { all: {…} } })`.
- Build-time defaults: `@use 'slim' with ($colors-light: (...), $font-size-base: 16px);`
  in `apps/app/src/styles.scss`.

## Component catalogue (block → elements / modifiers)

- **Layout**: `slim-shell` (`__topbar __sidebar __main __tabbar`), `slim-page`
  (`__header __title __subtitle __actions __body`), `slim-container` (`--narrow --flush`),
  `slim-stack` (`--xs --sm --lg --row --row-md`), `slim-grid` (`--2 --3 --4 --auto`), `slim-divider`
- **Navigation**: `slim-topbar` (`__brand __mark __brand-text __org __title __actions __btn __iconbtn __user __user-name`, `--primary`),
  `slim-tabbar` (`__item --active __icon __label __badge`) mobile only,
  `slim-sidebar` (`__brand __section __heading __link --active __icon __footer`) desktop only,
  `slim-breadcrumbs` (`__item --current`)
- **Entry page**: `slim-hello` (`__greet __name __sub`), `slim-tiles` + `slim-tile`
  (`__icon --neutral __title __text __kpi __foot --muted`; `--disabled`)
- **Button**: `slim-btn` (`__icon __label`; `--primary --secondary --ghost --danger --link`,
  `--sm --lg --block --block-mobile --icon --pill --loading`), `slim-btn-group` (`--stretch`)
- **Card**: `slim-card` (`__header __title __subtitle __actions __body __footer __media`;
  `--flat --borderless --interactive --selected --accent --dense --bleed`), `slim-stat`
  (`__label __value __delta --up --down`)
- **Form**: `slim-form` (`__row __section __legend __actions`), `slim-field`
  (`__label __required __hint __error __control __addon`; `--invalid --inline`),
  `slim-input` (`--sm --lg`), `slim-select`, `slim-textarea`, `slim-check`
  (`__input __label __hint`), `slim-switch` (`__input __label`)
- **Feedback**: `slim-badge` (`__dot`; `--primary --success --warning --danger --info --solid --outline`),
  `slim-chip` (`--selected __remove`), `slim-chips` (`--scroll`), `slim-alert`
  (`__icon __body __title __close`; `--success --warning --danger --info`),
  `slim-toasts` + `slim-toast` (`__body __title __action`; state modifiers),
  `slim-spinner` (`--sm --lg`), `slim-skeleton` (`--text --title --circle --block`),
  `slim-empty` (`__icon __title __text __action`), `slim-avatar` (`--sm --lg`)
- **Data**: `slim-list` (`__item --interactive __leading __content __title __meta __trailing`;
  `--divided --card`), `slim-toolbar` (`__grow __meta __lock`), `slim-search` (`__input __icon`),
  `slim-filter`, `slim-table-wrap` + `slim-table` (`__cell--num --wrap --actions`,
  `__row--clickable --selected`; `--striped --dense --stack`), `slim-table-foot` (`__grow`),
  `slim-pager` (`__btn --active`), `slim-legend` (`__item`), `slim-row-actions`, `slim-segmented`
  (`__item --active`; `--block`), `slim-tabs` (`__tab --active`), `slim-kv` (`__key __value`)
- **Overlay**: `slim-sheet` (`__backdrop __panel __handle __header __title __close __body __footer`;
  `--open --lg --full`) bottom sheet on phones, dialog from `md`; `slim-dropdown`
  (`__panel`; `--open --left`) anchor for a `slim-menu`
  (`__item --active --danger __icon __divider __heading`)
- **Badge icons**: `slim-badge__icon` (14px svg before the label; see `app-status-pill`)
- **Typography**: `slim-h1…h4`, `slim-text--muted --secondary --small --xs --strong --mono --danger --success`, `slim-eyebrow`
- **Utilities** (`slim-u-*`): `sr-only truncate text-center text-right flex flex-between grow desktop-only mobile-only mt-N mb-N`

## Adding a component to the design system

1. Create `slim/components/_<name>.scss`, `@use '../abstracts' as *;`, one block
   with `@include elem()` / `@include mod()`.
2. `@use` it in `slim.scss`.
3. Add it to the `/styleguide` page and to the catalogue above.
4. Check light + dark, 375px and 1280px.
