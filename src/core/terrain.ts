export type TerrainType = "fairway" | "rough" | "green" | "bunker" | "water" | "tee";
export type ObstacleType = "none" | "tree" | "pine_tree" | "shrub" | "bush";
export type OverlayMode = "normal" | "moisture" | "nutrients" | "height" | "irrigation";

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const ELEVATION_HEIGHT = 4;

export const TERRAIN_CODES = {
  FAIRWAY: 0,
  ROUGH: 1,
  GREEN: 2,
  BUNKER: 3,
  WATER: 4,
  TEE: 5,
} as const;

export const OBSTACLE_CODES = {
  NONE: 0,
  TREE: 1,
  PINE_TREE: 2,
  SHRUB: 3,
  BUSH: 4,
} as const;

export function isNonRough(type: TerrainType): boolean {
  return type !== 'rough';
}

const TERRAIN_TYPES: TerrainType[] = ["fairway", "rough", "green", "bunker", "water", "tee"];
const OBSTACLE_TYPES: ObstacleType[] = ["none", "tree", "pine_tree", "shrub", "bush"];

export function getTerrainType(code: number): TerrainType {
  return TERRAIN_TYPES[code] || "rough";
}

export function getObstacleType(code: number): ObstacleType {
  return OBSTACLE_TYPES[code] || "none";
}

export function getInitialValues(type: TerrainType) {
  return {
    fairway: { height: 30, moisture: 60, nutrients: 70 },
    rough: { height: 70, moisture: 50, nutrients: 50 },
    green: { height: 10, moisture: 70, nutrients: 80 },
    bunker: { height: 0, moisture: 20, nutrients: 0 },
    water: { height: 0, moisture: 100, nutrients: 0 },
    tee: { height: 15, moisture: 65, nutrients: 75 }
  }[type];
}

export function gridToScreen(
  gridX: number,
  gridY: number,
  mapWidth: number,
  elevation: number = 0
): { x: number; y: number } {
  const screenX =
    (gridX - gridY) * (TILE_WIDTH / 2) + (mapWidth * TILE_WIDTH) / 2;
  const screenY =
    (gridX + gridY) * (TILE_HEIGHT / 2) - elevation * ELEVATION_HEIGHT;
  return { x: screenX, y: screenY };
}

export function screenToGrid(
  screenX: number,
  screenY: number,
  mapWidth: number
): { x: number; y: number } {
  const offsetX = screenX - (mapWidth * TILE_WIDTH) / 2;
  const isoX = (offsetX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2;
  const isoY = (screenY / (TILE_HEIGHT / 2) - offsetX / (TILE_WIDTH / 2)) / 2;
  return { x: Math.floor(isoX), y: Math.floor(isoY) };
}

export function isGrassTerrain(type: TerrainType): boolean {
  return type === "fairway" || type === "rough" || type === "green" || type === "tee";
}

export function calculateHealth(
  cell: { type: TerrainType; moisture: number; nutrients: number; height: number }
): number {
  if (!isGrassTerrain(cell.type)) {
    return 100;
  }
  const moistureScore = cell.moisture * 0.35;
  const nutrientScore = cell.nutrients * 0.35;
  const heightScore = (100 - Math.min(cell.height, 100)) * 0.3;
  return Math.max(
    0,
    Math.min(100, moistureScore + nutrientScore + heightScore)
  );
}

export interface WalkableCell {
  type: TerrainType;
  obstacle: ObstacleType;
}

export function isWalkable(cell: WalkableCell | null): boolean {
  if (!cell) return false;
  if (cell.type === "water") return false;
  if (cell.obstacle !== "none") return false;
  return true;
}

export function getRampDirection(
  elevation: number,
  northElev: number | null,
  southElev: number | null,
  eastElev: number | null,
  westElev: number | null
): "north" | "south" | "east" | "west" | null {
  const n = northElev ?? elevation;
  const s = southElev ?? elevation;
  const e = eastElev ?? elevation;
  const w = westElev ?? elevation;

  if (n > elevation && n - elevation === 1 && s <= elevation) {
    return "north";
  }
  if (s > elevation && s - elevation === 1 && n <= elevation) {
    return "south";
  }
  if (e > elevation && e - elevation === 1 && w <= elevation) {
    return "east";
  }
  if (w > elevation && w - elevation === 1 && e <= elevation) {
    return "west";
  }

  return null;
}

export function getTerrainSpeedModifier(type: TerrainType): number {
  return { fairway: 1.0, green: 1.0, rough: 0.7, bunker: 0.5, water: 0.0, tee: 1.0 }[type] ?? 0.7;
}

export const getTerrainMowable = isGrassTerrain;
export const getTerrainWaterable = isGrassTerrain;
export const getTerrainFertilizable = isGrassTerrain;

export function clampToGrid(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max - 1, Math.floor(value)));
}

const TERRAIN_NAMES: Record<TerrainType, string> = { fairway: "Fairway", rough: "Rough", green: "Green", bunker: "Bunker", water: "Water", tee: "Tee Box" };

export function getTerrainDisplayName(type: TerrainType): string { return TERRAIN_NAMES[type]; }

const OBSTACLE_NAMES: Record<ObstacleType, string> = { none: "None", tree: "Tree", pine_tree: "Pine Tree", shrub: "Shrub", bush: "Bush" };
const TERRAIN_CODE_MAP: Record<TerrainType, number> = { fairway: 0, rough: 1, green: 2, bunker: 3, water: 4, tee: 5 };

export function getObstacleDisplayName(type: ObstacleType): string { return OBSTACLE_NAMES[type]; }

export interface TerrainThresholds {
  mownHeight: number;
  growingHeight: number;
}

export function getTerrainThresholds(type: TerrainType): TerrainThresholds {
  return {
    fairway: { mownHeight: 20, growingHeight: 45 },
    rough: { mownHeight: 30, growingHeight: 60 },
    green: { mownHeight: 10, growingHeight: 22 },
    tee: { mownHeight: 12, growingHeight: 25 },
    bunker: { mownHeight: 0, growingHeight: 0 },
    water: { mownHeight: 0, growingHeight: 0 },
  }[type] || { mownHeight: 30, growingHeight: 60 };
}

export function getGrassState(cell: { type: TerrainType; height: number }): "mown" | "growing" | "unmown" {
  if (!isGrassTerrain(cell.type)) {
    return "mown";
  }
  const thresholds = getTerrainThresholds(cell.type);
  if (cell.height <= thresholds.mownHeight) return "mown";
  if (cell.height <= thresholds.growingHeight) return "growing";
  return "unmown";
}

export function getTerrainCode(type: TerrainType): number { return TERRAIN_CODE_MAP[type]; }

export function getAdjacentPositions(x: number, y: number, diag: boolean = false): { x: number; y: number }[] {
  const p = [{ x, y: y-1 }, { x: x+1, y }, { x, y: y+1 }, { x: x-1, y }];
  return diag ? [...p, { x: x-1, y: y-1 }, { x: x+1, y: y-1 }, { x: x+1, y: y+1 }, { x: x-1, y: y+1 }] : p;
}

import { TerrainMeshTopology, computeFaceSlopeAngle, MAX_WALKABLE_SLOPE_DEGREES } from './mesh-topology';

export function isFaceWalkableBySlope(
  topology: TerrainMeshTopology,
  faceId: number,
  heightUnit: number,
  maxSlopeDegrees: number = MAX_WALKABLE_SLOPE_DEGREES
): boolean {
  const tri = topology.triangles.get(faceId);
  if (!tri) return false;
  if (getTerrainType(tri.terrainCode) === 'water') return false;
  if (computeFaceSlopeAngle(topology, faceId, heightUnit) > maxSlopeDegrees) return false;
  return true;
}
