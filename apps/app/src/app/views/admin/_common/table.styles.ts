/**
 * Shared toolbar + table styling of the redesigned list pages (units,
 * tenants, …) — extracted from the units overview so every list page
 * stops carrying its own copy.
 */
export const AD_TABLE_STYLES = `
    :host {
      display: block;
    }
    .ad-page {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .ad-toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .ad-search {
      position: relative;
      min-width: 220px;
      flex: 1;
      max-width: 340px;
    }
    .ad-search input {
      width: 100%;
      height: 40px;
      padding: 0 12px 0 34px;
      border: 1px solid var(--ad-line-strong);
      border-radius: var(--ad-radius);
      background: var(--ad-card);
      font: inherit;
      color: inherit;
    }
    .ad-search input:focus {
      border-color: var(--ad-ink);
      outline: none;
      box-shadow: 0 0 0 3px rgba(23, 24, 28, 0.08);
    }
    .ad-search svg {
      position: absolute;
      left: 11px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--ad-gray-400);
    }
    .ad-chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .ad-chip {
      font-size: 12.5px;
      font-weight: 600;
      border: 1px solid var(--ad-line-strong);
      border-radius: 14px;
      background: var(--ad-card);
      color: var(--ad-gray-700);
      padding: 5px 12px;
      cursor: pointer;
      font-family: inherit;
    }
    .ad-chip[aria-pressed='true'] {
      background: var(--chip-color, var(--ad-ink));
      border-color: var(--chip-color, var(--ad-ink));
      /* Gegenfarbe zur Flaeche, nicht fix weiss: im dunklen Modus ist
         --ad-ink fast weiss, weisse Schrift darauf waere unlesbar. */
      color: var(--ad-card);
    }
    .ad-grow {
      flex: 1;
    }
    .ad-result-count {
      font-size: 12.5px;
      color: var(--ad-gray-500);
      white-space: nowrap;
    }
    .ad-more {
      position: relative;
    }
    .ad-btn {
      height: 40px;
      padding: 0 14px;
      border-radius: var(--ad-radius);
      font: inherit;
      font-weight: 600;
      font-size: 13.5px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 7px;
    }
    .ad-btn--ghost {
      background: var(--ad-card);
      border: 1px solid var(--ad-line-strong);
      color: var(--ad-gray-700);
    }
    .ad-btn--primary {
      background: var(--ad-ink);
      border: 1px solid var(--ad-ink);
      color: var(--ad-card);
    }
    .ad-menu-pop {
      position: absolute;
      right: 0;
      top: calc(100% + 6px);
      z-index: 20;
      min-width: 200px;
      background: var(--ad-card);
      border: 1px solid var(--ad-line);
      border-radius: var(--ad-radius);
      box-shadow: var(--ad-shadow-lg, 0 10px 26px rgba(0, 0, 0, 0.14));
      padding: 6px;
      display: flex;
      flex-direction: column;
    }
    .ad-menu-pop button {
      text-align: left;
      padding: 9px 11px;
      border: 0;
      background: none;
      font: inherit;
      font-size: 13.5px;
      border-radius: 7px;
      cursor: pointer;
      color: inherit;
    }
    .ad-menu-pop button:hover:not(:disabled) {
      background: var(--ad-bg);
    }
    .ad-menu-pop button:disabled {
      opacity: 0.55;
      cursor: default;
    }
    .ad-note--error {
      background: var(--ad-danger-bg);
      color: var(--ad-danger);
      border-radius: var(--ad-radius);
      padding: 11px 13px;
      font-size: 13.5px;
      font-weight: 600;
    }
    .ad-table-wrap {
      background: var(--ad-card);
      border: 1px solid var(--ad-line);
      border-radius: var(--ad-radius-lg);
      box-shadow: var(--ad-shadow);
      overflow-x: auto;
    }
    .ad-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13.5px;
    }
    .ad-table th {
      text-align: left;
      font-size: 11.5px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--ad-gray-500);
      padding: 11px 14px;
      border-bottom: 1px solid var(--ad-line);
      white-space: nowrap;
    }
    .ad-table td {
      padding: 10px 14px;
      border-bottom: 1px solid var(--ad-line);
      vertical-align: middle;
    }
    .ad-table tr:last-child td {
      border-bottom: 0;
    }
    .ad-table td b {
      font-weight: 600;
      display: block;
    }
    .ad-table td small {
      color: var(--ad-gray-500);
      font-size: 12px;
    }
    .ad-sort {
      cursor: pointer;
      user-select: none;
    }
    .ad-num {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .c {
      text-align: center;
    }
    .r {
      text-align: right;
    }
    .ad-cat-chips {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    .ad-cat-chip {
      font-size: 11.5px;
      font-weight: 600;
      border-radius: 10px;
      padding: 2px 9px;
      color: #fff;
      background: var(--chip-color, var(--ad-gray-500));
      white-space: nowrap;
    }
    .ad-toggle {
      position: relative;
      width: 40px;
      height: 24px;
      border: 0;
      border-radius: 12px;
      background: var(--ad-line-strong);
      transition: background 0.2s;
      cursor: pointer;
    }
    .ad-toggle::after {
      content: '';
      position: absolute;
      top: 3px;
      left: 3px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
      transition: transform 0.2s;
    }
    .ad-toggle[aria-pressed='true'] {
      background: var(--ad-green);
    }
    .ad-toggle[aria-pressed='true']::after {
      transform: translateX(16px);
    }
    .ad-row-actions {
      display: inline-flex;
      gap: 6px;
    }
    .ad-icon-btn {
      width: 30px;
      height: 30px;
      display: inline-grid;
      place-items: center;
      border: 1px solid var(--ad-line-strong);
      border-radius: 7px;
      background: var(--ad-card);
      color: var(--ad-gray-700);
      cursor: pointer;
    }
    .ad-icon-btn--danger {
      color: var(--ad-danger);
    }
    .ad-empty {
      text-align: center;
      color: var(--ad-gray-500);
      padding: 28px 14px !important;
    }
`;
