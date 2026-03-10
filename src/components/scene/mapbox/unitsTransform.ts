import type { AxisBasis, UnitsTransform } from "./types";
import { normalizeVector } from "./geometry";

function centroidOfPolygon(points: [number, number][]): [number, number] {
  if (!points.length) return [0, 0];
  const sum = points.reduce<[number, number]>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
  return [sum[0] / points.length, sum[1] / points.length];
}

export function computeAxisBasis(points: [number, number][]): AxisBasis | null {
  if (!points.length) return null;
  const center = centroidOfPolygon(points);
  let sxx = 0,
    syy = 0,
    sxy = 0;
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
  const discr = Math.max((trace * trace) / 4 - det, 0);
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
  const spreads: [number, number] = [
    Math.sqrt(Math.max(lambda1, 1e-12)),
    Math.sqrt(Math.max(lambda2, 1e-12)),
  ];
  return { center, axes: [axis1, axis2], spreads };
}

export function buildUnitsTransform(
  sourcePoints: [number, number][],
  targetPoints: [number, number][]
): UnitsTransform | null {
  const source = computeAxisBasis(sourcePoints);
  const target = computeAxisBasis(targetPoints);
  if (!source || !target) return null;
  const scale1 = target.spreads[0] / (source.spreads[0] || 1);
  const scale2 = target.spreads[1] / (source.spreads[1] || 1);
  return { source, target, scales: [scale1, scale2] };
}
