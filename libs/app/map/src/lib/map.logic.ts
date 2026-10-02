import type { MapConfig, MapPlantPart, MapPoint } from './map.model';

/** Standardised rendering pixel of OGC (0.28 mm) — the usual basis of «1:XXX» on screen maps. */
export const OGC_PIXEL_M = 0.00028;

/** Massstab 1:x of a view with `resolution` m per px (B1 5.4.3). */
export function scaleDenominator(resolution: number): number {
  return Math.round(resolution / OGC_PIXEL_M);
}

/** Massstab of a printed map: `resolution` m per px at `dpi` px per inch. */
export function printScale(resolution: number, dpi: number): number {
  return Math.round((resolution * dpi) / 0.0254);
}

export interface ScaleBar {
  meters: number;
  px: number;
  label: string;
}

/** Ausdehnungsbalken: the longest «round» length (1, 2 or 5 × 10ⁿ m) that fits into `maxPx`. */
export function scaleBar(resolution: number, maxPx = 120): ScaleBar {
  const maxMeters = resolution * maxPx;
  const magnitude = 10 ** Math.floor(Math.log10(maxMeters));
  const step = [5, 2, 1].find((s) => s * magnitude <= maxMeters) ?? 1;
  const meters = step * magnitude;
  return { meters, px: Math.round(meters / resolution), label: meters >= 1000 ? `${meters / 1000} km` : `${meters} m` };
}

/** Whole number with the Swiss thousands separator «’» — fixed here, because Intl gives ' or ’ depending on the runtime. */
const integer = { format: (value: number): string => String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '’') };

/** «2’618’420, 1’176’900» — LV95 east, north in whole metres (B1 5.4.4). */
export function formatLv95(coordinate: readonly [number, number] | null): string {
  if (!coordinate) return '';
  return `${integer.format(Math.round(coordinate[0]))}, ${integer.format(Math.round(coordinate[1]))}`;
}

export function formatScale(denominator: number): string {
  return `1:${integer.format(denominator)}`;
}

/** Inside the LV95 extent of the configuration (a swapped or LV03 coordinate is not). */
export function isInExtent(east: number, north: number, extent: MapConfig['extent']): boolean {
  return east >= extent[0] && east <= extent[2] && north >= extent[1] && north <= extent[3];
}

/** Points the map can place: both coordinates present and inside the extent. */
export function placeablePoints(points: MapPoint[], extent: MapConfig['extent']): (MapPoint & { east: number; north: number })[] {
  return points.filter(
    (p): p is MapPoint & { east: number; north: number } => p.east !== null && p.north !== null && isInExtent(p.east, p.north, extent),
  );
}

/** Coordinate pairs of a WKT geometry (POINT, LINESTRING, POLYGON, MULTI…; Z values are dropped). */
export function wktCoordinates(wkt: string | null): [number, number][] {
  if (!wkt) return [];
  const out: [number, number][] = [];
  for (const match of wkt.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)(?:\s+-?\d+(?:\.\d+)?)?/g)) {
    out.push([Number(match[1]), Number(match[2])]);
  }
  return out;
}

/** Anlageteile the map can draw: a geometry whose coordinates all lie inside the extent. */
export function drawablePlantParts(parts: MapPlantPart[], extent: MapConfig['extent']): MapPlantPart[] {
  return parts.filter((p) => {
    const coordinates = wktCoordinates(p.geometry);
    return coordinates.length > 0 && coordinates.every(([e, n]) => isInExtent(e, n, extent));
  });
}

/** Bounding box [minE, minN, maxE, maxN] of points and Anlageteile, null when there is nothing to show. */
export function objectsExtent(points: MapPoint[], parts: MapPlantPart[], extent: MapConfig['extent']): [number, number, number, number] | null {
  const coordinates: [number, number][] = [
    ...placeablePoints(points, extent).map((p): [number, number] => [p.east, p.north]),
    ...drawablePlantParts(parts, extent).flatMap((p) => wktCoordinates(p.geometry)),
  ];
  if (!coordinates.length) return null;
  const east = coordinates.map((c) => c[0]);
  const north = coordinates.map((c) => c[1]);
  return [Math.min(...east), Math.min(...north), Math.max(...east), Math.max(...north)];
}

/** Short label of an Anlageteil on the map: the last block of its Koordinationsabschnittsnummer («07»), else the name. */
export function plantPartLabel(part: Pick<MapPlantPart, 'coordinationSectionNo' | 'name'>): string {
  const tail = part.coordinationSectionNo.split('.').pop();
  return tail && tail !== part.coordinationSectionNo ? tail : part.name;
}
