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
import { IrrigationToolbar } from "./ui/IrrigationToolbar";
import { IrrigationInfoPanel } from "./ui/IrrigationInfoPanel";
import { IrrigationSchedulePanel } from "./ui/IrrigationSchedulePanel";
import { UIManager } from "./ui/UIManager";

import {
  EconomyState,
  addIncome,
  addExpense,
} from "../core/economy";
import {
  IrrigationSystem,
  repairLeak,
} from "../core/irrigation";
import {
  EmployeeRoster,
  EmployeeRole,
  EMPLOYEE_ROLE_INFO,
  hireEmployee,
  fireEmployee,
  ApplicationState,
  createInitialApplicationState,
  postJobOpening,
  acceptApplication,
  getPostingCost,
  Employee,
} from "../core/employees";
import {
  EmployeeWorkSystemState,
  syncWorkersWithRoster,
} from "../core/employee-work";
import {
  GreenFeeStructure,
} from "../core/golfers";
import {
  ResearchState,
  startResearch,
  cancelResearch,
  setFundingLevel,
  FundingLevel,
  RESEARCH_ITEMS,
  EquipmentStats,
} from "../core/research";
import {
  PrestigeState,
  upgradeAmenity,
} from "../core/prestige";
import { AmenityUpgrade, getUpgradeCost } from "../core/amenities";
import {
  TeeTimeSystemState,
  TeeTimeSpacing,
  checkInTeeTime,
  cancelTeeTime,
  markNoShow,
  updateSpacing,
} from "../core/tee-times";
import { WalkOnState } from "../core/walk-ons";
import { RevenueState } from "../core/tee-revenue";
import {
  MarketingState,
  startCampaign,
  stopCampaign,
} from "../core/marketing";
import {
  AutonomousEquipmentState,
  purchaseRobot,
  sellRobot,
} from "../core/autonomous-equipment";
import { IrrigationRenderSystem } from "./systems/IrrigationRenderSystem";

export interface UIPanelContext {
  get economyState(): EconomyState;
  set economyState(v: EconomyState);
  get employeeRoster(): EmployeeRoster;
  set employeeRoster(v: EmployeeRoster);
  get employeeWorkState(): EmployeeWorkSystemState;
  set employeeWorkState(v: EmployeeWorkSystemState);
  get applicationState(): ApplicationState;
  set applicationState(v: ApplicationState);
  get researchState(): ResearchState;
  set researchState(v: ResearchState);
  get prestigeState(): PrestigeState;
  set prestigeState(v: PrestigeState);
  get teeTimeState(): TeeTimeSystemState;
  set teeTimeState(v: TeeTimeSystemState);
  get walkOnState(): WalkOnState;
  set walkOnState(v: WalkOnState);
  get revenueState(): RevenueState;
  set revenueState(v: RevenueState);
  get marketingState(): MarketingState;
  set marketingState(v: MarketingState);
  get autonomousState(): AutonomousEquipmentState;
  set autonomousState(v: AutonomousEquipmentState);
  get irrigationSystem(): IrrigationSystem;
  set irrigationSystem(v: IrrigationSystem);
  get irrigationRenderSystem(): IrrigationRenderSystem | null;
  get greenFees(): GreenFeeStructure;
  set greenFees(v: GreenFeeStructure);
  get gameTime(): number;
  get gameDay(): number;
  get dailyStats(): {
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
  set dailyStats(v: UIPanelContext["dailyStats"]);
  uiManager: UIManager;
  resetDailyStats: () => void;
  pauseGame: () => void;
}

export class UIPanelCoordinator {
  private scene: Scene;
  private ctx: UIPanelContext;

  private employeePanel: EmployeePanel | null = null;
  private researchPanel: ResearchPanel | null = null;
  private daySummaryPopup: DaySummaryPopup | null = null;
  private teeSheetPanel: TeeSheetPanel | null = null;
  private teeSheetViewDay: number = 1;
  private marketingDashboard: MarketingDashboard | null = null;
  private equipmentStorePanel: EquipmentStorePanel | null = null;
  private amenityPanel: AmenityPanel | null = null;
  private walkOnQueuePanel: WalkOnQueuePanel | null = null;
  private irrigationToolbar: IrrigationToolbar | null = null;
  private irrigationInfoPanel: IrrigationInfoPanel | null = null;
  private irrigationSchedulePanel: IrrigationSchedulePanel | null = null;

  constructor(scene: Scene, ctx: UIPanelContext) {
    this.scene = scene;
    this.ctx = ctx;
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
    this.setupIrrigationUI();
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
        const result = hireEmployee(this.ctx.employeeRoster, employee);
        if (result) {
          this.ctx.employeeRoster = result;
          this.ctx.employeeWorkState = syncWorkersWithRoster(
            this.ctx.employeeWorkState,
            this.ctx.employeeRoster.employees
          );

          const updatedAppState = acceptApplication(
            this.ctx.applicationState,
            employee.id
          );
          if (updatedAppState) {
            this.ctx.applicationState = updatedAppState;
          }

          this.ctx.uiManager.showNotification(
            `Hired ${employee.name} as ${employee.role}`
          );
          this.employeePanel?.update(this.ctx.employeeRoster);
          this.employeePanel?.updateApplications(
            this.ctx.applicationState,
            this.ctx.prestigeState.tier,
            this.ctx.gameTime + this.ctx.gameDay * 24 * 60
          );
        } else {
          this.ctx.uiManager.showNotification("Cannot hire - roster full");
        }
      },
      onFire: (employeeId: string) => {
        const employee = this.ctx.employeeRoster.employees.find(
          (e) => e.id === employeeId
        );
        const result = fireEmployee(this.ctx.employeeRoster, employeeId);
        if (result) {
          this.ctx.employeeRoster = result;
          this.ctx.employeeWorkState = syncWorkersWithRoster(
            this.ctx.employeeWorkState,
            this.ctx.employeeRoster.employees
          );
          if (employee) {
            this.ctx.uiManager.showNotification(`Fired ${employee.name}`);
          }
          this.employeePanel?.update(this.ctx.employeeRoster);
        }
      },
      onClose: () => {
        this.employeePanel?.hide();
      },
      onPostJobOpening: (role: EmployeeRole) => {
        const cost = getPostingCost(this.ctx.prestigeState.tier);
        if (this.ctx.economyState.cash < cost) {
          this.ctx.uiManager.showNotification(
            `⚠️ Not enough cash! Need $${cost}`,
            "#ff4444"
          );
          return;
        }

        const currentTime = this.ctx.gameTime + this.ctx.gameDay * 24 * 60;
        const result = postJobOpening(
          this.ctx.applicationState,
          currentTime,
          this.ctx.prestigeState.tier,
          role
        );

        if (result) {
          this.ctx.applicationState = result.state;
          const timestamp = this.ctx.gameDay * 24 * 60 + this.ctx.gameTime;
          const expenseResult = addExpense(
            this.ctx.economyState,
            cost,
            "marketing",
            "Job Posting",
            timestamp,
            false
          );
          if (expenseResult) {
            this.ctx.economyState = expenseResult;
            this.ctx.dailyStats.expenses.other += cost;
          }

          const roleInfo = EMPLOYEE_ROLE_INFO[role];
          this.ctx.uiManager.showNotification(
            `📢 Hiring ${roleInfo.name}! Cost: $${cost}`
          );
          this.employeePanel?.updateApplications(
            this.ctx.applicationState,
            this.ctx.prestigeState.tier,
            currentTime
          );
        }
      },
    });

    this.employeePanel.update(this.ctx.employeeRoster);

    this.ctx.applicationState = createInitialApplicationState(
      this.ctx.gameTime + this.ctx.gameDay * 24 * 60,
      this.ctx.prestigeState.tier
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
        const currentTime = this.ctx.gameTime + this.ctx.gameDay * 24 * 60;
        const result = startResearch(this.ctx.researchState, itemId, currentTime);
        if (result) {
          this.ctx.researchState = result;
          const item = RESEARCH_ITEMS.find((i) => i.id === itemId);
          if (item) {
            this.ctx.uiManager.showNotification(
              `Started researching: ${item.name}`
            );
          }
          this.researchPanel?.update(this.ctx.researchState);
        } else {
          this.ctx.uiManager.showNotification("Cannot start research");
        }
      },
      onQueueResearch: (itemId: string) => {
        this.ctx.researchState = {
          ...this.ctx.researchState,
          researchQueue: [...this.ctx.researchState.researchQueue, itemId],
        };
        this.researchPanel?.update(this.ctx.researchState);
      },
      onCancelResearch: () => {
        this.ctx.researchState = cancelResearch(this.ctx.researchState);
        this.ctx.uiManager.showNotification("Research cancelled");
        this.researchPanel?.update(this.ctx.researchState);
      },
      onSetFunding: (level: FundingLevel) => {
        this.ctx.researchState = setFundingLevel(this.ctx.researchState, level);
        this.ctx.uiManager.showNotification(`Funding set to ${level}`);
        this.researchPanel?.update(this.ctx.researchState);
      },
      onClose: () => {
        this.researchPanel?.hide();
      },
    });

    this.researchPanel.update(this.ctx.researchState);
  }

  private setupDaySummaryPopup(): void {
    const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "DaySummaryUI",
      true,
      this.scene
    );

    this.daySummaryPopup = new DaySummaryPopup(uiTexture, {
      onContinue: () => {
        this.ctx.resetDailyStats();
      },
    });
  }

  private setupTeeSheetPanel(): void {
    const uiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "TeeSheetUI",
      true,
      this.scene
    );
    this.teeSheetViewDay = this.ctx.gameDay;

    this.teeSheetPanel = new TeeSheetPanel(uiTexture, {
      onCheckIn: (teeTimeId: string) => {
        const result = checkInTeeTime(this.ctx.teeTimeState, teeTimeId);
        this.ctx.teeTimeState = result;
        this.teeSheetPanel?.update(this.ctx.teeTimeState, this.teeSheetViewDay);
        this.ctx.uiManager.showNotification("Golfer checked in");
      },
      onCancel: (teeTimeId: string) => {
        const result = cancelTeeTime(this.ctx.teeTimeState, teeTimeId);
        this.ctx.teeTimeState = result;
        this.teeSheetPanel?.update(this.ctx.teeTimeState, this.teeSheetViewDay);
        this.ctx.uiManager.showNotification("Tee time cancelled");
      },
      onMarkNoShow: (teeTimeId: string) => {
        const result = markNoShow(this.ctx.teeTimeState, teeTimeId);
        if (result) {
          this.ctx.teeTimeState = result;
          this.teeSheetPanel?.update(this.ctx.teeTimeState, this.teeSheetViewDay);
          this.ctx.uiManager.showNotification("Marked as no-show");
        }
      },
      onChangeDay: (delta: number) => {
        this.teeSheetViewDay = Math.max(1, this.teeSheetViewDay + delta);
        this.teeSheetPanel?.update(this.ctx.teeTimeState, this.teeSheetViewDay);
      },
      onSpacingChange: (spacing: TeeTimeSpacing) => {
        this.ctx.teeTimeState = updateSpacing(this.ctx.teeTimeState, spacing);
        this.teeSheetPanel?.update(this.ctx.teeTimeState, this.teeSheetViewDay);
        this.ctx.uiManager.showNotification(`Tee time spacing: ${spacing}`);
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
          this.ctx.marketingState,
          campaignId,
          this.ctx.gameDay,
          duration
        );
        if (result) {
          this.ctx.marketingState = result.state;
          if (result.setupCost > 0) {
            const timestamp = this.ctx.gameDay * 24 * 60 + this.ctx.gameTime;
            const expenseResult = addExpense(
              this.ctx.economyState,
              result.setupCost,
              "marketing",
              "Campaign setup",
              timestamp,
              false
            );
            if (expenseResult) {
              this.ctx.economyState = expenseResult;
              this.ctx.dailyStats.expenses.other += result.setupCost;
            }
          }
          this.marketingDashboard?.update(
            this.ctx.marketingState,
            this.ctx.gameDay,
            this.ctx.economyState.cash
          );
          this.ctx.uiManager.showNotification("Campaign started!");
        }
      },
      onStopCampaign: (campaignId: string) => {
        const result = stopCampaign(
          this.ctx.marketingState,
          campaignId,
          this.ctx.gameDay
        );
        this.ctx.marketingState = result;
        this.marketingDashboard?.update(
          this.ctx.marketingState,
          this.ctx.gameDay,
          this.ctx.economyState.cash
        );
        this.ctx.uiManager.showNotification("Campaign stopped");
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
        const result = purchaseRobot(this.ctx.autonomousState, equipmentId, stats);
        if (result && result.cost <= this.ctx.economyState.cash) {
          this.ctx.autonomousState = result.state;
          const timestamp = this.ctx.gameDay * 24 * 60 + this.ctx.gameTime;
          const expenseResult = addExpense(
            this.ctx.economyState,
            result.cost,
            "equipment_purchase",
            `Robot purchase: ${equipmentId}`,
            timestamp,
            false
          );
          if (expenseResult) {
            this.ctx.economyState = expenseResult;
            this.ctx.dailyStats.expenses.other += result.cost;
          }
          this.equipmentStorePanel?.update(
            this.ctx.researchState,
            this.ctx.autonomousState,
            this.ctx.economyState.cash
          );
          this.ctx.uiManager.showNotification(`Purchased ${equipmentId}!`);
          return true;
        }
        return false;
      },
      onSellRobot: (robotId: string) => {
        const result = sellRobot(this.ctx.autonomousState, robotId);
        if (result) {
          this.ctx.autonomousState = result.state;
          const timestamp = this.ctx.gameDay * 24 * 60 + this.ctx.gameTime;
          const incomeResult = addIncome(
            this.ctx.economyState,
            result.refund,
            "other_income",
            `Robot sold: ${robotId}`,
            timestamp
          );
          if (incomeResult) {
            this.ctx.economyState = incomeResult;
            this.ctx.dailyStats.revenue.other += result.refund;
          }
          this.equipmentStorePanel?.update(
            this.ctx.researchState,
            this.ctx.autonomousState,
            this.ctx.economyState.cash
          );
          this.ctx.uiManager.showNotification(
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
          this.ctx.dailyStats.expenses.other += cost;
        }
        this.amenityPanel?.update(this.ctx.prestigeState, this.ctx.economyState.cash);
        this.ctx.uiManager.showNotification(`Purchased ${upgrade.type} upgrade!`);
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
        this.ctx.uiManager.showNotification(
          `Assigned golfer to next available slot`
        );
        this.walkOnQueuePanel?.update(this.ctx.walkOnState);
      },
      onTurnAway: (golferId: string) => {
        const golfer = this.ctx.walkOnState.queue.find(
          (g) => g.golferId === golferId
        );
        if (golfer) {
          golfer.status = "turned_away";
          this.ctx.walkOnState.metrics.walkOnsTurnedAwayToday++;
          this.walkOnQueuePanel?.update(this.ctx.walkOnState);
          this.ctx.uiManager.showNotification(`Turned away ${golfer.name}`);
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
      this.scene
    );

    this.irrigationToolbar = new IrrigationToolbar(uiTexture, {
      onToolSelect: () => {},
      onPipeTypeSelect: () => {},
      onSprinklerTypeSelect: () => {},
      onClose: () => {
        this.irrigationToolbar?.hide();
      },
    });

    this.irrigationInfoPanel = new IrrigationInfoPanel(uiTexture, {
      onClose: () => {
        this.irrigationInfoPanel?.hide();
      },
      onRepair: (x, y) => {
        const result = repairLeak(this.ctx.irrigationSystem, x, y);
        if (result) {
          this.ctx.irrigationSystem = result;
          this.ctx.irrigationRenderSystem?.update(this.ctx.irrigationSystem);
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
    this.ctx.uiManager.setPriceCallback((delta: number) => {
      const newPrice = Math.max(
        5,
        Math.min(500, this.ctx.greenFees.weekday18Holes + delta)
      );
      if (newPrice !== this.ctx.greenFees.weekday18Holes) {
        this.ctx.greenFees = {
          ...this.ctx.greenFees,
          weekday18Holes: newPrice,
          weekday9Holes: Math.round(newPrice * 0.6),
          weekend18Holes: Math.round(newPrice * 1.2),
          weekend9Holes: Math.round(newPrice * 0.72),
          twilight18Holes: Math.round(newPrice * 0.6),
          twilight9Holes: Math.round(newPrice * 0.36),
        };
        this.ctx.uiManager.updateCurrentPrice(newPrice);
      }
    });
    this.ctx.uiManager.updateCurrentPrice(this.ctx.greenFees.weekday18Holes);
  }

  handleEmployeePanel(): void {
    if (this.employeePanel?.isVisible()) {
      this.employeePanel.hide();
    } else {
      const currentTime = this.ctx.gameTime + this.ctx.gameDay * 24 * 60;
      this.employeePanel?.update(this.ctx.employeeRoster);
      this.employeePanel?.updateApplications(
        this.ctx.applicationState,
        this.ctx.prestigeState.tier,
        currentTime
      );
      this.employeePanel?.show();
    }
  }

  handleResearchPanel(): void {
    if (this.researchPanel?.isVisible()) {
      this.researchPanel.hide();
    } else {
      this.researchPanel?.update(this.ctx.researchState);
      this.researchPanel?.show();
    }
  }

  handleTeeSheetPanel(): void {
    if (this.teeSheetPanel?.isVisible()) {
      this.teeSheetPanel.hide();
    } else {
      this.teeSheetViewDay = this.ctx.gameDay;
      this.teeSheetPanel?.update(this.ctx.teeTimeState, this.teeSheetViewDay);
      this.teeSheetPanel?.show();
    }
  }

  handleMarketingPanel(): void {
    if (this.marketingDashboard?.isVisible()) {
      this.marketingDashboard.hide();
    } else {
      this.marketingDashboard?.update(
        this.ctx.marketingState,
        this.ctx.gameDay,
        this.ctx.economyState.cash
      );
      this.marketingDashboard?.show();
    }
  }

  handleEquipmentStore(): void {
    if (this.equipmentStorePanel?.isVisible()) {
      this.equipmentStorePanel.hide();
    } else {
      this.equipmentStorePanel?.update(
        this.ctx.researchState,
        this.ctx.autonomousState,
        this.ctx.economyState.cash
      );
      this.equipmentStorePanel?.show();
    }
  }

  handleAmenityPanel(): void {
    if (this.amenityPanel?.isVisible()) {
      this.amenityPanel.hide();
    } else {
      this.amenityPanel?.update(this.ctx.prestigeState, this.ctx.economyState.cash);
      this.amenityPanel?.show();
    }
  }

  handleWalkOnQueuePanel(): void {
    if (this.walkOnQueuePanel?.isVisible()) {
      this.walkOnQueuePanel.hide();
    } else {
      this.walkOnQueuePanel?.update(this.ctx.walkOnState);
      this.walkOnQueuePanel?.show();
    }
  }

  showDaySummary(data: DaySummaryData): void {
    this.daySummaryPopup?.show(data);
    this.ctx.pauseGame();
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
    this.irrigationToolbar?.dispose();
    this.irrigationInfoPanel?.dispose();
    this.irrigationSchedulePanel?.dispose();
  }
}
