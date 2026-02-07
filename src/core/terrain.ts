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

export function getTerrainType(code: number): TerrainType {
  switch (code) {
    case 0:
      return "fairway";
    case 1:
      return "rough";
    case 2:
      return "green";
    case 3:
      return "bunker";
    case 4:
      return "water";
    case 5:
      return "tee";
    default:
      return "rough";
  }
}

export function getObstacleType(code: number): ObstacleType {
  switch (code) {
    case 0:
      return "none";
    case 1:
      return "tree";
    case 2:
      return "pine_tree";
    case 3:
      return "shrub";
    case 4:
      return "bush";
    default:
      return "none";
  }
}

export function getInitialValues(type: TerrainType): {
  height: number;
  moisture: number;
  nutrients: number;
} {
  switch (type) {
    case "fairway":
      return { height: 30, moisture: 60, nutrients: 70 };
    case "rough":
      return { height: 70, moisture: 50, nutrients: 50 };
    case "green":
      return { height: 10, moisture: 70, nutrients: 80 };
    case "bunker":
      return { height: 0, moisture: 20, nutrients: 0 };
    case "water":
      return { height: 0, moisture: 100, nutrients: 0 };
    case "tee":
      return { height: 15, moisture: 65, nutrients: 75 };
  }
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
  switch (type) {
    case "fairway":
      return 1.0;
    case "green":
      return 1.0;
    case "rough":
      return 0.7;
    case "bunker":
      return 0.5;
    case "water":
      return 0.0;
    case "tee":
      return 1.0;
  }
}

export const getTerrainMowable = isGrassTerrain;
export const getTerrainWaterable = isGrassTerrain;
export const getTerrainFertilizable = isGrassTerrain;

export function clampToGrid(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max - 1, Math.floor(value)));
}

export function getTerrainDisplayName(type: TerrainType): string {
  switch (type) {
    case "fairway":
      return "Fairway";
    case "rough":
      return "Rough";
    case "green":
      return "Green";
    case "bunker":
      return "Bunker";
    case "water":
      return "Water";
    case "tee":
      return "Tee Box";
  }
}

export function getObstacleDisplayName(type: ObstacleType): string {
  switch (type) {
    case "none":
      return "None";
    case "tree":
      return "Tree";
    case "pine_tree":
      return "Pine Tree";
    case "shrub":
      return "Shrub";
    case "bush":
      return "Bush";
  }
}

export interface TerrainThresholds {
  mownHeight: number;
  growingHeight: number;
}

export function getTerrainThresholds(type: TerrainType): TerrainThresholds {
  switch (type) {
    case "fairway":
      return { mownHeight: 20, growingHeight: 45 };
    case "rough":
      return { mownHeight: 30, growingHeight: 60 };
    case "green":
      return { mownHeight: 10, growingHeight: 22 };
    case "tee":
      return { mownHeight: 12, growingHeight: 25 };
    default:
      return { mownHeight: 30, growingHeight: 60 };
  }
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

export function getTerrainCode(type: TerrainType): number {
  switch (type) {
    case "fairway":
      return TERRAIN_CODES.FAIRWAY;
    case "rough":
      return TERRAIN_CODES.ROUGH;
    case "green":
      return TERRAIN_CODES.GREEN;
    case "bunker":
      return TERRAIN_CODES.BUNKER;
    case "water":
      return TERRAIN_CODES.WATER;
    case "tee":
      return TERRAIN_CODES.TEE;
  }
}

export function getAdjacentPositions(
  x: number,
  y: number,
  includeDiagonals: boolean = false
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [
    { x: x, y: y - 1 },
    { x: x + 1, y: y },
    { x: x, y: y + 1 },
    { x: x - 1, y: y },
  ];

  if (includeDiagonals) {
    positions.push(
      { x: x - 1, y: y - 1 },
      { x: x + 1, y: y - 1 },
      { x: x + 1, y: y + 1 },
      { x: x - 1, y: y + 1 }
    );
  }

  return positions;
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
