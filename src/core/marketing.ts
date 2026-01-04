export type CampaignType =
  | 'local_advertising'
  | 'radio_campaign'
  | 'social_media'
  | 'golf_magazine'
  | 'free_round_voucher'
  | 'group_discount'
  | 'twilight_special'
  | 'tournament_hosting'
  | 'celebrity_appearance';

export type GolferTargetType =
  | 'casual'
  | 'regular'
  | 'avid'
  | 'serious'
  | 'new_golfer'
  | 'lapsed'
  | 'corporate'
  | 'social_group'
  | 'budget'
  | 'after_work'
  | 'young_professional'
  | 'high_handicap'
  | 'all';

export interface MarketingCampaign {
  id: string;
  type: CampaignType;
  name: string;
  description: string;
  dailyCost: number;
  setupCost: number;
  minDuration: number;
  maxDuration: number;
  demandMultiplier: number;
  targetAudience: GolferTargetType[];
  priceElasticityEffect: number;
  cooldownDays: number;
  maxConcurrent: number;
  twilightOnly?: boolean;
  isEvent?: boolean;
}

export const MARKETING_CAMPAIGNS: MarketingCampaign[] = [
  {
    id: 'local_newspaper',
    type: 'local_advertising',
    name: 'Local Newspaper Ad',
    description: 'Advertise in local newspapers to attract nearby golfers.',
    dailyCost: 100,
    setupCost: 0,
    minDuration: 7,
    maxDuration: 30,
    demandMultiplier: 1.15,
    targetAudience: ['casual', 'regular'],
    priceElasticityEffect: 0,
    cooldownDays: 0,
    maxConcurrent: 2,
  },
  {
    id: 'radio_spot',
    type: 'radio_campaign',
    name: 'Radio Advertising',
    description: 'Regional radio spots to reach a wider audience.',
    dailyCost: 300,
    setupCost: 500,
    minDuration: 14,
    maxDuration: 60,
    demandMultiplier: 1.25,
    targetAudience: ['casual', 'regular', 'avid'],
    priceElasticityEffect: 0,
    cooldownDays: 14,
    maxConcurrent: 1,
  },
  {
    id: 'social_media_push',
    type: 'social_media',
    name: 'Social Media Campaign',
    description: 'Targeted social media advertising for golf enthusiasts.',
    dailyCost: 150,
    setupCost: 200,
    minDuration: 7,
    maxDuration: 90,
    demandMultiplier: 1.20,
    targetAudience: ['casual', 'regular', 'young_professional'],
    priceElasticityEffect: -0.05,
    cooldownDays: 7,
    maxConcurrent: 2,
  },
  {
    id: 'golf_magazine_feature',
    type: 'golf_magazine',
    name: 'Golf Magazine Feature',
    description: 'Premium placement in regional golf magazine. Attracts serious golfers.',
    dailyCost: 500,
    setupCost: 2000,
    minDuration: 30,
    maxDuration: 90,
    demandMultiplier: 1.35,
    targetAudience: ['avid', 'serious', 'high_handicap'],
    priceElasticityEffect: 0.10,
    cooldownDays: 60,
    maxConcurrent: 1,
  },
  {
    id: 'free_round_voucher',
    type: 'free_round_voucher',
    name: 'Free Round Vouchers',
    description: 'Distribute free round vouchers. Great for new customer acquisition.',
    dailyCost: 0,
    setupCost: 0,
    minDuration: 7,
    maxDuration: 30,
    demandMultiplier: 2.0,
    targetAudience: ['new_golfer', 'casual', 'lapsed'],
    priceElasticityEffect: -0.30,
    cooldownDays: 90,
    maxConcurrent: 1,
  },
  {
    id: 'group_discount',
    type: 'group_discount',
    name: 'Group Booking Discount',
    description: '15% off for groups of 8 or more. Great for corporate outings.',
    dailyCost: 0,
    setupCost: 0,
    minDuration: 14,
    maxDuration: 365,
    demandMultiplier: 1.4,
    targetAudience: ['corporate', 'social_group'],
    priceElasticityEffect: -0.15,
    cooldownDays: 0,
    maxConcurrent: 1,
  },
  {
    id: 'twilight_special',
    type: 'twilight_special',
    name: 'Twilight Special',
    description: 'Heavily discounted twilight rates to fill afternoon slots.',
    dailyCost: 0,
    setupCost: 0,
    minDuration: 7,
    maxDuration: 365,
    demandMultiplier: 1.6,
    targetAudience: ['budget', 'casual', 'after_work'],
    priceElasticityEffect: -0.25,
    cooldownDays: 0,
    maxConcurrent: 1,
    twilightOnly: true,
  },
  {
    id: 'tournament_hosting',
    type: 'tournament_hosting',
    name: 'Host Tournament',
    description: 'Host a local tournament. One-time event with lasting reputation effects.',
    dailyCost: 0,
    setupCost: 5000,
    minDuration: 1,
    maxDuration: 1,
    demandMultiplier: 0,
    targetAudience: [],
    priceElasticityEffect: 0,
    cooldownDays: 30,
    maxConcurrent: 1,
    isEvent: true,
  },
  {
    id: 'celebrity_appearance',
    type: 'celebrity_appearance',
    name: 'Celebrity Pro Appearance',
    description: 'Book a celebrity golfer for a day. Huge publicity boost!',
    dailyCost: 0,
    setupCost: 25000,
    minDuration: 1,
    maxDuration: 3,
    demandMultiplier: 1.5,
    targetAudience: ['all'],
    priceElasticityEffect: 0.20,
    cooldownDays: 180,
    maxConcurrent: 1,
    isEvent: true,
  },
] as const;

export type CampaignStatus = 'active' | 'completed' | 'cancelled';

export interface ActiveCampaign {
  campaignId: string;
  startDay: number;
  plannedDuration: number;
  elapsedDays: number;
  status: CampaignStatus;
  totalCostSoFar: number;
  bookingsDuringCampaign: number;
  revenueDuringCampaign: number;
}

export type CampaignRecommendation = 'highly_effective' | 'effective' | 'marginal' | 'ineffective';

export interface CampaignEffectiveness {
  campaignId: string;
  startDay: number;
  endDay: number;
  durationDays: number;
  additionalBookings: number;
  revenueGenerated: number;
  costIncurred: number;
  returnOnInvestment: number;
  prestigeChange: number;
  recommendation: CampaignRecommendation;
}

export interface MarketingMetrics {
  totalSpent: number;
  totalRevenueGenerated: number;
  campaignsRun: number;
  averageRoi: number;
}

export interface MarketingState {
  activeCampaigns: ActiveCampaign[];
  campaignHistory: CampaignEffectiveness[];
  cooldowns: Record<string, number>;
  metrics: MarketingMetrics;
  baselineBookingsPerDay: number;
  baselineRevenuePerDay: number;
}

export function createInitialMarketingState(
  baselineBookings: number = 20,
  baselineRevenue: number = 2000
): MarketingState {
  return {
    activeCampaigns: [],
    campaignHistory: [],
    cooldowns: {},
    metrics: {
      totalSpent: 0,
      totalRevenueGenerated: 0,
      campaignsRun: 0,
      averageRoi: 0,
    },
    baselineBookingsPerDay: baselineBookings,
    baselineRevenuePerDay: baselineRevenue,
  };
}

export function getCampaignById(campaignId: string): MarketingCampaign | undefined {
  return MARKETING_CAMPAIGNS.find(c => c.id === campaignId);
}

export function isOnCooldown(state: MarketingState, campaignId: string): boolean {
  return (state.cooldowns[campaignId] ?? 0) > 0;
}

export function getCooldownRemaining(state: MarketingState, campaignId: string): number {
  return state.cooldowns[campaignId] ?? 0;
}

export function getActiveCampaignCount(state: MarketingState, campaignId: string): number {
  return state.activeCampaigns.filter(
    ac => ac.campaignId === campaignId && ac.status === 'active'
  ).length;
}

export function canStartCampaign(
  state: MarketingState,
  campaignId: string,
  availableCash: number
): { canStart: boolean; reason?: string } {
  const campaign = getCampaignById(campaignId);
  if (!campaign) {
    return { canStart: false, reason: 'Campaign not found' };
  }

  if (isOnCooldown(state, campaignId)) {
    const remaining = getCooldownRemaining(state, campaignId);
    return { canStart: false, reason: `On cooldown for ${remaining} more days` };
  }

  const activeCount = getActiveCampaignCount(state, campaignId);
  if (activeCount >= campaign.maxConcurrent) {
    return { canStart: false, reason: 'Maximum concurrent campaigns reached' };
  }

  const startupCost = campaign.setupCost + campaign.dailyCost;
  if (availableCash < startupCost) {
    return { canStart: false, reason: `Need $${startupCost} to start (have $${availableCash})` };
  }

  return { canStart: true };
}

export function startCampaign(
  state: MarketingState,
  campaignId: string,
  currentDay: number,
  duration: number
): { state: MarketingState; setupCost: number } | null {
  const campaign = getCampaignById(campaignId);
  if (!campaign) return null;

  const clampedDuration = Math.max(
    campaign.minDuration,
    Math.min(campaign.maxDuration, duration)
  );

  const newCampaign: ActiveCampaign = {
    campaignId,
    startDay: currentDay,
    plannedDuration: clampedDuration,
    elapsedDays: 0,
    status: 'active',
    totalCostSoFar: campaign.setupCost,
    bookingsDuringCampaign: 0,
    revenueDuringCampaign: 0,
  };

  return {
    state: {
      ...state,
      activeCampaigns: [...state.activeCampaigns, newCampaign],
    },
    setupCost: campaign.setupCost,
  };
}

export function stopCampaign(
  state: MarketingState,
  campaignId: string,
  currentDay: number
): MarketingState {
  const activeCampaign = state.activeCampaigns.find(
    ac => ac.campaignId === campaignId && ac.status === 'active'
  );

  if (!activeCampaign) return state;

  const campaign = getCampaignById(campaignId);
  if (!campaign) return state;

  const effectiveness = evaluateCampaign(
    state,
    activeCampaign,
    campaign,
    currentDay
  );

  const updatedActiveCampaigns = state.activeCampaigns.map(ac =>
    ac === activeCampaign ? { ...ac, status: 'cancelled' as const } : ac
  );

  const newCooldowns = { ...state.cooldowns };
  if (campaign.cooldownDays > 0) {
    newCooldowns[campaignId] = campaign.cooldownDays;
  }

  return {
    ...state,
    activeCampaigns: updatedActiveCampaigns.filter(ac => ac.status === 'active'),
    campaignHistory: [...state.campaignHistory, effectiveness],
    cooldowns: newCooldowns,
    metrics: updateMetrics(state.metrics, effectiveness),
  };
}

export function processDailyCampaigns(
  state: MarketingState,
  currentDay: number,
  dailyBookings: number,
  dailyRevenue: number
): { state: MarketingState; dailyCost: number; completedCampaignNames: string[] } {
  let totalDailyCost = 0;
  const completedCampaigns: CampaignEffectiveness[] = [];
  const completedCampaignNames: string[] = [];
  const stillActive: ActiveCampaign[] = [];
  const newCooldowns = { ...state.cooldowns };

  for (const key of Object.keys(newCooldowns)) {
    if (newCooldowns[key] > 0) {
      newCooldowns[key]--;
    }
  }

  for (const activeCampaign of state.activeCampaigns) {
    if (activeCampaign.status !== 'active') continue;

    const campaign = getCampaignById(activeCampaign.campaignId);
    if (!campaign) continue;

    const updated: ActiveCampaign = {
      ...activeCampaign,
      elapsedDays: activeCampaign.elapsedDays + 1,
      totalCostSoFar: activeCampaign.totalCostSoFar + campaign.dailyCost,
      bookingsDuringCampaign: activeCampaign.bookingsDuringCampaign + dailyBookings,
      revenueDuringCampaign: activeCampaign.revenueDuringCampaign + dailyRevenue,
    };

    totalDailyCost += campaign.dailyCost;

    if (updated.elapsedDays >= updated.plannedDuration) {
      const effectiveness = evaluateCampaign(state, updated, campaign, currentDay);
      completedCampaigns.push(effectiveness);
      completedCampaignNames.push(campaign.name);

      if (campaign.cooldownDays > 0) {
        newCooldowns[campaign.id] = campaign.cooldownDays;
      }
    } else {
      stillActive.push(updated);
    }
  }

  let updatedMetrics = state.metrics;
  for (const eff of completedCampaigns) {
    updatedMetrics = updateMetrics(updatedMetrics, eff);
  }

  return {
    state: {
      ...state,
      activeCampaigns: stillActive,
      campaignHistory: [...state.campaignHistory, ...completedCampaigns],
      cooldowns: newCooldowns,
      metrics: updatedMetrics,
    },
    dailyCost: totalDailyCost,
    completedCampaignNames,
  };
}

export function evaluateCampaign(
  state: MarketingState,
  activeCampaign: ActiveCampaign,
  campaign: MarketingCampaign,
  _currentDay: number
): CampaignEffectiveness {
  const days = activeCampaign.elapsedDays || 1;
  const avgBookings = activeCampaign.bookingsDuringCampaign / days;
  const additionalBookings = Math.max(0, (avgBookings - state.baselineBookingsPerDay) * days);

  const avgRevenue = activeCampaign.revenueDuringCampaign / days;
  const additionalRevenue = Math.max(0, (avgRevenue - state.baselineRevenuePerDay) * days);

  const cost = activeCampaign.totalCostSoFar;
  const roi = cost > 0 ? (additionalRevenue - cost) / cost : 0;

  const prestigeChange = calculatePrestigeFromCampaign(campaign, days);

  return {
    campaignId: activeCampaign.campaignId,
    startDay: activeCampaign.startDay,
    endDay: activeCampaign.startDay + days,
    durationDays: days,
    additionalBookings: Math.round(additionalBookings),
    revenueGenerated: Math.round(additionalRevenue * 100) / 100,
    costIncurred: cost,
    returnOnInvestment: Math.round(roi * 100) / 100,
    prestigeChange,
    recommendation: getRecommendation(roi),
  };
}

export function calculatePrestigeFromCampaign(
  campaign: MarketingCampaign,
  durationDays: number
): number {
  switch (campaign.type) {
    case 'golf_magazine':
      return Math.min(50, 5 + durationDays);
    case 'celebrity_appearance':
      return 100;
    case 'tournament_hosting':
      return 75;
    case 'free_round_voucher':
      return -10;
    case 'radio_campaign':
      return Math.min(20, durationDays);
    case 'social_media':
      return Math.min(10, Math.floor(durationDays / 3));
    default:
      return 0;
  }
}

export function getRecommendation(roi: number): CampaignRecommendation {
  if (roi >= 2.0) return 'highly_effective';
  if (roi >= 1.0) return 'effective';
  if (roi >= 0.5) return 'marginal';
  return 'ineffective';
}

function updateMetrics(
  metrics: MarketingMetrics,
  effectiveness: CampaignEffectiveness
): MarketingMetrics {
  const campaignsRun = metrics.campaignsRun + 1;
  const totalSpent = metrics.totalSpent + effectiveness.costIncurred;
  const totalRevenueGenerated = metrics.totalRevenueGenerated + effectiveness.revenueGenerated;

  const previousTotalRoi = metrics.averageRoi * metrics.campaignsRun;
  const newAverageRoi = (previousTotalRoi + effectiveness.returnOnInvestment) / campaignsRun;

  return {
    totalSpent,
    totalRevenueGenerated,
    campaignsRun,
    averageRoi: Math.round(newAverageRoi * 100) / 100,
  };
}

export function calculateCombinedDemandMultiplier(state: MarketingState): number {
  let multiplier = 1.0;

  for (const activeCampaign of state.activeCampaigns) {
    if (activeCampaign.status !== 'active') continue;

    const campaign = getCampaignById(activeCampaign.campaignId);
    if (!campaign) continue;

    if (campaign.demandMultiplier > 0) {
      multiplier *= campaign.demandMultiplier;
    }
  }

  return Math.round(multiplier * 100) / 100;
}

export function calculateCombinedElasticityEffect(state: MarketingState): number {
  let effect = 0;

  for (const activeCampaign of state.activeCampaigns) {
    if (activeCampaign.status !== 'active') continue;

    const campaign = getCampaignById(activeCampaign.campaignId);
    if (!campaign) continue;

    effect += campaign.priceElasticityEffect;
  }

  return Math.round(effect * 100) / 100;
}

export function getTargetedAudiences(state: MarketingState): GolferTargetType[] {
  const audiences = new Set<GolferTargetType>();

  for (const activeCampaign of state.activeCampaigns) {
    if (activeCampaign.status !== 'active') continue;

    const campaign = getCampaignById(activeCampaign.campaignId);
    if (!campaign) continue;

    for (const audience of campaign.targetAudience) {
      audiences.add(audience);
    }
  }

  return Array.from(audiences);
}

export function hasTwilightCampaign(state: MarketingState): boolean {
  return state.activeCampaigns.some(ac => {
    if (ac.status !== 'active') return false;
    const campaign = getCampaignById(ac.campaignId);
    return campaign?.twilightOnly === true;
  });
}

export function hasActiveEvent(state: MarketingState): boolean {
  return state.activeCampaigns.some(ac => {
    if (ac.status !== 'active') return false;
    const campaign = getCampaignById(ac.campaignId);
    return campaign?.isEvent === true;
  });
}

export function getAvailableCampaigns(
  state: MarketingState,
  availableCash: number
): Array<{ campaign: MarketingCampaign; canStart: boolean; reason?: string }> {
  return MARKETING_CAMPAIGNS.map(campaign => {
    const { canStart, reason } = canStartCampaign(state, campaign.id, availableCash);
    return { campaign, canStart, reason };
  });
}

export function getCampaignSummary(state: MarketingState): {
  activeCampaignCount: number;
  totalDailyCost: number;
  combinedDemandMultiplier: number;
  combinedElasticityEffect: number;
  historicalRoi: number;
  totalHistoricalSpent: number;
  totalHistoricalRevenue: number;
} {
  let totalDailyCost = 0;
  for (const ac of state.activeCampaigns) {
    if (ac.status !== 'active') continue;
    const campaign = getCampaignById(ac.campaignId);
    if (campaign) {
      totalDailyCost += campaign.dailyCost;
    }
  }

  return {
    activeCampaignCount: state.activeCampaigns.filter(ac => ac.status === 'active').length,
    totalDailyCost,
    combinedDemandMultiplier: calculateCombinedDemandMultiplier(state),
    combinedElasticityEffect: calculateCombinedElasticityEffect(state),
    historicalRoi: state.metrics.averageRoi,
    totalHistoricalSpent: state.metrics.totalSpent,
    totalHistoricalRevenue: state.metrics.totalRevenueGenerated,
  };
}

export function updateBaseline(
  state: MarketingState,
  baselineBookings: number,
  baselineRevenue: number
): MarketingState {
  return {
    ...state,
    baselineBookingsPerDay: baselineBookings,
    baselineRevenuePerDay: baselineRevenue,
  };
}
