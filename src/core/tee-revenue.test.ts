import { describe, it, expect } from 'vitest';
import {
  DEFAULT_GREEN_FEE_STRUCTURE,
  DEFAULT_CART_FEE_STRUCTURE,
  DEFAULT_TIP_CONFIG,
  STANDARD_ADDONS,
  createEmptyDailyRevenue,
  createInitialRevenueState,
  isWeekend,
  isPrimeMorning,
  isTwilightHour,
  calculateGreenFee,
  calculateCartFee,
  calculateAddOnUptake,
  generateAddOnsForGolfer,
  calculateTotalAddOnRevenue,
  calculateTip,
  calculateRoundRevenue,
  addRevenueToDaily,
  setOperatingCosts,
  finalizeDailyRevenue,
  getRevenueForDay,
  calculateAverageRevenue,
  updateGreenFeeStructure,
  updateCartFeeStructure,
  getRevenueSummary,
} from './tee-revenue';

describe('tee-revenue', () => {
  describe('DEFAULT_GREEN_FEE_STRUCTURE', () => {
    it('has reasonable default values', () => {
      expect(DEFAULT_GREEN_FEE_STRUCTURE.weekdayRate).toBe(45);
      expect(DEFAULT_GREEN_FEE_STRUCTURE.weekendRate).toBe(65);
      expect(DEFAULT_GREEN_FEE_STRUCTURE.twilightRate).toBe(30);
      expect(DEFAULT_GREEN_FEE_STRUCTURE.primeMorningPremium).toBe(1.2);
      expect(DEFAULT_GREEN_FEE_STRUCTURE.memberRate).toBe(0.7);
      expect(DEFAULT_GREEN_FEE_STRUCTURE.dynamicPricingEnabled).toBe(false);
    });
  });

  describe('DEFAULT_CART_FEE_STRUCTURE', () => {
    it('has reasonable default values', () => {
      expect(DEFAULT_CART_FEE_STRUCTURE.pricingModel).toBe('per_person');
      expect(DEFAULT_CART_FEE_STRUCTURE.standardCartFee).toBe(20);
      expect(DEFAULT_CART_FEE_STRUCTURE.cartRequired).toBe(false);
      expect(DEFAULT_CART_FEE_STRUCTURE.cartIncluded).toBe(false);
    });
  });

  describe('STANDARD_ADDONS', () => {
    it('has expected add-ons', () => {
      expect(STANDARD_ADDONS).toHaveLength(5);
      const ids = STANDARD_ADDONS.map(a => a.id);
      expect(ids).toContain('range_balls');
      expect(ids).toContain('caddie');
      expect(ids).toContain('club_rental');
    });

    it('has valid uptake rates', () => {
      for (const addOn of STANDARD_ADDONS) {
        expect(addOn.baseUptakeRate).toBeGreaterThan(0);
        expect(addOn.baseUptakeRate).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('createEmptyDailyRevenue', () => {
    it('creates revenue with all zeros', () => {
      const revenue = createEmptyDailyRevenue();
      expect(revenue.greenFees).toBe(0);
      expect(revenue.cartFees).toBe(0);
      expect(revenue.addOnServices).toBe(0);
      expect(revenue.tips).toBe(0);
      expect(revenue.grossRevenue).toBe(0);
      expect(revenue.netRevenue).toBe(0);
    });
  });

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
      expect(isWeekend(0)).toBe(true);  // Sunday
      expect(isWeekend(6)).toBe(true);  // Saturday
    });

    it('returns false for weekdays', () => {
      expect(isWeekend(1)).toBe(false); // Monday
      expect(isWeekend(3)).toBe(false); // Wednesday
      expect(isWeekend(5)).toBe(false); // Friday
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
      const fee = calculateGreenFee(DEFAULT_GREEN_FEE_STRUCTURE, 3, 10);
      expect(fee).toBe(45);
    });

    it('returns weekend rate for weekend', () => {
      const fee = calculateGreenFee(DEFAULT_GREEN_FEE_STRUCTURE, 6, 10);
      expect(fee).toBe(65);
    });

    it('returns twilight rate for twilight', () => {
      const fee = calculateGreenFee(DEFAULT_GREEN_FEE_STRUCTURE, 3, 16);
      expect(fee).toBe(30);
    });

    it('applies prime morning premium', () => {
      const normalFee = calculateGreenFee(DEFAULT_GREEN_FEE_STRUCTURE, 3, 10);
      const primeFee = calculateGreenFee(DEFAULT_GREEN_FEE_STRUCTURE, 3, 8);
      expect(primeFee).toBe(normalFee * 1.2);
    });

    it('applies member discount', () => {
      const publicFee = calculateGreenFee(DEFAULT_GREEN_FEE_STRUCTURE, 3, 10, 'public');
      const memberFee = calculateGreenFee(DEFAULT_GREEN_FEE_STRUCTURE, 3, 10, 'member');
      expect(memberFee).toBeCloseTo(publicFee * 0.7, 2);
    });

    it('applies guest of member discount', () => {
      const publicFee = calculateGreenFee(DEFAULT_GREEN_FEE_STRUCTURE, 3, 10, 'public');
      const guestFee = calculateGreenFee(DEFAULT_GREEN_FEE_STRUCTURE, 3, 10, 'guest_of_member');
      expect(guestFee).toBe(publicFee * 0.85);
    });

    it('applies dynamic pricing when enabled', () => {
      const structure = { ...DEFAULT_GREEN_FEE_STRUCTURE, dynamicPricingEnabled: true };
      const normalFee = calculateGreenFee(structure, 3, 10, 'public', 14, 1.0);
      const highDemandFee = calculateGreenFee(structure, 3, 10, 'public', 14, 1.3);
      expect(highDemandFee).toBeGreaterThan(normalFee);
    });
  });

  describe('calculateCartFee', () => {
    it('returns standard fee per person', () => {
      const fee = calculateCartFee(DEFAULT_CART_FEE_STRUCTURE, false, false, 4);
      expect(fee).toBe(80);
    });

    it('returns 0 when cart included', () => {
      const structure = { ...DEFAULT_CART_FEE_STRUCTURE, cartIncluded: true };
      const fee = calculateCartFee(structure, false, false, 4);
      expect(fee).toBe(0);
    });

    it('returns walking discount when walking', () => {
      const structure = { ...DEFAULT_CART_FEE_STRUCTURE, walkingDiscount: -5 };
      const fee = calculateCartFee(structure, true, false, 4);
      expect(fee).toBe(-5);
    });

    it('applies premium cart fee', () => {
      const structure = { ...DEFAULT_CART_FEE_STRUCTURE, premiumCartFee: 30 };
      const standardFee = calculateCartFee(structure, false, false, 4);
      const premiumFee = calculateCartFee(structure, false, true, 4);
      expect(premiumFee).toBeGreaterThan(standardFee);
    });

    it('calculates per cart pricing', () => {
      const structure = { ...DEFAULT_CART_FEE_STRUCTURE, pricingModel: 'per_cart' as const };
      const fee4 = calculateCartFee(structure, false, false, 4);
      const fee3 = calculateCartFee(structure, false, false, 3);
      expect(fee4).toBe(40);
      expect(fee3).toBe(40);
    });
  });

  describe('calculateAddOnUptake', () => {
    it('returns true when random below uptake rate', () => {
      const addOn = STANDARD_ADDONS.find(a => a.id === 'range_balls')!;
      expect(calculateAddOnUptake(addOn, 500, 0.1)).toBe(true);
    });

    it('returns false when random above uptake rate', () => {
      const addOn = STANDARD_ADDONS.find(a => a.id === 'range_balls')!;
      expect(calculateAddOnUptake(addOn, 500, 0.9)).toBe(false);
    });

    it('higher prestige increases uptake', () => {
      const addOn = STANDARD_ADDONS.find(a => a.id === 'caddie')!;
      const lowPrestigeRate = addOn.baseUptakeRate + (200 / 1000) * addOn.prestigeUptakeBonus;
      const highPrestigeRate = addOn.baseUptakeRate + (800 / 1000) * addOn.prestigeUptakeBonus;
      expect(highPrestigeRate).toBeGreaterThan(lowPrestigeRate);
    });
  });

  describe('generateAddOnsForGolfer', () => {
    it('only includes add-ons offered at booking phase', () => {
      const addOns = generateAddOnsForGolfer(STANDARD_ADDONS, 'booking', 500, () => 0.01);
      const offeredAtBooking = STANDARD_ADDONS.filter(a => a.offeredAtBooking);
      expect(addOns.length).toBe(offeredAtBooking.length);
    });

    it('returns empty array when random high', () => {
      const addOns = generateAddOnsForGolfer(STANDARD_ADDONS, 'booking', 500, () => 0.99);
      expect(addOns).toHaveLength(0);
    });
  });

  describe('calculateTotalAddOnRevenue', () => {
    it('sums add-on prices', () => {
      const addOns = [
        { id: 'a', name: 'A', price: 10, offeredAtBooking: true, offeredAtCheckIn: false, offeredDuringRound: false, baseUptakeRate: 0.1, prestigeUptakeBonus: 0.1 },
        { id: 'b', name: 'B', price: 25, offeredAtBooking: true, offeredAtCheckIn: false, offeredDuringRound: false, baseUptakeRate: 0.1, prestigeUptakeBonus: 0.1 },
      ];
      expect(calculateTotalAddOnRevenue(addOns)).toBe(35);
    });

    it('returns 0 for empty array', () => {
      expect(calculateTotalAddOnRevenue([])).toBe(0);
    });
  });

  describe('calculateTip', () => {
    it('calculates base tip', () => {
      const tip = calculateTip(100, 0, DEFAULT_TIP_CONFIG);
      expect(tip).toBe(15);
    });

    it('increases tip for high satisfaction', () => {
      const baseTip = calculateTip(100, 0, DEFAULT_TIP_CONFIG);
      const highSatTip = calculateTip(100, 50, DEFAULT_TIP_CONFIG);
      expect(highSatTip).toBeGreaterThan(baseTip);
    });

    it('decreases tip for low satisfaction', () => {
      const baseTip = calculateTip(100, 0, DEFAULT_TIP_CONFIG);
      const lowSatTip = calculateTip(100, -50, DEFAULT_TIP_CONFIG);
      expect(lowSatTip).toBeLessThan(baseTip);
    });

    it('applies house percentage', () => {
      const config = { ...DEFAULT_TIP_CONFIG, housePercentage: 0.1 };
      const tip = calculateTip(100, 0, config);
      expect(tip).toBe(13.5);
    });
  });

  describe('calculateRoundRevenue', () => {
    it('calculates total revenue', () => {
      const addOns = [{ id: 'a', name: 'A', price: 10, offeredAtBooking: true, offeredAtCheckIn: false, offeredDuringRound: false, baseUptakeRate: 0.1, prestigeUptakeBonus: 0.1 }];
      const result = calculateRoundRevenue(50, 20, addOns, 50, 0, DEFAULT_TIP_CONFIG);
      expect(result.greenFees).toBe(50);
      expect(result.cartFees).toBe(20);
      expect(result.addOnServices).toBe(10);
      expect(result.tips).toBeGreaterThan(0);
      expect(result.total).toBe(result.greenFees + result.cartFees + result.addOnServices + result.tips);
    });
  });

  describe('addRevenueToDaily', () => {
    it('adds revenue to daily totals', () => {
      const daily = createEmptyDailyRevenue();
      const updated = addRevenueToDaily(daily, { greenFees: 100, cartFees: 40 });
      expect(updated.greenFees).toBe(100);
      expect(updated.cartFees).toBe(40);
      expect(updated.grossRevenue).toBe(140);
    });

    it('accumulates multiple additions', () => {
      let daily = createEmptyDailyRevenue();
      daily = addRevenueToDaily(daily, { greenFees: 100 });
      daily = addRevenueToDaily(daily, { greenFees: 50, tips: 10 });
      expect(daily.greenFees).toBe(150);
      expect(daily.tips).toBe(10);
      expect(daily.grossRevenue).toBe(160);
    });

    it('calculates net revenue', () => {
      let daily = createEmptyDailyRevenue();
      daily = setOperatingCosts(daily, 50);
      daily = addRevenueToDaily(daily, { greenFees: 100 });
      expect(daily.netRevenue).toBe(50);
    });
  });

  describe('setOperatingCosts', () => {
    it('sets costs and updates net revenue', () => {
      let daily = createEmptyDailyRevenue();
      daily = addRevenueToDaily(daily, { greenFees: 200 });
      daily = setOperatingCosts(daily, 75);
      expect(daily.operatingCosts).toBe(75);
      expect(daily.netRevenue).toBe(125);
    });
  });

  describe('finalizeDailyRevenue', () => {
    it('moves today to history and resets', () => {
      let state = createInitialRevenueState();
      state = {
        ...state,
        todaysRevenue: addRevenueToDaily(createEmptyDailyRevenue(), { greenFees: 500 }),
      };
      state = finalizeDailyRevenue(state);
      expect(state.revenueHistory).toHaveLength(1);
      expect(state.revenueHistory[0].greenFees).toBe(500);
      expect(state.todaysRevenue.greenFees).toBe(0);
    });
  });

  describe('getRevenueForDay', () => {
    it('returns today for daysAgo=0', () => {
      let state = createInitialRevenueState();
      state = {
        ...state,
        todaysRevenue: addRevenueToDaily(createEmptyDailyRevenue(), { greenFees: 100 }),
      };
      const revenue = getRevenueForDay(state, 0);
      expect(revenue?.greenFees).toBe(100);
    });

    it('returns historical day', () => {
      let state = createInitialRevenueState();
      state = {
        ...state,
        todaysRevenue: addRevenueToDaily(createEmptyDailyRevenue(), { greenFees: 100 }),
      };
      state = finalizeDailyRevenue(state);
      state = {
        ...state,
        todaysRevenue: addRevenueToDaily(createEmptyDailyRevenue(), { greenFees: 200 }),
      };
      const yesterday = getRevenueForDay(state, 1);
      expect(yesterday?.greenFees).toBe(100);
    });

    it('returns undefined for invalid day', () => {
      const state = createInitialRevenueState();
      expect(getRevenueForDay(state, 5)).toBeUndefined();
    });
  });

  describe('calculateAverageRevenue', () => {
    it('calculates average over days', () => {
      let state = createInitialRevenueState();
      for (let i = 0; i < 3; i++) {
        state = {
          ...state,
          todaysRevenue: addRevenueToDaily(createEmptyDailyRevenue(), { greenFees: (i + 1) * 100 }),
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

  describe('updateGreenFeeStructure', () => {
    it('updates green fee structure', () => {
      let state = createInitialRevenueState();
      state = updateGreenFeeStructure(state, { weekdayRate: 55 });
      expect(state.greenFeeStructure.weekdayRate).toBe(55);
      expect(state.greenFeeStructure.weekendRate).toBe(65);
    });
  });

  describe('updateCartFeeStructure', () => {
    it('updates cart fee structure', () => {
      let state = createInitialRevenueState();
      state = updateCartFeeStructure(state, { standardCartFee: 25, cartRequired: true });
      expect(state.cartFeeStructure.standardCartFee).toBe(25);
      expect(state.cartFeeStructure.cartRequired).toBe(true);
    });
  });

  describe('getRevenueSummary', () => {
    it('returns complete summary', () => {
      let state = createInitialRevenueState();
      state = {
        ...state,
        todaysRevenue: addRevenueToDaily(createEmptyDailyRevenue(), { greenFees: 500 }),
      };
      const summary = getRevenueSummary(state);
      expect(summary.today.greenFees).toBe(500);
      expect(summary.totalHistoricalDays).toBe(0);
    });
  });
});
