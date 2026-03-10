import type * as GeoJSON from "geojson";
import type { Unit } from "./types";
import { TOTAL_FLOORS } from "./constants";

export async function loadUnitsFromGeojson(): Promise<Unit[]> {
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
          const props = feat.properties || {};
          units.push({
            id: props.id || `${f}-${units.length + 1}`,
            floor: f,
            status: props.status || "available",
            area: props.area || 40,
            rooms: props.rooms || 2,
            polyUV:
              feat.geometry?.coordinates?.[0]?.map((p: number[]) => [p[0], p[1]]) ||
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
              ],
          });
        }
      }
    } catch {}
  }
  return units;
}

export async function loadFloorFeatureCollection(): Promise<GeoJSON.FeatureCollection | null> {
  const floors = Array.from({ length: TOTAL_FLOORS }, (_, i) => i + 1);
  const features: GeoJSON.Feature[] = [];
  for (const f of floors) {
    try {
      const fileName = `floor${f}.geojson`;
      const res = await fetch(`/plans/geojson/${fileName}`, { cache: "no-store" });
      if (!res.ok) continue;
      const geojson = await res.json();
      if (geojson && Array.isArray(geojson.features)) {
        try {
          console.info(`MapboxScene: loaded ${fileName} with ${geojson.features.length} features`);
        } catch {}
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
  return features.length ? ({ type: "FeatureCollection", features } as GeoJSON.FeatureCollection) : null;
}

// Biliinear mapping from UV to lng/lat on a quad
export function uvToLngLat(uv: [number, number], quad: [number, number][]) {
  const [u, v] = uv;
  const [A, B, C, D] = quad;
  const lerp = (p: number[], q: number[], t: number) =>
    [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t] as [number, number];
  const E = lerp(A, D, v);
  const F = lerp(B, C, v);
  return lerp(E, F, u) as [number, number];
}

export function sanitizeStyleExpression(expr: any): any {
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
    polys?.forEach((poly) => poly.forEach(pushRing));
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

export function deriveFootprintFromUnits(collection: GeoJSON.FeatureCollection | null): [number, number][] | null {
  if (!collection || !Array.isArray(collection.features)) return null;
  const pts: [number, number][] = [];
  for (const feature of collection.features) {
    pts.push(...collectFeaturePoints(feature as GeoJSON.Feature));
  }
  if (!pts.length) return null;
  const hull = convexHull(pts);
  return hull.length >= 3 ? hull : null;
}
