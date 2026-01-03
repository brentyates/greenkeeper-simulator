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

export interface TeeTimeSystemState {
  spacingConfig: SpacingConfiguration;
  operatingHours: CourseOperatingHours;
  teeTimes: Map<number, TeeTime[]>;
  currentDay: number;
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
    teeTimes: new Map(),
    currentDay: 0,
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
      const pricePerGolfer = golfers.length > 0 ? totalRevenue / golfers.length : 0;

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
