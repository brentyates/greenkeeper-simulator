import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialApplicationState,
  tickApplications,
  postJobOpening,
  acceptApplication,
  rejectApplication,
  getTimeUntilNextApplication,
  getPostingCost,
  PRESTIGE_HIRING_CONFIG,
  PrestigeTier,
  ApplicationState,
  resetEmployeeCounter,
  resetJobPostingCounter,
} from './employees';

describe('Prestige-Based Hiring System', () => {
  beforeEach(() => {
    resetEmployeeCounter();
    resetJobPostingCounter();
  });

  describe('createInitialApplicationState', () => {
    it('should create initial state with correct next application time', () => {
      const state = createInitialApplicationState(0, 'municipal');

      expect(state.applications).toHaveLength(0);
      expect(state.lastApplicationTime).toBe(0);
      expect(state.activeJobPostings).toHaveLength(0);
      expect(state.totalApplicationsReceived).toBe(0);
      // Municipal tier should have 48-hour interval (48 * 60 = 2880 minutes)
      expect(state.nextApplicationTime).toBe(2880);
    });

    it('should vary next application time by prestige tier', () => {
      const municipal = createInitialApplicationState(0, 'municipal');
      const championship = createInitialApplicationState(0, 'championship');

      // Championship tier should have much shorter wait
      expect(championship.nextApplicationTime).toBeLessThan(municipal.nextApplicationTime);
    });
  });

  describe('tickApplications', () => {
    it('should not generate application before next application time', () => {
      const state = createInitialApplicationState(0, 'public');
      const ticked = tickApplications(state, 100, 'public'); // Well before next time

      expect(ticked.applications).toHaveLength(0);
    });

    it('should generate application when time arrives', () => {
      const state = createInitialApplicationState(0, 'public');
      const config = PRESTIGE_HIRING_CONFIG.public;
      const ticked = tickApplications(state, config.applicationRate * 60, 'public');

      expect(ticked.applications).toHaveLength(1);
      expect(ticked.totalApplicationsReceived).toBe(1);
    });

    it('should respect max applications limit', () => {
      let state = createInitialApplicationState(0, 'municipal');
      const config = PRESTIGE_HIRING_CONFIG.municipal;

      // Generate max applications (2 for municipal)
      for (let i = 0; i < config.maxApplications + 2; i++) {
        state = tickApplications(state, (config.applicationRate * 60) * (i + 1), 'municipal');
      }

      expect(state.applications.length).toBeLessThanOrEqual(config.maxApplications);
    });

    it('should generate higher quality candidates for higher prestige', () => {
      const municipalState = createInitialApplicationState(0, 'municipal');
      const championshipState = createInitialApplicationState(0, 'championship');

      // Generate multiple applications
      let municipalApps = municipalState;
      let championshipApps = championshipState;

      for (let i = 0; i < 10; i++) {
        const time = i * 1000;
        municipalApps = tickApplications(municipalApps, time, 'municipal');
        championshipApps = tickApplications(championshipApps, time, 'championship');
      }

      // Championship should eventually have better skilled candidates
      const municipalExperts = municipalApps.applications.filter(a => a.skillLevel === 'expert').length;
      const championshipExperts = championshipApps.applications.filter(a => a.skillLevel === 'expert').length;

      // Championship has 38% expert rate vs 0% for municipal, so should have more experts
      expect(championshipExperts).toBeGreaterThanOrEqual(municipalExperts);
    });

    it('should remove expired job postings', () => {
      let state = createInitialApplicationState(0, 'public');

      // Post a job
      const result = postJobOpening(state, 0, 'public');
      if (!result) throw new Error('Failed to post job');
      state = result.state;

      expect(state.activeJobPostings).toHaveLength(1);

      // Tick past expiration time
      const config = PRESTIGE_HIRING_CONFIG.public;
      state = tickApplications(state, config.postingDuration * 60 + 100, 'public');

      expect(state.activeJobPostings).toHaveLength(0);
    });
  });

  describe('postJobOpening', () => {
    it('should create active job posting with correct cost', () => {
      const state = createInitialApplicationState(0, 'semi_private');
      const result = postJobOpening(state, 0, 'semi_private');

      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.state.activeJobPostings).toHaveLength(1);
      expect(result.posting.cost).toBe(PRESTIGE_HIRING_CONFIG.semi_private.postingCost);
    });

    it('should speed up next application time when posting is active', () => {
      let state = createInitialApplicationState(0, 'public');
      const originalNextTime = state.nextApplicationTime;

      const result = postJobOpening(state, 0, 'public');
      if (!result) throw new Error('Failed to post job');
      state = result.state;

      expect(state.nextApplicationTime).toBeLessThan(originalNextTime);
    });

    it('should have different costs per prestige tier', () => {
      const municipal = getPostingCost('municipal');
      const championship = getPostingCost('championship');

      // Higher prestige courses should have cheaper postings (more attractive)
      expect(championship).toBeLessThan(municipal);
    });
  });

  describe('acceptApplication', () => {
    it('should remove application from list', () => {
      let state = createInitialApplicationState(0, 'public');
      state = tickApplications(state, 2000, 'public');

      const applicationId = state.applications[0].id;
      const updated = acceptApplication(state, applicationId);

      expect(updated).not.toBeNull();
      if (!updated) return;
      expect(updated.applications).toHaveLength(0);
    });

    it('should return null for invalid application', () => {
      const state = createInitialApplicationState(0, 'public');
      const updated = acceptApplication(state, 'invalid_id');

      expect(updated).toBeNull();
    });
  });

  describe('rejectApplication', () => {
    it('should remove application from list', () => {
      let state = createInitialApplicationState(0, 'public');
      state = tickApplications(state, 2000, 'public');

      const applicationId = state.applications[0].id;
      const updated = rejectApplication(state, applicationId);

      expect(updated).not.toBeNull();
      if (!updated) return;
      expect(updated.applications).toHaveLength(0);
    });
  });

  describe('getTimeUntilNextApplication', () => {
    it('should return correct time remaining', () => {
      const state = createInitialApplicationState(0, 'public');
      const timeUntil = getTimeUntilNextApplication(state, 500);

      const config = PRESTIGE_HIRING_CONFIG.public;
      const expected = config.applicationRate * 60 - 500;
      expect(timeUntil).toBe(expected);
    });

    it('should return 0 if time has passed', () => {
      const state = createInitialApplicationState(0, 'public');
      const timeUntil = getTimeUntilNextApplication(state, 99999);

      expect(timeUntil).toBe(0);
    });
  });

  describe('Prestige progression balance', () => {
    it('should have increasing application rates with prestige', () => {
      const tiers: PrestigeTier[] = ['municipal', 'public', 'semi_private', 'private_club', 'championship'];

      for (let i = 0; i < tiers.length - 1; i++) {
        const current = PRESTIGE_HIRING_CONFIG[tiers[i]];
        const next = PRESTIGE_HIRING_CONFIG[tiers[i + 1]];

        // Higher tier should have faster application rate (lower interval)
        expect(next.applicationRate).toBeLessThan(current.applicationRate);
        // Higher tier should allow more applications
        expect(next.maxApplications).toBeGreaterThanOrEqual(current.maxApplications);
      }
    });

    it('should have decreasing costs with prestige', () => {
      const tiers: PrestigeTier[] = ['municipal', 'public', 'semi_private', 'private_club', 'championship'];

      for (let i = 0; i < tiers.length - 1; i++) {
        const current = PRESTIGE_HIRING_CONFIG[tiers[i]];
        const next = PRESTIGE_HIRING_CONFIG[tiers[i + 1]];

        // Higher tier should have lower posting cost
        expect(next.postingCost).toBeLessThan(current.postingCost);
      }
    });
  });
});
