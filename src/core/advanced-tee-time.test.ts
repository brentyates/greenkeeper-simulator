import { describe, it, expect } from 'vitest';
import {
  calculateDynamicMultiplier,
  calculateBookingRate,
  isPremiumSlot,
  canBookAsMember,
  canBookAsPublic,
  isMemberReservedSlot,
  countReservedMemberSlots,
  createInitialTournamentState,
  scheduleTournament,
  cancelTournament,
  isTournamentDay,
  getTournamentForDay,
  isCourseClosedForTournament,
  getAvailableSlotsForTournament,
  completeTournament,
  calculateTournamentPrestige,
  createInitialGroupBookingState,
  calculateGroupDiscount,
  calculateGroupTotal,
  calculateSlotsNeeded,
  createGroupBooking,
  confirmGroupBooking,
  cancelGroupBooking,
  completeGroupBooking,
  getGroupBookingsForDay,
  getActiveGroupBookings,
  createInitialAdvancedState,
  updateDynamicPricingConfig,
  updateMemberPriorityConfig,
  getAdvancedSummary,
  DEFAULT_DYNAMIC_PRICING,
  DEFAULT_MEMBER_PRIORITY,
  DEFAULT_GROUP_BOOKING,
  type DynamicPricingConfig,
  type MemberPriorityConfig,
  type TournamentConfig,
  type GroupBooking,
  type TeeTime,
  type TeeTimeSystemState,
} from './advanced-tee-time';
import { DEFAULT_GREEN_FEE_STRUCTURE } from './tee-revenue';

describe('advanced-tee-time', () => {
  describe('DEFAULT_DYNAMIC_PRICING', () => {
    it('has reasonable defaults', () => {
      expect(DEFAULT_DYNAMIC_PRICING.enabled).toBe(false);
      expect(DEFAULT_DYNAMIC_PRICING.minMultiplier).toBe(0.8);
      expect(DEFAULT_DYNAMIC_PRICING.maxMultiplier).toBe(1.3);
      expect(DEFAULT_DYNAMIC_PRICING.targetBookingRate).toBe(0.75);
    });
  });

  describe('calculateDynamicMultiplier', () => {
    it('returns 1.0 when disabled', () => {
      const config: DynamicPricingConfig = { ...DEFAULT_DYNAMIC_PRICING, enabled: false };
      expect(calculateDynamicMultiplier(config, 0.9)).toBe(1.0);
    });

    it('increases price when above target booking rate', () => {
      const config: DynamicPricingConfig = { ...DEFAULT_DYNAMIC_PRICING, enabled: true };
      const multiplier = calculateDynamicMultiplier(config, 0.95);
      expect(multiplier).toBeGreaterThan(1.0);
    });

    it('decreases price when below target booking rate', () => {
      const config: DynamicPricingConfig = { ...DEFAULT_DYNAMIC_PRICING, enabled: true };
      const multiplier = calculateDynamicMultiplier(config, 0.5);
      expect(multiplier).toBeLessThan(1.0);
    });

    it('clamps to min multiplier', () => {
      const config: DynamicPricingConfig = { ...DEFAULT_DYNAMIC_PRICING, enabled: true };
      const multiplier = calculateDynamicMultiplier(config, 0);
      expect(multiplier).toBe(0.8);
    });

    it('clamps to max multiplier', () => {
      const config: DynamicPricingConfig = { ...DEFAULT_DYNAMIC_PRICING, enabled: true };
      const multiplier = calculateDynamicMultiplier(config, 1.0);
      expect(multiplier).toBe(1.13);
    });
  });

  describe('calculateBookingRate', () => {
    it('returns 0 for empty slots', () => {
      const state = { todaySlots: [] } as unknown as TeeTimeSystemState;
      expect(calculateBookingRate(state)).toBe(0);
    });

    it('calculates correct booking rate', () => {
      const slots = [
        { status: 'available' },
        { status: 'reserved' },
        { status: 'checked_in' },
        { status: 'available' },
      ] as TeeTime[];
      const state = { todaySlots: slots } as TeeTimeSystemState;
      expect(calculateBookingRate(state)).toBe(0.5);
    });
  });

  describe('DEFAULT_MEMBER_PRIORITY', () => {
    it('has reasonable defaults', () => {
      expect(DEFAULT_MEMBER_PRIORITY.memberBookingDaysAdvance).toBe(14);
      expect(DEFAULT_MEMBER_PRIORITY.publicBookingDaysAdvance).toBe(7);
      expect(DEFAULT_MEMBER_PRIORITY.reservedMemberSlots).toBe(4);
    });
  });

  describe('isPremiumSlot', () => {
    it('returns true for prime morning hours', () => {
      expect(isPremiumSlot(DEFAULT_MEMBER_PRIORITY, 7)).toBe(true);
      expect(isPremiumSlot(DEFAULT_MEMBER_PRIORITY, 8)).toBe(true);
      expect(isPremiumSlot(DEFAULT_MEMBER_PRIORITY, 9)).toBe(true);
    });

    it('returns false for non-prime hours', () => {
      expect(isPremiumSlot(DEFAULT_MEMBER_PRIORITY, 6)).toBe(false);
      expect(isPremiumSlot(DEFAULT_MEMBER_PRIORITY, 10)).toBe(false);
      expect(isPremiumSlot(DEFAULT_MEMBER_PRIORITY, 14)).toBe(false);
    });
  });

  describe('canBookAsMember', () => {
    it('allows booking within member window', () => {
      expect(canBookAsMember(DEFAULT_MEMBER_PRIORITY, 1, 10)).toBe(true);
      expect(canBookAsMember(DEFAULT_MEMBER_PRIORITY, 1, 15)).toBe(true);
    });

    it('rejects booking outside member window', () => {
      expect(canBookAsMember(DEFAULT_MEMBER_PRIORITY, 1, 20)).toBe(false);
    });
  });

  describe('canBookAsPublic', () => {
    it('allows booking within public window', () => {
      expect(canBookAsPublic(DEFAULT_MEMBER_PRIORITY, 1, 5)).toBe(true);
      expect(canBookAsPublic(DEFAULT_MEMBER_PRIORITY, 1, 8)).toBe(true);
    });

    it('rejects booking outside public window', () => {
      expect(canBookAsPublic(DEFAULT_MEMBER_PRIORITY, 1, 10)).toBe(false);
    });
  });

  describe('isMemberReservedSlot', () => {
    const config: MemberPriorityConfig = { ...DEFAULT_MEMBER_PRIORITY, enabled: true };

    it('returns false when disabled', () => {
      const disabledConfig = { ...config, enabled: false };
      const slot = { id: '1', status: 'available', scheduledTime: { hour: 8, minute: 0 } } as TeeTime;
      expect(isMemberReservedSlot(slot, disabledConfig, [slot], 1, 10)).toBe(false);
    });

    it('returns false for non-premium slots', () => {
      const slot = { id: '1', status: 'available', scheduledTime: { hour: 14, minute: 0 } } as TeeTime;
      expect(isMemberReservedSlot(slot, config, [slot], 1, 10)).toBe(false);
    });

    it('returns true for first few premium slots when outside public window', () => {
      const slots = [
        { id: '1', status: 'available', scheduledTime: { hour: 7, minute: 0 } },
        { id: '2', status: 'available', scheduledTime: { hour: 7, minute: 10 } },
        { id: '3', status: 'available', scheduledTime: { hour: 8, minute: 0 } },
      ] as TeeTime[];
      expect(isMemberReservedSlot(slots[0], config, slots, 1, 10)).toBe(true);
      expect(isMemberReservedSlot(slots[1], config, slots, 1, 10)).toBe(true);
    });

    it('returns false when within public window', () => {
      const slot = { id: '1', status: 'available', scheduledTime: { hour: 8, minute: 0 } } as TeeTime;
      expect(isMemberReservedSlot(slot, config, [slot], 1, 5)).toBe(false);
    });
  });

  describe('countReservedMemberSlots', () => {
    it('counts available premium slots up to limit', () => {
      const slots = [
        { id: '1', status: 'available', scheduledTime: { hour: 7, minute: 0 } },
        { id: '2', status: 'available', scheduledTime: { hour: 8, minute: 0 } },
        { id: '3', status: 'reserved', scheduledTime: { hour: 9, minute: 0 } },
      ] as TeeTime[];
      expect(countReservedMemberSlots(slots, DEFAULT_MEMBER_PRIORITY)).toBe(2);
    });
  });

  describe('Tournament System', () => {
    describe('createInitialTournamentState', () => {
      it('creates empty state', () => {
        const state = createInitialTournamentState();
        expect(state.scheduledTournaments).toEqual([]);
        expect(state.completedTournaments).toEqual([]);
        expect(state.revenueFromTournaments).toBe(0);
      });
    });

    const sampleTournament: TournamentConfig = {
      id: 'club_champ_2024',
      name: 'Club Championship',
      type: 'club_championship',
      dayOfYear: 150,
      duration: 2,
      entryFee: 100,
      maxParticipants: 64,
      prestigeBonus: 50,
      courseClosedFully: true,
      teeTimesReserved: 0,
    };

    describe('scheduleTournament', () => {
      it('adds tournament to schedule', () => {
        const state = createInitialTournamentState();
        const result = scheduleTournament(state, sampleTournament);
        expect(result.scheduledTournaments).toHaveLength(1);
        expect(result.scheduledTournaments[0].id).toBe('club_champ_2024');
      });

      it('prevents duplicate tournaments', () => {
        const state = createInitialTournamentState();
        const result1 = scheduleTournament(state, sampleTournament);
        const result2 = scheduleTournament(result1, sampleTournament);
        expect(result2.scheduledTournaments).toHaveLength(1);
      });
    });

    describe('cancelTournament', () => {
      it('removes tournament from schedule', () => {
        const state = scheduleTournament(createInitialTournamentState(), sampleTournament);
        const result = cancelTournament(state, 'club_champ_2024');
        expect(result.scheduledTournaments).toHaveLength(0);
      });
    });

    describe('isTournamentDay', () => {
      it('returns true for tournament days', () => {
        const state = scheduleTournament(createInitialTournamentState(), sampleTournament);
        expect(isTournamentDay(state, 150)).toBe(true);
        expect(isTournamentDay(state, 151)).toBe(true);
      });

      it('returns false for non-tournament days', () => {
        const state = scheduleTournament(createInitialTournamentState(), sampleTournament);
        expect(isTournamentDay(state, 149)).toBe(false);
        expect(isTournamentDay(state, 152)).toBe(false);
      });
    });

    describe('getTournamentForDay', () => {
      it('returns tournament config for tournament day', () => {
        const state = scheduleTournament(createInitialTournamentState(), sampleTournament);
        const tournament = getTournamentForDay(state, 150);
        expect(tournament?.id).toBe('club_champ_2024');
      });

      it('returns undefined for non-tournament day', () => {
        const state = scheduleTournament(createInitialTournamentState(), sampleTournament);
        expect(getTournamentForDay(state, 100)).toBeUndefined();
      });
    });

    describe('isCourseClosedForTournament', () => {
      it('returns true when fully closed', () => {
        const state = scheduleTournament(createInitialTournamentState(), sampleTournament);
        expect(isCourseClosedForTournament(state, 150)).toBe(true);
      });

      it('returns false when not fully closed', () => {
        const partialTournament = { ...sampleTournament, courseClosedFully: false };
        const state = scheduleTournament(createInitialTournamentState(), partialTournament);
        expect(isCourseClosedForTournament(state, 150)).toBe(false);
      });
    });

    describe('getAvailableSlotsForTournament', () => {
      it('returns 0 for fully closed tournament', () => {
        expect(getAvailableSlotsForTournament([], sampleTournament)).toBe(0);
      });

      it('returns remaining slots for partial tournament', () => {
        const partialTournament = { ...sampleTournament, courseClosedFully: false, teeTimesReserved: 20 };
        const slots = new Array(50).fill({});
        expect(getAvailableSlotsForTournament(slots, partialTournament)).toBe(30);
      });
    });

    describe('completeTournament', () => {
      it('moves tournament to completed and calculates revenue', () => {
        const state = scheduleTournament(createInitialTournamentState(), sampleTournament);
        const result = completeTournament(state, sampleTournament, 50);
        expect(result.scheduledTournaments).toHaveLength(0);
        expect(result.completedTournaments).toContain('club_champ_2024');
        expect(result.revenueFromTournaments).toBe(5000);
        expect(result.participantsServed).toBe(50);
      });
    });

    describe('calculateTournamentPrestige', () => {
      it('calculates prestige based on participation', () => {
        const fullPrestige = calculateTournamentPrestige(sampleTournament, 64);
        expect(fullPrestige).toBe(75);

        const halfPrestige = calculateTournamentPrestige(sampleTournament, 32);
        expect(halfPrestige).toBe(50);
      });
    });
  });

  describe('Group Booking System', () => {
    describe('DEFAULT_GROUP_BOOKING', () => {
      it('has reasonable defaults', () => {
        expect(DEFAULT_GROUP_BOOKING.minGroupSize).toBe(8);
        expect(DEFAULT_GROUP_BOOKING.discountPercentage).toBe(15);
        expect(DEFAULT_GROUP_BOOKING.maxGroupSize).toBe(24);
      });
    });

    describe('createInitialGroupBookingState', () => {
      it('creates empty state with defaults', () => {
        const state = createInitialGroupBookingState();
        expect(state.bookings).toEqual([]);
        expect(state.config.minGroupSize).toBe(8);
      });

      it('accepts custom config', () => {
        const state = createInitialGroupBookingState({ minGroupSize: 12 });
        expect(state.config.minGroupSize).toBe(12);
      });
    });

    describe('calculateGroupDiscount', () => {
      it('returns 0 when disabled', () => {
        const config = { ...DEFAULT_GROUP_BOOKING, enabled: false };
        expect(calculateGroupDiscount(config, 12, 1000)).toBe(0);
      });

      it('returns 0 when below minimum size', () => {
        expect(calculateGroupDiscount(DEFAULT_GROUP_BOOKING, 6, 1000)).toBe(0);
      });

      it('calculates discount for qualifying groups', () => {
        expect(calculateGroupDiscount(DEFAULT_GROUP_BOOKING, 12, 1000)).toBe(150);
      });
    });

    describe('calculateGroupTotal', () => {
      it('calculates total with discount', () => {
        const result = calculateGroupTotal(
          DEFAULT_GROUP_BOOKING,
          DEFAULT_GREEN_FEE_STRUCTURE,
          12,
          false
        );
        expect(result.subtotal).toBe(540);
        expect(result.discount).toBe(81);
        expect(result.total).toBe(459);
        expect(result.deposit).toBe(114.75);
      });

      it('uses weekend rate when applicable', () => {
        const result = calculateGroupTotal(
          DEFAULT_GROUP_BOOKING,
          DEFAULT_GREEN_FEE_STRUCTURE,
          12,
          true
        );
        expect(result.subtotal).toBe(780);
      });
    });

    describe('calculateSlotsNeeded', () => {
      it('calculates slots for various group sizes', () => {
        expect(calculateSlotsNeeded(4)).toBe(1);
        expect(calculateSlotsNeeded(8)).toBe(2);
        expect(calculateSlotsNeeded(12)).toBe(3);
        expect(calculateSlotsNeeded(13)).toBe(4);
      });
    });

    describe('createGroupBooking', () => {
      it('adds booking to state', () => {
        const state = createInitialGroupBookingState();
        const booking: Omit<GroupBooking, 'status' | 'depositPaid' | 'totalPrice'> = {
          id: 'group_1',
          organizerName: 'John Doe',
          organizerContact: 'john@example.com',
          groupSize: 12,
          dayOfYear: 100,
          startTime: { day: 100, hour: 9, minute: 0 },
          discountApplied: 81,
          reservedSlotIds: [],
          notes: '',
        };
        const result = createGroupBooking(state, booking);
        expect(result.bookings).toHaveLength(1);
        expect(result.bookings[0].status).toBe('inquiry');
      });

      it('rejects groups larger than max', () => {
        const state = createInitialGroupBookingState();
        const booking: Omit<GroupBooking, 'status' | 'depositPaid' | 'totalPrice'> = {
          id: 'group_1',
          organizerName: 'John Doe',
          organizerContact: 'john@example.com',
          groupSize: 30,
          dayOfYear: 100,
          startTime: { day: 100, hour: 9, minute: 0 },
          discountApplied: 0,
          reservedSlotIds: [],
          notes: '',
        };
        const result = createGroupBooking(state, booking);
        expect(result.bookings).toHaveLength(0);
      });
    });

    describe('confirmGroupBooking', () => {
      it('updates status based on deposit', () => {
        let state = createInitialGroupBookingState();
        const booking: Omit<GroupBooking, 'status' | 'depositPaid' | 'totalPrice'> = {
          id: 'group_1',
          organizerName: 'John Doe',
          organizerContact: 'john@example.com',
          groupSize: 12,
          dayOfYear: 100,
          startTime: { day: 100, hour: 9, minute: 0 },
          discountApplied: 81,
          reservedSlotIds: [],
          notes: '',
        };
        state = createGroupBooking(state, booking);

        const confirmed = confirmGroupBooking(state, 'group_1', 459, 0);
        expect(confirmed.bookings[0].status).toBe('confirmed');

        const deposited = confirmGroupBooking(state, 'group_1', 459, 150);
        expect(deposited.bookings[0].status).toBe('deposit_paid');
      });
    });

    describe('cancelGroupBooking', () => {
      it('sets status to cancelled', () => {
        let state = createInitialGroupBookingState();
        const booking: Omit<GroupBooking, 'status' | 'depositPaid' | 'totalPrice'> = {
          id: 'group_1',
          organizerName: 'John Doe',
          organizerContact: 'john@example.com',
          groupSize: 12,
          dayOfYear: 100,
          startTime: { day: 100, hour: 9, minute: 0 },
          discountApplied: 81,
          reservedSlotIds: [],
          notes: '',
        };
        state = createGroupBooking(state, booking);

        const cancelled = cancelGroupBooking(state, 'group_1');
        expect(cancelled.bookings[0].status).toBe('cancelled');
      });
    });

    describe('completeGroupBooking', () => {
      it('updates totals and marks complete', () => {
        let state = createInitialGroupBookingState();
        const booking: Omit<GroupBooking, 'status' | 'depositPaid' | 'totalPrice'> = {
          id: 'group_1',
          organizerName: 'John Doe',
          organizerContact: 'john@example.com',
          groupSize: 12,
          dayOfYear: 100,
          startTime: { day: 100, hour: 9, minute: 0 },
          discountApplied: 81,
          reservedSlotIds: [],
          notes: '',
        };
        state = createGroupBooking(state, booking);
        state = confirmGroupBooking(state, 'group_1', 459, 459);

        const completed = completeGroupBooking(state, 'group_1');
        expect(completed.bookings[0].status).toBe('completed');
        expect(completed.totalGroupRevenue).toBe(459);
        expect(completed.groupsServed).toBe(1);
      });
    });

    describe('getGroupBookingsForDay', () => {
      it('returns bookings for specific day', () => {
        let state = createInitialGroupBookingState();
        const booking1: Omit<GroupBooking, 'status' | 'depositPaid' | 'totalPrice'> = {
          id: 'group_1',
          organizerName: 'John',
          organizerContact: 'john@example.com',
          groupSize: 12,
          dayOfYear: 100,
          startTime: { day: 100, hour: 9, minute: 0 },
          discountApplied: 0,
          reservedSlotIds: [],
          notes: '',
        };
        const booking2: Omit<GroupBooking, 'status' | 'depositPaid' | 'totalPrice'> = {
          id: 'group_2',
          organizerName: 'Jane',
          organizerContact: 'jane@example.com',
          groupSize: 8,
          dayOfYear: 101,
          startTime: { day: 101, hour: 10, minute: 0 },
          discountApplied: 0,
          reservedSlotIds: [],
          notes: '',
        };
        state = createGroupBooking(state, booking1);
        state = createGroupBooking(state, booking2);

        expect(getGroupBookingsForDay(state, 100)).toHaveLength(1);
        expect(getGroupBookingsForDay(state, 101)).toHaveLength(1);
        expect(getGroupBookingsForDay(state, 102)).toHaveLength(0);
      });

      it('excludes cancelled bookings', () => {
        let state = createInitialGroupBookingState();
        const booking: Omit<GroupBooking, 'status' | 'depositPaid' | 'totalPrice'> = {
          id: 'group_1',
          organizerName: 'John',
          organizerContact: 'john@example.com',
          groupSize: 12,
          dayOfYear: 100,
          startTime: { day: 100, hour: 9, minute: 0 },
          discountApplied: 0,
          reservedSlotIds: [],
          notes: '',
        };
        state = createGroupBooking(state, booking);
        state = cancelGroupBooking(state, 'group_1');

        expect(getGroupBookingsForDay(state, 100)).toHaveLength(0);
      });
    });

    describe('getActiveGroupBookings', () => {
      it('returns only active bookings', () => {
        let state = createInitialGroupBookingState();
        const booking1: Omit<GroupBooking, 'status' | 'depositPaid' | 'totalPrice'> = {
          id: 'group_1',
          organizerName: 'John',
          organizerContact: 'john@example.com',
          groupSize: 12,
          dayOfYear: 100,
          startTime: { day: 100, hour: 9, minute: 0 },
          discountApplied: 0,
          reservedSlotIds: [],
          notes: '',
        };
        const booking2: Omit<GroupBooking, 'status' | 'depositPaid' | 'totalPrice'> = {
          id: 'group_2',
          organizerName: 'Jane',
          organizerContact: 'jane@example.com',
          groupSize: 8,
          dayOfYear: 101,
          startTime: { day: 101, hour: 10, minute: 0 },
          discountApplied: 0,
          reservedSlotIds: [],
          notes: '',
        };
        state = createGroupBooking(state, booking1);
        state = createGroupBooking(state, booking2);
        state = cancelGroupBooking(state, 'group_1');

        expect(getActiveGroupBookings(state)).toHaveLength(1);
        expect(getActiveGroupBookings(state)[0].id).toBe('group_2');
      });
    });
  });

  describe('AdvancedTeeTimeState', () => {
    describe('createInitialAdvancedState', () => {
      it('creates state with all subsystems', () => {
        const state = createInitialAdvancedState();
        expect(state.dynamicPricing).toBeDefined();
        expect(state.memberPriority).toBeDefined();
        expect(state.tournaments).toBeDefined();
        expect(state.groupBookings).toBeDefined();
      });
    });

    describe('updateDynamicPricingConfig', () => {
      it('updates dynamic pricing config', () => {
        const state = createInitialAdvancedState();
        const updated = updateDynamicPricingConfig(state, { enabled: true, maxMultiplier: 1.5 });
        expect(updated.dynamicPricing.enabled).toBe(true);
        expect(updated.dynamicPricing.maxMultiplier).toBe(1.5);
        expect(updated.dynamicPricing.minMultiplier).toBe(0.8);
      });
    });

    describe('updateMemberPriorityConfig', () => {
      it('updates member priority config', () => {
        const state = createInitialAdvancedState();
        const updated = updateMemberPriorityConfig(state, { enabled: true, reservedMemberSlots: 8 });
        expect(updated.memberPriority.enabled).toBe(true);
        expect(updated.memberPriority.reservedMemberSlots).toBe(8);
      });
    });

    describe('getAdvancedSummary', () => {
      it('returns summary of all features', () => {
        let state = createInitialAdvancedState();
        state = updateDynamicPricingConfig(state, { enabled: true });

        const summary = getAdvancedSummary(state);
        expect(summary.dynamicPricingEnabled).toBe(true);
        expect(summary.memberPriorityEnabled).toBe(false);
        expect(summary.scheduledTournaments).toBe(0);
        expect(summary.activeGroupBookings).toBe(0);
      });
    });
  });
});
