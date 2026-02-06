import Delaunator from 'delaunator';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface GridUV {
  u: number;
  v: number;
}

export interface TerrainVertex {
  id: number;
  position: Vec3;
  gridUV: GridUV;
  neighbors: Set<number>;
}

export interface TerrainEdge {
  id: number;
  v1: number;
  v2: number;
  triangles: number[];
}

export interface TerrainTriangle {
  id: number;
  vertices: [number, number, number];
  edges: [number, number, number];
  terrainCode: number;
}

export interface TerrainMeshTopology {
  vertices: Map<number, TerrainVertex>;
  edges: Map<number, TerrainEdge>;
  triangles: Map<number, TerrainTriangle>;
  nextVertexId: number;
  nextEdgeId: number;
  nextTriangleId: number;
  worldWidth: number;
  worldHeight: number;
}

export function createEmptyTopology(worldWidth: number, worldHeight: number): TerrainMeshTopology {
  return {
    vertices: new Map(),
    edges: new Map(),
    triangles: new Map(),
    nextVertexId: 0,
    nextEdgeId: 0,
    nextTriangleId: 0,
    worldWidth,
    worldHeight,
  };
}

export function edgeKey(v1: number, v2: number): string {
  const minV = Math.min(v1, v2);
  const maxV = Math.max(v1, v2);
  return `${minV},${maxV}`;
}

export function gridToTopology(
  vertexPositions: Vec3[][],
  worldWidth: number,
  worldHeight: number,
  meshResolution: number
): TerrainMeshTopology {
  const topology = createEmptyTopology(worldWidth, worldHeight);
  const vertexHeight = vertexPositions.length;
  const vertexWidth = vertexPositions[0]?.length ?? 0;

  const gridVertexMap = new Map<string, number>();

  for (let vy = 0; vy < vertexHeight; vy++) {
    for (let vx = 0; vx < vertexWidth; vx++) {
      const pos = vertexPositions[vy][vx];
      const vertexId = topology.nextVertexId++;

      const originalX = vx / meshResolution;
      const originalZ = vy / meshResolution;

      const vertex: TerrainVertex = {
        id: vertexId,
        position: { ...pos },
        gridUV: {
          u: originalX / worldWidth,
          v: originalZ / worldHeight,
        },
        neighbors: new Set(),
      };

      topology.vertices.set(vertexId, vertex);
      gridVertexMap.set(`${vx},${vy}`, vertexId);
    }
  }

  const edgeIdMap = new Map<string, number>();

  function getOrCreateEdge(v1: number, v2: number): number {
    const key = edgeKey(v1, v2);
    let eid = edgeIdMap.get(key);
    if (eid === undefined) {
      eid = topology.nextEdgeId++;
      const edge: TerrainEdge = {
        id: eid,
        v1: Math.min(v1, v2),
        v2: Math.max(v1, v2),
        triangles: [],
      };
      topology.edges.set(eid, edge);
      edgeIdMap.set(key, eid);

      const vert1 = topology.vertices.get(v1);
      const vert2 = topology.vertices.get(v2);
      if (vert1) vert1.neighbors.add(v2);
      if (vert2) vert2.neighbors.add(v1);
    }
    return eid;
  }

  const gridH = vertexHeight - 1;
  const gridW = vertexWidth - 1;

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const topLeftId = gridVertexMap.get(`${gx},${gy}`)!;
      const topRightId = gridVertexMap.get(`${gx + 1},${gy}`)!;
      const bottomLeftId = gridVertexMap.get(`${gx},${gy + 1}`)!;
      const bottomRightId = gridVertexMap.get(`${gx + 1},${gy + 1}`)!;

      const e1 = getOrCreateEdge(topLeftId, bottomLeftId);
      const e2 = getOrCreateEdge(bottomLeftId, topRightId);
      const e3 = getOrCreateEdge(topRightId, topLeftId);

      const tri1Id = topology.nextTriangleId++;
      const tri1: TerrainTriangle = {
        id: tri1Id,
        vertices: [topLeftId, bottomLeftId, topRightId],
        edges: [e1, e2, e3],
        terrainCode: 0, // Default terrain code
      };
      topology.triangles.set(tri1Id, tri1);

      topology.edges.get(e1)!.triangles.push(tri1Id);
      topology.edges.get(e2)!.triangles.push(tri1Id);
      topology.edges.get(e3)!.triangles.push(tri1Id);

      const e4 = getOrCreateEdge(topRightId, bottomLeftId);
      const e5 = getOrCreateEdge(bottomLeftId, bottomRightId);
      const e6 = getOrCreateEdge(bottomRightId, topRightId);

      const tri2Id = topology.nextTriangleId++;
      const tri2: TerrainTriangle = {
        id: tri2Id,
        vertices: [topRightId, bottomLeftId, bottomRightId],
        edges: [e4, e5, e6],
        terrainCode: 0, // Default terrain code
      };
      topology.triangles.set(tri2Id, tri2);

      topology.edges.get(e4)!.triangles.push(tri2Id);
      topology.edges.get(e5)!.triangles.push(tri2Id);
      topology.edges.get(e6)!.triangles.push(tri2Id);
    }
  }

  return topology;
}

export function findNearestEdge(
  topology: TerrainMeshTopology,
  worldX: number,
  worldZ: number,
  maxDist: number = 0.5
): { edgeId: number; t: number; dist: number } | null {
  let nearestEdge: number | null = null;
  let nearestT = 0;
  let minDist = maxDist;

  for (const [edgeId, edge] of topology.edges) {
    const v1 = topology.vertices.get(edge.v1);
    const v2 = topology.vertices.get(edge.v2);
    if (!v1 || !v2) continue;

    const result = pointToEdgeDistance(
      worldX, worldZ,
      v1.position.x, v1.position.z,
      v2.position.x, v2.position.z
    );

    if (result.dist < minDist) {
      minDist = result.dist;
      nearestEdge = edgeId;
      nearestT = result.t;
    }
  }

  if (nearestEdge === null) return null;

  return { edgeId: nearestEdge, t: nearestT, dist: minDist };
}

function pointToEdgeDistance(
  px: number, pz: number,
  ax: number, az: number,
  bx: number, bz: number
): { dist: number; t: number } {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSq = dx * dx + dz * dz;

  if (lengthSq === 0) {
    const dist = Math.sqrt((px - ax) * (px - ax) + (pz - az) * (pz - az));
    return { dist, t: 0 };
  }

  let t = ((px - ax) * dx + (pz - az) * dz) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = ax + t * dx;
  const closestZ = az + t * dz;

  const dist = Math.sqrt(
    (px - closestX) * (px - closestX) + (pz - closestZ) * (pz - closestZ)
  );

  return { dist, t };
}

export interface SubdivideResult {
  newVertexId: number;
  newEdgeIds: [number, number];
  newTriangleIds: number[];
  removedTriangleIds: number[];
}

function computeSubdividedTriangleWinding(
  originalVerts: [number, number, number],
  edgeV1: number,
  edgeV2: number,
  midpointId: number,
  oppositeId: number
): [[number, number, number], [number, number, number]] {
  const idx1 = originalVerts.indexOf(edgeV1);
  const idx2 = originalVerts.indexOf(edgeV2);

  if (idx1 === -1 || idx2 === -1) {
    return [
      [edgeV1, midpointId, oppositeId],
      [midpointId, edgeV2, oppositeId],
    ];
  }

  if ((idx1 + 1) % 3 === idx2) {
    return [
      [edgeV1, midpointId, oppositeId],
      [midpointId, edgeV2, oppositeId],
    ];
  } else {
    return [
      [midpointId, edgeV1, oppositeId],
      [edgeV2, midpointId, oppositeId],
    ];
  }
}

export function subdivideEdge(
  topology: TerrainMeshTopology,
  edgeId: number,
  t: number = 0.5
): SubdivideResult | null {
  const edge = topology.edges.get(edgeId);
  if (!edge) return null;

  const v1 = topology.vertices.get(edge.v1);
  const v2 = topology.vertices.get(edge.v2);
  if (!v1 || !v2) return null;

  const newPos: Vec3 = {
    x: v1.position.x + t * (v2.position.x - v1.position.x),
    y: v1.position.y + t * (v2.position.y - v1.position.y),
    z: v1.position.z + t * (v2.position.z - v1.position.z),
  };

  const newUV: GridUV = {
    u: v1.gridUV.u + t * (v2.gridUV.u - v1.gridUV.u),
    v: v1.gridUV.v + t * (v2.gridUV.v - v1.gridUV.v),
  };

  const newVertexId = topology.nextVertexId++;
  const newVertex: TerrainVertex = {
    id: newVertexId,
    position: newPos,
    gridUV: newUV,
    neighbors: new Set([edge.v1, edge.v2]),
  };
  topology.vertices.set(newVertexId, newVertex);

  v1.neighbors.delete(edge.v2);
  v1.neighbors.add(newVertexId);
  v2.neighbors.delete(edge.v1);
  v2.neighbors.add(newVertexId);

  const newEdge1Id = topology.nextEdgeId++;
  const newEdge1: TerrainEdge = {
    id: newEdge1Id,
    v1: Math.min(edge.v1, newVertexId),
    v2: Math.max(edge.v1, newVertexId),
    triangles: [],
  };
  topology.edges.set(newEdge1Id, newEdge1);

  const newEdge2Id = topology.nextEdgeId++;
  const newEdge2: TerrainEdge = {
    id: newEdge2Id,
    v1: Math.min(edge.v2, newVertexId),
    v2: Math.max(edge.v2, newVertexId),
    triangles: [],
  };
  topology.edges.set(newEdge2Id, newEdge2);

  const removedTriangleIds: number[] = [];
  const newTriangleIds: number[] = [];

  for (const triId of edge.triangles) {
    const tri = topology.triangles.get(triId);
    if (!tri) continue;

    removedTriangleIds.push(triId);

    // Clean up triId from other edges of this triangle!
    for (const eid of tri.edges) {
        if (eid === edgeId) continue;
        const e = topology.edges.get(eid);
        if (e) {
            e.triangles = e.triangles.filter(tid => tid !== triId);
        }
    }

    const oppositeVertexId = tri.vertices.find(
      vid => vid !== edge.v1 && vid !== edge.v2
    );
    if (oppositeVertexId === undefined) continue;

    const oppositeVertex = topology.vertices.get(oppositeVertexId);
    if (!oppositeVertex) continue;

    newVertex.neighbors.add(oppositeVertexId);
    oppositeVertex.neighbors.add(newVertexId);

    const newConnectingEdgeId = topology.nextEdgeId++;
    const newConnectingEdge: TerrainEdge = {
      id: newConnectingEdgeId,
      v1: Math.min(newVertexId, oppositeVertexId),
      v2: Math.max(newVertexId, oppositeVertexId),
      triangles: [],
    };
    topology.edges.set(newConnectingEdgeId, newConnectingEdge);

    const [tri1Verts, tri2Verts] = computeSubdividedTriangleWinding(
      tri.vertices,
      edge.v1,
      edge.v2,
      newVertexId,
      oppositeVertexId
    );

    const tri1Id = topology.nextTriangleId++;
    const tri1Edges = findTriangleEdges(topology, tri1Verts, newEdge1Id, newConnectingEdgeId);
    const tri1: TerrainTriangle = {
      id: tri1Id,
      vertices: tri1Verts,
      edges: tri1Edges,
      terrainCode: tri.terrainCode, // Inherit terrain code
    };
    topology.triangles.set(tri1Id, tri1);
    newTriangleIds.push(tri1Id);

    for (const eid of tri1Edges) {
      const e = topology.edges.get(eid);
      if (e) e.triangles.push(tri1Id);
    }

    const tri2Id = topology.nextTriangleId++;
    const tri2Edges = findTriangleEdges(topology, tri2Verts, newEdge2Id, newConnectingEdgeId);
    const tri2: TerrainTriangle = {
      id: tri2Id,
      vertices: tri2Verts,
      edges: tri2Edges,
      terrainCode: tri.terrainCode, // Inherit terrain code
    };
    topology.triangles.set(tri2Id, tri2);
    newTriangleIds.push(tri2Id);

    for (const eid of tri2Edges) {
      const e = topology.edges.get(eid);
      if (e && !e.triangles.includes(tri2Id)) e.triangles.push(tri2Id);
    }

    topology.triangles.delete(triId);
  }

  topology.edges.delete(edgeId);

  return {
    newVertexId,
    newEdgeIds: [newEdge1Id, newEdge2Id],
    newTriangleIds,
    removedTriangleIds,
  };
}

function findTriangleEdges(
  topology: TerrainMeshTopology,
  vertices: [number, number, number],
  _knownEdge1: number,
  _knownEdge2: number
): [number, number, number] {
  const edges: number[] = [];
  const pairs: Array<[number, number]> = [
    [vertices[0], vertices[1]],
    [vertices[1], vertices[2]],
    [vertices[2], vertices[0]],
  ];

  for (const [va, vb] of pairs) {
    const key = edgeKey(va, vb);
    let foundEdge: number | null = null;

    for (const [eid, e] of topology.edges) {
      if (edgeKey(e.v1, e.v2) === key) {
        foundEdge = eid;
        break;
      }
    }

    if (foundEdge !== null) {
      edges.push(foundEdge);
    }
  }

  return edges as [number, number, number];
}

export function isBoundaryVertex(topology: TerrainMeshTopology, vertexId: number): boolean {
  const vertex = topology.vertices.get(vertexId);
  if (!vertex) return true;

  for (const [, edge] of topology.edges) {
    if ((edge.v1 === vertexId || edge.v2 === vertexId) && edge.triangles.length < 2) {
      return true;
    }
  }

  return false;
}

export function canDeleteVertex(topology: TerrainMeshTopology, vertexId: number): boolean {
  if (topology.vertices.size <= 4) return false;

  const vertex = topology.vertices.get(vertexId);
  if (!vertex) return false;

  if (isBoundaryVertex(topology, vertexId) && vertex.neighbors.size < 3) {
    return false;
  }

  return true;
}

export interface DeleteVertexResult {
  removedTriangleIds: number[];
  removedEdgeIds: number[];
  newTriangleIds: number[];
  newEdgeIds: number[];
}

export function deleteVertex(
  topology: TerrainMeshTopology,
  vertexId: number
): DeleteVertexResult | null {
  if (!canDeleteVertex(topology, vertexId)) return null;

  const vertex = topology.vertices.get(vertexId);
  if (!vertex) return null;

  const removedTriangleIds: number[] = [];
  const removedEdgeIds: number[] = [];
  const trianglesToRemove: number[] = [];

  for (const [triId, tri] of topology.triangles) {
    if (tri.vertices.includes(vertexId)) {
      trianglesToRemove.push(triId);
    }
  }

  const holeVertices = findOrderedHoleVertices(topology, vertexId, trianglesToRemove);
  if (!holeVertices || holeVertices.length < 3) return null;

  for (const triId of trianglesToRemove) {
    const tri = topology.triangles.get(triId);
    if (tri) {
      for (const eid of tri.edges) {
        const edge = topology.edges.get(eid);
        if (edge) {
          edge.triangles = edge.triangles.filter(tid => tid !== triId);
        }
      }
      topology.triangles.delete(triId);
      removedTriangleIds.push(triId);
    }
  }

  const edgesToRemove: number[] = [];
  for (const [eid, edge] of topology.edges) {
    if (edge.v1 === vertexId || edge.v2 === vertexId) {
      edgesToRemove.push(eid);
    }
  }

  for (const eid of edgesToRemove) {
    topology.edges.delete(eid);
    removedEdgeIds.push(eid);
  }

  for (const neighborId of vertex.neighbors) {
    const neighbor = topology.vertices.get(neighborId);
    if (neighbor) {
      neighbor.neighbors.delete(vertexId);
    }
  }

  topology.vertices.delete(vertexId);

  const { newTriangleIds, newEdgeIds } = retriangulateHole(topology, holeVertices);

  return {
    removedTriangleIds,
    removedEdgeIds,
    newTriangleIds,
    newEdgeIds,
  };
}

export function collapseEdge(
  topology: TerrainMeshTopology,
  edgeId: number
): { survivingVertexId: number } | null {
  const edge = topology.edges.get(edgeId);
  if (!edge) return null;

  const v1 = topology.vertices.get(edge.v1);
  const v2 = topology.vertices.get(edge.v2);
  if (!v1 || !v2) return null;

  const survivingVertex = v1;
  const survivingId = edge.v1;
  const removedId = edge.v2;

  survivingVertex.position = {
    x: (v1.position.x + v2.position.x) / 2,
    y: (v1.position.y + v2.position.y) / 2,
    z: (v1.position.z + v2.position.z) / 2,
  };
  survivingVertex.gridUV = {
    u: (v1.gridUV.u + v2.gridUV.u) / 2,
    v: (v1.gridUV.v + v2.gridUV.v) / 2,
  };

  const trianglesToRemove: number[] = [];
  for (const triId of edge.triangles) {
    trianglesToRemove.push(triId);
  }

  for (const triId of trianglesToRemove) {
    const tri = topology.triangles.get(triId);
    if (tri) {
      for (const eid of tri.edges) {
        const e = topology.edges.get(eid);
        if (e) {
          e.triangles = e.triangles.filter(t => t !== triId);
        }
      }
      topology.triangles.delete(triId);
    }
  }

  const edgesToRemove: number[] = [edgeId];
  for (const [eid, e] of topology.edges) {
    if (eid === edgeId) continue;

    if (e.v1 === removedId) {
      const otherV = e.v2;
      if (otherV === survivingId) {
        edgesToRemove.push(eid);
      } else {
        e.v1 = survivingId;
        survivingVertex.neighbors.add(otherV);
        const otherVertex = topology.vertices.get(otherV);
        if (otherVertex) {
          otherVertex.neighbors.delete(removedId);
          otherVertex.neighbors.add(survivingId);
        }
      }
    } else if (e.v2 === removedId) {
      const otherV = e.v1;
      if (otherV === survivingId) {
        edgesToRemove.push(eid);
      } else {
        e.v2 = survivingId;
        survivingVertex.neighbors.add(otherV);
        const otherVertex = topology.vertices.get(otherV);
        if (otherVertex) {
          otherVertex.neighbors.delete(removedId);
          otherVertex.neighbors.add(survivingId);
        }
      }
    }
  }

  for (const [, tri] of topology.triangles) {
    for (let i = 0; i < tri.vertices.length; i++) {
      if (tri.vertices[i] === removedId) {
        tri.vertices[i] = survivingId;
      }
    }
  }

  for (const eid of edgesToRemove) {
    topology.edges.delete(eid);
  }

  survivingVertex.neighbors.delete(removedId);
  topology.vertices.delete(removedId);

  return { survivingVertexId: survivingId };
}

function findOrderedHoleVertices(
  topology: TerrainMeshTopology,
  deletedVertexId: number,
  triangleIds: number[]
): number[] | null {
  if (triangleIds.length === 0) return null;

  const neighborEdges: Array<{ v1: number; v2: number }> = [];

  for (const triId of triangleIds) {
    const tri = topology.triangles.get(triId);
    if (!tri) continue;

    const otherVerts = tri.vertices.filter(v => v !== deletedVertexId);
    if (otherVerts.length === 2) {
      neighborEdges.push({ v1: otherVerts[0], v2: otherVerts[1] });
    }
  }

  if (neighborEdges.length === 0) return null;

  const ordered: number[] = [neighborEdges[0].v1, neighborEdges[0].v2];
  const usedEdges = new Set<number>([0]);

  while (usedEdges.size < neighborEdges.length) {
    let found = false;
    for (let i = 0; i < neighborEdges.length; i++) {
      if (usedEdges.has(i)) continue;

      const edge = neighborEdges[i];
      const lastVertex = ordered[ordered.length - 1];

      if (edge.v1 === lastVertex && !ordered.includes(edge.v2)) {
        ordered.push(edge.v2);
        usedEdges.add(i);
        found = true;
        break;
      } else if (edge.v2 === lastVertex && !ordered.includes(edge.v1)) {
        ordered.push(edge.v1);
        usedEdges.add(i);
        found = true;
        break;
      }
    }

    if (!found) break;
  }

  return ordered;
}

function retriangulateHole(
  topology: TerrainMeshTopology,
  holeVertices: number[]
): { newTriangleIds: number[]; newEdgeIds: number[] } {
  const newTriangleIds: number[] = [];
  const newEdgeIds: number[] = [];

  if (holeVertices.length < 3) {
    return { newTriangleIds, newEdgeIds };
  }

  if (holeVertices.length === 3) {
    const triId = createTriangle(topology, holeVertices[0], holeVertices[1], holeVertices[2]);
    if (triId !== null) newTriangleIds.push(triId);
    return { newTriangleIds, newEdgeIds };
  }

  const coords: number[] = [];
  for (const vid of holeVertices) {
    const v = topology.vertices.get(vid);
    if (v) {
      coords.push(v.position.x, v.position.z);
    }
  }

  const delaunay = new Delaunator(coords);

  for (let i = 0; i < delaunay.triangles.length; i += 3) {
    const i0 = delaunay.triangles[i];
    const i1 = delaunay.triangles[i + 1];
    const i2 = delaunay.triangles[i + 2];

    const v0 = holeVertices[i0];
    const v1 = holeVertices[i1];
    const v2 = holeVertices[i2];

    const triId = createTriangle(topology, v0, v1, v2);
    if (triId !== null) newTriangleIds.push(triId);
  }

  return { newTriangleIds, newEdgeIds };
}

function createTriangle(
  topology: TerrainMeshTopology,
  v0: number,
  v1: number,
  v2: number
): number | null {
  const vert0 = topology.vertices.get(v0);
  const vert1 = topology.vertices.get(v1);
  const vert2 = topology.vertices.get(v2);

  if (!vert0 || !vert1 || !vert2) return null;

  const triId = topology.nextTriangleId++;
  const edges: [number, number, number] = [
    getOrCreateEdgeForTriangle(topology, v0, v1, triId),
    getOrCreateEdgeForTriangle(topology, v1, v2, triId),
    getOrCreateEdgeForTriangle(topology, v2, v0, triId),
  ];

  const tri: TerrainTriangle = {
    id: triId,
    vertices: [v0, v1, v2],
    edges,
    terrainCode: 0, // Default terrain code
  };

  topology.triangles.set(triId, tri);

  vert0.neighbors.add(v1);
  vert0.neighbors.add(v2);
  vert1.neighbors.add(v0);
  vert1.neighbors.add(v2);
  vert2.neighbors.add(v0);
  vert2.neighbors.add(v1);

  return triId;
}

function getOrCreateEdgeForTriangle(
  topology: TerrainMeshTopology,
  v1: number,
  v2: number,
  triId: number
): number {
  const key = edgeKey(v1, v2);

  for (const [eid, edge] of topology.edges) {
    if (edgeKey(edge.v1, edge.v2) === key) {
      if (!edge.triangles.includes(triId)) {
        edge.triangles.push(triId);
      }
      return eid;
    }
  }

  const newEdgeId = topology.nextEdgeId++;
  const newEdge: TerrainEdge = {
    id: newEdgeId,
    v1: Math.min(v1, v2),
    v2: Math.max(v1, v2),
    triangles: [triId],
  };
  topology.edges.set(newEdgeId, newEdge);

  return newEdgeId;
}

export function buildMeshArrays(
  topology: TerrainMeshTopology,
  heightUnit: number = 1
): {
  positions: number[];
  indices: number[];
  uvs: number[];
  normals: number[];
  terrainTypes: number[];
  faceIds: number[];
  vertexIdMap: Map<number, number[]>;
} {
  const positions: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  const normals: number[] = [];
  const terrainTypes: number[] = [];
  const faceIds: number[] = [];

  const vertexIdMap = new Map<number, number[]>();

  let nextIndex = 0;

  for (const [triId, tri] of topology.triangles) {
    const terrainCode = tri.terrainCode ?? 0;
    const triIndices: number[] = [];

    for (const vId of tri.vertices) {
      const vertex = topology.vertices.get(vId);
      if (!vertex) continue;

      const idx = nextIndex++;

      const existing = vertexIdMap.get(vId) || [];
      existing.push(idx);
      vertexIdMap.set(vId, existing);

      positions.push(vertex.position.x, vertex.position.y * heightUnit, vertex.position.z);
      uvs.push(vertex.gridUV.u, vertex.gridUV.v);
      normals.push(0, 1, 0);
      terrainTypes.push(terrainCode);
      faceIds.push(triId);

      triIndices.push(idx);
    }

    if (triIndices.length === 3) {
      indices.push(triIndices[0], triIndices[1], triIndices[2]);
    }
  }

  computeNormals(positions, indices, normals);

  for (const [, bufferIndices] of vertexIdMap) {
    if (bufferIndices.length <= 1) continue;
    let nx = 0, ny = 0, nz = 0;
    for (const idx of bufferIndices) {
      nx += normals[idx * 3];
      ny += normals[idx * 3 + 1];
      nz += normals[idx * 3 + 2];
    }
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 0) { nx /= len; ny /= len; nz /= len; }
    for (const idx of bufferIndices) {
      normals[idx * 3] = nx;
      normals[idx * 3 + 1] = ny;
      normals[idx * 3 + 2] = nz;
    }
  }

  return { positions, indices, uvs, normals, terrainTypes, faceIds, vertexIdMap };
}

function computeNormals(positions: number[], indices: number[], normals: number[]): void {
  for (let i = 0; i < normals.length; i++) {
    normals[i] = 0;
  }

  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i];
    const i1 = indices[i + 1];
    const i2 = indices[i + 2];

    const p0x = positions[i0 * 3];
    const p0y = positions[i0 * 3 + 1];
    const p0z = positions[i0 * 3 + 2];

    const p1x = positions[i1 * 3];
    const p1y = positions[i1 * 3 + 1];
    const p1z = positions[i1 * 3 + 2];

    const p2x = positions[i2 * 3];
    const p2y = positions[i2 * 3 + 1];
    const p2z = positions[i2 * 3 + 2];

    const ax = p1x - p0x;
    const ay = p1y - p0y;
    const az = p1z - p0z;

    const bx = p2x - p0x;
    const by = p2y - p0y;
    const bz = p2z - p0z;

    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;

    normals[i0 * 3] += nx;
    normals[i0 * 3 + 1] += ny;
    normals[i0 * 3 + 2] += nz;

    normals[i1 * 3] += nx;
    normals[i1 * 3 + 1] += ny;
    normals[i1 * 3 + 2] += nz;

    normals[i2 * 3] += nx;
    normals[i2 * 3 + 1] += ny;
    normals[i2 * 3 + 2] += nz;
  }

  for (let i = 0; i < normals.length; i += 3) {
    const nx = normals[i];
    const ny = normals[i + 1];
    const nz = normals[i + 2];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 0) {
      normals[i] /= len;
      normals[i + 1] /= len;
      normals[i + 2] /= len;
    }
  }
}

export function findNearestTopologyVertex(
  topology: TerrainMeshTopology,
  worldX: number,
  worldZ: number
): { vertexId: number; dist: number } | null {
  let nearestId: number | null = null;
  let minDistSq = Infinity;

  for (const [vertexId, vertex] of topology.vertices) {
    const dx = vertex.position.x - worldX;
    const dz = vertex.position.z - worldZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < minDistSq) {
      minDistSq = distSq;
      nearestId = vertexId;
    }
  }

  if (nearestId === null) return null;

  return { vertexId: nearestId, dist: Math.sqrt(minDistSq) };
}

export interface TopologyModification {
  type: 'subdivide' | 'delete' | 'collapse' | 'flip';
  vertexId?: number;
  edgeId?: number;
  subdivideT?: number;
  beforeState: {
    vertices: Array<{ id: number; vertex: TerrainVertex }>;
    edges: Array<{ id: number; edge: TerrainEdge }>;
    triangles: Array<{ id: number; triangle: TerrainTriangle }>;
    nextVertexId: number;
    nextEdgeId: number;
    nextTriangleId: number;
  };
}

export function captureTopologyState(topology: TerrainMeshTopology): TopologyModification['beforeState'] {
  const vertices: Array<{ id: number; vertex: TerrainVertex }> = [];
  const edges: Array<{ id: number; edge: TerrainEdge }> = [];
  const triangles: Array<{ id: number; triangle: TerrainTriangle }> = [];

  for (const [id, vertex] of topology.vertices) {
    vertices.push({
      id,
      vertex: {
        id: vertex.id,
        position: { ...vertex.position },
        gridUV: { ...vertex.gridUV },
        neighbors: new Set(vertex.neighbors),
      },
    });
  }

  for (const [id, edge] of topology.edges) {
    edges.push({
      id,
      edge: {
        id: edge.id,
        v1: edge.v1,
        v2: edge.v2,
        triangles: [...edge.triangles],
      },
    });
  }

  for (const [id, triangle] of topology.triangles) {
    triangles.push({
      id,
      triangle: {
        id: triangle.id,
        vertices: [...triangle.vertices] as [number, number, number],
        edges: [...triangle.edges] as [number, number, number],
        terrainCode: triangle.terrainCode,
      },
    });
  }

  return {
    vertices,
    edges,
    triangles,
    nextVertexId: topology.nextVertexId,
    nextEdgeId: topology.nextEdgeId,
    nextTriangleId: topology.nextTriangleId,
  };
}

export function restoreTopologyState(
  topology: TerrainMeshTopology,
  state: TopologyModification['beforeState']
): void {
  topology.vertices.clear();
  topology.edges.clear();
  topology.triangles.clear();

  for (const { id, vertex } of state.vertices) {
    topology.vertices.set(id, {
      id: vertex.id,
      position: { ...vertex.position },
      gridUV: { ...vertex.gridUV },
      neighbors: new Set(vertex.neighbors),
    });
  }

  for (const { id, edge } of state.edges) {
    topology.edges.set(id, {
      id: edge.id,
      v1: edge.v1,
      v2: edge.v2,
      triangles: [...edge.triangles],
    });
  }

  for (const { id, triangle } of state.triangles) {
    topology.triangles.set(id, {
      id: triangle.id,
      vertices: [...triangle.vertices] as [number, number, number],
      edges: [...triangle.edges] as [number, number, number],
      terrainCode: triangle.terrainCode,
    });
  }


  topology.nextVertexId = state.nextVertexId;
  topology.nextEdgeId = state.nextEdgeId;
  topology.nextTriangleId = state.nextTriangleId;
}

export function flipEdge(
  topology: TerrainMeshTopology,
  edgeId: number
): boolean {
  const edge = topology.edges.get(edgeId);
  if (!edge) {
      console.warn(`FlipEdge: Edge ${edgeId} not found`);
      return false;
  }

  // Defensive: Clean up any ghost triangles before checking
  edge.triangles = edge.triangles.filter(tid => topology.triangles.has(tid));
  
  if (edge.triangles.length !== 2) {
      console.warn(`FlipEdge: Edge ${edgeId} is not an interior edge (triangles: ${edge.triangles.length})`, {triIds: edge.triangles});
      return false;
  }

  const t1Id = edge.triangles[0];
  const t2Id = edge.triangles[1];
  const t1 = topology.triangles.get(t1Id);
  const t2 = topology.triangles.get(t2Id);
  if (!t1 || !t2) {
      console.warn(`FlipEdge: Triangle(s) not found`, {t1Id, t2Id});
      return false;
  }

  const v1 = edge.v1;
  const v2 = edge.v2;

  // Find opposite vertices
  const o1 = t1.vertices.find(v => v !== v1 && v !== v2);
  const o2 = t2.vertices.find(v => v !== v1 && v !== v2);

  if (o1 === undefined || o2 === undefined) {
      console.warn(`FlipEdge: Could not find opposite vertices`, {v1, v2, t1Verts: t1.vertices, t2Verts: t2.vertices});
      return false;
  }

  // Check if o1 and o2 are already connected to avoid duplicate edges
  for (const [, otherEdge] of topology.edges) {
      if ((otherEdge.v1 === o1 && otherEdge.v2 === o2) || (otherEdge.v1 === o2 && otherEdge.v2 === o1)) {
          console.warn(`FlipEdge: Opposite vertices ${o1} and ${o2} are already connected by edge ${otherEdge.id}`);
          return false;
      }
  }

  // Retrieve vertex objects for position check
  const vert1 = topology.vertices.get(v1);
  const vert2 = topology.vertices.get(v2);
  const vertO1 = topology.vertices.get(o1);
  const vertO2 = topology.vertices.get(o2);

  if (!vert1 || !vert2 || !vertO1 || !vertO2) {
      console.warn(`FlipEdge: Vertex objects not found`);
      return false;
  }

  // Check for convexity (diagonals must intersect)
  if (!segmentsIntersect(
      vert1.position.x, vert1.position.z,
      vert2.position.x, vert2.position.z,
      vertO1.position.x, vertO1.position.z,
      vertO2.position.x, vertO2.position.z
  )) {
      console.warn(`FlipEdge: Quadrilateral is not convex (diagonals do not intersect)`);
      return false;
  }

  // --- Proceed with Flip ---

  // 1. Identify Boundary Edges
  // Find edge connecting v2 and o1 (in T1)
  const e_v2_o1_id = t1.edges.find(eid => {
      if (eid === edgeId) return false;
      const e = topology.edges.get(eid);
      if (!e) return false;
      return (e.v1 === v2 && e.v2 === o1) || (e.v1 === o1 && e.v2 === v2);
  });

  // Find edge connecting o1 and v1 (in T1)
  const e_o1_v1_id = t1.edges.find(eid => {
      if (eid === edgeId) return false;
      const e = topology.edges.get(eid);
      if (!e) return false;
      return (e.v1 === o1 && e.v2 === v1) || (e.v1 === v1 && e.v2 === o1);
  });

  // Find edge connecting v1 and o2 (in T2)
  const e_v1_o2_id = t2.edges.find(eid => {
      if (eid === edgeId) return false;
      const e = topology.edges.get(eid);
      if (!e) return false;
      return (e.v1 === v1 && e.v2 === o2) || (e.v1 === o2 && e.v2 === v1);
  });

  // Find edge connecting o2 and v2 (in T2)
  const e_o2_v2_id = t2.edges.find(eid => {
      if (eid === edgeId) return false;
      const e = topology.edges.get(eid);
      if (!e) return false;
      return (e.v1 === o2 && e.v2 === v2) || (e.v1 === v2 && e.v2 === o2);
  });

  if (e_v2_o1_id === undefined || e_o1_v1_id === undefined || e_v1_o2_id === undefined || e_o2_v2_id === undefined) {
      console.warn("FlipEdge: Could not find all boundary edges", {e_v2_o1_id, e_o1_v1_id, e_v1_o2_id, e_o2_v2_id});
      return false;
  }

  // 2. Update Vertex Neighbors
  // Remove v1-v2 connection
  vert1.neighbors.delete(v2);
  vert2.neighbors.delete(v1);
  // Add o1-o2 connection
  vertO1.neighbors.add(o2);
  vertO2.neighbors.add(o1);

  // 3. Update shared edge to be o1-o2
  edge.v1 = Math.min(o1, o2);
  edge.v2 = Math.max(o1, o2);

  // 4. Update Triangles and Winding
  // New T1 vertices should be (v1, o1, o2) or (v1, o2, o1) depending on CCW
  if (ccw(vert1.position.x, vert1.position.z, vertO1.position.x, vertO1.position.z, vertO2.position.x, vertO2.position.z)) {
    t1.vertices = [v1, o1, o2];
    t1.edges = [e_o1_v1_id, edgeId, e_v1_o2_id];
  } else {
    t1.vertices = [v1, o2, o1];
    t1.edges = [e_v1_o2_id, edgeId, e_o1_v1_id];
  }

  // New T2 vertices should be (v2, o2, o1) or (v2, o1, o2) depending on CCW
  if (ccw(vert2.position.x, vert2.position.z, vertO2.position.x, vertO2.position.z, vertO1.position.x, vertO1.position.z)) {
    t2.vertices = [v2, o2, o1];
    t2.edges = [e_o2_v2_id, edgeId, e_v2_o1_id];
  } else {
    t2.vertices = [v2, o1, o2];
    t2.edges = [e_v2_o1_id, edgeId, e_o2_v2_id];
  }

  // 5. Update Edge Triangle Membership
  // e_v1_o2 and e_v2_o1 might have changed triangle membership
  moveEdgeToTriangle(topology, e_v1_o2_id, t2Id, t1Id);
  moveEdgeToTriangle(topology, e_v2_o1_id, t1Id, t2Id);

  return true;
}

function moveEdgeToTriangle(topology: TerrainMeshTopology, edgeId: number, fromTri: number, toTri: number) {
    const e = topology.edges.get(edgeId);
    if (e) {
        const idx = e.triangles.indexOf(fromTri);
        if (idx !== -1) {
            e.triangles.splice(idx, 1);
        }
        if (!e.triangles.includes(toTri)) {
            e.triangles.push(toTri);
        }
    }
}

// CCW of A,B,C
function ccw(ax: number, az: number, bx: number, bz: number, cx: number, cz: number): boolean {
    return (cz - az) * (bx - ax) > (bz - az) * (cx - ax);
}

function segmentsIntersect(
    ax: number, az: number, bx: number, bz: number,
    cx: number, cz: number, dx: number, dz: number
): boolean {
    return ccw(ax, az, cx, cz, dx, dz) !== ccw(bx, bz, cx, cz, dx, dz) &&
           ccw(ax, az, bx, bz, cx, cz) !== ccw(ax, az, bx, bz, dx, dz);
}

export interface SerializedVertex {
  id: number;
  position: Vec3;
  gridUV: GridUV;
}

export interface SerializedTriangle {
  id: number;
  vertices: [number, number, number];
  terrainCode: number;
}

export interface SerializedTopology {
  vertices: SerializedVertex[];
  triangles: SerializedTriangle[];
  worldWidth: number;
  worldHeight: number;
}

export function serializeTopology(topology: TerrainMeshTopology): SerializedTopology {
  const vertices: SerializedVertex[] = [];
  for (const [, v] of topology.vertices) {
    vertices.push({
      id: v.id,
      position: { ...v.position },
      gridUV: { ...v.gridUV },
    });
  }

  const triangles: SerializedTriangle[] = [];
  for (const [, tri] of topology.triangles) {
    triangles.push({
      id: tri.id,
      vertices: [...tri.vertices] as [number, number, number],
      terrainCode: tri.terrainCode,
    });
  }

  return {
    vertices,
    triangles,
    worldWidth: topology.worldWidth,
    worldHeight: topology.worldHeight,
  };
}

export function deserializeTopology(data: SerializedTopology): TerrainMeshTopology {
  const topology = createEmptyTopology(data.worldWidth, data.worldHeight);

  let maxVertexId = -1;
  for (const sv of data.vertices) {
    topology.vertices.set(sv.id, {
      id: sv.id,
      position: { ...sv.position },
      gridUV: { ...sv.gridUV },
      neighbors: new Set(),
    });
    if (sv.id > maxVertexId) maxVertexId = sv.id;
  }
  topology.nextVertexId = maxVertexId + 1;

  let maxTriId = -1;
  for (const st of data.triangles) {
    const triId = createTriangleFromSerialized(topology, st.vertices[0], st.vertices[1], st.vertices[2]);
    if (triId !== null) {
      const tri = topology.triangles.get(triId);
      if (tri) tri.terrainCode = st.terrainCode;
    }
    if (st.id > maxTriId) maxTriId = st.id;
  }
  if (maxTriId >= topology.nextTriangleId) {
    topology.nextTriangleId = maxTriId + 1;
  }

  return topology;
}

function createTriangleFromSerialized(
  topology: TerrainMeshTopology,
  v0: number,
  v1: number,
  v2: number
): number | null {
  const vert0 = topology.vertices.get(v0);
  const vert1 = topology.vertices.get(v1);
  const vert2 = topology.vertices.get(v2);
  if (!vert0 || !vert1 || !vert2) return null;

  const triId = topology.nextTriangleId++;
  const edges: [number, number, number] = [
    getOrCreateEdgeForTriangle(topology, v0, v1, triId),
    getOrCreateEdgeForTriangle(topology, v1, v2, triId),
    getOrCreateEdgeForTriangle(topology, v2, v0, triId),
  ];

  const tri: TerrainTriangle = {
    id: triId,
    vertices: [v0, v1, v2],
    edges,
    terrainCode: 0,
  };

  topology.triangles.set(triId, tri);

  vert0.neighbors.add(v1); vert0.neighbors.add(v2);
  vert1.neighbors.add(v0); vert1.neighbors.add(v2);
  vert2.neighbors.add(v0); vert2.neighbors.add(v1);

  return triId;
}

export function barycentricInterpolateY(
  worldX: number,
  worldZ: number,
  v0: Vec3,
  v1: Vec3,
  v2: Vec3
): number {
  const d00 = (v1.x - v0.x) * (v1.x - v0.x) + (v1.z - v0.z) * (v1.z - v0.z);
  const d01 = (v1.x - v0.x) * (v2.x - v0.x) + (v1.z - v0.z) * (v2.z - v0.z);
  const d11 = (v2.x - v0.x) * (v2.x - v0.x) + (v2.z - v0.z) * (v2.z - v0.z);
  const d20 = (worldX - v0.x) * (v1.x - v0.x) + (worldZ - v0.z) * (v1.z - v0.z);
  const d21 = (worldX - v0.x) * (v2.x - v0.x) + (worldZ - v0.z) * (v2.z - v0.z);

  const denom = d00 * d11 - d01 * d01;
  if (Math.abs(denom) < 1e-10) return v0.y;

  const bv = (d11 * d20 - d01 * d21) / denom;
  const bw = (d00 * d21 - d01 * d20) / denom;
  const bu = 1 - bv - bw;

  return bu * v0.y + bv * v1.y + bw * v2.y;
}

export const MAX_WALKABLE_SLOPE_DEGREES = 45;

export function computeFaceSlopeAngle(
  topology: TerrainMeshTopology,
  faceId: number,
  heightUnit: number
): number {
  const tri = topology.triangles.get(faceId);
  if (!tri) return 90;

  const v0 = topology.vertices.get(tri.vertices[0]);
  const v1 = topology.vertices.get(tri.vertices[1]);
  const v2 = topology.vertices.get(tri.vertices[2]);
  if (!v0 || !v1 || !v2) return 90;

  const ax = v1.position.x - v0.position.x;
  const ay = (v1.position.y - v0.position.y) * heightUnit;
  const az = v1.position.z - v0.position.z;

  const bx = v2.position.x - v0.position.x;
  const by = (v2.position.y - v0.position.y) * heightUnit;
  const bz = v2.position.z - v0.position.z;

  const nx = ay * bz - az * by;
  const ny = az * bx - ax * bz;
  const nz = ax * by - ay * bx;

  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len < 1e-10) return 90;

  const normalY = ny / len;
  return Math.acos(Math.min(1, Math.max(-1, normalY))) * (180 / Math.PI);
}

export function sanitizeTopology(topology: TerrainMeshTopology): void {
  for (const [eid, edge] of topology.edges) {
    // Remove ghost triangles
    const beforeCount = edge.triangles.length;
    edge.triangles = edge.triangles.filter(tid => topology.triangles.has(tid));
    if (edge.triangles.length !== beforeCount) {
        console.log(`Sanitize: Removed ghost triangles from edge ${eid}`);
    }
  }
}
