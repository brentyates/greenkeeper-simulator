import { describe, it, expect } from 'vitest';
import {
  MEMBERSHIP_BASE_SCORES,
  EXCLUSIVITY_WEIGHTS,
  MEMBERSHIP_COST_THRESHOLD,
  WAITLIST_BONUS_MONTHS,
  DRESS_CODE_BONUSES,
  AWARD_DEFINITIONS,
  createInitialExclusivityState,
  calculateExclusivityScore,
  setMembershipModel,
  setWaitlistLength,
  setAdvanceBookingDays,
  setDressCode,
  earnAward,
  removeAward,
  getAwardsSummary,
  getMembershipLabel,
  getDressCodeLabel,
  getExclusivitySummary,
} from './exclusivity';

describe('exclusivity', () => {
  describe('createInitialExclusivityState', () => {
    it('creates state with public membership', () => {
      const state = createInitialExclusivityState();
      expect(state.membershipModel).toBe('public');
      expect(state.membershipCost).toBe(0);
    });

    it('starts with no waitlist', () => {
      const state = createInitialExclusivityState();
      expect(state.waitlistLength).toBe(0);
    });

    it('starts with no dress code', () => {
      const state = createInitialExclusivityState();
      expect(state.dressCode).toBe('none');
    });

    it('starts with no awards', () => {
      const state = createInitialExclusivityState();
      expect(state.awards).toHaveLength(0);
    });

    it('starts with zero composite score', () => {
      const state = createInitialExclusivityState();
      expect(state.composite).toBe(0);
    });
  });

  describe('calculateExclusivityScore', () => {
    it('returns 0 for public course with no extras', () => {
      const state = createInitialExclusivityState();
      expect(calculateExclusivityScore(state)).toBe(0);
    });

    it('returns higher score for private membership', () => {
      const publicState = createInitialExclusivityState();
      const privateState = setMembershipModel(publicState, 'private', 10000);
      expect(privateState.composite).toBeGreaterThan(publicState.composite);
    });

    it('returns highest base score for exclusive membership', () => {
      const state = setMembershipModel(createInitialExclusivityState(), 'exclusive', 50000);
      expect(state.composite).toBeGreaterThan(500);
    });

    it('adds bonus for high membership cost', () => {
      const lowCost = setMembershipModel(createInitialExclusivityState(), 'private', 5000);
      const highCost = setMembershipModel(createInitialExclusivityState(), 'private', 30000);
      expect(highCost.composite).toBeGreaterThan(lowCost.composite);
    });

    it('adds bonus for long waitlist', () => {
      let state = setMembershipModel(createInitialExclusivityState(), 'private', 10000);
      const noWaitlist = state.composite;
      state = setWaitlistLength(state, 18);
      expect(state.composite).toBeGreaterThan(noWaitlist);
    });

    it('adds bonus for formal dress code', () => {
      let state = setMembershipModel(createInitialExclusivityState(), 'semi_private', 5000);
      const noDressCode = state.composite;
      state = setDressCode(state, 'formal');
      expect(state.composite).toBeGreaterThan(noDressCode);
    });

    it('caps score at 1000', () => {
      let state = setMembershipModel(createInitialExclusivityState(), 'exclusive', 100000);
      state = setWaitlistLength(state, 24);
      state = setDressCode(state, 'formal');
      state = earnAward(state, 'major_championship_host', 1);
      state = earnAward(state, 'pga_tour_venue', 2);
      expect(state.composite).toBeLessThanOrEqual(1000);
    });
  });

  describe('setMembershipModel', () => {
    it('updates membership model', () => {
      const state = createInitialExclusivityState();
      const updated = setMembershipModel(state, 'semi_private', 2000);
      expect(updated.membershipModel).toBe('semi_private');
      expect(updated.membershipCost).toBe(2000);
    });

    it('sets cost to 0 for public courses', () => {
      let state = setMembershipModel(createInitialExclusivityState(), 'private', 10000);
      state = setMembershipModel(state, 'public', 5000);
      expect(state.membershipCost).toBe(0);
    });

    it('recalculates composite score', () => {
      const state = createInitialExclusivityState();
      const updated = setMembershipModel(state, 'private', 10000);
      expect(updated.composite).toBeGreaterThan(0);
    });
  });

  describe('setWaitlistLength', () => {
    it('updates waitlist length', () => {
      const state = createInitialExclusivityState();
      const updated = setWaitlistLength(state, 6);
      expect(updated.waitlistLength).toBe(6);
    });

    it('clamps to minimum of 0', () => {
      const state = createInitialExclusivityState();
      const updated = setWaitlistLength(state, -5);
      expect(updated.waitlistLength).toBe(0);
    });

    it('recalculates composite score', () => {
      let state = setMembershipModel(createInitialExclusivityState(), 'private', 10000);
      const before = state.composite;
      state = setWaitlistLength(state, 12);
      expect(state.composite).toBeGreaterThan(before);
    });
  });

  describe('setAdvanceBookingDays', () => {
    it('updates advance booking days', () => {
      const state = createInitialExclusivityState();
      const updated = setAdvanceBookingDays(state, 30);
      expect(updated.advanceBookingDays).toBe(30);
    });

    it('clamps to minimum of 1', () => {
      const state = createInitialExclusivityState();
      const updated = setAdvanceBookingDays(state, 0);
      expect(updated.advanceBookingDays).toBe(1);
    });

    it('adds bonus for long advance booking', () => {
      let state = setMembershipModel(createInitialExclusivityState(), 'private', 10000);
      const before = state.composite;
      state = setAdvanceBookingDays(state, 21);
      expect(state.composite).toBeGreaterThan(before);
    });
  });

  describe('setDressCode', () => {
    it('updates dress code', () => {
      const state = createInitialExclusivityState();
      const updated = setDressCode(state, 'smart_casual');
      expect(updated.dressCode).toBe('smart_casual');
    });

    it('formal dress code gives highest bonus', () => {
      const casual = setDressCode(createInitialExclusivityState(), 'casual');
      const formal = setDressCode(createInitialExclusivityState(), 'formal');
      expect(formal.composite).toBeGreaterThan(casual.composite);
    });
  });

  describe('earnAward', () => {
    it('adds award to state', () => {
      const state = createInitialExclusivityState();
      const updated = earnAward(state, 'best_municipal', 100);
      expect(updated.awards).toHaveLength(1);
      expect(updated.awards[0].id).toBe('best_municipal');
      expect(updated.awards[0].dateEarned).toBe(100);
    });

    it('increases composite score', () => {
      const state = createInitialExclusivityState();
      const updated = earnAward(state, 'top_100_public', 50);
      expect(updated.composite).toBeGreaterThan(state.composite);
    });

    it('ignores unknown award IDs', () => {
      const state = createInitialExclusivityState();
      const updated = earnAward(state, 'fake_award', 1);
      expect(updated.awards).toHaveLength(0);
    });

    it('prevents duplicate awards', () => {
      let state = earnAward(createInitialExclusivityState(), 'best_municipal', 1);
      state = earnAward(state, 'best_municipal', 2);
      expect(state.awards).toHaveLength(1);
      expect(state.awards[0].dateEarned).toBe(1);
    });

    it('allows multiple different awards', () => {
      let state = earnAward(createInitialExclusivityState(), 'best_municipal', 1);
      state = earnAward(state, 'hidden_gem', 2);
      state = earnAward(state, 'environmental', 3);
      expect(state.awards).toHaveLength(3);
    });
  });

  describe('removeAward', () => {
    it('removes award from state', () => {
      let state = earnAward(createInitialExclusivityState(), 'best_municipal', 1);
      state = removeAward(state, 'best_municipal');
      expect(state.awards).toHaveLength(0);
    });

    it('recalculates composite score', () => {
      let state = earnAward(createInitialExclusivityState(), 'pga_tour_venue', 1);
      const before = state.composite;
      state = removeAward(state, 'pga_tour_venue');
      expect(state.composite).toBeLessThan(before);
    });

    it('handles non-existent award gracefully', () => {
      const state = createInitialExclusivityState();
      const updated = removeAward(state, 'fake_award');
      expect(updated.awards).toHaveLength(0);
    });
  });

  describe('getAwardsSummary', () => {
    it('returns correct count and bonus', () => {
      let state = earnAward(createInitialExclusivityState(), 'best_municipal', 1);
      state = earnAward(state, 'hidden_gem', 2);
      const summary = getAwardsSummary(state);
      expect(summary.count).toBe(2);
      expect(summary.totalBonus).toBe(30 + 60);
    });

    it('returns empty summary for no awards', () => {
      const summary = getAwardsSummary(createInitialExclusivityState());
      expect(summary.count).toBe(0);
      expect(summary.totalBonus).toBe(0);
      expect(summary.awards).toHaveLength(0);
    });
  });

  describe('getMembershipLabel', () => {
    it('returns correct labels', () => {
      expect(getMembershipLabel('public')).toBe('Public Course');
      expect(getMembershipLabel('semi_private')).toBe('Semi-Private');
      expect(getMembershipLabel('private')).toBe('Private Club');
      expect(getMembershipLabel('exclusive')).toBe('Exclusive Club');
    });
  });

  describe('getDressCodeLabel', () => {
    it('returns correct labels', () => {
      expect(getDressCodeLabel('none')).toBe('No Dress Code');
      expect(getDressCodeLabel('casual')).toBe('Casual');
      expect(getDressCodeLabel('smart_casual')).toBe('Smart Casual');
      expect(getDressCodeLabel('formal')).toBe('Formal Attire Required');
    });
  });

  describe('getExclusivitySummary', () => {
    it('returns complete summary', () => {
      let state = setMembershipModel(createInitialExclusivityState(), 'private', 15000);
      state = setWaitlistLength(state, 6);
      state = setDressCode(state, 'smart_casual');
      state = earnAward(state, 'best_municipal', 1);

      const summary = getExclusivitySummary(state);
      expect(summary.membership).toBe('Private Club');
      expect(summary.membershipCost).toBe(15000);
      expect(summary.waitlistMonths).toBe(6);
      expect(summary.dressCode).toBe('Smart Casual');
      expect(summary.awardsCount).toBe(1);
      expect(summary.score).toBeGreaterThan(0);
    });
  });

  describe('constants', () => {
    it('has correct membership base scores', () => {
      expect(MEMBERSHIP_BASE_SCORES.public).toBe(0);
      expect(MEMBERSHIP_BASE_SCORES.semi_private).toBe(200);
      expect(MEMBERSHIP_BASE_SCORES.private).toBe(500);
      expect(MEMBERSHIP_BASE_SCORES.exclusive).toBe(800);
    });

    it('has exclusivity weights summing to 1', () => {
      const sum = Object.values(EXCLUSIVITY_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0);
    });

    it('has defined award presets', () => {
      expect(AWARD_DEFINITIONS.best_municipal.prestigeBonus).toBe(30);
      expect(AWARD_DEFINITIONS.pga_tour_venue.prestigeBonus).toBe(200);
      expect(AWARD_DEFINITIONS.major_championship_host.prestigeBonus).toBe(300);
    });

    it('has reasonable thresholds', () => {
      expect(MEMBERSHIP_COST_THRESHOLD).toBe(25000);
      expect(WAITLIST_BONUS_MONTHS).toBe(12);
    });

    it('has dress code bonuses in ascending order', () => {
      expect(DRESS_CODE_BONUSES.none).toBeLessThan(DRESS_CODE_BONUSES.casual);
      expect(DRESS_CODE_BONUSES.casual).toBeLessThan(DRESS_CODE_BONUSES.smart_casual);
      expect(DRESS_CODE_BONUSES.smart_casual).toBeLessThan(DRESS_CODE_BONUSES.formal);
    });
  });
});
