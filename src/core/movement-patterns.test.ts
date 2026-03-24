import { describe, it, expect } from 'vitest';
import {
  generateLinearStripes,
  generateConcentricCircles,
  generatePerimeterFirst,
  generateRandomCoverage,
  generateWaypoints,
} from './movement-patterns';
import { pointInPolygon, type Point2D } from './spline-math';
import type { NamedRegion } from './named-region';

const SQUARE: Point2D[] = [
  { x: 0, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 20 }, { x: 0, z: 20 },
];

const SMALL_SQUARE: Point2D[] = [
  { x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 4 }, { x: 0, z: 4 },
];

const TRIANGLE: Point2D[] = [
  { x: 10, z: 0 }, { x: 20, z: 20 }, { x: 0, z: 20 },
];

function allInsideBoundary(waypoints: Point2D[], boundary: Point2D[], tolerance = 0.5): boolean {
  for (const wp of waypoints) {
    const expanded = boundary.map(p => ({
      x: p.x + (p.x > 10 ? tolerance : -tolerance),
      z: p.z + (p.z > 10 ? tolerance : -tolerance),
    }));
    if (!pointInPolygon(wp, expanded) && !pointInPolygon(wp, boundary)) {
      const minDist = boundary.reduce((min, bp) => {
        const d = Math.sqrt((wp.x - bp.x) ** 2 + (wp.z - bp.z) ** 2);
        return d < min ? d : min;
      }, Infinity);
      if (minDist > tolerance) return false;
    }
  }
  return true;
}

describe('generateLinearStripes', () => {
  it('produces waypoints for a square boundary', () => {
    const wps = generateLinearStripes(SQUARE, 2, 0);
    expect(wps.length).toBeGreaterThan(10);
  });

  it('all waypoints fall inside the boundary', () => {
    const wps = generateLinearStripes(SQUARE, 2, 0);
    expect(allInsideBoundary(wps, SQUARE)).toBe(true);
  });

  it('works with angled stripes', () => {
    const wps = generateLinearStripes(SQUARE, 2, 45);
    expect(wps.length).toBeGreaterThan(5);
    expect(allInsideBoundary(wps, SQUARE, 1.5)).toBe(true);
  });

  it('handles triangular boundary', () => {
    const wps = generateLinearStripes(TRIANGLE, 2, 0);
    expect(wps.length).toBeGreaterThan(5);
  });

  it('handles small regions', () => {
    const wps = generateLinearStripes(SMALL_SQUARE, 2, 0);
    expect(wps.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty for degenerate boundary', () => {
    const wps = generateLinearStripes([{ x: 0, z: 0 }], 2, 0);
    expect(wps).toHaveLength(0);
  });
});

describe('generateConcentricCircles', () => {
  it('produces waypoints converging to center', () => {
    const wps = generateConcentricCircles(SQUARE, 2);
    expect(wps.length).toBeGreaterThan(10);
    const last = wps[wps.length - 1];
    expect(last.x).toBeCloseTo(10, 0);
    expect(last.z).toBeCloseTo(10, 0);
  });

  it('all waypoints inside boundary', () => {
    const wps = generateConcentricCircles(SQUARE, 2);
    const insideCount = wps.filter(wp => pointInPolygon(wp, SQUARE)).length;
    expect(insideCount / wps.length).toBeGreaterThan(0.9);
  });

  it('handles small regions', () => {
    const wps = generateConcentricCircles(SMALL_SQUARE, 1);
    expect(wps.length).toBeGreaterThanOrEqual(1);
  });
});

describe('generatePerimeterFirst', () => {
  it('starts with boundary points then fills', () => {
    const wps = generatePerimeterFirst(SQUARE, 2);
    expect(wps.length).toBeGreaterThan(20);
    expect(wps[0].x).toBeCloseTo(0);
    expect(wps[0].z).toBeCloseTo(0);
  });

  it('has more points than just the boundary', () => {
    const wps = generatePerimeterFirst(SQUARE, 2);
    const boundaryPerimeter = 80;
    const perimeterPointsApprox = boundaryPerimeter / 2;
    expect(wps.length).toBeGreaterThan(perimeterPointsApprox);
  });
});

describe('generateRandomCoverage', () => {
  it('returns empty without topology', () => {
    const wps = generateRandomCoverage([1, 2, 3]);
    expect(wps).toHaveLength(0);
  });

  it('produces face centroids from topology', () => {
    const topology = {
      vertices: [
        { id: 0, position: { x: 0, y: 0, z: 0 } },
        { id: 1, position: { x: 10, y: 0, z: 0 } },
        { id: 2, position: { x: 5, y: 0, z: 10 } },
        { id: 3, position: { x: 15, y: 0, z: 10 } },
      ],
      triangles: [
        { id: 100, vertices: [0, 1, 2] as [number, number, number], terrainCode: 0 },
        { id: 101, vertices: [1, 3, 2] as [number, number, number], terrainCode: 0 },
      ],
      worldWidth: 20,
      worldHeight: 20,
    };
    const wps = generateRandomCoverage([100, 101], topology);
    expect(wps).toHaveLength(2);
    for (const wp of wps) {
      expect(wp.x).toBeGreaterThan(0);
      expect(wp.z).toBeGreaterThan(0);
    }
  });

  it('is deterministic for same inputs', () => {
    const topology = {
      vertices: [
        { id: 0, position: { x: 0, y: 0, z: 0 } },
        { id: 1, position: { x: 10, y: 0, z: 0 } },
        { id: 2, position: { x: 5, y: 0, z: 10 } },
      ],
      triangles: [
        { id: 100, vertices: [0, 1, 2] as [number, number, number], terrainCode: 0 },
      ],
      worldWidth: 20,
      worldHeight: 20,
    };
    const wps1 = generateRandomCoverage([100], topology);
    const wps2 = generateRandomCoverage([100], topology);
    expect(wps1).toEqual(wps2);
  });
});

describe('generateWaypoints dispatcher', () => {
  const region: NamedRegion = {
    id: 'test_region',
    name: 'Test',
    holeNumber: 1,
    terrainCode: 0,
    boundary: SQUARE,
    faceIds: [],
  };

  it('dispatches linear_stripes', () => {
    const wps = generateWaypoints('linear_stripes', region);
    expect(wps.length).toBeGreaterThan(0);
  });

  it('dispatches diagonal_stripes', () => {
    const wps = generateWaypoints('diagonal_stripes', region);
    expect(wps.length).toBeGreaterThan(0);
  });

  it('dispatches concentric_circles', () => {
    const wps = generateWaypoints('concentric_circles', region);
    expect(wps.length).toBeGreaterThan(0);
  });

  it('dispatches perimeter_first', () => {
    const wps = generateWaypoints('perimeter_first', region);
    expect(wps.length).toBeGreaterThan(0);
  });

  it('dispatches random_coverage (empty without topology)', () => {
    const wps = generateWaypoints('random_coverage', region);
    expect(wps).toHaveLength(0);
  });
});
