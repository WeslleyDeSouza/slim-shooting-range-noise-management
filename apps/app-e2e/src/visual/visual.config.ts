import type { PageAssertionsToHaveScreenshotOptions } from '@playwright/test';

/**
 * Shared thresholds of the visual specs.
 *
 * `maxDiffPixelRatio` is the share of the page that may differ before the
 * comparison fails (0.01 = one percent); `threshold` is the per-pixel colour
 * distance (0 exact, 1 anything) that still counts as equal, which absorbs
 * anti-aliasing. Override per run with `VISUAL_MAX_DIFF_RATIO` and
 * `VISUAL_THRESHOLD`, e.g. while a font change is being rolled out.
 */
export const SCREENSHOT: PageAssertionsToHaveScreenshotOptions = {
  animations: 'disabled',
  caret: 'hide',
  maxDiffPixelRatio: +(process.env['VISUAL_MAX_DIFF_RATIO'] ?? 0.01),
  threshold: +(process.env['VISUAL_THRESHOLD'] ?? 0.2),
};
