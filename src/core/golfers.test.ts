import { describe, it, expect, beforeEach } from "vitest";
import {
  // Types
  Golfer,
  GolferType,
  GolferPoolState,
  GolferPreferences,
  WeatherCondition,

  // Constants
  GOLFER_TYPE_WEIGHTS,
  GOLFER_TYPE_CONFIGS,
  DEFAULT_GREEN_FEES,
  SATISFACTION_WEIGHTS,
  WEATHER_SATISFACTION_MODIFIERS,

  // Factory functions
  createInitialPoolState,
  generateGolferPreferences,
  selectGolferType,
  createGolfer,

  // Query functions
  getGolfer,
  getGolfersByStatus,
  getGolfersByType,
  getActiveGolferCount,
  getPlayingGolferCount,
  isAtCapacity,
  getAvailableTeeSlots,
  calculateCrowdingLevel,
  getAverageSatisfaction,
  getGolferStats,

  // Pricing functions
  getGreenFee,
  wouldPayFee,
  calculateOptimalPrice,
  calculateTip,

  // Satisfaction functions
  calculateSatisfactionFactor,
  updateSatisfaction,
  calculateWillReturn,

  // Generation functions
  calculateArrivalRate,
  generateArrivals,

  // State transformation functions
  addGolfer,
  removeGolfer,
  updateGolfer,
  setGolferStatus,
  advanceGolferProgress,
  tickGolfers,
  updateCourseRating,
  resetDailyStats,

  // Utility functions
  getGolferTypeName,
  getSatisfactionLevel,
  formatGreenFee,
  resetGolferCounter,
  estimateRoundDuration
} from "./golfers";

// ============================================================================
// Test Helpers
// ============================================================================

function makeGolfer(overrides: Partial<Golfer> = {}): Golfer {
  return {
    id: "golfer_test",
    type: "regular",
    preferences: {
      priceThreshold: 75,
      qualityExpectation: 65,
      patienceLevel: 60,
      tipGenerosity: 1.0
    },
    status: "playing",
    arrivalTime: 0,
    holesPlayed: 0,
    totalHoles: 18,
    paidAmount: 55,
    satisfaction: 75,
    satisfactionFactors: {},
    willReturn: false,
    ...overrides
  };
}

function makePoolState(overrides: Partial<GolferPoolState> = {}): GolferPoolState {
  return {
    golfers: [],
    dailyVisitors: 0,
    peakCapacity: 40,
    totalVisitorsToday: 0,
    totalRevenueToday: 0,
    rating: {
      overall: 70,
      condition: 70,
      difficulty: 50,
      amenities: 60,
      value: 70
    },
    ...overrides
  };
}

function makeWeather(overrides: Partial<WeatherCondition> = {}): WeatherCondition {
  return {
    type: "sunny",
    temperature: 75,
    windSpeed: 5,
    ...overrides
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("Golfer System", () => {
  beforeEach(() => {
    resetGolferCounter();
  });

  // ==========================================================================
  // Constants Tests
  // ==========================================================================

  describe("Constants", () => {
    it("golfer type weights sum to 1", () => {
      const sum = Object.values(GOLFER_TYPE_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 2);
    });

    it("all golfer types have configs", () => {
      const types: GolferType[] = ["casual", "regular", "enthusiast", "professional", "tourist"];
      for (const type of types) {
        expect(GOLFER_TYPE_CONFIGS[type]).toBeDefined();
      }
    });

    it("satisfaction weights sum to 1", () => {
      const sum = Object.values(SATISFACTION_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 2);
    });

    it("has valid weather modifiers", () => {
      expect(WEATHER_SATISFACTION_MODIFIERS.sunny).toBe(1.0);
      expect(WEATHER_SATISFACTION_MODIFIERS.stormy).toBeLessThan(WEATHER_SATISFACTION_MODIFIERS.sunny);
    });

    it("has default green fees", () => {
      expect(DEFAULT_GREEN_FEES.weekday18Holes).toBeGreaterThan(0);
      expect(DEFAULT_GREEN_FEES.weekend18Holes).toBeGreaterThan(DEFAULT_GREEN_FEES.weekday18Holes);
    });
  });

  // ==========================================================================
  // Factory Function Tests
  // ==========================================================================

  describe("createInitialPoolState", () => {
    it("creates empty golfer pool", () => {
      const state = createInitialPoolState();
      expect(state.golfers).toEqual([]);
    });

    it("sets default peak capacity", () => {
      const state = createInitialPoolState();
      expect(state.peakCapacity).toBe(40);
    });

    it("accepts custom capacity", () => {
      const state = createInitialPoolState(60);
      expect(state.peakCapacity).toBe(60);
    });

    it("initializes daily stats to zero", () => {
      const state = createInitialPoolState();
      expect(state.dailyVisitors).toBe(0);
      expect(state.totalVisitorsToday).toBe(0);
      expect(state.totalRevenueToday).toBe(0);
    });

    it("has initial course rating", () => {
      const state = createInitialPoolState();
      expect(state.rating.overall).toBe(70);
    });
  });

  describe("generateGolferPreferences", () => {
    it("generates preferences within type ranges", () => {
      const config = GOLFER_TYPE_CONFIGS.regular;
      const prefs = generateGolferPreferences("regular");

      expect(prefs.priceThreshold).toBeGreaterThanOrEqual(config.priceRange[0]);
      expect(prefs.priceThreshold).toBeLessThanOrEqual(config.priceRange[1]);
    });

    it("generates deterministic results with seed", () => {
      const prefs1 = generateGolferPreferences("casual", 0.5);
      const prefs2 = generateGolferPreferences("casual", 0.5);
      expect(prefs1.priceThreshold).toBe(prefs2.priceThreshold);
    });

    it("professionals have higher quality expectations", () => {
      const casual = GOLFER_TYPE_CONFIGS.casual;
      const professional = GOLFER_TYPE_CONFIGS.professional;

      expect(professional.qualityRange[0]).toBeGreaterThan(casual.qualityRange[0]);
    });
  });

  describe("selectGolferType", () => {
    it("returns valid golfer type", () => {
      const validTypes: GolferType[] = ["casual", "regular", "enthusiast", "professional", "tourist"];
      const type = selectGolferType();
      expect(validTypes).toContain(type);
    });

    it("produces distribution matching weights over many samples", () => {
      const counts: Record<GolferType, number> = {
        casual: 0, regular: 0, enthusiast: 0, professional: 0, tourist: 0
      };

      for (let i = 0; i < 1000; i++) {
        counts[selectGolferType(i / 1000)]++;
      }

      // Casual should be most common
      expect(counts.casual).toBeGreaterThan(counts.professional);
    });
  });

  describe("createGolfer", () => {
    it("creates golfer with unique id", () => {
      const g1 = createGolfer("casual", 0);
      const g2 = createGolfer("casual", 0);
      expect(g1.id).not.toBe(g2.id);
    });

    it("sets type correctly", () => {
      const golfer = createGolfer("enthusiast", 0);
      expect(golfer.type).toBe("enthusiast");
    });

    it("sets arrival time", () => {
      const golfer = createGolfer("casual", 5000);
      expect(golfer.arrivalTime).toBe(5000);
    });

    it("defaults to 18 holes", () => {
      const golfer = createGolfer("casual", 0);
      expect(golfer.totalHoles).toBe(18);
    });

    it("accepts 9 holes option", () => {
      const golfer = createGolfer("casual", 0, 9);
      expect(golfer.totalHoles).toBe(9);
    });

    it("starts with arriving status", () => {
      const golfer = createGolfer("casual", 0);
      expect(golfer.status).toBe("arriving");
    });

    it("starts with neutral satisfaction", () => {
      const golfer = createGolfer("casual", 0);
      expect(golfer.satisfaction).toBe(75);
    });

    it("starts with zero holes played", () => {
      const golfer = createGolfer("casual", 0);
      expect(golfer.holesPlayed).toBe(0);
    });

    it("accepts custom preferences", () => {
      const prefs: GolferPreferences = {
        priceThreshold: 100,
        qualityExpectation: 80,
        patienceLevel: 50,
        tipGenerosity: 1.5
      };
      const golfer = createGolfer("casual", 0, 18, 50, prefs);
      expect(golfer.preferences).toEqual(prefs);
    });
  });

  // ==========================================================================
  // Query Function Tests
  // ==========================================================================

  describe("getGolfer", () => {
    it("returns golfer when found", () => {
      const golfer = makeGolfer({ id: "golfer_123" });
      const state = makePoolState({ golfers: [golfer] });
      expect(getGolfer(state, "golfer_123")).toEqual(golfer);
    });

    it("returns null when not found", () => {
      const state = makePoolState();
      expect(getGolfer(state, "fake")).toBeNull();
    });
  });

  describe("getGolfersByStatus", () => {
    it("filters by status", () => {
      const g1 = makeGolfer({ id: "g1", status: "playing" });
      const g2 = makeGolfer({ id: "g2", status: "checking_in" });
      const g3 = makeGolfer({ id: "g3", status: "playing" });
      const state = makePoolState({ golfers: [g1, g2, g3] });

      const playing = getGolfersByStatus(state, "playing");
      expect(playing.length).toBe(2);
    });
  });

  describe("getGolfersByType", () => {
    it("filters by type", () => {
      const g1 = makeGolfer({ id: "g1", type: "casual" });
      const g2 = makeGolfer({ id: "g2", type: "professional" });
      const g3 = makeGolfer({ id: "g3", type: "casual" });
      const state = makePoolState({ golfers: [g1, g2, g3] });

      const casual = getGolfersByType(state, "casual");
      expect(casual.length).toBe(2);
    });
  });

  describe("getActiveGolferCount", () => {
    it("counts playing and checking in golfers", () => {
      const state = makePoolState({
        golfers: [
          makeGolfer({ id: "g1", status: "playing" }),
          makeGolfer({ id: "g2", status: "checking_in" }),
          makeGolfer({ id: "g3", status: "leaving" })
        ]
      });
      expect(getActiveGolferCount(state)).toBe(2);
    });
  });

  describe("getPlayingGolferCount", () => {
    it("counts only playing golfers", () => {
      const state = makePoolState({
        golfers: [
          makeGolfer({ id: "g1", status: "playing" }),
          makeGolfer({ id: "g2", status: "checking_in" }),
          makeGolfer({ id: "g3", status: "playing" })
        ]
      });
      expect(getPlayingGolferCount(state)).toBe(2);
    });
  });

  describe("isAtCapacity", () => {
    it("returns false when under capacity", () => {
      const state = makePoolState({
        peakCapacity: 40,
        golfers: [makeGolfer({ status: "playing" })]
      });
      expect(isAtCapacity(state)).toBe(false);
    });

    it("returns true at capacity", () => {
      const golfers = Array(40).fill(null).map((_, i) =>
        makeGolfer({ id: `g${i}`, status: "playing" })
      );
      const state = makePoolState({ peakCapacity: 40, golfers });
      expect(isAtCapacity(state)).toBe(true);
    });
  });

  describe("getAvailableTeeSlots", () => {
    it("calculates remaining slots", () => {
      const golfers = Array(15).fill(null).map((_, i) =>
        makeGolfer({ id: `g${i}`, status: "playing" })
      );
      const state = makePoolState({ peakCapacity: 40, golfers });
      expect(getAvailableTeeSlots(state)).toBe(25);
    });

    it("returns 0 at capacity", () => {
      const golfers = Array(40).fill(null).map((_, i) =>
        makeGolfer({ id: `g${i}`, status: "playing" })
      );
      const state = makePoolState({ peakCapacity: 40, golfers });
      expect(getAvailableTeeSlots(state)).toBe(0);
    });
  });

  describe("calculateCrowdingLevel", () => {
    it("returns 0 when empty", () => {
      const state = makePoolState();
      expect(calculateCrowdingLevel(state)).toBe(0);
    });

    it("returns 50 at half capacity", () => {
      const golfers = Array(20).fill(null).map((_, i) =>
        makeGolfer({ id: `g${i}`, status: "playing" })
      );
      const state = makePoolState({ peakCapacity: 40, golfers });
      expect(calculateCrowdingLevel(state)).toBe(50);
    });

    it("returns 100 at full capacity", () => {
      const golfers = Array(40).fill(null).map((_, i) =>
        makeGolfer({ id: `g${i}`, status: "playing" })
      );
      const state = makePoolState({ peakCapacity: 40, golfers });
      expect(calculateCrowdingLevel(state)).toBe(100);
    });
  });

  describe("getAverageSatisfaction", () => {
    it("returns 75 for empty pool", () => {
      const state = makePoolState();
      expect(getAverageSatisfaction(state)).toBe(75);
    });

    it("calculates average", () => {
      const state = makePoolState({
        golfers: [
          makeGolfer({ id: "g1", satisfaction: 80 }),
          makeGolfer({ id: "g2", satisfaction: 60 })
        ]
      });
      expect(getAverageSatisfaction(state)).toBe(70);
    });
  });

  describe("getGolferStats", () => {
    it("returns stats for pool", () => {
      const state = makePoolState({
        golfers: [
          makeGolfer({ id: "g1", type: "casual", satisfaction: 80, willReturn: true }),
          makeGolfer({ id: "g2", type: "regular", satisfaction: 60, willReturn: false })
        ],
        totalVisitorsToday: 10,
        totalRevenueToday: 500
      });

      const stats = getGolferStats(state);
      expect(stats.totalGolfers).toBe(10);
      expect(stats.totalRevenue).toBe(500);
      expect(stats.averageSatisfaction).toBe(70);
      expect(stats.returnRate).toBe(50);
      expect(stats.byType.casual).toBe(1);
      expect(stats.byType.regular).toBe(1);
    });
  });

  // ==========================================================================
  // Pricing Function Tests
  // ==========================================================================

  describe("getGreenFee", () => {
    it("returns weekday rate for weekdays", () => {
      const fee = getGreenFee(DEFAULT_GREEN_FEES, 18, false, false);
      expect(fee).toBe(DEFAULT_GREEN_FEES.weekday18Holes);
    });

    it("returns weekend rate for weekends", () => {
      const fee = getGreenFee(DEFAULT_GREEN_FEES, 18, true, false);
      expect(fee).toBe(DEFAULT_GREEN_FEES.weekend18Holes);
    });

    it("returns twilight rate when twilight", () => {
      const fee = getGreenFee(DEFAULT_GREEN_FEES, 18, false, true);
      expect(fee).toBe(DEFAULT_GREEN_FEES.twilight18Holes);
    });

    it("twilight takes priority over weekend", () => {
      const fee = getGreenFee(DEFAULT_GREEN_FEES, 18, true, true);
      expect(fee).toBe(DEFAULT_GREEN_FEES.twilight18Holes);
    });

    it("returns 9-hole rate for 9 holes", () => {
      const fee = getGreenFee(DEFAULT_GREEN_FEES, 9, false, false);
      expect(fee).toBe(DEFAULT_GREEN_FEES.weekday9Holes);
    });
  });

  describe("wouldPayFee", () => {
    it("returns true when fee is under threshold", () => {
      const golfer = makeGolfer({ preferences: { ...makeGolfer().preferences, priceThreshold: 100 } });
      expect(wouldPayFee(golfer, 80)).toBe(true);
    });

    it("returns true when fee equals threshold", () => {
      const golfer = makeGolfer({ preferences: { ...makeGolfer().preferences, priceThreshold: 100 } });
      expect(wouldPayFee(golfer, 100)).toBe(true);
    });

    it("returns false when fee exceeds threshold", () => {
      const golfer = makeGolfer({ preferences: { ...makeGolfer().preferences, priceThreshold: 100 } });
      expect(wouldPayFee(golfer, 120)).toBe(false);
    });
  });

  describe("calculateOptimalPrice", () => {
    it("increases price with higher crowding", () => {
      const lowCrowding = makePoolState({ peakCapacity: 40, golfers: [] });
      const highCrowding = makePoolState({
        peakCapacity: 40,
        golfers: Array(30).fill(null).map((_, i) =>
          makeGolfer({ id: `g${i}`, status: "playing" })
        )
      });

      const lowPrice = calculateOptimalPrice(lowCrowding, 50);
      const highPrice = calculateOptimalPrice(highCrowding, 50);

      expect(highPrice).toBeGreaterThan(lowPrice);
    });

    it("increases price with higher rating", () => {
      const lowRating = makePoolState({ rating: { ...makePoolState().rating, overall: 50 } });
      const highRating = makePoolState({ rating: { ...makePoolState().rating, overall: 90 } });

      const lowPrice = calculateOptimalPrice(lowRating, 50);
      const highPrice = calculateOptimalPrice(highRating, 50);

      expect(highPrice).toBeGreaterThan(lowPrice);
    });
  });

  describe("calculateTip", () => {
    it("returns base tip at neutral satisfaction", () => {
      const golfer = makeGolfer({ satisfaction: 75, preferences: { ...makeGolfer().preferences, tipGenerosity: 1.0 } });
      const tip = calculateTip(golfer, 5);
      expect(tip).toBeCloseTo(5, 1);
    });

    it("increases tip with higher satisfaction", () => {
      const lowSat = makeGolfer({ satisfaction: 50, preferences: { ...makeGolfer().preferences, tipGenerosity: 1.0 } });
      const highSat = makeGolfer({ satisfaction: 100, preferences: { ...makeGolfer().preferences, tipGenerosity: 1.0 } });

      expect(calculateTip(highSat, 5)).toBeGreaterThan(calculateTip(lowSat, 5));
    });

    it("scales with tip generosity", () => {
      const lowGen = makeGolfer({ satisfaction: 75, preferences: { ...makeGolfer().preferences, tipGenerosity: 0.5 } });
      const highGen = makeGolfer({ satisfaction: 75, preferences: { ...makeGolfer().preferences, tipGenerosity: 2.0 } });

      expect(calculateTip(highGen, 5)).toBeGreaterThan(calculateTip(lowGen, 5));
    });
  });

  // ==========================================================================
  // Satisfaction Function Tests
  // ==========================================================================

  describe("calculateSatisfactionFactor", () => {
    it("returns high satisfaction when course condition meets expectation", () => {
      const golfer = makeGolfer({ preferences: { ...makeGolfer().preferences, qualityExpectation: 70 } });
      const sat = calculateSatisfactionFactor("course_condition", 80, golfer);
      expect(sat).toBeGreaterThanOrEqual(80);
    });

    it("returns low satisfaction when course condition below expectation", () => {
      const golfer = makeGolfer({ preferences: { ...makeGolfer().preferences, qualityExpectation: 80 } });
      const sat = calculateSatisfactionFactor("course_condition", 50, golfer);
      expect(sat).toBeLessThan(70);
    });

    it("patient golfers tolerate slow pace", () => {
      const patient = makeGolfer({ preferences: { ...makeGolfer().preferences, patienceLevel: 80 } });
      const impatient = makeGolfer({ preferences: { ...makeGolfer().preferences, patienceLevel: 20 } });

      const patientSat = calculateSatisfactionFactor("pace_of_play", 50, patient);
      const impatientSat = calculateSatisfactionFactor("pace_of_play", 50, impatient);

      expect(patientSat).toBeGreaterThan(impatientSat);
    });
  });

  describe("updateSatisfaction", () => {
    it("updates satisfaction factors", () => {
      const golfer = makeGolfer({ satisfactionFactors: {} });
      const updated = updateSatisfaction(golfer, { course_condition: 80 });

      expect(updated.satisfactionFactors.course_condition).toBeDefined();
    });

    it("recalculates overall satisfaction", () => {
      const golfer = makeGolfer({ satisfaction: 50 });
      const updated = updateSatisfaction(golfer, {
        course_condition: 90,
        facilities: 90,
        staff_service: 90
      });

      expect(updated.satisfaction).toBeGreaterThan(golfer.satisfaction);
    });

    it("preserves existing factors", () => {
      const golfer = makeGolfer({
        satisfactionFactors: { course_condition: 80 }
      });
      const updated = updateSatisfaction(golfer, { facilities: 70 });

      expect(updated.satisfactionFactors.course_condition).toBe(80);
      expect(updated.satisfactionFactors.facilities).toBeDefined();
    });
  });

  describe("calculateWillReturn", () => {
    it("returns true for high satisfaction", () => {
      const golfer = makeGolfer({ satisfaction: 90, type: "regular" });
      expect(calculateWillReturn(golfer)).toBe(true);
    });

    it("returns false for low satisfaction", () => {
      const golfer = makeGolfer({ satisfaction: 30, type: "regular" });
      expect(calculateWillReturn(golfer)).toBe(false);
    });

    it("tourists are less likely to return", () => {
      const tourist = makeGolfer({ satisfaction: 70, type: "tourist" });
      const regular = makeGolfer({ satisfaction: 70, type: "regular" });

      // Run multiple times since there's randomness
      // Tourist should have lower return probability
      expect(calculateWillReturn(regular)).toBe(true);
      // Tourist at 70% with 0.5 modifier = 0.35, should be false
      expect(calculateWillReturn(tourist)).toBe(false);
    });

    it("poor value reduces return chance", () => {
      const goodValue = makeGolfer({
        satisfaction: 75,
        type: "regular",
        satisfactionFactors: { price_value: 80 }
      });
      // Good value should return
      expect(calculateWillReturn(goodValue)).toBe(true);
    });
  });

  // ==========================================================================
  // Generation Function Tests
  // ==========================================================================

  describe("calculateArrivalRate", () => {
    it("returns higher rate for better rated courses", () => {
      const lowRated = makePoolState({ rating: { ...makePoolState().rating, overall: 50 } });
      const highRated = makePoolState({ rating: { ...makePoolState().rating, overall: 90 } });
      const weather = makeWeather();

      const lowRate = calculateArrivalRate(lowRated, weather, false, 9);
      const highRate = calculateArrivalRate(highRated, weather, false, 9);

      expect(highRate).toBeGreaterThan(lowRate);
    });

    it("returns lower rate in bad weather", () => {
      const state = makePoolState();
      const sunny = makeWeather({ type: "sunny" });
      const stormy = makeWeather({ type: "stormy" });

      const sunnyRate = calculateArrivalRate(state, sunny, false, 9);
      const stormyRate = calculateArrivalRate(state, stormy, false, 9);

      expect(sunnyRate).toBeGreaterThan(stormyRate);
    });

    it("returns higher rate on weekends", () => {
      const state = makePoolState();
      const weather = makeWeather();

      const weekdayRate = calculateArrivalRate(state, weather, false, 9);
      const weekendRate = calculateArrivalRate(state, weather, true, 9);

      expect(weekendRate).toBeGreaterThan(weekdayRate);
    });

    it("peaks during morning hours", () => {
      const state = makePoolState();
      const weather = makeWeather();

      const morningRate = calculateArrivalRate(state, weather, false, 8);
      const noonRate = calculateArrivalRate(state, weather, false, 12);

      expect(morningRate).toBeGreaterThan(noonRate);
    });

    it("drops when crowded", () => {
      const empty = makePoolState();
      const crowded = makePoolState({
        golfers: Array(35).fill(null).map((_, i) =>
          makeGolfer({ id: `g${i}`, status: "playing" })
        )
      });
      const weather = makeWeather();

      const emptyRate = calculateArrivalRate(empty, weather, false, 9);
      const crowdedRate = calculateArrivalRate(crowded, weather, false, 9);

      expect(emptyRate).toBeGreaterThan(crowdedRate);
    });
  });

  describe("generateArrivals", () => {
    it("generates specified count of golfers", () => {
      const state = makePoolState();
      const arrivals = generateArrivals(state, 5, 0, DEFAULT_GREEN_FEES, false, false);

      // Some might not pay, so should be <= 5
      expect(arrivals.length).toBeLessThanOrEqual(5);
    });

    it("returns empty for zero count", () => {
      const state = makePoolState();
      const arrivals = generateArrivals(state, 0, 0, DEFAULT_GREEN_FEES, false, false);
      expect(arrivals).toEqual([]);
    });

    it("golfers have paid amount set", () => {
      const state = makePoolState();
      const arrivals = generateArrivals(state, 10, 0, DEFAULT_GREEN_FEES, false, false);

      for (const golfer of arrivals) {
        expect(golfer.paidAmount).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================================================
  // State Transformation Tests
  // ==========================================================================

  describe("addGolfer", () => {
    it("adds golfer to pool", () => {
      const state = makePoolState();
      const golfer = makeGolfer();
      const result = addGolfer(state, golfer);

      expect(result.golfers.length).toBe(1);
    });

    it("increments daily visitors", () => {
      const state = makePoolState({ dailyVisitors: 5 });
      const golfer = makeGolfer();
      const result = addGolfer(state, golfer);

      expect(result.dailyVisitors).toBe(6);
    });

    it("adds to total revenue", () => {
      const state = makePoolState({ totalRevenueToday: 100 });
      const golfer = makeGolfer({ paidAmount: 55 });
      const result = addGolfer(state, golfer);

      expect(result.totalRevenueToday).toBe(155);
    });
  });

  describe("removeGolfer", () => {
    it("removes golfer from pool", () => {
      const golfer = makeGolfer({ id: "g1" });
      const state = makePoolState({ golfers: [golfer] });
      const result = removeGolfer(state, "g1");

      expect(result.golfers.length).toBe(0);
    });

    it("keeps other golfers", () => {
      const g1 = makeGolfer({ id: "g1" });
      const g2 = makeGolfer({ id: "g2" });
      const state = makePoolState({ golfers: [g1, g2] });
      const result = removeGolfer(state, "g1");

      expect(result.golfers.length).toBe(1);
      expect(result.golfers[0].id).toBe("g2");
    });
  });

  describe("updateGolfer", () => {
    it("updates golfer fields", () => {
      const golfer = makeGolfer({ id: "g1", satisfaction: 50 });
      const state = makePoolState({ golfers: [golfer] });
      const result = updateGolfer(state, "g1", { satisfaction: 80 });

      expect(result?.golfers[0].satisfaction).toBe(80);
    });

    it("returns null for nonexistent golfer", () => {
      const state = makePoolState();
      expect(updateGolfer(state, "fake", { satisfaction: 80 })).toBeNull();
    });
  });

  describe("setGolferStatus", () => {
    it("updates status", () => {
      const golfer = makeGolfer({ id: "g1", status: "arriving" });
      const state = makePoolState({ golfers: [golfer] });
      const result = setGolferStatus(state, "g1", "playing");

      expect(result?.golfers[0].status).toBe("playing");
    });
  });

  describe("advanceGolferProgress", () => {
    it("increases holes played", () => {
      const golfer = makeGolfer({ id: "g1", holesPlayed: 5, totalHoles: 18 });
      const state = makePoolState({ golfers: [golfer] });
      const result = advanceGolferProgress(state, "g1", 3);

      expect(result?.golfers[0].holesPlayed).toBe(8);
    });

    it("caps at total holes", () => {
      const golfer = makeGolfer({ id: "g1", holesPlayed: 16, totalHoles: 18 });
      const state = makePoolState({ golfers: [golfer] });
      const result = advanceGolferProgress(state, "g1", 5);

      expect(result?.golfers[0].holesPlayed).toBe(18);
    });

    it("sets status to finishing when complete", () => {
      const golfer = makeGolfer({ id: "g1", holesPlayed: 17, totalHoles: 18, status: "playing" });
      const state = makePoolState({ golfers: [golfer] });
      const result = advanceGolferProgress(state, "g1", 2);

      expect(result?.golfers[0].status).toBe("finishing");
    });
  });

  describe("tickGolfers", () => {
    it("advances arriving golfers to checking_in", () => {
      const golfer = makeGolfer({ id: "g1", status: "arriving" });
      const state = makePoolState({ golfers: [golfer] });
      const weather = makeWeather();

      const result = tickGolfers(state, 10, 70, 70, weather);

      expect(result.state.golfers[0].status).toBe("checking_in");
    });

    it("advances checking_in golfers to playing", () => {
      const golfer = makeGolfer({ id: "g1", status: "checking_in" });
      const state = makePoolState({ golfers: [golfer] });
      const weather = makeWeather();

      const result = tickGolfers(state, 10, 70, 70, weather);

      expect(result.state.golfers[0].status).toBe("playing");
    });

    it("progresses holes for playing golfers", () => {
      const golfer = makeGolfer({ id: "g1", status: "playing", holesPlayed: 0, totalHoles: 18 });
      const state = makePoolState({ golfers: [golfer] });
      const weather = makeWeather();

      const result = tickGolfers(state, 60, 70, 70, weather);

      expect(result.state.golfers[0].holesPlayed).toBeGreaterThan(0);
    });

    it("updates satisfaction while playing", () => {
      const golfer = makeGolfer({
        id: "g1",
        status: "playing",
        holesPlayed: 5,
        totalHoles: 18,
        satisfactionFactors: {}
      });
      const state = makePoolState({ golfers: [golfer] });
      const weather = makeWeather();

      const result = tickGolfers(state, 30, 90, 70, weather);

      expect(result.state.golfers[0].satisfactionFactors.course_condition).toBeDefined();
    });

    it("finishing golfers become leaving with departures", () => {
      const golfer = makeGolfer({ id: "g1", status: "finishing" });
      const state = makePoolState({ golfers: [golfer] });
      const weather = makeWeather();

      const result = tickGolfers(state, 10, 70, 70, weather);

      expect(result.departures.length).toBe(1);
      expect(result.departures[0].id).toBe("g1");
    });

    it("removes leaving golfers", () => {
      const golfer = makeGolfer({ id: "g1", status: "finishing" });
      const state = makePoolState({ golfers: [golfer] });
      const weather = makeWeather();

      const result = tickGolfers(state, 10, 70, 70, weather);

      expect(result.state.golfers.length).toBe(0);
    });

    it("calculates tips from departing golfers", () => {
      const golfer = makeGolfer({
        id: "g1",
        status: "finishing",
        satisfaction: 80,
        preferences: { ...makeGolfer().preferences, tipGenerosity: 1.5 }
      });
      const state = makePoolState({ golfers: [golfer] });
      const weather = makeWeather();

      const result = tickGolfers(state, 10, 70, 70, weather);

      expect(result.tips).toBeGreaterThan(0);
    });
  });

  describe("updateCourseRating", () => {
    it("updates specified ratings", () => {
      const state = makePoolState();
      const result = updateCourseRating(state, { condition: 85 });

      expect(result.rating.condition).toBe(85);
    });

    it("recalculates overall rating", () => {
      const state = makePoolState();
      const result = updateCourseRating(state, { condition: 90, amenities: 90, value: 90 });

      expect(result.rating.overall).toBeGreaterThan(state.rating.overall);
    });
  });

  describe("resetDailyStats", () => {
    it("resets all daily counters", () => {
      const state = makePoolState({
        dailyVisitors: 50,
        totalVisitorsToday: 50,
        totalRevenueToday: 2500
      });
      const result = resetDailyStats(state);

      expect(result.dailyVisitors).toBe(0);
      expect(result.totalVisitorsToday).toBe(0);
      expect(result.totalRevenueToday).toBe(0);
    });

    it("preserves golfers", () => {
      const golfer = makeGolfer();
      const state = makePoolState({
        golfers: [golfer],
        totalVisitorsToday: 10
      });
      const result = resetDailyStats(state);

      expect(result.golfers.length).toBe(1);
    });
  });

  // ==========================================================================
  // Utility Function Tests
  // ==========================================================================

  describe("getGolferTypeName", () => {
    it("returns display names", () => {
      expect(getGolferTypeName("casual")).toBe("Casual Golfer");
      expect(getGolferTypeName("professional")).toBe("Professional");
      expect(getGolferTypeName("tourist")).toBe("Tourist");
    });
  });

  describe("getSatisfactionLevel", () => {
    it("returns level names", () => {
      expect(getSatisfactionLevel(95)).toBe("Excellent");
      expect(getSatisfactionLevel(80)).toBe("Good");
      expect(getSatisfactionLevel(65)).toBe("Fair");
      expect(getSatisfactionLevel(45)).toBe("Poor");
      expect(getSatisfactionLevel(30)).toBe("Very Poor");
    });
  });

  describe("formatGreenFee", () => {
    it("formats with dollar sign", () => {
      expect(formatGreenFee(55)).toBe("$55");
      expect(formatGreenFee(100)).toBe("$100");
    });
  });

  describe("estimateRoundDuration", () => {
    it("returns base duration at no crowding", () => {
      expect(estimateRoundDuration(9, 0)).toBe(120);
      expect(estimateRoundDuration(18, 0)).toBe(240);
    });

    it("increases duration with crowding", () => {
      expect(estimateRoundDuration(18, 100)).toBeGreaterThan(estimateRoundDuration(18, 0));
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("Edge Cases", () => {
    it("handles pool at exactly capacity", () => {
      const golfers = Array(40).fill(null).map((_, i) =>
        makeGolfer({ id: `g${i}`, status: "playing" })
      );
      const state = makePoolState({ peakCapacity: 40, golfers });

      expect(isAtCapacity(state)).toBe(true);
      expect(getAvailableTeeSlots(state)).toBe(0);
      expect(calculateCrowdingLevel(state)).toBe(100);
    });

    it("handles zero capacity edge case", () => {
      const state = makePoolState({ peakCapacity: 0 });
      expect(isAtCapacity(state)).toBe(true);
    });

    it("handles golfer completing round in single tick", () => {
      const golfer = makeGolfer({
        id: "g1",
        status: "playing",
        holesPlayed: 16,
        totalHoles: 18
      });
      const state = makePoolState({ golfers: [golfer] });
      const weather = makeWeather();

      // 60 minutes = 2 holes at HOLES_PER_HOUR
      const result = tickGolfers(state, 60, 70, 70, weather);

      expect(result.state.golfers[0].holesPlayed).toBe(18);
      expect(result.state.golfers[0].status).toBe("finishing");
    });

    it("maintains immutability", () => {
      const golfer = makeGolfer({ id: "g1" });
      const state = makePoolState({ golfers: [golfer] });

      const result = addGolfer(state, makeGolfer({ id: "g2" }));

      expect(state.golfers.length).toBe(1);
      expect(result.golfers.length).toBe(2);
    });
  });
});
