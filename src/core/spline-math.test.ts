import { describe, it, expect } from 'vitest';
import {
  splineToBoundaryPolygon,
  makeEllipseBoundary,
  makeRectBoundary,
  pointInPolygon,
  type Point2D,
} from './spline-math';

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
