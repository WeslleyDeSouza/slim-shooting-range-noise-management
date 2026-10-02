import type { Page } from '@playwright/test';

/**
 * Background maps of the viewer (`assets/config/map.config.json`): the
 * swisstopo vector styles («Light Base Map», «Imagery Base Map») and the
 * raster tiles of the WMTS.
 */
export const MAP_STYLES = 'https://vectortiles.geo.admin.ch/**';
export const MAP_TILES = 'https://wmts.geo.admin.ch/**';
/** Raster tiles of the Orthofoto, as the «Imagery Base Map» loads them. */
export const IMAGERY_TILES = 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg';

/** 1 × 1 px PNG. */
const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const CORS = { 'access-control-allow-origin': '*' };

/** A style document without vector sources: a background colour, for the imagery map also the Orthofoto tiles. */
function styleFor(url: string): object {
  const imagery = url.includes('imagerybasemap');
  return {
    version: 8,
    name: imagery ? 'imagery (e2e)' : 'light (e2e)',
    sources: imagery ? { swissimage: { type: 'raster', tiles: [IMAGERY_TILES], tileSize: 256, maxzoom: 19 } } : {},
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': imagery ? '#20303a' : '#f4f1ea' } },
      ...(imagery ? [{ id: 'swissimage', type: 'raster', source: 'swissimage' }] : []),
    ],
  };
}

/**
 * Answers every request of the background maps locally: the specs must not
 * depend on an external service (B1 5.4.5: no availability promise), and
 * the CORS header keeps the canvas readable for the export.
 */
export async function mockMapTiles(page: Page): Promise<void> {
  await page.route(MAP_STYLES, (route) => {
    const url = route.request().url();
    if (url.endsWith('/style.json')) return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(styleFor(url)) });
    return route.fulfill({ status: 404, headers: CORS, body: '' });
  });
  await page.route(MAP_TILES, (route) => route.fulfill({ status: 200, contentType: 'image/png', headers: CORS, body: TILE }));
}

/** The external map services are down: every request of a background map fails. */
export async function failMapTiles(page: Page): Promise<void> {
  await page.route(MAP_STYLES, (route) => route.abort('failed'));
  await page.route(MAP_TILES, (route) => route.abort('failed'));
}
