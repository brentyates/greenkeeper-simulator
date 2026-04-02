import { BabylonEngine, gridTo3D, HEIGHT_UNIT } from "./engine/BabylonEngine";
import { GameAPI, GameSystems } from "./GameAPI";
import { SimulationSystems, runSimulationTick } from "./SimulationTick";
import {
  GameState,
  getRuntimeRefillStationsFromState,
  resolveServiceHubAnchorFromState,
} from "./GameState";

import { InputManager, Direction, EquipmentSlot } from "./engine/InputManager";
import { TerrainMeshSystem } from "./systems/TerrainMeshSystem";
import { TerrainSystem } from "./systems/TerrainSystemInterface";
import { OverlayMode, getTerrainType, getTerrainDisplayName } from "../core/terrain";
import { EquipmentManager } from "./systems/EquipmentManager";
import { EmployeeVisualSystem } from "./systems/EmployeeVisualSystem";
import { CourseScenerySystem } from "./systems/CourseScenerySystem";
import { GolferVisualSystem } from "./systems/GolferVisualSystem";
import { RobotVisualSystem } from "./systems/RobotVisualSystem";
import { IrrigationRenderSystem } from "./systems/IrrigationRenderSystem";
import { ActivityIndicatorSystem } from "./systems/ActivityIndicatorSystem";
import { WeatherVisualSystem } from "./systems/WeatherVisualSystem";
import { EntityVisualState } from "./systems/EntityVisualSystem";
import {
  clearAssetCache,
  loadAsset,
  createInstance,
  disposeInstance,
  AssetInstance,
  AssetId,
} from "./assets/AssetLoader";
import { UIManager, type GroundInteractionMode } from "./ui/UIManager";
import { DaySummaryData } from "./ui/DaySummaryPopup";
import { findRegionAtPosition } from "../core/named-region";
import { computeRegionStats } from "../core/standing-orders";
import { getJobForRegion, isRegionLocked, createJob, getPatternForTask } from "../core/job";
import { generateWaypoints } from "../core/movement-patterns";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/core/Culling/ray";

import { PlayerController } from "./PlayerController";
import { UIPanelCoordinator } from "./UIPanelCoordinator";
import { TerrainEditorController } from "./TerrainEditorController";
import { AssetPlacementSystem } from "./systems/AssetPlacementSystem";
import {
  HoleBuilderToolbar,
  HOLE_BUILDER_TOOLBAR_BOUNDS,
  HoleBuilderTool,
} from "./ui/HoleBuilderToolbar";
import { AssetBrowserUI, ASSET_BROWSER_BOUNDS } from "./ui/AssetBrowserUI";

import { PlacedAsset } from "../data/customCourseData";

import {
  addExpense,
} from "../core/economy";
import {
  createInitialApplicationState,
  type Employee,
} from "../core/employees";
import {
  syncWorkersWithRoster,
  createDefaultCourseAreas,
  sampleCourseAreaConditions,
  getWorkerPositions,
  type EmployeeTask,
} from "../core/employee-work";
import { initWasmPathfinding } from "../core/navigation-backend";
import {
  getActiveGolferCount,
  getAverageSatisfaction,
  type Golfer,
} from "../core/golfers";
import {
  getBestFertilizerEffectiveness,
  RESEARCH_ITEMS,
} from "../core/research";
import {
  takeDailySnapshot,
  updateHistoricalExcellence,
} from "../core/prestige";
import {
  createSaveState,
  saveGame,
  loadGame,
  hasSave,
  deserializeFaceStates,
} from "../core/save-game";
import {
  createInitialWeatherState,
  getSeasonFromDay,
} from "../core/weather";
import {
  buildHoleDefinitionsFromAssets,
  calculateCoursePar,
  estimateParForHole,
  syncHoleFeatureAssignments,
} from "../core/hole-construction";
import { getAssetDisplayName } from "./assets/AssetManifest";

type InspectWorkerPosition = {
  employeeId: string;
  worldX: number;
  worldZ: number;
  gridX: number;
  gridY: number;
  task: EmployeeTask;
  isMoving: boolean;
};

type InspectableTarget =
  | { kind: 'robot'; robot: import("../core/autonomous-equipment").RobotUnit }
  | { kind: 'employee'; employee: Employee; position: InspectWorkerPosition }
  | { kind: 'golfer'; golfer: Golfer; worldX: number; worldZ: number }
  | { kind: 'asset'; asset: PlacedAsset; canDelete: boolean };

export interface GameOptions {
  scenario?: import("../data/scenarioData").ScenarioDefinition;
  loadFromSave?: boolean;
  onReturnToMenu?: () => void;
  onScenarioComplete?: (score: number) => void;
}

function getAssetLabel(assetId: string): string {
  try {
    return getAssetDisplayName(assetId as any);
  } catch {
    return assetId;
  }
}

export class BabylonMain {
  public state: GameState;

  private babylonEngine: BabylonEngine;
  private inputManager: InputManager;
  private terrainSystem: TerrainSystem;
  private terrainMeshSystem: TerrainMeshSystem;
  private equipmentManager: EquipmentManager;
  private uiManager: UIManager;
  private lastTime: number = 0;

  private playerController!: PlayerController;
  private uiPanelCoordinator!: UIPanelCoordinator;
  private terrainEditorController!: TerrainEditorController;

  private obstacleMeshes: Mesh[] = [];
  private treeInstances: AssetInstance[] = [];
  private refillStationInstances: AssetInstance[] = [];

  private holePlacementSystem: AssetPlacementSystem;
  private holeBuilderUITexture: AdvancedDynamicTexture | null = null;
  private holeBuilderToolbar: HoleBuilderToolbar | null = null;
  private holeBuilderTool: HoleBuilderTool | null = null;
  private holeBuilderDraggingSelection: boolean = false;
  private scenarioAssetPlacementSystem: AssetPlacementSystem;
  private assetBuilderUITexture: AdvancedDynamicTexture | null = null;
  private assetBrowserUI: AssetBrowserUI | null = null;
  private assetBuilderDraggingSelection: boolean = false;
  private holeDistanceLines: Mesh[] = [];
  private holeGuideMeshes: Mesh[] = [];
  private holeDistanceLabelAnchors: Mesh[] = [];
  private holeDistanceLabels: TextBlock[] = [];

  private employeeVisualSystem: EmployeeVisualSystem | null = null;
  private golferVisualSystem: GolferVisualSystem | null = null;
  private robotVisualSystem: RobotVisualSystem | null = null;
  private irrigationRenderSystem: IrrigationRenderSystem | null = null;
  private activityIndicatorSystem: ActivityIndicatorSystem | null = null;
  private weatherVisualSystem: WeatherVisualSystem | null = null;
  private courseScenerySystem: CourseScenerySystem | null = null;
  private groundInteractionMode: GroundInteractionMode = "view";
  private cameraDragAnchor: { x: number; y: number } | null = null;
  private scenarioOutcomeResolved: boolean = false;

  private deleteScenarioAsset(asset: PlacedAsset): void {
    this.scenarioAssetPlacementSystem.selectAt(asset.x, asset.z);
    const selected = this.scenarioAssetPlacementSystem.getSelectedAsset();
    if (!selected) {
      this.uiManager.showNotification("Asset no longer exists");
      return;
    }
    this.scenarioAssetPlacementSystem.deleteSelected();
    this.syncScenarioPlacedAssets();
    this.uiManager.showNotification(`Deleted ${getAssetLabel(asset.assetId)}`);
  }

  private applyScenarioTerrainState(): void {
    const conditions = this.state.currentScenario?.conditions;
    if (!conditions || conditions.startingHealth === undefined) {
      return;
    }

    const startingHealth = Math.max(5, Math.min(100, conditions.startingHealth));
    const moisture = Math.max(20, Math.min(85, startingHealth + 5));
    const nutrients = Math.max(20, Math.min(85, startingHealth + 2));
    const grassHeight = Math.max(18, Math.min(78, 92 - startingHealth * 0.7));

    this.terrainSystem.setAllFaceStates({
      health: startingHealth,
      moisture,
      nutrients,
      grassHeight,
    });
  }

  constructor(canvasId: string, options: GameOptions = {}) {
    this.state = GameState.createGameState(options);

    initWasmPathfinding().then(ok => { this.state.useWasmPathfinding = ok; });

    const course = this.state.currentCourse;

    const startX = Math.floor(course.width / 2);
    const startY = Math.floor(course.height * 0.75);
    this.babylonEngine = new BabylonEngine(
      canvasId,
      course.width,
      course.height
    );
    this.inputManager = new InputManager(this.babylonEngine.getScene());

    this.terrainMeshSystem = new TerrainMeshSystem(this.babylonEngine.getScene(), course);
    this.terrainSystem = this.terrainMeshSystem;
    this.applyScenarioTerrainState();

    this.equipmentManager = new EquipmentManager(this.babylonEngine.getScene());
    this.employeeVisualSystem = new EmployeeVisualSystem(
      this.babylonEngine.getScene(),
      { getElevationAt: (x, y, d) => this.terrainSystem.getElevationAt(x, y, d) }
    );
    this.golferVisualSystem = new GolferVisualSystem(
      this.babylonEngine.getScene(),
      { getElevationAt: (x, y, d) => this.terrainSystem.getElevationAt(x, y, d) },
      course.width,
      course.height,
      course
    );
    this.robotVisualSystem = new RobotVisualSystem(
      this.babylonEngine.getScene(),
      { getElevationAt: (x, y, d) => this.terrainSystem.getElevationAt(x, y, d) }
    );
    this.uiManager = new UIManager(this.babylonEngine.getScene());
    this.irrigationRenderSystem = new IrrigationRenderSystem(
      this.babylonEngine.getScene(),
      { getElevationAt: (x, y, d) => this.terrainSystem.getElevationAt(x, y, d) }
    );
    this.activityIndicatorSystem = new ActivityIndicatorSystem(
      this.babylonEngine.getScene(),
      { getElevationAt: (x, y, d) => this.terrainSystem.getElevationAt(x, y, d) }
    );
    this.weatherVisualSystem = new WeatherVisualSystem(this.babylonEngine.getScene());

    this.playerController = new PlayerController(
      this.babylonEngine.getScene(),
      {
        getElevationAt: (x, y, d) => this.terrainSystem.getElevationAt(x, y, d),
        getCourseStats: () => this.terrainSystem.getCourseStats(),
        getWorldDimensions: () => this.terrainSystem.getWorldDimensions(),
        getTerrainTypeAt: (wx, wz) => this.terrainSystem.getTerrainTypeAt(wx, wz),
        isPositionWalkable: (wx, wz) => this.terrainSystem.isPositionWalkable(wx, wz),
        getTerrainSpeedAt: (wx, wz) => this.terrainSystem.getTerrainSpeedAt(wx, wz),
        findFaceAtPosition: (wx, wz) => this.terrainSystem.findFaceAtPosition(wx, wz),
        mowAt: (wx, wz) => this.terrainSystem.mowAt(wx, wz),
        waterArea: (cx, cy, r, a) => this.terrainSystem.waterArea(cx, cy, r, a),
        fertilizeArea: (cx, cy, r, a, e) => this.terrainSystem.fertilizeArea(cx, cy, r, a, e),
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
      getTerrainMeshSystem: () => this.terrainMeshSystem,
      getCourseWidth: () => this.state.currentCourse.width,
      getCourseHeight: () => this.state.currentCourse.height,
      getPlayerVisual: () => null,
      getPlayerWorldPosition: () => ({ worldX: 0, worldZ: 0 }),
      setPlayerVisualEnabled: () => {},
      setEmployeeVisualSystemVisible: (visible) => {
        this.employeeVisualSystem?.setVisible(visible);
        this.robotVisualSystem?.setVisible(visible);
      },
      snapEmployeesToTerrain: () => this.employeeVisualSystem?.snapAllToTerrain(),
      snapEntityToTerrain: (visual, worldX, worldZ) => this.snapEntityToTerrain(visual, worldX, worldZ),
      snapAssetsToTerrain: () => this.snapAssetsToTerrain(),
      openHoleBuilder: () => this.handleHoleBuilderPanel(),
      openAssetBuilder: () => this.handleAssetBuilderPanel(),
    });

    this.uiPanelCoordinator = new UIPanelCoordinator(
      this.babylonEngine.getScene(),
      this.state,
      {
        uiManager: this.uiManager,
        irrigationRenderSystem: this.irrigationRenderSystem,
        resetDailyStats: () => this.resetDailyStats(),
        onTerrainEditor: () => this.setTerrainEditor(true),
        onHoleBuilder: () => this.handleHoleBuilderPanel(),
        onAssetBuilder: () => this.handleAssetBuilderPanel(),
        onDeleteScenarioAsset: (asset) => this.deleteScenarioAsset(asset),
      }
    );
    this.uiManager.setGroundModeCallback((mode) => {
      this.setGroundInteractionMode(mode);
    });
    this.uiManager.setCameraCallbacks(
      (delta) => this.babylonEngine.rotateCamera(delta),
      (delta) => this.babylonEngine.tiltCamera(delta),
      () => this.babylonEngine.resetCameraView(),
      (headingDegrees) => this.babylonEngine.setCameraHeadingDegrees(headingDegrees),
      (tiltDegrees) => this.babylonEngine.setCameraTiltDegrees(tiltDegrees),
    );
    this.uiManager.updateCameraInfo(
      this.babylonEngine.getCameraHeadingDegrees(),
      this.babylonEngine.getCameraTiltDegrees(),
    );
    this.uiManager.setMinimapNavigateCallback((worldX, worldZ) => {
      if (this.state.isPaused || this.terrainEditorController.isEnabled()) {
        return;
      }
      this.centerCameraOn(worldX, worldZ);
    });
    this.uiManager.setManagementCallbacks(
      () => this.uiPanelCoordinator.handleEmployeePanel(),
      () => this.uiPanelCoordinator.handleResearchPanel(),
      () => this.uiPanelCoordinator.handleTeeSheetPanel(),
      () => this.setTerrainEditor(true),
      () => this.handleHoleBuilderPanel(),
      () => this.handleAssetBuilderPanel(),
      () => this.uiPanelCoordinator.handleEquipmentStore(),
      () => this.uiPanelCoordinator.handleAmenityPanel(),
      () => this.uiPanelCoordinator.handleCourseLayoutPanel(),
    );
    this.uiManager.setGroundMode("view");
    this.refreshBuildModeHUD();

    this.uiPanelCoordinator.setOnRegionTaskAssigned((region, taskType) => {
      this.queueRegionTask(region, taskType);
    });

    this.holePlacementSystem = new AssetPlacementSystem(
      this.babylonEngine.getScene(),
      {
        onSelect: (asset) => {
          this.holeBuilderToolbar?.setSelectedAsset(asset);
          const holeNumber = asset?.gameplay?.holeFeature?.holeNumber;
          if (holeNumber !== undefined) {
            this.holePlacementSystem.setActiveHoleNumber(holeNumber);
            this.holeBuilderToolbar?.setActiveHoleNumber(holeNumber);
            this.updateHoleBuilderGuidance();
            this.renderHoleDistanceIndicators();
          }
        },
        onPlace: () => this.syncHoleBuilderToCourse(),
        getTerrainElevation: (worldX, worldZ) =>
          this.terrainSystem.getElevationAt(worldX, worldZ, 0) * HEIGHT_UNIT,
      }
    );
    this.scenarioAssetPlacementSystem = new AssetPlacementSystem(
      this.babylonEngine.getScene(),
      {
        onSelect: (asset) => {
          if (!asset) {
            this.assetBrowserUI?.clearSelectionContext();
            return;
          }
          this.assetBrowserUI?.setSelectionContext(
            getAssetLabel(asset.assetId),
            'Drag to reposition this prop, Rotate to adjust its facing, or Delete to clear the spot.'
          );
        },
        onPlace: () => this.syncScenarioPlacedAssets(),
        getTerrainElevation: (worldX, worldZ) =>
          this.terrainSystem.getElevationAt(worldX, worldZ, 0) * HEIGHT_UNIT,
      }
    );
    this.setupHoleBuilderUI();
    this.setupAssetBuilderUI();
    this.loadHoleBuilderAssets(this.getInitialHoleBuilderAssets());
    this.loadScenarioPlacedAssets(this.getInitialScenarioPlacedAssets());

    this.setupInputCallbacks();
    this.buildScene();
    this.terrainEditorController.setup();
    this.uiPanelCoordinator.setupAll();
    this.setupUpdateLoop();

    if (options.loadFromSave && this.loadSavedGame()) {
      this.uiManager.showNotification(`Loaded Day ${this.state.gameDay}`);
      this.playerController.updatePlayerPosition();
    }

    if (this.state.currentScenario) {
      this.uiManager.updateObjective(this.getObjectiveText());
    }
  }

  private getObjectiveText(): string {
    if (!this.state.currentScenario) return "";
    const obj = this.state.currentScenario.objective;
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
    this.state.dailyStats = {
      revenue: { greenFees: 0, tips: 0, addOns: 0, other: 0 },
      expenses: { wages: 0, supplies: 0, research: 0, utilities: 0, other: 0 },
      golfersServed: 0,
      totalSatisfaction: 0,
      courseHealthStart: courseStats.health,
      prestigeStart: this.state.prestigeState.currentScore,
      maintenance: {
        tasksCompleted: 0,
        tilesMowed: 0,
        tilesWatered: 0,
        tilesFertilized: 0,
      },
    };
  }

  private setupHoleBuilderUI(): void {
    this.holeBuilderUITexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "HoleBuilderUI",
      true,
      this.babylonEngine.getScene()
    );

    this.holeBuilderToolbar = new HoleBuilderToolbar(this.holeBuilderUITexture, {
      onToolSelect: (tool) => this.setHoleBuilderTool(tool),
      onHoleNumberChange: (holeNumber) => {
        this.holePlacementSystem.setActiveHoleNumber(holeNumber);
        this.updateHoleBuilderGuidance();
        this.renderHoleDistanceIndicators();
        this.focusCameraOnActiveHole();
      },
      onOpenTerrainEditor: () => this.setTerrainEditor(true),
      onOpenAssetBuilder: () => this.handleAssetBuilderPanel(),
      onRotateSelected: () => {
        const selected = this.holePlacementSystem.getSelectedAsset();
        if (selected?.gameplay?.holeFeature?.kind === "pin_position") {
          this.uiManager.showNotification("Pins do not rotate");
          return;
        }
        this.holePlacementSystem.rotateSelected();
        this.syncHoleBuilderToCourse();
      },
      onClearSelection: () => {
        this.holePlacementSystem.clearSelection();
      },
      onClose: () => this.hideHoleBuilderPanel(),
    });
  }

  private setupAssetBuilderUI(): void {
    this.assetBuilderUITexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "ScenarioAssetBuilderUI",
      true,
      this.babylonEngine.getScene()
    );

    this.assetBrowserUI = new AssetBrowserUI(this.assetBuilderUITexture, {
      onSelectAsset: (assetId) => {
        this.scenarioAssetPlacementSystem.setPlaceMode(assetId);
        this.assetBrowserUI?.setSelectionContext(
          getAssetLabel(assetId),
          'Placement mode is active. Click the course to place this asset, or Cancel to go back to selecting existing props.'
        );
      },
      onOpenTerrainEditor: () => this.setTerrainEditor(true),
      onOpenHoleBuilder: () => this.handleHoleBuilderPanel(),
      onRotate: () => {
        this.scenarioAssetPlacementSystem.rotateSelected();
        this.syncScenarioPlacedAssets();
      },
      onDelete: () => {
        this.scenarioAssetPlacementSystem.deleteSelected();
        this.syncScenarioPlacedAssets();
        this.assetBrowserUI?.clearSelectionContext();
      },
      onExitPlaceMode: () => {
        this.scenarioAssetPlacementSystem.exitPlaceMode();
        this.scenarioAssetPlacementSystem.clearSelection();
        this.assetBrowserUI?.clearSelectionContext();
      },
    }, this.babylonEngine.getScene());
  }

  private getInitialHoleBuilderAssets(): PlacedAsset[] {
    if (this.state.holeBuilderAssets.length > 0) {
      return this.state.holeBuilderAssets.map((asset) => ({ ...asset }));
    }

    const holes = this.state.currentCourse.holes ?? [];
    if (holes.length === 0) {
      return [];
    }

    const assets: PlacedAsset[] = [];
    for (const hole of holes) {
      for (const tee of hole.teeBoxes) {
        assets.push({
          assetId: tee.assetId,
          x: tee.x,
          y: tee.y,
          z: tee.z,
          rotation: tee.rotation,
          gameplay: {
            holeFeature: {
              kind: "tee_box",
              holeNumber: hole.holeNumber,
              teeSet: tee.teeSet,
            },
          },
        });
      }
      for (const pin of hole.pinPositions) {
        assets.push({
          assetId: pin.assetId,
          x: pin.x,
          y: pin.y,
          z: pin.z,
          rotation: pin.rotation,
          gameplay: {
            holeFeature: {
              kind: "pin_position",
              holeNumber: hole.holeNumber,
            },
          },
        });
      }
    }

    return assets;
  }

  private getInitialScenarioPlacedAssets(): PlacedAsset[] {
    return this.state.scenarioPlacedAssets.map((asset) => ({ ...asset }));
  }

  private loadHoleBuilderAssets(assets: PlacedAsset[]): void {
    const normalized = syncHoleFeatureAssignments(assets);
    this.state.holeBuilderAssets = normalized;

    void this.holePlacementSystem
      .loadPlacedAssets(normalized)
      .then(() => {
        const activeHole = this.holePlacementSystem.getActiveHoleNumber();
        this.holeBuilderToolbar?.setActiveHoleNumber(activeHole);
        this.syncHoleBuilderToCourse();
        this.focusCameraOnActiveHole();
      })
      .catch(() => {

      });
  }

  private loadScenarioPlacedAssets(assets: PlacedAsset[]): void {
    this.state.scenarioPlacedAssets = assets.map((asset) => ({ ...asset }));

    void this.scenarioAssetPlacementSystem
      .loadPlacedAssets(this.state.scenarioPlacedAssets)
      .catch(() => {

      });
  }

  private syncHoleBuilderToCourse(): void {
    const placedAssets = this.holePlacementSystem.getPlacedAssets();
    const normalized = syncHoleFeatureAssignments(placedAssets);
    this.state.holeBuilderAssets = normalized;

    const holes = buildHoleDefinitionsFromAssets(normalized);
    this.state.currentCourse.holes = holes;
    this.holeBuilderToolbar?.setHoleCatalog(holes.map((hole) => hole.holeNumber));

    const calculatedPar = calculateCoursePar(holes);
    if (calculatedPar > 0) {
      this.state.currentCourse.par = calculatedPar;
    }

    this.uiPanelCoordinator.refreshCourseLayoutPanel();
    this.updateHoleBuilderGuidance();
    this.renderHoleDistanceIndicators();
  }

  private syncScenarioPlacedAssets(): void {
    this.state.scenarioPlacedAssets = this.scenarioAssetPlacementSystem.getPlacedAssets();
  }

  public refreshBuildModeHUD(): void {
    if (this.terrainEditorController.isEnabled()) {
      this.uiManager.setBuildMode('terrain');
      return;
    }
    if (this.holeBuilderToolbar?.isVisible()) {
      this.uiManager.setBuildMode('holes');
      return;
    }
    if (this.assetBrowserUI?.isVisible()) {
      this.uiManager.setBuildMode('assets');
      return;
    }
    this.uiManager.setBuildMode(null);
  }

  private updateHoleBuilderGuidance(): void {
    if (!this.holeBuilderToolbar) return;

    const activeHoleNumber = this.holePlacementSystem.getActiveHoleNumber();
    const holes = this.state.currentCourse.holes ?? [];
    const activeHole = holes.find((hole) => hole.holeNumber === activeHoleNumber);
    const totalDefinedHoles = holes.length;

    if (!activeHole) {
      this.holeBuilderToolbar.updateHoleMetrics(
        `Hole ${activeHoleNumber}: add tees and a pin to create the next hole or refill an empty slot. Defined holes: ${totalDefinedHoles}.`
      );
      return;
    }

    const par = estimateParForHole(activeHole);
    const yardages = activeHole.teeBoxes
      .map((tee) => Math.round(tee.yardageToPrimaryPin))
      .filter((yards) => yards > 0);

    let yardageText = "No tee-to-pin yardage yet";
    if (yardages.length > 0) {
      const minYards = Math.min(...yardages);
      const maxYards = Math.max(...yardages);
      yardageText =
        minYards === maxYards
          ? `${minYards} yds`
          : `${minYards}-${maxYards} yds`;
    }

    const statusText =
      activeHole.validationIssues.length === 0
        ? "Playable"
        : activeHole.validationIssues.join("; ");

    this.holeBuilderToolbar.updateHoleMetrics(
      `Hole ${activeHoleNumber}: Par ${par} | ${yardageText}\n` +
      `Tees: ${activeHole.teeBoxes.length} | Pins: ${activeHole.pinPositions.length} | ${statusText}`
    );
  }

  private getTeeDistanceLineColor(assetId: string): Color3 {
    if (assetId === "course.tee.marker.blue") return new Color3(0.31, 0.59, 0.97);
    if (assetId === "course.tee.marker.white") return new Color3(0.85, 0.89, 0.95);
    if (assetId === "course.tee.marker.red") return new Color3(0.91, 0.39, 0.39);
    if (assetId === "course.tee.marker.gold") return new Color3(0.86, 0.72, 0.34);
    return new Color3(0.64, 0.86, 0.64);
  }

  private getActiveHoleViewData(): {
    holeNumber: number;
    centerX: number;
    centerZ: number;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  } | null {
    const activeHoleNumber = this.holePlacementSystem.getActiveHoleNumber();
    const activeHole = (this.state.currentCourse.holes ?? []).find(
      (hole) => hole.holeNumber === activeHoleNumber
    );

    const points: Array<{ x: number; z: number }> = [];
    if (activeHole) {
      for (const tee of activeHole.teeBoxes) points.push({ x: tee.x, z: tee.z });
      for (const pin of activeHole.pinPositions) points.push({ x: pin.x, z: pin.z });
    }

    if (points.length === 0) {
      for (const asset of this.state.holeBuilderAssets) {
        if (asset.gameplay?.holeFeature?.holeNumber === activeHoleNumber) {
          points.push({ x: asset.x, z: asset.z });
        }
      }
    }

    if (points.length === 0) return null;

    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minZ = Math.min(...points.map((point) => point.z));
    const maxZ = Math.max(...points.map((point) => point.z));
    const centerX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
    const centerZ = points.reduce((sum, point) => sum + point.z, 0) / points.length;

    return {
      holeNumber: activeHoleNumber,
      centerX,
      centerZ,
      minX,
      maxX,
      minZ,
      maxZ,
    };
  }

  private focusCameraOnActiveHole(): void {
    if (!this.holeBuilderToolbar?.isVisible()) return;
    const holeView = this.getActiveHoleViewData();
    if (!holeView) return;
    this.centerCameraOn(holeView.centerX, holeView.centerZ);
  }

  private clearHoleGuideMeshes(): void {
    for (const mesh of this.holeGuideMeshes) {
      mesh.dispose();
    }
    this.holeGuideMeshes = [];
  }

  private createHoleMarkerRing(
    name: string,
    worldX: number,
    worldZ: number,
    radius: number,
    color: Color3
  ): void {
    const segments = 28;
    const elevation = this.terrainSystem.getElevationAt(worldX, worldZ, 0) + 0.2;
    const points: Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      points.push(new Vector3(
        worldX + Math.cos(t) * radius,
        elevation,
        worldZ + Math.sin(t) * radius
      ));
    }
    const ring = MeshBuilder.CreateLines(name, { points }, this.babylonEngine.getScene());
    ring.color = color;
    ring.isPickable = false;
    this.holeGuideMeshes.push(ring);
  }

  private renderActiveHoleBoundary(holeView: {
    holeNumber: number;
    centerX: number;
    centerZ: number;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  }): void {
    const padX = Math.max(4, (holeView.maxX - holeView.minX) * 0.22);
    const padZ = Math.max(4, (holeView.maxZ - holeView.minZ) * 0.22);
    const minX = Math.max(0.5, holeView.minX - padX);
    const maxX = Math.min(this.state.currentCourse.width - 0.5, holeView.maxX + padX);
    const minZ = Math.max(0.5, holeView.minZ - padZ);
    const maxZ = Math.min(this.state.currentCourse.height - 0.5, holeView.maxZ + padZ);
    const corners = [
      { x: minX, z: minZ },
      { x: maxX, z: minZ },
      { x: maxX, z: maxZ },
      { x: minX, z: maxZ },
      { x: minX, z: minZ },
    ];
    const points = corners.map(({ x, z }) => {
      const elevation = this.terrainSystem.getElevationAt(x, z, 0) + 0.18;
      return new Vector3(x, elevation, z);
    });
    const boundary = MeshBuilder.CreateLines(
      `holeBoundary_${holeView.holeNumber}`,
      { points },
      this.babylonEngine.getScene()
    );
    boundary.color = new Color3(0.96, 0.88, 0.36);
    boundary.isPickable = false;
    this.holeGuideMeshes.push(boundary);
  }

  private clearHoleDistanceIndicators(): void {
    this.clearHoleGuideMeshes();
    for (const mesh of this.holeDistanceLines) {
      mesh.dispose();
    }
    this.holeDistanceLines = [];

    for (const anchor of this.holeDistanceLabelAnchors) {
      anchor.dispose();
    }
    this.holeDistanceLabelAnchors = [];

    for (const label of this.holeDistanceLabels) {
      this.holeBuilderUITexture?.removeControl(label);
      label.dispose();
    }
    this.holeDistanceLabels = [];
  }

  private renderHoleDistanceIndicators(): void {
    this.clearHoleDistanceIndicators();
    if (!this.holeBuilderToolbar?.isVisible()) return;

    const holeView = this.getActiveHoleViewData();
    if (!holeView) {
      return;
    }

    const activeHoleNumber = holeView.holeNumber;
    const activeHole = (this.state.currentCourse.holes ?? []).find(
      (hole) => hole.holeNumber === activeHoleNumber
    );
    if (!activeHole || activeHole.teeBoxes.length === 0 || activeHole.pinPositions.length === 0) {
      this.renderActiveHoleBoundary(holeView);
      return;
    }

    this.renderActiveHoleBoundary(holeView);
    const primaryPin = activeHole.pinPositions.find((pin) => pin.isPrimary) ?? activeHole.pinPositions[0];
    const pinPoint = new Vector3(primaryPin.x, primaryPin.y + 0.2, primaryPin.z);
    this.createHoleMarkerRing(`holePinRing_${activeHoleNumber}`, primaryPin.x, primaryPin.z, 1.1, new Color3(0.98, 0.85, 0.32));

    for (let i = 0; i < activeHole.teeBoxes.length; i++) {
      const tee = activeHole.teeBoxes[i];
      const teePoint = new Vector3(tee.x, tee.y + 0.2, tee.z);
      const line = MeshBuilder.CreateLines(
        `holeDistanceLine_${activeHoleNumber}_${i}`,
        {
          points: [teePoint, pinPoint],
          updatable: false,
        },
        this.babylonEngine.getScene()
      );
      line.color = this.getTeeDistanceLineColor(tee.assetId);
      line.isPickable = false;
      this.holeDistanceLines.push(line);
      this.createHoleMarkerRing(
        `holeTeeRing_${activeHoleNumber}_${i}`,
        tee.x,
        tee.z,
        0.85,
        this.getTeeDistanceLineColor(tee.assetId)
      );

      const midpoint = teePoint.add(pinPoint).scale(0.5);
      midpoint.y += 0.12;

      const labelAnchor = MeshBuilder.CreateSphere(
        `holeDistanceLabelAnchor_${activeHoleNumber}_${i}`,
        { diameter: 0.08 },
        this.babylonEngine.getScene()
      );
      labelAnchor.position.copyFrom(midpoint);
      labelAnchor.isPickable = false;
      labelAnchor.isVisible = false;
      this.holeDistanceLabelAnchors.push(labelAnchor);

      if (this.holeBuilderUITexture) {
        const label = new TextBlock(
          `holeDistanceLabel_${activeHoleNumber}_${i}`,
          `${Math.round(tee.yardageToPrimaryPin)} yds`
        );
        label.fontSize = 16;
        label.fontWeight = "700";
        label.color = line.color.toHexString();
        label.outlineColor = "#102015";
        label.outlineWidth = 4;
        label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        label.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        label.linkOffsetY = -4;
        this.holeBuilderUITexture.addControl(label);
        // Babylon GUI requires linked controls to already be attached to the root texture.
        label.linkWithMesh(labelAnchor);
        this.holeDistanceLabels.push(label);
      }
    }
  }

  private getHoleBuilderAssetId(tool: HoleBuilderTool): string | null {
    switch (tool) {
      case "tee_blue":
        return "course.tee.marker.blue";
      case "tee_white":
        return "course.tee.marker.white";
      case "tee_red":
        return "course.tee.marker.red";
      case "tee_gold":
        return "course.tee.marker.gold";
      case "pin":
        return "course.flag";
      case "delete":
        return null;
      default:
        return null;
    }
  }

  private setHoleBuilderTool(tool: HoleBuilderTool | null): void {
    this.holeBuilderTool = tool;
    if (tool === null || tool === "delete") {
      this.holePlacementSystem.exitPlaceMode();
      if (tool === null) {
        if (this.holeBuilderToolbar?.isVisible()) {
          this.uiManager.showNotification("Hole builder tool cleared");
        }
      } else {
        this.uiManager.showNotification("Hole builder: Delete marker");
      }
      return;
    }

    const assetId = this.getHoleBuilderAssetId(tool);
    if (!assetId) return;
    this.holePlacementSystem.setPlaceMode(assetId);
    const holeNumber = this.holePlacementSystem.getActiveHoleNumber();
    const label = tool === "pin" ? "pin" : "tee marker";
    this.uiManager.showNotification(`Hole builder: place ${label} on Hole ${holeNumber}`);
  }

  private handleAssetBuilderPanel(): void {
    if (this.assetBrowserUI?.isVisible()) {
      this.hideAssetBuilderPanel();
      return;
    }

    if (this.state.isPaused) {
      this.resumeGame();
    }

    if (this.terrainEditorController.isEnabled()) {
      this.setTerrainEditor(false);
    }
    if (this.holeBuilderToolbar?.isVisible()) {
      this.hideHoleBuilderPanel();
    }
    if (this.uiPanelCoordinator.isIrrigationToolbarVisible()) {
      this.uiPanelCoordinator.hideIrrigationPanels();
    }

    this.uiManager.setGroundMode("view");
    this.uiPanelCoordinator.hideRegionInfo();
    this.uiPanelCoordinator.hideEntityInspector();
    this.assetBrowserUI?.show();
    this.assetBrowserUI?.clearSelectionContext();
    this.refreshBuildModeHUD();
  }

  private hideAssetBuilderPanel(): void {
    if (!this.assetBrowserUI?.isVisible()) return;
    this.assetBrowserUI.hide();
    this.assetBrowserUI.clearSelectionContext();
    this.scenarioAssetPlacementSystem.exitPlaceMode();
    this.scenarioAssetPlacementSystem.clearSelection();
    this.assetBuilderDraggingSelection = false;
    this.refreshBuildModeHUD();
  }

  private handleAssetBuilderMouseMove(screenX: number, screenY: number): void {
    if (!this.assetBrowserUI?.isVisible()) return;
    if (!this.scenarioAssetPlacementSystem.isInPlaceMode()) return;
    const world = this.babylonEngine.screenToWorldPosition(screenX, screenY);
    if (!world) return;
    this.scenarioAssetPlacementSystem.handleMouseMove(world.x, world.z);
  }

  private handleHoleBuilderPanel(): void {
    if (this.holeBuilderToolbar?.isVisible()) {
      this.hideHoleBuilderPanel();
      return;
    }

    if (this.state.isPaused) {
      this.resumeGame();
    }

    if (this.terrainEditorController.isEnabled()) {
      this.setTerrainEditor(false);
    }

    if (this.uiPanelCoordinator.isIrrigationToolbarVisible()) {
      this.uiPanelCoordinator.hideIrrigationPanels();
    }
    if (this.assetBrowserUI?.isVisible()) {
      this.hideAssetBuilderPanel();
    }

    this.uiManager.setGroundMode("view");
    this.uiPanelCoordinator.hideRegionInfo();
    this.uiPanelCoordinator.hideEntityInspector();
    this.holeBuilderToolbar?.show();
    this.holeBuilderToolbar?.setActiveTool("select");
    this.holeBuilderToolbar?.setActiveHoleNumber(this.holePlacementSystem.getActiveHoleNumber());
    this.updateHoleBuilderGuidance();
    this.renderHoleDistanceIndicators();
    this.focusCameraOnActiveHole();
    this.refreshBuildModeHUD();
  }

  private hideHoleBuilderPanel(): void {
    if (!this.holeBuilderToolbar?.isVisible()) return;
    this.clearHoleDistanceIndicators();
    this.holeBuilderToolbar.hide();
    this.holeBuilderToolbar.clearToolSelection();
    this.holeBuilderToolbar.setSelectedAsset(null);
    this.holePlacementSystem.exitPlaceMode();
    this.holePlacementSystem.clearSelection();
    this.holeBuilderTool = null;
    this.holeBuilderDraggingSelection = false;
    this.refreshBuildModeHUD();
  }

  private handleHoleBuilderMouseMove(screenX: number, screenY: number): void {
    if (!this.holeBuilderToolbar?.isVisible()) return;
    if (!this.holeBuilderTool || this.holeBuilderTool === "delete") return;
    const world = this.babylonEngine.screenToWorldPosition(screenX, screenY);
    if (!world) return;
    this.holePlacementSystem.handleMouseMove(world.x, world.z);
  }

  private handleGameplayMouseMove(screenX: number, screenY: number): void {
    if (this.state.isPaused || this.terrainEditorController.isEnabled()) {
      this.clearInspectHover();
      return;
    }
    if (this.uiPanelCoordinator.isIrrigationToolbarVisible() || this.holeBuilderToolbar?.isVisible() || this.assetBrowserUI?.isVisible()) {
      this.clearInspectHover();
      return;
    }
    if (this.groundInteractionMode !== "inspect") {
      this.clearInspectHover();
      return;
    }


    const resolved = this.resolveRegionContextAtScreenPoint(screenX, screenY);
    if (resolved) {
      this.robotVisualSystem?.setHoveredRobot(null);
      this.terrainMeshSystem.setExternalHoveredFaces(resolved.region.faceIds);
      this.setCanvasCursor("pointer");
      const detail = `${resolved.region.name} • Health ${resolved.stats.avgHealth.toFixed(0)} • Moisture ${resolved.stats.avgMoisture.toFixed(0)} • Nutrients ${resolved.stats.avgNutrients.toFixed(0)}`;
      const hint = resolved.hasActiveJob
        ? "Click to review active work here"
        : "Click to inspect this turf region";
      const tone = resolved.stats.avgHealth < 40 || resolved.stats.avgMoisture < 35 ? "warning" : "info";
      this.uiManager.setInspectHover("Turf target", detail, hint, tone);
      return;
    }

    this.clearInspectHover();
  }

  private resolveInspectableAtScreenPoint(screenX: number, screenY: number): InspectableTarget | null {
    const world = this.babylonEngine.screenToWorldPosition(screenX, screenY);
    if (!world) return null;

    let bestDist = 1.75;
    let bestTarget: InspectableTarget | null = null;

    for (const robot of this.state.autonomousState.robots) {
      const dx = robot.worldX - world.x;
      const dz = robot.worldZ - world.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        bestTarget = { kind: 'robot', robot };
      }
    }

    const workerPositions = getWorkerPositions(this.state.employeeWorkState) as readonly InspectWorkerPosition[];
    for (const position of workerPositions) {
      const employee = this.state.employeeRoster.employees.find((entry) => entry.id === position.employeeId);
      if (!employee) continue;
      const dx = position.worldX - world.x;
      const dz = position.worldZ - world.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        bestTarget = { kind: 'employee', employee, position };
      }
    }

    if (this.golferVisualSystem) {
      for (const gp of this.golferVisualSystem.getGolferPositions()) {
        const golfer = this.state.golferPool.golfers.find((entry) => entry.id === gp.golferId);
        if (!golfer) continue;
        const dx = gp.worldX - world.x;
        const dz = gp.worldZ - world.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < bestDist) {
          bestDist = dist;
          bestTarget = { kind: 'golfer', golfer, worldX: gp.worldX, worldZ: gp.worldZ };
        }
      }
    }

    for (const asset of this.state.scenarioPlacedAssets) {
      const dx = asset.x - world.x;
      const dz = asset.z - world.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        bestTarget = { kind: 'asset', asset, canDelete: true };
      }
    }

    for (const asset of this.courseScenerySystem?.getInspectablePlacements() ?? []) {
      const dx = asset.x - world.x;
      const dz = asset.z - world.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        bestTarget = { kind: 'asset', asset, canDelete: false };
      }
    }

    for (const station of this.getRuntimeRefillStations()) {
      const dx = station.x - world.x;
      const dz = station.y - world.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        bestTarget = {
          kind: 'asset',
          asset: {
            assetId: 'building.maintenance.shed',
            x: station.x,
            y: this.terrainSystem.getElevationAt(station.x, station.y, 0) * HEIGHT_UNIT,
            z: station.y,
            rotation: 0,
          },
          canDelete: false,
        };
      }
    }

    return bestTarget;
  }

  private handleViewModeEntityClick(screenX: number, screenY: number): void {
    const world = this.babylonEngine.screenToWorldPosition(screenX, screenY);
    if (!world) return;

    const pickRadius = 5.0;
    let bestDist = pickRadius;
    let bestInfo: string | null = null;

    for (const robot of this.state.autonomousState.robots) {
      const dx = robot.worldX - world.x;
      const dz = robot.worldZ - world.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        const batteryPct = Math.round((robot.resourceCurrent / Math.max(1, robot.resourceMax)) * 100);
        bestInfo = `${robot.type.replace(/_/g, " ")} - ${robot.state} | Battery ${batteryPct}%`;
      }
    }

    const workerPositions = getWorkerPositions(this.state.employeeWorkState);
    for (const wp of workerPositions) {
      const dx = wp.worldX - world.x;
      const dz = wp.worldZ - world.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        const employee = this.state.employeeRoster.employees.find(e => e.id === wp.employeeId);
        const name = employee?.name ?? wp.employeeId;
        const role = employee?.role?.replace(/_/g, " ") ?? "worker";
        const task = wp.task.replace(/_/g, " ");
        const focus = employee?.assignedFocus ?? "balanced";
        bestInfo = `${name} (${role}) - ${task} | Focus: ${focus}`;
      }
    }

    if (this.golferVisualSystem) {
      const golferPositions = this.golferVisualSystem.getGolferPositions();
      for (const gp of golferPositions) {
        const dx = gp.worldX - world.x;
        const dz = gp.worldZ - world.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < bestDist) {
          bestDist = dist;
          const golfer = this.state.golferPool.golfers.find(g => g.id === gp.golferId);
          if (golfer) {
            bestInfo = `${golfer.name} (${golfer.type}) - ${golfer.status} | Holes ${golfer.holesPlayed}/${golfer.totalHoles} | Satisfaction ${Math.round(golfer.satisfaction)}%`;
          }
        }
      }
    }

    for (const asset of this.state.scenarioPlacedAssets) {
      const dx = asset.x - world.x;
      const dz = asset.z - world.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        bestInfo = `${getAssetLabel(asset.assetId)} - placed prop`;
      }
    }

    for (const asset of this.courseScenerySystem?.getInspectablePlacements() ?? []) {
      const dx = asset.x - world.x;
      const dz = asset.z - world.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        bestInfo = `${getAssetLabel(asset.assetId)} - course asset`;
      }
    }

    if (bestInfo) {
      this.uiManager.showNotification(bestInfo, undefined, 4000);
    }
  }

  private clearInspectHover(): void {
    this.setCanvasCursor("default");
    this.terrainMeshSystem.setExternalHoveredFaces([]);
    this.robotVisualSystem?.setHoveredRobot(null);
    this.uiManager.clearInspectHover();
  }

  private setCanvasCursor(cursor: string): void {
    const canvas = this.babylonEngine.getScene().getEngine().getRenderingCanvas();
    if (canvas) {
      canvas.style.cursor = cursor;
    }
  }

  private centerCameraOn(worldX: number, worldZ: number): void {
    const elevation = this.terrainSystem.getElevationAt(worldX, worldZ, 0);
    this.babylonEngine.setCameraTarget(gridTo3D(worldX, worldZ, elevation));
  }

  private handleHoleBuilderClick(screenX: number, screenY: number): boolean {
    if (!this.holeBuilderToolbar?.isVisible()) {
      return false;
    }

    const world = this.babylonEngine.screenToWorldPosition(screenX, screenY);
    if (!world) {
      return true;
    }

    const gridX = Math.floor(world.x);
    const gridY = Math.floor(world.z);
    const course = this.state.currentCourse;
    if (gridX < 0 || gridY < 0 || gridX >= course.width || gridY >= course.height) {
      this.uiManager.showNotification("Hole builder action out of bounds");
      return true;
    }

    if (!this.holeBuilderTool) {
      this.holeBuilderToolbar?.setActiveTool("select");
    }

    if (this.holeBuilderTool === "select") {
      this.holePlacementSystem.selectAt(world.x, world.z);
      const selected = this.holePlacementSystem.getSelectedAsset();
      if (!selected) {
        this.uiManager.showNotification("No hole marker at this location");
      }
      return true;
    }

    if (this.holeBuilderTool === "delete") {
      const before = this.holePlacementSystem.getPlacedAssets().length;
      this.holePlacementSystem.selectAt(world.x, world.z);
      this.holePlacementSystem.deleteSelected();
      const after = this.holePlacementSystem.getPlacedAssets().length;
      if (after < before) {
        this.syncHoleBuilderToCourse();
        this.uiManager.showNotification("Hole marker removed");
      } else {
        this.uiManager.showNotification("No hole marker at this location");
      }
      return true;
    }

    const activeTool = this.holeBuilderTool;
    if (!activeTool) {
      return true;
    }

    const assetId = this.getHoleBuilderAssetId(activeTool);
    if (!assetId) return true;

    this.holePlacementSystem.setActiveHoleNumber(this.holeBuilderToolbar.getActiveHoleNumber());
    if (
      !this.holePlacementSystem.isInPlaceMode() ||
      this.holePlacementSystem.getPlaceModeAssetId() !== assetId
    ) {
      this.holePlacementSystem.setPlaceMode(assetId);
    }

    void this.holePlacementSystem.placeAsset(world.x, world.z).then(() => {
      const holeNumber = this.holePlacementSystem.getActiveHoleNumber();
      if (activeTool === "pin") {
        this.uiManager.showNotification(`Set Hole ${holeNumber} pin position`);
      } else {
        this.uiManager.showNotification(`Updated Hole ${holeNumber} tee marker`);
      }
    });
    return true;
  }

  private handleAssetBuilderClick(screenX: number, screenY: number): boolean {
    if (!this.assetBrowserUI?.isVisible()) {
      return false;
    }

    const world = this.babylonEngine.screenToWorldPosition(screenX, screenY);
    if (!world) {
      return true;
    }

    const gridX = Math.floor(world.x);
    const gridY = Math.floor(world.z);
    const course = this.state.currentCourse;
    if (gridX < 0 || gridY < 0 || gridX >= course.width || gridY >= course.height) {
      this.uiManager.showNotification("Asset placement out of bounds");
      return true;
    }

    if (this.scenarioAssetPlacementSystem.isInPlaceMode()) {
      void this.scenarioAssetPlacementSystem.placeAsset(world.x, world.z).then(() => {
        this.syncScenarioPlacedAssets();
        this.uiManager.showNotification("Placed course asset");
      });
      return true;
    }

    this.scenarioAssetPlacementSystem.selectAt(world.x, world.z);
    if (!this.scenarioAssetPlacementSystem.getSelectedAsset()) {
      this.uiManager.showNotification("No placed asset at this location");
    }
    return true;
  }

  private handleHoleBuilderDragStart(screenX: number, screenY: number): boolean {
    if (!this.holeBuilderToolbar?.isVisible()) return false;
    if (this.holeBuilderTool !== "select") return false;

    const world = this.babylonEngine.screenToWorldPosition(screenX, screenY);
    if (!world) return true;

    this.holePlacementSystem.selectAt(world.x, world.z);
    this.holeBuilderDraggingSelection = this.holePlacementSystem.getSelectedAsset() !== null;
    return this.holeBuilderDraggingSelection;
  }

  private handleHoleBuilderDrag(screenX: number, screenY: number): boolean {
    if (!this.holeBuilderDraggingSelection) return false;

    const world = this.babylonEngine.screenToWorldPosition(screenX, screenY);
    if (!world) return true;

    const course = this.state.currentCourse;
    const clampedX = Math.max(0.5, Math.min(course.width - 0.5, world.x));
    const clampedZ = Math.max(0.5, Math.min(course.height - 0.5, world.z));
    this.holePlacementSystem.moveSelected(clampedX, clampedZ);
    this.syncHoleBuilderToCourse();
    return true;
  }

  private handleHoleBuilderDragEnd(): boolean {
    if (!this.holeBuilderDraggingSelection) return false;
    this.holeBuilderDraggingSelection = false;
    this.syncHoleBuilderToCourse();
    return true;
  }

  private handleAssetBuilderDragStart(screenX: number, screenY: number): boolean {
    if (!this.assetBrowserUI?.isVisible()) return false;
    if (this.scenarioAssetPlacementSystem.isInPlaceMode()) return false;

    const world = this.babylonEngine.screenToWorldPosition(screenX, screenY);
    if (!world) return true;

    this.scenarioAssetPlacementSystem.selectAt(world.x, world.z);
    this.assetBuilderDraggingSelection = this.scenarioAssetPlacementSystem.getSelectedAsset() !== null;
    return this.assetBuilderDraggingSelection;
  }

  private handleAssetBuilderDrag(screenX: number, screenY: number): boolean {
    if (!this.assetBuilderDraggingSelection) return false;

    const world = this.babylonEngine.screenToWorldPosition(screenX, screenY);
    if (!world) return true;

    const course = this.state.currentCourse;
    const clampedX = Math.max(0.5, Math.min(course.width - 0.5, world.x));
    const clampedZ = Math.max(0.5, Math.min(course.height - 0.5, world.z));
    this.scenarioAssetPlacementSystem.moveSelected(clampedX, clampedZ);
    this.syncScenarioPlacedAssets();
    return true;
  }

  private handleAssetBuilderDragEnd(): boolean {
    if (!this.assetBuilderDraggingSelection) return false;
    this.assetBuilderDraggingSelection = false;
    this.syncScenarioPlacedAssets();
    return true;
  }

  private isHoleBuilderUIBlockingPointer(screenX: number, screenY: number): boolean {
    if (!this.holeBuilderToolbar?.isVisible()) return false;
    const canvas = this.babylonEngine.getScene().getEngine().getRenderingCanvas();
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    const x = screenX - rect.left;
    const y = screenY - rect.top;
    return (
      x >= HOLE_BUILDER_TOOLBAR_BOUNDS.left &&
      x <= HOLE_BUILDER_TOOLBAR_BOUNDS.left + HOLE_BUILDER_TOOLBAR_BOUNDS.width &&
      y >= HOLE_BUILDER_TOOLBAR_BOUNDS.top &&
      y <= HOLE_BUILDER_TOOLBAR_BOUNDS.top + HOLE_BUILDER_TOOLBAR_BOUNDS.height
    );
  }

  private isAssetBuilderUIBlockingPointer(screenX: number, screenY: number): boolean {
    if (!this.assetBrowserUI?.isVisible()) return false;
    const canvas = this.babylonEngine.getScene().getEngine().getRenderingCanvas();
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    const x = screenX - rect.left;
    const y = screenY - rect.top;
    const panelLeft = rect.width - (ASSET_BROWSER_BOUNDS.width + ASSET_BROWSER_BOUNDS.right);
    return (
      x >= panelLeft &&
      x <= panelLeft + ASSET_BROWSER_BOUNDS.width &&
      y >= ASSET_BROWSER_BOUNDS.top &&
      y <= ASSET_BROWSER_BOUNDS.top + ASSET_BROWSER_BOUNDS.height
    );
  }

  private showDaySummary(): void {
    const courseStats = this.terrainSystem.getCourseStats();
    const avgSatisfaction =
      this.state.dailyStats.golfersServed > 0
        ? this.state.dailyStats.totalSatisfaction / this.state.dailyStats.golfersServed
        : 0;

    const summaryData: DaySummaryData = {
      day: this.state.gameDay,
      revenue: { ...this.state.dailyStats.revenue },
      expenses: { ...this.state.dailyStats.expenses },
      courseHealth: {
        start: this.state.dailyStats.courseHealthStart,
        end: courseStats.health,
        change: courseStats.health - this.state.dailyStats.courseHealthStart,
      },
      golfers: {
        totalServed: this.state.dailyStats.golfersServed,
        averageSatisfaction: avgSatisfaction,
        tipsEarned: this.state.dailyStats.revenue.tips,
      },
      prestige: {
        score: this.state.prestigeState.currentScore,
        change: this.state.prestigeState.currentScore - this.state.dailyStats.prestigeStart,
      },
      maintenance: { ...this.state.dailyStats.maintenance },
    };

    this.uiPanelCoordinator.showDaySummary(summaryData);
  }

  public saveCurrentGame(): void {
    if (!this.state.currentScenario || !this.state.scenarioManager) return;

    const faceStates = this.terrainSystem.getAllFaceStates();
    const scenarioProgress = this.state.scenarioManager.getProgress();
    const savedState = createSaveState(
      this.state.currentScenario.id,
      this.state.gameTime,
      this.state.gameDay,
      this.playerController.getPlayer().gridX,
      this.playerController.getPlayer().gridY,
      this.state.score,
      this.state.economyState,
      this.state.employeeRoster,
      this.state.employeeWorkState,
      this.state.golferPool,
      this.state.researchState,
      this.state.prestigeState,
      this.state.teeTimeState,
      this.state.revenueState,
      this.state.applicationState,
      scenarioProgress,
      this.state.autonomousState,
      this.state.weatherState,
      faceStates,
      this.state.irrigationSystem,
      this.state.holeBuilderAssets,
      this.state.scenarioPlacedAssets
    );

    if (saveGame(savedState)) {
      this.uiManager.showNotification("Game saved");
    }
  }

  private loadSavedGame(): boolean {
    if (!this.state.currentScenario) return false;

    const saved = loadGame(this.state.currentScenario.id);
    if (!saved) return false;

    this.state.gameTime = saved.gameTime;
    this.state.gameDay = saved.gameDay;
    this.playerController.teleport(saved.playerX, saved.playerY);
    this.state.score = saved.score;
    this.state.economyState = saved.economyState;
    this.state.employeeRoster = saved.employeeRoster;
    const preferredEmployeeWorkState =
      saved.employeeWorkState ?? this.state.employeeWorkState;
    const preferredAutonomousState =
      saved.autonomousState ?? this.state.autonomousState;
    const serviceHubAnchor = resolveServiceHubAnchorFromState({
      currentCourse: this.state.currentCourse,
      employeeWorkState: {
        maintenanceShedX: preferredEmployeeWorkState.maintenanceShedX,
        maintenanceShedY: preferredEmployeeWorkState.maintenanceShedY,
      },
      autonomousState: {
        chargingStationX: preferredAutonomousState.chargingStationX,
        chargingStationY: preferredAutonomousState.chargingStationY,
      },
    });
    if (saved.employeeWorkState) {
      this.state.employeeWorkState = saved.employeeWorkState;
      this.state.employeeWorkState = {
        ...this.state.employeeWorkState,
        areas:
          this.state.employeeWorkState.areas.length > 0
            ? this.state.employeeWorkState.areas
            : [...createDefaultCourseAreas(this.state.currentCourse.width, this.state.currentCourse.height)],
        maintenanceShedX: serviceHubAnchor.x,
        maintenanceShedY: serviceHubAnchor.y,
      };
    } else {
      this.state.employeeWorkState = syncWorkersWithRoster(
        this.state.employeeWorkState,
        this.state.employeeRoster.employees
      );
      this.state.employeeWorkState = {
        ...this.state.employeeWorkState,
        maintenanceShedX: serviceHubAnchor.x,
        maintenanceShedY: serviceHubAnchor.y,
      };
    }
    this.state.golferPool = saved.golferPool;
    this.state.researchState = saved.researchState;
    this.state.prestigeState = saved.prestigeState;
    const teeTimesData = saved.teeTimeState.teeTimes;
    const reconstructedTeeTimes = teeTimesData instanceof Map
      ? teeTimesData
      : new Map(Object.entries(teeTimesData || {}).map(([k, v]) => [Number(k), v as import('../core/tee-times').TeeTime[]]));
    this.state.teeTimeState = {
      ...saved.teeTimeState,
      teeTimes: reconstructedTeeTimes,
    };
    this.state.revenueState = saved.revenueState;
    this.state.applicationState =
      saved.applicationState ||
      createInitialApplicationState(
        this.state.gameTime + this.state.gameDay * 24 * 60,
        this.state.prestigeState.tier
      );

    if (saved.scenarioProgress && this.state.scenarioManager) {
      this.state.scenarioManager.updateProgress(saved.scenarioProgress);
    }

    if (saved.autonomousState) {
      this.state.autonomousState = {
        ...saved.autonomousState,
        chargingStationX: serviceHubAnchor.x,
        chargingStationY: serviceHubAnchor.y,
      };
    } else {
      this.state.autonomousState = {
        ...this.state.autonomousState,
        chargingStationX: serviceHubAnchor.x,
        chargingStationY: serviceHubAnchor.y,
      };
    }

    if (saved.weatherState) {
      this.state.weatherState = saved.weatherState;
      this.state.weather = this.state.weatherState.current;
    }

    if (saved.faceStates && saved.faceStates.length > 0) {
      this.terrainSystem.restoreFaceStates(deserializeFaceStates(saved.faceStates));
    }

    if (saved.irrigationSystem) {
      this.state.irrigationSystem = saved.irrigationSystem;
      if (this.irrigationRenderSystem) {
        this.irrigationRenderSystem.update(this.state.irrigationSystem);
      }
    }

    if (saved.holeBuilderAssets) {
      this.loadHoleBuilderAssets(saved.holeBuilderAssets);
    }
    if (saved.scenarioPlacedAssets) {
      this.loadScenarioPlacedAssets(saved.scenarioPlacedAssets);
    }

    this.rebuildRefillStations();

    return true;
  }

  public hasSavedGame(): boolean {
    if (!this.state.currentScenario) return false;
    return hasSave(this.state.currentScenario.id);
  }

  public getAutomationState(): Record<string, unknown> {
    return {
      screen: "game",
      paused: this.state.isPaused,
      gameDay: this.state.gameDay,
      gameTime: this.state.gameTime,
      scenarioId: this.state.currentScenario?.id ?? null,
      groundMode: this.uiManager.getGroundMode(),
      panels: this.uiPanelCoordinator.getAutomationPanelState(),
      pauseMenuVisible: this.uiManager.isPauseMenuVisible(),
      holeBuilderVisible: this.holeBuilderToolbar?.isVisible() ?? false,
      assetBuilderVisible: this.assetBrowserUI?.isVisible() ?? false,
    };
  }

  private setupInputCallbacks(): void {
    const editorSystem = () => this.terrainEditorController.getSystem();

    this.inputManager.setCallbacks({
      onMove: (direction: Direction) => {
        if (this.terrainEditorController.isEnabled()) return;
        if (
          this.state.isPaused ||
          this.uiPanelCoordinator.isModalDialogVisible() ||
          this.uiPanelCoordinator.isIrrigationToolbarVisible() ||
          this.holeBuilderToolbar?.isVisible() ||
          this.assetBrowserUI?.isVisible()
        ) {
          return;
        }
        this.babylonEngine.nudgeCamera(direction);
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
      onCameraRotate: (delta: number) => this.babylonEngine.rotateCamera(delta),
      onCameraTilt: (delta: number) => this.babylonEngine.tiltCamera(delta),
      onCameraReset: () => this.babylonEngine.resetCameraView(),
      onZoom: (delta: number) => this.handleZoom(delta),
      onDebugReload: () => this.handleDebugReload(),
      onDebugExport: () => this.handleDebugExport(),
      onClick: (screenX: number, screenY: number) =>
        this.handleClick(screenX, screenY),

      onEditorToggle: () => {
        this.setTerrainEditor(!this.isTerrainEditorEnabled());
      },

      onEditorBrushSelect: (brush: string) =>
        this.terrainEditorController.handleEditorBrushSelect(brush),
      onEditorBrushSizeChange: (delta: number) =>
        this.terrainEditorController.handleEditorBrushSizeDelta(delta),
      onEditorBrushStrengthChange: (delta: number) =>
        this.terrainEditorController.handleEditorBrushStrengthDelta(delta),

      onMouseMove: (screenX: number, screenY: number) => {
        this.terrainEditorController.handleMouseMove(screenX, screenY);
        this.handleHoleBuilderMouseMove(screenX, screenY);
        this.handleAssetBuilderMouseMove(screenX, screenY);
        this.handleGameplayMouseMove(screenX, screenY);
      },
      onDragStart: (screenX: number, screenY: number, shiftKey?: boolean) => {
        if (this.terrainEditorController.isEnabled()) {
          this.terrainEditorController.handleDragStart(screenX, screenY, shiftKey);
          return;
        }
        if (this.handleHoleBuilderDragStart(screenX, screenY)) {
          return;
        }
        if (this.handleAssetBuilderDragStart(screenX, screenY)) {
          return;
        }
        this.cameraDragAnchor = { x: screenX, y: screenY };
      },
      onDrag: (screenX: number, screenY: number) => {
        if (this.terrainEditorController.isEnabled()) {
          this.terrainEditorController.handleDrag(screenX, screenY);
          return;
        }
        if (this.handleHoleBuilderDrag(screenX, screenY)) {
          return;
        }
        if (this.handleAssetBuilderDrag(screenX, screenY)) {
          return;
        }
        if (!this.cameraDragAnchor) {
          this.cameraDragAnchor = { x: screenX, y: screenY };
          return;
        }
        this.babylonEngine.panCameraByScreenDelta(
          screenX - this.cameraDragAnchor.x,
          screenY - this.cameraDragAnchor.y
        );
        this.cameraDragAnchor = { x: screenX, y: screenY };
      },
      onDragEnd: () => {
        if (this.terrainEditorController.isEnabled()) {
          this.terrainEditorController.handleDragEnd();
        }
        if (this.handleHoleBuilderDragEnd()) {
          this.cameraDragAnchor = null;
          return;
        }
        if (this.handleAssetBuilderDragEnd()) {
          this.cameraDragAnchor = null;
          return;
        }
        this.cameraDragAnchor = null;
      },
      onEmployeePanel: () => this.uiPanelCoordinator.handleEmployeePanel(),
      onResearchPanel: () => this.uiPanelCoordinator.handleResearchPanel(),
      onTeeSheetPanel: () => this.uiPanelCoordinator.handleTeeSheetPanel(),
      onIrrigationPanel: () => this.handleIrrigationPanel(),
      onHoleBuilderPanel: () => this.handleHoleBuilderPanel(),
      onAssetBuilderPanel: () => this.handleAssetBuilderPanel(),
      onEquipmentStore: () => this.uiPanelCoordinator.handleEquipmentStore(),
      onAmenityPanel: () => this.uiPanelCoordinator.handleAmenityPanel(),
      onCourseLayoutPanel: () => this.uiPanelCoordinator.handleCourseLayoutPanel(),
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
      isInputBlocked: (x: number, y: number) =>
        this.uiManager.isPauseMenuVisible() ||
        this.uiManager.isScenarioFailureVisible() ||
        this.uiManager.isMinimapBlockingPointer(x, y) ||
        this.uiPanelCoordinator.isModalDialogVisible() ||
        this.uiPanelCoordinator.isIrrigationUIBlockingPointer(x, y) ||
        this.uiPanelCoordinator.isEntityInspectorBlockingPointer(x, y) ||
        this.isHoleBuilderUIBlockingPointer(x, y) ||
        this.isAssetBuilderUIBlockingPointer(x, y),
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
    this.terrainSystem.build(this.state.currentCourse);
    this.buildObstacles();
    this.buildRefillStations();
    this.buildCourseScenery();
    const course = this.state.currentCourse;
    const centerX = course.width / 2;
    const centerZ = course.height / 2;
    this.babylonEngine.setCameraTargetGrid(
      centerX,
      centerZ,
      this.terrainSystem.getElevationAt(centerX, centerZ)
    );
    const overviewSize = Math.max(course.width, course.height) * 0.45;
    this.babylonEngine.setTargetOrthoSize(overviewSize);
  }

  private buildCourseScenery(): void {
    this.courseScenerySystem?.dispose();
    this.courseScenerySystem = new CourseScenerySystem(this.babylonEngine.getScene());
    this.courseScenerySystem.populate(this.state.currentCourse, this.terrainMeshSystem);
  }

  private buildObstacles(): void {
    const { obstacles } = this.state.currentCourse;
    if (!obstacles) return;

    for (const obs of obstacles) {
      const elevation = this.terrainSystem.getElevationAt(obs.x, obs.y);

      if (obs.type === 1 || obs.type === 2) {
        this.createTree(obs.x, elevation * HEIGHT_UNIT, obs.y, obs.type === 2);
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
      .catch(() => {

      });
  }

  private buildRefillStations(): void {
    const scene = this.babylonEngine.getScene();
    const stations = this.getRuntimeRefillStations();

    for (let i = 0; i < stations.length; i++) {
      const station = stations[i];
      const elevation = this.terrainSystem.getElevationAt(station.x, station.y);

      loadAsset(scene, "building.maintenance.shed")
        .then((loadedAsset) => {
          const instance = createInstance(scene, loadedAsset, `refill_${i}`);
          instance.root.position = new Vector3(station.x, elevation * HEIGHT_UNIT, station.y);
          this.refillStationInstances.push(instance);
        })
        .catch(() => {

        });
    }
  }

  private clearRefillStations(): void {
    for (const instance of this.refillStationInstances) {
      disposeInstance(instance);
    }
    this.refillStationInstances = [];
  }

  private rebuildRefillStations(): void {
    this.clearRefillStations();
    this.buildRefillStations();
  }

  private getRuntimeRefillStations(): Array<{ x: number; y: number; name: string }> {
    return getRuntimeRefillStationsFromState(this.state);
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
    this.courseScenerySystem?.snapToTerrain(this.terrainMeshSystem);
  }

  private snapEntityToTerrain(visual: EntityVisualState, worldX: number, worldZ: number): void {
    const elevation = this.terrainSystem.getElevationAt(worldX, worldZ, 0);
    const worldPos = gridTo3D(worldX + 0.5, worldZ + 0.5, elevation);
    visual.container.position.copyFrom(worldPos);
    visual.lastGridX = worldX;
    visual.lastGridY = worldZ;
    visual.targetGridX = worldX;
    visual.targetGridY = worldZ;
    visual.visualProgress = 1;
  }

  private handleClick(screenX: number, screenY: number): void {
    if (this.state.isPaused) return;

    if (this.terrainEditorController.isEnabled()) {
      const result = this.terrainEditorController.screenToGridAndWorld(screenX, screenY);
      if (result) {
        this.terrainEditorController.getSystem()?.handleClick(result.gridX, result.gridY);
      }
      return;
    }

    if (this.handleHoleBuilderClick(screenX, screenY)) {
      return;
    }

    if (this.handleAssetBuilderClick(screenX, screenY)) {
      return;
    }

    if (this.handleIrrigationClick(screenX, screenY)) {
      return;
    }

    if (this.groundInteractionMode === "view") {
      if (this.handleEntityClick(screenX, screenY)) {
        return;
      }
      this.uiPanelCoordinator.hideEntityInspector();
      this.handleViewModeEntityClick(screenX, screenY);
      return;
    }

    if (this.groundInteractionMode === "inspect") {
      this.uiPanelCoordinator.hideEntityInspector();
      this.handleRegionClick(screenX, screenY);
      return;
    }

    this.uiPanelCoordinator.hideEntityInspector();
    this.handleDirectDispatchClick(screenX, screenY);
  }

  private handleIrrigationClick(screenX: number, screenY: number): boolean {
    if (!this.uiPanelCoordinator.isIrrigationToolbarVisible()) {
      return false;
    }

    const world = this.babylonEngine.screenToWorldPosition(screenX, screenY);
    if (!world) {
      return true;
    }

    const gridX = Math.floor(world.x);
    const gridY = Math.floor(world.z);
    const course = this.state.currentCourse;
    if (gridX < 0 || gridY < 0 || gridX >= course.width || gridY >= course.height) {
      this.uiManager.showNotification("Irrigation action out of bounds");
      return true;
    }

    this.uiPanelCoordinator.handleIrrigationGridAction(gridX, gridY);
    return true;
  }

  private handleEntityClick(screenX: number, screenY: number): boolean {
    if (this.uiPanelCoordinator.isEntityInspectorBlockingPointer(screenX, screenY)) {
      return true;
    }
    const target = this.resolveInspectableAtScreenPoint(screenX, screenY);
    if (target?.kind === 'robot') {
      this.uiPanelCoordinator.showRobotInspector(target.robot);
      return true;
    }

    if (target?.kind === 'employee') {
      this.uiPanelCoordinator.showEmployeeInspector(
        target.employee,
        target.position.task,
        target.position.worldX,
        target.position.worldZ
      );
      return true;
    }

    if (target?.kind === 'golfer') {
      this.uiPanelCoordinator.showGolferInspector(
        target.golfer,
        target.worldX,
        target.worldZ
      );
      return true;
    }

    if (target?.kind === 'asset') {
      this.uiPanelCoordinator.showAssetInspector(target.asset, target.canDelete);
      return true;
    }

    return false;
  }

  private handleRegionClick(screenX: number, screenY: number): boolean {
    const resolved = this.resolveRegionContextAtScreenPoint(screenX, screenY);
    if (!resolved) return false;

    this.uiPanelCoordinator.showRegionInfo(resolved.region, resolved.stats, resolved.hasActiveJob);
    return true;
  }

  private handleDirectDispatchClick(screenX: number, screenY: number): boolean {
    const taskType = this.getDispatchTaskForMode();
    if (!taskType) return false;

    const resolved = this.resolveRegionContextAtScreenPoint(screenX, screenY);
    if (!resolved) return false;

    this.queueRegionTask(resolved.region, taskType);
    return true;
  }

  private resolveRegionContextAtScreenPoint(screenX: number, screenY: number): {
    region: import("../core/named-region").NamedRegion;
    stats: import("../core/standing-orders").RegionStats;
    hasActiveJob: boolean;
  } | null {
    if (this.state.namedRegions.length === 0 && this.terrainSystem.getAllFaceStates().size === 0) return null;

    const world = this.babylonEngine.screenToWorldPosition(screenX, screenY);
    if (!world) return null;

    let region = findRegionAtPosition(this.state.namedRegions, world.x, world.z);
    if (!region) {
      const faceId = this.terrainSystem.findFaceAtPosition(world.x, world.z);
      if (faceId === null || faceId === undefined) return null;
      const fs = this.terrainSystem.getAllFaceStates().get(faceId);
      if (!fs || fs.terrainCode === 4) return null;
      const nearbyFaces = this.terrainSystem.getFacesInBrush(world.x, world.z, 5);
      const sameTerrain = nearbyFaces.filter(f => {
        const s = this.terrainSystem.getAllFaceStates().get(f);
        return s && s.terrainCode === fs.terrainCode;
      });
      const name = getTerrainDisplayName(getTerrainType(fs.terrainCode));
      region = {
        id: `adhoc_${faceId}`,
        name,
        holeNumber: 0,
        terrainCode: fs.terrainCode,
        boundary: [],
        faceIds: sameTerrain,
      };
    }

    const sampler = {
      getFaceState: (fid: number) => {
        const fs = this.terrainSystem.getAllFaceStates().get(fid);
        return fs ? { grassHeight: fs.grassHeight, moisture: fs.moisture, nutrients: fs.nutrients, health: fs.health } : undefined;
      },
    };

    const stats = computeRegionStats(region, sampler);
    const hasActiveJob = getJobForRegion(this.state.jobSystemState, region.id) !== null;
    return { region, stats, hasActiveJob };
  }

  private queueRegionTask(region: import("../core/named-region").NamedRegion, taskType: import("../core/job").JobTaskType): boolean {
    if (isRegionLocked(this.state.jobSystemState, region.id)) {
      this.uiManager.showNotification('Region already has an active job');
      return false;
    }

    const pattern = getPatternForTask(taskType, region.terrainCode);
    const waypoints = generateWaypoints(pattern, region, this.state.currentCourse.topology);
    if (waypoints.length === 0) {
      this.uiManager.showNotification('Cannot generate work pattern for this region');
      return false;
    }

    const job = createJob(
      this.state.jobSystemState, region.id, taskType,
      region.faceIds, pattern, waypoints,
      this.state.gameDay * 1440 + this.state.gameTime
    );
    if (job) {
      this.uiManager.showNotification(`${taskType} job queued on ${region.name}`);
      return true;
    }
    return false;
  }

  private setGroundInteractionMode(mode: GroundInteractionMode): void {
    this.groundInteractionMode = mode;
    if (mode !== "inspect" && mode !== "view") {
      this.uiPanelCoordinator.hideRegionInfo();
      this.uiPanelCoordinator.hideEntityInspector();
    }
    if (mode === "view") {
      this.clearInspectHover();
    }
  }

  private getDispatchTaskForMode(): import("../core/job").JobTaskType | null {
    switch (this.groundInteractionMode) {
      case "dispatch_mow":
        return "mow";
      case "dispatch_water":
        return "water";
      case "dispatch_fertilize":
        return "fertilize";
      case "dispatch_rake":
        return "rake";
      default:
        return null;
    }
  }

  private applyEquipmentEffect(x: number, y: number): void {
    const type = this.equipmentManager.getSelected();
    const eqState = this.equipmentManager.getCurrentState();
    if (!type || !eqState) return;

    switch (type) {
      case "mower":
        this.terrainSystem.mowAt(x, y);
        break;
      case "sprinkler":
        this.terrainSystem.waterArea(x, y, eqState.effectRadius, 15);
        break;
      case "spreader":
        this.terrainSystem.fertilizeArea(
          x,
          y,
          eqState.effectRadius,
          10,
          getBestFertilizerEffectiveness(this.state.researchState)
        );
        break;
    }
  }

  private handleRefill(): void {
    const player = this.playerController.getPlayer();
    const nearStation = this.getRuntimeRefillStations().some((station) => {
      const dx = Math.abs(station.x - player.gridX);
      const dy = Math.abs(station.y - player.gridY);
      return dx <= 2 && dy <= 2;
    });

    if (nearStation) {
      const cost = this.equipmentManager.refill();
      if (cost > 0) {
        const timestamp = this.state.gameDay * 1440 + this.state.gameTime;
        const expenseResult = addExpense(
          this.state.economyState,
          cost,
          "supplies",
          "Equipment refill",
          timestamp,
          true
        );
        if (expenseResult) {
          this.state.economyState = expenseResult;
          this.state.dailyStats.expenses.supplies += cost;
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
    if (mode !== "irrigation" && this.uiPanelCoordinator.isIrrigationToolbarVisible()) {
      this.uiPanelCoordinator.hideIrrigationPanels();
      this.uiManager.showNotification("Irrigation tools closed (overlay changed)");
    }
    this.uiManager.updateOverlayLegend(mode);
    this.state.overlayAutoSwitched = false;
    this.updateIrrigationVisibility();
  }

  private handleIrrigationPanel(): void {
    const willOpen = !this.uiPanelCoordinator.isIrrigationToolbarVisible();
    if (willOpen && this.holeBuilderToolbar?.isVisible()) {
      this.hideHoleBuilderPanel();
    }
    if (willOpen && this.assetBrowserUI?.isVisible()) {
      this.hideAssetBuilderPanel();
    }
    this.uiPanelCoordinator.toggleIrrigationToolbar();

    if (willOpen && this.terrainSystem.getOverlayMode() !== "irrigation") {
      this.terrainSystem.setOverlayMode("irrigation");
      this.uiManager.updateOverlayLegend("irrigation");
      this.state.overlayAutoSwitched = false;
      this.updateIrrigationVisibility();
    }

    if (willOpen) {
      this.uiManager.setGroundMode("view");
      this.uiPanelCoordinator.hideRegionInfo();
      this.uiPanelCoordinator.hideEntityInspector();
    }
  }

  private updateIrrigationVisibility(): void {
    if (this.irrigationRenderSystem) {
      const overlayMode = this.terrainSystem.getOverlayMode();
      this.irrigationRenderSystem.setVisible(overlayMode === "irrigation");
    }
  }

  private handlePause(): void {
    if (this.state.isPaused) {
      this.resumeGame();
      return;
    }
    if (this.uiPanelCoordinator.closeTopmostPanel()) {
      return;
    }
    if (this.uiPanelCoordinator.isIrrigationToolbarVisible()) {
      this.uiPanelCoordinator.hideIrrigationPanels();
      return;
    }
    if (this.holeBuilderToolbar?.isVisible()) {
      this.hideHoleBuilderPanel();
      return;
    }
    this.pauseGame();
  }

  private pauseGame(): void {
    if (this.terrainEditorController.isEnabled()) {
      this.setTerrainEditor(false);
    }
    if (this.holeBuilderToolbar?.isVisible()) {
      this.hideHoleBuilderPanel();
    }
    if (this.assetBrowserUI?.isVisible()) {
      this.hideAssetBuilderPanel();
    }
    this.state.isPaused = true;
    this.uiManager.showPauseMenu(
      () => this.resumeGame(),
      () => this.restartGame(),
      this.state.gameOptions.onReturnToMenu ? () => this.returnToMenu() : undefined,
      () => this.saveCurrentGame(),
      () => {
        this.resumeGame();
        this.uiPanelCoordinator.handleEmployeePanel();
      },
      () => {
        this.resumeGame();
        this.uiPanelCoordinator.handleResearchPanel();
      },
      () => {
        this.resumeGame();
        this.uiPanelCoordinator.handleTeeSheetPanel();
      },
      () => {
        this.resumeGame();
        this.setTerrainEditor(true);
      },
      () => {
        this.resumeGame();
        this.handleHoleBuilderPanel();
      },
      () => {
        this.resumeGame();
        this.handleAssetBuilderPanel();
      },
      () => {
        this.resumeGame();
        this.uiPanelCoordinator.handleEquipmentStore();
      },
      () => {
        this.resumeGame();
        this.uiPanelCoordinator.handleAmenityPanel();
      },
      () => {
        this.resumeGame();
        this.uiPanelCoordinator.handleCourseLayoutPanel();
      },
      (delta: number) => this.handleTimeSpeed(delta),
      this.state.timeScale
    );
  }

  private resumeGame(): void {
    this.state.isPaused = false;
    this.uiManager.hidePauseMenu();
  }

  private restartGame(): void {
    const course = this.state.currentCourse;
    const startX = Math.floor(course.width / 2);
    const startY = Math.floor(course.height * 0.75);
    this.playerController.teleport(startX, startY);
    this.state.gameTime = 6 * 60;
    this.state.gameDay = 1;
    this.state.score = 0;
    this.state.timeScale = 1;
    this.state.weatherState = createInitialWeatherState(this.state.gameDay);
    this.state.weather = this.state.weatherState.current;
    this.equipmentManager.refill();
    this.terrainSystem.dispose();
    this.terrainMeshSystem = new TerrainMeshSystem(this.babylonEngine.getScene(), course);
    this.terrainSystem = this.terrainMeshSystem;
    this.terrainSystem.build(course);
    this.buildCourseScenery();
    this.playerController.updatePlayerPosition();
    this.resumeGame();
    this.uiManager.showNotification("Game Restarted");
  }

  private returnToMenu(): void {
    this.saveCurrentGame();
    if (this.state.gameOptions.onReturnToMenu) {
      this.state.gameOptions.onReturnToMenu();
    }
  }

  private handleMute(): void {
    this.state.isMuted = !this.state.isMuted;
  }

  private handleTimeSpeed(delta: number): void {
    const speeds = [0.5, 1, 2, 4, 8];
    const currentIndex = speeds.indexOf(this.state.timeScale);
    const newIndex = Math.max(
      0,
      Math.min(speeds.length - 1, currentIndex + delta)
    );
    this.state.timeScale = speeds[newIndex];
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
    // Debug export disabled
  }

  private setupUpdateLoop(): void {
    this.lastTime = performance.now();

    const stats = this.terrainSystem.getCourseStats();
    this.uiManager.updateCourseStatus(
      stats.health,
      stats.moisture,
      stats.nutrients
    );
    this.babylonEngine.getScene().onBeforeRenderObservable.add(() => {
      const now = performance.now();
      const deltaMs = now - this.lastTime;
      this.lastTime = now;

      this.updateZoom(deltaMs);
      this.uiManager.updateCameraInfo(
        this.babylonEngine.getCameraHeadingDegrees(),
        this.babylonEngine.getCameraTiltDegrees(),
      );
      this.robotVisualSystem?.update(this.state.autonomousState.robots);

      if (this.uiPanelCoordinator.isEntityInspectorVisible()) {
        const trackedId = this.uiPanelCoordinator.getEntityInspectorTrackedRobotId();
        if (trackedId) {
          const tracked = this.state.autonomousState.robots.find(r => r.id === trackedId);
          if (tracked) {
            this.uiPanelCoordinator.updateEntityInspector(tracked);
          } else {
            this.uiPanelCoordinator.hideEntityInspector();
          }
        }
      }

      if (this.state.isPaused) {
        return;
      }

      this.babylonEngine.updateCameraPan(deltaMs, {
        up: this.inputManager.isDirectionKeyHeld('up'),
        down: this.inputManager.isDirectionKeyHeld('down'),
        left: this.inputManager.isDirectionKeyHeld('left'),
        right: this.inputManager.isDirectionKeyHeld('right'),
      });

      this.state.gameTime += (deltaMs / 1000) * 2 * this.state.timeScale;
      if (this.state.gameTime >= 24 * 60) {
        this.state.gameTime -= 24 * 60;

        const snapshot = takeDailySnapshot(
          this.state.prestigeState.currentConditions,
          this.state.gameDay
        );
        this.state.prestigeState = {
          ...this.state.prestigeState,
          historicalExcellence: updateHistoricalExcellence(
            this.state.prestigeState.historicalExcellence,
            snapshot
          ),
        };

        this.state.gameDay++;
        this.state.scenarioManager?.incrementDay();
      }

      this.terrainSystem.update(
        deltaMs * this.state.timeScale,
        this.state.gameDay * 1440 + this.state.gameTime,
        this.state.weather
      );

      this.updateEconomySystems(deltaMs);

      this.checkTutorialHints();

      if (this.state.scenarioManager && Math.random() < 0.01) {
        this.checkScenarioCompletion();
      }

      this.activityIndicatorSystem?.update(deltaMs);

      this.updateDayNightCycle();
      this.updatePrestigeVisuals();

      this.weatherVisualSystem?.update(
        deltaMs,
        this.state.weather,
        this.babylonEngine.getCamera().target
      );

      const hours = Math.floor(this.state.gameTime / 60);
      const minutes = Math.floor(this.state.gameTime % 60);
      const season = getSeasonFromDay(this.state.gameDay).season;
      this.uiManager.updateTime(hours, minutes, this.state.gameDay, season);
      this.uiManager.updateWeather(this.state.weather.type, this.state.weather.temperature);
      const courseStats = this.terrainSystem.getCourseStats();
      this.activityIndicatorSystem?.updateAmbientLevel(
        this.babylonEngine.getScene(),
        courseStats.health,
        getActiveGolferCount(this.state.golferPool)
      );
      this.uiManager.updateCourseStatus(
        courseStats.health,
        courseStats.moisture,
        courseStats.nutrients
      );
      this.uiManager.updateScore(this.state.score);
      this.uiPanelCoordinator.refreshLivePanels();
      this.uiManager.updateEconomy(
        this.state.economyState.cash,
        getActiveGolferCount(this.state.golferPool),
        getAverageSatisfaction(this.state.golferPool)
      );
      this.uiManager.updateMinimapPlayerPosition(
        this.state.employeeWorkState.maintenanceShedX,
        this.state.employeeWorkState.maintenanceShedY,
        this.state.currentCourse.width,
        this.state.currentCourse.height
      );
      this.uiManager.updateMinimapRobots(
        this.state.autonomousState.robots.map((robot) => ({
          worldX: robot.worldX,
          worldZ: robot.worldZ,
          state: robot.state,
        })),
        this.state.currentCourse.width,
        this.state.currentCourse.height
      );
      if (this.golferVisualSystem) {
        this.uiManager.updateMinimapGolfers(
          this.golferVisualSystem.getGolferPositions(),
          this.state.currentCourse.width,
          this.state.currentCourse.height
        );
      }

      const todayTeeTimes = this.state.teeTimeState.teeTimes.get(this.state.gameDay) ?? [];
      const bookedTeeTimes = todayTeeTimes.filter((tt) =>
        tt.status !== "available" && tt.status !== "cancelled"
      ).length;
      const workers = this.state.employeeWorkState.workers;
      const activeWorkers = workers.filter((worker) => worker.currentTask !== "idle").length;
      const currentResearch = this.state.researchState.currentResearch;
      const activeResearchName = currentResearch
        ? (RESEARCH_ITEMS.find((item) => item.id === currentResearch.itemId)?.name ?? currentResearch.itemId)
        : null;
      const researchProgress = currentResearch
        ? (currentResearch.pointsEarned / Math.max(1, currentResearch.pointsRequired)) * 100
        : 0;
      const robotsWorking = this.state.autonomousState.robots.filter((robot) =>
        robot.state === "working" || robot.state === "moving"
      ).length;
      const robotsBroken = this.state.autonomousState.robots.filter((robot) => robot.state === "broken").length;
      const pipePressureByTile = new Map(
        this.state.irrigationSystem.pipes.map((pipe) => [
          `${pipe.gridX},${pipe.gridY}`,
          pipe.pressureLevel,
        ])
      );
      const sprinklersPumping = this.state.irrigationSystem.sprinklerHeads.filter((head) => {
        if (!head.isActive) return false;
        const pressure = pipePressureByTile.get(`${head.gridX},${head.gridY}`) ?? 0;
        return pressure > 0;
      }).length;
      const sprinklersDry = this.state.irrigationSystem.sprinklerHeads.filter((head) => {
        if (!head.isActive) return false;
        const pressure = pipePressureByTile.get(`${head.gridX},${head.gridY}`) ?? 0;
        return pressure <= 0;
      }).length;
      const pipeLeaks = this.state.irrigationSystem.pipes.filter((pipe) => pipe.isLeaking).length;
      const areaConditions = sampleCourseAreaConditions(this.state.employeeWorkState.areas, this.terrainSystem);
      const staffedZones = new Set(
        this.state.employeeRoster.employees
          .map((employee) => employee.assignedArea)
          .filter((areaId): areaId is string => areaId !== null && areaId !== "all_course")
      ).size;
      const flexWorkers = this.state.employeeRoster.employees.filter(
        (employee) => employee.assignedArea === null || employee.assignedArea === "all_course"
      ).length;
      const zonedRobots = this.state.autonomousState.robots.filter(
        (robot) => robot.assignedAreaId !== null && robot.assignedAreaId !== undefined && robot.assignedAreaId !== "all_course"
      ).length;
      const flexRobots = this.state.autonomousState.robots.filter(
        (robot) => robot.assignedAreaId === null || robot.assignedAreaId === undefined || robot.assignedAreaId === "all_course"
      ).length;
      const topPriority = areaConditions[0] ?? null;
      const topPriorityLabel = topPriority && topPriority.severity > 0
        ? `${topPriority.areaName} ${topPriority.issueLabel} • H${Math.round(topPriority.avgHealth)} M${Math.round(topPriority.avgMoisture)} N${Math.round(topPriority.avgNutrients)}`
        : "Course holding steady";

      this.uiManager.updateOperationsSummary({
        workersActive: activeWorkers,
        workersIdle: workers.length - activeWorkers,
        staffedZones,
        totalZones: Math.max(0, this.state.employeeWorkState.areas.filter((area) => area.id !== "all_course").length),
        flexWorkers,
        zonedRobots,
        flexRobots,
        bookedTeeTimes,
        totalTeeTimes: todayTeeTimes.length,
        researchName: activeResearchName,
        researchProgress,
        robotsWorking,
        robotsBroken,
        sprinklersPumping,
        sprinklersDry,
        pipeLeaks,
        topPriorityLabel,
        topPrioritySeverity: topPriority?.severity ?? 0,
      });

      if (this.state.scenarioManager && this.state.currentScenario) {
        const progress = this.state.scenarioManager.getProgress();
        const objective = this.state.currentScenario.objective;
        const conditions = this.state.currentScenario.conditions;

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

        const result = this.state.scenarioManager.checkObjective();
        this.uiManager.updateScenarioProgress(
          objectiveText,
          currentValue,
          targetValue,
          progress.daysElapsed,
          conditions.timeLimitDays,
          result.completed
        );
      }

    });
  }

  private updateDayNightCycle(): void {
    const hours = this.state.gameTime / 60;
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

  private updatePrestigeVisuals(): void {
    const score = this.state.prestigeState.currentScore;
    const modifier = (score - 500) / 500;
    this.terrainMeshSystem.setPrestigeModifier(modifier);

    const scene = this.babylonEngine.getScene();
    const ambient = scene.getLightByName("ambient") as any;
    if (ambient) {
      const baseIntensity = 0.7;
      ambient.intensity = baseIntensity + modifier * 0.08;
    }
  }

  private updateEconomySystems(deltaMs: number): void {
    const systems: SimulationSystems = {
      terrainSystem: this.terrainSystem,
      uiManager: this.uiManager,
      employeeVisualSystem: this.employeeVisualSystem,
      golferVisualSystem: this.golferVisualSystem,
      irrigationRenderSystem: this.irrigationRenderSystem,
      activityIndicatorSystem: this.activityIndicatorSystem,
      saveCallback: () => this.saveCurrentGame(),
      showDaySummaryCallback: () => this.showDaySummary(),
    };

    runSimulationTick(this.state, systems, deltaMs);
  }

  private checkScenarioCompletion(): void {
    if (!this.state.scenarioManager || this.scenarioOutcomeResolved) return;

    const result = this.state.scenarioManager.checkObjective();

    if (result.completed) {
      this.scenarioOutcomeResolved = true;
      const score = Math.round(
        this.state.economyState.cash +
          this.state.golferPool.totalVisitorsToday * 10 +
          this.terrainSystem.getCourseStats().health * 100
      );
      this.state.gameOptions.onScenarioComplete?.(score);
      this.uiManager.showNotification(`Scenario Complete! Score: ${score}`);
    } else if (result.failed) {
      this.scenarioOutcomeResolved = true;
      this.state.isPaused = true;
      this.uiManager.hidePauseMenu();
      this.uiManager.showScenarioFailure(
        'Club target missed',
        result.message || 'The scenario objective was not met before the deadline or the course became non-viable.'
      );
      this.uiManager.showNotification(`Scenario Failed: ${result.message || "Objective not met"}`);
    }
  }

  public setRunning(running: boolean): void {
    if (running) {
      this.babylonEngine.start();
    } else {
      this.babylonEngine.stop();
    }
  }

  private movePlayer(
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

  private selectEquipment(slot: 1 | 2 | 3): void {
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
        this.state.overlayAutoSwitched = true;
        this.updateIrrigationVisibility();
      } else if (targetOverlay === null && this.state.overlayAutoSwitched) {
        this.terrainSystem.setOverlayMode("normal");
        this.uiManager.updateOverlayLegend("normal");
        this.state.overlayAutoSwitched = false;
        this.updateIrrigationVisibility();
      }
    } else if (nowSelected === null && this.state.overlayAutoSwitched) {
      this.terrainSystem.setOverlayMode("normal");
      this.uiManager.updateOverlayLegend("normal");
      this.state.overlayAutoSwitched = false;
      this.updateIrrigationVisibility();
    }
  }

  private toggleEquipment(): void {
    const selected = this.equipmentManager.getSelected();
    if (selected === null) return;

    const slotMap: Record<string, 1 | 2 | 3> = {
      mower: 1,
      sprinkler: 2,
      spreader: 3,
    };
    this.selectEquipment(slotMap[selected]);
  }

  private setTerrainEditor(enabled: boolean): void {
    const system = this.terrainEditorController.getSystem();
    if (!system) return;
    if (enabled) {
      if (this.holeBuilderToolbar?.isVisible()) {
        this.hideHoleBuilderPanel();
      }
      if (this.assetBrowserUI?.isVisible()) {
        this.hideAssetBuilderPanel();
      }
      this.uiManager.setGroundMode("view");
      this.uiPanelCoordinator.hideRegionInfo();
      this.uiPanelCoordinator.hideEntityInspector();
      system.enable();
    } else {
      system.disable();
    }
    this.refreshBuildModeHUD();
  }

  private isTerrainEditorEnabled(): boolean {
    return this.terrainEditorController.isEnabled();
  }

  public createAPI(): GameAPI {
    const gameSystems: GameSystems = {
      player: this.playerController.getPlayer(),
      playerVisual: this.playerController.getPlayerVisual(),
      clickToMoveWaypoints: this.playerController.getClickToMoveWaypoints(),
      lastEquipmentFaceId: this.playerController.getLastEquipmentFaceId(),
      getPlayer: () => this.playerController.getPlayer(),
      setPlayer: (player) => this.playerController.setPlayer(player),
      getPlayerVisual: () => this.playerController.getPlayerVisual(),
      getClickToMoveWaypoints: () => this.playerController.getClickToMoveWaypoints(),
      setClickToMoveWaypoints: (waypoints) => this.playerController.setClickToMoveWaypoints(waypoints),
      getLastEquipmentFaceId: () => this.playerController.getLastEquipmentFaceId(),
      setLastEquipmentFaceId: (faceId) => this.playerController.setLastEquipmentFaceId(faceId),
      equipmentManager: this.equipmentManager,
      terrainSystem: this.terrainSystem,
      terrainEditorSystem: this.terrainEditorController.getSystem(),
      irrigationRenderSystem: this.irrigationRenderSystem,
      uiManager: this.uiManager,
      babylonEngine: this.babylonEngine,
      teeSheetViewDay: this.uiPanelCoordinator.getTeeSheetViewDay(),
      handleMove: (d) => this.movePlayer(d),
      handleEmployeePanel: () => this.uiPanelCoordinator.handleEmployeePanel(),
      handleResearchPanel: () => this.uiPanelCoordinator.handleResearchPanel(),
      handleTeeSheetPanel: () => this.uiPanelCoordinator.handleTeeSheetPanel(),
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
      showRobotInspector: (robot) => this.uiPanelCoordinator.showRobotInspector(robot),
      getGolferVisualCount: () => this.golferVisualSystem?.getGolferCount() ?? 0,
      getSceneryObjectCount: () => this.courseScenerySystem?.getObjectCount() ?? 0,
      getActiveEffectCount: () => this.activityIndicatorSystem?.getActiveCount() ?? 0,
    };
    return new GameAPI(this.state, gameSystems);
  }

  public dispose(): void {
    this.inputManager.dispose();
    this.terrainSystem.dispose();
    this.equipmentManager.dispose();
    this.uiManager.dispose();
    this.terrainEditorController.dispose();
    this.playerController.dispose();
    this.uiPanelCoordinator.dispose();
    this.clearHoleDistanceIndicators();
    this.holeBuilderToolbar?.dispose();
    this.holeBuilderToolbar = null;
    this.holeBuilderUITexture?.dispose();
    this.holeBuilderUITexture = null;
    this.holePlacementSystem.dispose();
    this.assetBrowserUI?.dispose();
    this.assetBrowserUI = null;
    this.assetBuilderUITexture?.dispose();
    this.assetBuilderUITexture = null;
    this.scenarioAssetPlacementSystem.dispose();

    this.employeeVisualSystem?.dispose();
    this.employeeVisualSystem = null;

    this.golferVisualSystem?.dispose();
    this.golferVisualSystem = null;

    this.robotVisualSystem?.dispose();
    this.robotVisualSystem = null;

    this.irrigationRenderSystem?.dispose();

    this.courseScenerySystem?.dispose();
    this.courseScenerySystem = null;

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
    if (this.state.shownTutorialHints.has(id)) return;
    if (this.state.currentScenario?.id !== "tutorial_basics") return;
    this.state.shownTutorialHints.add(id);
    this.uiManager.showNotification(message, color, 5000);
  }

  private checkTutorialHints(): void {
    if (this.state.currentScenario?.id !== "tutorial_basics") return;

    const courseStats = this.terrainSystem.getCourseStats();
    const hours = Math.floor(this.state.gameTime / 60);

    if (this.state.gameDay === 1 && hours >= 6 && hours < 7) {
      this.showTutorialHint(
        "welcome",
        "🎓 Welcome! Use WASD to move around your course."
      );
    }

    if (this.state.gameDay === 1 && hours >= 8) {
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

    if (this.state.gameDay === 2 && hours >= 7) {
      this.showTutorialHint(
        "panels",
        "🎓 Press H=Employees, Y=Research, G=TeeSheet"
      );
    }

    if (this.state.prestigeState.golfersRejectedToday >= 3) {
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
