import { describe, it, expect } from 'vitest';
import {
  createInitialRevenueState,
  isWeekend,
  isPrimeMorning,
  isTwilightHour,
  calculateGreenFee,
  calculateCartFee,
  finalizeDailyRevenue,
  calculateAverageRevenue,
  getRevenueSummary,
} from './tee-revenue';

describe('tee-revenue', () => {
  describe('createInitialRevenueState', () => {
    it('creates state with defaults', () => {
      const state = createInitialRevenueState();
      expect(state.greenFeeStructure.weekdayRate).toBe(45);
      expect(state.cartFeeStructure.standardCartFee).toBe(20);
      expect(state.availableAddOns).toHaveLength(5);
      expect(state.todaysRevenue.grossRevenue).toBe(0);
      expect(state.revenueHistory).toHaveLength(0);
    });
  });

  describe('isWeekend', () => {
    it('returns true for Saturday and Sunday', () => {
      expect(isWeekend(0)).toBe(true);
      expect(isWeekend(6)).toBe(true);
    });

    it('returns false for weekdays', () => {
      expect(isWeekend(1)).toBe(false);
      expect(isWeekend(3)).toBe(false);
      expect(isWeekend(5)).toBe(false);
    });
  });

  describe('isPrimeMorning', () => {
    it('returns true for 7-10 AM', () => {
      expect(isPrimeMorning(7)).toBe(true);
      expect(isPrimeMorning(8)).toBe(true);
      expect(isPrimeMorning(9)).toBe(true);
    });

    it('returns false outside prime morning', () => {
      expect(isPrimeMorning(6)).toBe(false);
      expect(isPrimeMorning(10)).toBe(false);
      expect(isPrimeMorning(14)).toBe(false);
    });
  });

  describe('isTwilightHour', () => {
    it('returns true for twilight hours', () => {
      expect(isTwilightHour(14)).toBe(true);
      expect(isTwilightHour(16)).toBe(true);
      expect(isTwilightHour(18)).toBe(true);
    });

    it('returns false for non-twilight hours', () => {
      expect(isTwilightHour(8)).toBe(false);
      expect(isTwilightHour(13)).toBe(false);
    });

    it('uses custom twilight start', () => {
      expect(isTwilightHour(16, 17)).toBe(false);
      expect(isTwilightHour(17, 17)).toBe(true);
    });
  });

  describe('calculateGreenFee', () => {
    it('returns weekday rate for weekday', () => {
      const state = createInitialRevenueState();
      const fee = calculateGreenFee(state.greenFeeStructure, 3, 10);
      expect(fee).toBe(45);
    });

    it('returns weekend rate for weekend', () => {
      const state = createInitialRevenueState();
      const fee = calculateGreenFee(state.greenFeeStructure, 6, 10);
      expect(fee).toBe(65);
    });

    it('returns twilight rate for twilight', () => {
      const state = createInitialRevenueState();
      const fee = calculateGreenFee(state.greenFeeStructure, 3, 16);
      expect(fee).toBe(30);
    });

    it('applies prime morning premium', () => {
      const state = createInitialRevenueState();
      const normalFee = calculateGreenFee(state.greenFeeStructure, 3, 10);
      const primeFee = calculateGreenFee(state.greenFeeStructure, 3, 8);
      expect(primeFee).toBe(normalFee * 1.2);
    });

    it('applies member discount', () => {
      const state = createInitialRevenueState();
      const publicFee = calculateGreenFee(state.greenFeeStructure, 3, 10, 'public');
      const memberFee = calculateGreenFee(state.greenFeeStructure, 3, 10, 'member');
      expect(memberFee).toBeCloseTo(publicFee * 0.7, 2);
    });

    it('applies guest of member discount', () => {
      const state = createInitialRevenueState();
      const publicFee = calculateGreenFee(state.greenFeeStructure, 3, 10, 'public');
      const guestFee = calculateGreenFee(state.greenFeeStructure, 3, 10, 'guest_of_member');
      expect(guestFee).toBe(publicFee * 0.85);
    });

    it('applies dynamic pricing when enabled', () => {
      const state = createInitialRevenueState();
      const structure = { ...state.greenFeeStructure, dynamicPricingEnabled: true };
      const normalFee = calculateGreenFee(structure, 3, 10, 'public', 14, 1.0);
      const highDemandFee = calculateGreenFee(structure, 3, 10, 'public', 14, 1.3);
      expect(highDemandFee).toBeGreaterThan(normalFee);
    });
  });

  describe('calculateCartFee', () => {
    it('returns standard fee per person', () => {
      const state = createInitialRevenueState();
      const fee = calculateCartFee(state.cartFeeStructure, false, false, 4);
      expect(fee).toBe(80);
    });

    it('returns 0 when cart included', () => {
      const state = createInitialRevenueState();
      const structure = { ...state.cartFeeStructure, cartIncluded: true };
      const fee = calculateCartFee(structure, false, false, 4);
      expect(fee).toBe(0);
    });

    it('returns walking discount when walking', () => {
      const state = createInitialRevenueState();
      const structure = { ...state.cartFeeStructure, walkingDiscount: -5 };
      const fee = calculateCartFee(structure, true, false, 4);
      expect(fee).toBe(-5);
    });

    it('applies premium cart fee', () => {
      const state = createInitialRevenueState();
      const structure = { ...state.cartFeeStructure, premiumCartFee: 30 };
      const standardFee = calculateCartFee(structure, false, false, 4);
      const premiumFee = calculateCartFee(structure, false, true, 4);
      expect(premiumFee).toBeGreaterThan(standardFee);
    });

    it('calculates per cart pricing', () => {
      const state = createInitialRevenueState();
      const structure = { ...state.cartFeeStructure, pricingModel: 'per_cart' as const };
      const fee4 = calculateCartFee(structure, false, false, 4);
      const fee3 = calculateCartFee(structure, false, false, 3);
      expect(fee4).toBe(40);
      expect(fee3).toBe(40);
    });
  });

  describe('finalizeDailyRevenue', () => {
    it('moves today to history and resets', () => {
      let state = createInitialRevenueState();
      state = {
        ...state,
        todaysRevenue: { ...state.todaysRevenue, greenFees: 500, grossRevenue: 500 },
      };
      state = finalizeDailyRevenue(state);
      expect(state.revenueHistory).toHaveLength(1);
      expect(state.revenueHistory[0].greenFees).toBe(500);
      expect(state.todaysRevenue.greenFees).toBe(0);
    });
  });

  describe('calculateAverageRevenue', () => {
    it('calculates average over days', () => {
      let state = createInitialRevenueState();
      for (let i = 0; i < 3; i++) {
        state = {
          ...state,
          todaysRevenue: { ...state.todaysRevenue, greenFees: (i + 1) * 100 },
        };
        state = finalizeDailyRevenue(state);
      }
      const avg = calculateAverageRevenue(state, 3);
      expect(avg.greenFees).toBe(200);
    });

    it('returns empty for no history', () => {
      const state = createInitialRevenueState();
      const avg = calculateAverageRevenue(state, 7);
      expect(avg.greenFees).toBe(0);
    });
  });

  describe('getRevenueSummary', () => {
    it('returns complete summary', () => {
      let state = createInitialRevenueState();
      state = {
        ...state,
        todaysRevenue: { ...state.todaysRevenue, greenFees: 500 },
      };
      const summary = getRevenueSummary(state);
      expect(summary.today.greenFees).toBe(500);
      expect(summary.totalHistoricalDays).toBe(0);
    });
  });
});
