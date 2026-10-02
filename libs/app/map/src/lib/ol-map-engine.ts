import OlMap from 'ol/Map';
import View from 'ol/View';
import { boundingExtent, buffer, createEmpty, extend as extendExtent, isEmpty } from 'ol/extent';
import WKT from 'ol/format/WKT';
import { defaults as defaultInteractions } from 'ol/interaction/defaults';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import Projection from 'ol/proj/Projection';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import { Fill, Stroke, Style, Text } from 'ol/style';
import TileGrid from 'ol/tilegrid/TileGrid';
import { drawablePlantParts, plantPartLabel, printScale } from './map.logic';
import type { MapConfig, MapEngine, MapEngineHandlers, MapExportImage, MapExportRequest, MapPin, MapPlantPart } from './map.model';

/** The export waits this long for the background tiles before it prints what is there. */
const EXPORT_TIMEOUT_MS = 12_000;

/**
 * OpenLayers behind the `MapEngine` interface (slm 2): view, tiles and data
 * in CH1903+ / LV95, so no reprojection is involved. Background maps are
 * swisstopo WMTS layers fetched live (B1 5.4.2, no caching in SLIM), the
 * Anlagenteile a vector layer. The Empfangspunkte are the buttons the viewer
 * renders (keyboard, screen reader and tests reach them like any button);
 * they stay where the framework put them and are only positioned here, on
 * every rendered frame — moving them into the map would take them away
 * from the framework that owns them.
 */
export function createOlMapEngine(target: HTMLElement, config: MapConfig, handlers: MapEngineHandlers): MapEngine {
  const projection = new Projection({ code: config.projection, units: 'm', extent: config.extent });
  const wkt = new WKT();

  const baseLayers = new Map(
    config.baseMaps.map((base) => {
      const source = new XYZ({
        url: base.url,
        projection,
        crossOrigin: 'anonymous', // needed to read the canvas for the export
        attributions: base.attribution,
        tileGrid: new TileGrid({
          origin: config.tileGrid.origin,
          resolutions: config.tileGrid.resolutions.slice(0, base.maxMatrix + 1),
          extent: config.extent,
        }),
      });
      source.on('tileloaderror', () => handlers.tileError());
      return [base.id, new TileLayer({ source, opacity: base.opacity ?? 1, visible: base.id === config.defaultBaseMap })];
    }),
  );

  const plantPartSource = new VectorSource();
  const style = config.layers.plantParts;
  const plantPartLayer = new VectorLayer({
    source: plantPartSource,
    visible: style.visible,
    style: (feature, resolution) =>
      new Style({
        stroke: new Stroke({ color: style.stroke, width: style.strokeWidth }),
        fill: new Fill({ color: style.fill }),
        text:
          resolution <= style.labelMaxResolution
            ? new Text({
                text: String(feature.get('label') ?? ''),
                font: '600 12px Helvetica, Arial, sans-serif',
                fill: new Fill({ color: style.stroke }),
                stroke: new Stroke({ color: '#ffffff', width: 3 }),
                overflow: true,
              })
            : undefined,
      }),
  });

  const view = new View({
    projection,
    extent: config.extent,
    resolutions: config.zoom.resolutions,
    constrainResolution: true,
    center: config.defaultCenter,
    resolution: config.zoom.resolutions[0],
  });

  const map = new OlMap({
    target,
    layers: [...baseLayers.values(), plantPartLayer],
    view,
    controls: [], // the viewer brings its own (B1 Abbildung 16)
    interactions: defaultInteractions({ altShiftDragRotate: false, pinchRotate: false }),
  });

  let pins: MapPin[] = [];
  let pinsVisible = config.layers.points.visible;
  /** Zoomstufe a running zoom animation heads for, so quick clicks add up. */
  let targetZoom: number | null = null;

  /** Places every pin at the pixel of its coordinate (`--x` / `--y` of the design-system pin). */
  const positionPins = () => {
    for (const pin of pins) {
      const pixel = pinsVisible ? map.getPixelFromCoordinate([pin.east, pin.north]) : null;
      pin.element.style.display = pixel ? '' : 'none'; // the pin sets its own `display`, the `hidden` attribute would lose
      if (pixel) {
        pin.element.style.setProperty('--x', `${Math.round(pixel[0])}px`);
        pin.element.style.setProperty('--y', `${Math.round(pixel[1])}px`);
      }
    }
  };

  const emitView = () => {
    const center = view.getCenter();
    const resolution = view.getResolution();
    if (!center || !resolution) return;
    handlers.view({ zoom: Math.round(view.getZoom() ?? 0), resolution, center: [center[0], center[1]] });
  };
  map.on('moveend', () => {
    targetZoom = null;
    emitView();
  });
  map.on('postrender', positionPins);
  map.on('pointermove', (event) => handlers.pointer(event.dragging ? null : [event.coordinate[0], event.coordinate[1]]));
  const leave = () => handlers.pointer(null);
  map.getViewport().addEventListener('pointerleave', leave);

  const objectsExtent = () => {
    const extent = createEmpty();
    const parts = plantPartSource.getFeatures().length ? plantPartSource.getExtent() : null;
    if (parts) extendExtent(extent, parts);
    if (pins.length) extendExtent(extent, boundingExtent(pins.map((p) => [p.east, p.north])));
    return extent;
  };

  const fit = () => {
    const extent = objectsExtent();
    if (isEmpty(extent)) {
      view.setCenter(config.defaultCenter);
      view.setResolution(config.zoom.resolutions[0]);
    } else {
      // A single point has no size: give it a neighbourhood instead of the finest Zoomstufe.
      view.fit(buffer(extent, 40), { padding: Array(4).fill(config.zoom.fitPadding), minResolution: config.zoom.fitMinResolution });
    }
    emitView();
  };

  return {
    setBaseMap(id) {
      for (const [key, layer] of baseLayers) layer.setVisible(key === id);
    },

    setPlantParts(parts: MapPlantPart[]) {
      plantPartSource.clear();
      for (const part of drawablePlantParts(parts, config.extent)) {
        try {
          const feature = wkt.readFeature(part.geometry as string);
          feature.setId(part.id);
          feature.set('label', plantPartLabel(part));
          plantPartSource.addFeature(feature);
        } catch {
          // a geometry the format cannot read is left out, the others still show
        }
      }
    },

    setPins(next: MapPin[]) {
      pins = next;
      positionPins();
    },

    setLayerVisible(layer, visible) {
      if (layer === 'plantParts') {
        plantPartLayer.setVisible(visible);
        return;
      }
      pinsVisible = visible;
      positionPins();
    },

    fit,

    zoomBy(delta) {
      // From the Zoomstufe the view is heading for: a second click during the animation must not be lost.
      const from = targetZoom ?? Math.round(view.getZoom() ?? 0);
      targetZoom = Math.max(0, Math.min(config.zoom.resolutions.length - 1, from + delta));
      view.cancelAnimations();
      view.animate({ zoom: targetZoom, duration: 150 });
    },

    exportImage(request: MapExportRequest): Promise<MapExportImage> {
      const size = map.getSize();
      const resolution = view.getResolution();
      const center = view.getCenter();
      if (!size || !resolution || !center) return Promise.reject(new Error('map not ready'));
      const width = Math.round((request.widthMm * request.dpi) / 25.4);
      const height = Math.round((request.heightMm * request.dpi) / 25.4);
      // Same area as on screen, at the pixel density of the export.
      const printResolution = resolution / Math.min(width / size[0], height / size[1]);

      return new Promise<MapExportImage>((resolve, reject) => {
        let done = false;
        const restore = () => {
          map.setSize(size);
          view.setConstrainResolution(true);
          view.setResolution(resolution);
          view.setCenter(center);
        };
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          try {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d') as CanvasRenderingContext2D;
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, width, height);
            for (const layerCanvas of Array.from(map.getViewport().querySelectorAll<HTMLCanvasElement>('.ol-layer canvas, canvas.ol-layer'))) {
              if (!layerCanvas.width) continue;
              const opacity = layerCanvas.parentElement?.style.opacity || layerCanvas.style.opacity;
              context.globalAlpha = opacity === '' ? 1 : Number(opacity);
              const transform = layerCanvas.style.transform.match(/^matrix\(([^(]*)\)$/);
              const matrix = transform
                ? transform[1].split(',').map(Number)
                : [parseFloat(layerCanvas.style.width) / layerCanvas.width, 0, 0, parseFloat(layerCanvas.style.height) / layerCanvas.height, 0, 0];
              context.setTransform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
              context.drawImage(layerCanvas, 0, 0);
            }
            context.globalAlpha = 1;
            context.setTransform(1, 0, 0, 1, 0, 0);
            drawPins(context, request, (coordinate) => map.getPixelFromCoordinate(coordinate), request.dpi);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
            resolve({ dataUrl, widthPx: width, heightPx: height, scale: printScale(printResolution, request.dpi), center: [center[0], center[1]] });
          } catch (error) {
            reject(error);
          } finally {
            restore();
          }
        };
        const timer = setTimeout(finish, EXPORT_TIMEOUT_MS);
        map.once('rendercomplete', finish);
        map.setSize([width, height]);
        view.setConstrainResolution(false);
        view.setResolution(printResolution);
        view.setCenter(center);
      });
    },

    destroy() {
      map.getViewport().removeEventListener('pointerleave', leave);
      map.setTarget(undefined);
    },
  };
}

/** The Empfangspunkte of the export: a filled circle in the Ampel colour with the code, sized in mm. */
function drawPins(
  context: CanvasRenderingContext2D,
  request: MapExportRequest,
  pixelOf: (coordinate: [number, number]) => number[] | null,
  dpi: number,
): void {
  const radius = (2.6 * dpi) / 25.4;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `700 ${Math.round(radius * 0.95)}px Helvetica, Arial, sans-serif`;
  for (const pin of request.pins) {
    const pixel = pixelOf([pin.east, pin.north]);
    if (!pixel) continue;
    context.beginPath();
    context.arc(pixel[0], pixel[1], radius, 0, 2 * Math.PI);
    context.fillStyle = pin.color;
    context.fill();
    context.lineWidth = Math.max(1, radius / 5);
    context.strokeStyle = '#ffffff';
    context.stroke();
    context.fillStyle = '#ffffff';
    context.fillText(pin.code, pixel[0], pixel[1]);
  }
}
