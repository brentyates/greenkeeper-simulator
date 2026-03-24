import type { Point2D } from './spline-math';
import { pointInPolygon, polygonCentroid } from './spline-math';
import type { MovementPatternType } from './job';
import type { NamedRegion } from './named-region';
import type { SerializedTopology } from './mesh-topology';

export function generateWaypoints(
  patternType: MovementPatternType,
  region: NamedRegion,
  topology?: SerializedTopology,
): Point2D[] {
  switch (patternType) {
    case 'linear_stripes':
      return generateLinearStripes(region.boundary, 1.5, 0);
    case 'diagonal_stripes':
      return generateLinearStripes(region.boundary, 1.2, 45);
    case 'concentric_circles':
      return generateConcentricCircles(region.boundary, 1.0);
    case 'perimeter_first':
      return generatePerimeterFirst(region.boundary, 1.5);
    case 'random_coverage':
      return generateRandomCoverage(region.faceIds, topology);
  }
}

export function generateLinearStripes(
  boundary: Point2D[],
  stripeWidth: number,
  angleDeg: number,
): Point2D[] {
  if (boundary.length < 3) return [];

  const angleRad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  const rotated = boundary.map(p => ({
    x: p.x * cos + p.z * sin,
    z: -p.x * sin + p.z * cos,
  }));

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of rotated) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }

  const unrotCos = Math.cos(-angleRad);
  const unrotSin = Math.sin(-angleRad);
  const unrotate = (p: Point2D): Point2D => ({
    x: p.x * unrotCos + p.z * unrotSin,
    z: -p.x * unrotSin + p.z * unrotCos,
  });

  const waypoints: Point2D[] = [];
  let direction = 1;
  const pad = stripeWidth * 0.5;

  for (let z = minZ + pad; z <= maxZ - pad; z += stripeWidth) {
    const linePoints: Point2D[] = [];
    const step = stripeWidth * 0.5;
    const startX = direction === 1 ? minX + pad : maxX - pad;
    const endX = direction === 1 ? maxX - pad : minX + pad;
    const dx = direction === 1 ? step : -step;

    let x = startX;
    while ((direction === 1 && x <= endX) || (direction === -1 && x >= endX)) {
      const world = unrotate({ x, z });
      if (pointInPolygon(world, boundary)) {
        linePoints.push(world);
      }
      x += dx;
    }

    if (linePoints.length > 0) {
      waypoints.push(...linePoints);
    }
    direction *= -1;
  }

  return waypoints;
}

export function generateConcentricCircles(
  boundary: Point2D[],
  ringSpacing: number,
): Point2D[] {
  if (boundary.length < 3) return [];

  const center = polygonCentroid(boundary);
  let maxRadius = 0;
  for (const p of boundary) {
    const dx = p.x - center.x;
    const dz = p.z - center.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > maxRadius) maxRadius = d;
  }

  const waypoints: Point2D[] = [];
  for (let r = maxRadius; r > ringSpacing * 0.5; r -= ringSpacing) {
    const circumference = 2 * Math.PI * r;
    const pointCount = Math.max(8, Math.round(circumference / ringSpacing));

    for (let i = 0; i < pointCount; i++) {
      const angle = (2 * Math.PI * i) / pointCount;
      const p: Point2D = {
        x: center.x + Math.cos(angle) * r,
        z: center.z + Math.sin(angle) * r,
      };
      if (pointInPolygon(p, boundary)) {
        waypoints.push(p);
      }
    }
  }

  waypoints.push(center);
  return waypoints;
}

export function generatePerimeterFirst(
  boundary: Point2D[],
  fillSpacing: number,
): Point2D[] {
  if (boundary.length < 3) return [];

  const waypoints: Point2D[] = [];

  const perimeterStep = fillSpacing;
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i];
    const b = boundary[(i + 1) % boundary.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    const steps = Math.max(1, Math.ceil(len / perimeterStep));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      waypoints.push({ x: a.x + dx * t, z: a.z + dz * t });
    }
  }

  const fill = generateLinearStripes(boundary, fillSpacing, 0);
  waypoints.push(...fill);

  return waypoints;
}

export function generateRandomCoverage(
  faceIds: readonly number[],
  topology?: SerializedTopology,
): Point2D[] {
  if (!topology || faceIds.length === 0) return [];

  const vertMap = new Map<number, Point2D>();
  for (const v of topology.vertices) {
    vertMap.set(v.id, { x: v.position.x, z: v.position.z });
  }

  const centroids: Point2D[] = [];
  for (const fid of faceIds) {
    const tri = topology.triangles.find(t => t.id === fid);
    if (!tri) continue;
    const v0 = vertMap.get(tri.vertices[0]);
    const v1 = vertMap.get(tri.vertices[1]);
    const v2 = vertMap.get(tri.vertices[2]);
    if (!v0 || !v1 || !v2) continue;
    centroids.push({
      x: (v0.x + v1.x + v2.x) / 3,
      z: (v0.z + v1.z + v2.z) / 3,
    });
  }

  const seed = faceIds.length > 0 ? faceIds[0] : 42;
  shuffleSeeded(centroids, seed);

  return centroids;
}

function shuffleSeeded(arr: Point2D[], seed: number): void {
  let s = seed;
  const next = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
