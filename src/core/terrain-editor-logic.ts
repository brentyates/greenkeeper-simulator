import {
  TerrainType,
} from "./terrain";

export type EditorMode = 'sculpt' | 'paint' | 'stamp';
export type TopologyMode = 'vertex' | 'edge' | 'face' | 'none';
export type InteractionMode = 'brush' | 'select';
export type SculptTool = 'raise' | 'lower' | 'smooth' | 'flatten' | 'level';
export type TerrainBrush =
  | 'terrain_fairway'
  | 'terrain_rough'
  | 'terrain_green'
  | 'terrain_bunker'
  | 'terrain_water'
  | 'terrain_tee';
export type EditorTool = SculptTool | TerrainBrush;

export interface EditorState {
  enabled: boolean;
  mode: EditorMode;
  interactionMode: InteractionMode;
  activeTool: EditorTool;
  brushSize: number;
  brushStrength: number;
  isDragging: boolean;
  hoverTile: { x: number; y: number } | null;
  hoverVertex: { vx: number; vy: number } | null;
  selectedVertices: Set<string>;
  dragStartScreenY: number | null;
  dragLastScreenY: number | null;
}

export interface VertexModification {
  vx: number;
  vy: number;
  oldZ: number;
  newZ: number;
}

import { Vec3 } from './mesh-topology';
export type { Vec3 };


export function createInitialEditorState(): EditorState {
  return {
    enabled: false,
    mode: 'sculpt',
    interactionMode: 'brush',
    activeTool: 'raise',
    brushSize: 1,
    brushStrength: 1.0,
    isDragging: false,
    hoverTile: null,
    hoverVertex: null,
    selectedVertices: new Set(),
    dragStartScreenY: null,
    dragLastScreenY: null,
  };
}

export function vertexKey(vx: number, vy: number): string {
  return `${vx},${vy}`;
}

export function parseVertexKey(key: string): { vx: number; vy: number } {
  const [vxStr, vyStr] = key.split(',');
  return { vx: parseInt(vxStr), vy: parseInt(vyStr) };
}

export function selectVertex(
  state: EditorState,
  vx: number,
  vy: number,
  additive: boolean = false
): void {
  if (!additive) {
    state.selectedVertices.clear();
  }
  state.selectedVertices.add(vertexKey(vx, vy));
}

export function deselectVertex(state: EditorState, vx: number, vy: number): void {
  state.selectedVertices.delete(vertexKey(vx, vy));
}

export function toggleVertex(state: EditorState, vx: number, vy: number): void {
  const key = vertexKey(vx, vy);
  if (state.selectedVertices.has(key)) {
    state.selectedVertices.delete(key);
  } else {
    state.selectedVertices.add(key);
  }
}

export function isVertexSelected(state: EditorState, vx: number, vy: number): boolean {
  return state.selectedVertices.has(vertexKey(vx, vy));
}

export function selectAll(
  state: EditorState,
  vertexWidth: number,
  vertexHeight: number
): void {
  state.selectedVertices.clear();
  for (let vy = 0; vy < vertexHeight; vy++) {
    for (let vx = 0; vx < vertexWidth; vx++) {
      state.selectedVertices.add(vertexKey(vx, vy));
    }
  }
}

export function deselectAll(state: EditorState): void {
  state.selectedVertices.clear();
}

export function invertSelection(
  state: EditorState,
  vertexWidth: number,
  vertexHeight: number
): void {
  const newSelection = new Set<string>();
  for (let vy = 0; vy < vertexHeight; vy++) {
    for (let vx = 0; vx < vertexWidth; vx++) {
      const key = vertexKey(vx, vy);
      if (!state.selectedVertices.has(key)) {
        newSelection.add(key);
      }
    }
  }
  state.selectedVertices = newSelection;
}

export function selectVerticesInBox(
  state: EditorState,
  vx1: number,
  vy1: number,
  vx2: number,
  vy2: number,
  vertexWidth: number,
  vertexHeight: number,
  additive: boolean = false
): void {
  if (!additive) {
    state.selectedVertices.clear();
  }

  const minVx = Math.max(0, Math.min(vx1, vx2));
  const maxVx = Math.min(vertexWidth - 1, Math.max(vx1, vx2));
  const minVy = Math.max(0, Math.min(vy1, vy2));
  const maxVy = Math.min(vertexHeight - 1, Math.max(vy1, vy2));

  for (let vy = minVy; vy <= maxVy; vy++) {
    for (let vx = minVx; vx <= maxVx; vx++) {
      state.selectedVertices.add(vertexKey(vx, vy));
    }
  }
}

export function selectVerticesInBrush(
  state: EditorState,
  centerVx: number,
  centerVy: number,
  radius: number,
  vertexWidth: number,
  vertexHeight: number,
  additive: boolean = true
): void {
  const vertices = getVerticesInBrush(centerVx, centerVy, radius, vertexWidth, vertexHeight);
  if (!additive) {
    state.selectedVertices.clear();
  }
  for (const v of vertices) {
    state.selectedVertices.add(vertexKey(v.vx, v.vy));
  }
}

export function getSelectedVerticesList(state: EditorState): Array<{ vx: number; vy: number }> {
  return Array.from(state.selectedVertices).map(parseVertexKey);
}

export function isSculptTool(tool: EditorTool): tool is SculptTool {
  return (
    tool === 'raise' ||
    tool === 'lower' ||
    tool === 'flatten' ||
    tool === 'smooth' ||
    tool === 'level'
  );
}

export function isTerrainBrush(tool: EditorTool): tool is TerrainBrush {
  return tool.startsWith('terrain_');
}

export function getTerrainTypeFromBrush(brush: TerrainBrush): TerrainType {
  switch (brush) {
    case 'terrain_fairway': return 'fairway';
    case 'terrain_rough': return 'rough';
    case 'terrain_green': return 'green';
    case 'terrain_bunker': return 'bunker';
    case 'terrain_water': return 'water';
    case 'terrain_tee': return 'tee';
  }
}

export function getVerticesInBrush(
  centerVx: number,
  centerVy: number,
  brushSize: number,
  vertexWidth: number,
  vertexHeight: number
): Array<{ vx: number; vy: number }> {
  const vertices: Array<{ vx: number; vy: number }> = [];
  const geoRadius = brushSize - 1;
  const r = Math.ceil(geoRadius);

  for (let dvy = -r; dvy <= r; dvy++) {
    for (let dvx = -r; dvx <= r; dvx++) {
      if (dvx * dvx + dvy * dvy <= geoRadius * geoRadius + 0.1) {
        const vx = centerVx + dvx;
        const vy = centerVy + dvy;
        if (vx >= 0 && vx < vertexWidth && vy >= 0 && vy < vertexHeight) {
          vertices.push({ vx, vy });
        }
      }
    }
  }

  if (vertices.length === 0) {
    vertices.push({ vx: centerVx, vy: centerVy });
  }

  return vertices;
}

export function getCellsInBrush(
  centerX: number,
  centerY: number,
  brushSize: number
): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  const geoRadius = brushSize - 1;
  const r = Math.ceil(geoRadius);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= geoRadius * geoRadius + 0.1) {
        cells.push({ x: centerX + dx, y: centerY + dy });
      }
    }
  }

  if (cells.length === 0) {
    cells.push({ x: centerX, y: centerY });
  }

  return cells;
}

export function getEdgesInBrush(
  worldX: number,
  worldZ: number,
  radius: number,
  topology: { edges: Map<number, { v1: number, v2: number }>, vertices: Map<number, { position: Vec3 }> }
): number[] {
  const edgeIds: number[] = [];
  const radiusSq = radius * radius;

  for (const [id, edge] of topology.edges) {
    const v1 = topology.vertices.get(edge.v1);
    const v2 = topology.vertices.get(edge.v2);
    if (!v1 || !v2) continue;

    // Center of the edge
    const cx = (v1.position.x + v2.position.x) / 2;
    const cz = (v1.position.z + v2.position.z) / 2;

    const dx = cx - worldX;
    const dz = cz - worldZ;
    if (dx * dx + dz * dz <= radiusSq) {
      edgeIds.push(id);
    }
  }
  return edgeIds;
}

export function getFacesInBrush(
  worldX: number,
  worldZ: number,
  radius: number,
  topology: { triangles: Map<number, { vertices: [number, number, number] }>, vertices: Map<number, { position: Vec3 }> }
): number[] {
  const faceIds: number[] = [];
  const radiusSq = radius * radius;

  for (const [id, tri] of topology.triangles) {
    const v1 = topology.vertices.get(tri.vertices[0]);
    const v2 = topology.vertices.get(tri.vertices[1]);
    const v3 = topology.vertices.get(tri.vertices[2]);
    if (!v1 || !v2 || !v3) continue;

    // Centroid of the triangle
    const cx = (v1.position.x + v2.position.x + v3.position.x) / 3;
    const cz = (v1.position.z + v2.position.z + v3.position.z) / 3;

    const dx = cx - worldX;
    const dz = cz - worldZ;
    if (dx * dx + dz * dz <= radiusSq) {
      faceIds.push(id);
    }
  }
  return faceIds;
}

export function applyRaiseVertex(
  vx: number,
  vy: number,
  vertexElevations: number[][],
  amount: number = 1
): VertexModification | null {
  const oldZ = vertexElevations[vy]?.[vx];
  if (oldZ === undefined) return null;

  return {
    vx,
    vy,
    oldZ,
    newZ: oldZ + amount,
  };
}

export function applyLowerVertex(
  vx: number,
  vy: number,
  vertexElevations: number[][],
  amount: number = 1,
  minElev: number = -10
): VertexModification | null {
  const oldZ = vertexElevations[vy]?.[vx];
  if (oldZ === undefined) return null;

  const newZ = Math.max(minElev, oldZ - amount);
  if (newZ === oldZ) return null;

  return {
    vx,
    vy,
    oldZ,
    newZ,
  };
}

export function applySmoothVertices(
  centerVx: number,
  centerVy: number,
  vertexElevations: number[][],
  radius: number,
  vertexWidth: number,
  vertexHeight: number,
  brushStrength: number = 1.0,
  precomputedVertices?: Array<{ vx: number; vy: number }>
): VertexModification[] {
  const modifications: VertexModification[] = [];
  const vertices = precomputedVertices ?? getVerticesInBrush(centerVx, centerVy, radius, vertexWidth, vertexHeight);

  if (vertices.length === 0) return [];

  const totalElev = vertices.reduce((sum, v) => {
    return sum + (vertexElevations[v.vy]?.[v.vx] ?? 0);
  }, 0);
  const avgElev = totalElev / vertices.length;

  for (const v of vertices) {
    const oldZ = vertexElevations[v.vy]?.[v.vx];
    if (oldZ === undefined) continue;

    const diff = avgElev - oldZ;
    // Blend towards average based on strength
    const newZ = oldZ + diff * 0.1 * brushStrength;

    if (Math.abs(newZ - oldZ) > 0.001) {
      modifications.push({ vx: v.vx, vy: v.vy, oldZ, newZ });
    }
  }

  return modifications;
}

export function applyFlattenVertices(
  centerVx: number,
  centerVy: number,
  vertexElevations: number[][],
  radius: number,
  vertexWidth: number,
  vertexHeight: number,
  targetZ?: number,
  precomputedVertices?: Array<{ vx: number; vy: number }>
): VertexModification[] {
  const modifications: VertexModification[] = [];

  const centerZ = targetZ ?? (vertexElevations[centerVy]?.[centerVx] ?? 0);
  const vertices = precomputedVertices ?? getVerticesInBrush(centerVx, centerVy, radius, vertexWidth, vertexHeight);

  for (const v of vertices) {
    const oldZ = vertexElevations[v.vy]?.[v.vx];
    if (oldZ === undefined) continue;

    if (Math.abs(oldZ - centerZ) > 0.01) {
      modifications.push({ vx: v.vx, vy: v.vy, oldZ, newZ: centerZ });
    }
  }

  return modifications;
}

export function applyLevelVertices(
  selectedVertices: Set<string>,
  vertexElevations: number[][]
): VertexModification[] {
  const modifications: VertexModification[] = [];

  if (selectedVertices.size === 0) return [];

  let totalElev = 0;
  let count = 0;

  for (const key of selectedVertices) {
    const [vxStr, vyStr] = key.split(',');
    const vx = parseInt(vxStr);
    const vy = parseInt(vyStr);
    const z = vertexElevations[vy]?.[vx];
    if (z !== undefined) {
      totalElev += z;
      count++;
    }
  }

  if (count === 0) return [];

  const avgElev = totalElev / count;

  for (const key of selectedVertices) {
    const [vxStr, vyStr] = key.split(',');
    const vx = parseInt(vxStr);
    const vy = parseInt(vyStr);
    const oldZ = vertexElevations[vy]?.[vx];
    if (oldZ !== undefined && Math.abs(oldZ - avgElev) > 0.01) {
      modifications.push({ vx, vy, oldZ, newZ: avgElev });
    }
  }

  return modifications;
}

export function applySculptTool(
  tool: SculptTool,
  centerVx: number,
  centerVy: number,
  vertexElevations: number[][],
  brushSize: number,
  brushStrength: number,
  vertexWidth: number,
  vertexHeight: number,
  selectedVertices?: Set<string>,
  precomputedVertices?: Array<{ vx: number; vy: number }>
): VertexModification[] {
  const modifications: VertexModification[] = [];

  switch (tool) {
    case 'raise': {
      const vertices = precomputedVertices ?? getVerticesInBrush(centerVx, centerVy, brushSize, vertexWidth, vertexHeight);
      for (const v of vertices) {
        const mod = applyRaiseVertex(v.vx, v.vy, vertexElevations, brushStrength);
        if (mod) modifications.push(mod);
      }
      break;
    }
    case 'lower': {
      const vertices = precomputedVertices ?? getVerticesInBrush(centerVx, centerVy, brushSize, vertexWidth, vertexHeight);
      for (const v of vertices) {
        const mod = applyLowerVertex(v.vx, v.vy, vertexElevations, brushStrength);
        if (mod) modifications.push(mod);
      }
      break;
    }
    case 'smooth': {
      const effectiveRadius = Math.max(brushSize, 1.5);
      return applySmoothVertices(centerVx, centerVy, vertexElevations, effectiveRadius, vertexWidth, vertexHeight, brushStrength, precomputedVertices);
    }
    case 'flatten': {
      return applyFlattenVertices(centerVx, centerVy, vertexElevations, brushSize, vertexWidth, vertexHeight, undefined, precomputedVertices);
    }
    case 'level': {
      if (selectedVertices && selectedVertices.size > 0) {
        return applyLevelVertices(selectedVertices, vertexElevations);
      }
      break;
    }
  }

  return modifications;
}



export function commitVertexModifications(
  modifications: VertexModification[],
  vertexElevations: number[][]
): void {
  for (const mod of modifications) {
    if (vertexElevations[mod.vy]) {
      vertexElevations[mod.vy][mod.vx] = mod.newZ;
    }
  }
}










