      "use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { Map, LngLatLike, GeoJSONSource } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { PMREMGenerator } from "three/examples/jsm/cubemap/PMREMGenerator.js";
import type * as GeoJSON from "geojson";

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
const FACADE_GLASS_COLOR = "#c6d8eb";
const FACADE_GLASS_OPACITY = 0.78;
const STREET_WALL_STRIP_SCALE = -0.02;
const TERRACE_FLOOR_THICKNESS = 0.12;
const TERRACE_RAIL_HEIGHT = FLOOR_HEIGHT_M / 3;
const TERRACE_RAIL_SCALE = -0.06;
const BALCONY_FLOOR_THICKNESS = 0.1;
const BALCONY_RAIL_HEIGHT = FLOOR_HEIGHT_M * 0.48;
const BALCONY_RAIL_SCALE = -0.03;
const BALCONY_POST_SIZE_FACTOR = 0.0025;
const BALCONY_POST_MIN_SIZE = 0.000002;
const STREET_BEAM_SIZE_FACTOR = 0.042;
const STREET_BEAM_MIN_SIZE = 0.0000025;
const STREET_TOP_BEAM_HEIGHT = 0.22;
const STREET_TOP_BEAM_THICKNESS_FACTOR = 1.35;
const STREET_CROSS_DEPTH_FACTOR = 0.35;
const STREET_CROSS_WIDTH_FACTOR = 0.22;
const STREET_CROSS_WINDOW_INSET_FACTOR = 0.05;
const STREET_CROSS_DEPTH_CLEARANCE_FACTOR = 0.35;

const STREET_CROSS_HALF_HEIGHT = 0.08;
const FLOOR5_LEFT_PANORAMA_BAND = 0.29;
const FLOOR5_FRONT_RIGHT_BAND = 1 / 3;
const FLOOR5_PERP_WINDOW_BAND = 1 / 3;
const FLOOR5_FRONT_ASPECT_RATIO = 0.85;
const FLOOR5_EDGE_BLEND = 0.04;
const STREET_CORNER_BEAM_WIDTH_FACTOR = 0.08;
const STREET_CORNER_BEAM_DEPTH_FACTOR = 0.12;
const FLOOR5_RELAXED_FACING_COS = 0.4;
const FLOOR5_SIDE_WINDOW_BAND = 1 / 3;
const FLOOR5_FRONT_ALIGNMENT = 0.72;
const FLOOR5_SIDE_ALIGNMENT = 0.6;
const STREET_GLASS_TARGET_FLOORS = [5, 4, 3, 2];

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

function makeStreetGlassFeatureCollection(
  unitsFc: GeoJSON.FeatureCollection | null,
  terraceFc: GeoJSON.FeatureCollection | null
): GeoJSON.FeatureCollection {
  if (!unitsFc) return emptyFeatureCollection;
  const features: GeoJSON.Feature[] = [];
  let fallbackDir: [number, number] | null = null;

  STREET_GLASS_TARGET_FLOORS.forEach((floor) => {
    const floorUnits = unitsFc.features.filter((feature) => {
      const props = feature.properties as any;
      return Number(props?.floor) === floor;
    });
    if (!floorUnits.length) return;
    const refFeature = floorUnits[0] as GeoJSON.Feature;
    const baseMin = Number(
      (refFeature.properties as any)?.min_height ?? (floor - 1) * FLOOR_HEIGHT_M + 0.02
    );
    const baseMax = Number((refFeature.properties as any)?.height ?? floor * FLOOR_HEIGHT_M - 0.02);
    const primaryRing = getPrimaryRing(refFeature.geometry as any);
    if (!primaryRing) return;
    const closedRing = ensureClosedRing(primaryRing);
    const ringPoints = closedRing.slice(0, -1);
    if (!ringPoints.length) return;
    const floorCenter = centroidOfPolygon(ringPoints);
    let dirVec: [number, number] | null = null;
    const terraceFeature = terraceFc?.features.find((feature) => {
      const props = feature.properties as any;
      return props?.kind === "terrace-floor" && Number(props?.floor) === floor;
    });

    if (terraceFeature) {
      const terracePoints = collectGeometryPoints(terraceFeature.geometry);
      if (terracePoints.length) {
        const terraceCenter = centroidOfPolygon(terracePoints);
        const dirVecRaw: [number, number] = [
          terraceCenter[0] - floorCenter[0],
          terraceCenter[1] - floorCenter[1],
        ];
        const dirLen = Math.hypot(dirVecRaw[0], dirVecRaw[1]) || 1;
        if (dirLen > 0) {
          dirVec = [dirVecRaw[0] / dirLen, dirVecRaw[1] / dirLen];
          fallbackDir = dirVec;
        }
      }
    } else if (fallbackDir) {
      dirVec = fallbackDir;
    }
    if (!dirVec) return;

    const sideAxis: [number, number] = [-dirVec[1], dirVec[0]];
    const normalize = (vec: [number, number]) => {
      const len = Math.hypot(vec[0], vec[1]) || 1;
      return [vec[0] / len, vec[1] / len] as [number, number];
    };
    const secondaryAxis = normalize([
      sideAxis[0] * 0.65 + dirVec[0] * 0.35,
      sideAxis[1] * 0.65 + dirVec[1] * 0.35,
    ]);
    const pointFromSD = (s: number, d: number): [number, number] => [
      floorCenter[0] + sideAxis[0] * s + dirVec[0] * d,
      floorCenter[1] + sideAxis[1] * s + dirVec[1] * d,
    ];

    const rectFromSD = (
      centerS: number,
      centerD: number,
      halfWidth: number,
      halfDepth: number
    ): number[][] | null => {
      if (!(halfWidth > 0) || !(halfDepth > 0)) return null;
      const ring = ensureClosedRing([
        pointFromSD(centerS - halfWidth, centerD - halfDepth),
        pointFromSD(centerS + halfWidth, centerD - halfDepth),
        pointFromSD(centerS + halfWidth, centerD + halfDepth),
        pointFromSD(centerS - halfWidth, centerD + halfDepth),
      ]);
      return ring && ring.length >= 4 ? ring : null;
    };

    const shellGeom = createRailGeometry(refFeature.geometry as any, STREET_WALL_STRIP_SCALE);
    if (!shellGeom) return;

    const recordExtreme = (
      pts: [number, number][],
      projFunc: (pt: [number, number]) => number
    ) => {
      let minProj = Number.POSITIVE_INFINITY;
      let maxProj = Number.NEGATIVE_INFINITY;
      let minPoints: [number, number][] = [];
      let maxPoints: [number, number][] = [];
      const EPS = 1e-8;
      pts.forEach((pt) => {
        const proj = projFunc(pt);
        if (proj < minProj - EPS) {
          minProj = proj;
          minPoints = [pt];
        } else if (Math.abs(proj - minProj) <= EPS) {
          minPoints.push(pt);
        }
        if (proj > maxProj + EPS) {
          maxProj = proj;
          maxPoints = [pt];
        } else if (Math.abs(proj - maxProj) <= EPS) {
          maxPoints.push(pt);
        }
      });
      return { minPoints, maxPoints, minProj, maxProj };
    };

    let floor5MinFrontSideSpan = Number.POSITIVE_INFINITY;
    if (floor === 5) {
      (shellGeom.coordinates || []).forEach((poly) => {
        if (!poly?.[0]) return;
        const ring = poly[0];
        if (!Array.isArray(ring) || ring.length < 4) return;
        const withoutClose = ring
          .slice(0, -1)
          .map((pt: number[]) => [Number(pt[0]), Number(pt[1])] as [number, number]);
        if (!withoutClose.length) return;
        const centroid = centroidOfPolygon(withoutClose);
        const rel: [number, number] = [centroid[0] - floorCenter[0], centroid[1] - floorCenter[1]];
        const relLen = Math.hypot(rel[0], rel[1]) || 1;
        const relUnit: [number, number] = [rel[0] / relLen, rel[1] / relLen];
        const facingDir = relUnit[0] * dirVec[0] + relUnit[1] * dirVec[1];
        if (facingDir < FLOOR5_RELAXED_FACING_COS) return;

        const sideExtremes = recordExtreme(withoutClose, (pt) => {
          const relPt: [number, number] = [pt[0] - floorCenter[0], pt[1] - floorCenter[1]];
          return relPt[0] * sideAxis[0] + relPt[1] * sideAxis[1];
        });
        const dirExtremes = recordExtreme(withoutClose, (pt) => {
          const relPt: [number, number] = [pt[0] - floorCenter[0], pt[1] - floorCenter[1]];
          return relPt[0] * dirVec[0] + relPt[1] * dirVec[1];
        });

        const ringSideSpan = sideExtremes.maxProj - sideExtremes.minProj;
        const ringDepthSpan = dirExtremes.maxProj - dirExtremes.minProj;
        const isFrontWallSection =
          ringSideSpan > 0 && ringDepthSpan > 0 && ringSideSpan >= ringDepthSpan * FLOOR5_FRONT_ASPECT_RATIO;

        if (isFrontWallSection && ringSideSpan < floor5MinFrontSideSpan) {
          floor5MinFrontSideSpan = ringSideSpan;
        }
      });
    }

    (shellGeom.coordinates || []).forEach((poly, idx) => {
      if (!poly?.[0]) return;
      const ring = poly[0];
      if (!Array.isArray(ring) || ring.length < 4) return;

      const withoutClose = ring.slice(0, -1).map((pt: number[]) => [Number(pt[0]), Number(pt[1])] as [number, number]);

      if (!withoutClose.length) return;
      const centroid = centroidOfPolygon(withoutClose);
      const rel: [number, number] = [centroid[0] - floorCenter[0], centroid[1] - floorCenter[1]];
      const relLen = Math.hypot(rel[0], rel[1]) || 1;
      const dot = rel[0] * dirVec[0] + rel[1] * dirVec[1];
      const cosTheta = dot / relLen;
      if (floor !== 5 && cosTheta < 0.92) return;
      const pushGlassFeature = (coords: number[][], suffix = "full") => {
        if (!coords || coords.length < 4) return;
        features.push({
          type: "Feature",
          id: `street-glass-${floor}-${idx}-${suffix}`,
          properties: {
            floor,
            min_height: baseMin,
            height: baseMax,
            kind: "street-glass",
          },
          geometry: { type: "Polygon", coordinates: [coords] },
        } as GeoJSON.Feature);
      };

      const sideExtremes = recordExtreme(withoutClose, (pt) => {
        const relPt: [number, number] = [pt[0] - floorCenter[0], pt[1] - floorCenter[1]];
        return relPt[0] * sideAxis[0] + relPt[1] * sideAxis[1];
      });
      const dirExtremes = recordExtreme(withoutClose, (pt) => {
        const relPt: [number, number] = [pt[0] - floorCenter[0], pt[1] - floorCenter[1]];
        return relPt[0] * dirVec[0] + relPt[1] * dirVec[1];
      });

      const avgPoint = (pts: [number, number][]) => {
        if (!pts.length) return null;
        const sum = pts.reduce<[number, number]>(
          (acc, p) => [acc[0] + p[0], acc[1] + p[1]],
          [0, 0]
        );
        return [sum[0] / pts.length, sum[1] / pts.length] as [number, number];
      };

      const spanBounds = withoutClose.reduce(
        (acc, [x, y]) => ({
          minX: Math.min(acc.minX, x),
          maxX: Math.max(acc.maxX, x),
          minY: Math.min(acc.minY, y),
          maxY: Math.max(acc.maxY, y),
        }),
        {
          minX: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY,
        }
      );
      const span =
        Math.max(spanBounds.maxX - spanBounds.minX, spanBounds.maxY - spanBounds.minY) || 0.00001;
      const beamSize = Math.max(span * STREET_BEAM_SIZE_FACTOR, STREET_BEAM_MIN_SIZE);
      const beamInset = Math.min(span * 0.02, beamSize * 2);

      if (floor === 5) {
        const ringSideSpan = sideExtremes.maxProj - sideExtremes.minProj;
        const ringDepthSpan = dirExtremes.maxProj - dirExtremes.minProj;
        const relUnit: [number, number] = [rel[0] / relLen, rel[1] / relLen];
        const facingDir = relUnit[0] * dirVec[0] + relUnit[1] * dirVec[1];

        const isFrontWallSection =
          ringSideSpan > 0 && ringDepthSpan > 0 && ringSideSpan >= ringDepthSpan * FLOOR5_FRONT_ASPECT_RATIO;

        if (isFrontWallSection && facingDir >= FLOOR5_RELAXED_FACING_COS) {
          const isSmallFrontWall =
            Number.isFinite(floor5MinFrontSideSpan) &&
            floor5MinFrontSideSpan < Number.POSITIVE_INFINITY &&
            ringSideSpan <= floor5MinFrontSideSpan * 1.05;

          if (isSmallFrontWall) {
            pushGlassFeature(ring, "front-full");

            const ringPts = ring.slice(0, -1).map((pt) => [Number(pt[0]), Number(pt[1])] as [number, number]);
            if (ringPts.length) {
              const sideVals = ringPts.map(
                (pt) => (pt[0] - floorCenter[0]) * sideAxis[0] + (pt[1] - floorCenter[1]) * sideAxis[1]
              );
              const depthVals = ringPts.map(
                (pt) => (pt[0] - floorCenter[0]) * dirVec[0] + (pt[1] - floorCenter[1]) * dirVec[1]
              );
              const frontSideMin = Math.min(...sideVals);
              const frontDepthMax = Math.max(...depthVals);
              const cornerWidth = Math.max(ringSideSpan * STREET_CORNER_BEAM_WIDTH_FACTOR, beamSize * 0.8) * 2.24;
              const cornerDepth = Math.max(ringDepthSpan * STREET_CORNER_BEAM_DEPTH_FACTOR, beamSize * 0.6);
              const cornerRect = rectFromSD(
                frontSideMin + cornerWidth / 2,
                frontDepthMax - cornerDepth / 2,
                cornerWidth / 2,
                cornerDepth / 2
              );
              if (cornerRect) {
                features.push({
                  type: "Feature",
                  id: `street-glass-corner-beam-${floor}-${idx}-full`,
                  properties: {
                    floor,
                    min_height: baseMin,
                    height: baseMax,
                    kind: "street-glass-beam",
                  },
                  geometry: { type: "Polygon", coordinates: [cornerRect] },
                } as GeoJSON.Feature);
              }

              const topThickness = beamSize * STREET_TOP_BEAM_THICKNESS_FACTOR;
              const ringCenterLocal = centroidOfPolygon(ringPts);

              const pickWallAxis = (): [number, number] | null => {
                if (ringPts.length < 3) return null;
                const e0: [number, number] = [ringPts[1][0] - ringPts[0][0], ringPts[1][1] - ringPts[0][1]];
                const e1: [number, number] = [ringPts[2][0] - ringPts[1][0], ringPts[2][1] - ringPts[1][1]];
                const l0 = Math.hypot(e0[0], e0[1]);
                const l1 = Math.hypot(e1[0], e1[1]);
                const v = (l1 > l0 ? e1 : e0) as [number, number];
                const len = Math.hypot(v[0], v[1]);
                if (!(len > 1e-12)) return null;
                return [v[0] / len, v[1] / len];
              };

              const wallAxis = pickWallAxis();
              let topBeamRing: [number, number][] | null = null;
              if (!wallAxis) {
                const leftS = sideExtremes.minProj;
                const rightS = sideExtremes.maxProj;
                const outerD = dirExtremes.maxProj;
                const innerD = dirExtremes.maxProj - topThickness;
                topBeamRing = ensureClosedRing([
                  pointFromSD(leftS, outerD),
                  pointFromSD(rightS, outerD),
                  pointFromSD(rightS, innerD),
                  pointFromSD(leftS, innerD),
                ]);
              } else {
                let outAxis: [number, number] = [-wallAxis[1], wallAxis[0]];
                if (outAxis[0] * dirVec[0] + outAxis[1] * dirVec[1] < 0) outAxis = [-outAxis[0], -outAxis[1]];

                const projectS = (pt: [number, number]) => {
                  const relPt: [number, number] = [pt[0] - ringCenterLocal[0], pt[1] - ringCenterLocal[1]];
                  return relPt[0] * wallAxis[0] + relPt[1] * wallAxis[1];
                };
                const projectD = (pt: [number, number]) => {
                  const relPt: [number, number] = [pt[0] - ringCenterLocal[0], pt[1] - ringCenterLocal[1]];
                  return relPt[0] * outAxis[0] + relPt[1] * outAxis[1];
                };

                const sExt = recordExtreme(ringPts, projectS);
                const dExt = recordExtreme(ringPts, projectD);
                const leftS = sExt.minProj;
                const rightS = sExt.maxProj;
                const outerD = dExt.maxProj;
                const innerD = outerD - topThickness;
                const pointFromLocal = (s: number, d: number): [number, number] => [
                  ringCenterLocal[0] + wallAxis[0] * s + outAxis[0] * d,
                  ringCenterLocal[1] + wallAxis[1] * s + outAxis[1] * d,
                ];
                topBeamRing = ensureClosedRing([
                  pointFromLocal(leftS, outerD),
                  pointFromLocal(rightS, outerD),
                  pointFromLocal(rightS, innerD),
                  pointFromLocal(leftS, innerD),
                ]);
              }

              if (topBeamRing && topBeamRing.length >= 4) {
                features.push({
                  type: "Feature",
                  id: `street-glass-top-beam-${floor}-${idx}-full`,
                  properties: {
                    floor,
                    min_height: Math.max(baseMax - STREET_TOP_BEAM_HEIGHT, baseMin),
                    height: baseMax,
                    kind: "street-glass-top-beam",
                  },
                  geometry: { type: "Polygon", coordinates: [topBeamRing] },
                } as GeoJSON.Feature);
              }
            }
          } else {
            const bandWidth = Math.max(ringSideSpan * FLOOR5_FRONT_RIGHT_BAND, ringSideSpan * 0.1);
            const blend = ringSideSpan * FLOOR5_EDGE_BLEND;

            const threshold = sideExtremes.maxProj - bandWidth - blend;
            const clippedRing = clipRingByAxisThreshold(ring, floorCenter, sideAxis, threshold, true);
            if (clippedRing && clippedRing.length >= 4) {
              pushGlassFeature(clippedRing, "front");

              const ringPts = clippedRing.slice(0, -1).map((pt) => [Number(pt[0]), Number(pt[1])] as [number, number]);
              if (ringPts.length) {
                const sideVals = ringPts.map(
                  (pt) => (pt[0] - floorCenter[0]) * sideAxis[0] + (pt[1] - floorCenter[1]) * sideAxis[1]
                );
                const depthVals = ringPts.map(
                  (pt) => (pt[0] - floorCenter[0]) * dirVec[0] + (pt[1] - floorCenter[1]) * dirVec[1]
                );
                const frontSideMax = Math.max(...sideVals);
                const frontDepthMin = Math.min(...depthVals);
                const cornerWidth = Math.max(ringSideSpan * STREET_CORNER_BEAM_WIDTH_FACTOR, beamSize * 0.8);
                const cornerDepth = Math.max(ringDepthSpan * STREET_CORNER_BEAM_DEPTH_FACTOR, beamSize * 0.6);
                const cornerRect = rectFromSD(
                  frontSideMax - cornerWidth / 2,
                  frontDepthMin + cornerDepth / 2,
                  cornerWidth / 2,
                  cornerDepth / 2
                );
                if (cornerRect) {
                  features.push({
                    type: "Feature",
                    id: `street-glass-corner-beam-${floor}-${idx}`,
                    properties: {
                      floor,
                      min_height: baseMin,
                      height: baseMax,
                      kind: "street-glass-beam",
                    },
                    geometry: { type: "Polygon", coordinates: [cornerRect] },
                  } as GeoJSON.Feature);
                }
              }
            }
          }
        }

        return;
      }

      pushGlassFeature(ring);

      const beamContactPoints: [number, number][] = [];
      const beamCenters: { center: [number, number]; side: number }[] = [];
      const addBeamAt = (center: [number, number], suffix: string) => {
        const beamPoly = createPostPolygon(center, beamSize);
        if (!beamPoly || beamPoly.length < 4) return;
        const relToCenter: [number, number] = [center[0] - floorCenter[0], center[1] - floorCenter[1]];
        const sideCoord = relToCenter[0] * sideAxis[0] + relToCenter[1] * sideAxis[1];
        const sideSign = sideCoord >= 0 ? 1 : -1;
        features.push({
          type: "Feature",
          id: `street-glass-beam-${floor}-${idx}-${suffix}`,
          properties: {
            floor,
            min_height: baseMin,
            height: baseMax,
            kind: "street-glass-beam",
          },
          geometry: { type: "Polygon", coordinates: [beamPoly] },
        } as GeoJSON.Feature);
        const relPoints = beamPoly.map((pt) => {
          const rel: [number, number] = [pt[0] - floorCenter[0], pt[1] - floorCenter[1]];
          return {
            point: pt as [number, number],
            side: rel[0] * sideAxis[0] + rel[1] * sideAxis[1],
            dir: rel[0] * dirVec[0] + rel[1] * dirVec[1],
          };
        });
        const maxDir = Math.max(...relPoints.map((p) => p.dir));
        const frontCandidates = relPoints.filter((p) => Math.abs(p.dir - maxDir) < 1e-9);
        const chosen = frontCandidates.reduce<typeof relPoints[0] | null>((acc, cur) => {
          if (!acc) return cur;
          if (sideSign >= 0) {
            return cur.side > acc.side ? cur : acc;
          }
          return cur.side < acc.side ? cur : acc;
        }, null);
        if (chosen) beamContactPoints.push(chosen.point);
        beamCenters.push({ center, side: sideCoord });
      };

      const basePositions = [avgPoint(sideExtremes.minPoints), avgPoint(sideExtremes.maxPoints)].filter(
        (pt): pt is [number, number] => Array.isArray(pt)
      );
      basePositions.forEach((pos, beamIdx) => {
        if (!pos) return;
        const relToCenter: [number, number] = [pos[0] - floorCenter[0], pos[1] - floorCenter[1]];
        const sideSign = (relToCenter[0] * sideAxis[0] + relToCenter[1] * sideAxis[1]) >= 0 ? 1 : -1;
        let insetPos = pos;
        if (beamInset > 0) {
          insetPos = [
            pos[0] - sideAxis[0] * sideSign * beamInset,
            pos[1] - sideAxis[1] * sideSign * beamInset,
          ];
        }
        addBeamAt(insetPos, `corner-${beamIdx}`);
      });

      const makeOrderedCenters = () => [...beamCenters].sort((a, b) => a.side - b.side);

      if (beamCenters.length >= 2) {
        const orderedCenters = makeOrderedCenters();
        const leftCenter = orderedCenters[0].center;
        const rightCenter = orderedCenters[orderedCenters.length - 1].center;
        const delta: [number, number] = [rightCenter[0] - leftCenter[0], rightCenter[1] - leftCenter[1]];
        [1 / 3, 2 / 3].forEach((frac, fracIdx) => {
          const newCenter: [number, number] = [
            leftCenter[0] + delta[0] * frac,
            leftCenter[1] + delta[1] * frac,
          ];
          addBeamAt(newCenter, `inner-${fracIdx}`);
        });
      }

      const shiftInward = (pt: [number, number], dist: number): [number, number] => [
        pt[0] - dirVec[0] * dist,
        pt[1] - dirVec[1] * dist,
      ];

      const topThickness = beamSize * STREET_TOP_BEAM_THICKNESS_FACTOR;
      const finalOrderedCenters = beamCenters.length >= 2 ? makeOrderedCenters() : [];

      const makePerpAxis = (primary: [number, number], reference: [number, number]): [number, number] => {
        const dot = primary[0] * reference[0] + primary[1] * reference[1];
        const residual: [number, number] = [reference[0] - primary[0] * dot, reference[1] - primary[1] * dot];
        const len = Math.hypot(residual[0], residual[1]);
        if (len > 1e-6) return [residual[0] / len, residual[1] / len];
        return [-primary[1], primary[0]];
      };

      const spanBasis =
        finalOrderedCenters.length >= 2
          ? (() => {
              const fullSpanVec: [number, number] = [
                finalOrderedCenters[finalOrderedCenters.length - 1].center[0] - finalOrderedCenters[0].center[0],
                finalOrderedCenters[finalOrderedCenters.length - 1].center[1] - finalOrderedCenters[0].center[1],
              ];
              const spanLen = Math.hypot(fullSpanVec[0], fullSpanVec[1]) || 1;
              const basisSide: [number, number] = [fullSpanVec[0] / spanLen, fullSpanVec[1] / spanLen];
              let basisDepth = makePerpAxis(basisSide, dirVec);
              if (basisDepth[0] * dirVec[0] + basisDepth[1] * dirVec[1] < 0) {
                basisDepth = [-basisDepth[0], -basisDepth[1]];
              }
              const projectAlong = (pt: [number, number], axis: [number, number]) => {
                const rel: [number, number] = [pt[0] - floorCenter[0], pt[1] - floorCenter[1]];
                return rel[0] * axis[0] + rel[1] * axis[1];
              };
              const pointFromBasis = (s: number, d: number): [number, number] => [
                floorCenter[0] + basisSide[0] * s + basisDepth[0] * d,
                floorCenter[1] + basisSide[1] * s + basisDepth[1] * d,
              ];
              const rectFromBasis = (
                centerS: number,
                centerD: number,
                halfWidth: number,
                halfDepth: number
              ): number[][] | null => {
                if (!(halfWidth > 0) || !(halfDepth > 0)) return null;
                const corners: [number, number][] = [
                  pointFromBasis(centerS - halfWidth, centerD - halfDepth),
                  pointFromBasis(centerS + halfWidth, centerD - halfDepth),
                  pointFromBasis(centerS + halfWidth, centerD + halfDepth),
                  pointFromBasis(centerS - halfWidth, centerD + halfDepth),
                ];
                return ensureClosedRing(corners);
              };
              const depthExtremes = recordExtreme(withoutClose, (pt) => projectAlong(pt, basisDepth));
              const spanExtremes = recordExtreme(withoutClose, (pt) => projectAlong(pt, basisSide));
              return { basisSide, basisDepth, projectAlong, rectFromBasis, depthExtremes, spanExtremes };
            })()
          : null;

      const spanBasisReady =
        spanBasis &&
        Number.isFinite(spanBasis.depthExtremes.maxProj) &&
        Number.isFinite(spanBasis.depthExtremes.minProj) &&
        Number.isFinite(spanBasis.spanExtremes.minProj) &&
        Number.isFinite(spanBasis.spanExtremes.maxProj)
          ? spanBasis
          : null;

      if (
        spanBasisReady &&
        (floor === 2 || floor === 3) &&
        finalOrderedCenters.length >= 4 &&
        spanBasisReady.spanExtremes.maxProj - spanBasisReady.spanExtremes.minProj > 0
      ) {
        const availableDepth = Math.max(
          spanBasisReady.depthExtremes.maxProj - spanBasisReady.depthExtremes.minProj,
          beamSize * 0.5
        );
        let crossDepthHalf = Math.max(beamSize * STREET_CROSS_DEPTH_FACTOR, beamSize * 0.2);
        crossDepthHalf = Math.min(crossDepthHalf, availableDepth / 2);
        const desiredInset = Math.max(
          beamSize * STREET_CROSS_DEPTH_CLEARANCE_FACTOR,
          crossDepthHalf * 0.35
        );
        const maxInset = Math.max(availableDepth - crossDepthHalf, beamSize * 0.1);
        const crossDepthInset = Math.min(desiredInset, maxInset);
        const minCenter = spanBasisReady.depthExtremes.minProj + crossDepthHalf;
        const maxCenter = spanBasisReady.depthExtremes.maxProj - crossDepthHalf;
        const desiredCenter =
          spanBasisReady.depthExtremes.maxProj - crossDepthInset - crossDepthHalf;
        const crossDepthCenter = Math.max(minCenter, Math.min(desiredCenter, maxCenter));
        const verticalHalfWidth = Math.max(beamSize * STREET_CROSS_WIDTH_FACTOR, beamSize * 0.15);

        for (let windowIdx = 0; windowIdx < finalOrderedCenters.length - 1; windowIdx++) {
          const left = finalOrderedCenters[windowIdx];
          const right = finalOrderedCenters[windowIdx + 1];
          const leftS = spanBasisReady.projectAlong(left.center, spanBasisReady.basisSide);
          const rightS = spanBasisReady.projectAlong(right.center, spanBasisReady.basisSide);
          const windowWidth = Math.abs(rightS - leftS);
          if (!(windowWidth > beamSize * 0.4)) continue;
          const crossCenterS = (leftS + rightS) / 2;

          const windowInset = Math.max(
            windowWidth * STREET_CROSS_WINDOW_INSET_FACTOR,
            verticalHalfWidth * 0.5
          );

          const verticalRing = spanBasisReady.rectFromBasis(
            crossCenterS,
            crossDepthCenter,
            verticalHalfWidth,
            crossDepthHalf
          );
          if (verticalRing) {
            features.push({
              type: "Feature",
              id: `street-glass-cross-vertical-${floor}-${idx}-${windowIdx}`,
              properties: {
                floor,
                min_height: baseMin,
                height: baseMax,
                kind: "street-glass-cross-vertical",
              },
              geometry: { type: "Polygon", coordinates: [verticalRing] },
            } as GeoJSON.Feature);
          }

          const horizontalHalfWidth = Math.max(windowWidth / 2 - windowInset, beamSize * 0.18);
          if (!(horizontalHalfWidth > 0)) continue;
          const horizontalRing = spanBasisReady.rectFromBasis(
            crossCenterS,
            crossDepthCenter,
            horizontalHalfWidth,
            crossDepthHalf
          );
          if (horizontalRing) {
            const spanHeight = baseMax - baseMin;
            const crossMid = baseMin + spanHeight / 2;
            const halfHeight = Math.min(STREET_CROSS_HALF_HEIGHT, spanHeight / 2 - 0.01);
            const horizontalMin = Math.max(baseMin, crossMid - halfHeight);
            const horizontalMax = Math.min(baseMax, crossMid + halfHeight);
            features.push({
              type: "Feature",
              id: `street-glass-cross-horizontal-${floor}-${idx}-${windowIdx}`,
              properties: {
                floor,
                min_height: horizontalMin,
                height: horizontalMax,
                kind: "street-glass-cross-horizontal",
              },
              geometry: { type: "Polygon", coordinates: [horizontalRing] },
            } as GeoJSON.Feature);
          }
        }
      }

      let topBeamPlaced = false;

      if (
        spanBasisReady &&
        (floor === 2 || floor === 3 || floor === 4) &&
        finalOrderedCenters.length >= 2
      ) {
        const spanWidth =
          spanBasisReady.spanExtremes.maxProj - spanBasisReady.spanExtremes.minProj;
        if (spanWidth > beamSize * 0.4) {
          const edgePadding = Math.min(Math.max(spanWidth * 0.02, beamSize * 0.3), spanWidth / 4);
          const leftS = spanBasisReady.spanExtremes.minProj + edgePadding;
          const rightS = spanBasisReady.spanExtremes.maxProj - edgePadding;
          const usableWidth = rightS - leftS;
          if (usableWidth > beamSize * 0.3) {
            const halfWidth = usableWidth / 2;
            const centerS = (leftS + rightS) / 2;
            const depthOuter = spanBasisReady.depthExtremes.maxProj;
            const depthInner = spanBasisReady.depthExtremes.minProj;
            const depthSpan = Math.max(depthOuter - depthInner, beamSize * 0.2);
            const halfDepth = Math.min(
              Math.max(topThickness / 2, depthSpan * 0.25, beamSize * 0.1),
              depthSpan / 2
            );
            const centerD = depthOuter - halfDepth;
            const topBeamRing = spanBasisReady.rectFromBasis(centerS, centerD, halfWidth, halfDepth);
            if (topBeamRing) {
              features.push({
                type: "Feature",
                id: `street-glass-top-beam-${floor}-${idx}`,
                properties: {
                  floor,
                  min_height: Math.max(baseMax - STREET_TOP_BEAM_HEIGHT, baseMin),
                  height: baseMax,
                  kind: "street-glass-top-beam",
                },
                geometry: { type: "Polygon", coordinates: [topBeamRing] },
              } as GeoJSON.Feature);
              topBeamPlaced = true;
            }
          }
        }
      }

      if (
        !topBeamPlaced &&
        Number.isFinite(sideExtremes.minProj) &&
        Number.isFinite(sideExtremes.maxProj) &&
        Number.isFinite(dirExtremes.maxProj)
      ) {
        const sPadding = beamSize * 0.5;
        const dThickness = topThickness;
        const leftS = sideExtremes.minProj - sPadding;
        const rightS = sideExtremes.maxProj + sPadding;
        const outerD = dirExtremes.maxProj;
        const innerD = dirExtremes.maxProj - dThickness;
        const topBeamRing = ensureClosedRing([
          pointFromSD(leftS, outerD),
          pointFromSD(rightS, outerD),
          pointFromSD(rightS, innerD),
          pointFromSD(leftS, innerD),
        ]);
        if (topBeamRing && topBeamRing.length >= 4) {
          features.push({
            type: "Feature",
            id: `street-glass-top-beam-${floor}-${idx}`,
            properties: {
              floor,
              min_height: Math.max(baseMax - STREET_TOP_BEAM_HEIGHT, baseMin),
              height: baseMax,
              kind: "street-glass-top-beam",
            },
            geometry: { type: "Polygon", coordinates: [topBeamRing] },
          } as GeoJSON.Feature);
        }
      }

    });
  });

  return features.length ? { type: "FeatureCollection", features } : emptyFeatureCollection;
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
      let railGeom = createRailGeometry(geom, TERRACE_RAIL_SCALE);
      const primaryRing = getPrimaryRing(geom);
      const postRing = primaryRing ? ensureClosedRing(primaryRing) : null;
      const ringVertices = postRing ? postRing.slice(0, postRing.length - 1) : null;
      const ringCenter = ringVertices?.length ? centroidOfPolygon(ringVertices) : null;
      const axisBasis = ringVertices?.length ? computeAxisBasis(ringVertices) : null;
      const longAxis = axisBasis ? axisBasis.axes[0] : null;
      const shortAxis = axisBasis ? axisBasis.axes[1] : null;
      const outerShortSign = ringVertices && ringCenter && shortAxis
        ? determineOuterSign(ringVertices, ringCenter, shortAxis)
        : null;
      const outerLongSign = ringVertices && ringCenter && longAxis
        ? determineOuterSign(ringVertices, ringCenter, longAxis)
        : null;
      const longMaxAbs = ringVertices && ringCenter && longAxis
        ? Math.max(
            1e-12,
            ...ringVertices.map((pt) => {
              const rel: [number, number] = [pt[0] - ringCenter[0], pt[1] - ringCenter[1]];
              return Math.abs(rel[0] * longAxis[0] + rel[1] * longAxis[1]);
            })
          )
        : null;

      if (
        floor !== 6 &&
        railGeom &&
        ringCenter &&
        shortAxis &&
        longAxis &&
        outerShortSign &&
        outerLongSign &&
        longMaxAbs
      ) {
        const filteredCoords = (railGeom.coordinates as number[][][][]).filter((poly) => {
          const ring = poly[0];
          if (!ring?.length) return false;
          const rel = [ring[0][0] - ringCenter[0], ring[0][1] - ringCenter[1]];
          const projShort = rel[0] * shortAxis[0] + rel[1] * shortAxis[1];
          const projLong = rel[0] * longAxis[0] + rel[1] * longAxis[1];
          const shortOk = Math.sign(projShort || outerShortSign) === outerShortSign;
          if (shortOk) return true;

          const nearOuterLongEdge = Math.abs(projLong) >= longMaxAbs * 0.85;
          const allowCornerInnerSegment = (floor === 2 || floor === 3 || floor === 4 || floor === 5) && nearOuterLongEdge;
          return allowCornerInnerSegment;
        });
        if (filteredCoords.length) {
          railGeom = { type: "MultiPolygon", coordinates: filteredCoords } as GeoJSON.MultiPolygon;
        }
      }

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
    if (balconyRailGeom && ringCenter && ringVertices && axisBasis) {
      const longAxis = axisBasis.axes[0];
      const shortAxisLocal = axisBasis.axes[1];
      const outerShortSign = determineOuterSign(ringVertices, ringCenter, shortAxisLocal);
      if (outerShortSign) {
        const outerLongSign = determineOuterSign(ringVertices, ringCenter, longAxis);
        const longMaxAbs = Math.max(
          1e-12,
          ...ringVertices.map((pt) => {
            const rel: [number, number] = [pt[0] - ringCenter[0], pt[1] - ringCenter[1]];
            return Math.abs(rel[0] * longAxis[0] + rel[1] * longAxis[1]);
          })
        );
        const filteredCoords = (balconyRailGeom.coordinates as number[][][][]).filter((poly) => {
          const ring = poly[0];
          if (!ring?.length) return false;
          const rel = [ring[0][0] - ringCenter[0], ring[0][1] - ringCenter[1]];
          const projShort = rel[0] * shortAxisLocal[0] + rel[1] * shortAxisLocal[1];
          const projLong = rel[0] * longAxis[0] + rel[1] * longAxis[1];
          const shortOk = Math.sign(projShort || outerShortSign) === outerShortSign;
          if (shortOk) return true;
          if (!(floor === 2 || floor === 3 || floor === 4 || floor === 5) || !outerLongSign) return false;
          const nearOuterLongEdge = Math.abs(projLong) >= longMaxAbs * 0.85;
          return nearOuterLongEdge;
        });
        const filtered = filteredCoords.length
          ? ({ type: "MultiPolygon", coordinates: filteredCoords } as GeoJSON.MultiPolygon)
          : null;
        if (filtered) balconyRailGeom = filtered;
      }
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
  const [unitsGeojson, setUnitsGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [terraceGeojson, setTerraceGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [streetGlassGeojson, setStreetGlassGeojson] = useState<GeoJSON.FeatureCollection>(emptyFeatureCollection);
  const [balconyFeatures, setBalconyFeatures] = useState<GeoJSON.FeatureCollection | null>(BALCONY_FALLBACK);
  const [terraceFeatures, setTerraceFeatures] = useState<GeoJSON.FeatureCollection | null>(TERRACE_FALLBACK);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("units") as GeoJSONSource | undefined;
    if (!source) return;

    let unitsSourceData: GeoJSON.FeatureCollection;
    if (externalUnits && externalUnits.type === "FeatureCollection") {
      unitsSourceData = makeExternalUnitsFeatureCollection(externalUnits, unitsTransform);
    } else {
      unitsSourceData = makeUnitsFeatureCollection(
        (Array.isArray(footprint) ? (footprint as any) : [center]) as any,
        units
      ) as any;
    }
    source.setData(unitsSourceData as any);
    setUnitsGeojson(unitsSourceData as GeoJSON.FeatureCollection);
  }, [ready, externalUnits, unitsTransform, useRawUnits, units, footprint, center]);

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
    setTerraceGeojson(data as GeoJSON.FeatureCollection);
  }, [terraceFeatures, unitsTransform, useRawUnits, ready]);

  useEffect(() => {
    if (!unitsGeojson || !terraceGeojson) {
      setStreetGlassGeojson(emptyFeatureCollection);
      return;
    }
    const glass = makeStreetGlassFeatureCollection(unitsGeojson, terraceGeojson);
    setStreetGlassGeojson(glass);
  }, [unitsGeojson, terraceGeojson]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("street-glass") as GeoJSONSource | undefined;
    if (!source) return;
    source.setData(streetGlassGeojson as any);
  }, [streetGlassGeojson, ready]);
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
        pitch: 58,
        bearing: 32,
        antialias: true,
        cooperativeGestures: true,
      });
        mapRef.current = map;
        try { (window as any).__debugMap = map; } catch {}

        // Controls: rotate with LMB (bearing + pitch). We disable default dragRotate to avoid conflicts.
        try {
          map.dragRotate.disable();
        } catch {}
        try {
          // If it was enabled somewhere else, keep it off.
          map.touchZoomRotate.disableRotation();
        } catch {}

        try {
          const canvas = map.getCanvas();
          let rotating = false;
          let suppressContextMenuUntil = 0;
          let startX = 0;
          let startY = 0;
          let startBearing = 0;
          let startPitch = 0;

          const onDown = (e: PointerEvent) => {
            // RMB only: avoids accidental apartment clicks while rotating
            if (e.button !== 2) return;
            rotating = true;
            suppressContextMenuUntil = (typeof performance !== "undefined" ? performance.now() : Date.now()) + 800;
            startX = e.clientX;
            startY = e.clientY;
            startBearing = map.getBearing();
            startPitch = map.getPitch();
            try { map.dragPan.disable(); } catch {}
            try { canvas.setPointerCapture(e.pointerId); } catch {}
            try { e.preventDefault(); } catch {}
          };

          const onMove = (e: PointerEvent) => {
            if (!rotating) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const bearing = startBearing + dx * 0.25;
            const pitch = Math.max(15, Math.min(80, startPitch - dy * 0.15));
            try {
              map.setBearing(bearing);
              map.setPitch(pitch);
            } catch {}
            try { e.preventDefault(); } catch {}
          };

          const onUp = (e: PointerEvent) => {
            if (!rotating) return;
            rotating = false;
            try { map.dragPan.enable(); } catch {}
            try { canvas.releasePointerCapture(e.pointerId); } catch {}
            try { e.preventDefault(); } catch {}
          };

          const onContextMenu = (e: MouseEvent) => {
            // When using RMB-drag for rotate, suppress the browser context menu.
            const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
            if (rotating || now < suppressContextMenuUntil) {
              try { e.preventDefault(); } catch {}
              return;
            }
            // Also suppress context menu on the map canvas in general, since RMB is reserved for camera controls.
            try { e.preventDefault(); } catch {}
          };

          canvas.addEventListener("pointerdown", onDown, { passive: false });
          canvas.addEventListener("pointermove", onMove, { passive: false });
          canvas.addEventListener("pointerup", onUp, { passive: false });
          canvas.addEventListener("pointercancel", onUp, { passive: false });
          canvas.addEventListener("contextmenu", onContextMenu, { passive: false });

          // Cleanup on map remove
          map.once("remove", () => {
            try { canvas.removeEventListener("pointerdown", onDown as any); } catch {}
            try { canvas.removeEventListener("pointermove", onMove as any); } catch {}
            try { canvas.removeEventListener("pointerup", onUp as any); } catch {}
            try { canvas.removeEventListener("pointercancel", onUp as any); } catch {}
            try { canvas.removeEventListener("contextmenu", onContextMenu as any); } catch {}
          });
        } catch {}

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
          setUnitsGeojson(unitsSourceData as GeoJSON.FeatureCollection);
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
          setTerraceGeojson(makeOutdoorFeatureCollection(terraceFeatures, unitsTransform, { useRaw: useRawUnits, mode: "terrace" }));
          map.addSource("street-glass", { type: "geojson", data: streetGlassGeojson });
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
            id: "street-glass-fill",
            type: "fill-extrusion",
            source: "street-glass",
            filter: ["==", ["get", "kind"], "street-glass"],
            paint: {
              "fill-extrusion-color": FACADE_GLASS_COLOR,
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": FACADE_GLASS_OPACITY,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "street-glass-cross-vertical-fill",
            type: "fill-extrusion",
            source: "street-glass",
            filter: ["==", ["get", "kind"], "street-glass-cross-vertical"],
            paint: {
              "fill-extrusion-color": BUILDING_BASE_COLOR,
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 1,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "street-glass-cross-horizontal-fill",
            type: "fill-extrusion",
            source: "street-glass",
            filter: ["==", ["get", "kind"], "street-glass-cross-horizontal"],
            paint: {
              "fill-extrusion-color": BUILDING_BASE_COLOR,
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 1,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "street-glass-beam-fill",
            type: "fill-extrusion",
            source: "street-glass",
            filter: ["==", ["get", "kind"], "street-glass-beam"],
            paint: {
              "fill-extrusion-color": BUILDING_BASE_COLOR,
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 1,
              "fill-extrusion-vertical-gradient": false
            }
          });
          map.addLayer({
            id: "street-glass-top-beam-fill",
            type: "fill-extrusion",
            source: "street-glass",
            filter: ["==", ["get", "kind"], "street-glass-top-beam"],
            paint: {
              "fill-extrusion-color": BUILDING_BASE_COLOR,
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 1,
              "fill-extrusion-vertical-gradient": false
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

          try {
            const quad = Array.isArray(footprint) && footprint.length >= 4 ? (footprint as [number, number][]) : null;
            if (quad && quad.length >= 4) {
              const PLANT_LAYER_ID = "plants-3d";
              if (!map.getLayer(PLANT_LAYER_ID)) {
                const plantAnchors: Array<{ uv: [number, number]; floor: number; heightOffsetM?: number; scaleM?: number; rotY?: number }> = [
                  { uv: [0.74, 0.33], floor: 4, heightOffsetM: 1.1, scaleM: 0.9, rotY: 0.6 },
                  { uv: [0.78, 0.40], floor: 4, heightOffsetM: 1.1, scaleM: 0.85, rotY: 0.6 },
                  { uv: [0.62, 0.44], floor: 4, heightOffsetM: 1.1, scaleM: 0.9, rotY: 0.2 },
                  { uv: [0.70, 0.56], floor: 5, heightOffsetM: 1.1, scaleM: 0.75, rotY: 0.8 },
                  { uv: [0.84, 0.60], floor: 5, heightOffsetM: 1.1, scaleM: 0.75, rotY: 0.9 },
                ];

                const SHOW_PLANTS = false;
                const SHOW_DEBUG_PLASTER_CUBE = false;

                const layer: any = {
                  id: PLANT_LAYER_ID,
                  type: "custom",
                  renderingMode: "3d",
                  onAdd: (mapInstance: any, gl: WebGLRenderingContext) => {
                    const camera = new THREE.Camera();
                    const scene = new THREE.Scene();
                    const renderer = new THREE.WebGLRenderer({
                      canvas: mapInstance.getCanvas(),
                      context: gl as any,
                      antialias: true,
                      alpha: true,
                    });
                    renderer.autoClear = false;

                    renderer.toneMapping = THREE.ACESFilmicToneMapping;
                    renderer.toneMappingExposure = 1.15;
                    renderer.outputColorSpace = THREE.SRGBColorSpace;
                    (renderer as any).physicallyCorrectLights = true;

                    try {
                      const pmrem = new THREE.PMREMGenerator(renderer);
                      pmrem.compileEquirectangularShader();
                      const exrLoader = new EXRLoader();
                      exrLoader.load(
                        "/texture/docklands_01_2k.exr",
                        (tex) => {
                          try {
                            tex.colorSpace = THREE.LinearSRGBColorSpace;
                          } catch {}
                          const env = pmrem.fromEquirectangular(tex).texture;
                          scene.environment = env;
                          try {
                            tex.dispose();
                          } catch {}
                          try {
                            pmrem.dispose();
                          } catch {}
                          mapInstance.triggerRepaint();
                        },
                        undefined,
                        () => {
                          try { pmrem.dispose(); } catch {}
                        }
                      );
                    } catch {}

                    const ambient = new THREE.AmbientLight(0xffffff, 0.75);
                    scene.add(ambient);
                    const sun = new THREE.DirectionalLight(0xffffff, 0.85);
                    sun.position.set(20, 40, 20);
                    scene.add(sun);

                    try {
                      const c0 = { lng: center[0], lat: center[1] };
                      if (c0 && Number.isFinite(c0.lng) && Number.isFinite(c0.lat)) {
                        const mc0 = (mapboxgl as any).MercatorCoordinate.fromLngLat({ lng: c0.lng, lat: c0.lat }, 0);
                        (layer as any)._originMc = mc0;
                        const metersToMercator0 = mc0.meterInMercatorCoordinateUnits();

                        const s = metersToMercator0 * 6;
                        const rX = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

                        if (SHOW_DEBUG_PLASTER_CUBE) try {
                          const plasterLoader = new THREE.TextureLoader();
                          const applyTexSettings = (tex: THREE.Texture, isColor: boolean) => {
                            try {
                              tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
                            } catch {}
                            tex.wrapS = THREE.RepeatWrapping;
                            tex.wrapT = THREE.RepeatWrapping;
                            tex.repeat.set(1.6, 1.6);
                            tex.anisotropy = 4;
                          };

                          const baseColor = plasterLoader.load(
                            "/texture/plaster/2K-plasteR_8-diffuse.png",
                            (t) => applyTexSettings(t, true)
                          );
                          const normal = plasterLoader.load(
                            "/texture/plaster/2K-plasteR_8-normal.jpg",
                            (t) => applyTexSettings(t, false)
                          );
                          const displacement = plasterLoader.load(
                            "/texture/plaster/2K-plasteR_8-displacement.jpg",
                            (t) => applyTexSettings(t, false)
                          );
                          const specular = plasterLoader.load(
                            "/texture/plaster/2K-plasteR_8-specular.png",
                            (t) => applyTexSettings(t, false)
                          );

                          applyTexSettings(baseColor, true);
                          applyTexSettings(normal, false);
                          applyTexSettings(displacement, false);
                          applyTexSettings(specular, false);

                          const plasterMat = new THREE.MeshPhysicalMaterial({
                            map: baseColor,
                            normalMap: normal,
                            displacementMap: displacement,
                            displacementScale: 0.08,
                            roughness: 0.95,
                            metalness: 0.0,
                            specularIntensity: 0.2,
                            specularIntensityMap: specular,
                          });
                          plasterMat.side = THREE.DoubleSide;
                          plasterMat.depthTest = false;
                          plasterMat.depthWrite = false;
                          try {
                            (plasterMat as any).normalScale?.set?.(1.2, 1.2);
                          } catch {}

                          const plasterCube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1, 40, 40, 40), plasterMat);
                          plasterCube.frustumCulled = false;
                          plasterCube.renderOrder = 1000;
                          plasterCube.matrixAutoUpdate = false;

                          const metersToMercatorUnit = metersToMercator0;
                          const t2 = new THREE.Matrix4().makeTranslation(
                            8 * metersToMercatorUnit,
                            2 * metersToMercatorUnit,
                            25 * metersToMercatorUnit
                          );
                          const sc2 = new THREE.Matrix4().makeScale(s, s, s);
                          plasterCube.matrix = t2.multiply(rX).multiply(sc2);
                          scene.add(plasterCube);
                          mapInstance.triggerRepaint();
                        } catch {}
                      }
                    } catch {}

                    if (SHOW_PLANTS) {
                      const loader = new GLTFLoader();

                      loader.load(
                        "/texture/small_tree.glb",
                        (gltf: any) => {
                          const base = gltf.scene;
                          try {
                            if (!(base as any).userData?._dbgLogged) {
                              (base as any).userData = (base as any).userData || {};
                              (base as any).userData._dbgLogged = true;
                              const meshes: any[] = [];
                              base.traverse((o: any) => {
                                if (o && o.isMesh) {
                                  meshes.push({ name: o.name, mat: o.material, geo: o.geometry });
                                }
                              });
                              console.info(
                                "MapboxScene plants: GLB loaded meshes=",
                                meshes.map((m) => ({
                                  name: m.name,
                                  geoType: m.geo?.type,
                                  hasPos: !!m.geo?.attributes?.position,
                                  matType: Array.isArray(m.mat) ? m.mat.map((x: any) => x?.type) : m.mat?.type,
                                  matName: Array.isArray(m.mat) ? m.mat.map((x: any) => x?.name) : m.mat?.name,
                                }))
                              );
                            }
                          } catch {}

                          base.traverse((obj: any) => {
                            if (!obj || !obj.isMesh) return;
                            obj.castShadow = false;
                            obj.receiveShadow = false;
                            obj.frustumCulled = false;
                            obj.renderOrder = 10;

                            const materials = Array.isArray(obj.material) ? obj.material : [obj.material].filter(Boolean);
                            materials.forEach((mat: any) => {
                              if (!mat) return;
                              mat.transparent = mat.transparent ?? false;
                              mat.side = THREE.DoubleSide;

                              const hasAlphaTexture =
                                !!mat.alphaMap ||
                                (typeof mat.alphaTest === "number" && mat.alphaTest > 0) ||
                                mat.transparent === true ||
                                (typeof mat.opacity === "number" && mat.opacity < 1);

                              if (hasAlphaTexture) {
                                mat.alphaTest = 0;
                                mat.transparent = true;
                                mat.depthWrite = false;
                                mat.depthTest = false;
                                if (mat.map) {
                                  try {
                                    mat.map.generateMipmaps = false;
                                    mat.map.minFilter = THREE.LinearFilter;
                                    mat.map.magFilter = THREE.LinearFilter;
                                    mat.map.needsUpdate = true;
                                  } catch {}
                                }
                              } else {
                                mat.alphaTest = 0;
                                mat.transparent = false;
                                mat.depthWrite = true;
                                mat.depthTest = true;
                                try {
                                  if (mat.emissive && typeof mat.emissive.setHex === "function") {
                                    mat.emissive.setHex(0x222222);
                                    mat.emissiveIntensity = Math.max(mat.emissiveIntensity ?? 0, 0.35);
                                  }
                                } catch {}
                              }

                              mat.needsUpdate = true;
                            });
                          });

                          const createInstance = (anchor: typeof plantAnchors[number]) => {
                            const ll = uvToLngLat(anchor.uv, quad);
                            const baseH = (anchor.floor - 1) * FLOOR_HEIGHT_M;
                            const height = baseH + (anchor.heightOffsetM ?? 0);
                            const mc = (mapboxgl as any).MercatorCoordinate.fromLngLat({ lng: ll[0], lat: ll[1] }, height);
                            const originMc = (layer as any)._originMc as any;
                            const ox = originMc?.x ?? 0;
                            const oy = originMc?.y ?? 0;
                            const oz = originMc?.z ?? 0;
                            const metersToMercator = mc.meterInMercatorCoordinateUnits();

                            const inst = base.clone(true);
                            const scaleM = anchor.scaleM ?? 1;
                            const s = metersToMercator * scaleM;
                            inst.matrixAutoUpdate = false;
                            const t = new THREE.Matrix4().makeTranslation(mc.x - ox, mc.y - oy, mc.z - oz);
                            const rX = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
                            const rY = new THREE.Matrix4().makeRotationY(anchor.rotY ?? 0);
                            const sc = new THREE.Matrix4().makeScale(s, -s, s);
                            inst.matrix = t.multiply(rX).multiply(rY).multiply(sc);
                            scene.add(inst);
                          };

                          plantAnchors.forEach(createInstance);
                          mapInstance.triggerRepaint();
                        },
                        undefined,
                        () => {
                          try { console.warn("MapboxScene: failed to load /texture/small_tree.glb"); } catch {}
                        }
                      );
                    }

                    (layer as any)._three = { camera, scene, renderer };
                  },
                  render: (gl: WebGLRenderingContext, matrix: number[]) => {
                    const three = (layer as any)._three;
                    if (!three) return;
                    const { camera, scene, renderer } = three as { camera: THREE.Camera; scene: THREE.Scene; renderer: THREE.WebGLRenderer };

                    const mapM = new THREE.Matrix4().fromArray(matrix);
                    const originMc = (layer as any)._originMc as any;
                    const originT = new THREE.Matrix4().makeTranslation(originMc?.x ?? 0, originMc?.y ?? 0, originMc?.z ?? 0);
                    camera.matrixAutoUpdate = false;
                    camera.matrixWorld.identity();
                    camera.matrixWorldInverse.identity();
                    camera.projectionMatrix.copy(mapM.multiply(originT));
                    try {
                      (camera as any).projectionMatrixInverse?.copy?.(camera.projectionMatrix)?.invert?.();
                    } catch {}
                    try {
                      (renderer as any).state?.reset?.();
                    } catch {}
                    renderer.setRenderTarget(null);
                    try {
                      const glc = gl;
                      // Explicit viewport: prevents deformation when Mapbox changes the drawing buffer.
                      renderer.setViewport(0, 0, glc.drawingBufferWidth, glc.drawingBufferHeight);
                      renderer.setScissorTest(false);

                      glc.viewport(0, 0, glc.drawingBufferWidth, glc.drawingBufferHeight);
                      // Mapbox heavily uses stencil/scissor; make sure those don't interfere with Three.
                      glc.disable(glc.STENCIL_TEST);
                      glc.disable(glc.SCISSOR_TEST);
                      glc.disable(glc.CULL_FACE);
                      glc.enable(glc.DEPTH_TEST);
                      glc.depthFunc(glc.LEQUAL);
                      glc.depthMask(true);
                      glc.clearDepth(1);
                      glc.clear(glc.DEPTH_BUFFER_BIT);
                    } catch {}
                    renderer.render(scene, camera);
                  },
                };
                if (SHOW_PLANTS) {
                  map.addLayer(layer);
                }
              }
            }
          } catch {}

          // Center and zoom closer to the building so facade is visible
          try {
            map.easeTo({ center: center as LngLatLike, zoom: 18.9, pitch: 62, bearing: 28, duration: 900, essential: true });
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

function clipRingByAxisThreshold(
  ring: number[][],
  center: [number, number],
  axis: [number, number],
  threshold: number,
  keepGreater: boolean
): [number, number][] | null {
  if (!Array.isArray(ring) || ring.length < 4) return null;
  const project = (pt: number[]) => {
    const relX = pt[0] - center[0];
    const relY = pt[1] - center[1];
    return relX * axis[0] + relY * axis[1];
  };

  const isInside = (proj: number) => (keepGreater ? proj >= threshold : proj <= threshold);
  const closed = ensureClosedRing(ring as [number, number][]);
  const output: [number, number][] = [];
  for (let i = 0; i < closed.length; i++) {
    const current = closed[i];
    const prev = closed[(i + closed.length - 1) % closed.length];
    const currentProj = project(current);
    const prevProj = project(prev);
    const currentInside = isInside(currentProj);
    const prevInside = isInside(prevProj);
    if (currentInside !== prevInside) {
      const denom = currentProj - prevProj;
      if (Math.abs(denom) > 1e-9) {
        const t = (threshold - prevProj) / denom;
        const intersect: [number, number] = [
          prev[0] + (current[0] - prev[0]) * t,
          prev[1] + (current[1] - prev[1]) * t,
        ];
        output.push(intersect);
      }
    }
    if (currentInside) output.push(current as [number, number]);
  }
  return output.length >= 4 ? ensureClosedRing(output) : null;
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