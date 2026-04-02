import { describe, it, expect } from 'vitest';
import { generateStampTopology, stampIntoTopology, ShapeTemplate } from './shape-templates';
import { TERRAIN_CODES } from './terrain';
import { pointInPolygon } from './delaunay-topology';
import { deserializeTopology, type SerializedTopology } from './mesh-topology';

const simpleTemplate: ShapeTemplate = {
  name: 'Test',
  shape: 'circle',
  rings: [
    { radiusFraction: 1.0, pointCount: 8, terrainCode: TERRAIN_CODES.ROUGH },
    { radiusFraction: 0.5, pointCount: 6, terrainCode: TERRAIN_CODES.BUNKER },
  ],
  baseRadius: 3,
  centerTerrainCode: TERRAIN_CODES.BUNKER,
};

const flatElev = () => 0;

describe('shape-templates', () => {
  describe('generateStampTopology', () => {
    it('produces vertices including fill points for dense templates', () => {
      const denseTemplate: ShapeTemplate = {
        ...simpleTemplate,
        rings: [
          { radiusFraction: 1.0, pointCount: 24, terrainCode: TERRAIN_CODES.ROUGH },
          { radiusFraction: 0.5, pointCount: 16, terrainCode: TERRAIN_CODES.BUNKER },
        ],
      };
      const stamp = generateStampTopology(denseTemplate, 10, 10, flatElev);
      const ringCount = 1 + 24 + 16;
      expect(stamp.vertices.length).toBeGreaterThan(ringCount);
    });

    it('outer ring indices form closed boundary', () => {
      const stamp = generateStampTopology(simpleTemplate, 10, 10, flatElev);
      expect(stamp.outerRingIndices.length).toBe(8);
      for (const idx of stamp.outerRingIndices) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(stamp.vertices.length);
      }
    });

    it('uses getElevation callback for vertex Y', () => {
      const getElev = (x: number, z: number) => x + z;
      const stamp = generateStampTopology(simpleTemplate, 10, 10, getElev);
      const center = stamp.vertices[0];
      expect(center.y).toBeCloseTo(20);
    });

    it('boundary polygon contains all interior vertices', () => {
      const stamp = generateStampTopology(simpleTemplate, 10, 10, flatElev);
      const innerVerts = stamp.vertices.filter((_, i) =>
        !stamp.outerRingIndices.includes(i) && i !== 0
      );
      for (const v of innerVerts) {
        expect(pointInPolygon(v.x, v.z, stamp.boundaryPolygon)).toBe(true);
      }
    });

    it('centers stamp at given position', () => {
      const stamp = generateStampTopology(simpleTemplate, 20, 30, flatElev);
      const center = stamp.vertices[0];
      expect(center.x).toBeCloseTo(20);
      expect(center.z).toBeCloseTo(30);
    });
  });

  describe('stampIntoTopology', () => {
    function createGridTopology() {
      const size = 20;
      const step = 2;
      const vertices: SerializedTopology['vertices'] = [];
      const triangles: SerializedTopology['triangles'] = [];
      const grid: number[][] = [];
      let nextId = 0;
      let nextTriId = 0;

      for (let z = 0; z <= size; z += step) {
        const row: number[] = [];
        for (let x = 0; x <= size; x += step) {
          const id = nextId++;
          vertices.push({ id, position: { x, y: 0, z } });
          row.push(id);
        }
        grid.push(row);
      }

      for (let gy = 0; gy < grid.length - 1; gy++) {
        for (let gx = 0; gx < grid[0].length - 1; gx++) {
          const tl = grid[gy][gx], tr = grid[gy][gx + 1];
          const bl = grid[gy + 1][gx], br = grid[gy + 1][gx + 1];
          triangles.push({ id: nextTriId++, vertices: [tl, bl, tr], terrainCode: 0 });
          triangles.push({ id: nextTriId++, vertices: [tr, bl, br], terrainCode: 0 });
        }
      }

      return deserializeTopology({ vertices, triangles, worldWidth: size, worldHeight: size });
    }

    const smallTemplate: ShapeTemplate = {
      name: 'Small',
      shape: 'circle',
      rings: [
        { radiusFraction: 1.0, pointCount: 8, terrainCode: TERRAIN_CODES.BUNKER },
      ],
      baseRadius: 2,
      centerTerrainCode: TERRAIN_CODES.BUNKER,
    };

    it('stamps into center of grid topology', () => {
      const topology = createGridTopology();
      const initialTriCount = topology.triangles.size;
      const stamp = generateStampTopology(smallTemplate, 10, 10, flatElev);

      const result = stampIntoTopology(topology, stamp, smallTemplate, 10, 10);

      expect(result.newFaceIds.length).toBeGreaterThan(0);
      expect(result.newVertexIds.length).toBe(stamp.vertices.length);
      expect(topology.triangles.size).not.toBe(initialTriCount);
    });

    it('stamp triangles have correct terrain codes', () => {
      const topology = createGridTopology();
      const stamp = generateStampTopology(smallTemplate, 10, 10, flatElev);

      const result = stampIntoTopology(topology, stamp, smallTemplate, 10, 10);

      const bunkerFaces = result.newFaceIds.filter(id => {
        const tri = topology.triangles.get(id);
        return tri && tri.terrainCode === TERRAIN_CODES.BUNKER;
      });
      expect(bunkerFaces.length).toBeGreaterThan(0);
    });

    it('new vertices exist in topology', () => {
      const topology = createGridTopology();
      const stamp = generateStampTopology(smallTemplate, 10, 10, flatElev);

      const result = stampIntoTopology(topology, stamp, smallTemplate, 10, 10);

      for (const vid of result.newVertexIds) {
        expect(topology.vertices.has(vid)).toBe(true);
      }
    });

    it('topology is manifold after stamping (edges have 1-2 triangles)', () => {
      const topology = createGridTopology();
      const stamp = generateStampTopology(smallTemplate, 10, 10, flatElev);

      stampIntoTopology(topology, stamp, smallTemplate, 10, 10);

      for (const [, edge] of topology.edges) {
        expect(edge.triangles.length).toBeGreaterThanOrEqual(1);
        expect(edge.triangles.length).toBeLessThanOrEqual(2);
      }
    });
  });
});
