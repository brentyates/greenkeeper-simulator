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

const MEMBERSHIP_BASE_SCORES: Record<MembershipModel, number> = {
  public: 0,
  semi_private: 200,
  private: 500,
  exclusive: 800,
} as const;

const EXCLUSIVITY_WEIGHTS = {
  membershipType: 0.40,
  pricePoint: 0.25,
  bookingDifficulty: 0.20,
  dressCode: 0.15,
} as const;

const MEMBERSHIP_COST_THRESHOLD = 25000;
const WAITLIST_BONUS_MONTHS = 12;

const DRESS_CODE_BONUSES: Record<DressCode, number> = {
  none: 0,
  casual: 10,
  smart_casual: 30,
  formal: 50,
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
