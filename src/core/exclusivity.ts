export type MembershipModel = 'public' | 'semi_private' | 'private' | 'exclusive';
export type DressCode = 'none' | 'casual' | 'smart_casual' | 'formal';

export interface Award {
  id: string;
  name: string;
  dateEarned: number;
  prestigeBonus: number;
}

export interface ExclusivityState {
  membershipModel: MembershipModel;
  membershipCost: number;
  waitlistLength: number;
  advanceBookingDays: number;
  dressCode: DressCode;
  awards: Award[];
  composite: number;
}

export const MEMBERSHIP_BASE_SCORES: Record<MembershipModel, number> = {
  public: 0,
  semi_private: 200,
  private: 500,
  exclusive: 800,
} as const;

export const EXCLUSIVITY_WEIGHTS = {
  membershipType: 0.40,
  pricePoint: 0.25,
  bookingDifficulty: 0.20,
  dressCode: 0.15,
} as const;

export const MEMBERSHIP_COST_THRESHOLD = 25000;
export const WAITLIST_BONUS_MONTHS = 12;

export const DRESS_CODE_BONUSES: Record<DressCode, number> = {
  none: 0,
  casual: 10,
  smart_casual: 30,
  formal: 50,
} as const;

export const AWARD_DEFINITIONS: Record<string, Omit<Award, 'dateEarned'>> = {
  best_municipal: { id: 'best_municipal', name: 'Best Municipal Course', prestigeBonus: 30 },
  top_100_public: { id: 'top_100_public', name: 'Top 100 Public Courses', prestigeBonus: 100 },
  pga_tour_venue: { id: 'pga_tour_venue', name: 'PGA Tour Venue', prestigeBonus: 200 },
  major_championship_host: { id: 'major_championship_host', name: 'Major Championship Host', prestigeBonus: 300 },
  reader_choice: { id: 'reader_choice', name: "Golfer's Choice Award", prestigeBonus: 50 },
  environmental: { id: 'environmental', name: 'Environmental Excellence', prestigeBonus: 40 },
  best_new_course: { id: 'best_new_course', name: 'Best New Course', prestigeBonus: 75 },
  hidden_gem: { id: 'hidden_gem', name: 'Hidden Gem', prestigeBonus: 60 },
} as const;

export function createInitialExclusivityState(): ExclusivityState {
  return {
    membershipModel: 'public',
    membershipCost: 0,
    waitlistLength: 0,
    advanceBookingDays: 7,
    dressCode: 'none',
    awards: [],
    composite: 0,
  };
}

export function calculateExclusivityScore(state: ExclusivityState): number {
  const membershipScore = MEMBERSHIP_BASE_SCORES[state.membershipModel];
  const membershipNormalized = membershipScore / 800;

  let priceScore = 0;
  if (state.membershipModel !== 'public') {
    if (state.membershipCost >= MEMBERSHIP_COST_THRESHOLD) {
      priceScore = 1.0;
    } else if (state.membershipCost > 0) {
      priceScore = state.membershipCost / MEMBERSHIP_COST_THRESHOLD;
    }
  }

  let bookingScore = 0;
  if (state.waitlistLength >= WAITLIST_BONUS_MONTHS) {
    bookingScore = 1.0;
  } else if (state.waitlistLength > 0) {
    bookingScore = state.waitlistLength / WAITLIST_BONUS_MONTHS;
  }
  if (state.advanceBookingDays > 14) {
    bookingScore = Math.min(1.0, bookingScore + 0.2);
  }

  const dressCodeScore = DRESS_CODE_BONUSES[state.dressCode] / 50;

  const baseScore =
    membershipNormalized * EXCLUSIVITY_WEIGHTS.membershipType +
    priceScore * EXCLUSIVITY_WEIGHTS.pricePoint +
    bookingScore * EXCLUSIVITY_WEIGHTS.bookingDifficulty +
    dressCodeScore * EXCLUSIVITY_WEIGHTS.dressCode;

  const awardsBonus = state.awards.reduce((sum, award) => sum + award.prestigeBonus, 0);
  const normalizedAwardsBonus = Math.min(200, awardsBonus) / 1000;

  const totalScore = (baseScore * 1000) + (normalizedAwardsBonus * 1000);

  return Math.max(0, Math.min(1000, Math.round(totalScore)));
}

export function setMembershipModel(
  state: ExclusivityState,
  model: MembershipModel,
  cost: number = 0
): ExclusivityState {
  const newState = {
    ...state,
    membershipModel: model,
    membershipCost: model === 'public' ? 0 : cost,
  };
  return {
    ...newState,
    composite: calculateExclusivityScore(newState),
  };
}

export function setWaitlistLength(state: ExclusivityState, months: number): ExclusivityState {
  const newState = {
    ...state,
    waitlistLength: Math.max(0, months),
  };
  return {
    ...newState,
    composite: calculateExclusivityScore(newState),
  };
}

export function setAdvanceBookingDays(state: ExclusivityState, days: number): ExclusivityState {
  const newState = {
    ...state,
    advanceBookingDays: Math.max(1, days),
  };
  return {
    ...newState,
    composite: calculateExclusivityScore(newState),
  };
}

export function setDressCode(state: ExclusivityState, dressCode: DressCode): ExclusivityState {
  const newState = {
    ...state,
    dressCode,
  };
  return {
    ...newState,
    composite: calculateExclusivityScore(newState),
  };
}

export function earnAward(state: ExclusivityState, awardId: string, day: number): ExclusivityState {
  const awardDef = AWARD_DEFINITIONS[awardId];
  if (!awardDef) return state;

  if (state.awards.some(a => a.id === awardId)) {
    return state;
  }

  const award: Award = {
    ...awardDef,
    dateEarned: day,
  };

  const newState = {
    ...state,
    awards: [...state.awards, award],
  };
  return {
    ...newState,
    composite: calculateExclusivityScore(newState),
  };
}

export function removeAward(state: ExclusivityState, awardId: string): ExclusivityState {
  const newState = {
    ...state,
    awards: state.awards.filter(a => a.id !== awardId),
  };
  return {
    ...newState,
    composite: calculateExclusivityScore(newState),
  };
}

export function getAwardsSummary(state: ExclusivityState): {
  count: number;
  totalBonus: number;
  awards: Award[];
} {
  const totalBonus = state.awards.reduce((sum, award) => sum + award.prestigeBonus, 0);
  return {
    count: state.awards.length,
    totalBonus,
    awards: state.awards,
  };
}

export function getMembershipLabel(model: MembershipModel): string {
  switch (model) {
    case 'public': return 'Public Course';
    case 'semi_private': return 'Semi-Private';
    case 'private': return 'Private Club';
    case 'exclusive': return 'Exclusive Club';
  }
}

export function getDressCodeLabel(dressCode: DressCode): string {
  switch (dressCode) {
    case 'none': return 'No Dress Code';
    case 'casual': return 'Casual';
    case 'smart_casual': return 'Smart Casual';
    case 'formal': return 'Formal Attire Required';
  }
}

export function getExclusivitySummary(state: ExclusivityState): {
  membership: string;
  membershipCost: number;
  waitlistMonths: number;
  dressCode: string;
  awardsCount: number;
  score: number;
} {
  return {
    membership: getMembershipLabel(state.membershipModel),
    membershipCost: state.membershipCost,
    waitlistMonths: state.waitlistLength,
    dressCode: getDressCodeLabel(state.dressCode),
    awardsCount: state.awards.length,
    score: state.composite,
  };
}
