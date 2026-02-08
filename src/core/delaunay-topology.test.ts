import { describe, it, expect } from 'vitest';
import { buildDelaunayTopology, pointInPolygon, TerrainRegion } from './delaunay-topology';
import { deserializeTopology, serializeTopology, barycentricInterpolateY, Vec3, getVertexNeighbors } from './mesh-topology';
import { TERRAIN_CODES } from './terrain';

describe('delaunay-topology', () => {
  describe('pointInPolygon', () => {
    const square = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 10 },
      { x: 0, z: 10 },
    ];

    it('returns true for point inside', () => {
      expect(pointInPolygon(5, 5, square)).toBe(true);
    });

    it('returns false for point outside', () => {
      expect(pointInPolygon(15, 5, square)).toBe(false);
    });

    it('handles concave polygon', () => {
      const concave = [
        { x: 0, z: 0 },
        { x: 10, z: 0 },
        { x: 10, z: 10 },
        { x: 5, z: 5 },
        { x: 0, z: 10 },
      ];
      expect(pointInPolygon(2, 5, concave)).toBe(true);
      expect(pointInPolygon(7, 8, concave)).toBe(false);
    });
  });

  describe('buildDelaunayTopology', () => {
    const circularFairway = makeCircleRegion(10, 10, 5, TERRAIN_CODES.FAIRWAY);

    it('produces valid topology with vertices and triangles', () => {
      const topo = buildDelaunayTopology({
        worldWidth: 20,
        worldHeight: 20,
        regions: [circularFairway],
        backgroundTerrainCode: TERRAIN_CODES.ROUGH,
        boundaryPointSpacing: 2,
        fillPointSpacing: 3,
      });

      expect(topo.vertices.length).toBeGreaterThan(0);
      expect(topo.triangles.length).toBeGreaterThan(0);
      expect(topo.worldWidth).toBe(20);
      expect(topo.worldHeight).toBe(20);
    });

    it('assigns correct terrain codes to regions', () => {
      const topo = buildDelaunayTopology({
        worldWidth: 20,
        worldHeight: 20,
        regions: [circularFairway],
        backgroundTerrainCode: TERRAIN_CODES.ROUGH,
        boundaryPointSpacing: 2,
        fillPointSpacing: 3,
      });

      const fairwayTriangles = topo.triangles.filter(t => t.terrainCode === TERRAIN_CODES.FAIRWAY);
      const roughTriangles = topo.triangles.filter(t => t.terrainCode === TERRAIN_CODES.ROUGH);

      expect(fairwayTriangles.length).toBeGreaterThan(0);
      expect(roughTriangles.length).toBeGreaterThan(0);
    });

    it('applies elevation from region config', () => {
      const elevated = makeCircleRegion(10, 10, 5, TERRAIN_CODES.GREEN);
      elevated.elevation = 3.0;

      const topo = buildDelaunayTopology({
        worldWidth: 20,
        worldHeight: 20,
        regions: [elevated],
        backgroundTerrainCode: TERRAIN_CODES.ROUGH,
        boundaryPointSpacing: 2,
        fillPointSpacing: 3,
      });

      const insideVerts = topo.vertices.filter(v => {
        const dx = v.position.x - 10;
        const dz = v.position.z - 10;
        return Math.sqrt(dx * dx + dz * dz) < 3;
      });

      expect(insideVerts.length).toBeGreaterThan(0);
      for (const v of insideVerts) {
        expect(v.position.y).toBe(3.0);
      }
    });

    it('applies elevationFn', () => {
      const region = makeCircleRegion(10, 10, 5, TERRAIN_CODES.GREEN);
      region.elevationFn = (x, z) => x * 0.1 + z * 0.2;

      const topo = buildDelaunayTopology({
        worldWidth: 20,
        worldHeight: 20,
        regions: [region],
        backgroundTerrainCode: TERRAIN_CODES.ROUGH,
        boundaryPointSpacing: 2,
        fillPointSpacing: 3,
      });

      const insideVerts = topo.vertices.filter(v => {
        const dx = v.position.x - 10;
        const dz = v.position.z - 10;
        return Math.sqrt(dx * dx + dz * dz) < 3;
      });

      for (const v of insideVerts) {
        expect(v.position.y).toBeCloseTo(v.position.x * 0.1 + v.position.z * 0.2, 5);
      }
    });

    it('handles multiple overlapping regions (last wins)', () => {
      const outer = makeCircleRegion(10, 10, 8, TERRAIN_CODES.FAIRWAY);
      const inner = makeCircleRegion(10, 10, 3, TERRAIN_CODES.GREEN);

      const topo = buildDelaunayTopology({
        worldWidth: 20,
        worldHeight: 20,
        regions: [outer, inner],
        backgroundTerrainCode: TERRAIN_CODES.ROUGH,
        boundaryPointSpacing: 2,
        fillPointSpacing: 3,
      });

      const centerTri = topo.triangles.find(t => {
        const cx = (topo.vertices[t.vertices[0]].position.x +
                    topo.vertices[t.vertices[1]].position.x +
                    topo.vertices[t.vertices[2]].position.x) / 3;
        const cz = (topo.vertices[t.vertices[0]].position.z +
                    topo.vertices[t.vertices[1]].position.z +
                    topo.vertices[t.vertices[2]].position.z) / 3;
        const dx = cx - 10;
        const dz = cz - 10;
        return Math.sqrt(dx * dx + dz * dz) < 2;
      });

      expect(centerTri).toBeDefined();
      expect(centerTri!.terrainCode).toBe(TERRAIN_CODES.GREEN);
    });
  });

  describe('serialization roundtrip', () => {
    it('survives serialize → deserialize', () => {
      const topo = buildDelaunayTopology({
        worldWidth: 15,
        worldHeight: 15,
        regions: [makeCircleRegion(7, 7, 4, TERRAIN_CODES.FAIRWAY)],
        backgroundTerrainCode: TERRAIN_CODES.ROUGH,
        boundaryPointSpacing: 2,
        fillPointSpacing: 3,
      });

      const deserialized = deserializeTopology(topo);
      const reserialized = serializeTopology(deserialized);

      expect(reserialized.vertices.length).toBe(topo.vertices.length);
      expect(reserialized.triangles.length).toBe(topo.triangles.length);
      expect(reserialized.worldWidth).toBe(topo.worldWidth);
      expect(reserialized.worldHeight).toBe(topo.worldHeight);

      expect(deserialized.vertices.size).toBe(topo.vertices.length);
      expect(deserialized.triangles.size).toBe(topo.triangles.length);
      expect(deserialized.edges.size).toBeGreaterThan(0);

      for (const [, v] of deserialized.vertices) {
        expect(getVertexNeighbors(deserialized, v.id).size).toBeGreaterThan(0);
      }
    });

    it('preserves terrain codes through roundtrip', () => {
      const topo = buildDelaunayTopology({
        worldWidth: 10,
        worldHeight: 10,
        regions: [makeCircleRegion(5, 5, 3, TERRAIN_CODES.GREEN)],
        backgroundTerrainCode: TERRAIN_CODES.ROUGH,
        boundaryPointSpacing: 1.5,
        fillPointSpacing: 2,
      });

      const deserialized = deserializeTopology(topo);

      for (const st of topo.triangles) {
        const tri = deserialized.triangles.get(st.id);
        expect(tri).toBeDefined();
        if (tri) {
          expect(tri.terrainCode).toBe(st.terrainCode);
        }
      }
    });
  });

  describe('barycentricInterpolateY', () => {
    it('returns exact vertex Y at vertex position', () => {
      const v0: Vec3 = { x: 0, y: 1, z: 0 };
      const v1: Vec3 = { x: 10, y: 2, z: 0 };
      const v2: Vec3 = { x: 5, y: 3, z: 10 };

      expect(barycentricInterpolateY(0, 0, v0, v1, v2)).toBeCloseTo(1, 5);
      expect(barycentricInterpolateY(10, 0, v0, v1, v2)).toBeCloseTo(2, 5);
      expect(barycentricInterpolateY(5, 10, v0, v1, v2)).toBeCloseTo(3, 5);
    });

    it('interpolates correctly at centroid', () => {
      const v0: Vec3 = { x: 0, y: 0, z: 0 };
      const v1: Vec3 = { x: 6, y: 3, z: 0 };
      const v2: Vec3 = { x: 3, y: 6, z: 6 };

      const cx = 3, cz = 2;
      const y = barycentricInterpolateY(cx, cz, v0, v1, v2);
      expect(y).toBeCloseTo(3, 5);
    });
  });
});

function makeCircleRegion(cx: number, cz: number, radius: number, terrainCode: number): TerrainRegion {
  const segments = 16;
  const boundary: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    boundary.push({
      x: cx + Math.cos(angle) * radius,
      z: cz + Math.sin(angle) * radius,
    });
  }
  return { terrainCode, boundary };
}
