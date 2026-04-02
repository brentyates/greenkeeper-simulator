import { describe, it, expect } from 'vitest';
import {
  DEFAULT_OPERATING_HOURS,
  SPACING_CONFIGS,
  createInitialTeeTimeState,
  generateDailySlots,
  getTeeTimes,
  getAvailableSlots,
  updateSpacing,
  bookTeeTime,
  checkInTeeTime,
  cancelTeeTime,
  markNoShow,
  getDailyStats,
  isTwilight,
  formatTeeTime,
  getSpacingLabel,
  getDayOfWeek,
  simulateDailyBookings,
  applyBookingSimulation,
  resetDailyMetrics,
} from './tee-times';

function findSlot(state: ReturnType<typeof createInitialTeeTimeState>, day: number, id: string) {
  return getTeeTimes(state, day).find(s => s.id === id);
}

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
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('adjusts for seasonal hours', () => {
      const summer = generateDailySlots(150, SPACING_CONFIGS.standard, DEFAULT_OPERATING_HOURS);
      const winter = generateDailySlots(30, SPACING_CONFIGS.standard, DEFAULT_OPERATING_HOURS);
      expect(summer.length).toBeGreaterThan(winter.length);
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

  describe('updateSpacing', () => {
    it('updates spacing configuration', () => {
      const state = createInitialTeeTimeState('standard');
      const updated = updateSpacing(state, 'relaxed');
      expect(updated.spacingConfig.spacing).toBe('relaxed');
      expect(updated.spacingConfig.minutesBetween).toBe(15);
    });
  });

  describe('bookTeeTime', () => {
    it('books an available slot', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      state = bookTeeTime(state, 'tt-75-0600', [
        { golferId: 'g1', name: 'Test', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] }
      ], 'reservation', { day: 0, hour: 8, minute: 0 });

      const slot = findSlot(state, 75, 'tt-75-0600');
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

      const slot = findSlot(state, 75, 'tt-75-0600');
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

      const slot = findSlot(state, 75, 'tt-75-0600');
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

    it('returns unchanged state for empty golfers array', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      const beforeState = state;
      state = bookTeeTime(state, 'tt-75-0600', [], 'reservation', { day: 0, hour: 8, minute: 0 });
      expect(state).toBe(beforeState);
    });

    it('sets booking type correctly', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      state = bookTeeTime(state, 'tt-75-0600', [
        { golferId: 'g1', name: 'Test', membershipStatus: 'member', greenFee: 40, cartFee: 0, addOns: [] }
      ], 'member', { day: 0, hour: 8, minute: 0 });

      const slot = findSlot(state, 75, 'tt-75-0600');
      expect(slot?.bookingType).toBe('member');
    });

    it('returns unchanged state for invalid tee time id', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      const beforeState = state;
      state = bookTeeTime(state, 'invalid-id', [
        { golferId: 'g1', name: 'Test', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] }
      ], 'reservation', { day: 0, hour: 8, minute: 0 });
      expect(state).toBe(beforeState);
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

      const slot = findSlot(state, 75, 'tt-75-0600');
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

    it('returns unchanged state for invalid tee time id', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      const beforeState = state;
      state = checkInTeeTime(state, 'invalid-id');
      expect(state).toBe(beforeState);
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

      const slot = findSlot(state, 75, 'tt-75-0600');
      expect(slot?.status).toBe('cancelled');
      expect(slot?.golfers).toHaveLength(0);
      expect(slot?.totalRevenue).toBe(0);
    });

    it('does not cancel non-reserved slot', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      const beforeState = state;
      state = cancelTeeTime(state, 'tt-75-0600');
      expect(state).toBe(beforeState);
    });

    it('returns unchanged state for invalid tee time id', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      const beforeState = state;
      state = cancelTeeTime(state, 'invalid-id');
      expect(state).toBe(beforeState);
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

      const slot = findSlot(state, 75, 'tt-75-0600');
      expect(slot?.status).toBe('no_show');
    });

    it('does not mark non-reserved slot as no-show', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      const beforeState = state;
      state = markNoShow(state, 'tt-75-0600');
      expect(state).toBe(beforeState);
    });

    it('returns unchanged state for invalid tee time id', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      const beforeState = state;
      state = markNoShow(state, 'invalid-id');
      expect(state).toBe(beforeState);
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

    it('tracks cancelled bookings', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      state = bookTeeTime(state, 'tt-75-0600', [
        { golferId: 'g1', name: 'A', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] },
      ], 'reservation', { day: 0, hour: 8, minute: 0 });
      state = cancelTeeTime(state, 'tt-75-0600');

      const stats = getDailyStats(state, 75);
      expect(stats.cancelled).toBe(1);
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
      expect(getSpacingLabel('tight')).toBe('Tight (8 min)');
      expect(getSpacingLabel('standard')).toBe('Standard (10 min)');
      expect(getSpacingLabel('comfortable')).toBe('Comfortable (12 min)');
      expect(getSpacingLabel('relaxed')).toBe('Relaxed (15 min)');
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

  describe('getDayOfWeek', () => {
    it('returns correct day of week', () => {
      expect(getDayOfWeek(0)).toBe(0);
      expect(getDayOfWeek(1)).toBe(1);
      expect(getDayOfWeek(6)).toBe(6);
      expect(getDayOfWeek(7)).toBe(0);
      expect(getDayOfWeek(8)).toBe(1);
    });
  });

  describe('simulateDailyBookings', () => {
    it('creates bookings based on demand', () => {
      const state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      const result = simulateDailyBookings(state, 75, 74, { baseDemand: 1.0 }, 50, 20, () => 0.1);
      expect(result.newBookings.length).toBeGreaterThan(0);
      expect(result.totalNewRevenue).toBeGreaterThan(0);
    });

    it('creates no bookings when random is high', () => {
      const state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      const result = simulateDailyBookings(state, 75, 74, { baseDemand: 0.1 }, 50, 20, () => 0.99);
      expect(result.newBookings.length).toBe(0);
      expect(result.totalNewRevenue).toBe(0);
    });

    it('uses correct green and cart fees', () => {
      const state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      const result = simulateDailyBookings(state, 75, 74, { baseDemand: 1.0 }, 100, 30, () => 0.01);
      expect(result.newBookings.length).toBeGreaterThan(0);
      expect(result.newBookings[0].golfers[0].greenFee).toBe(100);
      expect(result.newBookings[0].golfers[0].cartFee).toBe(30);
    });
  });

  describe('applyBookingSimulation', () => {
    it('updates state with new bookings', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      const simulation = simulateDailyBookings(state, 75, 74, { baseDemand: 1.0 }, 50, 20, () => 0.01);
      state = applyBookingSimulation(state, simulation, 75);
      const stats = getDailyStats(state, 75);
      expect(stats.bookedSlots).toBeGreaterThan(0);
    });

    it('updates booking metrics', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      const simulation = simulateDailyBookings(state, 75, 74, { baseDemand: 1.0 }, 50, 20, () => 0.01);
      state = applyBookingSimulation(state, simulation, 75);
      expect(state.bookingMetrics.totalBookingsToday).toBeGreaterThan(0);
    });

    it('preserves unbooked slots when simulation has partial bookings', () => {
      let state = createInitialTeeTimeState();
      const slots = getTeeTimes(state, 75);
      const totalSlots = slots.length;

      const simulation = simulateDailyBookings(state, 75, 74, { baseDemand: 0.1 }, 50, 20, () => 0.5);
      expect(simulation.newBookings.length).toBeLessThan(totalSlots);

      state = applyBookingSimulation(state, simulation, 75);
      const slotsAfter = getTeeTimes(state, 75);
      expect(slotsAfter.length).toBe(totalSlots);
    });
  });

  describe('resetDailyMetrics', () => {
    it('resets all metrics to zero', () => {
      let state = createInitialTeeTimeState();
      state = {
        ...state,
        bookingMetrics: {
          totalBookingsToday: 10,
          cancellationsToday: 2,
          noShowsToday: 1,
          lateCancellationsToday: 1,
        },
      };
      state = resetDailyMetrics(state);
      expect(state.bookingMetrics.totalBookingsToday).toBe(0);
      expect(state.bookingMetrics.cancellationsToday).toBe(0);
      expect(state.bookingMetrics.noShowsToday).toBe(0);
      expect(state.bookingMetrics.lateCancellationsToday).toBe(0);
    });
  });
});
