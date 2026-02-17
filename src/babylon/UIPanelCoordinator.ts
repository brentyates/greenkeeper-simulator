import { Scene } from "@babylonjs/core/scene";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";

import { EmployeePanel } from "./ui/EmployeePanel";
import { ResearchPanel } from "./ui/ResearchPanel";
import { DaySummaryPopup, DaySummaryData } from "./ui/DaySummaryPopup";
import { TeeSheetPanel } from "./ui/TeeSheetPanel";
import { MarketingDashboard } from "./ui/MarketingDashboard";
import { EquipmentStorePanel } from "./ui/EquipmentStorePanel";
import { AmenityPanel } from "./ui/AmenityPanel";
import { WalkOnQueuePanel } from "./ui/WalkOnQueuePanel";
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
import { UIManager } from "./ui/UIManager";
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
  EMPLOYEE_ROLE_INFO,
  hireEmployee,
  fireEmployee,
  createInitialApplicationState,
  postJobOpening,
  acceptApplication,
  getPostingCost,
  Employee,
} from "../core/employees";
import {
  syncWorkersWithRoster,
} from "../core/employee-work";
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
  startCampaign,
  stopCampaign,
} from "../core/marketing";
import {
  purchaseRobot,
  sellRobot,
  RobotUnit,
} from "../core/autonomous-equipment";
import { IrrigationRenderSystem } from "./systems/IrrigationRenderSystem";

export interface UIPanelSystems {
  uiManager: UIManager;
  irrigationRenderSystem: IrrigationRenderSystem | null;
  resetDailyStats: () => void;
  pauseGame: () => void;
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
  private marketingDashboard: MarketingDashboard | null = null;
  private equipmentStorePanel: EquipmentStorePanel | null = null;
  private amenityPanel: AmenityPanel | null = null;
  private walkOnQueuePanel: WalkOnQueuePanel | null = null;
  private courseLayoutPanel: CourseLayoutPanel | null = null;
  private irrigationToolbar: IrrigationToolbar | null = null;
  private irrigationInfoPanel: IrrigationInfoPanel | null = null;
  private irrigationSchedulePanel: IrrigationSchedulePanel | null = null;
  private entityInspectorPanel: EntityInspectorPanel | null = null;
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
    this.setupMarketingDashboard();
    this.setupEquipmentStorePanel();
    this.setupAmenityPanel();
    this.setupWalkOnQueuePanel();
    this.setupCourseLayoutPanel();
    this.setupIrrigationUI();
    this.setupEntityInspector();
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
          this.employeePanel?.update(this.state.employeeRoster);
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
          this.employeePanel?.update(this.state.employeeRoster);
        }
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

    this.employeePanel.update(this.state.employeeRoster);

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

  private setupMarketingDashboard(): void {
    const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "MarketingUI",
      true,
      this.scene
    );

    this.marketingDashboard = new MarketingDashboard(uiTexture, {
      onStartCampaign: (campaignId: string, duration: number) => {
        const result = startCampaign(
          this.state.marketingState,
          campaignId,
          this.state.gameDay,
          duration
        );
        if (result) {
          this.state.marketingState = result.state;
          if (result.setupCost > 0) {
            const timestamp = this.state.gameDay * 24 * 60 + this.state.gameTime;
            const expenseResult = addExpense(
              this.state.economyState,
              result.setupCost,
              "marketing",
              "Campaign setup",
              timestamp,
              false
            );
            if (expenseResult) {
              this.state.economyState = expenseResult;
              this.state.dailyStats.expenses.other += result.setupCost;
            }
          }
          this.marketingDashboard?.update(
            this.state.marketingState,
            this.state.gameDay,
            this.state.economyState.cash
          );
          this.systems.uiManager.showNotification("Campaign started!");
        }
      },
      onStopCampaign: (campaignId: string) => {
        const result = stopCampaign(
          this.state.marketingState,
          campaignId,
          this.state.gameDay
        );
        this.state.marketingState = result;
        this.marketingDashboard?.update(
          this.state.marketingState,
          this.state.gameDay,
          this.state.economyState.cash
        );
        this.systems.uiManager.showNotification("Campaign stopped");
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
            this.state.economyState.cash
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
            this.state.economyState.cash
          );
          this.systems.uiManager.showNotification(
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

  private setupWalkOnQueuePanel(): void {
    const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "WalkOnQueueUI",
      true,
      this.scene
    );

    this.walkOnQueuePanel = new WalkOnQueuePanel(uiTexture, {
      onAssignToSlot: (_golferId: string) => {
        this.systems.uiManager.showNotification(
          `Assigned golfer to next available slot`
        );
        this.walkOnQueuePanel?.update(this.state.walkOnState);
      },
      onTurnAway: (golferId: string) => {
        const golfer = this.state.walkOnState.queue.find(
          (g) => g.golferId === golferId
        );
        if (golfer) {
          golfer.status = "turned_away";
          this.state.walkOnState.metrics.walkOnsTurnedAwayToday++;
          this.walkOnQueuePanel?.update(this.state.walkOnState);
          this.systems.uiManager.showNotification(`Turned away ${golfer.name}`);
        }
      },
      onClose: () => {
        this.walkOnQueuePanel?.hide();
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
    this.entityInspectorPanel?.showRobot(robot);
  }

  hideEntityInspector(): void {
    this.entityInspectorPanel?.hide();
  }

  updateEntityInspector(robot: RobotUnit): void {
    this.entityInspectorPanel?.update(robot);
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

  handleEmployeePanel(): void {
    if (this.employeePanel?.isVisible()) {
      this.employeePanel.hide();
    } else {
      const currentTime = this.state.gameTime + this.state.gameDay * 24 * 60;
      this.employeePanel?.update(this.state.employeeRoster);
      this.employeePanel?.updateApplications(
        this.state.applicationState,
        this.state.prestigeState.tier,
        currentTime
      );
      this.employeePanel?.show();
    }
  }

  handleResearchPanel(): void {
    if (this.researchPanel?.isVisible()) {
      this.researchPanel.hide();
    } else {
      this.researchPanel?.update(this.state.researchState);
      this.researchPanel?.show();
    }
  }

  handleTeeSheetPanel(): void {
    if (this.teeSheetPanel?.isVisible()) {
      this.teeSheetPanel.hide();
    } else {
      this.teeSheetViewDay = this.state.gameDay;
      this.teeSheetPanel?.update(this.state.teeTimeState, this.teeSheetViewDay);
      this.teeSheetPanel?.show();
    }
  }

  handleMarketingPanel(): void {
    if (this.marketingDashboard?.isVisible()) {
      this.marketingDashboard.hide();
    } else {
      this.marketingDashboard?.update(
        this.state.marketingState,
        this.state.gameDay,
        this.state.economyState.cash
      );
      this.marketingDashboard?.show();
    }
  }

  handleEquipmentStore(): void {
    if (this.equipmentStorePanel?.isVisible()) {
      this.equipmentStorePanel.hide();
    } else {
      this.equipmentStorePanel?.update(
        this.state.researchState,
        this.state.autonomousState,
        this.state.economyState.cash
      );
      this.equipmentStorePanel?.show();
    }
  }

  handleAmenityPanel(): void {
    if (this.amenityPanel?.isVisible()) {
      this.amenityPanel.hide();
    } else {
      this.amenityPanel?.update(this.state.prestigeState, this.state.economyState.cash);
      this.amenityPanel?.show();
    }
  }

  handleWalkOnQueuePanel(): void {
    if (this.walkOnQueuePanel?.isVisible()) {
      this.walkOnQueuePanel.hide();
    } else {
      this.walkOnQueuePanel?.update(this.state.walkOnState);
      this.walkOnQueuePanel?.show();
    }
  }

  handleCourseLayoutPanel(): void {
    if (this.courseLayoutPanel?.isVisible()) {
      this.courseLayoutPanel.hide();
      return;
    }

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
    return (
      (this.employeePanel?.isVisible() ?? false) ||
      (this.researchPanel?.isVisible() ?? false) ||
      (this.daySummaryPopup?.isVisible() ?? false) ||
      (this.teeSheetPanel?.isVisible() ?? false) ||
      (this.marketingDashboard?.isVisible() ?? false) ||
      (this.equipmentStorePanel?.isVisible() ?? false) ||
      (this.amenityPanel?.isVisible() ?? false) ||
      (this.walkOnQueuePanel?.isVisible() ?? false) ||
      (this.courseLayoutPanel?.isVisible() ?? false) ||
      (this.irrigationSchedulePanel?.isVisible() ?? false)
    );
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
    this.daySummaryPopup?.show(data);
    this.systems.pauseGame();
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

  setTeeSheetViewDay(v: number): void {
    this.teeSheetViewDay = v;
  }

  dispose(): void {
    this.employeePanel?.dispose();
    this.researchPanel?.dispose();
    this.daySummaryPopup?.dispose();
    this.teeSheetPanel?.dispose();
    this.marketingDashboard?.dispose();
    this.equipmentStorePanel?.dispose();
    this.amenityPanel?.dispose();
    this.walkOnQueuePanel?.dispose();
    this.courseLayoutPanel?.dispose();
    this.irrigationToolbar?.dispose();
    this.irrigationInfoPanel?.dispose();
    this.irrigationSchedulePanel?.dispose();
    this.entityInspectorPanel?.dispose();
  }
}
