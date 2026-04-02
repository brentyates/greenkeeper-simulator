import { describe, it, expect } from "vitest";
import {
  Golfer,
  GolferPoolState,
  WeatherCondition,

  DEFAULT_GREEN_FEES,

  createInitialPoolState,
  createGolfer,

  getGolfer,
  getAverageSatisfaction,

  calculateArrivalRate,
  generateArrivals,

  addGolfer,
  tickGolfers,
  updateCourseRating,
  resetDailyStats
} from "./golfers";

function makeGolfer(overrides: Partial<Golfer> = {}): Golfer {
  return {
    id: "golfer_test",
    name: "Test Golfer",
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

describe("Golfer System", () => {
  describe("Constants", () => {
    it("has default green fees", () => {
      expect(DEFAULT_GREEN_FEES.weekday18Holes).toBeGreaterThan(0);
      expect(DEFAULT_GREEN_FEES.weekend18Holes).toBeGreaterThan(DEFAULT_GREEN_FEES.weekday18Holes);
    });
  });

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
  });

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

    it("drops sharply when course condition collapses", () => {
      const weather = makeWeather();
      const healthy = makePoolState({
        rating: { ...makePoolState().rating, overall: 75, condition: 72 }
      });
      const neglected = makePoolState({
        rating: { ...makePoolState().rating, overall: 75, condition: 18 }
      });

      const healthyRate = calculateArrivalRate(healthy, weather, false, 9);
      const neglectedRate = calculateArrivalRate(neglected, weather, false, 9);

      expect(healthyRate).toBeGreaterThan(neglectedRate);
      expect(neglectedRate).toBeLessThan(healthyRate * 0.25);
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

    it("applies afternoon modifier for hours 13-16", () => {
      const state = makePoolState();
      const weather = makeWeather();

      const afternoonRate = calculateArrivalRate(state, weather, false, 14);
      const eveningRate = calculateArrivalRate(state, weather, false, 18);

      expect(afternoonRate).toBeGreaterThan(eveningRate);
    });

    it("applies twilight modifier for hour >= 17", () => {
      const state = makePoolState();
      const weather = makeWeather();

      const twilightRate = calculateArrivalRate(state, weather, false, 17);
      const noonRate = calculateArrivalRate(state, weather, false, 12);

      expect(twilightRate).toBeLessThan(noonRate);
    });

    it("applies early morning modifier for hour < 7", () => {
      const state = makePoolState();
      const weather = makeWeather();

      const earlyRate = calculateArrivalRate(state, weather, false, 6);
      const morningRate = calculateArrivalRate(state, weather, false, 8);

      expect(earlyRate).toBeLessThan(morningRate);
    });

    it("applies moderate crowding modifier for 60-80% capacity", () => {
      const moderateCrowd = makePoolState({
        peakCapacity: 40,
        golfers: Array(26).fill(null).map((_, i) =>
          makeGolfer({ id: `g${i}`, status: "playing" })
        )
      });
      const veryCrowded = makePoolState({
        peakCapacity: 40,
        golfers: Array(34).fill(null).map((_, i) =>
          makeGolfer({ id: `g${i}`, status: "playing" })
        )
      });
      const weather = makeWeather();

      const moderateRate = calculateArrivalRate(moderateCrowd, weather, false, 9);
      const veryRate = calculateArrivalRate(veryCrowded, weather, false, 9);

      expect(moderateRate).toBeGreaterThan(veryRate);
    });
  });

  describe("generateArrivals", () => {
    it("generates specified count of golfers", () => {
      const state = makePoolState();
      const arrivals = generateArrivals(state, 5, 0, DEFAULT_GREEN_FEES, false, false);

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

  describe("Price Value Branches", () => {
    it("assigns great value (100) when paidAmount is much lower than expected", () => {
      const golfer = makeGolfer({
        id: "g1",
        status: "checking_in",
        paidAmount: 40,
        preferences: { ...makeGolfer().preferences, priceThreshold: 100 }
      });
      const state = makePoolState({
        golfers: [golfer],
        rating: { ...makePoolState().rating, overall: 70 }
      });
      const weather = makeWeather();

      const result = tickGolfers(state, 10, 70, 70, weather);

      expect(result.state.golfers[0].status).toBe("playing");
      expect(result.state.golfers[0].satisfactionFactors.price_value).toBe(100);
    });

    it("assigns fair value (75) when paidAmount is at or below expected", () => {
      const golfer = makeGolfer({
        id: "g1",
        status: "checking_in",
        paidAmount: 60,
        preferences: { ...makeGolfer().preferences, priceThreshold: 100 }
      });
      const state = makePoolState({
        golfers: [golfer],
        rating: { ...makePoolState().rating, overall: 70 }
      });
      const weather = makeWeather();

      const result = tickGolfers(state, 10, 70, 70, weather);

      expect(result.state.golfers[0].status).toBe("playing");
      expect(result.state.golfers[0].satisfactionFactors.price_value).toBe(75);
    });

    it("assigns slightly overpriced (50) when paidAmount exceeds expected by up to 30%", () => {
      const golfer = makeGolfer({
        id: "g1",
        status: "checking_in",
        paidAmount: 85,
        preferences: { ...makeGolfer().preferences, priceThreshold: 100 }
      });
      const state = makePoolState({
        golfers: [golfer],
        rating: { ...makePoolState().rating, overall: 70 }
      });
      const weather = makeWeather();

      const result = tickGolfers(state, 10, 70, 70, weather);

      expect(result.state.golfers[0].status).toBe("playing");
      expect(result.state.golfers[0].satisfactionFactors.price_value).toBe(50);
    });

    it("assigns overpriced (25) when paidAmount exceeds expected by more than 30%", () => {
      const golfer = makeGolfer({
        id: "g1",
        status: "checking_in",
        paidAmount: 100,
        preferences: { ...makeGolfer().preferences, priceThreshold: 100 }
      });
      const state = makePoolState({
        golfers: [golfer],
        rating: { ...makePoolState().rating, overall: 70 }
      });
      const weather = makeWeather();

      const result = tickGolfers(state, 10, 70, 70, weather);

      expect(result.state.golfers[0].status).toBe("playing");
      expect(result.state.golfers[0].satisfactionFactors.price_value).toBe(25);
    });
  });

  describe("Edge Cases", () => {
    it("handles golfer completing round in single tick", () => {
      const golfer = makeGolfer({
        id: "g1",
        status: "playing",
        holesPlayed: 16,
        totalHoles: 18
      });
      const state = makePoolState({ golfers: [golfer] });
      const weather = makeWeather();

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
