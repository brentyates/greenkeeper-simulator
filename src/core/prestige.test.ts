import { describe, it, expect } from 'vitest';
import {
  TIER_TOLERANCES,

  createInitialPrestigeState,
  getStarDisplay,
  calculateDemandMultiplier,
  updatePrestigeScore,
  resetDailyStats,
  takeDailySnapshot,
  updateHistoricalExcellence,
  upgradeAmenity,
} from './prestige';

describe('Prestige System', () => {
  describe('createInitialPrestigeState', () => {
    it('creates state with default score of 100', () => {
      const state = createInitialPrestigeState();
      expect(state.currentScore).toBe(100);
      expect(state.targetScore).toBe(100);
      expect(state.tier).toBe('municipal');
    });

    it('creates state with custom starting score', () => {
      const state = createInitialPrestigeState(500);
      expect(state.currentScore).toBe(500);
      expect(state.tier).toBe('semi_private');
    });

    it('sets appropriate tolerance for tier', () => {
      const state = createInitialPrestigeState(600);
      expect(state.tolerance).toEqual(TIER_TOLERANCES.private_club);
    });

    it('sets default green fee to sweet spot', () => {
      const state = createInitialPrestigeState(400);
      expect(state.greenFee).toBe(TIER_TOLERANCES.semi_private.sweetSpot);
    });

    it('initializes daily stats to zero', () => {
      const state = createInitialPrestigeState();
      expect(state.golfersToday).toBe(0);
      expect(state.golfersRejectedToday).toBe(0);
      expect(state.revenueToday).toBe(0);
      expect(state.revenueLostToday).toBe(0);
    });
  });

  describe('getStarDisplay', () => {
    it('displays 1 star correctly', () => {
      expect(getStarDisplay(1)).toBe('★☆☆☆☆');
    });

    it('displays 1.5 stars correctly', () => {
      expect(getStarDisplay(1.5)).toBe('★½☆☆☆');
    });

    it('displays 3 stars correctly', () => {
      expect(getStarDisplay(3)).toBe('★★★☆☆');
    });

    it('displays 5 stars correctly', () => {
      expect(getStarDisplay(5)).toBe('★★★★★');
    });

    it('displays half star at boundary', () => {
      expect(getStarDisplay(2.5)).toBe('★★½☆☆');
    });
  });

  describe('calculateDemandMultiplier', () => {
    const tolerance = {
      sweetSpot: 50,
      rejectionThreshold: 75,
      maxTolerance: 100,
    };

    it('returns 1.0 at or below sweet spot', () => {
      expect(calculateDemandMultiplier(30, tolerance)).toBe(1.0);
      expect(calculateDemandMultiplier(50, tolerance)).toBe(1.0);
    });

    it('returns between 0.8-1.0 between sweet spot and rejection threshold', () => {
      const multiplier = calculateDemandMultiplier(62.5, tolerance);
      expect(multiplier).toBeGreaterThan(0.8);
      expect(multiplier).toBeLessThan(1.0);
    });

    it('returns 0.8 at rejection threshold', () => {
      expect(calculateDemandMultiplier(75, tolerance)).toBe(0.8);
    });

    it('returns between 0.2-0.8 between rejection and max tolerance', () => {
      const multiplier = calculateDemandMultiplier(87.5, tolerance);
      expect(multiplier).toBeGreaterThan(0.2);
      expect(multiplier).toBeLessThan(0.8);
    });

    it('returns 0.2 at max tolerance', () => {
      expect(calculateDemandMultiplier(100, tolerance)).toBeCloseTo(0.2);
    });

    it('returns low multiplier beyond max tolerance', () => {
      const multiplier = calculateDemandMultiplier(150, tolerance);
      expect(multiplier).toBeLessThanOrEqual(0.2);
      expect(multiplier).toBeGreaterThanOrEqual(0.05);
    });

    it('never returns below 0.05', () => {
      expect(calculateDemandMultiplier(1000, tolerance)).toBeGreaterThanOrEqual(0.05);
    });
  });

  describe('updatePrestigeScore', () => {
    it('increases score gradually toward target', () => {
      const state = createInitialPrestigeState(100);
      state.reputation = { ...state.reputation, composite: 0 };
      const conditions = {
        averageHealth: 100,
        greenScore: 100,
        fairwayScore: 100,
        bunkerScore: 100,
        hazardScore: 100,
        teeBoxScore: 100,
        composite: 300,
      };
      const newState = updatePrestigeScore(state, conditions);
      expect(newState.currentScore).toBe(105);
      expect(newState.targetScore).toBe(200);
    });

    it('decreases score faster than it increases', () => {
      const state = createInitialPrestigeState(500);
      state.historicalExcellence = { ...state.historicalExcellence, composite: 0 };
      state.amenities = { ...state.amenities, facilities: {
        drivingRange: false, puttingGreen: false, chippingArea: false,
        teachingAcademy: false, golfSimulator: false, tourLevelRange: false
      } };
      state.reputation = { ...state.reputation, composite: 0, averageRating: 1.0 };
      state.exclusivity = { ...state.exclusivity, composite: 0 };
      const conditions = {
        averageHealth: 0,
        greenScore: 0,
        fairwayScore: 0,
        bunkerScore: 0,
        hazardScore: 0,
        teeBoxScore: 0,
        composite: 0,
      };
      const newState = updatePrestigeScore(state, conditions);
      expect(newState.currentScore).toBeLessThan(500);
      expect(newState.targetScore).toBeLessThan(500);
    });

    it('updates tier when crossing threshold', () => {
      const state = createInitialPrestigeState(395);
      state.historicalExcellence = { ...state.historicalExcellence, composite: 800 };
      state.reputation = { ...state.reputation, composite: 0 };
      const conditions = {
        averageHealth: 100,
        greenScore: 100,
        fairwayScore: 100,
        bunkerScore: 100,
        hazardScore: 100,
        teeBoxScore: 100,
        composite: 800,
      };
      const newState = updatePrestigeScore(state, conditions);
      expect(newState.tier).toBe('semi_private');
    });

    it('updates star rating', () => {
      const state = createInitialPrestigeState(195);
      state.reputation = { ...state.reputation, composite: 0 };
      const conditions = {
        averageHealth: 100,
        greenScore: 100,
        fairwayScore: 100,
        bunkerScore: 100,
        hazardScore: 100,
        teeBoxScore: 100,
        composite: 300,
      };
      const newState = updatePrestigeScore(state, conditions);
      expect(newState.starRating).toBeGreaterThan(state.starRating);
    });
  });

  describe('resetDailyStats', () => {
    it('resets all daily stats to zero', () => {
      const state = createInitialPrestigeState();
      state.golfersToday = 5;
      state.golfersRejectedToday = 2;
      state.revenueToday = 250;
      state.revenueLostToday = 100;
      const reset = resetDailyStats(state);
      expect(reset.golfersToday).toBe(0);
      expect(reset.golfersRejectedToday).toBe(0);
      expect(reset.revenueToday).toBe(0);
      expect(reset.revenueLostToday).toBe(0);
    });

    it('preserves other state', () => {
      const state = createInitialPrestigeState(500);
      state.golfersToday = 5;
      const reset = resetDailyStats(state);
      expect(reset.currentScore).toBe(500);
      expect(reset.tier).toBe('semi_private');
    });
  });

  describe('takeDailySnapshot', () => {
    it('creates snapshot with correct values', () => {
      const conditions = {
        averageHealth: 85,
        greenScore: 90,
        fairwayScore: 80,
        bunkerScore: 100,
        hazardScore: 100,
        teeBoxScore: 75,
        composite: 850,
      };
      const snapshot = takeDailySnapshot(conditions, 5);
      expect(snapshot.day).toBe(5);
      expect(snapshot.averageHealth).toBe(85);
      expect(snapshot.greenHealth).toBe(90);
      expect(snapshot.fairwayHealth).toBe(80);
      expect(snapshot.conditionRating).toBe('excellent');
    });
  });

  describe('updateHistoricalExcellence', () => {
    function makeHistoricalState() {
      return createInitialPrestigeState().historicalExcellence;
    }

    it('adds snapshot to history', () => {
      const state = makeHistoricalState();
      const snapshot = { day: 1, averageHealth: 85, greenHealth: 90, fairwayHealth: 80, conditionRating: 'excellent' as const };
      const newState = updateHistoricalExcellence(state, snapshot);
      expect(newState.dailySnapshots.length).toBe(1);
    });

    it('increments excellent streak for excellent rating', () => {
      const state = makeHistoricalState();
      const snapshot = { day: 1, averageHealth: 85, greenHealth: 90, fairwayHealth: 80, conditionRating: 'excellent' as const };
      const newState = updateHistoricalExcellence(state, snapshot);
      expect(newState.consecutiveExcellentDays).toBe(1);
      expect(newState.consecutiveGoodDays).toBe(1);
    });

    it('increments good streak but resets excellent for good rating', () => {
      let state = makeHistoricalState();
      state = updateHistoricalExcellence(state, {
        day: 1, averageHealth: 85, greenHealth: 90, fairwayHealth: 80, conditionRating: 'excellent',
      });
      state = updateHistoricalExcellence(state, {
        day: 2, averageHealth: 65, greenHealth: 70, fairwayHealth: 60, conditionRating: 'good',
      });
      expect(state.consecutiveExcellentDays).toBe(0);
      expect(state.consecutiveGoodDays).toBe(2);
    });

    it('resets all streaks for poor rating', () => {
      let state = makeHistoricalState();
      state = updateHistoricalExcellence(state, {
        day: 1, averageHealth: 85, greenHealth: 90, fairwayHealth: 80, conditionRating: 'excellent',
      });
      state = updateHistoricalExcellence(state, {
        day: 2, averageHealth: 30, greenHealth: 25, fairwayHealth: 35, conditionRating: 'poor',
      });
      expect(state.consecutiveExcellentDays).toBe(0);
      expect(state.consecutiveGoodDays).toBe(0);
      expect(state.daysSinceLastPoorRating).toBe(0);
    });

    it('tracks longest excellent streak', () => {
      let state = makeHistoricalState();
      for (let i = 1; i <= 5; i++) {
        state = updateHistoricalExcellence(state, {
          day: i, averageHealth: 85, greenHealth: 90, fairwayHealth: 80, conditionRating: 'excellent',
        });
      }
      expect(state.longestExcellentStreak).toBe(5);
      state = updateHistoricalExcellence(state, {
        day: 6, averageHealth: 30, greenHealth: 25, fairwayHealth: 35, conditionRating: 'poor',
      });
      expect(state.longestExcellentStreak).toBe(5);
    });

    it('calculates rolling average', () => {
      let state = makeHistoricalState();
      for (let i = 1; i <= 10; i++) {
        state = updateHistoricalExcellence(state, {
          day: i, averageHealth: 80, greenHealth: 80, fairwayHealth: 80, conditionRating: 'excellent',
        });
      }
      expect(state.rollingAverage30).toBe(80);
    });

    it('tracks poor days in last 90', () => {
      let state = makeHistoricalState();
      for (let i = 1; i <= 5; i++) {
        state = updateHistoricalExcellence(state, {
          day: i, averageHealth: 30, greenHealth: 25, fairwayHealth: 35, conditionRating: 'poor',
        });
      }
      expect(state.poorDaysInLast90).toBe(5);
    });

    it('calculates composite score', () => {
      let state = makeHistoricalState();
      for (let i = 1; i <= 30; i++) {
        state = updateHistoricalExcellence(state, {
          day: i, averageHealth: 85, greenHealth: 90, fairwayHealth: 80, conditionRating: 'excellent',
        });
      }
      expect(state.composite).toBeGreaterThan(0);
      expect(state.composite).toBeLessThanOrEqual(1000);
    });

    it('resets streaks but increments daysSinceLastPoorRating for fair rating', () => {
      let state = makeHistoricalState();
      state = updateHistoricalExcellence(state, {
        day: 1, averageHealth: 85, greenHealth: 90, fairwayHeight: 80, conditionRating: 'excellent',
      } as any);
      state = updateHistoricalExcellence(state, {
        day: 2, averageHealth: 50, greenHealth: 55, fairwayHealth: 45, conditionRating: 'fair',
      });
      expect(state.consecutiveExcellentDays).toBe(0);
      expect(state.consecutiveGoodDays).toBe(0);
      expect(state.daysSinceLastPoorRating).toBe(1001);
    });
  });

  describe('upgradeAmenity', () => {
    it('applies clubhouse upgrade and updates score', () => {
      const state = createInitialPrestigeState();
      const newState = upgradeAmenity(state, { type: 'clubhouse', tier: 1 });
      expect(newState.amenities.clubhouseTier).toBe(1);
      expect(newState.amenityScore).toBeGreaterThanOrEqual(0);
    });

    it('applies facility upgrade', () => {
      const state = createInitialPrestigeState();
      const newState = upgradeAmenity(state, { type: 'facility', facility: 'drivingRange' });
      expect(newState.amenities.facilities.drivingRange).toBe(true);
    });
  });

  describe('tier tolerances', () => {
    it('has progressive tolerance values', () => {
      const tiers = ['municipal', 'public', 'semi_private', 'private_club', 'championship'] as const;
      for (let i = 1; i < tiers.length; i++) {
        expect(TIER_TOLERANCES[tiers[i]].sweetSpot).toBeGreaterThan(TIER_TOLERANCES[tiers[i-1]].sweetSpot);
      }
    });
  });
});
