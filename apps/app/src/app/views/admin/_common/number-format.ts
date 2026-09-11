/** Swiss thousands separator: right single quotation mark, never the ASCII one. */
const GROUP_SEPARATOR = '’';

/**
 * `1234` → `1’234`.
 *
 * `toLocaleString('de-CH')` alone is not enough: which character it groups
 * with depends on the CLDR version built into the running JS engine — newer
 * ICU emits `’` (U+2019), older ones the straight `'` (U+0027). The rendered
 * number would then differ between browsers, Node versions and the test
 * runner, so pin the separator ourselves.
 */
export function formatSwissNumber(value: number | undefined | null): string {
  return (value ?? 0)
    .toLocaleString('de-CH')
    .replace(/['‘’  ]/g, GROUP_SEPARATOR);
}
