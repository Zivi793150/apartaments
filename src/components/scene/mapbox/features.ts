import type * as GeoJSON from "geojson";
import type { Unit, UnitsTransform, BalconyProperties } from "./types";
import {
  FLOOR_HEIGHT_M,
  FLOOR_SCALE_OVERRIDES,
  FLOOR5_LEFT_PANORAMA_BAND,
  FLOOR5_FRONT_RIGHT_BAND,
  FLOOR5_PERP_WINDOW_BAND,
  FLOOR5_FRONT_ASPECT_RATIO,
  FLOOR5_EDGE_BLEND,
  FLOOR5_RELAXED_FACING_COS,
  FLOOR5_SIDE_WINDOW_BAND,
  FLOOR5_FRONT_ALIGNMENT,
  FLOOR5_SIDE_ALIGNMENT,
  STREET_GLASS_TARGET_FLOORS,
  STREET_WALL_STRIP_SCALE,
  STREET_BEAM_SIZE_FACTOR,
  STREET_BEAM_MIN_SIZE,
  STREET_TOP_BEAM_HEIGHT,
  STREET_TOP_BEAM_THICKNESS_FACTOR,
  STREET_CROSS_DEPTH_FACTOR,
  STREET_CROSS_WIDTH_FACTOR,
  STREET_CROSS_WINDOW_INSET_FACTOR,
  STREET_CROSS_DEPTH_CLEARANCE_FACTOR,
  STREET_CROSS_HALF_HEIGHT,
  STREET_CORNER_BEAM_WIDTH_FACTOR,
  STREET_CORNER_BEAM_DEPTH_FACTOR,
  UNITS_OUTLINE_OUTSET,
  TERRACE_FLOOR_THICKNESS,
  TERRACE_RAIL_HEIGHT,
  TERRACE_RAIL_SCALE,
  BALCONY_FLOOR_THICKNESS,
  BALCONY_RAIL_HEIGHT,
  BALCONY_RAIL_SCALE,
  BALCONY_POST_MIN_SIZE,
  UNITS_OUTLINE_VERT_POST_MIN_SIZE,
  UNITS_OUTLINE_VERT_POST_MULT,
  UNITS_OUTLINE_VERT_INSET_MULT,
  emptyFeatureCollection,
} from "./constants";
import {
  createRailGeometry,
  ensureClosedRing,
  getPrimaryRing,
  estimatePostSize,
  filterCornerPoints,
  distance,
  movePointTowards,
  createPostPolygon,
  normalizeVector,
  transformGeometry,
  determineOuterSign,
} from "./geometry";
import { collectGeometryPoints, scaleGeometryFromCenter } from "./geojson";
import { computeAxisBasis } from "./unitsTransform";

function centroidOfPolygon(points: [number, number][]): [number, number] {
  if (!points.length) return [0, 0];
  const sum = points.reduce<[number, number]>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
  return [sum[0] / points.length, sum[1] / points.length];
}

function scaleGeometry(geometry: any, factor: number): any {
  if (!geometry || !factor) return geometry;
  const pts = collectGeometryPoints(geometry);
  if (!pts.length) return geometry;
  const center = centroidOfPolygon(pts);
  return scaleGeometryFromCenter(geometry, factor, center);
}

export function makeOutlineFeatureCollection(fc: GeoJSON.FeatureCollection, scaleFactor: number): GeoJSON.FeatureCollection {
  const features = (fc.features || [])
    .map((f: any, idx: number) => {
      const copy = { ...f } as any;
      const props = { ...(copy.properties || {}) } as any;
      const floor = Number(isFinite(props.floor) ? props.floor : 1);
      void floor;
      const baseId = typeof copy.id !== "undefined" ? String(copy.id) : `outline-${idx}`;
      const outsetGeom = scaleGeometry(copy.geometry, UNITS_OUTLINE_OUTSET);
      const stripGeom = createRailGeometry(outsetGeom, scaleFactor);
      if (!stripGeom) return null;
      return {
        type: "Feature",
        id: `${baseId}-outline`,
        properties: props,
        geometry: stripGeom as any,
      } as GeoJSON.Feature;
    })
    .filter(Boolean);
  return { type: "FeatureCollection", features } as GeoJSON.FeatureCollection;
}

export function filterFeatureCollection(
  fc: GeoJSON.FeatureCollection,
  predicate: (feature: GeoJSON.Feature) => boolean
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: (fc.features || []).filter((feature) => {
      try {
        return predicate(feature);
      } catch {
        return false;
      }
    }),
  } as GeoJSON.FeatureCollection;
}

export function openRing(ring: [number, number][]): [number, number][] {
  if (!Array.isArray(ring) || !ring.length) return [];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && first[0] === last[0] && first[1] === last[1]) {
    return ring.slice(0, ring.length - 1);
  }
  return ring;
}

export function makeVerticalOutlineFeatureCollection(fc: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  (fc.features || []).forEach((f: any, idx: number) => {
    const props = f.properties || {};
    const floor = Number(props.floor);

    const geom = f?.geometry;
    const ring = getPrimaryRing(geom);
    if (!ring || ring.length < 4) return;

    const ringVertices = openRing(ring);
    if (!ringVertices.length) return;

    const center = centroidOfPolygon(ringVertices);
    const postSize = Math.max(
      estimatePostSize(ringVertices, UNITS_OUTLINE_VERT_POST_MIN_SIZE) * UNITS_OUTLINE_VERT_POST_MULT,
      UNITS_OUTLINE_VERT_POST_MIN_SIZE
    );
    const insetDist = postSize * UNITS_OUTLINE_VERT_INSET_MULT;

    let cornerPoints: [number, number][] = [];
    if (floor === 6) {
      const base = ringVertices;
      const len = base.length;
      const maxCorners = Math.min(12, len);
      const maxDot = Math.cos((22 * Math.PI) / 180);
      const minDist = estimatePostSize(base) * 0.9;
      const minEdgeLen = postSize * 6;

      const candidates: { pt: [number, number]; dot: number }[] = [];
      for (let i = 0; i < len; i++) {
        const prev = base[(i - 1 + len) % len];
        const curr = base[i];
        const next = base[(i + 1) % len];
        const e1 = distance(prev, curr);
        const e2 = distance(curr, next);
        if (!(e1 > minEdgeLen && e2 > minEdgeLen)) continue;
        const v1 = normalizeVector([curr[0] - prev[0], curr[1] - prev[1]]);
        const v2 = normalizeVector([next[0] - curr[0], next[1] - curr[1]]);
        const dot = v1[0] * v2[0] + v1[1] * v2[1];
        if (!Number.isFinite(dot) || dot >= maxDot) continue;
        candidates.push({ pt: curr, dot });
      }
      candidates.sort((a, b) => a.dot - b.dot);

      const corners: [number, number][] = [];
      const addIfFar = (pt: [number, number]) => {
        const farEnough = corners.every((existing) => distance(existing, pt) > minDist);
        if (farEnough) corners.push(pt);
      };

      for (const c of candidates) {
        if (corners.length >= maxCorners) break;
        addIfFar(c.pt);
      }

      if (!corners.length) {
        for (let i = 0; i < len; i += Math.ceil(len / 4)) {
          corners.push(base[i]);
        }
      }
      cornerPoints = corners.slice(0, 12);
    } else if (floor === 1) {
      const base = ringVertices;
      const len = base.length;
      const maxCorners = Math.min(12, len);
      const maxDot = Math.cos((25 * Math.PI) / 180);
      const minDist = estimatePostSize(base) * 1.0;
      const minEdgeLen = postSize * 10;

      const candidates: { pt: [number, number]; dot: number }[] = [];
      for (let i = 0; i < len; i++) {
        const prev = base[(i - 1 + len) % len];
        const curr = base[i];
        const next = base[(i + 1) % len];
        const e1 = distance(prev, curr);
        const e2 = distance(curr, next);
        if (!(e1 > minEdgeLen && e2 > minEdgeLen)) continue;
        const v1 = normalizeVector([curr[0] - prev[0], curr[1] - prev[1]]);
        const v2 = normalizeVector([next[0] - curr[0], next[1] - curr[1]]);
        const dot = v1[0] * v2[0] + v1[1] * v2[1];
        if (!Number.isFinite(dot) || dot >= maxDot) continue;
        candidates.push({ pt: curr, dot });
      }
      candidates.sort((a, b) => a.dot - b.dot);

      const corners: [number, number][] = [];
      const addIfFar = (pt: [number, number]) => {
        const farEnough = corners.every((existing) => distance(existing, pt) > minDist);
        if (farEnough) corners.push(pt);
      };

      for (const c of candidates) {
        if (corners.length >= maxCorners) break;
        addIfFar(c.pt);
      }

      cornerPoints = corners.length ? corners.slice(0, 12) : filterCornerPoints(base);
    } else {
      cornerPoints = filterCornerPoints(ringVertices);
    }

    const baseId = typeof f.id !== "undefined" ? String(f.id) : `vert-outline-${idx}`;
    cornerPoints.forEach((pt, cornerIdx) => {
      const insetPoint = movePointTowards(pt, center, insetDist);
      const postPoly = createPostPolygon(insetPoint, postSize, UNITS_OUTLINE_VERT_POST_MIN_SIZE);

      if (!postPoly || postPoly.length < 4) return;
      features.push({
        type: "Feature",
        id: `${baseId}-v${cornerIdx}`,
        properties: { ...props },
        geometry: { type: "Polygon", coordinates: [postPoly] } as any,
      } as GeoJSON.Feature);
    });
  });
  return { type: "FeatureCollection", features } as GeoJSON.FeatureCollection;
}

export function makeExternalUnitsFeatureCollection(
  externalUnits: GeoJSON.FeatureCollection,
  unitsTransform: UnitsTransform | null,
  opts?: { useRaw?: boolean }
): GeoJSON.FeatureCollection {
  const features = externalUnits.features.map((f: any, idx: number) => {
    const copy = { ...f } as any;
    const props = { ...(copy.properties || {}) } as any;
    const floor = Number(isFinite(props.floor) ? props.floor : 1);
    const status = String(props.status || "available").toLowerCase();
    const statusMap: Record<string, Unit["status"]> = {
      available: "available",
      aviable: "available",
      free: "available",
      reserved: "reserved",
      booked: "reserved",
      sold: "sold",
      xz: "reserved",
    };
    props.status = statusMap[status] || "available";
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
    if (copy.geometry && copy.geometry.type === "MultiPolygon") {
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
  try {
    console.info("MapboxScene: using external units.geojson with", features.length, "features");
  } catch {}
  return { type: "FeatureCollection", features } as GeoJSON.FeatureCollection;
}

export function makeStreetGlassFeatureCollection(
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
    const baseMin = Number((refFeature.properties as any)?.min_height ?? (floor - 1) * FLOOR_HEIGHT_M + 0.02);
    const baseMax = Number((refFeature.properties as any)?.height ?? floor * FLOOR_HEIGHT_M - 0.02);
    const primaryRing = getPrimaryRing(refFeature.geometry as any);
    if (!primaryRing) return;

    const ringPoints = openRing(primaryRing);
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
        const dirVecRaw: [number, number] = [terraceCenter[0] - floorCenter[0], terraceCenter[1] - floorCenter[1]];
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

    const rectFromSD = (centerS: number, centerD: number, halfWidth: number, halfDepth: number): number[][] | null => {
      if (!(halfWidth > 0) || !(halfDepth > 0)) return null;
      const ring = ensureClosedRing([
        pointFromSD(centerS - halfWidth, centerD - halfDepth),
        pointFromSD(centerS + halfWidth, centerD - halfDepth),
        pointFromSD(centerS + halfWidth, centerD + halfDepth),
        pointFromSD(centerS - halfWidth, centerD + halfDepth),
      ]);
      return ring && ring.length >= 4 ? ring : null;
    };

    const streetGlassWallGeom =
      floor === 5 ? scaleGeometry(refFeature.geometry as any, UNITS_OUTLINE_OUTSET) : (refFeature.geometry as any);
    const shellGeom = createRailGeometry(streetGlassWallGeom as any, STREET_WALL_STRIP_SCALE);
    if (!shellGeom) return;

    const recordExtreme = (pts: [number, number][], projFunc: (pt: [number, number]) => number) => {
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
        const dot = rel[0] * dirVec[0] + rel[1] * dirVec[1];
        if (dot < 0.92) return;
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

      const withoutClose = ring
        .slice(0, -1)
        .map((pt: number[]) => [Number(pt[0]), Number(pt[1])] as [number, number]);

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
        const sum = pts.reduce<[number, number]>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
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
      const span = Math.max(spanBounds.maxX - spanBounds.minX, spanBounds.maxY - spanBounds.minY) || 0.00001;
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

            const ringPts = ring
              .slice(0, -1)
              .map((pt) => [Number(pt[0]), Number(pt[1])] as [number, number]);
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
                  geometry: { type: "Polygon", coordinates: [cornerRect] } as any,
                } as GeoJSON.Feature);
              }

              const topThickness = beamSize * STREET_TOP_BEAM_THICKNESS_FACTOR;
              const ringCenterLocal = centroidOfPolygon(ringPts);

              const pickWallAxis = (): [number, number] | null => {
                if (ringPts.length < 2) return null;
                let best: [number, number] | null = null;
                let bestLen = 0;
                for (let i = 0; i < ringPts.length; i++) {
                  const a = ringPts[i];
                  const b = ringPts[(i + 1) % ringPts.length];
                  const v: [number, number] = [b[0] - a[0], b[1] - a[1]];
                  const len = Math.hypot(v[0], v[1]);
                  if (len > bestLen) {
                    bestLen = len;
                    best = [v[0] / len, v[1] / len];
                  }
                }
                return bestLen > 1e-12 && best ? best : null;
              };

              const wallAxis = pickWallAxis();
              let topBeamRing: [number, number][] | null = null;
              if (!wallAxis) {
                const leftS = sideExtremes.minProj;
                const rightS = sideExtremes.maxProj;
                const spanS = rightS - leftS;
                const edgePadding = Math.min(Math.max(spanS * 0.08, beamSize * 1.2), spanS * 0.35);
                const finalLeftS = spanS > 0 ? leftS + edgePadding : leftS;
                const finalRightS = spanS > 0 ? rightS - edgePadding : rightS;
                const outerD = dirExtremes.maxProj;
                const innerD = dirExtremes.maxProj - topThickness;
                topBeamRing = ensureClosedRing([
                  pointFromSD(finalRightS > finalLeftS ? finalLeftS : leftS, outerD),
                  pointFromSD(finalRightS > finalLeftS ? finalRightS : rightS, outerD),
                  pointFromSD(finalRightS > finalLeftS ? finalRightS : rightS, innerD),
                  pointFromSD(finalRightS > finalLeftS ? finalLeftS : leftS, innerD),
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
                const spanS = rightS - leftS;
                const edgePadding = Math.min(Math.max(spanS * 0.08, beamSize * 1.2), spanS * 0.35);
                const finalLeftS = spanS > 0 ? leftS + edgePadding : leftS;
                const finalRightS = spanS > 0 ? rightS - edgePadding : rightS;
                const outerD = dExt.maxProj;
                const innerD = outerD - topThickness;
                const pointFromLocal = (s: number, d: number): [number, number] => [
                  ringCenterLocal[0] + wallAxis[0] * s + outAxis[0] * d,
                  ringCenterLocal[1] + wallAxis[1] * s + outAxis[1] * d,
                ];
                topBeamRing = ensureClosedRing([
                  pointFromLocal(finalRightS > finalLeftS ? finalLeftS : leftS, outerD),
                  pointFromLocal(finalRightS > finalLeftS ? finalRightS : rightS, outerD),
                  pointFromLocal(finalRightS > finalLeftS ? finalRightS : rightS, innerD),
                  pointFromLocal(finalRightS > finalLeftS ? finalLeftS : leftS, innerD),
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
                  geometry: { type: "Polygon", coordinates: [topBeamRing] } as any,
                } as GeoJSON.Feature);
              }
            }
          } else {
            pushGlassFeature(ring, "front");

            const ringPts = ring
              .slice(0, -1)
              .map((pt) => [Number(pt[0]), Number(pt[1])] as [number, number]);
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
                  geometry: { type: "Polygon", coordinates: [cornerRect] } as any,
                } as GeoJSON.Feature);
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
          geometry: { type: "Polygon", coordinates: [beamPoly] } as any,
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
        const sideSign = relToCenter[0] * sideAxis[0] + relToCenter[1] * sideAxis[1] >= 0 ? 1 : -1;
        let insetPos = pos;
        if (beamInset > 0) {
          insetPos = [pos[0] - sideAxis[0] * sideSign * beamInset, pos[1] - sideAxis[1] * sideSign * beamInset];
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
          const newCenter: [number, number] = [leftCenter[0] + delta[0] * frac, leftCenter[1] + delta[1] * frac];
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
              const rectFromBasis = (centerS: number, centerD: number, halfWidth: number, halfDepth: number): number[][] | null => {
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
        const availableDepth = Math.max(spanBasisReady.depthExtremes.maxProj - spanBasisReady.depthExtremes.minProj, beamSize * 0.5);
        let crossDepthHalf = Math.max(beamSize * STREET_CROSS_DEPTH_FACTOR, beamSize * 0.2);
        crossDepthHalf = Math.min(crossDepthHalf, availableDepth / 2);
        const desiredInset = Math.max(beamSize * STREET_CROSS_DEPTH_CLEARANCE_FACTOR, crossDepthHalf * 0.35);
        const maxInset = Math.max(availableDepth - crossDepthHalf, beamSize * 0.1);
        const crossDepthInset = Math.min(desiredInset, maxInset);
        const minCenter = spanBasisReady.depthExtremes.minProj + crossDepthHalf;
        const maxCenter = spanBasisReady.depthExtremes.maxProj - crossDepthHalf;
        const desiredCenter = spanBasisReady.depthExtremes.maxProj - crossDepthInset - crossDepthHalf;
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

          const windowInset = Math.max(windowWidth * STREET_CROSS_WINDOW_INSET_FACTOR, verticalHalfWidth * 0.5);

          const verticalRing = spanBasisReady.rectFromBasis(crossCenterS, crossDepthCenter, verticalHalfWidth, crossDepthHalf);
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
              geometry: { type: "Polygon", coordinates: [verticalRing] } as any,
            } as GeoJSON.Feature);
          }

          const horizontalHalfWidth = Math.max(windowWidth / 2 - windowInset, beamSize * 0.18);
          if (!(horizontalHalfWidth > 0)) continue;
          const horizontalRing = spanBasisReady.rectFromBasis(crossCenterS, crossDepthCenter, horizontalHalfWidth, crossDepthHalf);
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
              geometry: { type: "Polygon", coordinates: [horizontalRing] } as any,
            } as GeoJSON.Feature);
          }
        }
      }

      let topBeamPlaced = false;

      if (spanBasisReady && (floor === 2 || floor === 3 || floor === 4) && finalOrderedCenters.length >= 2) {
        const spanWidth = spanBasisReady.spanExtremes.maxProj - spanBasisReady.spanExtremes.minProj;
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
            const halfDepth = Math.min(Math.max(topThickness / 2, depthSpan * 0.25, beamSize * 0.1), depthSpan / 2);
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
                geometry: { type: "Polygon", coordinates: [topBeamRing] } as any,
              } as GeoJSON.Feature);
              topBeamPlaced = true;
            }
          }
        }
      }

      if (!topBeamPlaced && Number.isFinite(sideExtremes.minProj) && Number.isFinite(sideExtremes.maxProj) && Number.isFinite(dirExtremes.maxProj)) {
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
            geometry: { type: "Polygon", coordinates: [topBeamRing] } as any,
          } as GeoJSON.Feature);
        }
      }
    });
  });

  return features.length ? ({ type: "FeatureCollection", features } as GeoJSON.FeatureCollection) : emptyFeatureCollection;
}

type OutdoorKind = "balcony-floor" | "balcony-rail" | "balcony-post" | "terrace-floor" | "terrace-rail";

export function makeOutdoorFeatureCollection(
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
        coordinates: geom.coordinates.map((poly: number[][][]) => poly.map((ring: number[][]) => closeRing(ring))),
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
      const outerShortSign = ringVertices && ringCenter && shortAxis ? determineOuterSign(ringVertices, ringCenter, shortAxis) : null;
      const outerLongSign = ringVertices && ringCenter && longAxis ? determineOuterSign(ringVertices, ringCenter, longAxis) : null;
      const longMaxAbs =
        ringVertices && ringCenter && longAxis
          ? Math.max(
              1e-12,
              ...ringVertices.map((pt) => {
                const rel: [number, number] = [pt[0] - ringCenter[0], pt[1] - ringCenter[1]];
                return Math.abs(rel[0] * longAxis[0] + rel[1] * longAxis[1]);
              })
            )
          : null;

      if (floor !== 6 && railGeom && ringCenter && shortAxis && longAxis && outerShortSign && outerLongSign && longMaxAbs) {
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
    const outerSign = ringVertices && ringCenter && shortAxis ? determineOuterSign(ringVertices, ringCenter, shortAxis) : null;
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
        const filtered = filteredCoords.length ? ({ type: "MultiPolygon", coordinates: filteredCoords } as GeoJSON.MultiPolygon) : null;
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
    if (ringVertices && ringVertices.length) {
      const postSize = estimatePostSize(ringVertices, BALCONY_POST_MIN_SIZE);
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
          insetPoint = [insetPoint[0] + shortAxis[0] * delta, insetPoint[1] + shortAxis[1] * delta];
        }
        const postPolygon = createPostPolygon(insetPoint, postSize, BALCONY_POST_MIN_SIZE);
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
          geometry: { type: "Polygon", coordinates: [postPolygon] } as any,
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
          const sum = points.reduce<[number, number]>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
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
