/**
 * Shared styles of the redesigned admin forms, values 1:1 from the approved
 * form mock (see docs/projects/admin-redesign-plan.md §4.2). Imported into the form
 * components' `styles` array until Etappe 3 extracts real `_ui` components.
 */
export const ELO_FORM_STYLES = `
  /* Async form load (pair with <app-elo-form-loading>): dims the form and
     blocks pointer input while the data patch is pending. */
  .elo-form--loading {
    opacity: 0.6;
    pointer-events: none;
  }

  :host {
    display: block;
    max-width: 760px;
    margin: 0 auto;
  }

  .elo-form__head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  }

  .elo-form__back {
    width: 38px;
    height: 38px;
    border: 1px solid var(--ad-line-strong);
    border-radius: var(--ad-radius);
    background: var(--ad-card);
    display: grid;
    place-items: center;
    flex: none;
    color: var(--ad-gray-700);
    cursor: pointer;
  }

  .elo-form__back:hover {
    border-color: var(--ad-gray-400);
  }

  .elo-form__crumb b {
    display: block;
    font-size: 16px;
  }

  .elo-form__crumb span {
    font-size: 12px;
    color: var(--ad-gray-500);
  }

  .elo-card {
    background: var(--ad-card);
    border: 1px solid var(--ad-line);
    border-radius: var(--ad-radius-lg);
    box-shadow: var(--ad-shadow);
    padding: 22px;
    margin-bottom: 16px;
  }

  @media (min-width: 720px) {
    .elo-card {
      padding: 28px;
    }
  }

  .elo-card h2 {
    font-size: 15px;
    margin: 0 0 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .elo-card h2::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--ad-line);
  }

  .elo-card h2 .elo-cnt {
    font-size: 11.5px;
    font-weight: 700;
    background: var(--ad-bg);
    border-radius: 10px;
    padding: 2px 9px;
    color: var(--ad-gray-500);
    font-variant-numeric: tabular-nums;
  }

  .elo-field {
    margin-bottom: 20px;
  }

  .elo-field:last-child {
    margin-bottom: 0;
  }

  .elo-field > label {
    display: flex;
    gap: 4px;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 6px;
    color: var(--ad-gray-700);
  }

  .elo-req {
    color: var(--ad-red);
  }

  .elo-field input[type='text'],
  .elo-field input[type='email'],
  .elo-field input[type='tel'],
  .elo-field input[type='number'],
  .elo-field input[type='password'],
  .elo-field textarea,
  .elo-field select {
    width: 100%;
    height: 46px;
    padding: 0 12px;
    border: 1px solid var(--ad-line-strong);
    border-radius: var(--ad-radius);
    background: var(--ad-card);
    transition: border-color 0.15s;
    appearance: none;
    -webkit-appearance: none;
    font-family: inherit;
    font-size: inherit;
    color: inherit;
  }

  .elo-field select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236B7280' stroke-width='1.6' fill='none'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 34px;
  }

  .elo-field input:focus,
  .elo-field textarea:focus,
  .elo-field select:focus {
    border-color: var(--ad-ink);
    outline: none;
    box-shadow: 0 0 0 3px rgba(23, 24, 28, 0.08);
  }

  .elo-field--err input,
  .elo-field--err textarea,
  .elo-field--err select {
    border-color: var(--ad-danger);
  }

  .elo-field--ok input,
  .elo-field--ok select {
    border-color: var(--ad-green);
  }

  .elo-field input:disabled,
  .elo-field select:disabled {
    background-color: var(--ad-bg);
    color: var(--ad-gray-500);
    cursor: not-allowed;
  }

  .elo-hint {
    font-size: 12.5px;
    color: var(--ad-gray-500);
    margin-top: 6px;
    line-height: 1.5;
  }

  .elo-error-msg {
    font-size: 12.5px;
    color: var(--ad-danger);
    margin-top: 6px;
    font-weight: 600;
  }

  .elo-row2 {
    display: grid;
    gap: 16px;
  }

  @media (min-width: 640px) {
    .elo-row2 {
      grid-template-columns: 1fr 1fr;
    }
  }

  .elo-alert {
    background: var(--ad-danger-bg);
    border: 1px solid #f2c6cb;
    border-radius: var(--ad-radius);
    padding: 11px 13px;
    font-size: 13.5px;
    color: var(--ad-danger);
    margin-bottom: 16px;
    font-weight: 600;
  }

  /* Used by several forms for a confirmation; without it success looked like
     an error, because the base class paints the danger colours. */
  .elo-alert--ok {
    background: #eaf5ee;
    border-color: #c4e2ce;
    color: var(--ad-green);
  }

  .elo-alert--warn {
    background: var(--ad-amber-bg);
    border-color: #f0dca8;
    color: #6b4e00;
  }

  .elo-rows {
    border: 1px solid var(--ad-line);
    border-radius: var(--ad-radius);
    overflow: hidden;
    margin-bottom: 12px;
  }

  .elo-rrow {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    background: var(--ad-card);
    border-bottom: 1px solid var(--ad-line);
  }

  .elo-rrow:last-child {
    border-bottom: 0;
  }

  .elo-rrow input {
    flex: 1;
    min-width: 0;
    height: 36px;
    border: 1px solid transparent;
    border-radius: 5px;
    padding: 0 8px;
    background: transparent;
    font-family: inherit;
    font-size: inherit;
    color: inherit;
  }

  .elo-rrow input:hover {
    border-color: var(--ad-line);
  }

  .elo-rrow input:focus {
    border-color: var(--ad-ink);
    background: var(--ad-card);
    outline: none;
  }

  .elo-icon-btn {
    width: 32px;
    height: 32px;
    border-radius: var(--ad-radius);
    border: 0;
    background: transparent;
    display: grid;
    place-items: center;
    color: var(--ad-gray-400);
    flex: none;
    cursor: pointer;
  }

  .elo-icon-btn:hover {
    background: var(--ad-danger-bg);
    color: var(--ad-danger);
  }

  .elo-row-add {
    display: flex;
    gap: 10px;
  }

  .elo-row-add input {
    flex: 1;
    height: 44px;
    padding: 0 12px;
    border: 1px solid var(--ad-line-strong);
    border-radius: var(--ad-radius);
    font-family: inherit;
    font-size: inherit;
    color: inherit;
    background: var(--ad-card);
  }

  .elo-row-add input:focus {
    border-color: var(--ad-ink);
    outline: none;
    box-shadow: 0 0 0 3px rgba(23, 24, 28, 0.08);
  }

  .elo-rows-empty {
    border: 1.5px dashed var(--ad-line-strong);
    border-radius: var(--ad-radius);
    padding: 18px 14px;
    text-align: center;
    font-size: 13px;
    color: var(--ad-gray-500);
    margin-bottom: 12px;
  }

  .elo-warn {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    background: var(--ad-amber-bg);
    border: 1px solid #f0dca8;
    border-radius: var(--ad-radius);
    padding: 11px 13px;
    font-size: 13px;
    color: #6b4e00;
    margin-top: 12px;
    line-height: 1.5;
  }

  .elo-warn svg {
    flex: none;
    margin-top: 1px;
  }

  .elo-toggle-row {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 14px;
    background: var(--ad-bg);
    border-radius: var(--ad-radius);
  }

  .elo-toggle {
    position: relative;
    width: 44px;
    height: 26px;
    flex: none;
    border: 0;
    border-radius: 13px;
    background: var(--ad-line-strong);
    transition: background 0.2s;
    cursor: pointer;
  }

  .elo-toggle::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    transition: transform 0.2s;
  }

  .elo-toggle[aria-pressed='true'] {
    background: var(--ad-green);
  }

  .elo-toggle[aria-pressed='true']::after {
    transform: translateX(18px);
  }

  .elo-toggle-label b {
    display: block;
    font-size: 14px;
  }

  .elo-toggle-label span {
    font-size: 12.5px;
    color: var(--ad-gray-500);
    line-height: 1.5;
  }

  .elo-card--danger {
    border-color: #f2c6cb;
  }

  .elo-card--danger h2 {
    color: var(--ad-danger);
  }

  .elo-card--danger h2::after {
    background: #f2c6cb;
  }

  .elo-danger-row {
    display: flex;
    gap: 14px;
    align-items: center;
    flex-wrap: wrap;
  }

  .elo-danger-row p {
    flex: 1;
    min-width: 220px;
    font-size: 13.5px;
    color: var(--ad-gray-700);
    line-height: 1.5;
    margin: 0;
  }

  .elo-btn {
    height: 46px;
    padding: 0 20px;
    border-radius: var(--ad-radius);
    border: 1px solid transparent;
    font-size: 14.5px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.15s;
    white-space: nowrap;
    cursor: pointer;
    font-family: inherit;
  }

  .elo-btn--primary {
    background: var(--ad-red);
    color: #fff;
  }

  .elo-btn--primary:hover {
    background: var(--ad-red-dark);
  }

  .elo-btn--primary:disabled {
    background: var(--ad-line-strong);
    cursor: default;
  }

  .elo-btn--ghost {
    background: var(--ad-card);
    border-color: var(--ad-line-strong);
    color: var(--ad-gray-700);
  }

  .elo-btn--ghost:hover {
    border-color: var(--ad-gray-400);
  }

  .elo-btn--danger-ghost {
    background: var(--ad-card);
    border-color: #e8a6ad;
    color: var(--ad-danger);
  }

  .elo-btn--danger-ghost:hover {
    background: var(--ad-danger-bg);
  }

  .elo-actions {
    position: sticky;
    bottom: calc(var(--ad-tabbar-h) + env(safe-area-inset-bottom));
    z-index: 35;
    background: var(--ad-card);
    border-top: 1px solid var(--ad-line);
    border-radius: var(--ad-radius-lg) var(--ad-radius-lg) 0 0;
    box-shadow: var(--ad-shadow-lift);
    margin: 24px -16px 0;
  }

  @media (min-width: 1024px) {
    .elo-actions {
      bottom: 0;
      margin: 24px 0 0;
    }
  }

  .elo-actions__inner {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 12px 16px;
  }

  .elo-dirty {
    font-size: 12.5px;
    color: var(--ad-amber);
    font-weight: 600;
    flex: 1;
    min-width: 0;
  }

  .elo-actions .elo-btn--ghost {
    min-width: 120px;
  }

  .elo-actions .elo-btn--primary {
    min-width: 180px;
  }

  @media (max-width: 560px) {
    .elo-actions__inner {
      flex-wrap: wrap;
    }

    .elo-dirty {
      flex-basis: 100%;
    }

    .elo-actions .elo-btn {
      flex: 1;
      min-width: 0;
    }
  }
`;
