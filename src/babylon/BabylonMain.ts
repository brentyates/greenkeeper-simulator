import { BabylonEngine, gridTo3D, HEIGHT_UNIT } from "./engine/BabylonEngine";
import { GameAPI, GameContext } from "./GameAPI";
import { SimulationContext, runSimulationTick } from "./SimulationTick";

import { InputManager, Direction, EquipmentSlot } from "./engine/InputManager";
import { GrassSystem, OverlayMode } from "./systems/GrassSystem";
import { VectorTerrainSystem } from "./systems/VectorTerrainSystem";
import { TerrainSystem } from "./systems/TerrainSystemInterface";
import { EquipmentManager } from "./systems/EquipmentManager";
import { EmployeeVisualSystem } from "./systems/EmployeeVisualSystem";
import { IrrigationRenderSystem } from "./systems/IrrigationRenderSystem";
import { EntityVisualState } from "./systems/EntityVisualSystem";
import {
  clearAssetCache,
  loadAsset,
  createInstance,
  disposeInstance,
  AssetInstance,
  AssetId,
} from "./assets/AssetLoader";
import { UIManager } from "./ui/UIManager";
import { DaySummaryData } from "./ui/DaySummaryPopup";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/core/Culling/ray";

import { PlayerController } from "./PlayerController";
import { UIPanelCoordinator } from "./UIPanelCoordinator";
import { TerrainEditorController } from "./TerrainEditorController";

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
  addIncome,
  addExpense,
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
  syncWorkersWithRoster,
} from "../core/employee-work";
import {
  GolferPoolState,
  GreenFeeStructure,
  createInitialPoolState,
  getActiveGolferCount,
  getAverageSatisfaction,
  WeatherCondition,
  DEFAULT_GREEN_FEES,
} from "../core/golfers";
import {
  ResearchState,
  createInitialResearchState,
  getBestFertilizerEffectiveness,
} from "../core/research";
import { ScenarioManager } from "../core/scenario";
import {
  PrestigeState,
  createInitialPrestigeState,
  calculateCurrentConditionsFromFaces,
  updatePrestigeScore,
  takeDailySnapshot,
  updateHistoricalExcellence,
  upgradeAmenity,
} from "../core/prestige";
import { AmenityUpgrade, getUpgradeCost } from "../core/amenities";
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
  startCampaign,
  canStartCampaign,
} from "../core/marketing";
import {
  createSaveState,
  saveGame,
  loadGame,
  hasSave,
  deserializeFaceStates,
} from "../core/save-game";
import {
  AutonomousEquipmentState,
  createInitialAutonomousState,
} from "../core/autonomous-equipment";
import {
  WeatherState,
  createInitialWeatherState,
  getSeasonFromDay,
} from "../core/weather";
import {
  ReputationState,
  createInitialReputationState,
} from "../core/reputation";

export interface GameOptions {
  scenario?: ScenarioDefinition;
  loadFromSave?: boolean;
  onReturnToMenu?: () => void;
  onScenarioComplete?: (score: number) => void;
  useVectorTerrain?: boolean;  // Use SDF-based vector terrain rendering
}

export class BabylonMain {
  private babylonEngine: BabylonEngine;
  private inputManager: InputManager;
  private terrainSystem: TerrainSystem;
  private vectorTerrainSystem: VectorTerrainSystem | null = null;
  private equipmentManager: EquipmentManager;
  private uiManager: UIManager;
  private lastTime: number = 0;
  private gameTime: number = 6 * 60;
  private gameDay: number = 1;
  private timeScale: number = 1;
  private isPaused: boolean = false;
  private isMuted: boolean = false;
  private overlayAutoSwitched: boolean = false;

  private playerController!: PlayerController;
  private uiPanelCoordinator!: UIPanelCoordinator;
  private terrainEditorController!: TerrainEditorController;

  private score: number = 0;
  private obstacleMeshes: Mesh[] = [];
  private treeInstances: AssetInstance[] = [];
  private refillStationInstances: AssetInstance[] = [];

  private employeeVisualSystem: EmployeeVisualSystem | null = null;
  private irrigationRenderSystem: IrrigationRenderSystem | null = null;
  private irrigationSystem: IrrigationSystem = createInitialIrrigationSystem();

  private applicationState: ApplicationState = createInitialApplicationState();
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

    const startX = Math.floor(course.width / 2);
    const startY = Math.floor(course.height * 0.75);
    this.babylonEngine = new BabylonEngine(
      canvasId,
      course.width,
      course.height
    );
    this.inputManager = new InputManager(this.babylonEngine.getScene());

    if (options.useVectorTerrain) {
      this.vectorTerrainSystem = new VectorTerrainSystem(this.babylonEngine.getScene(), course);
      this.terrainSystem = this.vectorTerrainSystem;
    } else {
      this.terrainSystem = new GrassSystem(this.babylonEngine.getScene(), course);
    }

    this.equipmentManager = new EquipmentManager(this.babylonEngine.getScene());
    this.employeeVisualSystem = new EmployeeVisualSystem(
      this.babylonEngine.getScene(),
      { getElevationAt: (x, y, d) => this.terrainSystem.getElevationAt(x, y, d) }
    );
    this.uiManager = new UIManager(this.babylonEngine.getScene());
    this.irrigationRenderSystem = new IrrigationRenderSystem(
      this.babylonEngine.getScene(),
      { getElevationAt: (x, y, d) => this.terrainSystem.getElevationAt(x, y, d) }
    );

    this.playerController = new PlayerController(
      this.babylonEngine.getScene(),
      {
        getCell: (x, y) => this.terrainSystem.getCell(x, y),
        getElevationAt: (x, y, d) => this.terrainSystem.getElevationAt(x, y, d),
        getCourseStats: () => this.terrainSystem.getCourseStats(),
        getGridDimensions: () => this.terrainSystem.getGridDimensions(),
        isPositionWalkable: (wx, wz) => this.terrainSystem.isPositionWalkable(wx, wz),
        getTerrainSpeedAt: (wx, wz) => this.terrainSystem.getTerrainSpeedAt(wx, wz),
        findFaceAtPosition: (wx, wz) => this.terrainSystem.findFaceAtPosition(wx, wz),
        mowAt: (gx, gy) => this.terrainSystem.mowAt(gx, gy),
        waterArea: (cx, cy, r, a) => this.terrainSystem.waterArea(cx, cy, r, a),
        fertilizeArea: (cx, cy, r, a, e) => this.terrainSystem.fertilizeArea(cx, cy, r, a, e),
        getResolution: () => this.terrainSystem.getResolution?.() ?? 1,
      },
      {
        getSelected: () => this.equipmentManager.getSelected(),
        getCurrentState: () => this.equipmentManager.getCurrentState(),
        isActive: () => this.equipmentManager.isActive(),
      },
      {
        getScene: () => this.babylonEngine.getScene(),
        getCamera: () => this.babylonEngine.getCamera(),
        setCameraTarget: (t) => this.babylonEngine.setCameraTarget(t),
        updateCameraPan: (d, dirs) => this.babylonEngine.updateCameraPan(d, dirs),
      },
      {
        isDirectionKeyHeld: (d) => this.inputManager.isDirectionKeyHeld(d),
      },
      {
        editor: { isEnabled: () => this.terrainEditorController.isEnabled() },
        onEquipmentEffect: (x, y) => this.applyEquipmentEffect(x, y),
        startX,
        startY,
      }
    );

    this.terrainEditorController = new TerrainEditorController({
      getScene: () => this.babylonEngine.getScene(),
      getCamera: () => this.babylonEngine.getCamera(),
      screenToWorldPosition: (sx, sy) => this.babylonEngine.screenToWorldPosition(sx, sy),
      setCameraTarget: (t) => this.babylonEngine.setCameraTarget(t),
      getTerrainSystem: () => this.terrainSystem,
      getVectorTerrainSystem: () => this.vectorTerrainSystem,
      getCourseWidth: () => this.currentCourse.width,
      getCourseHeight: () => this.currentCourse.height,
      getPlayerVisual: () => this.playerController.getPlayerVisual(),
      getPlayerGridPosition: () => {
        const p = this.playerController.getPlayer();
        return { gridX: p.gridX, gridY: p.gridY };
      },
      setPlayerVisualEnabled: (enabled) => {
        const pv = this.playerController.getPlayerVisual();
        if (pv) pv.container.setEnabled(enabled);
      },
      setEmployeeVisualSystemVisible: (visible) => this.employeeVisualSystem?.setVisible(visible),
      snapEmployeesToTerrain: () => this.employeeVisualSystem?.snapAllToTerrain(),
      snapEntityToTerrain: (visual, gx, gy) => this.snapEntityToTerrain(visual, gx, gy),
      snapAssetsToTerrain: () => this.snapAssetsToTerrain(),
    });

    const self = this;
    this.uiPanelCoordinator = new UIPanelCoordinator(
      this.babylonEngine.getScene(),
      {
        get economyState() { return self.economyState; },
        set economyState(v) { self.economyState = v; },
        get employeeRoster() { return self.employeeRoster; },
        set employeeRoster(v) { self.employeeRoster = v; },
        get employeeWorkState() { return self.employeeWorkState; },
        set employeeWorkState(v) { self.employeeWorkState = v; },
        get applicationState() { return self.applicationState; },
        set applicationState(v) { self.applicationState = v; },
        get researchState() { return self.researchState; },
        set researchState(v) { self.researchState = v; },
        get prestigeState() { return self.prestigeState; },
        set prestigeState(v) { self.prestigeState = v; },
        get teeTimeState() { return self.teeTimeState; },
        set teeTimeState(v) { self.teeTimeState = v; },
        get walkOnState() { return self.walkOnState; },
        set walkOnState(v) { self.walkOnState = v; },
        get revenueState() { return self.revenueState; },
        set revenueState(v) { self.revenueState = v; },
        get marketingState() { return self.marketingState; },
        set marketingState(v) { self.marketingState = v; },
        get autonomousState() { return self.autonomousState; },
        set autonomousState(v) { self.autonomousState = v; },
        get irrigationSystem() { return self.irrigationSystem; },
        set irrigationSystem(v) { self.irrigationSystem = v; },
        get irrigationRenderSystem() { return self.irrigationRenderSystem; },
        get greenFees() { return self.greenFees; },
        set greenFees(v) { self.greenFees = v; },
        get gameTime() { return self.gameTime; },
        get gameDay() { return self.gameDay; },
        get dailyStats() { return self.dailyStats; },
        set dailyStats(v) { self.dailyStats = v; },
        uiManager: this.uiManager,
        resetDailyStats: () => this.resetDailyStats(),
        pauseGame: () => this.pauseGame(),
      }
    );

    this.setupInputCallbacks();
    this.buildScene();
    this.terrainEditorController.setup();
    this.uiPanelCoordinator.setupAll();
    this.setupUpdateLoop();

    if (options.loadFromSave && this.loadSavedGame()) {
      this.uiManager.showNotification(`Loaded Day ${this.gameDay}`);
      this.playerController.updatePlayerPosition();
    }

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

  private resetDailyStats(): void {
    const courseStats = this.terrainSystem.getCourseStats();
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
    const courseStats = this.terrainSystem.getCourseStats();
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

    this.uiPanelCoordinator.showDaySummary(summaryData);
  }

  public saveCurrentGame(): void {
    if (!this.currentScenario || !this.scenarioManager) return;

    const cells = this.terrainSystem.getAllCells();
    const faceStates = this.terrainSystem.getAllFaceStates();
    const scenarioProgress = this.scenarioManager.getProgress();
    const state = createSaveState(
      this.currentScenario.id,
      this.gameTime,
      this.gameDay,
      this.playerController.getPlayer().gridX,
      this.playerController.getPlayer().gridY,
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
      this.irrigationSystem,
      faceStates
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
    this.playerController.teleport(saved.playerX, saved.playerY);
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

    if (saved.faceStates && saved.faceStates.length > 0) {
      this.terrainSystem.restoreFaceStates(deserializeFaceStates(saved.faceStates));
    } else if (saved.cells && saved.cells.length > 0) {
      this.terrainSystem.restoreCells(saved.cells);
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
    const editorSystem = () => this.terrainEditorController.getSystem();

    this.inputManager.setCallbacks({
      onMove: (direction: Direction) => {
        if (this.terrainEditorController.isEnabled()) return;
        const dirMap: Record<Direction, "up" | "down" | "left" | "right"> = {
          up: "up",
          down: "down",
          left: "left",
          right: "right",
        };
        this.movePlayer(dirMap[direction]);
      },

      onEquipmentSelect: (slot: EquipmentSlot) => {
        this.selectEquipment(slot);
      },

      onEquipmentToggle: () => {
        this.toggleEquipment();
      },

      onRefill: () => this.handleRefill(),
      onOverlayCycle: () => this.handleOverlayCycle(),
      onPause: () => this.handlePause(),
      onMute: () => this.handleMute(),
      onTimeSpeedUp: () => this.handleTimeSpeed(1),
      onTimeSlowDown: () => this.handleTimeSpeed(-1),
      onZoom: (delta: number) => this.handleZoom(delta),
      onDebugReload: () => this.handleDebugReload(),
      onDebugExport: () => this.handleDebugExport(),
      onClick: (screenX: number, screenY: number) =>
        this.handleClick(screenX, screenY),

      onEditorToggle: () => {
        this.setTerrainEditor(!this.isTerrainEditorEnabled());
      },

      onEditorToolSelect: (tool: number) => this.terrainEditorController.handleEditorToolNumber(tool),
      onEditorBrushSelect: (brush: string) =>
        this.terrainEditorController.handleEditorBrushSelect(brush),
      onEditorBrushSizeChange: (delta: number) =>
        this.terrainEditorController.handleEditorBrushSizeDelta(delta),
      onEditorBrushStrengthChange: (delta: number) =>
        this.terrainEditorController.handleEditorBrushStrengthDelta(delta),

      onMouseMove: (screenX: number, screenY: number) =>
        this.terrainEditorController.handleMouseMove(screenX, screenY),
      onDragStart: (screenX: number, screenY: number, shiftKey?: boolean) =>
        this.terrainEditorController.handleDragStart(screenX, screenY, shiftKey),
      onDrag: (screenX: number, screenY: number) =>
        this.terrainEditorController.handleDrag(screenX, screenY),
      onDragEnd: () => this.terrainEditorController.handleDragEnd(),
      onEmployeePanel: () => this.uiPanelCoordinator.handleEmployeePanel(),
      onResearchPanel: () => this.uiPanelCoordinator.handleResearchPanel(),
      onTeeSheetPanel: () => this.uiPanelCoordinator.handleTeeSheetPanel(),
      onMarketingPanel: () => this.uiPanelCoordinator.handleMarketingPanel(),
      onEquipmentStore: () => this.uiPanelCoordinator.handleEquipmentStore(),
      onAmenityPanel: () => this.uiPanelCoordinator.handleAmenityPanel(),
      onWalkOnQueuePanel: () => this.uiPanelCoordinator.handleWalkOnQueuePanel(),
      onSelectAll: () => {
        const es = editorSystem();
        if (es?.isEnabled() && es.getMode() === 'sculpt') {
          es.selectAllVertices();
        }
      },
      onDeselectAll: () => {
        const es = editorSystem();
        if (es?.isEnabled() && es.getMode() === 'sculpt') {
          es.deselectAllVertices();
        }
      },
      onAxisConstraint: (axis) => {
        const es = editorSystem();
        if (es?.isEnabled() && es.getMode() === 'sculpt') {
          es.setAxisConstraint(axis);
        }
      },
      onEdgeModeToggle: () => {
        editorSystem()?.setTopologyMode('edge');
      },
      onFaceModeToggle: () => {
        editorSystem()?.setTopologyMode('face');
      },
      onDeleteVertex: () => {
        editorSystem()?.handleDeleteSelectedTopologyVertices();
      },
      onSubdivideEdge: () => {
        editorSystem()?.subdivideSelectedEdge();
      },
      onFlipEdge: () => {
        editorSystem()?.flipSelectedEdge();
      },
      isInputBlocked: () => this.uiManager.isPauseMenuVisible(),
      isEditorActive: () => this.terrainEditorController.isEnabled(),
      isEdgeModeActive: () => editorSystem()?.getTopologyMode() === 'edge',
      isFaceModeActive: () => editorSystem()?.getTopologyMode() === 'face',
      onSelectModeToggle: () => {
        editorSystem()?.setInteractionMode('select');
      },
      onBrushModeToggle: () => {
        editorSystem()?.setInteractionMode('brush');
      },
    });
  }

  private buildScene(): void {
    this.terrainSystem.build(this.currentCourse);
    this.buildObstacles();
    this.buildRefillStations();
    this.playerController.createPlayer();
    this.playerController.updatePlayerPosition();
  }

  private buildObstacles(): void {
    const { obstacles } = this.currentCourse;
    if (!obstacles) return;

    for (const obs of obstacles) {
      const pos = this.terrainSystem.gridToWorld(obs.x, obs.y);

      if (obs.type === 1 || obs.type === 2) {
        this.createTree(pos.x, pos.y, pos.z, obs.type === 2);
      }
    }
  }

  private createTree(x: number, y: number, z: number, isPine: boolean): void {
    const scene = this.babylonEngine.getScene();
    const assetId: AssetId = isPine ? "tree.pine.medium" : "tree.oak.medium";
    const treeIndex = this.treeInstances.length;

    loadAsset(scene, assetId)
      .then((loadedAsset) => {
        const instance = createInstance(scene, loadedAsset, `tree_${treeIndex}`);
        instance.root.position = new Vector3(x, y, z);
        this.treeInstances.push(instance);
      })
      .catch((error) => {
        console.error(`[BabylonMain] Failed to load tree asset ${assetId}:`, error);
      });
  }

  private buildRefillStations(): void {
    const scene = this.babylonEngine.getScene();

    for (let i = 0; i < REFILL_STATIONS.length; i++) {
      const station = REFILL_STATIONS[i];
      const pos = this.terrainSystem.gridToWorld(station.x, station.y);

      loadAsset(scene, "building.refill.station")
        .then((loadedAsset) => {
          const instance = createInstance(scene, loadedAsset, `refill_${i}`);
          instance.root.position = new Vector3(pos.x, pos.y, pos.z);
          this.refillStationInstances.push(instance);
        })
        .catch((error) => {
          console.error(`[BabylonMain] Failed to load refill station:`, error);
        });
    }
  }

  public teleport(x: number, y: number): void {
    this.playerController.teleport(x, y);
  }

  private snapAssetsToTerrain(): void {
    const allInstances = [...this.treeInstances, ...this.refillStationInstances];
    for (const instance of allInstances) {
      const worldX = instance.root.position.x;
      const worldZ = instance.root.position.z;
      const elevation = this.terrainSystem.getElevationAt(worldX, worldZ, 0);
      instance.root.position.y = elevation * HEIGHT_UNIT;
    }
  }

  private snapEntityToTerrain(visual: EntityVisualState, gridX: number, gridY: number): void {
    const elevation = this.terrainSystem.getElevationAt(gridX, gridY, 0);
    const worldPos = gridTo3D(gridX + 0.5, gridY + 0.5, elevation);
    visual.container.position.copyFrom(worldPos);
    visual.lastGridX = gridX;
    visual.lastGridY = gridY;
    visual.targetGridX = gridX;
    visual.targetGridY = gridY;
    visual.visualProgress = 1;
  }

  private handleClick(screenX: number, screenY: number): void {
    if (this.isPaused) return;

    if (this.terrainEditorController.isEnabled()) {
      const result = this.terrainEditorController.screenToGridAndWorld(screenX, screenY);
      if (result) {
        this.terrainEditorController.getSystem()?.handleClick(result.gridX, result.gridY);
      }
      return;
    }

    this.playerController.handleClick(screenX, screenY);
  }

  private applyEquipmentEffect(x: number, y: number): void {
    const type = this.equipmentManager.getSelected();
    const state = this.equipmentManager.getCurrentState();
    if (!type || !state) return;

    switch (type) {
      case "mower":
        this.terrainSystem.mowAt(x, y);
        break;
      case "sprinkler":
        this.terrainSystem.waterArea(x, y, state.effectRadius, 15);
        break;
      case "spreader":
        this.terrainSystem.fertilizeArea(
          x,
          y,
          state.effectRadius,
          10,
          getBestFertilizerEffectiveness(this.researchState)
        );
        break;
    }
  }


  private handleRefill(): void {
    const player = this.playerController.getPlayer();
    const nearStation = REFILL_STATIONS.some((station) => {
      const dx = Math.abs(station.x - player.gridX);
      const dy = Math.abs(station.y - player.gridY);
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
    const mode = this.terrainSystem.cycleOverlayMode();
    this.uiManager.updateOverlayLegend(mode);
    this.overlayAutoSwitched = false;
    this.updateIrrigationVisibility();
  }

  private updateIrrigationVisibility(): void {
    if (this.irrigationRenderSystem) {
      const overlayMode = this.terrainSystem.getOverlayMode();
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

  private pauseGame(): void {
    this.isPaused = true;
    this.uiManager.showPauseMenu(
      () => this.resumeGame(),
      () => this.restartGame(),
      this.gameOptions.onReturnToMenu ? () => this.returnToMenu() : undefined,
      () => this.saveCurrentGame(),
      () => this.uiPanelCoordinator.handleEmployeePanel(),
      () => this.uiPanelCoordinator.handleResearchPanel(),
      () => this.uiPanelCoordinator.handleTeeSheetPanel(),
      () => this.uiPanelCoordinator.handleMarketingPanel(),
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
    this.playerController.teleport(startX, startY);
    this.gameTime = 6 * 60;
    this.gameDay = 1;
    this.score = 0;
    this.timeScale = 1;
    this.weatherState = createInitialWeatherState(this.gameDay);
    this.weather = this.weatherState.current;
    this.equipmentManager.refill();
    this.terrainSystem.dispose();
    if (this.gameOptions.useVectorTerrain) {
      this.terrainSystem = new VectorTerrainSystem(this.babylonEngine.getScene(), course);
    } else {
      this.terrainSystem = new GrassSystem(this.babylonEngine.getScene(), course);
    }
    this.terrainSystem.build(course);
    this.playerController.updatePlayerPosition();
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

  private handleZoom(delta: number): void {
    this.babylonEngine.handleZoom(delta);
  }



  private updateZoom(deltaMs: number): void {
    this.babylonEngine.updateSmoothZoom(deltaMs);
  }


  private handleDebugReload(): void {
    window.location.reload();
  }

  private handleDebugExport(): void {
    const player = this.playerController.getPlayer();
    const state = {
      playerX: player.gridX,
      playerY: player.gridY,
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

    const stats = this.terrainSystem.getCourseStats();
    this.uiManager.updateCourseStatus(
      stats.health,
      stats.moisture,
      stats.nutrients
    );
    const initPlayer = this.playerController.getPlayer();
    this.uiManager.updateMinimapPlayerPosition(
      initPlayer.gridX,
      initPlayer.gridY,
      course.width,
      course.height
    );

    this.babylonEngine.getScene().onBeforeRenderObservable.add(() => {
      const now = performance.now();
      const deltaMs = now - this.lastTime;
      this.lastTime = now;

      this.updateZoom(deltaMs);

      if (this.isPaused) {
        return;
      }

      if (this.terrainEditorController.isPausedByEditor()) {
        this.terrainSystem.update(0, this.gameDay * 1440 + this.gameTime, this.weather);

        if (this.terrainEditorController.isEnabled()) {
          this.playerController.updateEditorCamera(deltaMs);
        }
        return;
      }

      this.playerController.updateMovement(deltaMs);

      const pv = this.playerController.getPlayerVisual();
      if (pv) {
        const wasDeactivated = this.equipmentManager.update(
          deltaMs,
          pv.container.position
        );
        if (wasDeactivated) {
          if (this.overlayAutoSwitched) {
            this.terrainSystem.setOverlayMode("normal");
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

      this.terrainSystem.update(
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

      const courseStats = this.terrainSystem.getCourseStats();
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

      const p = this.playerController.getPlayer();
      this.uiManager.updateMinimapPlayerPosition(
        p.gridX,
        p.gridY,
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
    const ctx: SimulationContext = {
      economyState: this.economyState,
      employeeRoster: this.employeeRoster,
      employeeWorkState: this.employeeWorkState,
      golferPool: this.golferPool,
      researchState: this.researchState,
      weatherState: this.weatherState,
      weather: this.weather,
      teeTimeState: this.teeTimeState,
      walkOnState: this.walkOnState,
      revenueState: this.revenueState,
      marketingState: this.marketingState,
      autonomousState: this.autonomousState,
      prestigeState: this.prestigeState,
      irrigationSystem: this.irrigationSystem,
      reputationState: this.reputationState,
      applicationState: this.applicationState,
      dailyStats: this.dailyStats,
      greenFees: this.greenFees,
      gameTime: this.gameTime,
      gameDay: this.gameDay,
      timeScale: this.timeScale,
      lastPayrollHour: this.lastPayrollHour,
      lastArrivalHour: this.lastArrivalHour,
      lastAutoSaveHour: this.lastAutoSaveHour,
      lastPrestigeUpdateHour: this.lastPrestigeUpdateHour,
      lastTeeTimeUpdateHour: this.lastTeeTimeUpdateHour,
      accumulatedResearchTime: this.accumulatedResearchTime,
      terrainSystem: this.terrainSystem,
      scenarioManager: this.scenarioManager,
      uiManager: this.uiManager,
      employeeVisualSystem: this.employeeVisualSystem,
      irrigationRenderSystem: this.irrigationRenderSystem,
      currentCourse: this.currentCourse,
      currentScenario: this.currentScenario,
      gameOptions: this.gameOptions,
      saveCurrentGame: () => this.saveCurrentGame(),
      showDaySummary: () => this.showDaySummary(),
    };

    runSimulationTick(ctx, deltaMs);

    this.economyState = ctx.economyState;
    this.employeeRoster = ctx.employeeRoster;
    this.employeeWorkState = ctx.employeeWorkState;
    this.golferPool = ctx.golferPool;
    this.researchState = ctx.researchState;
    this.weatherState = ctx.weatherState;
    this.weather = ctx.weather;
    this.teeTimeState = ctx.teeTimeState;
    this.walkOnState = ctx.walkOnState;
    this.revenueState = ctx.revenueState;
    this.marketingState = ctx.marketingState;
    this.autonomousState = ctx.autonomousState;
    this.prestigeState = ctx.prestigeState;
    this.irrigationSystem = ctx.irrigationSystem;
    this.reputationState = ctx.reputationState;
    this.applicationState = ctx.applicationState;
    this.dailyStats = ctx.dailyStats;
    this.lastPayrollHour = ctx.lastPayrollHour;
    this.lastArrivalHour = ctx.lastArrivalHour;
    this.lastAutoSaveHour = ctx.lastAutoSaveHour;
    this.lastPrestigeUpdateHour = ctx.lastPrestigeUpdateHour;
    this.lastTeeTimeUpdateHour = ctx.lastTeeTimeUpdateHour;
    this.accumulatedResearchTime = ctx.accumulatedResearchTime;
  }

  private checkScenarioCompletion(): void {
    if (!this.scenarioManager) return;

    const result = this.scenarioManager.checkObjective();

    if (result.completed) {
      const score = Math.round(
        this.economyState.cash +
          this.golferPool.totalVisitorsToday * 10 +
          this.terrainSystem.getCourseStats().health * 100
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
    const conditionsScore = calculateCurrentConditionsFromFaces(this.terrainSystem.getAllFaceStates());
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

  public movePlayer(
    direction: "up" | "down" | "left" | "right" | "w" | "a" | "s" | "d"
  ): void {
    const dirMap: Record<string, "up" | "down" | "left" | "right"> = {
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
      this.playerController.handleMove(dir);
    }
  }

  public selectEquipment(slot: 1 | 2 | 3): void {
    const wasSelected = this.equipmentManager.getSelected();
    this.equipmentManager.handleSlot(slot);
    const nowSelected = this.equipmentManager.getSelected();

    if (nowSelected !== null && nowSelected !== wasSelected) {
      const overlayMap: Record<EquipmentSlot, OverlayMode | null> = {
        1: null,
        2: "moisture",
        3: "nutrients",
      };
      const targetOverlay = overlayMap[slot];
      if (targetOverlay && this.terrainSystem.getOverlayMode() !== targetOverlay) {
        this.terrainSystem.setOverlayMode(targetOverlay);
        this.uiManager.updateOverlayLegend(targetOverlay);
        this.overlayAutoSwitched = true;
        this.updateIrrigationVisibility();
      } else if (targetOverlay === null && this.overlayAutoSwitched) {
        this.terrainSystem.setOverlayMode("normal");
        this.uiManager.updateOverlayLegend("normal");
        this.overlayAutoSwitched = false;
        this.updateIrrigationVisibility();
      }
    } else if (nowSelected === null && this.overlayAutoSwitched) {
      this.terrainSystem.setOverlayMode("normal");
      this.uiManager.updateOverlayLegend("normal");
      this.overlayAutoSwitched = false;
      this.updateIrrigationVisibility();
    }
  }

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
  public setTerrainEditor(enabled: boolean): void {
    const system = this.terrainEditorController.getSystem();
    if (!system) return;
    if (enabled) {
      system.enable();
    } else {
      system.disable();
    }
  }

  public isTerrainEditorEnabled(): boolean {
    return this.terrainEditorController.isEnabled();
  }

  public createAPI(): GameAPI {
    const self = this;
    const ctx: GameContext = {
      get player() { return self.playerController.getPlayer(); },
      set player(v) { self.playerController.setPlayer(v); },
      get playerVisual() { return self.playerController.getPlayerVisual(); },
      set playerVisual(v) { self.playerController.setPlayerVisual(v); },
      get clickToMoveWaypoints() { return self.playerController.getClickToMoveWaypoints(); },
      set clickToMoveWaypoints(v) { self.playerController.setClickToMoveWaypoints(v); },
      get equipmentManager() { return self.equipmentManager; },
      get terrainSystem() { return self.terrainSystem; },
      get terrainEditorSystem() { return self.terrainEditorController.getSystem(); },
      get uiManager() { return self.uiManager; },
      get babylonEngine() { return self.babylonEngine; },
      get overlayAutoSwitched() { return self.overlayAutoSwitched; },
      set overlayAutoSwitched(v) { self.overlayAutoSwitched = v; },
      get isPaused() { return self.isPaused; },
      set isPaused(v) { self.isPaused = v; },
      get isMuted() { return self.isMuted; },
      set isMuted(v) { self.isMuted = v; },
      get gameTime() { return self.gameTime; },
      set gameTime(v) { self.gameTime = v; },
      get gameDay() { return self.gameDay; },
      set gameDay(v) { self.gameDay = v; },
      get timeScale() { return self.timeScale; },
      set timeScale(v) { self.timeScale = v; },
      get score() { return self.score; },
      set score(v) { self.score = v; },
      get lastEquipmentFaceId() { return self.playerController.getLastEquipmentFaceId(); },
      set lastEquipmentFaceId(v) { self.playerController.setLastEquipmentFaceId(v); },
      get economyState() { return self.economyState; },
      set economyState(v) { self.economyState = v; },
      get employeeRoster() { return self.employeeRoster; },
      set employeeRoster(v) { self.employeeRoster = v; },
      get employeeWorkState() { return self.employeeWorkState; },
      set employeeWorkState(v) { self.employeeWorkState = v; },
      get applicationState() { return self.applicationState; },
      set applicationState(v) { self.applicationState = v; },
      get golferPool() { return self.golferPool; },
      set golferPool(v) { self.golferPool = v; },
      get researchState() { return self.researchState; },
      set researchState(v) { self.researchState = v; },
      get scenarioManager() { return self.scenarioManager; },
      get weatherState() { return self.weatherState; },
      set weatherState(v) { self.weatherState = v; },
      get weather() { return self.weather; },
      set weather(v) { self.weather = v; },
      get greenFees() { return self.greenFees; },
      set greenFees(v) { self.greenFees = v; },
      get prestigeState() { return self.prestigeState; },
      set prestigeState(v) { self.prestigeState = v; },
      get teeTimeState() { return self.teeTimeState; },
      set teeTimeState(v) { self.teeTimeState = v; },
      get teeSheetViewDay() { return self.uiPanelCoordinator.getTeeSheetViewDay(); },
      set teeSheetViewDay(v) { self.uiPanelCoordinator.setTeeSheetViewDay(v); },
      get walkOnState() { return self.walkOnState; },
      set walkOnState(v) { self.walkOnState = v; },
      get revenueState() { return self.revenueState; },
      set revenueState(v) { self.revenueState = v; },
      get marketingState() { return self.marketingState; },
      set marketingState(v) { self.marketingState = v; },
      get autonomousState() { return self.autonomousState; },
      set autonomousState(v) { self.autonomousState = v; },
      get reputationState() { return self.reputationState; },
      set reputationState(v) { self.reputationState = v; },
      get irrigationSystem() { return self.irrigationSystem; },
      set irrigationSystem(v) { self.irrigationSystem = v; },
      get irrigationRenderSystem() { return self.irrigationRenderSystem; },
      get currentCourse() { return self.currentCourse; },
      get currentScenario() { return self.currentScenario; },
      get dailyStats() { return self.dailyStats; },
      set dailyStats(v) { self.dailyStats = v; },
      handleMove: (d) => this.movePlayer(d),
      handleEmployeePanel: () => this.uiPanelCoordinator.handleEmployeePanel(),
      handleResearchPanel: () => this.uiPanelCoordinator.handleResearchPanel(),
      handleTeeSheetPanel: () => this.uiPanelCoordinator.handleTeeSheetPanel(),
      handleMarketingPanel: () => this.uiPanelCoordinator.handleMarketingPanel(),
      handleOverlayCycle: () => this.handleOverlayCycle(),
      handleRefill: () => this.handleRefill(),
      handleMute: () => this.handleMute(),
      isPlayerMoving: () => this.playerController.isMoving(),
      pauseGame: () => this.pauseGame(),
      resumeGame: () => this.resumeGame(),
      updateEconomySystems: (ms) => this.updateEconomySystems(ms),
      updateIrrigationVisibility: () => this.updateIrrigationVisibility(),
      updatePlayerPosition: () => this.playerController.updatePlayerPosition(),
      saveCurrentGame: () => this.saveCurrentGame(),
      hasSavedGame: () => this.hasSavedGame(),
    };
    return new GameAPI(ctx);
  }

  public dispose(): void {
    this.inputManager.dispose();
    this.terrainSystem.dispose();
    this.equipmentManager.dispose();
    this.uiManager.dispose();
    this.terrainEditorController.dispose();
    this.playerController.dispose();
    this.uiPanelCoordinator.dispose();

    this.employeeVisualSystem?.dispose();
    this.employeeVisualSystem = null;

    this.irrigationRenderSystem?.dispose();

    for (const instance of this.treeInstances) {
      disposeInstance(instance);
    }
    this.treeInstances = [];

    for (const instance of this.refillStationInstances) {
      disposeInstance(instance);
    }
    this.refillStationInstances = [];

    for (const mesh of this.obstacleMeshes) {
      mesh.dispose();
    }

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

    const courseStats = this.terrainSystem.getCourseStats();
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

}

export function startBabylonGame(
  canvasId: string,
  options: GameOptions = {}
): BabylonMain {
  const game = new BabylonMain(canvasId, options);
  game.setRunning(true);
  return game;
}
