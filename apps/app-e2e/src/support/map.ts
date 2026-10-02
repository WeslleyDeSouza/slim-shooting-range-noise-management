import type { Page } from '@playwright/test';

/** Background tiles of the map viewer (swisstopo WMTS, `assets/config/map.config.json`). */
export const MAP_TILES = 'https://wmts.geo.admin.ch/**';

/** 1 × 1 px PNG. */
const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/**
 * Answers every tile request locally: the specs must not depend on an
 * external service (B1 5.4.5: no availability promise), and the CORS header
 * keeps the canvas readable for the export.
 */
export async function mockMapTiles(page: Page): Promise<void> {
  await page.route(MAP_TILES, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: TILE }),
  );
}

/** The external map service is down: every tile request fails. */
export async function failMapTiles(page: Page): Promise<void> {
  await page.route(MAP_TILES, (route) => route.abort('failed'));
}
