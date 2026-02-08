import Delaunator from 'delaunator';
import {
  TerrainMeshTopology,
  TerrainVertex,
  createTriangle,
  edgeKey,
} from './mesh-topology';
import { pointInPolygon } from './delaunay-topology';

export interface TemplateRing {
  radiusFraction: number;
  pointCount: number;
  terrainCode: number;
}

export type StampShape = 'circle' | 'oval' | 'rectangle' | 'kidney';

export interface ShapeTemplate {
  name: string;
  shape: StampShape;
  rings: TemplateRing[];
  baseRadius: number;
  centerTerrainCode: number;
  aspectX?: number;
  aspectZ?: number;
  kidneyStrength?: number;
}

export interface GeneratedStamp {
  vertices: Array<{ x: number; y: number; z: number }>;
  outerRingIndices: number[];
  boundaryPolygon: Array<{ x: number; z: number }>;
}

export function generateStampTopology(
  template: ShapeTemplate,
  centerX: number,
  centerZ: number,
  getElevation: (x: number, z: number) => number,
  snapStep?: number
): GeneratedStamp {
  const vertices: Array<{ x: number; y: number; z: number }> = [];
  const outerRingIndices: number[] = [];

  const sortedRings = [...template.rings].sort((a, b) => b.radiusFraction - a.radiusFraction);
  const outerRadius = template.baseRadius;
  const aspectX = template.aspectX ?? 1;
  const aspectZ = template.aspectZ ?? 1;
  const kidneyStrength = template.kidneyStrength ?? 0.35;

  const vertexIndexByKey = new Map<string, number>();
  const snap = (v: number): number => {
    if (!snapStep || snapStep <= 0) return v;
    return Math.round(v / snapStep) * snapStep;
  };
  const addVertex = (x: number, z: number): number => {
    const key = `${x.toFixed(4)},${z.toFixed(4)}`;
    const existing = vertexIndexByKey.get(key);
    if (existing !== undefined) return existing;
    const idx = vertices.length;
    vertices.push({ x, y: getElevation(x, z), z });
    vertexIndexByKey.set(key, idx);
    return idx;
  };

  addVertex(snap(centerX), snap(centerZ));

  for (const ring of sortedRings) {
    const radius = outerRadius * ring.radiusFraction;
    const ringIndices: number[] = [];
    for (let i = 0; i < ring.pointCount; i++) {
      const t = i / ring.pointCount;
      const point = getShapePoint(template.shape, t, radius, aspectX, aspectZ, kidneyStrength);
      const x = snap(centerX + point.x);
      const z = snap(centerZ + point.z);
      const idx = addVertex(x, z);
      if (ringIndices.length === 0 || ringIndices[ringIndices.length - 1] !== idx) {
        ringIndices.push(idx);
      }
    }
    if (ring === sortedRings[0]) {
      for (const idx of ringIndices) outerRingIndices.push(idx);
    }
  }

  const boundaryPolygon = outerRingIndices.map(idx => ({
    x: vertices[idx].x,
    z: vertices[idx].z,
  }));

  const outerRing = sortedRings[0];
  const maxDim = outerRadius * Math.max(aspectX, aspectZ);
  const avgEdgeLen = (2 * Math.PI * maxDim) / outerRing.pointCount;
  const fillSpacing = avgEdgeLen * 0.9;

  const kidneyShift = template.shape === 'kidney' ? kidneyStrength * outerRadius * 0.8 * aspectX : 0;
  const extent = maxDim + kidneyShift + fillSpacing;
  const minX = centerX - extent;
  const maxXBound = centerX + extent;
  const minZ = centerZ - extent;
  const maxZBound = centerZ + extent;

  const occupiedCells = new Set<string>();
  for (const v of vertices) {
    const cx = Math.floor((v.x - minX) / fillSpacing);
    const cz = Math.floor((v.z - minZ) / fillSpacing);
    occupiedCells.add(`${cx},${cz}`);
  }

  const cols = Math.ceil((maxXBound - minX) / fillSpacing);
  const rows = Math.ceil((maxZBound - minZ) / fillSpacing);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const key = `${col},${row}`;
      if (occupiedCells.has(key)) continue;

      const jitterX = (pseudoRandom(col, row, 0) - 0.5) * fillSpacing * 0.3;
      const jitterZ = (pseudoRandom(col, row, 1) - 0.5) * fillSpacing * 0.3;
      const x = snap(minX + (col + 0.5) * fillSpacing + jitterX);
      const z = snap(minZ + (row + 0.5) * fillSpacing + jitterZ);

      if (!pointInPolygon(x, z, boundaryPolygon)) continue;

      addVertex(x, z);
    }
  }

  return { vertices, outerRingIndices, boundaryPolygon };
}

function getShapePoint(
  shape: StampShape,
  t: number,
  radius: number,
  aspectX: number,
  aspectZ: number,
  kidneyStrength: number
): { x: number; z: number } {
  switch (shape) {
    case 'rectangle': {
      const halfW = radius * aspectX;
      const halfH = radius * aspectZ;
      const w = halfW * 2;
      const h = halfH * 2;
      const perimeter = 2 * (w + h);
      const dist = t * perimeter;
      if (dist < w) {
        return { x: -halfW + dist, z: -halfH };
      }
      if (dist < w + h) {
        return { x: halfW, z: -halfH + (dist - w) };
      }
      if (dist < w + h + w) {
        return { x: halfW - (dist - (w + h)), z: halfH };
      }
      return { x: -halfW, z: halfH - (dist - (w + h + w)) };
    }
    case 'kidney': {
      const angle = t * Math.PI * 2;
      const r = radius * (1 + kidneyStrength * Math.cos(angle));
      const x = Math.cos(angle) * r * aspectX;
      const z = Math.sin(angle) * r * aspectZ;
      const shift = -kidneyStrength * radius * 0.8 * aspectX;
      return { x: x + shift, z };
    }
    case 'oval':
    case 'circle':
    default: {
      const angle = t * Math.PI * 2;
      return {
        x: Math.cos(angle) * radius * aspectX,
        z: Math.sin(angle) * radius * aspectZ,
      };
    }
  }
}

function getShapeDistance(
  shape: StampShape,
  dx: number,
  dz: number,
  baseRadius: number,
  aspectX: number,
  aspectZ: number,
  kidneyStrength: number
): number {
  const kidneyShift = shape === 'kidney'
    ? -kidneyStrength * baseRadius * 0.8 * aspectX
    : 0;
  const adjX = dx - kidneyShift;
  const nx = adjX / (baseRadius * aspectX);
  const nz = dz / (baseRadius * aspectZ);

  switch (shape) {
    case 'rectangle': {
      return Math.max(Math.abs(nx), Math.abs(nz));
    }
    case 'kidney': {
      const angle = Math.atan2(nz, nx);
      const r = Math.sqrt(nx * nx + nz * nz);
      const limit = 1 + kidneyStrength * Math.cos(angle);
      return r / Math.max(0.0001, limit);
    }
    case 'oval':
    case 'circle':
    default: {
      return Math.sqrt(nx * nx + nz * nz);
    }
  }
}

function pseudoRandom(a: number, b: number, seed: number): number {
  let h = (a * 374761393 + b * 668265263 + seed * 1274126177) | 0;
  h = (h ^ (h >> 13)) * 1103515245;
  h = h ^ (h >> 16);
  return (h & 0x7fffffff) / 0x7fffffff;
}

export function stampIntoTopology(
  topology: TerrainMeshTopology,
  stamp: GeneratedStamp,
  template: ShapeTemplate,
  centerX: number,
  centerZ: number,
  resolveTerrainCode?: (x: number, z: number) => number | null
): { newFaceIds: number[]; newVertexIds: number[] } {
  const overlappingTriIds = new Set<number>();
  for (const [triId, tri] of topology.triangles) {
    const verts = tri.vertices.map(vid => topology.vertices.get(vid)!);
    if (!verts[0] || !verts[1] || !verts[2]) continue;
    const cx = (verts[0].position.x + verts[1].position.x + verts[2].position.x) / 3;
    const cz = (verts[0].position.z + verts[1].position.z + verts[2].position.z) / 3;
    if (pointInPolygon(cx, cz, stamp.boundaryPolygon)) {
      overlappingTriIds.add(triId);
    }
  }

  const boundaryVertexIds = new Set<number>();
  const removedVertexIds = new Set<number>();
  for (const triId of overlappingTriIds) {
    const tri = topology.triangles.get(triId);
    if (!tri) continue;
    for (const vid of tri.vertices) {
      removedVertexIds.add(vid);
    }
  }
  for (const vid of removedVertexIds) {
    let hasSurvivingTri = false;
    for (const [triId, tri] of topology.triangles) {
      if (overlappingTriIds.has(triId)) continue;
      if (tri.vertices.includes(vid)) {
        hasSurvivingTri = true;
        break;
      }
    }
    if (hasSurvivingTri) {
      boundaryVertexIds.add(vid);
    }
  }

  for (const triId of overlappingTriIds) {
    const tri = topology.triangles.get(triId);
    if (!tri) continue;
    for (const eid of tri.edges) {
      const edge = topology.edges.get(eid);
      if (edge) {
        edge.triangles = edge.triangles.filter(t => t !== triId);
        if (edge.triangles.length === 0) {
          topology.edgeIndex.delete(edgeKey(edge.v1, edge.v2));
          const ve1 = topology.vertexEdges.get(edge.v1);
          if (ve1) { ve1.delete(eid); if (ve1.size === 0) topology.vertexEdges.delete(edge.v1); }
          const ve2 = topology.vertexEdges.get(edge.v2);
          if (ve2) { ve2.delete(eid); if (ve2.size === 0) topology.vertexEdges.delete(edge.v2); }
          topology.edges.delete(eid);
        }
      }
    }
    topology.triangles.delete(triId);
  }

  const orphanedVertexIds = new Set<number>();
  for (const vid of removedVertexIds) {
    if (boundaryVertexIds.has(vid)) continue;
    let stillUsed = false;
    for (const [, tri] of topology.triangles) {
      if (tri.vertices.includes(vid)) { stillUsed = true; break; }
    }
    if (!stillUsed) {
      orphanedVertexIds.add(vid);
    }
  }
  for (const vid of orphanedVertexIds) {
    topology.vertexEdges.delete(vid);
    topology.vertices.delete(vid);
  }

  const stampVertexIdMap = new Map<number, number>();
  const newVertexIds: number[] = [];
  for (let i = 0; i < stamp.vertices.length; i++) {
    const sv = stamp.vertices[i];
    const vid = topology.nextVertexId++;
    const vertex: TerrainVertex = {
      id: vid,
      position: { x: sv.x, y: sv.y, z: sv.z },
    };
    topology.vertices.set(vid, vertex);
    stampVertexIdMap.set(i, vid);
    newVertexIds.push(vid);
  }

  const allPoints: Array<{ x: number; z: number; topologyVertexId: number; isStamp: boolean }> = [];
  for (let i = 0; i < stamp.vertices.length; i++) {
    const sv = stamp.vertices[i];
    allPoints.push({ x: sv.x, z: sv.z, topologyVertexId: stampVertexIdMap.get(i)!, isStamp: true });
  }
  for (const vid of boundaryVertexIds) {
    const v = topology.vertices.get(vid)!;
    allPoints.push({ x: v.position.x, z: v.position.z, topologyVertexId: vid, isStamp: false });
  }

  const newFaceIds: number[] = [];
  if (allPoints.length >= 3) {
    const coords = new Float64Array(allPoints.length * 2);
    for (let i = 0; i < allPoints.length; i++) {
      coords[i * 2] = allPoints[i].x;
      coords[i * 2 + 1] = allPoints[i].z;
    }
    const delaunay = new Delaunator(coords);

    const eKey = (a: number, b: number) => a < b ? `${a},${b}` : `${b},${a}`;
    const edgeFaceCount = new Map<string, number>();
    for (const [, edge] of topology.edges) {
      edgeFaceCount.set(eKey(edge.v1, edge.v2), edge.triangles.length);
    }

    const sortedRings = [...template.rings].sort((a, b) => b.radiusFraction - a.radiusFraction);
    const aspectX = template.aspectX ?? 1;
    const aspectZ = template.aspectZ ?? 1;
    const kidneyStrength = template.kidneyStrength ?? 0.35;

    for (let i = 0; i < delaunay.triangles.length; i += 3) {
      const i0 = delaunay.triangles[i];
      const i1 = delaunay.triangles[i + 1];
      const i2 = delaunay.triangles[i + 2];

      const p0 = allPoints[i0];
      const p1 = allPoints[i1];
      const p2 = allPoints[i2];

      if (!p0.isStamp && !p1.isStamp && !p2.isStamp) continue;

      const v0 = p0.topologyVertexId;
      const v1 = p1.topologyVertexId;
      const v2 = p2.topologyVertexId;

      const ek01 = eKey(v0, v1);
      const ek12 = eKey(v1, v2);
      const ek20 = eKey(v2, v0);

      if ((edgeFaceCount.get(ek01) ?? 0) >= 2 ||
          (edgeFaceCount.get(ek12) ?? 0) >= 2 ||
          (edgeFaceCount.get(ek20) ?? 0) >= 2) continue;

      const triId = createTriangle(topology, v0, v1, v2);
      if (triId !== null) {
        edgeFaceCount.set(ek01, (edgeFaceCount.get(ek01) ?? 0) + 1);
        edgeFaceCount.set(ek12, (edgeFaceCount.get(ek12) ?? 0) + 1);
        edgeFaceCount.set(ek20, (edgeFaceCount.get(ek20) ?? 0) + 1);

        const tri = topology.triangles.get(triId);
        if (tri) {
          const tcx = (p0.x + p1.x + p2.x) / 3;
          const tcz = (p0.z + p1.z + p2.z) / 3;

          if (pointInPolygon(tcx, tcz, stamp.boundaryPolygon)) {
            const dist = getShapeDistance(
              template.shape,
              tcx - centerX,
              tcz - centerZ,
              template.baseRadius,
              aspectX,
              aspectZ,
              kidneyStrength
            );
            let terrainCode = template.centerTerrainCode;
            for (const ring of sortedRings) {
              if (dist <= ring.radiusFraction) {
                terrainCode = ring.terrainCode;
              }
            }
            const resolved = resolveTerrainCode ? resolveTerrainCode(tcx, tcz) : null;
            tri.terrainCode = resolved ?? terrainCode;
          } else {
            const resolved = resolveTerrainCode ? resolveTerrainCode(tcx, tcz) : null;
            if (resolved !== null && resolved !== undefined) {
              tri.terrainCode = resolved;
            }
          }
        }
        newFaceIds.push(triId);
      }
    }
  }

  return { newFaceIds, newVertexIds };
}
