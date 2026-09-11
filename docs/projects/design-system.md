# Design System

Lib: `libs/app/design-system` (`@ui-slim/design-system`). Entwicklungsregeln:
[`.claude/styleguide.md`](../../.claude/styleguide.md). Living Styleguide: `/styleguide`.

## Ziele

- **Mobile first**, Desktop ab 1024 px (Seitenleiste statt Tabbar).
- **Alles SCSS**, BEM (`.slim-block__element--modifier`).
- **Tokens als CSS-Variablen** (`--slim-*`): SCSS-Funktionen (`color()`, `space()`, …)
  liefern `var(--slim-*)`, daher können Grundfarben zur Laufzeit per JS gesetzt werden
  (`SlimThemeService.setColors()`), z. B. pro Mandant.
- **Light und Dark** gleichwertig; Farbschema aus dem ELO-Redesign
  (Bundesrot `#dc0018`, Ink `#17181c`, Flächen `#f4f5f7` / `#ffffff`).

## Aufbau

```
src/styles/slim.scss              Einstieg (@use 'slim')
src/styles/slim/abstracts/        tokens, functions, mixins (kein CSS)
src/styles/slim/base/             css-vars (Runtime-Vertrag), reset, typography, utilities
src/styles/slim/components/       layout, navigation, button, card, form, feedback, data, overlay
src/styles/slim/bridge/           --bs-* Mapping für ng-bootstrap
src/lib/                          SlimThemeService, provideDesignSystem, <slim-theme-toggle>
```

## Stand

- Umgesetzt: Shell (Topbar/Sidebar/Tabbar), Kacheln, Karten, Formulare, Feedback
  (Badge/Alert/Toast/Spinner/Skeleton/Empty), Daten (Liste/Tabelle/Segmented/Tabs/Pager/Legende),
  Overlays (Sheet/Dialog, Dropdown, Menü), Breadcrumbs, Suche.
- Offen: Datepicker, Datei-Upload, Charts (Auswertungen), Karten-Widgets (falls MGDM/Geo).
