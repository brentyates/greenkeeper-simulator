import { CourseData } from "../../data/courseData";
import { TerrainType, OverlayMode } from "../../core/terrain";
import { FaceState } from "../../core/face-state";
import { WeatherEffect } from "../../core/grass-simulation";

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
  maxGrassHeight?: number;
  terrainCodesPresent?: readonly number[];
  terrainStatsByCode?: Readonly<Partial<Record<number, WorkCandidateTerrainStats>>>;
  minMoisture?: number;
  minNutrients?: number;
}

export interface WorkCandidateTerrainStats {
  worldX: number;
  worldZ: number;
  avgMoisture: number;
  avgNutrients: number;
  avgGrassHeight: number;
  maxGrassHeight: number;
  avgHealth: number;
  faceCount: number;
  minMoisture: number;
  minNutrients: number;
}

export interface TerrainSystem {
  build(courseData: CourseData): void;
  dispose(): void;

  update(deltaMs: number, gameTimeMinutes: number, weather?: WeatherEffect): void;

  getFaceState(faceId: number): FaceState | undefined;
  getAllFaceStates(): Map<number, FaceState>;
  restoreFaceStates(saved: Map<number, FaceState>): void;
  setAllFaceStates(state: Partial<Pick<FaceState, 'moisture' | 'nutrients' | 'grassHeight' | 'health'>>): void;

  getWorldDimensions(): { width: number; height: number };

  getElevationAt(x: number, y: number, defaultForOutOfBounds?: number): number;
  setElevationAt(x: number, y: number, elev: number): void;

  getTerrainTypeAt(worldX: number, worldZ: number): string | undefined;
  setTerrainTypeAt(worldX: number, worldZ: number, type: TerrainType): void;

  mowAt(worldX: number, worldZ: number): boolean;
  rakeAt(worldX: number, worldZ: number): boolean;
  waterArea(centerX: number, centerZ: number, radius: number, amount: number): number;
  fertilizeArea(centerX: number, centerZ: number, radius: number, amount: number, effectiveness?: number): number;

  cycleOverlayMode(): OverlayMode;
  getOverlayMode(): OverlayMode;
  setOverlayMode(mode: OverlayMode): void;

  getCourseStats(): { health: number; moisture: number; nutrients: number; height: number };

  findFaceAtPosition(worldX: number, worldZ: number): number | null;
  isPositionWalkable(worldX: number, worldZ: number): boolean;
  getTerrainSpeedAt(worldX: number, worldZ: number): number;

  getFacesInBrush(worldX: number, worldZ: number, radius: number): number[];
  sampleFaceStatesInRadius(worldX: number, worldZ: number, sampleRadius: number): FaceStateSample;
  findWorkCandidates(centerX: number, centerZ: number, maxRadius: number, cellSize?: number): WorkCandidate[];
  applyWorkEffect(
    worldX: number,
    worldZ: number,
    equipmentRadius: number,
    jobType: 'mow' | 'water' | 'fertilize' | 'rake',
    efficiency: number,
    gameTime: number,
    allowedTerrainCodes?: readonly number[]
  ): number[];

  getResolution?(): number;
}
