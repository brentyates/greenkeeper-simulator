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
  hoverVertex: { vertexId: number } | null;
  selectedVertices: Set<number>;
}

export interface VertexModification {
  vertexId: number;
  oldY: number;
  newY: number;
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
  };
}

export function selectVertex(
  state: EditorState,
  vertexId: number,
  additive: boolean = false
): void {
  if (!additive) {
    state.selectedVertices.clear();
  }
  state.selectedVertices.add(vertexId);
}

export function toggleVertex(state: EditorState, vertexId: number): void {
  if (state.selectedVertices.has(vertexId)) {
    state.selectedVertices.delete(vertexId);
  } else {
    state.selectedVertices.add(vertexId);
  }
}

export function isVertexSelected(state: EditorState, vertexId: number): boolean {
  return state.selectedVertices.has(vertexId);
}

export function selectAll(
  state: EditorState,
  topology: { vertices: Map<number, any> }
): void {
  state.selectedVertices.clear();
  for (const vertexId of topology.vertices.keys()) {
    state.selectedVertices.add(vertexId);
  }
}

export function deselectAll(state: EditorState): void {
  state.selectedVertices.clear();
}

export function invertSelection(
  state: EditorState,
  topology: { vertices: Map<number, any> }
): void {
  const newSelection = new Set<number>();
  for (const vertexId of topology.vertices.keys()) {
    if (!state.selectedVertices.has(vertexId)) {
      newSelection.add(vertexId);
    }
  }
  state.selectedVertices = newSelection;
}

export function selectVerticesInBox(
  state: EditorState,
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
  topology: { vertices: Map<number, { position: Vec3 }> },
  additive: boolean = false
): void {
  if (!additive) {
    state.selectedVertices.clear();
  }

  const x1 = Math.min(minX, maxX);
  const x2 = Math.max(minX, maxX);
  const z1 = Math.min(minZ, maxZ);
  const z2 = Math.max(minZ, maxZ);

  for (const [vertexId, vertex] of topology.vertices) {
    const pos = vertex.position;
    if (pos.x >= x1 && pos.x <= x2 && pos.z >= z1 && pos.z <= z2) {
      state.selectedVertices.add(vertexId);
    }
  }
}

export function selectVerticesInBrush(
  state: EditorState,
  worldX: number,
  worldZ: number,
  radius: number,
  topology: { vertices: Map<number, { position: Vec3 }> },
  additive: boolean = true
): void {
  if (!additive) {
    state.selectedVertices.clear();
  }
  const radiusSq = radius * radius;
  for (const [vertexId, vertex] of topology.vertices) {
    const dx = vertex.position.x - worldX;
    const dz = vertex.position.z - worldZ;
    if (dx * dx + dz * dz <= radiusSq) {
      state.selectedVertices.add(vertexId);
    }
  }
}

export function getSelectedVerticesList(state: EditorState): number[] {
  return Array.from(state.selectedVertices);
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


export function applyRaiseVertex(
  vertexId: number,
  topology: { vertices: Map<number, { position: Vec3 }> },
  amount: number = 1
): VertexModification | null {
  const vertex = topology.vertices.get(vertexId);
  if (!vertex) return null;

  const oldY = vertex.position.y;
  const newY = oldY + amount;
  vertex.position.y = newY;

  return { vertexId, oldY, newY };
}

export function applyLowerVertex(
  vertexId: number,
  topology: { vertices: Map<number, { position: Vec3 }> },
  amount: number = 1,
  minElev: number = -10
): VertexModification | null {
  const vertex = topology.vertices.get(vertexId);
  if (!vertex) return null;

  const oldY = vertex.position.y;
  const newY = Math.max(minElev, oldY - amount);
  if (newY === oldY) return null;

  vertex.position.y = newY;
  return { vertexId, oldY, newY };
}

export function applySmoothVertices(
  vertexIds: number[],
  topology: { vertices: Map<number, { position: Vec3 }> },
  brushStrength: number = 1.0
): VertexModification[] {
  const modifications: VertexModification[] = [];

  if (vertexIds.length === 0) return [];

  const totalElev = vertexIds.reduce((sum, id) => {
    const v = topology.vertices.get(id);
    return sum + (v?.position.y ?? 0);
  }, 0);
  const avgElev = totalElev / vertexIds.length;

  for (const id of vertexIds) {
    const vertex = topology.vertices.get(id);
    if (!vertex) continue;

    const oldY = vertex.position.y;
    const diff = avgElev - oldY;
    const newY = oldY + diff * 0.1 * brushStrength;

    if (Math.abs(newY - oldY) > 0.001) {
      vertex.position.y = newY;
      modifications.push({ vertexId: id, oldY, newY });
    }
  }

  return modifications;
}

export function applyFlattenVertices(
  vertexIds: number[],
  topology: { vertices: Map<number, { position: Vec3 }> },
  targetY?: number
): VertexModification[] {
  const modifications: VertexModification[] = [];

  if (vertexIds.length === 0) return [];

  const flattenY = targetY ?? (topology.vertices.get(vertexIds[0])?.position.y ?? 0);

  for (const id of vertexIds) {
    const vertex = topology.vertices.get(id);
    if (!vertex) continue;

    const oldY = vertex.position.y;
    if (Math.abs(oldY - flattenY) > 0.01) {
      vertex.position.y = flattenY;
      modifications.push({ vertexId: id, oldY, newY: flattenY });
    }
  }

  return modifications;
}

export function applyLevelVertices(
  selectedVertexIds: Set<number>,
  topology: { vertices: Map<number, { position: Vec3 }> }
): VertexModification[] {
  const modifications: VertexModification[] = [];

  if (selectedVertexIds.size === 0) return [];

  let totalElev = 0;
  let count = 0;

  for (const id of selectedVertexIds) {
    const vertex = topology.vertices.get(id);
    if (vertex) {
      totalElev += vertex.position.y;
      count++;
    }
  }

  if (count === 0) return [];

  const avgElev = totalElev / count;

  for (const id of selectedVertexIds) {
    const vertex = topology.vertices.get(id);
    if (vertex && Math.abs(vertex.position.y - avgElev) > 0.01) {
      const oldY = vertex.position.y;
      vertex.position.y = avgElev;
      modifications.push({ vertexId: id, oldY, newY: avgElev });
    }
  }

  return modifications;
}

export function applySculptTool(
  tool: SculptTool,
  vertexIds: number[],
  topology: { vertices: Map<number, { position: Vec3 }> },
  brushStrength: number,
  selectedVertices?: Set<number>
): VertexModification[] {
  const modifications: VertexModification[] = [];

  switch (tool) {
    case 'raise': {
      for (const id of vertexIds) {
        const mod = applyRaiseVertex(id, topology, brushStrength);
        if (mod) modifications.push(mod);
      }
      break;
    }
    case 'lower': {
      for (const id of vertexIds) {
        const mod = applyLowerVertex(id, topology, brushStrength);
        if (mod) modifications.push(mod);
      }
      break;
    }
    case 'smooth': {
      return applySmoothVertices(vertexIds, topology, brushStrength);
    }
    case 'flatten': {
      return applyFlattenVertices(vertexIds, topology);
    }
    case 'level': {
      if (selectedVertices && selectedVertices.size > 0) {
        return applyLevelVertices(selectedVertices, topology);
      }
      break;
    }
  }

  return modifications;
}
