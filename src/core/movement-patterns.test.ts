import { describe, it, expect } from 'vitest';
import {
  generateWaypoints,
} from './movement-patterns';
import type { NamedRegion } from './named-region';

const SQUARE = [
  { x: 0, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 20 }, { x: 0, z: 20 },
];

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
