export type TeeTimeStatus =
  | 'available'
  | 'reserved'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'no_show'
  | 'cancelled';

export type BookingType = 'reservation' | 'walk_on' | 'member' | 'tournament';
export type MembershipStatus = 'member' | 'guest' | 'public';

export type TeeTimeSpacing = 'packed' | 'tight' | 'standard' | 'comfortable' | 'relaxed' | 'exclusive';
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface BookingWindowConfig {
  publicBookingDays: number;
  memberBookingDays: number;
  freeCancellationHours: number;
  lateCancelPenalty: number;
  noShowPenalty: number;
  noShowCountForBlacklist: number;
}

export const DEFAULT_BOOKING_CONFIG: BookingWindowConfig = {
  publicBookingDays: 7,
  memberBookingDays: 14,
  freeCancellationHours: 24,
  lateCancelPenalty: 0.5,
  noShowPenalty: 1.0,
  noShowCountForBlacklist: 3,
} as const;

export interface ReservationDemand {
  baseDemand: number;
  dayOfWeekMultiplier: number;
  timeOfDayMultiplier: number;
  seasonMultiplier: number;
  weatherMultiplier: number;
  prestigeMultiplier: number;
  pricingMultiplier: number;
  marketingMultiplier: number;
  finalDemand: number;
  bookingProbability: number;
}

export const DAY_OF_WEEK_MULTIPLIERS: Record<DayOfWeek, number> = {
  0: 1.3,   // Sunday
  1: 0.7,   // Monday
  2: 0.8,   // Tuesday
  3: 0.9,   // Wednesday
  4: 0.9,   // Thursday
  5: 1.1,   // Friday
  6: 1.4,   // Saturday
} as const;

export interface GameTime {
  day: number;
  hour: number;
  minute: number;
}

export interface AddOn {
  id: string;
  name: string;
  price: number;
}

export interface GolferBooking {
  golferId: string;
  name: string;
  membershipStatus: MembershipStatus;
  greenFee: number;
  cartFee: number;
  addOns: AddOn[];
}

export interface TeeTime {
  id: string;
  scheduledTime: GameTime;
  groupSize: number;
  status: TeeTimeStatus;
  bookingType: BookingType;
  golfers: GolferBooking[];
  pricePerGolfer: number;
  totalRevenue: number;
  bookedAt?: GameTime;
  checkedIn: boolean;
  actualStartTime?: GameTime;
  roundCompleted: boolean;
  completionTime?: GameTime;
}

export interface CourseOperatingHours {
  openTime: number;
  closeTime: number;
  lastTeeTime: number;
  summerHours: { open: number; close: number; lastTee: number };
  winterHours: { open: number; close: number; lastTee: number };
  twilightStart: number;
}

export interface SpacingConfiguration {
  spacing: TeeTimeSpacing;
  minutesBetween: number;
  maxDailyTeeTimes: number;
  paceOfPlayPenalty: number;
  backupRiskMultiplier: number;
  reputationModifier: number;
  revenueMultiplier: number;
}

export interface BookingMetrics {
  totalBookingsToday: number;
  cancellationsToday: number;
  noShowsToday: number;
  lateCancellationsToday: number;
}

export interface TeeTimeSystemState {
  spacingConfig: SpacingConfiguration;
  operatingHours: CourseOperatingHours;
  bookingConfig: BookingWindowConfig;
  teeTimes: Map<number, TeeTime[]>;
  currentDay: number;
  bookingMetrics: BookingMetrics;
}

export const DEFAULT_OPERATING_HOURS: CourseOperatingHours = {
  openTime: 6,
  closeTime: 20,
  lastTeeTime: 16,
  summerHours: { open: 5, close: 21, lastTee: 17 },
  winterHours: { open: 7, close: 18, lastTee: 14 },
  twilightStart: 14,
} as const;

export const SPACING_CONFIGS: Record<TeeTimeSpacing, SpacingConfiguration> = {
  packed: {
    spacing: 'packed',
    minutesBetween: 6,
    maxDailyTeeTimes: 100,
    paceOfPlayPenalty: 0.35,
    backupRiskMultiplier: 2.5,
    reputationModifier: -0.15,
    revenueMultiplier: 1.67,
  },
  tight: {
    spacing: 'tight',
    minutesBetween: 8,
    maxDailyTeeTimes: 75,
    paceOfPlayPenalty: 0.20,
    backupRiskMultiplier: 1.8,
    reputationModifier: -0.08,
    revenueMultiplier: 1.25,
  },
  standard: {
    spacing: 'standard',
    minutesBetween: 10,
    maxDailyTeeTimes: 60,
    paceOfPlayPenalty: 0.0,
    backupRiskMultiplier: 1.0,
    reputationModifier: 0.0,
    revenueMultiplier: 1.0,
  },
  comfortable: {
    spacing: 'comfortable',
    minutesBetween: 12,
    maxDailyTeeTimes: 50,
    paceOfPlayPenalty: -0.10,
    backupRiskMultiplier: 0.6,
    reputationModifier: 0.05,
    revenueMultiplier: 0.83,
  },
  relaxed: {
    spacing: 'relaxed',
    minutesBetween: 15,
    maxDailyTeeTimes: 40,
    paceOfPlayPenalty: -0.20,
    backupRiskMultiplier: 0.3,
    reputationModifier: 0.12,
    revenueMultiplier: 0.67,
  },
  exclusive: {
    spacing: 'exclusive',
    minutesBetween: 20,
    maxDailyTeeTimes: 30,
    paceOfPlayPenalty: -0.30,
    backupRiskMultiplier: 0.1,
    reputationModifier: 0.20,
    revenueMultiplier: 0.50,
  },
} as const;

export function createInitialTeeTimeState(
  spacing: TeeTimeSpacing = 'standard'
): TeeTimeSystemState {
  return {
    spacingConfig: { ...SPACING_CONFIGS[spacing] },
    operatingHours: { ...DEFAULT_OPERATING_HOURS },
    bookingConfig: { ...DEFAULT_BOOKING_CONFIG },
    teeTimes: new Map(),
    currentDay: 0,
    bookingMetrics: {
      totalBookingsToday: 0,
      cancellationsToday: 0,
      noShowsToday: 0,
      lateCancellationsToday: 0,
    },
  };
}

export function getOperatingHoursForSeason(
  hours: CourseOperatingHours,
  day: number
): { open: number; close: number; lastTee: number } {
  const dayOfYear = day % 365;
  if (dayOfYear >= 91 && dayOfYear <= 273) {
    return hours.summerHours;
  }
  if (dayOfYear <= 60 || dayOfYear >= 305) {
    return hours.winterHours;
  }
  return { open: hours.openTime, close: hours.closeTime, lastTee: hours.lastTeeTime };
}

export function calculateMaxDailySlots(
  spacing: SpacingConfiguration,
  operatingHours: CourseOperatingHours,
  day: number
): number {
  const seasonalHours = getOperatingHoursForSeason(operatingHours, day);
  const operatingMinutes = (seasonalHours.lastTee - seasonalHours.open) * 60;
  return Math.floor(operatingMinutes / spacing.minutesBetween) + 1;
}

function generateTeeTimeId(day: number, hour: number, minute: number): string {
  return `tt-${day}-${hour.toString().padStart(2, '0')}${minute.toString().padStart(2, '0')}`;
}

export function generateDailySlots(
  day: number,
  spacing: SpacingConfiguration,
  operatingHours: CourseOperatingHours
): TeeTime[] {
  const seasonalHours = getOperatingHoursForSeason(operatingHours, day);
  const slots: TeeTime[] = [];

  let currentMinutes = seasonalHours.open * 60;
  const lastTeeMinutes = seasonalHours.lastTee * 60;

  while (currentMinutes <= lastTeeMinutes) {
    const hour = Math.floor(currentMinutes / 60);
    const minute = currentMinutes % 60;

    slots.push({
      id: generateTeeTimeId(day, hour, minute),
      scheduledTime: { day, hour, minute },
      groupSize: 0,
      status: 'available',
      bookingType: 'reservation',
      golfers: [],
      pricePerGolfer: 0,
      totalRevenue: 0,
      checkedIn: false,
      roundCompleted: false,
    });

    currentMinutes += spacing.minutesBetween;
  }

  return slots;
}

export function getTeeTimes(state: TeeTimeSystemState, day: number): TeeTime[] {
  const existingSlots = state.teeTimes.get(day);
  if (existingSlots) {
    return existingSlots;
  }
  const newSlots = generateDailySlots(day, state.spacingConfig, state.operatingHours);
  state.teeTimes.set(day, newSlots);
  return newSlots;
}

export function getTeeTimeById(state: TeeTimeSystemState, id: string): TeeTime | undefined {
  for (const slots of state.teeTimes.values()) {
    const found = slots.find(s => s.id === id);
    if (found) return found;
  }
  return undefined;
}

export function getAvailableSlots(state: TeeTimeSystemState, day: number): TeeTime[] {
  const slots = getTeeTimes(state, day);
  return slots.filter(s => s.status === 'available');
}

export function getBookedSlots(state: TeeTimeSystemState, day: number): TeeTime[] {
  const slots = getTeeTimes(state, day);
  return slots.filter(s => s.status !== 'available' && s.status !== 'cancelled');
}

export function updateSpacing(
  state: TeeTimeSystemState,
  newSpacing: TeeTimeSpacing
): TeeTimeSystemState {
  return {
    ...state,
    spacingConfig: { ...SPACING_CONFIGS[newSpacing] },
  };
}

export function updateOperatingHours(
  state: TeeTimeSystemState,
  hours: Partial<CourseOperatingHours>
): TeeTimeSystemState {
  return {
    ...state,
    operatingHours: { ...state.operatingHours, ...hours },
  };
}

export function bookTeeTime(
  state: TeeTimeSystemState,
  teeTimeId: string,
  golfers: GolferBooking[],
  bookingType: BookingType,
  currentTime: GameTime
): TeeTimeSystemState {
  if (golfers.length === 0) return state;

  const newTeeTimes = new Map(state.teeTimes);

  for (const [day, slots] of newTeeTimes) {
    const slotIndex = slots.findIndex(s => s.id === teeTimeId);
    if (slotIndex >= 0) {
      const slot = slots[slotIndex];
      if (slot.status !== 'available') {
        return state;
      }

      const totalRevenue = golfers.reduce((sum, g) => {
        const addOnTotal = g.addOns.reduce((a, addon) => a + addon.price, 0);
        return sum + g.greenFee + g.cartFee + addOnTotal;
      }, 0);
      const pricePerGolfer = totalRevenue / golfers.length;

      const updatedSlot: TeeTime = {
        ...slot,
        status: 'reserved',
        bookingType,
        golfers,
        groupSize: golfers.length,
        pricePerGolfer,
        totalRevenue,
        bookedAt: currentTime,
      };

      const newSlots = [...slots];
      newSlots[slotIndex] = updatedSlot;
      newTeeTimes.set(day, newSlots);

      return { ...state, teeTimes: newTeeTimes };
    }
  }

  return state;
}

export function checkInTeeTime(
  state: TeeTimeSystemState,
  teeTimeId: string
): TeeTimeSystemState {
  const newTeeTimes = new Map(state.teeTimes);

  for (const [day, slots] of newTeeTimes) {
    const slotIndex = slots.findIndex(s => s.id === teeTimeId);
    if (slotIndex >= 0) {
      const slot = slots[slotIndex];
      if (slot.status !== 'reserved') {
        return state;
      }

      const updatedSlot: TeeTime = {
        ...slot,
        status: 'checked_in',
        checkedIn: true,
      };

      const newSlots = [...slots];
      newSlots[slotIndex] = updatedSlot;
      newTeeTimes.set(day, newSlots);

      return { ...state, teeTimes: newTeeTimes };
    }
  }

  return state;
}

export function startRound(
  state: TeeTimeSystemState,
  teeTimeId: string,
  actualStartTime: GameTime
): TeeTimeSystemState {
  const newTeeTimes = new Map(state.teeTimes);

  for (const [day, slots] of newTeeTimes) {
    const slotIndex = slots.findIndex(s => s.id === teeTimeId);
    if (slotIndex >= 0) {
      const slot = slots[slotIndex];
      if (slot.status !== 'checked_in') {
        return state;
      }

      const updatedSlot: TeeTime = {
        ...slot,
        status: 'in_progress',
        actualStartTime,
      };

      const newSlots = [...slots];
      newSlots[slotIndex] = updatedSlot;
      newTeeTimes.set(day, newSlots);

      return { ...state, teeTimes: newTeeTimes };
    }
  }

  return state;
}

export function completeRound(
  state: TeeTimeSystemState,
  teeTimeId: string,
  completionTime: GameTime
): TeeTimeSystemState {
  const newTeeTimes = new Map(state.teeTimes);

  for (const [day, slots] of newTeeTimes) {
    const slotIndex = slots.findIndex(s => s.id === teeTimeId);
    if (slotIndex >= 0) {
      const slot = slots[slotIndex];
      if (slot.status !== 'in_progress') {
        return state;
      }

      const updatedSlot: TeeTime = {
        ...slot,
        status: 'completed',
        roundCompleted: true,
        completionTime,
      };

      const newSlots = [...slots];
      newSlots[slotIndex] = updatedSlot;
      newTeeTimes.set(day, newSlots);

      return { ...state, teeTimes: newTeeTimes };
    }
  }

  return state;
}

export function cancelTeeTime(
  state: TeeTimeSystemState,
  teeTimeId: string
): TeeTimeSystemState {
  const newTeeTimes = new Map(state.teeTimes);

  for (const [day, slots] of newTeeTimes) {
    const slotIndex = slots.findIndex(s => s.id === teeTimeId);
    if (slotIndex >= 0) {
      const slot = slots[slotIndex];
      if (slot.status !== 'reserved') {
        return state;
      }

      const updatedSlot: TeeTime = {
        ...slot,
        status: 'cancelled',
        golfers: [],
        groupSize: 0,
        totalRevenue: 0,
        pricePerGolfer: 0,
      };

      const newSlots = [...slots];
      newSlots[slotIndex] = updatedSlot;
      newTeeTimes.set(day, newSlots);

      return { ...state, teeTimes: newTeeTimes };
    }
  }

  return state;
}

export function markNoShow(
  state: TeeTimeSystemState,
  teeTimeId: string
): TeeTimeSystemState {
  const newTeeTimes = new Map(state.teeTimes);

  for (const [day, slots] of newTeeTimes) {
    const slotIndex = slots.findIndex(s => s.id === teeTimeId);
    if (slotIndex >= 0) {
      const slot = slots[slotIndex];
      if (slot.status !== 'reserved') {
        return state;
      }

      const updatedSlot: TeeTime = {
        ...slot,
        status: 'no_show',
      };

      const newSlots = [...slots];
      newSlots[slotIndex] = updatedSlot;
      newTeeTimes.set(day, newSlots);

      return { ...state, teeTimes: newTeeTimes };
    }
  }

  return state;
}

export function getDailyStats(state: TeeTimeSystemState, day: number): {
  totalSlots: number;
  bookedSlots: number;
  availableSlots: number;
  checkedIn: number;
  inProgress: number;
  completed: number;
  noShows: number;
  cancelled: number;
  totalGolfers: number;
  totalRevenue: number;
  bookingRate: number;
} {
  const slots = getTeeTimes(state, day);
  const totalSlots = slots.length;

  let bookedSlots = 0;
  let availableSlots = 0;
  let checkedIn = 0;
  let inProgress = 0;
  let completed = 0;
  let noShows = 0;
  let cancelled = 0;
  let totalGolfers = 0;
  let totalRevenue = 0;

  for (const slot of slots) {
    switch (slot.status) {
      case 'available':
        availableSlots++;
        break;
      case 'reserved':
        bookedSlots++;
        totalGolfers += slot.groupSize;
        totalRevenue += slot.totalRevenue;
        break;
      case 'checked_in':
        bookedSlots++;
        checkedIn++;
        totalGolfers += slot.groupSize;
        totalRevenue += slot.totalRevenue;
        break;
      case 'in_progress':
        bookedSlots++;
        inProgress++;
        totalGolfers += slot.groupSize;
        totalRevenue += slot.totalRevenue;
        break;
      case 'completed':
        bookedSlots++;
        completed++;
        totalGolfers += slot.groupSize;
        totalRevenue += slot.totalRevenue;
        break;
      case 'no_show':
        noShows++;
        break;
      case 'cancelled':
        cancelled++;
        break;
    }
  }

  const bookingRate = totalSlots > 0 ? bookedSlots / totalSlots : 0;

  return {
    totalSlots,
    bookedSlots,
    availableSlots,
    checkedIn,
    inProgress,
    completed,
    noShows,
    cancelled,
    totalGolfers,
    totalRevenue,
    bookingRate,
  };
}

export function isTwilight(
  time: GameTime,
  operatingHours: CourseOperatingHours
): boolean {
  return time.hour >= operatingHours.twilightStart;
}

export function formatTeeTime(time: GameTime): string {
  const hour12 = time.hour % 12 || 12;
  const ampm = time.hour < 12 ? 'AM' : 'PM';
  const minuteStr = time.minute.toString().padStart(2, '0');
  return `${hour12}:${minuteStr} ${ampm}`;
}

export function getSpacingLabel(spacing: TeeTimeSpacing): string {
  switch (spacing) {
    case 'packed': return 'Packed (6 min)';
    case 'tight': return 'Tight (8 min)';
    case 'standard': return 'Standard (10 min)';
    case 'comfortable': return 'Comfortable (12 min)';
    case 'relaxed': return 'Relaxed (15 min)';
    case 'exclusive': return 'Exclusive (20 min)';
  }
}

export function getDayOfWeek(day: number): DayOfWeek {
  return (day % 7) as DayOfWeek;
}

export function getTimeOfDayMultiplier(hour: number): number {
  if (hour < 7) return 0.6;      // Early bird
  if (hour < 10) return 1.3;     // Prime morning
  if (hour < 12) return 1.1;     // Late morning
  if (hour < 14) return 0.9;     // Midday
  if (hour < 16) return 1.0;     // Afternoon
  return 0.7;                     // Twilight
}

export function getSeasonMultiplier(day: number): number {
  const dayOfYear = day % 365;
  if (dayOfYear >= 91 && dayOfYear <= 273) return 1.2;   // Summer: high season
  if (dayOfYear <= 60 || dayOfYear >= 305) return 0.6;   // Winter: low season
  return 1.0;                                             // Spring/Fall: normal
}

export interface DemandFactors {
  baseDemand?: number;
  prestigeScore?: number;
  weatherCondition?: 'perfect' | 'good' | 'fair' | 'poor' | 'bad';
  pricingRatio?: number;
  marketingBonus?: number;
}

const WEATHER_MULTIPLIERS: Record<string, number> = {
  perfect: 1.3,
  good: 1.1,
  fair: 1.0,
  poor: 0.7,
  bad: 0.3,
};

export function calculateSlotDemand(
  slot: TeeTime,
  day: number,
  factors: DemandFactors = {}
): ReservationDemand {
  const {
    baseDemand = 0.5,
    prestigeScore = 500,
    weatherCondition = 'good',
    pricingRatio = 1.0,
    marketingBonus = 0,
  } = factors;

  const dayOfWeek = getDayOfWeek(day);
  const dayOfWeekMultiplier = DAY_OF_WEEK_MULTIPLIERS[dayOfWeek];
  const timeOfDayMultiplier = getTimeOfDayMultiplier(slot.scheduledTime.hour);
  const seasonMultiplier = getSeasonMultiplier(day);
  const weatherMultiplier = WEATHER_MULTIPLIERS[weatherCondition] ?? 1.0;
  const prestigeMultiplier = 0.5 + (prestigeScore / 1000);
  const pricingMultiplier = pricingRatio <= 1.0 ? 1.0 : Math.max(0.3, 1.5 - pricingRatio * 0.5);
  const marketingMultiplier = 1.0 + marketingBonus;

  const finalDemand = baseDemand
    * dayOfWeekMultiplier
    * timeOfDayMultiplier
    * seasonMultiplier
    * weatherMultiplier
    * prestigeMultiplier
    * pricingMultiplier
    * marketingMultiplier;

  const bookingProbability = Math.min(1.0, Math.max(0, finalDemand));

  return {
    baseDemand,
    dayOfWeekMultiplier,
    timeOfDayMultiplier,
    seasonMultiplier,
    weatherMultiplier,
    prestigeMultiplier,
    pricingMultiplier,
    marketingMultiplier,
    finalDemand,
    bookingProbability,
  };
}

export function selectGroupSize(random: number = Math.random()): number {
  if (random < 0.05) return 1;   // 5% singles
  if (random < 0.15) return 2;   // 10% twosomes
  if (random < 0.30) return 3;   // 15% threesomes
  return 4;                       // 70% foursomes
}

export function canBookSlot(
  state: TeeTimeSystemState,
  teeTimeDay: number,
  currentDay: number,
  membershipStatus: MembershipStatus
): boolean {
  const maxDaysAhead = membershipStatus === 'member'
    ? state.bookingConfig.memberBookingDays
    : state.bookingConfig.publicBookingDays;

  const daysAhead = teeTimeDay - currentDay;
  return daysAhead > 0 && daysAhead <= maxDaysAhead;
}

export function isLateCancellation(
  teeTime: TeeTime,
  currentTime: GameTime,
  bookingConfig: BookingWindowConfig
): boolean {
  const teeTimeMinutes = teeTime.scheduledTime.day * 24 * 60
    + teeTime.scheduledTime.hour * 60
    + teeTime.scheduledTime.minute;
  const currentMinutes = currentTime.day * 24 * 60
    + currentTime.hour * 60
    + currentTime.minute;
  const hoursUntilTeeTime = (teeTimeMinutes - currentMinutes) / 60;
  return hoursUntilTeeTime < bookingConfig.freeCancellationHours;
}

export function calculateCancellationPenalty(
  teeTime: TeeTime,
  currentTime: GameTime,
  bookingConfig: BookingWindowConfig
): number {
  if (!isLateCancellation(teeTime, currentTime, bookingConfig)) {
    return 0;
  }
  return teeTime.totalRevenue * bookingConfig.lateCancelPenalty;
}

export function calculateNoShowPenalty(
  teeTime: TeeTime,
  bookingConfig: BookingWindowConfig
): number {
  return teeTime.totalRevenue * bookingConfig.noShowPenalty;
}

export interface BookingSimulationResult {
  newBookings: TeeTime[];
  cancellations: string[];
  noShows: string[];
  totalNewRevenue: number;
  totalCancellationPenalties: number;
  totalNoShowPenalties: number;
}

export function simulateDailyBookings(
  state: TeeTimeSystemState,
  targetDay: number,
  currentDay: number,
  factors: DemandFactors = {},
  greenFee: number = 50,
  cartFee: number = 20,
  randomFn: () => number = Math.random
): BookingSimulationResult {
  const availableSlots = getAvailableSlots(state, targetDay);
  const newBookings: TeeTime[] = [];
  let totalNewRevenue = 0;

  for (const slot of availableSlots) {
    const demand = calculateSlotDemand(slot, targetDay, factors);

    if (randomFn() < demand.bookingProbability) {
      const groupSize = selectGroupSize(randomFn());
      const golfers: GolferBooking[] = [];

      for (let i = 0; i < groupSize; i++) {
        golfers.push({
          golferId: `golfer-${targetDay}-${slot.id}-${i}`,
          name: `Golfer ${i + 1}`,
          membershipStatus: 'public',
          greenFee,
          cartFee,
          addOns: [],
        });
      }

      const totalSlotRevenue = groupSize * (greenFee + cartFee);
      totalNewRevenue += totalSlotRevenue;

      newBookings.push({
        ...slot,
        status: 'reserved',
        bookingType: 'reservation',
        golfers,
        groupSize,
        pricePerGolfer: greenFee + cartFee,
        totalRevenue: totalSlotRevenue,
        bookedAt: { day: currentDay, hour: 12, minute: 0 },
      });
    }
  }

  return {
    newBookings,
    cancellations: [],
    noShows: [],
    totalNewRevenue,
    totalCancellationPenalties: 0,
    totalNoShowPenalties: 0,
  };
}

export function applyBookingSimulation(
  state: TeeTimeSystemState,
  simulation: BookingSimulationResult,
  targetDay: number
): TeeTimeSystemState {
  const newTeeTimes = new Map(state.teeTimes);
  const existingSlots = getTeeTimes(state, targetDay);

  const updatedSlots = existingSlots.map(slot => {
    const booking = simulation.newBookings.find(b => b.id === slot.id);
    return booking ?? slot;
  });

  newTeeTimes.set(targetDay, updatedSlots);

  return {
    ...state,
    teeTimes: newTeeTimes,
    bookingMetrics: {
      ...state.bookingMetrics,
      totalBookingsToday: state.bookingMetrics.totalBookingsToday + simulation.newBookings.length,
    },
  };
}

export function resetDailyMetrics(state: TeeTimeSystemState): TeeTimeSystemState {
  return {
    ...state,
    bookingMetrics: {
      totalBookingsToday: 0,
      cancellationsToday: 0,
      noShowsToday: 0,
      lateCancellationsToday: 0,
    },
  };
}

export function updateBookingConfig(
  state: TeeTimeSystemState,
  config: Partial<BookingWindowConfig>
): TeeTimeSystemState {
  return {
    ...state,
    bookingConfig: { ...state.bookingConfig, ...config },
  };
}

export type PaceRating = 'excellent' | 'good' | 'acceptable' | 'slow' | 'terrible';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface SkillDistribution {
  beginner: number;
  intermediate: number;
  advanced: number;
  expert: number;
}

export interface PaceOfPlayState {
  targetRoundTime: number;
  averageRoundTime: number;
  backupLocations: number[];
  waitTimeMinutes: number;
  paceRating: PaceRating;
  satisfactionPenalty: number;
}

export const SKILL_TIME_PENALTIES: Record<SkillLevel, number> = {
  beginner: 0.5,
  intermediate: 0.15,
  advanced: 0,
  expert: -0.1,
} as const;

export const PACE_RATING_THRESHOLDS = {
  excellent: 3.75,
  good: 4.25,
  acceptable: 4.75,
  slow: 5.5,
} as const;

export const PACE_SATISFACTION_PENALTIES: Record<PaceRating, number> = {
  excellent: 0,
  good: 0,
  acceptable: -5,
  slow: -15,
  terrible: -30,
} as const;

export function getPaceRating(roundTime: number): PaceRating {
  if (roundTime <= PACE_RATING_THRESHOLDS.excellent) return 'excellent';
  if (roundTime <= PACE_RATING_THRESHOLDS.good) return 'good';
  if (roundTime <= PACE_RATING_THRESHOLDS.acceptable) return 'acceptable';
  if (roundTime <= PACE_RATING_THRESHOLDS.slow) return 'slow';
  return 'terrible';
}

export function calculateSkillPenalty(skillMix: SkillDistribution): number {
  const total = skillMix.beginner + skillMix.intermediate + skillMix.advanced + skillMix.expert;
  if (total === 0) return 0;

  return (
    (skillMix.beginner / total) * SKILL_TIME_PENALTIES.beginner +
    (skillMix.intermediate / total) * SKILL_TIME_PENALTIES.intermediate +
    (skillMix.advanced / total) * SKILL_TIME_PENALTIES.advanced +
    (skillMix.expert / total) * SKILL_TIME_PENALTIES.expert
  );
}

export function identifyBackupLocations(roundTime: number, spacing: SpacingConfiguration): number[] {
  const backups: number[] = [];
  if (roundTime <= 4.0) return backups;

  const excessTime = roundTime - 4.0;
  const backupProbability = Math.min(0.8, excessTime * spacing.backupRiskMultiplier * 0.3);

  const typicalBackupHoles = [4, 8, 12, 15, 17];
  for (const hole of typicalBackupHoles) {
    if (Math.random() < backupProbability) {
      backups.push(hole);
    }
  }
  return backups;
}

export function calculateWaitTime(roundTime: number, spacing: SpacingConfiguration): number {
  if (roundTime <= 4.0) return 0;
  const excessMinutes = (roundTime - 4.0) * 60;
  const waitPerHole = (excessMinutes / 18) * spacing.backupRiskMultiplier;
  return Math.round(waitPerHole * 10) / 10;
}

export function calculatePaceOfPlay(
  spacing: SpacingConfiguration,
  currentCapacity: number,
  courseConditions: number,
  skillMix: SkillDistribution = { beginner: 10, intermediate: 50, advanced: 30, expert: 10 }
): PaceOfPlayState {
  let roundTime = 4.0;

  roundTime += spacing.paceOfPlayPenalty;

  if (currentCapacity > 0.8) {
    roundTime += (currentCapacity - 0.8) * 1.5;
  }

  if (courseConditions < 50) {
    roundTime += (50 - courseConditions) * 0.02;
  }

  roundTime += calculateSkillPenalty(skillMix);

  const paceRating = getPaceRating(roundTime);
  const satisfactionPenalty = PACE_SATISFACTION_PENALTIES[paceRating];
  const backupLocations = identifyBackupLocations(roundTime, spacing);
  const waitTimeMinutes = calculateWaitTime(roundTime, spacing);

  return {
    targetRoundTime: 4.0,
    averageRoundTime: Math.round(roundTime * 100) / 100,
    backupLocations,
    waitTimeMinutes,
    paceRating,
    satisfactionPenalty,
  };
}

export function calculatePaceOfPlayDeterministic(
  spacing: SpacingConfiguration,
  currentCapacity: number,
  courseConditions: number,
  skillMix: SkillDistribution = { beginner: 10, intermediate: 50, advanced: 30, expert: 10 }
): Omit<PaceOfPlayState, 'backupLocations'> {
  let roundTime = 4.0;

  roundTime += spacing.paceOfPlayPenalty;

  if (currentCapacity > 0.8) {
    roundTime += (currentCapacity - 0.8) * 1.5;
  }

  if (courseConditions < 50) {
    roundTime += (50 - courseConditions) * 0.02;
  }

  roundTime += calculateSkillPenalty(skillMix);

  const paceRating = getPaceRating(roundTime);
  const satisfactionPenalty = PACE_SATISFACTION_PENALTIES[paceRating];
  const waitTimeMinutes = calculateWaitTime(roundTime, spacing);

  return {
    targetRoundTime: 4.0,
    averageRoundTime: Math.round(roundTime * 100) / 100,
    waitTimeMinutes,
    paceRating,
    satisfactionPenalty,
  };
}

export interface SpacingImpactPreview {
  maxDailyTeeTimes: number;
  estimatedRoundTime: number;
  paceRating: PaceRating;
  backupRisk: 'low' | 'medium' | 'high' | 'very_high';
  revenueMultiplier: number;
  reputationImpact: number;
  satisfactionPenalty: number;
}

export function previewSpacingImpact(
  spacing: TeeTimeSpacing,
  currentCapacity: number = 0.7,
  courseConditions: number = 80
): SpacingImpactPreview {
  const config = SPACING_CONFIGS[spacing];
  const pace = calculatePaceOfPlayDeterministic(config, currentCapacity, courseConditions);

  let backupRisk: SpacingImpactPreview['backupRisk'];
  if (config.backupRiskMultiplier <= 0.5) backupRisk = 'low';
  else if (config.backupRiskMultiplier <= 1.0) backupRisk = 'medium';
  else if (config.backupRiskMultiplier <= 2.0) backupRisk = 'high';
  else backupRisk = 'very_high';

  return {
    maxDailyTeeTimes: config.maxDailyTeeTimes,
    estimatedRoundTime: pace.averageRoundTime,
    paceRating: pace.paceRating,
    backupRisk,
    revenueMultiplier: config.revenueMultiplier,
    reputationImpact: config.reputationModifier,
    satisfactionPenalty: pace.satisfactionPenalty,
  };
}

export function getPaceRatingLabel(rating: PaceRating): string {
  switch (rating) {
    case 'excellent': return 'Excellent (≤3:45)';
    case 'good': return 'Good (≤4:15)';
    case 'acceptable': return 'Acceptable (≤4:45)';
    case 'slow': return 'Slow (≤5:30)';
    case 'terrible': return 'Very Slow (>5:30)';
  }
}

export function formatRoundTime(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}
