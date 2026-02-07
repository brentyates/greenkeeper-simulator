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
  calculateMasterPrestigeScore,
  upgradeAmenity,
  updateMembership,
  updateWaitlist,
  updateBookingWindow,
  updateDressCode,
  awardPrestige,
  revokeAward,
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
      state.historicalExcellence = { ...state.historicalExcellence, composite: 0 };
      state.amenities = { ...state.amenities, facilities: {
        drivingRange: false, puttingGreen: false, chippingArea: false,
        teachingAcademy: false, golfSimulator: false, tourLevelRange: false
      } };
      state.reputation = { ...state.reputation, composite: 0, averageRating: 1.0 };
      state.exclusivity = { ...state.exclusivity, composite: 0 };
      const conditions: CurrentConditionsScore = {
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

  describe('calculateMasterPrestigeScore', () => {
    it('calculates weighted score from all components', () => {
      const score = calculateMasterPrestigeScore(800, 800, 800, 800, 800);
      expect(score).toBe(800);
    });

    it('clamps to 0-1000 range', () => {
      const lowScore = calculateMasterPrestigeScore(0, 0, 0, 0, 0);
      const highScore = calculateMasterPrestigeScore(2000, 2000, 2000, 2000, 2000);
      expect(lowScore).toBe(0);
      expect(highScore).toBe(1000);
    });

    it('handles default reputation and exclusivity', () => {
      const score = calculateMasterPrestigeScore(500, 500, 500);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1000);
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

  describe('updateMembership', () => {
    it('updates membership model and exclusivity score', () => {
      const state = createInitialPrestigeState();
      const newState = updateMembership(state, 'private', 50000);
      expect(newState.exclusivity.membershipModel).toBe('private');
      expect(newState.exclusivityScore).toBeDefined();
    });
  });

  describe('updateWaitlist', () => {
    it('updates waitlist length and exclusivity score', () => {
      const state = createInitialPrestigeState();
      const newState = updateWaitlist(state, 12);
      expect(newState.exclusivity.waitlistLength).toBe(12);
      expect(newState.exclusivityScore).toBeDefined();
    });
  });

  describe('updateBookingWindow', () => {
    it('updates booking window and exclusivity score', () => {
      const state = createInitialPrestigeState();
      const newState = updateBookingWindow(state, 14);
      expect(newState.exclusivity.advanceBookingDays).toBe(14);
      expect(newState.exclusivityScore).toBeDefined();
    });
  });

  describe('updateDressCode', () => {
    it('updates dress code and exclusivity score', () => {
      const state = createInitialPrestigeState();
      const newState = updateDressCode(state, 'formal');
      expect(newState.exclusivity.dressCode).toBe('formal');
      expect(newState.exclusivityScore).toBeDefined();
    });
  });

  describe('awardPrestige', () => {
    it('adds award and updates exclusivity score', () => {
      const state = createInitialPrestigeState();
      const newState = awardPrestige(state, 'best_municipal', 100);
      expect(newState.exclusivity.awards.some(a => a.id === 'best_municipal')).toBe(true);
      expect(newState.exclusivityScore).toBeDefined();
    });

    it('ignores unknown award ids', () => {
      const state = createInitialPrestigeState();
      const newState = awardPrestige(state, 'nonexistent_award', 100);
      expect(newState.exclusivity.awards.length).toBe(0);
    });

    it('does not duplicate awards', () => {
      let state = createInitialPrestigeState();
      state = awardPrestige(state, 'best_municipal', 100);
      state = awardPrestige(state, 'best_municipal', 200);
      expect(state.exclusivity.awards.filter(a => a.id === 'best_municipal').length).toBe(1);
    });
  });

  describe('revokeAward', () => {
    it('removes award and updates exclusivity score', () => {
      let state = createInitialPrestigeState();
      state = awardPrestige(state, 'best_municipal', 100);
      const newState = revokeAward(state, 'best_municipal');
      expect(newState.exclusivity.awards.some(a => a.id === 'best_municipal')).toBe(false);
      expect(newState.exclusivityScore).toBeDefined();
    });
  });

  describe('updateHistoricalExcellence fair rating', () => {
    it('resets streaks but increments daysSinceLastPoorRating for fair rating', () => {
      let state = createInitialHistoricalState();
      state = updateHistoricalExcellence(state, {
        day: 1, averageHealth: 85, greenHealth: 90, fairwayHealth: 80, conditionRating: 'excellent',
      });
      expect(state.consecutiveExcellentDays).toBe(1);
      expect(state.consecutiveGoodDays).toBe(1);

      state = updateHistoricalExcellence(state, {
        day: 2, averageHealth: 50, greenHealth: 55, fairwayHealth: 45, conditionRating: 'fair',
      });
      expect(state.consecutiveExcellentDays).toBe(0);
      expect(state.consecutiveGoodDays).toBe(0);
      expect(state.daysSinceLastPoorRating).toBe(1001);
    });
  });

  describe('recovery penalty thresholds', () => {
    it('applies day8to14 penalty when daysSinceLastPoorRating is 10', () => {
      let state = createInitialHistoricalState();
      state = updateHistoricalExcellence(state, {
        day: 1, averageHealth: 30, greenHealth: 35, fairwayHealth: 25, conditionRating: 'poor',
      });
      for (let i = 2; i <= 11; i++) {
        state = updateHistoricalExcellence(state, {
          day: i, averageHealth: 80, greenHealth: 85, fairwayHealth: 75, conditionRating: 'good',
        });
      }
      expect(state.daysSinceLastPoorRating).toBe(10);
    });

    it('applies day15to30 penalty when daysSinceLastPoorRating is 20', () => {
      let state = createInitialHistoricalState();
      state = updateHistoricalExcellence(state, {
        day: 1, averageHealth: 30, greenHealth: 35, fairwayHealth: 25, conditionRating: 'poor',
      });
      for (let i = 2; i <= 21; i++) {
        state = updateHistoricalExcellence(state, {
          day: i, averageHealth: 80, greenHealth: 85, fairwayHealth: 75, conditionRating: 'good',
        });
      }
      expect(state.daysSinceLastPoorRating).toBe(20);
    });

    it('applies day31to60 penalty when daysSinceLastPoorRating is 45', () => {
      let state = createInitialHistoricalState();
      state = updateHistoricalExcellence(state, {
        day: 1, averageHealth: 30, greenHealth: 35, fairwayHealth: 25, conditionRating: 'poor',
      });
      for (let i = 2; i <= 46; i++) {
        state = updateHistoricalExcellence(state, {
          day: i, averageHealth: 80, greenHealth: 85, fairwayHealth: 75, conditionRating: 'good',
        });
      }
      expect(state.daysSinceLastPoorRating).toBe(45);
    });
  });
});
