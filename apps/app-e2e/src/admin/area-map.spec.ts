import { expect, test, type Page } from '@playwright/test';
import { failMapTiles, mockMapTiles } from '../support/map';
import { ROUTES } from '../support/selectors';

/**
 * GIS-Kartenviewer (B1 5.4, Abbildung 16; slm 2) on the Details of the demo
 * area 1104.020 Geissalp: 6 Empfangspunkte and 14 Anlagenteile in LV95 on a
 * swisstopo background. The background tiles are answered locally, so the
 * suite does not depend on the external service. Signed in through the
 * setup project.
 */
const MAP = {
  detailsTab: '[data-testid="area-tab-details"]',
  host: '[data-testid="details-map"]',
  viewer: '[data-testid="map-viewer"]',
  pin: '[data-testid="details-pin"]',
  aside: '[data-testid="details-aside"]',
  scale: '[data-testid="map-scale"]',
  scaleBar: '[data-testid="map-scale-bar"]',
  coordinates: '[data-testid="map-coordinates"]',
  zoomIn: '[data-testid="map-zoom-in"]',
  zoomOut: '[data-testid="map-zoom-out"]',
  zoomLevel: '[data-testid="map-zoom-level"]',
  reset: '[data-testid="map-reset"]',
  base: '[data-testid="map-base"]',
  baseItem: (id: string) => `[data-testid="map-base-${id}"]`,
  layers: '[data-testid="map-layers"]',
  layersPanel: '[data-testid="map-layers-panel"]',
  layerPoints: '[data-testid="map-layer-points"]',
  layerParts: '[data-testid="map-layer-plant-parts"]',
  export: '[data-testid="map-export"]',
  exportPanel: '[data-testid="map-export-panel"]',
  exportFormat: '[data-testid="map-export-format"]',
  exportDpi: '[data-testid="map-export-dpi"]',
  exportExtra: (name: string) => `[data-testid="map-export-${name}"]`,
  exportRun: '[data-testid="map-export-run"]',
  tilesFailed: '[data-testid="map-tiles-failed"]',
  fullscreen: '[data-testid="details-fullscreen"]',
  // Vollansicht
  pageTitle: '[data-testid="amap-title"]',
  pagePin: '[data-testid="amap-pin"]',
  pageInfo: '[data-testid="amap-info"]',
  pageRow: '[data-testid="amap-row"]',
} as const;

async function openDetails(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(ROUTES.area);
  // First row of the overview is 1104.020 Geissalp (sorted by number).
  await page.locator('.slim-table tbody tr.slim-table__row').first().click();
  await page.locator(MAP.detailsTab).click();
  await expect(page.locator(MAP.viewer)).toHaveAttribute('data-status', 'ready');
  await expect(page.locator(MAP.pin)).toHaveCount(6);
}

test.describe('map viewer (slm 2)', () => {
  test('shows the Empfangspunkte on the map with Massstab, Ausdehnungsbalken and Zoomstufen (5.4.3)', async ({ page }) => {
    await mockMapTiles(page);
    await openDetails(page);

    // The pins sit on the map (not in the hidden holder) and one of them opens the details.
    const e1 = page.locator(`${MAP.pin}[data-code="E1"]`);
    await expect(e1).toBeVisible();
    await e1.click();
    await expect(page.locator(MAP.aside)).toContainText('E1');

    // Massstab «1:XXX» and a bar with a round length.
    await expect(page.locator(MAP.scale)).toHaveText(/^1:\d{1,3}(’\d{3})*$/);
    await expect(page.locator(MAP.scaleBar)).toHaveText(/^\d+ (m|km)$/);
    const level = Number(await page.locator(MAP.zoomLevel).innerText());
    const scale = await page.locator(MAP.scale).innerText();
    expect(level).toBeGreaterThanOrEqual(1);
    expect(level).toBeLessThanOrEqual(12);

    // + enlarges the scale by one Zoomstufe, − goes back, «Default» returns to the start.
    await page.locator(MAP.zoomIn).click();
    await expect(page.locator(MAP.zoomLevel)).toHaveText(String(level + 1));
    await expect(page.locator(MAP.scale)).not.toHaveText(scale);
    await page.locator(MAP.zoomOut).click();
    await page.locator(MAP.zoomOut).click();
    await expect(page.locator(MAP.zoomLevel)).toHaveText(String(level - 1));
    await page.locator(MAP.reset).click();
    await expect(page.locator(MAP.zoomLevel)).toHaveText(String(level));
    await expect(page.locator(MAP.scale)).toHaveText(scale);
  });

  test('shows the LV95 coordinates under the mouse (5.4.4)', async ({ page }) => {
    await mockMapTiles(page);
    await openDetails(page);
    const box = await page.locator(MAP.viewer).boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2);
    // Geissalp of the demo lies around 2’618’400 / 1’176’900.
    await expect(page.locator(MAP.coordinates)).toHaveText(/2’61[78]’\d{3}, 1’17[67]’\d{3}/);
  });

  test('switches the background map and the layers (5.4.5, 5.10)', async ({ page }) => {
    const tiles: string[] = [];
    await mockMapTiles(page);
    page.on('request', (request) => {
      if (request.url().startsWith('https://wmts.geo.admin.ch/')) tiles.push(request.url());
    });
    await openDetails(page);
    // Default: the light base map of swisstopo in LV95.
    await expect.poll(() => tiles.some((u) => u.includes('ch.swisstopo.leichte-basiskarte_reliefschattierung') && u.includes('/2056/'))).toBe(true);

    await page.locator(MAP.base).click();
    await expect(page.locator(MAP.baseItem('imagery'))).toBeVisible();
    await expect(page.locator(MAP.baseItem('topo'))).toBeVisible();
    await page.locator(MAP.baseItem('imagery')).click();
    await expect(page.locator(MAP.base)).toContainText('Luftbild');
    await expect.poll(() => tiles.some((u) => u.includes('ch.swisstopo.swissimage/'))).toBe(true);

    // Layers: the Empfangspunkte can be hidden and shown again; the legend explains the colours.
    await page.locator(MAP.layers).click();
    await expect(page.locator(MAP.layersPanel)).toContainText('Grenzwert überschritten');
    await expect(page.locator(MAP.layerParts)).toBeChecked();
    await page.locator(MAP.layerPoints).uncheck();
    await expect(page.locator(`${MAP.pin}[data-code="E1"]`)).toBeHidden();
    await page.locator(MAP.layerPoints).check();
    await expect(page.locator(`${MAP.pin}[data-code="E1"]`)).toBeVisible();
  });

  test('exports the Kartenausschnitt as PDF and as image (5.4.6)', async ({ page }) => {
    await mockMapTiles(page);
    await openDetails(page);

    await page.locator(MAP.export).click();
    await expect(page.locator(MAP.exportPanel)).toBeVisible();
    // Resolution and the optional extras of the print.
    await expect(page.locator(`${MAP.exportDpi} option`)).toHaveText(['96 dpi', '150 dpi', '300 dpi']);
    for (const extra of ['title', 'copyright', 'date', 'disclaimer', 'scale', 'center']) {
      await expect(page.locator(MAP.exportExtra(extra))).toBeChecked();
    }
    await page.locator(MAP.exportExtra('disclaimer')).uncheck();
    await page.locator(MAP.exportDpi).selectOption('96');

    const pdf = page.waitForEvent('download');
    await page.locator(MAP.exportRun).click();
    const file = await pdf;
    expect(file.suggestedFilename()).toMatch(/^karte-1104-020-geissalp-\d{4}-\d{2}-\d{2}\.pdf$/);
    await expect(page.locator(MAP.exportPanel)).toBeHidden();
    // The map is back at its size and still usable after the export.
    await expect(page.locator(`${MAP.pin}[data-code="E1"]`)).toBeVisible();

    await page.locator(MAP.export).click();
    await page.locator(MAP.exportFormat).selectOption('image');
    await expect(page.locator(MAP.exportExtra('title'))).toHaveCount(0);
    const image = page.waitForEvent('download');
    await page.locator(MAP.exportRun).click();
    expect((await image).suggestedFilename()).toMatch(/^karte-1104-020-geissalp-\d{4}-\d{2}-\d{2}\.jpg$/);
  });

  test('keeps working without the background service and says so (FAQ 119)', async ({ page }) => {
    await failMapTiles(page);
    await openDetails(page);
    await expect(page.locator(MAP.tilesFailed)).toContainText('Hintergrundkarte nicht erreichbar');
    await page.locator(`${MAP.pin}[data-code="E2"]`).click();
    await expect(page.locator(MAP.aside)).toContainText('E2');
  });

  test('opens the Vollansicht in a separate tab with the points of the state (5.10)', async ({ page, context }) => {
    await mockMapTiles(page);
    await openDetails(page);
    const link = page.locator(MAP.fullscreen);
    await expect(link).toHaveAttribute('href', /\/admin\/area\/[^/]+\/map\?state=/);
    await expect(link).toHaveAttribute('target', '_blank');

    const opened = context.waitForEvent('page');
    await link.click();
    const full = await opened;
    await mockMapTiles(full);
    await expect(full).toHaveURL(/\/admin\/area\/[^/]+\/map\?state=/);
    await expect(full.locator(MAP.pageTitle)).toContainText('Karte 1104.020 Geissalp');
    await expect(full.locator(MAP.pagePin)).toHaveCount(6);
    // A chosen point shows its Grenzwert and Beurteilungspegel next to the map.
    await full.locator(`${MAP.pagePin}[data-code="E1"]`).click();
    await expect(full.locator(MAP.pageInfo)).toContainText('E1');
    await expect(full.locator(MAP.pageRow).first()).toContainText('60 dB');
    await expect(full.locator(MAP.pageRow).first()).toContainText('60.8 dB');
  });
});
