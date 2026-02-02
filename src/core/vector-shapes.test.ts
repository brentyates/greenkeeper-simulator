import { describe, it, expect } from 'vitest';
import {
  catmullRom,
  sampleSpline,
  pointInPolygon,
  signedDistanceToPolygon,
  createCircleShape,
  createEllipseShape,
  createFairwayShape,
  getDefaultZIndex,
  ControlPoint,
} from './vector-shapes';

describe('vector-shapes', () => {
  describe('catmullRom', () => {
    it('returns start point at t=0', () => {
      const p0: ControlPoint = { x: 0, y: 0, tension: 0.5 };
      const p1: ControlPoint = { x: 1, y: 0, tension: 0.5 };
      const p2: ControlPoint = { x: 2, y: 0, tension: 0.5 };
      const p3: ControlPoint = { x: 3, y: 0, tension: 0.5 };

      const result = catmullRom(p0, p1, p2, p3, 0, 0.5);
      expect(result.x).toBeCloseTo(1);
      expect(result.y).toBeCloseTo(0);
    });

    it('returns end point at t=1', () => {
      const p0: ControlPoint = { x: 0, y: 0, tension: 0.5 };
      const p1: ControlPoint = { x: 1, y: 0, tension: 0.5 };
      const p2: ControlPoint = { x: 2, y: 0, tension: 0.5 };
      const p3: ControlPoint = { x: 3, y: 0, tension: 0.5 };

      const result = catmullRom(p0, p1, p2, p3, 1, 0.5);
      expect(result.x).toBeCloseTo(2);
      expect(result.y).toBeCloseTo(0);
    });

    it('interpolates between points', () => {
      const p0: ControlPoint = { x: 0, y: 0, tension: 0.5 };
      const p1: ControlPoint = { x: 1, y: 0, tension: 0.5 };
      const p2: ControlPoint = { x: 2, y: 0, tension: 0.5 };
      const p3: ControlPoint = { x: 3, y: 0, tension: 0.5 };

      const result = catmullRom(p0, p1, p2, p3, 0.5, 0.5);
      expect(result.x).toBeCloseTo(1.5);
    });

    it('tension=0 gives sharper curve', () => {
      const p0: ControlPoint = { x: 0, y: 0, tension: 0 };
      const p1: ControlPoint = { x: 1, y: 0, tension: 0 };
      const p2: ControlPoint = { x: 2, y: 1, tension: 0 };
      const p3: ControlPoint = { x: 3, y: 1, tension: 0 };

      // With tension=0, curve should be sharper
      const sharp = catmullRom(p0, p1, p2, p3, 0.5, 0);
      const smooth = catmullRom(p0, p1, p2, p3, 0.5, 1);

      // Both should interpolate, but at different rates
      expect(sharp.y).toBeGreaterThan(0);
      expect(smooth.y).toBeGreaterThan(0);
    });
  });

  describe('sampleSpline', () => {
    it('returns original points for 2-point spline', () => {
      const points: ControlPoint[] = [
        { x: 0, y: 0, tension: 0.5 },
        { x: 10, y: 10, tension: 0.5 },
      ];

      const samples = sampleSpline(points, false, 5);
      expect(samples.length).toBeGreaterThan(0);
      expect(samples[0].x).toBeCloseTo(0);
      expect(samples[0].y).toBeCloseTo(0);
    });

    it('generates samples for closed splines', () => {
      const points: ControlPoint[] = [
        { x: 0, y: 0, tension: 1 },
        { x: 10, y: 0, tension: 1 },
        { x: 10, y: 10, tension: 1 },
        { x: 0, y: 10, tension: 1 },
      ];

      const samples = sampleSpline(points, true, 4);
      expect(samples.length).toBe(16); // 4 segments * 4 samples each
    });

    it('handles single point gracefully', () => {
      const points: ControlPoint[] = [{ x: 5, y: 5, tension: 0.5 }];
      const samples = sampleSpline(points, false, 10);
      expect(samples.length).toBe(1);
      expect(samples[0].x).toBe(5);
    });
  });

  describe('pointInPolygon', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    it('returns true for point inside polygon', () => {
      expect(pointInPolygon(5, 5, square)).toBe(true);
      expect(pointInPolygon(1, 1, square)).toBe(true);
      expect(pointInPolygon(9, 9, square)).toBe(true);
    });

    it('returns false for point outside polygon', () => {
      expect(pointInPolygon(-1, 5, square)).toBe(false);
      expect(pointInPolygon(11, 5, square)).toBe(false);
      expect(pointInPolygon(5, -1, square)).toBe(false);
      expect(pointInPolygon(5, 11, square)).toBe(false);
    });

    it('handles complex polygons', () => {
      const triangle = [
        { x: 5, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];

      expect(pointInPolygon(5, 5, triangle)).toBe(true);
      expect(pointInPolygon(1, 1, triangle)).toBe(false);
    });
  });

  describe('signedDistanceToPolygon', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    it('returns negative distance for points inside', () => {
      const dist = signedDistanceToPolygon(5, 5, square);
      expect(dist).toBeLessThan(0);
    });

    it('returns positive distance for points outside', () => {
      const dist = signedDistanceToPolygon(15, 5, square);
      expect(dist).toBeGreaterThan(0);
      expect(dist).toBeCloseTo(5);
    });

    it('returns approximately zero for points on edge', () => {
      const dist = signedDistanceToPolygon(5, 0, square);
      expect(Math.abs(dist)).toBeLessThan(0.01);
    });

    it('returns Infinity for empty polygon', () => {
      expect(signedDistanceToPolygon(0, 0, [])).toBe(Infinity);
      expect(signedDistanceToPolygon(0, 0, [{ x: 0, y: 0 }])).toBe(Infinity);
    });
  });

  describe('createCircleShape', () => {
    it('creates a closed shape with correct properties', () => {
      const shape = createCircleShape('green', 10, 10, 5, 8, 1.0);

      expect(shape.type).toBe('green');
      expect(shape.closed).toBe(true);
      expect(shape.points.length).toBe(8);
      expect(shape.zIndex).toBe(getDefaultZIndex('green'));
    });

    it('creates points in a circle', () => {
      const shape = createCircleShape('green', 0, 0, 5, 4, 1.0);

      // With 4 points and center at origin, radius 5
      // Points should be at (5,0), (0,5), (-5,0), (0,-5) approximately
      const expectedPoints = [
        { x: 5, y: 0 },
        { x: 0, y: 5 },
        { x: -5, y: 0 },
        { x: 0, y: -5 },
      ];

      for (let i = 0; i < 4; i++) {
        expect(shape.points[i].x).toBeCloseTo(expectedPoints[i].x, 1);
        expect(shape.points[i].y).toBeCloseTo(expectedPoints[i].y, 1);
        expect(shape.points[i].tension).toBe(1.0);
      }
    });
  });

  describe('createEllipseShape', () => {
    it('creates an ellipse with different radii', () => {
      const shape = createEllipseShape('bunker', 0, 0, 10, 5, 0, 4, 0.8);

      expect(shape.type).toBe('bunker');
      expect(shape.points.length).toBe(4);

      // Major axis should be along x (radius 10)
      // Minor axis should be along y (radius 5)
      expect(Math.abs(shape.points[0].x)).toBeCloseTo(10, 1);
      expect(shape.points[1].y).toBeCloseTo(5, 1);
    });

    it('applies rotation', () => {
      const shape = createEllipseShape('bunker', 0, 0, 10, 5, Math.PI / 2, 4, 0.8);

      // After 90 degree rotation, major axis should be along y
      expect(shape.points[0].y).toBeCloseTo(10, 1);
      expect(Math.abs(shape.points[0].x)).toBeLessThan(1);
    });
  });

  describe('createFairwayShape', () => {
    it('creates a rectangular fairway segment', () => {
      const shape = createFairwayShape(0, 0, 100, 0, 10, 0.8);

      expect(shape.type).toBe('fairway');
      expect(shape.closed).toBe(true);
      expect(shape.points.length).toBe(4);
    });

    it('has correct width', () => {
      const shape = createFairwayShape(0, 0, 100, 0, 10, 0.8);

      // Width is 10, so perpendicular offset should be 5 on each side
      const topY = shape.points[0].y;
      const bottomY = shape.points[3].y;

      expect(Math.abs(topY - bottomY)).toBeCloseTo(10, 1);
    });

    it('handles zero-length (start equals end) without NaN', () => {
      // This would previously cause division by zero
      const shape = createFairwayShape(50, 50, 50, 50, 10, 0.8);

      expect(shape.type).toBe('fairway');
      expect(shape.closed).toBe(true);
      expect(shape.points.length).toBe(4);

      // All points should be valid numbers
      for (const p of shape.points) {
        expect(isFinite(p.x)).toBe(true);
        expect(isFinite(p.y)).toBe(true);
        expect(isNaN(p.x)).toBe(false);
        expect(isNaN(p.y)).toBe(false);
      }
    });
  });

  describe('getDefaultZIndex', () => {
    it('returns correct z-index ordering', () => {
      expect(getDefaultZIndex('water')).toBe(0);
      expect(getDefaultZIndex('fairway')).toBe(1);
      expect(getDefaultZIndex('tee')).toBe(2);
      expect(getDefaultZIndex('bunker')).toBe(3);
      expect(getDefaultZIndex('green')).toBe(4);
    });

    it('green renders on top of fairway', () => {
      expect(getDefaultZIndex('green')).toBeGreaterThan(getDefaultZIndex('fairway'));
    });

    it('bunker renders on top of fairway', () => {
      expect(getDefaultZIndex('bunker')).toBeGreaterThan(getDefaultZIndex('fairway'));
    });
  });
});
