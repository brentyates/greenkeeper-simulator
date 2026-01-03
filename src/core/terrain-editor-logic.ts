import {
  TerrainType,
  TERRAIN_CODES,
  getTerrainCode,
  MAX_SLOPE_DELTA,
  getAdjacentPositions,
} from "./terrain";

export type ElevationTool = "raise" | "lower" | "flatten" | "smooth";
export type TerrainBrush =
  | "terrain_fairway"
  | "terrain_rough"
  | "terrain_green"
  | "terrain_bunker"
  | "terrain_water";
export type EditorTool = ElevationTool | TerrainBrush;

export interface EditorState {
  enabled: boolean;
  activeTool: EditorTool;
  brushSize: number;
  isDragging: boolean;
  hoverTile: { x: number; y: number } | null;
  hoverCorner: "nw" | "ne" | "se" | "sw" | null;
  dragCorner: "nw" | "ne" | "se" | "sw" | null;
  dragStartScreenY: number | null;
  dragLastScreenY: number | null;
}

export interface TileModification {
  x: number;
  y: number;
  oldElevation: number;
  newElevation: number;
  oldType: number;
  newType: number;
}

export interface EditorAction {
  modifications: TileModification[];
  timestamp: number;
}

export function createInitialEditorState(): EditorState {
  return {
    enabled: false,
    activeTool: "raise",
    brushSize: 1,
    isDragging: false,
    hoverTile: null,
    hoverCorner: null,
    dragCorner: null,
    dragStartScreenY: null,
    dragLastScreenY: null,
  };
}

export function isElevationTool(tool: EditorTool): tool is ElevationTool {
  return (
    tool === "raise" ||
    tool === "lower" ||
    tool === "flatten" ||
    tool === "smooth"
  );
}

export function isTerrainBrush(tool: EditorTool): tool is TerrainBrush {
  return tool.startsWith("terrain_");
}

export function getTerrainTypeFromBrush(brush: TerrainBrush): TerrainType {
  switch (brush) {
    case "terrain_fairway":
      return "fairway";
    case "terrain_rough":
      return "rough";
    case "terrain_green":
      return "green";
    case "terrain_bunker":
      return "bunker";
    case "terrain_water":
      return "water";
  }
}

function getElevationAt(
  x: number,
  y: number,
  elevation: number[][]
): number | null {
  if (y < 0 || y >= elevation.length) return null;
  if (x < 0 || x >= (elevation[y]?.length ?? 0)) return null;
  return elevation[y][x];
}

function getNeighborElevations(
  x: number,
  y: number,
  elevation: number[][]
): number[] {
  const neighbors: number[] = [];
  const positions = getAdjacentPositions(x, y, true);
  for (const pos of positions) {
    const elev = getElevationAt(pos.x, pos.y, elevation);
    if (elev !== null) {
      neighbors.push(elev);
    }
  }
  return neighbors;
}

export function canRaiseAt(
  x: number,
  y: number,
  elevation: number[][],
  _maxDelta: number = MAX_SLOPE_DELTA
): boolean {
  const currentElev = getElevationAt(x, y, elevation);
  if (currentElev === null) return false;

  // RCT allows any elevation difference (creates cliffs)
  return true;
}

export function canLowerAt(
  x: number,
  y: number,
  elevation: number[][],
  _maxDelta: number = MAX_SLOPE_DELTA,
  minElev: number = -10
): boolean {
  const currentElev = getElevationAt(x, y, elevation);
  if (currentElev === null) return false;
  if (currentElev <= minElev) return false;

  // RCT allows any elevation difference (creates cliffs)
  return true;
}

export function applyRaise(
  x: number,
  y: number,
  elevation: number[][],
  layout: number[][]
): TileModification | null {
  if (!canRaiseAt(x, y, elevation)) return null;

  const oldElev = elevation[y][x];
  const terrainCode = layout[y]?.[x] ?? TERRAIN_CODES.ROUGH;

  return {
    x,
    y,
    oldElevation: oldElev,
    newElevation: oldElev + 1,
    oldType: terrainCode,
    newType: terrainCode,
  };
}

export function applyLower(
  x: number,
  y: number,
  elevation: number[][],
  layout: number[][]
): TileModification | null {
  if (!canLowerAt(x, y, elevation)) return null;

  const oldElev = elevation[y][x];
  const terrainCode = layout[y]?.[x] ?? TERRAIN_CODES.ROUGH;

  return {
    x,
    y,
    oldElevation: oldElev,
    newElevation: oldElev - 1,
    oldType: terrainCode,
    newType: terrainCode,
  };
}

export function applyFlatten(
  x: number,
  y: number,
  elevation: number[][],
  layout: number[][],
  targetElevation?: number
): TileModification | null {
  const currentElev = getElevationAt(x, y, elevation);
  if (currentElev === null) return null;

  let target = targetElevation;
  if (target === undefined) {
    const neighbors = getNeighborElevations(x, y, elevation);
    if (neighbors.length === 0) return null;
    target = Math.round(
      neighbors.reduce((a, b) => a + b, 0) / neighbors.length
    );
  }

  if (target === currentElev) return null;

  const neighbors = getNeighborElevations(x, y, elevation);
  for (const neighborElev of neighbors) {
    if (Math.abs(target - neighborElev) > MAX_SLOPE_DELTA) {
      return null;
    }
  }

  const terrainCode = layout[y]?.[x] ?? TERRAIN_CODES.ROUGH;

  return {
    x,
    y,
    oldElevation: currentElev,
    newElevation: target,
    oldType: terrainCode,
    newType: terrainCode,
  };
}

export function applySmooth(
  centerX: number,
  centerY: number,
  elevation: number[][],
  layout: number[][],
  radius: number = 1
): TileModification[] {
  const modifications: TileModification[] = [];
  const positions: Array<{ x: number; y: number }> = [];

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= radius * radius) {
        const px = centerX + dx;
        const py = centerY + dy;
        if (getElevationAt(px, py, elevation) !== null) {
          positions.push({ x: px, y: py });
        }
      }
    }
  }

  if (positions.length === 0) return [];

  const totalElev = positions.reduce((sum, pos) => {
    return sum + (getElevationAt(pos.x, pos.y, elevation) ?? 0);
  }, 0);
  const avgElev = Math.round(totalElev / positions.length);

  for (const pos of positions) {
    const mod = applyFlatten(pos.x, pos.y, elevation, layout, avgElev);
    if (mod) {
      modifications.push(mod);
    }
  }

  return modifications;
}

export function applyTerrainType(
  x: number,
  y: number,
  elevation: number[][],
  layout: number[][],
  newType: TerrainType
): TileModification | null {
  if (y < 0 || y >= layout.length) return null;
  if (x < 0 || x >= (layout[y]?.length ?? 0)) return null;

  const oldCode = layout[y][x];
  const newCode = getTerrainCode(newType);

  if (oldCode === newCode) return null;

  const elev = elevation[y]?.[x] ?? 0;

  return {
    x,
    y,
    oldElevation: elev,
    newElevation: elev,
    oldType: oldCode,
    newType: newCode,
  };
}

export function applyTool(
  tool: EditorTool,
  x: number,
  y: number,
  elevation: number[][],
  layout: number[][],
  brushSize: number = 1
): TileModification[] {
  const modifications: TileModification[] = [];

  if (isTerrainBrush(tool)) {
    const terrainType = getTerrainTypeFromBrush(tool);
    const positions = getCellsInBrush(x, y, brushSize);
    for (const pos of positions) {
      const mod = applyTerrainType(
        pos.x,
        pos.y,
        elevation,
        layout,
        terrainType
      );
      if (mod) modifications.push(mod);
    }
    return modifications;
  }

  switch (tool) {
    case "raise": {
      const positions = getCellsInBrush(x, y, brushSize);
      for (const pos of positions) {
        const mod = applyRaise(pos.x, pos.y, elevation, layout);
        if (mod) modifications.push(mod);
      }
      break;
    }
    case "lower": {
      const positions = getCellsInBrush(x, y, brushSize);
      for (const pos of positions) {
        const mod = applyLower(pos.x, pos.y, elevation, layout);
        if (mod) modifications.push(mod);
      }
      break;
    }
    case "flatten": {
      const centerElev = getElevationAt(x, y, elevation);
      if (centerElev !== null) {
        const positions = getCellsInBrush(x, y, brushSize);
        for (const pos of positions) {
          const mod = applyFlatten(pos.x, pos.y, elevation, layout, centerElev);
          if (mod) modifications.push(mod);
        }
      }
      break;
    }
    case "smooth": {
      return applySmooth(x, y, elevation, layout, brushSize);
    }
  }

  return modifications;
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

export function commitModifications(
  modifications: TileModification[],
  elevation: number[][],
  layout: number[][]
): void {
  for (const mod of modifications) {
    if (
      mod.y >= 0 &&
      mod.y < elevation.length &&
      mod.x >= 0 &&
      mod.x < (elevation[mod.y]?.length ?? 0)
    ) {
      elevation[mod.y][mod.x] = mod.newElevation;
    }
    if (
      mod.y >= 0 &&
      mod.y < layout.length &&
      mod.x >= 0 &&
      mod.x < (layout[mod.y]?.length ?? 0)
    ) {
      layout[mod.y][mod.x] = mod.newType;
    }
  }
}

export function revertModifications(
  modifications: TileModification[],
  elevation: number[][],
  layout: number[][]
): void {
  for (const mod of modifications) {
    if (
      mod.y >= 0 &&
      mod.y < elevation.length &&
      mod.x >= 0 &&
      mod.x < (elevation[mod.y]?.length ?? 0)
    ) {
      elevation[mod.y][mod.x] = mod.oldElevation;
    }
    if (
      mod.y >= 0 &&
      mod.y < layout.length &&
      mod.x >= 0 &&
      mod.x < (layout[mod.y]?.length ?? 0)
    ) {
      layout[mod.y][mod.x] = mod.oldType;
    }
  }
}

export function createEditorAction(
  modifications: TileModification[]
): EditorAction {
  return {
    modifications,
    timestamp: Date.now(),
  };
}

export function canUndo(undoStack: EditorAction[]): boolean {
  return undoStack.length > 0;
}

export function canRedo(redoStack: EditorAction[]): boolean {
  return redoStack.length > 0;
}

export function undo(
  undoStack: EditorAction[],
  redoStack: EditorAction[],
  elevation: number[][],
  layout: number[][]
): EditorAction | null {
  const action = undoStack.pop();
  if (!action) return null;

  revertModifications(action.modifications, elevation, layout);
  redoStack.push(action);

  return action;
}

export function redo(
  undoStack: EditorAction[],
  redoStack: EditorAction[],
  elevation: number[][],
  layout: number[][]
): EditorAction | null {
  const action = redoStack.pop();
  if (!action) return null;

  commitModifications(action.modifications, elevation, layout);
  undoStack.push(action);

  return action;
}

export function getAffectedTiles(
  modifications: TileModification[]
): Array<{ x: number; y: number }> {
  const affected = new Set<string>();
  const tiles: Array<{ x: number; y: number }> = [];

  for (const mod of modifications) {
    const key = `${mod.x},${mod.y}`;
    if (!affected.has(key)) {
      affected.add(key);
      tiles.push({ x: mod.x, y: mod.y });
    }
    const neighbors = getAdjacentPositions(mod.x, mod.y, true);
    for (const neighbor of neighbors) {
      const nKey = `${neighbor.x},${neighbor.y}`;
      if (!affected.has(nKey)) {
        affected.add(nKey);
        tiles.push(neighbor);
      }
    }
  }

  return tiles;
}

export function exportTerrainData(
  layout: number[][],
  elevation: number[][]
): { layout: number[][]; elevation: number[][] } {
  return {
    layout: layout.map((row) => [...row]),
    elevation: elevation.map((row) => [...row]),
  };
}

export function cloneGrid<T>(grid: T[][]): T[][] {
  return grid.map((row) => [...row]);
}
