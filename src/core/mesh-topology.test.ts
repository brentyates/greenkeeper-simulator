import { describe, it, expect } from 'vitest';
import {
  createEmptyTopology,
  gridToTopology,
  findNearestEdge,
  subdivideEdge,
  deleteVertex,
  canDeleteVertex,
  isBoundaryVertex,
  findNearestTopologyVertex,
  buildMeshArrays,
  captureTopologyState,
  restoreTopologyState,
  computeFaceSlopeAngle,
  MAX_WALKABLE_SLOPE_DEGREES,
  Vec3,
} from './mesh-topology';

describe('mesh-topology', () => {
  describe('createEmptyTopology', () => {
    it('creates an empty topology with correct dimensions', () => {
      const topology = createEmptyTopology(10, 20);
      expect(topology.worldWidth).toBe(10);
      expect(topology.worldHeight).toBe(20);
      expect(topology.vertices.size).toBe(0);
      expect(topology.edges.size).toBe(0);
      expect(topology.triangles.size).toBe(0);
    });
  });

  describe('gridToTopology', () => {
    function createSimpleGrid(): Vec3[][] {
      return [
        [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }],
        [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, { x: 2, y: 0, z: 1 }],
        [{ x: 0, y: 0, z: 2 }, { x: 1, y: 0, z: 2 }, { x: 2, y: 0, z: 2 }],
      ];
    }

    it('converts a 3x3 grid to topology', () => {
      const grid = createSimpleGrid();
      const topology = gridToTopology(grid, 2, 2);

      expect(topology.vertices.size).toBe(9);
      expect(topology.triangles.size).toBe(8);
    });

    it('creates correct vertex positions', () => {
      const grid = createSimpleGrid();
      const topology = gridToTopology(grid, 2, 2);

      const positions = Array.from(topology.vertices.values()).map(v => v.position);
      expect(positions.some(p => p.x === 0 && p.z === 0)).toBe(true);
      expect(positions.some(p => p.x === 2 && p.z === 2)).toBe(true);
    });


    it('sets up vertex neighbors correctly', () => {
      const grid = createSimpleGrid();
      const topology = gridToTopology(grid, 2, 2);

      for (const vertex of topology.vertices.values()) {
        expect(vertex.neighbors.size).toBeGreaterThan(0);
        expect(vertex.neighbors.size).toBeLessThanOrEqual(8);
      }
    });
  });

  describe('findNearestEdge', () => {
    function createSimpleTopology() {
      const grid: Vec3[][] = [
        [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
        [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }],
      ];
      return gridToTopology(grid, 1, 1);
    }

    it('finds nearest edge to a point', () => {
      const topology = createSimpleTopology();
      const result = findNearestEdge(topology, 0.5, 0);

      expect(result).not.toBeNull();
      expect(result!.dist).toBeLessThan(0.1);
    });

    it('returns null when no edge is within max distance', () => {
      const topology = createSimpleTopology();
      const result = findNearestEdge(topology, 10, 10, 0.5);

      expect(result).toBeNull();
    });

    it('returns t parameter indicating position along edge', () => {
      const topology = createSimpleTopology();
      const result = findNearestEdge(topology, 0.5, 0, 1.0);

      expect(result).not.toBeNull();
      expect(result!.t).toBeGreaterThanOrEqual(0);
      expect(result!.t).toBeLessThanOrEqual(1);
    });
  });

  describe('subdivideEdge', () => {
    function createSimpleTopology() {
      const grid: Vec3[][] = [
        [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }],
        [{ x: 0, y: 0, z: 2 }, { x: 2, y: 0, z: 2 }],
      ];
      return gridToTopology(grid, 2, 2);
    }

    it('adds a new vertex at the midpoint', () => {
      const topology = createSimpleTopology();
      const initialVertexCount = topology.vertices.size;

      const edgeId = Array.from(topology.edges.keys())[0];
      const result = subdivideEdge(topology, edgeId, 0.5);

      expect(result).not.toBeNull();
      expect(topology.vertices.size).toBe(initialVertexCount + 1);
    });

    it('creates two new edges from the split', () => {
      const topology = createSimpleTopology();
      const initialEdgeCount = topology.edges.size;

      const edgeId = Array.from(topology.edges.keys())[0];
      const result = subdivideEdge(topology, edgeId);

      expect(result).not.toBeNull();
      expect(result!.newEdgeIds.length).toBe(2);
      expect(topology.edges.size).toBeGreaterThan(initialEdgeCount);
    });


    it('maintains mesh connectivity', () => {
      const topology = createSimpleTopology();
      const edgeId = Array.from(topology.edges.keys())[0];
      subdivideEdge(topology, edgeId, 0.5);

      for (const vertex of topology.vertices.values()) {
        expect(vertex.neighbors.size).toBeGreaterThan(0);
        for (const neighborId of vertex.neighbors) {
          const neighbor = topology.vertices.get(neighborId);
          expect(neighbor).toBeDefined();
          expect(neighbor!.neighbors.has(vertex.id)).toBe(true);
        }
      }
    });
  });

  describe('isBoundaryVertex', () => {
    function createSimpleTopology() {
      const grid: Vec3[][] = [
        [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }],
        [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, { x: 2, y: 0, z: 1 }],
        [{ x: 0, y: 0, z: 2 }, { x: 1, y: 0, z: 2 }, { x: 2, y: 0, z: 2 }],
      ];
      return gridToTopology(grid, 2, 2);
    }

    it('returns true for corner vertices', () => {
      const topology = createSimpleTopology();
      const cornerVertex = Array.from(topology.vertices.values()).find(
        v => v.position.x === 0 && v.position.z === 0
      );
      expect(cornerVertex).toBeDefined();
      expect(isBoundaryVertex(topology, cornerVertex!.id)).toBe(true);
    });

    it('returns false for interior vertices', () => {
      const topology = createSimpleTopology();
      const centerVertex = Array.from(topology.vertices.values()).find(
        v => v.position.x === 1 && v.position.z === 1
      );
      expect(centerVertex).toBeDefined();
      expect(isBoundaryVertex(topology, centerVertex!.id)).toBe(false);
    });
  });

  describe('canDeleteVertex', () => {
    function createSimpleTopology() {
      const grid: Vec3[][] = [
        [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }],
        [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, { x: 2, y: 0, z: 1 }],
        [{ x: 0, y: 0, z: 2 }, { x: 1, y: 0, z: 2 }, { x: 2, y: 0, z: 2 }],
      ];
      return gridToTopology(grid, 2, 2);
    }

    it('returns false for boundary vertices', () => {
      const topology = createSimpleTopology();
      const cornerVertex = Array.from(topology.vertices.values()).find(
        v => v.position.x === 0 && v.position.z === 0
      );
      expect(canDeleteVertex(topology, cornerVertex!.id)).toBe(false);
    });

    it('returns true for interior vertices with enough neighbors', () => {
      const topology = createSimpleTopology();
      const centerVertex = Array.from(topology.vertices.values()).find(
        v => v.position.x === 1 && v.position.z === 1
      );
      expect(centerVertex).toBeDefined();
      expect(canDeleteVertex(topology, centerVertex!.id)).toBe(true);
    });

    it('returns false when too few vertices remain', () => {
      const grid: Vec3[][] = [
        [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
        [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }],
      ];
      const topology = gridToTopology(grid, 1, 1);
      for (const vertex of topology.vertices.values()) {
        expect(canDeleteVertex(topology, vertex.id)).toBe(false);
      }
    });

    it('returns true for boundary vertices with 3+ neighbors from subdivision', () => {
      const grid: Vec3[][] = [
        [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }],
        [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, { x: 2, y: 0, z: 1 }],
        [{ x: 0, y: 0, z: 2 }, { x: 1, y: 0, z: 2 }, { x: 2, y: 0, z: 2 }],
      ];
      const topology = gridToTopology(grid, 2, 2);

      const boundaryEdge = Array.from(topology.edges.values()).find(
        e => e.triangles.length === 1
      );
      expect(boundaryEdge).toBeDefined();

      const result = subdivideEdge(topology, boundaryEdge!.id);
      expect(result).not.toBeNull();

      const newVertex = topology.vertices.get(result!.newVertexId);
      expect(newVertex).toBeDefined();
      expect(newVertex!.neighbors.size).toBeGreaterThanOrEqual(3);

      expect(isBoundaryVertex(topology, result!.newVertexId)).toBe(true);
      expect(canDeleteVertex(topology, result!.newVertexId)).toBe(true);
    });
  });

  describe('deleteVertex', () => {
    function createSimpleTopology() {
      const grid: Vec3[][] = [
        [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }],
        [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, { x: 2, y: 0, z: 1 }],
        [{ x: 0, y: 0, z: 2 }, { x: 1, y: 0, z: 2 }, { x: 2, y: 0, z: 2 }],
      ];
      return gridToTopology(grid, 2, 2);
    }

    it('removes the vertex from topology', () => {
      const topology = createSimpleTopology();
      const centerVertex = Array.from(topology.vertices.values()).find(
        v => v.position.x === 1 && v.position.z === 1
      );
      const initialCount = topology.vertices.size;

      const result = deleteVertex(topology, centerVertex!.id);

      expect(result).not.toBeNull();
      expect(topology.vertices.size).toBe(initialCount - 1);
      expect(topology.vertices.has(centerVertex!.id)).toBe(false);
    });

    it('retriangulates the hole', () => {
      const topology = createSimpleTopology();
      const centerVertex = Array.from(topology.vertices.values()).find(
        v => v.position.x === 1 && v.position.z === 1
      );

      deleteVertex(topology, centerVertex!.id);

      expect(topology.triangles.size).toBeGreaterThan(0);
    });

    it('returns null for non-deletable vertices', () => {
      const topology = createSimpleTopology();
      const cornerVertex = Array.from(topology.vertices.values()).find(
        v => v.position.x === 0 && v.position.z === 0
      );

      const result = deleteVertex(topology, cornerVertex!.id);

      expect(result).toBeNull();
    });
  });

  describe('findNearestTopologyVertex', () => {
    it('finds the nearest vertex to a world position', () => {
      const grid: Vec3[][] = [
        [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
        [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }],
      ];
      const topology = gridToTopology(grid, 1, 1);

      const result = findNearestTopologyVertex(topology, 0.1, 0.1);

      expect(result).not.toBeNull();
      const nearestVertex = topology.vertices.get(result!.vertexId);
      expect(nearestVertex!.position.x).toBe(0);
      expect(nearestVertex!.position.z).toBe(0);
    });
  });

  describe('buildMeshArrays', () => {
    it('generates arrays for rendering', () => {
      const grid: Vec3[][] = [
        [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
        [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }],
      ];
      const topology = gridToTopology(grid, 1, 1);

      const result = buildMeshArrays(topology, 1);

      expect(result.positions.length).toBe(6 * 3);
      expect(result.normals.length).toBe(6 * 3);
      expect(result.faceIds.length).toBe(6);
      expect(result.indices.length).toBe(2 * 3);
    });

    it('applies height unit scaling', () => {
      const grid: Vec3[][] = [
        [{ x: 0, y: 5, z: 0 }, { x: 1, y: 5, z: 0 }],
        [{ x: 0, y: 5, z: 1 }, { x: 1, y: 5, z: 1 }],
      ];
      const topology = gridToTopology(grid, 1, 1);

      const heightUnit = 2;
      const result = buildMeshArrays(topology, heightUnit);

      const yValues = [];
      for (let i = 1; i < result.positions.length; i += 3) {
        yValues.push(result.positions[i]);
      }
      expect(yValues.every(y => y === 10)).toBe(true);
    });
  });

  describe('captureTopologyState and restoreTopologyState', () => {
    it('captures and restores topology state', () => {
      const grid: Vec3[][] = [
        [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
        [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }],
      ];
      const topology = gridToTopology(grid, 1, 1);
      const originalVertexCount = topology.vertices.size;
      const originalTriangleCount = topology.triangles.size;

      const state = captureTopologyState(topology);

      const edgeId = Array.from(topology.edges.keys())[0];
      subdivideEdge(topology, edgeId);

      expect(topology.vertices.size).toBeGreaterThan(originalVertexCount);

      restoreTopologyState(topology, state);

      expect(topology.vertices.size).toBe(originalVertexCount);
      expect(topology.triangles.size).toBe(originalTriangleCount);
    });

    it('restores vertex positions correctly', () => {
      const grid: Vec3[][] = [
        [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
        [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }],
      ];
      const topology = gridToTopology(grid, 1, 1);

      const state = captureTopologyState(topology);

      const vertex = topology.vertices.get(0);
      if (vertex) {
        vertex.position.x = 99;
      }

      restoreTopologyState(topology, state);

      const restoredVertex = topology.vertices.get(0);
      expect(restoredVertex?.position.x).toBe(0);
    });
  });

  describe('computeFaceSlopeAngle', () => {
    it('returns 0 degrees for a flat face', () => {
      const grid: Vec3[][] = [
        [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
        [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }],
      ];
      const topology = gridToTopology(grid, 1, 1);
      const faceId = Array.from(topology.triangles.keys())[0];

      const angle = computeFaceSlopeAngle(topology, faceId, 1);
      expect(angle).toBeCloseTo(0, 1);
    });

    it('returns 45 degrees for a 45-degree slope', () => {
      const grid: Vec3[][] = [
        [{ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }],
        [{ x: 0, y: 1, z: 1 }, { x: 1, y: 0, z: 1 }],
      ];
      const topology = gridToTopology(grid, 1, 1);

      const faceId = Array.from(topology.triangles.keys())[0];
      const angle = computeFaceSlopeAngle(topology, faceId, 1);
      expect(angle).toBeCloseTo(45, 0);
    });

    it('returns 90 degrees for a vertical face', () => {
      const topology = createEmptyTopology(1, 1);
      const v0Id = topology.nextVertexId++;
      topology.vertices.set(v0Id, {
        id: v0Id, position: { x: 0, y: 0, z: 0 },
        neighbors: new Set(),
      });
      const v1Id = topology.nextVertexId++;
      topology.vertices.set(v1Id, {
        id: v1Id, position: { x: 0, y: 1, z: 0 },
        neighbors: new Set(),
      });
      const v2Id = topology.nextVertexId++;
      topology.vertices.set(v2Id, {
        id: v2Id, position: { x: 0, y: 0.5, z: 0 },
        neighbors: new Set(),
      });

      const triId = topology.nextTriangleId++;
      topology.triangles.set(triId, {
        id: triId,
        vertices: [v0Id, v1Id, v2Id],
        edges: [0, 0, 0],
        terrainCode: 0,
      });

      const angle = computeFaceSlopeAngle(topology, triId, 1);
      expect(angle).toBeCloseTo(90, 1);
    });

    it('returns 90 degrees for a degenerate triangle', () => {
      const topology = createEmptyTopology(1, 1);
      const v0Id = topology.nextVertexId++;
      topology.vertices.set(v0Id, {
        id: v0Id, position: { x: 0, y: 0, z: 0 },
        neighbors: new Set(),
      });
      const v1Id = topology.nextVertexId++;
      topology.vertices.set(v1Id, {
        id: v1Id, position: { x: 1, y: 0, z: 0 },
        neighbors: new Set(),
      });
      const v2Id = topology.nextVertexId++;
      topology.vertices.set(v2Id, {
        id: v2Id, position: { x: 2, y: 0, z: 0 },
        neighbors: new Set(),
      });

      const triId = topology.nextTriangleId++;
      topology.triangles.set(triId, {
        id: triId,
        vertices: [v0Id, v1Id, v2Id],
        edges: [0, 0, 0],
        terrainCode: 0,
      });

      const angle = computeFaceSlopeAngle(topology, triId, 1);
      expect(angle).toBe(90);
    });
  });

  describe('MAX_WALKABLE_SLOPE_DEGREES', () => {
    it('is 45', () => {
      expect(MAX_WALKABLE_SLOPE_DEGREES).toBe(45);
    });
  });
});
