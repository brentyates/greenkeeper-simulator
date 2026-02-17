import { GameOptions } from "./BabylonMain";

import {
  COURSE_HOLE_1,
  REFILL_STATIONS,
  CourseData,
  getCourseById,
} from "../data/courseData";
import type { PlacedAsset } from "../data/customCourseData";
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
  RESEARCH_ITEMS,
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
  RevenueState,
  createInitialRevenueState,
} from "../core/tee-revenue";
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

function isInBounds(
  course: Pick<CourseData, "width" | "height">,
  x: number,
  y: number
): boolean {
  return x >= 0 && x < course.width && y >= 0 && y < course.height;
}

export function resolveRefillAnchor(
  course: Pick<CourseData, "width" | "height">,
  preferredX?: number,
  preferredY?: number
): { x: number; y: number } {
  if (
    typeof preferredX === "number" &&
    Number.isFinite(preferredX) &&
    typeof preferredY === "number" &&
    Number.isFinite(preferredY) &&
    isInBounds(course, preferredX, preferredY)
  ) {
    return { x: preferredX, y: preferredY };
  }

  const configured = REFILL_STATIONS[0];
  if (configured && isInBounds(course, configured.x, configured.y)) {
    return { x: configured.x, y: configured.y };
  }

  return {
    x: Math.floor(course.width / 2),
    y: Math.floor(course.height / 2),
  };
}

export interface RuntimeRefillStation {
  x: number;
  y: number;
  name: string;
}

interface RefillStateSnapshot {
  currentCourse: Pick<CourseData, "width" | "height">;
  autonomousState: { chargingStationX: number; chargingStationY: number };
  employeeWorkState: { maintenanceShedX: number; maintenanceShedY: number };
}

export function resolveServiceHubAnchorFromState(
  state: RefillStateSnapshot
): { x: number; y: number } {
  if (
    isInBounds(
      state.currentCourse,
      state.autonomousState.chargingStationX,
      state.autonomousState.chargingStationY
    )
  ) {
    return {
      x: state.autonomousState.chargingStationX,
      y: state.autonomousState.chargingStationY,
    };
  }

  return resolveRefillAnchor(state.currentCourse);
}

export function getRuntimeRefillStationsFromState(
  state: RefillStateSnapshot
): RuntimeRefillStation[] {
  const anchor = resolveServiceHubAnchorFromState(state);
  return [{ x: anchor.x, y: anchor.y, name: "Maintenance Shed" }];
}

function createFullyUnlockedResearchState(baseState: ResearchState): ResearchState {
  const completedResearch = RESEARCH_ITEMS.map(item => item.id);
  const totalPointsSpent = RESEARCH_ITEMS.reduce(
    (total, item) => total + item.baseCost,
    0
  );

  return {
    ...baseState,
    completedResearch,
    currentResearch: null,
    researchQueue: [],
    totalPointsSpent,
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

  revenueState!: RevenueState;

  autonomousState!: AutonomousEquipmentState;

  weatherState: WeatherState = createInitialWeatherState();
  weather: WeatherCondition = this.weatherState.current;

  irrigationSystem: IrrigationSystem = createInitialIrrigationSystem();

  reputationState: ReputationState = createInitialReputationState();

  scenarioManager: ScenarioManager | null = null;
  currentScenario: ScenarioDefinition | null = null;

  currentCourse!: CourseData;
  holeBuilderAssets: PlacedAsset[] = [];
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

    const refillAnchor = resolveRefillAnchor(course);
    const maintenanceShedX = refillAnchor.x;
    const maintenanceShedY = refillAnchor.y;
    state.employeeWorkState = createInitialWorkSystemState(
      maintenanceShedX,
      maintenanceShedY
    );

    state.golferPool = createInitialPoolState();
    state.researchState = createInitialResearchState();
    if (options.scenario?.unlockAllResearch) {
      state.researchState = createFullyUnlockedResearchState(state.researchState);
    }
    state.prestigeState = createInitialPrestigeState(100);
    state.teeTimeState = createInitialTeeTimeState();
    state.revenueState = createInitialRevenueState();
    state.autonomousState = createInitialAutonomousState(refillAnchor.x, refillAnchor.y);

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
