import { describe, it, expect } from 'vitest';
import {
  REPUTATION_WEIGHTS,
  WORD_OF_MOUTH_THRESHOLDS,
  MAX_STORED_REVIEWS,
  RECENT_REVIEW_DAYS,
  TURN_AWAY_PENALTY_PER_GOLFER,
  MAX_TURN_AWAY_PENALTY,

  createInitialReputationState,
  generateReview,
  addReview,
  updateWordOfMouth,
  trackGolferVisit,
  trackTurnAway,
  resetMonthlyTurnAways,
  calculateReputationScore,
  refreshRecentReviews,
  getReputationSummary,
} from './reputation';

describe('reputation', () => {
  describe('createInitialReputationState', () => {
    it('creates state with neutral ratings', () => {
      const state = createInitialReputationState();
      expect(state.totalReviews).toBe(0);
      expect(state.averageRating).toBe(3.0);
      expect(state.recentRating).toBe(3.0);
      expect(state.ratingTrend).toBe('stable');
    });

    it('starts with no golfers tracked', () => {
      const state = createInitialReputationState();
      expect(state.returnGolferCount).toBe(0);
      expect(state.totalUniqueGolfers).toBe(0);
      expect(state.returnRate).toBe(0);
    });

    it('starts with unknown word-of-mouth', () => {
      const state = createInitialReputationState();
      expect(state.golfersThisMonth).toBe(0);
      expect(state.wordOfMouthMultiplier).toBe(0.8);
    });

    it('starts with zero turn-aways', () => {
      const state = createInitialReputationState();
      expect(state.turnAwaysThisMonth).toBe(0);
      expect(state.totalTurnAways).toBe(0);
      expect(state.turnAwayPenalty).toBe(0);
    });

    it('has empty review lists', () => {
      const state = createInitialReputationState();
      expect(state.reviews).toHaveLength(0);
      expect(state.recentReviews).toHaveLength(0);
    });
  });

  describe('generateReview', () => {
    it('creates review from satisfaction metrics', () => {
      const review = generateReview('golfer-1', 10, 80, 85, 70, 75, 60, 60);
      expect(review.golferId).toBe('golfer-1');
      expect(review.date).toBe(10);
      expect(review.overallRating).toBe(4);
    });

    it('calculates category ratings from 0-100 scale', () => {
      const review = generateReview('golfer-1', 10, 80, 100, 60, 40, 20, 60);
      expect(review.categoryRatings.conditions).toBe(5);
      expect(review.categoryRatings.pace).toBe(3);
      expect(review.categoryRatings.value).toBe(2);
      expect(review.categoryRatings.service).toBe(1);
    });

    it('clamps ratings to 1-5 range', () => {
      const lowReview = generateReview('golfer-1', 10, 0, 0, 0, 0, 0, 0);
      expect(lowReview.overallRating).toBe(1);
      expect(lowReview.categoryRatings.conditions).toBe(1);

      const highReview = generateReview('golfer-1', 10, 120, 150, 100, 100, 100, 100);
      expect(highReview.overallRating).toBe(5);
      expect(highReview.categoryRatings.conditions).toBe(5);
    });

    it('sets wouldRecommend based on rating', () => {
      const goodReview = generateReview('g1', 10, 80, 80, 80, 80, 80, 80);
      expect(goodReview.wouldRecommend).toBe(true);

      const badReview = generateReview('g2', 10, 50, 50, 50, 50, 50, 50);
      expect(badReview.wouldRecommend).toBe(false);
    });

    it('sets wouldReturn based on rating', () => {
      const okReview = generateReview('g1', 10, 60, 60, 60, 60, 60, 60);
      expect(okReview.wouldReturn).toBe(true);

      const poorReview = generateReview('g2', 10, 30, 30, 30, 30, 30, 30);
      expect(poorReview.wouldReturn).toBe(false);
    });
  });

  describe('addReview', () => {
    it('adds review to list', () => {
      const state = createInitialReputationState();
      const review = generateReview('g1', 10, 80, 80, 80, 80, 80, 80);
      const newState = addReview(state, review, 10);
      expect(newState.reviews).toHaveLength(1);
      expect(newState.totalReviews).toBe(1);
    });

    it('updates average rating', () => {
      const state = createInitialReputationState();
      const review = generateReview('g1', 10, 100, 100, 100, 100, 100, 100);
      const newState = addReview(state, review, 10);
      expect(newState.averageRating).toBe(5);
    });

    it('updates recent rating from recent reviews', () => {
      let state = createInitialReputationState();
      const oldReview = generateReview('g1', 1, 40, 40, 40, 40, 40, 40);
      state = addReview(state, oldReview, 50);

      const recentReview = generateReview('g2', 45, 100, 100, 100, 100, 100, 100);
      const newState = addReview(state, recentReview, 50);

      expect(newState.recentRating).toBeGreaterThan(newState.averageRating);
    });

    it('calculates category averages', () => {
      let state = createInitialReputationState();
      const review1 = generateReview('g1', 10, 80, 100, 60, 80, 80, 40);
      state = addReview(state, review1, 10);

      expect(state.categoryAverages.conditions).toBe(5);
      expect(state.categoryAverages.pace).toBe(3);
      expect(state.categoryAverages.service).toBe(4);
    });

    it('limits stored reviews', () => {
      let state = createInitialReputationState();
      for (let i = 0; i < MAX_STORED_REVIEWS + 50; i++) {
        const review = generateReview(`g${i}`, i, 80, 80, 80, 80, 80, 80);
        state = addReview(state, review, i);
      }
      expect(state.reviews).toHaveLength(MAX_STORED_REVIEWS);
    });

    it('detects rising trend', () => {
      let state = createInitialReputationState();
      const badReview = generateReview('g1', 1, 40, 40, 40, 40, 40, 40);
      state = addReview(state, badReview, 5);

      const goodReview = generateReview('g2', 10, 100, 100, 100, 100, 100, 100);
      state = addReview(state, goodReview, 15);

      expect(state.ratingTrend).toBe('rising');
    });

    it('detects falling trend', () => {
      let state = createInitialReputationState();
      const goodReview = generateReview('g1', 1, 100, 100, 100, 100, 100, 100);
      state = addReview(state, goodReview, 5);

      const badReview = generateReview('g2', 10, 40, 40, 40, 40, 40, 40);
      state = addReview(state, badReview, 15);

      expect(state.ratingTrend).toBe('falling');
    });
  });

  describe('updateWordOfMouth', () => {
    it('sets unknown multiplier for low golfer count', () => {
      const state = createInitialReputationState();
      const newState = updateWordOfMouth(state, 50);
      expect(newState.wordOfMouthMultiplier).toBe(0.8);
      expect(newState.golfersThisMonth).toBe(50);
    });

    it('sets establishing multiplier for moderate count', () => {
      const state = createInitialReputationState();
      const newState = updateWordOfMouth(state, 200);
      expect(newState.wordOfMouthMultiplier).toBe(1.0);
    });

    it('sets growing multiplier for higher count', () => {
      const state = createInitialReputationState();
      const newState = updateWordOfMouth(state, 750);
      expect(newState.wordOfMouthMultiplier).toBe(1.1);
    });

    it('sets well-known multiplier for high count', () => {
      const state = createInitialReputationState();
      const newState = updateWordOfMouth(state, 1500);
      expect(newState.wordOfMouthMultiplier).toBe(1.2);
    });

    it('updates composite score', () => {
      let state = createInitialReputationState();
      const review = generateReview('g1', 10, 80, 80, 80, 80, 80, 80);
      state = addReview(state, review, 10);
      const initialComposite = state.composite;

      const newState = updateWordOfMouth(state, 1500);
      expect(newState.composite).toBeGreaterThan(initialComposite);
    });
  });

  describe('trackGolferVisit', () => {
    it('increments unique golfer count for new golfer', () => {
      const state = createInitialReputationState();
      const newState = trackGolferVisit(state, 'golfer-1', false);
      expect(newState.totalUniqueGolfers).toBe(1);
      expect(newState.returnGolferCount).toBe(0);
    });

    it('increments return count for returning golfer', () => {
      let state = createInitialReputationState();
      state = trackGolferVisit(state, 'golfer-1', false);
      state = trackGolferVisit(state, 'golfer-1', true);

      expect(state.totalUniqueGolfers).toBe(1);
      expect(state.returnGolferCount).toBe(1);
    });

    it('calculates return rate', () => {
      let state = createInitialReputationState();
      state = trackGolferVisit(state, 'g1', false);
      state = trackGolferVisit(state, 'g2', false);
      state = trackGolferVisit(state, 'g1', true);

      expect(state.returnRate).toBeGreaterThan(0);
    });
  });

  describe('calculateReputationScore', () => {
    it('returns composite score', () => {
      const state = createInitialReputationState();
      expect(calculateReputationScore(state)).toBe(state.composite);
    });

    it('higher ratings produce higher scores', () => {
      let lowState = createInitialReputationState();
      lowState = addReview(lowState, generateReview('g1', 1, 40, 40, 40, 40, 40, 40), 1);

      let highState = createInitialReputationState();
      highState = addReview(highState, generateReview('g1', 1, 100, 100, 100, 100, 100, 100), 1);

      expect(calculateReputationScore(highState)).toBeGreaterThan(calculateReputationScore(lowState));
    });
  });

  describe('refreshRecentReviews', () => {
    it('removes old reviews from recent list', () => {
      let state = createInitialReputationState();
      const oldReview = generateReview('g1', 1, 80, 80, 80, 80, 80, 80);
      state = addReview(state, oldReview, 1);
      expect(state.recentReviews).toHaveLength(1);

      const refreshed = refreshRecentReviews(state, RECENT_REVIEW_DAYS + 10);
      expect(refreshed.recentReviews).toHaveLength(0);
    });

    it('keeps reviews within recent window', () => {
      let state = createInitialReputationState();
      const review = generateReview('g1', 20, 80, 80, 80, 80, 80, 80);
      state = addReview(state, review, 20);

      const refreshed = refreshRecentReviews(state, 25);
      expect(refreshed.recentReviews).toHaveLength(1);
    });
  });

  describe('getReputationSummary', () => {
    it('returns star rating', () => {
      let state = createInitialReputationState();
      state = addReview(state, generateReview('g1', 1, 80, 80, 80, 80, 80, 80), 1);
      const summary = getReputationSummary(state);
      expect(summary.starRating).toBe(4);
    });

    it('returns word of mouth status', () => {
      let state = createInitialReputationState();
      state = updateWordOfMouth(state, 50);
      expect(getReputationSummary(state).wordOfMouth).toBe('Unknown');

      state = updateWordOfMouth(state, 300);
      expect(getReputationSummary(state).wordOfMouth).toBe('Establishing');

      state = updateWordOfMouth(state, 800);
      expect(getReputationSummary(state).wordOfMouth).toBe('Growing');

      state = updateWordOfMouth(state, 2000);
      expect(getReputationSummary(state).wordOfMouth).toBe('Well-Known');
    });

    it('returns trend and counts', () => {
      let state = createInitialReputationState();
      state = addReview(state, generateReview('g1', 1, 80, 80, 80, 80, 80, 80), 1);
      const summary = getReputationSummary(state);

      expect(summary.trend).toBe('rising');
      expect(summary.totalReviews).toBe(1);
      expect(summary.returnRate).toBe(0);
    });
  });

  describe('constants', () => {
    it('has reputation weights summing to 1', () => {
      const sum = Object.values(REPUTATION_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0);
    });

    it('has word of mouth thresholds in ascending order', () => {
      expect(WORD_OF_MOUTH_THRESHOLDS.unknown.max).toBeLessThan(WORD_OF_MOUTH_THRESHOLDS.establishing.max);
      expect(WORD_OF_MOUTH_THRESHOLDS.establishing.max).toBeLessThan(WORD_OF_MOUTH_THRESHOLDS.growing.max);
    });

    it('has appropriate max review storage', () => {
      expect(MAX_STORED_REVIEWS).toBeGreaterThanOrEqual(365);
    });

    it('has turn-away penalty constants', () => {
      expect(TURN_AWAY_PENALTY_PER_GOLFER).toBeGreaterThan(0);
      expect(MAX_TURN_AWAY_PENALTY).toBeLessThanOrEqual(1);
      expect(MAX_TURN_AWAY_PENALTY).toBeGreaterThan(TURN_AWAY_PENALTY_PER_GOLFER);
    });
  });

  describe('trackTurnAway', () => {
    it('increments turn-away counters', () => {
      let state = createInitialReputationState();
      state = trackTurnAway(state);
      expect(state.turnAwaysThisMonth).toBe(1);
      expect(state.totalTurnAways).toBe(1);
    });

    it('accumulates turn-aways over multiple calls', () => {
      let state = createInitialReputationState();
      state = trackTurnAway(state);
      state = trackTurnAway(state);
      state = trackTurnAway(state);
      expect(state.turnAwaysThisMonth).toBe(3);
      expect(state.totalTurnAways).toBe(3);
    });

    it('calculates penalty based on monthly turn-aways', () => {
      let state = createInitialReputationState();
      state = trackTurnAway(state);
      expect(state.turnAwayPenalty).toBeCloseTo(TURN_AWAY_PENALTY_PER_GOLFER);

      state = trackTurnAway(state);
      expect(state.turnAwayPenalty).toBeCloseTo(2 * TURN_AWAY_PENALTY_PER_GOLFER);
    });

    it('caps penalty at maximum', () => {
      let state = createInitialReputationState();
      for (let i = 0; i < 50; i++) {
        state = trackTurnAway(state);
      }
      expect(state.turnAwayPenalty).toBe(MAX_TURN_AWAY_PENALTY);
    });

    it('reduces reputation composite with turn-aways', () => {
      let state = createInitialReputationState();
      const initialComposite = state.composite;
      state = trackTurnAway(state);
      expect(state.composite).toBeLessThan(initialComposite);
    });
  });

  describe('resetMonthlyTurnAways', () => {
    it('resets monthly counter but keeps total', () => {
      let state = createInitialReputationState();
      state = trackTurnAway(state);
      state = trackTurnAway(state);
      expect(state.turnAwaysThisMonth).toBe(2);
      expect(state.totalTurnAways).toBe(2);

      state = resetMonthlyTurnAways(state);
      expect(state.turnAwaysThisMonth).toBe(0);
      expect(state.totalTurnAways).toBe(2);
    });

    it('clears penalty after reset', () => {
      let state = createInitialReputationState();
      state = trackTurnAway(state);
      expect(state.turnAwayPenalty).toBeGreaterThan(0);

      state = resetMonthlyTurnAways(state);
      expect(state.turnAwayPenalty).toBe(0);
    });

    it('restores composite after penalty is cleared', () => {
      let state = createInitialReputationState();
      state = trackTurnAway(state);
      const penalizedComposite = state.composite;

      state = resetMonthlyTurnAways(state);
      expect(state.composite).toBeGreaterThan(penalizedComposite);
    });
  });
});
