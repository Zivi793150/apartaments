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
const FLOOR_SCALE_OVERRIDES: Record<number, number> = {
  4: 0.015,
  5: 0.025,
  6: 0.035,
};
const emptyFeatureCollection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const BUILDING_BASE_COLOR = "#ece3db";
const TERRACE_GLASS_COLOR = "#d9e5f1";
const TERRACE_GLASS_OPACITY = 0.55;
const BALCONY_GLASS_COLOR = "#dfe9f4";
const BALCONY_GLASS_OPACITY = 0.65;
const TERRACE_FLOOR_THICKNESS = 0.12;
const TERRACE_RAIL_HEIGHT = FLOOR_HEIGHT_M / 3;
const TERRACE_RAIL_SCALE = -0.06;
const BALCONY_FLOOR_THICKNESS = 0.1;
const BALCONY_RAIL_HEIGHT = FLOOR_HEIGHT_M * 0.48;
const BALCONY_RAIL_SCALE = -0.03;
const BALCONY_POST_SIZE_FACTOR = 0.0025;
const BALCONY_POST_MIN_SIZE = 0.000002;
const BALCONY_FALLBACK: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { id: "balcony-l3", floor: 2 },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-4.038977023510829, 36.773148311336989],
            [-4.038928911693906, 36.773142308598672],
            [-4.038906331644696, 36.77300317878764],
            [-4.038953086095496, 36.77299834277639],
            [-4.038977023510829, 36.773148311336989]
          ]
        ]
      }
    },
    {
      type: "Feature",
      properties: { id: "balcony-l2", floor: 3 },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-4.03895308607562, 36.772998342792285],
            [-4.038977024011023, 36.77314831409106],
            [-4.038928911647464, 36.773142308606197],
            [-4.038906331644529, 36.773003178797943],
            [-4.03895308607562, 36.772998342792285]
          ]
        ]
      }
    }
  ]
};
const TERRACE_FALLBACK: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { id: "terrace-l5", floor: 5 },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-4.039009050309353, 36.773152318939118],
            [-4.03897702061007, 36.773148320247827],
            [-4.038953105692699, 36.772998461420102],
            [-4.039018761180211, 36.772991814241806],
            [-4.039026026669926, 36.773039458900236],
            [-4.038989825865965, 36.773043671787349],
            [-4.039009050309353, 36.773152318939118]
          ]
        ]
      }
    },
    {
      type: "Feature",
      properties: { id: "terrace-l6", floor: 6 },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-4.038999165069861, 36.773097004915414],
            [-4.038989825863409, 36.773043671772037],
            [-4.039026026644835, 36.77303945894392],
            [-4.039018760523848, 36.7729918121791],
            [-4.039066129842723, 36.772987489192381],
            [-4.039115268568533, 36.772969209025327],
            [-4.039127986808273, 36.773026608367154],
            [-4.03911723081169, 36.773026841323691],
            [-4.03911805381011, 36.773037210251793],
            [-4.039018569221341, 36.773047992106072],
            [-4.03901683596164, 36.773081685828018],
            [-4.038999506591647, 36.773082839778134],
            [-4.038999165069861, 36.773097004915414]
          ]
        ]
      }
    }
  ]
};
const HOVER_EDGE_SCALE = 0.006;
const HOVER_FACE_SCALE = -0.003;
const HOVER_BASE_LIFT = 0.18;

type Unit = { id: string; floor: number; status: "available" | "reserved" | "sold"; area: number; rooms: number; polyUV: [number, number][] };
type BalconyProperties = {
  floor?: number;
  base?: number;
  height?: number;
  id?: string | number;
  type?: string;
};

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
      const res = await fetch(`/plans/geojson/${fileName}`, { cache: "no-store" });
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
      const res = await fetch(`/plans/geojson/${fileName}`, { cache: "no-store" });
      if (!res.ok) continue;
      const geojson = await res.json();
      if (geojson && Array.isArray(geojson.features)) {
        try { console.info(`MapboxScene: loaded ${fileName} with ${geojson.features.length} features`); } catch {}
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

function collectGeometryPoints(geometry: any): [number, number][] {
  const points: [number, number][] = [];
  const visit = (coords: any) => {
    if (Array.isArray(coords) && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      if (Number.isFinite(coords[0]) && Number.isFinite(coords[1])) {
        points.push([Number(coords[0]), Number(coords[1])]);
      }
      return;
    }
    if (Array.isArray(coords)) coords.forEach(visit);
  };
  visit(geometry?.coordinates);
  return points;
}

function scaleGeometry(geometry: any, factor: number): any {
  if (!geometry || !factor) return geometry;
  const pts = collectGeometryPoints(geometry);
  if (!pts.length) return geometry;
  const center = centroidOfPolygon(pts);
  const scalePoint = (pt: number[]): [number, number] => {
    const scaled: [number, number] = [
      center[0] + (pt[0] - center[0]) * (1 + factor),
      center[1] + (pt[1] - center[1]) * (1 + factor),
    ];
    if (!Number.isFinite(scaled[0]) || !Number.isFinite(scaled[1])) return [pt[0], pt[1]];
    return scaled;
  };
  if (geometry.type === 'Polygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring: number[][]) => ring.map(scalePoint)),
    };
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((poly: number[][][]) =>
        poly.map((ring: number[][]) => ring.map(scalePoint))
      ),
    };
  }
  return geometry;
}

function makeExternalUnitsFeatureCollection(
  externalUnits: GeoJSON.FeatureCollection,
  unitsTransform: UnitsTransform | null,
  opts?: { useRaw?: boolean }
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
    props.cap_min_height = Math.max(props.min_height, props.height - 0.08);
    props.floor = floor;
    copy.properties = props;
    const baseId = props.id ? String(props.id) : `ext-${idx}`;
    copy.id = `${baseId}-f${floor}`;
    let geom = copy.geometry;
    if (opts?.useRaw && FLOOR_SCALE_OVERRIDES[floor]) {
      geom = scaleGeometry(geom, FLOOR_SCALE_OVERRIDES[floor]);
    }
    geom = transformGeometry(geom, unitsTransform);
    copy.geometry = geom;
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

type OutdoorKind = "balcony-floor" | "balcony-rail" | "balcony-post" | "terrace-floor" | "terrace-rail";

function makeOutdoorFeatureCollection(
  collection: GeoJSON.FeatureCollection | null,
  unitsTransform: UnitsTransform | null,
  opts?: { useRaw?: boolean; mode?: "balcony" | "terrace" }
): GeoJSON.FeatureCollection {
  if (!collection || !Array.isArray(collection.features)) return emptyFeatureCollection;
  const closeRing = (ring: number[][]) => {
    if (!Array.isArray(ring) || !ring.length) return ring;
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (!last || first[0] !== last[0] || first[1] !== last[1]) {
      return [...ring, first];
    }
    return ring;
  };
  const features: GeoJSON.Feature[] = [];

  collection.features.forEach((f: any, idx: number) => {
    const copy = { ...f } as any;
    const props: BalconyProperties = { ...(copy.properties || {}) };
    const floor = Number(isFinite(props.floor as number) ? props.floor : 1);
    const baseMin = (floor - 1) * FLOOR_HEIGHT_M + 0.02;
    const baseMax = floor * FLOOR_HEIGHT_M - 0.02;
    let geom = copy.geometry;
    if (!(opts?.useRaw) && unitsTransform) {
      geom = transformGeometry(geom, unitsTransform);
    }
    if (geom?.type === "Polygon") {
      geom = {
        ...geom,
        coordinates: geom.coordinates.map((ring: number[][]) => closeRing(ring)),
      };
    } else if (geom?.type === "MultiPolygon") {
      geom = {
        ...geom,
        coordinates: geom.coordinates.map((poly: number[][][]) =>
          poly.map((ring: number[][]) => closeRing(ring))
        ),
      };
    }
    const idBase = copy.id ?? props.id ?? `outdoor-${idx}-f${floor}`;
    const typeProp = (props.type ?? "").toString().toLowerCase();
    const mode = opts?.mode ?? (typeProp === "terrace" ? "terrace" : "balcony");
    if (mode === "terrace") {
      const floorFeature = {
        type: "Feature",
        properties: {
          ...props,
          floor,
          min_height: baseMin,
          height: baseMin + TERRACE_FLOOR_THICKNESS,
          kind: "terrace-floor" as OutdoorKind,
        },
        geometry: geom,
        id: `${idBase}-floor`,
      } as GeoJSON.Feature;
      features.push(floorFeature);
      const railGeom = createRailGeometry(geom, TERRACE_RAIL_SCALE);
      if (railGeom) {
        const railFeature = {
          type: "Feature",
          properties: {
            ...props,
            floor,
            min_height: baseMin + TERRACE_FLOOR_THICKNESS,
            height: Math.min(baseMin + TERRACE_FLOOR_THICKNESS + TERRACE_RAIL_HEIGHT, baseMax),
            kind: "terrace-rail" as OutdoorKind,
          },
          geometry: railGeom,
          id: `${idBase}-rail`,
        } as GeoJSON.Feature;
        features.push(railFeature);
      }
      return;
    }
    const primaryRing = getPrimaryRing(geom);
    const postRing = primaryRing ? ensureClosedRing(primaryRing) : null;
    const ringVertices = postRing ? postRing.slice(0, postRing.length - 1) : null;
    const ringCenter = ringVertices?.length ? centroidOfPolygon(ringVertices) : null;
    const axisBasis = ringVertices?.length ? computeAxisBasis(ringVertices) : null;
    const shortAxis = axisBasis ? axisBasis.axes[1] : null;
    const outerSign = ringVertices && ringCenter && shortAxis
      ? determineOuterSign(ringVertices, ringCenter, shortAxis)
      : null;
    // Balcony floor slab
    const balconyFloor = {
      type: "Feature",
      properties: {
        ...props,
        floor,
        min_height: baseMin,
        height: Math.min(baseMin + BALCONY_FLOOR_THICKNESS, baseMax),
        kind: "balcony-floor" as OutdoorKind,
      },
      geometry: geom,
      id: `${idBase}-floor`,
    } as GeoJSON.Feature;
    features.push(balconyFloor);
    // Balcony rail
    let balconyRailGeom = createRailGeometry(geom, BALCONY_RAIL_SCALE);
    if (balconyRailGeom && ringCenter && shortAxis && outerSign) {
      const filtered = filterRailGeometryToOuter(balconyRailGeom, ringCenter, shortAxis, outerSign);
      if (filtered) balconyRailGeom = filtered;
    }
    if (balconyRailGeom) {
      const balconyRail = {
        type: "Feature",
        properties: {
          ...props,
          floor,
          min_height: Math.min(baseMin + BALCONY_FLOOR_THICKNESS, baseMax),
          height: Math.min(baseMin + BALCONY_FLOOR_THICKNESS + BALCONY_RAIL_HEIGHT, baseMax),
          kind: "balcony-rail" as OutdoorKind,
        },
        geometry: balconyRailGeom,
        id: `${idBase}-rail`,
      } as GeoJSON.Feature;
      features.push(balconyRail);
    }
    // Balcony posts at key corners
    if (ringVertices && ringVertices.length) {
      const postSize = estimatePostSize(ringVertices);
      const postInset = postSize * 1.35;
      const postCenter = ringCenter;
      const extraShortInset = postSize * 0.75;
      const cornerPoints = filterCornerPoints(ringVertices);

      const placePost = (pt: [number, number], suffix: string) => {
        let insetPoint = postCenter ? movePointTowards(pt, postCenter, postInset) : pt;
        if (shortAxis && postCenter) {
          const vecToCenter: [number, number] = [insetPoint[0] - postCenter[0], insetPoint[1] - postCenter[1]];
          const alongShort = vecToCenter[0] * shortAxis[0] + vecToCenter[1] * shortAxis[1];
          const newAlongShort = Math.sign(alongShort || 1) * Math.max(Math.abs(alongShort) - extraShortInset, 0);
          const delta = newAlongShort - alongShort;
          insetPoint = [
            insetPoint[0] + shortAxis[0] * delta,
            insetPoint[1] + shortAxis[1] * delta,
          ];
        }
        const postPolygon = createPostPolygon(insetPoint, postSize);
        if (!postPolygon || postPolygon.length < 4) return;
        features.push({
          type: "Feature",
          properties: {
            ...props,
            floor,
            min_height: baseMin,
            height: baseMax,
            kind: "balcony-post" as OutdoorKind,
          },
          geometry: { type: "Polygon", coordinates: [postPolygon] },
          id: `${idBase}-post-${suffix}`,
        } as GeoJSON.Feature);
      };

      cornerPoints.forEach((pt, cornerIdx) => {
        placePost(pt, `corner-${cornerIdx}`);
      });

      if (shortAxis && postCenter) {
        const front: [number, number][] = [];
        const back: [number, number][] = [];
        cornerPoints.forEach((pt) => {
          const rel: [number, number] = [pt[0] - postCenter[0], pt[1] - postCenter[1]];
          const projShort = rel[0] * shortAxis[0] + rel[1] * shortAxis[1];
          if (projShort >= 0) front.push(pt);
          else back.push(pt);
        });

        const targetSign = outerSign ?? (front.length >= back.length ? 1 : -1);
        const makeMidpoint = (points: [number, number][]) => {
          if (points.length < 2) return null;
          const sum = points.reduce<[number, number]>(
            (acc, p) => [acc[0] + p[0], acc[1] + p[1]],
            [0, 0]
          );
          return [sum[0] / points.length, sum[1] / points.length] as [number, number];
        };

        const frontMid = makeMidpoint(front);
        const backMid = makeMidpoint(back);
        if (targetSign >= 0 && frontMid) {
          placePost(frontMid, "mid-front");
        } else if (targetSign < 0 && backMid) {
          placePost(backMid, "mid-back");
        }
      }
    }
  });
  return { type: "FeatureCollection", features } as GeoJSON.FeatureCollection;
}

function computeFeatureCollectionBounds(fc: GeoJSON.FeatureCollection | null) {
  if (!fc) return null;
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  const visit = (coords: any) => {
    if (typeof coords?.[0] === 'number' && typeof coords?.[1] === 'number') {
      const [lng, lat] = coords;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
      return;
    }
    if (Array.isArray(coords)) coords.forEach(visit);
  };
  fc.features.forEach((feature) => {
    visit((feature.geometry as any)?.coordinates);
  });
  if (!Number.isFinite(minLng)) return null;
  return { min: [minLng, minLat], max: [maxLng, maxLat] } as const;
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
  const apply = (pt: number[]): [number, number] => {
    const mapped = transformPointUsingBasis([pt[0], pt[1]], transform);
    if (!Number.isFinite(mapped[0]) || !Number.isFinite(mapped[1])) {
      return [pt[0], pt[1]];
    }
    return mapped;
  };
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
  const [useRawUnits, setUseRawUnits] = useState(false);
  const [balconyFeatures, setBalconyFeatures] = useState<GeoJSON.FeatureCollection | null>(BALCONY_FALLBACK);
  const [terraceFeatures, setTerraceFeatures] = useState<GeoJSON.FeatureCollection | null>(TERRACE_FALLBACK);

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
        setUseRawUnits(true);
        try {
          const [balconRes, terraceRes] = await Promise.allSettled([
            fetch("/plans/geojson/balcon.geojson", { cache: "no-store" }),
            fetch("/plans/geojson/terraces.geojson", { cache: "no-store" })
          ]);
          if (balconRes.status === "fulfilled" && balconRes.value.ok) {
            const balconJson = await balconRes.value.json();
            if (mounted && balconJson?.type === "FeatureCollection") {
              try { console.info("MapboxScene: loaded balcon.geojson with", balconJson.features?.length ?? 0, "features"); } catch {}
              setBalconyFeatures(balconJson as GeoJSON.FeatureCollection);
            }
          } else {
            setBalconyFeatures(BALCONY_FALLBACK);
          }
          if (terraceRes.status === "fulfilled" && terraceRes.value.ok) {
            const terraceJson = await terraceRes.value.json();
            if (mounted && terraceJson?.type === "FeatureCollection") {
              try { console.info("MapboxScene: loaded terraces.geojson with", terraceJson.features?.length ?? 0, "features"); } catch {}
              setTerraceFeatures(terraceJson as GeoJSON.FeatureCollection);
            }
          } else {
            setTerraceFeatures(TERRACE_FALLBACK);
          }
        } catch {
          setBalconyFeatures(BALCONY_FALLBACK);
          setTerraceFeatures(TERRACE_FALLBACK);
        }
        return;
      }
      try {
        const res = await fetch('/plans/geojson/units.geojson');
        if (!res.ok) return;
        const json = await res.json();
        if (mounted && json && json.type === 'FeatureCollection') {
          setExternalUnits(json as GeoJSON.FeatureCollection);
          setUseRawUnits(false);
        }
      } catch {
        // ignore
      }
      try {
        const [balconRes, terraceRes] = await Promise.allSettled([
          fetch("/plans/geojson/balcon.geojson", { cache: "no-store" }),
          fetch("/plans/geojson/terraces.geojson", { cache: "no-store" })
        ]);
        if (balconRes.status === "fulfilled" && balconRes.value.ok) {
          const balconJson = await balconRes.value.json();
          if (mounted && balconJson?.type === "FeatureCollection") {
            try { console.info("MapboxScene: loaded balcon.geojson with", balconJson.features?.length ?? 0, "features"); } catch {}
            setBalconyFeatures(balconJson as GeoJSON.FeatureCollection);
          }
        } else {
          setBalconyFeatures(BALCONY_FALLBACK);
        }
        if (terraceRes.status === "fulfilled" && terraceRes.value.ok) {
          const terraceJson = await terraceRes.value.json();
          if (mounted && terraceJson?.type === "FeatureCollection") {
            try { console.info("MapboxScene: loaded terraces.geojson with", terraceJson.features?.length ?? 0, "features"); } catch {}
            setTerraceFeatures(terraceJson as GeoJSON.FeatureCollection);
          }
        } else {
          setTerraceFeatures(TERRACE_FALLBACK);
        }
      } catch {
        setBalconyFeatures(BALCONY_FALLBACK);
        setTerraceFeatures(TERRACE_FALLBACK);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!externalUnits || !hasCustomFootprint.current || footprint.length < 3 || useRawUnits) {
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
  }, [externalUnits, footprint, useRawUnits]);

  useEffect(() => {
    if (!externalUnits) return;
    const map = mapRef.current;
    if (!map) return;
    const updateUnits = () => {
      const unitsSource = map.getSource("units") as GeoJSONSource | undefined;
      if (!unitsSource) return;
      try { console.info('MapboxScene: updating units source', { features: externalUnits.features?.length ?? 0, hasTransform: !!unitsTransform, useRaw: useRawUnits }); } catch {}
      const data = makeExternalUnitsFeatureCollection(externalUnits, unitsTransform, { useRaw: useRawUnits });
      unitsSource.setData(data as any);
      const bounds = computeFeatureCollectionBounds(data);
      if (bounds) {
        const pad = 0.0001;
        const sw: [number, number] = [bounds.min[0] - pad, bounds.min[1] - pad];
        const ne: [number, number] = [bounds.max[0] + pad, bounds.max[1] + pad];
        try { console.info('MapboxScene: units bounds', bounds); } catch {}
        try { map.fitBounds([sw, ne], { padding: 50, duration: 800 }); } catch {}
      }
    };
    if (map.isStyleLoaded()) {
      updateUnits();
      return;
    }
    const onData = () => {
      if (!map.isStyleLoaded()) return;
      map.off("styledata", onData);
      updateUnits();
    };
    map.on("styledata", onData);
    return () => {
      map.off("styledata", onData);
    };
  }, [unitsTransform, externalUnits, useRawUnits]);

  useEffect(() => {
    if (!externalUnits || hasCustomFootprint.current) return;
    const derived = deriveFootprintFromUnits(externalUnits);
    if (!derived || derived.length < 4) return;
    setFootprint(derived);
    const map = mapRef.current;
    if (!map) return;
    const updateFootprint = () => {
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
    };
    if (map.isStyleLoaded()) {
      updateFootprint();
      return;
    }
    const once = () => {
      map.off("styledata", once);
      updateFootprint();
    };
    map.on("styledata", once);
    return () => {
      map.off("styledata", once);
    };
  }, [externalUnits]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("balconies") as GeoJSONSource | undefined;
    if (!source) return;
    const data = makeOutdoorFeatureCollection(balconyFeatures, unitsTransform, { useRaw: useRawUnits, mode: "balcony" });
    try { console.info("MapboxScene: updating balcony source", { features: data.features?.length ?? 0 }); } catch {}
    source.setData(data as any);
  }, [balconyFeatures, unitsTransform, useRawUnits, ready]);
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("terraces") as GeoJSONSource | undefined;
    if (!source) return;
    const data = makeOutdoorFeatureCollection(terraceFeatures, unitsTransform, { useRaw: useRawUnits, mode: "terrace" });
    try { console.info("MapboxScene: updating terrace source", { features: data.features?.length ?? 0 }); } catch {}
    source.setData(data as any);
  }, [terraceFeatures, unitsTransform, useRawUnits, ready]);
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
          map.addSource("hover-unit", { type: "geojson", data: emptyFeatureCollection });
          map.addSource("hover-edge", { type: "geojson", data: emptyFeatureCollection });
          map.addSource("balconies", {
            type: "geojson",
            data: makeOutdoorFeatureCollection(balconyFeatures, unitsTransform, { useRaw: useRawUnits, mode: "balcony" })
          });
          map.addSource("terraces", {
            type: "geojson",
            data: makeOutdoorFeatureCollection(terraceFeatures, unitsTransform, { useRaw: useRawUnits, mode: "terrace" })
          });
          map.addLayer({
            id: "units-fill",
            type: "fill-extrusion",
            source: "units",
            paint: {
              "fill-extrusion-color": [
                "case",
                  ["boolean", ["feature-state", "hover"], false], "#fff7ef",
                  ["match", ["get", "status"],
                    "sold", "#dfd1c4",
                    "reserved", "#f1e3d6",
                    "available", BUILDING_BASE_COLOR,
                    BUILDING_BASE_COLOR
                  ]
              ],
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 0.98,
            }
          });
          map.addLayer({
            id: "terrace-floor-fill",
            type: "fill-extrusion",
            source: "terraces",
            filter: ["==", ["get", "kind"], "terrace-floor"],
            paint: {
              "fill-extrusion-color": BUILDING_BASE_COLOR,
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 0.98,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "terrace-rail-fill",
            type: "fill-extrusion",
            source: "terraces",
            filter: ["==", ["get", "kind"], "terrace-rail"],
            paint: {
              "fill-extrusion-color": [
                "interpolate",
                ["linear"],
                ["get", "floor"],
                4, TERRACE_GLASS_COLOR,
                6, "#eff4f9"
              ],
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": TERRACE_GLASS_OPACITY,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "hover-edge-fill",
            type: "fill-extrusion",
            source: "hover-edge",
            paint: {
              "fill-extrusion-color": "#1eff65",
              "fill-extrusion-height": [
                "+",
                ["get", "height"],
                HOVER_BASE_LIFT
              ],
              "fill-extrusion-base": [
                "+",
                ["get", "min_height"],
                HOVER_BASE_LIFT
              ],
              "fill-extrusion-opacity": 0.65,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "hover-unit-fill",
            type: "fill-extrusion",
            source: "hover-unit",
            paint: {
              "fill-extrusion-color": "#ffe9c8",
              "fill-extrusion-height": [
                "+",
                ["get", "height"],
                HOVER_BASE_LIFT
              ],
              "fill-extrusion-base": [
                "+",
                ["get", "min_height"],
                HOVER_BASE_LIFT
              ],
              "fill-extrusion-opacity": 0.96,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "balcony-floor-fill",
            type: "fill-extrusion",
            source: "balconies",
            filter: ["==", ["get", "kind"], "balcony-floor"],
            paint: {
              "fill-extrusion-color": BUILDING_BASE_COLOR,
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 0.96,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "balcony-rail-fill",
            type: "fill-extrusion",
            source: "balconies",
            filter: ["==", ["get", "kind"], "balcony-rail"],
            paint: {
              "fill-extrusion-color": [
                "interpolate",
                ["linear"],
                ["get", "floor"],
                2, BALCONY_GLASS_COLOR,
                4, "#eff5fb"
              ],
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": BALCONY_GLASS_OPACITY,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "balcony-post-fill",
            type: "fill-extrusion",
            source: "balconies",
            filter: ["==", ["get", "kind"], "balcony-post"],
            paint: {
              "fill-extrusion-color": BUILDING_BASE_COLOR,
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 1,
              "fill-extrusion-vertical-gradient": false
            }
          });

          // Center and zoom closer to the building so facade is visible
          try {
            map.jumpTo({ center: center as LngLatLike, zoom: 19.2, pitch: 68, bearing: -8 });
          } catch(e) {}

          } catch (e) {
            console.error('MapboxScene: error during map load:', e);
          }
          setReady(true);
        });
      let lastHoverId: string | null = null;
      const hoverSource = () => map.getSource("hover-unit") as GeoJSONSource | undefined;
      const hoverEdgeSource = () => map.getSource("hover-edge") as GeoJSONSource | undefined;
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
          if (lastHoverId) {
            map.setFeatureState({ source: "units", id: lastHoverId }, { hover: false });
          }
          map.setFeatureState({ source: "units", id: fid }, { hover: true });
          const hs = hoverSource();
          if (hs) {
            const baseMin = Number((f.properties as any)?.min_height ?? 0);
            const baseHeight = Number((f.properties as any)?.height ?? baseMin + FLOOR_HEIGHT_M);
            const faceGeom = scaleGeometry(f.geometry, HOVER_FACE_SCALE) ?? f.geometry;
            const edgeGeom = scaleGeometry(f.geometry, HOVER_EDGE_SCALE) ?? f.geometry;
            hs.setData({
              type: "FeatureCollection",
              features: [{
                type: "Feature",
                geometry: faceGeom,
                properties: {
                  min_height: baseMin + HOVER_BASE_LIFT,
                  height: baseHeight - 0.04 + HOVER_BASE_LIFT
                }
              }]
            } as any);
            const es = hoverEdgeSource();
            if (es) {
              es.setData({
                type: "FeatureCollection",
                features: [{
                  type: "Feature",
                  geometry: edgeGeom,
                  properties: {
                    min_height: baseMin + HOVER_BASE_LIFT,
                    height: baseHeight + HOVER_BASE_LIFT
                  }
                }]
              } as any);
            }
          }
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
          const hs = hoverSource();
          if (hs) hs.setData(emptyFeatureCollection as any);
          const es = hoverEdgeSource();
          if (es) es.setData(emptyFeatureCollection as any);
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

function ensureClosedRing(ring: [number, number][]): [number, number][] {
  if (!ring.length) return ring;
  const closed = [...ring];
  const first = closed[0];
  const last = closed[closed.length - 1];
  if (last[0] !== first[0] || last[1] !== first[1]) {
    closed.push([first[0], first[1]]);
  }
  return closed;
}

function createRailGeometry(geometry: any, insetScale: number): GeoJSON.MultiPolygon | null {
  if (!geometry || !Number.isFinite(insetScale)) return null;
  const buildStrips = (rings: number[][][]): number[][][][] => {
    if (!Array.isArray(rings) || !rings.length) return [];
    const normalizedOuter = normalizeRing(rings[0]);
    if (!normalizedOuter || normalizedOuter.length < 4) return [];
    const outer = normalizedOuter.slice(0, normalizedOuter.length - 1);
    const inner = scalePolygon(outer, insetScale);
    if (!inner.length || inner.length !== outer.length) return [];
    const strips: number[][][][] = [];
    for (let i = 0; i < outer.length; i++) {
      const next = (i + 1) % outer.length;
      const poly = ensureClosedRing([
        outer[i] as [number, number],
        outer[next] as [number, number],
        inner[next] as [number, number],
        inner[i] as [number, number],
      ]);
      strips.push([poly]);
    }
    return strips;
  };
  if (geometry.type === "Polygon") {
    const strips = buildStrips(geometry.coordinates as number[][][]);
    return strips.length ? { type: "MultiPolygon", coordinates: strips } : null;
  }
  if (geometry.type === "MultiPolygon") {
    const strips = (geometry.coordinates as number[][][][]).flatMap((poly) => buildStrips(poly));
    return strips.length ? { type: "MultiPolygon", coordinates: strips } : null;
  }
  return null;
}

function filterRailGeometryToOuter(
  geometry: GeoJSON.MultiPolygon,
  center: [number, number],
  shortAxis: [number, number],
  outerSign: number
): GeoJSON.MultiPolygon | null {
  const filtered = (geometry.coordinates as number[][][][]).filter((poly) => {
    const ring = poly[0];
    if (!ring?.length) return false;
    const rel = [ring[0][0] - center[0], ring[0][1] - center[1]];
    const proj = rel[0] * shortAxis[0] + rel[1] * shortAxis[1];
    return Math.sign(proj || outerSign) === outerSign;
  });
  return filtered.length ? { type: "MultiPolygon", coordinates: filtered } : null;
}

function determineOuterSign(
  points: [number, number][],
  center: [number, number],
  shortAxis: [number, number]
): number | null {
  if (!points.length) return null;
  let maxProj = 0;
  points.forEach((pt) => {
    const rel: [number, number] = [pt[0] - center[0], pt[1] - center[1]];
    const proj = rel[0] * shortAxis[0] + rel[1] * shortAxis[1];
    if (Math.abs(proj) > Math.abs(maxProj)) {
      maxProj = proj;
    }
  });
  if (maxProj === 0) return null;
  return Math.sign(maxProj);
}

function getPrimaryRing(geometry: any): [number, number][] | null {
  const trimDuplicate = (ring: [number, number][]) => {
    if (!ring.length) return ring;
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first && last && first[0] === last[0] && first[1] === last[1]) {
      return ring.slice(0, ring.length - 1);
    }
    return ring;
  };
  if (geometry?.type === "Polygon") {
    const normalized = normalizeRing((geometry.coordinates?.[0] as number[][]) || []);
    return normalized ? trimDuplicate(normalized) : null;
  }
  if (geometry?.type === "MultiPolygon") {
    let best: [number, number][] | null = null;
    let bestArea = -Infinity;
    (geometry.coordinates as number[][][][])?.forEach((poly) => {
      if (!Array.isArray(poly) || !poly.length) return;
      const normalized = normalizeRing(poly[0]);
      if (!normalized) return;
      const trimmed = trimDuplicate(normalized);
      const area = Math.abs(polygonArea(trimmed));
      if (area > bestArea) {
        bestArea = area;
        best = trimmed;
      }
    });
    return best;
  }
  return null;
}

function polygonArea(points: [number, number][]): number {
  if (!points.length) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i][0] * points[j][1] - points[j][0] * points[i][1];
  }
  return area / 2;
}

function estimatePostSize(points: [number, number][]): number {
  if (!points.length) return BALCONY_POST_MIN_SIZE;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  points.forEach(([x, y]) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });
  const span = Math.max(maxX - minX, maxY - minY);
  const size = Math.max(span * BALCONY_POST_SIZE_FACTOR, BALCONY_POST_MIN_SIZE);
  return size || BALCONY_POST_MIN_SIZE;
}

function filterCornerPoints(points: [number, number][]): [number, number][] {
  if (points.length <= 4) return points;
  const corners: [number, number][] = [];
  const len = points.length;
  const maxCorners = Math.min(6, len);
  const minDot = Math.cos((130 * Math.PI) / 180); // require > ~50° turn

  const addIfFar = (pt: [number, number]) => {
    const minDist = estimatePostSize(points) * 0.6;
    const farEnough = corners.every((existing) => distance(existing, pt) > minDist);
    if (farEnough) corners.push(pt);
  };

  for (let i = 0; i < len && corners.length < maxCorners; i++) {
    const prev = points[(i - 1 + len) % len];
    const curr = points[i];
    const next = points[(i + 1) % len];
    const v1 = normalizeVector([prev[0] - curr[0], prev[1] - curr[1]]);
    const v2 = normalizeVector([next[0] - curr[0], next[1] - curr[1]]);
    const dot = v1[0] * v2[0] + v1[1] * v2[1];
    if (!Number.isFinite(dot) || dot > minDot) continue;
    addIfFar(curr);
  }

  if (!corners.length) {
    // fallback: take every nth vertex
    for (let i = 0; i < len; i += Math.ceil(len / 4)) {
      corners.push(points[i]);
    }
  }
  return corners.slice(0, 6);
}

function distance(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function movePointTowards(
  from: [number, number],
  to: [number, number],
  dist: number
): [number, number] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const t = Math.min(dist / len, 1);
  return [from[0] + dx * t, from[1] + dy * t];
}

function createPostPolygon(
  center: [number, number],
  size: number
): [number, number][] | null {
  if (!center) return null;
  const half = Math.max(size / 2, BALCONY_POST_MIN_SIZE);
  const ring: [number, number][] = [
    [center[0] - half, center[1] - half],
    [center[0] + half, center[1] - half],
    [center[0] + half, center[1] + half],
    [center[0] - half, center[1] + half],
  ];
  return ensureClosedRing(ring);
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