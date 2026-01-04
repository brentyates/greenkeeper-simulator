import { describe, it, expect } from 'vitest';
import {
  calculateDemandMultiplier,
  TIER_TOLERANCES
} from './prestige';
import {
  generateDailySlots,
  SPACING_CONFIGS,
  DEFAULT_OPERATING_HOURS,
  type TeeTime,
  type GameTime
} from './tee-times';
import {
  createInitialWalkOnState,
  addWalkOnToQueue,
  processWalkOns,
  createWalkOnGolfer
} from './walk-ons';
import { generateArrivals, createInitialPoolState, DEFAULT_GREEN_FEES } from './golfers';

describe('Integration: Prestige affects golfer demand', () => {
  it('low prestige courses have lower green fee tolerance', () => {
    const municipalTolerance = TIER_TOLERANCES['municipal'];
    const privateTolerance = TIER_TOLERANCES['private_club'];

    expect(municipalTolerance.sweetSpot).toBe(15);
    expect(privateTolerance.sweetSpot).toBe(120);
    expect(municipalTolerance.maxTolerance).toBe(35);
    expect(privateTolerance.maxTolerance).toBe(250);
  });

  it('overpricing reduces demand multiplier', () => {
    const tolerance = TIER_TOLERANCES['public'];

    const demandAtSweetSpot = calculateDemandMultiplier(tolerance.sweetSpot, tolerance);
    const demandAtRejection = calculateDemandMultiplier(tolerance.rejectionThreshold, tolerance);
    const demandAtMax = calculateDemandMultiplier(tolerance.maxTolerance, tolerance);
    const demandOverMax = calculateDemandMultiplier(tolerance.maxTolerance + 50, tolerance);

    expect(demandAtSweetSpot).toBe(1.0);
    expect(demandAtRejection).toBeCloseTo(0.8, 5);
    expect(demandAtMax).toBeCloseTo(0.2, 5);
    expect(demandOverMax).toBeLessThan(0.2);
  });

  it('higher prestige allows higher green fees without rejection', () => {
    const municipalTolerance = TIER_TOLERANCES['municipal'];
    const championshipTolerance = TIER_TOLERANCES['championship'];

    const municipalDemandAt50 = calculateDemandMultiplier(50, municipalTolerance);
    const championshipDemandAt50 = calculateDemandMultiplier(50, championshipTolerance);

    expect(municipalDemandAt50).toBeLessThan(0.2);
    expect(championshipDemandAt50).toBe(1.0);
  });

  it('tier tolerances scale with prestige level', () => {
    const tiers = ['municipal', 'public', 'semi_private', 'private_club', 'championship'] as const;
    const tolerances = tiers.map(t => TIER_TOLERANCES[t]);

    for (let i = 1; i < tolerances.length; i++) {
      expect(tolerances[i].sweetSpot).toBeGreaterThan(tolerances[i - 1].sweetSpot);
      expect(tolerances[i].maxTolerance).toBeGreaterThan(tolerances[i - 1].maxTolerance);
    }
  });
});

describe('Integration: Overpricing causes rejections', () => {
  it('golfers reject overpriced fees based on course tier', () => {
    const fees = { ...DEFAULT_GREEN_FEES };

    const golferPool = createInitialPoolState();
    const arrivals = generateArrivals(golferPool, 20, 420, fees, false, false);

    expect(arrivals.length).toBeLessThanOrEqual(20);
    expect(arrivals.length).toBeGreaterThan(0);
  });

  it('higher prestige reduces rejections at same price', () => {
    const municipalTolerance = TIER_TOLERANCES['municipal'];
    const privateTolerance = TIER_TOLERANCES['private_club'];

    const price = 60;

    const municipalDemand = calculateDemandMultiplier(price, municipalTolerance);
    const privateDemand = calculateDemandMultiplier(price, privateTolerance);

    expect(municipalDemand).toBeLessThan(privateDemand);
    expect(privateDemand).toBe(1.0);
  });

  it('demand drops severely when price exceeds max tolerance', () => {
    const tolerance = TIER_TOLERANCES['public'];
    const extremePrice = tolerance.maxTolerance * 2;

    const demand = calculateDemandMultiplier(extremePrice, tolerance);

    expect(demand).toBeLessThanOrEqual(0.15);
    expect(demand).toBeGreaterThanOrEqual(0.05);
  });
});

describe('Integration: Tee time spacing affects course capacity', () => {
  it('packed spacing allows more tee times but impacts pace', () => {
    const packed = SPACING_CONFIGS['packed'];
    const exclusive = SPACING_CONFIGS['exclusive'];

    expect(packed.minutesBetween).toBeLessThan(exclusive.minutesBetween);
    expect(packed.paceOfPlayPenalty).toBeGreaterThan(exclusive.paceOfPlayPenalty);
    expect(packed.reputationModifier).toBeLessThan(exclusive.reputationModifier);
  });

  it('spacing affects max daily tee times', () => {
    const packedSlots = generateDailySlots(
      1,
      SPACING_CONFIGS['packed'],
      DEFAULT_OPERATING_HOURS
    );

    const exclusiveSlots = generateDailySlots(
      1,
      SPACING_CONFIGS['exclusive'],
      DEFAULT_OPERATING_HOURS
    );

    expect(packedSlots.length).toBeGreaterThan(exclusiveSlots.length);
    expect(packedSlots.length / exclusiveSlots.length).toBeGreaterThan(2);
  });

  it('all spacing configs have valid multipliers', () => {
    const spacings = ['packed', 'tight', 'standard', 'comfortable', 'relaxed', 'exclusive'] as const;

    for (const spacing of spacings) {
      const config = SPACING_CONFIGS[spacing];
      expect(config.minutesBetween).toBeGreaterThan(0);
      expect(config.revenueMultiplier).toBeGreaterThan(0);
      expect(config.revenueMultiplier).toBeLessThanOrEqual(2);
    }
  });
});

describe('Integration: Walk-on queue management', () => {
  const makeArrivalTime = (hour: number, minute: number = 0): GameTime => ({
    day: 1,
    hour,
    minute
  });

  const makeAvailableSlot = (hour: number, minute: number = 0): TeeTime => ({
    id: `slot-${hour}-${minute}`,
    scheduledTime: { day: 1, hour, minute },
    groupSize: 0,
    status: 'available',
    bookingType: 'reservation',
    golfers: [],
    pricePerGolfer: 0,
    totalRevenue: 0,
    checkedIn: false,
    roundCompleted: false
  });

  it('walk-ons can be added to queue', () => {
    let state = createInitialWalkOnState();

    const golfer1 = createWalkOnGolfer('g1', 'Golfer 1', makeArrivalTime(10, 0), 2, 0.5, 30);
    const golfer2 = createWalkOnGolfer('g2', 'Golfer 2', makeArrivalTime(10, 0), 4, 0.5, 20);

    const result1 = addWalkOnToQueue(state, golfer1);
    state = result1.state;
    const result2 = addWalkOnToQueue(state, golfer2);
    state = result2.state;

    expect(state.queue.length).toBe(2);
    expect(state.queue[0].desiredGroupSize).toBe(2);
    expect(state.queue[1].desiredGroupSize).toBe(4);
  });

  it('golfers leave queue when wait exceeds tolerance', () => {
    let state = createInitialWalkOnState();

    const golfer = createWalkOnGolfer('g1', 'Golfer 1', makeArrivalTime(10, 0), 2, 0.5, 10);
    const addResult = addWalkOnToQueue(state, golfer);
    state = addResult.state;

    const currentTime: GameTime = { day: 1, hour: 10, minute: 15 };
    const result = processWalkOns(state, currentTime, []);

    expect(result.state.queue.length).toBe(0);
    expect(result.result.gaveUp.length).toBe(1);
    expect(result.result.gaveUp[0].desiredGroupSize).toBe(2);
  });

  it('walk-ons are assigned to available slots', () => {
    let state = createInitialWalkOnState();

    const golfer = createWalkOnGolfer('g1', 'Golfer 1', makeArrivalTime(10, 0), 2, 0.5, 30);
    const addResult = addWalkOnToQueue(state, golfer);
    state = addResult.state;

    const availableSlots = [makeAvailableSlot(10, 10)];
    const currentTime: GameTime = { day: 1, hour: 10, minute: 5 };
    const result = processWalkOns(state, currentTime, availableSlots);

    expect(result.result.assigned.length).toBe(1);
    expect(result.result.assigned[0].desiredGroupSize).toBe(2);
    expect(result.state.queue.length).toBe(0);
  });

  it('walk-ons wait if no suitable slot available', () => {
    let state = createInitialWalkOnState();

    const golfer = createWalkOnGolfer('g1', 'Golfer 1', makeArrivalTime(10, 0), 2, 0.5, 30);
    const addResult = addWalkOnToQueue(state, golfer);
    state = addResult.state;

    const currentTime: GameTime = { day: 1, hour: 10, minute: 5 };
    const result = processWalkOns(state, currentTime, []);

    expect(result.result.assigned.length).toBe(0);
    expect(result.state.queue.length).toBe(1);
  });

  it('walk-on metrics track daily activity', () => {
    let state = createInitialWalkOnState();

    const golfer1 = createWalkOnGolfer('g1', 'Golfer 1', makeArrivalTime(10, 0), 2, 0.5, 30);
    const golfer2 = createWalkOnGolfer('g2', 'Golfer 2', makeArrivalTime(10, 0), 4, 0.5, 5);

    state = addWalkOnToQueue(state, golfer1).state;
    state = addWalkOnToQueue(state, golfer2).state;

    const availableSlots = [makeAvailableSlot(10, 15)];
    const currentTime: GameTime = { day: 1, hour: 10, minute: 10 };
    const result = processWalkOns(state, currentTime, availableSlots);

    expect(result.result.assigned.length).toBe(1);
    expect(result.result.gaveUp.length).toBe(1);

    expect(result.state.metrics.walkOnsServedToday).toBe(1);
    expect(result.state.metrics.walkOnsGaveUpToday).toBe(1);
  });
});
