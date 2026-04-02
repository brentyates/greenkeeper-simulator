import { describe, it, expect } from 'vitest';
import { courseLayoutToCourseData } from './layout-to-regions';
import { deriveNamedRegions, findRegionAtPosition } from './named-region';
import type { CourseLayout } from './course-layout';

function makeSimpleLayout(): CourseLayout {
  return {
    id: 'test_1hole',
    name: 'Test Course',
    worldWidth: 60,
    worldHeight: 80,
    backgroundTerrainCode: 1,
    holes: [
      {
        id: 'fairway_1',
        holeNumber: 1,
        terrainCode: 0,
        centerline: [
          { x: 30, z: 20, widthLeft: 4, widthRight: 4 },
          { x: 30, z: 40, widthLeft: 5, widthRight: 5 },
          { x: 30, z: 60, widthLeft: 4, widthRight: 4 },
        ],
      },
    ],
    features: [
      {
        id: 'green_1',
        holeNumber: 1,
        terrainCode: 2,
        center: { x: 30, z: 62 },
        params: { type: 'ellipse', radiusX: 5, radiusZ: 4 },
      },
      {
        id: 'tee_1',
        holeNumber: 1,
        terrainCode: 5,
        center: { x: 30, z: 18 },
        params: { type: 'rectangle', width: 4, height: 3, rotation: 0 },
      },
      {
        id: 'bunker_1',
        holeNumber: 1,
        terrainCode: 3,
        center: { x: 24, z: 58 },
        params: { type: 'ellipse', radiusX: 3, radiusZ: 2 },
      },
    ],
    obstacles: [],
  };
}

describe('courseLayoutToCourseData', () => {
  it('produces valid CourseData', () => {
    const layout = makeSimpleLayout();
    const data = courseLayoutToCourseData(layout);
    expect(data.name).toBe('Test Course');
    expect(data.width).toBe(60);
    expect(data.height).toBe(80);
    expect(data.topology.vertices.length).toBeGreaterThan(0);
    expect(data.layout).toBe(layout);
  });

  it('derives hole definitions from features', () => {
    const layout = makeSimpleLayout();
    const data = courseLayoutToCourseData(layout);
    expect(data.holes).toBeDefined();
    expect(data.holes!.length).toBe(1);
    expect(data.holes![0].holeNumber).toBe(1);
    expect(data.holes![0].teeBoxes.length).toBe(1);
    expect(data.holes![0].pinPositions.length).toBe(1);
    expect(data.holes![0].playable).toBe(true);
  });
});

describe('deriveNamedRegions', () => {
  it('creates named regions from layout', () => {
    const layout = makeSimpleLayout();
    const topology = courseLayoutToCourseData(layout).topology;
    const regions = deriveNamedRegions(layout, topology);
    expect(regions).toHaveLength(4);
    expect(regions[0].name).toBe('Fairway 1');
    expect(regions[1].name).toBe('Green 1');
    expect(regions[2].name).toBe('Tee Box 1');
    expect(regions[3].name).toBe('Bunker 1');
  });

  it('maps faces to regions', () => {
    const layout = makeSimpleLayout();
    const topology = courseLayoutToCourseData(layout).topology;
    const regions = deriveNamedRegions(layout, topology);
    const totalMapped = regions.reduce((sum, r) => sum + r.faceIds.length, 0);
    expect(totalMapped).toBeGreaterThan(0);
    const fairway = regions.find(r => r.name === 'Fairway 1')!;
    expect(fairway.faceIds.length).toBeGreaterThan(0);
  });
});

describe('findRegionAtPosition', () => {
  it('finds region containing a point', () => {
    const layout = makeSimpleLayout();
    const topology = courseLayoutToCourseData(layout).topology;
    const regions = deriveNamedRegions(layout, topology);
    const r = findRegionAtPosition(regions, 30, 40);
    expect(r).not.toBeNull();
    expect(r!.name).toBe('Fairway 1');
  });

  it('returns null for point outside all regions', () => {
    const layout = makeSimpleLayout();
    const topology = courseLayoutToCourseData(layout).topology;
    const regions = deriveNamedRegions(layout, topology);
    const r = findRegionAtPosition(regions, 5, 5);
    expect(r).toBeNull();
  });

  it('finds feature region that overlays hole', () => {
    const layout = makeSimpleLayout();
    const topology = courseLayoutToCourseData(layout).topology;
    const regions = deriveNamedRegions(layout, topology);
    const r = findRegionAtPosition(regions, 30, 62);
    expect(r).not.toBeNull();
    expect(r!.name).toBe('Green 1');
  });
});
