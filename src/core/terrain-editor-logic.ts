import {
  TerrainType,
  getTerrainCode,
} from "./terrain";

export type EditorMode = 'sculpt' | 'paint';
export type TopologyMode = 'vertex' | 'edge' | 'face';
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

export interface TerrainTypeModification {
  x: number;
  y: number;
  oldType: number;
  newType: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PositionModification {
  vx: number;
  vy: number;
  oldPos: Vec3;
  newPos: Vec3;
}

import { TopologyModification } from './mesh-topology';

export type EditorAction =
  | { type: 'elevation'; modifications: VertexModification[] }
  | { type: 'paint'; modifications: TerrainTypeModification[] }
  | { type: 'position'; modifications: PositionModification[] }
  | { type: 'topology'; modification: TopologyModification };


export type SelectionMode = 'single' | 'box' | 'brush';

export function createInitialEditorState(): EditorState {
  return {
    enabled: false,
    mode: 'sculpt',
    activeTool: 'terrain_fairway',
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
  radius: number,
  vertexWidth: number,
  vertexHeight: number
): Array<{ vx: number; vy: number }> {
  if (radius <= 1) {
    return [{ vx: centerVx, vy: centerVy }];
  }

  const vertices: Array<{ vx: number; vy: number }> = [];
  const r = radius - 1;

  for (let dvy = -r; dvy <= r; dvy++) {
    for (let dvx = -r; dvx <= r; dvx++) {
      if (dvx * dvx + dvy * dvy <= r * r) {
        const vx = centerVx + dvx;
        const vy = centerVy + dvy;
        if (vx >= 0 && vx < vertexWidth && vy >= 0 && vy < vertexHeight) {
          vertices.push({ vx, vy });
        }
      }
    }
  }

  return vertices;
}

export function getCellsInBrush(
  centerX: number,
  centerY: number,
  radius: number
): Array<{ x: number; y: number }> {
  if (radius <= 1) {
    return [{ x: centerX, y: centerY }];
  }

  const cells: Array<{ x: number; y: number }> = [];
  const r = radius - 1;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) {
        cells.push({ x: centerX + dx, y: centerY + dy });
      }
    }
  }
  return cells;
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
  vertexHeight: number
): VertexModification[] {
  const modifications: VertexModification[] = [];
  const vertices = getVerticesInBrush(centerVx, centerVy, radius, vertexWidth, vertexHeight);

  if (vertices.length === 0) return [];

  const totalElev = vertices.reduce((sum, v) => {
    return sum + (vertexElevations[v.vy]?.[v.vx] ?? 0);
  }, 0);
  const avgElev = totalElev / vertices.length;

  for (const v of vertices) {
    const oldZ = vertexElevations[v.vy]?.[v.vx];
    if (oldZ === undefined) continue;

    const diff = avgElev - oldZ;
    const newZ = oldZ + diff * 0.5;

    if (Math.abs(newZ - oldZ) > 0.01) {
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
  targetZ?: number
): VertexModification[] {
  const modifications: VertexModification[] = [];

  const centerZ = targetZ ?? (vertexElevations[centerVy]?.[centerVx] ?? 0);
  const vertices = getVerticesInBrush(centerVx, centerVy, radius, vertexWidth, vertexHeight);

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
  selectedVertices?: Set<string>
): VertexModification[] {
  const modifications: VertexModification[] = [];

  switch (tool) {
    case 'raise': {
      const vertices = getVerticesInBrush(centerVx, centerVy, brushSize, vertexWidth, vertexHeight);
      for (const v of vertices) {
        const mod = applyRaiseVertex(v.vx, v.vy, vertexElevations, brushStrength);
        if (mod) modifications.push(mod);
      }
      break;
    }
    case 'lower': {
      const vertices = getVerticesInBrush(centerVx, centerVy, brushSize, vertexWidth, vertexHeight);
      for (const v of vertices) {
        const mod = applyLowerVertex(v.vx, v.vy, vertexElevations, brushStrength);
        if (mod) modifications.push(mod);
      }
      break;
    }
    case 'smooth': {
      return applySmoothVertices(centerVx, centerVy, vertexElevations, brushSize, vertexWidth, vertexHeight);
    }
    case 'flatten': {
      return applyFlattenVertices(centerVx, centerVy, vertexElevations, brushSize, vertexWidth, vertexHeight);
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


function applyTerrainTypeInternal(
  x: number,
  y: number,
  layout: number[][],
  newType: TerrainType
): TerrainTypeModification | null {
  if (y < 0 || y >= layout.length) return null;
  if (x < 0 || x >= (layout[y]?.length ?? 0)) return null;

  const oldCode = layout[y][x];
  const newCode = getTerrainCode(newType);

  if (oldCode === newCode) return null;

  return {
    x,
    y,
    oldType: oldCode,
    newType: newCode,
  };
}

export function applyPaintBrush(
  centerX: number,
  centerY: number,
  layout: number[][],
  terrainType: TerrainType,
  brushSize: number,
  mapWidth: number,
  mapHeight: number
): TerrainTypeModification[] {
  const modifications: TerrainTypeModification[] = [];
  const cells = getCellsInBrush(centerX, centerY, brushSize);

  for (const cell of cells) {
    if (cell.x >= 0 && cell.x < mapWidth && cell.y >= 0 && cell.y < mapHeight) {
      const mod = applyTerrainTypeInternal(cell.x, cell.y, layout, terrainType);
      if (mod) modifications.push(mod);
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

export function revertVertexModifications(
  modifications: VertexModification[],
  vertexElevations: number[][]
): void {
  for (const mod of modifications) {
    if (vertexElevations[mod.vy]) {
      vertexElevations[mod.vy][mod.vx] = mod.oldZ;
    }
  }
}

export function commitTerrainTypeModifications(
  modifications: TerrainTypeModification[],
  layout: number[][]
): void {
  for (const mod of modifications) {
    if (layout[mod.y]) {
      layout[mod.y][mod.x] = mod.newType;
    }
  }
}

export function revertTerrainTypeModifications(
  modifications: TerrainTypeModification[],
  layout: number[][]
): void {
  for (const mod of modifications) {
    if (layout[mod.y]) {
      layout[mod.y][mod.x] = mod.oldType;
    }
  }
}

export function createElevationAction(modifications: VertexModification[]): EditorAction {
  return { type: 'elevation', modifications };
}

export function createPaintAction(modifications: TerrainTypeModification[]): EditorAction {
  return { type: 'paint', modifications };
}

export function createPositionAction(modifications: PositionModification[]): EditorAction {
  return { type: 'position', modifications };
}

export function createTopologyAction(modification: TopologyModification): EditorAction {
  return { type: 'topology', modification };
}

export function canUndo(undoStack: EditorAction[]): boolean {
  return undoStack.length > 0;
}

export function canRedo(redoStack: EditorAction[]): boolean {
  return redoStack.length > 0;
}

export function undoAction(
  undoStack: EditorAction[],
  redoStack: EditorAction[],
  vertexElevations: number[][],
  layout: number[][]
): EditorAction | null {
  const action = undoStack.pop();
  if (!action) return null;

  if (action.type === 'elevation') {
    revertVertexModifications(action.modifications, vertexElevations);
  } else if (action.type === 'paint') {
    revertTerrainTypeModifications(action.modifications, layout);
  }

  redoStack.push(action);
  return action;
}

export function redoAction(
  undoStack: EditorAction[],
  redoStack: EditorAction[],
  vertexElevations: number[][],
  layout: number[][]
): EditorAction | null {
  const action = redoStack.pop();
  if (!action) return null;

  if (action.type === 'elevation') {
    commitVertexModifications(action.modifications, vertexElevations);
  } else if (action.type === 'paint') {
    commitTerrainTypeModifications(action.modifications, layout);
  }

  undoStack.push(action);
  return action;
}









