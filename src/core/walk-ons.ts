import type { GameTime, TeeTime, GolferBooking, MembershipStatus } from './tee-times';

export type WalkOnStatus = 'waiting' | 'assigned' | 'gave_up' | 'turned_away';

export interface WalkOnPolicy {
  allowWalkOns: boolean;
  reserveWalkOnSlots: number;
  walkOnPremium: number;
  walkOnDiscount: number;
  maxQueueSize: number;
  maxWaitMinutes: number;
}

export const DEFAULT_WALK_ON_POLICY: WalkOnPolicy = {
  allowWalkOns: true,
  reserveWalkOnSlots: 1,
  walkOnPremium: 1.1,
  walkOnDiscount: 0.9,
  maxQueueSize: 12,
  maxWaitMinutes: 45,
} as const;

export interface WalkOnGolfer {
  golferId: string;
  name: string;
  arrivalTime: GameTime;
  desiredGroupSize: number;
  priceFlexibility: number;
  waitTolerance: number;
  membershipStatus: MembershipStatus;
  status: WalkOnStatus;
  assignedSlot?: TeeTime;
  waitedMinutes: number;
}

export interface WalkOnMetrics {
  walkOnsServedToday: number;
  walkOnsTurnedAwayToday: number;
  walkOnsGaveUpToday: number;
  averageWaitTime: number;
  totalWaitTime: number;
  reputationPenalty: number;
}

export interface WalkOnState {
  policy: WalkOnPolicy;
  queue: WalkOnGolfer[];
  metrics: WalkOnMetrics;
}

export function createInitialWalkOnState(
  policy: Partial<WalkOnPolicy> = {}
): WalkOnState {
  return {
    policy: { ...DEFAULT_WALK_ON_POLICY, ...policy },
    queue: [],
    metrics: {
      walkOnsServedToday: 0,
      walkOnsTurnedAwayToday: 0,
      walkOnsGaveUpToday: 0,
      averageWaitTime: 0,
      totalWaitTime: 0,
      reputationPenalty: 0,
    },
  };
}

export function calculateWaitMinutes(arrivalTime: GameTime, currentTime: GameTime): number {
  const arrivalMinutes = arrivalTime.day * 24 * 60 + arrivalTime.hour * 60 + arrivalTime.minute;
  const currentMinutes = currentTime.day * 24 * 60 + currentTime.hour * 60 + currentTime.minute;
  return Math.max(0, currentMinutes - arrivalMinutes);
}

export function createWalkOnGolfer(
  golferId: string,
  name: string,
  arrivalTime: GameTime,
  desiredGroupSize: number = 1,
  priceFlexibility: number = 0.5,
  waitTolerance: number = 30,
  membershipStatus: MembershipStatus = 'public'
): WalkOnGolfer {
  return {
    golferId,
    name,
    arrivalTime,
    desiredGroupSize,
    priceFlexibility,
    waitTolerance,
    membershipStatus,
    status: 'waiting',
    waitedMinutes: 0,
  };
}

export interface WalkOnResult {
  assigned: WalkOnGolfer[];
  gaveUp: WalkOnGolfer[];
  stillWaiting: WalkOnGolfer[];
  turnedAway: WalkOnGolfer[];
}

export function addWalkOnToQueue(
  state: WalkOnState,
  golfer: WalkOnGolfer
): { state: WalkOnState; accepted: boolean } {
  if (!state.policy.allowWalkOns) {
    return {
      state: {
        ...state,
        metrics: {
          ...state.metrics,
          walkOnsTurnedAwayToday: state.metrics.walkOnsTurnedAwayToday + 1,
          reputationPenalty: state.metrics.reputationPenalty - 2,
        },
      },
      accepted: false,
    };
  }

  if (state.queue.length >= state.policy.maxQueueSize) {
    return {
      state: {
        ...state,
        metrics: {
          ...state.metrics,
          walkOnsTurnedAwayToday: state.metrics.walkOnsTurnedAwayToday + 1,
          reputationPenalty: state.metrics.reputationPenalty - 3,
        },
      },
      accepted: false,
    };
  }

  return {
    state: {
      ...state,
      queue: [...state.queue, { ...golfer, status: 'waiting' }],
    },
    accepted: true,
  };
}

export function findSuitableSlot(
  golfer: WalkOnGolfer,
  availableSlots: TeeTime[],
  currentTime: GameTime,
  policy: WalkOnPolicy
): TeeTime | undefined {
  const currentMinutes = currentTime.hour * 60 + currentTime.minute;

  for (const slot of availableSlots) {
    const slotMinutes = slot.scheduledTime.hour * 60 + slot.scheduledTime.minute;
    if (slotMinutes < currentMinutes) continue;
    if (slotMinutes > currentMinutes + 60) continue;
    if (slot.status !== 'available') continue;

    return slot;
  }
  return undefined;
}

export function processWalkOns(
  state: WalkOnState,
  currentTime: GameTime,
  availableSlots: TeeTime[],
  greenFee: number = 50,
  cartFee: number = 20
): { state: WalkOnState; result: WalkOnResult; bookings: Array<{ slot: TeeTime; golfers: GolferBooking[] }> } {
  const result: WalkOnResult = {
    assigned: [],
    gaveUp: [],
    stillWaiting: [],
    turnedAway: [],
  };

  const bookings: Array<{ slot: TeeTime; golfers: GolferBooking[] }> = [];
  let remainingSlots = [...availableSlots];
  let totalNewWaitTime = 0;
  let reputationHit = 0;

  for (const golfer of state.queue) {
    const waitMinutes = calculateWaitMinutes(golfer.arrivalTime, currentTime);
    const updatedGolfer = { ...golfer, waitedMinutes: waitMinutes };

    if (waitMinutes > updatedGolfer.waitTolerance) {
      updatedGolfer.status = 'gave_up';
      result.gaveUp.push(updatedGolfer);
      reputationHit -= 5;
      continue;
    }

    const slot = findSuitableSlot(updatedGolfer, remainingSlots, currentTime, state.policy);

    if (slot) {
      updatedGolfer.status = 'assigned';
      updatedGolfer.assignedSlot = slot;
      result.assigned.push(updatedGolfer);
      totalNewWaitTime += waitMinutes;

      const walkOnFee = greenFee * state.policy.walkOnPremium;
      const golfers: GolferBooking[] = [];
      for (let i = 0; i < updatedGolfer.desiredGroupSize; i++) {
        golfers.push({
          golferId: `${updatedGolfer.golferId}-${i}`,
          name: i === 0 ? updatedGolfer.name : `Guest ${i}`,
          membershipStatus: updatedGolfer.membershipStatus,
          greenFee: walkOnFee,
          cartFee,
          addOns: [],
        });
      }

      bookings.push({ slot, golfers });
      remainingSlots = remainingSlots.filter(s => s.id !== slot.id);
    } else {
      result.stillWaiting.push(updatedGolfer);
    }
  }

  const assignedCount = result.assigned.length;
  const gaveUpCount = result.gaveUp.length;
  const previousTotal = state.metrics.walkOnsServedToday;
  const previousWaitTime = state.metrics.totalWaitTime;
  const newTotalWaitTime = previousWaitTime + totalNewWaitTime;
  const newAverage = previousTotal + assignedCount > 0
    ? newTotalWaitTime / (previousTotal + assignedCount)
    : 0;

  return {
    state: {
      ...state,
      queue: result.stillWaiting,
      metrics: {
        walkOnsServedToday: state.metrics.walkOnsServedToday + assignedCount,
        walkOnsTurnedAwayToday: state.metrics.walkOnsTurnedAwayToday,
        walkOnsGaveUpToday: state.metrics.walkOnsGaveUpToday + gaveUpCount,
        averageWaitTime: Math.round(newAverage * 10) / 10,
        totalWaitTime: newTotalWaitTime,
        reputationPenalty: state.metrics.reputationPenalty + reputationHit,
      },
    },
    result,
    bookings,
  };
}

export function updateWalkOnPolicy(
  state: WalkOnState,
  policy: Partial<WalkOnPolicy>
): WalkOnState {
  return {
    ...state,
    policy: { ...state.policy, ...policy },
  };
}

export function resetDailyWalkOnMetrics(state: WalkOnState): WalkOnState {
  return {
    ...state,
    metrics: {
      walkOnsServedToday: 0,
      walkOnsTurnedAwayToday: 0,
      walkOnsGaveUpToday: 0,
      averageWaitTime: 0,
      totalWaitTime: 0,
      reputationPenalty: 0,
    },
  };
}

export function clearQueue(state: WalkOnState): WalkOnState {
  return {
    ...state,
    queue: [],
  };
}

export function getQueueLength(state: WalkOnState): number {
  return state.queue.length;
}

export function getEstimatedWaitTime(
  state: WalkOnState,
  slotIntervalMinutes: number = 10
): number {
  const queueAhead = state.queue.length;
  return queueAhead * slotIntervalMinutes;
}

export function getWalkOnSummary(state: WalkOnState): {
  queueLength: number;
  served: number;
  turnedAway: number;
  gaveUp: number;
  averageWait: number;
  policyEnabled: boolean;
  reputationImpact: number;
} {
  return {
    queueLength: state.queue.length,
    served: state.metrics.walkOnsServedToday,
    turnedAway: state.metrics.walkOnsTurnedAwayToday,
    gaveUp: state.metrics.walkOnsGaveUpToday,
    averageWait: state.metrics.averageWaitTime,
    policyEnabled: state.policy.allowWalkOns,
    reputationImpact: state.metrics.reputationPenalty,
  };
}
