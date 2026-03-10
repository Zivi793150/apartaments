import type * as GeoJSON from "geojson";

export function computeFeatureCollectionBounds(fc: GeoJSON.FeatureCollection | null) {
  if (!fc) return null;
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  const visit = (coords: any) => {
    if (typeof coords?.[0] === "number" && typeof coords?.[1] === "number") {
      if (!Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return;
      minLng = Math.min(minLng, coords[0]);
      minLat = Math.min(minLat, coords[1]);
      maxLng = Math.max(maxLng, coords[0]);
      maxLat = Math.max(maxLat, coords[1]);
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

export function offsetGeometry(geometry: any, offset: [number, number] | null): any {
  if (!geometry || !offset) return geometry;
  const shiftPoint = (pt: number[]): [number, number] => [pt[0] + offset[0], pt[1] + offset[1]];

  if (geometry.type === "Polygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring: number[][]) => ring.map(shiftPoint)),
    };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((poly: number[][][]) => poly.map((ring: number[][]) => ring.map(shiftPoint))),
    };
  }
  return geometry;
}

export function collectGeometryPoints(geometry: any): [number, number][] {
  const points: [number, number][] = [];
  const visit = (coords: any) => {
    if (Array.isArray(coords) && typeof coords[0] === "number" && typeof coords[1] === "number") {
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

export function scaleGeometry(geometry: any, factor: number, center: [number, number]) {
  if (!geometry || !factor) return geometry;
  const scalePoint = (pt: number[]): [number, number] => {
    const scaled: [number, number] = [
      center[0] + (pt[0] - center[0]) * (1 + factor),
      center[1] + (pt[1] - center[1]) * (1 + factor),
    ];
    if (!Number.isFinite(scaled[0]) || !Number.isFinite(scaled[1])) return [pt[0], pt[1]];
    return scaled;
  };
  if (geometry.type === "Polygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring: number[][]) => ring.map(scalePoint)),
    };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((poly: number[][][]) => poly.map((ring: number[][]) => ring.map(scalePoint))),
    };
  }
  return geometry;
}

export function scaleGeometryFromCenter(geometry: any, factor: number, center: [number, number] | null): any {
  if (!geometry || !factor || !center) return geometry;
  return scaleGeometry(geometry, factor, center);
}
