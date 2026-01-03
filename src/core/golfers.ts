/**
 * Golfer System - Guest management for the golf course
 *
 * Similar to RollerCoaster Tycoon's guest system:
 * - Golfer generation based on course rating and marketing
 * - Green fees and pricing
 * - Golfer satisfaction and ratings
 * - Different golfer types with varying preferences
 */

// ============================================================================
// Types
// ============================================================================

export type GolferType =
  | "casual"          // Occasional players, price sensitive
  | "regular"         // Weekly players, value consistency
  | "enthusiast"      // Frequent players, quality focused
  | "professional"    // Serious players, demand excellence
  | "tourist";        // One-time visitors, experience focused

export type GolferStatus =
  | "arriving"        // Coming to the course
  | "checking_in"     // At pro shop
  | "playing"         // On the course
  | "finishing"       // Completing round
  | "leaving";        // Departing

export type SatisfactionFactor =
  | "course_condition"    // Grass health, bunker quality
  | "pace_of_play"        // How crowded the course is
  | "facilities"          // Clubhouse, amenities
  | "price_value"         // Was it worth the money
  | "staff_service"       // Employee interactions
  | "weather";            // Weather conditions

export interface GolferPreferences {
  readonly priceThreshold: number;    // Max willing to pay
  readonly qualityExpectation: number; // 0-100, minimum acceptable quality
  readonly patienceLevel: number;     // 0-100, tolerance for delays
  readonly tipGenerosity: number;     // 0-2, tip multiplier
}

export interface Golfer {
  readonly id: string;
  readonly type: GolferType;
  readonly preferences: GolferPreferences;
  readonly status: GolferStatus;
  readonly arrivalTime: number;
  readonly holesPlayed: number;
  readonly totalHoles: number;        // 9 or 18
  readonly paidAmount: number;
  readonly satisfaction: number;      // 0-100
  readonly satisfactionFactors: Partial<Record<SatisfactionFactor, number>>;
  readonly willReturn: boolean;       // Calculated on departure
}

export interface GreenFeeStructure {
  readonly weekday9Holes: number;
  readonly weekday18Holes: number;
  readonly weekend9Holes: number;
  readonly weekend18Holes: number;
  readonly twilight9Holes: number;    // After 4pm
  readonly twilight18Holes: number;
}

export interface CourseRating {
  readonly overall: number;           // 0-100
  readonly condition: number;         // 0-100
  readonly difficulty: number;        // 0-100
  readonly amenities: number;         // 0-100
  readonly value: number;             // 0-100
}

export interface GolferStats {
  readonly totalGolfers: number;
  readonly totalRevenue: number;
  readonly averageSatisfaction: number;
  readonly returnRate: number;        // Percentage willing to return
  readonly byType: Record<GolferType, number>;
}

export interface GolferPoolState {
  readonly golfers: readonly Golfer[];
  readonly dailyVisitors: number;
  readonly peakCapacity: number;      // Max golfers at once
  readonly totalVisitorsToday: number;
  readonly totalRevenueToday: number;
  readonly rating: CourseRating;
}

export interface WeatherCondition {
  readonly type: "sunny" | "cloudy" | "rainy" | "stormy";
  readonly temperature: number;       // Fahrenheit
  readonly windSpeed: number;         // MPH
}

// ============================================================================
// Constants
// ============================================================================

export const GOLFER_TYPE_WEIGHTS: Record<GolferType, number> = {
  casual: 0.35,
  regular: 0.30,
  enthusiast: 0.20,
  professional: 0.05,
  tourist: 0.10
};

export const GOLFER_TYPE_CONFIGS: Record<GolferType, {
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

export const SATISFACTION_WEIGHTS: Record<SatisfactionFactor, number> = {
  course_condition: 0.30,
  pace_of_play: 0.20,
  facilities: 0.15,
  price_value: 0.15,
  staff_service: 0.10,
  weather: 0.10
};

export const WEATHER_SATISFACTION_MODIFIERS: Record<WeatherCondition["type"], number> = {
  sunny: 1.0,
  cloudy: 0.9,
  rainy: 0.6,
  stormy: 0.3
};

export const BASE_ARRIVAL_RATE = 4; // Golfers per game hour at baseline
export const HOLES_PER_HOUR = 2;    // Average pace of play
export const ROUND_DURATION_9 = 120;  // Minutes for 9 holes
export const ROUND_DURATION_18 = 240; // Minutes for 18 holes

// ============================================================================
// Factory Functions
// ============================================================================

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

export function generateGolferPreferences(
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

export function selectGolferType(seed?: number): GolferType {
  const getRandom = () => seed !== undefined ? seed : Math.random();
  const roll = getRandom();

  let cumulative = 0;
  for (const [type, weight] of Object.entries(GOLFER_TYPE_WEIGHTS)) {
    cumulative += weight;
    if (roll < cumulative) {
      return type as GolferType;
    }
  }

  return "casual"; // Fallback
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
    type,
    preferences: preferences ?? generateGolferPreferences(type),
    status: "arriving",
    arrivalTime,
    holesPlayed: 0,
    totalHoles: holes,
    paidAmount,
    satisfaction: 75, // Starting neutral satisfaction
    satisfactionFactors: {},
    willReturn: false
  };
}

// ============================================================================
// Query Functions
// ============================================================================

export function getGolfer(state: GolferPoolState, golferId: string): Golfer | null {
  return state.golfers.find(g => g.id === golferId) ?? null;
}

export function getGolfersByStatus(
  state: GolferPoolState,
  status: GolferStatus
): readonly Golfer[] {
  return state.golfers.filter(g => g.status === status);
}

export function getGolfersByType(
  state: GolferPoolState,
  type: GolferType
): readonly Golfer[] {
  return state.golfers.filter(g => g.type === type);
}

export function getActiveGolferCount(state: GolferPoolState): number {
  return state.golfers.filter(g =>
    g.status === "playing" || g.status === "checking_in"
  ).length;
}

export function getPlayingGolferCount(state: GolferPoolState): number {
  return state.golfers.filter(g => g.status === "playing").length;
}

export function isAtCapacity(state: GolferPoolState): boolean {
  return getActiveGolferCount(state) >= state.peakCapacity;
}

export function getAvailableTeeSlots(state: GolferPoolState): number {
  return Math.max(0, state.peakCapacity - getActiveGolferCount(state));
}

export function calculateCrowdingLevel(state: GolferPoolState): number {
  const active = getActiveGolferCount(state);
  return Math.min(100, (active / state.peakCapacity) * 100);
}

export function getAverageSatisfaction(state: GolferPoolState): number {
  if (state.golfers.length === 0) return 75;
  return state.golfers.reduce((sum, g) => sum + g.satisfaction, 0) / state.golfers.length;
}

export function getGolferStats(state: GolferPoolState): GolferStats {
  const golfers = state.golfers;
  const byType: Record<GolferType, number> = {
    casual: 0,
    regular: 0,
    enthusiast: 0,
    professional: 0,
    tourist: 0
  };

  let totalSatisfaction = 0;
  let willReturnCount = 0;

  for (const golfer of golfers) {
    byType[golfer.type]++;
    totalSatisfaction += golfer.satisfaction;
    if (golfer.willReturn) willReturnCount++;
  }

  return {
    totalGolfers: state.totalVisitorsToday,
    totalRevenue: state.totalRevenueToday,
    averageSatisfaction: golfers.length > 0 ? totalSatisfaction / golfers.length : 75,
    returnRate: golfers.length > 0 ? (willReturnCount / golfers.length) * 100 : 0,
    byType
  };
}

// ============================================================================
// Pricing Functions
// ============================================================================

export function getGreenFee(
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

export function wouldPayFee(golfer: Golfer, fee: number): boolean {
  return fee <= golfer.preferences.priceThreshold;
}

export function calculateOptimalPrice(
  state: GolferPoolState,
  basePrice: number
): number {
  // Adjust price based on demand and rating
  const crowding = calculateCrowdingLevel(state);
  const rating = state.rating.overall;

  // Higher crowding = higher prices (demand)
  const demandModifier = 1 + (crowding / 100) * 0.3;

  // Higher rating = can charge more
  const ratingModifier = 0.7 + (rating / 100) * 0.6;

  return Math.round(basePrice * demandModifier * ratingModifier);
}

export function calculateTip(golfer: Golfer, baseService: number = 5): number {
  const satisfactionModifier = golfer.satisfaction / 75; // 1.0 at neutral
  return Math.round(baseService * golfer.preferences.tipGenerosity * satisfactionModifier * 100) / 100;
}

// ============================================================================
// Satisfaction Functions
// ============================================================================

export function calculateSatisfactionFactor(
  factor: SatisfactionFactor,
  value: number,
  golfer: Golfer
): number {
  // Value is 0-100, returns 0-100 satisfaction for this factor
  switch (factor) {
    case "course_condition":
      // Quality-focused golfers are more sensitive
      const qualityPenalty = Math.max(0, golfer.preferences.qualityExpectation - value);
      return Math.max(0, 100 - qualityPenalty * 1.5);

    case "pace_of_play":
      // Patient golfers tolerate slower play (higher crowding/value)
      // patienceLevel represents the threshold where they start getting unhappy
      const paceThreshold = golfer.preferences.patienceLevel;
      if (value >= paceThreshold) {
        return Math.max(0, 100 - (value - paceThreshold) * 2);
      }
      return 100;

    case "price_value":
      // Compare what they paid vs what they expected
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

export function updateSatisfaction(
  golfer: Golfer,
  factors: Partial<Record<SatisfactionFactor, number>>
): Golfer {
  const updatedFactors = { ...golfer.satisfactionFactors };

  for (const [factor, value] of Object.entries(factors)) {
    const factorKey = factor as SatisfactionFactor;
    const factorSatisfaction = calculateSatisfactionFactor(factorKey, value, golfer);
    updatedFactors[factorKey] = factorSatisfaction;
  }

  // Calculate overall satisfaction from weighted factors
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

export function calculateWillReturn(golfer: Golfer): boolean {
  // Base chance from satisfaction
  let returnChance = golfer.satisfaction / 100;

  // Type modifiers
  const typeModifiers: Record<GolferType, number> = {
    casual: 0.8,      // Less likely to return
    regular: 1.2,     // More loyal
    enthusiast: 1.1,  // Loyal if quality is good
    professional: 0.9, // High standards
    tourist: 0.5      // One-time visitors
  };

  returnChance *= typeModifiers[golfer.type];

  // Price value factor
  const priceValue = golfer.satisfactionFactors.price_value ?? 75;
  if (priceValue < 50) {
    returnChance *= 0.7; // Poor value = less likely to return
  }

  return returnChance > 0.5;
}

// ============================================================================
// Generation Functions
// ============================================================================

export function calculateArrivalRate(
  state: GolferPoolState,
  weather: WeatherCondition,
  isWeekend: boolean,
  hourOfDay: number
): number {
  let rate = BASE_ARRIVAL_RATE;

  // Rating modifier (higher rated courses attract more golfers)
  rate *= 0.5 + (state.rating.overall / 100);

  // Weather modifier
  rate *= WEATHER_SATISFACTION_MODIFIERS[weather.type];

  // Weekend boost
  if (isWeekend) {
    rate *= 1.5;
  }

  // Time of day modifier (peak: 7-10am and 1-4pm)
  if (hourOfDay >= 7 && hourOfDay <= 10) {
    rate *= 1.4; // Morning rush
  } else if (hourOfDay >= 13 && hourOfDay <= 16) {
    rate *= 1.2; // Afternoon
  } else if (hourOfDay >= 17) {
    rate *= 0.6; // Twilight
  } else if (hourOfDay < 7) {
    rate *= 0.2; // Too early
  }

  // Capacity dampening
  const crowding = calculateCrowdingLevel(state);
  if (crowding > 80) {
    rate *= 0.5; // Very crowded, fewer people come
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

    // Check if they'll pay the fee
    if (wouldPayFee(golfer, fee)) {
      arrivals.push({
        ...golfer,
        paidAmount: fee
      });
    }
  }

  return arrivals;
}

// ============================================================================
// State Transformation Functions
// ============================================================================

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

export function removeGolfer(
  state: GolferPoolState,
  golferId: string
): GolferPoolState {
  return {
    ...state,
    golfers: state.golfers.filter(g => g.id !== golferId)
  };
}

export function updateGolfer(
  state: GolferPoolState,
  golferId: string,
  updates: Partial<Omit<Golfer, "id">>
): GolferPoolState | null {
  const golfer = getGolfer(state, golferId);
  if (!golfer) return null;

  return {
    ...state,
    golfers: state.golfers.map(g =>
      g.id === golferId ? { ...g, ...updates } : g
    )
  };
}

export function setGolferStatus(
  state: GolferPoolState,
  golferId: string,
  status: GolferStatus
): GolferPoolState | null {
  return updateGolfer(state, golferId, { status });
}

export function advanceGolferProgress(
  state: GolferPoolState,
  golferId: string,
  holesPlayed: number
): GolferPoolState | null {
  const golfer = getGolfer(state, golferId);
  if (!golfer) return null;

  const newHolesPlayed = Math.min(golfer.totalHoles, golfer.holesPlayed + holesPlayed);
  const isFinished = newHolesPlayed >= golfer.totalHoles;

  return updateGolfer(state, golferId, {
    holesPlayed: newHolesPlayed,
    status: isFinished ? "finishing" : "playing"
  });
}

export interface GolferTickResult {
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

  // Calculate pace of play factor (crowding affects pace)
  const crowding = calculateCrowdingLevel(state);
  const paceOfPlay = Math.max(0, 100 - crowding);

  const updatedGolfers = state.golfers.map(golfer => {
    let updated = { ...golfer };

    switch (golfer.status) {
      case "arriving":
        // Move to checking in
        updated = { ...updated, status: "checking_in" as GolferStatus };
        break;

      case "checking_in":
        // Move to playing, apply initial satisfaction factors
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
        // Progress through holes
        const holesPerTick = (HOLES_PER_HOUR * deltaMinutes) / 60;
        const newHolesPlayed = Math.min(
          updated.totalHoles,
          updated.holesPlayed + holesPerTick
        );

        updated = {
          ...updated,
          holesPlayed: newHolesPlayed
        };

        // Update satisfaction while playing
        updated = updateSatisfaction(updated, {
          course_condition: courseCondition,
          pace_of_play: paceOfPlay,
          weather: WEATHER_SATISFACTION_MODIFIERS[weather.type] * 100
        });

        // Check if finished
        if (newHolesPlayed >= updated.totalHoles) {
          updated = { ...updated, status: "finishing" as GolferStatus };
        }
        break;

      case "finishing":
        // Calculate final satisfaction and willReturn
        const willReturn = calculateWillReturn(updated);
        updated = {
          ...updated,
          status: "leaving" as GolferStatus,
          willReturn
        };

        // Calculate tip
        tips += calculateTip(updated);
        departures.push(updated);
        break;
    }

    return updated;
  });

  // Remove departed golfers
  const remainingGolfers = updatedGolfers.filter(g => g.status !== "leaving");

  return {
    state: {
      ...state,
      golfers: remainingGolfers
    },
    departures,
    revenue: 0, // Revenue was already added when golfer arrived
    tips
  };
}

function calculatePriceValue(golfer: Golfer, rating: CourseRating): number {
  // Compare what they paid vs expected value based on rating
  const expectedValue = (rating.overall / 100) * golfer.preferences.priceThreshold;
  const actualValue = golfer.paidAmount;

  if (actualValue <= expectedValue * 0.7) {
    return 100; // Great value
  } else if (actualValue <= expectedValue) {
    return 75; // Fair value
  } else if (actualValue <= expectedValue * 1.3) {
    return 50; // Slightly overpriced
  } else {
    return 25; // Overpriced
  }
}

export function updateCourseRating(
  state: GolferPoolState,
  updates: Partial<CourseRating>
): GolferPoolState {
  const newRating = { ...state.rating, ...updates };

  // Recalculate overall from components
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

// ============================================================================
// Utility Functions
// ============================================================================

export function getGolferTypeName(type: GolferType): string {
  const names: Record<GolferType, string> = {
    casual: "Casual Golfer",
    regular: "Regular Member",
    enthusiast: "Golf Enthusiast",
    professional: "Professional",
    tourist: "Tourist"
  };
  return names[type];
}

export function getSatisfactionLevel(satisfaction: number): string {
  if (satisfaction >= 90) return "Excellent";
  if (satisfaction >= 75) return "Good";
  if (satisfaction >= 60) return "Fair";
  if (satisfaction >= 40) return "Poor";
  return "Very Poor";
}

export function formatGreenFee(amount: number): string {
  return `$${amount}`;
}

export function resetGolferCounter(): void {
  golferIdCounter = 0;
}

export function estimateRoundDuration(holes: 9 | 18, crowdingLevel: number): number {
  const baseDuration = holes === 9 ? ROUND_DURATION_9 : ROUND_DURATION_18;
  // Add up to 50% more time at full crowding
  const crowdingPenalty = 1 + (crowdingLevel / 100) * 0.5;
  return Math.round(baseDuration * crowdingPenalty);
}
