import { generateRandomName } from "./employees";

export type GolferType =
  | "casual"
  | "regular"
  | "enthusiast"
  | "professional"
  | "tourist";

export type GolferStatus =
  | "arriving"
  | "checking_in"
  | "playing"
  | "finishing"
  | "leaving";

type SatisfactionFactor =
  | "course_condition"
  | "pace_of_play"
  | "facilities"
  | "price_value"
  | "staff_service"
  | "weather";

interface GolferPreferences {
  readonly priceThreshold: number;
  readonly qualityExpectation: number;
  readonly patienceLevel: number;
  readonly tipGenerosity: number;
}

export interface Golfer {
  readonly id: string;
  readonly name: string;
  readonly type: GolferType;
  readonly preferences: GolferPreferences;
  readonly status: GolferStatus;
  readonly arrivalTime: number;
  readonly holesPlayed: number;
  readonly totalHoles: number;
  readonly paidAmount: number;
  readonly satisfaction: number;
  readonly satisfactionFactors: Partial<Record<SatisfactionFactor, number>>;
  readonly willReturn: boolean;
}

export interface GreenFeeStructure {
  readonly weekday9Holes: number;
  readonly weekday18Holes: number;
  readonly weekend9Holes: number;
  readonly weekend18Holes: number;
  readonly twilight9Holes: number;
  readonly twilight18Holes: number;
}

export interface CourseRating {
  readonly overall: number;
  readonly condition: number;
  readonly difficulty: number;
  readonly amenities: number;
  readonly value: number;
}

export interface GolferPoolState {
  readonly golfers: readonly Golfer[];
  readonly dailyVisitors: number;
  readonly peakCapacity: number;
  readonly totalVisitorsToday: number;
  readonly totalRevenueToday: number;
  readonly rating: CourseRating;
}

export interface WeatherCondition {
  readonly type: "sunny" | "cloudy" | "rainy" | "stormy";
  readonly temperature: number;
  readonly windSpeed: number;
}

const GOLFER_TYPE_WEIGHTS: Record<GolferType, number> = {
  casual: 0.35,
  regular: 0.30,
  enthusiast: 0.20,
  professional: 0.05,
  tourist: 0.10
};

const GOLFER_TYPE_CONFIGS: Record<GolferType, {
  priceRange: [number, number];
  qualityRange: [number, number];
  patienceRange: [number, number];
  tipRange: [number, number];
}> = {
  casual: {
    priceRange: [25, 60],
    qualityRange: [30, 60],
    patienceRange: [40, 70],
    tipRange: [0.5, 1.0]
  },
  regular: {
    priceRange: [40, 80],
    qualityRange: [50, 75],
    patienceRange: [50, 80],
    tipRange: [0.8, 1.2]
  },
  enthusiast: {
    priceRange: [60, 120],
    qualityRange: [65, 90],
    patienceRange: [30, 60],
    tipRange: [1.0, 1.5]
  },
  professional: {
    priceRange: [80, 200],
    qualityRange: [80, 100],
    patienceRange: [20, 50],
    tipRange: [1.2, 2.0]
  },
  tourist: {
    priceRange: [50, 100],
    qualityRange: [40, 70],
    patienceRange: [60, 90],
    tipRange: [1.0, 1.8]
  }
};

export const DEFAULT_GREEN_FEES: GreenFeeStructure = {
  weekday9Holes: 35,
  weekday18Holes: 55,
  weekend9Holes: 45,
  weekend18Holes: 75,
  twilight9Holes: 25,
  twilight18Holes: 40
};

const SATISFACTION_WEIGHTS: Record<SatisfactionFactor, number> = {
  course_condition: 0.30,
  pace_of_play: 0.20,
  facilities: 0.15,
  price_value: 0.15,
  staff_service: 0.10,
  weather: 0.10
};

const WEATHER_SATISFACTION_MODIFIERS: Record<WeatherCondition["type"], number> = {
  sunny: 1.0,
  cloudy: 0.9,
  rainy: 0.6,
  stormy: 0.3
};

const BASE_ARRIVAL_RATE = 4;
const HOLES_PER_HOUR = 2;

let golferIdCounter = 0;

export function createInitialPoolState(peakCapacity: number = 40): GolferPoolState {
  return {
    golfers: [],
    dailyVisitors: 0,
    peakCapacity,
    totalVisitorsToday: 0,
    totalRevenueToday: 0,
    rating: {
      overall: 70,
      condition: 70,
      difficulty: 50,
      amenities: 60,
      value: 70
    }
  };
}

function generateGolferPreferences(
  type: GolferType,
  seed?: number
): GolferPreferences {
  const config = GOLFER_TYPE_CONFIGS[type];
  const getRandom = () => seed !== undefined ? (seed * 9301 + 49297) % 233280 / 233280 : Math.random();

  const lerp = (min: number, max: number) => min + getRandom() * (max - min);

  return {
    priceThreshold: Math.round(lerp(config.priceRange[0], config.priceRange[1])),
    qualityExpectation: Math.round(lerp(config.qualityRange[0], config.qualityRange[1])),
    patienceLevel: Math.round(lerp(config.patienceRange[0], config.patienceRange[1])),
    tipGenerosity: Math.round(lerp(config.tipRange[0], config.tipRange[1]) * 100) / 100
  };
}

function selectGolferType(seed?: number): GolferType {
  const getRandom = () => seed !== undefined ? seed : Math.random();
  const roll = getRandom();

  let cumulative = 0;
  for (const [type, weight] of Object.entries(GOLFER_TYPE_WEIGHTS)) {
    cumulative += weight;
    if (roll < cumulative) {
      return type as GolferType;
    }
  }

  return "casual";
}

export function createGolfer(
  type: GolferType,
  arrivalTime: number,
  holes: 9 | 18 = 18,
  paidAmount: number = 0,
  preferences?: GolferPreferences
): Golfer {
  return {
    id: `golfer_${++golferIdCounter}`,
    name: generateRandomName(),
    type,
    preferences: preferences ?? generateGolferPreferences(type),
    status: "arriving",
    arrivalTime,
    holesPlayed: 0,
    totalHoles: holes,
    paidAmount,
    satisfaction: 75,
    satisfactionFactors: {},
    willReturn: false
  };
}

export function getGolfer(state: GolferPoolState, golferId: string): Golfer | null {
  return state.golfers.find(g => g.id === golferId) ?? null;
}

export function getActiveGolferCount(state: GolferPoolState): number {
  return state.golfers.filter(g =>
    g.status === "playing" || g.status === "checking_in"
  ).length;
}

function calculateCrowdingLevel(state: GolferPoolState): number {
  const active = getActiveGolferCount(state);
  return Math.min(100, (active / state.peakCapacity) * 100);
}

export function getAverageSatisfaction(state: GolferPoolState): number {
  if (state.golfers.length === 0) return 75;
  return state.golfers.reduce((sum, g) => sum + g.satisfaction, 0) / state.golfers.length;
}

function getGreenFee(
  fees: GreenFeeStructure,
  holes: 9 | 18,
  isWeekend: boolean,
  isTwilight: boolean
): number {
  if (isTwilight) {
    return holes === 9 ? fees.twilight9Holes : fees.twilight18Holes;
  }

  if (isWeekend) {
    return holes === 9 ? fees.weekend9Holes : fees.weekend18Holes;
  }

  return holes === 9 ? fees.weekday9Holes : fees.weekday18Holes;
}

function wouldPayFee(golfer: Golfer, fee: number): boolean {
  return fee <= golfer.preferences.priceThreshold;
}

function calculateTip(golfer: Golfer, baseService: number = 5): number {
  const satisfactionModifier = golfer.satisfaction / 75;
  return Math.round(baseService * golfer.preferences.tipGenerosity * satisfactionModifier * 100) / 100;
}

function calculateSatisfactionFactor(
  factor: SatisfactionFactor,
  value: number,
  golfer: Golfer
): number {
  switch (factor) {
    case "course_condition":
      const qualityPenalty = Math.max(0, golfer.preferences.qualityExpectation - value);
      return Math.max(0, 100 - qualityPenalty * 1.5);

    case "pace_of_play":
      const paceThreshold = golfer.preferences.patienceLevel;
      if (value >= paceThreshold) {
        return Math.max(0, 100 - (value - paceThreshold) * 2);
      }
      return 100;

    case "price_value":
      return value;

    case "staff_service":
      return value;

    case "facilities":
      return value;

    case "weather":
      return value;

    default:
      return value;
  }
}

function updateSatisfaction(
  golfer: Golfer,
  factors: Partial<Record<SatisfactionFactor, number>>
): Golfer {
  const updatedFactors = { ...golfer.satisfactionFactors };

  for (const [factor, value] of Object.entries(factors)) {
    const factorKey = factor as SatisfactionFactor;
    const factorSatisfaction = calculateSatisfactionFactor(factorKey, value, golfer);
    updatedFactors[factorKey] = factorSatisfaction;
  }

  let totalWeight = 0;
  let weightedSum = 0;

  for (const [factor, satisfaction] of Object.entries(updatedFactors)) {
    const weight = SATISFACTION_WEIGHTS[factor as SatisfactionFactor];
    if (weight) {
      totalWeight += weight;
      weightedSum += satisfaction * weight;
    }
  }

  const newSatisfaction = totalWeight > 0
    ? Math.round(weightedSum / totalWeight)
    : golfer.satisfaction;

  return {
    ...golfer,
    satisfaction: newSatisfaction,
    satisfactionFactors: updatedFactors
  };
}

function calculateWillReturn(golfer: Golfer): boolean {
  let returnChance = golfer.satisfaction / 100;

  const typeModifiers: Record<GolferType, number> = {
    casual: 0.8,
    regular: 1.2,
    enthusiast: 1.1,
    professional: 0.9,
    tourist: 0.5
  };

  returnChance *= typeModifiers[golfer.type];

  const priceValue = golfer.satisfactionFactors.price_value ?? 75;
  if (priceValue < 50) {
    returnChance *= 0.7;
  }

  return returnChance > 0.5;
}

export function calculateArrivalRate(
  state: GolferPoolState,
  weather: WeatherCondition,
  isWeekend: boolean,
  hourOfDay: number
): number {
  let rate = BASE_ARRIVAL_RATE;

  rate *= 0.5 + (state.rating.overall / 100);

  const condition = state.rating.condition;
  if (condition >= 80) {
    rate *= 1.1;
  } else if (condition >= 65) {
    rate *= 1.0;
  } else if (condition >= 50) {
    rate *= 0.82;
  } else if (condition >= 35) {
    rate *= 0.55;
  } else if (condition >= 20) {
    rate *= 0.28;
  } else {
    rate *= 0.12;
  }

  rate *= WEATHER_SATISFACTION_MODIFIERS[weather.type];

  if (isWeekend) {
    rate *= 1.5;
  }

  if (hourOfDay >= 7 && hourOfDay <= 10) {
    rate *= 1.4;
  } else if (hourOfDay >= 13 && hourOfDay <= 16) {
    rate *= 1.2;
  } else if (hourOfDay >= 17) {
    rate *= 0.6;
  } else if (hourOfDay < 7) {
    rate *= 0.2;
  }

  const crowding = calculateCrowdingLevel(state);
  if (crowding > 80) {
    rate *= 0.5;
  } else if (crowding > 60) {
    rate *= 0.8;
  }

  return Math.max(0, rate);
}

export function generateArrivals(
  _state: GolferPoolState,
  count: number,
  currentTime: number,
  fees: GreenFeeStructure,
  isWeekend: boolean,
  isTwilight: boolean
): readonly Golfer[] {
  if (count <= 0) return [];

  const arrivals: Golfer[] = [];

  for (let i = 0; i < count; i++) {
    const type = selectGolferType();
    const holes: 9 | 18 = Math.random() > 0.3 ? 18 : 9;
    const fee = getGreenFee(fees, holes, isWeekend, isTwilight);

    const golfer = createGolfer(type, currentTime, holes, 0);

    if (wouldPayFee(golfer, fee)) {
      arrivals.push({
        ...golfer,
        paidAmount: fee
      });
    }
  }

  return arrivals;
}

export function addGolfer(
  state: GolferPoolState,
  golfer: Golfer
): GolferPoolState {
  return {
    ...state,
    golfers: [...state.golfers, golfer],
    dailyVisitors: state.dailyVisitors + 1,
    totalVisitorsToday: state.totalVisitorsToday + 1,
    totalRevenueToday: state.totalRevenueToday + golfer.paidAmount
  };
}

interface GolferTickResult {
  readonly state: GolferPoolState;
  readonly departures: readonly Golfer[];
  readonly revenue: number;
  readonly tips: number;
}

export function tickGolfers(
  state: GolferPoolState,
  deltaMinutes: number,
  courseCondition: number,
  staffQuality: number,
  weather: WeatherCondition
): GolferTickResult {
  const departures: Golfer[] = [];
  let tips = 0;

  const crowding = calculateCrowdingLevel(state);
  const paceOfPlay = Math.max(0, 100 - crowding);

  const updatedGolfers = state.golfers.map(golfer => {
    let updated = { ...golfer };

    switch (golfer.status) {
      case "arriving":
        updated = { ...updated, status: "checking_in" as GolferStatus };
        break;

      case "checking_in":
        updated = updateSatisfaction(
          { ...updated, status: "playing" as GolferStatus },
          {
            facilities: state.rating.amenities,
            staff_service: staffQuality,
            price_value: calculatePriceValue(golfer, state.rating)
          }
        );
        break;

      case "playing":
        const holesPerTick = (HOLES_PER_HOUR * deltaMinutes) / 60;
        const newHolesPlayed = Math.min(
          updated.totalHoles,
          updated.holesPlayed + holesPerTick
        );

        updated = {
          ...updated,
          holesPlayed: newHolesPlayed
        };

        updated = updateSatisfaction(updated, {
          course_condition: courseCondition,
          pace_of_play: paceOfPlay,
          weather: WEATHER_SATISFACTION_MODIFIERS[weather.type] * 100
        });

        if (newHolesPlayed >= updated.totalHoles) {
          updated = { ...updated, status: "finishing" as GolferStatus };
        }
        break;

      case "finishing":
        const willReturn = calculateWillReturn(updated);
        updated = {
          ...updated,
          status: "leaving" as GolferStatus,
          willReturn
        };

        tips += calculateTip(updated);
        departures.push(updated);
        break;
    }

    return updated;
  });

  const remainingGolfers = updatedGolfers.filter(g => g.status !== "leaving");

  return {
    state: {
      ...state,
      golfers: remainingGolfers
    },
    departures,
    revenue: 0,
    tips
  };
}

function calculatePriceValue(golfer: Golfer, rating: CourseRating): number {
  const expectedValue = (rating.overall / 100) * golfer.preferences.priceThreshold;
  const actualValue = golfer.paidAmount;

  if (actualValue <= expectedValue * 0.7) {
    return 100;
  } else if (actualValue <= expectedValue) {
    return 75;
  } else if (actualValue <= expectedValue * 1.3) {
    return 50;
  } else {
    return 25;
  }
}

export function updateCourseRating(
  state: GolferPoolState,
  updates: Partial<CourseRating>
): GolferPoolState {
  const newRating = { ...state.rating, ...updates };

  const overall = Math.round(
    (newRating.condition * 0.4 +
     newRating.amenities * 0.25 +
     newRating.value * 0.25 +
     newRating.difficulty * 0.1)
  );

  return {
    ...state,
    rating: { ...newRating, overall }
  };
}

export function resetDailyStats(state: GolferPoolState): GolferPoolState {
  return {
    ...state,
    dailyVisitors: 0,
    totalVisitorsToday: 0,
    totalRevenueToday: 0
  };
}

