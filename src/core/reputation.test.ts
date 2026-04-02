import { describe, it, expect } from 'vitest';
import {
  createInitialReputationState,
  trackGolferVisit,
  trackTurnAway,
  calculateReputationScore,
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
  });

  describe('getReputationSummary', () => {
    it('returns star rating and trend', () => {
      const state = createInitialReputationState();
      const summary = getReputationSummary(state);
      expect(summary.starRating).toBe(3.0);
      expect(summary.trend).toBe('stable');
      expect(summary.totalReviews).toBe(0);
      expect(summary.returnRate).toBe(0);
    });

    it('returns word of mouth status based on multiplier', () => {
      const state = createInitialReputationState();
      expect(getReputationSummary(state).wordOfMouth).toBe('Unknown');
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
      expect(state.turnAwayPenalty).toBeCloseTo(0.02);

      state = trackTurnAway(state);
      expect(state.turnAwayPenalty).toBeCloseTo(0.04);
    });

    it('caps penalty at maximum', () => {
      let state = createInitialReputationState();
      for (let i = 0; i < 50; i++) {
        state = trackTurnAway(state);
      }
      expect(state.turnAwayPenalty).toBe(0.3);
    });

    it('reduces reputation composite with turn-aways', () => {
      let state = createInitialReputationState();
      const initialComposite = state.composite;
      state = trackTurnAway(state);
      expect(state.composite).toBeLessThan(initialComposite);
    });
  });
});
