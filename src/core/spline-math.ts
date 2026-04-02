export interface Point2D {
  x: number;
  z: number;
}

function evaluateCatmullRom(
  p0: Point2D, p1: Point2D, p2: Point2D, p3: Point2D, t: number
): Point2D {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * (
      (2 * p1.x) +
      (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
    ),
    z: 0.5 * (
      (2 * p1.z) +
      (-p0.z + p2.z) * t +
      (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
      (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3
    ),
  };
}

function splineToPolyline(
  points: Point2D[], segmentsPerSpan = 8
): Point2D[] {
  if (points.length < 2) return [...points];
  if (points.length === 2) {
    const result: Point2D[] = [];
    for (let i = 0; i <= segmentsPerSpan; i++) {
      const t = i / segmentsPerSpan;
      result.push({
        x: points[0].x + (points[1].x - points[0].x) * t,
        z: points[0].z + (points[1].z - points[0].z) * t,
      });
    }
    return result;
  }

  const result: Point2D[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const steps = i === points.length - 2 ? segmentsPerSpan + 1 : segmentsPerSpan;
    for (let s = 0; s < steps; s++) {
      const t = s / segmentsPerSpan;
      result.push(evaluateCatmullRom(p0, p1, p2, p3, t));
    }
  }

  return result;
}

function interpolateWidth(
  widths: number[], pointCount: number, segmentsPerSpan: number, index: number
): number {
  const totalSegments = (pointCount - 1) * segmentsPerSpan;
  const t = index / totalSegments;
  const floatIdx = t * (widths.length - 1);
  const lo = Math.floor(floatIdx);
  const hi = Math.min(widths.length - 1, lo + 1);
  const frac = floatIdx - lo;
  return widths[lo] * (1 - frac) + widths[hi] * frac;
}

function polylineNormalAt(polyline: Point2D[], index: number): Point2D {
  let dx: number, dz: number;
  if (index === 0) {
    dx = polyline[1].x - polyline[0].x;
    dz = polyline[1].z - polyline[0].z;
  } else if (index === polyline.length - 1) {
    dx = polyline[index].x - polyline[index - 1].x;
    dz = polyline[index].z - polyline[index - 1].z;
  } else {
    dx = polyline[index + 1].x - polyline[index - 1].x;
    dz = polyline[index + 1].z - polyline[index - 1].z;
  }
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 1e-10) return { x: 0, z: 1 };
  return { x: -dz / len, z: dx / len };
}

function offsetPolyline(
  polyline: Point2D[],
  leftWidths: number[],
  rightWidths: number[]
): { left: Point2D[]; right: Point2D[] } {
  const left: Point2D[] = [];
  const right: Point2D[] = [];

  for (let i = 0; i < polyline.length; i++) {
    const n = polylineNormalAt(polyline, i);
    const lw = leftWidths[i];
    const rw = rightWidths[i];
    left.push({ x: polyline[i].x + n.x * lw, z: polyline[i].z + n.z * lw });
    right.push({ x: polyline[i].x - n.x * rw, z: polyline[i].z - n.z * rw });
  }

  return { left, right };
}

export function splineToBoundaryPolygon(
  centerline: Point2D[],
  leftWidths: number[],
  rightWidths: number[],
  segmentsPerSpan = 8
): Point2D[] {
  const polyline = splineToPolyline(centerline, segmentsPerSpan);

  const interpLeft: number[] = [];
  const interpRight: number[] = [];
  for (let i = 0; i < polyline.length; i++) {
    interpLeft.push(interpolateWidth(leftWidths, centerline.length, segmentsPerSpan, i));
    interpRight.push(interpolateWidth(rightWidths, centerline.length, segmentsPerSpan, i));
  }

  const { left, right } = offsetPolyline(polyline, interpLeft, interpRight);

  const endCap = makeEndCap(
    left[left.length - 1], right[right.length - 1], 4
  );
  const startCap = makeEndCap(
    right[0], left[0], 4
  );

  return [...left, ...endCap, ...right.reverse(), ...startCap];
}

function makeEndCap(from: Point2D, to: Point2D, segments: number): Point2D[] {
  const cx = (from.x + to.x) / 2;
  const cz = (from.z + to.z) / 2;
  const rx = from.x - cx;
  const rz = from.z - cz;
  const result: Point2D[] = [];
  for (let i = 1; i < segments; i++) {
    const angle = (Math.PI * i) / segments;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    result.push({
      x: cx + rx * cos - rz * sin,
      z: cz + rx * sin + rz * cos,
    });
  }
  return result;
}

export function makeEllipseBoundary(
  cx: number, cz: number, rx: number, rz: number, n = 24
): Point2D[] {
  return Array.from({ length: n }, (_, i) => ({
    x: cx + Math.cos(2 * Math.PI * i / n) * rx,
    z: cz + Math.sin(2 * Math.PI * i / n) * rz,
  }));
}

export function makeRectBoundary(
  cx: number, cz: number, width: number, height: number, rotation = 0
): Point2D[] {
  const hw = width / 2;
  const hh = height / 2;
  const corners = [
    { x: -hw, z: -hh },
    { x: hw, z: -hh },
    { x: hw, z: hh },
    { x: -hw, z: hh },
  ];
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return corners.map(c => ({
    x: cx + c.x * cos - c.z * sin,
    z: cz + c.x * sin + c.z * cos,
  }));
}

export function pointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    if (
      ((pi.z > point.z) !== (pj.z > point.z)) &&
      (point.x < (pj.x - pi.x) * (point.z - pi.z) / (pj.z - pi.z) + pi.x)
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export function polygonCentroid(polygon: Point2D[]): Point2D {
  let sx = 0, sz = 0;
  for (const p of polygon) {
    sx += p.x;
    sz += p.z;
  }
  return { x: sx / polygon.length, z: sz / polygon.length };
}
