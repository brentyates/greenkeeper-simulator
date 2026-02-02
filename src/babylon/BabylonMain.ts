import { BabylonEngine } from "./engine/BabylonEngine";
import { InputManager, Direction, EquipmentSlot } from "./engine/InputManager";
import { GrassSystem, OverlayMode } from "./systems/GrassSystem";
import { EquipmentManager } from "./systems/EquipmentManager";
import { TerrainEditorSystem } from "./systems/TerrainEditorSystem";
import { EmployeeVisualSystem } from "./systems/EmployeeVisualSystem";
import { IrrigationRenderSystem } from "./systems/IrrigationRenderSystem";
import {
  EntityVisualState,
  PLAYER_APPEARANCE,
  createEntityMesh,
  updateEntityVisualPosition,
  disposeEntityMesh,
} from "./systems/EntityVisualSystem";
import { clearAssetCache } from "./assets/AssetLoader";
import { UIManager } from "./ui/UIManager";
import { TerrainEditorUI } from "./ui/TerrainEditorUI";
import { EmployeePanel } from "./ui/EmployeePanel";
import { ResearchPanel } from "./ui/ResearchPanel";
import { DaySummaryPopup, DaySummaryData } from "./ui/DaySummaryPopup";
import { TeeSheetPanel } from "./ui/TeeSheetPanel";
import { MarketingDashboard } from "./ui/MarketingDashboard";
import { EquipmentStorePanel } from "./ui/EquipmentStorePanel";
import { AmenityPanel } from "./ui/AmenityPanel";
import { WalkOnQueuePanel } from "./ui/WalkOnQueuePanel";
import { IrrigationToolbar } from "./ui/IrrigationToolbar";
import { IrrigationInfoPanel } from "./ui/IrrigationInfoPanel";
import { IrrigationSchedulePanel } from "./ui/IrrigationSchedulePanel";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import "@babylonjs/core/Culling/ray";

import {
  COURSE_HOLE_1,
  REFILL_STATIONS,
  CourseData,
  getCourseById,
} from "../data/courseData";
import { canMoveFromTo } from "../core/terrain";
import { EditorTool } from "../core/terrain-editor-logic";
import { ScenarioDefinition } from "../data/scenarioData";

import {
  EconomyState,
  createInitialEconomyState,
  addIncome,
  addExpense,
  takeLoan,
  makeLoanPayment,
  payOffLoan,
  getTotalDebt,
  getNetWorth,
  DEFAULT_LOAN_TERMS,
  getTransactionsInRange,
  calculateFinancialSummary,
} from "../core/economy";
import {
  IrrigationSystem,
  createInitialIrrigationSystem,
  addPipe,
  removePipe,
  addSprinklerHead,
  removeSprinklerHead,
  updatePipePressures,
  checkForLeaks,
  repairLeak,
  calculateWaterUsage,
  calculateWaterCost,
  setSprinklerActive,
  getPipeAt,
  getSprinklerHeadAt,
  updateSprinklerSchedule,
  PipeType,
  SprinklerType,
  WateringSchedule,
  PIPE_CONFIGS,
  SPRINKLER_CONFIGS,
} from "../core/irrigation";
import { canAfford } from "../core/economy";
import {
  EmployeeRoster,
  EmployeeRole,
  EMPLOYEE_ROLE_INFO,
  createInitialRoster,
  tickEmployees,
  processPayroll,
  getManagerBonus,
  hireEmployee,
  fireEmployee,
  ApplicationState,
  createInitialApplicationState,
  tickApplications,
  postJobOpening,
  acceptApplication,
  getPostingCost,
  Employee,
  awardExperience,
  createEmployee,
} from "../core/employees";
import {
  EmployeeWorkSystemState,
  createInitialWorkSystemState,
  tickEmployeeWork,
  syncWorkersWithRoster,
  getWorkerPositions,
  TASK_EXPERIENCE_REWARDS,
  TASK_SUPPLY_COSTS,
} from "../core/employee-work";
import {
  PlayerEntity,
  createPlayerEntity,
  setEntityPath,
  teleportEntity,
} from "../core/movable-entity";
import {
  GolferPoolState,
  GreenFeeStructure,
  createInitialPoolState,
  tickGolfers,
  generateArrivals,
  calculateArrivalRate,
  updateCourseRating,
  addGolfer,
  getActiveGolferCount,
  getAverageSatisfaction,
  WeatherCondition,
  DEFAULT_GREEN_FEES,
  resetDailyStats as resetGolferDailyStats,
} from "../core/golfers";
import {
  ResearchState,
  createInitialResearchState,
  tickResearch,
  getFundingCostPerMinute,
  startResearch,
  cancelResearch,
  setFundingLevel,
  FundingLevel,
  RESEARCH_ITEMS,
  getBestFertilizerEffectiveness,
  getEquipmentEfficiencyBonus,
  describeResearchUnlock,
  completeResearchInstantly,
  getAvailableResearch as getAvailableResearchItems,
  getPrerequisiteChain,
  getResearchStatus,
  getResearchProgress,
} from "../core/research";
import { ScenarioManager } from "../core/scenario";
import {
  PrestigeState,
  createInitialPrestigeState,
  calculateCurrentConditions,
  updatePrestigeScore,
  calculateDemandMultiplier,
  takeDailySnapshot,
  updateHistoricalExcellence,
  resetDailyStats as resetPrestigeDailyStats,
  upgradeAmenity,
} from "../core/prestige";
import { AmenityUpgrade, getUpgradeCost, getAvailableUpgrades, getUpgradeName } from "../core/amenities";
import {
  TeeTimeSystemState,
  TeeTimeSpacing,
  createInitialTeeTimeState,
  generateDailySlots,
  simulateDailyBookings,
  applyBookingSimulation,
  getAvailableSlots,
  resetDailyMetrics as resetTeeTimeDailyMetrics,
  checkInTeeTime,
  cancelTeeTime,
  bookTeeTime,
  markNoShow,
  updateSpacing,
  type GameTime,
} from "../core/tee-times";
import {
  WalkOnState,
  createInitialWalkOnState,
  processWalkOns,
  resetDailyWalkOnMetrics,
  getWalkOnSummary,
  getQueueLength,
  getEstimatedWaitTime,
  updateWalkOnPolicy,
  addWalkOnToQueue,
  createWalkOnGolfer,
} from "../core/walk-ons";
import {
  RevenueState,
  createInitialRevenueState,
  finalizeDailyRevenue,
  getRevenueSummary,
  calculateGreenFee,
  calculateCartFee,
  calculateAverageRevenue,
  isWeekend,
  isPrimeMorning,
  isTwilightHour,
} from "../core/tee-revenue";
import {
  MarketingState,
  createInitialMarketingState,
  processDailyCampaigns,
  calculateCombinedDemandMultiplier,
  startCampaign,
  stopCampaign,
  canStartCampaign,
} from "../core/marketing";
import {
  createSaveState,
  saveGame,
  loadGame,
  hasSave,
  deleteSave,
  getSaveInfo,
  listSaves,
} from "../core/save-game";
import {
  AutonomousEquipmentState,
  createInitialAutonomousState,
  tickAutonomousEquipment,
  purchaseRobot,
  sellRobot,
  countWorkingRobots,
  countBrokenRobots,
  getAvailableRobotsToPurchase,
} from "../core/autonomous-equipment";
import {
  WeatherState,
  createInitialWeatherState,
  tickWeather,
  getWeatherDescription,
  getWeatherImpactDescription,
  getSeasonFromDay,
} from "../core/weather";
import {
  ReputationState,
  createInitialReputationState,
  getReputationSummary,
  calculateReputationScore,
  trackGolferVisit,
  trackTurnAway,
} from "../core/reputation";

export interface GameOptions {
  scenario?: ScenarioDefinition;
  loadFromSave?: boolean;
  onReturnToMenu?: () => void;
  onScenarioComplete?: (score: number) => void;
}

export class BabylonMain {
  private babylonEngine: BabylonEngine;
  private inputManager: InputManager;
  private grassSystem: GrassSystem;
  private equipmentManager: EquipmentManager;
  private uiManager: UIManager;
  private zoomLevel: "close" | "far" = "close";
  private lastTime: number = 0;
  private gameTime: number = 6 * 60;
  private gameDay: number = 1;
  private timeScale: number = 1;
  private isPaused: boolean = false;
  private isMuted: boolean = false;
  private overlayAutoSwitched: boolean = false;

  private player: PlayerEntity = createPlayerEntity("player", 25, 19);
  private playerVisual: EntityVisualState | null = null;
  private cameraFollowPlayer: boolean = true;

  private score: number = 0;
  private obstacleMeshes: Mesh[] = [];

  private terrainEditorSystem: TerrainEditorSystem | null = null;
  private terrainEditorUI: TerrainEditorUI | null = null;
  private editorUITexture: AdvancedDynamicTexture | null = null;
  private employeeVisualSystem: EmployeeVisualSystem | null = null;
  private irrigationRenderSystem: IrrigationRenderSystem | null = null;
  private irrigationSystem: IrrigationSystem = createInitialIrrigationSystem();
  private irrigationToolbar: IrrigationToolbar | null = null;
  private irrigationInfoPanel: IrrigationInfoPanel | null = null;
  private irrigationSchedulePanel: IrrigationSchedulePanel | null = null;

  private employeePanel: EmployeePanel | null = null;
  private applicationState: ApplicationState = createInitialApplicationState();
  private researchPanel: ResearchPanel | null = null;
  private daySummaryPopup: DaySummaryPopup | null = null;
  private teeSheetPanel: TeeSheetPanel | null = null;
  private teeSheetViewDay: number = 1;
  private marketingDashboard: MarketingDashboard | null = null;
  private equipmentStorePanel: EquipmentStorePanel | null = null;
  private amenityPanel: AmenityPanel | null = null;
  private walkOnQueuePanel: WalkOnQueuePanel | null = null;
  private dailyStats = {
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

  private gameOptions: GameOptions;
  private currentCourse: CourseData;
  private currentScenario: ScenarioDefinition | null = null;

  private economyState: EconomyState;
  private employeeRoster: EmployeeRoster;
  private employeeWorkState: EmployeeWorkSystemState;
  private golferPool: GolferPoolState;
  private researchState: ResearchState;
  private scenarioManager: ScenarioManager | null = null;
  private weatherState: WeatherState = createInitialWeatherState();
  private weather: WeatherCondition = this.weatherState.current;
  private greenFees: GreenFeeStructure = { ...DEFAULT_GREEN_FEES };
  private lastPayrollHour: number = -1;
  private lastArrivalHour: number = -1;
  private lastAutoSaveHour: number = -1;
  private accumulatedResearchTime: number = 0;
  private prestigeState: PrestigeState;
  private lastPrestigeUpdateHour: number = -1;
  private teeTimeState: TeeTimeSystemState;
  private walkOnState: WalkOnState;
  private revenueState: RevenueState;
  private marketingState: MarketingState;
  private autonomousState: AutonomousEquipmentState;
  private reputationState: ReputationState = createInitialReputationState();
  private lastTeeTimeUpdateHour: number = -1;
  private shownTutorialHints: Set<string> = new Set();

  constructor(canvasId: string, options: GameOptions = {}) {
    this.gameOptions = options;
    this.currentScenario = options.scenario || null;

    // Determine which course to load
    if (options.scenario) {
      const scenarioCourse = getCourseById(options.scenario.courseId);
      this.currentCourse = scenarioCourse || COURSE_HOLE_1;
    } else {
      this.currentCourse = COURSE_HOLE_1;
    }

    const course = this.currentCourse;

    // Initialize economy and management systems
    const startingCash = options.scenario?.conditions.startingCash ?? 10000;
    this.economyState = createInitialEconomyState(startingCash);
    this.employeeRoster = createInitialRoster();
    const maintenanceShedX =
      REFILL_STATIONS[0]?.x ?? Math.floor(course.width / 2);
    const maintenanceShedY =
      REFILL_STATIONS[0]?.y ?? Math.floor(course.height / 2);
    this.employeeWorkState = createInitialWorkSystemState(
      maintenanceShedX,
      maintenanceShedY
    );
    this.golferPool = createInitialPoolState();
    this.researchState = createInitialResearchState();
    this.prestigeState = createInitialPrestigeState(100);
    this.teeTimeState = createInitialTeeTimeState();
    this.walkOnState = createInitialWalkOnState();
    this.revenueState = createInitialRevenueState();
    this.marketingState = createInitialMarketingState();
    this.autonomousState = createInitialAutonomousState(
      REFILL_STATIONS[0]?.x ?? 25,
      REFILL_STATIONS[0]?.y ?? 19
    );

    // Set green fees based on course size
    const courseHoles = course.par ? Math.round(course.par / 4) : 9;
    if (courseHoles <= 3) {
      this.greenFees = {
        weekday9Holes: 15,
        weekday18Holes: 25,
        weekend9Holes: 20,
        weekend18Holes: 30,
        twilight9Holes: 10,
        twilight18Holes: 15,
      };
    } else if (courseHoles <= 9) {
      this.greenFees = {
        weekday9Holes: 25,
        weekday18Holes: 45,
        weekend9Holes: 35,
        weekend18Holes: 55,
        twilight9Holes: 18,
        twilight18Holes: 30,
      };
    }

    // Initialize scenario manager if we have a scenario
    if (options.scenario) {
      this.scenarioManager = new ScenarioManager(
        options.scenario.objective,
        options.scenario.conditions
      );
    }

    // Set starting position based on course size
    const startX = Math.floor(course.width / 2);
    const startY = Math.floor(course.height * 0.75);
    this.player = createPlayerEntity("player", startX, startY);
    this.babylonEngine = new BabylonEngine(
      canvasId,
      course.width,
      course.height
    );
    this.inputManager = new InputManager(this.babylonEngine.getScene());
    this.grassSystem = new GrassSystem(this.babylonEngine.getScene(), course);
    this.equipmentManager = new EquipmentManager(this.babylonEngine.getScene());
    this.employeeVisualSystem = new EmployeeVisualSystem(
      this.babylonEngine.getScene(),
      { getElevationAt: (x, y, d) => this.grassSystem.getElevationAt(x, y, d) }
    );
    this.uiManager = new UIManager(this.babylonEngine.getScene());
    this.irrigationRenderSystem = new IrrigationRenderSystem(
      this.babylonEngine.getScene(),
      { getElevationAt: (x, y, d) => this.grassSystem.getElevationAt(x, y, d) }
    );

    this.setupInputCallbacks();
    this.buildScene();
    this.setupTerrainEditor();
    this.setupEmployeePanel();
    this.setupResearchPanel();
    this.setupDaySummaryPopup();
    this.setupTeeSheetPanel();
    this.setupMarketingDashboard();
    this.setupEquipmentStorePanel();
    this.setupAmenityPanel();
    this.setupWalkOnQueuePanel();
    this.setupIrrigationUI();
    this.setupPriceCallback();
    this.setupUpdateLoop();

    // Load saved game if requested
    if (options.loadFromSave && this.loadSavedGame()) {
      this.uiManager.showNotification(`Loaded Day ${this.gameDay}`);
      this.updatePlayerPosition();
    }

    // Show scenario objective if we have one
    if (this.currentScenario) {
      this.uiManager.updateObjective(this.getObjectiveText());
    }
  }

  private getObjectiveText(): string {
    if (!this.currentScenario) return "";
    const obj = this.currentScenario.objective;
    switch (obj.type) {
      case "economic":
        if (obj.targetProfit)
          return `Earn $${obj.targetProfit.toLocaleString()} profit`;
        if (obj.targetRevenue)
          return `Generate $${obj.targetRevenue.toLocaleString()} revenue`;
        return "Complete economic goal";
      case "restoration":
        return `Restore course to ${obj.targetHealth}% health`;
      case "attendance":
        return `Host ${obj.targetRounds} rounds of golf`;
      case "satisfaction":
        return `Maintain ${obj.targetRating}% rating for ${obj.maintainForDays} days`;
      default:
        return "Complete scenario objective";
    }
  }

  private setupTerrainEditor(): void {
    const scene = this.babylonEngine.getScene();

    const cornerProvider = {
      getCornerHeights: (gridX: number, gridY: number) =>
        this.grassSystem.getCornerHeightsPublic(gridX, gridY),
      getElevationAt: (gridX: number, gridY: number, defaultValue?: number) =>
        this.grassSystem.getElevationAt(gridX, gridY, defaultValue),
    };

    this.terrainEditorSystem = new TerrainEditorSystem(scene, cornerProvider);
    this.terrainEditorSystem.setTerrainModifier({
      setElevationAt: (x, y, elev) =>
        this.grassSystem.setElevationAt(x, y, elev),
      setTerrainTypeAt: (x, y, type) =>
        this.grassSystem.setTerrainTypeAt(x, y, type),
      rebuildTileAndNeighbors: (x, y) =>
        this.grassSystem.rebuildTileAndNeighbors(x, y),
    });

    this.terrainEditorSystem.initialize(
      this.grassSystem.getLayoutGrid(),
      this.grassSystem.getElevationGrid()
    );

    this.editorUITexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "EditorUI",
      true,
      scene
    );
    this.terrainEditorUI = new TerrainEditorUI(this.editorUITexture, {
      onToolSelect: (tool: EditorTool) => this.handleEditorToolSelect(tool),
      onClose: () => this.handleEditorToggle(),
      onExport: () => this.handleEditorExport(),
      onUndo: () => this.handleEditorUndo(),
      onRedo: () => this.handleEditorRedo(),
      onBrushSizeChange: (delta: number) => this.handleEditorBrushSize(delta),
    });

    this.terrainEditorSystem.setCallbacks({
      onEnable: () => {
        this.terrainEditorUI?.show();
        this.terrainEditorUI?.setActiveTool(
          this.terrainEditorSystem!.getTool()
        );
      },
      onDisable: () => {
        this.terrainEditorUI?.hide();
      },
      onToolChange: (tool: EditorTool) => {
        this.terrainEditorUI?.setActiveTool(tool);
      },
      onBrushSizeChange: (size: number) => {
        this.terrainEditorUI?.setBrushSize(size);
      },
      onUndoRedoChange: (canUndo: boolean, canRedo: boolean) => {
        this.terrainEditorUI?.setUndoEnabled(canUndo);
        this.terrainEditorUI?.setRedoEnabled(canRedo);
      },
    });
  }

  private setupEmployeePanel(): void {
    const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "EmployeePanelUI",
      true,
      this.babylonEngine.getScene()
    );

    this.employeePanel = new EmployeePanel(uiTexture, {
      onHire: (employee: Employee) => {
        const result = hireEmployee(this.employeeRoster, employee);
        if (result) {
          this.employeeRoster = result;
          this.employeeWorkState = syncWorkersWithRoster(
            this.employeeWorkState,
            this.employeeRoster.employees
          );

          // Remove application after hiring
          const updatedAppState = acceptApplication(
            this.applicationState,
            employee.id
          );
          if (updatedAppState) {
            this.applicationState = updatedAppState;
          }

          this.uiManager.showNotification(
            `Hired ${employee.name} as ${employee.role}`
          );
          this.employeePanel?.update(this.employeeRoster);
          this.employeePanel?.updateApplications(
            this.applicationState,
            this.prestigeState.tier,
            this.gameTime + this.gameDay * 24 * 60
          );
        } else {
          this.uiManager.showNotification("Cannot hire - roster full");
        }
      },
      onFire: (employeeId: string) => {
        const employee = this.employeeRoster.employees.find(
          (e) => e.id === employeeId
        );
        const result = fireEmployee(this.employeeRoster, employeeId);
        if (result) {
          this.employeeRoster = result;
          this.employeeWorkState = syncWorkersWithRoster(
            this.employeeWorkState,
            this.employeeRoster.employees
          );
          if (employee) {
            this.uiManager.showNotification(`Fired ${employee.name}`);
          }
          this.employeePanel?.update(this.employeeRoster);
        }
      },
      onClose: () => {
        this.employeePanel?.hide();
      },
      onPostJobOpening: (role: EmployeeRole) => {
        const cost = getPostingCost(this.prestigeState.tier);
        if (this.economyState.cash < cost) {
          this.uiManager.showNotification(
            `⚠️ Not enough cash! Need $${cost}`,
            "#ff4444"
          );
          return;
        }

        const currentTime = this.gameTime + this.gameDay * 24 * 60;
        const result = postJobOpening(
          this.applicationState,
          currentTime,
          this.prestigeState.tier,
          role
        );

        if (result) {
          this.applicationState = result.state;
          const timestamp = this.gameDay * 24 * 60 + this.gameTime;
          const expenseResult = addExpense(
            this.economyState,
            cost,
            "marketing",
            "Job Posting",
            timestamp,
            false
          );
          if (expenseResult) {
            this.economyState = expenseResult;
            this.dailyStats.expenses.other += cost;
          }

          const roleInfo = EMPLOYEE_ROLE_INFO[role];
          this.uiManager.showNotification(
            `📢 Hiring ${roleInfo.name}! Cost: $${cost}`
          );
          this.employeePanel?.updateApplications(
            this.applicationState,
            this.prestigeState.tier,
            currentTime
          );
        }
      },
    });

    this.employeePanel.update(this.employeeRoster);

    // Initialize application state based on starting prestige tier
    this.applicationState = createInitialApplicationState(
      this.gameTime + this.gameDay * 24 * 60,
      this.prestigeState.tier
    );
  }

  private setupResearchPanel(): void {
    const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "ResearchPanelUI",
      true,
      this.babylonEngine.getScene()
    );

    this.researchPanel = new ResearchPanel(uiTexture, {
      onStartResearch: (itemId: string) => {
        const currentTime = this.gameTime + this.gameDay * 24 * 60;
        const result = startResearch(this.researchState, itemId, currentTime);
        if (result) {
          this.researchState = result;
          const item = RESEARCH_ITEMS.find((i) => i.id === itemId);
          if (item) {
            this.uiManager.showNotification(
              `Started researching: ${item.name}`
            );
          }
          this.researchPanel?.update(this.researchState);
        } else {
          this.uiManager.showNotification("Cannot start research");
        }
      },
      onQueueResearch: (itemId: string) => {
        this.researchState = {
          ...this.researchState,
          researchQueue: [...this.researchState.researchQueue, itemId],
        };
        this.researchPanel?.update(this.researchState);
      },
      onCancelResearch: () => {
        this.researchState = cancelResearch(this.researchState);
        this.uiManager.showNotification("Research cancelled");
        this.researchPanel?.update(this.researchState);
      },
      onSetFunding: (level: FundingLevel) => {
        this.researchState = setFundingLevel(this.researchState, level);
        this.uiManager.showNotification(`Funding set to ${level}`);
        this.researchPanel?.update(this.researchState);
      },
      onClose: () => {
        this.researchPanel?.hide();
      },
    });

    this.researchPanel.update(this.researchState);
  }

  private setupDaySummaryPopup(): void {
    const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "DaySummaryUI",
      true,
      this.babylonEngine.getScene()
    );

    this.daySummaryPopup = new DaySummaryPopup(uiTexture, {
      onContinue: () => {
        this.resetDailyStats();
      },
    });
  }

  private setupTeeSheetPanel(): void {
    const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "TeeSheetUI",
      true,
      this.babylonEngine.getScene()
    );
    this.teeSheetViewDay = this.gameDay;

    this.teeSheetPanel = new TeeSheetPanel(uiTexture, {
      onCheckIn: (teeTimeId: string) => {
        const result = checkInTeeTime(this.teeTimeState, teeTimeId);
        this.teeTimeState = result;
        this.teeSheetPanel?.update(this.teeTimeState, this.teeSheetViewDay);
        this.uiManager.showNotification("Golfer checked in");
      },
      onCancel: (teeTimeId: string) => {
        const result = cancelTeeTime(this.teeTimeState, teeTimeId);
        this.teeTimeState = result;
        this.teeSheetPanel?.update(this.teeTimeState, this.teeSheetViewDay);
        this.uiManager.showNotification("Tee time cancelled");
      },
      onMarkNoShow: (teeTimeId: string) => {
        const result = markNoShow(this.teeTimeState, teeTimeId);
        if (result) {
          this.teeTimeState = result;
          this.teeSheetPanel?.update(this.teeTimeState, this.teeSheetViewDay);
          this.uiManager.showNotification("Marked as no-show");
        }
      },
      onChangeDay: (delta: number) => {
        this.teeSheetViewDay = Math.max(1, this.teeSheetViewDay + delta);
        this.teeSheetPanel?.update(this.teeTimeState, this.teeSheetViewDay);
      },
      onSpacingChange: (spacing: TeeTimeSpacing) => {
        this.teeTimeState = updateSpacing(this.teeTimeState, spacing);
        this.teeSheetPanel?.update(this.teeTimeState, this.teeSheetViewDay);
        this.uiManager.showNotification(`Tee time spacing: ${spacing}`);
      },
      onClose: () => {
        this.teeSheetPanel?.hide();
      },
    });
  }

  private setupMarketingDashboard(): void {
    const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "MarketingUI",
      true,
      this.babylonEngine.getScene()
    );

    this.marketingDashboard = new MarketingDashboard(uiTexture, {
      onStartCampaign: (campaignId: string, duration: number) => {
        const result = startCampaign(
          this.marketingState,
          campaignId,
          this.gameDay,
          duration
        );
        if (result) {
          this.marketingState = result.state;
          if (result.setupCost > 0) {
            const timestamp = this.gameDay * 24 * 60 + this.gameTime;
            const expenseResult = addExpense(
              this.economyState,
              result.setupCost,
              "marketing",
              "Campaign setup",
              timestamp,
              false
            );
            if (expenseResult) {
              this.economyState = expenseResult;
              this.dailyStats.expenses.other += result.setupCost;
            }
          }
          this.marketingDashboard?.update(
            this.marketingState,
            this.gameDay,
            this.economyState.cash
          );
          this.uiManager.showNotification("Campaign started!");
        }
      },
      onStopCampaign: (campaignId: string) => {
        const result = stopCampaign(
          this.marketingState,
          campaignId,
          this.gameDay
        );
        this.marketingState = result;
        this.marketingDashboard?.update(
          this.marketingState,
          this.gameDay,
          this.economyState.cash
        );
        this.uiManager.showNotification("Campaign stopped");
      },
      onClose: () => {
        this.marketingDashboard?.hide();
      },
    });
  }

  private setupEquipmentStorePanel(): void {
    const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "EquipmentStoreUI",
      true,
      this.babylonEngine.getScene()
    );

    this.equipmentStorePanel = new EquipmentStorePanel(uiTexture, {
      onPurchaseRobot: (equipmentId, stats) => {
        const result = purchaseRobot(this.autonomousState, equipmentId, stats);
        if (result && result.cost <= this.economyState.cash) {
          this.autonomousState = result.state;
          const timestamp = this.gameDay * 24 * 60 + this.gameTime;
          const expenseResult = addExpense(
            this.economyState,
            result.cost,
            "equipment_purchase",
            `Robot purchase: ${equipmentId}`,
            timestamp,
            false
          );
          if (expenseResult) {
            this.economyState = expenseResult;
            this.dailyStats.expenses.other += result.cost;
          }
          this.equipmentStorePanel?.update(
            this.researchState,
            this.autonomousState,
            this.economyState.cash
          );
          this.uiManager.showNotification(`Purchased ${equipmentId}!`);
          return true;
        }
        return false;
      },
      onSellRobot: (robotId) => {
        const result = sellRobot(this.autonomousState, robotId);
        if (result) {
          this.autonomousState = result.state;
          const timestamp = this.gameDay * 24 * 60 + this.gameTime;
          const incomeResult = addIncome(
            this.economyState,
            result.refund,
            "other_income",
            `Robot sold: ${robotId}`,
            timestamp
          );
          if (incomeResult) {
            this.economyState = incomeResult;
            this.dailyStats.revenue.other += result.refund;
          }
          this.equipmentStorePanel?.update(
            this.researchState,
            this.autonomousState,
            this.economyState.cash
          );
          this.uiManager.showNotification(
            `Sold robot for $${result.refund.toLocaleString()}`
          );
          return true;
        }
        return false;
      },
      onClose: () => {
        this.equipmentStorePanel?.hide();
      },
    });
  }

  private setupAmenityPanel(): void {
    const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "AmenityPanelUI",
      true,
      this.babylonEngine.getScene()
    );

    this.amenityPanel = new AmenityPanel(uiTexture, {
      onPurchaseUpgrade: (upgrade: AmenityUpgrade) => {
        const cost = getUpgradeCost(this.prestigeState.amenities, upgrade);
        if (this.economyState.cash < cost) {
          return false;
        }
        this.prestigeState = upgradeAmenity(this.prestigeState, upgrade);
        const timestamp = this.gameDay * 24 * 60 + this.gameTime;
        const expenseResult = addExpense(
          this.economyState,
          cost,
          "equipment_purchase",
          `Amenity: ${upgrade.type}`,
          timestamp,
          false
        );
        if (expenseResult) {
          this.economyState = expenseResult;
          this.dailyStats.expenses.other += cost;
        }
        this.amenityPanel?.update(this.prestigeState, this.economyState.cash);
        this.uiManager.showNotification(`Purchased ${upgrade.type} upgrade!`);
        return true;
      },
      onClose: () => {
        this.amenityPanel?.hide();
      },
    });
  }

  private setupWalkOnQueuePanel(): void {
    const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "WalkOnQueueUI",
      true,
      this.babylonEngine.getScene()
    );

    this.walkOnQueuePanel = new WalkOnQueuePanel(uiTexture, {
      onAssignToSlot: (_golferId: string) => {
        this.uiManager.showNotification(
          `Assigned golfer to next available slot`
        );
        this.walkOnQueuePanel?.update(this.walkOnState);
      },
      onTurnAway: (golferId: string) => {
        const golfer = this.walkOnState.queue.find(
          (g) => g.golferId === golferId
        );
        if (golfer) {
          golfer.status = "turned_away";
          this.walkOnState.metrics.walkOnsTurnedAwayToday++;
          this.walkOnQueuePanel?.update(this.walkOnState);
          this.uiManager.showNotification(`Turned away ${golfer.name}`);
        }
      },
      onClose: () => {
        this.walkOnQueuePanel?.hide();
      },
    });
  }

  private setupIrrigationUI(): void {
    const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "IrrigationUI",
      true,
      this.babylonEngine.getScene()
    );

    this.irrigationToolbar = new IrrigationToolbar(uiTexture, {
      onToolSelect: () => {
        // Tool selection handling
      },
      onPipeTypeSelect: () => {
        // Pipe type selection
      },
      onSprinklerTypeSelect: () => {
        // Sprinkler type selection
      },
      onClose: () => {
        this.irrigationToolbar?.hide();
      },
    });

    this.irrigationInfoPanel = new IrrigationInfoPanel(uiTexture, {
      onClose: () => {
        this.irrigationInfoPanel?.hide();
      },
      onRepair: (x, y) => {
        const result = repairLeak(this.irrigationSystem, x, y);
        if (result) {
          this.irrigationSystem = result;
          this.irrigationRenderSystem?.update(this.irrigationSystem);
        }
      },
    });

    this.irrigationSchedulePanel = new IrrigationSchedulePanel(uiTexture, {
      onClose: () => {
        this.irrigationSchedulePanel?.hide();
      },
    });
  }

  private setupPriceCallback(): void {
    this.uiManager.setPriceCallback((delta: number) => {
      const newPrice = Math.max(
        5,
        Math.min(500, this.greenFees.weekday18Holes + delta)
      );
      if (newPrice !== this.greenFees.weekday18Holes) {
        this.greenFees = {
          ...this.greenFees,
          weekday18Holes: newPrice,
          weekday9Holes: Math.round(newPrice * 0.6),
          weekend18Holes: Math.round(newPrice * 1.2),
          weekend9Holes: Math.round(newPrice * 0.72),
          twilight18Holes: Math.round(newPrice * 0.6),
          twilight9Holes: Math.round(newPrice * 0.36),
        };
        this.uiManager.updateCurrentPrice(newPrice);
      }
    });
    this.uiManager.updateCurrentPrice(this.greenFees.weekday18Holes);
  }

  private resetDailyStats(): void {
    const courseStats = this.grassSystem.getCourseStats();
    this.dailyStats = {
      revenue: { greenFees: 0, tips: 0, addOns: 0, other: 0 },
      expenses: { wages: 0, supplies: 0, research: 0, utilities: 0, other: 0 },
      golfersServed: 0,
      totalSatisfaction: 0,
      courseHealthStart: courseStats.health,
      prestigeStart: this.prestigeState.currentScore,
      maintenance: {
        tasksCompleted: 0,
        tilesMowed: 0,
        tilesWatered: 0,
        tilesFertilized: 0,
      },
    };
  }

  private showDaySummary(): void {
    const courseStats = this.grassSystem.getCourseStats();
    const avgSatisfaction =
      this.dailyStats.golfersServed > 0
        ? this.dailyStats.totalSatisfaction / this.dailyStats.golfersServed
        : 0;

    const summaryData: DaySummaryData = {
      day: this.gameDay,
      revenue: { ...this.dailyStats.revenue },
      expenses: { ...this.dailyStats.expenses },
      courseHealth: {
        start: this.dailyStats.courseHealthStart,
        end: courseStats.health,
        change: courseStats.health - this.dailyStats.courseHealthStart,
      },
      golfers: {
        totalServed: this.dailyStats.golfersServed,
        averageSatisfaction: avgSatisfaction,
        tipsEarned: this.dailyStats.revenue.tips,
      },
      prestige: {
        score: this.prestigeState.currentScore,
        change: this.prestigeState.currentScore - this.dailyStats.prestigeStart,
      },
      maintenance: { ...this.dailyStats.maintenance },
    };

    this.daySummaryPopup?.show(summaryData);
    this.pauseGame();
  }

  public saveCurrentGame(): void {
    if (!this.currentScenario || !this.scenarioManager) return;

    const cells = this.grassSystem.getAllCells();
    const scenarioProgress = this.scenarioManager.getProgress();
    const state = createSaveState(
      this.currentScenario.id,
      this.gameTime,
      this.gameDay,
      this.player.gridX,
      this.player.gridY,
      this.score,
      this.economyState,
      this.employeeRoster,
      this.employeeWorkState,
      this.golferPool,
      this.researchState,
      this.prestigeState,
      this.teeTimeState,
      this.walkOnState,
      this.revenueState,
      this.marketingState,
      this.applicationState,
      scenarioProgress,
      this.autonomousState,
      this.weatherState,
      cells,
      this.irrigationSystem
    );

    if (saveGame(state)) {
      this.uiManager.showNotification("Game saved");
    }
  }

  private loadSavedGame(): boolean {
    if (!this.currentScenario) return false;

    const saved = loadGame(this.currentScenario.id);
    if (!saved) return false;

    this.gameTime = saved.gameTime;
    this.gameDay = saved.gameDay;
    this.player = teleportEntity(this.player, saved.playerX, saved.playerY);
    this.score = saved.score;
    this.economyState = saved.economyState;
    this.employeeRoster = saved.employeeRoster;
    if (saved.employeeWorkState) {
      this.employeeWorkState = saved.employeeWorkState;
    } else {
      this.employeeWorkState = syncWorkersWithRoster(
        this.employeeWorkState,
        this.employeeRoster.employees
      );
    }
    this.golferPool = saved.golferPool;
    this.researchState = saved.researchState;
    this.prestigeState = saved.prestigeState;
    // Reconstruct teeTimes Map from saved data (Map doesn't serialize to JSON properly)
    const teeTimesData = saved.teeTimeState.teeTimes;
    const reconstructedTeeTimes = teeTimesData instanceof Map
      ? teeTimesData
      : new Map(Object.entries(teeTimesData || {}).map(([k, v]) => [Number(k), v as import('../core/tee-times').TeeTime[]]));
    this.teeTimeState = {
      ...saved.teeTimeState,
      teeTimes: reconstructedTeeTimes,
    };
    this.walkOnState = saved.walkOnState;
    this.revenueState = saved.revenueState;
    this.marketingState = saved.marketingState;
    this.applicationState =
      saved.applicationState ||
      createInitialApplicationState(
        this.gameTime + this.gameDay * 24 * 60,
        this.prestigeState.tier
      );

    if (saved.scenarioProgress && this.scenarioManager) {
      this.scenarioManager.updateProgress(saved.scenarioProgress);
    }

    if (saved.autonomousState) {
      this.autonomousState = saved.autonomousState;
    }

    if (saved.weatherState) {
      this.weatherState = saved.weatherState;
      this.weather = this.weatherState.current;
    }

    if (saved.cells && saved.cells.length > 0) {
      this.grassSystem.restoreCells(saved.cells);
    }

    if (saved.irrigationSystem) {
      this.irrigationSystem = saved.irrigationSystem;
      if (this.irrigationRenderSystem) {
        this.irrigationRenderSystem.update(this.irrigationSystem);
      }
    }

    return true;
  }

  public hasSavedGame(): boolean {
    if (!this.currentScenario) return false;
    return hasSave(this.currentScenario.id);
  }

  private setupInputCallbacks(): void {
    this.inputManager.setCallbacks({
      // Core movement - use public API for consistency
      onMove: (direction: Direction) => {
        const dirMap: Record<Direction, "up" | "down" | "left" | "right"> = {
          up: "up",
          down: "down",
          left: "left",
          right: "right",
        };
        this.movePlayer(dirMap[direction]);
      },

      // Equipment control - use public API
      onEquipmentSelect: (slot: EquipmentSlot) => {
        this.selectEquipment(slot);
      },

      onEquipmentToggle: () => {
        this.toggleEquipment();
      },

      // Other handlers remain private as they're more complex
      onRefill: () => this.handleRefill(),
      onOverlayCycle: () => this.handleOverlayCycle(),
      onPause: () => this.handlePause(),
      onMute: () => this.handleMute(),
      onTimeSpeedUp: () => this.handleTimeSpeed(1),
      onTimeSlowDown: () => this.handleTimeSpeed(-1),
      onZoomIn: () => this.handleZoom(1),
      onZoomOut: () => this.handleZoom(-1),
      onDebugReload: () => this.handleDebugReload(),
      onDebugExport: () => this.handleDebugExport(),
      onClick: (screenX: number, screenY: number) =>
        this.handleClick(screenX, screenY),

      // Terrain editor - use public API where available
      onEditorToggle: () => {
        this.setTerrainEditor(!this.isTerrainEditorEnabled());
      },

      onEditorToolSelect: (tool: number) => this.handleEditorToolNumber(tool),
      onEditorBrushSelect: (brush: string) =>
        this.handleEditorBrushSelect(brush),
      onEditorBrushSizeChange: (delta: number) =>
        this.handleEditorBrushSize(delta),

      onUndo: () => {
        this.undoTerrainEdit();
      },

      onRedo: () => {
        this.redoTerrainEdit();
      },

      onMouseMove: (screenX: number, screenY: number) =>
        this.handleMouseMove(screenX, screenY),
      onDragStart: (screenX: number, screenY: number) =>
        this.handleDragStart(screenX, screenY),
      onDrag: (screenX: number, screenY: number) =>
        this.handleDrag(screenX, screenY),
      onDragEnd: () => this.handleDragEnd(),
      onEmployeePanel: () => this.handleEmployeePanel(),
      onResearchPanel: () => this.handleResearchPanel(),
      onTeeSheetPanel: () => this.handleTeeSheetPanel(),
      onMarketingPanel: () => this.handleMarketingPanel(),
      onEquipmentStore: () => this.handleEquipmentStore(),
      onAmenityPanel: () => this.handleAmenityPanel(),
      onWalkOnQueuePanel: () => this.handleWalkOnQueuePanel(),
      isInputBlocked: () => this.isAnyPopupOpen(),
    });
  }

  private isAnyPopupOpen(): boolean {
    return (
      (this.employeePanel?.isVisible() ||
        this.researchPanel?.isVisible() ||
        this.teeSheetPanel?.isVisible() ||
        this.marketingDashboard?.isVisible() ||
        this.equipmentStorePanel?.isVisible() ||
        this.amenityPanel?.isVisible() ||
        this.walkOnQueuePanel?.isVisible() ||
        this.daySummaryPopup?.isVisible() ||
        this.uiManager.isPauseMenuVisible()) ??
      false
    );
  }

  private buildScene(): void {
    this.grassSystem.build();
    this.buildObstacles();
    this.buildRefillStations();
    this.createPlayer();
    this.babylonEngine.setZoomLevel(this.zoomLevel);
    this.updatePlayerPosition();
  }

  private buildObstacles(): void {
    const { obstacles } = this.currentCourse;
    if (!obstacles) return;

    for (const obs of obstacles) {
      const pos = this.grassSystem.gridToWorld(obs.x, obs.y);

      if (obs.type === 1 || obs.type === 2) {
        this.createTree(pos.x, pos.y, pos.z, obs.type === 2);
      }
    }
  }

  private createTree(x: number, y: number, z: number, isPine: boolean): void {
    const scene = this.babylonEngine.getScene();
    const trunkHeight = isPine ? 1.5 : 1.0;
    const trunkDiameter = 0.15;
    const foliageSize = isPine ? 0.6 : 1.0;

    const trunk = MeshBuilder.CreateCylinder(
      "trunk",
      { height: trunkHeight, diameter: trunkDiameter },
      scene
    );
    trunk.position = new Vector3(x, y + trunkHeight / 2, z);
    const trunkMat = new StandardMaterial("trunkMat", scene);
    trunkMat.diffuseColor = new Color3(0.35, 0.22, 0.1);
    trunkMat.emissiveColor = new Color3(0.18, 0.11, 0.05);
    trunk.material = trunkMat;
    this.obstacleMeshes.push(trunk);

    if (isPine) {
      for (let layer = 0; layer < 3; layer++) {
        const layerSize = foliageSize - layer * 0.15;
        const cone = MeshBuilder.CreateCylinder(
          "foliage",
          {
            height: layerSize,
            diameterTop: 0,
            diameterBottom: layerSize,
          },
          scene
        );
        cone.position = new Vector3(
          x,
          y + trunkHeight + layer * 0.4 + layerSize / 2,
          z
        );
        const foliageMat = new StandardMaterial("foliageMat", scene);
        foliageMat.diffuseColor = new Color3(0.15, 0.45, 0.15);
        foliageMat.emissiveColor = new Color3(0.08, 0.23, 0.08);
        cone.material = foliageMat;
        this.obstacleMeshes.push(cone);
      }
    } else {
      const sphere = MeshBuilder.CreateSphere(
        "foliage",
        { diameter: foliageSize },
        scene
      );
      sphere.position = new Vector3(x, y + trunkHeight + foliageSize / 2, z);
      const foliageMat = new StandardMaterial("foliageMat", scene);
      foliageMat.diffuseColor = new Color3(0.2, 0.5, 0.2);
      foliageMat.emissiveColor = new Color3(0.1, 0.25, 0.1);
      sphere.material = foliageMat;
      this.obstacleMeshes.push(sphere);
    }
  }

  private buildRefillStations(): void {
    const scene = this.babylonEngine.getScene();

    for (const station of REFILL_STATIONS) {
      const pos = this.grassSystem.gridToWorld(station.x, station.y);

      const base = MeshBuilder.CreateBox(
        "refillBase",
        { width: 0.8, height: 0.4, depth: 0.6 },
        scene
      );
      base.position = new Vector3(pos.x, pos.y + 0.2, pos.z);
      const baseMat = new StandardMaterial("baseMat", scene);
      baseMat.diffuseColor = new Color3(0.55, 0.27, 0.07);
      baseMat.emissiveColor = new Color3(0.28, 0.14, 0.04);
      base.material = baseMat;
      this.obstacleMeshes.push(base);

      const roof = MeshBuilder.CreateBox(
        "refillRoof",
        { width: 1.0, height: 0.1, depth: 0.8 },
        scene
      );
      roof.position = new Vector3(pos.x, pos.y + 0.7, pos.z);
      const roofMat = new StandardMaterial("roofMat", scene);
      roofMat.diffuseColor = new Color3(0.61, 0.33, 0.12);
      roofMat.emissiveColor = new Color3(0.31, 0.17, 0.06);
      roof.material = roofMat;
      this.obstacleMeshes.push(roof);

      const pump = MeshBuilder.CreateBox(
        "pump",
        { width: 0.25, height: 0.5, depth: 0.2 },
        scene
      );
      pump.position = new Vector3(pos.x, pos.y + 0.25, pos.z + 0.15);
      const pumpMat = new StandardMaterial("pumpMat", scene);
      pumpMat.diffuseColor = new Color3(0.4, 0.4, 0.45);
      pumpMat.emissiveColor = new Color3(0.2, 0.2, 0.23);
      pump.material = pumpMat;
      this.obstacleMeshes.push(pump);

      const blueDot = MeshBuilder.CreateSphere(
        "blueDot",
        { diameter: 0.12 },
        scene
      );
      blueDot.position = new Vector3(pos.x - 0.08, pos.y + 0.35, pos.z + 0.26);
      const blueMat = new StandardMaterial("blueMat", scene);
      blueMat.diffuseColor = new Color3(0.2, 0.4, 0.8);
      blueMat.emissiveColor = new Color3(0.1, 0.2, 0.4);
      blueDot.material = blueMat;
      this.obstacleMeshes.push(blueDot);

      const redDot = MeshBuilder.CreateSphere(
        "redDot",
        { diameter: 0.12 },
        scene
      );
      redDot.position = new Vector3(pos.x + 0.08, pos.y + 0.35, pos.z + 0.26);
      const redMat = new StandardMaterial("redMat", scene);
      redMat.diffuseColor = new Color3(0.8, 0.2, 0.2);
      redMat.emissiveColor = new Color3(0.4, 0.1, 0.1);
      redDot.material = redMat;
      this.obstacleMeshes.push(redDot);
    }
  }

  private createPlayer(): void {
    const scene = this.babylonEngine.getScene();
    this.playerVisual = createEntityMesh(
      scene,
      "player",
      PLAYER_APPEARANCE,
      this.player.gridX,
      this.player.gridY,
      { getElevationAt: (x, y, d) => this.grassSystem.getElevationAt(x, y, d) }
    );
  }

  public teleport(x: number, y: number): void {
    const course = this.currentCourse;
    if (x < 0 || x >= course.width || y < 0 || y >= course.height) {
      console.warn(`Teleport target (${x}, ${y}) is out of bounds.`);
      return;
    }

    this.player = teleportEntity(this.player, x, y);

    if (this.playerVisual) {
      this.playerVisual.lastGridX = x;
      this.playerVisual.lastGridY = y;
      this.playerVisual.targetGridX = x;
      this.playerVisual.targetGridY = y;
      this.playerVisual.visualProgress = 1;
    }

    this.updatePlayerPosition();
  }

  private updatePlayerPosition(): void {
    if (!this.playerVisual) return;

    const worldPos = this.grassSystem.gridToWorld(
      this.player.gridX,
      this.player.gridY
    );
    this.playerVisual.container.position = worldPos.clone();

    if (this.cameraFollowPlayer) {
      this.babylonEngine.setCameraTarget(worldPos);
    }
  }

  private isPlayerMoving(): boolean {
    return this.playerVisual !== null && this.playerVisual.visualProgress < 1;
  }

  private updateMovement(deltaMs: number): void {
    if (!this.playerVisual) return;

    const wasMoving = this.isPlayerMoving();

    this.updatePlayerVisualProgress(deltaMs);

    if (this.cameraFollowPlayer) {
      this.babylonEngine.setCameraTarget(this.playerVisual.container.position);
    }

    if (wasMoving && !this.isPlayerMoving()) {
      this.checkContinuousMovement();
    }
  }

  private updatePlayerVisualProgress(deltaMs: number): void {
    if (!this.playerVisual) return;

    const isMoving = this.playerVisual.visualProgress < 1 ||
      this.playerVisual.targetGridX !== this.player.gridX ||
      this.playerVisual.targetGridY !== this.player.gridY;

    updateEntityVisualPosition(
      this.playerVisual,
      this.playerVisual.targetGridX,
      this.playerVisual.targetGridY,
      isMoving ? this.player.gridX : null,
      isMoving ? this.player.gridY : null,
      deltaMs,
      this.grassSystem
    );
  }

  private checkContinuousMovement(): void {
    if (this.player.path.length > 0) {
      const next = this.player.path[0];
      this.player = { ...this.player, path: this.player.path.slice(1) };
      this.startMoveTo(next.x, next.y);
      return;
    }

    if (
      this.player.pendingDirection &&
      this.isDirectionKeyHeld(this.player.pendingDirection)
    ) {
      this.tryMove(this.player.pendingDirection);
    } else {
      this.player = { ...this.player, pendingDirection: null };
    }
  }

  private isDirectionKeyHeld(direction: Direction): boolean {
    switch (direction) {
      case "up":
        return (
          this.inputManager.isKeyDown("arrowup") ||
          this.inputManager.isKeyDown("w")
        );
      case "down":
        return (
          this.inputManager.isKeyDown("arrowdown") ||
          this.inputManager.isKeyDown("s")
        );
      case "left":
        return (
          this.inputManager.isKeyDown("arrowleft") ||
          this.inputManager.isKeyDown("a")
        );
      case "right":
        return (
          this.inputManager.isKeyDown("arrowright") ||
          this.inputManager.isKeyDown("d")
        );
    }
  }

  private handleMove(direction: Direction): void {
    if (this.isPaused) return;

    this.player = { ...this.player, pendingDirection: direction, path: [] };

    if (!this.isPlayerMoving()) {
      this.tryMove(direction);
    }
  }

  private tryMove(direction: Direction): boolean {
    const course = this.currentCourse;
    let newX = this.player.gridX;
    let newY = this.player.gridY;

    switch (direction) {
      case "up":
        newX--;
        break;
      case "down":
        newX++;
        break;
      case "left":
        newY--;
        break;
      case "right":
        newY++;
        break;
    }

    if (newX < 0 || newX >= course.width || newY < 0 || newY >= course.height) {
      return false;
    }

    const fromCell = this.grassSystem.getCell(
      this.player.gridX,
      this.player.gridY
    );
    const toCell = this.grassSystem.getCell(newX, newY);

    if (!canMoveFromTo(fromCell, toCell)) {
      return false;
    }

    this.startMoveTo(newX, newY);
    return true;
  }

  private startMoveTo(newX: number, newY: number): void {
    this.player = { ...this.player, gridX: newX, gridY: newY };

    if (this.equipmentManager.isActive()) {
      this.applyEquipmentEffect(newX, newY);
    }
  }

  private handleClick(screenX: number, screenY: number): void {
    if (this.isPaused) return;

    const gridPos = this.screenToGridFromScreen(screenX, screenY);
    if (!gridPos) return;

    if (this.terrainEditorSystem?.isEnabled()) {
      this.terrainEditorSystem.handleClick();
      return;
    }

    const course = this.currentCourse;
    if (
      gridPos.x < 0 ||
      gridPos.x >= course.width ||
      gridPos.y < 0 ||
      gridPos.y >= course.height
    ) {
      return;
    }

    const targetCell = this.grassSystem.getCell(gridPos.x, gridPos.y);
    if (!targetCell || targetCell.type === "water") return;

    if (gridPos.x === this.player.gridX && gridPos.y === this.player.gridY) {
      return;
    }

    const path = this.findPath(
      this.player.gridX,
      this.player.gridY,
      gridPos.x,
      gridPos.y
    );
    if (path.length > 0) {
      this.player = setEntityPath(this.player, path);
      this.player = { ...this.player, pendingDirection: null };
      if (!this.isPlayerMoving()) {
        this.checkContinuousMovement();
      }
    }
  }

  private screenToGridFromScreen(
    screenX: number,
    screenY: number
  ): { x: number; y: number } | null {
    const scene = this.babylonEngine.getScene();
    const canvas = scene.getEngine().getRenderingCanvas();
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (screenX - rect.left) * scaleX;
    const canvasY = (screenY - rect.top) * scaleY;

    const pickResult = scene.pick(canvasX, canvasY, (mesh) => {
      return mesh.name.startsWith("tile_");
    });

    if (pickResult?.hit && pickResult.pickedMesh) {
      const match = pickResult.pickedMesh.name.match(/^tile_(\d+)_(\d+)/);
      if (match) {
        return { x: parseInt(match[1]), y: parseInt(match[2]) };
      }
    }

    return this.raycastToGround(canvasX, canvasY);
  }

  private raycastToGround(
    canvasX: number,
    canvasY: number
  ): { x: number; y: number } | null {
    const scene = this.babylonEngine.getScene();
    const camera = this.babylonEngine.getCamera();
    const ray = scene.createPickingRay(canvasX, canvasY, null, camera);

    if (ray.direction.y === 0) return null;

    const t = -ray.origin.y / ray.direction.y;
    if (t < 0) return null;

    const groundX = ray.origin.x + ray.direction.x * t;
    const groundZ = ray.origin.z + ray.direction.z * t;

    const gridX = Math.floor(groundX);
    const gridY = Math.floor(groundZ);

    const course = this.currentCourse;
    if (
      gridX < 0 ||
      gridX >= course.width ||
      gridY < 0 ||
      gridY >= course.height
    ) {
      return null;
    }

    return { x: gridX, y: gridY };
  }

  private findPath(
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): { x: number; y: number }[] {
    interface PathNode {
      x: number;
      y: number;
      g: number;
      h: number;
      f: number;
      parent: PathNode | null;
    }

    const course = this.currentCourse;
    const openSet: PathNode[] = [];
    const closedSet = new Set<string>();

    const heuristic = (x: number, y: number) =>
      Math.abs(x - endX) + Math.abs(y - endY);

    openSet.push({
      x: startX,
      y: startY,
      g: 0,
      h: heuristic(startX, startY),
      f: heuristic(startX, startY),
      parent: null,
    });

    while (openSet.length > 0) {
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift()!;

      if (current.x === endX && current.y === endY) {
        const path: { x: number; y: number }[] = [];
        let node = current;
        while (node.parent) {
          path.unshift({ x: node.x, y: node.y });
          node = node.parent;
        }
        return path;
      }

      closedSet.add(`${current.x},${current.y}`);

      const neighbors = [
        { x: current.x, y: current.y - 1 },
        { x: current.x, y: current.y + 1 },
        { x: current.x - 1, y: current.y },
        { x: current.x + 1, y: current.y },
      ];

      for (const neighbor of neighbors) {
        if (
          neighbor.x < 0 ||
          neighbor.x >= course.width ||
          neighbor.y < 0 ||
          neighbor.y >= course.height
        )
          continue;
        if (closedSet.has(`${neighbor.x},${neighbor.y}`)) continue;

        const fromCell = this.grassSystem.getCell(current.x, current.y);
        const toCell = this.grassSystem.getCell(neighbor.x, neighbor.y);
        if (!canMoveFromTo(fromCell, toCell)) continue;

        const g = current.g + 1;
        const h = heuristic(neighbor.x, neighbor.y);
        const f = g + h;

        const existing = openSet.find(
          (n) => n.x === neighbor.x && n.y === neighbor.y
        );
        if (existing) {
          if (g < existing.g) {
            existing.g = g;
            existing.f = f;
            existing.parent = current;
          }
        } else {
          openSet.push({
            x: neighbor.x,
            y: neighbor.y,
            g,
            h,
            f,
            parent: current,
          });
        }
      }
    }

    return [];
  }

  private applyEquipmentEffect(x: number, y: number): void {
    const type = this.equipmentManager.getSelected();
    const state = this.equipmentManager.getCurrentState();
    if (!type || !state) return;

    switch (type) {
      case "mower":
        this.grassSystem.mowAt(x, y);
        break;
      case "sprinkler":
        this.grassSystem.waterArea(x, y, state.effectRadius, 15);
        break;
      case "spreader":
        const fertilizerEffectiveness = getBestFertilizerEffectiveness(
          this.researchState
        );
        this.grassSystem.fertilizeArea(
          x,
          y,
          state.effectRadius,
          10,
          fertilizerEffectiveness
        );
        break;
    }
  }


  private handleRefill(): void {
    const nearStation = REFILL_STATIONS.some((station) => {
      const dx = Math.abs(station.x - this.player.gridX);
      const dy = Math.abs(station.y - this.player.gridY);
      return dx <= 2 && dy <= 2;
    });

    if (nearStation) {
      const cost = this.equipmentManager.refill();
      if (cost > 0) {
        const timestamp = this.gameDay * 1440 + this.gameTime;
        const expenseResult = addExpense(
          this.economyState,
          cost,
          "supplies",
          "Equipment refill",
          timestamp,
          true
        );
        if (expenseResult) {
          this.economyState = expenseResult;
          this.dailyStats.expenses.supplies += cost;
        }
        this.uiManager.showNotification(`Refilled! Cost: $${cost.toFixed(2)}`);
      } else {
        this.uiManager.showNotification("Equipment already full!");
      }
    } else {
      this.uiManager.showNotification("Move closer to refill station");
    }
  }

  private handleOverlayCycle(): void {
    const mode = this.grassSystem.cycleOverlayMode();
    this.uiManager.updateOverlayLegend(mode);
    this.overlayAutoSwitched = false;
    this.updateIrrigationVisibility();
  }

  private updateIrrigationVisibility(): void {
    if (this.irrigationRenderSystem) {
      const overlayMode = this.grassSystem.getOverlayMode();
      this.irrigationRenderSystem.setVisible(overlayMode === "irrigation");
    }
  }

  private handlePause(): void {
    if (this.isPaused) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

  private handleEmployeePanel(): void {
    if (this.employeePanel?.isVisible()) {
      this.employeePanel.hide();
    } else {
      const currentTime = this.gameTime + this.gameDay * 24 * 60;
      this.employeePanel?.update(this.employeeRoster);
      this.employeePanel?.updateApplications(
        this.applicationState,
        this.prestigeState.tier,
        currentTime
      );
      this.employeePanel?.show();
    }
  }

  private handleResearchPanel(): void {
    if (this.researchPanel?.isVisible()) {
      this.researchPanel.hide();
    } else {
      this.researchPanel?.update(this.researchState);
      this.researchPanel?.show();
    }
  }

  private handleTeeSheetPanel(): void {
    if (this.teeSheetPanel?.isVisible()) {
      this.teeSheetPanel.hide();
    } else {
      this.teeSheetViewDay = this.gameDay;
      this.teeSheetPanel?.update(this.teeTimeState, this.teeSheetViewDay);
      this.teeSheetPanel?.show();
    }
  }

  private handleMarketingPanel(): void {
    if (this.marketingDashboard?.isVisible()) {
      this.marketingDashboard.hide();
    } else {
      this.marketingDashboard?.update(
        this.marketingState,
        this.gameDay,
        this.economyState.cash
      );
      this.marketingDashboard?.show();
    }
  }

  private handleEquipmentStore(): void {
    if (this.equipmentStorePanel?.isVisible()) {
      this.equipmentStorePanel.hide();
    } else {
      this.equipmentStorePanel?.update(
        this.researchState,
        this.autonomousState,
        this.economyState.cash
      );
      this.equipmentStorePanel?.show();
    }
  }

  private handleAmenityPanel(): void {
    if (this.amenityPanel?.isVisible()) {
      this.amenityPanel.hide();
    } else {
      this.amenityPanel?.update(this.prestigeState, this.economyState.cash);
      this.amenityPanel?.show();
    }
  }

  private handleWalkOnQueuePanel(): void {
    if (this.walkOnQueuePanel?.isVisible()) {
      this.walkOnQueuePanel.hide();
    } else {
      this.walkOnQueuePanel?.update(this.walkOnState);
      this.walkOnQueuePanel?.show();
    }
  }

  private pauseGame(): void {
    this.isPaused = true;
    this.uiManager.showPauseMenu(
      () => this.resumeGame(),
      () => this.restartGame(),
      this.gameOptions.onReturnToMenu ? () => this.returnToMenu() : undefined,
      () => this.saveCurrentGame(),
      () => this.handleEmployeePanel(),
      () => this.handleResearchPanel(),
      () => this.handleTeeSheetPanel(),
      () => this.handleMarketingPanel(),
      (delta: number) => this.handleTimeSpeed(delta),
      this.timeScale
    );
  }

  private resumeGame(): void {
    this.isPaused = false;
    this.uiManager.hidePauseMenu();
  }

  private restartGame(): void {
    const course = this.currentCourse;
    const startX = Math.floor(course.width / 2);
    const startY = Math.floor(course.height * 0.75);
    this.player = teleportEntity(this.player, startX, startY);
    this.gameTime = 6 * 60;
    this.gameDay = 1;
    this.score = 0;
    this.timeScale = 1;
    this.weatherState = createInitialWeatherState(this.gameDay);
    this.weather = this.weatherState.current;
    this.equipmentManager.refill();
    this.grassSystem.dispose();
    this.grassSystem = new GrassSystem(this.babylonEngine.getScene(), course);
    this.grassSystem.build();
    this.updatePlayerPosition();
    this.resumeGame();
    this.uiManager.showNotification("Game Restarted");
  }

  private returnToMenu(): void {
    this.saveCurrentGame();
    if (this.gameOptions.onReturnToMenu) {
      this.gameOptions.onReturnToMenu();
    }
  }

  private handleMute(): void {
    this.isMuted = !this.isMuted;
  }

  private handleTimeSpeed(delta: number): void {
    const speeds = [0.5, 1, 2, 4, 8];
    const currentIndex = speeds.indexOf(this.timeScale);
    const newIndex = Math.max(
      0,
      Math.min(speeds.length - 1, currentIndex + delta)
    );
    this.timeScale = speeds[newIndex];
  }

  private handleZoom(_delta: number): void {
    this.zoomLevel = this.zoomLevel === "close" ? "far" : "close";
    this.babylonEngine.setZoomLevel(this.zoomLevel);
  }

  private handleEditorToggle(): void {
    this.terrainEditorSystem?.toggle();
  }

  private handleEditorToolSelect(tool: EditorTool): void {
    this.terrainEditorSystem?.setTool(tool);
  }

  private handleEditorToolNumber(toolNumber: number): void {
    if (!this.terrainEditorSystem?.isEnabled()) return;

    const tools: EditorTool[] = ["raise", "lower", "flatten", "smooth"];
    if (toolNumber >= 1 && toolNumber <= tools.length) {
      this.terrainEditorSystem.setTool(tools[toolNumber - 1]);
    }
  }

  private handleEditorBrushSelect(brush: string): void {
    if (!this.terrainEditorSystem?.isEnabled()) return;

    if (brush.startsWith("terrain_")) {
      this.terrainEditorSystem.setTool(brush as EditorTool);
    }
  }

  private handleEditorBrushSize(delta: number): void {
    this.terrainEditorSystem?.changeBrushSize(delta);
  }

  private handleEditorUndo(): void {
    this.terrainEditorSystem?.undo();
  }

  private handleEditorRedo(): void {
    this.terrainEditorSystem?.redo();
  }

  private handleEditorExport(): void {
    if (!this.terrainEditorSystem) return;

    const json = this.terrainEditorSystem.exportToJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "terrain_export.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.uiManager.showNotification("Terrain exported!");
  }

  private handleMouseMove(screenX: number, screenY: number): void {
    if (!this.terrainEditorSystem?.isEnabled()) return;

    const gridPos = this.screenToGridFromScreen(screenX, screenY);
    if (gridPos) {
      this.terrainEditorSystem.handleMouseMove(gridPos.x, gridPos.y);

      const hoverInfo = this.terrainEditorSystem.getHoverInfo();
      if (hoverInfo) {
        this.terrainEditorUI?.updateCoordinates(
          hoverInfo.x,
          hoverInfo.y,
          hoverInfo.elevation,
          hoverInfo.type
        );
      } else {
        this.terrainEditorUI?.clearCoordinates();
      }
    }
  }

  private handleDragStart(screenX: number, screenY: number): void {
    if (!this.terrainEditorSystem?.isEnabled()) return;

    const gridPos = this.screenToGridFromScreen(screenX, screenY);
    if (gridPos) {
      this.terrainEditorSystem.handleDragStart(gridPos.x, gridPos.y);
    }
  }

  private handleDrag(screenX: number, screenY: number): void {
    if (!this.terrainEditorSystem?.isEnabled()) return;

    const gridPos = this.screenToGridFromScreen(screenX, screenY);
    if (gridPos) {
      this.terrainEditorSystem.handleDrag(gridPos.x, gridPos.y);
    }
  }

  private handleDragEnd(): void {
    if (!this.terrainEditorSystem?.isEnabled()) return;
    this.terrainEditorSystem.handleDragEnd();
  }

  private handleDebugReload(): void {
    window.location.reload();
  }

  private handleDebugExport(): void {
    const state = {
      playerX: this.player.gridX,
      playerY: this.player.gridY,
      gameTime: this.gameTime,
      gameDay: this.gameDay,
      score: this.score,
    };
    console.log("Game State:", JSON.stringify(state, null, 2));
    console.log("Base64:", btoa(JSON.stringify(state)));
  }

  private setupUpdateLoop(): void {
    this.lastTime = performance.now();
    const course = this.currentCourse;

    const stats = this.grassSystem.getCourseStats();
    this.uiManager.updateCourseStatus(
      stats.health,
      stats.moisture,
      stats.nutrients
    );
    this.uiManager.updateMinimapPlayerPosition(
      this.player.gridX,
      this.player.gridY,
      course.width,
      course.height
    );

    this.babylonEngine.getScene().onBeforeRenderObservable.add(() => {
      if (this.isPaused) {
        this.lastTime = performance.now();
        return;
      }

      const now = performance.now();
      const deltaMs = now - this.lastTime;
      this.lastTime = now;

      this.updateMovement(deltaMs);

      if (this.playerVisual) {
        const wasDeactivated = this.equipmentManager.update(
          deltaMs,
          this.playerVisual.container.position
        );
        if (wasDeactivated) {
          if (this.overlayAutoSwitched) {
            this.grassSystem.setOverlayMode("normal");
            this.uiManager.updateOverlayLegend("normal");
            this.overlayAutoSwitched = false;
            this.updateIrrigationVisibility();
          }
        }
      }

      this.gameTime += (deltaMs / 1000) * 2 * this.timeScale;
      if (this.gameTime >= 24 * 60) {
        this.gameTime -= 24 * 60;

        // Take daily snapshot for historical tracking
        const snapshot = takeDailySnapshot(
          this.prestigeState.currentConditions,
          this.gameDay
        );
        this.prestigeState = {
          ...this.prestigeState,
          historicalExcellence: updateHistoricalExcellence(
            this.prestigeState.historicalExcellence,
            snapshot
          ),
        };

        this.gameDay++;
      }

      this.grassSystem.update(
        deltaMs * this.timeScale,
        this.gameDay * 1440 + this.gameTime,
        this.weather
      );

      // Update economy and management systems
      this.updateEconomySystems(deltaMs);

      // Check tutorial hints
      this.checkTutorialHints();

      // Check scenario objectives periodically
      if (this.scenarioManager && Math.random() < 0.01) {
        this.checkScenarioCompletion();
      }

      this.updateDayNightCycle();

      const hours = Math.floor(this.gameTime / 60);
      const minutes = Math.floor(this.gameTime % 60);
      const season = getSeasonFromDay(this.gameDay).season;
      this.uiManager.updateTime(hours, minutes, this.gameDay, season);
      this.uiManager.updateWeather(this.weather.type, this.weather.temperature);
      this.uiManager.updateEquipment(
        this.equipmentManager.getSelected(),
        this.equipmentManager.isActive()
      );

      const mowerState = this.equipmentManager.getState("mower");
      const sprinklerState = this.equipmentManager.getState("sprinkler");
      const spreaderState = this.equipmentManager.getState("spreader");
      this.uiManager.updateResources(
        mowerState
          ? (mowerState.resourceCurrent / mowerState.resourceMax) * 100
          : 100,
        sprinklerState
          ? (sprinklerState.resourceCurrent / sprinklerState.resourceMax) * 100
          : 100,
        spreaderState
          ? (spreaderState.resourceCurrent / spreaderState.resourceMax) * 100
          : 100
      );

      const courseStats = this.grassSystem.getCourseStats();
      this.uiManager.updateCourseStatus(
        courseStats.health,
        courseStats.moisture,
        courseStats.nutrients
      );
      this.uiManager.updateScore(this.score);
      this.uiManager.updateEconomy(
        this.economyState.cash,
        getActiveGolferCount(this.golferPool),
        getAverageSatisfaction(this.golferPool)
      );

      // Update scenario progress HUD
      if (this.scenarioManager && this.currentScenario) {
        const progress = this.scenarioManager.getProgress();
        const objective = this.currentScenario.objective;
        const conditions = this.currentScenario.conditions;

        let currentValue = 0;
        let targetValue = 1;
        let objectiveText = "";

        switch (objective.type) {
          case "economic":
            if (objective.targetProfit) {
              currentValue = progress.totalRevenue - progress.totalExpenses;
              targetValue = objective.targetProfit;
              objectiveText = `Profit: $${currentValue.toLocaleString()} / $${targetValue.toLocaleString()}`;
            } else if (objective.targetRevenue) {
              currentValue = progress.totalRevenue;
              targetValue = objective.targetRevenue;
              objectiveText = `Revenue: $${currentValue.toLocaleString()} / $${targetValue.toLocaleString()}`;
            }
            break;
          case "restoration":
            currentValue = progress.currentHealth;
            targetValue = objective.targetHealth || 80;
            objectiveText = `Health: ${Math.round(
              currentValue
            )}% / ${targetValue}%`;
            break;
          case "attendance":
            currentValue = progress.totalRounds;
            targetValue = objective.targetRounds || 100;
            objectiveText = `Rounds: ${currentValue} / ${targetValue}`;
            break;
          case "satisfaction":
            currentValue = progress.daysAtTargetRating;
            targetValue = objective.maintainForDays || 30;
            objectiveText = `Days at rating: ${currentValue} / ${targetValue}`;
            break;
        }

        const result = this.scenarioManager.checkObjective();
        this.uiManager.updateScenarioProgress(
          objectiveText,
          currentValue,
          targetValue,
          progress.daysElapsed,
          conditions.timeLimitDays,
          result.completed
        );
      }

      this.uiManager.updateMinimapPlayerPosition(
        this.player.gridX,
        this.player.gridY,
        course.width,
        course.height
      );
    });
  }

  private updateDayNightCycle(): void {
    const hours = this.gameTime / 60;
    let brightness = 1.0;

    if (hours < 6) {
      brightness = 0.3 + (hours / 6) * 0.3;
    } else if (hours < 8) {
      brightness = 0.6 + ((hours - 6) / 2) * 0.4;
    } else if (hours < 18) {
      brightness = 1.0;
    } else if (hours < 20) {
      brightness = 1.0 - ((hours - 18) / 2) * 0.4;
    } else {
      brightness = 0.6 - ((hours - 20) / 4) * 0.3;
    }

    const scene = this.babylonEngine.getScene();
    scene.clearColor = new Color4(
      0.1 * brightness,
      0.15 * brightness,
      0.1 * brightness,
      1
    );
  }

  private updateEconomySystems(deltaMs: number): void {
    const hours = Math.floor(this.gameTime / 60);
    const gameMinutes = (deltaMs / 1000) * 2 * this.timeScale;
    const isWeekend = this.gameDay % 7 >= 5;
    const isTwilight = hours >= 16;
    const timestamp = this.gameDay * 24 * 60 + this.gameTime;

    const weatherResult = tickWeather(
      this.weatherState,
      this.gameTime,
      this.gameDay
    );
    if (weatherResult.changed || weatherResult.state !== this.weatherState) {
      this.weatherState = weatherResult.state;
      this.weather = this.weatherState.current;
      if (weatherResult.changed) {
        const impact = getWeatherImpactDescription(this.weather);
        this.uiManager.showNotification(
          `Weather: ${getWeatherDescription(this.weather)}`,
          undefined,
          3000
        );
        if (impact) {
          setTimeout(() => {
            this.uiManager.showNotification(impact, undefined, 4000);
          }, 500);
        }
      }
    }

    // Hourly payroll processing
    if (
      hours !== this.lastPayrollHour &&
      this.employeeRoster.employees.length > 0
    ) {
      this.lastPayrollHour = hours;
      const payrollResult = processPayroll(this.employeeRoster, timestamp);
      this.employeeRoster = payrollResult.roster;
      if (payrollResult.totalPaid > 0) {
        const expenseResult = addExpense(
          this.economyState,
          payrollResult.totalPaid,
          "employee_wages",
          "Hourly wages",
          timestamp,
          true
        );
        if (expenseResult) {
          this.economyState = expenseResult;
          this.dailyStats.expenses.wages += payrollResult.totalPaid;
        }
      }
    }

    // Hourly auto-save
    if (hours !== this.lastAutoSaveHour) {
      this.lastAutoSaveHour = hours;
      this.saveCurrentGame();
    }

    // Hourly prestige update
    if (hours !== this.lastPrestigeUpdateHour) {
      this.lastPrestigeUpdateHour = hours;
      const cells = this.grassSystem.getAllCells();
      const conditionsScore = calculateCurrentConditions(cells);
      this.prestigeState = updatePrestigeScore(
        this.prestigeState,
        conditionsScore
      );
      const demandMult = calculateDemandMultiplier(
        this.greenFees.weekday18Holes,
        this.prestigeState.tolerance
      );
      const rejectionRate = Math.round((1 - demandMult) * 100);
      const recommendedMax = this.prestigeState.tolerance.rejectionThreshold;
      this.uiManager.updatePrestige(
        this.prestigeState,
        rejectionRate,
        recommendedMax
      );
    }

    // Hourly tee time processing
    if (hours !== this.lastTeeTimeUpdateHour) {
      this.lastTeeTimeUpdateHour = hours;
      const currentGameTime: GameTime = {
        day: this.gameDay,
        hour: hours,
        minute: 0,
      };

      // Generate new day's slots at 5 AM
      if (hours === 5) {
        const newSlots = generateDailySlots(
          this.gameDay,
          this.teeTimeState.spacingConfig,
          this.teeTimeState.operatingHours
        );
        const updatedTeeTimes = new Map(this.teeTimeState.teeTimes);
        updatedTeeTimes.set(this.gameDay, newSlots);
        this.teeTimeState = {
          ...this.teeTimeState,
          teeTimes: updatedTeeTimes,
          currentDay: this.gameDay,
        };

        // Simulate bookings with marketing demand boost
        const marketingMultiplier = calculateCombinedDemandMultiplier(
          this.marketingState
        );
        const bookings = simulateDailyBookings(
          this.teeTimeState,
          this.gameDay,
          this.gameDay,
          {
            prestigeScore: this.prestigeState.currentScore / 200,
            marketingBonus: marketingMultiplier,
          },
          this.greenFees.weekday18Holes,
          20
        );
        this.teeTimeState = applyBookingSimulation(
          this.teeTimeState,
          bookings,
          this.gameDay
        );
      }

      // Process walk-ons during golf hours
      if (hours >= 6 && hours <= 19) {
        const availableSlots = getAvailableSlots(
          this.teeTimeState,
          this.gameDay
        );
        const walkOnResult = processWalkOns(
          this.walkOnState,
          currentGameTime,
          availableSlots,
          this.greenFees.weekday18Holes,
          20
        );
        this.walkOnState = walkOnResult.state;
      }

      // End of day processing at 10 PM
      if (hours === 22) {
        this.revenueState = finalizeDailyRevenue(this.revenueState);

        // Process marketing campaigns
        const marketingResult = processDailyCampaigns(
          this.marketingState,
          this.gameDay,
          this.teeTimeState.bookingMetrics.totalBookingsToday,
          this.revenueState.todaysRevenue.grossRevenue
        );
        this.marketingState = marketingResult.state;
        for (const name of marketingResult.completedCampaignNames) {
          this.uiManager.showNotification(`📢 Campaign completed: ${name}`);
        }
        if (marketingResult.dailyCost > 0) {
          const expenseResult = addExpense(
            this.economyState,
            marketingResult.dailyCost,
            "marketing",
            "Marketing campaigns",
            timestamp,
            true
          );
          if (expenseResult) {
            this.economyState = expenseResult;
            this.dailyStats.expenses.other += marketingResult.dailyCost;
          }
        }

        // Daily operating expenses (utilities, maintenance)
        const dailyUtilitiesCost = 50;
        const utilitiesResult = addExpense(
          this.economyState,
          dailyUtilitiesCost,
          "utilities",
          "Daily utilities",
          timestamp,
          true
        );
        if (utilitiesResult) {
          this.economyState = utilitiesResult;
          this.dailyStats.expenses.utilities += dailyUtilitiesCost;
        }

        // Take prestige daily snapshot and update historical tracking
        const dailySnapshot = takeDailySnapshot(
          this.prestigeState.currentConditions,
          this.gameDay
        );
        const newHistoricalExcellence = updateHistoricalExcellence(
          this.prestigeState.historicalExcellence,
          dailySnapshot
        );
        this.prestigeState = {
          ...this.prestigeState,
          historicalExcellence: newHistoricalExcellence,
        };

        // Show day summary popup
        this.showDaySummary();

        // Auto-save at end of day
        this.saveCurrentGame();

        // Reset all daily counters
        this.walkOnState = resetDailyWalkOnMetrics(this.walkOnState);
        this.teeTimeState = resetTeeTimeDailyMetrics(this.teeTimeState);
        this.prestigeState = resetPrestigeDailyStats(this.prestigeState);
        this.golferPool = resetGolferDailyStats(this.golferPool);
      }
    }

    // Golfer arrivals (hourly during golf hours: 6am - 7pm)
    if (hours !== this.lastArrivalHour && hours >= 6 && hours <= 19) {
      this.lastArrivalHour = hours;
      const courseStats = this.grassSystem.getCourseStats();
      this.golferPool = updateCourseRating(this.golferPool, {
        condition: courseStats.health,
      });

      const baseArrivalRate = calculateArrivalRate(
        this.golferPool,
        this.weather,
        isWeekend,
        hours
      );

      // Apply prestige demand multiplier and track rejected golfers
      const demandMultiplier = calculateDemandMultiplier(
        this.greenFees.weekday18Holes,
        this.prestigeState.tolerance
      );
      const potentialArrivals = Math.floor(
        baseArrivalRate + (Math.random() < baseArrivalRate % 1 ? 1 : 0)
      );
      const arrivalRate = baseArrivalRate * demandMultiplier;
      const arrivalCount = Math.floor(
        arrivalRate + (Math.random() < arrivalRate % 1 ? 1 : 0)
      );
      const rejectedCount = Math.max(0, potentialArrivals - arrivalCount);

      // Track rejected golfers in prestige state
      if (rejectedCount > 0) {
        const lostRevenue = rejectedCount * this.greenFees.weekday18Holes;
        this.prestigeState = {
          ...this.prestigeState,
          golfersRejectedToday:
            this.prestigeState.golfersRejectedToday + rejectedCount,
          revenueLostToday: this.prestigeState.revenueLostToday + lostRevenue,
        };
        // Show warning if significant rejections (first time each hour)
        if (
          this.prestigeState.golfersRejectedToday >= 5 &&
          rejectedCount >= 2
        ) {
          this.uiManager.showNotification(
            `⚠️ ${rejectedCount} golfers turned away! (Prices too high)`,
            "#ffaa44"
          );
        }
      }

      if (arrivalCount > 0) {
        const arrivals = generateArrivals(
          this.golferPool,
          arrivalCount,
          this.gameTime,
          this.greenFees,
          isWeekend,
          isTwilight
        );
        let totalFees = 0;
        for (const golfer of arrivals) {
          this.golferPool = addGolfer(this.golferPool, golfer);
          totalFees += golfer.paidAmount;
          this.economyState = addIncome(
            this.economyState,
            golfer.paidAmount,
            "green_fees",
            `Green fee: ${golfer.type}`,
            timestamp
          );
          this.dailyStats.revenue.greenFees += golfer.paidAmount;
          if (this.scenarioManager) {
            this.scenarioManager.addRevenue(golfer.paidAmount);
            this.scenarioManager.addGolfers(1);
          }
        }
        this.uiManager.showNotification(
          `${arrivalCount} golfer${
            arrivalCount > 1 ? "s" : ""
          } arrived (+$${totalFees.toFixed(0)})`
        );
      }
    }

    // Tick golfers (progress through their round)
    const courseStats = this.grassSystem.getCourseStats();
    const staffQuality = getManagerBonus(this.employeeRoster) * 10 + 50;
    const tickResult = tickGolfers(
      this.golferPool,
      gameMinutes,
      courseStats.health,
      staffQuality,
      this.weather
    );
    this.golferPool = tickResult.state;

    // Process departures - tips become income
    const departureCount = tickResult.departures.length;
    if (departureCount > 0) {
      if (tickResult.tips > 0) {
        this.economyState = addIncome(
          this.economyState,
          tickResult.tips,
          "other_income",
          "Golfer tips",
          timestamp
        );
        if (this.scenarioManager) {
          this.scenarioManager.addRevenue(tickResult.tips);
        }
        this.uiManager.showNotification(
          `${departureCount} golfer${
            departureCount > 1 ? "s" : ""
          } finished (+$${tickResult.tips.toFixed(0)} tips)`
        );
      }
      this.dailyStats.revenue.tips += tickResult.tips;
      for (const departure of tickResult.departures) {
        this.dailyStats.golfersServed++;
        this.dailyStats.totalSatisfaction += departure.satisfaction;
        if (this.scenarioManager) {
          this.scenarioManager.addRound();
        }
      }
    }

    // Tick employees (energy, breaks) - apply training bonus from research
    const trainingBonus = getEquipmentEfficiencyBonus(this.researchState);
    const tickEmployeesResult = tickEmployees(
      this.employeeRoster,
      gameMinutes,
      trainingBonus
    );
    this.employeeRoster = tickEmployeesResult.roster;

    // Tick job applications based on prestige tier
    const absoluteTime = this.gameDay * 24 * 60 + this.gameTime;
    const appResult = tickApplications(
      this.applicationState,
      absoluteTime,
      this.prestigeState.tier
    );
    this.applicationState = appResult.state;

    if (appResult.newApplicant) {
      this.uiManager.showNotification(
        `📋 New applicant: ${appResult.newApplicant.name} (${appResult.newApplicant.role})`
      );
    }
    for (const posting of appResult.expiredPostings) {
      this.uiManager.showNotification(
        `⏰ Job posting expired: ${posting.role}`,
        "#ffaa44"
      );
    }

    // Tick employee autonomous work
    const cells = this.grassSystem.getAllCells();
    const absoluteGameTime = this.gameDay * 1440 + this.gameTime;
    const workResult = tickEmployeeWork(
      this.employeeWorkState,
      this.employeeRoster.employees,
      cells,
      gameMinutes,
      absoluteGameTime
    );
    this.employeeWorkState = workResult.state;

    for (const effect of workResult.effects) {
      if (effect.type === "mow") {
        this.grassSystem.mowAt(effect.gridX, effect.gridY);
        this.dailyStats.maintenance.tilesMowed++;
      } else if (effect.type === "water") {
        this.grassSystem.waterArea(
          effect.gridX,
          effect.gridY,
          1,
          20 * effect.efficiency
        );
        this.dailyStats.maintenance.tilesWatered++;
      } else if (effect.type === "fertilize") {
        this.grassSystem.fertilizeArea(
          effect.gridX,
          effect.gridY,
          1,
          20,
          effect.efficiency
        );
        this.dailyStats.maintenance.tilesFertilized++;
      } else if (effect.type === "rake") {
        this.grassSystem.rakeAt(effect.gridX, effect.gridY);
      }
    }

    for (const completion of workResult.completions) {
      const expReward = TASK_EXPERIENCE_REWARDS[completion.task];
      if (expReward > 0) {
        this.employeeRoster = awardExperience(
          this.employeeRoster,
          completion.employeeId,
          expReward
        );
      }
      this.dailyStats.maintenance.tasksCompleted++;

      const supplyCost = TASK_SUPPLY_COSTS[completion.task];
      if (supplyCost > 0) {
        const timestamp = this.gameDay * 24 * 60 + this.gameTime;
        const expenseResult = addExpense(
          this.economyState,
          supplyCost,
          "supplies",
          `Maintenance: ${completion.task}`,
          timestamp,
          true
        );
        if (expenseResult) {
          this.economyState = expenseResult;
          this.dailyStats.expenses.supplies += supplyCost;
        }
      }
    }

    // Update employee visual positions
    const workerPositions = getWorkerPositions(this.employeeWorkState);
    if (this.employeeVisualSystem) {
      this.employeeVisualSystem.update(workerPositions, deltaMs);
    }

    // Update minimap worker dots
    this.uiManager.updateMinimapWorkers(
      workerPositions,
      this.currentCourse.width,
      this.currentCourse.height
    );

    // Tick research (only charge funding if there's active research)
    if (this.researchState.currentResearch) {
      this.accumulatedResearchTime += gameMinutes;
      if (this.accumulatedResearchTime >= 1) {
        const researchMinutes = Math.floor(this.accumulatedResearchTime);
        this.accumulatedResearchTime -= researchMinutes;
        const fundingCost =
          getFundingCostPerMinute(this.researchState) * researchMinutes;
        if (fundingCost > 0 && this.economyState.cash >= fundingCost) {
          const expenseResult = addExpense(
            this.economyState,
            fundingCost,
            "research",
            "Research funding",
            timestamp,
            true
          );
          if (expenseResult) {
            this.economyState = expenseResult;
          }
          const researchResult = tickResearch(
            this.researchState,
            researchMinutes,
            timestamp
          );
          this.researchState = researchResult.state;
          if (researchResult.completed) {
            const unlockDesc = describeResearchUnlock(researchResult.completed);
            this.uiManager.showNotification(`Research complete: ${unlockDesc}`);
          }
        }
      }
    }

    // Tick autonomous equipment (robots)
    if (this.autonomousState.robots.length > 0) {
      const cells = this.grassSystem.getAllCells();
      const fleetAIActive =
        this.researchState.completedResearch.includes("fleet_ai");
      const robotResult = tickAutonomousEquipment(
        this.autonomousState,
        cells,
        gameMinutes,
        fleetAIActive
      );
      this.autonomousState = robotResult.state;

      if (robotResult.operatingCost > 0) {
        const expenseResult = addExpense(
          this.economyState,
          robotResult.operatingCost,
          "equipment_maintenance",
          "Robot operating costs",
          timestamp,
          true
        );
        if (expenseResult) {
          this.economyState = expenseResult;
        }
      }

      for (const effect of robotResult.effects) {
        if (effect.type === "mower") {
          this.grassSystem.mowAt(effect.gridX, effect.gridY);
        } else if (effect.type === "sprayer") {
          this.grassSystem.waterArea(
            effect.gridX,
            effect.gridY,
            1,
            10 * effect.efficiency
          );
        } else if (effect.type === "spreader") {
          const effectiveness = getBestFertilizerEffectiveness(
            this.researchState
          );
          this.grassSystem.fertilizeArea(
            effect.gridX,
            effect.gridY,
            1,
            10 * effect.efficiency,
            effectiveness
          );
        }
      }
    }

    // Update scenario manager with current course state
    if (this.scenarioManager) {
      this.scenarioManager.updateProgress({
        currentCash: this.economyState.cash,
        currentHealth: courseStats.health,
      });
    }

    // Tick irrigation system
    this.updateIrrigationSystem(gameMinutes, timestamp);
  }

  private updateIrrigationSystem(
    deltaMinutes: number,
    timestamp: number
  ): void {
    const hours = Math.floor(this.gameTime / 60);
    const minutes = this.gameTime % 60;

    // Update pipe pressures
    this.irrigationSystem = updatePipePressures(this.irrigationSystem);

    // Check for leaks
    const weatherEffect = this.weather
      ? {
          type:
            this.weather.type === "rainy"
              ? ("rainy" as const)
              : this.weather.type === "stormy"
              ? ("stormy" as const)
              : this.weather.type === "cloudy"
              ? ("cloudy" as const)
              : ("sunny" as const),
          temperature: this.weather.temperature ?? 70,
        }
      : undefined;
    this.irrigationSystem = checkForLeaks(
      this.irrigationSystem,
      timestamp,
      weatherEffect
    );

    // Process scheduled watering
    for (const head of this.irrigationSystem.sprinklerHeads) {
      if (!head.schedule.enabled) continue;

      let shouldWater = false;
      for (const range of head.schedule.timeRanges) {
        const currentMinutes = hours * 60 + minutes;
        if (currentMinutes >= range.start && currentMinutes < range.end) {
          shouldWater = true;
          break;
        }
      }

      if (shouldWater && !head.isActive) {
        this.irrigationSystem = setSprinklerActive(
          this.irrigationSystem,
          head.id,
          true
        );
      } else if (!shouldWater && head.isActive) {
        this.irrigationSystem = setSprinklerActive(
          this.irrigationSystem,
          head.id,
          false
        );
      }

      if (head.isActive) {
        const pipe = getPipeAt(this.irrigationSystem, head.gridX, head.gridY);
        const pressure = pipe ? pipe.pressureLevel : 0;

        for (const tile of head.coverageTiles) {
          const cell = this.grassSystem.getCell(tile.x, tile.y);
          if (cell) {
            const waterAmount = 15 * tile.efficiency * (pressure / 100);
            this.grassSystem.waterArea(tile.x, tile.y, 0, waterAmount);
            this.dailyStats.maintenance.tilesWatered++;
          }
        }
      }
    }

    // Calculate water costs
    const activeHeads = this.irrigationSystem.sprinklerHeads.filter(
      (h) => h.isActive
    );
    if (
      activeHeads.length > 0 &&
      this.irrigationSystem.waterSources.length > 0
    ) {
      const source = this.irrigationSystem.waterSources[0];
      const waterUsage = calculateWaterUsage(
        activeHeads,
        deltaMinutes,
        this.irrigationSystem
      );
      const waterCost = calculateWaterCost(waterUsage, source);

      if (waterCost > 0) {
        const expenseResult = addExpense(
          this.economyState,
          waterCost,
          "utilities",
          "Irrigation water",
          timestamp,
          true
        );
        if (expenseResult) {
          this.economyState = expenseResult;
          this.dailyStats.expenses.utilities += waterCost;
        }
      }
    }

    // Update render system
    if (this.irrigationRenderSystem) {
      this.irrigationRenderSystem.update(this.irrigationSystem);
    }
  }

  private checkScenarioCompletion(): void {
    if (!this.scenarioManager) return;

    const result = this.scenarioManager.checkObjective();

    if (result.completed) {
      const score = Math.round(
        this.economyState.cash +
          this.golferPool.totalVisitorsToday * 10 +
          this.grassSystem.getCourseStats().health * 100
      );
      this.gameOptions.onScenarioComplete?.(score);
      this.uiManager.showNotification(`Scenario Complete! Score: ${score}`);
    } else if (result.failed) {
      this.uiManager.showNotification(
        `Scenario Failed: ${result.message || "Objective not met"}`
      );
    }
  }

  public setRunning(running: boolean): void {
    if (running) {
      this.babylonEngine.start();
    } else {
      this.babylonEngine.stop();
    }
  }

  public getScenarioState(): {
    progress: number;
    completed: boolean;
    failed: boolean;
    message?: string;
  } | null {
    if (!this.scenarioManager) return null;
    const result = this.scenarioManager.checkObjective();
    return {
      progress: result.progress,
      completed: result.completed,
      failed: result.failed,
      message: result.message,
    };
  }

  public getEconomyState(): { cash: number; earned: number; spent: number } {
    return {
      cash: this.economyState.cash,
      earned: this.economyState.totalEarned,
      spent: this.economyState.totalSpent,
    };
  }

  public getPrestigeState(): {
    score: number;
    stars: number;
    tier: string;
    amenityScore: number;
  } {
    return {
      score: this.prestigeState.currentScore,
      stars: this.prestigeState.starRating,
      tier: this.prestigeState.tier,
      amenityScore: this.prestigeState.amenityScore,
    };
  }

  public getGameDay(): number {
    return this.gameDay;
  }

  public getTeeTimeStats(): {
    totalBookings: number;
    cancellations: number;
    noShows: number;
    slotsAvailable: number;
  } {
    const todaySlots = this.teeTimeState.teeTimes.get(this.gameDay) ?? [];
    const available = todaySlots.filter((t) => t.status === "available").length;

    return {
      totalBookings: this.teeTimeState.bookingMetrics.totalBookingsToday,
      cancellations: this.teeTimeState.bookingMetrics.cancellationsToday,
      noShows: this.teeTimeState.bookingMetrics.noShowsToday,
      slotsAvailable: available,
    };
  }

  public getMarketingStats(): {
    activeCampaigns: number;
    totalSpent: number;
    totalROI: number;
  } {
    const totalSpent = this.marketingState.metrics.totalSpent;
    const totalRevenue = this.marketingState.metrics.totalRevenueGenerated;
    const roi =
      totalSpent > 0 ? ((totalRevenue - totalSpent) / totalSpent) * 100 : 0;

    return {
      activeCampaigns: this.marketingState.activeCampaigns.length,
      totalSpent,
      totalROI: Math.round(roi),
    };
  }

  public startMarketingCampaign(campaignId: string, days: number = 7): boolean {
    const canStart = canStartCampaign(
      this.marketingState,
      campaignId,
      this.economyState.cash
    );
    if (!canStart.canStart) {
      return false;
    }

    const result = startCampaign(
      this.marketingState,
      campaignId,
      this.gameDay,
      days
    );
    if (result) {
      this.marketingState = result.state;
      const cost = result.setupCost;
      if (cost > 0) {
        const timestamp = this.gameDay * 24 * 60 + this.gameTime;
        const expenseResult = addExpense(
          this.economyState,
          cost,
          "marketing",
          `Campaign: ${campaignId}`,
          timestamp,
          false
        );
        if (expenseResult) {
          this.economyState = expenseResult;
        }
      }
      return true;
    }
    return false;
  }

  public getGameTime(): { hours: number; minutes: number } {
    return {
      hours: Math.floor(this.gameTime / 60),
      minutes: Math.floor(this.gameTime % 60),
    };
  }

  public setCash(amount: number): void {
    const diff = amount - this.economyState.cash;
    const timestamp = Date.now();
    if (diff > 0) {
      this.economyState = addIncome(
        this.economyState,
        diff,
        "other_income",
        "Test adjustment",
        timestamp
      );
    } else if (diff < 0) {
      const result = addExpense(
        this.economyState,
        -diff,
        "other_expense",
        "Test adjustment",
        timestamp,
        true
      );
      if (result) {
        this.economyState = result;
      }
    }
    this.uiManager.updateEconomy(
      this.economyState.cash,
      getActiveGolferCount(this.golferPool),
      getAverageSatisfaction(this.golferPool)
    );
  }

  public advanceDay(): void {
    this.gameDay++;
    if (this.scenarioManager) {
      this.scenarioManager.incrementDay();
    }
    const cells = this.grassSystem.getAllCells();
    const conditionsScore = calculateCurrentConditions(cells);
    this.prestigeState = updatePrestigeScore(
      this.prestigeState,
      conditionsScore
    );
  }

  public purchaseAmenity(upgradeType: string): boolean {
    let upgrade: AmenityUpgrade;

    switch (upgradeType) {
      case "clubhouse_1":
        upgrade = { type: "clubhouse", tier: 1 };
        break;
      case "pro_shop_1":
        upgrade = { type: "proShop", tier: 1 };
        break;
      case "dining_1":
        upgrade = { type: "dining", tier: 1 };
        break;
      case "facility_driving_range":
        upgrade = { type: "facility", facility: "drivingRange" };
        break;
      case "facility_putting_green":
        upgrade = { type: "facility", facility: "puttingGreen" };
        break;
      default:
        return false;
    }

    const cost = getUpgradeCost(this.prestigeState.amenities, upgrade);
    if (this.economyState.cash < cost) {
      return false;
    }

    this.prestigeState = upgradeAmenity(this.prestigeState, upgrade);
    const timestamp = this.gameDay * 24 * 60 + this.gameTime;
    const expenseResult = addExpense(
      this.economyState,
      cost,
      "equipment_purchase",
      `Amenity: ${upgrade.type}`,
      timestamp,
      false
    );
    if (expenseResult) {
      this.economyState = expenseResult;
    }

    return true;
  }

  // ============================================================================
  // PUBLIC TESTING API
  // These methods provide a stable interface for automated testing and bots.
  // They replace flaky canvas click operations with reliable programmatic control.
  // ============================================================================

  /**
   * Move player one tile in a direction.
   * @param direction - 'up', 'down', 'left', 'right', 'w', 'a', 's', 'd'
   */
  public movePlayer(
    direction: "up" | "down" | "left" | "right" | "w" | "a" | "s" | "d"
  ): void {
    const dirMap: Record<string, Direction> = {
      up: "up",
      w: "up",
      down: "down",
      s: "down",
      left: "left",
      a: "left",
      right: "right",
      d: "right",
    };
    const dir = dirMap[direction];
    if (dir) {
      this.handleMove(dir);
    }
  }

  /**
   * Get current player position.
   */
  public getPlayerPosition(): { x: number; y: number } {
    return { x: this.player.gridX, y: this.player.gridY };
  }

  /**
   * Handle equipment button press. Unified control:
   * - Press when nothing selected: select and activate
   * - Press different equipment: switch to it
   * - Press same equipment: deselect
   * @param slot - 1 (mower), 2 (sprinkler), 3 (spreader)
   */
  public selectEquipment(slot: 1 | 2 | 3): void {
    const wasSelected = this.equipmentManager.getSelected();
    this.equipmentManager.handleSlot(slot);
    const nowSelected = this.equipmentManager.getSelected();

    if (nowSelected !== null && nowSelected !== wasSelected) {
      const overlayMap: Record<EquipmentSlot, OverlayMode | null> = {
        1: null,        // mower - no overlay, stripes show mowing status
        2: "moisture",  // sprinkler - show moisture levels
        3: "nutrients", // spreader - show nutrient levels
      };
      const targetOverlay = overlayMap[slot];
      if (targetOverlay && this.grassSystem.getOverlayMode() !== targetOverlay) {
        this.grassSystem.setOverlayMode(targetOverlay);
        this.uiManager.updateOverlayLegend(targetOverlay);
        this.overlayAutoSwitched = true;
        this.updateIrrigationVisibility();
      } else if (targetOverlay === null && this.overlayAutoSwitched) {
        this.grassSystem.setOverlayMode("normal");
        this.uiManager.updateOverlayLegend("normal");
        this.overlayAutoSwitched = false;
        this.updateIrrigationVisibility();
      }
    } else if (nowSelected === null && this.overlayAutoSwitched) {
      this.grassSystem.setOverlayMode("normal");
      this.uiManager.updateOverlayLegend("normal");
      this.overlayAutoSwitched = false;
      this.updateIrrigationVisibility();
    }
  }

  /**
   * Toggle equipment on/off (alias for selectEquipment with current selection).
   * @deprecated Use selectEquipment instead - pressing same slot toggles
   */
  public toggleEquipment(): void {
    const selected = this.equipmentManager.getSelected();
    if (selected === null) return;

    const slotMap: Record<string, 1 | 2 | 3> = {
      mower: 1,
      sprinkler: 2,
      spreader: 3,
    };
    this.selectEquipment(slotMap[selected]);
  }


  /**
   * Get current equipment state.
   */
  public getEquipmentState(): {
    selectedSlot: number | null;
    mower: { active: boolean; resource: number; max: number } | null;
    sprinkler: { active: boolean; resource: number; max: number } | null;
    spreader: { active: boolean; resource: number; max: number } | null;
  } {
    const mowerState = this.equipmentManager.getState("mower");
    const sprinklerState = this.equipmentManager.getState("sprinkler");
    const spreaderState = this.equipmentManager.getState("spreader");

    const selected = this.equipmentManager.getSelected();
    const slotMap: Record<string, number> = {
      mower: 0,
      sprinkler: 1,
      spreader: 2,
    };

    return {
      selectedSlot: selected ? slotMap[selected] : null,
      mower: mowerState
        ? {
            active: selected === "mower",
            resource: mowerState.resourceCurrent,
            max: mowerState.resourceMax,
          }
        : null,
      sprinkler: sprinklerState
        ? {
            active: selected === "sprinkler",
            resource: sprinklerState.resourceCurrent,
            max: sprinklerState.resourceMax,
          }
        : null,
      spreader: spreaderState
        ? {
            active: selected === "spreader",
            resource: spreaderState.resourceCurrent,
            max: spreaderState.resourceMax,
          }
        : null,
    };
  }

  public setTerrainEditor(enabled: boolean): void {
    if (!this.terrainEditorSystem) return;
    if (enabled) {
      this.terrainEditorSystem.enable();
    } else {
      this.terrainEditorSystem.disable();
    }
  }

  public isTerrainEditorEnabled(): boolean {
    return this.terrainEditorSystem?.isEnabled() ?? false;
  }

  /**
   * Set terrain editor tool.
   * @param tool - 'raise', 'lower', 'flatten', 'smooth', or terrain brush like 'terrain_fairway'
   */
  public setEditorTool(tool: string): void {
    if (!this.terrainEditorSystem) return;

    const toolMap: Record<string, EditorTool> = {
      raise: "raise",
      lower: "lower",
      flatten: "flatten",
      smooth: "smooth",
      terrain_fairway: "terrain_fairway",
      terrain_bunker: "terrain_bunker",
      terrain_water: "terrain_water",
    };

    const editorTool = toolMap[tool];
    if (editorTool) {
      this.terrainEditorSystem.setTool(editorTool);
    }
  }

  /**
   * Set terrain editor brush size.
   * @param size - 1, 2, or 3
   */
  public setEditorBrushSize(size: number): void {
    if (this.terrainEditorSystem) {
      this.terrainEditorSystem.setBrushSize(size);
    }
  }

  /**
   * Edit terrain at a grid position (simulates click).
   * @param gridX - Grid X coordinate
   * @param gridY - Grid Y coordinate
   */
  public editTerrainAt(gridX: number, gridY: number): void {
    if (!this.terrainEditorSystem || !this.terrainEditorSystem.isEnabled()) {
      return;
    }

    // Create world position that will trigger corner detection (NW corner)
    // TILE_SIZE is 1, CORNER_THRESHOLD is 0.25, so we use 0.1 to be safely in the corner
    const worldPos = new Vector3(gridX + 0.1, 0, gridY + 0.1);
    this.terrainEditorSystem.handleMouseMove(gridX, gridY, worldPos);
    this.terrainEditorSystem.handleClick();
  }

  /**
   * Start terrain drag operation.
   * @param gridX - Grid X coordinate
   * @param gridY - Grid Y coordinate
   * @param screenY - Optional screen Y coordinate for vertical drag
   */
  public dragTerrainStart(
    gridX: number,
    gridY: number,
    screenY?: number
  ): void {
    if (!this.terrainEditorSystem || !this.terrainEditorSystem.isEnabled()) {
      return;
    }

    this.terrainEditorSystem.handleMouseMove(gridX, gridY);
    this.terrainEditorSystem.handleDragStart(gridX, gridY, screenY);
  }

  /**
   * Continue terrain drag operation.
   * @param gridX - Grid X coordinate
   * @param gridY - Grid Y coordinate
   * @param screenY - Optional screen Y coordinate for vertical drag
   */
  public dragTerrainMove(gridX: number, gridY: number, screenY?: number): void {
    if (!this.terrainEditorSystem || !this.terrainEditorSystem.isEnabled()) {
      return;
    }

    this.terrainEditorSystem.handleMouseMove(gridX, gridY);
    this.terrainEditorSystem.handleDrag(gridX, gridY, screenY);
  }

  /**
   * End terrain drag operation.
   */
  public dragTerrainEnd(): void {
    if (this.terrainEditorSystem) {
      this.terrainEditorSystem.handleDragEnd();
    }
  }

  /**
   * Undo last terrain edit.
   */
  public undoTerrainEdit(): void {
    if (this.terrainEditorSystem) {
      this.terrainEditorSystem.undo();
    }
  }

  /**
   * Redo last undone terrain edit.
   */
  public redoTerrainEdit(): void {
    if (this.terrainEditorSystem) {
      this.terrainEditorSystem.redo();
    }
  }

  /**
   * Get elevation at a grid position.
   */
  public getElevationAt(x: number, y: number): number | undefined {
    return this.grassSystem.getElevationAt(x, y);
  }

  /**
   * Set elevation at a grid position (testing only - bypasses normal editing).
   */
  public setElevationAt(x: number, y: number, elevation: number): void {
    this.grassSystem.setElevationAt(x, y, elevation);
  }

  /**
   * Set grass cell state at a grid position.
   */
  public setCellState(
    x: number,
    y: number,
    state: { height?: number; moisture?: number; nutrients?: number; health?: number }
  ): void {
    this.grassSystem.setCellState(x, y, state);
  }

  /**
   * Set all grass cells to the same state (useful for test setup).
   */
  public setAllCellsState(
    state: { height?: number; moisture?: number; nutrients?: number; health?: number }
  ): void {
    this.grassSystem.setAllCellsState(state);
  }

  /**
   * Get terrain type at a grid position.
   */
  public getTerrainTypeAt(x: number, y: number): string | undefined {
    return this.grassSystem.getTerrainTypeAt(x, y);
  }

  /**
   * Set terrain type at a grid position (testing only - bypasses normal editing).
   */
  public setTerrainTypeAt(
    x: number,
    y: number,
    type: "fairway" | "rough" | "green" | "bunker" | "water" | "tee"
  ): void {
    this.grassSystem.setTerrainTypeAt(x, y, type);
  }

  /**
   * Set overlay mode directly.
   * @param mode - 'normal', 'moisture', 'nutrients', 'height', or 'irrigation'
   */
  public setOverlayMode(
    mode: "normal" | "moisture" | "nutrients" | "height" | "irrigation"
  ): void {
    this.grassSystem.setOverlayMode(mode);

    // Update background color based on mode
    const scene = this.babylonEngine.getScene();
    if (mode === "irrigation") {
      // Very light sand color for maximum visibility
      scene.clearColor = new Color4(0.9, 0.88, 0.85, 1);
    } else {
      // Default sky blue
      scene.clearColor = new Color4(0.4, 0.6, 0.9, 1);
    }

    // Toggle irrigation render system visibility
    if (this.irrigationRenderSystem) {
      this.irrigationRenderSystem.setVisible(mode === "irrigation");
    }

    this.uiManager.updateOverlayLegend(mode);
    this.overlayAutoSwitched = false;
    this.updateIrrigationVisibility();
  }

  /**
   * Get current overlay mode.
   */
  public getOverlayMode():
    | "normal"
    | "moisture"
    | "nutrients"
    | "height"
    | "irrigation" {
    return this.grassSystem.getOverlayMode();
  }

  /**
   * Wait for player movement to complete.
   * @returns Promise that resolves when player is idle
   */
  public async waitForPlayerIdle(): Promise<void> {
    return new Promise((resolve) => {
      const checkIdle = () => {
        if (this.player.path.length === 0 && this.player.moveProgress === 0) {
          resolve();
        } else {
          setTimeout(checkIdle, 16); // Check every frame
        }
      };
      checkIdle();
    });
  }

  /**
   * Get full game state for testing.
   */
  /**
   * Toggle employee panel visibility.
   */
  public toggleEmployeePanel(): void {
    this.handleEmployeePanel();
  }

  /**
   * Toggle research panel visibility.
   */
  public toggleResearchPanel(): void {
    this.handleResearchPanel();
  }

  /**
   * Toggle tee sheet panel visibility.
   */
  public toggleTeeSheetPanel(): void {
    this.handleTeeSheetPanel();
  }

  /**
   * Toggle marketing panel visibility.
   */
  public toggleMarketingPanel(): void {
    this.handleMarketingPanel();
  }

  /**
   * Cycle to the next overlay mode.
   */
  public cycleOverlay(): void {
    this.handleOverlayCycle();
  }

  /**
   * Refill equipment at current position.
   */
  public refillEquipment(): void {
    this.handleRefill();
  }

  /**
   * Toggle audio mute.
   */
  public toggleMute(): void {
    this.handleMute();
  }

  /**
   * Get employee roster state.
   */
  public getEmployeeState(): {
    employees: readonly Employee[];
    count: number;
    maxEmployees: number;
    totalHourlyWages: number;
  } {
    return {
      employees: this.employeeRoster.employees,
      count: this.employeeRoster.employees.length,
      maxEmployees: this.employeeRoster.maxEmployees,
      totalHourlyWages: this.employeeRoster.employees.reduce(
        (sum, e) => sum + e.hourlyWage,
        0
      ),
    };
  }

  /**
   * Get job application state.
   */
  public getApplicationState(): {
    applications: readonly Employee[];
    nextApplicationTime: number;
    activeJobPostings: number;
    totalReceived: number;
  } {
    return {
      applications: this.applicationState.applications,
      nextApplicationTime: this.applicationState.nextApplicationTime,
      activeJobPostings: this.applicationState.activeJobPostings.length,
      totalReceived: this.applicationState.totalApplicationsReceived,
    };
  }

  public getFullGameState(): {
    player: { x: number; y: number; isMoving: boolean };
    equipment: ReturnType<BabylonMain["getEquipmentState"]>;
    time: { day: number; hours: number; minutes: number };
    economy: ReturnType<BabylonMain["getEconomyState"]>;
    terrain: { width: number; height: number };
    editorEnabled: boolean;
  } {
    const layoutGrid = this.grassSystem.getLayoutGrid();
    return {
      player: {
        x: this.player.gridX,
        y: this.player.gridY,
        isMoving: this.player.path.length > 0 || this.player.moveProgress > 0,
      },
      equipment: this.getEquipmentState(),
      time: {
        day: this.gameDay,
        hours: Math.floor(this.gameTime / 60),
        minutes: this.gameTime % 60,
      },
      economy: this.getEconomyState(),
      terrain: {
        width: layoutGrid[0]?.length ?? 0,
        height: layoutGrid.length,
      },
      editorEnabled: this.isTerrainEditorEnabled(),
    };
  }

  /**
   * Place a pipe at the specified grid position.
   */
  public placePipe(x: number, y: number, pipeType: PipeType): boolean {
    const timestamp = this.gameDay * 24 * 60 + this.gameTime;
    const config = PIPE_CONFIGS[pipeType];
    const cost = config.cost;

    if (!canAfford(this.economyState, cost)) {
      return false;
    }

    this.irrigationSystem = addPipe(
      this.irrigationSystem,
      x,
      y,
      pipeType,
      timestamp
    );
    const expenseResult = addExpense(
      this.economyState,
      cost,
      "construction",
      `Pipe installation: ${pipeType}`,
      timestamp,
      false
    );
    if (expenseResult) {
      this.economyState = expenseResult;
    }

    if (this.irrigationRenderSystem) {
      this.irrigationRenderSystem.update(this.irrigationSystem);
    }

    return true;
  }

  /**
   * Remove a pipe at the specified grid position.
   */
  public removePipe(x: number, y: number): void {
    this.irrigationSystem = removePipe(this.irrigationSystem, x, y);
    if (this.irrigationRenderSystem) {
      this.irrigationRenderSystem.update(this.irrigationSystem);
    }
  }

  /**
   * Place a sprinkler head at the specified grid position.
   */
  public placeSprinklerHead(
    x: number,
    y: number,
    sprinklerType: SprinklerType
  ): boolean {
    const timestamp = this.gameDay * 24 * 60 + this.gameTime;
    const config = SPRINKLER_CONFIGS[sprinklerType];
    const cost = config.cost + 20;

    if (!canAfford(this.economyState, cost)) {
      return false;
    }

    this.irrigationSystem = addSprinklerHead(
      this.irrigationSystem,
      x,
      y,
      sprinklerType,
      timestamp
    );
    const expenseResult = addExpense(
      this.economyState,
      cost,
      "construction",
      `Sprinkler installation: ${sprinklerType}`,
      timestamp,
      false
    );
    if (expenseResult) {
      this.economyState = expenseResult;
    }

    if (this.irrigationRenderSystem) {
      this.irrigationRenderSystem.update(this.irrigationSystem);
    }

    return true;
  }

  /**
   * Remove a sprinkler head at the specified grid position.
   */
  public removeSprinklerHead(x: number, y: number): void {
    const head = getSprinklerHeadAt(this.irrigationSystem, x, y);
    if (head) {
      this.irrigationSystem = removeSprinklerHead(
        this.irrigationSystem,
        head.id
      );
      if (this.irrigationRenderSystem) {
        this.irrigationRenderSystem.update(this.irrigationSystem);
      }
    }
  }

  /**
   * Repair a leak at the specified grid position.
   */
  public repairLeak(x: number, y: number): boolean {
    const timestamp = this.gameDay * 24 * 60 + this.gameTime;
    const cost = 20;

    if (!canAfford(this.economyState, cost)) {
      return false;
    }

    const result = repairLeak(this.irrigationSystem, x, y);
    if (result) {
      this.irrigationSystem = result;
      const expenseResult = addExpense(
        this.economyState,
        cost,
        "equipment_maintenance",
        "Pipe leak repair",
        timestamp,
        false
      );
      if (expenseResult) {
        this.economyState = expenseResult;
      }

      if (this.irrigationRenderSystem) {
        this.irrigationRenderSystem.update(this.irrigationSystem);
      }

      return true;
    }

    return false;
  }

  /**
   * Get the irrigation system state.
   */
  public getIrrigationSystem(): IrrigationSystem {
    return this.irrigationSystem;
  }

  /**
   * Set irrigation schedule for a sprinkler head.
   */
  public setIrrigationSchedule(
    headId: string,
    schedule: WateringSchedule
  ): void {
    this.irrigationSystem = updateSprinklerSchedule(
      this.irrigationSystem,
      headId,
      schedule
    );
  }

  /**
   * Get terrain/grass state at a specific position.
   */
  public getTerrainAt(x: number, y: number): {
    type: string;
    elevation: number;
    height: number;
    moisture: number;
    nutrients: number;
    health: number;
    lastMowed: number;
    lastWatered: number;
    lastFertilized: number;
  } | null {
    const cell = this.grassSystem.getCell(x, y);
    if (!cell) return null;
    return {
      type: cell.type,
      elevation: cell.elevation,
      height: cell.height,
      moisture: cell.moisture,
      nutrients: cell.nutrients,
      health: cell.health,
      lastMowed: cell.lastMowed,
      lastWatered: cell.lastWatered,
      lastFertilized: cell.lastFertilized,
    };
  }

  /**
   * Get overall course statistics.
   */
  public getCourseStats(): {
    health: number;
    moisture: number;
    nutrients: number;
    height: number;
  } {
    return this.grassSystem.getCourseStats();
  }

  /**
   * Set equipment resource level (for testing).
   */
  public setEquipmentResource(
    type: "mower" | "sprinkler" | "spreader",
    amount: number
  ): void {
    this.equipmentManager.setResource(type, amount);
  }

  /**
   * Advance game time by specified minutes (for testing).
   */
  public advanceTimeByMinutes(minutes: number): void {
    const deltaMs = minutes * 60 * 1000 / this.timeScale;
    // Update game time
    this.gameTime += (deltaMs / 1000) * 2 * this.timeScale;
    if (this.gameTime >= 24 * 60) {
      this.gameTime -= 24 * 60;
      this.gameDay++;
    }
    this.grassSystem.update(deltaMs, this.gameDay * 1440 + this.gameTime);
    this.updateEconomySystems(deltaMs);
  }

  /**
   * Get research state.
   */
  public getResearchState(): ResearchState {
    return this.researchState;
  }

  /**
   * Start researching an item.
   */
  public startResearchItem(itemId: string): boolean {
    const currentTime = this.gameDay * 24 * 60 + this.gameTime;
    const result = startResearch(this.researchState, itemId, currentTime);
    if (result) {
      this.researchState = result;
      return true;
    }
    return false;
  }

  /**
   * Cancel current research.
   */
  public cancelCurrentResearch(): void {
    this.researchState = cancelResearch(this.researchState);
  }

  /**
   * Set research funding level.
   */
  public setResearchFunding(level: FundingLevel): void {
    this.researchState = setFundingLevel(this.researchState, level);
  }

  /**
   * Queue a research item.
   */
  public queueResearch(itemId: string): void {
    this.researchState = {
      ...this.researchState,
      researchQueue: [...this.researchState.researchQueue, itemId],
    };
  }

  /**
   * Check if a research item is completed.
   */
  public isResearchCompleted(itemId: string): boolean {
    return this.researchState.completedResearch.includes(itemId);
  }

  /**
   * Get available research items (not completed and unlocked).
   */
  public getAvailableResearch(): string[] {
    return RESEARCH_ITEMS
      .filter((item) => {
        if (this.researchState.completedResearch.includes(item.id)) return false;
        return item.prerequisites.every((prereq) =>
          this.researchState.completedResearch.includes(prereq)
        );
      })
      .map((item) => item.id);
  }

  /**
   * Hire an employee from applications.
   */
  public hireEmployee(applicationIndex: number): boolean {
    if (
      applicationIndex < 0 ||
      applicationIndex >= this.applicationState.applications.length
    ) {
      return false;
    }
    const application = this.applicationState.applications[applicationIndex];
    const result = hireEmployee(this.employeeRoster, application);
    if (result) {
      this.employeeRoster = result;
      this.applicationState = {
        ...this.applicationState,
        applications: this.applicationState.applications.filter((_, i) => i !== applicationIndex),
      };
      return true;
    }
    return false;
  }

  /**
   * Fire an employee.
   */
  public fireEmployee(employeeId: string): boolean {
    const result = fireEmployee(this.employeeRoster, employeeId);
    if (result) {
      this.employeeRoster = result;
      return true;
    }
    return false;
  }

  /**
   * Get tee sheet for a specific day.
   */
  public getTeeSheet(day?: number): Array<{
    id: string;
    time: string;
    status: string;
    playerCount: number;
  }> {
    const targetDay = day ?? this.gameDay;
    const teeTimes = this.teeTimeState.teeTimes.get(targetDay) ?? [];
    return teeTimes.map((tt) => ({
      id: tt.id,
      time: `${tt.scheduledTime.hour}:${String(tt.scheduledTime.minute).padStart(2, "0")}`,
      status: tt.status,
      playerCount: tt.golfers?.length ?? 0,
    }));
  }

  /**
   * Book a tee time.
   */
  public bookTeeTime(teeTimeId: string, players: number = 4): boolean {
    const golferBookings = Array.from({ length: players }, (_, i) => ({
      golferId: `golfer_${Date.now()}_${i}`,
      name: `Golfer ${i + 1}`,
      membershipStatus: 'public' as const,
      greenFee: this.prestigeState.greenFee || 50,
      cartFee: 0,
      addOns: [],
    }));
    const currentTime: GameTime = {
      day: this.gameDay,
      hour: Math.floor(this.gameTime / 60),
      minute: this.gameTime % 60,
    };
    const result = bookTeeTime(this.teeTimeState, teeTimeId, golferBookings, 'reservation', currentTime);
    if (result !== this.teeTimeState) {
      this.teeTimeState = result;
      return true;
    }
    return false;
  }

  /**
   * Check in a tee time.
   */
  public checkInTeeTime(teeTimeId: string): boolean {
    const result = checkInTeeTime(this.teeTimeState, teeTimeId);
    this.teeTimeState = result;
    return true;
  }

  /**
   * Cancel a tee time booking.
   */
  public cancelTeeTimeBooking(teeTimeId: string): boolean {
    const result = cancelTeeTime(this.teeTimeState, teeTimeId);
    this.teeTimeState = result;
    return true;
  }

  /**
   * Get active marketing campaigns.
   */
  public getActiveCampaigns(): Array<{
    campaignId: string;
    daysRemaining: number;
  }> {
    return this.marketingState.activeCampaigns
      .filter(c => c.status === 'active')
      .map((c) => ({
        campaignId: c.campaignId,
        daysRemaining: c.plannedDuration - c.elapsedDays,
      }));
  }

  /**
   * End a marketing campaign early.
   */
  public endMarketingCampaign(campaignId: string): boolean {
    const result = stopCampaign(this.marketingState, campaignId, this.gameDay);
    this.marketingState = result;
    return true;
  }

  /**
   * Get available amenity upgrades.
   */
  public getAvailableAmenities(): Array<{
    id: string;
    name: string;
    cost: number;
    purchased: boolean;
  }> {
    const available = getAvailableUpgrades(this.prestigeState.amenities);
    return available.map((upgrade, index) => ({
      id: `amenity_${index}`,
      name: getUpgradeName(upgrade),
      cost: getUpgradeCost(this.prestigeState.amenities, upgrade),
      purchased: false,
    }));
  }

  /**
   * Get golfer pool state.
   */
  public getGolferState(): {
    active: number;
    served: number;
    avgSatisfaction: number;
  } {
    return {
      active: getActiveGolferCount(this.golferPool),
      served: this.golferPool.totalVisitorsToday,
      avgSatisfaction: getAverageSatisfaction(this.golferPool),
    };
  }

  /**
   * Get scenario progress (if in scenario mode).
   */
  public getScenarioProgress(): {
    daysElapsed: number;
    currentCash: number;
    totalRevenue: number;
    totalExpenses: number;
    totalGolfers: number;
    currentHealth: number;
    currentRating: number;
  } | null {
    if (!this.scenarioManager) return null;

    return this.scenarioManager.getProgress();
  }

  /**
   * Check if equipment has active particle effects.
   */
  public hasActiveParticles(): boolean {
    return this.equipmentManager.hasParticles();
  }

  /**
   * Get count of visual updates to grass rendering (for testing visual updates).
   */
  public getGrassRenderUpdateCount(): number {
    return this.grassSystem.getUpdateCount();
  }

  /**
   * Get UI state for testing.
   */
  public getUIState(): {
    isPaused: boolean;
    overlayMode: string;
    notificationCount: number;
  } {
    return {
      isPaused: this.isPaused,
      overlayMode: this.grassSystem.getOverlayMode(),
      notificationCount: 0, // Can be expanded if UIManager tracks this
    };
  }

  public setPaused(paused: boolean): void {
    if (paused) {
      this.pauseGame();
    } else {
      this.resumeGame();
    }
  }

  /**
   * Trigger a refill manually (for testing).
   */
  public refillAtCurrentPosition(): { success: boolean; cost: number } {
    const playerPos = { x: this.player.gridX, y: this.player.gridY };
    const isAtStation = REFILL_STATIONS.some(
      (station) => station.x === playerPos.x && station.y === playerPos.y
    );

    if (!isAtStation) {
      return { success: false, cost: 0 };
    }

    const cost = this.equipmentManager.refill();
    const timestamp = this.gameDay * 24 * 60 + this.gameTime;
    const expenseResult = addExpense(
      this.economyState,
      cost,
      "supplies",
      "Equipment refill",
      timestamp,
      false
    );
    if (expenseResult) {
      this.economyState = expenseResult;
    }

    return { success: true, cost };
  }

  /**
   * Check if player is at a refill station.
   */
  public isAtRefillStation(): boolean {
    const playerPos = { x: this.player.gridX, y: this.player.gridY };
    return REFILL_STATIONS.some(
      (station) => station.x === playerPos.x && station.y === playerPos.y
    );
  }

  /**
   * Get list of all refill station positions.
   */
  public getRefillStations(): Array<{ x: number; y: number }> {
    return REFILL_STATIONS.map(s => ({ x: s.x, y: s.y }));
  }

  /**
   * Manually trigger grass growth (for testing).
   * Simulates the specified number of game minutes of grass growth.
   * Note: GrassSystem.update uses deltaMinutes = (deltaMs/1000) * 2, so we account for that.
   */
  public forceGrassGrowth(minutes: number): void {
    const deltaMs = minutes * 500;
    this.grassSystem.update(deltaMs, this.gameDay * 1440 + this.gameTime);
  }

  /**
   * Get terrain editor state.
   */
  public getTerrainEditorState(): {
    enabled: boolean;
    tool: string | null;
    brushSize: number;
    canUndo: boolean;
    canRedo: boolean;
  } {
    if (!this.terrainEditorSystem) {
      return {
        enabled: false,
        tool: null,
        brushSize: 1,
        canUndo: false,
        canRedo: false,
      };
    }

    return {
      enabled: this.terrainEditorSystem.isEnabled(),
      tool: this.terrainEditorSystem.getCurrentTool(),
      brushSize: this.terrainEditorSystem.getBrushSize(),
      canUndo: this.terrainEditorSystem.canUndo(),
      canRedo: this.terrainEditorSystem.canRedo(),
    };
  }

  public dispose(): void {
    this.inputManager.dispose();
    this.grassSystem.dispose();
    this.equipmentManager.dispose();
    this.uiManager.dispose();
    this.terrainEditorSystem?.dispose();
    this.terrainEditorUI?.dispose();
    this.editorUITexture?.dispose();

    // Dispose player visual
    if (this.playerVisual) {
      disposeEntityMesh(this.playerVisual);
      this.playerVisual = null;
    }

    // Dispose employee visual system
    this.employeeVisualSystem?.dispose();
    this.employeeVisualSystem = null;

    // Dispose irrigation render system
    this.irrigationRenderSystem?.dispose();

    for (const mesh of this.obstacleMeshes) {
      mesh.dispose();
    }

    // Clear asset cache to free master meshes
    clearAssetCache();

    this.babylonEngine.dispose();
  }

  private showTutorialHint(id: string, message: string, color?: string): void {
    if (this.shownTutorialHints.has(id)) return;
    if (this.currentScenario?.id !== "tutorial_basics") return;
    this.shownTutorialHints.add(id);
    this.uiManager.showNotification(message, color, 5000);
  }

  private checkTutorialHints(): void {
    if (this.currentScenario?.id !== "tutorial_basics") return;

    const courseStats = this.grassSystem.getCourseStats();
    const hours = Math.floor(this.gameTime / 60);

    if (this.gameDay === 1 && hours >= 6 && hours < 7) {
      this.showTutorialHint(
        "welcome",
        "🎓 Welcome! Use WASD to move around your course."
      );
    }

    if (this.gameDay === 1 && hours >= 8) {
      this.showTutorialHint(
        "equipment",
        "🎓 Press 1/2/3 to select equipment, Space to toggle on/off."
      );
    }

    if (courseStats.health < 65) {
      this.showTutorialHint(
        "health_low",
        "🎓 Course health is low! Mow (1), water (2), or fertilize (3)."
      );
    }

    const mowerState = this.equipmentManager.getState("mower");
    const sprinklerState = this.equipmentManager.getState("sprinkler");
    const spreaderState = this.equipmentManager.getState("spreader");
    if (
      (mowerState && mowerState.resourceCurrent < 20) ||
      (sprinklerState && sprinklerState.resourceCurrent < 20) ||
      (spreaderState && spreaderState.resourceCurrent < 20)
    ) {
      this.showTutorialHint(
        "refill",
        "🎓 Running low on supplies! Press E near the refill station."
      );
    }

    if (this.gameDay === 2 && hours >= 7) {
      this.showTutorialHint(
        "panels",
        "🎓 Press H=Employees, Y=Research, G=TeeSheet, K=Marketing"
      );
    }

    if (this.prestigeState.golfersRejectedToday >= 3) {
      this.showTutorialHint(
        "pricing",
        "🎓 Golfers leaving! Lower prices with - button in prestige panel.",
        "#ffaa44"
      );
    }
  }

  /**
   * Get autonomous robot state.
   */
  public getRobotState(): {
    totalRobots: number;
    workingRobots: number;
    brokenRobots: number;
  } {
    return {
      totalRobots: this.autonomousState.robots.length,
      workingRobots: countWorkingRobots(this.autonomousState),
      brokenRobots: countBrokenRobots(this.autonomousState),
    };
  }

  /**
   * Get available robots for purchase.
   */
  public getAvailableRobots(): Array<{ equipmentId: string; ownedCount: number }> {
    return getAvailableRobotsToPurchase(this.researchState, this.autonomousState);
  }

  /**
   * Get walk-on queue state.
   */
  public getWalkOnState(): {
    queueLength: number;
    totalServed: number;
    totalTurnedAway: number;
  } {
    return {
      queueLength: this.walkOnState.queue.length,
      totalServed: this.walkOnState.metrics.walkOnsServedToday,
      totalTurnedAway: this.walkOnState.metrics.walkOnsTurnedAwayToday,
    };
  }

  /**
   * Get revenue state.
   */
  public getRevenueState(): {
    greenFees: number;
    cartFees: number;
    proShopSales: number;
    foodBeverage: number;
  } {
    return {
      greenFees: this.revenueState.todaysRevenue.greenFees,
      cartFees: this.revenueState.todaysRevenue.cartFees,
      proShopSales: this.revenueState.todaysRevenue.proShop,
      foodBeverage: this.revenueState.todaysRevenue.foodAndBeverage,
    };
  }

  /**
   * Get weather state.
   */
  public getWeatherState(): {
    condition: string;
    temperature: number;
    windSpeed: number;
  } {
    return {
      condition: this.weatherState.current.type,
      temperature: this.weatherState.current.temperature,
      windSpeed: this.weatherState.current.windSpeed,
    };
  }

  /**
   * Set weather condition type (for testing).
   */
  public setWeatherCondition(type: "sunny" | "cloudy" | "rainy" | "stormy"): void {
    const newCondition: WeatherCondition = {
      type,
      temperature: this.weatherState.current.temperature,
      windSpeed: this.weatherState.current.windSpeed,
    };
    this.weatherState = {
      ...this.weatherState,
      current: newCondition,
    };
  }

  /**
   * Get employee work state.
   */
  public getEmployeeWorkState(): {
    workerCount: number;
    activeWorkers: number;
    idleWorkers: number;
  } {
    const workers = this.employeeWorkState.workers;
    const activeCount = workers.filter(w => w.currentTask !== 'idle').length;
    return {
      workerCount: workers.length,
      activeWorkers: activeCount,
      idleWorkers: workers.length - activeCount,
    };
  }

  /**
   * Get terrain grid dimensions.
   */
  public getTerrainDimensions(): { width: number; height: number } {
    const cells = this.grassSystem.getAllCells();
    return {
      width: cells[0]?.length ?? 0,
      height: cells.length,
    };
  }

  /**
   * Get terrain cell data at position.
   */
  public getTerrainCellData(x: number, y: number): {
    type: string;
    elevation: number;
    moisture: number;
    nutrients: number;
    height: number;
    health: number;
  } | null {
    const cell = this.grassSystem.getCell(x, y);
    if (!cell) return null;

    return {
      type: cell.type,
      elevation: cell.elevation,
      moisture: cell.moisture,
      nutrients: cell.nutrients,
      height: cell.height,
      health: cell.health,
    };
  }

  /**
   * Get all terrain types present.
   */
  public getTerrainTypes(): string[] {
    const types = new Set<string>();
    const cells = this.grassSystem.getAllCells();
    for (const row of cells) {
      for (const cell of row) {
        types.add(cell.type);
      }
    }
    return Array.from(types);
  }

  // ============================================================================
  // Save Game APIs
  // ============================================================================

  public deleteSaveGame(scenarioId: string): boolean {
    return deleteSave(scenarioId);
  }

  public getSaveGameInfo(scenarioId?: string): { savedAt: number; gameDay: number } | null {
    const id = scenarioId || this.currentScenario?.id || 'sandbox';
    return getSaveInfo(id);
  }

  public listSaveGames(): Array<{ scenarioId: string; savedAt: number; gameDay: number }> {
    return listSaves();
  }

  // ============================================================================
  // Reputation APIs
  // ============================================================================

  public getReputationSummaryData(): {
    score: number;
    starRating: number;
    trend: string;
    totalTurnAways: number;
    returnRate: number;
  } {
    const summary = getReputationSummary(this.reputationState);
    return {
      score: calculateReputationScore(this.reputationState),
      starRating: summary.starRating,
      trend: summary.trend,
      totalTurnAways: this.reputationState.totalTurnAways,
      returnRate: summary.returnRate,
    };
  }

  public trackGolferVisitForReputation(golferId: string, isReturning: boolean): void {
    this.reputationState = trackGolferVisit(
      this.reputationState,
      golferId,
      isReturning
    );
  }

  public trackTurnAwayForReputation(): void {
    this.reputationState = trackTurnAway(this.reputationState);
  }

  // ============================================================================
  // Walk-On APIs
  // ============================================================================

  public getWalkOnSummary(): {
    queueLength: number;
    served: number;
    turnedAway: number;
    gaveUp: number;
    avgWait: number;
    estimatedWait: number;
  } {
    const summary = getWalkOnSummary(this.walkOnState);
    return {
      queueLength: getQueueLength(this.walkOnState),
      served: summary.served,
      turnedAway: summary.turnedAway,
      gaveUp: summary.gaveUp,
      avgWait: summary.averageWait,
      estimatedWait: getEstimatedWaitTime(this.walkOnState),
    };
  }

  public updateWalkOnPolicy(maxWaitMinutes?: number, maxQueueSize?: number): void {
    const updates: Partial<{ maxWaitMinutes: number; maxQueueSize: number }> = {};
    if (maxWaitMinutes !== undefined) updates.maxWaitMinutes = maxWaitMinutes;
    if (maxQueueSize !== undefined) updates.maxQueueSize = maxQueueSize;
    this.walkOnState = updateWalkOnPolicy(this.walkOnState, updates);
  }

  public addWalkOnGolfer(): boolean {
    const currentTime: GameTime = {
      day: this.gameDay,
      hour: Math.floor(this.gameTime / 60),
      minute: this.gameTime % 60,
    };
    const golfer = createWalkOnGolfer(
      `walkon_${Date.now()}`,
      `Walk-On ${Date.now() % 1000}`,
      currentTime
    );
    const result = addWalkOnToQueue(this.walkOnState, golfer);
    this.walkOnState = result.state;
    return result.accepted;
  }

  // ============================================================================
  // Revenue APIs
  // ============================================================================

  public getRevenueSummaryData(): {
    todaysGross: number;
    todaysNet: number;
    weeklyAvg: number;
    monthlyAvg: number;
    topRevenueSource: string;
  } {
    const summary = getRevenueSummary(this.revenueState);
    const sources: Array<{ name: string; value: number }> = [
      { name: 'greenFees', value: summary.today.greenFees },
      { name: 'cartFees', value: summary.today.cartFees },
      { name: 'proShop', value: summary.today.proShop },
      { name: 'foodAndBeverage', value: summary.today.foodAndBeverage },
    ];
    const topSource = sources.reduce((a, b) => a.value > b.value ? a : b);
    return {
      todaysGross: summary.today.grossRevenue,
      todaysNet: summary.today.netRevenue,
      weeklyAvg: summary.weeklyAverage.grossRevenue,
      monthlyAvg: summary.monthlyAverage.grossRevenue,
      topRevenueSource: topSource.name,
    };
  }

  public calculateGreenFeeForGolfer(
    membershipType: 'public' | 'member' | 'guest_of_member' = 'public'
  ): number {
    const hour = Math.floor(this.gameTime / 60);
    const dayOfWeek = this.gameDay % 7;
    return calculateGreenFee(
      this.revenueState.greenFeeStructure,
      dayOfWeek,
      hour,
      membershipType
    );
  }

  public calculateCartFeeForGolfer(): number {
    const hour = Math.floor(this.gameTime / 60);
    return calculateCartFee(this.revenueState.cartFeeStructure, isTwilightHour(hour));
  }

  public getAverageRevenue(days: number = 7): number {
    const avgRevenue = calculateAverageRevenue(this.revenueState, days);
    return avgRevenue.grossRevenue;
  }

  // ============================================================================
  // Autonomous Robot APIs
  // ============================================================================

  public purchaseRobotUnit(equipmentId: string): boolean {
    const availableRobots = getAvailableRobotsToPurchase(this.researchState, this.autonomousState);
    const robot = availableRobots.find(r => r.equipmentId === equipmentId);
    if (!robot) return false;

    const result = purchaseRobot(this.autonomousState, equipmentId, robot.stats);
    if (!result) return false;

    if (result.cost > this.economyState.cash) return false;

    this.autonomousState = result.state;
    const timestamp = this.gameDay * 24 * 60 + this.gameTime;
    const expenseResult = addExpense(
      this.economyState,
      result.cost,
      'equipment_purchase',
      `Robot purchase: ${equipmentId}`,
      timestamp
    );
    if (expenseResult) {
      this.economyState = expenseResult;
    }
    return true;
  }

  public sellRobotUnit(robotId: string): boolean {
    const result = sellRobot(this.autonomousState, robotId);
    if (!result) return false;

    this.autonomousState = result.state;
    const timestamp = this.gameDay * 24 * 60 + this.gameTime;
    const incomeResult = addIncome(
      this.economyState,
      result.refund,
      'equipment_purchase',
      `Robot sale: ${robotId}`,
      timestamp
    );
    this.economyState = incomeResult;
    return true;
  }

  public getRobotList(): Array<{ id: string; type: string; state: string; battery: number }> {
    return this.autonomousState.robots.map(r => ({
      id: r.id,
      type: r.type,
      state: r.state,
      battery: r.resourceCurrent,
    }));
  }

  // ============================================================================
  // Time Utility APIs (for tee-revenue coverage)
  // ============================================================================

  public isCurrentTimeWeekend(): boolean {
    return isWeekend(this.gameDay % 7);
  }

  public isCurrentTimePrimeMorning(): boolean {
    return isPrimeMorning(Math.floor(this.gameTime / 60));
  }

  public isCurrentTimeTwilight(): boolean {
    return isTwilightHour(Math.floor(this.gameTime / 60));
  }

  // ============================================================================
  // Weather Helper APIs
  // ============================================================================

  public getWeatherDescription(): string {
    return getWeatherDescription(this.weatherState.current);
  }

  public getWeatherImpact(): string {
    return getWeatherImpactDescription(this.weatherState.current);
  }

  public getCurrentSeason(): string {
    return getSeasonFromDay(this.gameDay).season;
  }

  // ============================================================================
  // Test/Debug APIs for E2E Coverage
  // ============================================================================

  public completeResearch(itemId: string): boolean {
    const newState = completeResearchInstantly(this.researchState, itemId);
    if (!newState) return false;
    this.researchState = newState;
    return true;
  }

  public completeResearchWithPrerequisites(itemId: string): boolean {
    const chain = getPrerequisiteChain(itemId);
    for (const prereqId of chain) {
      if (!this.researchState.completedResearch.includes(prereqId)) {
        const result = completeResearchInstantly(this.researchState, prereqId);
        if (result) {
          this.researchState = result;
        }
      }
    }
    return this.completeResearch(itemId);
  }

  public getResearchDetails(itemId: string): {
    status: string;
    progress: number;
    prerequisites: string[];
  } {
    return {
      status: getResearchStatus(this.researchState, itemId),
      progress: getResearchProgress(this.researchState),
      prerequisites: getPrerequisiteChain(itemId) as string[],
    };
  }

  public takeLoan(size: "small" | "medium" | "large"): boolean {
    const terms = DEFAULT_LOAN_TERMS[size];
    const result = takeLoan(this.economyState, terms, this.gameTime);
    if (!result) return false;
    this.economyState = result;
    return true;
  }

  public makeLoanPayment(loanId: string): boolean {
    const result = makeLoanPayment(this.economyState, loanId, this.gameTime);
    if (!result) return false;
    this.economyState = result;
    return true;
  }

  public payOffLoan(loanId: string): boolean {
    const result = payOffLoan(this.economyState, loanId, this.gameTime);
    if (!result) return false;
    this.economyState = result;
    return true;
  }

  public getLoanState(): {
    loans: Array<{
      id: string;
      principal: number;
      remainingBalance: number;
      interestRate: number;
      monthlyPayment: number;
    }>;
    totalDebt: number;
    netWorth: number;
    canTakeLoan: boolean;
  } {
    return {
      loans: this.economyState.loans.map((l) => ({
        id: l.id,
        principal: l.principal,
        remainingBalance: l.remainingBalance,
        interestRate: l.interestRate,
        monthlyPayment: l.monthlyPayment,
      })),
      totalDebt: getTotalDebt(this.economyState),
      netWorth: getNetWorth(this.economyState),
      canTakeLoan: this.economyState.loans.length < 3,
    };
  }

  public getTransactionHistory(
    startTime?: number,
    endTime?: number
  ): Array<{
    id: string;
    amount: number;
    category: string;
    description: string;
    timestamp: number;
  }> {
    const start = startTime ?? 0;
    const end = endTime ?? this.gameTime;
    return getTransactionsInRange(this.economyState, start, end).map((t) => ({
      id: t.id,
      amount: t.amount,
      category: t.category,
      description: t.description,
      timestamp: t.timestamp,
    }));
  }

  public getFinancialSummary(): {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
  } {
    const summary = calculateFinancialSummary(this.economyState.transactions);
    return {
      totalIncome: summary.totalIncome,
      totalExpenses: summary.totalExpenses,
      netProfit: summary.netProfit,
    };
  }

  public forceHireGroundskeeper(): string | null {
    const employee = createEmployee("groundskeeper", "novice", this.gameTime);
    this.employeeRoster = {
      ...this.employeeRoster,
      employees: [...this.employeeRoster.employees, employee],
    };
    this.employeeWorkState = syncWorkersWithRoster(
      this.employeeWorkState,
      this.employeeRoster.employees
    );
    return employee.id;
  }

  public getWorkerDetails(): Array<{
    employeeId: string;
    gridX: number;
    gridY: number;
    task: string;
    targetX: number | null;
    targetY: number | null;
  }> {
    return getWorkerPositions(this.employeeWorkState).map((w) => ({
      employeeId: w.employeeId,
      gridX: w.gridX,
      gridY: w.gridY,
      task: w.task,
      targetX: w.nextX,
      targetY: w.nextY,
    }));
  }

  public getRobotDetails(): Array<{
    id: string;
    type: string;
    state: string;
    battery: number;
    gridX: number;
    gridY: number;
    targetX: number | null;
    targetY: number | null;
    breakdownTimeRemaining: number;
  }> {
    return this.autonomousState.robots.map((r) => ({
      id: r.id,
      type: r.type,
      state: r.state,
      battery: Math.round((r.resourceCurrent / r.resourceMax) * 100),
      gridX: Math.round(r.gridX),
      gridY: Math.round(r.gridY),
      targetX: r.targetX,
      targetY: r.targetY,
      breakdownTimeRemaining: r.breakdownTimeRemaining,
    }));
  }

  public getScenarioObjective(): {
    type: string;
    description: string;
    timeLimitDays?: number;
  } | null {
    if (!this.scenarioManager) return null;
    const objective = this.scenarioManager.getObjective();
    const conditions = this.scenarioManager.getConditions();
    return {
      type: objective.type,
      description: this.scenarioManager.getObjectiveDescription(),
      timeLimitDays: conditions.timeLimitDays,
    };
  }

  public forceScenarioProgress(updates: {
    daysElapsed?: number;
    totalRevenue?: number;
    totalExpenses?: number;
    totalGolfers?: number;
    totalRounds?: number;
    currentHealth?: number;
    currentRating?: number;
    daysAtTargetRating?: number;
  }): void {
    if (!this.scenarioManager) return;
    this.scenarioManager.updateProgress(updates);
  }

  public checkScenarioObjective(): {
    completed: boolean;
    failed: boolean;
    progress: number;
    message?: string;
  } {
    if (!this.scenarioManager) {
      return { completed: false, failed: false, progress: 0 };
    }
    return this.scenarioManager.checkObjective();
  }

  public addRevenue(amount: number, category: string = "green_fees"): void {
    if (this.scenarioManager) {
      this.scenarioManager.addRevenue(amount);
    }
    this.economyState = addIncome(
      this.economyState,
      amount,
      category as any,
      "Test revenue",
      this.gameTime
    );
  }

  public addExpenseAmount(amount: number, category: string = "supplies"): void {
    if (this.scenarioManager) {
      this.scenarioManager.addExpense(amount);
    }
    const result = addExpense(
      this.economyState,
      amount,
      category as any,
      "Test expense",
      this.gameTime,
      true
    );
    if (result) {
      this.economyState = result;
    }
  }

  public incrementScenarioDay(): void {
    if (this.scenarioManager) {
      this.scenarioManager.incrementDay();
    }
  }

  public updateCourseHealthForScenario(): void {
    if (this.scenarioManager && this.grassSystem) {
      this.scenarioManager.updateCourseHealth(this.grassSystem.getAllCells());
    }
  }

  public checkSatisfactionStreak(targetRating: number): void {
    if (this.scenarioManager) {
      this.scenarioManager.checkSatisfactionStreak(targetRating);
    }
  }

  public addGolferCount(count: number): void {
    if (this.scenarioManager) {
      this.scenarioManager.addGolfers(count);
    }
  }

  public addRoundCount(): void {
    if (this.scenarioManager) {
      this.scenarioManager.addRound();
    }
  }

  public getDetailedResearchState(): {
    completedResearch: string[];
    currentResearch: { itemId: string; progress: number } | null;
    researchQueue: string[];
    fundingLevel: string;
    availableResearch: string[];
  } {
    const available = getAvailableResearchItems(this.researchState);
    return {
      completedResearch: [...this.researchState.completedResearch],
      currentResearch: this.researchState.currentResearch
        ? {
            itemId: this.researchState.currentResearch.itemId,
            progress: Math.round(
              (this.researchState.currentResearch.pointsEarned /
                this.researchState.currentResearch.pointsRequired) *
                100
            ),
          }
        : null,
      researchQueue: [...this.researchState.researchQueue],
      fundingLevel: this.researchState.fundingLevel,
      availableResearch: available.map((r) => r.id),
    };
  }
}

export function startBabylonGame(
  canvasId: string,
  options: GameOptions = {}
): BabylonMain {
  const game = new BabylonMain(canvasId, options);
  game.setRunning(true);
  return game;
}
