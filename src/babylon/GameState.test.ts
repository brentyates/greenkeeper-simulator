import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameState, DailyStats, getRuntimeRefillStationsFromState } from './GameState';
import { GameOptions } from './BabylonMain';
import { COURSE_HOLE_1 } from '../data/courseData';
import { ScenarioDefinition } from '../data/scenarioData';
import { DEFAULT_GREEN_FEES } from '../core/golfers';
import { RESEARCH_ITEMS } from '../core/research';

const mockRefillStations: Array<{ x: number; y: number; name: string }> = [
  { x: 16, y: 100, name: 'Maintenance Shed' },
];

vi.mock('../data/courseData', async () => {
  const actual = await vi.importActual<typeof import('../data/courseData')>('../data/courseData');
  return {
    ...actual,
    getCourseById: vi.fn(),
    get REFILL_STATIONS() {
      return mockRefillStations;
    },
  };
});

import { getCourseById } from '../data/courseData';
const mockedGetCourseById = getCourseById as ReturnType<typeof vi.fn>;

function makeScenario(overrides: Partial<ScenarioDefinition> = {}): ScenarioDefinition {
  return {
    id: 'test_scenario',
    name: 'Test',
    description: 'Test scenario',
    courseId: '3_hole',
    objective: { type: 'economic', targetProfit: 1000 },
    conditions: { startingCash: 5000 },
    difficulty: 'beginner',
    ...overrides,
  };
}

describe('GameState', () => {
  beforeEach(() => {
    mockedGetCourseById.mockReset();
  });

  describe('createGameState without scenario', () => {
    it('uses COURSE_HOLE_1 as default course', () => {
      const state = GameState.createGameState({});
      expect(state.currentCourse).toBe(COURSE_HOLE_1);
    });

    it('sets currentScenario to null', () => {
      const state = GameState.createGameState({});
      expect(state.currentScenario).toBeNull();
    });

    it('sets scenarioManager to null', () => {
      const state = GameState.createGameState({});
      expect(state.scenarioManager).toBeNull();
    });

    it('uses default starting cash of 10000', () => {
      const state = GameState.createGameState({});
      expect(state.economyState.cash).toBe(10000);
    });

    it('stores gameOptions', () => {
      const opts: GameOptions = {};
      const state = GameState.createGameState(opts);
      expect(state.gameOptions).toBe(opts);
    });
  });

  describe('createGameState with scenario', () => {
    it('resolves course from scenario courseId', () => {
      const fakeCourse = { ...COURSE_HOLE_1, name: 'Scenario Course', par: 12 };
      mockedGetCourseById.mockReturnValue(fakeCourse);

      const scenario = makeScenario({ courseId: '3_hole' });
      const state = GameState.createGameState({ scenario });

      expect(mockedGetCourseById).toHaveBeenCalledWith('3_hole');
      expect(state.currentCourse).toBe(fakeCourse);
    });

    it('falls back to COURSE_HOLE_1 when courseId is invalid', () => {
      mockedGetCourseById.mockReturnValue(undefined);

      const scenario = makeScenario({ courseId: 'nonexistent' as any });
      const state = GameState.createGameState({ scenario });

      expect(state.currentCourse).toBe(COURSE_HOLE_1);
    });

    it('sets currentScenario from options', () => {
      mockedGetCourseById.mockReturnValue(COURSE_HOLE_1);
      const scenario = makeScenario();
      const state = GameState.createGameState({ scenario });
      expect(state.currentScenario).toBe(scenario);
    });

    it('creates scenarioManager when scenario provided', () => {
      mockedGetCourseById.mockReturnValue(COURSE_HOLE_1);
      const scenario = makeScenario();
      const state = GameState.createGameState({ scenario });
      expect(state.scenarioManager).not.toBeNull();
    });

    it('uses scenario starting cash', () => {
      mockedGetCourseById.mockReturnValue(COURSE_HOLE_1);
      const scenario = makeScenario({ conditions: { startingCash: 7500 } });
      const state = GameState.createGameState({ scenario });
      expect(state.economyState.cash).toBe(7500);
    });

    it('completes all research when scenario requests full unlocks', () => {
      mockedGetCourseById.mockReturnValue(COURSE_HOLE_1);
      const scenario = makeScenario({ unlockAllResearch: true });
      const state = GameState.createGameState({ scenario });
      const expectedResearch = RESEARCH_ITEMS.map(item => item.id);
      const expectedPoints = RESEARCH_ITEMS.reduce((sum, item) => sum + item.baseCost, 0);

      expect(state.researchState.completedResearch).toEqual(expectedResearch);
      expect(state.researchState.currentResearch).toBeNull();
      expect(state.researchState.researchQueue).toEqual([]);
      expect(state.researchState.totalPointsSpent).toBe(expectedPoints);
    });
  });

  describe('green fee calculation', () => {
    it('sets small-course fees when courseHoles <= 3', () => {
      mockedGetCourseById.mockReturnValue({ ...COURSE_HOLE_1, par: 12 });
      const state = GameState.createGameState({ scenario: makeScenario() });

      expect(state.greenFees).toEqual({
        weekday9Holes: 15,
        weekday18Holes: 25,
        weekend9Holes: 20,
        weekend18Holes: 30,
        twilight9Holes: 10,
        twilight18Holes: 15,
      });
    });

    it('sets mid-course fees when courseHoles <= 9', () => {
      mockedGetCourseById.mockReturnValue({ ...COURSE_HOLE_1, par: 20 });
      const state = GameState.createGameState({ scenario: makeScenario() });

      expect(state.greenFees).toEqual({
        weekday9Holes: 25,
        weekday18Holes: 45,
        weekend9Holes: 35,
        weekend18Holes: 55,
        twilight9Holes: 18,
        twilight18Holes: 30,
      });
    });

    it('keeps DEFAULT_GREEN_FEES when courseHoles > 9', () => {
      mockedGetCourseById.mockReturnValue({ ...COURSE_HOLE_1, par: 72 });
      const state = GameState.createGameState({ scenario: makeScenario() });

      expect(state.greenFees).toEqual({ ...DEFAULT_GREEN_FEES });
    });

    it('uses 9 as courseHoles when par is 0', () => {
      mockedGetCourseById.mockReturnValue({ ...COURSE_HOLE_1, par: 0 });
      const state = GameState.createGameState({ scenario: makeScenario() });

      expect(state.greenFees).toEqual({
        weekday9Holes: 25,
        weekday18Holes: 45,
        weekend9Holes: 35,
        weekend18Holes: 55,
        twilight9Holes: 18,
        twilight18Holes: 30,
      });
    });
  });

  describe('default state field values', () => {
    let state: GameState;

    beforeEach(() => {
      state = GameState.createGameState({});
    });

    it('initializes gameTime to 6:00 AM (360 minutes)', () => {
      expect(state.gameTime).toBe(360);
    });

    it('initializes gameDay to 1', () => {
      expect(state.gameDay).toBe(1);
    });

    it('initializes timeScale to 1', () => {
      expect(state.timeScale).toBe(1);
    });

    it('initializes isPaused to false', () => {
      expect(state.isPaused).toBe(false);
    });

    it('initializes isMuted to false', () => {
      expect(state.isMuted).toBe(false);
    });

    it('initializes overlayAutoSwitched to false', () => {
      expect(state.overlayAutoSwitched).toBe(false);
    });

    it('initializes score to 0', () => {
      expect(state.score).toBe(0);
    });

    it('initializes accumulatedResearchTime to 0', () => {
      expect(state.accumulatedResearchTime).toBe(0);
    });

    it('initializes lastPayrollHour to -1', () => {
      expect(state.lastPayrollHour).toBe(-1);
    });

    it('initializes lastArrivalHour to -1', () => {
      expect(state.lastArrivalHour).toBe(-1);
    });

    it('initializes lastAutoSaveHour to -1', () => {
      expect(state.lastAutoSaveHour).toBe(-1);
    });

    it('initializes lastPrestigeUpdateHour to -1', () => {
      expect(state.lastPrestigeUpdateHour).toBe(-1);
    });

    it('initializes lastTeeTimeUpdateHour to -1', () => {
      expect(state.lastTeeTimeUpdateHour).toBe(-1);
    });

    it('initializes shownTutorialHints as empty set', () => {
      expect(state.shownTutorialHints).toBeInstanceOf(Set);
      expect(state.shownTutorialHints.size).toBe(0);
    });

    it('initializes subsystem states', () => {
      expect(state.employeeRoster).toBeDefined();
      expect(state.employeeWorkState).toBeDefined();
      expect(state.applicationState).toBeDefined();
      expect(state.golferPool).toBeDefined();
      expect(state.researchState).toBeDefined();
      expect(state.prestigeState).toBeDefined();
      expect(state.teeTimeState).toBeDefined();
      expect(state.revenueState).toBeDefined();
      expect(state.autonomousState).toBeDefined();
      expect(state.weatherState).toBeDefined();
      expect(state.irrigationSystem).toBeDefined();
      expect(state.reputationState).toBeDefined();
    });

    it('sets weather from weatherState', () => {
      expect(state.weather).toBeDefined();
    });
  });

  describe('REFILL_STATIONS fallback', () => {
    it('uses course center when REFILL_STATIONS is empty', () => {
      mockRefillStations.length = 0;
      try {
        const state = GameState.createGameState({});
        expect(state.employeeWorkState).toBeDefined();
        expect(state.autonomousState).toBeDefined();
        expect(state.employeeWorkState.maintenanceShedX).toBe(Math.floor(COURSE_HOLE_1.width / 2));
        expect(state.employeeWorkState.maintenanceShedY).toBe(Math.floor(COURSE_HOLE_1.height / 2));
        expect(state.autonomousState.chargingStationX).toBe(Math.floor(COURSE_HOLE_1.width / 2));
        expect(state.autonomousState.chargingStationY).toBe(Math.floor(COURSE_HOLE_1.height / 2));
      } finally {
        mockRefillStations.push({ x: 16, y: 100, name: 'Maintenance Shed' });
      }
    });

    it('uses course center when configured refill station is out of bounds', () => {
      const state = GameState.createGameState({});
      expect(state.employeeWorkState.maintenanceShedX).toBe(Math.floor(COURSE_HOLE_1.width / 2));
      expect(state.employeeWorkState.maintenanceShedY).toBe(Math.floor(COURSE_HOLE_1.height / 2));
      expect(state.autonomousState.chargingStationX).toBe(Math.floor(COURSE_HOLE_1.width / 2));
      expect(state.autonomousState.chargingStationY).toBe(Math.floor(COURSE_HOLE_1.height / 2));
    });

    it('derives runtime refill stations from sanitized game state anchors', () => {
      const state = GameState.createGameState({});
      const stations = getRuntimeRefillStationsFromState(state);
      expect(stations.length).toBeGreaterThan(0);
      for (const station of stations) {
        expect(station.x).toBeGreaterThanOrEqual(0);
        expect(station.x).toBeLessThan(COURSE_HOLE_1.width);
        expect(station.y).toBeGreaterThanOrEqual(0);
        expect(station.y).toBeLessThan(COURSE_HOLE_1.height);
      }
    });
  });

  describe('DailyStats', () => {
    it('initializes with zeroed daily stats', () => {
      const state = GameState.createGameState({});
      const stats: DailyStats = state.dailyStats;

      expect(stats.revenue).toEqual({ greenFees: 0, tips: 0, addOns: 0, other: 0 });
      expect(stats.expenses).toEqual({ wages: 0, supplies: 0, research: 0, utilities: 0, other: 0 });
      expect(stats.golfersServed).toBe(0);
      expect(stats.totalSatisfaction).toBe(0);
      expect(stats.courseHealthStart).toBe(0);
      expect(stats.prestigeStart).toBe(0);
      expect(stats.maintenance).toEqual({
        tasksCompleted: 0,
        tilesMowed: 0,
        tilesWatered: 0,
        tilesFertilized: 0,
      });
    });
  });
});
