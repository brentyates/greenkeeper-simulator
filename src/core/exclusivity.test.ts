import { describe, it, expect } from 'vitest';
import {
  createInitialExclusivityState,
  calculateExclusivityScore,
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
      const privateState = { ...publicState, membershipModel: 'private' as const, membershipCost: 10000 };
      expect(calculateExclusivityScore(privateState)).toBeGreaterThan(calculateExclusivityScore(publicState));
    });

    it('returns highest base score for exclusive membership', () => {
      const state = { ...createInitialExclusivityState(), membershipModel: 'exclusive' as const, membershipCost: 50000 };
      expect(calculateExclusivityScore(state)).toBeGreaterThan(500);
    });

    it('adds bonus for high membership cost', () => {
      const base = createInitialExclusivityState();
      const lowCost = { ...base, membershipModel: 'private' as const, membershipCost: 5000 };
      const highCost = { ...base, membershipModel: 'private' as const, membershipCost: 30000 };
      expect(calculateExclusivityScore(highCost)).toBeGreaterThan(calculateExclusivityScore(lowCost));
    });

    it('adds bonus for long waitlist', () => {
      const base = { ...createInitialExclusivityState(), membershipModel: 'private' as const, membershipCost: 10000 };
      const noWaitlist = calculateExclusivityScore(base);
      const withWaitlist = calculateExclusivityScore({ ...base, waitlistLength: 18 });
      expect(withWaitlist).toBeGreaterThan(noWaitlist);
    });

    it('adds bonus for formal dress code', () => {
      const base = { ...createInitialExclusivityState(), membershipModel: 'semi_private' as const, membershipCost: 5000 };
      const noDressCode = calculateExclusivityScore(base);
      const withDressCode = calculateExclusivityScore({ ...base, dressCode: 'formal' as const });
      expect(withDressCode).toBeGreaterThan(noDressCode);
    });

    it('caps score at 1000', () => {
      const state = {
        ...createInitialExclusivityState(),
        membershipModel: 'exclusive' as const,
        membershipCost: 100000,
        waitlistLength: 24,
        dressCode: 'formal' as const,
        awards: [
          { id: 'major_championship_host', name: 'Major Championship Host', dateEarned: 1, prestigeBonus: 300 },
          { id: 'pga_tour_venue', name: 'PGA Tour Venue', dateEarned: 2, prestigeBonus: 200 },
        ],
      };
      expect(calculateExclusivityScore(state)).toBeLessThanOrEqual(1000);
    });
  });
});
