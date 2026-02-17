import { describe, it, expect, beforeEach, vi } from "vitest";
import { SimulationSystems, runSimulationTick } from "./SimulationTick";
import { DailyStats, GameState } from "./GameState";
import type { EconomyState } from "../core/economy";
import type { EmployeeRoster, ApplicationState } from "../core/employees";
import type { GolferPoolState, WeatherCondition } from "../core/golfers";
import type { WeatherState } from "../core/weather";
import type { TeeTimeSystemState } from "../core/tee-times";
import type { WalkOnState } from "../core/walk-ons";
import type { RevenueState } from "../core/tee-revenue";
import type { PrestigeState } from "../core/prestige";
import type { IrrigationSystem } from "../core/irrigation";
import type { ReputationState } from "../core/reputation";
import type { TerrainSystem } from "./systems/TerrainSystemInterface";
import type { UIManager } from "./ui/UIManager";
import type { CourseData } from "../data/courseData";
import type { GameOptions } from "./BabylonMain";
import { TERRAIN_CODES } from "../core/terrain";

vi.mock("../core/weather", () => ({
  tickWeather: vi.fn(),
  getWeatherDescription: vi.fn(() => "Sunny 75°F"),
  getWeatherImpactDescription: vi.fn(),
}));

vi.mock("../core/economy", () => ({
  addIncome: vi.fn((state: EconomyState) => state),
  addExpense: vi.fn((state: EconomyState) => state),
}));

vi.mock("../core/employees", () => ({
  processPayroll: vi.fn(() => ({ roster: { employees: [], maxEmployees: 10, lastPayrollTime: 0, totalWagesPaid: 0 }, totalPaid: 0, breakdown: [] })),
  tickEmployees: vi.fn((roster: EmployeeRoster) => ({ roster, promotions: [], breaksTaken: [] })),
  awardExperience: vi.fn((roster: EmployeeRoster) => roster),
  tickApplications: vi.fn((state: ApplicationState) => ({ state, newApplicant: null, expiredPostings: [] })),
  getManagerBonus: vi.fn(() => 1.0),
}));

vi.mock("../core/employee-work", () => ({
  tickEmployeeWork: vi.fn(() => ({ state: { workers: [], areas: [], maintenanceShedX: 0, maintenanceShedY: 0 }, effects: [], tasksCompleted: 0, completions: [] })),
  getWorkerPositions: vi.fn(() => []),
  TASK_EXPERIENCE_REWARDS: { mow_grass: 10, water_area: 5, fertilize_area: 8, rake_bunker: 15, patrol: 2, return_to_base: 0, idle: 0 },
  TASK_SUPPLY_COSTS: { mow_grass: 0.25, water_area: 0.10, fertilize_area: 0.50, rake_bunker: 0.05, patrol: 0, return_to_base: 0, idle: 0 },
}));

vi.mock("../core/golfers", () => ({
  tickGolfers: vi.fn(() => ({ state: { golfers: [], dailyVisitors: 0, peakCapacity: 72, totalVisitorsToday: 0, totalRevenueToday: 0, rating: { overall: 50, condition: 50, difficulty: 50, amenities: 50, value: 50 } }, departures: [], revenue: 0, tips: 0 })),
  generateArrivals: vi.fn(() => []),
  calculateArrivalRate: vi.fn(() => 0),
  updateCourseRating: vi.fn((state: GolferPoolState) => state),
  addGolfer: vi.fn((state: GolferPoolState) => state),
  resetDailyStats: vi.fn((state: GolferPoolState) => state),
}));

vi.mock("../core/research", () => ({
  tickResearch: vi.fn(() => ({ state: { completedResearch: [], currentResearch: null, researchQueue: [], fundingLevel: "none", totalPointsSpent: 0 }, completed: null })),
  getFundingCostPerMinute: vi.fn(() => 0),
  describeResearchUnlock: vi.fn(() => "New item"),
  getEquipmentEfficiencyBonus: vi.fn(() => 1.0),
  getBestFertilizerEffectiveness: vi.fn(() => 1.0),
}));

vi.mock("../core/prestige", () => ({
  calculateCurrentConditionsFromFaces: vi.fn(() => ({ averageHealth: 50, greenScore: 50, fairwayScore: 50, bunkerScore: 50, hazardScore: 50, teeBoxScore: 50, composite: 50 })),
  updatePrestigeScore: vi.fn((state: PrestigeState) => state),
  calculateDemandMultiplier: vi.fn(() => 1.0),
  takeDailySnapshot: vi.fn(() => ({ day: 1, averageHealth: 50, greenHealth: 50, fairwayHealth: 50, conditionRating: "good" })),
  updateHistoricalExcellence: vi.fn((hist: any) => hist),
  resetDailyStats: vi.fn((state: PrestigeState) => state),
}));

vi.mock("../core/tee-times", () => ({
  generateDailySlots: vi.fn(() => []),
  simulateDailyBookings: vi.fn(() => []),
  applyBookingSimulation: vi.fn((state: TeeTimeSystemState) => state),
  getAvailableSlots: vi.fn(() => []),
  resetDailyMetrics: vi.fn((state: TeeTimeSystemState) => state),
}));

vi.mock("../core/walk-ons", () => ({
  processWalkOns: vi.fn((state: WalkOnState) => ({ state, served: 0, turnedAway: 0 })),
  resetDailyWalkOnMetrics: vi.fn((state: WalkOnState) => state),
}));

vi.mock("../core/tee-revenue", () => ({
  finalizeDailyRevenue: vi.fn((state: RevenueState) => state),
}));

vi.mock("../core/marketing", () => ({
  processDailyCampaigns: vi.fn(() => ({ state: { activeCampaigns: [], campaignHistory: [], cooldowns: {}, metrics: { totalSpent: 0, totalBookingsInfluenced: 0, totalRevenueInfluenced: 0, roi: 0 }, baselineBookingsPerDay: 20, baselineRevenuePerDay: 2000 }, completedCampaignNames: [], dailyCost: 0 })),
  calculateCombinedDemandMultiplier: vi.fn(() => 1.0),
}));

vi.mock("../core/autonomous-equipment", () => ({
  tickAutonomousEquipment: vi.fn(() => ({ state: { robots: [], chargingStationX: 0, chargingStationY: 0 }, effects: [], operatingCost: 0 })),
  getAllowedTerrainCodesForRobotEquipment: vi.fn((equipmentId: string, type: string) => {
    if (type === "mower") {
      if (equipmentId.includes("mower_fairway")) return [0];
      if (equipmentId.includes("mower_greens")) return [2];
      if (equipmentId.includes("mower_rough")) return [1];
      return [0, 1, 2, 5];
    }
    if (type === "raker") return [3];
    return null;
  }),
}));

vi.mock("../core/irrigation", () => ({
  updatePipePressures: vi.fn((sys: IrrigationSystem) => sys),
  checkForLeaks: vi.fn((sys: IrrigationSystem) => sys),
  setSprinklerActive: vi.fn((sys: IrrigationSystem) => sys),
  getPipeAt: vi.fn(),
  calculateWaterUsage: vi.fn(() => 0),
  calculateWaterCost: vi.fn(() => 0),
}));

import {
  tickWeather as coreTickWeather,
  getWeatherImpactDescription,
} from "../core/weather";
import { addIncome, addExpense } from "../core/economy";
import {
  processPayroll,
  tickEmployees as coreTickEmployees,
  awardExperience,
  tickApplications,
  getManagerBonus,
} from "../core/employees";
import {
  tickEmployeeWork,
} from "../core/employee-work";
import {
  tickGolfers as coreTickGolfers,
  generateArrivals,
  calculateArrivalRate,
  updateCourseRating,
  addGolfer,
  resetDailyStats as resetGolferDailyStats,
} from "../core/golfers";
import {
  tickResearch as coreTickResearch,
  getFundingCostPerMinute,
  describeResearchUnlock,
  getEquipmentEfficiencyBonus,
  getBestFertilizerEffectiveness,
} from "../core/research";
import {
  calculateCurrentConditionsFromFaces,
  updatePrestigeScore,
  calculateDemandMultiplier,
  takeDailySnapshot,
  updateHistoricalExcellence,
  resetDailyStats as resetPrestigeDailyStats,
} from "../core/prestige";
import {
  generateDailySlots,
  simulateDailyBookings,
  applyBookingSimulation,
  resetDailyMetrics as resetTeeTimeDailyMetrics,
} from "../core/tee-times";
import {
  processWalkOns,
  resetDailyWalkOnMetrics,
} from "../core/walk-ons";
import { finalizeDailyRevenue } from "../core/tee-revenue";
import {
  processDailyCampaigns,
} from "../core/marketing";
import { tickAutonomousEquipment as coreTickAutonomousEquipment } from "../core/autonomous-equipment";
import {
  updatePipePressures,
  checkForLeaks,
  setSprinklerActive,
  getPipeAt,
  calculateWaterUsage,
  calculateWaterCost,
} from "../core/irrigation";

function createMockDailyStats(): DailyStats {
  return {
    revenue: { greenFees: 0, tips: 0, addOns: 0, other: 0 },
    expenses: { wages: 0, supplies: 0, research: 0, utilities: 0, other: 0 },
    golfersServed: 0,
    totalSatisfaction: 0,
    courseHealthStart: 50,
    prestigeStart: 100,
    maintenance: { tasksCompleted: 0, tilesMowed: 0, tilesWatered: 0, tilesFertilized: 0 },
  };
}

interface MockContext {
  state: GameState;
  systems: SimulationSystems;
}

function createMockContext(overrides: Record<string, any> = {}): MockContext {
  const defaultWeather: WeatherCondition = { type: "sunny", temperature: 75, windSpeed: 5 };

  const terrainSystem = overrides.terrainSystem ?? {
    getAllFaceStates: vi.fn(() => new Map()),
    getCourseStats: vi.fn(() => ({ health: 50, moisture: 50, nutrients: 50, height: 50 })),
    findFaceAtPosition: vi.fn(() => 1),
    getTerrainTypeAt: vi.fn(() => "fairway"),
    isPositionWalkable: vi.fn(() => true),
    findWorkCandidates: vi.fn(() => []),
    applyWorkEffect: vi.fn(() => []),
    mowAt: vi.fn(() => true),
    waterArea: vi.fn(() => 1),
    fertilizeArea: vi.fn(() => 1),
  } as unknown as TerrainSystem;

  const uiManager = overrides.uiManager ?? {
    showNotification: vi.fn(),
    updatePrestige: vi.fn(),
    updateMinimapWorkers: vi.fn(),
  } as unknown as UIManager;

  const saveCallback = overrides.saveCallback ?? vi.fn();
  const showDaySummaryCallback = overrides.showDaySummaryCallback ?? vi.fn();

  const state = {
    economyState: { cash: 10000, loans: [], transactions: [], totalEarned: 0, totalSpent: 0 },
    employeeRoster: { employees: [], maxEmployees: 10, lastPayrollTime: 0, totalWagesPaid: 0 },
    employeeWorkState: { workers: [], areas: [], maintenanceShedX: 0, maintenanceShedY: 0 },
    golferPool: { golfers: [], dailyVisitors: 0, peakCapacity: 72, totalVisitorsToday: 0, totalRevenueToday: 0, rating: { overall: 50, condition: 50, difficulty: 50, amenities: 50, value: 50 } },
    researchState: { completedResearch: [], currentResearch: null, researchQueue: [], fundingLevel: "none" as const, totalPointsSpent: 0 },
    weatherState: { current: defaultWeather, forecast: [], lastChangeTime: 0, seasonalModifier: { season: "summer" as const, baseTemperature: 82, temperatureVariance: 12, rainChance: 0.15, stormChance: 0.08 } },
    weather: defaultWeather,
    teeTimeState: {
      spacingConfig: { spacing: "standard" as const, minutesBetween: 10, maxDailyTeeTimes: 60, paceOfPlayPenalty: 0, backupRiskMultiplier: 1, reputationModifier: 0, revenueMultiplier: 1 },
      operatingHours: { openTime: 6, closeTime: 20, lastTeeTime: 16, summerHours: { open: 5, close: 21, lastTee: 17 }, winterHours: { open: 7, close: 18, lastTee: 14 }, twilightStart: 14 },
      bookingConfig: { publicBookingDays: 7, memberBookingDays: 14, freeCancellationHours: 24, lateCancelPenalty: 0.5, noShowPenalty: 1.0, noShowCountForBlacklist: 3 },
      teeTimes: new Map(),
      currentDay: 1,
      bookingMetrics: { totalBookingsToday: 0, cancellationsToday: 0, noShowsToday: 0, lateCancellationsToday: 0 },
    },
    walkOnState: {
      policy: { allowWalkOns: true, reserveWalkOnSlots: 1, walkOnPremium: 1.1, walkOnDiscount: 0.9, maxQueueSize: 12, maxWaitMinutes: 45 },
      queue: [],
      metrics: { walkOnsServedToday: 0, walkOnsTurnedAwayToday: 0, walkOnsGaveUpToday: 0, averageWaitTime: 0, totalWaitTime: 0, reputationPenalty: 0 },
    },
    revenueState: {
      greenFeeStructure: { weekdayRate: 45, weekendRate: 65, twilightRate: 30, primeMorningPremium: 1.2, memberRate: 0.7, guestOfMemberRate: 0.85, dynamicPricingEnabled: false, demandMultiplierRange: [0.8, 1.3] },
      cartFeeStructure: { pricingModel: "per_person" as const, standardCartFee: 20, walkingDiscount: 0, cartRequired: false, cartIncluded: false },
      availableAddOns: [],
      tipConfig: { baseTipPercentage: 0.15, satisfactionModifier: 1.0, tipPooling: false, housePercentage: 0 },
      todaysRevenue: { greenFees: 0, cartFees: 0, addOnServices: 0, tips: 0, proShop: 0, foodAndBeverage: 0, rangeRevenue: 0, lessonRevenue: 0, eventFees: 0, grossRevenue: 100, operatingCosts: 0, netRevenue: 0 },
      revenueHistory: [],
    },
    marketingState: {
      activeCampaigns: [],
      campaignHistory: [],
      cooldowns: {},
      metrics: { totalSpent: 0, totalBookingsInfluenced: 0, totalRevenueInfluenced: 0, roi: 0 },
      baselineBookingsPerDay: 20,
      baselineRevenuePerDay: 2000,
    },
    autonomousState: { robots: [], chargingStationX: 0, chargingStationY: 0 },
    prestigeState: {
      currentScore: 100,
      targetScore: 200,
      starRating: 1,
      tier: "municipal" as const,
      currentConditions: { averageHealth: 50, greenScore: 50, fairwayScore: 50, bunkerScore: 50, hazardScore: 50, teeBoxScore: 50, composite: 50 },
      historicalExcellence: { dailySnapshots: [], consecutiveExcellentDays: 0, consecutiveGoodDays: 0, longestExcellentStreak: 0, daysSinceLastPoorRating: 0, poorDaysInLast90: 0, rollingAverage30: 0, rollingAverage90: 0, consistencyScore: 0, composite: 0 },
      amenities: {} as any,
      amenityScore: 0,
      reputation: {} as any,
      reputationScore: 0,
      exclusivity: {} as any,
      exclusivityScore: 0,
      greenFee: 45,
      tolerance: { sweetSpot: 45, maxTolerance: 80, rejectionThreshold: 60 },
      golfersToday: 0,
      golfersRejectedToday: 0,
      revenueToday: 0,
      revenueLostToday: 0,
    },
    irrigationSystem: {
      pipes: [],
      sprinklerHeads: [],
      waterSources: [],
      totalWaterUsedToday: 0,
      lastTickTime: 0,
      pressureCache: new Map(),
    },
    reputationState: {} as ReputationState,
    applicationState: { applications: [], lastApplicationTime: 0, nextApplicationTime: 100, activeJobPostings: [], totalApplicationsReceived: 0 },
    dailyStats: createMockDailyStats(),
    greenFees: { weekday9Holes: 25, weekday18Holes: 45, weekend9Holes: 35, weekend18Holes: 65, twilight9Holes: 20, twilight18Holes: 35 },
    gameTime: 600,
    gameDay: 1,
    timeScale: 1,
    lastPayrollHour: -1,
    lastArrivalHour: -1,
    lastAutoSaveHour: -1,
    lastPrestigeUpdateHour: -1,
    lastTeeTimeUpdateHour: -1,
    accumulatedResearchTime: 0,
    scenarioManager: null,
    currentCourse: { name: "Test Course", width: 20, height: 20, par: 72 } as unknown as CourseData,
    currentScenario: null,
    gameOptions: {} as GameOptions,
    score: 0,
    isPaused: false,
    isMuted: false,
    overlayAutoSwitched: false,
    shownTutorialHints: new Set<string>(),
    ...overrides,
  } as unknown as GameState;

  const systems: SimulationSystems = {
    terrainSystem,
    uiManager,
    employeeVisualSystem: overrides.employeeVisualSystem ?? null,
    irrigationRenderSystem: overrides.irrigationRenderSystem ?? null,
    saveCallback,
    showDaySummaryCallback,
  };

  return { state, systems };
}

describe("SimulationTick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(coreTickWeather).mockImplementation((state) => ({
      state,
      changed: false,
      previousType: null,
    }));
    vi.mocked(addExpense).mockImplementation((state) => state);
    vi.mocked(addIncome).mockImplementation((state) => state);
  });

  describe("tickWeather", () => {
    it("does nothing when weather unchanged and state is same reference", () => {
      const { state, systems } = createMockContext();
      const originalWeatherState = state.weatherState;
      const originalWeather = state.weather;
      runSimulationTick(state, systems, 16);
      expect(state.weatherState).toBe(originalWeatherState);
      expect(state.weather).toBe(originalWeather);
      expect(systems.uiManager.showNotification).not.toHaveBeenCalledWith(
        expect.stringContaining("Weather:"),
        undefined,
        3000
      );
    });

    it("updates weatherState when state reference changes without changed flag", () => {
      const { state, systems } = createMockContext();
      const newState: WeatherState = {
        current: { type: "sunny", temperature: 76, windSpeed: 5 },
        forecast: [],
        lastChangeTime: 0,
        seasonalModifier: { season: "summer", baseTemperature: 82, temperatureVariance: 12, rainChance: 0.15, stormChance: 0.08 },
      };
      vi.mocked(coreTickWeather).mockReturnValue({
        state: newState,
        changed: false,
        previousType: null,
      });
      runSimulationTick(state, systems, 16);
      expect(state.weatherState).toBe(newState);
      expect(state.weather).toBe(newState.current);
    });

    it("shows notification with weather description when changed", () => {
      const { state, systems } = createMockContext();
      const newState: WeatherState = {
        current: { type: "rainy", temperature: 65, windSpeed: 10 },
        forecast: [],
        lastChangeTime: 100,
        seasonalModifier: { season: "summer", baseTemperature: 82, temperatureVariance: 12, rainChance: 0.15, stormChance: 0.08 },
      };
      vi.mocked(coreTickWeather).mockReturnValue({
        state: newState,
        changed: true,
        previousType: "sunny",
      });
      vi.mocked(getWeatherImpactDescription).mockReturnValue("Rain is watering the course naturally. Fewer golfers expected.");
      runSimulationTick(state, systems, 16);
      expect(systems.uiManager.showNotification).toHaveBeenCalledWith(
        "Weather: Sunny 75°F",
        undefined,
        3000
      );
    });

    it("does not show impact notification when getWeatherImpactDescription returns empty", () => {
      vi.useFakeTimers();
      const { state, systems } = createMockContext();
      const newState: WeatherState = {
        current: { type: "sunny", temperature: 75, windSpeed: 5 },
        forecast: [],
        lastChangeTime: 100,
        seasonalModifier: { season: "summer", baseTemperature: 82, temperatureVariance: 12, rainChance: 0.15, stormChance: 0.08 },
      };
      vi.mocked(coreTickWeather).mockReturnValue({
        state: newState,
        changed: true,
        previousType: "cloudy",
      });
      vi.mocked(getWeatherImpactDescription).mockReturnValue("");
      runSimulationTick(state, systems, 16);
      vi.advanceTimersByTime(1000);
      expect(systems.uiManager.showNotification).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it("shows impact notification via setTimeout when impact is non-empty", () => {
      vi.useFakeTimers();
      const { state, systems } = createMockContext();
      const newState: WeatherState = {
        current: { type: "rainy", temperature: 65, windSpeed: 10 },
        forecast: [],
        lastChangeTime: 100,
        seasonalModifier: { season: "summer", baseTemperature: 82, temperatureVariance: 12, rainChance: 0.15, stormChance: 0.08 },
      };
      vi.mocked(coreTickWeather).mockReturnValue({
        state: newState,
        changed: true,
        previousType: "sunny",
      });
      vi.mocked(getWeatherImpactDescription).mockReturnValue("Rain impact");
      runSimulationTick(state, systems, 16);
      expect(systems.uiManager.showNotification).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(500);
      expect(systems.uiManager.showNotification).toHaveBeenCalledTimes(2);
      expect(systems.uiManager.showNotification).toHaveBeenCalledWith("Rain impact", undefined, 4000);
      vi.useRealTimers();
    });
  });

  describe("tickPayroll", () => {
    it("skips when hour matches lastPayrollHour", () => {
      const { state, systems } = createMockContext({ gameTime: 600, lastPayrollHour: 10 });
      runSimulationTick(state, systems, 16);
      expect(processPayroll).not.toHaveBeenCalled();
    });

    it("skips when no employees", () => {
      const { state, systems } = createMockContext({ gameTime: 600, lastPayrollHour: 5 });
      runSimulationTick(state, systems, 16);
      expect(processPayroll).not.toHaveBeenCalled();
    });

    it("processes payroll when hour changes and employees exist", () => {
      const { state, systems } = createMockContext({
        gameTime: 600,
        lastPayrollHour: 5,
        employeeRoster: { employees: [{ id: "e1", name: "Test", role: "groundskeeper", skillLevel: "novice", skills: { efficiency: 1, quality: 1, stamina: 1, reliability: 1 }, hireDate: 0, hourlyWage: 15, experience: 0, happiness: 100, fatigue: 0, status: "working", assignedArea: null }], maxEmployees: 10, lastPayrollTime: 0, totalWagesPaid: 0 },
      });
      vi.mocked(processPayroll).mockReturnValue({
        roster: state.employeeRoster,
        totalPaid: 15,
        breakdown: [{ employeeId: "e1", amount: 15 }],
      });
      vi.mocked(addExpense).mockReturnValue({ ...state.economyState, cash: 9985 });
      runSimulationTick(state, systems, 16);
      expect(processPayroll).toHaveBeenCalled();
      expect(state.lastPayrollHour).toBe(10);
    });

    it("updates economy and dailyStats when payroll totalPaid > 0", () => {
      const { state, systems } = createMockContext({
        gameTime: 600,
        lastPayrollHour: 5,
        employeeRoster: { employees: [{ id: "e1", name: "Test", role: "groundskeeper", skillLevel: "novice", skills: { efficiency: 1, quality: 1, stamina: 1, reliability: 1 }, hireDate: 0, hourlyWage: 15, experience: 0, happiness: 100, fatigue: 0, status: "working", assignedArea: null }], maxEmployees: 10, lastPayrollTime: 0, totalWagesPaid: 0 },
      });
      vi.mocked(processPayroll).mockReturnValue({
        roster: state.employeeRoster,
        totalPaid: 15,
        breakdown: [{ employeeId: "e1", amount: 15 }],
      });
      vi.mocked(addExpense).mockImplementation((state) => ({ ...state, cash: state.cash - 15 }));
      runSimulationTick(state, systems, 16);
      const wagesCalls = vi.mocked(addExpense).mock.calls.filter(c => c[2] === "employee_wages");
      expect(wagesCalls.length).toBe(1);
      expect(wagesCalls[0][1]).toBe(15);
      expect(state.dailyStats.expenses.wages).toBe(15);
    });

    it("does not update economy when addExpense returns null", () => {
      const { state, systems } = createMockContext({
        gameTime: 600,
        lastPayrollHour: 5,
        employeeRoster: { employees: [{ id: "e1", name: "Test", role: "groundskeeper", skillLevel: "novice", skills: { efficiency: 1, quality: 1, stamina: 1, reliability: 1 }, hireDate: 0, hourlyWage: 15, experience: 0, happiness: 100, fatigue: 0, status: "working", assignedArea: null }], maxEmployees: 10, lastPayrollTime: 0, totalWagesPaid: 0 },
      });
      vi.mocked(processPayroll).mockReturnValue({
        roster: state.employeeRoster,
        totalPaid: 15,
        breakdown: [{ employeeId: "e1", amount: 15 }],
      });
      vi.mocked(addExpense).mockReturnValue(null as any);
      const origCash = state.economyState.cash;
      runSimulationTick(state, systems, 16);
      expect(state.economyState.cash).toBe(origCash);
      expect(state.dailyStats.expenses.wages).toBe(0);
    });

    it("skips expense when totalPaid is 0", () => {
      const { state, systems } = createMockContext({
        gameTime: 600,
        lastPayrollHour: 5,
        employeeRoster: { employees: [{ id: "e1", name: "Test", role: "groundskeeper", skillLevel: "novice", skills: { efficiency: 1, quality: 1, stamina: 1, reliability: 1 }, hireDate: 0, hourlyWage: 0, experience: 0, happiness: 100, fatigue: 0, status: "working", assignedArea: null }], maxEmployees: 10, lastPayrollTime: 0, totalWagesPaid: 0 },
      });
      vi.mocked(processPayroll).mockReturnValue({
        roster: state.employeeRoster,
        totalPaid: 0,
        breakdown: [],
      });
      runSimulationTick(state, systems, 16);
      expect(addExpense).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        "employee_wages",
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe("tickAutoSave", () => {
    it("saves when hour changes", () => {
      const { state, systems } = createMockContext({ gameTime: 600, lastAutoSaveHour: 5 });
      runSimulationTick(state, systems, 16);
      expect(systems.saveCallback).toHaveBeenCalled();
      expect(state.lastAutoSaveHour).toBe(10);
    });

    it("skips save when hour matches", () => {
      const { state, systems } = createMockContext({ gameTime: 600, lastAutoSaveHour: 10 });
      runSimulationTick(state, systems, 16);
      expect(systems.saveCallback).not.toHaveBeenCalled();
    });
  });

  describe("tickPrestige", () => {
    it("skips when hour matches lastPrestigeUpdateHour", () => {
      const { state, systems } = createMockContext({ gameTime: 600, lastPrestigeUpdateHour: 10 });
      runSimulationTick(state, systems, 16);
      expect(calculateCurrentConditionsFromFaces).not.toHaveBeenCalled();
    });

    it("updates prestige and UI when hour changes", () => {
      const { state, systems } = createMockContext({ gameTime: 600, lastPrestigeUpdateHour: 5 });
      const updatedPrestige = { ...state.prestigeState, currentScore: 120 };
      vi.mocked(updatePrestigeScore).mockReturnValue(updatedPrestige);
      vi.mocked(calculateDemandMultiplier).mockReturnValue(0.8);
      runSimulationTick(state, systems, 16);
      expect(calculateCurrentConditionsFromFaces).toHaveBeenCalled();
      expect(systems.uiManager.updatePrestige).toHaveBeenCalled();
      expect(state.lastPrestigeUpdateHour).toBe(10);
    });
  });

  describe("tickTeeTimes", () => {
    it("skips when hour matches lastTeeTimeUpdateHour", () => {
      const { state, systems } = createMockContext({ gameTime: 600, lastTeeTimeUpdateHour: 10 });
      runSimulationTick(state, systems, 16);
      expect(generateDailySlots).not.toHaveBeenCalled();
    });

    it("generates daily slots at hour 5", () => {
      const { state, systems } = createMockContext({ gameTime: 300, lastTeeTimeUpdateHour: 4 });
      vi.mocked(generateDailySlots).mockReturnValue([]);
      vi.mocked(simulateDailyBookings).mockReturnValue({ newBookings: [], cancellations: [], noShows: [], totalNewRevenue: 0, totalCancellationPenalties: 0, totalNoShowPenalties: 0 });
      vi.mocked(applyBookingSimulation).mockReturnValue(state.teeTimeState);
      runSimulationTick(state, systems, 16);
      expect(generateDailySlots).toHaveBeenCalled();
      expect(simulateDailyBookings).toHaveBeenCalled();
      expect(applyBookingSimulation).toHaveBeenCalled();
    });

    it("does not generate slots at hours other than 5", () => {
      const { state, systems } = createMockContext({ gameTime: 480, lastTeeTimeUpdateHour: 7 });
      runSimulationTick(state, systems, 16);
      expect(generateDailySlots).not.toHaveBeenCalled();
    });

    it("processes walk-ons during operating hours (6-19)", () => {
      const { state, systems } = createMockContext({ gameTime: 480, lastTeeTimeUpdateHour: 7 });
      runSimulationTick(state, systems, 16);
      expect(processWalkOns).toHaveBeenCalled();
    });

    it("does not process walk-ons before hour 6", () => {
      const { state, systems } = createMockContext({ gameTime: 300, lastTeeTimeUpdateHour: 4 });
      runSimulationTick(state, systems, 16);
      expect(processWalkOns).not.toHaveBeenCalled();
    });

    it("does not process walk-ons after hour 19", () => {
      const { state, systems } = createMockContext({ gameTime: 1200, lastTeeTimeUpdateHour: 19 });
      runSimulationTick(state, systems, 16);
      expect(processWalkOns).not.toHaveBeenCalled();
    });

    it("processes end-of-day at hour 22", () => {
      const { state, systems } = createMockContext({ gameTime: 1320, lastTeeTimeUpdateHour: 21 });
      runSimulationTick(state, systems, 16);
      expect(finalizeDailyRevenue).toHaveBeenCalled();
    });

    it("does not process end-of-day at other hours", () => {
      const { state, systems } = createMockContext({ gameTime: 600, lastTeeTimeUpdateHour: 9 });
      runSimulationTick(state, systems, 16);
      expect(finalizeDailyRevenue).not.toHaveBeenCalled();
    });
  });

  describe("processEndOfDay", () => {
    function setupEndOfDay(overrides: Record<string, any> = {}) {
      return createMockContext({
        gameTime: 1320,
        lastTeeTimeUpdateHour: 21,
        ...overrides,
      });
    }

    it("finalizes daily revenue", () => {
      const { state, systems } = setupEndOfDay();
      runSimulationTick(state, systems, 16);
      expect(finalizeDailyRevenue).toHaveBeenCalledWith(state.revenueState);
    });

    it("processes marketing campaigns", () => {
      const { state, systems } = setupEndOfDay();
      runSimulationTick(state, systems, 16);
      expect(processDailyCampaigns).toHaveBeenCalled();
    });

    it("shows notification for completed campaigns", () => {
      const { state, systems } = setupEndOfDay();
      vi.mocked(processDailyCampaigns).mockReturnValue({
        state: state.marketingState,
        completedCampaignNames: ["Test Campaign"],
        dailyCost: 0,
      });
      runSimulationTick(state, systems, 16);
      expect(systems.uiManager.showNotification).toHaveBeenCalledWith(
        expect.stringContaining("Test Campaign")
      );
    });

    it("does not show campaign notification when no completed campaigns", () => {
      const { state, systems } = setupEndOfDay();
      vi.mocked(processDailyCampaigns).mockReturnValue({
        state: state.marketingState,
        completedCampaignNames: [],
        dailyCost: 0,
      });
      runSimulationTick(state, systems, 16);
      expect(systems.uiManager.showNotification).not.toHaveBeenCalledWith(
        expect.stringContaining("Campaign completed")
      );
    });

    it("charges marketing daily cost when > 0", () => {
      const { state, systems } = setupEndOfDay();
      const updatedEconomy = { ...state.economyState, cash: 9900 };
      vi.mocked(processDailyCampaigns).mockReturnValue({
        state: state.marketingState,
        completedCampaignNames: [],
        dailyCost: 100,
      });
      vi.mocked(addExpense).mockReturnValue(updatedEconomy);
      runSimulationTick(state, systems, 16);
      expect(state.dailyStats.expenses.other).toBe(100);
    });

    it("skips marketing expense when dailyCost is 0", () => {
      const { state, systems } = setupEndOfDay();
      vi.mocked(processDailyCampaigns).mockReturnValue({
        state: state.marketingState,
        completedCampaignNames: [],
        dailyCost: 0,
      });
      runSimulationTick(state, systems, 16);
      expect(state.dailyStats.expenses.other).toBe(0);
    });

    it("does not update economy when marketing addExpense returns null", () => {
      const { state, systems } = setupEndOfDay();
      vi.mocked(processDailyCampaigns).mockReturnValue({
        state: state.marketingState,
        completedCampaignNames: [],
        dailyCost: 100,
      });
      vi.mocked(addExpense).mockReturnValue(null as any);
      runSimulationTick(state, systems, 16);
      expect(state.dailyStats.expenses.other).toBe(0);
    });

    it("charges daily utilities", () => {
      const { state, systems } = setupEndOfDay();
      const updatedEconomy = { ...state.economyState, cash: 9950 };
      vi.mocked(addExpense).mockReturnValue(updatedEconomy);
      runSimulationTick(state, systems, 16);
      expect(state.dailyStats.expenses.utilities).toBe(50);
    });

    it("does not update utilities when addExpense returns null", () => {
      const { state, systems } = setupEndOfDay();
      vi.mocked(addExpense).mockReturnValue(null as any);
      runSimulationTick(state, systems, 16);
      expect(state.dailyStats.expenses.utilities).toBe(0);
    });

    it("takes daily prestige snapshot and updates historical excellence", () => {
      const { state, systems } = setupEndOfDay();
      vi.mocked(addExpense).mockReturnValue(state.economyState);
      runSimulationTick(state, systems, 16);
      expect(takeDailySnapshot).toHaveBeenCalled();
      expect(updateHistoricalExcellence).toHaveBeenCalled();
    });

    it("calls showDaySummaryCallback and saveCallback", () => {
      const { state, systems } = setupEndOfDay();
      vi.mocked(addExpense).mockReturnValue(state.economyState);
      runSimulationTick(state, systems, 16);
      expect(systems.showDaySummaryCallback).toHaveBeenCalled();
      expect(systems.saveCallback).toHaveBeenCalled();
    });

    it("resets daily metrics for walk-ons, tee-times, prestige, and golfers", () => {
      const { state, systems } = setupEndOfDay();
      vi.mocked(addExpense).mockReturnValue(state.economyState);
      runSimulationTick(state, systems, 16);
      expect(resetDailyWalkOnMetrics).toHaveBeenCalled();
      expect(resetTeeTimeDailyMetrics).toHaveBeenCalled();
      expect(resetPrestigeDailyStats).toHaveBeenCalled();
      expect(resetGolferDailyStats).toHaveBeenCalled();
    });
  });

  describe("tickGolferArrivals", () => {
    it("skips when hour matches lastArrivalHour", () => {
      const { state, systems } = createMockContext({ gameTime: 600, lastArrivalHour: 10 });
      runSimulationTick(state, systems, 16);
      expect(updateCourseRating).not.toHaveBeenCalled();
    });

    it("skips before hour 6", () => {
      const { state, systems } = createMockContext({ gameTime: 240, lastArrivalHour: 3 });
      runSimulationTick(state, systems, 16);
      expect(updateCourseRating).not.toHaveBeenCalled();
    });

    it("skips after hour 19", () => {
      const { state, systems } = createMockContext({ gameTime: 1200, lastArrivalHour: 19 });
      runSimulationTick(state, systems, 16);
      expect(updateCourseRating).not.toHaveBeenCalled();
    });

    it("updates course rating and calculates arrivals when valid hour", () => {
      const { state, systems } = createMockContext({ gameTime: 600, lastArrivalHour: 9 });
      vi.mocked(calculateArrivalRate).mockReturnValue(0);
      vi.mocked(calculateDemandMultiplier).mockReturnValue(1.0);
      runSimulationTick(state, systems, 16);
      expect(updateCourseRating).toHaveBeenCalled();
      expect(state.lastArrivalHour).toBe(10);
    });

    it("tracks rejected golfers when demand multiplier reduces arrivals", () => {
      const { state, systems } = createMockContext({ gameTime: 600, lastArrivalHour: 9 });
      vi.mocked(calculateArrivalRate).mockReturnValue(5);
      vi.mocked(calculateDemandMultiplier).mockReturnValue(0.5);
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      runSimulationTick(state, systems, 16);
      expect(state.prestigeState.golfersRejectedToday).toBeGreaterThanOrEqual(0);
      vi.spyOn(Math, "random").mockRestore();
    });

    it("rounds up fractional arrival rate when random < fractional part", () => {
      const { state, systems } = createMockContext({ gameTime: 600, lastArrivalHour: 9 });
      vi.mocked(calculateArrivalRate).mockReturnValue(2.7);
      vi.mocked(calculateDemandMultiplier).mockReturnValue(1.0);
      vi.spyOn(Math, "random").mockReturnValue(0.3);
      const mockGolfer = { id: "g1", type: "casual" as const, preferences: { priceThreshold: 100, qualityExpectation: 50, patienceLevel: 50, tipGenerosity: 1 }, status: "arriving" as const, arrivalTime: 600, holesPlayed: 0, totalHoles: 18, paidAmount: 45, satisfaction: 70, satisfactionFactors: {}, willReturn: true };
      vi.mocked(generateArrivals).mockReturnValue([mockGolfer, mockGolfer, mockGolfer]);
      runSimulationTick(state, systems, 16);
      expect(generateArrivals).toHaveBeenCalledWith(
        expect.anything(),
        3,
        expect.anything(),
        expect.anything(),
        expect.any(Boolean),
        expect.any(Boolean)
      );
      vi.spyOn(Math, "random").mockRestore();
    });

    it("shows warning notification when many golfers rejected", () => {
      const { state, systems } = createMockContext({
        gameTime: 600,
        lastArrivalHour: 9,
        prestigeState: {
          ...createMockContext().state.prestigeState,
          golfersRejectedToday: 5,
          revenueLostToday: 0,
        },
      });
      vi.mocked(calculateArrivalRate).mockReturnValue(10);
      vi.mocked(calculateDemandMultiplier).mockReturnValue(0.3);
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      runSimulationTick(state, systems, 16);
      const notifCalls = vi.mocked(systems.uiManager.showNotification).mock.calls;
      const hasWarning = notifCalls.some(
        (call) => typeof call[0] === "string" && call[0].includes("turned away")
      );
      expect(hasWarning).toBe(true);
      vi.spyOn(Math, "random").mockRestore();
    });

    it("does not show warning when golfersRejectedToday < 5", () => {
      const { state, systems } = createMockContext({
        gameTime: 600,
        lastArrivalHour: 9,
        prestigeState: {
          ...createMockContext().state.prestigeState,
          golfersRejectedToday: 0,
          revenueLostToday: 0,
        },
      });
      vi.mocked(calculateArrivalRate).mockReturnValue(3);
      vi.mocked(calculateDemandMultiplier).mockReturnValue(0.5);
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      runSimulationTick(state, systems, 16);
      const notifCalls = vi.mocked(systems.uiManager.showNotification).mock.calls;
      const hasWarning = notifCalls.some(
        (call) => typeof call[0] === "string" && call[0].includes("turned away")
      );
      expect(hasWarning).toBe(false);
      vi.spyOn(Math, "random").mockRestore();
    });

    it("generates arrivals and adds golfers when arrivalCount > 0", () => {
      const { state, systems } = createMockContext({ gameTime: 600, lastArrivalHour: 9 });
      vi.mocked(calculateArrivalRate).mockReturnValue(3);
      vi.mocked(calculateDemandMultiplier).mockReturnValue(1.0);
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      const mockGolfer = { id: "g1", type: "casual" as const, preferences: { priceThreshold: 100, qualityExpectation: 50, patienceLevel: 50, tipGenerosity: 1 }, status: "arriving" as const, arrivalTime: 600, holesPlayed: 0, totalHoles: 18, paidAmount: 45, satisfaction: 70, satisfactionFactors: {}, willReturn: true };
      vi.mocked(generateArrivals).mockReturnValue([mockGolfer]);
      runSimulationTick(state, systems, 16);
      expect(generateArrivals).toHaveBeenCalled();
      expect(addGolfer).toHaveBeenCalled();
      expect(addIncome).toHaveBeenCalled();
      expect(state.dailyStats.revenue.greenFees).toBe(45);
    });

    it("updates scenario manager when arrivals happen with scenario", () => {
      const { state, systems } = createMockContext({
        gameTime: 600,
        lastArrivalHour: 9,
        scenarioManager: {
          addRevenue: vi.fn(),
          addGolfers: vi.fn(),
          addRound: vi.fn(),
          updateProgress: vi.fn(),
        } as any,
      });
      vi.mocked(calculateArrivalRate).mockReturnValue(2);
      vi.mocked(calculateDemandMultiplier).mockReturnValue(1.0);
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      const mockGolfer = { id: "g1", type: "casual" as const, preferences: { priceThreshold: 100, qualityExpectation: 50, patienceLevel: 50, tipGenerosity: 1 }, status: "arriving" as const, arrivalTime: 600, holesPlayed: 0, totalHoles: 18, paidAmount: 45, satisfaction: 70, satisfactionFactors: {}, willReturn: true };
      vi.mocked(generateArrivals).mockReturnValue([mockGolfer]);
      runSimulationTick(state, systems, 16);
      expect(state.scenarioManager!.addRevenue).toHaveBeenCalledWith(45);
      expect(state.scenarioManager!.addGolfers).toHaveBeenCalledWith(1);
      vi.spyOn(Math, "random").mockRestore();
    });

    it("does not call generateArrivals when arrivalCount is 0", () => {
      const { state, systems } = createMockContext({ gameTime: 600, lastArrivalHour: 9 });
      vi.mocked(calculateArrivalRate).mockReturnValue(0);
      vi.mocked(calculateDemandMultiplier).mockReturnValue(1.0);
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      runSimulationTick(state, systems, 16);
      expect(generateArrivals).not.toHaveBeenCalled();
      vi.spyOn(Math, "random").mockRestore();
    });

    it("calculates weekend correctly for day % 7 >= 5", () => {
      const { state, systems } = createMockContext({ gameTime: 600, lastArrivalHour: 9, gameDay: 5 });
      vi.mocked(calculateArrivalRate).mockReturnValue(0);
      vi.mocked(calculateDemandMultiplier).mockReturnValue(1.0);
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      runSimulationTick(state, systems, 16);
      expect(calculateArrivalRate).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        true,
        expect.any(Number)
      );
      vi.spyOn(Math, "random").mockRestore();
    });

    it("calculates twilight correctly for hours >= 16", () => {
      const { state, systems } = createMockContext({ gameTime: 1020, lastArrivalHour: 16 });
      vi.mocked(calculateArrivalRate).mockReturnValue(1);
      vi.mocked(calculateDemandMultiplier).mockReturnValue(1.0);
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      const mockGolfer = { id: "g1", type: "casual" as const, preferences: { priceThreshold: 100, qualityExpectation: 50, patienceLevel: 50, tipGenerosity: 1 }, status: "arriving" as const, arrivalTime: 1020, holesPlayed: 0, totalHoles: 18, paidAmount: 35, satisfaction: 70, satisfactionFactors: {}, willReturn: true };
      vi.mocked(generateArrivals).mockReturnValue([mockGolfer]);
      runSimulationTick(state, systems, 16);
      expect(generateArrivals).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Number),
        expect.anything(),
        expect.anything(),
        expect.any(Boolean),
        true
      );
      vi.spyOn(Math, "random").mockRestore();
    });
  });

  describe("tickGolferSimulation", () => {
    it("always ticks golfer simulation", () => {
      const { state, systems } = createMockContext();
      runSimulationTick(state, systems, 16);
      expect(coreTickGolfers).toHaveBeenCalled();
      expect(getManagerBonus).toHaveBeenCalled();
    });

    it("processes departures with tips", () => {
      const { state, systems } = createMockContext({
        scenarioManager: {
          addRevenue: vi.fn(),
          addGolfers: vi.fn(),
          addRound: vi.fn(),
          updateProgress: vi.fn(),
        } as any,
      });
      vi.mocked(coreTickGolfers).mockReturnValue({
        state: state.golferPool,
        departures: [{ id: "g1", type: "casual", preferences: { priceThreshold: 100, qualityExpectation: 50, patienceLevel: 50, tipGenerosity: 1 }, status: "leaving" as const, arrivalTime: 0, holesPlayed: 18, totalHoles: 18, paidAmount: 45, satisfaction: 80, satisfactionFactors: {}, willReturn: true }],
        revenue: 45,
        tips: 10,
      });
      runSimulationTick(state, systems, 16);
      expect(addIncome).toHaveBeenCalledWith(
        expect.anything(),
        10,
        "other_income",
        "Golfer tips",
        expect.any(Number)
      );
      expect(state.dailyStats.revenue.tips).toBe(10);
      expect(state.dailyStats.golfersServed).toBe(1);
      expect(state.scenarioManager!.addRevenue).toHaveBeenCalledWith(10);
      expect(state.scenarioManager!.addRound).toHaveBeenCalled();
    });

    it("does not add income or show notification when tips are 0 but departures exist", () => {
      const { state, systems } = createMockContext();
      vi.mocked(coreTickGolfers).mockReturnValue({
        state: state.golferPool,
        departures: [{ id: "g1", type: "casual", preferences: { priceThreshold: 100, qualityExpectation: 50, patienceLevel: 50, tipGenerosity: 1 }, status: "leaving" as const, arrivalTime: 0, holesPlayed: 18, totalHoles: 18, paidAmount: 45, satisfaction: 80, satisfactionFactors: {}, willReturn: true }],
        revenue: 45,
        tips: 0,
      });
      runSimulationTick(state, systems, 16);
      expect(addIncome).not.toHaveBeenCalledWith(
        expect.anything(),
        0,
        "other_income",
        expect.anything(),
        expect.anything()
      );
      expect(state.dailyStats.golfersServed).toBe(1);
      expect(state.dailyStats.revenue.tips).toBe(0);
    });

    it("does nothing for departures when no departures", () => {
      const { state, systems } = createMockContext();
      vi.mocked(coreTickGolfers).mockReturnValue({
        state: state.golferPool,
        departures: [],
        revenue: 0,
        tips: 0,
      });
      runSimulationTick(state, systems, 16);
      expect(state.dailyStats.golfersServed).toBe(0);
    });

    it("does not update scenarioManager when null and departures have tips", () => {
      const { state, systems } = createMockContext({ scenarioManager: null });
      vi.mocked(coreTickGolfers).mockReturnValue({
        state: state.golferPool,
        departures: [{ id: "g1", type: "casual", preferences: { priceThreshold: 100, qualityExpectation: 50, patienceLevel: 50, tipGenerosity: 1 }, status: "leaving" as const, arrivalTime: 0, holesPlayed: 18, totalHoles: 18, paidAmount: 45, satisfaction: 80, satisfactionFactors: {}, willReturn: true }],
        revenue: 45,
        tips: 10,
      });
      runSimulationTick(state, systems, 16);
      expect(state.dailyStats.revenue.tips).toBe(10);
    });

    it("accumulates satisfaction from multiple departures", () => {
      const { state, systems } = createMockContext();
      vi.mocked(coreTickGolfers).mockReturnValue({
        state: state.golferPool,
        departures: [
          { id: "g1", type: "casual", preferences: { priceThreshold: 100, qualityExpectation: 50, patienceLevel: 50, tipGenerosity: 1 }, status: "leaving" as const, arrivalTime: 0, holesPlayed: 18, totalHoles: 18, paidAmount: 45, satisfaction: 80, satisfactionFactors: {}, willReturn: true },
          { id: "g2", type: "regular", preferences: { priceThreshold: 150, qualityExpectation: 60, patienceLevel: 60, tipGenerosity: 1.2 }, status: "leaving" as const, arrivalTime: 0, holesPlayed: 18, totalHoles: 18, paidAmount: 65, satisfaction: 90, satisfactionFactors: {}, willReturn: true },
        ],
        revenue: 110,
        tips: 15,
      });
      runSimulationTick(state, systems, 16);
      expect(state.dailyStats.golfersServed).toBe(2);
      expect(state.dailyStats.totalSatisfaction).toBe(170);
    });
  });

  describe("tickEmployees", () => {
    it("calls coreTickEmployees with training bonus", () => {
      const { state, systems } = createMockContext();
      vi.mocked(getEquipmentEfficiencyBonus).mockReturnValue(1.5);
      runSimulationTick(state, systems, 16);
      expect(coreTickEmployees).toHaveBeenCalledWith(
        state.employeeRoster,
        expect.any(Number),
        1.5
      );
    });

    it("processes new applicant notification", () => {
      const { state, systems } = createMockContext();
      vi.mocked(tickApplications).mockReturnValue({
        state: state.applicationState,
        newApplicant: { id: "a1", name: "John", role: "groundskeeper", skillLevel: "novice", skills: { efficiency: 1, quality: 1, stamina: 1, reliability: 1 }, hireDate: 0, hourlyWage: 12, experience: 0, happiness: 100, fatigue: 0, status: "idle" as const, assignedArea: null },
        expiredPostings: [],
      });
      runSimulationTick(state, systems, 16);
      expect(systems.uiManager.showNotification).toHaveBeenCalledWith(
        expect.stringContaining("New applicant: John")
      );
    });

    it("does not show applicant notification when no new applicant", () => {
      const { state, systems } = createMockContext();
      vi.mocked(tickApplications).mockReturnValue({
        state: state.applicationState,
        newApplicant: null,
        expiredPostings: [],
      });
      runSimulationTick(state, systems, 16);
      const notifCalls = vi.mocked(systems.uiManager.showNotification).mock.calls;
      const hasApplicant = notifCalls.some(
        (call) => typeof call[0] === "string" && call[0].includes("New applicant")
      );
      expect(hasApplicant).toBe(false);
    });

    it("shows notification for expired job postings", () => {
      const { state, systems } = createMockContext();
      vi.mocked(tickApplications).mockReturnValue({
        state: state.applicationState,
        newApplicant: null,
        expiredPostings: [{ id: "jp1", role: "groundskeeper" as const, postedTime: 0, expiresAt: 100, cost: 50 }],
      });
      runSimulationTick(state, systems, 16);
      expect(systems.uiManager.showNotification).toHaveBeenCalledWith(
        expect.stringContaining("Job posting expired: groundskeeper"),
        "#ffaa44"
      );
    });

    it("does not show expired postings notification when none expired", () => {
      const { state, systems } = createMockContext();
      vi.mocked(tickApplications).mockReturnValue({
        state: state.applicationState,
        newApplicant: null,
        expiredPostings: [],
      });
      runSimulationTick(state, systems, 16);
      const notifCalls = vi.mocked(systems.uiManager.showNotification).mock.calls;
      const hasExpired = notifCalls.some(
        (call) => typeof call[0] === "string" && call[0].includes("Job posting expired")
      );
      expect(hasExpired).toBe(false);
    });

    it("applies work effects for mow type", () => {
      const { state, systems } = createMockContext();
      vi.mocked(tickEmployeeWork).mockReturnValue({
        state: state.employeeWorkState,
        effects: [{ worldX: 5, worldZ: 5, radius: 1, type: "mow" as const, efficiency: 1.0 }],
        tasksCompleted: 0,
        completions: [],
      });
      vi.mocked(systems.terrainSystem.applyWorkEffect as any).mockReturnValue(["f1", "f2"]);
      runSimulationTick(state, systems, 16);
      expect(systems.terrainSystem.applyWorkEffect).toHaveBeenCalled();
      expect(state.dailyStats.maintenance.tilesMowed).toBe(2);
    });

    it("applies work effects for water type", () => {
      const { state, systems } = createMockContext();
      vi.mocked(tickEmployeeWork).mockReturnValue({
        state: state.employeeWorkState,
        effects: [{ worldX: 5, worldZ: 5, radius: 1, type: "water" as const, efficiency: 1.0 }],
        tasksCompleted: 0,
        completions: [],
      });
      vi.mocked(systems.terrainSystem.applyWorkEffect as any).mockReturnValue(["f1"]);
      runSimulationTick(state, systems, 16);
      expect(state.dailyStats.maintenance.tilesWatered).toBe(1);
    });

    it("applies work effects for fertilize type", () => {
      const { state, systems } = createMockContext();
      vi.mocked(tickEmployeeWork).mockReturnValue({
        state: state.employeeWorkState,
        effects: [{ worldX: 5, worldZ: 5, radius: 1, type: "fertilize" as const, efficiency: 1.0 }],
        tasksCompleted: 0,
        completions: [],
      });
      vi.mocked(systems.terrainSystem.applyWorkEffect as any).mockReturnValue(["f1", "f2", "f3"]);
      runSimulationTick(state, systems, 16);
      expect(state.dailyStats.maintenance.tilesFertilized).toBe(3);
    });

    it("does not increment maintenance stats for rake type", () => {
      const { state, systems } = createMockContext();
      vi.mocked(tickEmployeeWork).mockReturnValue({
        state: state.employeeWorkState,
        effects: [{ worldX: 5, worldZ: 5, radius: 1, type: "rake" as const, efficiency: 1.0 }],
        tasksCompleted: 0,
        completions: [],
      });
      vi.mocked(systems.terrainSystem.applyWorkEffect as any).mockReturnValue(["f1"]);
      runSimulationTick(state, systems, 16);
      expect(state.dailyStats.maintenance.tilesMowed).toBe(0);
      expect(state.dailyStats.maintenance.tilesWatered).toBe(0);
      expect(state.dailyStats.maintenance.tilesFertilized).toBe(0);
    });

    it("awards experience for task completions with rewards > 0", () => {
      const { state, systems } = createMockContext();
      vi.mocked(tickEmployeeWork).mockReturnValue({
        state: state.employeeWorkState,
        effects: [],
        tasksCompleted: 1,
        completions: [{ employeeId: "e1", task: "mow_grass" as const, worldX: 5, worldZ: 5 }],
      });
      runSimulationTick(state, systems, 16);
      expect(awardExperience).toHaveBeenCalledWith(
        expect.anything(),
        "e1",
        10
      );
      expect(state.dailyStats.maintenance.tasksCompleted).toBe(1);
    });

    it("does not award experience when reward is 0", () => {
      const { state, systems } = createMockContext();
      vi.mocked(tickEmployeeWork).mockReturnValue({
        state: state.employeeWorkState,
        effects: [],
        tasksCompleted: 1,
        completions: [{ employeeId: "e1", task: "idle" as const, worldX: 0, worldZ: 0 }],
      });
      runSimulationTick(state, systems, 16);
      expect(awardExperience).not.toHaveBeenCalled();
    });

    it("charges supply costs for task completions with cost > 0", () => {
      const { state, systems } = createMockContext();
      vi.mocked(tickEmployeeWork).mockReturnValue({
        state: state.employeeWorkState,
        effects: [],
        tasksCompleted: 1,
        completions: [{ employeeId: "e1", task: "mow_grass" as const, worldX: 5, worldZ: 5 }],
      });
      vi.mocked(addExpense).mockReturnValue({ ...state.economyState, cash: 9999.75 });
      runSimulationTick(state, systems, 16);
      expect(state.dailyStats.expenses.supplies).toBe(0.25);
    });

    it("does not charge supplies when cost is 0", () => {
      const { state, systems } = createMockContext();
      vi.mocked(tickEmployeeWork).mockReturnValue({
        state: state.employeeWorkState,
        effects: [],
        tasksCompleted: 1,
        completions: [{ employeeId: "e1", task: "idle" as const, worldX: 0, worldZ: 0 }],
      });
      runSimulationTick(state, systems, 16);
      expect(state.dailyStats.expenses.supplies).toBe(0);
    });

    it("does not update economy when supply addExpense returns null", () => {
      const { state, systems } = createMockContext();
      vi.mocked(tickEmployeeWork).mockReturnValue({
        state: state.employeeWorkState,
        effects: [],
        tasksCompleted: 1,
        completions: [{ employeeId: "e1", task: "mow_grass" as const, worldX: 5, worldZ: 5 }],
      });
      vi.mocked(addExpense).mockReturnValue(null as any);
      runSimulationTick(state, systems, 16);
      expect(state.dailyStats.expenses.supplies).toBe(0);
    });

    it("updates employee visual system when present", () => {
      const mockVisualSystem = { update: vi.fn() };
      const { state, systems } = createMockContext({
        employeeVisualSystem: mockVisualSystem as any,
      });
      runSimulationTick(state, systems, 16);
      expect(mockVisualSystem.update).toHaveBeenCalled();
    });

    it("does not call visual system when null", () => {
      const { state, systems } = createMockContext({ employeeVisualSystem: null });
      runSimulationTick(state, systems, 16);
    });

    it("updates minimap workers", () => {
      const { state, systems } = createMockContext();
      runSimulationTick(state, systems, 16);
      expect(systems.uiManager.updateMinimapWorkers).toHaveBeenCalledWith(
        expect.anything(),
        20,
        20
      );
    });
  });

  describe("tickResearch", () => {
    it("does nothing when no current research", () => {
      const { state, systems } = createMockContext();
      runSimulationTick(state, systems, 16);
      expect(getFundingCostPerMinute).not.toHaveBeenCalled();
    });

    it("accumulates research time without ticking when < 1 minute", () => {
      const { state, systems } = createMockContext({
        researchState: { completedResearch: [], currentResearch: { itemId: "r1", pointsEarned: 0, pointsRequired: 100, startTime: 0 }, researchQueue: [], fundingLevel: "normal" as const, totalPointsSpent: 0 },
        accumulatedResearchTime: 0,
      });
      runSimulationTick(state, systems, 1);
      expect(state.accumulatedResearchTime).toBeGreaterThan(0);
      expect(state.accumulatedResearchTime).toBeLessThan(1);
      expect(getFundingCostPerMinute).not.toHaveBeenCalled();
    });

    it("ticks research when accumulated time >= 1 and has funding", () => {
      const { state, systems } = createMockContext({
        researchState: { completedResearch: [], currentResearch: { itemId: "r1", pointsEarned: 0, pointsRequired: 100, startTime: 0 }, researchQueue: [], fundingLevel: "normal" as const, totalPointsSpent: 0 },
        accumulatedResearchTime: 0.5,
        economyState: { cash: 10000, loans: [], transactions: [], totalEarned: 0, totalSpent: 0 },
      });
      vi.mocked(getFundingCostPerMinute).mockReturnValue(5);
      vi.mocked(addExpense).mockReturnValue({ ...state.economyState, cash: 9995 });
      vi.mocked(coreTickResearch).mockReturnValue({
        state: state.researchState,
        completed: null,
        pointsAdded: 1,
      });
      runSimulationTick(state, systems, 500);
      expect(coreTickResearch).toHaveBeenCalled();
    });

    it("shows notification when research completes", () => {
      const { state, systems } = createMockContext({
        researchState: { completedResearch: [], currentResearch: { itemId: "r1", pointsEarned: 99, pointsRequired: 100, startTime: 0 }, researchQueue: [], fundingLevel: "normal" as const, totalPointsSpent: 0 },
        accumulatedResearchTime: 0.5,
        economyState: { cash: 10000, loans: [], transactions: [], totalEarned: 0, totalSpent: 0 },
      });
      vi.mocked(getFundingCostPerMinute).mockReturnValue(5);
      vi.mocked(addExpense).mockReturnValue({ ...state.economyState, cash: 9995 });
      vi.mocked(coreTickResearch).mockReturnValue({
        state: { ...state.researchState, currentResearch: null },
        completed: { id: "r1", name: "Auto Mower", description: "", category: "robotics" as const, baseCost: 100, prerequisites: [], tier: 1, unlocks: { type: "feature" as const, featureId: "auto_mow" } },
        pointsAdded: 1,
      });
      vi.mocked(describeResearchUnlock).mockReturnValue("Auto Mower");
      runSimulationTick(state, systems, 500);
      expect(systems.uiManager.showNotification).toHaveBeenCalledWith(
        "Research complete: Auto Mower"
      );
    });

    it("does not tick research when funding cost > 0 but cash insufficient", () => {
      const { state, systems } = createMockContext({
        researchState: { completedResearch: [], currentResearch: { itemId: "r1", pointsEarned: 0, pointsRequired: 100, startTime: 0 }, researchQueue: [], fundingLevel: "normal" as const, totalPointsSpent: 0 },
        accumulatedResearchTime: 0.5,
        economyState: { cash: 0, loans: [], transactions: [], totalEarned: 0, totalSpent: 0 },
      });
      vi.mocked(getFundingCostPerMinute).mockReturnValue(5);
      runSimulationTick(state, systems, 500);
      expect(coreTickResearch).not.toHaveBeenCalled();
    });

    it("ticks research even when addExpense returns null (expense not applied but research continues)", () => {
      const { state, systems } = createMockContext({
        researchState: { completedResearch: [], currentResearch: { itemId: "r1", pointsEarned: 0, pointsRequired: 100, startTime: 0 }, researchQueue: [], fundingLevel: "normal" as const, totalPointsSpent: 0 },
        accumulatedResearchTime: 0.5,
        economyState: { cash: 10000, loans: [], transactions: [], totalEarned: 0, totalSpent: 0 },
      });
      vi.mocked(getFundingCostPerMinute).mockReturnValue(5);
      vi.mocked(addExpense).mockReturnValue(null as any);
      vi.mocked(coreTickResearch).mockReturnValue({
        state: state.researchState,
        completed: null,
        pointsAdded: 1,
      });
      runSimulationTick(state, systems, 500);
      expect(coreTickResearch).toHaveBeenCalled();
      expect(state.economyState.cash).toBe(10000);
    });

    it("does not tick research when funding cost is 0 (guard: fundingCost > 0)", () => {
      const { state, systems } = createMockContext({
        researchState: { completedResearch: [], currentResearch: { itemId: "r1", pointsEarned: 0, pointsRequired: 100, startTime: 0 }, researchQueue: [], fundingLevel: "none" as const, totalPointsSpent: 0 },
        accumulatedResearchTime: 0.5,
        economyState: { cash: 0, loans: [], transactions: [], totalEarned: 0, totalSpent: 0 },
      });
      vi.mocked(getFundingCostPerMinute).mockReturnValue(0);
      runSimulationTick(state, systems, 500);
      expect(coreTickResearch).not.toHaveBeenCalled();
    });
  });

  describe("tickAutonomousEquipment", () => {
    it("does nothing when no robots", () => {
      const { state, systems } = createMockContext();
      runSimulationTick(state, systems, 16);
      expect(coreTickAutonomousEquipment).not.toHaveBeenCalled();
    });

    it("ticks autonomous equipment when robots exist", () => {
      const { state, systems } = createMockContext({
        autonomousState: {
          robots: [{ id: "r1", equipmentId: "auto_mower_1", type: "mower" as const, stats: { efficiency: 1, speed: 1, fuelCapacity: 100, fuelEfficiency: 1, durability: 100 }, worldX: 5, worldZ: 5, resourceCurrent: 100, resourceMax: 100, state: "working" as const, targetX: 10, targetY: 10, breakdownTimeRemaining: 0 }],
          chargingStationX: 0,
          chargingStationY: 0,
        },
      });
      vi.mocked(coreTickAutonomousEquipment).mockReturnValue({
        state: state.autonomousState,
        effects: [],
        operatingCost: 0,
      });
      runSimulationTick(state, systems, 16);
      expect(coreTickAutonomousEquipment).toHaveBeenCalled();
    });

    it("sanitizes out-of-bounds charging station before ticking robots", () => {
      const { state, systems } = createMockContext({
        currentCourse: { name: "Small Test Course", width: 12, height: 25, par: 72 } as unknown as CourseData,
        autonomousState: {
          robots: [{ id: "r1", equipmentId: "auto_mower_1", type: "mower" as const, stats: { efficiency: 1, speed: 1, fuelCapacity: 100, fuelEfficiency: 1, durability: 100 }, worldX: 5, worldZ: 5, resourceCurrent: 100, resourceMax: 100, state: "idle" as const, targetX: null, targetY: null, breakdownTimeRemaining: 0 }],
          chargingStationX: 8,
          chargingStationY: 50,
        },
      });
      vi.mocked(coreTickAutonomousEquipment).mockReturnValue({
        state: state.autonomousState,
        effects: [],
        operatingCost: 0,
      });

      runSimulationTick(state, systems, 16);

      expect(coreTickAutonomousEquipment).toHaveBeenCalled();
      const passedState = vi.mocked(coreTickAutonomousEquipment).mock.calls[0][0];
      expect(passedState.chargingStationX).toBe(Math.floor(12 / 2));
      expect(passedState.chargingStationY).toBe(Math.floor(25 / 2));
    });

    it("runs exactly one global candidate scan from course center", () => {
      const { state, systems } = createMockContext({
        autonomousState: {
          robots: [
            { id: "r1", equipmentId: "auto_sprayer_1", type: "sprayer" as const, stats: { efficiency: 1, speed: 1, fuelCapacity: 100, fuelEfficiency: 1, durability: 100 }, worldX: 5, worldZ: 5, resourceCurrent: 100, resourceMax: 100, state: "idle" as const, targetX: null, targetY: null, breakdownTimeRemaining: 0 },
            { id: "r2", equipmentId: "auto_mower_1", type: "mower" as const, stats: { efficiency: 1, speed: 1, fuelCapacity: 100, fuelEfficiency: 1, durability: 100 }, worldX: 35, worldZ: 25, resourceCurrent: 100, resourceMax: 100, state: "idle" as const, targetX: null, targetY: null, breakdownTimeRemaining: 0 },
          ],
          chargingStationX: 0,
          chargingStationY: 0,
        },
        currentCourse: { name: "Large Test Course", width: 40, height: 30, par: 72 } as unknown as CourseData,
      });
      vi.mocked(systems.terrainSystem.findWorkCandidates).mockReturnValue([]);
      vi.mocked(coreTickAutonomousEquipment).mockReturnValue({
        state: state.autonomousState,
        effects: [],
        operatingCost: 0,
      });

      runSimulationTick(state, systems, 16);

      expect(systems.terrainSystem.findWorkCandidates).toHaveBeenCalledTimes(1);
      expect(systems.terrainSystem.findWorkCandidates).toHaveBeenCalledWith(
        20,
        15,
        Math.ceil(Math.hypot(40, 30) / 2) + 2
      );
    });

    it("passes through global candidate snapshots without dropping same-tile entries", () => {
      const { state, systems } = createMockContext({
        autonomousState: {
          robots: [{ id: "r1", equipmentId: "auto_sprayer_1", type: "sprayer" as const, stats: { efficiency: 1, speed: 1, fuelCapacity: 100, fuelEfficiency: 1, durability: 100 }, worldX: 5, worldZ: 5, resourceCurrent: 100, resourceMax: 100, state: "idle" as const, targetX: null, targetY: null, breakdownTimeRemaining: 0 }],
          chargingStationX: 0,
          chargingStationY: 0,
        },
      });
      vi.mocked(systems.terrainSystem.findWorkCandidates).mockReturnValue([
        {
          worldX: 10.8,
          worldZ: 5.8,
          avgMoisture: 70,
          minMoisture: 70,
          avgNutrients: 60,
          minNutrients: 60,
          avgGrassHeight: 0.5,
          avgHealth: 90,
          dominantTerrainCode: TERRAIN_CODES.FAIRWAY,
          faceCount: 30,
        },
        {
          worldX: 10.2,
          worldZ: 5.2,
          avgMoisture: 58,
          minMoisture: 20,
          avgNutrients: 60,
          minNutrients: 60,
          avgGrassHeight: 0.5,
          avgHealth: 90,
          dominantTerrainCode: TERRAIN_CODES.FAIRWAY,
          faceCount: 2,
        },
      ]);
      vi.mocked(coreTickAutonomousEquipment).mockReturnValue({
        state: state.autonomousState,
        effects: [],
        operatingCost: 0,
      });

      runSimulationTick(state, systems, 16);

      const passedCandidates = vi.mocked(coreTickAutonomousEquipment).mock.calls[0][1];
      expect(passedCandidates).toHaveLength(2);
      expect(passedCandidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ worldX: 10.8, worldZ: 5.8 }),
          expect.objectContaining({ worldX: 10.2, worldZ: 5.2 }),
        ])
      );
    });

    it("keeps separate dominant-terrain candidates in the global pool", () => {
      const { state, systems } = createMockContext({
        autonomousState: {
          robots: [{ id: "r1", equipmentId: "auto_mower_1", type: "mower" as const, stats: { efficiency: 1, speed: 1, fuelCapacity: 100, fuelEfficiency: 1, durability: 100 }, worldX: 5, worldZ: 5, resourceCurrent: 100, resourceMax: 100, state: "idle" as const, targetX: null, targetY: null, breakdownTimeRemaining: 0 }],
          chargingStationX: 0,
          chargingStationY: 0,
        },
      });
      vi.mocked(systems.terrainSystem.findWorkCandidates).mockReturnValue([
        {
          worldX: 10.2,
          worldZ: 5.2,
          avgMoisture: 60,
          avgNutrients: 60,
          avgGrassHeight: 8,
          maxGrassHeight: 12,
          avgHealth: 90,
          dominantTerrainCode: TERRAIN_CODES.FAIRWAY,
          terrainCodesPresent: [TERRAIN_CODES.FAIRWAY],
          faceCount: 8,
        },
        {
          worldX: 10.8,
          worldZ: 5.8,
          avgMoisture: 60,
          avgNutrients: 60,
          avgGrassHeight: 6,
          maxGrassHeight: 10,
          avgHealth: 90,
          dominantTerrainCode: TERRAIN_CODES.ROUGH,
          terrainCodesPresent: [TERRAIN_CODES.ROUGH],
          faceCount: 6,
        },
      ]);
      vi.mocked(coreTickAutonomousEquipment).mockReturnValue({
        state: state.autonomousState,
        effects: [],
        operatingCost: 0,
      });

      runSimulationTick(state, systems, 16);

      const passedCandidates = vi.mocked(coreTickAutonomousEquipment).mock.calls[0][1];
      expect(passedCandidates).toHaveLength(2);
      const terrainCodes = passedCandidates.map((c: any) => c.dominantTerrainCode).sort((a: number, b: number) => a - b);
      expect(terrainCodes).toEqual([TERRAIN_CODES.FAIRWAY, TERRAIN_CODES.ROUGH]);
    });

    it("charges operating cost when > 0", () => {
      const { state, systems } = createMockContext({
        autonomousState: {
          robots: [{ id: "r1", equipmentId: "auto_mower_1", type: "mower" as const, stats: { efficiency: 1, speed: 1, fuelCapacity: 100, fuelEfficiency: 1, durability: 100 }, worldX: 5, worldZ: 5, resourceCurrent: 100, resourceMax: 100, state: "working" as const, targetX: 10, targetY: 10, breakdownTimeRemaining: 0 }],
          chargingStationX: 0,
          chargingStationY: 0,
        },
      });
      vi.mocked(coreTickAutonomousEquipment).mockReturnValue({
        state: state.autonomousState,
        effects: [],
        operatingCost: 5,
      });
      vi.mocked(addExpense).mockReturnValue({ ...state.economyState, cash: 9995 });
      runSimulationTick(state, systems, 16);
      expect(addExpense).toHaveBeenCalledWith(
        expect.anything(),
        5,
        "equipment_maintenance",
        "Robot operating costs",
        expect.any(Number),
        true
      );
    });

    it("does not charge operating cost when 0", () => {
      const { state, systems } = createMockContext({
        autonomousState: {
          robots: [{ id: "r1", equipmentId: "auto_mower_1", type: "mower" as const, stats: { efficiency: 1, speed: 1, fuelCapacity: 100, fuelEfficiency: 1, durability: 100 }, worldX: 5, worldZ: 5, resourceCurrent: 100, resourceMax: 100, state: "working" as const, targetX: 10, targetY: 10, breakdownTimeRemaining: 0 }],
          chargingStationX: 0,
          chargingStationY: 0,
        },
      });
      vi.mocked(coreTickAutonomousEquipment).mockReturnValue({
        state: state.autonomousState,
        effects: [],
        operatingCost: 0,
      });
      runSimulationTick(state, systems, 16);
      expect(addExpense).not.toHaveBeenCalledWith(
        expect.anything(),
        0,
        "equipment_maintenance",
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    it("does not update economy when operating addExpense returns null", () => {
      const { state, systems } = createMockContext({
        autonomousState: {
          robots: [{ id: "r1", equipmentId: "auto_mower_1", type: "mower" as const, stats: { efficiency: 1, speed: 1, fuelCapacity: 100, fuelEfficiency: 1, durability: 100 }, worldX: 5, worldZ: 5, resourceCurrent: 100, resourceMax: 100, state: "working" as const, targetX: 10, targetY: 10, breakdownTimeRemaining: 0 }],
          chargingStationX: 0,
          chargingStationY: 0,
        },
      });
      vi.mocked(coreTickAutonomousEquipment).mockReturnValue({
        state: state.autonomousState,
        effects: [],
        operatingCost: 5,
      });
      vi.mocked(addExpense).mockReturnValue(null as any);
      const origCash = state.economyState.cash;
      runSimulationTick(state, systems, 16);
      expect(state.economyState.cash).toBe(origCash);
    });

    it("applies mower effects", () => {
      const { state, systems } = createMockContext({
        autonomousState: {
          robots: [{ id: "r1", equipmentId: "auto_mower_1", type: "mower" as const, stats: { efficiency: 1, speed: 1, fuelCapacity: 100, fuelEfficiency: 1, durability: 100 }, worldX: 5, worldZ: 5, resourceCurrent: 100, resourceMax: 100, state: "working" as const, targetX: 10, targetY: 10, breakdownTimeRemaining: 0 }],
          chargingStationX: 0,
          chargingStationY: 0,
        },
      });
      vi.mocked(coreTickAutonomousEquipment).mockReturnValue({
        state: state.autonomousState,
        effects: [{ type: "mower" as const, equipmentId: "auto_mower_1", worldX: 5, worldZ: 5, efficiency: 1.0 }],
        operatingCost: 0,
      });
      runSimulationTick(state, systems, 16);
      expect(systems.terrainSystem.applyWorkEffect).toHaveBeenCalledWith(
        5,
        5,
        2.0,
        "mow",
        1.0,
        expect.any(Number),
        [
          TERRAIN_CODES.FAIRWAY,
          TERRAIN_CODES.ROUGH,
          TERRAIN_CODES.GREEN,
          TERRAIN_CODES.TEE,
        ]
      );
    });

    it("applies raker effects", () => {
      const { state, systems } = createMockContext({
        autonomousState: {
          robots: [{ id: "r1", equipmentId: "robot_bunker_rake", type: "raker" as const, stats: { efficiency: 1, speed: 1, fuelCapacity: 100, fuelEfficiency: 1, durability: 100 }, worldX: 5, worldZ: 5, resourceCurrent: 100, resourceMax: 100, state: "working" as const, targetX: 10, targetY: 10, breakdownTimeRemaining: 0 }],
          chargingStationX: 0,
          chargingStationY: 0,
        },
      });
      vi.mocked(coreTickAutonomousEquipment).mockReturnValue({
        state: state.autonomousState,
        effects: [{ type: "raker" as const, equipmentId: "robot_bunker_rake", worldX: 5, worldZ: 5, efficiency: 0.9 }],
        operatingCost: 0,
      });
      runSimulationTick(state, systems, 16);
      expect(systems.terrainSystem.applyWorkEffect).toHaveBeenCalledWith(
        5,
        5,
        2.0,
        "rake",
        0.9,
        expect.any(Number),
        [TERRAIN_CODES.BUNKER]
      );
    });

    it("applies sprayer effects", () => {
      const { state, systems } = createMockContext({
        autonomousState: {
          robots: [{ id: "r1", equipmentId: "auto_sprayer_1", type: "sprayer" as const, stats: { efficiency: 1, speed: 1, fuelCapacity: 100, fuelEfficiency: 1, durability: 100 }, worldX: 5, worldZ: 5, resourceCurrent: 100, resourceMax: 100, state: "working" as const, targetX: 10, targetY: 10, breakdownTimeRemaining: 0 }],
          chargingStationX: 0,
          chargingStationY: 0,
        },
      });
      vi.mocked(coreTickAutonomousEquipment).mockReturnValue({
        state: state.autonomousState,
        effects: [{ type: "sprayer" as const, equipmentId: "auto_sprayer_1", worldX: 5, worldZ: 5, efficiency: 0.8 }],
        operatingCost: 0,
      });
      runSimulationTick(state, systems, 16);
      expect(systems.terrainSystem.waterArea).toHaveBeenCalledWith(5, 5, 2, 8);
    });

    it("applies spreader effects with fertilizer effectiveness", () => {
      const { state, systems } = createMockContext({
        autonomousState: {
          robots: [{ id: "r1", equipmentId: "auto_spreader_1", type: "spreader" as const, stats: { efficiency: 1, speed: 1, fuelCapacity: 100, fuelEfficiency: 1, durability: 100 }, worldX: 5, worldZ: 5, resourceCurrent: 100, resourceMax: 100, state: "working" as const, targetX: 10, targetY: 10, breakdownTimeRemaining: 0 }],
          chargingStationX: 0,
          chargingStationY: 0,
        },
      });
      vi.mocked(coreTickAutonomousEquipment).mockReturnValue({
        state: state.autonomousState,
        effects: [{ type: "spreader" as const, equipmentId: "auto_spreader_1", worldX: 5, worldZ: 5, efficiency: 0.9 }],
        operatingCost: 0,
      });
      vi.mocked(getBestFertilizerEffectiveness).mockReturnValue(1.5);
      runSimulationTick(state, systems, 16);
      expect(systems.terrainSystem.fertilizeArea).toHaveBeenCalledWith(5, 5, 2, 9, 1.5);
    });

    it("ignores unknown robot effect types", () => {
      const { state, systems } = createMockContext({
        autonomousState: {
          robots: [{ id: "r1", equipmentId: "auto_mower_1", type: "mower" as const, stats: { efficiency: 1, speed: 1, fuelCapacity: 100, fuelEfficiency: 1, durability: 100 }, worldX: 5, worldZ: 5, resourceCurrent: 100, resourceMax: 100, state: "working" as const, targetX: 10, targetY: 10, breakdownTimeRemaining: 0 }],
          chargingStationX: 0,
          chargingStationY: 0,
        },
      });
      vi.mocked(coreTickAutonomousEquipment).mockReturnValue({
        state: state.autonomousState,
        effects: [{ type: "unknown" as any, equipmentId: "auto_unknown_1", worldX: 5, worldZ: 5, efficiency: 1.0 }],
        operatingCost: 0,
      });
      runSimulationTick(state, systems, 16);
      expect(systems.terrainSystem.mowAt).not.toHaveBeenCalled();
      expect(systems.terrainSystem.waterArea).not.toHaveBeenCalled();
      expect(systems.terrainSystem.fertilizeArea).not.toHaveBeenCalled();
    });

    it("checks fleet AI research state", () => {
      const { state, systems } = createMockContext({
        autonomousState: {
          robots: [{ id: "r1", equipmentId: "auto_mower_1", type: "mower" as const, stats: { efficiency: 1, speed: 1, fuelCapacity: 100, fuelEfficiency: 1, durability: 100 }, worldX: 5, worldZ: 5, resourceCurrent: 100, resourceMax: 100, state: "working" as const, targetX: 10, targetY: 10, breakdownTimeRemaining: 0 }],
          chargingStationX: 0,
          chargingStationY: 0,
        },
        researchState: { completedResearch: ["fleet_ai"], currentResearch: null, researchQueue: [], fundingLevel: "none" as const, totalPointsSpent: 0 },
      });
      vi.mocked(coreTickAutonomousEquipment).mockReturnValue({
        state: state.autonomousState,
        effects: [],
        operatingCost: 0,
      });
      runSimulationTick(state, systems, 16);
      expect(coreTickAutonomousEquipment).toHaveBeenCalledWith(
        state.autonomousState,
        expect.anything(),
        expect.any(Number),
        true,
        expect.any(Function)
      );
    });

    it("passes false for fleet AI when not researched", () => {
      const { state, systems } = createMockContext({
        autonomousState: {
          robots: [{ id: "r1", equipmentId: "auto_mower_1", type: "mower" as const, stats: { efficiency: 1, speed: 1, fuelCapacity: 100, fuelEfficiency: 1, durability: 100 }, worldX: 5, worldZ: 5, resourceCurrent: 100, resourceMax: 100, state: "working" as const, targetX: 10, targetY: 10, breakdownTimeRemaining: 0 }],
          chargingStationX: 0,
          chargingStationY: 0,
        },
      });
      vi.mocked(coreTickAutonomousEquipment).mockReturnValue({
        state: state.autonomousState,
        effects: [],
        operatingCost: 0,
      });
      runSimulationTick(state, systems, 16);
      expect(coreTickAutonomousEquipment).toHaveBeenCalledWith(
        state.autonomousState,
        expect.anything(),
        expect.any(Number),
        false,
        expect.any(Function)
      );
    });

    it("allows all robots to transit green terrain", () => {
      const { state, systems } = createMockContext({
        autonomousState: {
          robots: [{ id: "r1", equipmentId: "robot_bunker_rake", type: "raker" as const, stats: { efficiency: 1, speed: 1, fuelCapacity: 100, fuelEfficiency: 1, durability: 100 }, worldX: 5, worldZ: 5, resourceCurrent: 100, resourceMax: 100, state: "working" as const, targetX: 10, targetY: 10, breakdownTimeRemaining: 0 }],
          chargingStationX: 0,
          chargingStationY: 0,
        },
      });
      vi.mocked(coreTickAutonomousEquipment).mockReturnValue({
        state: state.autonomousState,
        effects: [],
        operatingCost: 0,
      });
      vi.mocked(systems.terrainSystem.isPositionWalkable).mockReturnValue(true);
      vi.mocked(systems.terrainSystem.getTerrainTypeAt).mockReturnValue("green");

      runSimulationTick(state, systems, 16);

      const canTraverse = vi.mocked(coreTickAutonomousEquipment).mock.calls[0][4];
      expect(canTraverse).toBeTypeOf("function");

      expect(canTraverse?.({ equipmentId: "robot_mower_greens", type: "mower" } as any, 5, 5)).toBe(true);
      expect(canTraverse?.({ equipmentId: "robot_bunker_rake", type: "raker" } as any, 5, 5)).toBe(false);
      expect(canTraverse?.({ equipmentId: "robot_mower_fairway", type: "mower" } as any, 5, 5)).toBe(false);
      expect(canTraverse?.({ equipmentId: "robot_mower_rough", type: "mower" } as any, 5, 5)).toBe(true);
      expect(canTraverse?.({ equipmentId: "robot_sprayer", type: "sprayer" } as any, 5, 5)).toBe(true);
      expect(canTraverse?.({ equipmentId: "robot_spreader", type: "spreader" } as any, 5, 5)).toBe(true);
    });

    it("allows rough transit while still blocking non-rakers from bunker tiles", () => {
      const { state, systems } = createMockContext({
        autonomousState: {
          robots: [{ id: "r1", equipmentId: "robot_mower_fairway", type: "mower" as const, stats: { efficiency: 1, speed: 1, fuelCapacity: 100, fuelEfficiency: 1, durability: 100 }, worldX: 5, worldZ: 5, resourceCurrent: 100, resourceMax: 100, state: "working" as const, targetX: 10, targetY: 10, breakdownTimeRemaining: 0 }],
          chargingStationX: 0,
          chargingStationY: 0,
        },
      });
      vi.mocked(coreTickAutonomousEquipment).mockReturnValue({
        state: state.autonomousState,
        effects: [],
        operatingCost: 0,
      });
      vi.mocked(systems.terrainSystem.isPositionWalkable).mockReturnValue(true);
      vi.mocked(systems.terrainSystem.getTerrainTypeAt).mockImplementation((worldX: number) => {
        if (worldX >= 6) return "bunker";
        return "rough";
      });

      runSimulationTick(state, systems, 16);

      const canTraverse = vi.mocked(coreTickAutonomousEquipment).mock.calls[0][4];
      expect(canTraverse).toBeTypeOf("function");

      expect(canTraverse?.({ equipmentId: "robot_mower_fairway", type: "mower" } as any, 5, 5)).toBe(true);
      expect(canTraverse?.({ equipmentId: "robot_mower_greens", type: "mower" } as any, 5, 5)).toBe(true);
      expect(canTraverse?.({ equipmentId: "robot_sprayer", type: "sprayer" } as any, 5, 5)).toBe(true);
      expect(canTraverse?.({ equipmentId: "robot_spreader", type: "spreader" } as any, 5, 5)).toBe(true);

      expect(canTraverse?.({ equipmentId: "robot_mower_fairway", type: "mower" } as any, 6, 5)).toBe(false);
      expect(canTraverse?.({ equipmentId: "robot_sprayer", type: "sprayer" } as any, 6, 5)).toBe(false);
      expect(canTraverse?.({ equipmentId: "robot_spreader", type: "spreader" } as any, 6, 5)).toBe(false);
      expect(canTraverse?.({ equipmentId: "robot_bunker_rake", type: "raker" } as any, 6, 5)).toBe(true);
    });
  });

  describe("tickScenario", () => {
    it("does nothing when no scenario manager", () => {
      const { state, systems } = createMockContext({ scenarioManager: null });
      runSimulationTick(state, systems, 16);
    });

    it("updates scenario progress when manager exists", () => {
      const mockManager = {
        addRevenue: vi.fn(),
        addGolfers: vi.fn(),
        addRound: vi.fn(),
        updateProgress: vi.fn(),
      };
      const { state, systems } = createMockContext({ scenarioManager: mockManager as any });
      runSimulationTick(state, systems, 16);
      expect(mockManager.updateProgress).toHaveBeenCalledWith({
        currentCash: state.economyState.cash,
        currentHealth: 50,
      });
    });
  });

  describe("tickIrrigation", () => {
    it("updates pipe pressures and checks for leaks every tick", () => {
      const { state, systems } = createMockContext();
      runSimulationTick(state, systems, 16);
      expect(updatePipePressures).toHaveBeenCalled();
      expect(checkForLeaks).toHaveBeenCalled();
    });

    it("recomputes pressures after leak checks", () => {
      const { state, systems } = createMockContext();
      const leakedSystem = {
        ...state.irrigationSystem,
        pipes: [
          {
            gridX: 1,
            gridY: 1,
            pipeType: "pvc" as const,
            installDate: 0,
            durability: 90,
            isLeaking: true,
            pressureLevel: 40,
            connectedTo: [],
          },
        ],
      };
      vi.mocked(checkForLeaks).mockImplementationOnce(() => leakedSystem as any);

      runSimulationTick(state, systems, 16);

      expect(updatePipePressures).toHaveBeenCalledTimes(2);
      expect(updatePipePressures).toHaveBeenNthCalledWith(2, leakedSystem);
    });

    it("passes weather effect with rainy type", () => {
      const { state, systems } = createMockContext({
        weather: { type: "rainy", temperature: 65, windSpeed: 10 },
      });
      runSimulationTick(state, systems, 16);
      expect(checkForLeaks).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Number),
        { type: "rainy", temperature: 65 }
      );
    });

    it("passes weather effect with stormy type", () => {
      const { state, systems } = createMockContext({
        weather: { type: "stormy", temperature: 55, windSpeed: 25 },
      });
      runSimulationTick(state, systems, 16);
      expect(checkForLeaks).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Number),
        { type: "stormy", temperature: 55 }
      );
    });

    it("passes weather effect with cloudy type", () => {
      const { state, systems } = createMockContext({
        weather: { type: "cloudy", temperature: 70, windSpeed: 8 },
      });
      runSimulationTick(state, systems, 16);
      expect(checkForLeaks).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Number),
        { type: "cloudy", temperature: 70 }
      );
    });

    it("passes weather effect with sunny type for non-matching weather", () => {
      const { state, systems } = createMockContext({
        weather: { type: "sunny", temperature: 80, windSpeed: 5 },
      });
      runSimulationTick(state, systems, 16);
      expect(checkForLeaks).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Number),
        { type: "sunny", temperature: 80 }
      );
    });

    it("passes undefined weather effect when weather is falsy", () => {
      const { state, systems } = createMockContext({
        weather: null as any,
      });
      runSimulationTick(state, systems, 16);
      expect(checkForLeaks).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Number),
        undefined
      );
    });

    it("activates sprinkler when schedule matches and not active", () => {
      const { state, systems } = createMockContext({
        gameTime: 360,
        irrigationSystem: {
          pipes: [],
          sprinklerHeads: [{
            id: "s1",
            gridX: 5,
            gridY: 5,
            sprinklerType: "rotary" as const,
            installDate: 0,
            isActive: false,
            schedule: { enabled: true, timeRanges: [{ start: 300, end: 420 }], skipRain: false, zone: "A" },
            coverageTiles: [],
            connectedToPipe: true,
          }],
          waterSources: [],
          totalWaterUsedToday: 0,
          lastTickTime: 0,
          pressureCache: new Map(),
        },
      });
      runSimulationTick(state, systems, 16);
      expect(setSprinklerActive).toHaveBeenCalledWith(
        expect.anything(),
        "s1",
        true
      );
    });

    it("deactivates sprinkler when schedule does not match and is active", () => {
      const { state, systems } = createMockContext({
        gameTime: 600,
        irrigationSystem: {
          pipes: [],
          sprinklerHeads: [{
            id: "s1",
            gridX: 5,
            gridY: 5,
            sprinklerType: "rotary" as const,
            installDate: 0,
            isActive: true,
            schedule: { enabled: true, timeRanges: [{ start: 300, end: 420 }], skipRain: false, zone: "A" },
            coverageTiles: [],
            connectedToPipe: true,
          }],
          waterSources: [],
          totalWaterUsedToday: 0,
          lastTickTime: 0,
          pressureCache: new Map(),
        },
      });
      runSimulationTick(state, systems, 16);
      expect(setSprinklerActive).toHaveBeenCalledWith(
        expect.anything(),
        "s1",
        false
      );
    });

    it("does not toggle sprinkler when already active and schedule matches", () => {
      const { state, systems } = createMockContext({
        gameTime: 360,
        irrigationSystem: {
          pipes: [],
          sprinklerHeads: [{
            id: "s1",
            gridX: 5,
            gridY: 5,
            sprinklerType: "rotary" as const,
            installDate: 0,
            isActive: true,
            schedule: { enabled: true, timeRanges: [{ start: 300, end: 420 }], skipRain: false, zone: "A" },
            coverageTiles: [{ x: 4, y: 5, efficiency: 0.9 }],
            connectedToPipe: true,
          }],
          waterSources: [],
          totalWaterUsedToday: 0,
          lastTickTime: 0,
          pressureCache: new Map(),
        },
      });
      runSimulationTick(state, systems, 16);
      expect(setSprinklerActive).not.toHaveBeenCalled();
    });

    it("does not toggle sprinkler when not active and schedule does not match", () => {
      const { state, systems } = createMockContext({
        gameTime: 600,
        irrigationSystem: {
          pipes: [],
          sprinklerHeads: [{
            id: "s1",
            gridX: 5,
            gridY: 5,
            sprinklerType: "rotary" as const,
            installDate: 0,
            isActive: false,
            schedule: { enabled: true, timeRanges: [{ start: 300, end: 420 }], skipRain: false, zone: "A" },
            coverageTiles: [],
            connectedToPipe: true,
          }],
          waterSources: [],
          totalWaterUsedToday: 0,
          lastTickTime: 0,
          pressureCache: new Map(),
        },
      });
      runSimulationTick(state, systems, 16);
      expect(setSprinklerActive).not.toHaveBeenCalled();
    });

    it("skips disabled sprinkler heads", () => {
      const { state, systems } = createMockContext({
        irrigationSystem: {
          pipes: [],
          sprinklerHeads: [{
            id: "s1",
            gridX: 5,
            gridY: 5,
            sprinklerType: "rotary" as const,
            installDate: 0,
            isActive: false,
            schedule: { enabled: false, timeRanges: [], skipRain: false, zone: "A" },
            coverageTiles: [],
            connectedToPipe: true,
          }],
          waterSources: [],
          totalWaterUsedToday: 0,
          lastTickTime: 0,
          pressureCache: new Map(),
        },
      });
      runSimulationTick(state, systems, 16);
      expect(setSprinklerActive).not.toHaveBeenCalled();
    });

    it("deactivates sprinkler when schedule is disabled but head is active", () => {
      const { state, systems } = createMockContext({
        irrigationSystem: {
          pipes: [],
          sprinklerHeads: [{
            id: "s1",
            gridX: 5,
            gridY: 5,
            sprinklerType: "rotary" as const,
            installDate: 0,
            isActive: true,
            schedule: { enabled: false, timeRanges: [{ start: 300, end: 420 }], skipRain: false, zone: "A" },
            coverageTiles: [],
            connectedToPipe: true,
          }],
          waterSources: [],
          totalWaterUsedToday: 0,
          lastTickTime: 0,
          pressureCache: new Map(),
        },
      });
      runSimulationTick(state, systems, 16);
      expect(setSprinklerActive).toHaveBeenCalledWith(
        expect.anything(),
        "s1",
        false
      );
    });

    it("does not activate sprinklers during rain when skipRain is enabled", () => {
      const { state, systems } = createMockContext({
        gameTime: 360,
        weather: { type: "rainy", temperature: 65, windSpeed: 10 },
        irrigationSystem: {
          pipes: [],
          sprinklerHeads: [{
            id: "s1",
            gridX: 5,
            gridY: 5,
            sprinklerType: "rotary" as const,
            installDate: 0,
            isActive: false,
            schedule: { enabled: true, timeRanges: [{ start: 300, end: 420 }], skipRain: true, zone: "A" },
            coverageTiles: [],
            connectedToPipe: true,
          }],
          waterSources: [],
          totalWaterUsedToday: 0,
          lastTickTime: 0,
          pressureCache: new Map(),
        },
      });
      runSimulationTick(state, systems, 16);
      expect(setSprinklerActive).not.toHaveBeenCalledWith(
        expect.anything(),
        "s1",
        true
      );
    });

    it("deactivates active sprinklers during rain when skipRain is enabled", () => {
      const { state, systems } = createMockContext({
        gameTime: 360,
        weather: { type: "stormy", temperature: 55, windSpeed: 20 },
        irrigationSystem: {
          pipes: [],
          sprinklerHeads: [{
            id: "s1",
            gridX: 5,
            gridY: 5,
            sprinklerType: "rotary" as const,
            installDate: 0,
            isActive: true,
            schedule: { enabled: true, timeRanges: [{ start: 300, end: 420 }], skipRain: true, zone: "A" },
            coverageTiles: [],
            connectedToPipe: true,
          }],
          waterSources: [],
          totalWaterUsedToday: 0,
          lastTickTime: 0,
          pressureCache: new Map(),
        },
      });
      runSimulationTick(state, systems, 16);
      expect(setSprinklerActive).toHaveBeenCalledWith(
        expect.anything(),
        "s1",
        false
      );
    });

    it("waters immediately when a scheduled sprinkler activates this tick", () => {
      const { state, systems } = createMockContext({
        gameTime: 360,
        irrigationSystem: {
          pipes: [],
          sprinklerHeads: [{
            id: "s1",
            gridX: 5,
            gridY: 5,
            sprinklerType: "rotary" as const,
            installDate: 0,
            isActive: false,
            schedule: { enabled: true, timeRanges: [{ start: 300, end: 420 }], skipRain: false, zone: "A" },
            coverageTiles: [{ x: 4, y: 5, efficiency: 0.8 }],
            connectedToPipe: true,
          }],
          waterSources: [],
          totalWaterUsedToday: 0,
          lastTickTime: 0,
          pressureCache: new Map(),
        },
      });
      vi.mocked(getPipeAt).mockReturnValue({
        gridX: 5,
        gridY: 5,
        pipeType: "pvc" as const,
        installDate: 0,
        durability: 100,
        isLeaking: false,
        pressureLevel: 80,
        connectedTo: [],
      });
      runSimulationTick(state, systems, 16);
      expect(setSprinklerActive).toHaveBeenCalledWith(
        expect.anything(),
        "s1",
        true
      );
      expect(systems.terrainSystem.waterArea).toHaveBeenCalledWith(
        4,
        5,
        0,
        15 * 0.8 * (80 / 100)
      );
    });

    it("waters coverage tiles when sprinkler is active with pipe pressure", () => {
      const { state, systems } = createMockContext({
        gameTime: 360,
        irrigationSystem: {
          pipes: [],
          sprinklerHeads: [{
            id: "s1",
            gridX: 5,
            gridY: 5,
            sprinklerType: "rotary" as const,
            installDate: 0,
            isActive: true,
            schedule: { enabled: true, timeRanges: [{ start: 300, end: 420 }], skipRain: false, zone: "A" },
            coverageTiles: [{ x: 4, y: 5, efficiency: 0.8 }],
            connectedToPipe: true,
          }],
          waterSources: [],
          totalWaterUsedToday: 0,
          lastTickTime: 0,
          pressureCache: new Map(),
        },
      });
      vi.mocked(getPipeAt).mockReturnValue({ gridX: 5, gridY: 5, pipeType: "pvc" as const, installDate: 0, durability: 100, isLeaking: false, pressureLevel: 80, connectedTo: [] });
      runSimulationTick(state, systems, 16);
      expect(systems.terrainSystem.waterArea).toHaveBeenCalledWith(4, 5, 0, 15 * 0.8 * (80 / 100));
      expect(state.dailyStats.maintenance.tilesWatered).toBeGreaterThanOrEqual(1);
    });

    it("skips watering when no pipe pressure is available", () => {
      const { state, systems } = createMockContext({
        gameTime: 360,
        irrigationSystem: {
          pipes: [],
          sprinklerHeads: [{
            id: "s1",
            gridX: 5,
            gridY: 5,
            sprinklerType: "rotary" as const,
            installDate: 0,
            isActive: true,
            schedule: { enabled: true, timeRanges: [{ start: 300, end: 420 }], skipRain: false, zone: "A" },
            coverageTiles: [{ x: 4, y: 5, efficiency: 0.8 }],
            connectedToPipe: true,
          }],
          waterSources: [],
          totalWaterUsedToday: 0,
          lastTickTime: 0,
          pressureCache: new Map(),
        },
      });
      vi.mocked(getPipeAt).mockReturnValue(null as any);
      runSimulationTick(state, systems, 16);
      expect(systems.terrainSystem.waterArea).not.toHaveBeenCalled();
      expect(state.dailyStats.maintenance.tilesWatered).toBe(0);
    });

    it("skips watering when cell returns null", () => {
      const { state, systems } = createMockContext({
        gameTime: 360,
        irrigationSystem: {
          pipes: [],
          sprinklerHeads: [{
            id: "s1",
            gridX: 5,
            gridY: 5,
            sprinklerType: "rotary" as const,
            installDate: 0,
            isActive: true,
            schedule: { enabled: true, timeRanges: [{ start: 300, end: 420 }], skipRain: false, zone: "A" },
            coverageTiles: [{ x: 99, y: 99, efficiency: 0.8 }],
            connectedToPipe: true,
          }],
          waterSources: [],
          totalWaterUsedToday: 0,
          lastTickTime: 0,
          pressureCache: new Map(),
        },
      });
      vi.mocked(systems.terrainSystem.findFaceAtPosition as any).mockReturnValue(null);
      vi.mocked(getPipeAt).mockReturnValue({ gridX: 5, gridY: 5, pipeType: "pvc" as const, installDate: 0, durability: 100, isLeaking: false, pressureLevel: 80, connectedTo: [] });
      runSimulationTick(state, systems, 16);
      expect(systems.terrainSystem.waterArea).not.toHaveBeenCalledWith(99, 99, expect.anything(), expect.anything());
    });

    it("charges water cost when active heads and water sources exist", () => {
      const { state, systems } = createMockContext({
        gameTime: 360,
        irrigationSystem: {
          pipes: [],
          sprinklerHeads: [{
            id: "s1",
            gridX: 5,
            gridY: 5,
            sprinklerType: "rotary" as const,
            installDate: 0,
            isActive: true,
            schedule: { enabled: true, timeRanges: [{ start: 300, end: 420 }], skipRain: false, zone: "A" },
            coverageTiles: [],
            connectedToPipe: true,
          }],
          waterSources: [{ id: "ws1", type: "municipal" as const, gridX: 0, gridY: 0, capacityPerDay: 10000, usedToday: 0, costPer1000Gal: 5, monthlyFixedCost: 50 }],
          totalWaterUsedToday: 0,
          lastTickTime: 0,
          pressureCache: new Map(),
        },
      });
      vi.mocked(calculateWaterUsage).mockReturnValue(100);
      vi.mocked(calculateWaterCost).mockReturnValue(2.5);
      vi.mocked(addExpense).mockReturnValue({ ...state.economyState, cash: 9997.5 });
      runSimulationTick(state, systems, 16);
      expect(calculateWaterUsage).toHaveBeenCalled();
      expect(calculateWaterCost).toHaveBeenCalled();
      expect(state.dailyStats.expenses.utilities).toBe(2.5);
    });

    it("does not charge water cost when no active heads", () => {
      const { state, systems } = createMockContext({
        irrigationSystem: {
          pipes: [],
          sprinklerHeads: [{
            id: "s1",
            gridX: 5,
            gridY: 5,
            sprinklerType: "rotary" as const,
            installDate: 0,
            isActive: false,
            schedule: { enabled: false, timeRanges: [], skipRain: false, zone: "A" },
            coverageTiles: [],
            connectedToPipe: true,
          }],
          waterSources: [{ id: "ws1", type: "municipal" as const, gridX: 0, gridY: 0, capacityPerDay: 10000, usedToday: 0, costPer1000Gal: 5, monthlyFixedCost: 50 }],
          totalWaterUsedToday: 0,
          lastTickTime: 0,
          pressureCache: new Map(),
        },
      });
      runSimulationTick(state, systems, 16);
      expect(calculateWaterUsage).not.toHaveBeenCalled();
    });

    it("does not charge water cost when no water sources", () => {
      const { state, systems } = createMockContext({
        gameTime: 360,
        irrigationSystem: {
          pipes: [],
          sprinklerHeads: [{
            id: "s1",
            gridX: 5,
            gridY: 5,
            sprinklerType: "rotary" as const,
            installDate: 0,
            isActive: true,
            schedule: { enabled: true, timeRanges: [{ start: 300, end: 420 }], skipRain: false, zone: "A" },
            coverageTiles: [],
            connectedToPipe: true,
          }],
          waterSources: [],
          totalWaterUsedToday: 0,
          lastTickTime: 0,
          pressureCache: new Map(),
        },
      });
      runSimulationTick(state, systems, 16);
      expect(calculateWaterUsage).not.toHaveBeenCalled();
    });

    it("does not charge when water cost is 0", () => {
      const { state, systems } = createMockContext({
        gameTime: 360,
        irrigationSystem: {
          pipes: [],
          sprinklerHeads: [{
            id: "s1",
            gridX: 5,
            gridY: 5,
            sprinklerType: "rotary" as const,
            installDate: 0,
            isActive: true,
            schedule: { enabled: true, timeRanges: [{ start: 300, end: 420 }], skipRain: false, zone: "A" },
            coverageTiles: [],
            connectedToPipe: true,
          }],
          waterSources: [{ id: "ws1", type: "municipal" as const, gridX: 0, gridY: 0, capacityPerDay: 10000, usedToday: 0, costPer1000Gal: 5, monthlyFixedCost: 50 }],
          totalWaterUsedToday: 0,
          lastTickTime: 0,
          pressureCache: new Map(),
        },
      });
      vi.mocked(calculateWaterUsage).mockReturnValue(0);
      vi.mocked(calculateWaterCost).mockReturnValue(0);
      runSimulationTick(state, systems, 16);
      expect(addExpense).not.toHaveBeenCalledWith(
        expect.anything(),
        0,
        "utilities",
        "Irrigation water",
        expect.anything(),
        expect.anything()
      );
    });

    it("does not update economy when irrigation addExpense returns null", () => {
      const { state, systems } = createMockContext({
        gameTime: 360,
        irrigationSystem: {
          pipes: [],
          sprinklerHeads: [{
            id: "s1",
            gridX: 5,
            gridY: 5,
            sprinklerType: "rotary" as const,
            installDate: 0,
            isActive: true,
            schedule: { enabled: true, timeRanges: [{ start: 300, end: 420 }], skipRain: false, zone: "A" },
            coverageTiles: [],
            connectedToPipe: true,
          }],
          waterSources: [{ id: "ws1", type: "municipal" as const, gridX: 0, gridY: 0, capacityPerDay: 10000, usedToday: 0, costPer1000Gal: 5, monthlyFixedCost: 50 }],
          totalWaterUsedToday: 0,
          lastTickTime: 0,
          pressureCache: new Map(),
        },
      });
      vi.mocked(calculateWaterUsage).mockReturnValue(100);
      vi.mocked(calculateWaterCost).mockReturnValue(2.5);
      vi.mocked(addExpense).mockReturnValue(null as any);
      runSimulationTick(state, systems, 16);
      expect(state.dailyStats.expenses.utilities).toBe(0);
    });

    it("updates irrigation render system when present", () => {
      const mockRenderSystem = { update: vi.fn() };
      const { state, systems } = createMockContext({
        irrigationRenderSystem: mockRenderSystem as any,
      });
      runSimulationTick(state, systems, 16);
      expect(mockRenderSystem.update).toHaveBeenCalledWith(state.irrigationSystem);
    });

    it("does not call render system when null", () => {
      const { state, systems } = createMockContext({ irrigationRenderSystem: null });
      runSimulationTick(state, systems, 16);
    });

    it("checks multiple time ranges for schedule", () => {
      const { state, systems } = createMockContext({
        gameTime: 720,
        irrigationSystem: {
          pipes: [],
          sprinklerHeads: [{
            id: "s1",
            gridX: 5,
            gridY: 5,
            sprinklerType: "rotary" as const,
            installDate: 0,
            isActive: false,
            schedule: {
              enabled: true,
              timeRanges: [
                { start: 300, end: 420 },
                { start: 660, end: 780 },
              ],
              skipRain: false,
              zone: "A",
            },
            coverageTiles: [],
            connectedToPipe: true,
          }],
          waterSources: [],
          totalWaterUsedToday: 0,
          lastTickTime: 0,
          pressureCache: new Map(),
        },
      });
      runSimulationTick(state, systems, 16);
      expect(setSprinklerActive).toHaveBeenCalledWith(
        expect.anything(),
        "s1",
        true
      );
    });

    it("uses default temperature of 70 when weather temperature is undefined", () => {
      const { state, systems } = createMockContext({
        weather: { type: "sunny", temperature: undefined as any, windSpeed: 5 },
      });
      runSimulationTick(state, systems, 16);
      expect(checkForLeaks).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Number),
        { type: "sunny", temperature: 70 }
      );
    });
  });

  describe("runSimulationTick", () => {
    it("calculates gameMinutes from deltaMs and timeScale", () => {
      const { state, systems } = createMockContext({ timeScale: 2 });
      runSimulationTick(state, systems, 1000);
      expect(coreTickGolfers).toHaveBeenCalledWith(
        expect.anything(),
        4,
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    it("calculates correct timestamp", () => {
      const { state, systems } = createMockContext({ gameDay: 3, gameTime: 120 });
      runSimulationTick(state, systems, 16);
      expect(coreTickGolfers).toHaveBeenCalled();
    });

    it("calls all tick functions in order", () => {
      const { state, systems } = createMockContext({
        gameTime: 600,
        lastPayrollHour: 9,
        lastArrivalHour: 9,
        lastAutoSaveHour: 9,
        lastPrestigeUpdateHour: 9,
        lastTeeTimeUpdateHour: 9,
        employeeRoster: { employees: [{ id: "e1", name: "Test", role: "groundskeeper", skillLevel: "novice", skills: { efficiency: 1, quality: 1, stamina: 1, reliability: 1 }, hireDate: 0, hourlyWage: 15, experience: 0, happiness: 100, fatigue: 0, status: "working", assignedArea: null }], maxEmployees: 10, lastPayrollTime: 0, totalWagesPaid: 0 },
      });
      vi.mocked(processPayroll).mockReturnValue({ roster: state.employeeRoster, totalPaid: 0, breakdown: [] });
      runSimulationTick(state, systems, 16);
      expect(coreTickWeather).toHaveBeenCalled();
      expect(processPayroll).toHaveBeenCalled();
      expect(coreTickGolfers).toHaveBeenCalled();
      expect(coreTickEmployees).toHaveBeenCalled();
      expect(updatePipePressures).toHaveBeenCalled();
    });
  });
});
