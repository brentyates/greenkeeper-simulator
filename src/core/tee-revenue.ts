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

export const DEFAULT_GREEN_FEE_STRUCTURE: GreenFeeStructure = {
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

export const DEFAULT_CART_FEE_STRUCTURE: CartFeeStructure = {
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

export const STANDARD_ADDONS: AddOnService[] = [
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

export type TippableStaff = 'caddie' | 'cart_attendant' | 'beverage_cart' | 'pro_shop';

export interface TipConfig {
  baseTipPercentage: number;
  satisfactionModifier: number;
  tipPooling: boolean;
  housePercentage: number;
}

export const DEFAULT_TIP_CONFIG: TipConfig = {
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

export function createEmptyDailyRevenue(): DailyRevenue {
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

export function calculateAddOnUptake(
  addOn: AddOnService,
  prestigeScore: number,
  randomValue: number = Math.random()
): boolean {
  const prestigeBonus = (prestigeScore / 1000) * addOn.prestigeUptakeBonus;
  const uptakeRate = Math.min(1.0, addOn.baseUptakeRate + prestigeBonus);
  return randomValue < uptakeRate;
}

export function generateAddOnsForGolfer(
  availableAddOns: AddOnService[],
  phase: 'booking' | 'check_in' | 'during_round',
  prestigeScore: number,
  randomFn: () => number = Math.random
): AddOnService[] {
  const selectedAddOns: AddOnService[] = [];

  for (const addOn of availableAddOns) {
    const offered =
      (phase === 'booking' && addOn.offeredAtBooking) ||
      (phase === 'check_in' && addOn.offeredAtCheckIn) ||
      (phase === 'during_round' && addOn.offeredDuringRound);

    if (offered && calculateAddOnUptake(addOn, prestigeScore, randomFn())) {
      selectedAddOns.push(addOn);
    }
  }

  return selectedAddOns;
}

export function calculateTotalAddOnRevenue(addOns: AddOnService[]): number {
  return addOns.reduce((sum, a) => sum + a.price, 0);
}

export function calculateTip(
  serviceValue: number,
  golferSatisfaction: number,
  tipConfig: TipConfig
): number {
  const baseTip = serviceValue * tipConfig.baseTipPercentage;
  const satisfactionMod = 1 + (golferSatisfaction / 100) * tipConfig.satisfactionModifier;
  const grossTip = baseTip * Math.max(0, satisfactionMod);
  const netTip = grossTip * (1 - tipConfig.housePercentage);
  return Math.round(netTip * 100) / 100;
}

export function calculateRoundRevenue(
  greenFee: number,
  cartFee: number,
  addOns: AddOnService[],
  tipableServiceValue: number,
  satisfaction: number,
  tipConfig: TipConfig
): {
  greenFees: number;
  cartFees: number;
  addOnServices: number;
  tips: number;
  total: number;
} {
  const addOnServices = calculateTotalAddOnRevenue(addOns);
  const tips = calculateTip(tipableServiceValue, satisfaction, tipConfig);
  const total = greenFee + cartFee + addOnServices + tips;

  return {
    greenFees: greenFee,
    cartFees: cartFee,
    addOnServices,
    tips,
    total,
  };
}

export function addRevenueToDaily(
  daily: DailyRevenue,
  revenue: {
    greenFees?: number;
    cartFees?: number;
    addOnServices?: number;
    tips?: number;
    proShop?: number;
    foodAndBeverage?: number;
    rangeRevenue?: number;
    lessonRevenue?: number;
    eventFees?: number;
  }
): DailyRevenue {
  const updated: DailyRevenue = {
    greenFees: daily.greenFees + (revenue.greenFees ?? 0),
    cartFees: daily.cartFees + (revenue.cartFees ?? 0),
    addOnServices: daily.addOnServices + (revenue.addOnServices ?? 0),
    tips: daily.tips + (revenue.tips ?? 0),
    proShop: daily.proShop + (revenue.proShop ?? 0),
    foodAndBeverage: daily.foodAndBeverage + (revenue.foodAndBeverage ?? 0),
    rangeRevenue: daily.rangeRevenue + (revenue.rangeRevenue ?? 0),
    lessonRevenue: daily.lessonRevenue + (revenue.lessonRevenue ?? 0),
    eventFees: daily.eventFees + (revenue.eventFees ?? 0),
    grossRevenue: 0,
    operatingCosts: daily.operatingCosts,
    netRevenue: 0,
  };

  updated.grossRevenue =
    updated.greenFees +
    updated.cartFees +
    updated.addOnServices +
    updated.tips +
    updated.proShop +
    updated.foodAndBeverage +
    updated.rangeRevenue +
    updated.lessonRevenue +
    updated.eventFees;

  updated.netRevenue = updated.grossRevenue - updated.operatingCosts;

  return updated;
}

export function setOperatingCosts(daily: DailyRevenue, costs: number): DailyRevenue {
  return {
    ...daily,
    operatingCosts: costs,
    netRevenue: daily.grossRevenue - costs,
  };
}

export function finalizeDailyRevenue(state: RevenueState): RevenueState {
  return {
    ...state,
    revenueHistory: [...state.revenueHistory, state.todaysRevenue],
    todaysRevenue: createEmptyDailyRevenue(),
  };
}

export function getRevenueForDay(state: RevenueState, daysAgo: number): DailyRevenue | undefined {
  if (daysAgo === 0) return state.todaysRevenue;
  const index = state.revenueHistory.length - daysAgo;
  return index >= 0 ? state.revenueHistory[index] : undefined;
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

export function updateGreenFeeStructure(
  state: RevenueState,
  structure: Partial<GreenFeeStructure>
): RevenueState {
  return {
    ...state,
    greenFeeStructure: { ...state.greenFeeStructure, ...structure },
  };
}

export function updateCartFeeStructure(
  state: RevenueState,
  structure: Partial<CartFeeStructure>
): RevenueState {
  return {
    ...state,
    cartFeeStructure: { ...state.cartFeeStructure, ...structure },
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
