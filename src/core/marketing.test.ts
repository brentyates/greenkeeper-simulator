import { describe, it, expect } from 'vitest';
import {
  createInitialMarketingState,
  getCampaignById,
  isOnCooldown,
  getCooldownRemaining,
  getActiveCampaignCount,
  canStartCampaign,
  startCampaign,
  stopCampaign,
  processDailyCampaigns,
  evaluateCampaign,
  calculatePrestigeFromCampaign,
  getRecommendation,
  calculateCombinedDemandMultiplier,
  calculateCombinedElasticityEffect,
  getTargetedAudiences,
  hasTwilightCampaign,
  hasActiveEvent,
  getAvailableCampaigns,
  getCampaignSummary,
  updateBaseline,
  MARKETING_CAMPAIGNS,
  type MarketingState,
  type ActiveCampaign,
} from './marketing';

describe('marketing', () => {
  describe('MARKETING_CAMPAIGNS', () => {
    it('has expected campaign types', () => {
      const types = MARKETING_CAMPAIGNS.map(c => c.type);
      expect(types).toContain('local_advertising');
      expect(types).toContain('radio_campaign');
      expect(types).toContain('social_media');
      expect(types).toContain('golf_magazine');
      expect(types).toContain('free_round_voucher');
      expect(types).toContain('group_discount');
      expect(types).toContain('twilight_special');
      expect(types).toContain('tournament_hosting');
      expect(types).toContain('celebrity_appearance');
    });

    it('has valid cost and duration values', () => {
      for (const campaign of MARKETING_CAMPAIGNS) {
        expect(campaign.dailyCost).toBeGreaterThanOrEqual(0);
        expect(campaign.setupCost).toBeGreaterThanOrEqual(0);
        expect(campaign.minDuration).toBeGreaterThan(0);
        expect(campaign.maxDuration).toBeGreaterThanOrEqual(campaign.minDuration);
      }
    });

    it('has demand multipliers in reasonable range', () => {
      for (const campaign of MARKETING_CAMPAIGNS) {
        expect(campaign.demandMultiplier).toBeGreaterThanOrEqual(0);
        expect(campaign.demandMultiplier).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('createInitialMarketingState', () => {
    it('creates empty state with defaults', () => {
      const state = createInitialMarketingState();
      expect(state.activeCampaigns).toEqual([]);
      expect(state.campaignHistory).toEqual([]);
      expect(state.cooldowns).toEqual({});
      expect(state.metrics.totalSpent).toBe(0);
      expect(state.baselineBookingsPerDay).toBe(20);
      expect(state.baselineRevenuePerDay).toBe(2000);
    });

    it('accepts custom baseline values', () => {
      const state = createInitialMarketingState(30, 3500);
      expect(state.baselineBookingsPerDay).toBe(30);
      expect(state.baselineRevenuePerDay).toBe(3500);
    });
  });

  describe('getCampaignById', () => {
    it('returns campaign when found', () => {
      const campaign = getCampaignById('local_newspaper');
      expect(campaign).toBeDefined();
      expect(campaign!.name).toBe('Local Newspaper Ad');
    });

    it('returns undefined when not found', () => {
      const campaign = getCampaignById('nonexistent');
      expect(campaign).toBeUndefined();
    });
  });

  describe('cooldown tracking', () => {
    it('returns false when no cooldown', () => {
      const state = createInitialMarketingState();
      expect(isOnCooldown(state, 'radio_spot')).toBe(false);
    });

    it('returns true when on cooldown', () => {
      const state: MarketingState = {
        ...createInitialMarketingState(),
        cooldowns: { radio_spot: 10 },
      };
      expect(isOnCooldown(state, 'radio_spot')).toBe(true);
    });

    it('returns remaining cooldown days', () => {
      const state: MarketingState = {
        ...createInitialMarketingState(),
        cooldowns: { radio_spot: 10 },
      };
      expect(getCooldownRemaining(state, 'radio_spot')).toBe(10);
      expect(getCooldownRemaining(state, 'local_newspaper')).toBe(0);
    });
  });

  describe('getActiveCampaignCount', () => {
    it('counts active campaigns by id', () => {
      const campaign: ActiveCampaign = {
        campaignId: 'local_newspaper',
        startDay: 1,
        plannedDuration: 7,
        elapsedDays: 2,
        status: 'active',
        totalCostSoFar: 200,
        bookingsDuringCampaign: 50,
        revenueDuringCampaign: 5000,
      };
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: [campaign],
      };
      expect(getActiveCampaignCount(state, 'local_newspaper')).toBe(1);
      expect(getActiveCampaignCount(state, 'radio_spot')).toBe(0);
    });
  });

  describe('canStartCampaign', () => {
    it('allows starting valid campaign with sufficient cash', () => {
      const state = createInitialMarketingState();
      const result = canStartCampaign(state, 'local_newspaper', 1000);
      expect(result.canStart).toBe(true);
    });

    it('rejects nonexistent campaign', () => {
      const state = createInitialMarketingState();
      const result = canStartCampaign(state, 'fake_campaign', 1000);
      expect(result.canStart).toBe(false);
      expect(result.reason).toBe('Campaign not found');
    });

    it('rejects campaign on cooldown', () => {
      const state: MarketingState = {
        ...createInitialMarketingState(),
        cooldowns: { radio_spot: 5 },
      };
      const result = canStartCampaign(state, 'radio_spot', 10000);
      expect(result.canStart).toBe(false);
      expect(result.reason).toContain('cooldown');
    });

    it('rejects when max concurrent reached', () => {
      const campaign: ActiveCampaign = {
        campaignId: 'radio_spot',
        startDay: 1,
        plannedDuration: 14,
        elapsedDays: 2,
        status: 'active',
        totalCostSoFar: 800,
        bookingsDuringCampaign: 50,
        revenueDuringCampaign: 5000,
      };
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: [campaign],
      };
      const result = canStartCampaign(state, 'radio_spot', 10000);
      expect(result.canStart).toBe(false);
      expect(result.reason).toContain('Maximum concurrent');
    });

    it('rejects when insufficient cash', () => {
      const state = createInitialMarketingState();
      const result = canStartCampaign(state, 'radio_spot', 100);
      expect(result.canStart).toBe(false);
      expect(result.reason).toContain('Need $');
    });
  });

  describe('startCampaign', () => {
    it('adds campaign to active list', () => {
      const state = createInitialMarketingState();
      const result = startCampaign(state, 'local_newspaper', 10, 14);
      expect(result).not.toBeNull();
      expect(result!.state.activeCampaigns).toHaveLength(1);
      expect(result!.state.activeCampaigns[0].campaignId).toBe('local_newspaper');
    });

    it('returns setup cost', () => {
      const state = createInitialMarketingState();
      const result = startCampaign(state, 'radio_spot', 10, 30);
      expect(result!.setupCost).toBe(500);
    });

    it('clamps duration to min/max', () => {
      const state = createInitialMarketingState();
      const resultTooShort = startCampaign(state, 'radio_spot', 10, 1);
      expect(resultTooShort!.state.activeCampaigns[0].plannedDuration).toBe(14);

      const resultTooLong = startCampaign(state, 'radio_spot', 10, 1000);
      expect(resultTooLong!.state.activeCampaigns[0].plannedDuration).toBe(60);
    });

    it('returns null for invalid campaign', () => {
      const state = createInitialMarketingState();
      const result = startCampaign(state, 'fake', 10, 14);
      expect(result).toBeNull();
    });
  });

  describe('stopCampaign', () => {
    it('removes campaign and adds to history', () => {
      const campaign: ActiveCampaign = {
        campaignId: 'local_newspaper',
        startDay: 1,
        plannedDuration: 14,
        elapsedDays: 5,
        status: 'active',
        totalCostSoFar: 500,
        bookingsDuringCampaign: 150,
        revenueDuringCampaign: 15000,
      };
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: [campaign],
      };

      const result = stopCampaign(state, 'local_newspaper', 6);
      expect(result.activeCampaigns).toHaveLength(0);
      expect(result.campaignHistory).toHaveLength(1);
    });

    it('sets cooldown when campaign has cooldown', () => {
      const campaign: ActiveCampaign = {
        campaignId: 'radio_spot',
        startDay: 1,
        plannedDuration: 14,
        elapsedDays: 10,
        status: 'active',
        totalCostSoFar: 3500,
        bookingsDuringCampaign: 300,
        revenueDuringCampaign: 30000,
      };
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: [campaign],
      };

      const result = stopCampaign(state, 'radio_spot', 11);
      expect(result.cooldowns['radio_spot']).toBe(14);
    });

    it('preserves other campaigns when stopping one', () => {
      const campaigns: ActiveCampaign[] = [
        {
          campaignId: 'local_newspaper',
          startDay: 1,
          plannedDuration: 7,
          elapsedDays: 3,
          status: 'active',
          totalCostSoFar: 300,
          bookingsDuringCampaign: 90,
          revenueDuringCampaign: 9000,
        },
        {
          campaignId: 'radio_spot',
          startDay: 2,
          plannedDuration: 14,
          elapsedDays: 5,
          status: 'active',
          totalCostSoFar: 750,
          bookingsDuringCampaign: 150,
          revenueDuringCampaign: 15000,
        },
      ];
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: campaigns,
      };

      const result = stopCampaign(state, 'local_newspaper', 10);
      expect(result.activeCampaigns).toHaveLength(1);
      expect(result.activeCampaigns[0].campaignId).toBe('radio_spot');
      expect(result.activeCampaigns[0].status).toBe('active');
      expect(result.campaignHistory).toHaveLength(1);
    });

    it('returns unchanged state if campaign not found', () => {
      const state = createInitialMarketingState();
      const result = stopCampaign(state, 'local_newspaper', 10);
      expect(result).toEqual(state);
    });

    it('returns unchanged state if campaign definition not found', () => {
      const campaign: ActiveCampaign = {
        campaignId: 'nonexistent_campaign',
        startDay: 1,
        plannedDuration: 7,
        elapsedDays: 3,
        status: 'active',
        totalCostSoFar: 300,
        bookingsDuringCampaign: 90,
        revenueDuringCampaign: 9000,
      };
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: [campaign],
      };

      const result = stopCampaign(state, 'nonexistent_campaign', 10);
      expect(result).toEqual(state);
    });
  });

  describe('processDailyCampaigns', () => {
    it('accumulates daily costs and bookings', () => {
      const campaign: ActiveCampaign = {
        campaignId: 'local_newspaper',
        startDay: 1,
        plannedDuration: 7,
        elapsedDays: 2,
        status: 'active',
        totalCostSoFar: 200,
        bookingsDuringCampaign: 50,
        revenueDuringCampaign: 5000,
      };
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: [campaign],
      };

      const { state: newState, dailyCost } = processDailyCampaigns(state, 4, 30, 3000);
      expect(dailyCost).toBe(100);
      expect(newState.activeCampaigns[0].elapsedDays).toBe(3);
      expect(newState.activeCampaigns[0].bookingsDuringCampaign).toBe(80);
      expect(newState.activeCampaigns[0].revenueDuringCampaign).toBe(8000);
    });

    it('completes campaign when duration reached', () => {
      const campaign: ActiveCampaign = {
        campaignId: 'local_newspaper',
        startDay: 1,
        plannedDuration: 7,
        elapsedDays: 6,
        status: 'active',
        totalCostSoFar: 600,
        bookingsDuringCampaign: 180,
        revenueDuringCampaign: 18000,
      };
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: [campaign],
      };

      const { state: newState } = processDailyCampaigns(state, 8, 30, 3000);
      expect(newState.activeCampaigns).toHaveLength(0);
      expect(newState.campaignHistory).toHaveLength(1);
      expect(newState.metrics.campaignsRun).toBe(1);
    });

    it('decrements cooldowns', () => {
      const state: MarketingState = {
        ...createInitialMarketingState(),
        cooldowns: { radio_spot: 5, social_media_push: 1 },
      };

      const { state: newState } = processDailyCampaigns(state, 10, 25, 2500);
      expect(newState.cooldowns['radio_spot']).toBe(4);
      expect(newState.cooldowns['social_media_push']).toBe(0);
    });

    it('does not decrement cooldown already at 0', () => {
      const state: MarketingState = {
        ...createInitialMarketingState(),
        cooldowns: { radio_spot: 0 },
      };

      const { state: newState } = processDailyCampaigns(state, 10, 25, 2500);
      expect(newState.cooldowns['radio_spot']).toBe(0);
    });

    it('sets cooldown when campaign with cooldownDays completes', () => {
      const campaign: ActiveCampaign = {
        campaignId: 'radio_spot',
        startDay: 1,
        plannedDuration: 7,
        elapsedDays: 6,
        status: 'active',
        totalCostSoFar: 1050,
        bookingsDuringCampaign: 180,
        revenueDuringCampaign: 18000,
      };
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: [campaign],
      };

      const { state: newState } = processDailyCampaigns(state, 8, 30, 3000);
      expect(newState.activeCampaigns).toHaveLength(0);
      expect(newState.cooldowns['radio_spot']).toBe(14);
    });

    it('skips non-active campaigns', () => {
      const campaign: ActiveCampaign = {
        campaignId: 'local_newspaper',
        startDay: 1,
        plannedDuration: 7,
        elapsedDays: 2,
        status: 'cancelled',
        totalCostSoFar: 200,
        bookingsDuringCampaign: 50,
        revenueDuringCampaign: 5000,
      };
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: [campaign],
      };

      const { state: newState, dailyCost } = processDailyCampaigns(state, 4, 30, 3000);
      expect(dailyCost).toBe(0);
      expect(newState.activeCampaigns).toHaveLength(0);
    });

    it('skips campaigns with invalid ID', () => {
      const campaign: ActiveCampaign = {
        campaignId: 'nonexistent_campaign',
        startDay: 1,
        plannedDuration: 7,
        elapsedDays: 2,
        status: 'active',
        totalCostSoFar: 200,
        bookingsDuringCampaign: 50,
        revenueDuringCampaign: 5000,
      };
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: [campaign],
      };

      const { state: newState, dailyCost } = processDailyCampaigns(state, 4, 30, 3000);
      expect(dailyCost).toBe(0);
      expect(newState.activeCampaigns).toHaveLength(0);
    });
  });

  describe('evaluateCampaign', () => {
    it('calculates ROI correctly', () => {
      const state = createInitialMarketingState(20, 2000);
      const campaign: ActiveCampaign = {
        campaignId: 'local_newspaper',
        startDay: 1,
        plannedDuration: 7,
        elapsedDays: 7,
        status: 'active',
        totalCostSoFar: 700,
        bookingsDuringCampaign: 210,
        revenueDuringCampaign: 21000,
      };
      const definition = getCampaignById('local_newspaper')!;

      const result = evaluateCampaign(state, campaign, definition, 8);
      expect(result.durationDays).toBe(7);
      expect(result.costIncurred).toBe(700);
      expect(result.additionalBookings).toBe(70);
      expect(result.revenueGenerated).toBe(7000);
      expect(result.returnOnInvestment).toBe(9);
      expect(result.recommendation).toBe('highly_effective');
    });

    it('handles zero cost campaigns', () => {
      const state = createInitialMarketingState(20, 2000);
      const campaign: ActiveCampaign = {
        campaignId: 'twilight_special',
        startDay: 1,
        plannedDuration: 7,
        elapsedDays: 7,
        status: 'active',
        totalCostSoFar: 0,
        bookingsDuringCampaign: 210,
        revenueDuringCampaign: 15000,
      };
      const definition = getCampaignById('twilight_special')!;

      const result = evaluateCampaign(state, campaign, definition, 8);
      expect(result.returnOnInvestment).toBe(0);
    });

    it('defaults to 1 day when elapsedDays is 0', () => {
      const state = createInitialMarketingState(20, 2000);
      const campaign: ActiveCampaign = {
        campaignId: 'local_newspaper',
        startDay: 1,
        plannedDuration: 7,
        elapsedDays: 0,
        status: 'active',
        totalCostSoFar: 100,
        bookingsDuringCampaign: 30,
        revenueDuringCampaign: 3000,
      };
      const definition = getCampaignById('local_newspaper')!;

      const result = evaluateCampaign(state, campaign, definition, 1);
      expect(result.durationDays).toBe(1);
    });
  });

  describe('calculatePrestigeFromCampaign', () => {
    it('gives high prestige for celebrity appearance', () => {
      const campaign = getCampaignById('celebrity_appearance')!;
      expect(calculatePrestigeFromCampaign(campaign, 1)).toBe(100);
    });

    it('gives prestige for tournament', () => {
      const campaign = getCampaignById('tournament_hosting')!;
      expect(calculatePrestigeFromCampaign(campaign, 1)).toBe(75);
    });

    it('gives negative prestige for free vouchers', () => {
      const campaign = getCampaignById('free_round_voucher')!;
      expect(calculatePrestigeFromCampaign(campaign, 14)).toBe(-10);
    });

    it('scales magazine prestige with duration', () => {
      const campaign = getCampaignById('golf_magazine_feature')!;
      expect(calculatePrestigeFromCampaign(campaign, 30)).toBe(35);
      expect(calculatePrestigeFromCampaign(campaign, 90)).toBe(50);
    });

    it('scales radio prestige with duration', () => {
      const campaign = getCampaignById('radio_spot')!;
      expect(calculatePrestigeFromCampaign(campaign, 10)).toBe(10);
      expect(calculatePrestigeFromCampaign(campaign, 30)).toBe(20);
    });

    it('scales social media prestige with duration', () => {
      const campaign = getCampaignById('social_media_push')!;
      expect(calculatePrestigeFromCampaign(campaign, 3)).toBe(1);
      expect(calculatePrestigeFromCampaign(campaign, 30)).toBe(10);
    });
  });

  describe('getRecommendation', () => {
    it('returns highly_effective for ROI >= 2.0', () => {
      expect(getRecommendation(2.0)).toBe('highly_effective');
      expect(getRecommendation(5.0)).toBe('highly_effective');
    });

    it('returns effective for ROI >= 1.0', () => {
      expect(getRecommendation(1.0)).toBe('effective');
      expect(getRecommendation(1.5)).toBe('effective');
    });

    it('returns marginal for ROI >= 0.5', () => {
      expect(getRecommendation(0.5)).toBe('marginal');
      expect(getRecommendation(0.75)).toBe('marginal');
    });

    it('returns ineffective for ROI < 0.5', () => {
      expect(getRecommendation(0.4)).toBe('ineffective');
      expect(getRecommendation(-1)).toBe('ineffective');
    });
  });

  describe('calculateCombinedDemandMultiplier', () => {
    it('returns 1.0 with no active campaigns', () => {
      const state = createInitialMarketingState();
      expect(calculateCombinedDemandMultiplier(state)).toBe(1.0);
    });

    it('multiplies demand from multiple campaigns', () => {
      const campaigns: ActiveCampaign[] = [
        {
          campaignId: 'local_newspaper',
          startDay: 1,
          plannedDuration: 7,
          elapsedDays: 2,
          status: 'active',
          totalCostSoFar: 200,
          bookingsDuringCampaign: 50,
          revenueDuringCampaign: 5000,
        },
        {
          campaignId: 'social_media_push',
          startDay: 1,
          plannedDuration: 14,
          elapsedDays: 2,
          status: 'active',
          totalCostSoFar: 350,
          bookingsDuringCampaign: 55,
          revenueDuringCampaign: 5500,
        },
      ];
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: campaigns,
      };

      const result = calculateCombinedDemandMultiplier(state);
      expect(result).toBeCloseTo(1.15 * 1.20, 2);
    });

    it('skips non-active campaigns', () => {
      const campaigns: ActiveCampaign[] = [
        {
          campaignId: 'local_newspaper',
          startDay: 1,
          plannedDuration: 7,
          elapsedDays: 2,
          status: 'cancelled',
          totalCostSoFar: 200,
          bookingsDuringCampaign: 50,
          revenueDuringCampaign: 5000,
        },
      ];
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: campaigns,
      };

      expect(calculateCombinedDemandMultiplier(state)).toBe(1.0);
    });

    it('skips campaigns with invalid ID', () => {
      const campaigns: ActiveCampaign[] = [
        {
          campaignId: 'nonexistent',
          startDay: 1,
          plannedDuration: 7,
          elapsedDays: 2,
          status: 'active',
          totalCostSoFar: 200,
          bookingsDuringCampaign: 50,
          revenueDuringCampaign: 5000,
        },
      ];
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: campaigns,
      };

      expect(calculateCombinedDemandMultiplier(state)).toBe(1.0);
    });

    it('skips campaigns with demandMultiplier = 0', () => {
      const campaigns: ActiveCampaign[] = [
        {
          campaignId: 'tournament_hosting',
          startDay: 1,
          plannedDuration: 1,
          elapsedDays: 0,
          status: 'active',
          totalCostSoFar: 5000,
          bookingsDuringCampaign: 0,
          revenueDuringCampaign: 0,
        },
      ];
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: campaigns,
      };

      expect(calculateCombinedDemandMultiplier(state)).toBe(1.0);
    });
  });

  describe('calculateCombinedElasticityEffect', () => {
    it('returns 0 with no active campaigns', () => {
      const state = createInitialMarketingState();
      expect(calculateCombinedElasticityEffect(state)).toBe(0);
    });

    it('sums elasticity effects', () => {
      const campaigns: ActiveCampaign[] = [
        {
          campaignId: 'social_media_push',
          startDay: 1,
          plannedDuration: 14,
          elapsedDays: 2,
          status: 'active',
          totalCostSoFar: 350,
          bookingsDuringCampaign: 55,
          revenueDuringCampaign: 5500,
        },
        {
          campaignId: 'golf_magazine_feature',
          startDay: 1,
          plannedDuration: 30,
          elapsedDays: 5,
          status: 'active',
          totalCostSoFar: 4500,
          bookingsDuringCampaign: 150,
          revenueDuringCampaign: 15000,
        },
      ];
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: campaigns,
      };

      const result = calculateCombinedElasticityEffect(state);
      expect(result).toBe(0.05);
    });

    it('skips non-active campaigns', () => {
      const campaigns: ActiveCampaign[] = [
        {
          campaignId: 'social_media_push',
          startDay: 1,
          plannedDuration: 14,
          elapsedDays: 2,
          status: 'completed',
          totalCostSoFar: 350,
          bookingsDuringCampaign: 55,
          revenueDuringCampaign: 5500,
        },
      ];
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: campaigns,
      };

      expect(calculateCombinedElasticityEffect(state)).toBe(0);
    });

    it('skips campaigns with invalid ID', () => {
      const campaigns: ActiveCampaign[] = [
        {
          campaignId: 'nonexistent',
          startDay: 1,
          plannedDuration: 14,
          elapsedDays: 2,
          status: 'active',
          totalCostSoFar: 350,
          bookingsDuringCampaign: 55,
          revenueDuringCampaign: 5500,
        },
      ];
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: campaigns,
      };

      expect(calculateCombinedElasticityEffect(state)).toBe(0);
    });
  });

  describe('getTargetedAudiences', () => {
    it('returns empty array with no active campaigns', () => {
      const state = createInitialMarketingState();
      expect(getTargetedAudiences(state)).toEqual([]);
    });

    it('combines unique audiences from campaigns', () => {
      const campaigns: ActiveCampaign[] = [
        {
          campaignId: 'local_newspaper',
          startDay: 1,
          plannedDuration: 7,
          elapsedDays: 2,
          status: 'active',
          totalCostSoFar: 200,
          bookingsDuringCampaign: 50,
          revenueDuringCampaign: 5000,
        },
        {
          campaignId: 'social_media_push',
          startDay: 1,
          plannedDuration: 14,
          elapsedDays: 2,
          status: 'active',
          totalCostSoFar: 350,
          bookingsDuringCampaign: 55,
          revenueDuringCampaign: 5500,
        },
      ];
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: campaigns,
      };

      const audiences = getTargetedAudiences(state);
      expect(audiences).toContain('casual');
      expect(audiences).toContain('regular');
      expect(audiences).toContain('young_professional');
    });

    it('skips non-active campaigns', () => {
      const campaigns: ActiveCampaign[] = [
        {
          campaignId: 'local_newspaper',
          startDay: 1,
          plannedDuration: 7,
          elapsedDays: 2,
          status: 'cancelled',
          totalCostSoFar: 200,
          bookingsDuringCampaign: 50,
          revenueDuringCampaign: 5000,
        },
      ];
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: campaigns,
      };

      expect(getTargetedAudiences(state)).toEqual([]);
    });

    it('skips campaigns with invalid ID', () => {
      const campaigns: ActiveCampaign[] = [
        {
          campaignId: 'nonexistent',
          startDay: 1,
          plannedDuration: 7,
          elapsedDays: 2,
          status: 'active',
          totalCostSoFar: 200,
          bookingsDuringCampaign: 50,
          revenueDuringCampaign: 5000,
        },
      ];
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: campaigns,
      };

      expect(getTargetedAudiences(state)).toEqual([]);
    });
  });

  describe('hasTwilightCampaign', () => {
    it('returns false with no twilight campaign', () => {
      const state = createInitialMarketingState();
      expect(hasTwilightCampaign(state)).toBe(false);
    });

    it('returns true with active twilight campaign', () => {
      const campaign: ActiveCampaign = {
        campaignId: 'twilight_special',
        startDay: 1,
        plannedDuration: 30,
        elapsedDays: 5,
        status: 'active',
        totalCostSoFar: 0,
        bookingsDuringCampaign: 150,
        revenueDuringCampaign: 10000,
      };
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: [campaign],
      };
      expect(hasTwilightCampaign(state)).toBe(true);
    });

    it('returns false with non-active twilight campaign', () => {
      const campaign: ActiveCampaign = {
        campaignId: 'twilight_special',
        startDay: 1,
        plannedDuration: 30,
        elapsedDays: 5,
        status: 'cancelled',
        totalCostSoFar: 0,
        bookingsDuringCampaign: 150,
        revenueDuringCampaign: 10000,
      };
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: [campaign],
      };
      expect(hasTwilightCampaign(state)).toBe(false);
    });
  });

  describe('hasActiveEvent', () => {
    it('returns false with no event', () => {
      const state = createInitialMarketingState();
      expect(hasActiveEvent(state)).toBe(false);
    });

    it('returns true with tournament', () => {
      const campaign: ActiveCampaign = {
        campaignId: 'tournament_hosting',
        startDay: 10,
        plannedDuration: 1,
        elapsedDays: 0,
        status: 'active',
        totalCostSoFar: 5000,
        bookingsDuringCampaign: 0,
        revenueDuringCampaign: 0,
      };
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: [campaign],
      };
      expect(hasActiveEvent(state)).toBe(true);
    });

    it('returns false with non-active event', () => {
      const campaign: ActiveCampaign = {
        campaignId: 'tournament_hosting',
        startDay: 10,
        plannedDuration: 1,
        elapsedDays: 0,
        status: 'completed',
        totalCostSoFar: 5000,
        bookingsDuringCampaign: 0,
        revenueDuringCampaign: 0,
      };
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: [campaign],
      };
      expect(hasActiveEvent(state)).toBe(false);
    });
  });

  describe('getAvailableCampaigns', () => {
    it('returns all campaigns with status', () => {
      const state = createInitialMarketingState();
      const available = getAvailableCampaigns(state, 100000);
      expect(available.length).toBe(MARKETING_CAMPAIGNS.length);
      expect(available.filter(c => c.canStart).length).toBeGreaterThan(0);
    });

    it('marks campaigns unavailable when on cooldown', () => {
      const state: MarketingState = {
        ...createInitialMarketingState(),
        cooldowns: { radio_spot: 5 },
      };
      const available = getAvailableCampaigns(state, 100000);
      const radio = available.find(c => c.campaign.id === 'radio_spot');
      expect(radio?.canStart).toBe(false);
      expect(radio?.reason).toContain('cooldown');
    });
  });

  describe('getCampaignSummary', () => {
    it('returns summary with active campaigns', () => {
      const campaigns: ActiveCampaign[] = [
        {
          campaignId: 'local_newspaper',
          startDay: 1,
          plannedDuration: 7,
          elapsedDays: 2,
          status: 'active',
          totalCostSoFar: 200,
          bookingsDuringCampaign: 50,
          revenueDuringCampaign: 5000,
        },
        {
          campaignId: 'radio_spot',
          startDay: 1,
          plannedDuration: 14,
          elapsedDays: 5,
          status: 'active',
          totalCostSoFar: 2000,
          bookingsDuringCampaign: 150,
          revenueDuringCampaign: 15000,
        },
      ];
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: campaigns,
        metrics: {
          totalSpent: 5000,
          totalRevenueGenerated: 8000,
          campaignsRun: 3,
          averageRoi: 0.6,
        },
      };

      const summary = getCampaignSummary(state);
      expect(summary.activeCampaignCount).toBe(2);
      expect(summary.totalDailyCost).toBe(400);
      expect(summary.combinedDemandMultiplier).toBeCloseTo(1.15 * 1.25, 2);
      expect(summary.historicalRoi).toBe(0.6);
      expect(summary.totalHistoricalSpent).toBe(5000);
    });

    it('skips non-active campaigns in daily cost', () => {
      const campaigns: ActiveCampaign[] = [
        {
          campaignId: 'local_newspaper',
          startDay: 1,
          plannedDuration: 7,
          elapsedDays: 2,
          status: 'cancelled',
          totalCostSoFar: 200,
          bookingsDuringCampaign: 50,
          revenueDuringCampaign: 5000,
        },
      ];
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: campaigns,
      };

      const summary = getCampaignSummary(state);
      expect(summary.totalDailyCost).toBe(0);
    });

    it('skips campaigns with invalid ID in daily cost', () => {
      const campaigns: ActiveCampaign[] = [
        {
          campaignId: 'nonexistent',
          startDay: 1,
          plannedDuration: 7,
          elapsedDays: 2,
          status: 'active',
          totalCostSoFar: 200,
          bookingsDuringCampaign: 50,
          revenueDuringCampaign: 5000,
        },
      ];
      const state: MarketingState = {
        ...createInitialMarketingState(),
        activeCampaigns: campaigns,
      };

      const summary = getCampaignSummary(state);
      expect(summary.totalDailyCost).toBe(0);
    });
  });

  describe('updateBaseline', () => {
    it('updates baseline values', () => {
      const state = createInitialMarketingState();
      const updated = updateBaseline(state, 40, 4500);
      expect(updated.baselineBookingsPerDay).toBe(40);
      expect(updated.baselineRevenuePerDay).toBe(4500);
    });
  });
});
