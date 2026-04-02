import { describe, it, expect } from "vitest";
import {
  ResearchState,
  ResearchProgress,

  FUNDING_POINTS_PER_MINUTE,
  FUNDING_COST_PER_MINUTE,
  RESEARCH_ITEMS,

  createInitialResearchState,
  getResearchStatus,
  getAvailableResearch,
  getResearchProgress,
  getFundingCostPerMinute,
  getBestFertilizerEffectiveness,
  getEquipmentEfficiencyBonus,
  getUnlockedAutonomousEquipment,
  getPrerequisiteChain,

  setFundingLevel,
  startResearch,
  cancelResearch,
  tickResearch,
  completeResearchInstantly,
  describeResearchUnlock
} from "./research";

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

describe("Research System", () => {
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

  describe("getFundingCostPerMinute", () => {
    it("returns correct cost for funding level", () => {
      const state = makeResearchState({ fundingLevel: "maximum" });
      expect(getFundingCostPerMinute(state)).toBe(8);
    });
  });

  describe("getBestFertilizerEffectiveness", () => {
    it("returns 1.0 when no fertilizers researched", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower"]
      });
      expect(getBestFertilizerEffectiveness(state)).toBe(1.0);
    });

    it("returns effectiveness of researched fertilizer", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower", "basic_fertilizer"]
      });
      expect(getBestFertilizerEffectiveness(state)).toBe(1.0);
    });

    it("returns highest effectiveness when multiple fertilizers researched", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower", "basic_fertilizer", "premium_fertilizer"]
      });
      expect(getBestFertilizerEffectiveness(state)).toBe(1.5);
    });

    it("returns maximum effectiveness with all fertilizers", () => {
      const state = makeResearchState({
        completedResearch: [
          "basic_push_mower",
          "basic_fertilizer",
          "premium_fertilizer",
          "slow_release_fertilizer",
          "organic_fertilizer"
        ]
      });
      expect(getBestFertilizerEffectiveness(state)).toBe(2.5);
    });
  });

  describe("getEquipmentEfficiencyBonus", () => {
    it("returns 1.0 when no training researched", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower"]
      });
      expect(getEquipmentEfficiencyBonus(state)).toBe(1.0);
    });

    it("returns bonus from basic training", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower", "employee_training_1"]
      });
      expect(getEquipmentEfficiencyBonus(state)).toBe(1.1);
    });

    it("stacks bonuses from multiple training upgrades", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower", "employee_training_1", "employee_training_2"]
      });
      expect(getEquipmentEfficiencyBonus(state)).toBeCloseTo(1.375);
    });

    it("ignores non-efficiency upgrades", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower", "clubhouse_upgrade"]
      });
      expect(getEquipmentEfficiencyBonus(state)).toBe(1.0);
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

    it("handles diamond dependencies without duplicates", () => {
      const chain = getPrerequisiteChain("smart_irrigation_controller");
      expect(chain).toContain("piped_irrigation_basic");
      const pibCount = chain.filter(id => id === "piped_irrigation_basic").length;
      expect(pibCount).toBe(1);
    });
  });

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

    it("skips invalid item IDs in queue", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower"],
        currentResearch: makeResearchProgress({ itemId: "riding_mower_basic" }),
        researchQueue: ["fake_invalid_id", "basic_fertilizer"]
      });
      const result = cancelResearch(state);

      expect(result.currentResearch).toBeNull();
    });

    it("skips locked items in queue", () => {
      const state = makeResearchState({
        completedResearch: [],
        currentResearch: makeResearchProgress({ itemId: "basic_push_mower" }),
        researchQueue: ["riding_mower_basic"]
      });
      const result = cancelResearch(state);

      expect(result.currentResearch).toBeNull();
    });
  });

  describe("tickResearch", () => {
    it("adds progress based on funding level", () => {
      const state = makeResearchState({
        fundingLevel: "normal",
        currentResearch: makeResearchProgress({
          pointsEarned: 100,
          pointsRequired: 500
        })
      });

      const result = tickResearch(state, 10, 1000);

      expect(result.state.currentResearch?.pointsEarned).toBe(130);
      expect(result.pointsAdded).toBe(30);
      expect(result.completed).toBeNull();
    });

    it("completes research when points reached", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower"],
        fundingLevel: "maximum",
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

      expect(result.state.totalPointsSpent).toBe(600);
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
        researchQueue: ["riding_mower_advanced", "basic_fertilizer"]
      });

      const result = tickResearch(state, 10, 1000);

      expect(result.state.currentResearch?.itemId).toBe("riding_mower_advanced");
    });

    it("skips invalid item IDs in queue on completion", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower"],
        fundingLevel: "maximum",
        currentResearch: makeResearchProgress({
          itemId: "riding_mower_basic",
          pointsEarned: 490,
          pointsRequired: 500
        }),
        researchQueue: ["fake_invalid_id", "basic_fertilizer"]
      });

      const result = tickResearch(state, 10, 1000);

      expect(result.state.currentResearch?.itemId).toBe("basic_fertilizer");
    });

    it("skips items with unmet prerequisites on completion", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower"],
        fundingLevel: "maximum",
        currentResearch: makeResearchProgress({
          itemId: "basic_fertilizer",
          pointsEarned: 190,
          pointsRequired: 200
        }),
        researchQueue: ["riding_mower_advanced"]
      });

      const result = tickResearch(state, 10, 1000);

      expect(result.state.currentResearch).toBeNull();
      expect(result.state.researchQueue).toContain("riding_mower_advanced");
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

      expect(result?.totalPointsSpent).toBe(600);
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

  describe("describeResearchUnlock", () => {
    it("describes equipment unlock", () => {
      const item = RESEARCH_ITEMS.find(i => i.id === "riding_mower_basic")!;
      const desc = describeResearchUnlock(item);
      expect(desc).toBe("Unlocked Basic Riding Mower");
    });

    it("describes autonomous equipment unlock", () => {
      const item = RESEARCH_ITEMS.find(i => i.id === "robot_mower_fairway")!;
      const desc = describeResearchUnlock(item);
      expect(desc).toContain("autonomous");
    });

    it("describes fertilizer unlock with effectiveness", () => {
      const item = RESEARCH_ITEMS.find(i => i.id === "premium_fertilizer")!;
      const desc = describeResearchUnlock(item);
      expect(desc).toContain("1.5x effectiveness");
    });

    it("describes upgrade bonus", () => {
      const item = RESEARCH_ITEMS.find(i => i.id === "employee_training_1")!;
      const desc = describeResearchUnlock(item);
      expect(desc).toContain("10%");
      expect(desc).toContain("efficiency");
    });

    it("describes feature unlock", () => {
      const item = RESEARCH_ITEMS.find(i => i.id === "weather_system")!;
      const desc = describeResearchUnlock(item);
      expect(desc).toContain("feature");
    });
  });

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
      const itemMap = new Map(RESEARCH_ITEMS.map(i => [i.id, i]));

      function hasCircularDep(itemId: string, visited: Set<string>): boolean {
        if (visited.has(itemId)) return true;

        const item = itemMap.get(itemId);
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
      const tier1 = RESEARCH_ITEMS.filter(i => i.tier === 1);
      const tier5 = RESEARCH_ITEMS.filter(i => i.tier === 5);

      if (tier1.length > 0 && tier5.length > 0) {
        const avgTier1Cost = tier1.reduce((sum, i) => sum + i.baseCost, 0) / tier1.length;
        const avgTier5Cost = tier5.reduce((sum, i) => sum + i.baseCost, 0) / tier5.length;

        expect(avgTier5Cost).toBeGreaterThan(avgTier1Cost);
      }
    });
  });

  describe("Edge Cases", () => {
    it("handles completing entire research tree", () => {
      let state = createInitialResearchState();

      for (let tier = 1; tier <= 5; tier++) {
        const tierItems = RESEARCH_ITEMS.filter(i => i.tier === tier);
        for (const item of tierItems) {
          const prereqsMet = item.prerequisites.every(p =>
            state.completedResearch.includes(p)
          );

          if (prereqsMet && !state.completedResearch.includes(item.id)) {
            const result = completeResearchInstantly(state, item.id);
            if (result) state = result;
          }
        }
      }

      expect(state.completedResearch.length).toBe(RESEARCH_ITEMS.length);
    });

    it("handles very long research times", () => {
      const state = makeResearchState({
        fundingLevel: "minimum",
        currentResearch: makeResearchProgress({
          pointsEarned: 0,
          pointsRequired: 5000
        })
      });

      const result = tickResearch(state, 5000, 0);

      expect(result.completed).not.toBeNull();
    });

    it("handles queue with prerequisites that become available", () => {
      const state = makeResearchState({
        completedResearch: ["basic_push_mower"],
        fundingLevel: "maximum",
        currentResearch: makeResearchProgress({
          itemId: "riding_mower_basic",
          pointsEarned: 499,
          pointsRequired: 500
        }),
        researchQueue: ["riding_mower_advanced"]
      });

      const result = tickResearch(state, 1, 1000);

      expect(result.state.currentResearch?.itemId).toBe("riding_mower_advanced");
    });
  });
});
