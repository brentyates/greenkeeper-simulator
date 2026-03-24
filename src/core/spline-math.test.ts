import { describe, it, expect } from 'vitest';
import {
  evaluateCatmullRom,
  splineToPolyline,
  offsetPolyline,
  splineToBoundaryPolygon,
  makeEllipseBoundary,
  makeRectBoundary,
  pointInPolygon,
  interpolateWidth,
  type Point2D,
} from './spline-math';

describe('evaluateCatmullRom', () => {
  it('returns p1 at t=0', () => {
    const p = evaluateCatmullRom(
      { x: 0, z: 0 }, { x: 10, z: 10 }, { x: 20, z: 20 }, { x: 30, z: 30 }, 0
    );
    expect(p.x).toBeCloseTo(10);
    expect(p.z).toBeCloseTo(10);
  });

  it('returns p2 at t=1', () => {
    const p = evaluateCatmullRom(
      { x: 0, z: 0 }, { x: 10, z: 10 }, { x: 20, z: 20 }, { x: 30, z: 30 }, 1
    );
    expect(p.x).toBeCloseTo(20);
    expect(p.z).toBeCloseTo(20);
  });

  it('returns midpoint at t=0.5 for collinear points', () => {
    const p = evaluateCatmullRom(
      { x: 0, z: 0 }, { x: 10, z: 0 }, { x: 20, z: 0 }, { x: 30, z: 0 }, 0.5
    );
    expect(p.x).toBeCloseTo(15);
    expect(p.z).toBeCloseTo(0);
  });
});

describe('splineToPolyline', () => {
  it('returns empty for empty input', () => {
    expect(splineToPolyline([])).toEqual([]);
  });

  it('returns single point for single input', () => {
    const result = splineToPolyline([{ x: 5, z: 5 }]);
    expect(result).toHaveLength(1);
  });

  it('interpolates two points linearly', () => {
    const result = splineToPolyline([{ x: 0, z: 0 }, { x: 10, z: 0 }], 4);
    expect(result).toHaveLength(5);
    expect(result[0].x).toBeCloseTo(0);
    expect(result[4].x).toBeCloseTo(10);
  });

  it('produces smooth curve for 4 control points', () => {
    const points: Point2D[] = [
      { x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 20, z: 10 }
    ];
    const result = splineToPolyline(points, 4);
    expect(result.length).toBeGreaterThan(4);
    expect(result[0].x).toBeCloseTo(0);
    expect(result[0].z).toBeCloseTo(0);
    const last = result[result.length - 1];
    expect(last.x).toBeCloseTo(20);
    expect(last.z).toBeCloseTo(10);
  });
});

describe('interpolateWidth', () => {
  it('returns constant width for uniform widths', () => {
    expect(interpolateWidth([5, 5, 5], 3, 4, 0)).toBeCloseTo(5);
    expect(interpolateWidth([5, 5, 5], 3, 4, 4)).toBeCloseTo(5);
  });

  it('interpolates between widths', () => {
    const w = interpolateWidth([2, 6], 2, 4, 2);
    expect(w).toBeCloseTo(4);
  });
});

describe('offsetPolyline', () => {
  it('produces left/right offsets for straight line', () => {
    const polyline: Point2D[] = [
      { x: 0, z: 0 }, { x: 10, z: 0 }, { x: 20, z: 0 }
    ];
    const widths = [3, 3, 3];
    const { left, right } = offsetPolyline(polyline, widths, widths);
    expect(left).toHaveLength(3);
    expect(right).toHaveLength(3);
    for (const p of left) expect(p.z).toBeCloseTo(3);
    for (const p of right) expect(p.z).toBeCloseTo(-3);
  });
});

describe('splineToBoundaryPolygon', () => {
  it('produces closed polygon for simple straight hole', () => {
    const centerline: Point2D[] = [
      { x: 0, z: 0 }, { x: 0, z: 20 }
    ];
    const widths = [3, 3];
    const boundary = splineToBoundaryPolygon(centerline, widths, widths, 4);
    expect(boundary.length).toBeGreaterThan(8);
    const xs = boundary.map(p => p.x);
    const zs = boundary.map(p => p.z);
    expect(Math.max(...xs)).toBeGreaterThan(2);
    expect(Math.min(...xs)).toBeLessThan(-2);
    expect(Math.min(...zs)).toBeLessThanOrEqual(0);
    expect(Math.max(...zs)).toBeGreaterThanOrEqual(20);
  });
});

describe('makeEllipseBoundary', () => {
  it('generates correct number of points', () => {
    const b = makeEllipseBoundary(10, 10, 5, 3, 16);
    expect(b).toHaveLength(16);
  });

  it('points lie on ellipse', () => {
    const b = makeEllipseBoundary(0, 0, 5, 3, 32);
    for (const p of b) {
      const r = (p.x / 5) ** 2 + (p.z / 3) ** 2;
      expect(r).toBeCloseTo(1, 4);
    }
  });
});

describe('makeRectBoundary', () => {
  it('produces 4 corner points', () => {
    const b = makeRectBoundary(10, 10, 6, 4, 0);
    expect(b).toHaveLength(4);
    const xs = b.map(p => p.x);
    const zs = b.map(p => p.z);
    expect(Math.min(...xs)).toBeCloseTo(7);
    expect(Math.max(...xs)).toBeCloseTo(13);
    expect(Math.min(...zs)).toBeCloseTo(8);
    expect(Math.max(...zs)).toBeCloseTo(12);
  });

  it('applies rotation', () => {
    const b = makeRectBoundary(0, 0, 4, 2, Math.PI / 2);
    const xs = b.map(p => Math.abs(p.x));
    expect(Math.max(...xs)).toBeCloseTo(1, 0);
  });
});

describe('pointInPolygon', () => {
  const square: Point2D[] = [
    { x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }
  ];

  it('detects inside point', () => {
    expect(pointInPolygon({ x: 5, z: 5 }, square)).toBe(true);
  });

  it('detects outside point', () => {
    expect(pointInPolygon({ x: 15, z: 5 }, square)).toBe(false);
  });

  it('works with negative coordinates', () => {
    expect(pointInPolygon({ x: -1, z: 5 }, square)).toBe(false);
  });
});
