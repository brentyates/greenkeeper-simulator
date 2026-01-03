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

export const REPUTATION_WEIGHTS = {
  satisfaction: 0.35,
  returnRate: 0.25,
  reviewScore: 0.20,
  tournamentHistory: 0.10,
  awards: 0.10,
} as const;

export const WORD_OF_MOUTH_THRESHOLDS = {
  unknown: { max: 100, multiplier: 0.8 },
  establishing: { max: 500, multiplier: 1.0 },
  growing: { max: 1000, multiplier: 1.1 },
  wellKnown: { max: Infinity, multiplier: 1.2 },
} as const;

export const MAX_STORED_REVIEWS = 365;
export const RECENT_REVIEW_DAYS = 30;

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

export function generateReview(
  golferId: string,
  day: number,
  satisfaction: number,
  courseCondition: number,
  paceOfPlay: number,
  priceVsValue: number,
  staffQuality: number,
  amenityLevel: number
): GolferReview {
  const conditionRating = Math.min(5, Math.max(1, Math.round(courseCondition / 20)));
  const paceRating = Math.min(5, Math.max(1, Math.round(paceOfPlay / 20)));
  const valueRating = Math.min(5, Math.max(1, Math.round(priceVsValue / 20)));
  const serviceRating = Math.min(5, Math.max(1, Math.round(staffQuality / 20)));
  const amenitiesRating = Math.min(5, Math.max(1, Math.round(amenityLevel / 20)));

  const overallRating = Math.min(5, Math.max(1, Math.round(satisfaction / 20)));

  return {
    golferId,
    date: day,
    overallRating,
    categoryRatings: {
      conditions: conditionRating,
      pace: paceRating,
      value: valueRating,
      service: serviceRating,
      amenities: amenitiesRating,
    },
    wouldRecommend: overallRating >= 4,
    wouldReturn: overallRating >= 3,
  };
}

export function addReview(state: ReputationState, review: GolferReview, currentDay: number): ReputationState {
  const newReviews = [...state.reviews, review].slice(-MAX_STORED_REVIEWS);
  const newRecentReviews = newReviews.filter(r => currentDay - r.date <= RECENT_REVIEW_DAYS);

  const totalReviews = newReviews.length;
  const averageRating = calculateAverageRating(newReviews);
  const recentRating = newRecentReviews.length > 0 ? calculateAverageRating(newRecentReviews) : averageRating;

  const ratingTrend = calculateTrend(state.recentRating, recentRating);

  const categoryAverages = calculateCategoryAverages(newReviews);

  const composite = calculateReputationComposite(
    averageRating,
    state.returnRate,
    totalReviews,
    state.wordOfMouthMultiplier
  );

  return {
    ...state,
    totalReviews,
    averageRating,
    recentRating,
    ratingTrend,
    categoryAverages,
    reviews: newReviews,
    recentReviews: newRecentReviews,
    composite,
  };
}

function calculateAverageRating(reviews: GolferReview[]): number {
  if (reviews.length === 0) return 3.0;
  const sum = reviews.reduce((acc, r) => acc + r.overallRating, 0);
  return sum / reviews.length;
}

function calculateTrend(previousRating: number, currentRating: number): RatingTrend {
  const diff = currentRating - previousRating;
  if (diff > 0.1) return 'rising';
  if (diff < -0.1) return 'falling';
  return 'stable';
}

function calculateCategoryAverages(reviews: GolferReview[]): ReputationState['categoryAverages'] {
  if (reviews.length === 0) {
    return { conditions: 3.0, pace: 3.0, value: 3.0, service: 3.0, amenities: 3.0 };
  }

  const sum = reviews.reduce(
    (acc, r) => ({
      conditions: acc.conditions + r.categoryRatings.conditions,
      pace: acc.pace + r.categoryRatings.pace,
      value: acc.value + r.categoryRatings.value,
      service: acc.service + r.categoryRatings.service,
      amenities: acc.amenities + r.categoryRatings.amenities,
    }),
    { conditions: 0, pace: 0, value: 0, service: 0, amenities: 0 }
  );

  const count = reviews.length;
  return {
    conditions: sum.conditions / count,
    pace: sum.pace / count,
    value: sum.value / count,
    service: sum.service / count,
    amenities: sum.amenities / count,
  };
}

export function updateWordOfMouth(state: ReputationState, golfersThisMonth: number): ReputationState {
  let multiplier: number;

  if (golfersThisMonth < WORD_OF_MOUTH_THRESHOLDS.unknown.max) {
    multiplier = WORD_OF_MOUTH_THRESHOLDS.unknown.multiplier;
  } else if (golfersThisMonth < WORD_OF_MOUTH_THRESHOLDS.establishing.max) {
    multiplier = WORD_OF_MOUTH_THRESHOLDS.establishing.multiplier;
  } else if (golfersThisMonth < WORD_OF_MOUTH_THRESHOLDS.growing.max) {
    multiplier = WORD_OF_MOUTH_THRESHOLDS.growing.multiplier;
  } else {
    multiplier = WORD_OF_MOUTH_THRESHOLDS.wellKnown.multiplier;
  }

  const composite = calculateReputationComposite(
    state.averageRating,
    state.returnRate,
    state.totalReviews,
    multiplier
  );

  return {
    ...state,
    golfersThisMonth,
    wordOfMouthMultiplier: multiplier,
    composite,
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
  wordOfMouthMultiplier: number
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

  const adjustedScore = baseScore * wordOfMouthMultiplier;

  return Math.max(0, Math.min(1000, Math.round(adjustedScore)));
}

export function calculateReputationScore(state: ReputationState): number {
  return state.composite;
}

export function refreshRecentReviews(state: ReputationState, currentDay: number): ReputationState {
  const newRecentReviews = state.reviews.filter(r => currentDay - r.date <= RECENT_REVIEW_DAYS);
  const recentRating = newRecentReviews.length > 0 ? calculateAverageRating(newRecentReviews) : state.averageRating;
  const ratingTrend = calculateTrend(state.recentRating, recentRating);

  return {
    ...state,
    recentReviews: newRecentReviews,
    recentRating,
    ratingTrend,
  };
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
