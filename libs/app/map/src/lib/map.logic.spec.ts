import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_MAP_CONFIG } from './map-config.service';
import { exportLayout, footerLines, MapExportOptions, MapExportTexts } from './map-export';
import {
  drawablePlantParts,
  formatLv95,
  formatScale,
  isInExtent,
  objectsExtent,
  placeablePoints,
  plantPartLabel,
  printScale,
  scaleBar,
  scaleDenominator,
  wktCoordinates,
} from './map.logic';
import type { MapPlantPart, MapPoint } from './map.model';

const EXTENT = DEFAULT_MAP_CONFIG.extent;
const point = (id: string, east: number | null, north: number | null): MapPoint => ({ id, code: id, east, north, state: 'ok', label: id });
const part = (id: string, geometry: string | null): MapPlantPart => ({ id, name: `Raum ${id}`, coordinationSectionNo: `1104.020.${id}`, geometry });
const SQUARE = 'POLYGON((2618300 1176700, 2618380 1176700, 2618380 1176750, 2618300 1176750, 2618300 1176700))';

describe('map logic (slm 2, B1 5.4)', () => {
  it('derives the Massstab 1:x from the resolution (0.28 mm per pixel) and the printed scale from the dpi', () => {
    expect(scaleDenominator(1)).toBe(3571);
    expect(scaleDenominator(2.5)).toBe(8929);
    expect(formatScale(scaleDenominator(2.5))).toBe('1:8’929');
    // 1 m per pixel printed at 254 dpi: one pixel is 0.1 mm → 1:10 000.
    expect(printScale(1, 254)).toBe(10000);
  });

  it('sizes the Ausdehnungsbalken to a round length that fits', () => {
    expect(scaleBar(1)).toEqual({ meters: 100, px: 100, label: '100 m' });
    expect(scaleBar(2.5)).toEqual({ meters: 200, px: 80, label: '200 m' });
    expect(scaleBar(20)).toEqual({ meters: 2000, px: 100, label: '2 km' });
    expect(scaleBar(0.25)).toEqual({ meters: 20, px: 80, label: '20 m' });
  });

  it('formats LV95 coordinates as whole metres, east first (B1 5.4.4)', () => {
    expect(formatLv95([2618420.4, 1176899.6])).toBe('2’618’420, 1’176’900');
    expect(formatLv95(null)).toBe('');
  });

  it('only places points that have LV95 coordinates inside the extent', () => {
    expect(isInExtent(2618420, 1176900, EXTENT)).toBe(true);
    expect(isInExtent(618420, 176900, EXTENT)).toBe(false); // LV03
    expect(isInExtent(1176900, 2618420, EXTENT)).toBe(false); // east / north swapped
    const points = [point('E1', 2618180, 1176916), point('E2', null, 1176900), point('E3', 618180, 176916)];
    expect(placeablePoints(points, EXTENT).map((p) => p.id)).toEqual(['E1']);
  });

  it('reads the coordinates of WKT geometries, with or without Z', () => {
    expect(wktCoordinates('POINT(2618300 1176700)')).toEqual([[2618300, 1176700]]);
    expect(wktCoordinates('LINESTRING Z (2618300 1176700 650.5, 2618400 1176800 655)')).toEqual([
      [2618300, 1176700],
      [2618400, 1176800],
    ]);
    expect(wktCoordinates(SQUARE)).toHaveLength(5);
    expect(wktCoordinates(null)).toEqual([]);
  });

  it('draws only Anlagenteile with a geometry inside the extent and labels them by the last block of their number', () => {
    const parts = [part('07', SQUARE), part('08', null), part('09', 'POINT(618300 176700)')];
    expect(drawablePlantParts(parts, EXTENT).map((p) => p.id)).toEqual(['07']);
    expect(plantPartLabel(parts[0])).toBe('07');
    expect(plantPartLabel({ coordinationSectionNo: '', name: 'NGST oben' })).toBe('NGST oben');
  });

  it('spans the extent over points and Anlagenteile, null when nothing can be shown', () => {
    expect(objectsExtent([point('E1', 2618180, 1176916)], [part('07', SQUARE)], EXTENT)).toEqual([2618180, 1176700, 2618380, 1176916]);
    expect(objectsExtent([point('E2', null, null)], [part('08', null)], EXTENT)).toBeNull();
  });
});

describe('map configuration (B1 5.4.2)', () => {
  it('ships a JSON file an administrator can edit, identical to the built-in fallback', () => {
    const file = JSON.parse(readFileSync(join(__dirname, '../../../../../apps/app/public/assets/config/map.config.json'), 'utf8'));
    expect(file).toEqual(DEFAULT_MAP_CONFIG);
  });

  it('offers 10–12 Zoomstufen and the swisstopo background maps with the light base map as default (5.4.3 / 5.4.5)', () => {
    const { zoom, baseMaps, defaultBaseMap, tileGrid } = DEFAULT_MAP_CONFIG;
    expect(zoom.resolutions.length).toBeGreaterThanOrEqual(10);
    expect(zoom.resolutions.length).toBeLessThanOrEqual(12);
    expect([...zoom.resolutions].sort((a, b) => b - a)).toEqual(zoom.resolutions); // coarse → fine
    // Every Zoomstufe is a resolution the tile grid serves natively (sharp tiles, no resampling).
    for (const r of zoom.resolutions) expect(tileGrid.resolutions).toContain(r);
    expect(defaultBaseMap).toBe('light');
    expect(baseMaps.map((b) => b.id)).toEqual(['light', 'imagery', 'topo']);
    for (const b of baseMaps) {
      expect(b.url).toMatch(/^https:\/\/wmts\.geo\.admin\.ch\/1\.0\.0\/ch\.swisstopo\.[a-z0-9._-]+\/default\/current\/2056\/\{z\}\/\{x\}\/\{y\}\.(png|jpeg)$/);
      expect(b.maxMatrix).toBeLessThan(tileGrid.resolutions.length);
    }
  });
});

describe('map export layout (B1 5.4.6)', () => {
  const all: MapExportOptions = { format: 'pdf', dpi: 150, title: true, copyright: true, date: true, disclaimer: true, scale: true, center: true };
  const texts: MapExportTexts = { title: 'T', copyright: '© swisstopo', date: 'Gedruckt am 02.10.2026', disclaimer: 'D', scale: 'Massstab 1:5’000', center: 'Zentrum 2’618’420, 1’176’900', fileName: 'karte' };

  it('fits title, map and three footer lines on A4 landscape', () => {
    const layout = exportLayout(all);
    expect(layout).toEqual({ mapWidthMm: 277, mapHeightMm: 162, mapTopMm: 20, footer: ['scale-center', 'date-copyright', 'disclaimer'] });
    expect(layout.mapTopMm + layout.mapHeightMm + 3 + 3 * 5 + 10).toBe(210);
    expect(footerLines(all, texts)).toEqual([
      { left: 'Massstab 1:5’000', right: 'Zentrum 2’618’420, 1’176’900' },
      { left: 'Gedruckt am 02.10.2026', right: '© swisstopo' },
      { left: 'D', right: '' },
    ]);
  });

  it('gives the map the space of every extra that is left out', () => {
    const none: MapExportOptions = { ...all, title: false, copyright: false, date: false, disclaimer: false, scale: false, center: false };
    expect(exportLayout(none)).toEqual({ mapWidthMm: 277, mapHeightMm: 190, mapTopMm: 10, footer: [] });
    expect(footerLines(none, texts)).toEqual([]);
    // Only one half of a line chosen: the line stays, the other half is empty.
    expect(footerLines({ ...none, center: true }, texts)).toEqual([{ left: '', right: 'Zentrum 2’618’420, 1’176’900' }]);
  });
});
