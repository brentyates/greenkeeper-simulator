import { GameOptions } from "./BabylonMain";

import {
  COURSE_HOLE_1,
  REFILL_STATIONS,
  CourseData,
  getCourseById,
} from "../data/courseData";
import { ScenarioDefinition } from "../data/scenarioData";

import {
  EconomyState,
  createInitialEconomyState,
} from "../core/economy";
import {
  IrrigationSystem,
  createInitialIrrigationSystem,
} from "../core/irrigation";
import {
  EmployeeRoster,
  createInitialRoster,
  ApplicationState,
  createInitialApplicationState,
} from "../core/employees";
import {
  EmployeeWorkSystemState,
  createInitialWorkSystemState,
} from "../core/employee-work";
import {
  GolferPoolState,
  GreenFeeStructure,
  createInitialPoolState,
  WeatherCondition,
  DEFAULT_GREEN_FEES,
} from "../core/golfers";
import {
  ResearchState,
  createInitialResearchState,
} from "../core/research";
import { ScenarioManager } from "../core/scenario";
import {
  PrestigeState,
  createInitialPrestigeState,
} from "../core/prestige";
import {
  TeeTimeSystemState,
  createInitialTeeTimeState,
} from "../core/tee-times";
import {
  WalkOnState,
  createInitialWalkOnState,
} from "../core/walk-ons";
import {
  RevenueState,
  createInitialRevenueState,
} from "../core/tee-revenue";
import {
  MarketingState,
  createInitialMarketingState,
} from "../core/marketing";
import {
  AutonomousEquipmentState,
  createInitialAutonomousState,
} from "../core/autonomous-equipment";
import {
  WeatherState,
  createInitialWeatherState,
} from "../core/weather";
import {
  ReputationState,
  createInitialReputationState,
} from "../core/reputation";

export interface DailyStats {
  revenue: { greenFees: number; tips: number; addOns: number; other: number };
  expenses: { wages: number; supplies: number; research: number; utilities: number; other: number };
  golfersServed: number;
  totalSatisfaction: number;
  courseHealthStart: number;
  prestigeStart: number;
  maintenance: {
    tasksCompleted: number;
    tilesMowed: number;
    tilesWatered: number;
    tilesFertilized: number;
  };
}

function createEmptyDailyStats(): DailyStats {
  return {
    revenue: { greenFees: 0, tips: 0, addOns: 0, other: 0 },
    expenses: { wages: 0, supplies: 0, research: 0, utilities: 0, other: 0 },
    golfersServed: 0,
    totalSatisfaction: 0,
    courseHealthStart: 0,
    prestigeStart: 0,
    maintenance: {
      tasksCompleted: 0,
      tilesMowed: 0,
      tilesWatered: 0,
      tilesFertilized: 0,
    },
  };
}

export class GameState {
  gameTime: number = 6 * 60;
  gameDay: number = 1;
  timeScale: number = 1;
  isPaused: boolean = false;
  isMuted: boolean = false;
  overlayAutoSwitched: boolean = false;
  score: number = 0;

  economyState!: EconomyState;
  dailyStats: DailyStats = createEmptyDailyStats();

  employeeRoster!: EmployeeRoster;
  employeeWorkState!: EmployeeWorkSystemState;
  applicationState: ApplicationState = createInitialApplicationState();

  golferPool!: GolferPoolState;
  greenFees: GreenFeeStructure = { ...DEFAULT_GREEN_FEES };

  researchState!: ResearchState;
  accumulatedResearchTime: number = 0;

  prestigeState!: PrestigeState;

  teeTimeState!: TeeTimeSystemState;

  walkOnState!: WalkOnState;

  revenueState!: RevenueState;

  marketingState!: MarketingState;

  autonomousState!: AutonomousEquipmentState;

  weatherState: WeatherState = createInitialWeatherState();
  weather: WeatherCondition = this.weatherState.current;

  irrigationSystem: IrrigationSystem = createInitialIrrigationSystem();

  reputationState: ReputationState = createInitialReputationState();

  scenarioManager: ScenarioManager | null = null;
  currentScenario: ScenarioDefinition | null = null;

  currentCourse!: CourseData;
  gameOptions!: GameOptions;

  lastPayrollHour: number = -1;
  lastArrivalHour: number = -1;
  lastAutoSaveHour: number = -1;
  lastPrestigeUpdateHour: number = -1;
  lastTeeTimeUpdateHour: number = -1;

  shownTutorialHints: Set<string> = new Set();

  private constructor() {}

  static createGameState(options: GameOptions): GameState {
    const state = new GameState();
    state.gameOptions = options;
    state.currentScenario = options.scenario || null;

    if (options.scenario) {
      const scenarioCourse = getCourseById(options.scenario.courseId);
      state.currentCourse = scenarioCourse || COURSE_HOLE_1;
    } else {
      state.currentCourse = COURSE_HOLE_1;
    }

    const course = state.currentCourse;

    const startingCash = options.scenario?.conditions.startingCash ?? 10000;
    state.economyState = createInitialEconomyState(startingCash);
    state.employeeRoster = createInitialRoster();

    const maintenanceShedX =
      REFILL_STATIONS[0]?.x ?? Math.floor(course.width / 2);
    const maintenanceShedY =
      REFILL_STATIONS[0]?.y ?? Math.floor(course.height / 2);
    state.employeeWorkState = createInitialWorkSystemState(
      maintenanceShedX,
      maintenanceShedY
    );

    state.golferPool = createInitialPoolState();
    state.researchState = createInitialResearchState();
    state.prestigeState = createInitialPrestigeState(100);
    state.teeTimeState = createInitialTeeTimeState();
    state.walkOnState = createInitialWalkOnState();
    state.revenueState = createInitialRevenueState();
    state.marketingState = createInitialMarketingState();
    state.autonomousState = createInitialAutonomousState(
      REFILL_STATIONS[0]?.x ?? 25,
      REFILL_STATIONS[0]?.y ?? 19
    );

    const courseHoles = course.par ? Math.round(course.par / 4) : 9;
    if (courseHoles <= 3) {
      state.greenFees = {
        weekday9Holes: 15,
        weekday18Holes: 25,
        weekend9Holes: 20,
        weekend18Holes: 30,
        twilight9Holes: 10,
        twilight18Holes: 15,
      };
    } else if (courseHoles <= 9) {
      state.greenFees = {
        weekday9Holes: 25,
        weekday18Holes: 45,
        weekend9Holes: 35,
        weekend18Holes: 55,
        twilight9Holes: 18,
        twilight18Holes: 30,
      };
    }

    if (options.scenario) {
      state.scenarioManager = new ScenarioManager(
        options.scenario.objective,
        options.scenario.conditions
      );
    }

    return state;
  }
}
