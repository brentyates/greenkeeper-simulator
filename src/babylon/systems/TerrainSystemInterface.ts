import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CourseData } from "../../data/courseData";
import { CellState, TerrainType, OverlayMode } from "../../core/terrain";
import { FaceState } from "../../core/face-state";
import { WeatherEffect } from "../../core/grass-simulation";

export interface TerrainSystem {
  build(courseData: CourseData): void;
  dispose(): void;

  update(deltaMs: number, gameTimeMinutes: number, weather?: WeatherEffect): void;

  // Grid-coordinate cell access (compatibility shims backed by face state)
  getCell(x: number, y: number): CellState | null;
  getAllCells(): CellState[][];
  restoreCells(savedCells: CellState[][]): void;

  // Face state access
  getFaceState(faceId: number): FaceState | undefined;
  getAllFaceStates(): Map<number, FaceState>;
  restoreFaceStates(saved: Map<number, FaceState>): void;
  setFaceState(faceId: number, state: Partial<FaceState>): void;
  setAllFaceStates(state: Partial<Pick<FaceState, 'moisture' | 'nutrients' | 'grassHeight' | 'health'>>): void;

  // Grid dimensions
  getGridDimensions(): { width: number; height: number };

  // Elevation
  getElevationAt(x: number, y: number, defaultForOutOfBounds?: number): number;
  getMeshElevationAt(meshX: number, meshY: number, defaultForOutOfBounds?: number): number;
  setElevationAt(x: number, y: number, elev: number): void;

  // Terrain type
  getTerrainTypeAt(x: number, y: number): string | undefined;
  setTerrainTypeAt(x: number, y: number, type: TerrainType): void;

  // Grid data
  getLayoutGrid(): number[][];
  getElevationGrid(): number[][];
  rebuildTileAndNeighbors(x: number, y: number): void;

  // Coordinate conversion
  gridToWorld(gridX: number, gridY: number): Vector3;

  // Maintenance actions
  mowAt(gridX: number, gridY: number): boolean;
  rakeAt(gridX: number, gridY: number): boolean;
  waterArea(centerX: number, centerY: number, radius: number, amount: number): number;
  fertilizeArea(centerX: number, centerY: number, radius: number, amount: number, effectiveness?: number): number;

  // Overlay modes
  cycleOverlayMode(): OverlayMode;
  getOverlayMode(): OverlayMode;
  setOverlayMode(mode: OverlayMode): void;

  // Stats
  getCourseStats(): { health: number; moisture: number; nutrients: number; height: number };

  // Cell state manipulation (grid-coordinate convenience, backed by face state)
  setCellState(x: number, y: number, state: Partial<Pick<CellState, 'height' | 'moisture' | 'nutrients' | 'health'>>): void;
  setAllCellsState(state: Partial<Pick<CellState, 'height' | 'moisture' | 'nutrients' | 'health'>>): void;

  // Position queries
  findFaceAtPosition(worldX: number, worldZ: number): number | null;
  isPositionWalkable(worldX: number, worldZ: number): boolean;
  getTerrainSpeedAt(worldX: number, worldZ: number): number;

  // Testing/debugging
  getUpdateCount(): number;
  getResolution?(): number;
}
