import type { TeeTime, TeeTimeSystemState, GameTime } from './tee-times';
import type { GreenFeeStructure } from './tee-revenue';

export interface DynamicPricingConfig {
  enabled: boolean;
  minMultiplier: number;
  maxMultiplier: number;
  targetBookingRate: number;
  adjustmentSpeed: number;
}

export const DEFAULT_DYNAMIC_PRICING: DynamicPricingConfig = {
  enabled: false,
  minMultiplier: 0.8,
  maxMultiplier: 1.3,
  targetBookingRate: 0.75,
  adjustmentSpeed: 0.05,
} as const;

export function calculateDynamicMultiplier(
  config: DynamicPricingConfig,
  currentBookingRate: number
): number {
  if (!config.enabled) return 1.0;

  const deviation = currentBookingRate - config.targetBookingRate;
  let multiplier = 1.0 + (deviation * config.adjustmentSpeed * 10);

  multiplier = Math.max(config.minMultiplier, Math.min(config.maxMultiplier, multiplier));
  return Math.round(multiplier * 100) / 100;
}

export function calculateBookingRate(state: TeeTimeSystemState): number {
  const availableSlots = state.todaySlots.filter(s => s.status === 'available').length;
  const totalSlots = state.todaySlots.length;
  if (totalSlots === 0) return 0;

  const bookedSlots = totalSlots - availableSlots;
  return Math.round((bookedSlots / totalSlots) * 100) / 100;
}

export interface MemberPriorityConfig {
  enabled: boolean;
  memberBookingDaysAdvance: number;
  publicBookingDaysAdvance: number;
  reservedMemberSlots: number;
  premiumSlotStartHour: number;
  premiumSlotEndHour: number;
}

export const DEFAULT_MEMBER_PRIORITY: MemberPriorityConfig = {
  enabled: false,
  memberBookingDaysAdvance: 14,
  publicBookingDaysAdvance: 7,
  reservedMemberSlots: 4,
  premiumSlotStartHour: 7,
  premiumSlotEndHour: 10,
} as const;

export function isPremiumSlot(config: MemberPriorityConfig, hour: number): boolean {
  return hour >= config.premiumSlotStartHour && hour < config.premiumSlotEndHour;
}

export function canBookAsMember(
  config: MemberPriorityConfig,
  currentDay: number,
  targetDay: number
): boolean {
  const daysAhead = targetDay - currentDay;
  return daysAhead <= config.memberBookingDaysAdvance;
}

export function canBookAsPublic(
  config: MemberPriorityConfig,
  currentDay: number,
  targetDay: number
): boolean {
  const daysAhead = targetDay - currentDay;
  return daysAhead <= config.publicBookingDaysAdvance;
}

export function countReservedMemberSlots(
  slots: TeeTime[],
  config: MemberPriorityConfig
): number {
  const premiumAvailable = slots.filter(
    s => s.status === 'available' && isPremiumSlot(config, s.scheduledTime.hour)
  );
  return Math.min(config.reservedMemberSlots, premiumAvailable.length);
}

export function isMemberReservedSlot(
  slot: TeeTime,
  config: MemberPriorityConfig,
  allSlots: TeeTime[],
  currentDay: number,
  targetDay: number
): boolean {
  if (!config.enabled) return false;
  if (!isPremiumSlot(config, slot.scheduledTime.hour)) return false;

  if (canBookAsPublic(config, currentDay, targetDay)) {
    return false;
  }

  const premiumSlots = allSlots.filter(
    s => s.status === 'available' && isPremiumSlot(config, s.scheduledTime.hour)
  ).sort((a, b) => {
    const aMin = a.scheduledTime.hour * 60 + a.scheduledTime.minute;
    const bMin = b.scheduledTime.hour * 60 + b.scheduledTime.minute;
    return aMin - bMin;
  });

  const slotIndex = premiumSlots.findIndex(s => s.id === slot.id);
  return slotIndex >= 0 && slotIndex < config.reservedMemberSlots;
}

export type TournamentType = 'club_championship' | 'member_guest' | 'charity_event' | 'corporate_outing' | 'pro_am' | 'qualifier';

export interface TournamentConfig {
  id: string;
  name: string;
  type: TournamentType;
  dayOfYear: number;
  duration: number;
  entryFee: number;
  maxParticipants: number;
  prestigeBonus: number;
  courseClosedFully: boolean;
  teeTimesReserved: number;
}

export interface TournamentState {
  scheduledTournaments: TournamentConfig[];
  completedTournaments: string[];
  revenueFromTournaments: number;
  participantsServed: number;
}

export function createInitialTournamentState(): TournamentState {
  return {
    scheduledTournaments: [],
    completedTournaments: [],
    revenueFromTournaments: 0,
    participantsServed: 0,
  };
}

export function scheduleTournament(
  state: TournamentState,
  config: TournamentConfig
): TournamentState {
  const exists = state.scheduledTournaments.some(t => t.id === config.id);
  if (exists) return state;

  return {
    ...state,
    scheduledTournaments: [...state.scheduledTournaments, config],
  };
}

export function cancelTournament(
  state: TournamentState,
  tournamentId: string
): TournamentState {
  return {
    ...state,
    scheduledTournaments: state.scheduledTournaments.filter(t => t.id !== tournamentId),
  };
}

export function isTournamentDay(
  state: TournamentState,
  dayOfYear: number
): boolean {
  return state.scheduledTournaments.some(t => {
    const endDay = t.dayOfYear + t.duration - 1;
    return dayOfYear >= t.dayOfYear && dayOfYear <= endDay;
  });
}

export function getTournamentForDay(
  state: TournamentState,
  dayOfYear: number
): TournamentConfig | undefined {
  return state.scheduledTournaments.find(t => {
    const endDay = t.dayOfYear + t.duration - 1;
    return dayOfYear >= t.dayOfYear && dayOfYear <= endDay;
  });
}

export function isCourseClosedForTournament(
  state: TournamentState,
  dayOfYear: number
): boolean {
  const tournament = getTournamentForDay(state, dayOfYear);
  return tournament?.courseClosedFully ?? false;
}

export function getAvailableSlotsForTournament(
  slots: TeeTime[],
  tournament: TournamentConfig
): number {
  if (tournament.courseClosedFully) {
    return 0;
  }
  return Math.max(0, slots.length - tournament.teeTimesReserved);
}

export function completeTournament(
  state: TournamentState,
  tournament: TournamentConfig,
  actualParticipants: number
): TournamentState {
  const revenue = tournament.entryFee * actualParticipants;

  return {
    ...state,
    scheduledTournaments: state.scheduledTournaments.filter(t => t.id !== tournament.id),
    completedTournaments: [...state.completedTournaments, tournament.id],
    revenueFromTournaments: state.revenueFromTournaments + revenue,
    participantsServed: state.participantsServed + actualParticipants,
  };
}

export function calculateTournamentPrestige(
  tournament: TournamentConfig,
  actualParticipants: number
): number {
  const participationRate = actualParticipants / tournament.maxParticipants;
  const baseBonus = tournament.prestigeBonus;
  const modifier = Math.min(1.5, 0.5 + participationRate);
  return Math.round(baseBonus * modifier);
}

export interface GroupBookingConfig {
  enabled: boolean;
  minGroupSize: number;
  discountPercentage: number;
  maxGroupSize: number;
  depositRequired: number;
}

export const DEFAULT_GROUP_BOOKING: GroupBookingConfig = {
  enabled: true,
  minGroupSize: 8,
  discountPercentage: 15,
  maxGroupSize: 24,
  depositRequired: 0.25,
} as const;

export type GroupBookingStatus = 'inquiry' | 'confirmed' | 'deposit_paid' | 'checked_in' | 'completed' | 'cancelled';

export interface GroupBooking {
  id: string;
  organizerName: string;
  organizerContact: string;
  groupSize: number;
  dayOfYear: number;
  startTime: GameTime;
  status: GroupBookingStatus;
  discountApplied: number;
  depositPaid: number;
  totalPrice: number;
  reservedSlotIds: string[];
  notes: string;
}

export interface GroupBookingState {
  config: GroupBookingConfig;
  bookings: GroupBooking[];
  totalGroupRevenue: number;
  groupsServed: number;
}

export function createInitialGroupBookingState(
  config: Partial<GroupBookingConfig> = {}
): GroupBookingState {
  return {
    config: { ...DEFAULT_GROUP_BOOKING, ...config },
    bookings: [],
    totalGroupRevenue: 0,
    groupsServed: 0,
  };
}

export function calculateGroupDiscount(
  config: GroupBookingConfig,
  groupSize: number,
  basePrice: number
): number {
  if (!config.enabled) return 0;
  if (groupSize < config.minGroupSize) return 0;

  return Math.round(basePrice * (config.discountPercentage / 100) * 100) / 100;
}

export function calculateGroupTotal(
  config: GroupBookingConfig,
  greenFeeStructure: GreenFeeStructure,
  groupSize: number,
  isWeekend: boolean
): { subtotal: number; discount: number; total: number; deposit: number } {
  const perPersonFee = isWeekend ? greenFeeStructure.weekendRate : greenFeeStructure.weekdayRate;
  const subtotal = perPersonFee * groupSize;
  const discount = calculateGroupDiscount(config, groupSize, subtotal);
  const total = Math.round((subtotal - discount) * 100) / 100;
  const deposit = Math.round(total * config.depositRequired * 100) / 100;

  return { subtotal, discount, total, deposit };
}

export function calculateSlotsNeeded(groupSize: number): number {
  return Math.ceil(groupSize / 4);
}

export function createGroupBooking(
  state: GroupBookingState,
  booking: Omit<GroupBooking, 'status' | 'depositPaid' | 'totalPrice'>
): GroupBookingState {
  if (booking.groupSize > state.config.maxGroupSize) {
    return state;
  }

  const newBooking: GroupBooking = {
    ...booking,
    status: 'inquiry',
    depositPaid: 0,
    totalPrice: 0,
  };

  return {
    ...state,
    bookings: [...state.bookings, newBooking],
  };
}

export function confirmGroupBooking(
  state: GroupBookingState,
  bookingId: string,
  totalPrice: number,
  depositPaid: number
): GroupBookingState {
  return {
    ...state,
    bookings: state.bookings.map(b =>
      b.id === bookingId
        ? {
            ...b,
            status: depositPaid >= totalPrice * state.config.depositRequired
              ? 'deposit_paid' as const
              : 'confirmed' as const,
            totalPrice,
            depositPaid,
          }
        : b
    ),
  };
}

export function cancelGroupBooking(
  state: GroupBookingState,
  bookingId: string
): GroupBookingState {
  return {
    ...state,
    bookings: state.bookings.map(b =>
      b.id === bookingId ? { ...b, status: 'cancelled' as const } : b
    ),
  };
}

export function completeGroupBooking(
  state: GroupBookingState,
  bookingId: string
): GroupBookingState {
  const booking = state.bookings.find(b => b.id === bookingId);
  if (!booking) return state;

  return {
    ...state,
    bookings: state.bookings.map(b =>
      b.id === bookingId ? { ...b, status: 'completed' as const } : b
    ),
    totalGroupRevenue: state.totalGroupRevenue + booking.totalPrice,
    groupsServed: state.groupsServed + 1,
  };
}

export function getGroupBookingsForDay(
  state: GroupBookingState,
  dayOfYear: number
): GroupBooking[] {
  return state.bookings.filter(
    b => b.dayOfYear === dayOfYear && b.status !== 'cancelled'
  );
}

export function getActiveGroupBookings(state: GroupBookingState): GroupBooking[] {
  return state.bookings.filter(
    b => b.status !== 'cancelled' && b.status !== 'completed'
  );
}

export interface AdvancedTeeTimeState {
  dynamicPricing: DynamicPricingConfig;
  memberPriority: MemberPriorityConfig;
  tournaments: TournamentState;
  groupBookings: GroupBookingState;
}

export function createInitialAdvancedState(): AdvancedTeeTimeState {
  return {
    dynamicPricing: { ...DEFAULT_DYNAMIC_PRICING },
    memberPriority: { ...DEFAULT_MEMBER_PRIORITY },
    tournaments: createInitialTournamentState(),
    groupBookings: createInitialGroupBookingState(),
  };
}

export function updateDynamicPricingConfig(
  state: AdvancedTeeTimeState,
  config: Partial<DynamicPricingConfig>
): AdvancedTeeTimeState {
  return {
    ...state,
    dynamicPricing: { ...state.dynamicPricing, ...config },
  };
}

export function updateMemberPriorityConfig(
  state: AdvancedTeeTimeState,
  config: Partial<MemberPriorityConfig>
): AdvancedTeeTimeState {
  return {
    ...state,
    memberPriority: { ...state.memberPriority, ...config },
  };
}

export function getAdvancedSummary(state: AdvancedTeeTimeState): {
  dynamicPricingEnabled: boolean;
  memberPriorityEnabled: boolean;
  scheduledTournaments: number;
  activeGroupBookings: number;
  totalTournamentRevenue: number;
  totalGroupRevenue: number;
} {
  return {
    dynamicPricingEnabled: state.dynamicPricing.enabled,
    memberPriorityEnabled: state.memberPriority.enabled,
    scheduledTournaments: state.tournaments.scheduledTournaments.length,
    activeGroupBookings: getActiveGroupBookings(state.groupBookings).length,
    totalTournamentRevenue: state.tournaments.revenueFromTournaments,
    totalGroupRevenue: state.groupBookings.totalGroupRevenue,
  };
}
