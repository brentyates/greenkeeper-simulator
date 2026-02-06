import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SaveGameState,
  createSaveState,
  saveGame,
  loadGame,
  deleteSave,
  hasSave,
  getSaveInfo,
  listSaves,
} from './save-game';
import { createInitialEconomyState } from './economy';
import { createInitialRoster, createInitialApplicationState } from './employees';
import { createInitialWorkSystemState } from './employee-work';
import { createInitialPoolState } from './golfers';
import { createInitialResearchState } from './research';
import { createInitialPrestigeState } from './prestige';
import { createInitialTeeTimeState } from './tee-times';
import { createInitialRevenueState } from './tee-revenue';
import { ScenarioProgress } from './scenario';
import { createInitialAutonomousState } from './autonomous-equipment';
import { createInitialWeatherState } from './weather';
import { createInitialIrrigationSystem } from './irrigation';

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    get length() { return Object.keys(store).length; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage });

function createMockScenarioProgress(): ScenarioProgress {
  return {
    daysElapsed: 5,
    currentCash: 10000,
    totalRevenue: 15000,
    totalExpenses: 5000,
    totalGolfers: 100,
    totalRounds: 25,
    currentHealth: 85,
    currentRating: 3.5,
    daysAtTargetRating: 2,
  };
}

function createMockSaveState(scenarioId = 'test_scenario'): SaveGameState {
  return createSaveState(
    scenarioId,
    420,
    5,
    25,
    19,
    1500,
    createInitialEconomyState(10000),
    createInitialRoster(),
    createInitialWorkSystemState(),
    createInitialPoolState(),
    createInitialResearchState(),
    createInitialPrestigeState(),
    createInitialTeeTimeState(),
    createInitialRevenueState(),
    createInitialApplicationState(),
    createMockScenarioProgress(),
    createInitialAutonomousState(),
    createInitialWeatherState(),
    new Map()
  );
}

describe('save-game', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe('createSaveState', () => {
    it('creates save state with all required fields', () => {
      const state = createMockSaveState();

      expect(state.version).toBe(2);
      expect(state.savedAt).toBeGreaterThan(0);
      expect(state.scenarioId).toBe('test_scenario');
      expect(state.gameTime).toBe(420);
      expect(state.gameDay).toBe(5);
      expect(state.playerX).toBe(25);
      expect(state.playerY).toBe(19);
      expect(state.score).toBe(1500);
      expect(state.economyState).toBeDefined();
      expect(state.employeeRoster).toBeDefined();
      expect(state.golferPool).toBeDefined();
      expect(state.researchState).toBeDefined();
      expect(state.prestigeState).toBeDefined();
      expect(state.teeTimeState).toBeDefined();
      expect(state.revenueState).toBeDefined();
      expect(state.scenarioProgress).toBeDefined();
      expect(state.autonomousState).toBeDefined();
      expect(state.weatherState).toBeDefined();
      expect(state.faceStates).toBeDefined();
    });

    it('creates save state with optional irrigationSystem', () => {
      const irrigationSystem = createInitialIrrigationSystem();
      const state = createSaveState(
        'irrigation_test',
        420,
        5,
        25,
        19,
        1500,
        createInitialEconomyState(10000),
        createInitialRoster(),
        createInitialWorkSystemState(),
        createInitialPoolState(),
        createInitialResearchState(),
        createInitialPrestigeState(),
        createInitialTeeTimeState(),
        createInitialRevenueState(),
        createInitialApplicationState(),
        createMockScenarioProgress(),
        createInitialAutonomousState(),
        createInitialWeatherState(),
        new Map(),
        irrigationSystem
      );

      expect(state.irrigationSystem).toBeDefined();
      expect(state.irrigationSystem).toEqual(irrigationSystem);
    });
  });

  describe('saveGame', () => {
    it('saves game to localStorage', () => {
      const state = createMockSaveState();
      const result = saveGame(state);

      expect(result).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'greenkeeper_save_test_scenario',
        expect.any(String)
      );
    });

    it('returns true on successful save', () => {
      const state = createMockSaveState();
      expect(saveGame(state)).toBe(true);
    });

    it('returns false when localStorage throws', () => {
      const state = createMockSaveState('error_scenario');
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('Storage quota exceeded');
      });

      const result = saveGame(state);
      expect(result).toBe(false);
    });
  });

  describe('loadGame', () => {
    it('loads saved game from localStorage', () => {
      const originalState = createMockSaveState();
      saveGame(originalState);

      const loadedState = loadGame('test_scenario');

      expect(loadedState).not.toBeNull();
      expect(loadedState!.scenarioId).toBe('test_scenario');
      expect(loadedState!.gameDay).toBe(5);
      expect(loadedState!.score).toBe(1500);
    });

    it('returns null for non-existent save', () => {
      const result = loadGame('nonexistent');
      expect(result).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      mockLocalStorage.setItem('greenkeeper_save_invalid', 'not json');
      const result = loadGame('invalid');
      expect(result).toBeNull();
    });

    it('returns null for version mismatch', () => {
      const state = createMockSaveState();
      const stateWithOldVersion = { ...state, version: 0 };
      mockLocalStorage.setItem(
        'greenkeeper_save_old_version',
        JSON.stringify(stateWithOldVersion)
      );

      const result = loadGame('old_version');
      expect(result).toBeNull();
    });
  });

  describe('deleteSave', () => {
    it('removes save from localStorage', () => {
      const state = createMockSaveState();
      saveGame(state);

      const result = deleteSave('test_scenario');

      expect(result).toBe(true);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('greenkeeper_save_test_scenario');
    });

    it('returns false when localStorage throws', () => {
      mockLocalStorage.removeItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      const result = deleteSave('error_scenario');
      expect(result).toBe(false);
    });
  });

  describe('hasSave', () => {
    it('returns true when save exists', () => {
      const state = createMockSaveState();
      saveGame(state);

      expect(hasSave('test_scenario')).toBe(true);
    });

    it('returns false when save does not exist', () => {
      expect(hasSave('nonexistent')).toBe(false);
    });
  });

  describe('getSaveInfo', () => {
    it('returns save metadata', () => {
      const state = createMockSaveState();
      saveGame(state);

      const info = getSaveInfo('test_scenario');

      expect(info).not.toBeNull();
      expect(info!.gameDay).toBe(5);
      expect(info!.savedAt).toBeGreaterThan(0);
    });

    it('returns null for non-existent save', () => {
      expect(getSaveInfo('nonexistent')).toBeNull();
    });

    it('returns null for invalid JSON data', () => {
      mockLocalStorage.setItem('greenkeeper_save_corrupt', 'invalid json data');
      const result = getSaveInfo('corrupt');
      expect(result).toBeNull();
    });
  });

  describe('listSaves', () => {
    it('lists all saves sorted by date', () => {
      const state1 = createMockSaveState('scenario_1');
      const state2 = createMockSaveState('scenario_2');
      saveGame(state1);
      saveGame(state2);

      const saves = listSaves();

      expect(saves.length).toBe(2);
      expect(saves[0].savedAt).toBeGreaterThanOrEqual(saves[1].savedAt);
    });

    it('returns empty array when no saves exist', () => {
      const saves = listSaves();
      expect(saves).toEqual([]);
    });

    it('skips saves with corrupt data', () => {
      const validState = createMockSaveState('valid_scenario');
      saveGame(validState);
      mockLocalStorage.setItem('greenkeeper_save_corrupt_scenario', 'not valid json');

      const saves = listSaves();

      expect(saves.length).toBe(1);
      expect(saves[0].scenarioId).toBe('valid_scenario');
    });

    it('skips keys that do not match save prefix', () => {
      const state = createMockSaveState('my_scenario');
      saveGame(state);
      mockLocalStorage.setItem('some_other_key', 'value');

      const saves = listSaves();

      expect(saves.length).toBe(1);
      expect(saves[0].scenarioId).toBe('my_scenario');
    });
  });

  describe('save state preservation', () => {
    it('preserves economy state through save/load cycle', () => {
      const state = createMockSaveState();
      const modifiedState = {
        ...state,
        economyState: { ...state.economyState, cash: 25000 },
      };
      saveGame(modifiedState);

      const loaded = loadGame('test_scenario');
      expect(loaded!.economyState.cash).toBe(25000);
    });

    it('preserves research state through save/load cycle', () => {
      const state = createMockSaveState();
      const modifiedState = {
        ...state,
        researchState: { ...state.researchState, fundingLevel: 'maximum' as const },
      };
      saveGame(modifiedState);

      const loaded = loadGame('test_scenario');
      expect(loaded!.researchState.fundingLevel).toBe('maximum');
    });

    it('preserves prestige state through save/load cycle', () => {
      const state = createMockSaveState();
      const modifiedState = {
        ...state,
        prestigeState: { ...state.prestigeState, starRating: 3.5 },
      };
      saveGame(modifiedState);

      const loaded = loadGame('test_scenario');
      expect(loaded!.prestigeState.starRating).toBe(3.5);
    });

    it('preserves scenario progress through save/load cycle', () => {
      const state = createMockSaveState();
      const modifiedState = {
        ...state,
        scenarioProgress: { ...state.scenarioProgress, totalRounds: 50, totalGolfers: 200 },
      };
      saveGame(modifiedState);

      const loaded = loadGame('test_scenario');
      expect(loaded!.scenarioProgress.totalRounds).toBe(50);
      expect(loaded!.scenarioProgress.totalGolfers).toBe(200);
    });

    it('preserves weather state through save/load cycle', () => {
      const state = createMockSaveState();
      const modifiedState = {
        ...state,
        weatherState: {
          ...state.weatherState,
          current: { type: 'rainy' as const, temperature: 55, windSpeed: 15 },
          lastChangeTime: 300,
        },
      };
      saveGame(modifiedState);

      const loaded = loadGame('test_scenario');
      expect(loaded!.weatherState.current.type).toBe('rainy');
      expect(loaded!.weatherState.current.temperature).toBe(55);
      expect(loaded!.weatherState.lastChangeTime).toBe(300);
    });
  });
});
