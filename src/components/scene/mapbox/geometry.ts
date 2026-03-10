import type * as GeoJSON from "geojson";
import type { AxisBasis, UnitsTransform } from "./types";
import { BALCONY_POST_MIN_SIZE, BALCONY_POST_SIZE_FACTOR, FLOOR_HEIGHT_M } from "./constants";

// Scale polygon (lng,lat points) from centroid by factor (positive = outward)
export function scalePolygon(pts: [number, number][], factor: number) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map((p) => {
    return [cx + (p[0] - cx) * (1 + factor), cy + (p[1] - cy) * (1 + factor)] as [number, number];
  });
}

export function ensureClosedRing(ring: [number, number][]): [number, number][] {
  if (!ring.length) return ring;
  const closed = [...ring];
  const first = closed[0];
  const last = closed[closed.length - 1];
  if (last[0] !== first[0] || last[1] !== first[1]) {
    closed.push([first[0], first[1]]);
  }
  return closed;
}

export function clipRingByAxisThreshold(
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

export function normalizeRing(ring: number[][]): [number, number][] | null {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  return ring.map((pt) => [Number(pt[0]), Number(pt[1])] as [number, number]);
}

export function createRailGeometry(geometry: any, insetScale: number): GeoJSON.MultiPolygon | null {
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

export function filterRailGeometryToOuter(
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

export function determineOuterSign(
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

export function polygonArea(points: [number, number][]): number {
  if (!points.length) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i][0] * points[j][1] - points[j][0] * points[i][1];
  }
  return area / 2;
}

export function getPrimaryRing(geometry: any): [number, number][] | null {
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

export function estimatePostSize(points: [number, number][], minSize = BALCONY_POST_MIN_SIZE): number {
  if (!points.length) return minSize;
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
  const size = Math.max(span * BALCONY_POST_SIZE_FACTOR, minSize);
  return size || minSize;
}

export function distance(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function movePointTowards(
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

export function createPostPolygon(
  center: [number, number],
  size: number,
  minSize = BALCONY_POST_MIN_SIZE
): [number, number][] | null {
  if (!center) return null;
  const half = Math.max(size / 2, minSize);
  const ring: [number, number][] = [
    [center[0] - half, center[1] - half],
    [center[0] + half, center[1] - half],
    [center[0] + half, center[1] + half],
    [center[0] - half, center[1] + half],
  ];
  return ensureClosedRing(ring);
}

export function normalizeVector(v: [number, number]): [number, number] {
  const len = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / len, v[1] / len];
}

export function filterCornerPoints(points: [number, number][]): [number, number][] {
  if (points.length <= 4) return points;
  const corners: [number, number][] = [];
  const len = points.length;
  const maxCorners = Math.min(12, len);
  const maxDot = Math.cos((15 * Math.PI) / 180); // require > ~15° turn (even sharper)
  const minDist = estimatePostSize(points) * 1.5; // increase minimum distance between corners

  const addIfFar = (pt: [number, number]) => {
    const farEnough = corners.every((existing) => distance(existing, pt) > minDist);
    if (farEnough) corners.push(pt);
  };

  for (let i = 0; i < len && corners.length < maxCorners; i++) {
    const prev = points[(i - 1 + len) % len];
    const curr = points[i];
    const next = points[(i + 1) % len];
    const v1 = normalizeVector([curr[0] - prev[0], curr[1] - prev[1]]);
    const v2 = normalizeVector([next[0] - curr[0], next[1] - curr[1]]);
    const dot = v1[0] * v2[0] + v1[1] * v2[1];
    if (!Number.isFinite(dot) || dot >= maxDot) continue;
    addIfFar(curr);
  }

  if (!corners.length) {
    // fallback: take every nth vertex
    for (let i = 0; i < len; i += Math.ceil(len / 4)) {
      corners.push(points[i]);
    }
  }
  return corners.slice(0, 12);
}

function transformPointUsingBasis(pt: [number, number], basis: AxisBasis): [number, number] {
  const rel: [number, number] = [pt[0] - basis.center[0], pt[1] - basis.center[1]];
  const x = rel[0] * basis.axes[0][0] + rel[1] * basis.axes[0][1];
  const y = rel[0] * basis.axes[1][0] + rel[1] * basis.axes[1][1];
  return [x / (basis.spreads[0] || 1), y / (basis.spreads[1] || 1)];
}

export function mapPointUsingBasis(pt: [number, number], transform: UnitsTransform): [number, number] {
  const inSource = transformPointUsingBasis(pt, transform.source);
  const scaled: [number, number] = [inSource[0] * transform.scales[0], inSource[1] * transform.scales[1]];
  const mapped: [number, number] = [
    scaled[0] * transform.target.spreads[0],
    scaled[1] * transform.target.spreads[1],
  ];
  const p: [number, number] = [
    mapped[0] * transform.target.axes[0][0] + mapped[1] * transform.target.axes[1][0],
    mapped[0] * transform.target.axes[0][1] + mapped[1] * transform.target.axes[1][1],
  ];
  return [p[0] + transform.target.center[0], p[1] + transform.target.center[1]];
}

export function transformGeometry(geometry: any, transform: UnitsTransform | null): any {
  if (!geometry || !transform) return geometry;
  const apply = (pt: number[]): [number, number] => {
    const mapped = mapPointUsingBasis([pt[0], pt[1]], transform);
    return [mapped[0], mapped[1]];
  };
  if (geometry.type === "Polygon") {
    return {
      ...geometry,
      coordinates: (geometry.coordinates as number[][][]).map((ring) => ring.map(apply)),
    };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: (geometry.coordinates as number[][][][]).map((poly) => poly.map((ring) => ring.map(apply))),
    };
  }
  return geometry;
}

export function makeFacadeFeatureCollection(quad: [number, number][], floors: number) {
  const features: GeoJSON.Feature[] = [];
  // base facade: one band per floor
  for (let f = 1; f <= floors; f++) {
    const band = scalePolygon(quad, 0); // same footprint
    const min_h = (f - 1) * FLOOR_HEIGHT_M + 0.005;
    const h = f * FLOOR_HEIGHT_M - 0.005;
    features.push({
      type: "Feature",
      properties: { floor: f, min_height: min_h, height: h, type: "facade" },
      geometry: { type: "Polygon", coordinates: [band.concat([band[0]])] },
    } as any);
  }

  // balconies: slightly expanded footprint, thinner slab at floor top
  const balconyPoly = scalePolygon(quad, 0.03);
  for (let f = 1; f <= floors; f++) {
    const slabTop = f * FLOOR_HEIGHT_M - 0.02;
    const slabBase = slabTop - 0.18; // balcony thickness ~0.18m
    features.push({
      type: "Feature",
      properties: { floor: f, min_height: slabBase, height: slabTop, type: "balcony" },
      geometry: { type: "Polygon", coordinates: [balconyPoly.concat([balconyPoly[0]])] },
    } as any);
  }

  // glass panels: inset smaller polygon to simulate windows
  const glassPoly = scalePolygon(quad, -0.06);
  for (let f = 1; f <= floors; f++) {
    const min_h = (f - 1) * FLOOR_HEIGHT_M + 0.15;
    const h = f * FLOOR_HEIGHT_M - 0.15;
    features.push({
      type: "Feature",
      properties: { floor: f, min_height: min_h, height: h, type: "glass" },
      geometry: { type: "Polygon", coordinates: [glassPoly.concat([glassPoly[0]])] },
    } as any);
  }

  return { type: "FeatureCollection", features } as GeoJSON.FeatureCollection;
}
