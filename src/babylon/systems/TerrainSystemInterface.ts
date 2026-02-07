import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CourseData } from "../../data/courseData";
import { TerrainType, OverlayMode, MovableCell } from "../../core/terrain";
import { FaceState } from "../../core/face-state";
import { GrassCell, WeatherEffect } from "../../core/grass-simulation";

export interface FaceStateSample {
  avgMoisture: number;
  avgNutrients: number;
  avgGrassHeight: number;
  avgHealth: number;
  dominantTerrainCode: number;
  faceCount: number;
}

export interface WorkCandidate extends FaceStateSample {
  worldX: number;
  worldZ: number;
}

export interface TerrainSystem {
  build(courseData: CourseData): void;
  dispose(): void;

  update(deltaMs: number, gameTimeMinutes: number, weather?: WeatherEffect): void;

  // Face state access
  getFaceState(faceId: number): FaceState | undefined;
  getAllFaceStates(): Map<number, FaceState>;
  restoreFaceStates(saved: Map<number, FaceState>): void;
  setFaceState(faceId: number, state: Partial<FaceState>): void;
  setAllFaceStates(state: Partial<Pick<FaceState, 'moisture' | 'nutrients' | 'grassHeight' | 'health'>>): void;

  getGridDimensions(): { width: number; height: number };

  // Elevation
  getElevationAt(x: number, y: number, defaultForOutOfBounds?: number): number;
  getMeshElevationAt(meshX: number, meshY: number, defaultForOutOfBounds?: number): number;
  setElevationAt(x: number, y: number, elev: number): void;

  // Terrain type
  getTerrainTypeAt(x: number, y: number): string | undefined;
  setTerrainTypeAt(x: number, y: number, type: TerrainType): void;

  // Coordinate conversion
  gridToWorld(gridX: number, gridY: number): Vector3;

  rebuildTileAndNeighbors(x: number, y: number): void;

  getAllCells(): GrassCell[][];

  // Maintenance actions
  mowAt(worldX: number, worldZ: number): boolean;
  rakeAt(worldX: number, worldZ: number): boolean;
  waterArea(centerX: number, centerZ: number, radius: number, amount: number): number;
  fertilizeArea(centerX: number, centerZ: number, radius: number, amount: number, effectiveness?: number): number;

  // Overlay modes
  cycleOverlayMode(): OverlayMode;
  getOverlayMode(): OverlayMode;
  setOverlayMode(mode: OverlayMode): void;

  // Stats
  getCourseStats(): { health: number; moisture: number; nutrients: number; height: number };

  // Pathfinding cell access
  getCell(x: number, y: number): MovableCell | null;

  // Position queries
  findFaceAtPosition(worldX: number, worldZ: number): number | null;
  isPositionWalkable(worldX: number, worldZ: number): boolean;
  getTerrainSpeedAt(worldX: number, worldZ: number): number;

  // Topology-based radius queries
  getFacesInBrush(worldX: number, worldZ: number, radius: number): number[];
  sampleFaceStatesInRadius(worldX: number, worldZ: number, sampleRadius: number): FaceStateSample;
  findWorkCandidates(centerX: number, centerZ: number, maxRadius: number, cellSize?: number): WorkCandidate[];
  applyWorkEffect(
    worldX: number,
    worldZ: number,
    equipmentRadius: number,
    jobType: 'mow' | 'water' | 'fertilize' | 'rake',
    efficiency: number,
    gameTime: number
  ): number[];

  getUpdateCount(): number;
  getResolution?(): number;
}
