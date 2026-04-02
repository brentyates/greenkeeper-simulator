import { Scene } from "@babylonjs/core/scene";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";

import { EmployeePanel } from "./ui/EmployeePanel";
import { ResearchPanel } from "./ui/ResearchPanel";
import { DaySummaryPopup, DaySummaryData } from "./ui/DaySummaryPopup";
import { TeeSheetPanel } from "./ui/TeeSheetPanel";
import { EquipmentStorePanel } from "./ui/EquipmentStorePanel";
import { AmenityPanel } from "./ui/AmenityPanel";
import { CourseLayoutPanel } from "./ui/CourseLayoutPanel";
import {
  IrrigationToolbar,
  IRRIGATION_TOOLBAR_BOUNDS,
} from "./ui/IrrigationToolbar";
import {
  IrrigationInfoPanel,
  IRRIGATION_INFO_PANEL_BOUNDS,
} from "./ui/IrrigationInfoPanel";
import {
  EntityInspectorPanel,
  ENTITY_INSPECTOR_BOUNDS,
} from "./ui/EntityInspectorPanel";
import {
  IrrigationSchedulePanel,
  IRRIGATION_SCHEDULE_PANEL_BOUNDS,
} from "./ui/IrrigationSchedulePanel";
import { UI_THEME } from "./ui/UITheme";
import { UIManager } from "./ui/UIManager";
import { RegionInfoPanel } from "./ui/RegionInfoPanel";
import { GameState, getRuntimeRefillStationsFromState } from "./GameState";

import {
  addIncome,
  addExpense,
  canAfford,
} from "../core/economy";
import {
  PipeType,
  SprinklerType,
  PIPE_CONFIGS,
  SPRINKLER_CONFIGS,
  addPipe,
  removePipe,
  addSprinklerHead,
  removeSprinklerHead,
  addWaterSource,
  updateSprinklerSchedule,
  getPipeAt,
  getSprinklerHeadAt,
  repairLeak,
} from "../core/irrigation";
import {
  EmployeeRole,
  EmployeeFocusPreference,
  EMPLOYEE_ROLE_INFO,
  hireEmployee,
  fireEmployee,
  assignEmployeeToArea,
  assignEmployeeFocus,
  createInitialApplicationState,
  postJobOpening,
  acceptApplication,
  getPostingCost,
  Employee,
} from "../core/employees";
import {
  assignWorkerToArea,
  syncWorkersWithRoster,
} from "../core/employee-work";
import { Golfer } from "../core/golfers";
import {
  startResearch,
  cancelResearch,
  setFundingLevel,
  FundingLevel,
  RESEARCH_ITEMS,
  EquipmentStats,
} from "../core/research";
import {
  upgradeAmenity,
} from "../core/prestige";
import { AmenityUpgrade, getUpgradeCost } from "../core/amenities";
import {
  TeeTimeSpacing,
  checkInTeeTime,
  cancelTeeTime,
  markNoShow,
  updateSpacing,
} from "../core/tee-times";
import {
  purchaseRobot,
  sellRobot,
  assignRobotToArea,
  RobotUnit,
} from "../core/autonomous-equipment";
import { IrrigationRenderSystem } from "./systems/IrrigationRenderSystem";
import { PlacedAsset } from "../data/customCourseData";

export interface UIPanelSystems {
  uiManager: UIManager;
  irrigationRenderSystem: IrrigationRenderSystem | null;
  resetDailyStats: () => void;
  onTerrainEditor?: () => void;
  onHoleBuilder?: () => void;
  onAssetBuilder?: () => void;
  onDeleteScenarioAsset?: (asset: PlacedAsset) => void;
}

export class UIPanelCoordinator {
  private scene: Scene;
  private state: GameState;
  private systems: UIPanelSystems;

  private employeePanel: EmployeePanel | null = null;
  private researchPanel: ResearchPanel | null = null;
  private daySummaryPopup: DaySummaryPopup | null = null;
  private teeSheetPanel: TeeSheetPanel | null = null;
  private teeSheetViewDay: number = 1;
  private equipmentStorePanel: EquipmentStorePanel | null = null;
  private amenityPanel: AmenityPanel | null = null;
  private courseLayoutPanel: CourseLayoutPanel | null = null;
  private irrigationToolbar: IrrigationToolbar | null = null;
  private irrigationInfoPanel: IrrigationInfoPanel | null = null;
  private irrigationSchedulePanel: IrrigationSchedulePanel | null = null;
  private entityInspectorPanel: EntityInspectorPanel | null = null;
  private regionInfoPanel: RegionInfoPanel | null = null;
  private irrigationTool: "pipe" | "sprinkler" | "delete" | "info" | null = null;
  private selectedPipeType: PipeType = "pvc";
  private selectedSprinklerType: SprinklerType = "fixed";

  constructor(scene: Scene, state: GameState, systems: UIPanelSystems) {
    this.scene = scene;
    this.state = state;
    this.systems = systems;
  }

  setupAll(): void {
    this.setupEmployeePanel();
    this.setupResearchPanel();
    this.setupDaySummaryPopup();
    this.setupTeeSheetPanel();
    this.setupEquipmentStorePanel();
    this.setupAmenityPanel();
    this.setupCourseLayoutPanel();
    this.setupIrrigationUI();
    this.setupEntityInspector();
    this.setupRegionInfoPanel();
    this.setupPriceCallback();
  }

  private setupEmployeePanel(): void {
    const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "EmployeePanelUI",
      true,
      this.scene
    );

    this.employeePanel = new EmployeePanel(uiTexture, {
      onHire: (employee: Employee) => {
        const result = hireEmployee(this.state.employeeRoster, employee);
        if (result) {
          this.state.employeeRoster = result;
          this.state.employeeWorkState = syncWorkersWithRoster(
            this.state.employeeWorkState,
            this.state.employeeRoster.employees
          );

          const updatedAppState = acceptApplication(
            this.state.applicationState,
            employee.id
          );
          if (updatedAppState) {
            this.state.applicationState = updatedAppState;
          }

          this.systems.uiManager.showNotification(
            `Hired ${employee.name} as ${employee.role}`
          );
          this.employeePanel?.update(this.state.employeeRoster, this.state.employeeWorkState, this.state.autonomousState);
          this.employeePanel?.updateApplications(
            this.state.applicationState,
            this.state.prestigeState.tier,
            this.state.gameTime + this.state.gameDay * 24 * 60
          );
        } else {
          this.systems.uiManager.showNotification("Cannot hire - roster full");
        }
      },
      onFire: (employeeId: string) => {
        const employee = this.state.employeeRoster.employees.find(
          (e) => e.id === employeeId
        );
        const result = fireEmployee(this.state.employeeRoster, employeeId);
        if (result) {
          this.state.employeeRoster = result;
          this.state.employeeWorkState = syncWorkersWithRoster(
            this.state.employeeWorkState,
            this.state.employeeRoster.employees
          );
          if (employee) {
            this.systems.uiManager.showNotification(`Fired ${employee.name}`);
          }
          this.employeePanel?.update(this.state.employeeRoster, this.state.employeeWorkState, this.state.autonomousState);
        }
      },
      onAssignArea: (employeeId: string, areaId: string | null) => {
        const employee = this.state.employeeRoster.employees.find((candidate) => candidate.id === employeeId);
        const nextRoster = assignEmployeeToArea(this.state.employeeRoster, employeeId, areaId);
        if (!employee || !nextRoster) {
          return;
        }

        this.state.employeeRoster = nextRoster;
        this.state.employeeWorkState = assignWorkerToArea(
          this.state.employeeWorkState,
          employeeId,
          areaId
        );

        const areaName =
          areaId === null
            ? 'All Course'
            : this.state.employeeWorkState.areas.find((area) => area.id === areaId)?.name ?? 'Assigned Area';
        this.systems.uiManager.showNotification(`${employee.name} now covers ${areaName}`);
        this.employeePanel?.update(this.state.employeeRoster, this.state.employeeWorkState, this.state.autonomousState);
      },
      onAssignFocus: (employeeId: string, focus: EmployeeFocusPreference) => {
        const employee = this.state.employeeRoster.employees.find((candidate) => candidate.id === employeeId);
        const nextRoster = assignEmployeeFocus(this.state.employeeRoster, employeeId, focus);
        if (!employee || !nextRoster) {
          return;
        }

        this.state.employeeRoster = nextRoster;
        this.systems.uiManager.showNotification(`${employee.name} focus set to ${focus}`);
        this.employeePanel?.update(this.state.employeeRoster, this.state.employeeWorkState, this.state.autonomousState);
      },
      onClose: () => {
        this.employeePanel?.hide();
      },
      onPostJobOpening: (role: EmployeeRole) => {
        const cost = getPostingCost(this.state.prestigeState.tier);
        if (this.state.economyState.cash < cost) {
          this.systems.uiManager.showNotification(
            `⚠️ Not enough cash! Need $${cost}`,
            "#ff4444"
          );
          return;
        }

        const currentTime = this.state.gameTime + this.state.gameDay * 24 * 60;
        const result = postJobOpening(
          this.state.applicationState,
          currentTime,
          this.state.prestigeState.tier,
          role
        );

        if (result) {
          this.state.applicationState = result.state;
          const timestamp = this.state.gameDay * 24 * 60 + this.state.gameTime;
          const expenseResult = addExpense(
            this.state.economyState,
            cost,
            "marketing",
            "Job Posting",
            timestamp,
            false
          );
          if (expenseResult) {
            this.state.economyState = expenseResult;
            this.state.dailyStats.expenses.other += cost;
          }

          const roleInfo = EMPLOYEE_ROLE_INFO[role];
          this.systems.uiManager.showNotification(
            `📢 Hiring ${roleInfo.name}! Cost: $${cost}`
          );
          this.employeePanel?.updateApplications(
            this.state.applicationState,
            this.state.prestigeState.tier,
            currentTime
          );
        }
      },
    });

    this.employeePanel.update(this.state.employeeRoster, this.state.employeeWorkState, this.state.autonomousState);

    this.state.applicationState = createInitialApplicationState(
      this.state.gameTime + this.state.gameDay * 24 * 60,
      this.state.prestigeState.tier
    );
  }

  private setupResearchPanel(): void {
    const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "ResearchPanelUI",
      true,
      this.scene
    );

    this.researchPanel = new ResearchPanel(uiTexture, {
      onStartResearch: (itemId: string) => {
        const currentTime = this.state.gameTime + this.state.gameDay * 24 * 60;
        const result = startResearch(this.state.researchState, itemId, currentTime);
        if (result) {
          this.state.researchState = result;
          const item = RESEARCH_ITEMS.find((i) => i.id === itemId);
          if (item) {
            this.systems.uiManager.showNotification(
              `Started researching: ${item.name}`
            );
          }
          this.researchPanel?.update(this.state.researchState);
        } else {
          this.systems.uiManager.showNotification("Cannot start research");
        }
      },
      onQueueResearch: (itemId: string) => {
        this.state.researchState = {
          ...this.state.researchState,
          researchQueue: [...this.state.researchState.researchQueue, itemId],
        };
        this.researchPanel?.update(this.state.researchState);
      },
      onCancelResearch: () => {
        this.state.researchState = cancelResearch(this.state.researchState);
        this.systems.uiManager.showNotification("Research cancelled");
        this.researchPanel?.update(this.state.researchState);
      },
      onSetFunding: (level: FundingLevel) => {
        this.state.researchState = setFundingLevel(this.state.researchState, level);
        this.systems.uiManager.showNotification(`Funding set to ${level}`);
        this.researchPanel?.update(this.state.researchState);
      },
      onClose: () => {
        this.researchPanel?.hide();
      },
    });

    this.researchPanel.update(this.state.researchState);
  }

  private setupDaySummaryPopup(): void {
    const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "DaySummaryUI",
      true,
      this.scene
    );

    this.daySummaryPopup = new DaySummaryPopup(uiTexture, {
      onContinue: () => {
        this.systems.resetDailyStats();
        this.state.isPaused = false;
      },
    });
  }

  private setupTeeSheetPanel(): void {
    const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "TeeSheetUI",
      true,
      this.scene
    );
    this.teeSheetViewDay = this.state.gameDay;

    this.teeSheetPanel = new TeeSheetPanel(uiTexture, {
      onCheckIn: (teeTimeId: string) => {
        const result = checkInTeeTime(this.state.teeTimeState, teeTimeId);
        this.state.teeTimeState = result;
        this.teeSheetPanel?.update(this.state.teeTimeState, this.teeSheetViewDay);
        this.systems.uiManager.showNotification("Golfer checked in");
      },
      onCancel: (teeTimeId: string) => {
        const result = cancelTeeTime(this.state.teeTimeState, teeTimeId);
        this.state.teeTimeState = result;
        this.teeSheetPanel?.update(this.state.teeTimeState, this.teeSheetViewDay);
        this.systems.uiManager.showNotification("Tee time cancelled");
      },
      onMarkNoShow: (teeTimeId: string) => {
        const result = markNoShow(this.state.teeTimeState, teeTimeId);
        if (result) {
          this.state.teeTimeState = result;
          this.teeSheetPanel?.update(this.state.teeTimeState, this.teeSheetViewDay);
          this.systems.uiManager.showNotification("Marked as no-show");
        }
      },
      onChangeDay: (delta: number) => {
        this.teeSheetViewDay = Math.max(1, this.teeSheetViewDay + delta);
        this.teeSheetPanel?.update(this.state.teeTimeState, this.teeSheetViewDay);
      },
      onSpacingChange: (spacing: TeeTimeSpacing) => {
        this.state.teeTimeState = updateSpacing(this.state.teeTimeState, spacing);
        this.teeSheetPanel?.update(this.state.teeTimeState, this.teeSheetViewDay);
        this.systems.uiManager.showNotification(`Tee time spacing: ${spacing}`);
      },
      onClose: () => {
        this.teeSheetPanel?.hide();
      },
    });
  }

  private setupEquipmentStorePanel(): void {
    const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "EquipmentStoreUI",
      true,
      this.scene
    );

    this.equipmentStorePanel = new EquipmentStorePanel(uiTexture, {
      onPurchaseRobot: (equipmentId: string, stats: EquipmentStats) => {
        const result = purchaseRobot(this.state.autonomousState, equipmentId, stats);
        if (result && result.cost <= this.state.economyState.cash) {
          this.state.autonomousState = result.state;
          const timestamp = this.state.gameDay * 24 * 60 + this.state.gameTime;
          const expenseResult = addExpense(
            this.state.economyState,
            result.cost,
            "equipment_purchase",
            `Robot purchase: ${equipmentId}`,
            timestamp,
            false
          );
          if (expenseResult) {
            this.state.economyState = expenseResult;
            this.state.dailyStats.expenses.other += result.cost;
          }
          this.equipmentStorePanel?.update(
            this.state.researchState,
            this.state.autonomousState,
            this.state.economyState.cash,
            this.state.employeeWorkState.areas
          );
          this.systems.uiManager.showNotification(`Purchased ${equipmentId}!`);
          return true;
        }
        return false;
      },
      onSellRobot: (robotId: string) => {
        const result = sellRobot(this.state.autonomousState, robotId);
        if (result) {
          this.state.autonomousState = result.state;
          const timestamp = this.state.gameDay * 24 * 60 + this.state.gameTime;
          const incomeResult = addIncome(
            this.state.economyState,
            result.refund,
            "other_income",
            `Robot sold: ${robotId}`,
            timestamp
          );
          if (incomeResult) {
            this.state.economyState = incomeResult;
            this.state.dailyStats.revenue.other += result.refund;
          }
          this.equipmentStorePanel?.update(
            this.state.researchState,
            this.state.autonomousState,
            this.state.economyState.cash,
            this.state.employeeWorkState.areas
          );
          this.systems.uiManager.showNotification(
            `Sold robot for $${result.refund.toLocaleString()}`
          );
          return true;
        }
        return false;
      },
      onAssignRobotArea: (robotId: string, areaId: string | null) => {
        const robot = this.state.autonomousState.robots.find((candidate) => candidate.id === robotId);
        if (!robot) return;
        this.state.autonomousState = assignRobotToArea(this.state.autonomousState, robotId, areaId);
        this.equipmentStorePanel?.update(
          this.state.researchState,
          this.state.autonomousState,
          this.state.economyState.cash,
          this.state.employeeWorkState.areas
        );
        const areaName =
          areaId === null
            ? 'All Course'
            : this.state.employeeWorkState.areas.find((area) => area.id === areaId)?.name ?? 'Assigned Area';
        this.systems.uiManager.showNotification(`${robot.id} now covers ${areaName}`);
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
      this.scene
    );

    this.amenityPanel = new AmenityPanel(uiTexture, {
      onPurchaseUpgrade: (upgrade: AmenityUpgrade) => {
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
          this.state.dailyStats.expenses.other += cost;
        }
        this.amenityPanel?.update(this.state.prestigeState, this.state.economyState.cash);
        this.systems.uiManager.showNotification(`Purchased ${upgrade.type} upgrade!`);
        return true;
      },
      onClose: () => {
        this.amenityPanel?.hide();
      },
    });
  }

  private setupCourseLayoutPanel(): void {
    const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "CourseLayoutUI",
      true,
      this.scene
    );

    this.courseLayoutPanel = new CourseLayoutPanel(uiTexture, {
      onClose: () => {
        this.courseLayoutPanel?.hide();
      },
      onOpenHoleBuilder: () => {
        this.courseLayoutPanel?.hide();
        this.systems.onHoleBuilder?.();
      },
      onOpenTerrainShaper: () => {
        this.courseLayoutPanel?.hide();
        this.systems.onTerrainEditor?.();
      },
      onOpenAssetBuilder: () => {
        this.courseLayoutPanel?.hide();
        this.systems.onAssetBuilder?.();
      },
    });
    this.courseLayoutPanel.update(this.state.currentCourse?.holes ?? []);
  }

  private setupEntityInspector(): void {
    const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "EntityInspectorUI",
      true,
      this.scene
    );
    this.entityInspectorPanel = new EntityInspectorPanel(uiTexture, () => {
      this.entityInspectorPanel?.hide();
    });
  }

  showRobotInspector(robot: RobotUnit): void {
    this.entityInspectorPanel?.showRobot(
      robot,
      this.getAreaName(robot.assignedAreaId ?? null),
      {
        label: 'Sell Robot',
        tone: 'danger',
        onClick: () => {
          if (this.sellRobotById(robot.id)) {
            this.entityInspectorPanel?.hide();
          }
        },
      }
    );
  }

  showEmployeeInspector(employee: Employee, currentTask: import("../core/employee-work").EmployeeTask, worldX: number, worldZ: number): void {
    this.entityInspectorPanel?.showEmployee(
      employee,
      currentTask,
      worldX,
      worldZ,
      this.getAreaName(employee.assignedArea),
      employee.assignedFocus ?? 'balanced',
      {
        label: 'Fire Employee',
        tone: 'danger',
        onClick: () => {
          if (this.fireEmployeeById(employee.id)) {
            this.entityInspectorPanel?.hide();
          }
        },
      }
    );
  }

  showGolferInspector(golfer: Golfer, worldX: number, worldZ: number): void {
    this.entityInspectorPanel?.showGolfer(
      golfer,
      worldX,
      worldZ,
      null
    );
  }

  showAssetInspector(asset: PlacedAsset, canDelete: boolean = true): void {
    const facilitySnapshot = this.getFacilitySnapshot(asset.assetId);
    this.entityInspectorPanel?.showAsset(
      asset,
      canDelete,
      facilitySnapshot,
      canDelete
        ? {
            label: 'Delete Asset',
            tone: 'danger',
            onClick: () => {
              this.systems.onDeleteScenarioAsset?.(asset);
              this.entityInspectorPanel?.hide();
            },
          }
        : null
    );
  }

  hideEntityInspector(): void {
    this.entityInspectorPanel?.hide();
  }

  updateEntityInspector(robot: RobotUnit): void {
    this.entityInspectorPanel?.update(robot, this.getAreaName(robot.assignedAreaId ?? null));
  }

  isEntityInspectorVisible(): boolean {
    return this.entityInspectorPanel?.isVisible() ?? false;
  }

  getEntityInspectorTrackedRobotId(): string | null {
    return this.entityInspectorPanel?.getTrackedRobotId() ?? null;
  }

  isEntityInspectorBlockingPointer(screenX: number, screenY: number): boolean {
    if (!this.entityInspectorPanel?.isVisible()) return false;
    const canvas = this.scene?.getEngine?.()?.getRenderingCanvas?.();
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    const x = screenX - rect.left;
    const y = screenY - rect.top;
    const panelLeft = rect.width - (ENTITY_INSPECTOR_BOUNDS.width + ENTITY_INSPECTOR_BOUNDS.right);
    return (
      x >= panelLeft &&
      x <= panelLeft + ENTITY_INSPECTOR_BOUNDS.width &&
      y >= ENTITY_INSPECTOR_BOUNDS.top &&
      y <= ENTITY_INSPECTOR_BOUNDS.top + ENTITY_INSPECTOR_BOUNDS.height
    );
  }

  private setupIrrigationUI(): void {
    const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "IrrigationUI",
      true,
      this.scene
    );

    this.irrigationToolbar = new IrrigationToolbar(uiTexture, {
      onToolSelect: (tool) => {
        this.irrigationTool = tool;
        if (tool) {
          this.systems.uiManager.showNotification(
            `Irrigation tool: ${tool.toUpperCase()}`
          );
        } else {
          this.systems.uiManager.showNotification("Irrigation tool cleared");
        }
      },
      onPipeTypeSelect: (type) => {
        if (!type) return;
        this.selectedPipeType = type;
        this.systems.uiManager.showNotification(
          `Pipe type: ${type.toUpperCase()}`
        );
      },
      onSprinklerTypeSelect: (type) => {
        if (!type) return;
        this.selectedSprinklerType = type;
        this.systems.uiManager.showNotification(
          `Sprinkler type: ${type.toUpperCase()}`
        );
      },
      onClose: () => {
        this.hideIrrigationPanels();
      },
    });

    this.irrigationInfoPanel = new IrrigationInfoPanel(uiTexture, {
      onClose: () => {
        this.irrigationInfoPanel?.hide();
      },
      onManageSchedule: (headId) => {
        const head = this.state.irrigationSystem.sprinklerHeads.find(
          (sprinklerHead) => sprinklerHead.id === headId
        );
        if (head) {
          this.irrigationSchedulePanel?.showForSprinkler(head);
        }
      },
      onRepair: (x, y) => {
        const repairCost = 20;
        if (!canAfford(this.state.economyState, repairCost)) {
          this.systems.uiManager.showNotification(
            `⚠️ Not enough cash! Need $${repairCost}`,
            "#ff4444"
          );
          return;
        }
        const result = repairLeak(this.state.irrigationSystem, x, y);
        if (result) {
          const timestamp = this.state.gameDay * 24 * 60 + this.state.gameTime;
          const expenseResult = addExpense(
            this.state.economyState,
            repairCost,
            "equipment_maintenance",
            "Pipe leak repair",
            timestamp,
            false
          );
          if (expenseResult) {
            this.state.economyState = expenseResult;
            this.state.dailyStats.expenses.other += repairCost;
          }
          this.state.irrigationSystem = result;
          this.systems.irrigationRenderSystem?.update(this.state.irrigationSystem);
          this.systems.uiManager.showNotification(
            `Leak repaired ($${repairCost})`
          );
        } else {
          this.systems.uiManager.showNotification("No leak to repair");
        }
      },
    });

    this.irrigationSchedulePanel = new IrrigationSchedulePanel(uiTexture, {
      onClose: () => {
        this.irrigationSchedulePanel?.hide();
      },
      onScheduleUpdate: (headId, schedule) => {
        const currentHeads = this.state.irrigationSystem.sprinklerHeads ?? [];
        const currentHead = currentHeads.find((head) => head.id === headId);
        if (!currentHead) {
          this.irrigationSchedulePanel?.hide();
          this.irrigationInfoPanel?.hide();
          this.systems.uiManager.showNotification("Sprinkler no longer exists");
          return;
        }

        this.state.irrigationSystem = updateSprinklerSchedule(
          this.state.irrigationSystem,
          headId,
          schedule
        );
        this.systems.irrigationRenderSystem?.update(this.state.irrigationSystem);
        const updatedHead = (this.state.irrigationSystem.sprinklerHeads ?? []).find(
          (head) => head.id === headId
        );
        if (updatedHead) {
          this.irrigationInfoPanel?.showSprinklerInfo(
            updatedHead,
            this.getSprinklerPressureLevel(updatedHead.gridX, updatedHead.gridY)
          );
        }
        this.systems.uiManager.showNotification("Updated sprinkler schedule");
      },
    });
  }

  private getAreaName(areaId: string | null): string {
    return areaId === null
      ? 'All Course'
      : this.state.employeeWorkState.areas.find((area) => area.id === areaId)?.name ?? 'Assigned Area';
  }

  private fireEmployeeById(employeeId: string): boolean {
    const employee = this.state.employeeRoster.employees.find(
      (candidate) => candidate.id === employeeId
    );
    const result = fireEmployee(this.state.employeeRoster, employeeId);
    if (!result) {
      this.systems.uiManager.showNotification("Cannot fire employee");
      return false;
    }

    this.state.employeeRoster = result;
    this.state.employeeWorkState = syncWorkersWithRoster(
      this.state.employeeWorkState,
      this.state.employeeRoster.employees
    );
    if (employee) {
      this.systems.uiManager.showNotification(`Fired ${employee.name}`);
    }
    this.employeePanel?.update(this.state.employeeRoster, this.state.employeeWorkState, this.state.autonomousState);
    return true;
  }

  private sellRobotById(robotId: string): boolean {
    const result = sellRobot(this.state.autonomousState, robotId);
    if (!result) {
      this.systems.uiManager.showNotification("Cannot sell robot");
      return false;
    }

    this.state.autonomousState = result.state;
    const timestamp = this.state.gameDay * 24 * 60 + this.state.gameTime;
    const incomeResult = addIncome(
      this.state.economyState,
      result.refund,
      "other_income",
      `Robot sold: ${robotId}`,
      timestamp
    );
    if (incomeResult) {
      this.state.economyState = incomeResult;
      this.state.dailyStats.revenue.other += result.refund;
    }
    this.equipmentStorePanel?.update(
      this.state.researchState,
      this.state.autonomousState,
      this.state.economyState.cash,
      this.state.employeeWorkState.areas
    );
    this.systems.uiManager.showNotification(
      `Sold robot for $${result.refund.toLocaleString()}`
    );
    return true;
  }

  private getFacilitySnapshot(assetId: string): {
    category: 'facility' | 'utility' | 'prop';
    status: string;
    sectionTitle: string;
    metrics: Array<{
      label: string;
      value: string;
      tone?: string;
    }>;
    note: string;
  } | null {
    const golfers = this.state.golferPool?.golfers ?? [];
    const activeGolfers = golfers.filter(
      (golfer) => golfer.status !== 'leaving'
    ).length;
    const servedGolfers = this.state.golferPool?.totalVisitorsToday ?? 0;
    const peakCapacity = this.state.golferPool?.peakCapacity ?? 0;
    const avgSatisfaction = activeGolfers > 0
      ? Math.round(
          golfers
            .filter((golfer) => golfer.status !== 'leaving')
            .reduce((total, golfer) => total + golfer.satisfaction, 0) / activeGolfers
        )
      : 0;
    const dailyRevenue = this.state.revenueState?.todaysRevenue ?? {
      greenFees: 0,
      cartFees: 0,
      addOnServices: 0,
      tips: 0,
      proShop: 0,
      grossRevenue: 0,
      foodAndBeverage: 0,
      rangeRevenue: 0,
      lessonRevenue: 0,
      eventFees: 0,
      operatingCosts: 0,
      netRevenue: 0,
    };
    const crewSize = this.state.employeeRoster.employees.length;
    const assignedCrew = this.state.employeeRoster.employees.filter(
      (employee) => employee.assignedArea !== null
    ).length;
    const robots = this.state.autonomousState.robots;
    const workingRobots = robots.filter(
      (robot) => robot.state === 'working' || robot.state === 'moving'
    ).length;
    const serviceHubCount = this.state.currentCourse
      ? getRuntimeRefillStationsFromState(this.state).length
      : 0;
    const utilization = peakCapacity > 0
      ? `${Math.min(999, Math.round((activeGolfers / peakCapacity) * 100))}%`
      : 'n/a';

    if (assetId.startsWith('building.clubhouse')) {
      return {
        category: 'facility',
        status: activeGolfers > 0 ? 'Open and serving guests' : 'Ready for the next wave',
        sectionTitle: 'Operations',
        metrics: [
          {
            label: 'Active Golfers',
            value: `${activeGolfers}`,
          },
          {
            label: 'Utilization',
            value: utilization,
          },
          {
            label: 'Amenity Score',
            value: `${Math.round(this.state.prestigeState.amenityScore)}`,
            tone: UI_THEME.colors.text.info,
          },
          {
            label: 'Today Gross',
            value: `$${Math.round(dailyRevenue.grossRevenue)}`,
          },
        ],
        note: 'The clubhouse is the anchor facility. Even before full room-by-room simulation exists, this card should tell you whether the course is converting guest traffic into a stronger experience and better spend.',
      };
    }

    if (assetId === 'amenity.snack.bar' || assetId === 'amenity.cooler') {
      return {
        category: 'facility',
        status: activeGolfers > 0 ? 'Serving the course' : 'Standing by',
        sectionTitle: 'Service Load',
        metrics: [
          {
            label: 'F&B Today',
            value: `$${Math.round(dailyRevenue.foodAndBeverage)}`,
            tone: UI_THEME.colors.text.info,
          },
          {
            label: 'Active Golfers',
            value: `${activeGolfers}`,
          },
          {
            label: 'Served Today',
            value: `${servedGolfers}`,
          },
          {
            label: 'Avg Satisfaction',
            value: avgSatisfaction > 0 ? `${avgSatisfaction}%` : 'n/a',
          },
        ],
        note: 'Food-and-beverage assets should eventually expose throughput, queue pressure, and stocking. For now this shows the demand signal already present in the sim.',
      };
    }

    if (
      assetId === 'building.maintenance.shed' ||
      assetId === 'building.pump.house' ||
      assetId === 'building.cart.barn' ||
      assetId === 'building.refill.station' ||
      assetId === 'building.starter.hut'
    ) {
      return {
        category: 'utility',
        status: workingRobots > 0 || assignedCrew > 0 ? 'Supporting active operations' : 'Ready for demand',
        sectionTitle: 'Ops Support',
        metrics: [
          {
            label: 'Crew Size',
            value: `${crewSize}`,
          },
          {
            label: 'Assigned Crew',
            value: `${assignedCrew}`,
          },
          {
            label: 'Working Robots',
            value: `${workingRobots}`,
            tone: workingRobots > 0 ? UI_THEME.colors.text.success : UI_THEME.colors.text.secondary,
          },
          {
            label: 'Service Hubs',
            value: `${serviceHubCount}`,
          },
        ],
        note: 'This is an operational support building. Later this should surface real maintenance load, equipment utilization, and queueing at the service hub.',
      };
    }

    if (assetId === 'amenity.restroom' || assetId === 'amenity.shelter.small' || assetId === 'amenity.drinking.fountain') {
      return {
        category: 'utility',
        status: activeGolfers > 0 ? 'Available to guests' : 'Idle',
        sectionTitle: 'Guest Impact',
        metrics: [
          {
            label: 'Active Golfers',
            value: `${activeGolfers}`,
          },
          {
            label: 'Served Today',
            value: `${servedGolfers}`,
          },
          {
            label: 'Amenity Score',
            value: `${Math.round(this.state.prestigeState.amenityScore)}`,
            tone: UI_THEME.colors.text.info,
          },
          {
            label: 'Avg Satisfaction',
            value: avgSatisfaction > 0 ? `${avgSatisfaction}%` : 'n/a',
          },
        ],
        note: 'Guest-comfort assets are now inspectable. The next step is tying them to satisfaction pressure instead of only broad amenity score.',
      };
    }

    return null;
  }

  private onRegionTaskAssigned: ((region: import('../core/named-region').NamedRegion, taskType: import('../core/job').JobTaskType) => void) | null = null;

  setOnRegionTaskAssigned(cb: (region: import('../core/named-region').NamedRegion, taskType: import('../core/job').JobTaskType) => void): void {
    this.onRegionTaskAssigned = cb;
  }

  private setupRegionInfoPanel(): void {
    const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "RegionInfoUI",
      true,
      this.scene
    );

    this.regionInfoPanel = new RegionInfoPanel(uiTexture, {
      onAssignTask: (region, taskType) => {
        this.onRegionTaskAssigned?.(region, taskType);
      },
      onClose: () => {},
    });
  }

  showRegionInfo(region: import('../core/named-region').NamedRegion, stats: import('../core/standing-orders').RegionStats, hasActiveJob: boolean): void {
    this.regionInfoPanel?.show(region, stats, hasActiveJob);
  }

  hideRegionInfo(): void {
    this.regionInfoPanel?.hide();
  }

  isRegionInfoVisible(): boolean {
    return this.regionInfoPanel?.isVisible() ?? false;
  }

  private setupPriceCallback(): void {
    this.systems.uiManager.setPriceCallback((delta: number) => {
      const newPrice = Math.max(
        5,
        Math.min(500, this.state.greenFees.weekday18Holes + delta)
      );
      if (newPrice !== this.state.greenFees.weekday18Holes) {
        this.state.greenFees = {
          ...this.state.greenFees,
          weekday18Holes: newPrice,
          weekday9Holes: Math.round(newPrice * 0.6),
          weekend18Holes: Math.round(newPrice * 1.2),
          weekend9Holes: Math.round(newPrice * 0.72),
          twilight18Holes: Math.round(newPrice * 0.6),
          twilight9Holes: Math.round(newPrice * 0.36),
        };
        this.systems.uiManager.updateCurrentPrice(newPrice);
      }
    });
    this.systems.uiManager.updateCurrentPrice(this.state.greenFees.weekday18Holes);
  }

  private get managementPanels() {
    return [
      this.employeePanel, this.researchPanel, this.teeSheetPanel,
      this.equipmentStorePanel, this.amenityPanel, this.courseLayoutPanel,
    ];
  }

  private get allClosablePanels() {
    return [
      this.irrigationSchedulePanel, this.courseLayoutPanel, this.amenityPanel,
      this.equipmentStorePanel, this.teeSheetPanel, this.researchPanel,
      this.employeePanel, this.irrigationInfoPanel, this.entityInspectorPanel,
      this.regionInfoPanel,
    ];
  }

  private closeAllManagementPanels(): void {
    for (const panel of this.managementPanels) {
      if (panel?.isVisible()) panel.hide();
    }
  }

  handleEmployeePanel(): void {
    if (this.employeePanel?.isVisible()) {
      this.employeePanel.hide();
    } else {
      this.closeAllManagementPanels();
      const currentTime = this.state.gameTime + this.state.gameDay * 24 * 60;
      this.employeePanel?.update(this.state.employeeRoster, this.state.employeeWorkState, this.state.autonomousState);
      this.employeePanel?.updateApplications(
        this.state.applicationState,
        this.state.prestigeState.tier,
        currentTime
      );
      this.employeePanel?.show();
    }
  }

  refreshLivePanels(): void {
    if (this.employeePanel?.isVisible()) {
      const currentTime = this.state.gameTime + this.state.gameDay * 24 * 60;
      this.employeePanel.updateApplications(
        this.state.applicationState,
        this.state.prestigeState.tier,
        currentTime
      );
    }

    if (this.equipmentStorePanel?.isVisible()) {
      this.equipmentStorePanel.update(
        this.state.researchState,
        this.state.autonomousState,
        this.state.economyState.cash,
        this.state.employeeWorkState.areas
      );
    }
  }

  handleResearchPanel(): void {
    if (this.researchPanel?.isVisible()) {
      this.researchPanel.hide();
    } else {
      this.closeAllManagementPanels();
      this.researchPanel?.update(this.state.researchState);
      this.researchPanel?.show();
    }
  }

  handleTeeSheetPanel(): void {
    if (this.teeSheetPanel?.isVisible()) {
      this.teeSheetPanel.hide();
    } else {
      this.closeAllManagementPanels();
      this.teeSheetViewDay = this.state.gameDay;
      this.teeSheetPanel?.update(this.state.teeTimeState, this.teeSheetViewDay);
      this.teeSheetPanel?.show();
    }
  }

  handleEquipmentStore(): void {
    if (this.equipmentStorePanel?.isVisible()) {
      this.equipmentStorePanel.hide();
    } else {
      this.closeAllManagementPanels();
      this.equipmentStorePanel?.update(
        this.state.researchState,
        this.state.autonomousState,
        this.state.economyState.cash,
        this.state.employeeWorkState.areas
      );
      this.equipmentStorePanel?.show();
    }
  }

  handleAmenityPanel(): void {
    if (this.amenityPanel?.isVisible()) {
      this.amenityPanel.hide();
    } else {
      this.closeAllManagementPanels();
      this.amenityPanel?.update(this.state.prestigeState, this.state.economyState.cash);
      this.amenityPanel?.show();
    }
  }

  handleCourseLayoutPanel(): void {
    if (this.courseLayoutPanel?.isVisible()) {
      this.courseLayoutPanel.hide();
      return;
    }

    this.closeAllManagementPanels();
    const holes = this.state.currentCourse?.holes ?? [];
    this.courseLayoutPanel?.update(holes);
    this.courseLayoutPanel?.show();
  }

  refreshCourseLayoutPanel(): void {
    if (!this.courseLayoutPanel?.isVisible()) return;
    this.courseLayoutPanel.update(this.state.currentCourse?.holes ?? []);
  }

  toggleIrrigationToolbar(): void {
    if (!this.irrigationToolbar) return;

    if (this.irrigationToolbar.isVisible()) {
      this.hideIrrigationPanels();
      return;
    }

    this.ensureIrrigationWaterSource();
    this.irrigationTool = null;
    this.irrigationToolbar.resetToolSelection();
    this.irrigationToolbar.show();
    this.irrigationInfoPanel?.hide();
    this.irrigationSchedulePanel?.hide();
  }

  hideIrrigationPanels(): void {
    this.irrigationToolbar?.hide();
    this.irrigationToolbar?.resetToolSelection();
    this.irrigationInfoPanel?.hide();
    this.irrigationSchedulePanel?.hide();
    this.irrigationTool = null;
  }

  handleIrrigationGridAction(gridX: number, gridY: number): void {
    if (!this.irrigationToolbar?.isVisible()) return;
    if (!this.irrigationTool) {
      this.systems.uiManager.showNotification(
        "Select Pipe, Sprinkler, Delete, or Info first"
      );
      return;
    }

    if (this.irrigationTool === "pipe") {
      this.handlePipePlacement(gridX, gridY);
      return;
    }

    if (this.irrigationTool === "sprinkler") {
      this.handleSprinklerPlacement(gridX, gridY);
      return;
    }

    if (this.irrigationTool === "delete") {
      this.handleIrrigationDelete(gridX, gridY);
      return;
    }

    if (this.irrigationTool === "info") {
      this.showIrrigationInfo(gridX, gridY);
    }
  }

  isIrrigationToolbarVisible(): boolean {
    return this.irrigationToolbar?.isVisible() ?? false;
  }

  isModalDialogVisible(): boolean {
    return this.managementPanels.some(p => p?.isVisible()) ||
      (this.daySummaryPopup?.isVisible() ?? false) ||
      (this.irrigationSchedulePanel?.isVisible() ?? false);
  }

  closeTopmostPanel(): boolean {
    for (const panel of this.allClosablePanels) {
      if (panel?.isVisible()) {
        panel.hide();
        return true;
      }
    }
    return false;
  }

  isIrrigationUIBlockingPointer(screenX: number, screenY: number): boolean {
    const canvas = this.scene?.getEngine?.()?.getRenderingCanvas?.();
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    const x = screenX - rect.left;
    const y = screenY - rect.top;

    const isInside = (
      left: number,
      top: number,
      width: number,
      height: number
    ): boolean => x >= left && x <= left + width && y >= top && y <= top + height;

    if (
      this.irrigationToolbar?.isVisible() &&
      isInside(
        IRRIGATION_TOOLBAR_BOUNDS.left,
        IRRIGATION_TOOLBAR_BOUNDS.top,
        IRRIGATION_TOOLBAR_BOUNDS.width,
        IRRIGATION_TOOLBAR_BOUNDS.height
      )
    ) {
      return true;
    }

    if (
      this.irrigationInfoPanel?.isVisible() &&
      isInside(
        rect.width -
          (IRRIGATION_INFO_PANEL_BOUNDS.width + IRRIGATION_INFO_PANEL_BOUNDS.right),
        IRRIGATION_INFO_PANEL_BOUNDS.top,
        IRRIGATION_INFO_PANEL_BOUNDS.width,
        IRRIGATION_INFO_PANEL_BOUNDS.height
      )
    ) {
      return true;
    }

    if (this.irrigationSchedulePanel?.isVisible()) {
      const panelWidth = IRRIGATION_SCHEDULE_PANEL_BOUNDS.width;
      const panelHeight = IRRIGATION_SCHEDULE_PANEL_BOUNDS.height;
      const left = rect.width / 2 - panelWidth / 2;
      const top = rect.height / 2 - panelHeight / 2;
      if (isInside(left, top, panelWidth, panelHeight)) {
        return true;
      }
    }

    return false;
  }

  private ensureIrrigationWaterSource(): void {
    if (this.state.irrigationSystem.waterSources.length > 0) return;

    const maxX = Math.max(0, this.state.currentCourse.width - 1);
    const maxY = Math.max(0, this.state.currentCourse.height - 1);
    const defaultSource =
      getRuntimeRefillStationsFromState(this.state)[0] ?? {
        x: Math.floor(this.state.currentCourse.width / 2),
        y: Math.floor(this.state.currentCourse.height / 2),
      };
    const sourceX = Math.min(Math.max(0, defaultSource.x), maxX);
    const sourceY = Math.min(Math.max(0, defaultSource.y), maxY);

    this.state.irrigationSystem = addWaterSource(
      this.state.irrigationSystem,
      "municipal",
      sourceX,
      sourceY
    );
    this.systems.irrigationRenderSystem?.update(this.state.irrigationSystem);
    this.systems.uiManager.showNotification("Municipal water source connected");
  }

  private handlePipePlacement(gridX: number, gridY: number): void {
    const existingPipe = getPipeAt(this.state.irrigationSystem, gridX, gridY);
    if (existingPipe) {
      this.systems.uiManager.showNotification("Pipe already exists here");
      return;
    }

    const cost = PIPE_CONFIGS[this.selectedPipeType].cost;
    if (!canAfford(this.state.economyState, cost)) {
      this.systems.uiManager.showNotification(
        `⚠️ Need $${cost} to place ${this.selectedPipeType} pipe`,
        "#ff4444"
      );
      return;
    }

    const timestamp = this.state.gameDay * 24 * 60 + this.state.gameTime;
    this.state.irrigationSystem = addPipe(
      this.state.irrigationSystem,
      gridX,
      gridY,
      this.selectedPipeType,
      timestamp
    );

    const expenseResult = addExpense(
      this.state.economyState,
      cost,
      "construction",
      `Pipe installation: ${this.selectedPipeType}`,
      timestamp,
      false
    );
    if (expenseResult) {
      this.state.economyState = expenseResult;
      this.state.dailyStats.expenses.other += cost;
    }

    this.systems.irrigationRenderSystem?.update(this.state.irrigationSystem);
    this.systems.uiManager.showNotification(
      `Placed ${this.selectedPipeType.toUpperCase()} pipe ($${cost})`
    );
  }

  private handleSprinklerPlacement(gridX: number, gridY: number): void {
    const existingHead = getSprinklerHeadAt(this.state.irrigationSystem, gridX, gridY);
    if (existingHead) {
      this.systems.uiManager.showNotification("Sprinkler already exists here");
      return;
    }

    const installCost = SPRINKLER_CONFIGS[this.selectedSprinklerType].cost + 20;
    if (!canAfford(this.state.economyState, installCost)) {
      this.systems.uiManager.showNotification(
        `⚠️ Need $${installCost} to place ${this.selectedSprinklerType} sprinkler`,
        "#ff4444"
      );
      return;
    }

    const timestamp = this.state.gameDay * 24 * 60 + this.state.gameTime;
    this.state.irrigationSystem = addSprinklerHead(
      this.state.irrigationSystem,
      gridX,
      gridY,
      this.selectedSprinklerType,
      timestamp
    );

    const expenseResult = addExpense(
      this.state.economyState,
      installCost,
      "construction",
      `Sprinkler installation: ${this.selectedSprinklerType}`,
      timestamp,
      false
    );
    if (expenseResult) {
      this.state.economyState = expenseResult;
      this.state.dailyStats.expenses.other += installCost;
    }

    this.systems.irrigationRenderSystem?.update(this.state.irrigationSystem);
    this.systems.uiManager.showNotification(
      `Placed ${this.selectedSprinklerType.toUpperCase()} sprinkler ($${installCost})`
    );
  }

  private handleIrrigationDelete(gridX: number, gridY: number): void {
    const sprinkler = getSprinklerHeadAt(this.state.irrigationSystem, gridX, gridY);
    if (sprinkler) {
      this.state.irrigationSystem = removeSprinklerHead(
        this.state.irrigationSystem,
        sprinkler.id
      );
      this.systems.irrigationRenderSystem?.update(this.state.irrigationSystem);
      this.systems.uiManager.showNotification("Removed sprinkler");
      this.irrigationInfoPanel?.hide();
      this.irrigationSchedulePanel?.hide();
      return;
    }

    const pipe = getPipeAt(this.state.irrigationSystem, gridX, gridY);
    if (pipe) {
      this.state.irrigationSystem = removePipe(
        this.state.irrigationSystem,
        gridX,
        gridY
      );
      this.systems.irrigationRenderSystem?.update(this.state.irrigationSystem);
      this.systems.uiManager.showNotification("Removed pipe");
      this.irrigationInfoPanel?.hide();
      this.irrigationSchedulePanel?.hide();
      return;
    }

    this.systems.uiManager.showNotification("No irrigation part at this tile");
  }

  private showIrrigationInfo(gridX: number, gridY: number): void {
    const sprinkler = getSprinklerHeadAt(this.state.irrigationSystem, gridX, gridY);
    if (sprinkler) {
      this.irrigationInfoPanel?.showSprinklerInfo(
        sprinkler,
        this.getSprinklerPressureLevel(gridX, gridY)
      );
      return;
    }

    const pipe = getPipeAt(this.state.irrigationSystem, gridX, gridY);
    if (pipe) {
      this.irrigationInfoPanel?.showPipeInfo(pipe);
      return;
    }

    this.irrigationInfoPanel?.hide();
    this.irrigationSchedulePanel?.hide();
    this.systems.uiManager.showNotification("No irrigation component here");
  }

  private getSprinklerPressureLevel(gridX: number, gridY: number): number {
    const pipe = getPipeAt(this.state.irrigationSystem, gridX, gridY);
    return pipe?.pressureLevel ?? 0;
  }

  showDaySummary(data: DaySummaryData): void {
    this.closeAllManagementPanels();
    this.hideRegionInfo();
    this.hideEntityInspector();
    this.daySummaryPopup?.show(data);
    this.state.isPaused = true;
  }

  getIrrigationToolbar(): IrrigationToolbar | null {
    return this.irrigationToolbar;
  }

  getIrrigationInfoPanel(): IrrigationInfoPanel | null {
    return this.irrigationInfoPanel;
  }

  getIrrigationSchedulePanel(): IrrigationSchedulePanel | null {
    return this.irrigationSchedulePanel;
  }

  getTeeSheetViewDay(): number {
    return this.teeSheetViewDay;
  }

  getAutomationPanelState(): Record<string, boolean> {
    return {
      employee: this.employeePanel?.isVisible() ?? false,
      research: this.researchPanel?.isVisible() ?? false,
      daySummary: this.daySummaryPopup?.isVisible() ?? false,
      teeSheet: this.teeSheetPanel?.isVisible() ?? false,
      equipmentStore: this.equipmentStorePanel?.isVisible() ?? false,
      amenity: this.amenityPanel?.isVisible() ?? false,
      courseLayout: this.courseLayoutPanel?.isVisible() ?? false,
      irrigationToolbar: this.irrigationToolbar?.isVisible() ?? false,
      irrigationInfo: this.irrigationInfoPanel?.isVisible() ?? false,
      irrigationSchedule: this.irrigationSchedulePanel?.isVisible() ?? false,
      entityInspector: this.entityInspectorPanel?.isVisible() ?? false,
      regionInfo: this.regionInfoPanel?.isVisible() ?? false,
    };
  }

  setTeeSheetViewDay(v: number): void {
    this.teeSheetViewDay = v;
  }

  dispose(): void {
    this.employeePanel?.dispose();
    this.researchPanel?.dispose();
    this.daySummaryPopup?.dispose();
    this.teeSheetPanel?.dispose();
    this.equipmentStorePanel?.dispose();
    this.amenityPanel?.dispose();
    this.courseLayoutPanel?.dispose();
    this.irrigationToolbar?.dispose();
    this.irrigationInfoPanel?.dispose();
    this.irrigationSchedulePanel?.dispose();
    this.entityInspectorPanel?.dispose();
  }
}
