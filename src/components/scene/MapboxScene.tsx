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

const TOTAL_FLOORS = 6;
const FLOOR_HEIGHT_M = 3.1;

type Unit = { id: string; floor: number; status: "available" | "reserved" | "sold"; area: number; rooms: number; polyUV: [number, number][] };

type AxisBasis = {
  center: [number, number];
  axes: [[number, number], [number, number]];
  spreads: [number, number];
};

type UnitsTransform = {
  source: AxisBasis;
  target: AxisBasis;
  scales: [number, number];
};

// Парсинг geojson квартир
async function loadUnitsFromGeojson(): Promise<Unit[]> {
  const floors = Array.from({ length: TOTAL_FLOORS }, (_, i) => i + 1);
  const units: Unit[] = [];
  for (const f of floors) {
    try {
      const fileName = `floor${f}.geojson`;
      const res = await fetch(`/plans/geojson/${fileName}`);
      if (!res.ok) continue;
      const geojson = await res.json();
      if (geojson && geojson.features) {
        for (const feat of geojson.features) {
          // предполагаем, что properties содержит нужные данные
          const props = feat.properties || {};
          units.push({
            id: props.id || `${f}-${units.length+1}`,
            floor: f,
            status: props.status || "available",
            area: props.area || 40,
            rooms: props.rooms || 2,
            polyUV: feat.geometry?.coordinates?.[0]?.map((p: number[]) => [p[0], p[1]]) || [[0,0],[1,0],[1,1],[0,1]],
          });
        }
      }
    } catch {}
  }
  return units;
}

async function loadFloorFeatureCollection(): Promise<GeoJSON.FeatureCollection | null> {
  const floors = Array.from({ length: TOTAL_FLOORS }, (_, i) => i + 1);
  const features: GeoJSON.Feature[] = [];
  for (const f of floors) {
    try {
      const fileName = `floor${f}.geojson`;
      const res = await fetch(`/plans/geojson/${fileName}`);
      if (!res.ok) continue;
      const geojson = await res.json();
      if (geojson && Array.isArray(geojson.features)) {
        for (const feat of geojson.features) {
          features.push({
            ...(feat as GeoJSON.Feature),
            properties: { ...(feat.properties || {}), floor: f },
          });
        }
      }
    } catch {
      // ignore missing floor file
    }
  }
  return features.length ? { type: 'FeatureCollection', features } : null;
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

function sanitizeStyleExpression(expr: any): any {
  if (!Array.isArray(expr)) return expr;
  if (expr.length === 2 && expr[0] === "get" && expr[1] === "sizerank") {
    return ["coalesce", ["get", "sizerank"], 0];
  }
  return expr.map((e: any) => sanitizeStyleExpression(e));
}

function normalizeRing(ring: number[][]): [number, number][] | null {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  return ring.map((pt) => [Number(pt[0]), Number(pt[1])] as [number, number]);
}

function collectFeaturePoints(feature: GeoJSON.Feature): [number, number][] {
  const pts: [number, number][] = [];
  if (!feature.geometry) return pts;
  const pushRing = (ring: number[][]) => {
    const normalized = normalizeRing(ring);
    if (normalized) pts.push(...normalized);
  };
  if (feature.geometry.type === "Polygon") {
    const rings = feature.geometry.coordinates as number[][][];
    rings?.forEach(pushRing);
  } else if (feature.geometry.type === "MultiPolygon") {
    const polys = feature.geometry.coordinates as number[][][][];
    polys?.forEach(poly => poly.forEach(pushRing));
  }
  return pts;
}

function convexHull(points: [number, number][]): [number, number][] {
  if (points.length < 3) return points;
  const sorted = [...points].sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return [...lower, ...upper];
}

function centroidOfPolygon(points: [number, number][]): [number, number] {
  if (!points.length) return [0, 0];
  const sum = points.reduce<[number, number]>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
  return [sum[0] / points.length, sum[1] / points.length];
}

function deriveFootprintFromUnits(collection: GeoJSON.FeatureCollection | null): [number, number][] | null {
  if (!collection || !Array.isArray(collection.features)) return null;
  const pts: [number, number][] = [];
  for (const feature of collection.features) {
    pts.push(...collectFeaturePoints(feature as GeoJSON.Feature));
  }
  if (!pts.length) return null;
  const hull = convexHull(pts);
  return hull.length >= 3 ? hull : null;
}

function offsetGeometry(geometry: any, offset: [number, number] | null): any {
  if (!geometry || !offset) return geometry;
  const shiftPoint = (pt: number[]): [number, number] => [pt[0] + offset[0], pt[1] + offset[1]];
  if (geometry.type === 'Polygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring: number[][]) => ring.map(shiftPoint)),
    };
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((poly: number[][][]) =>
        poly.map((ring: number[][]) => ring.map(shiftPoint))
      ),
    };
  }
  return geometry;
}

function makeExternalUnitsFeatureCollection(
  externalUnits: GeoJSON.FeatureCollection,
  unitsTransform: UnitsTransform | null,
): GeoJSON.FeatureCollection {
  const features = externalUnits.features.map((f: any, idx: number) => {
    const copy = { ...f } as any;
    const props = { ...(copy.properties || {}) } as any;
    const floor = Number(isFinite(props.floor) ? props.floor : 1);
    const status = String(props.status || 'available').toLowerCase();
    const statusMap: Record<string, Unit['status']> = {
      available: 'available',
      aviable: 'available',
      free: 'available',
      reserved: 'reserved',
      booked: 'reserved',
      sold: 'sold',
      xz: 'reserved',
    };
    props.status = statusMap[status] || 'available';
    props.min_height = (floor - 1) * FLOOR_HEIGHT_M + 0.02;
    props.height = floor * FLOOR_HEIGHT_M - 0.02;
    props.floor = floor;
    copy.properties = props;
    if (typeof copy.id === 'undefined') {
      copy.id = props.id ? String(props.id) : `ext-${idx}`;
    }
    copy.geometry = transformGeometry(copy.geometry, unitsTransform);
    if (copy.geometry && copy.geometry.type === 'MultiPolygon') {
      copy.geometry.coordinates = copy.geometry.coordinates.map((poly: number[][][]) =>
        poly.map((ring: number[][]) => {
          if (!ring.length) return ring;
          const first = ring[0];
          const last = ring[ring.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) {
            return [...ring, first];
          }
          return ring;
        })
      );
    }
    return copy;
  });
  try { console.info('MapboxScene: using external units.geojson with', features.length, 'features'); } catch {}
  return { type: 'FeatureCollection', features } as GeoJSON.FeatureCollection;
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

function normalizeVector(vec: [number, number]): [number, number] {
  const len = Math.hypot(vec[0], vec[1]) || 1;
  return [vec[0] / len, vec[1] / len];
}

function computeAxisBasis(points: [number, number][]): AxisBasis | null {
  if (!points.length) return null;
  const center = centroidOfPolygon(points);
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of points) {
    const dx = x - center[0];
    const dy = y - center[1];
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const n = points.length || 1;
  const covXX = sxx / n;
  const covYY = syy / n;
  const covXY = sxy / n;
  const trace = covXX + covYY;
  const det = covXX * covYY - covXY * covXY;
  const discr = Math.max(trace * trace / 4 - det, 0);
  const lambda1 = trace / 2 + Math.sqrt(discr);
  const lambda2 = trace / 2 - Math.sqrt(discr);
  let axis1: [number, number];
  if (Math.abs(covXY) > 1e-9) {
    axis1 = [lambda1 - covYY, covXY];
  } else {
    axis1 = covXX >= covYY ? [1, 0] : [0, 1];
  }
  axis1 = normalizeVector(axis1);
  const axis2: [number, number] = [-axis1[1], axis1[0]];
  const spreads: [number, number] = [Math.sqrt(Math.max(lambda1, 1e-12)), Math.sqrt(Math.max(lambda2, 1e-12))];
  return { center, axes: [axis1, axis2], spreads };
}

function buildUnitsTransform(sourcePoints: [number, number][], targetPoints: [number, number][]): UnitsTransform | null {
  const source = computeAxisBasis(sourcePoints);
  const target = computeAxisBasis(targetPoints);
  if (!source || !target) return null;
  const scale1 = target.spreads[0] / (source.spreads[0] || 1);
  const scale2 = target.spreads[1] / (source.spreads[1] || 1);
  return { source, target, scales: [scale1, scale2] };
}

function transformPointUsingBasis(pt: [number, number], transform: UnitsTransform): [number, number] {
  const { source, target, scales } = transform;
  const rel: [number, number] = [pt[0] - source.center[0], pt[1] - source.center[1]];
  const proj1 = rel[0] * source.axes[0][0] + rel[1] * source.axes[0][1];
  const proj2 = rel[0] * source.axes[1][0] + rel[1] * source.axes[1][1];
  const mapped: [number, number] = [
    proj1 * scales[0] * target.axes[0][0] + proj2 * scales[1] * target.axes[1][0],
    proj1 * scales[0] * target.axes[0][1] + proj2 * scales[1] * target.axes[1][1],
  ];
  return [mapped[0] + target.center[0], mapped[1] + target.center[1]];
}

function transformGeometry(geometry: any, transform: UnitsTransform | null): any {
  if (!geometry || !transform) return geometry;
  const apply = (pt: number[]): [number, number] => transformPointUsingBasis([pt[0], pt[1]], transform);
  if (geometry.type === 'Polygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring: number[][]) => ring.map(apply)),
    };
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((poly: number[][][]) =>
        poly.map((ring: number[][]) => ring.map(apply))
      ),
    };
  }
  return geometry;
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
  const hasCustomFootprint = useRef(false);
  const [unitsTransform, setUnitsTransform] = useState<UnitsTransform | null>(null);

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
        const normalizeRing = (ring: any) => {
          if (!Array.isArray(ring)) return null;
          const coords = ring.filter((p: any) => Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number');
          if (!coords.length) return null;
          const first = coords[0];
          const last = coords[coords.length - 1];
          if (first && last && first[0] === last[0] && first[1] === last[1]) {
            coords.pop();
          }
          return coords.length >= 3 ? coords as [number, number][] : null;
        };
        if (Array.isArray(json) && json.length >= 3 && Array.isArray(json[0])) {
          quad = normalizeRing(json as any) ?? null;
        } else if (json && json.type === 'Feature' && json.geometry && json.geometry.type === 'Polygon') {
          quad = normalizeRing(json.geometry.coordinates[0]) ?? null;
        } else if (json && json.type === 'FeatureCollection' && Array.isArray(json.features) && json.features.length) {
          const f = json.features.find((ff: any) => ff.geometry && ff.geometry.type === 'Polygon');
          if (f) quad = normalizeRing(f.geometry.coordinates[0]) ?? null;
        }
        if (quad && mounted) setFootprint(quad);
        if (quad && mounted) {
          try { console.info('MapboxScene: loaded building-quad.json, using quad:', quad); } catch {}
          setFootprint(quad);
          hasCustomFootprint.current = true;
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

  // fallback UV units for demo/testing
  useEffect(() => {
    let mounted = true;
    loadUnitsFromGeojson()
      .then((data) => {
        if (mounted && data.length) setUnits(data);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Load detailed per-floor GeoJSON (floor1..floor6). If absent, fall back to legacy units.geojson
  useEffect(() => {
    let mounted = true;
    (async () => {
      const floorsFC = await loadFloorFeatureCollection();
      if (mounted && floorsFC) {
        setExternalUnits(floorsFC);
        return;
      }
      try {
        const res = await fetch('/plans/geojson/units.geojson');
        if (!res.ok) return;
        const json = await res.json();
        if (mounted && json && json.type === 'FeatureCollection') {
          setExternalUnits(json as GeoJSON.FeatureCollection);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!externalUnits || !hasCustomFootprint.current || footprint.length < 3) {
      setUnitsTransform(null);
      return;
    }
    const hull = deriveFootprintFromUnits(externalUnits);
    if (!hull || hull.length < 3) {
      setUnitsTransform(null);
      return;
    }
    const transform = buildUnitsTransform(hull, footprint);
    setUnitsTransform(transform);
  }, [externalUnits, footprint]);

  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    if (!externalUnits) return;
    const unitsSource = mapRef.current.getSource("units") as GeoJSONSource | undefined;
    if (!unitsSource) return;
    const data = makeExternalUnitsFeatureCollection(externalUnits, unitsTransform);
    unitsSource.setData(data as any);
  }, [unitsTransform, externalUnits]);

  useEffect(() => {
    if (!externalUnits || !ready || hasCustomFootprint.current) return;
    const derived = deriveFootprintFromUnits(externalUnits);
    if (!derived || derived.length < 4) return;
    setFootprint(derived);
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const polygonCoords = [...derived, derived[0]];
    const footprintFeature = {
      type: 'Feature',
      id: 'building',
      properties: { floors: TOTAL_FLOORS },
      geometry: { type: 'Polygon', coordinates: [polygonCoords] }
    } as GeoJSON.Feature;
    const footprintSource = map.getSource("our-footprint") as GeoJSONSource | undefined;
    if (footprintSource) {
      footprintSource.setData(footprintFeature as any);
    }
    const facadeSource = map.getSource("facade") as GeoJSONSource | undefined;
    if (facadeSource) {
      facadeSource.setData(makeFacadeFeatureCollection(derived as any, TOTAL_FLOORS));
    }
  }, [externalUnits, ready]);
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !token) return;
    mapboxgl.accessToken = token;

    const styleUrl = "https://api.mapbox.com/styles/v1/mapbox/standard?access_token=" + token;

    const prepareStyle = async () => {
      try {
        const res = await fetch(styleUrl);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const styleJson = await res.json();
        (styleJson.layers || []).forEach((layer: any) => {
          if (layer.paint) {
            Object.keys(layer.paint).forEach((prop) => {
              layer.paint[prop] = sanitizeStyleExpression(layer.paint[prop]);
            });
          }
          if (layer.layout) {
            Object.keys(layer.layout).forEach((prop) => {
              layer.layout[prop] = sanitizeStyleExpression(layer.layout[prop]);
            });
          }
        });
        return styleJson;
      } catch (err) {
        try { console.warn('MapboxScene: failed to load sanitized style, fallback to default', err); } catch {}
        return "mapbox://styles/mapbox/standard";
      }
    };

    prepareStyle().then((styleConfig) => {
      if (!containerRef.current) return;
      const map = new mapboxgl.Map({
        container: containerRef.current as HTMLElement,
        style: styleConfig as any,
        center: center as LngLatLike,
        zoom: 17.6,
        pitch: 60,
        bearing: -20,
        antialias: true,
        cooperativeGestures: true,
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
          
          // our footprint source (needed for transform math even without rendering)
          const FLOORS = TOTAL_FLOORS;
          if (isValid) {
            map.addSource("our-footprint", { type: "geojson", data: { type: "Feature", id: "building", properties: { floors: FLOORS }, geometry: { type: "Polygon", coordinates: [polygonCoords! as any] } } });
          } else {
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

          // Квартиры: добавляем source и слои (оставляем поверх фасада)
          let unitsSourceData: GeoJSON.FeatureCollection;
          if (externalUnits && externalUnits.type === 'FeatureCollection') {
            unitsSourceData = makeExternalUnitsFeatureCollection(externalUnits, unitsTransform);
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
                  ["boolean", ["feature-state", "hover"], false], "#f4c689",
                  ["match", ["get", "status"],
                    "sold", "#d7c3a3",
                    "reserved", "#ffda9e",
                    "available", "#f4c689",
                    "#f4c689"
                  ]
              ],
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 0.98,
            }
          });
          map.addLayer({ id: "units-outline", type: "line", source: "units", paint: { "line-color": [
            "case",
              ["boolean", ["feature-state", "hover"], false], "#a87938",
              "#a87938"
          ], "line-width": [
            "case",
              ["boolean", ["feature-state", "hover"], false], 3,
              1.2
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
      let lastHoverId: string | null = null;
      let lastBuildingHover = false;
      map.on("mousemove", "units-fill", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features && e.features[0];
        const tip = tipRef.current;
        if (!f || !tip) return;
        tip.style.display = "block";
        tip.style.left = e.point.x + 12 + "px";
        tip.style.top = e.point.y + 12 + "px";
        const fid = (typeof f.id !== 'undefined') ? String(f.id) : (f.properties && f.properties.id ? String(f.properties.id) : null);
        const { floor, status, area, rooms } = f.properties as any;
        tip.textContent = `Кв. ${fid ?? ''} • этаж ${floor} • ${status} • ${area} м² • ${rooms}к`;
        if (fid && lastHoverId !== fid) {
          if (lastHoverId) map.setFeatureState({ source: "units", id: lastHoverId }, { hover: false });
          map.setFeatureState({ source: "units", id: fid }, { hover: true });
          lastHoverId = fid;
        }
        if (!lastBuildingHover) {
          try { map.setFeatureState({ source: "our-footprint", id: "building" }, { hover: true }); } catch {}
          lastBuildingHover = true;
        }
      });
      map.on("mouseleave", "units-fill", () => {
        map.getCanvas().style.cursor = "";
        if (tipRef.current) tipRef.current.style.display = "none";
        if (lastHoverId) {
          map.setFeatureState({ source: "units", id: lastHoverId }, { hover: false });
          lastHoverId = null;
        }
        if (lastBuildingHover) {
          try { map.setFeatureState({ source: "our-footprint", id: "building" }, { hover: false }); } catch {}
          lastBuildingHover = false;
        }
      });
      map.on("click", "units-fill", (e) => {
        const f = e.features && e.features[0];
        if (!f) return;
        const fid = (typeof f.id !== 'undefined') ? String(f.id) : (f.properties && f.properties.id ? String(f.properties.id) : null);
        const { area, rooms } = f.properties as any;
        onPick?.({ id: fid ?? (f.properties && f.properties.id) ?? null, area: Number(area), rooms: Number(rooms) });
      });

      setReady(true);
    });

    return () => { mapRef.current?.remove(); };
  }, [token, center, onPick]);

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
      <div className="relative w-full max-w-[1100px] mx-auto rounded-xl overflow-hidden ring-1 ring-border bg-surface p-6 text-sm text-muted">
        Добавьте NEXT_PUBLIC_MAPBOX_TOKEN в .env.local, чтобы отобразить карту с окружением.
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-[1100px] mx-auto rounded-xl overflow-hidden ring-1 ring-border" style={{ height: "68vh" }}>
      <div ref={containerRef} className="w-full h-full" />
      <div ref={tipRef} className="absolute pointer-events-none bg-[#111] text-white text-xs px-2 py-1 rounded" style={{ display: "none" }} />
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