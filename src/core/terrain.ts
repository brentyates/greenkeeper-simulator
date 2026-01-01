export type TerrainType = 'fairway' | 'rough' | 'green' | 'bunker' | 'water';
export type ObstacleType = 'none' | 'tree' | 'pine_tree' | 'shrub' | 'bush';

export interface CellState {
  x: number;
  y: number;
  type: TerrainType;
  height: number;
  moisture: number;
  nutrients: number;
  health: number;
  elevation: number;
  obstacle: ObstacleType;
  lastMowed: number;
  lastWatered: number;
  lastFertilized: number;
}

export interface CourseLayout {
  width: number;
  height: number;
  layout: number[][];
  elevation?: number[][];
  obstacles?: Array<{ x: number; y: number; type: number }>;
}

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const ELEVATION_HEIGHT = 16;

export function getTerrainType(code: number): TerrainType {
  switch (code) {
    case 0: return 'fairway';
    case 1: return 'rough';
    case 2: return 'green';
    case 3: return 'bunker';
    case 4: return 'water';
    default: return 'rough';
  }
}

export function getObstacleType(code: number): ObstacleType {
  switch (code) {
    case 0: return 'none';
    case 1: return 'tree';
    case 2: return 'pine_tree';
    case 3: return 'shrub';
    case 4: return 'bush';
    default: return 'none';
  }
}

export function getInitialValues(type: TerrainType): { height: number; moisture: number; nutrients: number } {
  switch (type) {
    case 'fairway':
      return { height: 30, moisture: 60, nutrients: 70 };
    case 'rough':
      return { height: 70, moisture: 50, nutrients: 50 };
    case 'green':
      return { height: 10, moisture: 70, nutrients: 80 };
    case 'bunker':
      return { height: 0, moisture: 20, nutrients: 0 };
    case 'water':
      return { height: 0, moisture: 100, nutrients: 0 };
    default:
      return { height: 50, moisture: 50, nutrients: 50 };
  }
}

export function gridToScreen(gridX: number, gridY: number, elevation: number, mapWidth: number): { x: number; y: number } {
  const screenX = (gridX - gridY) * (TILE_WIDTH / 2) + (mapWidth * TILE_WIDTH / 2);
  const screenY = (gridX + gridY) * (TILE_HEIGHT / 2) - elevation * ELEVATION_HEIGHT;
  return { x: screenX, y: screenY };
}

export function screenToGrid(screenX: number, screenY: number, mapWidth: number): { x: number; y: number } {
  const offsetX = screenX - (mapWidth * TILE_WIDTH / 2);
  const isoX = (offsetX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2;
  const isoY = (screenY / (TILE_HEIGHT / 2) - offsetX / (TILE_WIDTH / 2)) / 2;
  return { x: Math.floor(isoX), y: Math.floor(isoY) };
}

export function calculateHealth(cell: Pick<CellState, 'type' | 'moisture' | 'nutrients' | 'height'>): number {
  if (cell.type === 'bunker' || cell.type === 'water') {
    return 100;
  }
  const moistureScore = cell.moisture * 0.3;
  const nutrientScore = cell.nutrients * 0.3;
  const heightScore = (100 - Math.min(cell.height, 100)) * 0.4;
  return Math.max(0, Math.min(100, moistureScore + nutrientScore + heightScore));
}

export function isWalkable(cell: CellState | null): boolean {
  if (!cell) return false;
  if (cell.type === 'water') return false;
  if (cell.obstacle !== 'none') return false;
  return true;
}

export function canMoveFromTo(fromCell: CellState | null, toCell: CellState | null): boolean {
  if (!fromCell || !toCell) return false;
  if (!isWalkable(toCell)) return false;

  const elevationDiff = Math.abs(toCell.elevation - fromCell.elevation);
  if (elevationDiff > 1) return false;

  return true;
}

export function getRampDirection(
  elevation: number,
  northElev: number | null,
  southElev: number | null,
  eastElev: number | null,
  westElev: number | null
): 'north' | 'south' | 'east' | 'west' | null {
  const n = northElev ?? elevation;
  const s = southElev ?? elevation;
  const e = eastElev ?? elevation;
  const w = westElev ?? elevation;

  if (n > elevation && n - elevation === 1 && s <= elevation) {
    return 'north';
  }
  if (s > elevation && s - elevation === 1 && n <= elevation) {
    return 'south';
  }
  if (e > elevation && e - elevation === 1 && w <= elevation) {
    return 'east';
  }
  if (w > elevation && w - elevation === 1 && e <= elevation) {
    return 'west';
  }

  return null;
}

export function getTextureForCell(cell: CellState, rampDir: 'north' | 'south' | 'east' | 'west' | null): string {
  if (rampDir && cell.type !== 'bunker' && cell.type !== 'water') {
    return `iso_ramp_${rampDir}`;
  }

  if (cell.type === 'bunker') return 'iso_bunker';
  if (cell.type === 'water') return 'iso_water';
  if (cell.health < 20) return 'iso_grass_dead';
  if (cell.health < 40) return 'iso_grass_dry';

  if (cell.type === 'fairway') {
    if (cell.height <= 20) return 'iso_fairway_mown';
    if (cell.height <= 45) return 'iso_fairway_growing';
    return 'iso_fairway_unmown';
  }

  if (cell.type === 'rough') {
    if (cell.height <= 30) return 'iso_rough_mown';
    if (cell.height <= 60) return 'iso_rough_growing';
    return 'iso_rough_unmown';
  }

  if (cell.type === 'green') {
    if (cell.height <= 10) return 'iso_green_mown';
    if (cell.height <= 22) return 'iso_green_growing';
    return 'iso_green_unmown';
  }

  if (cell.height <= 30) return 'iso_rough_mown';
  if (cell.height <= 60) return 'iso_rough_growing';
  return 'iso_rough_unmown';
}

export function getCellsInRadius(centerX: number, centerY: number, radius: number): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= radius * radius) {
        cells.push({ x: centerX + dx, y: centerY + dy });
      }
    }
  }
  return cells;
}
