import { describe, it, expect } from 'vitest';
import {
  DEFAULT_OPERATING_HOURS,
  SPACING_CONFIGS,
  createInitialTeeTimeState,
  getOperatingHoursForSeason,
  calculateMaxDailySlots,
  generateDailySlots,
  getTeeTimes,
  getTeeTimeById,
  getAvailableSlots,
  getBookedSlots,
  updateSpacing,
  updateOperatingHours,
  bookTeeTime,
  checkInTeeTime,
  startRound,
  completeRound,
  cancelTeeTime,
  markNoShow,
  getDailyStats,
  isTwilight,
  formatTeeTime,
  getSpacingLabel,
} from './tee-times';

describe('tee-times', () => {
  describe('createInitialTeeTimeState', () => {
    it('creates state with standard spacing by default', () => {
      const state = createInitialTeeTimeState();
      expect(state.spacingConfig.spacing).toBe('standard');
      expect(state.spacingConfig.minutesBetween).toBe(10);
    });

    it('creates state with specified spacing', () => {
      const state = createInitialTeeTimeState('relaxed');
      expect(state.spacingConfig.spacing).toBe('relaxed');
      expect(state.spacingConfig.minutesBetween).toBe(15);
    });

    it('starts with default operating hours', () => {
      const state = createInitialTeeTimeState();
      expect(state.operatingHours.openTime).toBe(6);
      expect(state.operatingHours.closeTime).toBe(20);
    });

    it('starts with empty tee times map', () => {
      const state = createInitialTeeTimeState();
      expect(state.teeTimes.size).toBe(0);
    });
  });

  describe('getOperatingHoursForSeason', () => {
    it('returns summer hours in summer', () => {
      const hours = getOperatingHoursForSeason(DEFAULT_OPERATING_HOURS, 150);
      expect(hours.open).toBe(5);
      expect(hours.lastTee).toBe(17);
    });

    it('returns winter hours in winter', () => {
      const hours = getOperatingHoursForSeason(DEFAULT_OPERATING_HOURS, 30);
      expect(hours.open).toBe(7);
      expect(hours.lastTee).toBe(14);
    });

    it('returns default hours in spring/fall', () => {
      const hours = getOperatingHoursForSeason(DEFAULT_OPERATING_HOURS, 75);
      expect(hours.open).toBe(6);
      expect(hours.lastTee).toBe(16);
    });
  });

  describe('calculateMaxDailySlots', () => {
    it('calculates slots based on spacing', () => {
      const standardSlots = calculateMaxDailySlots(SPACING_CONFIGS.standard, DEFAULT_OPERATING_HOURS, 100);
      const packedSlots = calculateMaxDailySlots(SPACING_CONFIGS.packed, DEFAULT_OPERATING_HOURS, 100);
      expect(packedSlots).toBeGreaterThan(standardSlots);
    });

    it('adjusts for seasonal hours', () => {
      const summerSlots = calculateMaxDailySlots(SPACING_CONFIGS.standard, DEFAULT_OPERATING_HOURS, 150);
      const winterSlots = calculateMaxDailySlots(SPACING_CONFIGS.standard, DEFAULT_OPERATING_HOURS, 30);
      expect(summerSlots).toBeGreaterThan(winterSlots);
    });
  });

  describe('generateDailySlots', () => {
    it('generates correct number of slots', () => {
      const slots = generateDailySlots(75, SPACING_CONFIGS.standard, DEFAULT_OPERATING_HOURS);
      expect(slots.length).toBeGreaterThan(0);
    });

    it('generates slots with correct times', () => {
      const slots = generateDailySlots(75, SPACING_CONFIGS.standard, DEFAULT_OPERATING_HOURS);
      expect(slots[0].scheduledTime.hour).toBe(6);
      expect(slots[0].scheduledTime.minute).toBe(0);
      expect(slots[1].scheduledTime.minute).toBe(10);
    });

    it('all slots start as available', () => {
      const slots = generateDailySlots(75, SPACING_CONFIGS.standard, DEFAULT_OPERATING_HOURS);
      expect(slots.every(s => s.status === 'available')).toBe(true);
    });

    it('generates unique IDs', () => {
      const slots = generateDailySlots(75, SPACING_CONFIGS.standard, DEFAULT_OPERATING_HOURS);
      const ids = slots.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('getTeeTimes', () => {
    it('generates slots if none exist', () => {
      const state = createInitialTeeTimeState();
      const slots = getTeeTimes(state, 75);
      expect(slots.length).toBeGreaterThan(0);
    });

    it('returns cached slots on second call', () => {
      const state = createInitialTeeTimeState();
      const slots1 = getTeeTimes(state, 75);
      const slots2 = getTeeTimes(state, 75);
      expect(slots1).toBe(slots2);
    });
  });

  describe('getTeeTimeById', () => {
    it('finds tee time by ID', () => {
      const state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      const slot = getTeeTimeById(state, 'tt-75-0600');
      expect(slot).toBeDefined();
      expect(slot?.scheduledTime.hour).toBe(6);
    });

    it('returns undefined for non-existent ID', () => {
      const state = createInitialTeeTimeState();
      const slot = getTeeTimeById(state, 'fake-id');
      expect(slot).toBeUndefined();
    });
  });

  describe('getAvailableSlots', () => {
    it('returns only available slots', () => {
      const state = createInitialTeeTimeState();
      const available = getAvailableSlots(state, 75);
      expect(available.every(s => s.status === 'available')).toBe(true);
    });

    it('excludes booked slots', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      state = bookTeeTime(state, 'tt-75-0600', [
        { golferId: 'g1', name: 'Test', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] }
      ], 'reservation', { day: 0, hour: 8, minute: 0 });
      const available = getAvailableSlots(state, 75);
      expect(available.find(s => s.id === 'tt-75-0600')).toBeUndefined();
    });
  });

  describe('getBookedSlots', () => {
    it('returns only booked slots', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      state = bookTeeTime(state, 'tt-75-0600', [
        { golferId: 'g1', name: 'Test', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] }
      ], 'reservation', { day: 0, hour: 8, minute: 0 });
      const booked = getBookedSlots(state, 75);
      expect(booked.length).toBe(1);
      expect(booked[0].id).toBe('tt-75-0600');
    });
  });

  describe('updateSpacing', () => {
    it('updates spacing configuration', () => {
      const state = createInitialTeeTimeState('standard');
      const updated = updateSpacing(state, 'relaxed');
      expect(updated.spacingConfig.spacing).toBe('relaxed');
      expect(updated.spacingConfig.minutesBetween).toBe(15);
    });
  });

  describe('updateOperatingHours', () => {
    it('updates operating hours', () => {
      const state = createInitialTeeTimeState();
      const updated = updateOperatingHours(state, { openTime: 7, twilightStart: 15 });
      expect(updated.operatingHours.openTime).toBe(7);
      expect(updated.operatingHours.twilightStart).toBe(15);
      expect(updated.operatingHours.closeTime).toBe(20);
    });
  });

  describe('bookTeeTime', () => {
    it('books an available slot', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      state = bookTeeTime(state, 'tt-75-0600', [
        { golferId: 'g1', name: 'Test', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] }
      ], 'reservation', { day: 0, hour: 8, minute: 0 });

      const slot = getTeeTimeById(state, 'tt-75-0600');
      expect(slot?.status).toBe('reserved');
      expect(slot?.groupSize).toBe(1);
      expect(slot?.totalRevenue).toBe(70);
    });

    it('calculates revenue from multiple golfers', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      state = bookTeeTime(state, 'tt-75-0600', [
        { golferId: 'g1', name: 'A', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] },
        { golferId: 'g2', name: 'B', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] },
        { golferId: 'g3', name: 'C', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] },
        { golferId: 'g4', name: 'D', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] },
      ], 'reservation', { day: 0, hour: 8, minute: 0 });

      const slot = getTeeTimeById(state, 'tt-75-0600');
      expect(slot?.groupSize).toBe(4);
      expect(slot?.totalRevenue).toBe(280);
      expect(slot?.pricePerGolfer).toBe(70);
    });

    it('includes add-on revenue', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      state = bookTeeTime(state, 'tt-75-0600', [
        { golferId: 'g1', name: 'Test', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [{ id: 'range', name: 'Range Balls', price: 10 }] }
      ], 'reservation', { day: 0, hour: 8, minute: 0 });

      const slot = getTeeTimeById(state, 'tt-75-0600');
      expect(slot?.totalRevenue).toBe(80);
    });

    it('does not book already booked slot', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      state = bookTeeTime(state, 'tt-75-0600', [
        { golferId: 'g1', name: 'Test', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] }
      ], 'reservation', { day: 0, hour: 8, minute: 0 });

      const beforeState = state;
      state = bookTeeTime(state, 'tt-75-0600', [
        { golferId: 'g2', name: 'Other', membershipStatus: 'public', greenFee: 60, cartFee: 20, addOns: [] }
      ], 'reservation', { day: 0, hour: 9, minute: 0 });

      expect(state).toBe(beforeState);
    });

    it('sets booking type correctly', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      state = bookTeeTime(state, 'tt-75-0600', [
        { golferId: 'g1', name: 'Test', membershipStatus: 'member', greenFee: 40, cartFee: 0, addOns: [] }
      ], 'member', { day: 0, hour: 8, minute: 0 });

      const slot = getTeeTimeById(state, 'tt-75-0600');
      expect(slot?.bookingType).toBe('member');
    });
  });

  describe('checkInTeeTime', () => {
    it('checks in a reserved slot', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      state = bookTeeTime(state, 'tt-75-0600', [
        { golferId: 'g1', name: 'Test', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] }
      ], 'reservation', { day: 0, hour: 8, minute: 0 });
      state = checkInTeeTime(state, 'tt-75-0600');

      const slot = getTeeTimeById(state, 'tt-75-0600');
      expect(slot?.status).toBe('checked_in');
      expect(slot?.checkedIn).toBe(true);
    });

    it('does not check in non-reserved slot', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      const beforeState = state;
      state = checkInTeeTime(state, 'tt-75-0600');
      expect(state).toBe(beforeState);
    });
  });

  describe('startRound', () => {
    it('starts round for checked-in group', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      state = bookTeeTime(state, 'tt-75-0600', [
        { golferId: 'g1', name: 'Test', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] }
      ], 'reservation', { day: 0, hour: 8, minute: 0 });
      state = checkInTeeTime(state, 'tt-75-0600');
      state = startRound(state, 'tt-75-0600', { day: 75, hour: 6, minute: 5 });

      const slot = getTeeTimeById(state, 'tt-75-0600');
      expect(slot?.status).toBe('in_progress');
      expect(slot?.actualStartTime?.minute).toBe(5);
    });
  });

  describe('completeRound', () => {
    it('completes round in progress', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      state = bookTeeTime(state, 'tt-75-0600', [
        { golferId: 'g1', name: 'Test', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] }
      ], 'reservation', { day: 0, hour: 8, minute: 0 });
      state = checkInTeeTime(state, 'tt-75-0600');
      state = startRound(state, 'tt-75-0600', { day: 75, hour: 6, minute: 0 });
      state = completeRound(state, 'tt-75-0600', { day: 75, hour: 10, minute: 15 });

      const slot = getTeeTimeById(state, 'tt-75-0600');
      expect(slot?.status).toBe('completed');
      expect(slot?.roundCompleted).toBe(true);
      expect(slot?.completionTime?.hour).toBe(10);
    });
  });

  describe('cancelTeeTime', () => {
    it('cancels reserved slot', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      state = bookTeeTime(state, 'tt-75-0600', [
        { golferId: 'g1', name: 'Test', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] }
      ], 'reservation', { day: 0, hour: 8, minute: 0 });
      state = cancelTeeTime(state, 'tt-75-0600');

      const slot = getTeeTimeById(state, 'tt-75-0600');
      expect(slot?.status).toBe('cancelled');
      expect(slot?.golfers).toHaveLength(0);
      expect(slot?.totalRevenue).toBe(0);
    });
  });

  describe('markNoShow', () => {
    it('marks reserved slot as no-show', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      state = bookTeeTime(state, 'tt-75-0600', [
        { golferId: 'g1', name: 'Test', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] }
      ], 'reservation', { day: 0, hour: 8, minute: 0 });
      state = markNoShow(state, 'tt-75-0600');

      const slot = getTeeTimeById(state, 'tt-75-0600');
      expect(slot?.status).toBe('no_show');
    });
  });

  describe('getDailyStats', () => {
    it('calculates correct stats for empty day', () => {
      const state = createInitialTeeTimeState();
      const stats = getDailyStats(state, 75);
      expect(stats.totalSlots).toBeGreaterThan(0);
      expect(stats.availableSlots).toBe(stats.totalSlots);
      expect(stats.bookedSlots).toBe(0);
      expect(stats.bookingRate).toBe(0);
    });

    it('calculates correct stats with bookings', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      state = bookTeeTime(state, 'tt-75-0600', [
        { golferId: 'g1', name: 'A', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] },
        { golferId: 'g2', name: 'B', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] },
      ], 'reservation', { day: 0, hour: 8, minute: 0 });
      state = bookTeeTime(state, 'tt-75-0610', [
        { golferId: 'g3', name: 'C', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] },
      ], 'reservation', { day: 0, hour: 8, minute: 0 });

      const stats = getDailyStats(state, 75);
      expect(stats.bookedSlots).toBe(2);
      expect(stats.totalGolfers).toBe(3);
      expect(stats.totalRevenue).toBe(210);
      expect(stats.bookingRate).toBeGreaterThan(0);
    });

    it('tracks different statuses', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      state = bookTeeTime(state, 'tt-75-0600', [
        { golferId: 'g1', name: 'A', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] },
      ], 'reservation', { day: 0, hour: 8, minute: 0 });
      state = checkInTeeTime(state, 'tt-75-0600');

      state = bookTeeTime(state, 'tt-75-0610', [
        { golferId: 'g2', name: 'B', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] },
      ], 'reservation', { day: 0, hour: 8, minute: 0 });
      state = markNoShow(state, 'tt-75-0610');

      const stats = getDailyStats(state, 75);
      expect(stats.checkedIn).toBe(1);
      expect(stats.noShows).toBe(1);
    });
  });

  describe('isTwilight', () => {
    it('returns true for twilight hours', () => {
      expect(isTwilight({ day: 1, hour: 15, minute: 0 }, DEFAULT_OPERATING_HOURS)).toBe(true);
    });

    it('returns false for morning hours', () => {
      expect(isTwilight({ day: 1, hour: 8, minute: 0 }, DEFAULT_OPERATING_HOURS)).toBe(false);
    });
  });

  describe('formatTeeTime', () => {
    it('formats morning time correctly', () => {
      expect(formatTeeTime({ day: 1, hour: 6, minute: 0 })).toBe('6:00 AM');
    });

    it('formats afternoon time correctly', () => {
      expect(formatTeeTime({ day: 1, hour: 14, minute: 30 })).toBe('2:30 PM');
    });

    it('formats noon correctly', () => {
      expect(formatTeeTime({ day: 1, hour: 12, minute: 0 })).toBe('12:00 PM');
    });
  });

  describe('getSpacingLabel', () => {
    it('returns correct labels', () => {
      expect(getSpacingLabel('packed')).toBe('Packed (6 min)');
      expect(getSpacingLabel('standard')).toBe('Standard (10 min)');
      expect(getSpacingLabel('exclusive')).toBe('Exclusive (20 min)');
    });
  });

  describe('SPACING_CONFIGS', () => {
    it('has correct minute intervals', () => {
      expect(SPACING_CONFIGS.packed.minutesBetween).toBe(6);
      expect(SPACING_CONFIGS.tight.minutesBetween).toBe(8);
      expect(SPACING_CONFIGS.standard.minutesBetween).toBe(10);
      expect(SPACING_CONFIGS.comfortable.minutesBetween).toBe(12);
      expect(SPACING_CONFIGS.relaxed.minutesBetween).toBe(15);
      expect(SPACING_CONFIGS.exclusive.minutesBetween).toBe(20);
    });

    it('has revenue multipliers in descending order', () => {
      expect(SPACING_CONFIGS.packed.revenueMultiplier).toBeGreaterThan(SPACING_CONFIGS.tight.revenueMultiplier);
      expect(SPACING_CONFIGS.tight.revenueMultiplier).toBeGreaterThan(SPACING_CONFIGS.standard.revenueMultiplier);
      expect(SPACING_CONFIGS.standard.revenueMultiplier).toBeGreaterThan(SPACING_CONFIGS.comfortable.revenueMultiplier);
    });

    it('has reputation modifiers from negative to positive', () => {
      expect(SPACING_CONFIGS.packed.reputationModifier).toBeLessThan(0);
      expect(SPACING_CONFIGS.standard.reputationModifier).toBe(0);
      expect(SPACING_CONFIGS.exclusive.reputationModifier).toBeGreaterThan(0);
    });
  });
});
