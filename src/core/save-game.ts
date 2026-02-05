import { EconomyState } from './economy';
import { EmployeeRoster } from './employees';
import { EmployeeWorkSystemState } from './employee-work';
import { GolferPoolState } from './golfers';
import { ResearchState } from './research';
import { PrestigeState } from './prestige';
import { TeeTimeSystemState } from './tee-times';
import { WalkOnState } from './walk-ons';
import { RevenueState } from './tee-revenue';
import { MarketingState } from './marketing';
import { CellState } from './terrain';
import { FaceState } from './face-state';
import { ApplicationState } from './employees';
import { ScenarioProgress } from './scenario';
import { AutonomousEquipmentState } from './autonomous-equipment';
import { WeatherState } from './weather';
import { IrrigationSystem } from './irrigation';

export interface SaveGameState {
  version: number;
  savedAt: number;
  scenarioId: string;

  gameTime: number;
  gameDay: number;
  playerX: number;
  playerY: number;
  score: number;

  economyState: EconomyState;
  employeeRoster: EmployeeRoster;
  employeeWorkState?: EmployeeWorkSystemState;
  golferPool: GolferPoolState;
  researchState: ResearchState;
  prestigeState: PrestigeState;
  teeTimeState: TeeTimeSystemState;
  walkOnState: WalkOnState;
  revenueState: RevenueState;
  marketingState: MarketingState;
  applicationState: ApplicationState;
  scenarioProgress: ScenarioProgress;
  autonomousState: AutonomousEquipmentState;
  weatherState: WeatherState;
  irrigationSystem?: IrrigationSystem;

  cells: CellState[][];
  faceStates?: FaceState[];
}

const SAVE_VERSION = 1;
const SAVE_KEY_PREFIX = 'greenkeeper_save_';

export function createSaveState(
  scenarioId: string,
  gameTime: number,
  gameDay: number,
  playerX: number,
  playerY: number,
  score: number,
  economyState: EconomyState,
  employeeRoster: EmployeeRoster,
  employeeWorkState: EmployeeWorkSystemState,
  golferPool: GolferPoolState,
  researchState: ResearchState,
  prestigeState: PrestigeState,
  teeTimeState: TeeTimeSystemState,
  walkOnState: WalkOnState,
  revenueState: RevenueState,
  marketingState: MarketingState,
  applicationState: ApplicationState,
  scenarioProgress: ScenarioProgress,
  autonomousState: AutonomousEquipmentState,
  weatherState: WeatherState,
  cells: CellState[][],
  irrigationSystem?: IrrigationSystem,
  faceStates?: Map<number, FaceState>
): SaveGameState {
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    scenarioId,
    gameTime,
    gameDay,
    playerX,
    playerY,
    score,
    economyState,
    employeeRoster,
    employeeWorkState,
    golferPool,
    researchState,
    prestigeState,
    teeTimeState,
    walkOnState,
    revenueState,
    marketingState,
    applicationState,
    scenarioProgress,
    autonomousState,
    weatherState,
    irrigationSystem,
    cells,
    faceStates: faceStates ? Array.from(faceStates.values()) : undefined,
  };
}

export function deserializeFaceStates(saved: FaceState[]): Map<number, FaceState> {
  const map = new Map<number, FaceState>();
  for (const state of saved) {
    map.set(state.faceId, state);
  }
  return map;
}

export function saveGame(state: SaveGameState): boolean {
  try {
    const key = `${SAVE_KEY_PREFIX}${state.scenarioId}`;
    const serialized = JSON.stringify(state);
    localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    console.error('Failed to save game:', error);
    return false;
  }
}

export function loadGame(scenarioId: string): SaveGameState | null {
  try {
    const key = `${SAVE_KEY_PREFIX}${scenarioId}`;
    const serialized = localStorage.getItem(key);
    if (!serialized) {
      return null;
    }

    const state = JSON.parse(serialized) as SaveGameState;

    if (state.version !== SAVE_VERSION) {
      console.warn(`Save version mismatch: ${state.version} vs ${SAVE_VERSION}`);
      return null;
    }

    return state;
  } catch (error) {
    console.error('Failed to load game:', error);
    return null;
  }
}

export function deleteSave(scenarioId: string): boolean {
  try {
    const key = `${SAVE_KEY_PREFIX}${scenarioId}`;
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Failed to delete save:', error);
    return false;
  }
}

export function hasSave(scenarioId: string): boolean {
  const key = `${SAVE_KEY_PREFIX}${scenarioId}`;
  return localStorage.getItem(key) !== null;
}

export function getSaveInfo(scenarioId: string): { savedAt: number; gameDay: number } | null {
  try {
    const key = `${SAVE_KEY_PREFIX}${scenarioId}`;
    const serialized = localStorage.getItem(key);
    if (!serialized) {
      return null;
    }

    const state = JSON.parse(serialized) as SaveGameState;
    return {
      savedAt: state.savedAt,
      gameDay: state.gameDay,
    };
  } catch {
    return null;
  }
}

export function listSaves(): { scenarioId: string; savedAt: number; gameDay: number }[] {
  const saves: { scenarioId: string; savedAt: number; gameDay: number }[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(SAVE_KEY_PREFIX)) {
      const scenarioId = key.substring(SAVE_KEY_PREFIX.length);
      const info = getSaveInfo(scenarioId);
      if (info) {
        saves.push({ scenarioId, ...info });
      }
    }
  }

  return saves.sort((a, b) => b.savedAt - a.savedAt);
}
