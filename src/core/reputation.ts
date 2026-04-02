export type RatingTrend = 'rising' | 'stable' | 'falling';

export interface GolferReview {
  golferId: string;
  date: number;
  overallRating: number;
  categoryRatings: {
    conditions: number;
    pace: number;
    value: number;
    service: number;
    amenities: number;
  };
  wouldRecommend: boolean;
  wouldReturn: boolean;
}

export interface ReputationState {
  totalReviews: number;
  averageRating: number;
  recentRating: number;
  ratingTrend: RatingTrend;

  returnGolferCount: number;
  totalUniqueGolfers: number;
  returnRate: number;

  golfersThisMonth: number;
  wordOfMouthMultiplier: number;

  turnAwaysThisMonth: number;
  totalTurnAways: number;
  turnAwayPenalty: number;

  categoryAverages: {
    conditions: number;
    pace: number;
    value: number;
    service: number;
    amenities: number;
  };

  reviews: GolferReview[];
  recentReviews: GolferReview[];

  composite: number;
}

const REPUTATION_WEIGHTS = {
  satisfaction: 0.35,
  returnRate: 0.25,
  reviewScore: 0.20,
  tournamentHistory: 0.10,
  awards: 0.10,
} as const;

const TURN_AWAY_PENALTY_PER_GOLFER = 0.02;
const MAX_TURN_AWAY_PENALTY = 0.3;

export function createInitialReputationState(): ReputationState {
  return {
    totalReviews: 0,
    averageRating: 3.0,
    recentRating: 3.0,
    ratingTrend: 'stable',

    returnGolferCount: 0,
    totalUniqueGolfers: 0,
    returnRate: 0,

    golfersThisMonth: 0,
    wordOfMouthMultiplier: 0.8,

    turnAwaysThisMonth: 0,
    totalTurnAways: 0,
    turnAwayPenalty: 0,

    categoryAverages: {
      conditions: 3.0,
      pace: 3.0,
      value: 3.0,
      service: 3.0,
      amenities: 3.0,
    },

    reviews: [],
    recentReviews: [],

    composite: 500,
  };
}

export function trackGolferVisit(
  state: ReputationState,
  _golferId: string,
  isReturning: boolean
): ReputationState {
  const newUniqueCount = isReturning ? state.totalUniqueGolfers : state.totalUniqueGolfers + 1;
  const newReturnCount = isReturning ? state.returnGolferCount + 1 : state.returnGolferCount;

  const returnRate = newReturnCount > 0 && newUniqueCount > 0
    ? newReturnCount / (newReturnCount + newUniqueCount)
    : 0;

  return {
    ...state,
    returnGolferCount: newReturnCount,
    totalUniqueGolfers: newUniqueCount,
    returnRate,
  };
}

function calculateReputationComposite(
  averageRating: number,
  returnRate: number,
  totalReviews: number,
  wordOfMouthMultiplier: number,
  turnAwayPenalty: number = 0
): number {
  const satisfactionScore = (averageRating / 5) * 1000;

  const returnRateScore = returnRate * 1000;

  const reviewCountBonus = Math.min(100, totalReviews) * 2;
  const reviewScore = Math.min(1000, reviewCountBonus + satisfactionScore * 0.3);

  const tournamentScore = 0;
  const awardsScore = 0;

  const baseScore =
    satisfactionScore * REPUTATION_WEIGHTS.satisfaction +
    returnRateScore * REPUTATION_WEIGHTS.returnRate +
    reviewScore * REPUTATION_WEIGHTS.reviewScore +
    tournamentScore * REPUTATION_WEIGHTS.tournamentHistory +
    awardsScore * REPUTATION_WEIGHTS.awards;

  const adjustedScore = baseScore * wordOfMouthMultiplier * (1 - turnAwayPenalty);

  return Math.max(0, Math.min(1000, Math.round(adjustedScore)));
}

export function calculateReputationScore(state: ReputationState): number {
  return state.composite;
}

export function getReputationSummary(state: ReputationState): {
  starRating: number;
  trend: RatingTrend;
  totalReviews: number;
  returnRate: number;
  wordOfMouth: string;
} {
  let wordOfMouth: string;
  if (state.wordOfMouthMultiplier < 0.9) {
    wordOfMouth = 'Unknown';
  } else if (state.wordOfMouthMultiplier < 1.05) {
    wordOfMouth = 'Establishing';
  } else if (state.wordOfMouthMultiplier < 1.15) {
    wordOfMouth = 'Growing';
  } else {
    wordOfMouth = 'Well-Known';
  }

  return {
    starRating: state.averageRating,
    trend: state.ratingTrend,
    totalReviews: state.totalReviews,
    returnRate: state.returnRate,
    wordOfMouth,
  };
}

export function trackTurnAway(state: ReputationState): ReputationState {
  const newTurnAwaysThisMonth = state.turnAwaysThisMonth + 1;
  const newTotalTurnAways = state.totalTurnAways + 1;
  const penalty = Math.min(
    MAX_TURN_AWAY_PENALTY,
    newTurnAwaysThisMonth * TURN_AWAY_PENALTY_PER_GOLFER
  );

  const composite = calculateReputationComposite(
    state.averageRating,
    state.returnRate,
    state.totalReviews,
    state.wordOfMouthMultiplier,
    penalty
  );

  return {
    ...state,
    turnAwaysThisMonth: newTurnAwaysThisMonth,
    totalTurnAways: newTotalTurnAways,
    turnAwayPenalty: penalty,
    composite,
  };
}
