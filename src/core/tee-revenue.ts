export interface GreenFeeStructure {
  weekdayRate: number;
  weekendRate: number;
  twilightRate: number;
  primeMorningPremium: number;
  memberRate: number;
  guestOfMemberRate: number;
  dynamicPricingEnabled: boolean;
  demandMultiplierRange: [number, number];
}

const DEFAULT_GREEN_FEE_STRUCTURE: GreenFeeStructure = {
  weekdayRate: 45,
  weekendRate: 65,
  twilightRate: 30,
  primeMorningPremium: 1.2,
  memberRate: 0.7,
  guestOfMemberRate: 0.85,
  dynamicPricingEnabled: false,
  demandMultiplierRange: [0.8, 1.3],
} as const;

export type CartPricingModel = 'per_person' | 'per_cart';

export interface CartFeeStructure {
  pricingModel: CartPricingModel;
  standardCartFee: number;
  walkingDiscount: number;
  premiumCartFee?: number;
  cartRequired: boolean;
  cartIncluded: boolean;
}

const DEFAULT_CART_FEE_STRUCTURE: CartFeeStructure = {
  pricingModel: 'per_person',
  standardCartFee: 20,
  walkingDiscount: 0,
  premiumCartFee: undefined,
  cartRequired: false,
  cartIncluded: false,
} as const;

export interface AddOnService {
  id: string;
  name: string;
  price: number;
  offeredAtBooking: boolean;
  offeredAtCheckIn: boolean;
  offeredDuringRound: boolean;
  baseUptakeRate: number;
  prestigeUptakeBonus: number;
}

const STANDARD_ADDONS: AddOnService[] = [
  {
    id: 'range_balls',
    name: 'Range Balls',
    price: 10,
    offeredAtBooking: true,
    offeredAtCheckIn: true,
    offeredDuringRound: false,
    baseUptakeRate: 0.3,
    prestigeUptakeBonus: 0.1,
  },
  {
    id: 'caddie',
    name: 'Caddie Service',
    price: 75,
    offeredAtBooking: true,
    offeredAtCheckIn: true,
    offeredDuringRound: false,
    baseUptakeRate: 0.05,
    prestigeUptakeBonus: 0.15,
  },
  {
    id: 'forecaddie',
    name: 'Forecaddie (Group)',
    price: 50,
    offeredAtBooking: true,
    offeredAtCheckIn: false,
    offeredDuringRound: false,
    baseUptakeRate: 0.08,
    prestigeUptakeBonus: 0.10,
  },
  {
    id: 'club_rental',
    name: 'Club Rental',
    price: 60,
    offeredAtBooking: true,
    offeredAtCheckIn: true,
    offeredDuringRound: false,
    baseUptakeRate: 0.08,
    prestigeUptakeBonus: 0.02,
  },
  {
    id: 'gps_rental',
    name: 'GPS Device Rental',
    price: 15,
    offeredAtBooking: false,
    offeredAtCheckIn: true,
    offeredDuringRound: false,
    baseUptakeRate: 0.15,
    prestigeUptakeBonus: 0.05,
  },
] as const;

export interface TipConfig {
  baseTipPercentage: number;
  satisfactionModifier: number;
  tipPooling: boolean;
  housePercentage: number;
}

const DEFAULT_TIP_CONFIG: TipConfig = {
  baseTipPercentage: 0.15,
  satisfactionModifier: 1.0,
  tipPooling: false,
  housePercentage: 0,
} as const;

export interface DailyRevenue {
  greenFees: number;
  cartFees: number;
  addOnServices: number;
  tips: number;
  proShop: number;
  foodAndBeverage: number;
  rangeRevenue: number;
  lessonRevenue: number;
  eventFees: number;
  grossRevenue: number;
  operatingCosts: number;
  netRevenue: number;
}

function createEmptyDailyRevenue(): DailyRevenue {
  return {
    greenFees: 0,
    cartFees: 0,
    addOnServices: 0,
    tips: 0,
    proShop: 0,
    foodAndBeverage: 0,
    rangeRevenue: 0,
    lessonRevenue: 0,
    eventFees: 0,
    grossRevenue: 0,
    operatingCosts: 0,
    netRevenue: 0,
  };
}

export interface RevenueState {
  greenFeeStructure: GreenFeeStructure;
  cartFeeStructure: CartFeeStructure;
  availableAddOns: AddOnService[];
  tipConfig: TipConfig;
  todaysRevenue: DailyRevenue;
  revenueHistory: DailyRevenue[];
}

export function createInitialRevenueState(): RevenueState {
  return {
    greenFeeStructure: { ...DEFAULT_GREEN_FEE_STRUCTURE },
    cartFeeStructure: { ...DEFAULT_CART_FEE_STRUCTURE },
    availableAddOns: [...STANDARD_ADDONS],
    tipConfig: { ...DEFAULT_TIP_CONFIG },
    todaysRevenue: createEmptyDailyRevenue(),
    revenueHistory: [],
  };
}

export function isWeekend(dayOfWeek: number): boolean {
  return dayOfWeek === 0 || dayOfWeek === 6;
}

export function isPrimeMorning(hour: number): boolean {
  return hour >= 7 && hour < 10;
}

export function isTwilightHour(hour: number, twilightStart: number = 14): boolean {
  return hour >= twilightStart;
}

export type MembershipType = 'public' | 'member' | 'guest_of_member';

export function calculateGreenFee(
  structure: GreenFeeStructure,
  dayOfWeek: number,
  hour: number,
  membershipType: MembershipType = 'public',
  twilightStart: number = 14,
  demandMultiplier: number = 1.0
): number {
  let baseRate: number;

  if (isTwilightHour(hour, twilightStart)) {
    baseRate = structure.twilightRate;
  } else if (isWeekend(dayOfWeek)) {
    baseRate = structure.weekendRate;
  } else {
    baseRate = structure.weekdayRate;
  }

  if (isPrimeMorning(hour) && !isTwilightHour(hour, twilightStart)) {
    baseRate *= structure.primeMorningPremium;
  }

  switch (membershipType) {
    case 'member':
      baseRate *= structure.memberRate;
      break;
    case 'guest_of_member':
      baseRate *= structure.guestOfMemberRate;
      break;
  }

  if (structure.dynamicPricingEnabled) {
    const [min, max] = structure.demandMultiplierRange;
    const clampedMultiplier = Math.max(min, Math.min(max, demandMultiplier));
    baseRate *= clampedMultiplier;
  }

  return Math.round(baseRate * 100) / 100;
}

export function calculateCartFee(
  structure: CartFeeStructure,
  isWalking: boolean = false,
  usePremiumCart: boolean = false,
  groupSize: number = 1
): number {
  if (structure.cartIncluded) return 0;
  if (isWalking) return structure.walkingDiscount;

  let feePerPerson = usePremiumCart && structure.premiumCartFee
    ? structure.premiumCartFee
    : structure.standardCartFee;

  if (structure.pricingModel === 'per_cart') {
    return feePerPerson * Math.ceil(groupSize / 2);
  }

  return feePerPerson * groupSize;
}

export function finalizeDailyRevenue(state: RevenueState): RevenueState {
  return {
    ...state,
    revenueHistory: [...state.revenueHistory, state.todaysRevenue],
    todaysRevenue: createEmptyDailyRevenue(),
  };
}

export function calculateAverageRevenue(
  state: RevenueState,
  days: number
): DailyRevenue {
  const count = Math.min(days, state.revenueHistory.length);
  if (count === 0) return createEmptyDailyRevenue();

  const totals = createEmptyDailyRevenue();
  for (let i = state.revenueHistory.length - count; i < state.revenueHistory.length; i++) {
    const day = state.revenueHistory[i];
    totals.greenFees += day.greenFees;
    totals.cartFees += day.cartFees;
    totals.addOnServices += day.addOnServices;
    totals.tips += day.tips;
    totals.proShop += day.proShop;
    totals.foodAndBeverage += day.foodAndBeverage;
    totals.rangeRevenue += day.rangeRevenue;
    totals.lessonRevenue += day.lessonRevenue;
    totals.eventFees += day.eventFees;
    totals.grossRevenue += day.grossRevenue;
    totals.operatingCosts += day.operatingCosts;
    totals.netRevenue += day.netRevenue;
  }

  return {
    greenFees: Math.round((totals.greenFees / count) * 100) / 100,
    cartFees: Math.round((totals.cartFees / count) * 100) / 100,
    addOnServices: Math.round((totals.addOnServices / count) * 100) / 100,
    tips: Math.round((totals.tips / count) * 100) / 100,
    proShop: Math.round((totals.proShop / count) * 100) / 100,
    foodAndBeverage: Math.round((totals.foodAndBeverage / count) * 100) / 100,
    rangeRevenue: Math.round((totals.rangeRevenue / count) * 100) / 100,
    lessonRevenue: Math.round((totals.lessonRevenue / count) * 100) / 100,
    eventFees: Math.round((totals.eventFees / count) * 100) / 100,
    grossRevenue: Math.round((totals.grossRevenue / count) * 100) / 100,
    operatingCosts: Math.round((totals.operatingCosts / count) * 100) / 100,
    netRevenue: Math.round((totals.netRevenue / count) * 100) / 100,
  };
}

export function getRevenueSummary(state: RevenueState): {
  today: DailyRevenue;
  weeklyAverage: DailyRevenue;
  monthlyAverage: DailyRevenue;
  totalHistoricalDays: number;
} {
  return {
    today: state.todaysRevenue,
    weeklyAverage: calculateAverageRevenue(state, 7),
    monthlyAverage: calculateAverageRevenue(state, 30),
    totalHistoricalDays: state.revenueHistory.length,
  };
}
