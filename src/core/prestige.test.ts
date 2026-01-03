import { describe, it, expect } from 'vitest';
import {
  CurrentConditionsScore,
  GreenFeeTolerance,
  PrestigeTier,
  DailySnapshot,

  TIER_THRESHOLDS,
  TIER_TOLERANCES,
  CONDITION_WEIGHTS,
  MAX_DAILY_INCREASE,
  MAX_DAILY_DECREASE,
  HISTORICAL_WEIGHTS,

  createInitialPrestigeState,
  createInitialHistoricalState,
  getPrestigeTier,
  calculateStarRating,
  getStarDisplay,
  calculateCurrentConditions,
  calculateDemandMultiplier,
  updatePrestigeScore,
  processGolferArrival,
  resetDailyStats,
  setGreenFee,
  getGreenFeeAdvice,
  getConditionRating,
  takeDailySnapshot,
  updateHistoricalExcellence,
  calculateHistoricalExcellence,
} from './prestige';
import { CellState } from './terrain';

function makeCell(overrides: Partial<CellState> = {}): CellState {
  return {
    x: 0,
    y: 0,
    type: 'fairway',
    height: 30,
    moisture: 60,
    nutrients: 50,
    health: 75,
    elevation: 0,
    obstacle: 'none',
    lastMowed: 0,
    lastWatered: 0,
    lastFertilized: 0,
    ...overrides,
  };
}

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

  describe('getPrestigeTier', () => {
    it('returns municipal for scores 0-199', () => {
      expect(getPrestigeTier(0)).toBe('municipal');
      expect(getPrestigeTier(100)).toBe('municipal');
      expect(getPrestigeTier(199)).toBe('municipal');
    });

    it('returns public for scores 200-399', () => {
      expect(getPrestigeTier(200)).toBe('public');
      expect(getPrestigeTier(300)).toBe('public');
      expect(getPrestigeTier(399)).toBe('public');
    });

    it('returns semi_private for scores 400-599', () => {
      expect(getPrestigeTier(400)).toBe('semi_private');
      expect(getPrestigeTier(500)).toBe('semi_private');
      expect(getPrestigeTier(599)).toBe('semi_private');
    });

    it('returns private_club for scores 600-799', () => {
      expect(getPrestigeTier(600)).toBe('private_club');
      expect(getPrestigeTier(700)).toBe('private_club');
      expect(getPrestigeTier(799)).toBe('private_club');
    });

    it('returns championship for scores 800+', () => {
      expect(getPrestigeTier(800)).toBe('championship');
      expect(getPrestigeTier(900)).toBe('championship');
      expect(getPrestigeTier(1000)).toBe('championship');
    });
  });

  describe('calculateStarRating', () => {
    it('returns 0.5 stars for score 0', () => {
      expect(calculateStarRating(0)).toBe(0.5);
    });

    it('returns 1 star for score 100', () => {
      expect(calculateStarRating(100)).toBe(1.0);
    });

    it('returns 1.5 stars for score 200', () => {
      expect(calculateStarRating(200)).toBe(1.5);
    });

    it('returns 2 stars for score 300', () => {
      expect(calculateStarRating(300)).toBe(2.0);
    });

    it('returns 3 stars for score 500', () => {
      expect(calculateStarRating(500)).toBe(3.0);
    });

    it('returns 5 stars for score 900+', () => {
      expect(calculateStarRating(900)).toBe(5.0);
      expect(calculateStarRating(1000)).toBe(5.0);
    });

    it('clamps to minimum 0.5 stars', () => {
      expect(calculateStarRating(-100)).toBe(0.5);
    });

    it('clamps to maximum 5 stars', () => {
      expect(calculateStarRating(2000)).toBe(5.0);
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

  describe('calculateCurrentConditions', () => {
    it('calculates average health from grass cells', () => {
      const cells: CellState[][] = [
        [makeCell({ type: 'fairway', health: 80 })],
        [makeCell({ type: 'fairway', health: 60 })],
      ];
      const result = calculateCurrentConditions(cells);
      expect(result.averageHealth).toBe(70);
    });

    it('calculates green-specific score', () => {
      const cells: CellState[][] = [
        [makeCell({ type: 'green', health: 90 })],
        [makeCell({ type: 'green', health: 80 })],
        [makeCell({ type: 'fairway', health: 50 })],
      ];
      const result = calculateCurrentConditions(cells);
      expect(result.greenScore).toBe(85);
    });

    it('calculates fairway-specific score', () => {
      const cells: CellState[][] = [
        [makeCell({ type: 'fairway', health: 70 })],
        [makeCell({ type: 'fairway', health: 80 })],
        [makeCell({ type: 'green', health: 95 })],
      ];
      const result = calculateCurrentConditions(cells);
      expect(result.fairwayScore).toBe(75);
    });

    it('calculates tee box score', () => {
      const cells: CellState[][] = [
        [makeCell({ type: 'tee', health: 85 })],
        [makeCell({ type: 'tee', health: 75 })],
      ];
      const result = calculateCurrentConditions(cells);
      expect(result.teeBoxScore).toBe(80);
    });

    it('returns 100 for empty terrain types', () => {
      const cells: CellState[][] = [
        [makeCell({ type: 'fairway', health: 70 })],
      ];
      const result = calculateCurrentConditions(cells);
      expect(result.greenScore).toBe(100);
      expect(result.teeBoxScore).toBe(100);
    });

    it('excludes bunker and water from grass average', () => {
      const cells: CellState[][] = [
        [makeCell({ type: 'fairway', health: 80 })],
        [makeCell({ type: 'bunker', health: 0 })],
        [makeCell({ type: 'water', health: 0 })],
      ];
      const result = calculateCurrentConditions(cells);
      expect(result.averageHealth).toBe(80);
    });

    it('calculates composite score within 0-1000 range', () => {
      const cells: CellState[][] = [
        [makeCell({ type: 'fairway', health: 100 })],
        [makeCell({ type: 'green', health: 100 })],
        [makeCell({ type: 'tee', health: 100 })],
      ];
      const result = calculateCurrentConditions(cells);
      expect(result.composite).toBeGreaterThanOrEqual(0);
      expect(result.composite).toBeLessThanOrEqual(1000);
    });

    it('handles empty grid', () => {
      const cells: CellState[][] = [];
      const result = calculateCurrentConditions(cells);
      expect(result.averageHealth).toBe(100);
      expect(result.composite).toBeGreaterThan(0);
    });
  });

  describe('calculateDemandMultiplier', () => {
    const tolerance: GreenFeeTolerance = {
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
      const conditions: CurrentConditionsScore = {
        averageHealth: 100,
        greenScore: 100,
        fairwayScore: 100,
        bunkerScore: 100,
        hazardScore: 100,
        teeBoxScore: 100,
        composite: 300,
      };
      const newState = updatePrestigeScore(state, conditions);
      expect(newState.currentScore).toBe(100 + MAX_DAILY_INCREASE);
      expect(newState.targetScore).toBe(200);
    });

    it('decreases score faster than it increases', () => {
      const state = createInitialPrestigeState(500);
      state.reputation = { ...state.reputation, composite: 0 };
      const conditions: CurrentConditionsScore = {
        averageHealth: 20,
        greenScore: 20,
        fairwayScore: 20,
        bunkerScore: 20,
        hazardScore: 20,
        teeBoxScore: 20,
        composite: 200,
      };
      const newState = updatePrestigeScore(state, conditions);
      expect(newState.currentScore).toBe(500 - MAX_DAILY_DECREASE);
    });

    it('updates tier when crossing threshold', () => {
      const state = createInitialPrestigeState(395);
      state.historicalExcellence = { ...state.historicalExcellence, composite: 800 };
      state.reputation = { ...state.reputation, composite: 0 };
      const conditions: CurrentConditionsScore = {
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
      const conditions: CurrentConditionsScore = {
        averageHealth: 100,
        greenScore: 100,
        fairwayScore: 100,
        bunkerScore: 100,
        hazardScore: 100,
        teeBoxScore: 100,
        composite: 300,
      };
      const newState = updatePrestigeScore(state, conditions);
      expect(newState.starRating).toBe(calculateStarRating(200));
    });

    it('stops at target when within daily limit', () => {
      const state = createInitialPrestigeState(198);
      state.reputation = { ...state.reputation, composite: 0 };
      const conditions: CurrentConditionsScore = {
        averageHealth: 100,
        greenScore: 100,
        fairwayScore: 100,
        bunkerScore: 100,
        hazardScore: 100,
        teeBoxScore: 100,
        composite: 300,
      };
      const newState = updatePrestigeScore(state, conditions);
      expect(newState.currentScore).toBe(200);
    });
  });

  describe('processGolferArrival', () => {
    it('increments golfer count and revenue when paying', () => {
      const state = createInitialPrestigeState();
      const newState = processGolferArrival(state, 50, true);
      expect(newState.golfersToday).toBe(1);
      expect(newState.revenueToday).toBe(50);
      expect(newState.golfersRejectedToday).toBe(0);
    });

    it('increments rejected count and lost revenue when not paying', () => {
      const state = createInitialPrestigeState();
      const newState = processGolferArrival(state, 50, false);
      expect(newState.golfersRejectedToday).toBe(1);
      expect(newState.revenueLostToday).toBe(50);
      expect(newState.golfersToday).toBe(0);
    });

    it('accumulates counts over multiple arrivals', () => {
      let state = createInitialPrestigeState();
      state = processGolferArrival(state, 50, true);
      state = processGolferArrival(state, 50, true);
      state = processGolferArrival(state, 50, false);
      expect(state.golfersToday).toBe(2);
      expect(state.revenueToday).toBe(100);
      expect(state.golfersRejectedToday).toBe(1);
      expect(state.revenueLostToday).toBe(50);
    });
  });

  describe('resetDailyStats', () => {
    it('resets all daily stats to zero', () => {
      let state = createInitialPrestigeState();
      state = processGolferArrival(state, 50, true);
      state = processGolferArrival(state, 50, false);
      state = resetDailyStats(state);
      expect(state.golfersToday).toBe(0);
      expect(state.golfersRejectedToday).toBe(0);
      expect(state.revenueToday).toBe(0);
      expect(state.revenueLostToday).toBe(0);
    });

    it('preserves other state', () => {
      let state = createInitialPrestigeState(500);
      state = processGolferArrival(state, 50, true);
      state = resetDailyStats(state);
      expect(state.currentScore).toBe(500);
      expect(state.tier).toBe('semi_private');
    });
  });

  describe('setGreenFee', () => {
    it('sets green fee to specified value', () => {
      const state = createInitialPrestigeState();
      const newState = setGreenFee(state, 75);
      expect(newState.greenFee).toBe(75);
    });

    it('prevents negative green fees', () => {
      const state = createInitialPrestigeState();
      const newState = setGreenFee(state, -10);
      expect(newState.greenFee).toBe(0);
    });
  });

  describe('getGreenFeeAdvice', () => {
    it('indicates when price is at sweet spot', () => {
      let state = createInitialPrestigeState(400);
      state = setGreenFee(state, state.tolerance.sweetSpot);
      const advice = getGreenFeeAdvice(state);
      expect(advice.isOverpriced).toBe(false);
      expect(advice.expectedRejectionRate).toBe(0);
    });

    it('indicates when price is overpriced', () => {
      let state = createInitialPrestigeState(400);
      state = setGreenFee(state, state.tolerance.maxTolerance);
      const advice = getGreenFeeAdvice(state);
      expect(advice.isOverpriced).toBe(true);
      expect(advice.expectedRejectionRate).toBeGreaterThan(0);
    });

    it('provides recommended range', () => {
      const state = createInitialPrestigeState(400);
      const advice = getGreenFeeAdvice(state);
      expect(advice.recommended.min).toBeLessThan(advice.recommended.max);
      expect(advice.recommended.max).toBe(TIER_TOLERANCES.semi_private.rejectionThreshold);
    });
  });

  describe('constants validation', () => {
    it('has valid tier thresholds', () => {
      expect(TIER_THRESHOLDS.municipal.min).toBe(0);
      expect(TIER_THRESHOLDS.championship.max).toBe(1000);
    });

    it('has valid condition weights summing to 1', () => {
      const sum = Object.values(CONDITION_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0);
    });

    it('has progressive tolerance values', () => {
      const tiers: PrestigeTier[] = ['municipal', 'public', 'semi_private', 'private_club', 'championship'];
      for (let i = 1; i < tiers.length; i++) {
        expect(TIER_TOLERANCES[tiers[i]].sweetSpot).toBeGreaterThan(TIER_TOLERANCES[tiers[i-1]].sweetSpot);
      }
    });

    it('has valid daily change limits', () => {
      expect(MAX_DAILY_INCREASE).toBeLessThan(MAX_DAILY_DECREASE);
    });

    it('has valid historical weights summing to 1', () => {
      const sum = Object.values(HISTORICAL_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0);
    });
  });

  describe('getConditionRating', () => {
    it('returns excellent for health >= 80', () => {
      expect(getConditionRating(80)).toBe('excellent');
      expect(getConditionRating(100)).toBe('excellent');
    });

    it('returns good for health 60-79', () => {
      expect(getConditionRating(60)).toBe('good');
      expect(getConditionRating(79)).toBe('good');
    });

    it('returns fair for health 40-59', () => {
      expect(getConditionRating(40)).toBe('fair');
      expect(getConditionRating(59)).toBe('fair');
    });

    it('returns poor for health < 40', () => {
      expect(getConditionRating(39)).toBe('poor');
      expect(getConditionRating(0)).toBe('poor');
    });
  });

  describe('takeDailySnapshot', () => {
    it('creates snapshot with correct values', () => {
      const conditions: CurrentConditionsScore = {
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

  describe('createInitialHistoricalState', () => {
    it('creates state with empty snapshots', () => {
      const state = createInitialHistoricalState();
      expect(state.dailySnapshots).toEqual([]);
    });

    it('creates state with zero streaks', () => {
      const state = createInitialHistoricalState();
      expect(state.consecutiveExcellentDays).toBe(0);
      expect(state.consecutiveGoodDays).toBe(0);
    });

    it('creates state with high daysSinceLastPoorRating', () => {
      const state = createInitialHistoricalState();
      expect(state.daysSinceLastPoorRating).toBe(999);
    });
  });

  describe('updateHistoricalExcellence', () => {
    it('adds snapshot to history', () => {
      const state = createInitialHistoricalState();
      const snapshot: DailySnapshot = {
        day: 1,
        averageHealth: 85,
        greenHealth: 90,
        fairwayHealth: 80,
        conditionRating: 'excellent',
      };
      const newState = updateHistoricalExcellence(state, snapshot);
      expect(newState.dailySnapshots.length).toBe(1);
      expect(newState.dailySnapshots[0]).toEqual(snapshot);
    });

    it('increments excellent streak for excellent rating', () => {
      const state = createInitialHistoricalState();
      const snapshot: DailySnapshot = {
        day: 1,
        averageHealth: 85,
        greenHealth: 90,
        fairwayHealth: 80,
        conditionRating: 'excellent',
      };
      const newState = updateHistoricalExcellence(state, snapshot);
      expect(newState.consecutiveExcellentDays).toBe(1);
      expect(newState.consecutiveGoodDays).toBe(1);
    });

    it('increments good streak but resets excellent for good rating', () => {
      let state = createInitialHistoricalState();
      state = updateHistoricalExcellence(state, {
        day: 1, averageHealth: 85, greenHealth: 90, fairwayHealth: 80, conditionRating: 'excellent',
      });
      expect(state.consecutiveExcellentDays).toBe(1);

      state = updateHistoricalExcellence(state, {
        day: 2, averageHealth: 65, greenHealth: 70, fairwayHealth: 60, conditionRating: 'good',
      });
      expect(state.consecutiveExcellentDays).toBe(0);
      expect(state.consecutiveGoodDays).toBe(2);
    });

    it('resets all streaks for poor rating', () => {
      let state = createInitialHistoricalState();
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
      let state = createInitialHistoricalState();
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
      let state = createInitialHistoricalState();
      for (let i = 1; i <= 10; i++) {
        state = updateHistoricalExcellence(state, {
          day: i, averageHealth: 80, greenHealth: 80, fairwayHealth: 80, conditionRating: 'excellent',
        });
      }
      expect(state.rollingAverage30).toBe(80);
    });

    it('tracks poor days in last 90', () => {
      let state = createInitialHistoricalState();
      for (let i = 1; i <= 5; i++) {
        state = updateHistoricalExcellence(state, {
          day: i, averageHealth: 30, greenHealth: 25, fairwayHealth: 35, conditionRating: 'poor',
        });
      }
      expect(state.poorDaysInLast90).toBe(5);
    });

    it('calculates composite score', () => {
      let state = createInitialHistoricalState();
      for (let i = 1; i <= 30; i++) {
        state = updateHistoricalExcellence(state, {
          day: i, averageHealth: 85, greenHealth: 90, fairwayHealth: 80, conditionRating: 'excellent',
        });
      }
      expect(state.composite).toBeGreaterThan(0);
      expect(state.composite).toBeLessThanOrEqual(1000);
    });
  });

  describe('calculateHistoricalExcellence', () => {
    it('returns composite from state', () => {
      const state = createInitialHistoricalState();
      expect(calculateHistoricalExcellence(state)).toBe(state.composite);
    });
  });
});
