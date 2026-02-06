import { describe, it, expect } from 'vitest';
import {
  DEFAULT_OPERATING_HOURS,
  DEFAULT_BOOKING_CONFIG,
  DAY_OF_WEEK_MULTIPLIERS,
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
  getDayOfWeek,
  getTimeOfDayMultiplier,
  getSeasonMultiplier,
  calculateSlotDemand,
  selectGroupSize,
  canBookSlot,
  isLateCancellation,
  calculateCancellationPenalty,
  calculateNoShowPenalty,
  simulateDailyBookings,
  applyBookingSimulation,
  resetDailyMetrics,
  updateBookingConfig,
  PACE_RATING_THRESHOLDS,
  PACE_SATISFACTION_PENALTIES,
  SKILL_TIME_PENALTIES,
  getPaceRating,
  calculateSkillPenalty,
  calculateWaitTime,
  calculatePaceOfPlay,
  calculatePaceOfPlayDeterministic,
  previewSpacingImpact,
  getPaceRatingLabel,
  formatRoundTime,
  identifyBackupLocations,
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

    it('searches across multiple days to find tee time', () => {
      const state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      getTeeTimes(state, 76);
      const slot = getTeeTimeById(state, 'tt-76-0600');
      expect(slot).toBeDefined();
      expect(slot?.scheduledTime.hour).toBe(6);
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

      const slot = getTeeTimeById(state, 'tt-75-0600');
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

    it('returns unchanged state for invalid tee time id', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      const beforeState = state;
      state = checkInTeeTime(state, 'invalid-id');
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

    it('does not start round for non-checked-in slot', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      state = bookTeeTime(state, 'tt-75-0600', [
        { golferId: 'g1', name: 'Test', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] }
      ], 'reservation', { day: 0, hour: 8, minute: 0 });
      const beforeState = state;
      state = startRound(state, 'tt-75-0600', { day: 75, hour: 6, minute: 5 });
      expect(state).toBe(beforeState);
    });

    it('returns unchanged state for invalid tee time id', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      const beforeState = state;
      state = startRound(state, 'invalid-id', { day: 75, hour: 6, minute: 5 });
      expect(state).toBe(beforeState);
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

    it('does not complete round not in progress', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      state = bookTeeTime(state, 'tt-75-0600', [
        { golferId: 'g1', name: 'Test', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] }
      ], 'reservation', { day: 0, hour: 8, minute: 0 });
      state = checkInTeeTime(state, 'tt-75-0600');
      const beforeState = state;
      state = completeRound(state, 'tt-75-0600', { day: 75, hour: 10, minute: 15 });
      expect(state).toBe(beforeState);
    });

    it('returns unchanged state for invalid tee time id', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      const beforeState = state;
      state = completeRound(state, 'invalid-id', { day: 75, hour: 10, minute: 15 });
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

      const slot = getTeeTimeById(state, 'tt-75-0600');
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

      const slot = getTeeTimeById(state, 'tt-75-0600');
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

    it('returns zero booking rate when no slots exist', () => {
      let state = createInitialTeeTimeState();
      state = updateOperatingHours(state, {
        summerHours: { open: 18, close: 20, lastTee: 6 },
      });
      const stats = getDailyStats(state, 150);
      expect(stats.totalSlots).toBe(0);
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

    it('tracks in_progress rounds', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      state = bookTeeTime(state, 'tt-75-0600', [
        { golferId: 'g1', name: 'A', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] },
      ], 'reservation', { day: 0, hour: 8, minute: 0 });
      state = checkInTeeTime(state, 'tt-75-0600');
      state = startRound(state, 'tt-75-0600', { day: 75, hour: 6, minute: 0 });

      const stats = getDailyStats(state, 75);
      expect(stats.inProgress).toBe(1);
      expect(stats.totalGolfers).toBe(1);
      expect(stats.totalRevenue).toBe(70);
    });

    it('tracks completed rounds', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      state = bookTeeTime(state, 'tt-75-0600', [
        { golferId: 'g1', name: 'A', membershipStatus: 'public', greenFee: 50, cartFee: 20, addOns: [] },
      ], 'reservation', { day: 0, hour: 8, minute: 0 });
      state = checkInTeeTime(state, 'tt-75-0600');
      state = startRound(state, 'tt-75-0600', { day: 75, hour: 6, minute: 0 });
      state = completeRound(state, 'tt-75-0600', { day: 75, hour: 10, minute: 0 });

      const stats = getDailyStats(state, 75);
      expect(stats.completed).toBe(1);
      expect(stats.totalGolfers).toBe(1);
      expect(stats.totalRevenue).toBe(70);
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

  describe('DEFAULT_BOOKING_CONFIG', () => {
    it('has correct default values', () => {
      expect(DEFAULT_BOOKING_CONFIG.publicBookingDays).toBe(7);
      expect(DEFAULT_BOOKING_CONFIG.memberBookingDays).toBe(14);
      expect(DEFAULT_BOOKING_CONFIG.freeCancellationHours).toBe(24);
      expect(DEFAULT_BOOKING_CONFIG.lateCancelPenalty).toBe(0.5);
      expect(DEFAULT_BOOKING_CONFIG.noShowPenalty).toBe(1.0);
      expect(DEFAULT_BOOKING_CONFIG.noShowCountForBlacklist).toBe(3);
    });
  });

  describe('DAY_OF_WEEK_MULTIPLIERS', () => {
    it('has weekend days higher than weekdays', () => {
      expect(DAY_OF_WEEK_MULTIPLIERS[6]).toBeGreaterThan(DAY_OF_WEEK_MULTIPLIERS[1]); // Saturday > Monday
      expect(DAY_OF_WEEK_MULTIPLIERS[0]).toBeGreaterThan(DAY_OF_WEEK_MULTIPLIERS[2]); // Sunday > Tuesday
    });

    it('has Saturday as highest demand', () => {
      expect(DAY_OF_WEEK_MULTIPLIERS[6]).toBe(1.4);
    });

    it('has Monday as lowest demand', () => {
      expect(DAY_OF_WEEK_MULTIPLIERS[1]).toBe(0.7);
    });
  });

  describe('getDayOfWeek', () => {
    it('returns correct day of week', () => {
      expect(getDayOfWeek(0)).toBe(0); // Sunday
      expect(getDayOfWeek(1)).toBe(1); // Monday
      expect(getDayOfWeek(6)).toBe(6); // Saturday
      expect(getDayOfWeek(7)).toBe(0); // Sunday (next week)
      expect(getDayOfWeek(8)).toBe(1); // Monday (next week)
    });
  });

  describe('getTimeOfDayMultiplier', () => {
    it('returns early bird rate for before 7am', () => {
      expect(getTimeOfDayMultiplier(5)).toBe(0.6);
      expect(getTimeOfDayMultiplier(6)).toBe(0.6);
    });

    it('returns prime morning rate for 7-10am', () => {
      expect(getTimeOfDayMultiplier(7)).toBe(1.3);
      expect(getTimeOfDayMultiplier(9)).toBe(1.3);
    });

    it('returns late morning rate for 10-12', () => {
      expect(getTimeOfDayMultiplier(10)).toBe(1.1);
      expect(getTimeOfDayMultiplier(11)).toBe(1.1);
    });

    it('returns midday rate for 12-14', () => {
      expect(getTimeOfDayMultiplier(12)).toBe(0.9);
      expect(getTimeOfDayMultiplier(13)).toBe(0.9);
    });

    it('returns afternoon rate for 14-16', () => {
      expect(getTimeOfDayMultiplier(14)).toBe(1.0);
      expect(getTimeOfDayMultiplier(15)).toBe(1.0);
    });

    it('returns twilight rate for 16+', () => {
      expect(getTimeOfDayMultiplier(16)).toBe(0.7);
      expect(getTimeOfDayMultiplier(18)).toBe(0.7);
    });
  });

  describe('getSeasonMultiplier', () => {
    it('returns high season multiplier for summer', () => {
      expect(getSeasonMultiplier(100)).toBe(1.2); // April
      expect(getSeasonMultiplier(200)).toBe(1.2); // July
    });

    it('returns low season multiplier for winter', () => {
      expect(getSeasonMultiplier(30)).toBe(0.6);  // January
      expect(getSeasonMultiplier(350)).toBe(0.6); // December
    });

    it('returns normal multiplier for spring/fall', () => {
      expect(getSeasonMultiplier(75)).toBe(1.0);  // Mid-March
      expect(getSeasonMultiplier(285)).toBe(1.0); // October
    });
  });

  describe('calculateSlotDemand', () => {
    it('calculates demand with default factors', () => {
      const slot = generateDailySlots(75, SPACING_CONFIGS.standard, DEFAULT_OPERATING_HOURS)[0];
      const demand = calculateSlotDemand(slot, 75);
      expect(demand.baseDemand).toBe(0.5);
      expect(demand.bookingProbability).toBeGreaterThan(0);
      expect(demand.bookingProbability).toBeLessThanOrEqual(1);
    });

    it('uses prestige to modify demand', () => {
      const slot = generateDailySlots(75, SPACING_CONFIGS.standard, DEFAULT_OPERATING_HOURS)[0];
      const lowPrestige = calculateSlotDemand(slot, 75, { prestigeScore: 100 });
      const highPrestige = calculateSlotDemand(slot, 75, { prestigeScore: 900 });
      expect(highPrestige.bookingProbability).toBeGreaterThan(lowPrestige.bookingProbability);
    });

    it('uses weather to modify demand', () => {
      const slot = generateDailySlots(75, SPACING_CONFIGS.standard, DEFAULT_OPERATING_HOURS)[0];
      const perfectWeather = calculateSlotDemand(slot, 75, { weatherCondition: 'perfect' });
      const badWeather = calculateSlotDemand(slot, 75, { weatherCondition: 'bad' });
      expect(perfectWeather.bookingProbability).toBeGreaterThan(badWeather.bookingProbability);
    });

    it('caps booking probability at 1.0', () => {
      const slot = generateDailySlots(75, SPACING_CONFIGS.standard, DEFAULT_OPERATING_HOURS)[0];
      const demand = calculateSlotDemand(slot, 75, {
        baseDemand: 5.0,
        prestigeScore: 1000,
        weatherCondition: 'perfect',
      });
      expect(demand.bookingProbability).toBe(1.0);
    });

    it('uses default weather multiplier for unknown weather condition', () => {
      const slot = generateDailySlots(75, SPACING_CONFIGS.standard, DEFAULT_OPERATING_HOURS)[0];
      const demand = calculateSlotDemand(slot, 75, { weatherCondition: 'unknown_weather' as any });
      expect(demand.weatherMultiplier).toBe(1.0);
    });

    it('reduces demand for high pricing ratio', () => {
      const slot = generateDailySlots(75, SPACING_CONFIGS.standard, DEFAULT_OPERATING_HOURS)[0];
      const normalPricing = calculateSlotDemand(slot, 75, { pricingRatio: 1.0 });
      const highPricing = calculateSlotDemand(slot, 75, { pricingRatio: 2.0 });
      expect(highPricing.pricingMultiplier).toBeLessThan(normalPricing.pricingMultiplier);
    });
  });

  describe('selectGroupSize', () => {
    it('returns singles for low random values', () => {
      expect(selectGroupSize(0.02)).toBe(1);
    });

    it('returns twosomes for values between 0.05-0.15', () => {
      expect(selectGroupSize(0.10)).toBe(2);
    });

    it('returns threesomes for values between 0.15-0.30', () => {
      expect(selectGroupSize(0.25)).toBe(3);
    });

    it('returns foursomes for values above 0.30', () => {
      expect(selectGroupSize(0.50)).toBe(4);
      expect(selectGroupSize(0.99)).toBe(4);
    });
  });

  describe('canBookSlot', () => {
    it('allows public to book within 7 days', () => {
      const state = createInitialTeeTimeState();
      expect(canBookSlot(state, 5, 0, 'public')).toBe(true);
      expect(canBookSlot(state, 7, 0, 'public')).toBe(true);
    });

    it('prevents public from booking beyond 7 days', () => {
      const state = createInitialTeeTimeState();
      expect(canBookSlot(state, 8, 0, 'public')).toBe(false);
      expect(canBookSlot(state, 14, 0, 'public')).toBe(false);
    });

    it('allows members to book within 14 days', () => {
      const state = createInitialTeeTimeState();
      expect(canBookSlot(state, 10, 0, 'member')).toBe(true);
      expect(canBookSlot(state, 14, 0, 'member')).toBe(true);
    });

    it('prevents members from booking beyond 14 days', () => {
      const state = createInitialTeeTimeState();
      expect(canBookSlot(state, 15, 0, 'member')).toBe(false);
    });

    it('prevents same-day booking', () => {
      const state = createInitialTeeTimeState();
      expect(canBookSlot(state, 5, 5, 'public')).toBe(false);
      expect(canBookSlot(state, 5, 5, 'member')).toBe(false);
    });
  });

  describe('isLateCancellation', () => {
    it('returns true when cancelling within free cancellation window', () => {
      const teeTime = {
        id: 'tt-1-0800',
        scheduledTime: { day: 1, hour: 8, minute: 0 },
        groupSize: 4,
        status: 'reserved' as const,
        bookingType: 'reservation' as const,
        golfers: [],
        pricePerGolfer: 70,
        totalRevenue: 280,
        checkedIn: false,
        roundCompleted: false,
      };
      const currentTime = { day: 1, hour: 6, minute: 0 };
      expect(isLateCancellation(teeTime, currentTime, DEFAULT_BOOKING_CONFIG)).toBe(true);
    });

    it('returns false when cancelling with plenty of time', () => {
      const teeTime = {
        id: 'tt-2-0800',
        scheduledTime: { day: 2, hour: 8, minute: 0 },
        groupSize: 4,
        status: 'reserved' as const,
        bookingType: 'reservation' as const,
        golfers: [],
        pricePerGolfer: 70,
        totalRevenue: 280,
        checkedIn: false,
        roundCompleted: false,
      };
      const currentTime = { day: 0, hour: 6, minute: 0 };
      expect(isLateCancellation(teeTime, currentTime, DEFAULT_BOOKING_CONFIG)).toBe(false);
    });
  });

  describe('calculateCancellationPenalty', () => {
    it('returns 0 for early cancellation', () => {
      const teeTime = {
        id: 'tt-2-0800',
        scheduledTime: { day: 2, hour: 8, minute: 0 },
        groupSize: 4,
        status: 'reserved' as const,
        bookingType: 'reservation' as const,
        golfers: [],
        pricePerGolfer: 70,
        totalRevenue: 280,
        checkedIn: false,
        roundCompleted: false,
      };
      const currentTime = { day: 0, hour: 6, minute: 0 };
      expect(calculateCancellationPenalty(teeTime, currentTime, DEFAULT_BOOKING_CONFIG)).toBe(0);
    });

    it('returns 50% for late cancellation', () => {
      const teeTime = {
        id: 'tt-1-0800',
        scheduledTime: { day: 1, hour: 8, minute: 0 },
        groupSize: 4,
        status: 'reserved' as const,
        bookingType: 'reservation' as const,
        golfers: [],
        pricePerGolfer: 70,
        totalRevenue: 280,
        checkedIn: false,
        roundCompleted: false,
      };
      const currentTime = { day: 1, hour: 6, minute: 0 };
      expect(calculateCancellationPenalty(teeTime, currentTime, DEFAULT_BOOKING_CONFIG)).toBe(140);
    });
  });

  describe('calculateNoShowPenalty', () => {
    it('returns full amount for no-show', () => {
      const teeTime = {
        id: 'tt-1-0800',
        scheduledTime: { day: 1, hour: 8, minute: 0 },
        groupSize: 4,
        status: 'reserved' as const,
        bookingType: 'reservation' as const,
        golfers: [],
        pricePerGolfer: 70,
        totalRevenue: 280,
        checkedIn: false,
        roundCompleted: false,
      };
      expect(calculateNoShowPenalty(teeTime, DEFAULT_BOOKING_CONFIG)).toBe(280);
    });
  });

  describe('simulateDailyBookings', () => {
    it('creates bookings based on demand', () => {
      const state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      const result = simulateDailyBookings(
        state,
        75,
        74,
        { baseDemand: 1.0 },
        50,
        20,
        () => 0.1
      );
      expect(result.newBookings.length).toBeGreaterThan(0);
      expect(result.totalNewRevenue).toBeGreaterThan(0);
    });

    it('creates no bookings when random is high', () => {
      const state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      const result = simulateDailyBookings(
        state,
        75,
        74,
        { baseDemand: 0.1 },
        50,
        20,
        () => 0.99
      );
      expect(result.newBookings.length).toBe(0);
      expect(result.totalNewRevenue).toBe(0);
    });

    it('uses correct green and cart fees', () => {
      const state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      const result = simulateDailyBookings(
        state,
        75,
        74,
        { baseDemand: 1.0 },
        100,
        30,
        () => 0.01
      );
      expect(result.newBookings.length).toBeGreaterThan(0);
      const booking = result.newBookings[0];
      expect(booking.golfers[0].greenFee).toBe(100);
      expect(booking.golfers[0].cartFee).toBe(30);
    });
  });

  describe('applyBookingSimulation', () => {
    it('updates state with new bookings', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      const simulation = simulateDailyBookings(
        state,
        75,
        74,
        { baseDemand: 1.0 },
        50,
        20,
        () => 0.01
      );
      state = applyBookingSimulation(state, simulation, 75);
      const booked = getBookedSlots(state, 75);
      expect(booked.length).toBeGreaterThan(0);
    });

    it('updates booking metrics', () => {
      let state = createInitialTeeTimeState();
      getTeeTimes(state, 75);
      const simulation = simulateDailyBookings(
        state,
        75,
        74,
        { baseDemand: 1.0 },
        50,
        20,
        () => 0.01
      );
      state = applyBookingSimulation(state, simulation, 75);
      expect(state.bookingMetrics.totalBookingsToday).toBeGreaterThan(0);
    });

    it('preserves unbooked slots when simulation has partial bookings', () => {
      let state = createInitialTeeTimeState();
      const slots = getTeeTimes(state, 75);
      const totalSlots = slots.length;

      const simulation = simulateDailyBookings(
        state,
        75,
        74,
        { baseDemand: 0.1 },
        50,
        20,
        () => 0.5
      );
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

  describe('updateBookingConfig', () => {
    it('updates booking configuration', () => {
      let state = createInitialTeeTimeState();
      state = updateBookingConfig(state, { publicBookingDays: 14 });
      expect(state.bookingConfig.publicBookingDays).toBe(14);
      expect(state.bookingConfig.memberBookingDays).toBe(14);
    });

    it('preserves unmodified config values', () => {
      let state = createInitialTeeTimeState();
      state = updateBookingConfig(state, { noShowPenalty: 0.75 });
      expect(state.bookingConfig.noShowPenalty).toBe(0.75);
      expect(state.bookingConfig.publicBookingDays).toBe(7);
      expect(state.bookingConfig.freeCancellationHours).toBe(24);
    });
  });

  describe('PACE_RATING_THRESHOLDS', () => {
    it('has correct threshold values', () => {
      expect(PACE_RATING_THRESHOLDS.excellent).toBe(3.75);
      expect(PACE_RATING_THRESHOLDS.good).toBe(4.25);
      expect(PACE_RATING_THRESHOLDS.acceptable).toBe(4.75);
      expect(PACE_RATING_THRESHOLDS.slow).toBe(5.5);
    });
  });

  describe('PACE_SATISFACTION_PENALTIES', () => {
    it('has no penalty for good pace', () => {
      expect(PACE_SATISFACTION_PENALTIES.excellent).toBe(0);
      expect(PACE_SATISFACTION_PENALTIES.good).toBe(0);
    });

    it('has increasing penalties for slow pace', () => {
      expect(PACE_SATISFACTION_PENALTIES.acceptable).toBeLessThan(0);
      expect(PACE_SATISFACTION_PENALTIES.slow).toBeLessThan(PACE_SATISFACTION_PENALTIES.acceptable);
      expect(PACE_SATISFACTION_PENALTIES.terrible).toBeLessThan(PACE_SATISFACTION_PENALTIES.slow);
    });
  });

  describe('SKILL_TIME_PENALTIES', () => {
    it('has positive penalty for beginners', () => {
      expect(SKILL_TIME_PENALTIES.beginner).toBeGreaterThan(0);
    });

    it('has no penalty for advanced', () => {
      expect(SKILL_TIME_PENALTIES.advanced).toBe(0);
    });

    it('has negative penalty for experts', () => {
      expect(SKILL_TIME_PENALTIES.expert).toBeLessThan(0);
    });
  });

  describe('getPaceRating', () => {
    it('returns excellent for fast rounds', () => {
      expect(getPaceRating(3.5)).toBe('excellent');
      expect(getPaceRating(3.75)).toBe('excellent');
    });

    it('returns good for normal rounds', () => {
      expect(getPaceRating(4.0)).toBe('good');
      expect(getPaceRating(4.25)).toBe('good');
    });

    it('returns acceptable for slightly slow rounds', () => {
      expect(getPaceRating(4.5)).toBe('acceptable');
      expect(getPaceRating(4.75)).toBe('acceptable');
    });

    it('returns slow for slow rounds', () => {
      expect(getPaceRating(5.0)).toBe('slow');
      expect(getPaceRating(5.5)).toBe('slow');
    });

    it('returns terrible for very slow rounds', () => {
      expect(getPaceRating(6.0)).toBe('terrible');
      expect(getPaceRating(7.0)).toBe('terrible');
    });
  });

  describe('calculateSkillPenalty', () => {
    it('returns 0 for empty distribution', () => {
      expect(calculateSkillPenalty({ beginner: 0, intermediate: 0, advanced: 0, expert: 0 })).toBe(0);
    });

    it('returns high penalty for all beginners', () => {
      const penalty = calculateSkillPenalty({ beginner: 100, intermediate: 0, advanced: 0, expert: 0 });
      expect(penalty).toBe(0.5);
    });

    it('returns negative penalty for all experts', () => {
      const penalty = calculateSkillPenalty({ beginner: 0, intermediate: 0, advanced: 0, expert: 100 });
      expect(penalty).toBe(-0.1);
    });

    it('returns weighted average for mixed skill', () => {
      const penalty = calculateSkillPenalty({ beginner: 25, intermediate: 25, advanced: 25, expert: 25 });
      expect(penalty).toBeCloseTo((0.5 + 0.15 + 0 + -0.1) / 4, 5);
    });
  });

  describe('calculateWaitTime', () => {
    it('returns 0 for good pace', () => {
      expect(calculateWaitTime(4.0, SPACING_CONFIGS.standard)).toBe(0);
      expect(calculateWaitTime(3.5, SPACING_CONFIGS.standard)).toBe(0);
    });

    it('returns wait time for slow pace', () => {
      const wait = calculateWaitTime(5.0, SPACING_CONFIGS.standard);
      expect(wait).toBeGreaterThan(0);
    });

    it('returns higher wait time for packed spacing', () => {
      const standardWait = calculateWaitTime(5.0, SPACING_CONFIGS.standard);
      const packedWait = calculateWaitTime(5.0, SPACING_CONFIGS.packed);
      expect(packedWait).toBeGreaterThan(standardWait);
    });
  });

  describe('identifyBackupLocations', () => {
    it('returns empty array for fast round time', () => {
      const backups = identifyBackupLocations(3.5, SPACING_CONFIGS.standard);
      expect(backups).toEqual([]);
    });

    it('returns empty array for exactly 4.0 round time', () => {
      const backups = identifyBackupLocations(4.0, SPACING_CONFIGS.standard);
      expect(backups).toEqual([]);
    });

    it('may return backup locations for slow round time', () => {
      const originalRandom = Math.random;
      Math.random = () => 0.1;
      try {
        const backups = identifyBackupLocations(6.0, SPACING_CONFIGS.packed);
        expect(Array.isArray(backups)).toBe(true);
        expect(backups.length).toBeGreaterThan(0);
      } finally {
        Math.random = originalRandom;
      }
    });
  });

  describe('calculatePaceOfPlayDeterministic', () => {
    it('calculates base round time with standard spacing', () => {
      const pace = calculatePaceOfPlayDeterministic(SPACING_CONFIGS.standard, 0.5, 80);
      expect(pace.targetRoundTime).toBe(4.0);
      expect(pace.averageRoundTime).toBeGreaterThan(4.0); // skill mix adds time
    });

    it('packed spacing adds significant time', () => {
      const standard = calculatePaceOfPlayDeterministic(SPACING_CONFIGS.standard, 0.5, 80);
      const packed = calculatePaceOfPlayDeterministic(SPACING_CONFIGS.packed, 0.5, 80);
      expect(packed.averageRoundTime).toBeGreaterThan(standard.averageRoundTime);
    });

    it('exclusive spacing reduces time', () => {
      const standard = calculatePaceOfPlayDeterministic(SPACING_CONFIGS.standard, 0.5, 80);
      const exclusive = calculatePaceOfPlayDeterministic(SPACING_CONFIGS.exclusive, 0.5, 80);
      expect(exclusive.averageRoundTime).toBeLessThan(standard.averageRoundTime);
    });

    it('high capacity adds time', () => {
      const lowCapacity = calculatePaceOfPlayDeterministic(SPACING_CONFIGS.standard, 0.5, 80);
      const highCapacity = calculatePaceOfPlayDeterministic(SPACING_CONFIGS.standard, 0.95, 80);
      expect(highCapacity.averageRoundTime).toBeGreaterThan(lowCapacity.averageRoundTime);
    });

    it('poor conditions add time', () => {
      const goodConditions = calculatePaceOfPlayDeterministic(SPACING_CONFIGS.standard, 0.5, 80);
      const poorConditions = calculatePaceOfPlayDeterministic(SPACING_CONFIGS.standard, 0.5, 30);
      expect(poorConditions.averageRoundTime).toBeGreaterThan(goodConditions.averageRoundTime);
    });

    it('includes satisfaction penalty for slow pace', () => {
      const pace = calculatePaceOfPlayDeterministic(SPACING_CONFIGS.packed, 0.95, 30);
      expect(pace.paceRating).toBe('slow');
      expect(pace.satisfactionPenalty).toBeLessThan(0);
    });
  });

  describe('calculatePaceOfPlay', () => {
    it('returns full pace state including backup locations', () => {
      const pace = calculatePaceOfPlay(SPACING_CONFIGS.standard, 0.5, 80);
      expect(pace.targetRoundTime).toBe(4.0);
      expect(pace.averageRoundTime).toBeGreaterThan(0);
      expect(Array.isArray(pace.backupLocations)).toBe(true);
      expect(typeof pace.waitTimeMinutes).toBe('number');
      expect(pace.paceRating).toBeDefined();
      expect(typeof pace.satisfactionPenalty).toBe('number');
    });

    it('adds time for high capacity above 0.8', () => {
      const lowCapacity = calculatePaceOfPlay(SPACING_CONFIGS.standard, 0.5, 80);
      const highCapacity = calculatePaceOfPlay(SPACING_CONFIGS.standard, 0.95, 80);
      expect(highCapacity.averageRoundTime).toBeGreaterThan(lowCapacity.averageRoundTime);
    });

    it('adds time for poor course conditions below 50', () => {
      const goodConditions = calculatePaceOfPlay(SPACING_CONFIGS.standard, 0.5, 80);
      const poorConditions = calculatePaceOfPlay(SPACING_CONFIGS.standard, 0.5, 30);
      expect(poorConditions.averageRoundTime).toBeGreaterThan(goodConditions.averageRoundTime);
    });
  });

  describe('previewSpacingImpact', () => {
    it('returns preview for standard spacing', () => {
      const preview = previewSpacingImpact('standard');
      expect(preview.maxDailyTeeTimes).toBe(60);
      expect(preview.revenueMultiplier).toBe(1.0);
      expect(preview.reputationImpact).toBe(0);
      expect(preview.backupRisk).toBe('medium');
    });

    it('returns higher revenue for packed spacing', () => {
      const preview = previewSpacingImpact('packed');
      expect(preview.revenueMultiplier).toBeGreaterThan(1.0);
      expect(preview.backupRisk).toBe('very_high');
      expect(preview.reputationImpact).toBeLessThan(0);
    });

    it('returns better reputation for exclusive spacing', () => {
      const preview = previewSpacingImpact('exclusive');
      expect(preview.revenueMultiplier).toBeLessThan(1.0);
      expect(preview.backupRisk).toBe('low');
      expect(preview.reputationImpact).toBeGreaterThan(0);
    });

    it('returns high backup risk for tight spacing', () => {
      const preview = previewSpacingImpact('tight');
      expect(preview.backupRisk).toBe('high');
      expect(preview.reputationImpact).toBeLessThan(0);
    });
  });

  describe('getPaceRatingLabel', () => {
    it('returns correct labels', () => {
      expect(getPaceRatingLabel('excellent')).toContain('Excellent');
      expect(getPaceRatingLabel('good')).toContain('Good');
      expect(getPaceRatingLabel('acceptable')).toContain('Acceptable');
      expect(getPaceRatingLabel('slow')).toContain('Slow');
      expect(getPaceRatingLabel('terrible')).toContain('Very Slow');
    });
  });

  describe('formatRoundTime', () => {
    it('formats 4 hours correctly', () => {
      expect(formatRoundTime(4.0)).toBe('4:00');
    });

    it('formats 4.5 hours correctly', () => {
      expect(formatRoundTime(4.5)).toBe('4:30');
    });

    it('formats 5.25 hours correctly', () => {
      expect(formatRoundTime(5.25)).toBe('5:15');
    });

    it('formats short rounds correctly', () => {
      expect(formatRoundTime(3.75)).toBe('3:45');
    });
  });
});
