import { TerrainType, OverlayMode } from '../core/terrain';
import { EquipmentType, Direction } from '../core/movement';
import { IrrigationSystem, createInitialIrrigationSystem } from '../core/irrigation';

export type { OverlayMode };
export type ObjectiveType = 'mow_percentage' | 'maintain_health' | 'water_coverage' | 'complete_hole';

export interface GrassCellState {
  x: number;
  y: number;
  type: TerrainType;
  height: number;
  moisture: number;
  nutrients: number;
  health: number;
  elevation?: number;
  lastMowed: number;
  lastWatered: number;
  lastFertilized: number;
}

export interface PlayerState {
  x: number;
  y: number;
  stamina: number;
  currentEquipment: EquipmentType;
  isEquipmentActive: boolean;
  direction: Direction;
}

export interface EquipmentState {
  currentType: EquipmentType;
  mowerResource: number;
  sprinklerResource: number;
  spreaderResource: number;
}

export interface TimeState {
  gameTime: number;
  currentDay: number;
  currentHour: number;
  timeScale: number;
  isPaused: boolean;
}

export interface CameraState {
  scrollX: number;
  scrollY: number;
  zoom: number;
}

export interface ObjectiveState {
  type: ObjectiveType;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
}

export interface GameProgressState {
  score: number;
  daysPassed: number;
  consecutiveGoodDays: number;
  currentObjective: ObjectiveState | null;
}

export interface UIState {
  overlayMode: OverlayMode;
  isPaused: boolean;
}

export interface GameState {
  version: string;
  timestamp: number;
  courseId: string;

  grassCells: GrassCellState[][];
  player: PlayerState;
  equipment: EquipmentState;
  time: TimeState;
  camera: CameraState;
  progress: GameProgressState;
  ui: UIState;
  irrigationSystem?: IrrigationSystem;
}

export function createDefaultGameState(): GameState {
  return {
    version: '1.0.0',
    timestamp: Date.now(),
    courseId: 'hole_1',

    grassCells: [],
    player: {
      x: 0,
      y: 0,
      stamina: 100,
      currentEquipment: null,
      isEquipmentActive: false,
      direction: 'down'
    },
    equipment: {
      currentType: null,
      mowerResource: 100,
      sprinklerResource: 100,
      spreaderResource: 100
    },
    time: {
      gameTime: 0,
      currentDay: 1,
      currentHour: 6,
      timeScale: 1,
      isPaused: false
    },
    camera: {
      scrollX: 0,
      scrollY: 0,
      zoom: 1
    },
    progress: {
      score: 0,
      daysPassed: 0,
      consecutiveGoodDays: 0,
      currentObjective: null
    },
    ui: {
      overlayMode: 'normal',
      isPaused: false
    },
    irrigationSystem: createInitialIrrigationSystem()
  };
}
