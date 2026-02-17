import { Direction, EquipmentSlot } from "./engine/InputManager";
import { OverlayMode, getTerrainType } from "../core/terrain";
import { TerrainSystem } from "./systems/TerrainSystemInterface";
import { EquipmentManager } from "./systems/EquipmentManager";
import { TerrainEditorSystem } from "./systems/TerrainEditorSystem";
import { IrrigationRenderSystem } from "./systems/IrrigationRenderSystem";
import { EntityVisualState } from "./systems/EntityVisualSystem";
import { UIManager } from "./ui/UIManager";
import { BabylonEngine } from "./engine/BabylonEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";

import { EditorTool } from "../core/terrain-editor-logic";
import {
  summarizeHoleGameplay,
  type CourseHoleDefinition,
} from "../core/hole-construction";

import { GameState, getRuntimeRefillStationsFromState } from "./GameState";
export { GameState } from "./GameState";

import {
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
  IrrigationSystem,
} from "../core/irrigation";
import {
  hireEmployee,
  fireEmployee,
  Employee,
  createEmployee,
} from "../core/employees";
import {
  syncWorkersWithRoster,
  getWorkerPositions,
} from "../core/employee-work";
import { PlayerEntity, teleportEntity } from "../core/movable-entity";
import {
  getActiveGolferCount,
  getAverageSatisfaction,
  WeatherCondition,
} from "../core/golfers";
import {
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
  ResearchState,
} from "../core/research";
import {
  calculateCurrentConditionsFromFaces,
  updatePrestigeScore,
  upgradeAmenity,
} from "../core/prestige";
import { AmenityUpgrade, getUpgradeCost, getAvailableUpgrades, getUpgradeName } from "../core/amenities";
import {
  bookTeeTime,
  checkInTeeTime,
  cancelTeeTime,
  type GameTime,
} from "../core/tee-times";
import {
  getRevenueSummary,
  calculateGreenFee,
  calculateCartFee,
  calculateAverageRevenue,
  isWeekend,
  isPrimeMorning,
  isTwilightHour,
} from "../core/tee-revenue";
import {
  deleteSave,
  getSaveInfo,
  listSaves,
} from "../core/save-game";
import {
  purchaseRobot,
  sellRobot,
  countWorkingRobots,
  countBrokenRobots,
  getAvailableRobotsToPurchase,
  RobotUnit,
} from "../core/autonomous-equipment";
import {
  getWeatherDescription,
  getWeatherImpactDescription,
  getSeasonFromDay,
} from "../core/weather";
import {
  getReputationSummary,
  calculateReputationScore,
  trackGolferVisit,
  trackTurnAway,
} from "../core/reputation";

export interface GameSystems {
  player: PlayerEntity;
  playerVisual: EntityVisualState | null;
  clickToMoveWaypoints: Array<{ x: number; z: number }>;
  lastEquipmentFaceId: number | null;
  equipmentManager: EquipmentManager;
  terrainSystem: TerrainSystem;
  terrainEditorSystem: TerrainEditorSystem | null;
  irrigationRenderSystem: IrrigationRenderSystem | null;
  uiManager: UIManager;
  babylonEngine: BabylonEngine;
  teeSheetViewDay: number;
  handleMove(direction: Direction): void;
  handleEmployeePanel(): void;
  handleResearchPanel(): void;
  handleTeeSheetPanel(): void;
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
  showRobotInspector(robot: RobotUnit): void;
}

export class GameAPI {
  constructor(private state: GameState, private systems: GameSystems) {}

  public teleport(x: number, y: number): void {
    const course = this.state.currentCourse;
    if (x < 0 || x >= course.width || y < 0 || y >= course.height) {
      console.warn(`Teleport target (${x}, ${y}) is out of bounds.`);
      return;
    }

    this.systems.player = {
      ...teleportEntity(this.systems.player, x, y),
      worldX: x + 0.5,
      worldZ: y + 0.5,
    };
    this.systems.clickToMoveWaypoints = [];
    this.systems.lastEquipmentFaceId = null;

    if (this.systems.playerVisual) {
      this.systems.playerVisual.lastGridX = x;
      this.systems.playerVisual.lastGridY = y;
      this.systems.playerVisual.targetGridX = x;
      this.systems.playerVisual.targetGridY = y;
      this.systems.playerVisual.visualProgress = 1;
    }

    this.systems.updatePlayerPosition();
  }

  public setRunning(running: boolean): void {
    if (running) {
      this.systems.babylonEngine.start();
    } else {
      this.systems.babylonEngine.stop();
    }
  }

  public getScenarioState(): {
    progress: number;
    completed: boolean;
    failed: boolean;
    message?: string;
  } | null {
    if (!this.state.scenarioManager) return null;
    const result = this.state.scenarioManager.checkObjective();
    return {
      progress: result.progress,
      completed: result.completed,
      failed: result.failed,
      message: result.message,
    };
  }

  public getEconomyState(): { cash: number; earned: number; spent: number } {
    return {
      cash: this.state.economyState.cash,
      earned: this.state.economyState.totalEarned,
      spent: this.state.economyState.totalSpent,
    };
  }

  public getPrestigeState(): {
    score: number;
    stars: number;
    tier: string;
    amenityScore: number;
  } {
    return {
      score: this.state.prestigeState.currentScore,
      stars: this.state.prestigeState.starRating,
      tier: this.state.prestigeState.tier,
      amenityScore: this.state.prestigeState.amenityScore,
    };
  }

  public getGameDay(): number {
    return this.state.gameDay;
  }

  public getTeeTimeStats(): {
    totalBookings: number;
    cancellations: number;
    noShows: number;
    slotsAvailable: number;
  } {
    const todaySlots = this.state.teeTimeState.teeTimes.get(this.state.gameDay) ?? [];
    const available = todaySlots.filter((t) => t.status === "available").length;

    return {
      totalBookings: this.state.teeTimeState.bookingMetrics.totalBookingsToday,
      cancellations: this.state.teeTimeState.bookingMetrics.cancellationsToday,
      noShows: this.state.teeTimeState.bookingMetrics.noShowsToday,
      slotsAvailable: available,
    };
  }

  public getCourseHoles(): CourseHoleDefinition[] {
    const holes = this.state.currentCourse.holes ?? [];
    return holes.map((hole) => ({
      ...hole,
      teeBoxes: hole.teeBoxes.map((tee) => ({ ...tee })),
      pinPositions: hole.pinPositions.map((pin) => ({ ...pin })),
      yardages: { ...hole.yardages },
      validationIssues: [...hole.validationIssues],
    }));
  }

  public getCourseHoleSummary(): {
    totalHoles: number;
    playableHoles: number;
    totalTeeBoxes: number;
    totalPinPositions: number;
    coursePar: number;
  } {
    const holes = this.state.currentCourse.holes ?? [];
    return summarizeHoleGameplay(holes);
  }

  public getGameTime(): { hours: number; minutes: number } {
    return {
      hours: Math.floor(this.state.gameTime / 60),
      minutes: Math.floor(this.state.gameTime % 60),
    };
  }

  public setCash(amount: number): void {
    const diff = amount - this.state.economyState.cash;
    const timestamp = Date.now();
    if (diff > 0) {
      this.state.economyState = addIncome(
        this.state.economyState,
        diff,
        "other_income",
        "Test adjustment",
        timestamp
      );
    } else if (diff < 0) {
      const result = addExpense(
        this.state.economyState,
        -diff,
        "other_expense",
        "Test adjustment",
        timestamp,
        true
      );
      if (result) {
        this.state.economyState = result;
      }
    }
    this.systems.uiManager.updateEconomy(
      this.state.economyState.cash,
      getActiveGolferCount(this.state.golferPool),
      getAverageSatisfaction(this.state.golferPool)
    );
  }

  public advanceDay(): void {
    this.state.gameDay++;
    if (this.state.scenarioManager) {
      this.state.scenarioManager.incrementDay();
    }
    const conditionsScore = calculateCurrentConditionsFromFaces(this.systems.terrainSystem.getAllFaceStates());
    this.state.prestigeState = updatePrestigeScore(
      this.state.prestigeState,
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

    const cost = getUpgradeCost(this.state.prestigeState.amenities, upgrade);
    if (this.state.economyState.cash < cost) {
      return false;
    }

    this.state.prestigeState = upgradeAmenity(this.state.prestigeState, upgrade);
    const timestamp = this.state.gameDay * 24 * 60 + this.state.gameTime;
    const expenseResult = addExpense(
      this.state.economyState,
      cost,
      "equipment_purchase",
      `Amenity: ${upgrade.type}`,
      timestamp,
      false
    );
    if (expenseResult) {
      this.state.economyState = expenseResult;
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
      this.systems.handleMove(dir);
    }
  }

  public getPlayerPosition(): { x: number; y: number } {
    return { x: this.systems.player.worldX, y: this.systems.player.worldZ };
  }

  public selectEquipment(slot: 1 | 2 | 3): void {
    const wasSelected = this.systems.equipmentManager.getSelected();
    this.systems.equipmentManager.handleSlot(slot);
    const nowSelected = this.systems.equipmentManager.getSelected();

    if (nowSelected !== null && nowSelected !== wasSelected) {
      const overlayMap: Record<EquipmentSlot, OverlayMode | null> = {
        1: null,
        2: "moisture",
        3: "nutrients",
      };
      const targetOverlay = overlayMap[slot];
      if (targetOverlay && this.systems.terrainSystem.getOverlayMode() !== targetOverlay) {
        this.systems.terrainSystem.setOverlayMode(targetOverlay);
        this.systems.uiManager.updateOverlayLegend(targetOverlay);
        this.state.overlayAutoSwitched = true;
        this.systems.updateIrrigationVisibility();
      } else if (targetOverlay === null && this.state.overlayAutoSwitched) {
        this.systems.terrainSystem.setOverlayMode("normal");
        this.systems.uiManager.updateOverlayLegend("normal");
        this.state.overlayAutoSwitched = false;
        this.systems.updateIrrigationVisibility();
      }
    } else if (nowSelected === null && this.state.overlayAutoSwitched) {
      this.systems.terrainSystem.setOverlayMode("normal");
      this.systems.uiManager.updateOverlayLegend("normal");
      this.state.overlayAutoSwitched = false;
      this.systems.updateIrrigationVisibility();
    }
  }

  public toggleEquipment(): void {
    const selected = this.systems.equipmentManager.getSelected();
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
    const mowerState = this.systems.equipmentManager.getState("mower");
    const sprinklerState = this.systems.equipmentManager.getState("sprinkler");
    const spreaderState = this.systems.equipmentManager.getState("spreader");

    const selected = this.systems.equipmentManager.getSelected();
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
    if (!this.systems.terrainEditorSystem) return;
    if (enabled) {
      this.systems.terrainEditorSystem.enable();
    } else {
      this.systems.terrainEditorSystem.disable();
    }
  }

  public isTerrainEditorEnabled(): boolean {
    return this.systems.terrainEditorSystem?.isEnabled() ?? false;
  }

  public setEditorTool(tool: string): void {
    if (!this.systems.terrainEditorSystem) return;

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
      this.systems.terrainEditorSystem.setTool(editorTool);
    }
  }

  public setEditorBrushSize(size: number): void {
    if (this.systems.terrainEditorSystem) {
      this.systems.terrainEditorSystem.setBrushSize(size);
    }
  }

  public editTerrainAt(worldX: number, worldZ: number): void {
    if (!this.systems.terrainEditorSystem || !this.systems.terrainEditorSystem.isEnabled()) {
      return;
    }

    const worldPos = new Vector3(worldX + 0.1, 0, worldZ + 0.1);
    this.systems.terrainEditorSystem.handleMouseMove(worldX, worldZ, worldPos);
    this.systems.terrainEditorSystem.handleClick(worldX, worldZ);
  }

  public dragTerrainStart(
    worldX: number,
    worldZ: number
  ): void {
    if (!this.systems.terrainEditorSystem || !this.systems.terrainEditorSystem.isEnabled()) {
      return;
    }

    this.systems.terrainEditorSystem.handleMouseMove(worldX, worldZ);
    this.systems.terrainEditorSystem.handleDragStart(worldX, worldZ);
  }

  public dragTerrainMove(worldX: number, worldZ: number): void {
    if (!this.systems.terrainEditorSystem || !this.systems.terrainEditorSystem.isEnabled()) {
      return;
    }

    this.systems.terrainEditorSystem.handleMouseMove(worldX, worldZ);
    this.systems.terrainEditorSystem.handleDrag(worldX, worldZ);
  }

  public dragTerrainEnd(): void {
    if (this.systems.terrainEditorSystem) {
      this.systems.terrainEditorSystem.handleDragEnd();
    }
  }

  public getElevationAt(x: number, y: number): number | undefined {
    return this.systems.terrainSystem.getElevationAt(x, y);
  }

  public setElevationAt(x: number, y: number, elevation: number): void {
    this.systems.terrainSystem.setElevationAt(x, y, elevation);
  }

  public setAllCellsState(
    state: { height?: number; moisture?: number; nutrients?: number; health?: number }
  ): void {
    this.systems.terrainSystem.setAllFaceStates({
      grassHeight: state.height,
      moisture: state.moisture,
      nutrients: state.nutrients,
      health: state.health,
    });
  }

  public setAllFaceStates(
    state: { moisture?: number; nutrients?: number; grassHeight?: number; health?: number }
  ): void {
    this.systems.terrainSystem.setAllFaceStates(state);
  }

  public getTerrainTypeAt(worldX: number, worldZ: number): string | undefined {
    return this.systems.terrainSystem.getTerrainTypeAt(worldX, worldZ);
  }

  public setTerrainTypeAt(
    worldX: number,
    worldZ: number,
    type: "fairway" | "rough" | "green" | "bunker" | "water" | "tee"
  ): void {
    this.systems.terrainSystem.setTerrainTypeAt(worldX, worldZ, type);
  }

  public setOverlayMode(
    mode: "normal" | "moisture" | "nutrients" | "height" | "irrigation"
  ): void {
    this.systems.terrainSystem.setOverlayMode(mode);

    const scene = this.systems.babylonEngine.getScene();
    if (mode === "irrigation") {
      scene.clearColor = new Color4(0.9, 0.88, 0.85, 1);
    } else {
      scene.clearColor = new Color4(0.4, 0.6, 0.9, 1);
    }

    if (this.systems.irrigationRenderSystem) {
      this.systems.irrigationRenderSystem.setVisible(mode === "irrigation");
    }

    this.systems.uiManager.updateOverlayLegend(mode);
    this.state.overlayAutoSwitched = false;
    this.systems.updateIrrigationVisibility();
  }

  public getOverlayMode():
    | "normal"
    | "moisture"
    | "nutrients"
    | "height"
    | "irrigation" {
    return this.systems.terrainSystem.getOverlayMode();
  }

  public async waitForPlayerIdle(): Promise<void> {
    return new Promise((resolve) => {
      const checkIdle = () => {
        if (!this.systems.isPlayerMoving()) {
          resolve();
        } else {
          setTimeout(checkIdle, 16);
        }
      };
      checkIdle();
    });
  }

  public toggleEmployeePanel(): void {
    this.systems.handleEmployeePanel();
  }

  public toggleResearchPanel(): void {
    this.systems.handleResearchPanel();
  }

  public toggleTeeSheetPanel(): void {
    this.systems.handleTeeSheetPanel();
  }

  public cycleOverlay(): void {
    this.systems.handleOverlayCycle();
  }

  public refillEquipment(): void {
    this.systems.handleRefill();
  }

  public toggleMute(): void {
    this.systems.handleMute();
  }

  public getEmployeeState(): {
    employees: readonly Employee[];
    count: number;
    maxEmployees: number;
    totalHourlyWages: number;
  } {
    return {
      employees: this.state.employeeRoster.employees,
      count: this.state.employeeRoster.employees.length,
      maxEmployees: this.state.employeeRoster.maxEmployees,
      totalHourlyWages: this.state.employeeRoster.employees.reduce(
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
      applications: this.state.applicationState.applications,
      nextApplicationTime: this.state.applicationState.nextApplicationTime,
      activeJobPostings: this.state.applicationState.activeJobPostings.length,
      totalReceived: this.state.applicationState.totalApplicationsReceived,
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
    const dims = this.systems.terrainSystem.getWorldDimensions();
    return {
      player: {
        x: this.systems.player.worldX,
        y: this.systems.player.worldZ,
        isMoving: this.systems.isPlayerMoving(),
      },
      equipment: this.getEquipmentState(),
      time: {
        day: this.state.gameDay,
        hours: Math.floor(this.state.gameTime / 60),
        minutes: this.state.gameTime % 60,
      },
      economy: this.getEconomyState(),
      terrain: {
        width: dims.width,
        height: dims.height,
      },
      editorEnabled: this.isTerrainEditorEnabled(),
    };
  }

  public placePipe(x: number, y: number, pipeType: PipeType): boolean {
    const timestamp = this.state.gameDay * 24 * 60 + this.state.gameTime;
    const config = PIPE_CONFIGS[pipeType];
    const cost = config.cost;

    if (!canAfford(this.state.economyState, cost)) {
      return false;
    }

    this.state.irrigationSystem = addPipe(
      this.state.irrigationSystem,
      x,
      y,
      pipeType,
      timestamp
    );
    const expenseResult = addExpense(
      this.state.economyState,
      cost,
      "construction",
      `Pipe installation: ${pipeType}`,
      timestamp,
      false
    );
    if (expenseResult) {
      this.state.economyState = expenseResult;
    }

    if (this.systems.irrigationRenderSystem) {
      this.systems.irrigationRenderSystem.update(this.state.irrigationSystem);
    }

    return true;
  }

  public removePipe(x: number, y: number): void {
    this.state.irrigationSystem = removePipe(this.state.irrigationSystem, x, y);
    if (this.systems.irrigationRenderSystem) {
      this.systems.irrigationRenderSystem.update(this.state.irrigationSystem);
    }
  }

  public placeSprinklerHead(
    x: number,
    y: number,
    sprinklerType: SprinklerType
  ): boolean {
    const timestamp = this.state.gameDay * 24 * 60 + this.state.gameTime;
    const config = SPRINKLER_CONFIGS[sprinklerType];
    const cost = config.cost + 20;

    if (!canAfford(this.state.economyState, cost)) {
      return false;
    }

    this.state.irrigationSystem = addSprinklerHead(
      this.state.irrigationSystem,
      x,
      y,
      sprinklerType,
      timestamp
    );
    const expenseResult = addExpense(
      this.state.economyState,
      cost,
      "construction",
      `Sprinkler installation: ${sprinklerType}`,
      timestamp,
      false
    );
    if (expenseResult) {
      this.state.economyState = expenseResult;
    }

    if (this.systems.irrigationRenderSystem) {
      this.systems.irrigationRenderSystem.update(this.state.irrigationSystem);
    }

    return true;
  }

  public removeSprinklerHead(x: number, y: number): void {
    const head = getSprinklerHeadAt(this.state.irrigationSystem, x, y);
    if (head) {
      this.state.irrigationSystem = removeSprinklerHead(
        this.state.irrigationSystem,
        head.id
      );
      if (this.systems.irrigationRenderSystem) {
        this.systems.irrigationRenderSystem.update(this.state.irrigationSystem);
      }
    }
  }

  public repairLeak(x: number, y: number): boolean {
    const timestamp = this.state.gameDay * 24 * 60 + this.state.gameTime;
    const cost = 20;

    if (!canAfford(this.state.economyState, cost)) {
      return false;
    }

    const result = repairLeak(this.state.irrigationSystem, x, y);
    if (result) {
      this.state.irrigationSystem = result;
      const expenseResult = addExpense(
        this.state.economyState,
        cost,
        "equipment_maintenance",
        "Pipe leak repair",
        timestamp,
        false
      );
      if (expenseResult) {
        this.state.economyState = expenseResult;
      }

      if (this.systems.irrigationRenderSystem) {
        this.systems.irrigationRenderSystem.update(this.state.irrigationSystem);
      }

      return true;
    }

    return false;
  }

  public getIrrigationSystem(): IrrigationSystem {
    return this.state.irrigationSystem;
  }

  public setIrrigationSchedule(
    headId: string,
    schedule: WateringSchedule
  ): void {
    this.state.irrigationSystem = updateSprinklerSchedule(
      this.state.irrigationSystem,
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
    const terrainType = this.systems.terrainSystem.getTerrainTypeAt(x, y);
    if (!terrainType) return null;
    const faceId = this.systems.terrainSystem.findFaceAtPosition(x + 0.5, y + 0.5);
    const face = faceId != null ? this.systems.terrainSystem.getFaceState(faceId) : undefined;
    const elevation = this.systems.terrainSystem.getElevationAt(x, y);
    if (face) {
      return {
        type: terrainType,
        elevation,
        height: face.grassHeight,
        moisture: face.moisture,
        nutrients: face.nutrients,
        health: face.health,
        lastMowed: face.lastMowed,
        lastWatered: face.lastWatered,
        lastFertilized: face.lastFertilized,
      };
    }
    const sample = this.systems.terrainSystem.sampleFaceStatesInRadius(x + 0.5, y + 0.5, 0.5);
    return {
      type: terrainType,
      elevation,
      height: sample.avgGrassHeight,
      moisture: sample.avgMoisture,
      nutrients: sample.avgNutrients,
      health: sample.avgHealth,
      lastMowed: 0,
      lastWatered: 0,
      lastFertilized: 0,
    };
  }

  public getCourseStats(): {
    health: number;
    moisture: number;
    nutrients: number;
    height: number;
  } {
    return this.systems.terrainSystem.getCourseStats();
  }

  public setEquipmentResource(
    type: "mower" | "sprinkler" | "spreader",
    amount: number
  ): void {
    this.systems.equipmentManager.setResource(type, amount);
  }

  public advanceTimeByMinutes(minutes: number): void {
    const deltaMs = minutes * 60 * 1000 / this.state.timeScale;
    this.state.gameTime += (deltaMs / 1000) * 2 * this.state.timeScale;
    if (this.state.gameTime >= 24 * 60) {
      this.state.gameTime -= 24 * 60;
      this.state.gameDay++;
    }
    this.systems.terrainSystem.update(deltaMs, this.state.gameDay * 1440 + this.state.gameTime);
    this.systems.updateEconomySystems(deltaMs);
  }

  public getResearchState(): ResearchState {
    return this.state.researchState;
  }

  public startResearchItem(itemId: string): boolean {
    const currentTime = this.state.gameDay * 24 * 60 + this.state.gameTime;
    const result = startResearch(this.state.researchState, itemId, currentTime);
    if (result) {
      this.state.researchState = result;
      return true;
    }
    return false;
  }

  public cancelCurrentResearch(): void {
    this.state.researchState = cancelResearch(this.state.researchState);
  }

  public setResearchFunding(level: FundingLevel): void {
    this.state.researchState = setFundingLevel(this.state.researchState, level);
  }

  public queueResearch(itemId: string): void {
    this.state.researchState = {
      ...this.state.researchState,
      researchQueue: [...this.state.researchState.researchQueue, itemId],
    };
  }

  public isResearchCompleted(itemId: string): boolean {
    return this.state.researchState.completedResearch.includes(itemId);
  }

  public getAvailableResearch(): string[] {
    return RESEARCH_ITEMS
      .filter((item) => {
        if (this.state.researchState.completedResearch.includes(item.id)) return false;
        return item.prerequisites.every((prereq) =>
          this.state.researchState.completedResearch.includes(prereq)
        );
      })
      .map((item) => item.id);
  }

  public hireEmployee(applicationIndex: number): boolean {
    if (
      applicationIndex < 0 ||
      applicationIndex >= this.state.applicationState.applications.length
    ) {
      return false;
    }
    const application = this.state.applicationState.applications[applicationIndex];
    const result = hireEmployee(this.state.employeeRoster, application);
    if (result) {
      this.state.employeeRoster = result;
      this.state.applicationState = {
        ...this.state.applicationState,
        applications: this.state.applicationState.applications.filter((_, i) => i !== applicationIndex),
      };
      return true;
    }
    return false;
  }

  public fireEmployee(employeeId: string): boolean {
    const result = fireEmployee(this.state.employeeRoster, employeeId);
    if (result) {
      this.state.employeeRoster = result;
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
    const targetDay = day ?? this.state.gameDay;
    const teeTimes = this.state.teeTimeState.teeTimes.get(targetDay) ?? [];
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
      greenFee: this.state.prestigeState.greenFee || 50,
      cartFee: 0,
      addOns: [],
    }));
    const currentTime: GameTime = {
      day: this.state.gameDay,
      hour: Math.floor(this.state.gameTime / 60),
      minute: this.state.gameTime % 60,
    };
    const result = bookTeeTime(this.state.teeTimeState, teeTimeId, golferBookings, 'reservation', currentTime);
    if (result !== this.state.teeTimeState) {
      this.state.teeTimeState = result;
      return true;
    }
    return false;
  }

  public checkInTeeTime(teeTimeId: string): boolean {
    const result = checkInTeeTime(this.state.teeTimeState, teeTimeId);
    this.state.teeTimeState = result;
    return true;
  }

  public cancelTeeTimeBooking(teeTimeId: string): boolean {
    const result = cancelTeeTime(this.state.teeTimeState, teeTimeId);
    this.state.teeTimeState = result;
    return true;
  }

  public getAvailableAmenities(): Array<{
    id: string;
    name: string;
    cost: number;
    purchased: boolean;
  }> {
    const available = getAvailableUpgrades(this.state.prestigeState.amenities);
    return available.map((upgrade, index) => ({
      id: `amenity_${index}`,
      name: getUpgradeName(upgrade),
      cost: getUpgradeCost(this.state.prestigeState.amenities, upgrade),
      purchased: false,
    }));
  }

  public getGolferState(): {
    active: number;
    served: number;
    avgSatisfaction: number;
  } {
    return {
      active: getActiveGolferCount(this.state.golferPool),
      served: this.state.golferPool.totalVisitorsToday,
      avgSatisfaction: getAverageSatisfaction(this.state.golferPool),
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
    if (!this.state.scenarioManager) return null;

    return this.state.scenarioManager.getProgress();
  }

  public hasActiveParticles(): boolean {
    return this.systems.equipmentManager.hasParticles();
  }

  public getUIState(): {
    isPaused: boolean;
    overlayMode: string;
    notificationCount: number;
  } {
    return {
      isPaused: this.state.isPaused,
      overlayMode: this.systems.terrainSystem.getOverlayMode(),
      notificationCount: 0,
    };
  }

  public setPaused(paused: boolean): void {
    if (paused) {
      this.systems.pauseGame();
    } else {
      this.systems.resumeGame();
    }
  }

  private getResolvedRefillStations(): Array<{ x: number; y: number }> {
    return getRuntimeRefillStationsFromState(this.state).map(({ x, y }) => ({
      x,
      y,
    }));
  }

  public refillAtCurrentPosition(): { success: boolean; cost: number } {
    const playerPos = { x: this.systems.player.gridX, y: this.systems.player.gridY };
    const isAtStation = this.getResolvedRefillStations().some(
      (station) => station.x === playerPos.x && station.y === playerPos.y
    );

    if (!isAtStation) {
      return { success: false, cost: 0 };
    }

    const cost = this.systems.equipmentManager.refill();
    const timestamp = this.state.gameDay * 24 * 60 + this.state.gameTime;
    const expenseResult = addExpense(
      this.state.economyState,
      cost,
      "supplies",
      "Equipment refill",
      timestamp,
      false
    );
    if (expenseResult) {
      this.state.economyState = expenseResult;
    }

    return { success: true, cost };
  }

  public isAtRefillStation(): boolean {
    const playerPos = { x: this.systems.player.gridX, y: this.systems.player.gridY };
    return this.getResolvedRefillStations().some(
      (station) => station.x === playerPos.x && station.y === playerPos.y
    );
  }

  public getRefillStations(): Array<{ x: number; y: number }> {
    return this.getResolvedRefillStations();
  }

  public forceGrassGrowth(minutes: number): void {
    const deltaMs = minutes * 500;
    this.systems.terrainSystem.update(deltaMs, this.state.gameDay * 1440 + this.state.gameTime);
  }

  public getTerrainEditorState(): {
    enabled: boolean;
    tool: string | null;
    brushSize: number;
  } {
    if (!this.systems.terrainEditorSystem) {
      return {
        enabled: false,
        tool: null,
        brushSize: 1,
      };
    }

    return {
      enabled: this.systems.terrainEditorSystem.isEnabled(),
      tool: this.systems.terrainEditorSystem.getActiveTool(),
      brushSize: this.systems.terrainEditorSystem.getBrushSize(),
    };
  }

  public getRobotState(): {
    totalRobots: number;
    workingRobots: number;
    brokenRobots: number;
  } {
    return {
      totalRobots: this.state.autonomousState.robots.length,
      workingRobots: countWorkingRobots(this.state.autonomousState),
      brokenRobots: countBrokenRobots(this.state.autonomousState),
    };
  }

  public getAvailableRobots(): Array<{ equipmentId: string; ownedCount: number }> {
    return getAvailableRobotsToPurchase(this.state.researchState, this.state.autonomousState);
  }

  public getRevenueState(): {
    greenFees: number;
    cartFees: number;
    proShopSales: number;
    foodBeverage: number;
  } {
    return {
      greenFees: this.state.revenueState.todaysRevenue.greenFees,
      cartFees: this.state.revenueState.todaysRevenue.cartFees,
      proShopSales: this.state.revenueState.todaysRevenue.proShop,
      foodBeverage: this.state.revenueState.todaysRevenue.foodAndBeverage,
    };
  }

  public getWeatherState(): {
    condition: string;
    temperature: number;
    windSpeed: number;
  } {
    return {
      condition: this.state.weatherState.current.type,
      temperature: this.state.weatherState.current.temperature,
      windSpeed: this.state.weatherState.current.windSpeed,
    };
  }

  public setWeatherCondition(type: "sunny" | "cloudy" | "rainy" | "stormy"): void {
    const newCondition: WeatherCondition = {
      type,
      temperature: this.state.weatherState.current.temperature,
      windSpeed: this.state.weatherState.current.windSpeed,
    };
    this.state.weatherState = {
      ...this.state.weatherState,
      current: newCondition,
    };
  }

  public getEmployeeWorkState(): {
    workerCount: number;
    activeWorkers: number;
    idleWorkers: number;
  } {
    const workers = this.state.employeeWorkState.workers;
    const activeCount = workers.filter(w => w.currentTask !== 'idle').length;
    return {
      workerCount: workers.length,
      activeWorkers: activeCount,
      idleWorkers: workers.length - activeCount,
    };
  }

  public getTerrainDimensions(): { width: number; height: number } {
    return this.systems.terrainSystem.getWorldDimensions();
  }

  public getTerrainCellData(x: number, y: number): {
    type: string;
    elevation: number;
    moisture: number;
    nutrients: number;
    height: number;
    health: number;
  } | null {
    const terrainType = this.systems.terrainSystem.getTerrainTypeAt(x, y);
    if (!terrainType) return null;
    const elevation = this.systems.terrainSystem.getElevationAt(x, y);
    const sample = this.systems.terrainSystem.sampleFaceStatesInRadius(x + 0.5, y + 0.5, 0.5);
    return {
      type: terrainType,
      elevation,
      moisture: sample.avgMoisture,
      nutrients: sample.avgNutrients,
      height: sample.avgGrassHeight,
      health: sample.avgHealth,
    };
  }

  public getTerrainTypes(): string[] {
    const types = new Set<string>();
    for (const face of this.systems.terrainSystem.getAllFaceStates().values()) {
      types.add(getTerrainType(face.terrainCode));
    }
    return Array.from(types);
  }

  public deleteSaveGame(scenarioId: string): boolean {
    return deleteSave(scenarioId);
  }

  public getSaveGameInfo(scenarioId?: string): { savedAt: number; gameDay: number } | null {
    const id = scenarioId || this.state.currentScenario?.id || 'sandbox';
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
    const summary = getReputationSummary(this.state.reputationState);
    return {
      score: calculateReputationScore(this.state.reputationState),
      starRating: summary.starRating,
      trend: summary.trend,
      totalTurnAways: this.state.reputationState.totalTurnAways,
      returnRate: summary.returnRate,
    };
  }

  public trackGolferVisitForReputation(golferId: string, isReturning: boolean): void {
    this.state.reputationState = trackGolferVisit(
      this.state.reputationState,
      golferId,
      isReturning
    );
  }

  public trackTurnAwayForReputation(): void {
    this.state.reputationState = trackTurnAway(this.state.reputationState);
  }

  public getRevenueSummaryData(): {
    todaysGross: number;
    todaysNet: number;
    weeklyAvg: number;
    monthlyAvg: number;
    topRevenueSource: string;
  } {
    const summary = getRevenueSummary(this.state.revenueState);
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
    const hour = Math.floor(this.state.gameTime / 60);
    const dayOfWeek = this.state.gameDay % 7;
    return calculateGreenFee(
      this.state.revenueState.greenFeeStructure,
      dayOfWeek,
      hour,
      membershipType
    );
  }

  public calculateCartFeeForGolfer(): number {
    const hour = Math.floor(this.state.gameTime / 60);
    return calculateCartFee(this.state.revenueState.cartFeeStructure, isTwilightHour(hour));
  }

  public getAverageRevenue(days: number = 7): number {
    const avgRevenue = calculateAverageRevenue(this.state.revenueState, days);
    return avgRevenue.grossRevenue;
  }

  public purchaseRobotUnit(equipmentId: string): boolean {
    const availableRobots = getAvailableRobotsToPurchase(this.state.researchState, this.state.autonomousState);
    const robot = availableRobots.find(r => r.equipmentId === equipmentId);
    if (!robot) return false;

    const result = purchaseRobot(this.state.autonomousState, equipmentId, robot.stats);
    if (!result) return false;

    if (result.cost > this.state.economyState.cash) return false;

    this.state.autonomousState = result.state;
    const timestamp = this.state.gameDay * 24 * 60 + this.state.gameTime;
    const expenseResult = addExpense(
      this.state.economyState,
      result.cost,
      'equipment_purchase',
      `Robot purchase: ${equipmentId}`,
      timestamp
    );
    if (expenseResult) {
      this.state.economyState = expenseResult;
    }
    return true;
  }

  public sellRobotUnit(robotId: string): boolean {
    const result = sellRobot(this.state.autonomousState, robotId);
    if (!result) return false;

    this.state.autonomousState = result.state;
    const timestamp = this.state.gameDay * 24 * 60 + this.state.gameTime;
    const incomeResult = addIncome(
      this.state.economyState,
      result.refund,
      'equipment_purchase',
      `Robot sale: ${robotId}`,
      timestamp
    );
    this.state.economyState = incomeResult;
    return true;
  }

  public inspectRobot(robotId: string): boolean {
    const robot = this.state.autonomousState.robots.find(r => r.id === robotId);
    if (!robot) return false;
    this.systems.showRobotInspector(robot);
    return true;
  }

  public getRobotList(): Array<{ id: string; type: string; state: string; battery: number }> {
    return this.state.autonomousState.robots.map(r => ({
      id: r.id,
      type: r.type,
      state: r.state,
      battery: r.resourceCurrent,
    }));
  }

  public isCurrentTimeWeekend(): boolean {
    return isWeekend(this.state.gameDay % 7);
  }

  public isCurrentTimePrimeMorning(): boolean {
    return isPrimeMorning(Math.floor(this.state.gameTime / 60));
  }

  public isCurrentTimeTwilight(): boolean {
    return isTwilightHour(Math.floor(this.state.gameTime / 60));
  }

  public getWeatherDescription(): string {
    return getWeatherDescription(this.state.weatherState.current);
  }

  public getWeatherImpact(): string {
    return getWeatherImpactDescription(this.state.weatherState.current);
  }

  public getCurrentSeason(): string {
    return getSeasonFromDay(this.state.gameDay).season;
  }

  public completeResearch(itemId: string): boolean {
    const newState = completeResearchInstantly(this.state.researchState, itemId);
    if (!newState) return false;
    this.state.researchState = newState;
    return true;
  }

  public completeResearchWithPrerequisites(itemId: string): boolean {
    const chain = getPrerequisiteChain(itemId);
    for (const prereqId of chain) {
      if (!this.state.researchState.completedResearch.includes(prereqId)) {
        const result = completeResearchInstantly(this.state.researchState, prereqId);
        if (result) {
          this.state.researchState = result;
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
      status: getResearchStatus(this.state.researchState, itemId),
      progress: getResearchProgress(this.state.researchState),
      prerequisites: getPrerequisiteChain(itemId) as string[],
    };
  }

  public takeLoan(size: "small" | "medium" | "large"): boolean {
    const terms = DEFAULT_LOAN_TERMS[size];
    const result = takeLoan(this.state.economyState, terms, this.state.gameTime);
    if (!result) return false;
    this.state.economyState = result;
    return true;
  }

  public makeLoanPayment(loanId: string): boolean {
    const result = makeLoanPayment(this.state.economyState, loanId, this.state.gameTime);
    if (!result) return false;
    this.state.economyState = result;
    return true;
  }

  public payOffLoan(loanId: string): boolean {
    const result = payOffLoan(this.state.economyState, loanId, this.state.gameTime);
    if (!result) return false;
    this.state.economyState = result;
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
      loans: this.state.economyState.loans.map((l) => ({
        id: l.id,
        principal: l.principal,
        remainingBalance: l.remainingBalance,
        interestRate: l.interestRate,
        monthlyPayment: l.monthlyPayment,
      })),
      totalDebt: getTotalDebt(this.state.economyState),
      netWorth: getNetWorth(this.state.economyState),
      canTakeLoan: this.state.economyState.loans.length < 3,
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
    const end = endTime ?? this.state.gameTime;
    return getTransactionsInRange(this.state.economyState, start, end).map((t) => ({
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
    const summary = calculateFinancialSummary(this.state.economyState.transactions);
    return {
      totalIncome: summary.totalIncome,
      totalExpenses: summary.totalExpenses,
      netProfit: summary.netProfit,
    };
  }

  public forceHireGroundskeeper(): string | null {
    const employee = createEmployee("groundskeeper", "novice", this.state.gameTime);
    this.state.employeeRoster = {
      ...this.state.employeeRoster,
      employees: [...this.state.employeeRoster.employees, employee],
    };
    this.state.employeeWorkState = syncWorkersWithRoster(
      this.state.employeeWorkState,
      this.state.employeeRoster.employees
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
    return getWorkerPositions(this.state.employeeWorkState).map((w) => ({
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
    worldX: number;
    worldZ: number;
    targetX: number | null;
    targetY: number | null;
    breakdownTimeRemaining: number;
  }> {
    return this.state.autonomousState.robots.map((r) => ({
      id: r.id,
      type: r.type,
      state: r.state,
      battery: Math.round((r.resourceCurrent / r.resourceMax) * 100),
      worldX: Math.round(r.worldX),
      worldZ: Math.round(r.worldZ),
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
    if (!this.state.scenarioManager) return null;
    const objective = this.state.scenarioManager.getObjective();
    const conditions = this.state.scenarioManager.getConditions();
    return {
      type: objective.type,
      description: this.state.scenarioManager.getObjectiveDescription(),
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
    if (!this.state.scenarioManager) return;
    this.state.scenarioManager.updateProgress(updates);
  }

  public checkScenarioObjective(): {
    completed: boolean;
    failed: boolean;
    progress: number;
    message?: string;
  } {
    if (!this.state.scenarioManager) {
      return { completed: false, failed: false, progress: 0 };
    }
    return this.state.scenarioManager.checkObjective();
  }

  public addRevenue(amount: number, category: string = "green_fees"): void {
    if (this.state.scenarioManager) {
      this.state.scenarioManager.addRevenue(amount);
    }
    this.state.economyState = addIncome(
      this.state.economyState,
      amount,
      category as any,
      "Test revenue",
      this.state.gameTime
    );
  }

  public addExpenseAmount(amount: number, category: string = "supplies"): void {
    if (this.state.scenarioManager) {
      this.state.scenarioManager.addExpense(amount);
    }
    const result = addExpense(
      this.state.economyState,
      amount,
      category as any,
      "Test expense",
      this.state.gameTime,
      true
    );
    if (result) {
      this.state.economyState = result;
    }
  }

  public incrementScenarioDay(): void {
    if (this.state.scenarioManager) {
      this.state.scenarioManager.incrementDay();
    }
  }

  public updateCourseHealthForScenario(): void {
    if (this.state.scenarioManager && this.systems.terrainSystem) {
      this.state.scenarioManager.updateCourseHealthFromFaces(this.systems.terrainSystem.getAllFaceStates());
    }
  }

  public checkSatisfactionStreak(targetRating: number): void {
    if (this.state.scenarioManager) {
      this.state.scenarioManager.checkSatisfactionStreak(targetRating);
    }
  }

  public addGolferCount(count: number): void {
    if (this.state.scenarioManager) {
      this.state.scenarioManager.addGolfers(count);
    }
  }

  public addRoundCount(): void {
    if (this.state.scenarioManager) {
      this.state.scenarioManager.addRound();
    }
  }

  public getDetailedResearchState(): {
    completedResearch: string[];
    currentResearch: { itemId: string; progress: number } | null;
    researchQueue: string[];
    fundingLevel: string;
    availableResearch: string[];
  } {
    const available = getAvailableResearchItems(this.state.researchState);
    return {
      completedResearch: [...this.state.researchState.completedResearch],
      currentResearch: this.state.researchState.currentResearch
        ? {
            itemId: this.state.researchState.currentResearch.itemId,
            progress: Math.round(
              (this.state.researchState.currentResearch.pointsEarned /
                this.state.researchState.currentResearch.pointsRequired) *
                100
            ),
          }
        : null,
      researchQueue: [...this.state.researchState.researchQueue],
      fundingLevel: this.state.researchState.fundingLevel,
      availableResearch: available.map((r) => r.id),
    };
  }

  public saveCurrentGame(): void {
    this.systems.saveCurrentGame();
  }

  public hasSavedGame(): boolean {
    return this.systems.hasSavedGame();
  }
}
