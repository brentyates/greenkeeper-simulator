export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface TerrainVertex {
  id: number;
  position: Vec3;
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
  vertexEdges: Map<number, Set<number>>;
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
    vertexEdges: new Map(),
    nextVertexId: 0,
    nextEdgeId: 0,
    nextTriangleId: 0,
    worldWidth,
    worldHeight,
  };
}

export function findEdge(topology: TerrainMeshTopology, v1: number, v2: number): number | undefined {
  const eids = topology.vertexEdges.get(v1);
  if (eids) for (const eid of eids) {
    const e = topology.edges.get(eid);
    if (e && (e.v1 === v2 || e.v2 === v2)) return eid;
  }
  return undefined;
}

export function edgeKey(v1: number, v2: number): string { return `${Math.min(v1, v2)},${Math.max(v1, v2)}`; }

function addVertexEdge(topology: TerrainMeshTopology, vid: number, eid: number): void {
  let set = topology.vertexEdges.get(vid);
  if (!set) topology.vertexEdges.set(vid, set = new Set());
  set.add(eid);
}

function removeVertexEdge(topology: TerrainMeshTopology, vid: number, eid: number): void {
  const set = topology.vertexEdges.get(vid);
  if (set) { set.delete(eid); if (set.size === 0) topology.vertexEdges.delete(vid); }
}

export function getVertexNeighbors(topology: TerrainMeshTopology, vid: number): Set<number> {
  const n = new Set<number>(), eids = topology.vertexEdges.get(vid);
  if (eids) for (const eid of eids) { const e = topology.edges.get(eid); if (e) n.add(e.v1 === vid ? e.v2 : e.v1); }
  return n;
}

export function getTrianglesAdjacentToVertex(topology: TerrainMeshTopology, vid: number): Set<number> {
  const tids = new Set<number>(), eids = topology.vertexEdges.get(vid);
  if (eids) for (const eid of eids) { const e = topology.edges.get(eid); if (e) for (const tid of e.triangles) tids.add(tid); }
  return tids;
}

export function recomputeNormalsLocally(
  topology: TerrainMeshTopology,
  vertexIds: number[],
  bufferNormals: Float32Array | number[],
  vertexIdMap: Map<number, number[]>,
  heightUnit: number
): void {
  const affectedBufferIndices = new Set<number>();
  const affectedTriangles = new Set<number>();

  for (const vId of vertexIds) {
    const triangles = getTrianglesAdjacentToVertex(topology, vId);
    for (const triId of triangles) {
      affectedTriangles.add(triId);
      const tri = topology.triangles.get(triId);
      if (tri) {
        for (const vid of tri.vertices) {
          const bufIndices = vertexIdMap.get(vid);
          if (bufIndices) {
            for (const bIdx of bufIndices) affectedBufferIndices.add(bIdx);
          }
        }
      }
    }
  }

  // Reset normals for affected buffer indices
  for (const bIdx of affectedBufferIndices) {
    const nIdx = bIdx * 3;
    bufferNormals[nIdx] = 0;
    bufferNormals[nIdx + 1] = 0;
    bufferNormals[nIdx + 2] = 0;
  }

  // Compute face normals and add to vertex normals
  for (const triId of affectedTriangles) {
    const tri = topology.triangles.get(triId);
    if (!tri) continue;

    const v0 = topology.vertices.get(tri.vertices[0]);
    const v1 = topology.vertices.get(tri.vertices[1]);
    const v2 = topology.vertices.get(tri.vertices[2]);
    if (!v0 || !v1 || !v2) continue;

    const ax = v1.position.x - v0.position.x;
    const ay = (v1.position.y - v0.position.y) * heightUnit;
    const az = v1.position.z - v0.position.z;

    const bx = v2.position.x - v0.position.x;
    const by = (v2.position.y - v0.position.y) * heightUnit;
    const bz = v2.position.z - v0.position.z;

    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;

    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 0) { nx /= len; ny /= len; nz /= len; }

    for (const vId of tri.vertices) {
      const bufIndices = vertexIdMap.get(vId);
      if (bufIndices) {
        for (const bIdx of bufIndices) {
          const nIdx = bIdx * 3;
          bufferNormals[nIdx] += nx;
          bufferNormals[nIdx + 1] += ny;
          bufferNormals[nIdx + 2] += nz;
        }
      }
    }
  }

  // Normalize
  for (const bIdx of affectedBufferIndices) {
    const nIdx = bIdx * 3;
    const nx = bufferNormals[nIdx], ny = bufferNormals[nIdx + 1], nz = bufferNormals[nIdx + 2];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 0) {
      bufferNormals[nIdx] = nx / len;
      bufferNormals[nIdx + 1] = ny / len;
      bufferNormals[nIdx + 2] = nz / len;
    }
  }
}

export function gridToTopology(
  vertexPositions: Vec3[][],
  worldWidth: number,
  worldHeight: number
): TerrainMeshTopology {
  const topology = createEmptyTopology(worldWidth, worldHeight);
  const vertexHeight = vertexPositions.length;
  const vertexWidth = vertexPositions[0]?.length ?? 0;

  const gridVertexMap = new Map<string, number>();

  for (let vy = 0; vy < vertexHeight; vy++) {
    for (let vx = 0; vx < vertexWidth; vx++) {
      const pos = vertexPositions[vy][vx];
      const vertexId = topology.nextVertexId++;

      const vertex: TerrainVertex = {
        id: vertexId,
        position: { ...pos },
      };

      topology.vertices.set(vertexId, vertex);
      gridVertexMap.set(`${vx},${vy}`, vertexId);
    }
  }

  function getOrCreateEdge(v1: number, v2: number): number {
    let eid = findEdge(topology, v1, v2);
    if (eid === undefined) {
      eid = topology.nextEdgeId++;
      const edge: TerrainEdge = {
        id: eid,
        v1: Math.min(v1, v2),
        v2: Math.max(v1, v2),
        triangles: [],
      };
      topology.edges.set(eid, edge);
      addVertexEdge(topology, v1, eid);
      addVertexEdge(topology, v2, eid);
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
  let minDistSq = maxDist * maxDist;

  for (const [edgeId, edge] of topology.edges) {
    const v1 = topology.vertices.get(edge.v1);
    const v2 = topology.vertices.get(edge.v2);
    if (!v1 || !v2) continue;

    const result = pointToEdgeDistanceSq(
      worldX, worldZ,
      v1.position.x, v1.position.z,
      v2.position.x, v2.position.z
    );

    if (result.distSq < minDistSq) {
      minDistSq = result.distSq;
      nearestEdge = edgeId;
      nearestT = result.t;
    }
  }

  if (nearestEdge === null) return null;

  return { edgeId: nearestEdge, t: nearestT, dist: Math.sqrt(minDistSq) };
}

function pointToEdgeDistanceSq(
  px: number, pz: number,
  ax: number, az: number,
  bx: number, bz: number
): { distSq: number; t: number } {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSq = dx * dx + dz * dz;

  if (lengthSq === 0) {
    const dSq = (px - ax) * (px - ax) + (pz - az) * (pz - az);
    return { distSq: dSq, t: 0 };
  }

  let t = ((px - ax) * dx + (pz - az) * dz) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = ax + t * dx;
  const closestZ = az + t * dz;

  const dSq = (px - closestX) * (px - closestX) + (pz - closestZ) * (pz - closestZ);
  return { distSq: dSq, t };
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

  if (idx1 !== -1 && idx2 !== -1 && (idx1 + 1) % 3 !== idx2) {
    return [
      [midpointId, edgeV1, oppositeId],
      [edgeV2, midpointId, oppositeId],
    ];
  }

  return [
    [edgeV1, midpointId, oppositeId],
    [midpointId, edgeV2, oppositeId],
  ];
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

  const newVertexId = topology.nextVertexId++;
  const newVertex: TerrainVertex = {
    id: newVertexId,
    position: newPos,
  };
  topology.vertices.set(newVertexId, newVertex);

  const newEdge1Id = topology.nextEdgeId++;
  const newEdge1: TerrainEdge = {
    id: newEdge1Id,
    v1: Math.min(edge.v1, newVertexId),
    v2: Math.max(edge.v1, newVertexId),
    triangles: [],
  };
  topology.edges.set(newEdge1Id, newEdge1);
  addVertexEdge(topology, edge.v1, newEdge1Id);
  addVertexEdge(topology, newVertexId, newEdge1Id);

  const newEdge2Id = topology.nextEdgeId++;
  const newEdge2: TerrainEdge = {
    id: newEdge2Id,
    v1: Math.min(edge.v2, newVertexId),
    v2: Math.max(edge.v2, newVertexId),
    triangles: [],
  };
  topology.edges.set(newEdge2Id, newEdge2);
  addVertexEdge(topology, edge.v2, newEdge2Id);
  addVertexEdge(topology, newVertexId, newEdge2Id);

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

    if (!topology.vertices.get(oppositeVertexId)) continue;

    const newConnectingEdgeId = topology.nextEdgeId++;
    const newConnectingEdge: TerrainEdge = {
      id: newConnectingEdgeId,
      v1: Math.min(newVertexId, oppositeVertexId),
      v2: Math.max(newVertexId, oppositeVertexId),
      triangles: [],
    };
    topology.edges.set(newConnectingEdgeId, newConnectingEdge);
    addVertexEdge(topology, newVertexId, newConnectingEdgeId);
    addVertexEdge(topology, oppositeVertexId, newConnectingEdgeId);

    const [tri1Verts, tri2Verts] = computeSubdividedTriangleWinding(
      tri.vertices,
      edge.v1,
      edge.v2,
      newVertexId,
      oppositeVertexId
    );

    const tri1Id = topology.nextTriangleId++;
    const tri1Edges = findTriangleEdges(topology, tri1Verts);
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
      if (e && !e.triangles.includes(tri1Id)) e.triangles.push(tri1Id);
    }

    const tri2Id = topology.nextTriangleId++;
    const tri2Edges = findTriangleEdges(topology, tri2Verts);
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

  removeVertexEdge(topology, edge.v1, edgeId);
  removeVertexEdge(topology, edge.v2, edgeId);
  topology.edges.delete(edgeId);

  if (import.meta.env.DEV) validateTopology(topology);

  return {
    newVertexId,
    newEdgeIds: [newEdge1Id, newEdge2Id],
    newTriangleIds,
    removedTriangleIds,
  };
}

function findTriangleEdges(
  topology: TerrainMeshTopology,
  vertices: [number, number, number]
): [number, number, number] {
  const edges: number[] = [];
  const pairs: Array<[number, number]> = [
    [vertices[0], vertices[1]],
    [vertices[1], vertices[2]],
    [vertices[2], vertices[0]],
  ];

  for (const [va, vb] of pairs) {
    const eid = findEdge(topology, va, vb);
    if (eid !== undefined) {
      edges.push(eid);
    }
  }

  return edges as [number, number, number];
}

export function isBoundaryVertex(topology: TerrainMeshTopology, vertexId: number): boolean {
  const vertex = topology.vertices.get(vertexId);
  if (!vertex) return true;

  const edgeIds = topology.vertexEdges.get(vertexId);
  if (!edgeIds) return true;

  for (const eid of edgeIds) {
    const edge = topology.edges.get(eid);
    if (edge && edge.triangles.length < 2) {
      return true;
    }
  }

  return false;
}

export function canDeleteVertex(topology: TerrainMeshTopology, vertexId: number): boolean {
  if (topology.vertices.size <= 4) return false;

  const vertex = topology.vertices.get(vertexId);
  if (!vertex) return false;

  const neighborCount = getVertexNeighbors(topology, vertexId).size;
  if (isBoundaryVertex(topology, vertexId) && neighborCount < 3) {
    return false;
  }

  return true;
}

export interface DeleteVertexResult {
  removedTriangleIds: number[];
  removedEdgeIds: number[];
  newTriangleIds: number[];
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

  // Collect adjacent triangles via vertexEdges index (O(degree) vs O(all triangles))
  const triSet = new Set<number>();
  const vertexEdgeSet = topology.vertexEdges.get(vertexId);
  if (vertexEdgeSet) {
    for (const eid of vertexEdgeSet) {
      const edge = topology.edges.get(eid);
      if (edge) {
        for (const tid of edge.triangles) {
          triSet.add(tid);
        }
      }
    }
  }
  const trianglesToRemove = Array.from(triSet);

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

  const vertexEdgeIds = topology.vertexEdges.get(vertexId);
  const edgesToRemove: number[] = vertexEdgeIds ? [...vertexEdgeIds] : [];

  for (const eid of edgesToRemove) {
    const e = topology.edges.get(eid);
    if (e) {
      removeVertexEdge(topology, e.v1, eid);
      removeVertexEdge(topology, e.v2, eid);
    }
    topology.edges.delete(eid);
    removedEdgeIds.push(eid);
  }

  topology.vertices.delete(vertexId);
  topology.vertexEdges.delete(vertexId);

  const { newTriangleIds } = retriangulateHole(topology, holeVertices);

  if (import.meta.env.DEV) validateTopology(topology);

  return {
    removedTriangleIds,
    removedEdgeIds,
    newTriangleIds,
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
  const trianglesToRemove = [...edge.triangles];

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
  const affectedTriangles = new Set<number>();
  const removedTriSet = new Set(trianglesToRemove);
  const removedVertexEdgeIds = topology.vertexEdges.get(removedId);
  if (removedVertexEdgeIds) {
    for (const eid of removedVertexEdgeIds) {
      if (eid === edgeId) continue;
      const e = topology.edges.get(eid);
      if (!e) continue;

      for (const tid of e.triangles) {
        if (!removedTriSet.has(tid)) affectedTriangles.add(tid);
      }

      const otherV = e.v1 === removedId ? e.v2 : e.v1;
      if (otherV === survivingId) {
        edgesToRemove.push(eid);
      } else {
        if (e.v1 === removedId) {
          e.v1 = survivingId;
        } else {
          e.v2 = survivingId;
        }
        addVertexEdge(topology, survivingId, eid);
      }
    }
  }

  for (const tid of affectedTriangles) {
    const tri = topology.triangles.get(tid);
    if (tri) {
      for (let i = 0; i < tri.vertices.length; i++) {
        if (tri.vertices[i] === removedId) {
          tri.vertices[i] = survivingId;
        }
      }
    }
  }

  for (const eid of edgesToRemove) {
    const e = topology.edges.get(eid);
    if (e) {
      removeVertexEdge(topology, e.v1, eid);
      removeVertexEdge(topology, e.v2, eid);
    }
    topology.edges.delete(eid);
  }

  topology.vertices.delete(removedId);
  topology.vertexEdges.delete(removedId);

  if (import.meta.env.DEV) validateTopology(topology);

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
  const orderedSet = new Set<number>(ordered);
  const usedEdges = new Set<number>([0]);

  while (usedEdges.size < neighborEdges.length) {
    let found = false;
    for (let i = 0; i < neighborEdges.length; i++) {
      if (usedEdges.has(i)) continue;

      const edge = neighborEdges[i];
      const lastVertex = ordered[ordered.length - 1];

      if (edge.v1 === lastVertex && !orderedSet.has(edge.v2)) {
        ordered.push(edge.v2);
        orderedSet.add(edge.v2);
        usedEdges.add(i);
        found = true;
        break;
      } else if (edge.v2 === lastVertex && !orderedSet.has(edge.v1)) {
        ordered.push(edge.v1);
        orderedSet.add(edge.v1);
        usedEdges.add(i);
        found = true;
        break;
      }
    }

    if (!found) break;
  }

  return ordered;
}

function signedPolygonArea(topology: TerrainMeshTopology, vids: number[]): number {
  let area = 0;
  for (let i = 0; i < vids.length; i++) {
    const a = topology.vertices.get(vids[i])!;
    const b = topology.vertices.get(vids[(i + 1) % vids.length])!;
    area += (a.position.x * b.position.z - b.position.x * a.position.z);
  }
  return area / 2;
}

export function pointInTriangle(
  px: number, pz: number,
  ax: number, az: number,
  bx: number, bz: number,
  cx: number, cz: number
): boolean {
  const d1 = (px - bx) * (az - bz) - (ax - bx) * (pz - bz);
  const d2 = (px - cx) * (bz - cz) - (bx - cx) * (pz - cz);
  const d3 = (px - ax) * (cz - az) - (cx - ax) * (pz - az);
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

export function retriangulateHole(
  topology: TerrainMeshTopology,
  holeVertices: number[]
): { newTriangleIds: number[] } {
  const newTriangleIds: number[] = [];

  if (holeVertices.length < 3) {
    return { newTriangleIds };
  }

  if (holeVertices.length === 3) {
    const triId = createTriangle(topology, holeVertices[0], holeVertices[1], holeVertices[2]);
    if (triId !== null) newTriangleIds.push(triId);
    if (import.meta.env.DEV) validateTopology(topology);
    return { newTriangleIds };
  }

  const remaining = [...holeVertices];

  const polyArea = signedPolygonArea(topology, remaining);
  const expectCCW = polyArea > 0;

  while (remaining.length > 3) {
    let earFound = false;
    for (let i = 0; i < remaining.length; i++) {
      const prev = remaining[(i - 1 + remaining.length) % remaining.length];
      const curr = remaining[i];
      const next = remaining[(i + 1) % remaining.length];

      const pv = topology.vertices.get(prev)!;
      const cv = topology.vertices.get(curr)!;
      const nv = topology.vertices.get(next)!;

      const cross = (cv.position.x - pv.position.x) * (nv.position.z - pv.position.z) -
                    (cv.position.z - pv.position.z) * (nv.position.x - pv.position.x);
      const isConvex = expectCCW ? cross > 0 : cross < 0;
      if (!isConvex) continue;

      let containsOther = false;
      for (let j = 0; j < remaining.length; j++) {
        if (j === ((i - 1 + remaining.length) % remaining.length) || j === i || j === ((i + 1) % remaining.length)) continue;
        const tv = topology.vertices.get(remaining[j])!;
        if (pointInTriangle(tv.position.x, tv.position.z,
            pv.position.x, pv.position.z,
            cv.position.x, cv.position.z,
            nv.position.x, nv.position.z)) {
          containsOther = true;
          break;
        }
      }
      if (containsOther) continue;

      const triId = createTriangle(topology, prev, curr, next);
      if (triId !== null) newTriangleIds.push(triId);
      remaining.splice(i, 1);
      earFound = true;
      break;
    }
    if (!earFound) break;
  }

  if (remaining.length === 3) {
    const triId = createTriangle(topology, remaining[0], remaining[1], remaining[2]);
    if (triId !== null) newTriangleIds.push(triId);
  }

  if (import.meta.env.DEV) validateTopology(topology);
  return { newTriangleIds };
}

export function createTriangle(
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

  return triId;
}

function getOrCreateEdgeForTriangle(
  topology: TerrainMeshTopology,
  v1: number,
  v2: number,
  triId: number
): number {
  const existingId = findEdge(topology, v1, v2);

  if (existingId !== undefined) {
    const edge = topology.edges.get(existingId);
    if (edge && !edge.triangles.includes(triId)) {
      edge.triangles.push(triId);
    }
    return existingId;
  }

  const newEdgeId = topology.nextEdgeId++;
  const newEdge: TerrainEdge = {
    id: newEdgeId,
    v1: Math.min(v1, v2),
    v2: Math.max(v1, v2),
    triangles: [triId],
  };
  topology.edges.set(newEdgeId, newEdge);
  addVertexEdge(topology, v1, newEdgeId);
  addVertexEdge(topology, v2, newEdgeId);

  return newEdgeId;
}

export function buildMeshArrays(
  topology: TerrainMeshTopology,
  heightUnit: number = 1
): {
  positions: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
  terrainTypes: Float32Array;
  faceIds: Float32Array;
  vertexIdMap: Map<number, number[]>;
} {
  const triCount = topology.triangles.size;
  const vertCount = triCount * 3;

  const positions = new Float32Array(vertCount * 3);
  const indices = new Uint32Array(triCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const terrainTypes = new Float32Array(vertCount);
  const faceIds = new Float32Array(vertCount);

  const vertexIdMap = new Map<number, number[]>();

  let vIdx = 0;
  let iIdx = 0;

  for (const [triId, tri] of topology.triangles) {
    const terrainCode = tri.terrainCode ?? 0;

    for (const vId of tri.vertices) {
      const vertex = topology.vertices.get(vId);
      if (!vertex) continue;

      const currentVIdx = vIdx++;

      let mapped = vertexIdMap.get(vId);
      if (!mapped) {
        mapped = [];
        vertexIdMap.set(vId, mapped);
      }
      mapped.push(currentVIdx);

      const pBase = currentVIdx * 3;
      positions[pBase] = vertex.position.x;
      positions[pBase + 1] = vertex.position.y * heightUnit;
      positions[pBase + 2] = vertex.position.z;

      terrainTypes[currentVIdx] = terrainCode;
      faceIds[currentVIdx] = triId;
    }

    indices[iIdx++] = vIdx - 3;
    indices[iIdx++] = vIdx - 2;
    indices[iIdx++] = vIdx - 1;
  }

  computeNormals(positions, indices, normals);

  for (const [, bufferIndices] of vertexIdMap) {
    if (bufferIndices.length <= 1) continue;
    let nx = 0, ny = 0, nz = 0;
    for (const idx of bufferIndices) {
      const nBase = idx * 3;
      nx += normals[nBase];
      ny += normals[nBase + 1];
      nz += normals[nBase + 2];
    }
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 0) {
      nx /= len;
      ny /= len;
      nz /= len;
    }
    for (const idx of bufferIndices) {
      const nBase = idx * 3;
      normals[nBase] = nx;
      normals[nBase + 1] = ny;
      normals[nBase + 2] = nz;
    }
  }

  return { positions, indices, normals, terrainTypes, faceIds, vertexIdMap };
}

function computeNormals(positions: Float32Array, indices: Uint32Array, normals: Float32Array): void {
  // normals is already zeroed by Float32Array initialization
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i];
    const i1 = indices[i + 1];
    const i2 = indices[i + 2];

    const i03 = i0 * 3, i13 = i1 * 3, i23 = i2 * 3;

    const p0x = positions[i03], p0y = positions[i03 + 1], p0z = positions[i03 + 2];
    const p1x = positions[i13], p1y = positions[i13 + 1], p1z = positions[i13 + 2];
    const p2x = positions[i23], p2y = positions[i23 + 1], p2z = positions[i23 + 2];

    const ax = p1x - p0x, ay = p1y - p0y, az = p1z - p0z;
    const bx = p2x - p0x, by = p2y - p0y, bz = p2z - p0z;

    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;

    normals[i03] += nx; normals[i03 + 1] += ny; normals[i03 + 2] += nz;
    normals[i13] += nx; normals[i13 + 1] += ny; normals[i13 + 2] += nz;
    normals[i23] += nx; normals[i23 + 1] += ny; normals[i23 + 2] += nz;
  }

  for (let i = 0; i < normals.length; i += 3) {
    const nx = normals[i], ny = normals[i + 1], nz = normals[i + 2];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 0) {
      normals[i] /= len;
      normals[i + 1] /= len;
      normals[i + 2] /= len;
    }
  }
}

export function getTriangleCentroid(
  topology: TerrainMeshTopology,
  triId: number
): { x: number; z: number } | null {
  const tri = topology.triangles.get(triId);
  if (!tri) return null;
  const v0 = topology.vertices.get(tri.vertices[0]);
  const v1 = topology.vertices.get(tri.vertices[1]);
  const v2 = topology.vertices.get(tri.vertices[2]);
  if (!v0 || !v1 || !v2) return null;
  return {
    x: (v0.position.x + v1.position.x + v2.position.x) / 3,
    z: (v0.position.z + v1.position.z + v2.position.z) / 3,
  };
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

export function flipEdge(
  topology: TerrainMeshTopology,
  edgeId: number
): boolean {
  const edge = topology.edges.get(edgeId);
  if (!edge) {
      console.warn(`FlipEdge: Edge ${edgeId} not found`);
      return false;
  }

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

  const existingEdgeId = findEdge(topology, o1, o2);
  if (existingEdgeId !== undefined) {
      console.warn(`FlipEdge: Opposite vertices ${o1} and ${o2} are already connected by edge ${existingEdgeId}`);
      return false;
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
  const findBoundary = (tri: TerrainTriangle, a: number, b: number) =>
    tri.edges.find(eid => {
      if (eid === edgeId) return false;
      const e = topology.edges.get(eid);
      return e ? (e.v1 === a && e.v2 === b) || (e.v1 === b && e.v2 === a) : false;
    });

  const e_v2_o1_id = findBoundary(t1, v2, o1);
  const e_o1_v1_id = findBoundary(t1, o1, v1);
  const e_v1_o2_id = findBoundary(t2, v1, o2);
  const e_o2_v2_id = findBoundary(t2, o2, v2);

  if (e_v2_o1_id === undefined || e_o1_v1_id === undefined || e_v1_o2_id === undefined || e_o2_v2_id === undefined) {
      console.warn("FlipEdge: Could not find all boundary edges", {e_v2_o1_id, e_o1_v1_id, e_v1_o2_id, e_o2_v2_id});
      return false;
  }

  removeVertexEdge(topology, v1, edgeId);
  removeVertexEdge(topology, v2, edgeId);
  edge.v1 = Math.min(o1, o2);
  edge.v2 = Math.max(o1, o2);
  addVertexEdge(topology, o1, edgeId);
  addVertexEdge(topology, o2, edgeId);

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

  if (import.meta.env.DEV) validateTopology(topology);

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
    });
    if (sv.id > maxVertexId) maxVertexId = sv.id;
  }
  topology.nextVertexId = maxVertexId + 1;

  let maxTriId = -1;
  for (const st of data.triangles) {
    const triId = createTriangle(topology, st.vertices[0], st.vertices[1], st.vertices[2]);
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

export function validateTopology(topology: TerrainMeshTopology): void {
  for (const [eid, edge] of topology.edges) {
    if (!topology.vertices.has(edge.v1) || !topology.vertices.has(edge.v2)) throw new Error(`Edge ${eid} has non-existent vertex`);
    for (const tid of edge.triangles) if (!topology.triangles.has(tid)) throw new Error(`Edge ${eid} has non-existent triangle ${tid}`);
    if (edge.triangles.length === 0 || edge.triangles.length > 2) throw new Error(`Edge ${eid} has ${edge.triangles.length} triangles`);
    if (findEdge(topology, edge.v1, edge.v2) !== eid) throw new Error(`Edge ${eid} findEdge mismatch`);
    if (!topology.vertexEdges.get(edge.v1)?.has(eid) || !topology.vertexEdges.get(edge.v2)?.has(eid)) throw new Error(`Edge ${eid} missing from vertexEdges`);
  }
  for (const [vid, edgeSet] of topology.vertexEdges) {
    if (!topology.vertices.has(vid)) throw new Error(`Orphaned vertexEdges entry ${vid}`);
    for (const eid of edgeSet) if (!topology.edges.get(eid)) throw new Error(`vertexEdges[${vid}] has non-existent edge ${eid}`);
  }
  for (const [tid, tri] of topology.triangles) {
    for (const vid of tri.vertices) if (!topology.vertices.has(vid)) throw new Error(`Triangle ${tid} has non-existent vertex ${vid}`);
    for (const eid of tri.edges) if (!topology.edges.get(eid)) throw new Error(`Triangle ${tid} has non-existent edge ${eid}`);
    [[0,1], [1,2], [2,0]].forEach(([a,b]) => {
      const eid = findEdge(topology, tri.vertices[a], tri.vertices[b]);
      if (eid === undefined || !tri.edges.includes(eid)) throw new Error(`Triangle ${tid} edge mismatch`);
    });
  }
}

