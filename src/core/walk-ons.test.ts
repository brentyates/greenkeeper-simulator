import { describe, it, expect } from 'vitest';
import {
  DEFAULT_WALK_ON_POLICY,
  createInitialWalkOnState,
  createWalkOnGolfer,
  calculateWaitMinutes,
  addWalkOnToQueue,
  findSuitableSlot,
  processWalkOns,
  updateWalkOnPolicy,
  resetDailyWalkOnMetrics,
  clearQueue,
  getQueueLength,
  getEstimatedWaitTime,
  getWalkOnSummary,
} from './walk-ons';
import type { TeeTime, GameTime } from './tee-times';

function createTestSlot(id: string, hour: number, minute: number = 0, day: number = 75): TeeTime {
  return {
    id,
    scheduledTime: { day, hour, minute },
    groupSize: 0,
    status: 'available',
    bookingType: 'reservation',
    golfers: [],
    pricePerGolfer: 0,
    totalRevenue: 0,
    checkedIn: false,
    roundCompleted: false,
  };
}

describe('walk-ons', () => {
  describe('DEFAULT_WALK_ON_POLICY', () => {
    it('has correct default values', () => {
      expect(DEFAULT_WALK_ON_POLICY.allowWalkOns).toBe(true);
      expect(DEFAULT_WALK_ON_POLICY.reserveWalkOnSlots).toBe(1);
      expect(DEFAULT_WALK_ON_POLICY.walkOnPremium).toBe(1.1);
      expect(DEFAULT_WALK_ON_POLICY.walkOnDiscount).toBe(0.9);
      expect(DEFAULT_WALK_ON_POLICY.maxQueueSize).toBe(12);
      expect(DEFAULT_WALK_ON_POLICY.maxWaitMinutes).toBe(45);
    });
  });

  describe('createInitialWalkOnState', () => {
    it('creates state with default policy', () => {
      const state = createInitialWalkOnState();
      expect(state.policy.allowWalkOns).toBe(true);
      expect(state.queue).toHaveLength(0);
      expect(state.metrics.walkOnsServedToday).toBe(0);
    });

    it('allows policy overrides', () => {
      const state = createInitialWalkOnState({ allowWalkOns: false, maxQueueSize: 20 });
      expect(state.policy.allowWalkOns).toBe(false);
      expect(state.policy.maxQueueSize).toBe(20);
      expect(state.policy.walkOnPremium).toBe(1.1);
    });

    it('starts with zero metrics', () => {
      const state = createInitialWalkOnState();
      expect(state.metrics.walkOnsServedToday).toBe(0);
      expect(state.metrics.walkOnsTurnedAwayToday).toBe(0);
      expect(state.metrics.walkOnsGaveUpToday).toBe(0);
      expect(state.metrics.averageWaitTime).toBe(0);
      expect(state.metrics.reputationPenalty).toBe(0);
    });
  });

  describe('createWalkOnGolfer', () => {
    it('creates golfer with default values', () => {
      const golfer = createWalkOnGolfer('g1', 'John', { day: 75, hour: 8, minute: 0 });
      expect(golfer.golferId).toBe('g1');
      expect(golfer.name).toBe('John');
      expect(golfer.desiredGroupSize).toBe(1);
      expect(golfer.priceFlexibility).toBe(0.5);
      expect(golfer.waitTolerance).toBe(30);
      expect(golfer.status).toBe('waiting');
      expect(golfer.waitedMinutes).toBe(0);
    });

    it('allows custom values', () => {
      const golfer = createWalkOnGolfer('g1', 'Jane', { day: 75, hour: 9, minute: 0 }, 4, 0.8, 60, 'member');
      expect(golfer.desiredGroupSize).toBe(4);
      expect(golfer.priceFlexibility).toBe(0.8);
      expect(golfer.waitTolerance).toBe(60);
      expect(golfer.membershipStatus).toBe('member');
    });
  });

  describe('calculateWaitMinutes', () => {
    it('calculates correct wait time', () => {
      const arrival: GameTime = { day: 75, hour: 8, minute: 0 };
      const current: GameTime = { day: 75, hour: 8, minute: 20 };
      expect(calculateWaitMinutes(arrival, current)).toBe(20);
    });

    it('handles hour boundary', () => {
      const arrival: GameTime = { day: 75, hour: 8, minute: 45 };
      const current: GameTime = { day: 75, hour: 9, minute: 15 };
      expect(calculateWaitMinutes(arrival, current)).toBe(30);
    });

    it('handles day boundary', () => {
      const arrival: GameTime = { day: 74, hour: 23, minute: 0 };
      const current: GameTime = { day: 75, hour: 0, minute: 30 };
      expect(calculateWaitMinutes(arrival, current)).toBe(90);
    });

    it('returns 0 for same time', () => {
      const time: GameTime = { day: 75, hour: 8, minute: 0 };
      expect(calculateWaitMinutes(time, time)).toBe(0);
    });
  });

  describe('addWalkOnToQueue', () => {
    it('adds golfer to queue', () => {
      const state = createInitialWalkOnState();
      const golfer = createWalkOnGolfer('g1', 'John', { day: 75, hour: 8, minute: 0 });
      const { state: newState, accepted } = addWalkOnToQueue(state, golfer);
      expect(accepted).toBe(true);
      expect(newState.queue).toHaveLength(1);
      expect(newState.queue[0].golferId).toBe('g1');
    });

    it('rejects when walk-ons disabled', () => {
      const state = createInitialWalkOnState({ allowWalkOns: false });
      const golfer = createWalkOnGolfer('g1', 'John', { day: 75, hour: 8, minute: 0 });
      const { state: newState, accepted } = addWalkOnToQueue(state, golfer);
      expect(accepted).toBe(false);
      expect(newState.queue).toHaveLength(0);
      expect(newState.metrics.walkOnsTurnedAwayToday).toBe(1);
      expect(newState.metrics.reputationPenalty).toBe(-2);
    });

    it('rejects when queue full', () => {
      let state = createInitialWalkOnState({ maxQueueSize: 2 });
      for (let i = 0; i < 2; i++) {
        const { state: newState } = addWalkOnToQueue(
          state,
          createWalkOnGolfer(`g${i}`, `Golfer ${i}`, { day: 75, hour: 8, minute: 0 })
        );
        state = newState;
      }
      expect(state.queue).toHaveLength(2);

      const { state: finalState, accepted } = addWalkOnToQueue(
        state,
        createWalkOnGolfer('g3', 'Extra', { day: 75, hour: 8, minute: 0 })
      );
      expect(accepted).toBe(false);
      expect(finalState.queue).toHaveLength(2);
      expect(finalState.metrics.walkOnsTurnedAwayToday).toBe(1);
      expect(finalState.metrics.reputationPenalty).toBe(-3);
    });
  });

  describe('findSuitableSlot', () => {
    it('finds available slot within next hour', () => {
      const golfer = createWalkOnGolfer('g1', 'John', { day: 75, hour: 8, minute: 0 });
      const slots = [
        createTestSlot('slot1', 8, 20),
        createTestSlot('slot2', 8, 30),
      ];
      const currentTime: GameTime = { day: 75, hour: 8, minute: 0 };
      const slot = findSuitableSlot(golfer, slots, currentTime, DEFAULT_WALK_ON_POLICY);
      expect(slot?.id).toBe('slot1');
    });

    it('skips past slots', () => {
      const golfer = createWalkOnGolfer('g1', 'John', { day: 75, hour: 9, minute: 0 });
      const slots = [
        createTestSlot('slot1', 8, 30),
        createTestSlot('slot2', 9, 10),
      ];
      const currentTime: GameTime = { day: 75, hour: 9, minute: 0 };
      const slot = findSuitableSlot(golfer, slots, currentTime, DEFAULT_WALK_ON_POLICY);
      expect(slot?.id).toBe('slot2');
    });

    it('returns undefined when no suitable slot', () => {
      const golfer = createWalkOnGolfer('g1', 'John', { day: 75, hour: 8, minute: 0 });
      const slots: TeeTime[] = [];
      const currentTime: GameTime = { day: 75, hour: 8, minute: 0 };
      const slot = findSuitableSlot(golfer, slots, currentTime, DEFAULT_WALK_ON_POLICY);
      expect(slot).toBeUndefined();
    });

    it('skips non-available slots', () => {
      const golfer = createWalkOnGolfer('g1', 'John', { day: 75, hour: 8, minute: 0 });
      const bookedSlot = createTestSlot('slot1', 8, 20);
      bookedSlot.status = 'reserved';
      const availableSlot = createTestSlot('slot2', 8, 30);
      const slots = [bookedSlot, availableSlot];
      const currentTime: GameTime = { day: 75, hour: 8, minute: 0 };
      const slot = findSuitableSlot(golfer, slots, currentTime, DEFAULT_WALK_ON_POLICY);
      expect(slot?.id).toBe('slot2');
    });
  });

  describe('processWalkOns', () => {
    it('assigns waiting golfers to slots', () => {
      let state = createInitialWalkOnState();
      const golfer = createWalkOnGolfer('g1', 'John', { day: 75, hour: 8, minute: 0 });
      state = addWalkOnToQueue(state, golfer).state;

      const slots = [createTestSlot('slot1', 8, 10)];
      const currentTime: GameTime = { day: 75, hour: 8, minute: 5 };

      const { state: newState, result, bookings } = processWalkOns(state, currentTime, slots);

      expect(result.assigned).toHaveLength(1);
      expect(result.stillWaiting).toHaveLength(0);
      expect(newState.queue).toHaveLength(0);
      expect(newState.metrics.walkOnsServedToday).toBe(1);
      expect(bookings).toHaveLength(1);
      expect(bookings[0].slot.id).toBe('slot1');
    });

    it('marks golfers as gave up when waited too long', () => {
      let state = createInitialWalkOnState();
      const golfer = createWalkOnGolfer('g1', 'John', { day: 75, hour: 8, minute: 0 }, 1, 0.5, 15);
      state = addWalkOnToQueue(state, golfer).state;

      const slots: TeeTime[] = [];
      const currentTime: GameTime = { day: 75, hour: 8, minute: 30 };

      const { state: newState, result } = processWalkOns(state, currentTime, slots);

      expect(result.gaveUp).toHaveLength(1);
      expect(result.gaveUp[0].status).toBe('gave_up');
      expect(newState.metrics.walkOnsGaveUpToday).toBe(1);
      expect(newState.metrics.reputationPenalty).toBeLessThan(0);
    });

    it('keeps golfers waiting when no slots but not timed out', () => {
      let state = createInitialWalkOnState();
      const golfer = createWalkOnGolfer('g1', 'John', { day: 75, hour: 8, minute: 0 }, 1, 0.5, 60);
      state = addWalkOnToQueue(state, golfer).state;

      const slots: TeeTime[] = [];
      const currentTime: GameTime = { day: 75, hour: 8, minute: 15 };

      const { state: newState, result } = processWalkOns(state, currentTime, slots);

      expect(result.stillWaiting).toHaveLength(1);
      expect(newState.queue).toHaveLength(1);
    });

    it('applies walk-on premium pricing', () => {
      let state = createInitialWalkOnState({ walkOnPremium: 1.2 });
      const golfer = createWalkOnGolfer('g1', 'John', { day: 75, hour: 8, minute: 0 });
      state = addWalkOnToQueue(state, golfer).state;

      const slots = [createTestSlot('slot1', 8, 10)];
      const currentTime: GameTime = { day: 75, hour: 8, minute: 5 };

      const { bookings } = processWalkOns(state, currentTime, slots, 50, 20);

      expect(bookings[0].golfers[0].greenFee).toBe(60);
      expect(bookings[0].golfers[0].cartFee).toBe(20);
    });

    it('creates correct number of golfers for group', () => {
      let state = createInitialWalkOnState();
      const golfer = createWalkOnGolfer('g1', 'John', { day: 75, hour: 8, minute: 0 }, 4);
      state = addWalkOnToQueue(state, golfer).state;

      const slots = [createTestSlot('slot1', 8, 10)];
      const currentTime: GameTime = { day: 75, hour: 8, minute: 5 };

      const { bookings } = processWalkOns(state, currentTime, slots);

      expect(bookings[0].golfers).toHaveLength(4);
      expect(bookings[0].golfers[0].name).toBe('John');
      expect(bookings[0].golfers[1].name).toBe('Guest 1');
    });

    it('calculates average wait time', () => {
      let state = createInitialWalkOnState();
      const golfer1 = createWalkOnGolfer('g1', 'John', { day: 75, hour: 8, minute: 0 });
      const golfer2 = createWalkOnGolfer('g2', 'Jane', { day: 75, hour: 8, minute: 5 });
      state = addWalkOnToQueue(state, golfer1).state;
      state = addWalkOnToQueue(state, golfer2).state;

      const slots = [createTestSlot('slot1', 8, 20), createTestSlot('slot2', 8, 30)];
      const currentTime: GameTime = { day: 75, hour: 8, minute: 15 };

      const { state: newState } = processWalkOns(state, currentTime, slots);

      expect(newState.metrics.walkOnsServedToday).toBe(2);
      expect(newState.metrics.averageWaitTime).toBeGreaterThan(0);
    });
  });

  describe('updateWalkOnPolicy', () => {
    it('updates policy values', () => {
      const state = createInitialWalkOnState();
      const newState = updateWalkOnPolicy(state, { allowWalkOns: false, maxQueueSize: 20 });
      expect(newState.policy.allowWalkOns).toBe(false);
      expect(newState.policy.maxQueueSize).toBe(20);
      expect(newState.policy.walkOnPremium).toBe(1.1);
    });
  });

  describe('resetDailyWalkOnMetrics', () => {
    it('resets all metrics to zero', () => {
      let state = createInitialWalkOnState();
      state = {
        ...state,
        metrics: {
          walkOnsServedToday: 10,
          walkOnsTurnedAwayToday: 5,
          walkOnsGaveUpToday: 2,
          averageWaitTime: 15,
          totalWaitTime: 150,
          reputationPenalty: -10,
        },
      };
      state = resetDailyWalkOnMetrics(state);
      expect(state.metrics.walkOnsServedToday).toBe(0);
      expect(state.metrics.walkOnsTurnedAwayToday).toBe(0);
      expect(state.metrics.walkOnsGaveUpToday).toBe(0);
      expect(state.metrics.averageWaitTime).toBe(0);
      expect(state.metrics.reputationPenalty).toBe(0);
    });
  });

  describe('clearQueue', () => {
    it('removes all golfers from queue', () => {
      let state = createInitialWalkOnState();
      state = addWalkOnToQueue(state, createWalkOnGolfer('g1', 'A', { day: 75, hour: 8, minute: 0 })).state;
      state = addWalkOnToQueue(state, createWalkOnGolfer('g2', 'B', { day: 75, hour: 8, minute: 0 })).state;
      expect(state.queue).toHaveLength(2);

      state = clearQueue(state);
      expect(state.queue).toHaveLength(0);
    });
  });

  describe('getQueueLength', () => {
    it('returns current queue length', () => {
      let state = createInitialWalkOnState();
      expect(getQueueLength(state)).toBe(0);

      state = addWalkOnToQueue(state, createWalkOnGolfer('g1', 'A', { day: 75, hour: 8, minute: 0 })).state;
      expect(getQueueLength(state)).toBe(1);
    });
  });

  describe('getEstimatedWaitTime', () => {
    it('estimates wait based on queue length', () => {
      let state = createInitialWalkOnState();
      state = addWalkOnToQueue(state, createWalkOnGolfer('g1', 'A', { day: 75, hour: 8, minute: 0 })).state;
      state = addWalkOnToQueue(state, createWalkOnGolfer('g2', 'B', { day: 75, hour: 8, minute: 0 })).state;
      state = addWalkOnToQueue(state, createWalkOnGolfer('g3', 'C', { day: 75, hour: 8, minute: 0 })).state;

      expect(getEstimatedWaitTime(state, 10)).toBe(30);
      expect(getEstimatedWaitTime(state, 8)).toBe(24);
    });

    it('returns 0 for empty queue', () => {
      const state = createInitialWalkOnState();
      expect(getEstimatedWaitTime(state)).toBe(0);
    });
  });

  describe('getWalkOnSummary', () => {
    it('returns complete summary', () => {
      let state = createInitialWalkOnState();
      state = addWalkOnToQueue(state, createWalkOnGolfer('g1', 'A', { day: 75, hour: 8, minute: 0 })).state;
      state = {
        ...state,
        metrics: {
          ...state.metrics,
          walkOnsServedToday: 5,
          walkOnsTurnedAwayToday: 2,
          walkOnsGaveUpToday: 1,
          averageWaitTime: 12.5,
          totalWaitTime: 62.5,
          reputationPenalty: -8,
        },
      };

      const summary = getWalkOnSummary(state);
      expect(summary.queueLength).toBe(1);
      expect(summary.served).toBe(5);
      expect(summary.turnedAway).toBe(2);
      expect(summary.gaveUp).toBe(1);
      expect(summary.averageWait).toBe(12.5);
      expect(summary.policyEnabled).toBe(true);
      expect(summary.reputationImpact).toBe(-8);
    });
  });
});
