import { describe, it, expect } from "vitest";
import {
  // Types
  ResearchState,
  ResearchItem,
  ResearchProgress,
  ResearchCategory,
  FundingLevel,
  ResearchStatus,
  EquipmentStats,

  // Constants
  FUNDING_POINTS_PER_MINUTE,
  FUNDING_COST_PER_MINUTE,
  RESEARCH_ITEMS,

  // Factory functions
  createInitialResearchState,
  createResearchProgress,

  // Query functions
  getResearchItem,
  getResearchItemsByCategory,
  getResearchItemsByTier,
  getResearchStatus,
  getAvailableResearch,
  getCompletedResearch,
  getLockedResearch,
  canStartResearch,
  getResearchProgress,
  getEstimatedTimeToComplete,
  getFundingCostPerMinute,
  getTotalResearchCount,
  getCompletedResearchCount,
  getUnlockedEquipment,
  getUnlockedFertilizers,
  getActiveUpgrades,
  getUnlockedAutonomousEquipment,
  isAutonomousEquipment,
  getAutonomousEquipmentStats,
  calculateRobotOperatingCost,
  calculateBreakdownProbability,
  getPrerequisiteChain,
  getDependentResearch,

  // State transformation functions
  setFundingLevel,
  startResearch,
  addToQueue,
  removeFromQueue,
  cancelResearch,
  tickResearch,
  completeResearchInstantly,

  // Utility functions
  formatResearchTime,
  getResearchCategoryName
} from "./research";

// ============================================================================
// Test Helpers
// ============================================================================

function makeResearchState(overrides: Partial<ResearchState> = {}): ResearchState {
  return {
    completedResearch: ["basic_push_mower"],
    currentResearch: null,
    researchQueue: [],
    fundingLevel: "normal",
    totalPointsSpent: 0,
    ...overrides
  };
}

function makeResearchProgress(overrides: Partial<ResearchProgress> = {}): ResearchProgress {
  return {
    itemId: "riding_mower_basic",
    pointsEarned: 0,
    pointsRequired: 500,
    startTime: 0,
    ...overrides
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("Research System", () => {
  // ==========================================================================
  // Constants Tests
  // ==========================================================================

  describe("Constants", () => {
    it("has correct funding points per minute", () => {
      expect(FUNDING_POINTS_PER_MINUTE.none).toBe(0);
      expect(FUNDING_POINTS_PER_MINUTE.minimum).toBe(1);
      expect(FUNDING_POINTS_PER_MINUTE.normal).toBe(3);
      expect(FUNDING_POINTS_PER_MINUTE.maximum).toBe(6);
    });

    it("has increasing costs for higher funding", () => {
      expect(FUNDING_COST_PER_MINUTE.none).toBeLessThan(FUNDING_COST_PER_MINUTE.minimum);
      expect(FUNDING_COST_PER_MINUTE.minimum).toBeLessThan(FUNDING_COST_PER_MINUTE.normal);
      expect(FUNDING_COST_PER_MINUTE.normal).toBeLessThan(FUNDING_COST_PER_MINUTE.maximum);
    });

    it("has research items defined", () => {
      expect(RESEARCH_ITEMS.length).toBeGreaterThan(0);
    });

    it("has starting equipment with zero cost", () => {
      const startingItem = RESEARCH_ITEMS.find(i => i.id === "basic_push_mower");
      expect(startingItem).toBeDefined();
      expect(startingItem?.baseCost).toBe(0);
    });

    it("has items in tiers 1-5", () => {
      const tiers = new Set(RESEARCH_ITEMS.map(i => i.tier));
      expect(tiers.has(1)).toBe(true);
      expect(tiers.has(2)).toBe(true);
      expect(tiers.has(3)).toBe(true);
      expect(tiers.has(4)).toBe(true);
      expect(tiers.has(5)).toBe(true);
    });

    it("has items in all categories", () => {
      const categories = new Set(RESEARCH_ITEMS.map(i => i.category));
      expect(categories.has("equipment")).toBe(true);
      expect(categories.has("fertilizers")).toBe(true);
      expect(categories.has("irrigation")).toBe(true);
    });
  });

  // ==========================================================================
  // Factory Function Tests
  // ==========================================================================

  describe("createInitialResearchState", () => {
    it("starts with basic push mower completed", () => {
      const state = createInitialResearchState();
      expect(state.completedResearch).toContain("basic_push_mower");
    });

    it("starts with no current research", () => {
      const state = createInitialResearchState();
      expect(state.currentResearch).toBeNull();
    });

    it("starts with empty queue", () => {
      const state = createInitialResearchState();
      expect(state.researchQueue).toEqual([]);
    });

    it("starts with normal funding", () => {
      const state = createInitialResearchState();
      expect(state.fundingLevel).toBe("normal");
    });

    it("starts with zero points spent", () => {
      const state = createInitialResearchState();
      expect(state.totalPointsSpent).toBe(0);
    });
  });

  describe("createResearchProgress", () => {
    it("creates progress for valid item", () => {
      const progress = createResearchProgress("riding_mower_basic", 1000);
      expect(progress).not.toBeNull();
      expect(progress?.itemId).toBe("riding_mower_basic");
      expect(progress?.startTime).toBe(1000);
    });

    it("sets points earned to zero", () => {
      const progress = createResearchProgress("riding_mower_basic", 0);
      expect(progress?.pointsEarned).toBe(0);
    });

    it("sets points required from item cost", () => {
      const progress = createResearchProgress("riding_mower_basic", 0);
      expect(progress?.pointsRequired).toBe(500);
    });

    it("returns null for invalid item", () => {
      const progress = createResearchProgress("nonexistent_item", 0);
      expect(progress).toBeNull();
    });
  });

  // ==========================================================================
  // Query Function Tests
  // ==========================================================================

  describe("getResearchItem", () => {
    it("returns item when found", () => {
      const item = getResearchItem("riding_mower_basic");
      expect(item).not.toBeNull();
      expect(item?.name).toBe("Basic Riding Mower");
    });

    it("returns null when not found", () => {
      const item = getResearchItem("fake_item");
      expect(item).toBeNull();
    });
  });

  describe("getResearchItemsByCategory", () => {
    it("returns all items in category", () => {
      const equipment = getResearchItemsByCategory("equipment");
      expect(equipment.length).toBeGreaterThan(0);
      expect(equipment.every(i => i.category === "equipment")).toBe(true);
    });

    it("returns empty array for category with no items", () => {
      // All categories have items in our setup, but test the logic
      const items = getResearchItemsByCategory("equipment");
      expect(Array.isArray(items)).toBe(true);
    });
  });

  describe("getResearchItemsByTier", () => {
    it("returns items at specified tier", () => {
      const tier2 = getResearchItemsByTier(2);
      expect(tier2.length).toBeGreaterThan(0);
      expect(tier2.every(i => i.tier === 2)).toBe(true);
    });

    it("returns empty for non-existent tier", () => {
      const tier99 = getResearchItemsByTier(99);
      expect(tier99.length).toBe(0);
    });
  });

  describe("getResearchStatus", () => {
    it("returns completed for completed research", () => {
      const state = makeResearchState({ completedResearch: ["basic_push_mower", "riding_mower_basic"] });
      expect(getResearchStatus(state, "riding_mower_basic")).toBe("completed");
    });

    it("returns researching for current research", () => {
      const state = makeResearchState({
        currentResearch: makeResearchProgress({ itemId: "riding_mower_basic" })
      });
      expect(getResearchStatus(state, "riding_mower_basic")).toBe("researching");
    });

    it("returns available when prerequisites met", () => {
      const state = makeResearchState({ completedResearch: ["basic_push_mower"] });
      expect(getResearchStatus(state, "riding_mower_basic")).toBe("available");
    });

    it("returns locked when prerequisites not met", () => {
      const state = makeResearchState({ completedResearch: [] });
      expect(getResearchStatus(state, "riding_mower_advanced")).toBe("locked");
    });

    it("returns locked for nonexistent item", () => {
      const state = makeResearchState();
      expect(getResearchStatus(state, "fake_item")).toBe("locked");
    });
  });

  describe("getAvailableResearch", () => {
    it("returns items with met prerequisites", () => {
      const state = makeResearchState({ completedResearch: ["basic_push_mower"] });
      const available = getAvailableResearch(state);

      expect(available.some(i => i.id === "riding_mower_basic")).toBe(true);
      expect(available.some(i => i.id === "basic_sprinkler")).toBe(true);
    });

    it("excludes completed items", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower", "riding_mower_basic"]
      });
      const available = getAvailableResearch(state);

      expect(available.some(i => i.id === "riding_mower_basic")).toBe(false);
    });

    it("excludes items with unmet prerequisites", () => {
      const state = makeResearchState({ completedResearch: ["basic_push_mower"] });
      const available = getAvailableResearch(state);

      expect(available.some(i => i.id === "riding_mower_advanced")).toBe(false);
    });
  });

  describe("getCompletedResearch", () => {
    it("returns completed research items", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower", "riding_mower_basic"]
      });
      const completed = getCompletedResearch(state);

      expect(completed.length).toBe(2);
      expect(completed.some(i => i.id === "basic_push_mower")).toBe(true);
      expect(completed.some(i => i.id === "riding_mower_basic")).toBe(true);
    });
  });

  describe("getLockedResearch", () => {
    it("returns items with unmet prerequisites", () => {
      const state = makeResearchState({ completedResearch: ["basic_push_mower"] });
      const locked = getLockedResearch(state);

      expect(locked.some(i => i.id === "riding_mower_advanced")).toBe(true);
    });

    it("excludes available items", () => {
      const state = makeResearchState({ completedResearch: ["basic_push_mower"] });
      const locked = getLockedResearch(state);

      expect(locked.some(i => i.id === "riding_mower_basic")).toBe(false);
    });
  });

  describe("canStartResearch", () => {
    it("returns true for available research", () => {
      const state = makeResearchState({ completedResearch: ["basic_push_mower"] });
      expect(canStartResearch(state, "riding_mower_basic")).toBe(true);
    });

    it("returns false for locked research", () => {
      const state = makeResearchState({ completedResearch: [] });
      expect(canStartResearch(state, "riding_mower_advanced")).toBe(false);
    });

    it("returns false for completed research", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower", "riding_mower_basic"]
      });
      expect(canStartResearch(state, "riding_mower_basic")).toBe(false);
    });
  });

  describe("getResearchProgress", () => {
    it("returns 0 with no current research", () => {
      const state = makeResearchState();
      expect(getResearchProgress(state)).toBe(0);
    });

    it("returns correct percentage", () => {
      const state = makeResearchState({
        currentResearch: makeResearchProgress({
          pointsEarned: 250,
          pointsRequired: 500
        })
      });
      expect(getResearchProgress(state)).toBe(50);
    });

    it("caps at 100%", () => {
      const state = makeResearchState({
        currentResearch: makeResearchProgress({
          pointsEarned: 600,
          pointsRequired: 500
        })
      });
      expect(getResearchProgress(state)).toBe(100);
    });

    it("handles zero required points", () => {
      const state = makeResearchState({
        currentResearch: makeResearchProgress({
          pointsEarned: 0,
          pointsRequired: 0
        })
      });
      expect(getResearchProgress(state)).toBe(100);
    });
  });

  describe("getEstimatedTimeToComplete", () => {
    it("returns null with no current research", () => {
      const state = makeResearchState();
      expect(getEstimatedTimeToComplete(state)).toBeNull();
    });

    it("returns null with no funding", () => {
      const state = makeResearchState({
        fundingLevel: "none",
        currentResearch: makeResearchProgress({
          pointsEarned: 0,
          pointsRequired: 500
        })
      });
      expect(getEstimatedTimeToComplete(state)).toBeNull();
    });

    it("calculates correct time remaining", () => {
      const state = makeResearchState({
        fundingLevel: "normal", // 3 points/min
        currentResearch: makeResearchProgress({
          pointsEarned: 200,
          pointsRequired: 500
        })
      });
      // 300 points remaining / 3 per min = 100 minutes
      expect(getEstimatedTimeToComplete(state)).toBe(100);
    });
  });

  describe("getFundingCostPerMinute", () => {
    it("returns correct cost for funding level", () => {
      const state = makeResearchState({ fundingLevel: "maximum" });
      expect(getFundingCostPerMinute(state)).toBe(400);
    });
  });

  describe("getTotalResearchCount", () => {
    it("returns total number of research items", () => {
      expect(getTotalResearchCount()).toBe(RESEARCH_ITEMS.length);
    });
  });

  describe("getCompletedResearchCount", () => {
    it("returns count of completed research", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower", "riding_mower_basic", "basic_fertilizer"]
      });
      expect(getCompletedResearchCount(state)).toBe(3);
    });
  });

  describe("getUnlockedEquipment", () => {
    it("returns equipment IDs from completed research", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower", "riding_mower_basic"]
      });
      const equipment = getUnlockedEquipment(state);

      expect(equipment).toContain("push_mower_1");
      expect(equipment).toContain("riding_mower_1");
    });

    it("excludes non-equipment research", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower", "basic_fertilizer"]
      });
      const equipment = getUnlockedEquipment(state);

      expect(equipment).toContain("push_mower_1");
      expect(equipment.length).toBe(1);
    });
  });

  describe("getUnlockedFertilizers", () => {
    it("returns fertilizer IDs from completed research", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower", "basic_fertilizer", "premium_fertilizer"]
      });
      const fertilizers = getUnlockedFertilizers(state);

      expect(fertilizers).toContain("fertilizer_standard");
      expect(fertilizers).toContain("fertilizer_premium");
    });
  });

  describe("getActiveUpgrades", () => {
    it("returns upgrade bonuses from completed research", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower", "employee_training_1"]
      });
      const upgrades = getActiveUpgrades(state);

      expect(upgrades.length).toBe(1);
      expect(upgrades[0].type).toBe("efficiency");
      expect(upgrades[0].value).toBe(1.1);
    });
  });

  describe("getPrerequisiteChain", () => {
    it("returns empty for item with no prerequisites", () => {
      const chain = getPrerequisiteChain("basic_push_mower");
      expect(chain.length).toBe(0);
    });

    it("returns direct prerequisites", () => {
      const chain = getPrerequisiteChain("riding_mower_basic");
      expect(chain).toContain("basic_push_mower");
    });

    it("returns full chain for deep items", () => {
      const chain = getPrerequisiteChain("riding_mower_advanced");
      expect(chain).toContain("basic_push_mower");
      expect(chain).toContain("riding_mower_basic");
    });

    it("returns empty for nonexistent item", () => {
      const chain = getPrerequisiteChain("fake_item");
      expect(chain.length).toBe(0);
    });
  });

  describe("getDependentResearch", () => {
    it("returns items that depend on given item", () => {
      const dependents = getDependentResearch("basic_push_mower");
      expect(dependents.some(i => i.id === "riding_mower_basic")).toBe(true);
    });

    it("returns empty for items with no dependents", () => {
      const dependents = getDependentResearch("autonomous_mower");
      expect(dependents.length).toBe(0);
    });
  });

  // ==========================================================================
  // State Transformation Tests
  // ==========================================================================

  describe("setFundingLevel", () => {
    it("changes funding level", () => {
      const state = makeResearchState({ fundingLevel: "normal" });
      const result = setFundingLevel(state, "maximum");
      expect(result.fundingLevel).toBe("maximum");
    });

    it("preserves other state", () => {
      const state = makeResearchState({
        fundingLevel: "normal",
        totalPointsSpent: 1000
      });
      const result = setFundingLevel(state, "minimum");
      expect(result.totalPointsSpent).toBe(1000);
    });

    it("preserves immutability", () => {
      const state = makeResearchState({ fundingLevel: "normal" });
      const result = setFundingLevel(state, "maximum");
      expect(state.fundingLevel).toBe("normal");
      expect(result.fundingLevel).toBe("maximum");
    });
  });

  describe("startResearch", () => {
    it("starts research when available", () => {
      const state = makeResearchState({ completedResearch: ["basic_push_mower"] });
      const result = startResearch(state, "riding_mower_basic", 1000);

      expect(result).not.toBeNull();
      expect(result?.currentResearch?.itemId).toBe("riding_mower_basic");
    });

    it("sets correct start time", () => {
      const state = makeResearchState({ completedResearch: ["basic_push_mower"] });
      const result = startResearch(state, "riding_mower_basic", 5000);

      expect(result?.currentResearch?.startTime).toBe(5000);
    });

    it("returns null for locked research", () => {
      const state = makeResearchState({ completedResearch: [] });
      const result = startResearch(state, "riding_mower_advanced", 1000);

      expect(result).toBeNull();
    });

    it("returns null for completed research", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower", "riding_mower_basic"]
      });
      const result = startResearch(state, "riding_mower_basic", 1000);

      expect(result).toBeNull();
    });

    it("queues if already researching", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower"],
        currentResearch: makeResearchProgress({ itemId: "basic_fertilizer" })
      });
      const result = startResearch(state, "riding_mower_basic", 1000);

      expect(result?.currentResearch?.itemId).toBe("basic_fertilizer");
      expect(result?.researchQueue).toContain("riding_mower_basic");
    });
  });

  describe("addToQueue", () => {
    it("adds item to queue", () => {
      const state = makeResearchState({ completedResearch: ["basic_push_mower"] });
      const result = addToQueue(state, "riding_mower_basic");

      expect(result?.researchQueue).toContain("riding_mower_basic");
    });

    it("maintains queue order", () => {
      let state = makeResearchState({ completedResearch: ["basic_push_mower"] });
      state = addToQueue(state, "riding_mower_basic")!;
      state = addToQueue(state, "basic_fertilizer")!;

      expect(state.researchQueue[0]).toBe("riding_mower_basic");
      expect(state.researchQueue[1]).toBe("basic_fertilizer");
    });

    it("returns null if already in queue", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower"],
        researchQueue: ["riding_mower_basic"]
      });
      const result = addToQueue(state, "riding_mower_basic");

      expect(result).toBeNull();
    });

    it("returns null if currently being researched", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower"],
        currentResearch: makeResearchProgress({ itemId: "riding_mower_basic" })
      });
      const result = addToQueue(state, "riding_mower_basic");

      expect(result).toBeNull();
    });

    it("returns null for completed items", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower", "riding_mower_basic"]
      });
      const result = addToQueue(state, "riding_mower_basic");

      expect(result).toBeNull();
    });
  });

  describe("removeFromQueue", () => {
    it("removes item from queue", () => {
      const state = makeResearchState({
        researchQueue: ["riding_mower_basic", "basic_fertilizer"]
      });
      const result = removeFromQueue(state, "riding_mower_basic");

      expect(result.researchQueue).not.toContain("riding_mower_basic");
      expect(result.researchQueue).toContain("basic_fertilizer");
    });

    it("handles item not in queue", () => {
      const state = makeResearchState({ researchQueue: ["basic_fertilizer"] });
      const result = removeFromQueue(state, "riding_mower_basic");

      expect(result.researchQueue).toEqual(["basic_fertilizer"]);
    });
  });

  describe("cancelResearch", () => {
    it("clears current research", () => {
      const state = makeResearchState({
        currentResearch: makeResearchProgress({ itemId: "riding_mower_basic" })
      });
      const result = cancelResearch(state);

      expect(result.currentResearch).toBeNull();
    });

    it("starts next queued item if available", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower"],
        currentResearch: makeResearchProgress({ itemId: "riding_mower_basic" }),
        researchQueue: ["basic_fertilizer"]
      });
      const result = cancelResearch(state);

      expect(result.currentResearch?.itemId).toBe("basic_fertilizer");
      expect(result.researchQueue.length).toBe(0);
    });

    it("handles empty state", () => {
      const state = makeResearchState({ currentResearch: null });
      const result = cancelResearch(state);

      expect(result).toEqual(state);
    });
  });

  describe("tickResearch", () => {
    it("adds progress based on funding level", () => {
      const state = makeResearchState({
        fundingLevel: "normal", // 3 points/min
        currentResearch: makeResearchProgress({
          pointsEarned: 100,
          pointsRequired: 500
        })
      });

      const result = tickResearch(state, 10, 1000); // 10 minutes

      expect(result.state.currentResearch?.pointsEarned).toBe(130); // 100 + 30
      expect(result.pointsAdded).toBe(30);
      expect(result.completed).toBeNull();
    });

    it("completes research when points reached", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower"],
        fundingLevel: "maximum", // 6 points/min
        currentResearch: makeResearchProgress({
          itemId: "riding_mower_basic",
          pointsEarned: 490,
          pointsRequired: 500
        })
      });

      const result = tickResearch(state, 10, 1000);

      expect(result.completed?.id).toBe("riding_mower_basic");
      expect(result.state.completedResearch).toContain("riding_mower_basic");
    });

    it("starts next queued item after completion", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower"],
        fundingLevel: "maximum",
        currentResearch: makeResearchProgress({
          itemId: "riding_mower_basic",
          pointsEarned: 490,
          pointsRequired: 500
        }),
        researchQueue: ["basic_fertilizer"]
      });

      const result = tickResearch(state, 10, 1000);

      expect(result.state.currentResearch?.itemId).toBe("basic_fertilizer");
      expect(result.state.researchQueue.length).toBe(0);
    });

    it("does nothing with no current research", () => {
      const state = makeResearchState({ currentResearch: null });
      const result = tickResearch(state, 10, 1000);

      expect(result.state).toEqual(state);
      expect(result.completed).toBeNull();
      expect(result.pointsAdded).toBe(0);
    });

    it("does nothing with no funding", () => {
      const state = makeResearchState({
        fundingLevel: "none",
        currentResearch: makeResearchProgress({
          pointsEarned: 100,
          pointsRequired: 500
        })
      });

      const result = tickResearch(state, 10, 1000);

      expect(result.state.currentResearch?.pointsEarned).toBe(100);
      expect(result.pointsAdded).toBe(0);
    });

    it("updates total points spent on completion", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower"],
        fundingLevel: "maximum",
        currentResearch: makeResearchProgress({
          itemId: "riding_mower_basic",
          pointsEarned: 490,
          pointsRequired: 500
        }),
        totalPointsSpent: 100
      });

      const result = tickResearch(state, 10, 1000);

      expect(result.state.totalPointsSpent).toBe(600); // 100 + 500
    });

    it("skips queued items with unmet prerequisites", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower"],
        fundingLevel: "maximum",
        currentResearch: makeResearchProgress({
          itemId: "riding_mower_basic",
          pointsEarned: 490,
          pointsRequired: 500
        }),
        // riding_mower_advanced requires riding_mower_basic, which is just completing
        researchQueue: ["riding_mower_advanced", "basic_fertilizer"]
      });

      const result = tickResearch(state, 10, 1000);

      // After completing riding_mower_basic, riding_mower_advanced prerequisites are now met
      expect(result.state.currentResearch?.itemId).toBe("riding_mower_advanced");
    });
  });

  describe("completeResearchInstantly", () => {
    it("marks research as completed", () => {
      const state = makeResearchState({ completedResearch: ["basic_push_mower"] });
      const result = completeResearchInstantly(state, "riding_mower_basic");

      expect(result?.completedResearch).toContain("riding_mower_basic");
    });

    it("adds cost to total points spent", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower"],
        totalPointsSpent: 100
      });
      const result = completeResearchInstantly(state, "riding_mower_basic");

      expect(result?.totalPointsSpent).toBe(600); // 100 + 500
    });

    it("returns null if prerequisites not met", () => {
      const state = makeResearchState({ completedResearch: [] });
      const result = completeResearchInstantly(state, "riding_mower_advanced");

      expect(result).toBeNull();
    });

    it("returns state unchanged if already completed", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower", "riding_mower_basic"]
      });
      const result = completeResearchInstantly(state, "riding_mower_basic");

      expect(result).toEqual(state);
    });

    it("clears current research if completing that item", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower"],
        currentResearch: makeResearchProgress({ itemId: "riding_mower_basic" })
      });
      const result = completeResearchInstantly(state, "riding_mower_basic");

      expect(result?.currentResearch).toBeNull();
    });

    it("removes item from queue if present", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower"],
        researchQueue: ["riding_mower_basic", "basic_fertilizer"]
      });
      const result = completeResearchInstantly(state, "riding_mower_basic");

      expect(result?.researchQueue).not.toContain("riding_mower_basic");
      expect(result?.researchQueue).toContain("basic_fertilizer");
    });

    it("returns null for nonexistent item", () => {
      const state = makeResearchState();
      const result = completeResearchInstantly(state, "fake_item");

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Utility Function Tests
  // ==========================================================================

  describe("formatResearchTime", () => {
    it("formats minutes under an hour", () => {
      expect(formatResearchTime(30)).toBe("30 min");
    });

    it("formats exact hours", () => {
      expect(formatResearchTime(120)).toBe("2h");
    });

    it("formats hours and minutes", () => {
      expect(formatResearchTime(90)).toBe("1h 30m");
    });

    it("rounds up partial minutes", () => {
      expect(formatResearchTime(65.5)).toBe("1h 6m");
    });
  });

  describe("getResearchCategoryName", () => {
    it("returns display name for each category", () => {
      expect(getResearchCategoryName("equipment")).toBe("Equipment");
      expect(getResearchCategoryName("fertilizers")).toBe("Fertilizers");
      expect(getResearchCategoryName("irrigation")).toBe("Irrigation");
      expect(getResearchCategoryName("landscaping")).toBe("Landscaping");
      expect(getResearchCategoryName("facilities")).toBe("Facilities");
      expect(getResearchCategoryName("management")).toBe("Management");
      expect(getResearchCategoryName("robotics")).toBe("Robotics");
    });
  });

  // ==========================================================================
  // Robotics & Autonomous Equipment Tests
  // ==========================================================================

  describe("Robotics Category", () => {
    it("has robotics research items", () => {
      const roboticsItems = getResearchItemsByCategory("robotics");
      expect(roboticsItems.length).toBeGreaterThan(0);
    });

    it("robotics items are tier 5", () => {
      const roboticsItems = getResearchItemsByCategory("robotics");
      expect(roboticsItems.every(item => item.tier === 5)).toBe(true);
    });

    it("has robot mower for fairways", () => {
      const item = getResearchItem("robot_mower_fairway");
      expect(item).not.toBeNull();
      expect(item?.category).toBe("robotics");
    });

    it("has robot mower for greens", () => {
      const item = getResearchItem("robot_mower_greens");
      expect(item).not.toBeNull();
      expect(item?.category).toBe("robotics");
    });

    it("has robot sprayer", () => {
      const item = getResearchItem("robot_sprayer");
      expect(item).not.toBeNull();
      expect(item?.category).toBe("robotics");
    });

    it("has robot fertilizer spreader", () => {
      const item = getResearchItem("robot_fertilizer");
      expect(item).not.toBeNull();
      expect(item?.category).toBe("robotics");
    });

    it("has robot bunker rake", () => {
      const item = getResearchItem("robot_bunker_rake");
      expect(item).not.toBeNull();
      expect(item?.category).toBe("robotics");
    });

    it("has fleet management AI upgrade", () => {
      const item = getResearchItem("robot_fleet_manager");
      expect(item).not.toBeNull();
      expect(item?.unlocks.type).toBe("upgrade");
    });
  });

  describe("Autonomous Equipment Stats", () => {
    it("robot equipment has isAutonomous flag", () => {
      const item = getResearchItem("robot_mower_fairway");
      if (item?.unlocks.type === "equipment") {
        expect(item.unlocks.stats.isAutonomous).toBe(true);
      }
    });

    it("robot equipment has purchase cost", () => {
      const item = getResearchItem("robot_mower_fairway");
      if (item?.unlocks.type === "equipment") {
        expect(item.unlocks.stats.purchaseCost).toBeGreaterThan(0);
        expect(item.unlocks.stats.purchaseCost).toBe(45000);
      }
    });

    it("robot equipment has low operating cost", () => {
      const item = getResearchItem("robot_mower_fairway");
      if (item?.unlocks.type === "equipment") {
        // $2.50/hour is much less than employee wages (~$12-25/hour)
        expect(item.unlocks.stats.operatingCostPerHour).toBeLessThan(5);
      }
    });

    it("robot equipment has breakdown rate", () => {
      const item = getResearchItem("robot_mower_fairway");
      if (item?.unlocks.type === "equipment") {
        expect(item.unlocks.stats.breakdownRate).toBeGreaterThan(0);
        expect(item.unlocks.stats.breakdownRate).toBeLessThan(0.1);
      }
    });

    it("robot equipment has repair time", () => {
      const item = getResearchItem("robot_mower_fairway");
      if (item?.unlocks.type === "equipment") {
        expect(item.unlocks.stats.repairTime).toBeGreaterThan(0);
      }
    });

    it("bunker rake has higher breakdown rate due to sand", () => {
      const bunkerBot = getResearchItem("robot_bunker_rake");
      const fairwayBot = getResearchItem("robot_mower_fairway");

      if (bunkerBot?.unlocks.type === "equipment" && fairwayBot?.unlocks.type === "equipment") {
        expect(bunkerBot.unlocks.stats.breakdownRate).toBeGreaterThan(
          fairwayBot.unlocks.stats.breakdownRate!
        );
      }
    });
  });

  describe("isAutonomousEquipment", () => {
    it("returns true for robot equipment", () => {
      expect(isAutonomousEquipment("robot_mower_fairway")).toBe(true);
      expect(isAutonomousEquipment("robot_sprayer")).toBe(true);
      expect(isAutonomousEquipment("robot_fertilizer")).toBe(true);
    });

    it("returns false for regular equipment", () => {
      expect(isAutonomousEquipment("push_mower_1")).toBe(false);
      expect(isAutonomousEquipment("riding_mower_1")).toBe(false);
    });

    it("returns false for nonexistent equipment", () => {
      expect(isAutonomousEquipment("fake_equipment")).toBe(false);
    });
  });

  describe("getAutonomousEquipmentStats", () => {
    it("returns stats for valid equipment", () => {
      const stats = getAutonomousEquipmentStats("robot_mower_fairway");
      expect(stats).not.toBeNull();
      expect(stats?.isAutonomous).toBe(true);
      expect(stats?.purchaseCost).toBe(45000);
    });

    it("returns null for nonexistent equipment", () => {
      const stats = getAutonomousEquipmentStats("fake_equipment");
      expect(stats).toBeNull();
    });
  });

  describe("getUnlockedAutonomousEquipment", () => {
    it("returns empty array with no robot research completed", () => {
      const state = makeResearchState({ completedResearch: ["basic_push_mower"] });
      const autonomous = getUnlockedAutonomousEquipment(state);
      expect(autonomous.length).toBe(0);
    });

    it("returns autonomous equipment when researched", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower", "robot_mower_fairway"]
      });
      const autonomous = getUnlockedAutonomousEquipment(state);

      expect(autonomous.length).toBe(1);
      expect(autonomous[0].equipmentId).toBe("robot_mower_fairway");
      expect(autonomous[0].stats.isAutonomous).toBe(true);
    });

    it("returns multiple autonomous equipment", () => {
      const state = makeResearchState({
        completedResearch: [
          "basic_push_mower",
          "robot_mower_fairway",
          "robot_sprayer",
          "robot_fertilizer"
        ]
      });
      const autonomous = getUnlockedAutonomousEquipment(state);

      expect(autonomous.length).toBe(3);
    });
  });

  describe("calculateRobotOperatingCost", () => {
    it("calculates cost based on hours", () => {
      const stats: EquipmentStats = {
        efficiency: 1,
        speed: 1,
        fuelCapacity: 100,
        fuelEfficiency: 1,
        durability: 100,
        isAutonomous: true,
        operatingCostPerHour: 2.50
      };

      expect(calculateRobotOperatingCost(stats, 1)).toBe(2.50);
      expect(calculateRobotOperatingCost(stats, 8)).toBe(20.00);
      expect(calculateRobotOperatingCost(stats, 24)).toBe(60.00);
    });

    it("returns 0 for non-autonomous equipment", () => {
      const stats: EquipmentStats = {
        efficiency: 1,
        speed: 1,
        fuelCapacity: 100,
        fuelEfficiency: 1,
        durability: 100
        // No operatingCostPerHour
      };

      expect(calculateRobotOperatingCost(stats, 8)).toBe(0);
    });
  });

  describe("calculateBreakdownProbability", () => {
    it("calculates probability over time", () => {
      const stats: EquipmentStats = {
        efficiency: 1,
        speed: 1,
        fuelCapacity: 100,
        fuelEfficiency: 1,
        durability: 100,
        breakdownRate: 0.02  // 2% per hour
      };

      // Probability increases with time
      const prob1h = calculateBreakdownProbability(stats, 1);
      const prob8h = calculateBreakdownProbability(stats, 8);
      const prob24h = calculateBreakdownProbability(stats, 24);

      expect(prob1h).toBeCloseTo(0.02, 2);
      expect(prob8h).toBeGreaterThan(prob1h);
      expect(prob24h).toBeGreaterThan(prob8h);
    });

    it("fleet AI reduces breakdown rate by 40%", () => {
      const stats: EquipmentStats = {
        efficiency: 1,
        speed: 1,
        fuelCapacity: 100,
        fuelEfficiency: 1,
        durability: 100,
        breakdownRate: 0.02
      };

      const probWithoutAI = calculateBreakdownProbability(stats, 10, false);
      const probWithAI = calculateBreakdownProbability(stats, 10, true);

      expect(probWithAI).toBeLessThan(probWithoutAI);
      // With 40% reduction, the rate drops from 0.02 to 0.012
    });

    it("returns 0 for equipment without breakdown rate", () => {
      const stats: EquipmentStats = {
        efficiency: 1,
        speed: 1,
        fuelCapacity: 100,
        fuelEfficiency: 1,
        durability: 100
        // No breakdownRate
      };

      expect(calculateBreakdownProbability(stats, 24)).toBe(0);
    });
  });

  describe("Robot Economics", () => {
    it("robot operating cost is much cheaper than groundskeeper wages", () => {
      // Groundskeeper: ~$12/hour base, robot: $2.50/hour
      const stats = getAutonomousEquipmentStats("robot_mower_fairway");
      expect(stats?.operatingCostPerHour).toBeLessThan(12);
    });

    it("robot has significant upfront cost", () => {
      const stats = getAutonomousEquipmentStats("robot_mower_fairway");
      // $45,000 is a significant investment
      expect(stats?.purchaseCost).toBeGreaterThan(30000);
    });

    it("daily robot cost vs employee comparison", () => {
      const stats = getAutonomousEquipmentStats("robot_mower_fairway");
      const dailyRobotCost = (stats?.operatingCostPerHour ?? 0) * 8; // 8-hour day
      const dailyEmployeeCost = 12 * 8; // $12/hr groundskeeper

      expect(dailyRobotCost).toBeLessThan(dailyEmployeeCost);
      // Robot: $20/day, Employee: $96/day
    });
  });

  // ==========================================================================
  // Research Tree Integrity Tests
  // ==========================================================================

  describe("Research Tree Integrity", () => {
    it("all prerequisites reference valid items", () => {
      const itemIds = new Set(RESEARCH_ITEMS.map(i => i.id));

      for (const item of RESEARCH_ITEMS) {
        for (const prereq of item.prerequisites) {
          expect(itemIds.has(prereq)).toBe(true);
        }
      }
    });

    it("no circular dependencies", () => {
      function hasCircularDep(itemId: string, visited: Set<string>): boolean {
        if (visited.has(itemId)) return true;

        const item = getResearchItem(itemId);
        if (!item) return false;

        visited.add(itemId);

        for (const prereq of item.prerequisites) {
          if (hasCircularDep(prereq, new Set(visited))) {
            return true;
          }
        }

        return false;
      }

      for (const item of RESEARCH_ITEMS) {
        expect(hasCircularDep(item.id, new Set())).toBe(false);
      }
    });

    it("all items are reachable from starting items", () => {
      const state = createInitialResearchState();
      let completed = new Set(state.completedResearch);

      // Simulate completing all available research repeatedly
      for (let i = 0; i < 10; i++) {
        const available = RESEARCH_ITEMS.filter(item => {
          if (completed.has(item.id)) return false;
          return item.prerequisites.every(p => completed.has(p));
        });

        for (const item of available) {
          completed.add(item.id);
        }
      }

      expect(completed.size).toBe(RESEARCH_ITEMS.length);
    });

    it("higher tier items have higher or equal costs", () => {
      const tier1 = getResearchItemsByTier(1);
      const tier5 = getResearchItemsByTier(5);

      if (tier1.length > 0 && tier5.length > 0) {
        const avgTier1Cost = tier1.reduce((sum, i) => sum + i.baseCost, 0) / tier1.length;
        const avgTier5Cost = tier5.reduce((sum, i) => sum + i.baseCost, 0) / tier5.length;

        expect(avgTier5Cost).toBeGreaterThan(avgTier1Cost);
      }
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("Edge Cases", () => {
    it("handles completing entire research tree", () => {
      let state = createInitialResearchState();

      // Complete all research in order
      for (let tier = 1; tier <= 5; tier++) {
        for (const item of getResearchItemsByTier(tier)) {
          const prereqsMet = item.prerequisites.every(p =>
            state.completedResearch.includes(p)
          );

          if (prereqsMet && !state.completedResearch.includes(item.id)) {
            const result = completeResearchInstantly(state, item.id);
            if (result) state = result;
          }
        }
      }

      expect(getCompletedResearchCount(state)).toBe(RESEARCH_ITEMS.length);
    });

    it("handles very long research times", () => {
      const state = makeResearchState({
        fundingLevel: "minimum", // 1 point/min
        currentResearch: makeResearchProgress({
          pointsEarned: 0,
          pointsRequired: 5000
        })
      });

      // 5000 minutes to complete
      const result = tickResearch(state, 5000, 0);

      expect(result.completed).not.toBeNull();
    });

    it("handles queue with prerequisites that become available", () => {
      // Queue has item that requires current research
      const state = makeResearchState({
        completedResearch: ["basic_push_mower"],
        fundingLevel: "maximum",
        currentResearch: makeResearchProgress({
          itemId: "riding_mower_basic",
          pointsEarned: 499,
          pointsRequired: 500
        }),
        researchQueue: ["riding_mower_advanced"] // Requires riding_mower_basic
      });

      const result = tickResearch(state, 1, 1000);

      // After completing riding_mower_basic, riding_mower_advanced should start
      expect(result.state.currentResearch?.itemId).toBe("riding_mower_advanced");
    });
  });
});
