import { describe, it, expect, beforeEach, vi } from "vitest";

const mockEmployeePanel = {
  update: vi.fn(),
  updateApplications: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  isVisible: vi.fn(),
  dispose: vi.fn(),
};

const mockResearchPanel = {
  update: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  isVisible: vi.fn(),
  dispose: vi.fn(),
};

const mockDaySummaryPopup = {
  show: vi.fn(),
  hide: vi.fn(),
  isVisible: vi.fn(),
  dispose: vi.fn(),
};

const mockTeeSheetPanel = {
  update: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  isVisible: vi.fn(),
  dispose: vi.fn(),
};

const mockMarketingDashboard = {
  update: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  isVisible: vi.fn(),
  dispose: vi.fn(),
};

const mockEquipmentStorePanel = {
  update: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  isVisible: vi.fn(),
  dispose: vi.fn(),
};

const mockAmenityPanel = {
  update: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  isVisible: vi.fn(),
  dispose: vi.fn(),
};

const mockWalkOnQueuePanel = {
  update: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  isVisible: vi.fn(),
  dispose: vi.fn(),
};

const mockCourseLayoutPanel = {
  update: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  isVisible: vi.fn(),
  dispose: vi.fn(),
};

const mockIrrigationToolbar = {
  show: vi.fn(),
  hide: vi.fn(),
  isVisible: vi.fn(),
  resetToolSelection: vi.fn(),
  dispose: vi.fn(),
};

const mockIrrigationInfoPanel = {
  showPipeInfo: vi.fn(),
  showSprinklerInfo: vi.fn(),
  hide: vi.fn(),
  isVisible: vi.fn(),
  dispose: vi.fn(),
};

const mockIrrigationSchedulePanel = {
  show: vi.fn(),
  hide: vi.fn(),
  isVisible: vi.fn(),
  dispose: vi.fn(),
};

let capturedEmployeeCallbacks: any;
let capturedResearchCallbacks: any;
let capturedDaySummaryCallbacks: any;
let capturedTeeSheetCallbacks: any;
let capturedMarketingCallbacks: any;
let capturedEquipmentStoreCallbacks: any;
let capturedAmenityCallbacks: any;
let capturedWalkOnCallbacks: any;
let capturedIrrigationToolbarCallbacks: any;
let capturedIrrigationInfoCallbacks: any;
let capturedIrrigationScheduleCallbacks: any;

vi.mock("./ui/EmployeePanel", () => ({
  EmployeePanel: vi.fn().mockImplementation(function (_tex: any, callbacks: any) {
    capturedEmployeeCallbacks = callbacks;
    return mockEmployeePanel;
  }),
}));

vi.mock("./ui/ResearchPanel", () => ({
  ResearchPanel: vi.fn().mockImplementation(function (_tex: any, callbacks: any) {
    capturedResearchCallbacks = callbacks;
    return mockResearchPanel;
  }),
}));

vi.mock("./ui/DaySummaryPopup", () => ({
  DaySummaryPopup: vi.fn().mockImplementation(function (_tex: any, callbacks: any) {
    capturedDaySummaryCallbacks = callbacks;
    return mockDaySummaryPopup;
  }),
  DaySummaryData: {},
}));

vi.mock("./ui/TeeSheetPanel", () => ({
  TeeSheetPanel: vi.fn().mockImplementation(function (_tex: any, callbacks: any) {
    capturedTeeSheetCallbacks = callbacks;
    return mockTeeSheetPanel;
  }),
}));

vi.mock("./ui/MarketingDashboard", () => ({
  MarketingDashboard: vi.fn().mockImplementation(function (_tex: any, callbacks: any) {
    capturedMarketingCallbacks = callbacks;
    return mockMarketingDashboard;
  }),
}));

vi.mock("./ui/EquipmentStorePanel", () => ({
  EquipmentStorePanel: vi.fn().mockImplementation(function (_tex: any, callbacks: any) {
    capturedEquipmentStoreCallbacks = callbacks;
    return mockEquipmentStorePanel;
  }),
}));

vi.mock("./ui/AmenityPanel", () => ({
  AmenityPanel: vi.fn().mockImplementation(function (_tex: any, callbacks: any) {
    capturedAmenityCallbacks = callbacks;
    return mockAmenityPanel;
  }),
}));

vi.mock("./ui/WalkOnQueuePanel", () => ({
  WalkOnQueuePanel: vi.fn().mockImplementation(function (_tex: any, callbacks: any) {
    capturedWalkOnCallbacks = callbacks;
    return mockWalkOnQueuePanel;
  }),
}));

vi.mock("./ui/CourseLayoutPanel", () => ({
  CourseLayoutPanel: vi.fn().mockImplementation(function () {
    return mockCourseLayoutPanel;
  }),
}));

vi.mock("./ui/IrrigationToolbar", () => ({
  IRRIGATION_TOOLBAR_BOUNDS: { width: 300, height: 290, left: 10, top: 10 },
  IrrigationToolbar: vi.fn().mockImplementation(function (_tex: any, callbacks: any) {
    capturedIrrigationToolbarCallbacks = callbacks;
    return mockIrrigationToolbar;
  }),
}));

vi.mock("./ui/IrrigationInfoPanel", () => ({
  IRRIGATION_INFO_PANEL_BOUNDS: { width: 280, height: 350, right: 10, top: 10 },
  IrrigationInfoPanel: vi.fn().mockImplementation(function (_tex: any, callbacks: any) {
    capturedIrrigationInfoCallbacks = callbacks;
    return mockIrrigationInfoPanel;
  }),
}));

vi.mock("./ui/IrrigationSchedulePanel", () => ({
  IRRIGATION_SCHEDULE_PANEL_BOUNDS: { width: 350, height: 400 },
  IrrigationSchedulePanel: vi.fn().mockImplementation(function (_tex: any, callbacks: any) {
    capturedIrrigationScheduleCallbacks = callbacks;
    return mockIrrigationSchedulePanel;
  }),
}));

vi.mock("@babylonjs/gui/2D/advancedDynamicTexture", () => ({
  AdvancedDynamicTexture: {
    CreateFullscreenUI: vi.fn().mockReturnValue({}),
  },
}));

vi.mock("../core/economy", () => ({
  addIncome: vi.fn(),
  addExpense: vi.fn(),
  canAfford: vi.fn(() => true),
}));

vi.mock("../core/irrigation", () => ({
  PIPE_CONFIGS: {
    pvc: { cost: 10 },
    metal: { cost: 25 },
    industrial: { cost: 40 },
  },
  SPRINKLER_CONFIGS: {
    fixed: { cost: 80 },
    rotary: { cost: 120 },
    impact: { cost: 160 },
    precision: { cost: 220 },
  },
  addPipe: vi.fn((system: any) => system),
  removePipe: vi.fn((system: any) => system),
  addSprinklerHead: vi.fn((system: any) => system),
  removeSprinklerHead: vi.fn((system: any) => system),
  addWaterSource: vi.fn((system: any) => system),
  updateSprinklerSchedule: vi.fn((system: any) => system),
  getPipeAt: vi.fn(() => null),
  getSprinklerHeadAt: vi.fn(() => null),
  repairLeak: vi.fn(),
}));

vi.mock("../core/employees", () => ({
  hireEmployee: vi.fn(),
  fireEmployee: vi.fn(),
  createInitialApplicationState: vi.fn().mockReturnValue({ postings: [], applications: [] }),
  postJobOpening: vi.fn(),
  acceptApplication: vi.fn(),
  getPostingCost: vi.fn().mockReturnValue(100),
  EMPLOYEE_ROLE_INFO: {
    groundskeeper: { name: "Groundskeeper" },
    mechanic: { name: "Mechanic" },
    proshop: { name: "Pro Shop" },
    manager: { name: "Manager" },
  },
}));

vi.mock("../core/employee-work", () => ({
  syncWorkersWithRoster: vi.fn().mockReturnValue({ workers: [] }),
}));

vi.mock("../core/research", () => ({
  startResearch: vi.fn(),
  cancelResearch: vi.fn().mockReturnValue({ currentResearch: null, researchQueue: [], completedResearch: [], fundingLevel: "normal" }),
  setFundingLevel: vi.fn().mockReturnValue({ currentResearch: null, researchQueue: [], completedResearch: [], fundingLevel: "high" }),
  RESEARCH_ITEMS: [{ id: "item1", name: "Better Mower" }],
}));

vi.mock("../core/prestige", () => ({
  upgradeAmenity: vi.fn().mockReturnValue({ tier: "bronze", amenities: {} }),
}));

vi.mock("../core/amenities", () => ({
  getUpgradeCost: vi.fn().mockReturnValue(500),
}));

vi.mock("../core/tee-times", () => ({
  checkInTeeTime: vi.fn().mockReturnValue({ teeTimes: [] }),
  cancelTeeTime: vi.fn().mockReturnValue({ teeTimes: [] }),
  markNoShow: vi.fn(),
  updateSpacing: vi.fn().mockReturnValue({ teeTimes: [] }),
}));

vi.mock("../core/marketing", () => ({
  startCampaign: vi.fn(),
  stopCampaign: vi.fn().mockReturnValue({ campaigns: [] }),
}));

vi.mock("../core/autonomous-equipment", () => ({
  purchaseRobot: vi.fn(),
  sellRobot: vi.fn(),
}));

vi.mock("./ui/UIManager", () => ({
  UIManager: vi.fn(),
}));

import { UIPanelCoordinator, UIPanelSystems } from "./UIPanelCoordinator";
import { GameState } from "./GameState";
import { hireEmployee, fireEmployee, postJobOpening, acceptApplication, getPostingCost } from "../core/employees";
import { startResearch, cancelResearch, setFundingLevel } from "../core/research";
import { addExpense, addIncome } from "../core/economy";
import { checkInTeeTime, cancelTeeTime, markNoShow, updateSpacing } from "../core/tee-times";
import { startCampaign, stopCampaign } from "../core/marketing";
import { purchaseRobot, sellRobot } from "../core/autonomous-equipment";
import { upgradeAmenity } from "../core/prestige";
import { getUpgradeCost } from "../core/amenities";
import {
  repairLeak,
  updateSprinklerSchedule,
  getPipeAt,
  getSprinklerHeadAt,
} from "../core/irrigation";
import { syncWorkersWithRoster } from "../core/employee-work";

function createMockState(): GameState {
  const state = {
    gameTime: 720,
    gameDay: 5,
    economyState: { cash: 10000, transactions: [] },
    employeeRoster: { employees: [], maxEmployees: 10 },
    employeeWorkState: { workers: [] },
    applicationState: { postings: [], applications: [] },
    researchState: { currentResearch: null, researchQueue: [], completedResearch: [], fundingLevel: "normal" },
    prestigeState: { tier: "bronze", amenities: {} },
    teeTimeState: { teeTimes: [], spacing: 10 },
    walkOnState: { queue: [], metrics: { walkOnsTurnedAwayToday: 0 } },
    revenueState: { totalRevenue: 0 },
    marketingState: { campaigns: [] },
    autonomousState: { robots: [] },
    irrigationSystem: {
      pipes: [],
      sprinklerHeads: [],
      waterSources: [],
      totalWaterUsedToday: 0,
      lastTickTime: 0,
      pressureCache: new Map(),
    },
    greenFees: {
      weekday18Holes: 50,
      weekday9Holes: 30,
      weekend18Holes: 60,
      weekend9Holes: 36,
      twilight18Holes: 30,
      twilight9Holes: 18,
    },
    dailyStats: {
      revenue: { greenFees: 0, tips: 0, addOns: 0, other: 0 },
      expenses: { wages: 0, supplies: 0, research: 0, utilities: 0, other: 0 },
      golfersServed: 0,
      totalSatisfaction: 0,
      courseHealthStart: 0,
      prestigeStart: 0,
      maintenance: { tasksCompleted: 0, tilesMowed: 0, tilesWatered: 0, tilesFertilized: 0 },
    },
  } as any as GameState;
  return state;
}

function createMockSystems(): UIPanelSystems {
  return {
    uiManager: {
      showNotification: vi.fn(),
      setPriceCallback: vi.fn(),
      updateCurrentPrice: vi.fn(),
    } as any,
    irrigationRenderSystem: null,
    resetDailyStats: vi.fn(),
    pauseGame: vi.fn(),
  };
}

describe("UIPanelCoordinator", () => {
  let coordinator: UIPanelCoordinator;
  let state: GameState;
  let systems: UIPanelSystems;
  let scene: any;

  beforeEach(() => {
    vi.clearAllMocks();
    scene = {} as any;
    state = createMockState();
    systems = createMockSystems();
    coordinator = new UIPanelCoordinator(scene, state, systems);
  });

  describe("setupAll", () => {
    it("constructs all panels", () => {
      coordinator.setupAll();

      expect(mockEmployeePanel.update).toHaveBeenCalledWith(state.employeeRoster);
      expect(mockResearchPanel.update).toHaveBeenCalledWith(state.researchState);
      expect(systems.uiManager.setPriceCallback).toHaveBeenCalled();
      expect(systems.uiManager.updateCurrentPrice).toHaveBeenCalledWith(50);
    });
  });

  describe("handleEmployeePanel", () => {
    beforeEach(() => coordinator.setupAll());

    it("hides when visible", () => {
      mockEmployeePanel.isVisible.mockReturnValue(true);
      coordinator.handleEmployeePanel();
      expect(mockEmployeePanel.hide).toHaveBeenCalled();
    });

    it("shows and updates when not visible", () => {
      mockEmployeePanel.isVisible.mockReturnValue(false);
      coordinator.handleEmployeePanel();
      expect(mockEmployeePanel.update).toHaveBeenCalledWith(state.employeeRoster);
      expect(mockEmployeePanel.updateApplications).toHaveBeenCalled();
      expect(mockEmployeePanel.show).toHaveBeenCalled();
    });
  });

  describe("handleResearchPanel", () => {
    beforeEach(() => coordinator.setupAll());

    it("hides when visible", () => {
      mockResearchPanel.isVisible.mockReturnValue(true);
      coordinator.handleResearchPanel();
      expect(mockResearchPanel.hide).toHaveBeenCalled();
    });

    it("shows and updates when not visible", () => {
      mockResearchPanel.isVisible.mockReturnValue(false);
      coordinator.handleResearchPanel();
      expect(mockResearchPanel.update).toHaveBeenCalledWith(state.researchState);
      expect(mockResearchPanel.show).toHaveBeenCalled();
    });
  });

  describe("handleTeeSheetPanel", () => {
    beforeEach(() => coordinator.setupAll());

    it("hides when visible", () => {
      mockTeeSheetPanel.isVisible.mockReturnValue(true);
      coordinator.handleTeeSheetPanel();
      expect(mockTeeSheetPanel.hide).toHaveBeenCalled();
    });

    it("shows and updates when not visible", () => {
      mockTeeSheetPanel.isVisible.mockReturnValue(false);
      coordinator.handleTeeSheetPanel();
      expect(mockTeeSheetPanel.update).toHaveBeenCalled();
      expect(mockTeeSheetPanel.show).toHaveBeenCalled();
    });
  });

  describe("handleMarketingPanel", () => {
    beforeEach(() => coordinator.setupAll());

    it("hides when visible", () => {
      mockMarketingDashboard.isVisible.mockReturnValue(true);
      coordinator.handleMarketingPanel();
      expect(mockMarketingDashboard.hide).toHaveBeenCalled();
    });

    it("shows and updates when not visible", () => {
      mockMarketingDashboard.isVisible.mockReturnValue(false);
      coordinator.handleMarketingPanel();
      expect(mockMarketingDashboard.update).toHaveBeenCalled();
      expect(mockMarketingDashboard.show).toHaveBeenCalled();
    });
  });

  describe("handleEquipmentStore", () => {
    beforeEach(() => coordinator.setupAll());

    it("hides when visible", () => {
      mockEquipmentStorePanel.isVisible.mockReturnValue(true);
      coordinator.handleEquipmentStore();
      expect(mockEquipmentStorePanel.hide).toHaveBeenCalled();
    });

    it("shows and updates when not visible", () => {
      mockEquipmentStorePanel.isVisible.mockReturnValue(false);
      coordinator.handleEquipmentStore();
      expect(mockEquipmentStorePanel.update).toHaveBeenCalled();
      expect(mockEquipmentStorePanel.show).toHaveBeenCalled();
    });
  });

  describe("handleAmenityPanel", () => {
    beforeEach(() => coordinator.setupAll());

    it("hides when visible", () => {
      mockAmenityPanel.isVisible.mockReturnValue(true);
      coordinator.handleAmenityPanel();
      expect(mockAmenityPanel.hide).toHaveBeenCalled();
    });

    it("shows and updates when not visible", () => {
      mockAmenityPanel.isVisible.mockReturnValue(false);
      coordinator.handleAmenityPanel();
      expect(mockAmenityPanel.update).toHaveBeenCalled();
      expect(mockAmenityPanel.show).toHaveBeenCalled();
    });
  });

  describe("handleWalkOnQueuePanel", () => {
    beforeEach(() => coordinator.setupAll());

    it("hides when visible", () => {
      mockWalkOnQueuePanel.isVisible.mockReturnValue(true);
      coordinator.handleWalkOnQueuePanel();
      expect(mockWalkOnQueuePanel.hide).toHaveBeenCalled();
    });

    it("shows and updates when not visible", () => {
      mockWalkOnQueuePanel.isVisible.mockReturnValue(false);
      coordinator.handleWalkOnQueuePanel();
      expect(mockWalkOnQueuePanel.update).toHaveBeenCalled();
      expect(mockWalkOnQueuePanel.show).toHaveBeenCalled();
    });
  });

  describe("showDaySummary", () => {
    beforeEach(() => coordinator.setupAll());

    it("shows popup and pauses game", () => {
      const data = {
        day: 1,
        revenue: { greenFees: 100, tips: 10, addOns: 5, other: 0 },
        expenses: { wages: 50, supplies: 10, research: 0, utilities: 5, other: 0 },
        courseHealth: { start: 80, end: 82, change: 2 },
        golfers: { totalServed: 20, averageSatisfaction: 85, tipsEarned: 10 },
        prestige: { score: 12, change: 2 },
        maintenance: { tasksCompleted: 5, tilesMowed: 10, tilesWatered: 8, tilesFertilized: 3 },
      };
      coordinator.showDaySummary(data);
      expect(mockDaySummaryPopup.show).toHaveBeenCalledWith(data);
      expect(systems.pauseGame).toHaveBeenCalled();
    });
  });

  describe("showDaySummary without setup", () => {
    it("still pauses game even if popup is null", () => {
      const data = {
        day: 1,
        revenue: { greenFees: 0, tips: 0, addOns: 0, other: 0 },
        expenses: { wages: 0, supplies: 0, research: 0, utilities: 0, other: 0 },
        courseHealth: { start: 0, end: 0, change: 0 },
        golfers: { totalServed: 0, averageSatisfaction: 0, tipsEarned: 0 },
        prestige: { score: 0, change: 0 },
        maintenance: { tasksCompleted: 0, tilesMowed: 0, tilesWatered: 0, tilesFertilized: 0 },
      };
      coordinator.showDaySummary(data);
      expect(mockDaySummaryPopup.show).not.toHaveBeenCalled();
      expect(systems.pauseGame).toHaveBeenCalled();
    });
  });

  describe("irrigation getters", () => {
    it("returns null before setup", () => {
      expect(coordinator.getIrrigationToolbar()).toBeNull();
      expect(coordinator.getIrrigationInfoPanel()).toBeNull();
      expect(coordinator.getIrrigationSchedulePanel()).toBeNull();
    });

    it("returns panels after setup", () => {
      coordinator.setupAll();
      expect(coordinator.getIrrigationToolbar()).toBe(mockIrrigationToolbar);
      expect(coordinator.getIrrigationInfoPanel()).toBe(mockIrrigationInfoPanel);
      expect(coordinator.getIrrigationSchedulePanel()).toBe(mockIrrigationSchedulePanel);
    });
  });

  describe("teeSheetViewDay", () => {
    it("get/set work", () => {
      expect(coordinator.getTeeSheetViewDay()).toBe(1);
      coordinator.setTeeSheetViewDay(10);
      expect(coordinator.getTeeSheetViewDay()).toBe(10);
    });
  });

  describe("dispose", () => {
    it("disposes all panels after setup", () => {
      coordinator.setupAll();
      coordinator.dispose();
      expect(mockEmployeePanel.dispose).toHaveBeenCalled();
      expect(mockResearchPanel.dispose).toHaveBeenCalled();
      expect(mockDaySummaryPopup.dispose).toHaveBeenCalled();
      expect(mockTeeSheetPanel.dispose).toHaveBeenCalled();
      expect(mockMarketingDashboard.dispose).toHaveBeenCalled();
      expect(mockEquipmentStorePanel.dispose).toHaveBeenCalled();
      expect(mockAmenityPanel.dispose).toHaveBeenCalled();
      expect(mockWalkOnQueuePanel.dispose).toHaveBeenCalled();
      expect(mockIrrigationToolbar.dispose).toHaveBeenCalled();
      expect(mockIrrigationInfoPanel.dispose).toHaveBeenCalled();
      expect(mockIrrigationSchedulePanel.dispose).toHaveBeenCalled();
    });

    it("handles null panels gracefully without setup", () => {
      coordinator.dispose();
      expect(mockEmployeePanel.dispose).not.toHaveBeenCalled();
    });
  });

  describe("handle toggle without setup (null panels)", () => {
    it("handleEmployeePanel does not throw", () => {
      coordinator.handleEmployeePanel();
    });

    it("handleResearchPanel does not throw", () => {
      coordinator.handleResearchPanel();
    });

    it("handleTeeSheetPanel does not throw", () => {
      coordinator.handleTeeSheetPanel();
    });

    it("handleMarketingPanel does not throw", () => {
      coordinator.handleMarketingPanel();
    });

    it("handleEquipmentStore does not throw", () => {
      coordinator.handleEquipmentStore();
    });

    it("handleAmenityPanel does not throw", () => {
      coordinator.handleAmenityPanel();
    });

    it("handleWalkOnQueuePanel does not throw", () => {
      coordinator.handleWalkOnQueuePanel();
    });
  });

  describe("employee panel callbacks", () => {
    beforeEach(() => coordinator.setupAll());

    describe("onHire", () => {
      it("hires successfully and accepts application", () => {
        const employee = { id: "e1", name: "John", role: "groundskeeper" };
        const newRoster = { employees: [employee], maxEmployees: 10 };
        vi.mocked(hireEmployee).mockReturnValue(newRoster as any);
        vi.mocked(acceptApplication).mockReturnValue({ postings: [], applications: [] } as any);

        capturedEmployeeCallbacks.onHire(employee);

        expect(hireEmployee).toHaveBeenCalled();
        expect(syncWorkersWithRoster).toHaveBeenCalled();
        expect(acceptApplication).toHaveBeenCalledWith(expect.anything(), "e1");
        expect(systems.uiManager.showNotification).toHaveBeenCalledWith("Hired John as groundskeeper");
        expect(mockEmployeePanel.update).toHaveBeenCalledWith(newRoster);
        expect(mockEmployeePanel.updateApplications).toHaveBeenCalled();
      });

      it("hires successfully but acceptApplication returns null", () => {
        const employee = { id: "e1", name: "John", role: "groundskeeper" };
        vi.mocked(hireEmployee).mockReturnValue({ employees: [employee], maxEmployees: 10 } as any);
        vi.mocked(acceptApplication).mockReturnValue(null as any);

        capturedEmployeeCallbacks.onHire(employee);

        expect(systems.uiManager.showNotification).toHaveBeenCalledWith("Hired John as groundskeeper");
      });

      it("fails to hire when roster full", () => {
        vi.mocked(hireEmployee).mockReturnValue(null as any);

        capturedEmployeeCallbacks.onHire({ id: "e1", name: "John", role: "groundskeeper" });

        expect(systems.uiManager.showNotification).toHaveBeenCalledWith("Cannot hire - roster full");
      });
    });

    describe("onFire", () => {
      it("fires employee successfully with notification", () => {
        state.employeeRoster = {
          employees: [{ id: "e1", name: "Alice", role: "groundskeeper" }],
          maxEmployees: 10,
        } as any;
        vi.mocked(fireEmployee).mockReturnValue({ employees: [], maxEmployees: 10 } as any);

        capturedEmployeeCallbacks.onFire("e1");

        expect(fireEmployee).toHaveBeenCalled();
        expect(syncWorkersWithRoster).toHaveBeenCalled();
        expect(systems.uiManager.showNotification).toHaveBeenCalledWith("Fired Alice");
      });

      it("fires employee not found in roster (no notification name)", () => {
        state.employeeRoster = { employees: [], maxEmployees: 10 } as any;
        vi.mocked(fireEmployee).mockReturnValue({ employees: [], maxEmployees: 10 } as any);

        capturedEmployeeCallbacks.onFire("e1");

        expect(fireEmployee).toHaveBeenCalled();
        expect(systems.uiManager.showNotification).not.toHaveBeenCalled();
      });

      it("fireEmployee returns null", () => {
        vi.mocked(fireEmployee).mockReturnValue(null as any);
        mockEmployeePanel.update.mockClear();

        capturedEmployeeCallbacks.onFire("e1");

        expect(mockEmployeePanel.update).not.toHaveBeenCalled();
      });
    });

    describe("onClose", () => {
      it("hides the panel", () => {
        capturedEmployeeCallbacks.onClose();
        expect(mockEmployeePanel.hide).toHaveBeenCalled();
      });
    });

    describe("onPostJobOpening", () => {
      it("posts job and deducts expense", () => {
        vi.mocked(getPostingCost).mockReturnValue(100);
        vi.mocked(postJobOpening).mockReturnValue({ state: { postings: [{}], applications: [] } } as any);
        vi.mocked(addExpense).mockReturnValue({ cash: 9900, transactions: [] } as any);

        capturedEmployeeCallbacks.onPostJobOpening("groundskeeper");

        expect(postJobOpening).toHaveBeenCalled();
        expect(addExpense).toHaveBeenCalled();
        expect(systems.uiManager.showNotification).toHaveBeenCalled();
        expect(mockEmployeePanel.updateApplications).toHaveBeenCalled();
      });

      it("not enough cash", () => {
        vi.mocked(getPostingCost).mockReturnValue(99999);

        capturedEmployeeCallbacks.onPostJobOpening("groundskeeper");

        expect(postJobOpening).not.toHaveBeenCalled();
        expect(systems.uiManager.showNotification).toHaveBeenCalledWith(
          expect.stringContaining("Not enough cash"),
          "#ff4444"
        );
      });

      it("postJobOpening returns null", () => {
        vi.mocked(getPostingCost).mockReturnValue(100);
        vi.mocked(postJobOpening).mockReturnValue(null as any);

        capturedEmployeeCallbacks.onPostJobOpening("groundskeeper");

        expect(addExpense).not.toHaveBeenCalled();
      });

      it("addExpense returns null", () => {
        vi.mocked(getPostingCost).mockReturnValue(100);
        vi.mocked(postJobOpening).mockReturnValue({ state: { postings: [{}], applications: [] } } as any);
        vi.mocked(addExpense).mockReturnValue(null as any);

        capturedEmployeeCallbacks.onPostJobOpening("groundskeeper");

        expect(systems.uiManager.showNotification).toHaveBeenCalled();
      });
    });
  });

  describe("research panel callbacks", () => {
    beforeEach(() => coordinator.setupAll());

    describe("onStartResearch", () => {
      it("starts research successfully", () => {
        const newState = { currentResearch: { id: "item1" }, researchQueue: [], completedResearch: [], fundingLevel: "normal" };
        vi.mocked(startResearch).mockReturnValue(newState as any);

        capturedResearchCallbacks.onStartResearch("item1");

        expect(startResearch).toHaveBeenCalled();
        expect(systems.uiManager.showNotification).toHaveBeenCalledWith("Started researching: Better Mower");
        expect(mockResearchPanel.update).toHaveBeenCalledWith(newState);
      });

      it("starts research with unknown item id", () => {
        const newState = { currentResearch: { id: "unknown" }, researchQueue: [], completedResearch: [], fundingLevel: "normal" };
        vi.mocked(startResearch).mockReturnValue(newState as any);

        capturedResearchCallbacks.onStartResearch("unknown");

        expect(mockResearchPanel.update).toHaveBeenCalled();
      });

      it("fails to start research", () => {
        vi.mocked(startResearch).mockReturnValue(null as any);

        capturedResearchCallbacks.onStartResearch("item1");

        expect(systems.uiManager.showNotification).toHaveBeenCalledWith("Cannot start research");
      });
    });

    describe("onQueueResearch", () => {
      it("queues research item", () => {
        capturedResearchCallbacks.onQueueResearch("item2");

        expect(state.researchState.researchQueue).toContain("item2");
        expect(mockResearchPanel.update).toHaveBeenCalled();
      });
    });

    describe("onCancelResearch", () => {
      it("cancels current research", () => {
        capturedResearchCallbacks.onCancelResearch();

        expect(cancelResearch).toHaveBeenCalled();
        expect(systems.uiManager.showNotification).toHaveBeenCalledWith("Research cancelled");
        expect(mockResearchPanel.update).toHaveBeenCalled();
      });
    });

    describe("onSetFunding", () => {
      it("sets funding level", () => {
        capturedResearchCallbacks.onSetFunding("high");

        expect(setFundingLevel).toHaveBeenCalled();
        expect(systems.uiManager.showNotification).toHaveBeenCalledWith("Funding set to high");
        expect(mockResearchPanel.update).toHaveBeenCalled();
      });
    });

    describe("onClose", () => {
      it("hides the panel", () => {
        capturedResearchCallbacks.onClose();
        expect(mockResearchPanel.hide).toHaveBeenCalled();
      });
    });
  });

  describe("day summary callbacks", () => {
    beforeEach(() => coordinator.setupAll());

    it("onContinue resets daily stats", () => {
      capturedDaySummaryCallbacks.onContinue();
      expect(systems.resetDailyStats).toHaveBeenCalled();
    });
  });

  describe("tee sheet panel callbacks", () => {
    beforeEach(() => coordinator.setupAll());

    it("onCheckIn checks in tee time", () => {
      capturedTeeSheetCallbacks.onCheckIn("tt1");
      expect(checkInTeeTime).toHaveBeenCalled();
      expect(mockTeeSheetPanel.update).toHaveBeenCalled();
      expect(systems.uiManager.showNotification).toHaveBeenCalledWith("Golfer checked in");
    });

    it("onCancel cancels tee time", () => {
      capturedTeeSheetCallbacks.onCancel("tt1");
      expect(cancelTeeTime).toHaveBeenCalled();
      expect(mockTeeSheetPanel.update).toHaveBeenCalled();
      expect(systems.uiManager.showNotification).toHaveBeenCalledWith("Tee time cancelled");
    });

    it("onMarkNoShow with valid result", () => {
      vi.mocked(markNoShow).mockReturnValue({ teeTimes: [] } as any);
      capturedTeeSheetCallbacks.onMarkNoShow("tt1");
      expect(markNoShow).toHaveBeenCalled();
      expect(mockTeeSheetPanel.update).toHaveBeenCalled();
      expect(systems.uiManager.showNotification).toHaveBeenCalledWith("Marked as no-show");
    });

    it("onMarkNoShow with null result", () => {
      vi.mocked(markNoShow).mockReturnValue(null as any);
      capturedTeeSheetCallbacks.onMarkNoShow("tt1");
      expect(mockTeeSheetPanel.update).not.toHaveBeenCalled();
    });

    it("onChangeDay increments day", () => {
      capturedTeeSheetCallbacks.onChangeDay(1);
      expect(mockTeeSheetPanel.update).toHaveBeenCalled();
    });

    it("onChangeDay clamps to minimum 1", () => {
      capturedTeeSheetCallbacks.onChangeDay(-100);
      expect(mockTeeSheetPanel.update).toHaveBeenCalled();
      expect(coordinator.getTeeSheetViewDay()).toBe(1);
    });

    it("onSpacingChange updates spacing", () => {
      capturedTeeSheetCallbacks.onSpacingChange(15);
      expect(updateSpacing).toHaveBeenCalled();
      expect(mockTeeSheetPanel.update).toHaveBeenCalled();
      expect(systems.uiManager.showNotification).toHaveBeenCalledWith("Tee time spacing: 15");
    });

    it("onClose hides panel", () => {
      capturedTeeSheetCallbacks.onClose();
      expect(mockTeeSheetPanel.hide).toHaveBeenCalled();
    });
  });

  describe("marketing dashboard callbacks", () => {
    beforeEach(() => coordinator.setupAll());

    it("onStartCampaign with setup cost and successful expense", () => {
      vi.mocked(startCampaign).mockReturnValue({ state: { campaigns: [] }, setupCost: 200 } as any);
      vi.mocked(addExpense).mockReturnValue({ cash: 9800, transactions: [] } as any);

      capturedMarketingCallbacks.onStartCampaign("c1", 7);

      expect(startCampaign).toHaveBeenCalled();
      expect(addExpense).toHaveBeenCalled();
      expect(mockMarketingDashboard.update).toHaveBeenCalled();
      expect(systems.uiManager.showNotification).toHaveBeenCalledWith("Campaign started!");
    });

    it("onStartCampaign with zero setup cost", () => {
      vi.mocked(startCampaign).mockReturnValue({ state: { campaigns: [] }, setupCost: 0 } as any);

      capturedMarketingCallbacks.onStartCampaign("c1", 7);

      expect(addExpense).not.toHaveBeenCalled();
      expect(mockMarketingDashboard.update).toHaveBeenCalled();
    });

    it("onStartCampaign with setup cost but addExpense fails", () => {
      vi.mocked(startCampaign).mockReturnValue({ state: { campaigns: [] }, setupCost: 200 } as any);
      vi.mocked(addExpense).mockReturnValue(null as any);

      capturedMarketingCallbacks.onStartCampaign("c1", 7);

      expect(mockMarketingDashboard.update).toHaveBeenCalled();
    });

    it("onStartCampaign returns null", () => {
      vi.mocked(startCampaign).mockReturnValue(null as any);

      capturedMarketingCallbacks.onStartCampaign("c1", 7);

      expect(mockMarketingDashboard.update).not.toHaveBeenCalled();
    });

    it("onStopCampaign", () => {
      capturedMarketingCallbacks.onStopCampaign("c1");
      expect(stopCampaign).toHaveBeenCalled();
      expect(mockMarketingDashboard.update).toHaveBeenCalled();
      expect(systems.uiManager.showNotification).toHaveBeenCalledWith("Campaign stopped");
    });

    it("onClose hides dashboard", () => {
      capturedMarketingCallbacks.onClose();
      expect(mockMarketingDashboard.hide).toHaveBeenCalled();
    });
  });

  describe("equipment store callbacks", () => {
    beforeEach(() => coordinator.setupAll());

    it("onPurchaseRobot success with expense", () => {
      vi.mocked(purchaseRobot).mockReturnValue({ state: { robots: [] }, cost: 500 } as any);
      vi.mocked(addExpense).mockReturnValue({ cash: 9500, transactions: [] } as any);

      const result = capturedEquipmentStoreCallbacks.onPurchaseRobot("r1", { speed: 1 });

      expect(result).toBe(true);
      expect(purchaseRobot).toHaveBeenCalled();
      expect(addExpense).toHaveBeenCalled();
      expect(mockEquipmentStorePanel.update).toHaveBeenCalled();
      expect(systems.uiManager.showNotification).toHaveBeenCalledWith("Purchased r1!");
    });

    it("onPurchaseRobot success but addExpense fails", () => {
      vi.mocked(purchaseRobot).mockReturnValue({ state: { robots: [] }, cost: 500 } as any);
      vi.mocked(addExpense).mockReturnValue(null as any);

      const result = capturedEquipmentStoreCallbacks.onPurchaseRobot("r1", { speed: 1 });

      expect(result).toBe(true);
      expect(mockEquipmentStorePanel.update).toHaveBeenCalled();
    });

    it("onPurchaseRobot returns null", () => {
      vi.mocked(purchaseRobot).mockReturnValue(null as any);

      const result = capturedEquipmentStoreCallbacks.onPurchaseRobot("r1", { speed: 1 });

      expect(result).toBe(false);
    });

    it("onPurchaseRobot cost exceeds cash", () => {
      vi.mocked(purchaseRobot).mockReturnValue({ state: { robots: [] }, cost: 99999 } as any);

      const result = capturedEquipmentStoreCallbacks.onPurchaseRobot("r1", { speed: 1 });

      expect(result).toBe(false);
    });

    it("onSellRobot success with income", () => {
      vi.mocked(sellRobot).mockReturnValue({ state: { robots: [] }, refund: 300 } as any);
      vi.mocked(addIncome).mockReturnValue({ cash: 10300, transactions: [] } as any);

      const result = capturedEquipmentStoreCallbacks.onSellRobot("r1");

      expect(result).toBe(true);
      expect(sellRobot).toHaveBeenCalled();
      expect(addIncome).toHaveBeenCalled();
      expect(mockEquipmentStorePanel.update).toHaveBeenCalled();
      expect(systems.uiManager.showNotification).toHaveBeenCalled();
    });

    it("onSellRobot success but addIncome fails", () => {
      vi.mocked(sellRobot).mockReturnValue({ state: { robots: [] }, refund: 300 } as any);
      vi.mocked(addIncome).mockReturnValue(null as any);

      const result = capturedEquipmentStoreCallbacks.onSellRobot("r1");

      expect(result).toBe(true);
      expect(mockEquipmentStorePanel.update).toHaveBeenCalled();
    });

    it("onSellRobot returns null", () => {
      vi.mocked(sellRobot).mockReturnValue(null as any);

      const result = capturedEquipmentStoreCallbacks.onSellRobot("r1");

      expect(result).toBe(false);
    });

    it("onClose hides panel", () => {
      capturedEquipmentStoreCallbacks.onClose();
      expect(mockEquipmentStorePanel.hide).toHaveBeenCalled();
    });
  });

  describe("amenity panel callbacks", () => {
    beforeEach(() => coordinator.setupAll());

    it("onPurchaseUpgrade success with expense", () => {
      vi.mocked(getUpgradeCost).mockReturnValue(500);
      vi.mocked(upgradeAmenity).mockReturnValue({ tier: "bronze", amenities: {} } as any);
      vi.mocked(addExpense).mockReturnValue({ cash: 9500, transactions: [] } as any);

      const result = capturedAmenityCallbacks.onPurchaseUpgrade({ type: "clubhouse", level: 1 });

      expect(result).toBe(true);
      expect(upgradeAmenity).toHaveBeenCalled();
      expect(addExpense).toHaveBeenCalled();
      expect(mockAmenityPanel.update).toHaveBeenCalled();
      expect(systems.uiManager.showNotification).toHaveBeenCalledWith("Purchased clubhouse upgrade!");
    });

    it("onPurchaseUpgrade not enough cash", () => {
      vi.mocked(getUpgradeCost).mockReturnValue(99999);

      const result = capturedAmenityCallbacks.onPurchaseUpgrade({ type: "clubhouse", level: 1 });

      expect(result).toBe(false);
      expect(upgradeAmenity).not.toHaveBeenCalled();
    });

    it("onPurchaseUpgrade addExpense fails", () => {
      vi.mocked(getUpgradeCost).mockReturnValue(500);
      vi.mocked(upgradeAmenity).mockReturnValue({ tier: "bronze", amenities: {} } as any);
      vi.mocked(addExpense).mockReturnValue(null as any);

      const result = capturedAmenityCallbacks.onPurchaseUpgrade({ type: "clubhouse", level: 1 });

      expect(result).toBe(true);
      expect(mockAmenityPanel.update).toHaveBeenCalled();
    });

    it("onClose hides panel", () => {
      capturedAmenityCallbacks.onClose();
      expect(mockAmenityPanel.hide).toHaveBeenCalled();
    });
  });

  describe("walk-on queue panel callbacks", () => {
    beforeEach(() => coordinator.setupAll());

    it("onAssignToSlot shows notification and updates", () => {
      capturedWalkOnCallbacks.onAssignToSlot("g1");
      expect(systems.uiManager.showNotification).toHaveBeenCalledWith("Assigned golfer to next available slot");
      expect(mockWalkOnQueuePanel.update).toHaveBeenCalled();
    });

    it("onTurnAway with found golfer", () => {
      state.walkOnState = {
        queue: [{ golferId: "g1", name: "Bob", status: "waiting" }],
        metrics: { walkOnsTurnedAwayToday: 0 },
      } as any;

      capturedWalkOnCallbacks.onTurnAway("g1");

      expect(state.walkOnState.queue[0].status).toBe("turned_away");
      expect(state.walkOnState.metrics.walkOnsTurnedAwayToday).toBe(1);
      expect(mockWalkOnQueuePanel.update).toHaveBeenCalled();
      expect(systems.uiManager.showNotification).toHaveBeenCalledWith("Turned away Bob");
    });

    it("onTurnAway with golfer not found", () => {
      state.walkOnState = {
        queue: [],
        metrics: { walkOnsTurnedAwayToday: 0 },
      } as any;

      capturedWalkOnCallbacks.onTurnAway("g999");

      expect(mockWalkOnQueuePanel.update).not.toHaveBeenCalled();
    });

    it("onClose hides panel", () => {
      capturedWalkOnCallbacks.onClose();
      expect(mockWalkOnQueuePanel.hide).toHaveBeenCalled();
    });
  });

  describe("irrigation UI callbacks", () => {
    beforeEach(() => coordinator.setupAll());

    it("toolbar onToolSelect shows selected tool notification", () => {
      capturedIrrigationToolbarCallbacks.onToolSelect("pipe");
      expect(systems.uiManager.showNotification).toHaveBeenCalledWith("Irrigation tool: PIPE");
    });

    it("toolbar onToolSelect null shows cleared notification", () => {
      capturedIrrigationToolbarCallbacks.onToolSelect(null);
      expect(systems.uiManager.showNotification).toHaveBeenCalledWith("Irrigation tool cleared");
    });

    it("toolbar onPipeTypeSelect updates selection notification", () => {
      capturedIrrigationToolbarCallbacks.onPipeTypeSelect("metal");
      expect(systems.uiManager.showNotification).toHaveBeenCalledWith("Pipe type: METAL");
    });

    it("toolbar onSprinklerTypeSelect supports advanced types", () => {
      capturedIrrigationToolbarCallbacks.onSprinklerTypeSelect("impact");
      expect(systems.uiManager.showNotification).toHaveBeenCalledWith("Sprinkler type: IMPACT");
    });

    it("toolbar onClose hides toolbar", () => {
      capturedIrrigationToolbarCallbacks.onClose();
      expect(mockIrrigationToolbar.hide).toHaveBeenCalled();
      expect(mockIrrigationToolbar.resetToolSelection).toHaveBeenCalled();
    });

    it("info panel onClose hides info panel", () => {
      capturedIrrigationInfoCallbacks.onClose();
      expect(mockIrrigationInfoPanel.hide).toHaveBeenCalled();
    });

    it("info panel onRepair with successful result", () => {
      const startingSystem = state.irrigationSystem;
      vi.mocked(repairLeak).mockReturnValue({
        ...startingSystem,
        pipes: [],
      } as any);

      capturedIrrigationInfoCallbacks.onRepair(1, 2);

      expect(repairLeak).toHaveBeenCalledWith(startingSystem, 1, 2);
    });

    it("info panel onRepair with null result", () => {
      vi.mocked(repairLeak).mockReturnValue(null as any);

      capturedIrrigationInfoCallbacks.onRepair(1, 2);

      expect(repairLeak).toHaveBeenCalled();
    });

    it("info panel onRepair with irrigationRenderSystem present", () => {
      const mockRenderSystem = { update: vi.fn() };
      const systemsWithRender = createMockSystems();
      systemsWithRender.irrigationRenderSystem = mockRenderSystem as any;
      const coord2 = new UIPanelCoordinator(scene, state, systemsWithRender);
      coord2.setupAll();

      vi.mocked(repairLeak).mockReturnValue({ pipes: [], sprinklers: [] } as any);
      capturedIrrigationInfoCallbacks.onRepair(3, 4);

      expect(mockRenderSystem.update).toHaveBeenCalled();
    });

    it("schedule panel onClose hides schedule panel", () => {
      capturedIrrigationScheduleCallbacks.onClose();
      expect(mockIrrigationSchedulePanel.hide).toHaveBeenCalled();
    });

    it("schedule save handles missing sprinkler gracefully", () => {
      state.irrigationSystem = {
        ...state.irrigationSystem,
        sprinklerHeads: [],
      } as any;

      capturedIrrigationScheduleCallbacks.onScheduleUpdate("missing", {
        enabled: true,
        timeRanges: [{ start: 300, end: 420 }],
        skipRain: false,
        zone: "A",
      });

      expect(updateSprinklerSchedule).not.toHaveBeenCalled();
      expect(mockIrrigationSchedulePanel.hide).toHaveBeenCalled();
      expect(mockIrrigationInfoPanel.hide).toHaveBeenCalled();
      expect(systems.uiManager.showNotification).toHaveBeenCalledWith(
        "Sprinkler no longer exists"
      );
    });

    it("schedule save refreshes sprinkler info with live pressure", () => {
      state.irrigationSystem = {
        ...state.irrigationSystem,
        sprinklerHeads: [
          {
            id: "s1",
            gridX: 5,
            gridY: 5,
            sprinklerType: "rotary",
            schedule: { enabled: true, timeRanges: [{ start: 300, end: 420 }], skipRain: false, zone: "A" },
            coverageTiles: [],
            isActive: true,
            connectedToPipe: true,
          },
        ],
      } as any;
      const updatedHead = {
        id: "s1",
        gridX: 5,
        gridY: 5,
        sprinklerType: "rotary",
        schedule: { enabled: true, timeRanges: [{ start: 300, end: 420 }], skipRain: false, zone: "A" },
        coverageTiles: [],
        isActive: true,
        connectedToPipe: true,
      };
      vi.mocked(updateSprinklerSchedule).mockReturnValue({
        ...state.irrigationSystem,
        sprinklerHeads: [updatedHead],
      } as any);
      vi.mocked(getPipeAt).mockReturnValue({
        gridX: 5,
        gridY: 5,
        pressureLevel: 67,
      } as any);
      const startingSystem = state.irrigationSystem;

      capturedIrrigationScheduleCallbacks.onScheduleUpdate("s1", {
        enabled: true,
        timeRanges: [{ start: 300, end: 420 }],
        skipRain: false,
        zone: "A",
      });

      expect(updateSprinklerSchedule).toHaveBeenCalledWith(
        startingSystem,
        "s1",
        expect.any(Object)
      );
      expect(mockIrrigationInfoPanel.showSprinklerInfo).toHaveBeenCalledWith(
        updatedHead,
        67
      );
    });

    it("info mode shows sprinkler info with pressure", () => {
      const head = {
        id: "s2",
        gridX: 8,
        gridY: 9,
      };
      mockIrrigationToolbar.isVisible.mockReturnValue(true);
      capturedIrrigationToolbarCallbacks.onToolSelect("info");
      vi.mocked(getSprinklerHeadAt).mockReturnValue(head as any);
      vi.mocked(getPipeAt).mockReturnValue({
        gridX: 8,
        gridY: 9,
        pressureLevel: 72,
      } as any);

      coordinator.handleIrrigationGridAction(8, 9);

      expect(mockIrrigationInfoPanel.showSprinklerInfo).toHaveBeenCalledWith(
        head,
        72
      );
    });

    it("handleIrrigationGridAction prompts when no tool is selected", () => {
      mockIrrigationToolbar.isVisible.mockReturnValue(true);

      coordinator.handleIrrigationGridAction(5, 5);

      expect(systems.uiManager.showNotification).toHaveBeenCalledWith(
        "Select Pipe, Sprinkler, Delete, or Info first"
      );
    });
  });

  describe("price callback", () => {
    beforeEach(() => coordinator.setupAll());

    it("adjusts green fees up", () => {
      const priceCallback = vi.mocked(systems.uiManager.setPriceCallback).mock.calls[0][0];
      priceCallback(10);
      expect(state.greenFees.weekday18Holes).toBe(60);
      expect(systems.uiManager.updateCurrentPrice).toHaveBeenCalledWith(60);
    });

    it("adjusts green fees down", () => {
      const priceCallback = vi.mocked(systems.uiManager.setPriceCallback).mock.calls[0][0];
      priceCallback(-10);
      expect(state.greenFees.weekday18Holes).toBe(40);
      expect(systems.uiManager.updateCurrentPrice).toHaveBeenCalledWith(40);
    });

    it("clamps to minimum 5", () => {
      const priceCallback = vi.mocked(systems.uiManager.setPriceCallback).mock.calls[0][0];
      priceCallback(-1000);
      expect(state.greenFees.weekday18Holes).toBe(5);
    });

    it("clamps to maximum 500", () => {
      const priceCallback = vi.mocked(systems.uiManager.setPriceCallback).mock.calls[0][0];
      priceCallback(10000);
      expect(state.greenFees.weekday18Holes).toBe(500);
    });

    it("does not update when price unchanged (already at min)", () => {
      state.greenFees = { ...state.greenFees, weekday18Holes: 5 };
      vi.mocked(systems.uiManager.updateCurrentPrice).mockClear();

      const priceCallback = vi.mocked(systems.uiManager.setPriceCallback).mock.calls[0][0];
      priceCallback(-100);

      expect(systems.uiManager.updateCurrentPrice).not.toHaveBeenCalled();
    });

    it("calculates derived prices correctly", () => {
      const priceCallback = vi.mocked(systems.uiManager.setPriceCallback).mock.calls[0][0];
      priceCallback(50);
      expect(state.greenFees.weekday18Holes).toBe(100);
      expect(state.greenFees.weekday9Holes).toBe(60);
      expect(state.greenFees.weekend18Holes).toBe(120);
      expect(state.greenFees.weekend9Holes).toBe(72);
      expect(state.greenFees.twilight18Holes).toBe(60);
      expect(state.greenFees.twilight9Holes).toBe(36);
    });
  });
});
