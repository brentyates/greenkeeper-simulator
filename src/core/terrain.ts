export type TerrainType = "fairway" | "rough" | "green" | "bunker" | "water" | "tee";
export type ObstacleType = "none" | "tree" | "pine_tree" | "shrub" | "bush";
export type OverlayMode = "normal" | "moisture" | "nutrients" | "height" | "irrigation";

export const TERRAIN_CODES = {
  FAIRWAY: 0,
  ROUGH: 1,
  GREEN: 2,
  BUNKER: 3,
  WATER: 4,
  TEE: 5,
} as const;

const TERRAIN_TYPES: TerrainType[] = ["fairway", "rough", "green", "bunker", "water", "tee"];

export function getTerrainType(code: number): TerrainType {
  return TERRAIN_TYPES[code] || "rough";
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

export function getTerrainSpeedModifier(type: TerrainType): number {
  return { fairway: 1.0, green: 1.0, rough: 0.7, bunker: 0.5, water: 0.0, tee: 1.0 }[type] ?? 0.7;
}

const TERRAIN_NAMES: Record<TerrainType, string> = { fairway: "Fairway", rough: "Rough", green: "Green", bunker: "Bunker", water: "Water", tee: "Tee Box" };

export function getTerrainDisplayName(type: TerrainType): string { return TERRAIN_NAMES[type]; }

const TERRAIN_CODE_MAP: Record<TerrainType, number> = { fairway: 0, rough: 1, green: 2, bunker: 3, water: 4, tee: 5 };

export function getTerrainCode(type: TerrainType): number { return TERRAIN_CODE_MAP[type]; }

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
