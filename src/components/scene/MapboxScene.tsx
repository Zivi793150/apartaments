"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { Map, LngLatLike, GeoJSONSource } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export type MapboxPickedUnit = { id: string; area: number; rooms: number } | null;
export type MapboxSceneFilter = {
  activeBuilding: "all" | "a" | "b";
  rooms?: 1 | 2 | 3 | 4 | null;
  onlyAvailable?: boolean;
  hoverFloor?: number | null;
};

const sanitizeExpression = (expr: any): any => {
  if (!Array.isArray(expr)) return expr;
  if (expr[0] === "feature-set" || expr[0] === "feature-state") return expr;
  if (expr[0] === "get" && expr[1] === "sizerank") {
    return ["coalesce", ["get", "sizerank"], 0];
  }
  return expr.map((e: any) => sanitizeExpression(e));
};

// Простая генерация плана квартир (пример). Позже можно заменить данными из public/plans

const TEST_FLOORS = [1, 2, 3, 4, 5, 6];
const FLOOR_HEIGHT_M = 3.1;
const UNITS_PER_FLOOR = 4;

type Unit = { id: string; floor: number; status: "available" | "reserved" | "sold"; area: number; rooms: number; polyUV: [number, number][] };

// Парсинг geojson квартир
async function loadUnitsFromGeojson(): Promise<Unit[]> {
  const floors = TEST_FLOORS;
  const units: Unit[] = [];
  for (const f of floors) {
    const candidateFiles = [`floor${f}.geojson`];
    if (f === 1) candidateFiles.push('1floor.geojson'); // backwards compatibility

    let geojson: any = null;
    for (const file of candidateFiles) {
      try {
        const res = await fetch(`/plans/geojson/${file}`);
        if (!res.ok) continue;
        geojson = await res.json();
        break;
      } catch {
        continue;
      }
    }

    if (!geojson || !geojson.features) continue;

    for (const feat of geojson.features) {
      const props = feat.properties || {};
      units.push({
        id: props.id || `${f}-${units.length + 1}`,
        floor: f,
        status: props.status || "available",
        area: props.area || 40,
        rooms: props.rooms || 2,
        polyUV: feat.geometry?.coordinates?.[0]?.map((p: number[]) => [p[0], p[1]]) || [[0, 0], [1, 0], [1, 1], [0, 1]],
      });
    }
  }
  return units;
}

// Билинейная проекция UV -> lngLat на четырехугольник (контур здания)
function uvToLngLat(uv: [number, number], quad: [number, number][]) {
  const [u, v] = uv;
  const [A, B, C, D] = quad; // по часовой
  const lerp = (p: number[], q: number[], t: number) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t] as [number, number];
  const E = lerp(A, D, v);
  const F = lerp(B, C, v);
  return lerp(E, F, u) as [number, number];
}

function makeUnitsFeatureCollection(quad: [number, number][], units: Unit[]) {
  return {
    type: "FeatureCollection",
    features: units.map(u => {
      const ring = u.polyUV.map(p => uvToLngLat(p, quad));
      ring.push(ring[0]);
      // place unit extrusion to occupy the whole floor height on the facade
      // add small epsilon inset to avoid z-fighting with building top/base
      const min_h = (u.floor - 1) * FLOOR_HEIGHT_M + 0.02;
      const h = u.floor * FLOOR_HEIGHT_M - 0.02;
      return {
        type: "Feature",
        properties: { id: u.id, floor: u.floor, status: u.status, area: u.area, rooms: u.rooms, min_height: min_h, height: h },
        geometry: { type: "Polygon", coordinates: [ring] }
      };
    })
  } as GeoJSON.FeatureCollection;
}

export default function MapboxScene({
  filter,
  onPick,
}: {
  filter: MapboxSceneFilter;
  onPick?: (u: MapboxPickedUnit) => void;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const center = useMemo<[number, number]>(() => {
    const lat = parseFloat(process.env.NEXT_PUBLIC_BUILDING_LAT || "36.7696");
    const lng = parseFloat(process.env.NEXT_PUBLIC_BUILDING_LNG || "-4.0387");
    return [lng, lat];
  }, []);

  const [footprint, setFootprint] = useState<[number, number][]>(() => {
    const [lng, lat] = center;
    const dx = 0.00009 * Math.cos(lat * Math.PI / 180);
    const dy = 0.00006;
    return [
      [lng - dx, lat + dy],
      [lng + dx, lat + dy],
      [lng + dx * 0.95, lat - dy],
      [lng - dx * 0.95, lat - dy],
    ];
  });

  // Try to load a user-provided footprint / quad from public/building-quad.json
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/building-quad.json');
        if (!res.ok) { try { console.warn('MapboxScene: /building-quad.json not found', res.status); } catch {} ; return; }
        const json = await res.json();
        let quad: [number, number][] | null = null;
        // support simple array [[lng,lat],..] or GeoJSON Feature / FeatureCollection with Polygon
        if (Array.isArray(json) && json.length >= 4 && Array.isArray(json[0])) {
          quad = json.slice(0, 4) as any;
        } else if (json && json.type === 'Feature' && json.geometry && json.geometry.type === 'Polygon') {
          quad = json.geometry.coordinates[0].slice(0, 4) as any;
        } else if (json && json.type === 'FeatureCollection' && Array.isArray(json.features) && json.features.length) {
          const f = json.features.find((ff: any) => ff.geometry && ff.geometry.type === 'Polygon');
          if (f) quad = f.geometry.coordinates[0].slice(0,4) as any;
        }
        if (quad && mounted) setFootprint(quad);
        if (quad && mounted) {
          try { console.info('MapboxScene: loaded building-quad.json, using quad:', quad); } catch {}
          setFootprint(quad);
        }
      } catch (e) {
        try { console.warn('MapboxScene: failed to load /building-quad.json', e); } catch {}
        // ignore - fallback to generated rectangle
      }
    })();
    return () => { mounted = false; };
  }, []);

  const [units, setUnits] = useState<Unit[]>([]);
  const [externalUnits, setExternalUnits] = useState<GeoJSON.FeatureCollection | null>(null);

  
  // Try to load optional units.geojson (pre-drawn apartment polygons) from public
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/plans/geojson/units.geojson');
        if (!res.ok) return;
        const json = await res.json();
        if (mounted && json && json.type === 'FeatureCollection') setExternalUnits(json as GeoJSON.FeatureCollection);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !token) return;
    mapboxgl.accessToken = token;

    const loadMap = async () => {
      try {
        const response = await fetch("https://api.mapbox.com/styles/v1/mapbox/standard?access_token=" + token);
        const styleJson = await response.json();

        if (!Array.isArray(styleJson.layers)) {
          console.error('Invalid style format: missing layers array');
          return;
        }

        styleJson.layers = styleJson.layers.map((layer: any) => {
          if (layer.id === 'place-labels' || layer.id.startsWith('place-')) {
            return layer;
          }

          if (layer.paint) {
            Object.keys(layer.paint).forEach((prop) => {
              if (typeof layer.paint[prop] === 'object') {
                layer.paint[prop] = sanitizeExpression(layer.paint[prop]);
              }
            });
          }

          if (layer.layout) {
            Object.keys(layer.layout).forEach((prop) => {
              if (typeof layer.layout[prop] === 'object') {
                layer.layout[prop] = sanitizeExpression(layer.layout[prop]);
              }
            });
          }

          return layer;
        });

        if (!containerRef.current) return;

        const map = new mapboxgl.Map({
          container: containerRef.current as HTMLElement,
          style: styleJson,
          center: center as LngLatLike,
          zoom: 17.6,
          pitch: 60,
          bearing: -20,
          antialias: true,
          maxPitch: 85,
          minZoom: 15,
          maxZoom: 22,
          failIfMajorPerformanceCaveat: false
        });
        mapRef.current = map;
        try { (window as any).__debugMap = map; } catch {}

        map.on("load", () => {
          try {
            // Наш дом: добавляем footprint и слой здания
            const polygonCoords = Array.isArray(footprint) && footprint.length >= 4 ? [...footprint, footprint[0]] : null;
            if (!polygonCoords) {
              console.warn('MapboxScene: invalid footprint, falling back to generated rectangle', footprint);
            }
            // validate coordinates: each item should be [number, number]
            const isValid = polygonCoords && polygonCoords.every((p: any) => Array.isArray(p) && p.length === 2 && typeof p[0] === 'number' && typeof p[1] === 'number');
            const usedPolygon = isValid ? polygonCoords : [...(typeof footprint !== 'undefined' ? footprint as any : []), (footprint as any)?.[0]];
            try { console.info('MapboxScene: using polygon coords for building footprint:', usedPolygon); } catch {}

            // our building - slightly reduced height to avoid z-fighting with unit extrusions
            // give the building feature an id so it can be targeted with feature-state
            const FLOORS = TEST_FLOORS.length;
            if (isValid) {
              map.addSource("our-footprint", { type: "geojson", data: { type: "Feature", id: "building", properties: { floors: FLOORS }, geometry: { type: "Polygon", coordinates: [polygonCoords! as any] } } });
            } else {
              // fallback: build rectangle from center
              const [lng, lat] = center;
              const dx = 0.00009 * Math.cos(lat * Math.PI / 180);
              const dy = 0.00006;
              const fallback = [
                [lng - dx, lat + dy],
                [lng + dx, lat + dy],
                [lng + dx * 0.95, lat - dy],
                [lng - dx * 0.95, lat - dy],
              ];
              map.addSource("our-footprint", { type: "geojson", data: { type: "Feature", id: "building", properties: { floors: FLOORS }, geometry: { type: "Polygon", coordinates: [fallback.concat([fallback[0]])] } } });
              console.info('MapboxScene: used fallback rectangle footprint', fallback);
            }
            // our building - slightly reduced height to avoid z-fighting with unit extrusions
            // (source for our-footprint already added above depending on validity)
            // building fill - color reacts to feature-state hover for highlight
            map.addLayer({ id: "our-bldg", type: "fill-extrusion", source: "our-footprint", paint: { "fill-extrusion-color": ["case", ["boolean", ["feature-state", "hover"], false], "#ffd54d", "#EAECEF"], "fill-extrusion-height": ["-", ["*", ["get", "floors"], FLOOR_HEIGHT_M], 0.05], "fill-extrusion-opacity": 0.98 } });
            // 2D outline of the building footprint (visible on map) which also highlights on hover
            map.addLayer({ id: "our-outline", type: "line", source: "our-footprint", paint: { "line-color": ["case", ["boolean", ["feature-state", "hover"], false], "#ff6e00", "#2b2b2b"], "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 4, 1] } });

            // Add facade + balcony + glass approximation
            const facadeFC = makeFacadeFeatureCollection((Array.isArray(footprint) ? (footprint as any) : [center]) as any, TEST_FLOORS.length);
            map.addSource("facade", { type: "geojson", data: facadeFC });
            // facade bands
            map.addLayer({ id: "facade-bands", type: "fill-extrusion", source: "facade", filter: ["==", ["get", "type"], "facade"], paint: { "fill-extrusion-color": "#f7f5f0", "fill-extrusion-height": ["get", "height"], "fill-extrusion-base": ["get", "min_height"], "fill-extrusion-opacity": 0.98 } });

            // glass panels (transparent)
            map.addLayer({ id: "facade-glass", type: "fill-extrusion", source: "facade", filter: ["==", ["get", "type"], "glass"], paint: { "fill-extrusion-color": "#a8d0ff", "fill-extrusion-height": ["get", "height"], "fill-extrusion-base": ["get", "min_height"], "fill-extrusion-opacity": 0.18 } });

            // balconies
            map.addLayer({ id: "facade-balconies", type: "fill-extrusion", source: "facade", filter: ["==", ["get", "type"], "balcony"], paint: { "fill-extrusion-color": "#e9e6e1", "fill-extrusion-height": ["get", "height"], "fill-extrusion-base": ["get", "min_height"], "fill-extrusion-opacity": 1 } });

            // Квартиры: добавляем source и слои (оставляем поверх фасада)
            let unitsSourceData: GeoJSON.FeatureCollection;
            if (externalUnits && externalUnits.type === 'FeatureCollection') {
              // Ensure features have an id (Mapbox feature-state uses feature id)
              const features = externalUnits.features.map((f: any, idx: number) => {
                const copy = { ...f } as any;
                if (typeof copy.id === 'undefined') copy.id = copy.properties && copy.properties.id ? String(copy.properties.id) : `ext-${idx}`;
                return copy;
              });
              unitsSourceData = { type: 'FeatureCollection', features };
              try { console.info('MapboxScene: using external units.geojson with', features.length, 'features'); } catch {}
            } else {
              unitsSourceData = makeUnitsFeatureCollection((Array.isArray(footprint) ? (footprint as any) : [center]) as any, units) as any;
            }
            map.addSource("units", { type: "geojson", data: unitsSourceData });
            map.addLayer({
              id: "units-fill",
              type: "fill-extrusion",
              source: "units",
              paint: {
                "fill-extrusion-color": [
                  "case",
                    ["boolean", ["feature-state", "hover"], false], "#ff7f50",
                    ["match", ["get", "status"],
                      "sold", "#b8b8b8",
                      "reserved", "#ffcd3c",
                      "available", "#4fea98",
                      "#4fea98"
                    ]
                ],
                "fill-extrusion-height": ["get", "height"],
                "fill-extrusion-base": ["get", "min_height"],
                "fill-extrusion-opacity": 0.75,
              }
            });
            map.addLayer({ id: "units-outline", type: "line", source: "units", paint: { "line-color": [
              "case",
                ["boolean", ["feature-state", "hover"], false], "#00ff00",
                "#2b2b2b"
            ], "line-width": [
              "case",
                ["boolean", ["feature-state", "hover"], false], 4,
                1
            ] } });

            // Center and zoom closer to the building so facade is visible
            try {
              map.jumpTo({ center: center as LngLatLike, zoom: 19.2, pitch: 68, bearing: -8 });
            } catch(e) {}

            setReady(true);
          } catch (e) {
            console.error('MapboxScene: error during map load:', e);
          }
        });
      } catch (err) {
        console.error('Failed to load map:', err);
        setError('Failed to load map. ' + (err.message || 'Please try again later.'));
      }
    };

    loadMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [token, center, footprint, units, onPick]);

  // Применение фильтра (available/rooms/floor)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const filters: any[] = ["all"]; // базовый фильтр для слоя
    if (filter.onlyAvailable) filters.push(["==", ["get", "status"], "available"]);
    if (filter.rooms) filters.push(["==", ["get", "rooms"], filter.rooms]);
    if (filter.hoverFloor) filters.push(["==", ["get", "floor"], filter.hoverFloor]);
    try {
      map.setFilter("units-fill", filters as any);
      map.setFilter("units-outline", filters as any);
    } catch {}
  }, [filter]);

  if (!token) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-red-500">Mapbox token is missing. Please check your environment variables.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <div className="animate-pulse">Loading map...</div>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50">
          <div className="text-center p-4 max-w-md">
            <h3 className="text-red-600 font-semibold mb-2">Error loading map</h3>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      )}
      <div 
        ref={tipRef} 
        className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white p-2 rounded shadow-lg text-sm pointer-events-none opacity-0 transition-opacity"
        style={{ zIndex: 1000 }}
      />
    </div>
  );
}

// Scale polygon (lng,lat points) from centroid by factor (positive = outward)
function scalePolygon(pts: [number, number][], factor: number) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(p => {
    return [cx + (p[0] - cx) * (1 + factor), cy + (p[1] - cy) * (1 + factor)] as [number, number];
  });
}

function makeFacadeFeatureCollection(quad: [number, number][], floors: number) {
  const features: GeoJSON.Feature[] = [];
  // base facade: one band per floor
  for (let f = 1; f <= floors; f++) {
    const band = scalePolygon(quad, 0); // same footprint
    const min_h = (f - 1) * FLOOR_HEIGHT_M + 0.005;
    const h = f * FLOOR_HEIGHT_M - 0.005;
    features.push({ type: 'Feature', properties: { floor: f, min_height: min_h, height: h, type: 'facade' }, geometry: { type: 'Polygon', coordinates: [band.concat([band[0]])] } } as any);
  }

  // balconies: slightly expanded footprint, thinner slab at floor top
  const balconyPoly = scalePolygon(quad, 0.03);
  for (let f = 1; f <= floors; f++) {
    const slabTop = f * FLOOR_HEIGHT_M - 0.02;
    const slabBase = slabTop - 0.18; // balcony thickness ~0.18m
    features.push({ type: 'Feature', properties: { floor: f, min_height: slabBase, height: slabTop, type: 'balcony' }, geometry: { type: 'Polygon', coordinates: [balconyPoly.concat([balconyPoly[0]])] } } as any);
  }

  // glass panels: inset smaller polygon to simulate windows
  const glassPoly = scalePolygon(quad, -0.06);
  for (let f = 1; f <= floors; f++) {
    const min_h = (f - 1) * FLOOR_HEIGHT_M + 0.15;
    const h = f * FLOOR_HEIGHT_M - 0.15;
    features.push({ type: 'Feature', properties: { floor: f, min_height: min_h, height: h, type: 'glass' }, geometry: { type: 'Polygon', coordinates: [glassPoly.concat([glassPoly[0]])] } } as any);
  }

  return { type: 'FeatureCollection', features } as GeoJSON.FeatureCollection;
}