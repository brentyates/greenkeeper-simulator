import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { GameAPI, GameSystems, GameState } from "./GameAPI";

vi.mock("../core/economy", async () => {
  const actual = await vi.importActual<typeof import("../core/economy")>("../core/economy");
  return {
    ...actual,
    addIncome: vi.fn((_state) => ({ cash: 1000, totalEarned: 100, totalSpent: 0, loans: [], transactions: [] })),
    addExpense: vi.fn((_state) => ({ cash: 900, totalEarned: 0, totalSpent: 100, loans: [], transactions: [] })),
    canAfford: vi.fn(() => true),
    takeLoan: vi.fn(() => ({ cash: 2000, totalEarned: 0, totalSpent: 0, loans: [], transactions: [] })),
    makeLoanPayment: vi.fn(() => ({ cash: 800, totalEarned: 0, totalSpent: 0, loans: [], transactions: [] })),
    payOffLoan: vi.fn(() => ({ cash: 500, totalEarned: 0, totalSpent: 0, loans: [], transactions: [] })),
    getTotalDebt: vi.fn(() => 5000),
    getNetWorth: vi.fn(() => 10000),
    getTransactionsInRange: vi.fn(() => [
      { id: "t1", amount: 50, category: "green_fees", description: "Test", timestamp: 100 },
    ]),
    calculateFinancialSummary: vi.fn(() => ({ totalIncome: 200, totalExpenses: 100, netProfit: 100 })),
    DEFAULT_LOAN_TERMS: actual.DEFAULT_LOAN_TERMS,
  };
});

vi.mock("../core/irrigation", async () => {
  const actual = await vi.importActual<typeof import("../core/irrigation")>("../core/irrigation");
  return {
    ...actual,
    addPipe: vi.fn(() => ({ pipes: [], sprinklerHeads: [], waterSources: [], totalWaterUsedToday: 0, lastTickTime: 0, pressureCache: new Map() })),
    removePipe: vi.fn(() => ({ pipes: [], sprinklerHeads: [], waterSources: [], totalWaterUsedToday: 0, lastTickTime: 0, pressureCache: new Map() })),
    addSprinklerHead: vi.fn(() => ({ pipes: [], sprinklerHeads: [], waterSources: [], totalWaterUsedToday: 0, lastTickTime: 0, pressureCache: new Map() })),
    removeSprinklerHead: vi.fn(() => ({ pipes: [], sprinklerHeads: [], waterSources: [], totalWaterUsedToday: 0, lastTickTime: 0, pressureCache: new Map() })),
    repairLeak: vi.fn(() => null),
    getSprinklerHeadAt: vi.fn(() => null),
    updateSprinklerSchedule: vi.fn(() => ({ pipes: [], sprinklerHeads: [], waterSources: [], totalWaterUsedToday: 0, lastTickTime: 0, pressureCache: new Map() })),
    PIPE_CONFIGS: { standard: { cost: 50 }, premium: { cost: 100 } },
    SPRINKLER_CONFIGS: { rotary: { cost: 80 }, popup: { cost: 60 } },
  };
});

vi.mock("../core/employees", async () => {
  const actual = await vi.importActual<typeof import("../core/employees")>("../core/employees");
  return {
    ...actual,
    hireEmployee: vi.fn(() => null),
    fireEmployee: vi.fn(() => null),
    createEmployee: vi.fn(() => ({
      id: "emp_1",
      name: "Test Employee",
      role: "groundskeeper",
      skillLevel: "novice",
      skills: { mowing: 1, watering: 1, fertilizing: 1, bunkerRaking: 1 },
      hireDate: 0,
      hourlyWage: 15,
      experience: 0,
      happiness: 80,
      fatigue: 0,
      status: "idle",
      assignedArea: null,
    })),
  };
});

vi.mock("../core/employee-work", () => ({
  syncWorkersWithRoster: vi.fn(() => ({ workers: [], areas: [], maintenanceShedX: 0, maintenanceShedY: 0 })),
  getWorkerPositions: vi.fn(() => [
    { employeeId: "emp_1", gridX: 5, gridY: 10, task: "mow_grass", worldX: 5.5, worldZ: 10.5 },
  ]),
}));

vi.mock("../core/golfers", () => ({
  getActiveGolferCount: vi.fn(() => 12),
  getAverageSatisfaction: vi.fn(() => 75),
}));

vi.mock("../core/research", async () => {
  const actual = await vi.importActual<typeof import("../core/research")>("../core/research");
  return {
    ...actual,
    startResearch: vi.fn(() => null),
    cancelResearch: vi.fn(() => ({ completedResearch: [], currentResearch: null, researchQueue: [], fundingLevel: "normal", totalPointsSpent: 0 })),
    setFundingLevel: vi.fn(() => ({ completedResearch: [], currentResearch: null, researchQueue: [], fundingLevel: "maximum", totalPointsSpent: 0 })),
    completeResearchInstantly: vi.fn(() => null),
    getAvailableResearch: vi.fn(() => []),
    getPrerequisiteChain: vi.fn(() => []),
    getResearchStatus: vi.fn(() => "available"),
    getResearchProgress: vi.fn(() => 0),
    RESEARCH_ITEMS: [
      { id: "item_a", prerequisites: [] },
      { id: "item_b", prerequisites: ["item_a"] },
      { id: "item_c", prerequisites: [] },
    ],
  };
});

vi.mock("../core/prestige", () => ({
  calculateCurrentConditionsFromFaces: vi.fn(() => 70),
  updatePrestigeScore: vi.fn(() => ({
    currentScore: 80,
    targetScore: 100,
    starRating: 3,
    tier: "silver",
    currentConditions: {},
    historicalExcellence: {},
    amenities: { clubhouse: 0, proShop: 0, dining: 0, facilities: {} },
    amenityScore: 10,
    reputation: {},
    reputationScore: 5,
    exclusivity: {},
    exclusivityScore: 3,
    greenFee: 50,
  })),
  upgradeAmenity: vi.fn(() => ({
    currentScore: 85,
    targetScore: 100,
    starRating: 3,
    tier: "silver",
    currentConditions: {},
    historicalExcellence: {},
    amenities: { clubhouse: 1, proShop: 0, dining: 0, facilities: {} },
    amenityScore: 15,
    reputation: {},
    reputationScore: 5,
    exclusivity: {},
    exclusivityScore: 3,
    greenFee: 50,
  })),
}));

vi.mock("../core/amenities", () => ({
  getUpgradeCost: vi.fn(() => 500),
  getAvailableUpgrades: vi.fn(() => [{ type: "clubhouse", tier: 1 }]),
  getUpgradeName: vi.fn(() => "Clubhouse Tier 1"),
}));

vi.mock("../core/tee-times", () => ({
  bookTeeTime: vi.fn(() => ({ changed: true })),
  checkInTeeTime: vi.fn(() => ({ checkedIn: true })),
  cancelTeeTime: vi.fn(() => ({ cancelled: true })),
}));

vi.mock("../core/walk-ons", () => ({
  getWalkOnSummary: vi.fn(() => ({ served: 5, turnedAway: 2, gaveUp: 1, averageWait: 10 })),
  getQueueLength: vi.fn(() => 3),
  getEstimatedWaitTime: vi.fn(() => 15),
  updateWalkOnPolicy: vi.fn(() => ({ policy: {}, queue: [], metrics: { walkOnsServedToday: 0, walkOnsTurnedAwayToday: 0, walkOnsGaveUpToday: 0, averageWaitTime: 0, totalWaitTime: 0, reputationPenalty: 0 } })),
  addWalkOnToQueue: vi.fn(() => ({ state: { policy: {}, queue: [], metrics: {} }, accepted: true })),
  createWalkOnGolfer: vi.fn(() => ({ id: "walkon_1", name: "Test Walker" })),
}));

vi.mock("../core/tee-revenue", () => ({
  getRevenueSummary: vi.fn(() => ({
    today: { greenFees: 100, cartFees: 50, proShop: 30, foodAndBeverage: 20, grossRevenue: 200, netRevenue: 150 },
    weeklyAverage: { grossRevenue: 1400 },
    monthlyAverage: { grossRevenue: 6000 },
  })),
  calculateGreenFee: vi.fn(() => 55),
  calculateCartFee: vi.fn(() => 20),
  calculateAverageRevenue: vi.fn(() => ({ grossRevenue: 180 })),
  isWeekend: vi.fn(() => false),
  isPrimeMorning: vi.fn(() => true),
  isTwilightHour: vi.fn(() => false),
}));

vi.mock("../core/marketing", () => ({
  startCampaign: vi.fn(() => null),
  stopCampaign: vi.fn(() => ({ activeCampaigns: [], campaignHistory: [], cooldowns: {}, metrics: { totalSpent: 0, totalRevenueGenerated: 0, campaignsRun: 0, averageRoi: 0 }, baselineBookingsPerDay: 20, baselineRevenuePerDay: 2000 })),
  canStartCampaign: vi.fn(() => ({ canStart: true })),
}));

vi.mock("../core/save-game", () => ({
  deleteSave: vi.fn(() => true),
  getSaveInfo: vi.fn(() => ({ savedAt: 1000, gameDay: 5 })),
  listSaves: vi.fn(() => [{ scenarioId: "s1", savedAt: 1000, gameDay: 5 }]),
}));

vi.mock("../core/autonomous-equipment", () => ({
  purchaseRobot: vi.fn(() => null),
  sellRobot: vi.fn(() => null),
  countWorkingRobots: vi.fn(() => 2),
  countBrokenRobots: vi.fn(() => 1),
  getAvailableRobotsToPurchase: vi.fn(() => []),
}));

vi.mock("../core/weather", () => ({
  getWeatherDescription: vi.fn(() => "Sunny and clear"),
  getWeatherImpactDescription: vi.fn(() => "No impact"),
  getSeasonFromDay: vi.fn(() => ({ season: "summer" })),
}));

vi.mock("../core/reputation", () => ({
  getReputationSummary: vi.fn(() => ({ starRating: 4, trend: "improving", returnRate: 0.6 })),
  calculateReputationScore: vi.fn(() => 85),
  trackGolferVisit: vi.fn(() => ({ totalReviews: 1 })),
  trackTurnAway: vi.fn(() => ({ totalTurnAways: 1 })),
}));

vi.mock("../core/movable-entity", () => ({
  teleportEntity: vi.fn((_entity, x, y) => ({
    id: "player",
    gridX: x,
    gridY: y,
    path: [],
    moveProgress: 0,
    entityType: "player",
    efficiency: 1,
    pendingDirection: null,
    equipmentSlot: 0,
    equipmentActive: false,
    worldX: x + 0.5,
    worldZ: y + 0.5,
  })),
}));

vi.mock("@babylonjs/core/Maths/math.vector", () => ({
  Vector3: class MockVector3 {
    x: number; y: number; z: number;
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  },
}));

vi.mock("@babylonjs/core/Maths/math.color", () => ({
  Color4: class MockColor4 {
    constructor(public r = 0, public g = 0, public b = 0, public a = 1) {}
  },
}));

import { addIncome, addExpense, canAfford, takeLoan, makeLoanPayment, payOffLoan } from "../core/economy";
import { repairLeak, getSprinklerHeadAt, removeSprinklerHead as removeSprinklerHeadFn } from "../core/irrigation";
import { hireEmployee, fireEmployee } from "../core/employees";
import { startResearch, completeResearchInstantly, getPrerequisiteChain, getAvailableResearch } from "../core/research";
import { getUpgradeCost } from "../core/amenities";
import { bookTeeTime } from "../core/tee-times";
import { addWalkOnToQueue } from "../core/walk-ons";
import { startCampaign, canStartCampaign } from "../core/marketing";
import { purchaseRobot, sellRobot, getAvailableRobotsToPurchase } from "../core/autonomous-equipment";
import { getRevenueSummary } from "../core/tee-revenue";

const mockGetRevenueSummary = getRevenueSummary as Mock;
const mockAddIncome = addIncome as Mock;
const mockAddExpense = addExpense as Mock;
const mockCanAfford = canAfford as Mock;
const mockTakeLoan = takeLoan as Mock;
const mockMakeLoanPayment = makeLoanPayment as Mock;
const mockPayOffLoan = payOffLoan as Mock;
const mockRepairLeak = repairLeak as Mock;
const mockGetSprinklerHeadAt = getSprinklerHeadAt as Mock;
const mockRemoveSprinklerHead = removeSprinklerHeadFn as Mock;
const mockHireEmployee = hireEmployee as Mock;
const mockFireEmployee = fireEmployee as Mock;
const mockStartResearch = startResearch as Mock;
const mockCompleteResearchInstantly = completeResearchInstantly as Mock;
const mockGetPrerequisiteChain = getPrerequisiteChain as Mock;
const mockGetAvailableResearch = getAvailableResearch as Mock;
const mockGetUpgradeCost = getUpgradeCost as Mock;
const mockBookTeeTime = bookTeeTime as Mock;
const mockAddWalkOnToQueue = addWalkOnToQueue as Mock;
const mockStartCampaign = startCampaign as Mock;
const mockCanStartCampaign = canStartCampaign as Mock;
const mockPurchaseRobot = purchaseRobot as Mock;
const mockSellRobot = sellRobot as Mock;
const mockGetAvailableRobotsToPurchase = getAvailableRobotsToPurchase as Mock;

function createMockState(): GameState {
  return {
    overlayAutoSwitched: false,
    isPaused: false,
    isMuted: false,
    gameTime: 480,
    gameDay: 3,
    timeScale: 2,
    score: 100,
    economyState: { cash: 5000, loans: [], transactions: [], totalEarned: 10000, totalSpent: 5000 },
    employeeRoster: {
      employees: [{
        id: "emp_1", name: "Test Worker", role: "groundskeeper", skillLevel: "novice",
        skills: { mowing: 1, watering: 1, fertilizing: 1, bunkerRaking: 1 },
        hireDate: 0, hourlyWage: 15, experience: 0, happiness: 80, fatigue: 0,
        status: "idle", assignedArea: null,
      }] as any,
      maxEmployees: 10, lastPayrollTime: 0, totalWagesPaid: 0,
    },
    employeeWorkState: {
      workers: [{ currentTask: "mow_grass" }, { currentTask: "idle" }] as any,
      areas: [], maintenanceShedX: 0, maintenanceShedY: 0,
    },
    applicationState: {
      applications: [{
        id: "app_1", name: "Applicant", role: "groundskeeper", skillLevel: "novice",
        skills: { mowing: 1, watering: 1, fertilizing: 1, bunkerRaking: 1 },
        hireDate: 0, hourlyWage: 12, experience: 0, happiness: 80, fatigue: 0,
        status: "idle", assignedArea: null,
      }] as any,
      lastApplicationTime: 0, nextApplicationTime: 1000,
      activeJobPostings: [{ id: "jp_1", role: "groundskeeper" }] as any,
      totalApplicationsReceived: 5,
    },
    golferPool: {
      golfers: [], dailyVisitors: 20, peakCapacity: 50,
      totalVisitorsToday: 15, totalRevenueToday: 1000, rating: { overall: 70 },
    } as any,
    researchState: {
      completedResearch: [] as string[], currentResearch: null,
      researchQueue: [] as string[], fundingLevel: "normal" as const, totalPointsSpent: 0,
    },
    scenarioManager: null,
    weatherState: {
      current: { type: "sunny" as const, temperature: 75, windSpeed: 5 },
      forecast: [], lastChangeTime: 0,
      seasonalModifier: { season: "summer" as const, baseTemperature: 80, temperatureVariance: 10, rainChance: 0.2, stormChance: 0.05 },
    },
    weather: { type: "sunny" as const, temperature: 75, windSpeed: 5 },
    greenFees: {
      weekday9Holes: 25, weekday18Holes: 45, weekend9Holes: 35,
      weekend18Holes: 60, twilight9Holes: 20, twilight18Holes: 35,
    },
    prestigeState: {
      currentScore: 70, targetScore: 100, starRating: 3, tier: "silver",
      currentConditions: {}, historicalExcellence: {},
      amenities: { clubhouse: 0, proShop: 0, dining: 0, facilities: {} },
      amenityScore: 10, reputation: {}, reputationScore: 5,
      exclusivity: {}, exclusivityScore: 3, greenFee: 50,
    } as any,
    teeTimeState: {
      spacingConfig: {}, operatingHours: {}, bookingConfig: {},
      teeTimes: new Map(), currentDay: 3,
      bookingMetrics: { totalBookingsToday: 10, cancellationsToday: 2, noShowsToday: 1, lateCancellationsToday: 0 },
    } as any,
    walkOnState: {
      policy: {}, queue: [{ id: "w1" }],
      metrics: { walkOnsServedToday: 5, walkOnsTurnedAwayToday: 2, walkOnsGaveUpToday: 1, averageWaitTime: 10, totalWaitTime: 50, reputationPenalty: 0 },
    } as any,
    revenueState: {
      greenFeeStructure: {}, cartFeeStructure: {}, availableAddOns: [], tipConfig: {},
      todaysRevenue: {
        greenFees: 100, cartFees: 50, proShop: 30, foodAndBeverage: 20,
        addOnServices: 0, tips: 0, rangeRevenue: 0, lessonRevenue: 0,
        eventFees: 0, grossRevenue: 200, operatingCosts: 50, netRevenue: 150,
      },
      revenueHistory: [],
    } as any,
    marketingState: {
      activeCampaigns: [
        { campaignId: "camp1", startDay: 1, plannedDuration: 7, elapsedDays: 3, status: "active", totalCostSoFar: 100, bookingsDuringCampaign: 5, revenueDuringCampaign: 500 },
      ],
      campaignHistory: [], cooldowns: {},
      metrics: { totalSpent: 200, totalRevenueGenerated: 600, campaignsRun: 1, averageRoi: 200 },
      baselineBookingsPerDay: 20, baselineRevenuePerDay: 2000,
    } as any,
    autonomousState: {
      robots: [
        { id: "r1", equipmentId: "eq1", type: "mower_bot", stats: {}, worldX: 3.2, worldZ: 4.8, resourceCurrent: 80, resourceMax: 100, state: "working", targetX: 5, targetY: null, breakdownTimeRemaining: 0 },
      ],
      chargingStationX: 0, chargingStationY: 0,
    } as any,
    reputationState: {
      totalReviews: 10, averageRating: 4.0, recentRating: 4.2, ratingTrend: "improving",
      returnGolferCount: 5, totalUniqueGolfers: 20, returnRate: 0.25,
      golfersThisMonth: 15, wordOfMouthMultiplier: 1.0,
      turnAwaysThisMonth: 3, totalTurnAways: 10, turnAwayPenalty: 0.1,
      categoryAverages: { conditions: 80, pace: 70, value: 75 },
    } as any,
    irrigationSystem: {
      pipes: [], sprinklerHeads: [], waterSources: [],
      totalWaterUsedToday: 0, lastTickTime: 0, pressureCache: new Map(),
    },
    currentCourse: { name: "Test Course", width: 20, height: 20, par: 72 } as any,
    currentScenario: null,
    dailyStats: {
      revenue: { greenFees: 0, tips: 0, addOns: 0, other: 0 },
      expenses: { wages: 0, supplies: 0, research: 0, utilities: 0, other: 0 },
      golfersServed: 0, totalSatisfaction: 0, courseHealthStart: 75, prestigeStart: 70,
      maintenance: { tasksCompleted: 0, tilesMowed: 0, tilesWatered: 0, tilesFertilized: 0 },
    },
    accumulatedResearchTime: 0,
    lastPayrollHour: -1,
    lastArrivalHour: -1,
    lastAutoSaveHour: -1,
    lastPrestigeUpdateHour: -1,
    lastTeeTimeUpdateHour: -1,
    shownTutorialHints: new Set(),
    gameOptions: {} as any,
  } as any;
}

function createMockSystems(): GameSystems {
  return {
    player: {
      id: "player", gridX: 5, gridY: 5, path: [], moveProgress: 0,
      entityType: "player" as const, efficiency: 1, pendingDirection: null,
      equipmentSlot: 0, equipmentActive: false, worldX: 5.5, worldZ: 5.5,
    },
    playerVisual: null,
    clickToMoveWaypoints: [],
    lastEquipmentFaceId: null,
    equipmentManager: {
      handleSlot: vi.fn(),
      getSelected: vi.fn(() => null),
      getState: vi.fn(() => undefined),
      setResource: vi.fn(),
      refill: vi.fn(() => 25),
      hasParticles: vi.fn(() => false),
    } as any,
    terrainSystem: {
      getOverlayMode: vi.fn(() => "normal"),
      setOverlayMode: vi.fn(),
      getElevationAt: vi.fn(() => 1.5),
      setElevationAt: vi.fn(),
      setAllFaceStates: vi.fn(),
      getTerrainTypeAt: vi.fn(() => "fairway"),
      setTerrainTypeAt: vi.fn(),
      findFaceAtPosition: vi.fn(() => 1),
      getFaceState: vi.fn(() => ({
        faceId: 1, terrainCode: 0, moisture: 60, nutrients: 50,
        grassHeight: 0.5, health: 80, lastMowed: 100, lastWatered: 200,
        lastFertilized: 300, lastRaked: 0,
      })),
      sampleFaceStatesInRadius: vi.fn(() => ({
        avgMoisture: 60, avgNutrients: 50, avgGrassHeight: 0.5, avgHealth: 80, count: 1,
      })),
      getCourseStats: vi.fn(() => ({ health: 75, moisture: 60, nutrients: 50, height: 0.5 })),
      getWorldDimensions: vi.fn(() => ({ width: 10, height: 10 })),
      update: vi.fn(),
      getAllFaceStates: vi.fn(() => new Map([[0, { terrainCode: 0, moisture: 50, nutrients: 50, grassHeight: 0.5, health: 80, lastMowed: 0, lastWatered: 0, lastFertilized: 0, lastRaked: 0 }]])),
    } as any,
    terrainEditorSystem: null,
    irrigationRenderSystem: null,
    uiManager: { updateOverlayLegend: vi.fn(), updateEconomy: vi.fn() } as any,
    babylonEngine: {
      start: vi.fn(), stop: vi.fn(),
      getScene: vi.fn(() => ({ clearColor: null })),
    } as any,
    teeSheetViewDay: 3,
    handleMove: vi.fn(),
    handleEmployeePanel: vi.fn(),
    handleResearchPanel: vi.fn(),
    handleTeeSheetPanel: vi.fn(),
    handleMarketingPanel: vi.fn(),
    handleOverlayCycle: vi.fn(),
    handleRefill: vi.fn(),
    handleMute: vi.fn(),
    isPlayerMoving: vi.fn(() => false),
    pauseGame: vi.fn(),
    resumeGame: vi.fn(),
    updateEconomySystems: vi.fn(),
    updateIrrigationVisibility: vi.fn(),
    updatePlayerPosition: vi.fn(),
    saveCurrentGame: vi.fn(),
    hasSavedGame: vi.fn(() => true),
  } as any;
}

describe("GameAPI", () => {
  let state: GameState;
  let sys: GameSystems;
  let api: GameAPI;

  beforeEach(() => {
    vi.clearAllMocks();
    state = createMockState();
    sys = createMockSystems();
    api = new GameAPI(state, sys);
  });

  describe("teleport", () => {
    it("teleports within bounds", () => {
      api.teleport(10, 10);
      expect(sys.clickToMoveWaypoints).toEqual([]);
      expect(sys.lastEquipmentFaceId).toBeNull();
      expect(sys.updatePlayerPosition).toHaveBeenCalled();
    });

    it("rejects x < 0", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      api.teleport(-1, 5);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("rejects x >= width", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      api.teleport(20, 5);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("rejects y < 0", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      api.teleport(5, -1);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("rejects y >= height", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      api.teleport(5, 20);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("updates playerVisual when present", () => {
      sys.playerVisual = { lastGridX: 0, lastGridY: 0, targetGridX: 0, targetGridY: 0, visualProgress: 0 } as any;
      api.teleport(3, 4);
      expect(sys.playerVisual!.lastGridX).toBe(3);
      expect(sys.playerVisual!.lastGridY).toBe(4);
      expect(sys.playerVisual!.targetGridX).toBe(3);
      expect(sys.playerVisual!.targetGridY).toBe(4);
      expect(sys.playerVisual!.visualProgress).toBe(1);
    });

    it("skips playerVisual update when null", () => {
      sys.playerVisual = null;
      api.teleport(3, 4);
      expect(sys.updatePlayerPosition).toHaveBeenCalled();
    });
  });

  describe("setRunning", () => {
    it("starts engine when true", () => {
      api.setRunning(true);
      expect(sys.babylonEngine.start).toHaveBeenCalled();
    });

    it("stops engine when false", () => {
      api.setRunning(false);
      expect(sys.babylonEngine.stop).toHaveBeenCalled();
    });
  });

  describe("getScenarioState", () => {
    it("returns null when no scenarioManager", () => {
      expect(api.getScenarioState()).toBeNull();
    });

    it("returns scenario state when scenarioManager exists", () => {
      state.scenarioManager = {
        checkObjective: vi.fn(() => ({ progress: 50, completed: false, failed: false, message: "Half done" })),
      } as any;
      const result = api.getScenarioState();
      expect(result).toEqual({ progress: 50, completed: false, failed: false, message: "Half done" });
    });
  });

  describe("getEconomyState", () => {
    it("returns cash, earned, spent", () => {
      expect(api.getEconomyState()).toEqual({ cash: 5000, earned: 10000, spent: 5000 });
    });
  });

  describe("getPrestigeState", () => {
    it("returns prestige fields", () => {
      expect(api.getPrestigeState()).toEqual({ score: 70, stars: 3, tier: "silver", amenityScore: 10 });
    });
  });

  describe("getGameDay", () => {
    it("returns game day", () => {
      expect(api.getGameDay()).toBe(3);
    });
  });

  describe("getTeeTimeStats", () => {
    it("returns stats with no tee times for today", () => {
      expect(api.getTeeTimeStats()).toEqual({ totalBookings: 10, cancellations: 2, noShows: 1, slotsAvailable: 0 });
    });

    it("counts available slots", () => {
      state.teeTimeState.teeTimes.set(3, [
        { id: "tt1", status: "available", scheduledTime: { hour: 8, minute: 0 } },
        { id: "tt2", status: "booked", scheduledTime: { hour: 9, minute: 0 } },
        { id: "tt3", status: "available", scheduledTime: { hour: 10, minute: 0 } },
      ] as any);
      expect(api.getTeeTimeStats().slotsAvailable).toBe(2);
    });
  });

  describe("getMarketingStats", () => {
    it("calculates ROI when totalSpent > 0", () => {
      const result = api.getMarketingStats();
      expect(result.activeCampaigns).toBe(1);
      expect(result.totalSpent).toBe(200);
      expect(result.totalROI).toBe(Math.round(((600 - 200) / 200) * 100));
    });

    it("returns 0 ROI when totalSpent is 0", () => {
      state.marketingState.metrics.totalSpent = 0;
      state.marketingState.metrics.totalRevenueGenerated = 0;
      expect(api.getMarketingStats().totalROI).toBe(0);
    });
  });

  describe("startMarketingCampaign", () => {
    it("returns false when canStartCampaign returns false", () => {
      mockCanStartCampaign.mockReturnValueOnce({ canStart: false });
      expect(api.startMarketingCampaign("camp1")).toBe(false);
    });

    it("returns false when startCampaign returns null", () => {
      mockStartCampaign.mockReturnValueOnce(null);
      expect(api.startMarketingCampaign("camp1")).toBe(false);
    });

    it("returns true and applies expense when cost > 0", () => {
      mockStartCampaign.mockReturnValueOnce({ state: state.marketingState, setupCost: 100 });
      expect(api.startMarketingCampaign("camp1", 14)).toBe(true);
    });

    it("returns true without expense when cost is 0", () => {
      mockStartCampaign.mockReturnValueOnce({ state: state.marketingState, setupCost: 0 });
      const callsBefore = mockAddExpense.mock.calls.length;
      expect(api.startMarketingCampaign("camp1")).toBe(true);
      expect(mockAddExpense.mock.calls.length).toBe(callsBefore);
    });

    it("handles addExpense returning null", () => {
      mockStartCampaign.mockReturnValueOnce({ state: state.marketingState, setupCost: 50 });
      mockAddExpense.mockReturnValueOnce(null);
      expect(api.startMarketingCampaign("camp1")).toBe(true);
    });
  });

  describe("getGameTime", () => {
    it("returns hours and minutes", () => {
      state.gameTime = 510;
      expect(api.getGameTime()).toEqual({ hours: 8, minutes: 30 });
    });
  });

  describe("setCash", () => {
    it("adds income when diff > 0", () => {
      api.setCash(6000);
      expect(mockAddIncome).toHaveBeenCalled();
      expect(sys.uiManager.updateEconomy).toHaveBeenCalled();
    });

    it("adds expense when diff < 0", () => {
      api.setCash(4000);
      expect(mockAddExpense).toHaveBeenCalled();
    });

    it("handles addExpense returning null when diff < 0", () => {
      mockAddExpense.mockReturnValueOnce(null);
      api.setCash(4000);
      expect(sys.uiManager.updateEconomy).toHaveBeenCalled();
    });

    it("does nothing when diff is 0", () => {
      const incomeBefore = mockAddIncome.mock.calls.length;
      const expenseBefore = mockAddExpense.mock.calls.length;
      api.setCash(5000);
      expect(mockAddIncome.mock.calls.length).toBe(incomeBefore);
      expect(mockAddExpense.mock.calls.length).toBe(expenseBefore);
      expect(sys.uiManager.updateEconomy).toHaveBeenCalled();
    });
  });

  describe("advanceDay", () => {
    it("increments gameDay and updates prestige", () => {
      api.advanceDay();
      expect(state.gameDay).toBe(4);
    });

    it("increments scenarioManager day when present", () => {
      state.scenarioManager = { incrementDay: vi.fn() } as any;
      api.advanceDay();
      expect(state.scenarioManager!.incrementDay).toHaveBeenCalled();
    });

    it("skips scenarioManager when null", () => {
      state.scenarioManager = null;
      api.advanceDay();
      expect(state.gameDay).toBe(4);
    });
  });

  describe("purchaseAmenity", () => {
    it("handles clubhouse_1", () => { expect(api.purchaseAmenity("clubhouse_1")).toBe(true); });
    it("handles pro_shop_1", () => { expect(api.purchaseAmenity("pro_shop_1")).toBe(true); });
    it("handles dining_1", () => { expect(api.purchaseAmenity("dining_1")).toBe(true); });
    it("handles facility_driving_range", () => { expect(api.purchaseAmenity("facility_driving_range")).toBe(true); });
    it("handles facility_putting_green", () => { expect(api.purchaseAmenity("facility_putting_green")).toBe(true); });
    it("returns false for unknown type", () => { expect(api.purchaseAmenity("unknown")).toBe(false); });

    it("returns false when not enough cash", () => {
      mockGetUpgradeCost.mockReturnValueOnce(999999);
      expect(api.purchaseAmenity("clubhouse_1")).toBe(false);
    });

    it("handles addExpense returning null", () => {
      mockAddExpense.mockReturnValueOnce(null);
      expect(api.purchaseAmenity("clubhouse_1")).toBe(true);
    });
  });

  describe("movePlayer", () => {
    it("maps up", () => { api.movePlayer("up"); expect(sys.handleMove).toHaveBeenCalledWith("up"); });
    it("maps w", () => { api.movePlayer("w"); expect(sys.handleMove).toHaveBeenCalledWith("up"); });
    it("maps down", () => { api.movePlayer("down"); expect(sys.handleMove).toHaveBeenCalledWith("down"); });
    it("maps s", () => { api.movePlayer("s"); expect(sys.handleMove).toHaveBeenCalledWith("down"); });
    it("maps left", () => { api.movePlayer("left"); expect(sys.handleMove).toHaveBeenCalledWith("left"); });
    it("maps a", () => { api.movePlayer("a"); expect(sys.handleMove).toHaveBeenCalledWith("left"); });
    it("maps right", () => { api.movePlayer("right"); expect(sys.handleMove).toHaveBeenCalledWith("right"); });
    it("maps d", () => { api.movePlayer("d"); expect(sys.handleMove).toHaveBeenCalledWith("right"); });
    it("ignores invalid direction", () => { api.movePlayer("x" as any); expect(sys.handleMove).not.toHaveBeenCalled(); });
  });

  describe("getPlayerPosition", () => {
    it("returns world position", () => { expect(api.getPlayerPosition()).toEqual({ x: 5.5, y: 5.5 }); });
  });

  describe("selectEquipment", () => {
    it("auto-switches to moisture overlay when sprinkler selected", () => {
      (sys.equipmentManager.getSelected as Mock).mockReturnValueOnce(null).mockReturnValueOnce("sprinkler");
      api.selectEquipment(2);
      expect(sys.terrainSystem.setOverlayMode).toHaveBeenCalledWith("moisture");
      expect(state.overlayAutoSwitched).toBe(true);
    });

    it("auto-switches to nutrients overlay when spreader selected", () => {
      (sys.equipmentManager.getSelected as Mock).mockReturnValueOnce(null).mockReturnValueOnce("spreader");
      api.selectEquipment(3);
      expect(sys.terrainSystem.setOverlayMode).toHaveBeenCalledWith("nutrients");
    });

    it("reverts overlay when mower selected and was auto-switched", () => {
      state.overlayAutoSwitched = true;
      (sys.equipmentManager.getSelected as Mock).mockReturnValueOnce("sprinkler").mockReturnValueOnce("mower");
      api.selectEquipment(1);
      expect(sys.terrainSystem.setOverlayMode).toHaveBeenCalledWith("normal");
      expect(state.overlayAutoSwitched).toBe(false);
    });

    it("does not revert overlay for mower when not auto-switched", () => {
      state.overlayAutoSwitched = false;
      (sys.equipmentManager.getSelected as Mock).mockReturnValueOnce(null).mockReturnValueOnce("mower");
      api.selectEquipment(1);
      expect(sys.terrainSystem.setOverlayMode).not.toHaveBeenCalled();
    });

    it("reverts overlay when deselected and was auto-switched", () => {
      state.overlayAutoSwitched = true;
      (sys.equipmentManager.getSelected as Mock).mockReturnValueOnce("sprinkler").mockReturnValueOnce(null);
      api.selectEquipment(2);
      expect(sys.terrainSystem.setOverlayMode).toHaveBeenCalledWith("normal");
      expect(state.overlayAutoSwitched).toBe(false);
    });

    it("does not revert overlay when deselected and was not auto-switched", () => {
      state.overlayAutoSwitched = false;
      (sys.equipmentManager.getSelected as Mock).mockReturnValueOnce("mower").mockReturnValueOnce(null);
      api.selectEquipment(1);
      expect(sys.terrainSystem.setOverlayMode).not.toHaveBeenCalled();
    });

    it("does not switch overlay when same tool reselected", () => {
      (sys.equipmentManager.getSelected as Mock).mockReturnValueOnce("sprinkler").mockReturnValueOnce("sprinkler");
      api.selectEquipment(2);
      expect(sys.terrainSystem.setOverlayMode).not.toHaveBeenCalled();
    });

    it("does not switch overlay when already on target mode", () => {
      (sys.equipmentManager.getSelected as Mock).mockReturnValueOnce(null).mockReturnValueOnce("sprinkler");
      (sys.terrainSystem.getOverlayMode as Mock).mockReturnValue("moisture");
      api.selectEquipment(2);
      expect(sys.terrainSystem.setOverlayMode).not.toHaveBeenCalled();
    });
  });

  describe("toggleEquipment", () => {
    it("does nothing when nothing selected", () => {
      (sys.equipmentManager.getSelected as Mock).mockReturnValue(null);
      api.toggleEquipment();
      expect(sys.equipmentManager.handleSlot).not.toHaveBeenCalled();
    });

    it("re-selects mower slot", () => {
      (sys.equipmentManager.getSelected as Mock).mockReturnValueOnce("mower").mockReturnValueOnce(null).mockReturnValueOnce(null);
      api.toggleEquipment();
      expect(sys.equipmentManager.handleSlot).toHaveBeenCalledWith(1);
    });

    it("re-selects sprinkler slot", () => {
      (sys.equipmentManager.getSelected as Mock).mockReturnValueOnce("sprinkler").mockReturnValueOnce(null).mockReturnValueOnce(null);
      api.toggleEquipment();
      expect(sys.equipmentManager.handleSlot).toHaveBeenCalledWith(2);
    });

    it("re-selects spreader slot", () => {
      (sys.equipmentManager.getSelected as Mock).mockReturnValueOnce("spreader").mockReturnValueOnce(null).mockReturnValueOnce(null);
      api.toggleEquipment();
      expect(sys.equipmentManager.handleSlot).toHaveBeenCalledWith(3);
    });
  });

  describe("getEquipmentState", () => {
    it("returns null for missing equipment states", () => {
      (sys.equipmentManager.getState as Mock).mockReturnValue(undefined);
      (sys.equipmentManager.getSelected as Mock).mockReturnValue(null);
      const result = api.getEquipmentState();
      expect(result.selectedSlot).toBeNull();
      expect(result.mower).toBeNull();
      expect(result.sprinkler).toBeNull();
      expect(result.spreader).toBeNull();
    });

    it("returns populated equipment states", () => {
      (sys.equipmentManager.getState as Mock).mockImplementation((type: string) => ({
        resourceCurrent: type === "mower" ? 100 : type === "sprinkler" ? 80 : 60,
        resourceMax: 100,
      }));
      (sys.equipmentManager.getSelected as Mock).mockReturnValue("mower");
      const result = api.getEquipmentState();
      expect(result.selectedSlot).toBe(0);
      expect(result.mower!.active).toBe(true);
      expect(result.sprinkler!.active).toBe(false);
    });

    it("maps sprinkler selected slot", () => {
      (sys.equipmentManager.getState as Mock).mockReturnValue({ resourceCurrent: 50, resourceMax: 100 });
      (sys.equipmentManager.getSelected as Mock).mockReturnValue("sprinkler");
      expect(api.getEquipmentState().selectedSlot).toBe(1);
    });

    it("maps spreader selected slot", () => {
      (sys.equipmentManager.getState as Mock).mockReturnValue({ resourceCurrent: 50, resourceMax: 100 });
      (sys.equipmentManager.getSelected as Mock).mockReturnValue("spreader");
      expect(api.getEquipmentState().selectedSlot).toBe(2);
    });
  });

  describe("setTerrainEditor", () => {
    it("does nothing when terrainEditorSystem is null", () => { api.setTerrainEditor(true); });

    it("enables editor", () => {
      sys.terrainEditorSystem = { enable: vi.fn(), disable: vi.fn() } as any;
      api.setTerrainEditor(true);
      expect(sys.terrainEditorSystem!.enable).toHaveBeenCalled();
    });

    it("disables editor", () => {
      sys.terrainEditorSystem = { enable: vi.fn(), disable: vi.fn() } as any;
      api.setTerrainEditor(false);
      expect(sys.terrainEditorSystem!.disable).toHaveBeenCalled();
    });
  });

  describe("isTerrainEditorEnabled", () => {
    it("returns false when terrainEditorSystem is null", () => { expect(api.isTerrainEditorEnabled()).toBe(false); });

    it("delegates to terrainEditorSystem", () => {
      sys.terrainEditorSystem = { isEnabled: vi.fn(() => true) } as any;
      expect(api.isTerrainEditorEnabled()).toBe(true);
    });
  });

  describe("setEditorTool", () => {
    it("does nothing when terrainEditorSystem is null", () => { api.setEditorTool("raise"); });

    it("sets valid tools", () => {
      const setTool = vi.fn();
      sys.terrainEditorSystem = { setTool } as any;
      for (const tool of ["raise", "lower", "flatten", "smooth", "terrain_fairway", "terrain_bunker", "terrain_water", "terrain_rough", "terrain_green", "terrain_tee"]) {
        api.setEditorTool(tool);
      }
      expect(setTool).toHaveBeenCalledTimes(10);
    });

    it("ignores invalid tool", () => {
      const setTool = vi.fn();
      sys.terrainEditorSystem = { setTool } as any;
      api.setEditorTool("invalid_tool");
      expect(setTool).not.toHaveBeenCalled();
    });
  });

  describe("setEditorBrushSize", () => {
    it("does nothing when terrainEditorSystem is null", () => { api.setEditorBrushSize(3); });

    it("delegates to terrainEditorSystem", () => {
      const setBrushSize = vi.fn();
      sys.terrainEditorSystem = { setBrushSize } as any;
      api.setEditorBrushSize(5);
      expect(setBrushSize).toHaveBeenCalledWith(5);
    });
  });

  describe("editTerrainAt", () => {
    it("does nothing when terrainEditorSystem is null", () => { api.editTerrainAt(5, 5); });

    it("does nothing when editor is disabled", () => {
      sys.terrainEditorSystem = { isEnabled: vi.fn(() => false), handleMouseMove: vi.fn(), handleClick: vi.fn() } as any;
      api.editTerrainAt(5, 5);
      expect(sys.terrainEditorSystem!.handleMouseMove).not.toHaveBeenCalled();
    });

    it("delegates when editor is enabled", () => {
      sys.terrainEditorSystem = { isEnabled: vi.fn(() => true), handleMouseMove: vi.fn(), handleClick: vi.fn() } as any;
      api.editTerrainAt(5, 5);
      expect(sys.terrainEditorSystem!.handleMouseMove).toHaveBeenCalled();
      expect(sys.terrainEditorSystem!.handleClick).toHaveBeenCalledWith(5, 5);
    });
  });

  describe("dragTerrainStart", () => {
    it("does nothing when terrainEditorSystem is null", () => { api.dragTerrainStart(5, 5); });

    it("does nothing when editor is disabled", () => {
      sys.terrainEditorSystem = { isEnabled: vi.fn(() => false), handleMouseMove: vi.fn(), handleDragStart: vi.fn() } as any;
      api.dragTerrainStart(5, 5);
      expect(sys.terrainEditorSystem!.handleMouseMove).not.toHaveBeenCalled();
    });

    it("delegates when editor is enabled", () => {
      sys.terrainEditorSystem = { isEnabled: vi.fn(() => true), handleMouseMove: vi.fn(), handleDragStart: vi.fn() } as any;
      api.dragTerrainStart(5, 5);
      expect(sys.terrainEditorSystem!.handleMouseMove).toHaveBeenCalledWith(5, 5);
      expect(sys.terrainEditorSystem!.handleDragStart).toHaveBeenCalledWith(5, 5);
    });
  });

  describe("dragTerrainMove", () => {
    it("does nothing when terrainEditorSystem is null", () => { api.dragTerrainMove(5, 5); });

    it("does nothing when editor is disabled", () => {
      sys.terrainEditorSystem = { isEnabled: vi.fn(() => false), handleMouseMove: vi.fn(), handleDrag: vi.fn() } as any;
      api.dragTerrainMove(5, 5);
      expect(sys.terrainEditorSystem!.handleMouseMove).not.toHaveBeenCalled();
    });

    it("delegates when editor is enabled", () => {
      sys.terrainEditorSystem = { isEnabled: vi.fn(() => true), handleMouseMove: vi.fn(), handleDrag: vi.fn() } as any;
      api.dragTerrainMove(5, 5);
      expect(sys.terrainEditorSystem!.handleMouseMove).toHaveBeenCalledWith(5, 5);
      expect(sys.terrainEditorSystem!.handleDrag).toHaveBeenCalledWith(5, 5);
    });
  });

  describe("dragTerrainEnd", () => {
    it("does nothing when terrainEditorSystem is null", () => { api.dragTerrainEnd(); });

    it("delegates when terrainEditorSystem exists", () => {
      sys.terrainEditorSystem = { handleDragEnd: vi.fn() } as any;
      api.dragTerrainEnd();
      expect(sys.terrainEditorSystem!.handleDragEnd).toHaveBeenCalled();
    });
  });

  describe("terrain passthrough methods", () => {
    it("getElevationAt delegates", () => { expect(api.getElevationAt(1, 2)).toBe(1.5); });
    it("setElevationAt delegates", () => { api.setElevationAt(1, 2, 3.0); expect(sys.terrainSystem.setElevationAt).toHaveBeenCalledWith(1, 2, 3.0); });
    it("setAllCellsState delegates to setAllFaceStates", () => { api.setAllCellsState({ moisture: 80 }); expect(sys.terrainSystem.setAllFaceStates).toHaveBeenCalledWith({ moisture: 80, grassHeight: undefined, nutrients: undefined, health: undefined }); });
    it("setAllFaceStates delegates", () => { api.setAllFaceStates({ moisture: 80 }); expect(sys.terrainSystem.setAllFaceStates).toHaveBeenCalledWith({ moisture: 80 }); });
    it("getTerrainTypeAt delegates", () => { expect(api.getTerrainTypeAt(1, 2)).toBe("fairway"); });
    it("setTerrainTypeAt delegates", () => { api.setTerrainTypeAt(1, 2, "bunker"); expect(sys.terrainSystem.setTerrainTypeAt).toHaveBeenCalledWith(1, 2, "bunker"); });
    it("getOverlayMode delegates", () => { expect(api.getOverlayMode()).toBe("normal"); });
    it("getCourseStats delegates", () => { expect(api.getCourseStats().health).toBe(75); });
    it("getTerrainDimensions delegates", () => { expect(api.getTerrainDimensions()).toEqual({ width: 10, height: 10 }); });
  });

  describe("setOverlayMode", () => {
    it("sets irrigation mode with different background", () => {
      api.setOverlayMode("irrigation");
      expect(sys.terrainSystem.setOverlayMode).toHaveBeenCalledWith("irrigation");
      expect(sys.uiManager.updateOverlayLegend).toHaveBeenCalledWith("irrigation");
      expect(state.overlayAutoSwitched).toBe(false);
      expect(sys.updateIrrigationVisibility).toHaveBeenCalled();
    });

    it("sets non-irrigation mode", () => {
      api.setOverlayMode("normal");
      expect(sys.terrainSystem.setOverlayMode).toHaveBeenCalledWith("normal");
    });

    it("shows irrigation render system when irrigation", () => {
      sys.irrigationRenderSystem = { setVisible: vi.fn(), update: vi.fn() } as any;
      api.setOverlayMode("irrigation");
      expect(sys.irrigationRenderSystem!.setVisible).toHaveBeenCalledWith(true);
    });

    it("hides irrigation render system when not irrigation", () => {
      sys.irrigationRenderSystem = { setVisible: vi.fn(), update: vi.fn() } as any;
      api.setOverlayMode("moisture");
      expect(sys.irrigationRenderSystem!.setVisible).toHaveBeenCalledWith(false);
    });

    it("handles null irrigationRenderSystem", () => {
      sys.irrigationRenderSystem = null;
      api.setOverlayMode("irrigation");
      expect(sys.uiManager.updateOverlayLegend).toHaveBeenCalledWith("irrigation");
    });
  });

  describe("waitForPlayerIdle", () => {
    it("resolves immediately when not moving", async () => {
      (sys.isPlayerMoving as Mock).mockReturnValue(false);
      await api.waitForPlayerIdle();
    });

    it("waits and resolves when player stops", async () => {
      let callCount = 0;
      (sys.isPlayerMoving as Mock).mockImplementation(() => { callCount++; return callCount < 3; });
      await api.waitForPlayerIdle();
      expect(callCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe("panel toggles and simple delegations", () => {
    it("toggleEmployeePanel", () => { api.toggleEmployeePanel(); expect(sys.handleEmployeePanel).toHaveBeenCalled(); });
    it("toggleResearchPanel", () => { api.toggleResearchPanel(); expect(sys.handleResearchPanel).toHaveBeenCalled(); });
    it("toggleTeeSheetPanel", () => { api.toggleTeeSheetPanel(); expect(sys.handleTeeSheetPanel).toHaveBeenCalled(); });
    it("toggleMarketingPanel", () => { api.toggleMarketingPanel(); expect(sys.handleMarketingPanel).toHaveBeenCalled(); });
    it("cycleOverlay", () => { api.cycleOverlay(); expect(sys.handleOverlayCycle).toHaveBeenCalled(); });
    it("refillEquipment", () => { api.refillEquipment(); expect(sys.handleRefill).toHaveBeenCalled(); });
    it("toggleMute", () => { api.toggleMute(); expect(sys.handleMute).toHaveBeenCalled(); });
    it("hasActiveParticles", () => { expect(api.hasActiveParticles()).toBe(false); });
    it("setEquipmentResource", () => { api.setEquipmentResource("mower", 50); expect(sys.equipmentManager.setResource).toHaveBeenCalledWith("mower", 50); });
    it("getResearchState", () => { expect(api.getResearchState()).toBe(state.researchState); });
    it("getIrrigationSystem", () => { expect(api.getIrrigationSystem()).toBe(state.irrigationSystem); });
    it("saveCurrentGame", () => { api.saveCurrentGame(); expect(sys.saveCurrentGame).toHaveBeenCalled(); });
    it("hasSavedGame", () => { expect(api.hasSavedGame()).toBe(true); });
  });

  describe("getEmployeeState", () => {
    it("returns employee state", () => {
      const result = api.getEmployeeState();
      expect(result.count).toBe(1);
      expect(result.maxEmployees).toBe(10);
      expect(result.totalHourlyWages).toBe(15);
    });
  });

  describe("getApplicationState", () => {
    it("returns application state", () => {
      const result = api.getApplicationState();
      expect(result.applications).toHaveLength(1);
      expect(result.nextApplicationTime).toBe(1000);
      expect(result.activeJobPostings).toBe(1);
      expect(result.totalReceived).toBe(5);
    });
  });

  describe("getFullGameState", () => {
    it("returns complete game state", () => {
      (sys.equipmentManager.getState as Mock).mockReturnValue(undefined);
      (sys.equipmentManager.getSelected as Mock).mockReturnValue(null);
      const result = api.getFullGameState();
      expect(result.player).toEqual({ x: 5.5, y: 5.5, isMoving: false });
      expect(result.terrain).toEqual({ width: 10, height: 10 });
      expect(result.editorEnabled).toBe(false);
    });

    it("handles zero dimensions", () => {
      (sys.terrainSystem.getWorldDimensions as Mock).mockReturnValue({ width: 0, height: 0 });
      (sys.equipmentManager.getState as Mock).mockReturnValue(undefined);
      (sys.equipmentManager.getSelected as Mock).mockReturnValue(null);
      expect(api.getFullGameState().terrain.width).toBe(0);
    });
  });

  describe("placePipe", () => {
    it("places pipe and deducts cost", () => { expect(api.placePipe(5, 5, "standard" as any)).toBe(true); });

    it("returns false when cannot afford", () => {
      mockCanAfford.mockReturnValueOnce(false);
      expect(api.placePipe(5, 5, "standard" as any)).toBe(false);
    });

    it("handles addExpense returning null", () => {
      mockAddExpense.mockReturnValueOnce(null);
      expect(api.placePipe(5, 5, "standard" as any)).toBe(true);
    });

    it("updates irrigationRenderSystem when present", () => {
      sys.irrigationRenderSystem = { update: vi.fn(), setVisible: vi.fn() } as any;
      api.placePipe(5, 5, "standard" as any);
      expect(sys.irrigationRenderSystem!.update).toHaveBeenCalled();
    });

    it("skips irrigationRenderSystem when null", () => {
      sys.irrigationRenderSystem = null;
      api.placePipe(5, 5, "standard" as any);
    });
  });

  describe("removePipe", () => {
    it("removes pipe", () => { api.removePipe(5, 5); });

    it("updates irrigationRenderSystem when present", () => {
      sys.irrigationRenderSystem = { update: vi.fn(), setVisible: vi.fn() } as any;
      api.removePipe(5, 5);
      expect(sys.irrigationRenderSystem!.update).toHaveBeenCalled();
    });

    it("skips irrigationRenderSystem when null", () => { sys.irrigationRenderSystem = null; api.removePipe(5, 5); });
  });

  describe("placeSprinklerHead", () => {
    it("places sprinkler", () => { expect(api.placeSprinklerHead(5, 5, "rotary" as any)).toBe(true); });

    it("returns false when cannot afford", () => {
      mockCanAfford.mockReturnValueOnce(false);
      expect(api.placeSprinklerHead(5, 5, "rotary" as any)).toBe(false);
    });

    it("handles addExpense returning null", () => {
      mockAddExpense.mockReturnValueOnce(null);
      expect(api.placeSprinklerHead(5, 5, "rotary" as any)).toBe(true);
    });

    it("updates irrigationRenderSystem when present", () => {
      sys.irrigationRenderSystem = { update: vi.fn(), setVisible: vi.fn() } as any;
      api.placeSprinklerHead(5, 5, "rotary" as any);
      expect(sys.irrigationRenderSystem!.update).toHaveBeenCalled();
    });

    it("skips irrigationRenderSystem when null", () => { sys.irrigationRenderSystem = null; api.placeSprinklerHead(5, 5, "rotary" as any); });
  });

  describe("removeSprinklerHead", () => {
    it("does nothing when no head found", () => { api.removeSprinklerHead(5, 5); });

    it("removes head when found", () => {
      mockGetSprinklerHeadAt.mockReturnValueOnce({ id: "sh_1" });
      api.removeSprinklerHead(5, 5);
      expect(mockRemoveSprinklerHead).toHaveBeenCalled();
    });

    it("updates irrigationRenderSystem when removing head", () => {
      mockGetSprinklerHeadAt.mockReturnValueOnce({ id: "sh_1" });
      sys.irrigationRenderSystem = { update: vi.fn(), setVisible: vi.fn() } as any;
      api.removeSprinklerHead(5, 5);
      expect(sys.irrigationRenderSystem!.update).toHaveBeenCalled();
    });

    it("skips irrigationRenderSystem when null and removing head", () => {
      mockGetSprinklerHeadAt.mockReturnValueOnce({ id: "sh_1" });
      sys.irrigationRenderSystem = null;
      api.removeSprinklerHead(5, 5);
    });
  });

  describe("repairLeak", () => {
    it("returns false when cannot afford", () => {
      mockCanAfford.mockReturnValueOnce(false);
      expect(api.repairLeak(5, 5)).toBe(false);
    });

    it("returns false when repairLeak returns null", () => { expect(api.repairLeak(5, 5)).toBe(false); });

    it("returns true when repair succeeds", () => {
      mockRepairLeak.mockReturnValueOnce({ pipes: [], sprinklerHeads: [], waterSources: [], totalWaterUsedToday: 0, lastTickTime: 0, pressureCache: new Map() });
      expect(api.repairLeak(5, 5)).toBe(true);
    });

    it("handles addExpense returning null on repair", () => {
      mockRepairLeak.mockReturnValueOnce({ pipes: [], sprinklerHeads: [], waterSources: [], totalWaterUsedToday: 0, lastTickTime: 0, pressureCache: new Map() });
      mockAddExpense.mockReturnValueOnce(null);
      expect(api.repairLeak(5, 5)).toBe(true);
    });

    it("updates irrigationRenderSystem on repair", () => {
      mockRepairLeak.mockReturnValueOnce({ pipes: [], sprinklerHeads: [], waterSources: [], totalWaterUsedToday: 0, lastTickTime: 0, pressureCache: new Map() });
      sys.irrigationRenderSystem = { update: vi.fn(), setVisible: vi.fn() } as any;
      api.repairLeak(5, 5);
      expect(sys.irrigationRenderSystem!.update).toHaveBeenCalled();
    });

    it("skips irrigationRenderSystem when null on repair", () => {
      mockRepairLeak.mockReturnValueOnce({ pipes: [], sprinklerHeads: [], waterSources: [], totalWaterUsedToday: 0, lastTickTime: 0, pressureCache: new Map() });
      sys.irrigationRenderSystem = null;
      api.repairLeak(5, 5);
    });
  });

  describe("setIrrigationSchedule", () => {
    it("delegates", () => { api.setIrrigationSchedule("sh_1", {} as any); });
  });

  describe("getTerrainAt", () => {
    it("returns cell data", () => { expect(api.getTerrainAt(1, 2)!.type).toBe("fairway"); });
    it("returns null for missing terrain type", () => { (sys.terrainSystem.getTerrainTypeAt as Mock).mockReturnValueOnce(null); expect(api.getTerrainAt(99, 99)).toBeNull(); });
  });

  describe("getTerrainCellData", () => {
    it("returns cell data", () => { expect(api.getTerrainCellData(1, 2)!.type).toBe("fairway"); });
    it("returns null for missing terrain type", () => { (sys.terrainSystem.getTerrainTypeAt as Mock).mockReturnValueOnce(null); expect(api.getTerrainCellData(99, 99)).toBeNull(); });
  });

  describe("advanceTimeByMinutes", () => {
    it("advances time without day rollover", () => {
      state.gameTime = 100;
      state.timeScale = 1;
      api.advanceTimeByMinutes(1);
      expect(state.gameDay).toBe(3);
      expect(sys.terrainSystem.update).toHaveBeenCalled();
      expect(sys.updateEconomySystems).toHaveBeenCalled();
    });

    it("handles day rollover", () => {
      state.gameTime = 1430;
      state.timeScale = 1;
      api.advanceTimeByMinutes(60);
      expect(state.gameDay).toBe(4);
    });
  });

  describe("research methods", () => {
    it("startResearchItem returns false when null", () => { expect(api.startResearchItem("item_a")).toBe(false); });

    it("startResearchItem returns true on success", () => {
      mockStartResearch.mockReturnValueOnce({ completedResearch: [], currentResearch: { itemId: "item_a" }, researchQueue: [], fundingLevel: "normal", totalPointsSpent: 0 });
      expect(api.startResearchItem("item_a")).toBe(true);
    });

    it("cancelCurrentResearch delegates", () => { api.cancelCurrentResearch(); });
    it("setResearchFunding delegates", () => { api.setResearchFunding("maximum" as any); });

    it("queueResearch adds to queue", () => {
      api.queueResearch("item_b");
      expect(state.researchState.researchQueue).toContain("item_b");
    });

    it("isResearchCompleted returns false", () => { expect(api.isResearchCompleted("item_a")).toBe(false); });

    it("isResearchCompleted returns true", () => {
      state.researchState = { ...state.researchState, completedResearch: ["item_a"] };
      expect(api.isResearchCompleted("item_a")).toBe(true);
    });

    it("getAvailableResearch returns items with met prerequisites", () => {
      const result = api.getAvailableResearch();
      expect(result).toContain("item_a");
      expect(result).toContain("item_c");
      expect(result).not.toContain("item_b");
    });

    it("getAvailableResearch excludes completed", () => {
      state.researchState = { ...state.researchState, completedResearch: ["item_a"] };
      const result = api.getAvailableResearch();
      expect(result).not.toContain("item_a");
      expect(result).toContain("item_b");
    });
  });

  describe("hireEmployee", () => {
    it("returns false for negative index", () => { expect(api.hireEmployee(-1)).toBe(false); });
    it("returns false for out of range index", () => { expect(api.hireEmployee(99)).toBe(false); });
    it("returns false when core fn returns null", () => { expect(api.hireEmployee(0)).toBe(false); });

    it("returns true on success", () => {
      mockHireEmployee.mockReturnValueOnce({ employees: [...state.employeeRoster.employees], maxEmployees: 10, lastPayrollTime: 0, totalWagesPaid: 0 });
      expect(api.hireEmployee(0)).toBe(true);
    });
  });

  describe("fireEmployee", () => {
    it("returns false when null", () => { expect(api.fireEmployee("emp_1")).toBe(false); });

    it("returns true on success", () => {
      mockFireEmployee.mockReturnValueOnce({ employees: [], maxEmployees: 10, lastPayrollTime: 0, totalWagesPaid: 0 });
      expect(api.fireEmployee("emp_1")).toBe(true);
    });
  });

  describe("getTeeSheet", () => {
    it("returns empty array for no tee times", () => { expect(api.getTeeSheet()).toEqual([]); });

    it("returns tee times for specified day", () => {
      state.teeTimeState.teeTimes.set(5, [
        { id: "tt1", scheduledTime: { hour: 8, minute: 0 }, status: "available", golfers: null },
        { id: "tt2", scheduledTime: { hour: 9, minute: 5 }, status: "booked", golfers: ["g1", "g2"] },
      ] as any);
      const result = api.getTeeSheet(5);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: "tt1", time: "8:00", status: "available", playerCount: 0 });
      expect(result[1]).toEqual({ id: "tt2", time: "9:05", status: "booked", playerCount: 2 });
    });

    it("uses gameDay when day not specified", () => {
      state.teeTimeState.teeTimes.set(3, [{ id: "tt1", scheduledTime: { hour: 10, minute: 30 }, status: "available", golfers: [] }] as any);
      expect(api.getTeeSheet()).toHaveLength(1);
    });
  });

  describe("bookTeeTime", () => {
    it("returns true when state changed", () => {
      mockBookTeeTime.mockReturnValueOnce({ changed: true });
      expect(api.bookTeeTime("tt1")).toBe(true);
    });

    it("returns false when state unchanged", () => {
      mockBookTeeTime.mockReturnValueOnce(state.teeTimeState);
      expect(api.bookTeeTime("tt1", 2)).toBe(false);
    });

    it("uses default greenFee when prestigeState.greenFee is falsy", () => {
      state.prestigeState = { ...state.prestigeState, greenFee: 0 } as any;
      mockBookTeeTime.mockReturnValueOnce({ changed: true });
      api.bookTeeTime("tt1", 1);
      const booking = mockBookTeeTime.mock.calls[mockBookTeeTime.mock.calls.length - 1][2][0];
      expect(booking.greenFee).toBe(50);
    });
  });

  describe("checkInTeeTime", () => { it("always returns true", () => { expect(api.checkInTeeTime("tt1")).toBe(true); }); });
  describe("cancelTeeTimeBooking", () => { it("always returns true", () => { expect(api.cancelTeeTimeBooking("tt1")).toBe(true); }); });

  describe("getActiveCampaigns", () => {
    it("returns active campaigns", () => {
      const result = api.getActiveCampaigns();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ campaignId: "camp1", daysRemaining: 4 });
    });

    it("filters non-active", () => {
      state.marketingState.activeCampaigns = [{ campaignId: "camp1", status: "completed", plannedDuration: 7, elapsedDays: 7 } as any];
      expect(api.getActiveCampaigns()).toHaveLength(0);
    });
  });

  describe("endMarketingCampaign", () => { it("returns true", () => { expect(api.endMarketingCampaign("camp1")).toBe(true); }); });

  describe("getAvailableAmenities", () => {
    it("returns available amenities", () => {
      const result = api.getAvailableAmenities();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Clubhouse Tier 1");
    });
  });

  describe("getGolferState", () => {
    it("returns golfer state", () => {
      const result = api.getGolferState();
      expect(result).toEqual({ active: 12, served: 15, avgSatisfaction: 75 });
    });
  });

  describe("getScenarioProgress", () => {
    it("returns null when no scenarioManager", () => { expect(api.getScenarioProgress()).toBeNull(); });

    it("returns progress", () => {
      state.scenarioManager = { getProgress: vi.fn(() => ({ daysElapsed: 5 })) } as any;
      expect(api.getScenarioProgress()).toEqual({ daysElapsed: 5 });
    });
  });

  describe("getUIState", () => {
    it("returns UI state", () => {
      expect(api.getUIState()).toEqual({ isPaused: false, overlayMode: "normal", notificationCount: 0 });
    });
  });

  describe("setPaused", () => {
    it("pauses when true", () => { api.setPaused(true); expect(sys.pauseGame).toHaveBeenCalled(); });
    it("resumes when false", () => { api.setPaused(false); expect(sys.resumeGame).toHaveBeenCalled(); });
  });

  describe("refillAtCurrentPosition", () => {
    it("returns failure when not at station", () => { expect(api.refillAtCurrentPosition()).toEqual({ success: false, cost: 0 }); });

    it("returns success at station", () => {
      const station = api.getRefillStations()[0];
      sys.player = { ...sys.player, gridX: station.x, gridY: station.y } as any;
      const result = api.refillAtCurrentPosition();
      expect(result.success).toBe(true);
      expect(result.cost).toBe(25);
    });

    it("handles addExpense null at station", () => {
      mockAddExpense.mockReturnValueOnce(null);
      const station = api.getRefillStations()[0];
      sys.player = { ...sys.player, gridX: station.x, gridY: station.y } as any;
      expect(api.refillAtCurrentPosition().success).toBe(true);
    });
  });

  describe("isAtRefillStation", () => {
    it("returns false when not at station", () => { expect(api.isAtRefillStation()).toBe(false); });
    it("returns true at station", () => {
      const station = api.getRefillStations()[0];
      sys.player = { ...sys.player, gridX: station.x, gridY: station.y } as any;
      expect(api.isAtRefillStation()).toBe(true);
    });
  });

  describe("getRefillStations", () => {
    it("returns stations", () => { expect(api.getRefillStations().length).toBeGreaterThan(0); });
  });

  describe("forceGrassGrowth", () => {
    it("delegates", () => { api.forceGrassGrowth(10); expect(sys.terrainSystem.update).toHaveBeenCalledWith(5000, state.gameDay * 1440 + state.gameTime); });
  });

  describe("getTerrainEditorState", () => {
    it("returns defaults when null", () => { expect(api.getTerrainEditorState()).toEqual({ enabled: false, tool: null, brushSize: 1 }); });

    it("returns editor state", () => {
      sys.terrainEditorSystem = { isEnabled: vi.fn(() => true), getActiveTool: vi.fn(() => "raise"), getBrushSize: vi.fn(() => 3) } as any;
      expect(api.getTerrainEditorState()).toEqual({ enabled: true, tool: "raise", brushSize: 3 });
    });
  });

  describe("getRobotState", () => {
    it("returns counts", () => { expect(api.getRobotState()).toEqual({ totalRobots: 1, workingRobots: 2, brokenRobots: 1 }); });
  });

  describe("getAvailableRobots", () => { it("delegates", () => { expect(api.getAvailableRobots()).toEqual([]); }); });

  describe("getWalkOnState", () => {
    it("returns walk-on state", () => {
      expect(api.getWalkOnState()).toEqual({ queueLength: 1, totalServed: 5, totalTurnedAway: 2 });
    });
  });

  describe("getRevenueState", () => {
    it("returns revenue", () => {
      expect(api.getRevenueState()).toEqual({ greenFees: 100, cartFees: 50, proShopSales: 30, foodBeverage: 20 });
    });
  });

  describe("getWeatherState", () => {
    it("returns weather", () => { expect(api.getWeatherState()).toEqual({ condition: "sunny", temperature: 75, windSpeed: 5 }); });
  });

  describe("setWeatherCondition", () => {
    it("updates type", () => { api.setWeatherCondition("rainy"); expect(state.weatherState.current.type).toBe("rainy"); });
  });

  describe("getEmployeeWorkState", () => {
    it("returns counts", () => { expect(api.getEmployeeWorkState()).toEqual({ workerCount: 2, activeWorkers: 1, idleWorkers: 1 }); });
  });

  describe("getTerrainTypes", () => {
    it("returns unique types", () => {
      const result = api.getTerrainTypes();
      expect(result).toContain("fairway");
    });
  });

  describe("save game methods", () => {
    it("deleteSaveGame delegates", () => { expect(api.deleteSaveGame("s1")).toBe(true); });
    it("getSaveGameInfo with provided id", () => { expect(api.getSaveGameInfo("custom")).toEqual({ savedAt: 1000, gameDay: 5 }); });
    it("getSaveGameInfo with currentScenario", () => { state.currentScenario = { id: "scen1" } as any; api.getSaveGameInfo(); });
    it("getSaveGameInfo falls to sandbox", () => { state.currentScenario = null; api.getSaveGameInfo(); });
    it("listSaveGames delegates", () => { expect(api.listSaveGames()).toHaveLength(1); });
  });

  describe("reputation methods", () => {
    it("getReputationSummaryData", () => {
      const result = api.getReputationSummaryData();
      expect(result.score).toBe(85);
      expect(result.starRating).toBe(4);
      expect(result.totalTurnAways).toBe(10);
    });

    it("trackGolferVisitForReputation", () => { api.trackGolferVisitForReputation("g1", true); });
    it("trackTurnAwayForReputation", () => { api.trackTurnAwayForReputation(); });
  });

  describe("getWalkOnSummary", () => {
    it("returns summary", () => {
      const result = api.getWalkOnSummary();
      expect(result).toEqual({ queueLength: 3, served: 5, turnedAway: 2, gaveUp: 1, avgWait: 10, estimatedWait: 15 });
    });
  });

  describe("updateWalkOnPolicy", () => {
    it("updates with maxWaitMinutes", () => { api.updateWalkOnPolicy(30); });
    it("updates with maxQueueSize", () => { api.updateWalkOnPolicy(undefined, 10); });
    it("updates with both", () => { api.updateWalkOnPolicy(30, 10); });
    it("updates with neither", () => { api.updateWalkOnPolicy(); });
  });

  describe("addWalkOnGolfer", () => {
    it("returns accepted", () => { expect(api.addWalkOnGolfer()).toBe(true); });

    it("returns false when not accepted", () => {
      mockAddWalkOnToQueue.mockReturnValueOnce({ state: state.walkOnState, accepted: false });
      expect(api.addWalkOnGolfer()).toBe(false);
    });
  });

  describe("getRevenueSummaryData", () => {
    it("returns summary with top source", () => {
      const result = api.getRevenueSummaryData();
      expect(result.todaysGross).toBe(200);
      expect(result.topRevenueSource).toBe("greenFees");
    });

    it("picks later source when it has higher value", () => {
      mockGetRevenueSummary.mockReturnValueOnce({
        today: { greenFees: 10, cartFees: 10, proShop: 10, foodAndBeverage: 200, grossRevenue: 230, netRevenue: 200 },
        weeklyAverage: { grossRevenue: 1000 },
        monthlyAverage: { grossRevenue: 4000 },
      });
      const result = api.getRevenueSummaryData();
      expect(result.topRevenueSource).toBe("foodAndBeverage");
    });
  });

  describe("calculateGreenFeeForGolfer", () => {
    it("uses default public", () => { expect(api.calculateGreenFeeForGolfer()).toBe(55); });
    it("passes membership type", () => { api.calculateGreenFeeForGolfer("member"); });
  });

  describe("calculateCartFeeForGolfer", () => { it("returns fee", () => { expect(api.calculateCartFeeForGolfer()).toBe(20); }); });

  describe("getAverageRevenue", () => {
    it("uses default 7 days", () => { expect(api.getAverageRevenue()).toBe(180); });
    it("accepts custom days", () => { api.getAverageRevenue(30); });
  });

  describe("purchaseRobotUnit", () => {
    it("returns false when not available", () => { expect(api.purchaseRobotUnit("eq1")).toBe(false); });

    it("returns false when purchaseRobot returns null", () => {
      mockGetAvailableRobotsToPurchase.mockReturnValueOnce([{ equipmentId: "eq1", stats: {} }]);
      expect(api.purchaseRobotUnit("eq1")).toBe(false);
    });

    it("returns false when cost exceeds cash", () => {
      mockGetAvailableRobotsToPurchase.mockReturnValueOnce([{ equipmentId: "eq1", stats: {} }]);
      mockPurchaseRobot.mockReturnValueOnce({ state: {}, cost: 999999 });
      expect(api.purchaseRobotUnit("eq1")).toBe(false);
    });

    it("returns true on success", () => {
      mockGetAvailableRobotsToPurchase.mockReturnValueOnce([{ equipmentId: "eq1", stats: {} }]);
      mockPurchaseRobot.mockReturnValueOnce({ state: state.autonomousState, cost: 100 });
      expect(api.purchaseRobotUnit("eq1")).toBe(true);
    });

    it("handles addExpense null on purchase", () => {
      mockGetAvailableRobotsToPurchase.mockReturnValueOnce([{ equipmentId: "eq1", stats: {} }]);
      mockPurchaseRobot.mockReturnValueOnce({ state: state.autonomousState, cost: 100 });
      mockAddExpense.mockReturnValueOnce(null);
      expect(api.purchaseRobotUnit("eq1")).toBe(true);
    });
  });

  describe("sellRobotUnit", () => {
    it("returns false when null", () => { expect(api.sellRobotUnit("r1")).toBe(false); });

    it("returns true on success", () => {
      mockSellRobot.mockReturnValueOnce({ state: state.autonomousState, refund: 50 });
      expect(api.sellRobotUnit("r1")).toBe(true);
    });
  });

  describe("getRobotList", () => {
    it("returns list", () => {
      const result = api.getRobotList();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: "r1", type: "mower_bot", state: "working", battery: 80 });
    });
  });

  describe("time utility methods", () => {
    it("isCurrentTimeWeekend", () => { expect(api.isCurrentTimeWeekend()).toBe(false); });
    it("isCurrentTimePrimeMorning", () => { expect(api.isCurrentTimePrimeMorning()).toBe(true); });
    it("isCurrentTimeTwilight", () => { expect(api.isCurrentTimeTwilight()).toBe(false); });
    it("getWeatherDescription", () => { expect(api.getWeatherDescription()).toBe("Sunny and clear"); });
    it("getWeatherImpact", () => { expect(api.getWeatherImpact()).toBe("No impact"); });
    it("getCurrentSeason", () => { expect(api.getCurrentSeason()).toBe("summer"); });
  });

  describe("completeResearch", () => {
    it("returns false when null", () => { expect(api.completeResearch("item_a")).toBe(false); });

    it("returns true on success", () => {
      mockCompleteResearchInstantly.mockReturnValueOnce({ completedResearch: ["item_a"] });
      expect(api.completeResearch("item_a")).toBe(true);
    });
  });

  describe("completeResearchWithPrerequisites", () => {
    it("completes prerequisites then item", () => {
      mockGetPrerequisiteChain.mockReturnValueOnce(["prereq_1"]);
      mockCompleteResearchInstantly
        .mockReturnValueOnce({ completedResearch: ["prereq_1"], currentResearch: null, researchQueue: [], fundingLevel: "normal", totalPointsSpent: 0 })
        .mockReturnValueOnce({ completedResearch: ["prereq_1", "item_b"], currentResearch: null, researchQueue: [], fundingLevel: "normal", totalPointsSpent: 0 });
      expect(api.completeResearchWithPrerequisites("item_b")).toBe(true);
    });

    it("skips already completed prerequisites", () => {
      state.researchState = { ...state.researchState, completedResearch: ["prereq_1"] };
      mockGetPrerequisiteChain.mockReturnValueOnce(["prereq_1"]);
      mockCompleteResearchInstantly.mockReturnValueOnce({ completedResearch: ["prereq_1", "item_b"] });
      expect(api.completeResearchWithPrerequisites("item_b")).toBe(true);
    });

    it("handles null for prereq completion", () => {
      mockGetPrerequisiteChain.mockReturnValueOnce(["prereq_1"]);
      mockCompleteResearchInstantly.mockReturnValueOnce(null).mockReturnValueOnce(null);
      expect(api.completeResearchWithPrerequisites("item_b")).toBe(false);
    });
  });

  describe("getResearchDetails", () => {
    it("returns details", () => {
      const result = api.getResearchDetails("item_a");
      expect(result.status).toBe("available");
      expect(Array.isArray(result.prerequisites)).toBe(true);
    });
  });

  describe("loan methods", () => {
    it("takeLoan returns false on null", () => { mockTakeLoan.mockReturnValueOnce(null); expect(api.takeLoan("small")).toBe(false); });
    it("takeLoan returns true", () => { expect(api.takeLoan("medium")).toBe(true); });
    it("makeLoanPayment returns false on null", () => { mockMakeLoanPayment.mockReturnValueOnce(null); expect(api.makeLoanPayment("l1")).toBe(false); });
    it("makeLoanPayment returns true", () => { expect(api.makeLoanPayment("l1")).toBe(true); });
    it("payOffLoan returns false on null", () => { mockPayOffLoan.mockReturnValueOnce(null); expect(api.payOffLoan("l1")).toBe(false); });
    it("payOffLoan returns true", () => { expect(api.payOffLoan("l1")).toBe(true); });
  });

  describe("getLoanState", () => {
    it("returns state with no loans", () => {
      const result = api.getLoanState();
      expect(result.loans).toEqual([]);
      expect(result.canTakeLoan).toBe(true);
    });

    it("canTakeLoan false with 3 loans", () => {
      state.economyState = {
        ...state.economyState,
        loans: [
          { id: "l1", principal: 1000, remainingBalance: 800, interestRate: 0.05, monthlyPayment: 100 },
          { id: "l2", principal: 2000, remainingBalance: 1500, interestRate: 0.06, monthlyPayment: 200 },
          { id: "l3", principal: 3000, remainingBalance: 2500, interestRate: 0.07, monthlyPayment: 300 },
        ] as any,
      };
      expect(api.getLoanState().canTakeLoan).toBe(false);
    });
  });

  describe("getTransactionHistory", () => {
    it("uses defaults", () => { expect(api.getTransactionHistory()).toHaveLength(1); });
    it("accepts custom range", () => { api.getTransactionHistory(100, 200); });
  });

  describe("getFinancialSummary", () => {
    it("returns summary", () => { expect(api.getFinancialSummary()).toEqual({ totalIncome: 200, totalExpenses: 100, netProfit: 100 }); });
  });

  describe("forceHireGroundskeeper", () => {
    it("returns employee id", () => { expect(api.forceHireGroundskeeper()).toBe("emp_1"); });
  });

  describe("getWorkerDetails", () => {
    it("returns workers", () => { expect(api.getWorkerDetails()).toHaveLength(1); });
  });

  describe("getRobotDetails", () => {
    it("returns details", () => {
      const result = api.getRobotDetails();
      expect(result[0].battery).toBe(80);
      expect(result[0].worldX).toBe(3);
      expect(result[0].worldZ).toBe(5);
      expect(result[0].targetX).toBe(5);
      expect(result[0].targetY).toBeNull();
    });
  });

  describe("getScenarioObjective", () => {
    it("returns null when no scenarioManager", () => { expect(api.getScenarioObjective()).toBeNull(); });

    it("returns objective", () => {
      state.scenarioManager = {
        getObjective: vi.fn(() => ({ type: "economic" })),
        getConditions: vi.fn(() => ({ timeLimitDays: 30 })),
        getObjectiveDescription: vi.fn(() => "Reach $5000 profit"),
      } as any;
      const result = api.getScenarioObjective()!;
      expect(result.type).toBe("economic");
      expect(result.description).toBe("Reach $5000 profit");
      expect(result.timeLimitDays).toBe(30);
    });
  });

  describe("forceScenarioProgress", () => {
    it("does nothing when no scenarioManager", () => { api.forceScenarioProgress({ daysElapsed: 10 }); });

    it("delegates", () => {
      state.scenarioManager = { updateProgress: vi.fn() } as any;
      api.forceScenarioProgress({ totalRevenue: 5000 });
      expect(state.scenarioManager!.updateProgress).toHaveBeenCalledWith({ totalRevenue: 5000 });
    });
  });

  describe("checkScenarioObjective", () => {
    it("returns defaults when no scenarioManager", () => { expect(api.checkScenarioObjective()).toEqual({ completed: false, failed: false, progress: 0 }); });

    it("delegates", () => {
      state.scenarioManager = { checkObjective: vi.fn(() => ({ completed: true, failed: false, progress: 100 })) } as any;
      expect(api.checkScenarioObjective().completed).toBe(true);
    });
  });

  describe("addRevenue", () => {
    it("without scenarioManager", () => { api.addRevenue(100); });

    it("with scenarioManager", () => {
      state.scenarioManager = { addRevenue: vi.fn() } as any;
      api.addRevenue(100, "green_fees");
      expect(state.scenarioManager!.addRevenue).toHaveBeenCalledWith(100);
    });
  });

  describe("addExpenseAmount", () => {
    it("without scenarioManager", () => { api.addExpenseAmount(50); });

    it("with scenarioManager", () => {
      state.scenarioManager = { addExpense: vi.fn() } as any;
      api.addExpenseAmount(50, "supplies");
      expect(state.scenarioManager!.addExpense).toHaveBeenCalledWith(50);
    });

    it("handles addExpense null", () => {
      mockAddExpense.mockReturnValueOnce(null);
      api.addExpenseAmount(50);
    });
  });

  describe("scenario delegation methods", () => {
    it("incrementScenarioDay no manager", () => { api.incrementScenarioDay(); });
    it("incrementScenarioDay with manager", () => { state.scenarioManager = { incrementDay: vi.fn() } as any; api.incrementScenarioDay(); expect(state.scenarioManager!.incrementDay).toHaveBeenCalled(); });
    it("updateCourseHealthForScenario no manager", () => { api.updateCourseHealthForScenario(); });
    it("updateCourseHealthForScenario with manager", () => { state.scenarioManager = { updateCourseHealthFromFaces: vi.fn() } as any; api.updateCourseHealthForScenario(); expect(state.scenarioManager!.updateCourseHealthFromFaces).toHaveBeenCalled(); });
    it("checkSatisfactionStreak no manager", () => { api.checkSatisfactionStreak(80); });
    it("checkSatisfactionStreak with manager", () => { state.scenarioManager = { checkSatisfactionStreak: vi.fn() } as any; api.checkSatisfactionStreak(80); expect(state.scenarioManager!.checkSatisfactionStreak).toHaveBeenCalledWith(80); });
    it("addGolferCount no manager", () => { api.addGolferCount(5); });
    it("addGolferCount with manager", () => { state.scenarioManager = { addGolfers: vi.fn() } as any; api.addGolferCount(5); expect(state.scenarioManager!.addGolfers).toHaveBeenCalledWith(5); });
    it("addRoundCount no manager", () => { api.addRoundCount(); });
    it("addRoundCount with manager", () => { state.scenarioManager = { addRound: vi.fn() } as any; api.addRoundCount(); expect(state.scenarioManager!.addRound).toHaveBeenCalled(); });
  });

  describe("getDetailedResearchState", () => {
    it("returns null currentResearch when none active", () => {
      const result = api.getDetailedResearchState();
      expect(result.currentResearch).toBeNull();
      expect(result.fundingLevel).toBe("normal");
    });

    it("returns currentResearch with progress", () => {
      state.researchState = { ...state.researchState, currentResearch: { itemId: "item_a", pointsEarned: 50, pointsRequired: 100 } as any };
      const result = api.getDetailedResearchState();
      expect(result.currentResearch).toEqual({ itemId: "item_a", progress: 50 });
    });

    it("maps available research ids", () => {
      mockGetAvailableResearch.mockReturnValueOnce([{ id: "item_x" }, { id: "item_y" }]);
      const result = api.getDetailedResearchState();
      expect(result.availableResearch).toEqual(["item_x", "item_y"]);
    });
  });
});
