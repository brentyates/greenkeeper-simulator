import { Direction, EquipmentSlot } from "./engine/InputManager";
import { OverlayMode } from "./systems/GrassSystem";
import { TerrainSystem } from "./systems/TerrainSystemInterface";
import { EquipmentManager } from "./systems/EquipmentManager";
import { TerrainEditorSystem } from "./systems/TerrainEditorSystem";
import { IrrigationRenderSystem } from "./systems/IrrigationRenderSystem";
import { EntityVisualState } from "./systems/EntityVisualSystem";
import { UIManager } from "./ui/UIManager";
import { BabylonEngine } from "./engine/BabylonEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";

import { CourseData, REFILL_STATIONS } from "../data/courseData";
import { EditorTool } from "../core/terrain-editor-logic";
import { ScenarioDefinition } from "../data/scenarioData";

import {
  EconomyState,
  addIncome,
  addExpense,
  canAfford,
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
  addPipe,
  removePipe,
  addSprinklerHead,
  removeSprinklerHead,
  repairLeak,
  getSprinklerHeadAt,
  updateSprinklerSchedule,
  PipeType,
  SprinklerType,
  WateringSchedule,
  PIPE_CONFIGS,
  SPRINKLER_CONFIGS,
} from "../core/irrigation";
import {
  EmployeeRoster,
  ApplicationState,
  hireEmployee,
  fireEmployee,
  Employee,
  createEmployee,
} from "../core/employees";
import {
  EmployeeWorkSystemState,
  syncWorkersWithRoster,
  getWorkerPositions,
} from "../core/employee-work";
import { PlayerEntity, teleportEntity } from "../core/movable-entity";
import {
  GolferPoolState,
  GreenFeeStructure,
  getActiveGolferCount,
  getAverageSatisfaction,
  WeatherCondition,
} from "../core/golfers";
import {
  ResearchState,
  startResearch,
  cancelResearch,
  setFundingLevel,
  FundingLevel,
  RESEARCH_ITEMS,
  completeResearchInstantly,
  getAvailableResearch as getAvailableResearchItems,
  getPrerequisiteChain,
  getResearchStatus,
  getResearchProgress,
} from "../core/research";
import { ScenarioManager } from "../core/scenario";
import {
  PrestigeState,
  calculateCurrentConditionsFromFaces,
  updatePrestigeScore,
  upgradeAmenity,
} from "../core/prestige";
import { AmenityUpgrade, getUpgradeCost, getAvailableUpgrades, getUpgradeName } from "../core/amenities";
import {
  TeeTimeSystemState,
  bookTeeTime,
  checkInTeeTime,
  cancelTeeTime,
  type GameTime,
} from "../core/tee-times";
import {
  WalkOnState,
  getWalkOnSummary,
  getQueueLength,
  getEstimatedWaitTime,
  updateWalkOnPolicy,
  addWalkOnToQueue,
  createWalkOnGolfer,
} from "../core/walk-ons";
import {
  RevenueState,
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
  startCampaign,
  stopCampaign,
  canStartCampaign,
} from "../core/marketing";
import {
  deleteSave,
  getSaveInfo,
  listSaves,
} from "../core/save-game";
import {
  AutonomousEquipmentState,
  purchaseRobot,
  sellRobot,
  countWorkingRobots,
  countBrokenRobots,
  getAvailableRobotsToPurchase,
} from "../core/autonomous-equipment";
import {
  WeatherState,
  getWeatherDescription,
  getWeatherImpactDescription,
  getSeasonFromDay,
} from "../core/weather";
import {
  ReputationState,
  getReputationSummary,
  calculateReputationScore,
  trackGolferVisit,
  trackTurnAway,
} from "../core/reputation";

export interface GameContext {
  player: PlayerEntity;
  playerVisual: EntityVisualState | null;
  clickToMoveWaypoints: Array<{ x: number; z: number }>;
  equipmentManager: EquipmentManager;
  terrainSystem: TerrainSystem;
  terrainEditorSystem: TerrainEditorSystem | null;
  uiManager: UIManager;
  babylonEngine: BabylonEngine;
  overlayAutoSwitched: boolean;
  isPaused: boolean;
  isMuted: boolean;
  gameTime: number;
  gameDay: number;
  timeScale: number;
  score: number;
  lastEquipmentFaceId: number | null;
  economyState: EconomyState;
  employeeRoster: EmployeeRoster;
  employeeWorkState: EmployeeWorkSystemState;
  applicationState: ApplicationState;
  golferPool: GolferPoolState;
  researchState: ResearchState;
  scenarioManager: ScenarioManager | null;
  weatherState: WeatherState;
  weather: WeatherCondition;
  greenFees: GreenFeeStructure;
  prestigeState: PrestigeState;
  teeTimeState: TeeTimeSystemState;
  teeSheetViewDay: number;
  walkOnState: WalkOnState;
  revenueState: RevenueState;
  marketingState: MarketingState;
  autonomousState: AutonomousEquipmentState;
  reputationState: ReputationState;
  irrigationSystem: IrrigationSystem;
  irrigationRenderSystem: IrrigationRenderSystem | null;
  currentCourse: CourseData;
  currentScenario: ScenarioDefinition | null;
  dailyStats: {
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
  };

  handleMove(direction: Direction): void;
  handleEmployeePanel(): void;
  handleResearchPanel(): void;
  handleTeeSheetPanel(): void;
  handleMarketingPanel(): void;
  handleOverlayCycle(): void;
  handleRefill(): void;
  handleMute(): void;
  isPlayerMoving(): boolean;
  pauseGame(): void;
  resumeGame(): void;
  updateEconomySystems(deltaMs: number): void;
  updateIrrigationVisibility(): void;
  updatePlayerPosition(): void;
  saveCurrentGame(): void;
  hasSavedGame(): boolean;
}

export class GameAPI {
  constructor(private ctx: GameContext) {}

  public teleport(x: number, y: number): void {
    const course = this.ctx.currentCourse;
    if (x < 0 || x >= course.width || y < 0 || y >= course.height) {
      console.warn(`Teleport target (${x}, ${y}) is out of bounds.`);
      return;
    }

    this.ctx.player = {
      ...teleportEntity(this.ctx.player, x, y),
      worldX: x + 0.5,
      worldZ: y + 0.5,
    };
    this.ctx.clickToMoveWaypoints = [];
    this.ctx.lastEquipmentFaceId = null;

    if (this.ctx.playerVisual) {
      this.ctx.playerVisual.lastGridX = x;
      this.ctx.playerVisual.lastGridY = y;
      this.ctx.playerVisual.targetGridX = x;
      this.ctx.playerVisual.targetGridY = y;
      this.ctx.playerVisual.visualProgress = 1;
    }

    this.ctx.updatePlayerPosition();
  }

  public setRunning(running: boolean): void {
    if (running) {
      this.ctx.babylonEngine.start();
    } else {
      this.ctx.babylonEngine.stop();
    }
  }

  public getScenarioState(): {
    progress: number;
    completed: boolean;
    failed: boolean;
    message?: string;
  } | null {
    if (!this.ctx.scenarioManager) return null;
    const result = this.ctx.scenarioManager.checkObjective();
    return {
      progress: result.progress,
      completed: result.completed,
      failed: result.failed,
      message: result.message,
    };
  }

  public getEconomyState(): { cash: number; earned: number; spent: number } {
    return {
      cash: this.ctx.economyState.cash,
      earned: this.ctx.economyState.totalEarned,
      spent: this.ctx.economyState.totalSpent,
    };
  }

  public getPrestigeState(): {
    score: number;
    stars: number;
    tier: string;
    amenityScore: number;
  } {
    return {
      score: this.ctx.prestigeState.currentScore,
      stars: this.ctx.prestigeState.starRating,
      tier: this.ctx.prestigeState.tier,
      amenityScore: this.ctx.prestigeState.amenityScore,
    };
  }

  public getGameDay(): number {
    return this.ctx.gameDay;
  }

  public getTeeTimeStats(): {
    totalBookings: number;
    cancellations: number;
    noShows: number;
    slotsAvailable: number;
  } {
    const todaySlots = this.ctx.teeTimeState.teeTimes.get(this.ctx.gameDay) ?? [];
    const available = todaySlots.filter((t) => t.status === "available").length;

    return {
      totalBookings: this.ctx.teeTimeState.bookingMetrics.totalBookingsToday,
      cancellations: this.ctx.teeTimeState.bookingMetrics.cancellationsToday,
      noShows: this.ctx.teeTimeState.bookingMetrics.noShowsToday,
      slotsAvailable: available,
    };
  }

  public getMarketingStats(): {
    activeCampaigns: number;
    totalSpent: number;
    totalROI: number;
  } {
    const totalSpent = this.ctx.marketingState.metrics.totalSpent;
    const totalRevenue = this.ctx.marketingState.metrics.totalRevenueGenerated;
    const roi =
      totalSpent > 0 ? ((totalRevenue - totalSpent) / totalSpent) * 100 : 0;

    return {
      activeCampaigns: this.ctx.marketingState.activeCampaigns.length,
      totalSpent,
      totalROI: Math.round(roi),
    };
  }

  public startMarketingCampaign(campaignId: string, days: number = 7): boolean {
    const canStart = canStartCampaign(
      this.ctx.marketingState,
      campaignId,
      this.ctx.economyState.cash
    );
    if (!canStart.canStart) {
      return false;
    }

    const result = startCampaign(
      this.ctx.marketingState,
      campaignId,
      this.ctx.gameDay,
      days
    );
    if (result) {
      this.ctx.marketingState = result.state;
      const cost = result.setupCost;
      if (cost > 0) {
        const timestamp = this.ctx.gameDay * 24 * 60 + this.ctx.gameTime;
        const expenseResult = addExpense(
          this.ctx.economyState,
          cost,
          "marketing",
          `Campaign: ${campaignId}`,
          timestamp,
          false
        );
        if (expenseResult) {
          this.ctx.economyState = expenseResult;
        }
      }
      return true;
    }
    return false;
  }

  public getGameTime(): { hours: number; minutes: number } {
    return {
      hours: Math.floor(this.ctx.gameTime / 60),
      minutes: Math.floor(this.ctx.gameTime % 60),
    };
  }

  public setCash(amount: number): void {
    const diff = amount - this.ctx.economyState.cash;
    const timestamp = Date.now();
    if (diff > 0) {
      this.ctx.economyState = addIncome(
        this.ctx.economyState,
        diff,
        "other_income",
        "Test adjustment",
        timestamp
      );
    } else if (diff < 0) {
      const result = addExpense(
        this.ctx.economyState,
        -diff,
        "other_expense",
        "Test adjustment",
        timestamp,
        true
      );
      if (result) {
        this.ctx.economyState = result;
      }
    }
    this.ctx.uiManager.updateEconomy(
      this.ctx.economyState.cash,
      getActiveGolferCount(this.ctx.golferPool),
      getAverageSatisfaction(this.ctx.golferPool)
    );
  }

  public advanceDay(): void {
    this.ctx.gameDay++;
    if (this.ctx.scenarioManager) {
      this.ctx.scenarioManager.incrementDay();
    }
    const conditionsScore = calculateCurrentConditionsFromFaces(this.ctx.terrainSystem.getAllFaceStates());
    this.ctx.prestigeState = updatePrestigeScore(
      this.ctx.prestigeState,
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

    const cost = getUpgradeCost(this.ctx.prestigeState.amenities, upgrade);
    if (this.ctx.economyState.cash < cost) {
      return false;
    }

    this.ctx.prestigeState = upgradeAmenity(this.ctx.prestigeState, upgrade);
    const timestamp = this.ctx.gameDay * 24 * 60 + this.ctx.gameTime;
    const expenseResult = addExpense(
      this.ctx.economyState,
      cost,
      "equipment_purchase",
      `Amenity: ${upgrade.type}`,
      timestamp,
      false
    );
    if (expenseResult) {
      this.ctx.economyState = expenseResult;
    }

    return true;
  }

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
      this.ctx.handleMove(dir);
    }
  }

  public getPlayerPosition(): { x: number; y: number } {
    return { x: this.ctx.player.gridX, y: this.ctx.player.gridY };
  }

  public selectEquipment(slot: 1 | 2 | 3): void {
    const wasSelected = this.ctx.equipmentManager.getSelected();
    this.ctx.equipmentManager.handleSlot(slot);
    const nowSelected = this.ctx.equipmentManager.getSelected();

    if (nowSelected !== null && nowSelected !== wasSelected) {
      const overlayMap: Record<EquipmentSlot, OverlayMode | null> = {
        1: null,
        2: "moisture",
        3: "nutrients",
      };
      const targetOverlay = overlayMap[slot];
      if (targetOverlay && this.ctx.terrainSystem.getOverlayMode() !== targetOverlay) {
        this.ctx.terrainSystem.setOverlayMode(targetOverlay);
        this.ctx.uiManager.updateOverlayLegend(targetOverlay);
        this.ctx.overlayAutoSwitched = true;
        this.ctx.updateIrrigationVisibility();
      } else if (targetOverlay === null && this.ctx.overlayAutoSwitched) {
        this.ctx.terrainSystem.setOverlayMode("normal");
        this.ctx.uiManager.updateOverlayLegend("normal");
        this.ctx.overlayAutoSwitched = false;
        this.ctx.updateIrrigationVisibility();
      }
    } else if (nowSelected === null && this.ctx.overlayAutoSwitched) {
      this.ctx.terrainSystem.setOverlayMode("normal");
      this.ctx.uiManager.updateOverlayLegend("normal");
      this.ctx.overlayAutoSwitched = false;
      this.ctx.updateIrrigationVisibility();
    }
  }

  public toggleEquipment(): void {
    const selected = this.ctx.equipmentManager.getSelected();
    if (selected === null) return;

    const slotMap: Record<string, 1 | 2 | 3> = {
      mower: 1,
      sprinkler: 2,
      spreader: 3,
    };
    this.selectEquipment(slotMap[selected]);
  }

  public getEquipmentState(): {
    selectedSlot: number | null;
    mower: { active: boolean; resource: number; max: number } | null;
    sprinkler: { active: boolean; resource: number; max: number } | null;
    spreader: { active: boolean; resource: number; max: number } | null;
  } {
    const mowerState = this.ctx.equipmentManager.getState("mower");
    const sprinklerState = this.ctx.equipmentManager.getState("sprinkler");
    const spreaderState = this.ctx.equipmentManager.getState("spreader");

    const selected = this.ctx.equipmentManager.getSelected();
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
    if (!this.ctx.terrainEditorSystem) return;
    if (enabled) {
      this.ctx.terrainEditorSystem.enable();
    } else {
      this.ctx.terrainEditorSystem.disable();
    }
  }

  public isTerrainEditorEnabled(): boolean {
    return this.ctx.terrainEditorSystem?.isEnabled() ?? false;
  }

  public setEditorTool(tool: string): void {
    if (!this.ctx.terrainEditorSystem) return;

    const toolMap: Record<string, EditorTool> = {
      raise: "raise",
      lower: "lower",
      flatten: "flatten",
      smooth: "smooth",
      terrain_fairway: "terrain_fairway",
      terrain_bunker: "terrain_bunker",
      terrain_water: "terrain_water",
      terrain_rough: "terrain_rough",
      terrain_green: "terrain_green",
      terrain_tee: "terrain_tee",
    };

    const editorTool = toolMap[tool];
    if (editorTool) {
      this.ctx.terrainEditorSystem.setTool(editorTool);
    }
  }

  public setEditorBrushSize(size: number): void {
    if (this.ctx.terrainEditorSystem) {
      this.ctx.terrainEditorSystem.setBrushSize(size);
    }
  }

  public editTerrainAt(gridX: number, gridY: number): void {
    if (!this.ctx.terrainEditorSystem || !this.ctx.terrainEditorSystem.isEnabled()) {
      return;
    }

    const worldPos = new Vector3(gridX + 0.1, 0, gridY + 0.1);
    this.ctx.terrainEditorSystem.handleMouseMove(gridX, gridY, worldPos);
    this.ctx.terrainEditorSystem.handleClick(gridX, gridY);
  }

  public dragTerrainStart(
    gridX: number,
    gridY: number
  ): void {
    if (!this.ctx.terrainEditorSystem || !this.ctx.terrainEditorSystem.isEnabled()) {
      return;
    }

    this.ctx.terrainEditorSystem.handleMouseMove(gridX, gridY);
    this.ctx.terrainEditorSystem.handleDragStart(gridX, gridY);
  }

  public dragTerrainMove(gridX: number, gridY: number): void {
    if (!this.ctx.terrainEditorSystem || !this.ctx.terrainEditorSystem.isEnabled()) {
      return;
    }

    this.ctx.terrainEditorSystem.handleMouseMove(gridX, gridY);
    this.ctx.terrainEditorSystem.handleDrag(gridX, gridY);
  }

  public dragTerrainEnd(): void {
    if (this.ctx.terrainEditorSystem) {
      this.ctx.terrainEditorSystem.handleDragEnd();
    }
  }

  public getElevationAt(x: number, y: number): number | undefined {
    return this.ctx.terrainSystem.getElevationAt(x, y);
  }

  public setElevationAt(x: number, y: number, elevation: number): void {
    this.ctx.terrainSystem.setElevationAt(x, y, elevation);
  }

  public setCellState(
    x: number,
    y: number,
    state: { height?: number; moisture?: number; nutrients?: number; health?: number }
  ): void {
    this.ctx.terrainSystem.setCellState(x, y, state);
  }

  public setAllCellsState(
    state: { height?: number; moisture?: number; nutrients?: number; health?: number }
  ): void {
    this.ctx.terrainSystem.setAllCellsState(state);
  }

  public setAllFaceStates(
    state: { moisture?: number; nutrients?: number; grassHeight?: number; health?: number }
  ): void {
    this.ctx.terrainSystem.setAllFaceStates(state);
  }

  public getTerrainTypeAt(x: number, y: number): string | undefined {
    return this.ctx.terrainSystem.getTerrainTypeAt(x, y);
  }

  public setTerrainTypeAt(
    x: number,
    y: number,
    type: "fairway" | "rough" | "green" | "bunker" | "water" | "tee"
  ): void {
    this.ctx.terrainSystem.setTerrainTypeAt(x, y, type);
  }

  public setOverlayMode(
    mode: "normal" | "moisture" | "nutrients" | "height" | "irrigation"
  ): void {
    this.ctx.terrainSystem.setOverlayMode(mode);

    const scene = this.ctx.babylonEngine.getScene();
    if (mode === "irrigation") {
      scene.clearColor = new Color4(0.9, 0.88, 0.85, 1);
    } else {
      scene.clearColor = new Color4(0.4, 0.6, 0.9, 1);
    }

    if (this.ctx.irrigationRenderSystem) {
      this.ctx.irrigationRenderSystem.setVisible(mode === "irrigation");
    }

    this.ctx.uiManager.updateOverlayLegend(mode);
    this.ctx.overlayAutoSwitched = false;
    this.ctx.updateIrrigationVisibility();
  }

  public getOverlayMode():
    | "normal"
    | "moisture"
    | "nutrients"
    | "height"
    | "irrigation" {
    return this.ctx.terrainSystem.getOverlayMode();
  }

  public async waitForPlayerIdle(): Promise<void> {
    return new Promise((resolve) => {
      const checkIdle = () => {
        if (!this.ctx.isPlayerMoving()) {
          resolve();
        } else {
          setTimeout(checkIdle, 16);
        }
      };
      checkIdle();
    });
  }

  public toggleEmployeePanel(): void {
    this.ctx.handleEmployeePanel();
  }

  public toggleResearchPanel(): void {
    this.ctx.handleResearchPanel();
  }

  public toggleTeeSheetPanel(): void {
    this.ctx.handleTeeSheetPanel();
  }

  public toggleMarketingPanel(): void {
    this.ctx.handleMarketingPanel();
  }

  public cycleOverlay(): void {
    this.ctx.handleOverlayCycle();
  }

  public refillEquipment(): void {
    this.ctx.handleRefill();
  }

  public toggleMute(): void {
    this.ctx.handleMute();
  }

  public getEmployeeState(): {
    employees: readonly Employee[];
    count: number;
    maxEmployees: number;
    totalHourlyWages: number;
  } {
    return {
      employees: this.ctx.employeeRoster.employees,
      count: this.ctx.employeeRoster.employees.length,
      maxEmployees: this.ctx.employeeRoster.maxEmployees,
      totalHourlyWages: this.ctx.employeeRoster.employees.reduce(
        (sum, e) => sum + e.hourlyWage,
        0
      ),
    };
  }

  public getApplicationState(): {
    applications: readonly Employee[];
    nextApplicationTime: number;
    activeJobPostings: number;
    totalReceived: number;
  } {
    return {
      applications: this.ctx.applicationState.applications,
      nextApplicationTime: this.ctx.applicationState.nextApplicationTime,
      activeJobPostings: this.ctx.applicationState.activeJobPostings.length,
      totalReceived: this.ctx.applicationState.totalApplicationsReceived,
    };
  }

  public getFullGameState(): {
    player: { x: number; y: number; isMoving: boolean };
    equipment: ReturnType<GameAPI["getEquipmentState"]>;
    time: { day: number; hours: number; minutes: number };
    economy: ReturnType<GameAPI["getEconomyState"]>;
    terrain: { width: number; height: number };
    editorEnabled: boolean;
  } {
    const layoutGrid = this.ctx.terrainSystem.getLayoutGrid();
    return {
      player: {
        x: this.ctx.player.gridX,
        y: this.ctx.player.gridY,
        isMoving: this.ctx.isPlayerMoving(),
      },
      equipment: this.getEquipmentState(),
      time: {
        day: this.ctx.gameDay,
        hours: Math.floor(this.ctx.gameTime / 60),
        minutes: this.ctx.gameTime % 60,
      },
      economy: this.getEconomyState(),
      terrain: {
        width: layoutGrid[0]?.length ?? 0,
        height: layoutGrid.length,
      },
      editorEnabled: this.isTerrainEditorEnabled(),
    };
  }

  public placePipe(x: number, y: number, pipeType: PipeType): boolean {
    const timestamp = this.ctx.gameDay * 24 * 60 + this.ctx.gameTime;
    const config = PIPE_CONFIGS[pipeType];
    const cost = config.cost;

    if (!canAfford(this.ctx.economyState, cost)) {
      return false;
    }

    this.ctx.irrigationSystem = addPipe(
      this.ctx.irrigationSystem,
      x,
      y,
      pipeType,
      timestamp
    );
    const expenseResult = addExpense(
      this.ctx.economyState,
      cost,
      "construction",
      `Pipe installation: ${pipeType}`,
      timestamp,
      false
    );
    if (expenseResult) {
      this.ctx.economyState = expenseResult;
    }

    if (this.ctx.irrigationRenderSystem) {
      this.ctx.irrigationRenderSystem.update(this.ctx.irrigationSystem);
    }

    return true;
  }

  public removePipe(x: number, y: number): void {
    this.ctx.irrigationSystem = removePipe(this.ctx.irrigationSystem, x, y);
    if (this.ctx.irrigationRenderSystem) {
      this.ctx.irrigationRenderSystem.update(this.ctx.irrigationSystem);
    }
  }

  public placeSprinklerHead(
    x: number,
    y: number,
    sprinklerType: SprinklerType
  ): boolean {
    const timestamp = this.ctx.gameDay * 24 * 60 + this.ctx.gameTime;
    const config = SPRINKLER_CONFIGS[sprinklerType];
    const cost = config.cost + 20;

    if (!canAfford(this.ctx.economyState, cost)) {
      return false;
    }

    this.ctx.irrigationSystem = addSprinklerHead(
      this.ctx.irrigationSystem,
      x,
      y,
      sprinklerType,
      timestamp
    );
    const expenseResult = addExpense(
      this.ctx.economyState,
      cost,
      "construction",
      `Sprinkler installation: ${sprinklerType}`,
      timestamp,
      false
    );
    if (expenseResult) {
      this.ctx.economyState = expenseResult;
    }

    if (this.ctx.irrigationRenderSystem) {
      this.ctx.irrigationRenderSystem.update(this.ctx.irrigationSystem);
    }

    return true;
  }

  public removeSprinklerHead(x: number, y: number): void {
    const head = getSprinklerHeadAt(this.ctx.irrigationSystem, x, y);
    if (head) {
      this.ctx.irrigationSystem = removeSprinklerHead(
        this.ctx.irrigationSystem,
        head.id
      );
      if (this.ctx.irrigationRenderSystem) {
        this.ctx.irrigationRenderSystem.update(this.ctx.irrigationSystem);
      }
    }
  }

  public repairLeak(x: number, y: number): boolean {
    const timestamp = this.ctx.gameDay * 24 * 60 + this.ctx.gameTime;
    const cost = 20;

    if (!canAfford(this.ctx.economyState, cost)) {
      return false;
    }

    const result = repairLeak(this.ctx.irrigationSystem, x, y);
    if (result) {
      this.ctx.irrigationSystem = result;
      const expenseResult = addExpense(
        this.ctx.economyState,
        cost,
        "equipment_maintenance",
        "Pipe leak repair",
        timestamp,
        false
      );
      if (expenseResult) {
        this.ctx.economyState = expenseResult;
      }

      if (this.ctx.irrigationRenderSystem) {
        this.ctx.irrigationRenderSystem.update(this.ctx.irrigationSystem);
      }

      return true;
    }

    return false;
  }

  public getIrrigationSystem(): IrrigationSystem {
    return this.ctx.irrigationSystem;
  }

  public setIrrigationSchedule(
    headId: string,
    schedule: WateringSchedule
  ): void {
    this.ctx.irrigationSystem = updateSprinklerSchedule(
      this.ctx.irrigationSystem,
      headId,
      schedule
    );
  }

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
    const cell = this.ctx.terrainSystem.getCell(x, y);
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

  public getCourseStats(): {
    health: number;
    moisture: number;
    nutrients: number;
    height: number;
  } {
    return this.ctx.terrainSystem.getCourseStats();
  }

  public setEquipmentResource(
    type: "mower" | "sprinkler" | "spreader",
    amount: number
  ): void {
    this.ctx.equipmentManager.setResource(type, amount);
  }

  public advanceTimeByMinutes(minutes: number): void {
    const deltaMs = minutes * 60 * 1000 / this.ctx.timeScale;
    this.ctx.gameTime += (deltaMs / 1000) * 2 * this.ctx.timeScale;
    if (this.ctx.gameTime >= 24 * 60) {
      this.ctx.gameTime -= 24 * 60;
      this.ctx.gameDay++;
    }
    this.ctx.terrainSystem.update(deltaMs, this.ctx.gameDay * 1440 + this.ctx.gameTime);
    this.ctx.updateEconomySystems(deltaMs);
  }

  public getResearchState(): ResearchState {
    return this.ctx.researchState;
  }

  public startResearchItem(itemId: string): boolean {
    const currentTime = this.ctx.gameDay * 24 * 60 + this.ctx.gameTime;
    const result = startResearch(this.ctx.researchState, itemId, currentTime);
    if (result) {
      this.ctx.researchState = result;
      return true;
    }
    return false;
  }

  public cancelCurrentResearch(): void {
    this.ctx.researchState = cancelResearch(this.ctx.researchState);
  }

  public setResearchFunding(level: FundingLevel): void {
    this.ctx.researchState = setFundingLevel(this.ctx.researchState, level);
  }

  public queueResearch(itemId: string): void {
    this.ctx.researchState = {
      ...this.ctx.researchState,
      researchQueue: [...this.ctx.researchState.researchQueue, itemId],
    };
  }

  public isResearchCompleted(itemId: string): boolean {
    return this.ctx.researchState.completedResearch.includes(itemId);
  }

  public getAvailableResearch(): string[] {
    return RESEARCH_ITEMS
      .filter((item) => {
        if (this.ctx.researchState.completedResearch.includes(item.id)) return false;
        return item.prerequisites.every((prereq) =>
          this.ctx.researchState.completedResearch.includes(prereq)
        );
      })
      .map((item) => item.id);
  }

  public hireEmployee(applicationIndex: number): boolean {
    if (
      applicationIndex < 0 ||
      applicationIndex >= this.ctx.applicationState.applications.length
    ) {
      return false;
    }
    const application = this.ctx.applicationState.applications[applicationIndex];
    const result = hireEmployee(this.ctx.employeeRoster, application);
    if (result) {
      this.ctx.employeeRoster = result;
      this.ctx.applicationState = {
        ...this.ctx.applicationState,
        applications: this.ctx.applicationState.applications.filter((_, i) => i !== applicationIndex),
      };
      return true;
    }
    return false;
  }

  public fireEmployee(employeeId: string): boolean {
    const result = fireEmployee(this.ctx.employeeRoster, employeeId);
    if (result) {
      this.ctx.employeeRoster = result;
      return true;
    }
    return false;
  }

  public getTeeSheet(day?: number): Array<{
    id: string;
    time: string;
    status: string;
    playerCount: number;
  }> {
    const targetDay = day ?? this.ctx.gameDay;
    const teeTimes = this.ctx.teeTimeState.teeTimes.get(targetDay) ?? [];
    return teeTimes.map((tt) => ({
      id: tt.id,
      time: `${tt.scheduledTime.hour}:${String(tt.scheduledTime.minute).padStart(2, "0")}`,
      status: tt.status,
      playerCount: tt.golfers?.length ?? 0,
    }));
  }

  public bookTeeTime(teeTimeId: string, players: number = 4): boolean {
    const golferBookings = Array.from({ length: players }, (_, i) => ({
      golferId: `golfer_${Date.now()}_${i}`,
      name: `Golfer ${i + 1}`,
      membershipStatus: 'public' as const,
      greenFee: this.ctx.prestigeState.greenFee || 50,
      cartFee: 0,
      addOns: [],
    }));
    const currentTime: GameTime = {
      day: this.ctx.gameDay,
      hour: Math.floor(this.ctx.gameTime / 60),
      minute: this.ctx.gameTime % 60,
    };
    const result = bookTeeTime(this.ctx.teeTimeState, teeTimeId, golferBookings, 'reservation', currentTime);
    if (result !== this.ctx.teeTimeState) {
      this.ctx.teeTimeState = result;
      return true;
    }
    return false;
  }

  public checkInTeeTime(teeTimeId: string): boolean {
    const result = checkInTeeTime(this.ctx.teeTimeState, teeTimeId);
    this.ctx.teeTimeState = result;
    return true;
  }

  public cancelTeeTimeBooking(teeTimeId: string): boolean {
    const result = cancelTeeTime(this.ctx.teeTimeState, teeTimeId);
    this.ctx.teeTimeState = result;
    return true;
  }

  public getActiveCampaigns(): Array<{
    campaignId: string;
    daysRemaining: number;
  }> {
    return this.ctx.marketingState.activeCampaigns
      .filter(c => c.status === 'active')
      .map((c) => ({
        campaignId: c.campaignId,
        daysRemaining: c.plannedDuration - c.elapsedDays,
      }));
  }

  public endMarketingCampaign(campaignId: string): boolean {
    const result = stopCampaign(this.ctx.marketingState, campaignId, this.ctx.gameDay);
    this.ctx.marketingState = result;
    return true;
  }

  public getAvailableAmenities(): Array<{
    id: string;
    name: string;
    cost: number;
    purchased: boolean;
  }> {
    const available = getAvailableUpgrades(this.ctx.prestigeState.amenities);
    return available.map((upgrade, index) => ({
      id: `amenity_${index}`,
      name: getUpgradeName(upgrade),
      cost: getUpgradeCost(this.ctx.prestigeState.amenities, upgrade),
      purchased: false,
    }));
  }

  public getGolferState(): {
    active: number;
    served: number;
    avgSatisfaction: number;
  } {
    return {
      active: getActiveGolferCount(this.ctx.golferPool),
      served: this.ctx.golferPool.totalVisitorsToday,
      avgSatisfaction: getAverageSatisfaction(this.ctx.golferPool),
    };
  }

  public getScenarioProgress(): {
    daysElapsed: number;
    currentCash: number;
    totalRevenue: number;
    totalExpenses: number;
    totalGolfers: number;
    currentHealth: number;
    currentRating: number;
  } | null {
    if (!this.ctx.scenarioManager) return null;

    return this.ctx.scenarioManager.getProgress();
  }

  public hasActiveParticles(): boolean {
    return this.ctx.equipmentManager.hasParticles();
  }

  public getGrassRenderUpdateCount(): number {
    return this.ctx.terrainSystem.getUpdateCount();
  }

  public getUIState(): {
    isPaused: boolean;
    overlayMode: string;
    notificationCount: number;
  } {
    return {
      isPaused: this.ctx.isPaused,
      overlayMode: this.ctx.terrainSystem.getOverlayMode(),
      notificationCount: 0,
    };
  }

  public setPaused(paused: boolean): void {
    if (paused) {
      this.ctx.pauseGame();
    } else {
      this.ctx.resumeGame();
    }
  }

  public refillAtCurrentPosition(): { success: boolean; cost: number } {
    const playerPos = { x: this.ctx.player.gridX, y: this.ctx.player.gridY };
    const isAtStation = REFILL_STATIONS.some(
      (station) => station.x === playerPos.x && station.y === playerPos.y
    );

    if (!isAtStation) {
      return { success: false, cost: 0 };
    }

    const cost = this.ctx.equipmentManager.refill();
    const timestamp = this.ctx.gameDay * 24 * 60 + this.ctx.gameTime;
    const expenseResult = addExpense(
      this.ctx.economyState,
      cost,
      "supplies",
      "Equipment refill",
      timestamp,
      false
    );
    if (expenseResult) {
      this.ctx.economyState = expenseResult;
    }

    return { success: true, cost };
  }

  public isAtRefillStation(): boolean {
    const playerPos = { x: this.ctx.player.gridX, y: this.ctx.player.gridY };
    return REFILL_STATIONS.some(
      (station) => station.x === playerPos.x && station.y === playerPos.y
    );
  }

  public getRefillStations(): Array<{ x: number; y: number }> {
    return REFILL_STATIONS.map(s => ({ x: s.x, y: s.y }));
  }

  public forceGrassGrowth(minutes: number): void {
    const deltaMs = minutes * 500;
    this.ctx.terrainSystem.update(deltaMs, this.ctx.gameDay * 1440 + this.ctx.gameTime);
  }

  public getTerrainEditorState(): {
    enabled: boolean;
    tool: string | null;
    brushSize: number;
  } {
    if (!this.ctx.terrainEditorSystem) {
      return {
        enabled: false,
        tool: null,
        brushSize: 1,
      };
    }

    return {
      enabled: this.ctx.terrainEditorSystem.isEnabled(),
      tool: this.ctx.terrainEditorSystem.getCurrentTool(),
      brushSize: this.ctx.terrainEditorSystem.getBrushSize(),
    };
  }

  public getRobotState(): {
    totalRobots: number;
    workingRobots: number;
    brokenRobots: number;
  } {
    return {
      totalRobots: this.ctx.autonomousState.robots.length,
      workingRobots: countWorkingRobots(this.ctx.autonomousState),
      brokenRobots: countBrokenRobots(this.ctx.autonomousState),
    };
  }

  public getAvailableRobots(): Array<{ equipmentId: string; ownedCount: number }> {
    return getAvailableRobotsToPurchase(this.ctx.researchState, this.ctx.autonomousState);
  }

  public getWalkOnState(): {
    queueLength: number;
    totalServed: number;
    totalTurnedAway: number;
  } {
    return {
      queueLength: this.ctx.walkOnState.queue.length,
      totalServed: this.ctx.walkOnState.metrics.walkOnsServedToday,
      totalTurnedAway: this.ctx.walkOnState.metrics.walkOnsTurnedAwayToday,
    };
  }

  public getRevenueState(): {
    greenFees: number;
    cartFees: number;
    proShopSales: number;
    foodBeverage: number;
  } {
    return {
      greenFees: this.ctx.revenueState.todaysRevenue.greenFees,
      cartFees: this.ctx.revenueState.todaysRevenue.cartFees,
      proShopSales: this.ctx.revenueState.todaysRevenue.proShop,
      foodBeverage: this.ctx.revenueState.todaysRevenue.foodAndBeverage,
    };
  }

  public getWeatherState(): {
    condition: string;
    temperature: number;
    windSpeed: number;
  } {
    return {
      condition: this.ctx.weatherState.current.type,
      temperature: this.ctx.weatherState.current.temperature,
      windSpeed: this.ctx.weatherState.current.windSpeed,
    };
  }

  public setWeatherCondition(type: "sunny" | "cloudy" | "rainy" | "stormy"): void {
    const newCondition: WeatherCondition = {
      type,
      temperature: this.ctx.weatherState.current.temperature,
      windSpeed: this.ctx.weatherState.current.windSpeed,
    };
    this.ctx.weatherState = {
      ...this.ctx.weatherState,
      current: newCondition,
    };
  }

  public getEmployeeWorkState(): {
    workerCount: number;
    activeWorkers: number;
    idleWorkers: number;
  } {
    const workers = this.ctx.employeeWorkState.workers;
    const activeCount = workers.filter(w => w.currentTask !== 'idle').length;
    return {
      workerCount: workers.length,
      activeWorkers: activeCount,
      idleWorkers: workers.length - activeCount,
    };
  }

  public getTerrainDimensions(): { width: number; height: number } {
    return this.ctx.terrainSystem.getGridDimensions();
  }

  public getTerrainCellData(x: number, y: number): {
    type: string;
    elevation: number;
    moisture: number;
    nutrients: number;
    height: number;
    health: number;
  } | null {
    const cell = this.ctx.terrainSystem.getCell(x, y);
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

  public getTerrainTypes(): string[] {
    const types = new Set<string>();
    const cells = this.ctx.terrainSystem.getAllCells();
    for (const row of cells) {
      for (const cell of row) {
        types.add(cell.type);
      }
    }
    return Array.from(types);
  }

  public deleteSaveGame(scenarioId: string): boolean {
    return deleteSave(scenarioId);
  }

  public getSaveGameInfo(scenarioId?: string): { savedAt: number; gameDay: number } | null {
    const id = scenarioId || this.ctx.currentScenario?.id || 'sandbox';
    return getSaveInfo(id);
  }

  public listSaveGames(): Array<{ scenarioId: string; savedAt: number; gameDay: number }> {
    return listSaves();
  }

  public getReputationSummaryData(): {
    score: number;
    starRating: number;
    trend: string;
    totalTurnAways: number;
    returnRate: number;
  } {
    const summary = getReputationSummary(this.ctx.reputationState);
    return {
      score: calculateReputationScore(this.ctx.reputationState),
      starRating: summary.starRating,
      trend: summary.trend,
      totalTurnAways: this.ctx.reputationState.totalTurnAways,
      returnRate: summary.returnRate,
    };
  }

  public trackGolferVisitForReputation(golferId: string, isReturning: boolean): void {
    this.ctx.reputationState = trackGolferVisit(
      this.ctx.reputationState,
      golferId,
      isReturning
    );
  }

  public trackTurnAwayForReputation(): void {
    this.ctx.reputationState = trackTurnAway(this.ctx.reputationState);
  }

  public getWalkOnSummary(): {
    queueLength: number;
    served: number;
    turnedAway: number;
    gaveUp: number;
    avgWait: number;
    estimatedWait: number;
  } {
    const summary = getWalkOnSummary(this.ctx.walkOnState);
    return {
      queueLength: getQueueLength(this.ctx.walkOnState),
      served: summary.served,
      turnedAway: summary.turnedAway,
      gaveUp: summary.gaveUp,
      avgWait: summary.averageWait,
      estimatedWait: getEstimatedWaitTime(this.ctx.walkOnState),
    };
  }

  public updateWalkOnPolicy(maxWaitMinutes?: number, maxQueueSize?: number): void {
    const updates: Partial<{ maxWaitMinutes: number; maxQueueSize: number }> = {};
    if (maxWaitMinutes !== undefined) updates.maxWaitMinutes = maxWaitMinutes;
    if (maxQueueSize !== undefined) updates.maxQueueSize = maxQueueSize;
    this.ctx.walkOnState = updateWalkOnPolicy(this.ctx.walkOnState, updates);
  }

  public addWalkOnGolfer(): boolean {
    const currentTime: GameTime = {
      day: this.ctx.gameDay,
      hour: Math.floor(this.ctx.gameTime / 60),
      minute: this.ctx.gameTime % 60,
    };
    const golfer = createWalkOnGolfer(
      `walkon_${Date.now()}`,
      `Walk-On ${Date.now() % 1000}`,
      currentTime
    );
    const result = addWalkOnToQueue(this.ctx.walkOnState, golfer);
    this.ctx.walkOnState = result.state;
    return result.accepted;
  }

  public getRevenueSummaryData(): {
    todaysGross: number;
    todaysNet: number;
    weeklyAvg: number;
    monthlyAvg: number;
    topRevenueSource: string;
  } {
    const summary = getRevenueSummary(this.ctx.revenueState);
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
    const hour = Math.floor(this.ctx.gameTime / 60);
    const dayOfWeek = this.ctx.gameDay % 7;
    return calculateGreenFee(
      this.ctx.revenueState.greenFeeStructure,
      dayOfWeek,
      hour,
      membershipType
    );
  }

  public calculateCartFeeForGolfer(): number {
    const hour = Math.floor(this.ctx.gameTime / 60);
    return calculateCartFee(this.ctx.revenueState.cartFeeStructure, isTwilightHour(hour));
  }

  public getAverageRevenue(days: number = 7): number {
    const avgRevenue = calculateAverageRevenue(this.ctx.revenueState, days);
    return avgRevenue.grossRevenue;
  }

  public purchaseRobotUnit(equipmentId: string): boolean {
    const availableRobots = getAvailableRobotsToPurchase(this.ctx.researchState, this.ctx.autonomousState);
    const robot = availableRobots.find(r => r.equipmentId === equipmentId);
    if (!robot) return false;

    const result = purchaseRobot(this.ctx.autonomousState, equipmentId, robot.stats);
    if (!result) return false;

    if (result.cost > this.ctx.economyState.cash) return false;

    this.ctx.autonomousState = result.state;
    const timestamp = this.ctx.gameDay * 24 * 60 + this.ctx.gameTime;
    const expenseResult = addExpense(
      this.ctx.economyState,
      result.cost,
      'equipment_purchase',
      `Robot purchase: ${equipmentId}`,
      timestamp
    );
    if (expenseResult) {
      this.ctx.economyState = expenseResult;
    }
    return true;
  }

  public sellRobotUnit(robotId: string): boolean {
    const result = sellRobot(this.ctx.autonomousState, robotId);
    if (!result) return false;

    this.ctx.autonomousState = result.state;
    const timestamp = this.ctx.gameDay * 24 * 60 + this.ctx.gameTime;
    const incomeResult = addIncome(
      this.ctx.economyState,
      result.refund,
      'equipment_purchase',
      `Robot sale: ${robotId}`,
      timestamp
    );
    this.ctx.economyState = incomeResult;
    return true;
  }

  public getRobotList(): Array<{ id: string; type: string; state: string; battery: number }> {
    return this.ctx.autonomousState.robots.map(r => ({
      id: r.id,
      type: r.type,
      state: r.state,
      battery: r.resourceCurrent,
    }));
  }

  public isCurrentTimeWeekend(): boolean {
    return isWeekend(this.ctx.gameDay % 7);
  }

  public isCurrentTimePrimeMorning(): boolean {
    return isPrimeMorning(Math.floor(this.ctx.gameTime / 60));
  }

  public isCurrentTimeTwilight(): boolean {
    return isTwilightHour(Math.floor(this.ctx.gameTime / 60));
  }

  public getWeatherDescription(): string {
    return getWeatherDescription(this.ctx.weatherState.current);
  }

  public getWeatherImpact(): string {
    return getWeatherImpactDescription(this.ctx.weatherState.current);
  }

  public getCurrentSeason(): string {
    return getSeasonFromDay(this.ctx.gameDay).season;
  }

  public completeResearch(itemId: string): boolean {
    const newState = completeResearchInstantly(this.ctx.researchState, itemId);
    if (!newState) return false;
    this.ctx.researchState = newState;
    return true;
  }

  public completeResearchWithPrerequisites(itemId: string): boolean {
    const chain = getPrerequisiteChain(itemId);
    for (const prereqId of chain) {
      if (!this.ctx.researchState.completedResearch.includes(prereqId)) {
        const result = completeResearchInstantly(this.ctx.researchState, prereqId);
        if (result) {
          this.ctx.researchState = result;
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
      status: getResearchStatus(this.ctx.researchState, itemId),
      progress: getResearchProgress(this.ctx.researchState),
      prerequisites: getPrerequisiteChain(itemId) as string[],
    };
  }

  public takeLoan(size: "small" | "medium" | "large"): boolean {
    const terms = DEFAULT_LOAN_TERMS[size];
    const result = takeLoan(this.ctx.economyState, terms, this.ctx.gameTime);
    if (!result) return false;
    this.ctx.economyState = result;
    return true;
  }

  public makeLoanPayment(loanId: string): boolean {
    const result = makeLoanPayment(this.ctx.economyState, loanId, this.ctx.gameTime);
    if (!result) return false;
    this.ctx.economyState = result;
    return true;
  }

  public payOffLoan(loanId: string): boolean {
    const result = payOffLoan(this.ctx.economyState, loanId, this.ctx.gameTime);
    if (!result) return false;
    this.ctx.economyState = result;
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
      loans: this.ctx.economyState.loans.map((l) => ({
        id: l.id,
        principal: l.principal,
        remainingBalance: l.remainingBalance,
        interestRate: l.interestRate,
        monthlyPayment: l.monthlyPayment,
      })),
      totalDebt: getTotalDebt(this.ctx.economyState),
      netWorth: getNetWorth(this.ctx.economyState),
      canTakeLoan: this.ctx.economyState.loans.length < 3,
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
    const end = endTime ?? this.ctx.gameTime;
    return getTransactionsInRange(this.ctx.economyState, start, end).map((t) => ({
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
    const summary = calculateFinancialSummary(this.ctx.economyState.transactions);
    return {
      totalIncome: summary.totalIncome,
      totalExpenses: summary.totalExpenses,
      netProfit: summary.netProfit,
    };
  }

  public forceHireGroundskeeper(): string | null {
    const employee = createEmployee("groundskeeper", "novice", this.ctx.gameTime);
    this.ctx.employeeRoster = {
      ...this.ctx.employeeRoster,
      employees: [...this.ctx.employeeRoster.employees, employee],
    };
    this.ctx.employeeWorkState = syncWorkersWithRoster(
      this.ctx.employeeWorkState,
      this.ctx.employeeRoster.employees
    );
    return employee.id;
  }

  public getWorkerDetails(): Array<{
    employeeId: string;
    gridX: number;
    gridY: number;
    task: string;
    worldX: number;
    worldZ: number;
  }> {
    return getWorkerPositions(this.ctx.employeeWorkState).map((w) => ({
      employeeId: w.employeeId,
      gridX: w.gridX,
      gridY: w.gridY,
      task: w.task,
      worldX: w.worldX,
      worldZ: w.worldZ,
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
    return this.ctx.autonomousState.robots.map((r) => ({
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
    if (!this.ctx.scenarioManager) return null;
    const objective = this.ctx.scenarioManager.getObjective();
    const conditions = this.ctx.scenarioManager.getConditions();
    return {
      type: objective.type,
      description: this.ctx.scenarioManager.getObjectiveDescription(),
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
    if (!this.ctx.scenarioManager) return;
    this.ctx.scenarioManager.updateProgress(updates);
  }

  public checkScenarioObjective(): {
    completed: boolean;
    failed: boolean;
    progress: number;
    message?: string;
  } {
    if (!this.ctx.scenarioManager) {
      return { completed: false, failed: false, progress: 0 };
    }
    return this.ctx.scenarioManager.checkObjective();
  }

  public addRevenue(amount: number, category: string = "green_fees"): void {
    if (this.ctx.scenarioManager) {
      this.ctx.scenarioManager.addRevenue(amount);
    }
    this.ctx.economyState = addIncome(
      this.ctx.economyState,
      amount,
      category as any,
      "Test revenue",
      this.ctx.gameTime
    );
  }

  public addExpenseAmount(amount: number, category: string = "supplies"): void {
    if (this.ctx.scenarioManager) {
      this.ctx.scenarioManager.addExpense(amount);
    }
    const result = addExpense(
      this.ctx.economyState,
      amount,
      category as any,
      "Test expense",
      this.ctx.gameTime,
      true
    );
    if (result) {
      this.ctx.economyState = result;
    }
  }

  public incrementScenarioDay(): void {
    if (this.ctx.scenarioManager) {
      this.ctx.scenarioManager.incrementDay();
    }
  }

  public updateCourseHealthForScenario(): void {
    if (this.ctx.scenarioManager && this.ctx.terrainSystem) {
      this.ctx.scenarioManager.updateCourseHealthFromFaces(this.ctx.terrainSystem.getAllFaceStates());
    }
  }

  public checkSatisfactionStreak(targetRating: number): void {
    if (this.ctx.scenarioManager) {
      this.ctx.scenarioManager.checkSatisfactionStreak(targetRating);
    }
  }

  public addGolferCount(count: number): void {
    if (this.ctx.scenarioManager) {
      this.ctx.scenarioManager.addGolfers(count);
    }
  }

  public addRoundCount(): void {
    if (this.ctx.scenarioManager) {
      this.ctx.scenarioManager.addRound();
    }
  }

  public getDetailedResearchState(): {
    completedResearch: string[];
    currentResearch: { itemId: string; progress: number } | null;
    researchQueue: string[];
    fundingLevel: string;
    availableResearch: string[];
  } {
    const available = getAvailableResearchItems(this.ctx.researchState);
    return {
      completedResearch: [...this.ctx.researchState.completedResearch],
      currentResearch: this.ctx.researchState.currentResearch
        ? {
            itemId: this.ctx.researchState.currentResearch.itemId,
            progress: Math.round(
              (this.ctx.researchState.currentResearch.pointsEarned /
                this.ctx.researchState.currentResearch.pointsRequired) *
                100
            ),
          }
        : null,
      researchQueue: [...this.ctx.researchState.researchQueue],
      fundingLevel: this.ctx.researchState.fundingLevel,
      availableResearch: available.map((r) => r.id),
    };
  }

  public saveCurrentGame(): void {
    this.ctx.saveCurrentGame();
  }

  public hasSavedGame(): boolean {
    return this.ctx.hasSavedGame();
  }
}
