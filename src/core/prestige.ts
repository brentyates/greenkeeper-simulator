import { CellState, TerrainType } from './terrain';
import { AmenityState, AmenityUpgrade, createInitialAmenityState, calculateAmenityScore, applyUpgrade as applyAmenityUpgrade } from './amenities';
import { ReputationState, createInitialReputationState, calculateReputationScore } from './reputation';
import { ExclusivityState, createInitialExclusivityState, calculateExclusivityScore, MembershipModel, DressCode, setMembershipModel, setWaitlistLength, setAdvanceBookingDays, setDressCode, earnAward as earnExclusivityAward, removeAward as removeExclusivityAward } from './exclusivity';

export type PrestigeTier = 'municipal' | 'public' | 'semi_private' | 'private_club' | 'championship';

export interface CurrentConditionsScore {
  averageHealth: number;
  greenScore: number;
  fairwayScore: number;
  bunkerScore: number;
  hazardScore: number;
  teeBoxScore: number;
  composite: number;
}

export interface GreenFeeTolerance {
  sweetSpot: number;
  maxTolerance: number;
  rejectionThreshold: number;
}

export type ConditionRating = 'excellent' | 'good' | 'fair' | 'poor';

export interface DailySnapshot {
  day: number;
  averageHealth: number;
  greenHealth: number;
  fairwayHealth: number;
  conditionRating: ConditionRating;
}

export interface HistoricalExcellenceState {
  dailySnapshots: DailySnapshot[];
  consecutiveExcellentDays: number;
  consecutiveGoodDays: number;
  longestExcellentStreak: number;
  daysSinceLastPoorRating: number;
  poorDaysInLast90: number;
  rollingAverage30: number;
  rollingAverage90: number;
  consistencyScore: number;
  composite: number;
}

export interface PrestigeState {
  currentScore: number;
  targetScore: number;
  starRating: number;
  tier: PrestigeTier;

  currentConditions: CurrentConditionsScore;
  historicalExcellence: HistoricalExcellenceState;
  amenities: AmenityState;
  amenityScore: number;
  reputation: ReputationState;
  reputationScore: number;
  exclusivity: ExclusivityState;
  exclusivityScore: number;

  greenFee: number;
  tolerance: GreenFeeTolerance;

  golfersToday: number;
  golfersRejectedToday: number;
  revenueToday: number;
  revenueLostToday: number;
}

export const CONDITION_WEIGHTS = {
  averageHealth: 0.30,
  greenScore: 0.25,
  fairwayScore: 0.20,
  bunkerScore: 0.10,
  hazardScore: 0.10,
  teeBoxScore: 0.05,
} as const;

export const TIER_THRESHOLDS: Record<PrestigeTier, { min: number; max: number }> = {
  municipal: { min: 0, max: 199 },
  public: { min: 200, max: 399 },
  semi_private: { min: 400, max: 599 },
  private_club: { min: 600, max: 799 },
  championship: { min: 800, max: 1000 },
} as const;

export const TIER_LABELS: Record<PrestigeTier, string> = {
  municipal: 'Municipal',
  public: 'Public',
  semi_private: 'Semi-Private',
  private_club: 'Private Club',
  championship: 'Championship',
} as const;

export const TIER_TOLERANCES: Record<PrestigeTier, GreenFeeTolerance> = {
  municipal: { sweetSpot: 15, rejectionThreshold: 25, maxTolerance: 35 },
  public: { sweetSpot: 35, rejectionThreshold: 50, maxTolerance: 65 },
  semi_private: { sweetSpot: 65, rejectionThreshold: 90, maxTolerance: 120 },
  private_club: { sweetSpot: 120, rejectionThreshold: 175, maxTolerance: 250 },
  championship: { sweetSpot: 200, rejectionThreshold: 350, maxTolerance: 500 },
} as const;

export const MAX_DAILY_INCREASE = 5;
export const MAX_DAILY_DECREASE = 15;

export const STREAK_BONUSES = {
  good7Days: 25,
  good30Days: 75,
  excellent7Days: 50,
  excellent30Days: 150,
} as const;

export const RECOVERY_PENALTIES = {
  day1to7: -200,
  day8to14: -150,
  day15to30: -100,
  day31to60: -50,
} as const;

export const PRESTIGE_COMPONENT_WEIGHTS = {
  currentConditions: 0.25,
  historicalExcellence: 0.25,
  amenities: 0.20,
  reputation: 0.20,
  exclusivity: 0.10,
} as const;

export const HISTORICAL_WEIGHTS = {
  rollingAverage: 0.40,
  consistency: 0.25,
  streakBonus: 0.20,
  recoveryPenalty: 0.15,
} as const;

export const MAX_DAILY_SNAPSHOTS = 365;

export function createInitialHistoricalState(): HistoricalExcellenceState {
  return {
    dailySnapshots: [],
    consecutiveExcellentDays: 0,
    consecutiveGoodDays: 0,
    longestExcellentStreak: 0,
    daysSinceLastPoorRating: 999,
    poorDaysInLast90: 0,
    rollingAverage30: 50,
    rollingAverage90: 50,
    consistencyScore: 100,
    composite: 500,
  };
}

export function createInitialPrestigeState(startingScore: number = 100): PrestigeState {
  const tier = getPrestigeTier(startingScore);
  const initialAmenities = createInitialAmenityState();
  const initialExclusivity = createInitialExclusivityState();
  return {
    currentScore: startingScore,
    targetScore: startingScore,
    starRating: calculateStarRating(startingScore),
    tier,

    currentConditions: {
      averageHealth: 50,
      greenScore: 50,
      fairwayScore: 50,
      bunkerScore: 100,
      hazardScore: 100,
      teeBoxScore: 50,
      composite: 500,
    },

    historicalExcellence: createInitialHistoricalState(),
    amenities: initialAmenities,
    amenityScore: calculateAmenityScore(initialAmenities),
    reputation: createInitialReputationState(),
    reputationScore: 500,
    exclusivity: initialExclusivity,
    exclusivityScore: calculateExclusivityScore(initialExclusivity),

    greenFee: TIER_TOLERANCES[tier].sweetSpot,
    tolerance: TIER_TOLERANCES[tier],

    golfersToday: 0,
    golfersRejectedToday: 0,
    revenueToday: 0,
    revenueLostToday: 0,
  };
}

export function getPrestigeTier(score: number): PrestigeTier {
  if (score >= 800) return 'championship';
  if (score >= 600) return 'private_club';
  if (score >= 400) return 'semi_private';
  if (score >= 200) return 'public';
  return 'municipal';
}

export function calculateStarRating(score: number): number {
  const clampedScore = Math.max(0, Math.min(1000, score));
  return Math.max(0.5, Math.min(5, (clampedScore / 200) + 0.5));
}

export function getStarDisplay(rating: number): string {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return '★'.repeat(fullStars) + (hasHalfStar ? '½' : '') + '☆'.repeat(emptyStars);
}

function calculateTerrainTypeScore(cells: CellState[][], targetType: TerrainType): number {
  let totalHealth = 0;
  let count = 0;

  for (const row of cells) {
    for (const cell of row) {
      if (cell.type === targetType) {
        totalHealth += cell.health;
        count++;
      }
    }
  }

  if (count === 0) return 100;
  return totalHealth / count;
}

export function calculateCurrentConditions(cells: CellState[][]): CurrentConditionsScore {
  let totalHealth = 0;
  let grassCount = 0;

  for (const row of cells) {
    for (const cell of row) {
      if (cell.type === 'fairway' || cell.type === 'rough' || cell.type === 'green' || cell.type === 'tee') {
        totalHealth += cell.health;
        grassCount++;
      }
    }
  }

  const averageHealth = grassCount > 0 ? totalHealth / grassCount : 100;
  const greenScore = calculateTerrainTypeScore(cells, 'green');
  const fairwayScore = calculateTerrainTypeScore(cells, 'fairway');
  const teeBoxScore = calculateTerrainTypeScore(cells, 'tee');

  const bunkerScore = 100;
  const hazardScore = 100;

  const composite = Math.round(
    (averageHealth * CONDITION_WEIGHTS.averageHealth +
     greenScore * CONDITION_WEIGHTS.greenScore +
     fairwayScore * CONDITION_WEIGHTS.fairwayScore +
     bunkerScore * CONDITION_WEIGHTS.bunkerScore +
     hazardScore * CONDITION_WEIGHTS.hazardScore +
     teeBoxScore * CONDITION_WEIGHTS.teeBoxScore) * 10
  );

  return {
    averageHealth: Math.round(averageHealth),
    greenScore: Math.round(greenScore),
    fairwayScore: Math.round(fairwayScore),
    bunkerScore,
    hazardScore,
    teeBoxScore: Math.round(teeBoxScore),
    composite: Math.max(0, Math.min(1000, composite)),
  };
}

export function calculateDemandMultiplier(price: number, tolerance: GreenFeeTolerance): number {
  if (price <= tolerance.sweetSpot) {
    return 1.0;
  } else if (price <= tolerance.rejectionThreshold) {
    const ratio = (price - tolerance.sweetSpot) /
                  (tolerance.rejectionThreshold - tolerance.sweetSpot);
    return 1.0 - (ratio * 0.2);
  } else if (price <= tolerance.maxTolerance) {
    const ratio = (price - tolerance.rejectionThreshold) /
                  (tolerance.maxTolerance - tolerance.rejectionThreshold);
    return 0.8 - (ratio * 0.6);
  } else {
    return Math.max(0.05, 0.2 - ((price - tolerance.maxTolerance) / 100) * 0.15);
  }
}

export function calculateMasterPrestigeScore(
  conditionsComposite: number,
  historicalComposite: number,
  amenityScore: number,
  reputationScore: number = 0,
  exclusivityScore: number = 0
): number {
  const score =
    conditionsComposite * PRESTIGE_COMPONENT_WEIGHTS.currentConditions +
    historicalComposite * PRESTIGE_COMPONENT_WEIGHTS.historicalExcellence +
    amenityScore * PRESTIGE_COMPONENT_WEIGHTS.amenities +
    reputationScore * PRESTIGE_COMPONENT_WEIGHTS.reputation +
    exclusivityScore * PRESTIGE_COMPONENT_WEIGHTS.exclusivity;

  return Math.max(0, Math.min(1000, score));
}

export function updatePrestigeScore(
  state: PrestigeState,
  conditionsScore: CurrentConditionsScore,
  _deltaDay: number = 0
): PrestigeState {
  const amenityScore = calculateAmenityScore(state.amenities);
  const reputationScore = calculateReputationScore(state.reputation);
  const exclusivityScore = calculateExclusivityScore(state.exclusivity);

  const targetScore = calculateMasterPrestigeScore(
    conditionsScore.composite,
    state.historicalExcellence.composite,
    amenityScore,
    reputationScore,
    exclusivityScore
  );

  let newScore = state.currentScore;
  const diff = targetScore - state.currentScore;

  if (diff > 0) {
    newScore = Math.min(state.currentScore + MAX_DAILY_INCREASE, targetScore);
  }
  if (diff < 0) {
    newScore = Math.max(state.currentScore - MAX_DAILY_DECREASE, targetScore);
  }

  const newTier = getPrestigeTier(newScore);

  return {
    ...state,
    currentScore: newScore,
    targetScore,
    starRating: calculateStarRating(newScore),
    tier: newTier,
    currentConditions: conditionsScore,
    amenityScore,
    reputationScore,
    exclusivityScore,
    tolerance: TIER_TOLERANCES[newTier],
  };
}

export function processGolferArrival(
  state: PrestigeState,
  greenFee: number,
  wouldPay: boolean
): PrestigeState {
  if (wouldPay) {
    return {
      ...state,
      golfersToday: state.golfersToday + 1,
      revenueToday: state.revenueToday + greenFee,
    };
  } else {
    return {
      ...state,
      golfersRejectedToday: state.golfersRejectedToday + 1,
      revenueLostToday: state.revenueLostToday + greenFee,
    };
  }
}

export function resetDailyStats(state: PrestigeState): PrestigeState {
  return {
    ...state,
    golfersToday: 0,
    golfersRejectedToday: 0,
    revenueToday: 0,
    revenueLostToday: 0,
  };
}

export function setGreenFee(state: PrestigeState, fee: number): PrestigeState {
  return {
    ...state,
    greenFee: Math.max(0, fee),
  };
}

export function getGreenFeeAdvice(state: PrestigeState): {
  recommended: { min: number; max: number };
  current: number;
  isOverpriced: boolean;
  expectedRejectionRate: number;
} {
  const tolerance = state.tolerance;
  const current = state.greenFee;
  const demandMultiplier = calculateDemandMultiplier(current, tolerance);
  const expectedRejectionRate = Math.round((1 - demandMultiplier) * 100);

  return {
    recommended: { min: tolerance.sweetSpot * 0.8, max: tolerance.rejectionThreshold },
    current,
    isOverpriced: current > tolerance.rejectionThreshold,
    expectedRejectionRate,
  };
}

export function getConditionRating(health: number): ConditionRating {
  if (health >= 80) return 'excellent';
  if (health >= 60) return 'good';
  if (health >= 40) return 'fair';
  return 'poor';
}

export function takeDailySnapshot(
  conditions: CurrentConditionsScore,
  day: number
): DailySnapshot {
  return {
    day,
    averageHealth: conditions.averageHealth,
    greenHealth: conditions.greenScore,
    fairwayHealth: conditions.fairwayScore,
    conditionRating: getConditionRating(conditions.averageHealth),
  };
}

function calculateRollingAverage(snapshots: DailySnapshot[], days: number): number {
  const recentSnapshots = snapshots.slice(-days);
  const sum = recentSnapshots.reduce((acc, s) => acc + s.averageHealth, 0);
  return sum / recentSnapshots.length;
}

function calculateStandardDeviation(snapshots: DailySnapshot[], days: number): number {
  if (snapshots.length < 2) return 0;
  const recentSnapshots = snapshots.slice(-days);

  const mean = recentSnapshots.reduce((acc, s) => acc + s.averageHealth, 0) / recentSnapshots.length;
  const squaredDiffs = recentSnapshots.map(s => Math.pow(s.averageHealth - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((acc, d) => acc + d, 0) / squaredDiffs.length;
  return Math.sqrt(avgSquaredDiff);
}

function calculateStreakBonus(state: HistoricalExcellenceState): number {
  let bonus = 0;

  if (state.consecutiveGoodDays >= 30) {
    bonus += STREAK_BONUSES.good30Days;
  } else if (state.consecutiveGoodDays >= 7) {
    bonus += STREAK_BONUSES.good7Days;
  }

  if (state.consecutiveExcellentDays >= 30) {
    bonus += STREAK_BONUSES.excellent30Days;
  } else if (state.consecutiveExcellentDays >= 7) {
    bonus += STREAK_BONUSES.excellent7Days;
  }

  return bonus;
}

function calculateRecoveryPenalty(daysSincePoor: number): number {
  if (daysSincePoor <= 7) return RECOVERY_PENALTIES.day1to7;
  if (daysSincePoor <= 14) return RECOVERY_PENALTIES.day8to14;
  if (daysSincePoor <= 30) return RECOVERY_PENALTIES.day15to30;
  if (daysSincePoor <= 60) return RECOVERY_PENALTIES.day31to60;
  return 0;
}

export function updateHistoricalExcellence(
  state: HistoricalExcellenceState,
  snapshot: DailySnapshot
): HistoricalExcellenceState {
  const newSnapshots = [...state.dailySnapshots, snapshot].slice(-MAX_DAILY_SNAPSHOTS);

  let consecutiveExcellentDays = state.consecutiveExcellentDays;
  let consecutiveGoodDays = state.consecutiveGoodDays;
  let daysSinceLastPoorRating = state.daysSinceLastPoorRating;

  if (snapshot.conditionRating === 'excellent') {
    consecutiveExcellentDays++;
    consecutiveGoodDays++;
  } else if (snapshot.conditionRating === 'good') {
    consecutiveExcellentDays = 0;
    consecutiveGoodDays++;
  } else if (snapshot.conditionRating === 'fair') {
    consecutiveExcellentDays = 0;
    consecutiveGoodDays = 0;
  } else {
    consecutiveExcellentDays = 0;
    consecutiveGoodDays = 0;
    daysSinceLastPoorRating = 0;
  }

  if (snapshot.conditionRating !== 'poor') {
    daysSinceLastPoorRating++;
  }

  const longestExcellentStreak = Math.max(state.longestExcellentStreak, consecutiveExcellentDays);

  const last90 = newSnapshots.slice(-90);
  const poorDaysInLast90 = last90.filter(s => s.conditionRating === 'poor').length;

  const rollingAverage30 = calculateRollingAverage(newSnapshots, 30);
  const rollingAverage90 = calculateRollingAverage(newSnapshots, 90);
  const stdDev = calculateStandardDeviation(newSnapshots, 30);
  const consistencyScore = Math.max(0, Math.min(100, 100 - (stdDev * 2)));

  const updatedState: HistoricalExcellenceState = {
    dailySnapshots: newSnapshots,
    consecutiveExcellentDays,
    consecutiveGoodDays,
    longestExcellentStreak,
    daysSinceLastPoorRating,
    poorDaysInLast90,
    rollingAverage30,
    rollingAverage90,
    consistencyScore,
    composite: 0,
  };

  const streakBonus = calculateStreakBonus(updatedState);
  const recoveryPenalty = calculateRecoveryPenalty(daysSinceLastPoorRating);

  const rollingScore = (rollingAverage30 / 100) * 1000;
  const consistencyScoreNormalized = (consistencyScore / 100) * 1000;
  const streakScore = Math.min(1000, streakBonus * 4);
  const penaltyScore = Math.max(0, 1000 + recoveryPenalty * 5);

  const composite = Math.round(
    rollingScore * HISTORICAL_WEIGHTS.rollingAverage +
    consistencyScoreNormalized * HISTORICAL_WEIGHTS.consistency +
    streakScore * HISTORICAL_WEIGHTS.streakBonus +
    penaltyScore * HISTORICAL_WEIGHTS.recoveryPenalty
  );

  return {
    ...updatedState,
    composite: Math.max(0, Math.min(1000, composite)),
  };
}

export function calculateHistoricalExcellence(state: HistoricalExcellenceState): number {
  return state.composite;
}

export function upgradeAmenity(state: PrestigeState, upgrade: AmenityUpgrade): PrestigeState {
  const newAmenities = applyAmenityUpgrade(state.amenities, upgrade);
  const newAmenityScore = calculateAmenityScore(newAmenities);

  return {
    ...state,
    amenities: newAmenities,
    amenityScore: newAmenityScore,
  };
}

export function updateMembership(
  state: PrestigeState,
  model: MembershipModel,
  cost: number = 0
): PrestigeState {
  const newExclusivity = setMembershipModel(state.exclusivity, model, cost);
  return {
    ...state,
    exclusivity: newExclusivity,
    exclusivityScore: newExclusivity.composite,
  };
}

export function updateWaitlist(state: PrestigeState, months: number): PrestigeState {
  const newExclusivity = setWaitlistLength(state.exclusivity, months);
  return {
    ...state,
    exclusivity: newExclusivity,
    exclusivityScore: newExclusivity.composite,
  };
}

export function updateBookingWindow(state: PrestigeState, days: number): PrestigeState {
  const newExclusivity = setAdvanceBookingDays(state.exclusivity, days);
  return {
    ...state,
    exclusivity: newExclusivity,
    exclusivityScore: newExclusivity.composite,
  };
}

export function updateDressCode(state: PrestigeState, dressCode: DressCode): PrestigeState {
  const newExclusivity = setDressCode(state.exclusivity, dressCode);
  return {
    ...state,
    exclusivity: newExclusivity,
    exclusivityScore: newExclusivity.composite,
  };
}

export function awardPrestige(state: PrestigeState, awardId: string, day: number): PrestigeState {
  const newExclusivity = earnExclusivityAward(state.exclusivity, awardId, day);
  return {
    ...state,
    exclusivity: newExclusivity,
    exclusivityScore: newExclusivity.composite,
  };
}

export function revokeAward(state: PrestigeState, awardId: string): PrestigeState {
  const newExclusivity = removeExclusivityAward(state.exclusivity, awardId);
  return {
    ...state,
    exclusivity: newExclusivity,
    exclusivityScore: newExclusivity.composite,
  };
}

export type { AmenityUpgrade };
export type { MembershipModel, DressCode, ExclusivityState };
