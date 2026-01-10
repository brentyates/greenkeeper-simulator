import { describe, it, expect } from 'vitest';
import {
  AmenityState,
  ClubhouseTier,
  ProShopTier,
  DiningTier,
  ComfortStationTier,

  CLUBHOUSE_DATA,
  PRO_SHOP_DATA,
  DINING_DATA,
  FACILITY_DATA,
  SERVICE_DATA,
  CART_DATA,
  COMFORT_STATION_DATA,
  COURSE_FEATURE_DATA,

  createInitialAmenityState,
  calculateAmenityScore,
  getMaxPossibleAmenityScore,
  getUpgradeCost,
  getPrestigeGain,
  applyUpgrade,
  getMonthlyAmenityCost,
  getAvailableUpgrades,
  getUpgradeName,
} from './amenities';

describe('amenities', () => {
  describe('createInitialAmenityState', () => {
    it('creates state with all amenities at base level', () => {
      const state = createInitialAmenityState();
      expect(state.clubhouseTier).toBe(0);
      expect(state.proShopTier).toBe(0);
      expect(state.diningTier).toBe(0);
      expect(state.facilities.drivingRange).toBe(false);
      expect(state.services.caddieProgram).toBe(false);
      expect(state.courseFeatures.cartType).toBe('walking');
      expect(state.courseFeatures.comfortStations).toBe(0);
    });

    it('has zero amenity score initially', () => {
      const state = createInitialAmenityState();
      expect(calculateAmenityScore(state)).toBe(0);
    });
  });

  describe('calculateAmenityScore', () => {
    it('adds clubhouse prestige', () => {
      const state = createInitialAmenityState();
      const withClubhouse = { ...state, clubhouseTier: 1 as ClubhouseTier };
      expect(calculateAmenityScore(withClubhouse)).toBe(CLUBHOUSE_DATA[1].prestige);
    });

    it('adds pro shop prestige', () => {
      const state = createInitialAmenityState();
      const withProShop = { ...state, proShopTier: 2 as ProShopTier };
      expect(calculateAmenityScore(withProShop)).toBe(PRO_SHOP_DATA[2].prestige);
    });

    it('adds dining prestige', () => {
      const state = createInitialAmenityState();
      const withDining = { ...state, diningTier: 3 as DiningTier };
      expect(calculateAmenityScore(withDining)).toBe(DINING_DATA[3].prestige);
    });

    it('adds facility prestige', () => {
      const state = createInitialAmenityState();
      const withRange = {
        ...state,
        facilities: { ...state.facilities, drivingRange: true },
      };
      expect(calculateAmenityScore(withRange)).toBe(FACILITY_DATA.drivingRange.prestige);
    });

    it('adds service prestige', () => {
      const state = createInitialAmenityState();
      const withCaddie = {
        ...state,
        services: { ...state.services, caddieProgram: true },
      };
      expect(calculateAmenityScore(withCaddie)).toBe(SERVICE_DATA.caddieProgram.prestige);
    });

    it('adds cart prestige', () => {
      const state = createInitialAmenityState();
      const withCarts = {
        ...state,
        courseFeatures: { ...state.courseFeatures, cartType: 'premium_carts' as const },
      };
      expect(calculateAmenityScore(withCarts)).toBe(CART_DATA.premium_carts.prestige);
    });

    it('adds comfort station prestige', () => {
      const state = createInitialAmenityState();
      const withStations = {
        ...state,
        courseFeatures: { ...state.courseFeatures, comfortStations: 2 as ComfortStationTier },
      };
      expect(calculateAmenityScore(withStations)).toBe(COMFORT_STATION_DATA[2].prestige);
    });

    it('adds course feature prestige', () => {
      const state = createInitialAmenityState();
      const withFeatures = {
        ...state,
        courseFeatures: {
          ...state.courseFeatures,
          beverageService: true,
          halfwayHouse: true,
        },
      };
      const expected = COURSE_FEATURE_DATA.beverageService.prestige + COURSE_FEATURE_DATA.halfwayHouse.prestige;
      expect(calculateAmenityScore(withFeatures)).toBe(expected);
    });

    it('combines all amenity prestige values', () => {
      const state: AmenityState = {
        clubhouseTier: 2,
        proShopTier: 1,
        diningTier: 1,
        facilities: {
          drivingRange: true,
          puttingGreen: true,
          chippingArea: false,
          teachingAcademy: false,
          golfSimulator: false,
          tourLevelRange: false,
        },
        services: {
          caddieProgram: false,
          valetParking: false,
          bagStorage: true,
          lockerRoom: false,
          spa: false,
          concierge: false,
        },
        courseFeatures: {
          cartType: 'basic_carts',
          beverageService: true,
          comfortStations: 1,
          halfwayHouse: false,
          signatureMarkers: false,
          tournamentTees: false,
        },
      };

      const expected =
        CLUBHOUSE_DATA[2].prestige +
        PRO_SHOP_DATA[1].prestige +
        DINING_DATA[1].prestige +
        FACILITY_DATA.drivingRange.prestige +
        FACILITY_DATA.puttingGreen.prestige +
        SERVICE_DATA.bagStorage.prestige +
        CART_DATA.basic_carts.prestige +
        COMFORT_STATION_DATA[1].prestige +
        COURSE_FEATURE_DATA.beverageService.prestige;

      expect(calculateAmenityScore(state)).toBe(expected);
    });

    it('caps score at 1000', () => {
      const maxState: AmenityState = {
        clubhouseTier: 4,
        proShopTier: 3,
        diningTier: 4,
        facilities: {
          drivingRange: true,
          puttingGreen: true,
          chippingArea: true,
          teachingAcademy: true,
          golfSimulator: true,
          tourLevelRange: true,
        },
        services: {
          caddieProgram: true,
          valetParking: true,
          bagStorage: true,
          lockerRoom: true,
          spa: true,
          concierge: true,
        },
        courseFeatures: {
          cartType: 'luxury_carts',
          beverageService: true,
          comfortStations: 4,
          halfwayHouse: true,
          signatureMarkers: true,
          tournamentTees: true,
        },
      };

      const score = calculateAmenityScore(maxState);
      expect(score).toBeLessThanOrEqual(1000);
    });
  });

  describe('getMaxPossibleAmenityScore', () => {
    it('returns the sum of all max prestige values', () => {
      const max = getMaxPossibleAmenityScore();
      expect(max).toBeGreaterThan(500);
      expect(max).toBeLessThanOrEqual(1500);
    });
  });

  describe('applyUpgrade', () => {
    it('upgrades clubhouse tier', () => {
      const state = createInitialAmenityState();
      const upgraded = applyUpgrade(state, { type: 'clubhouse', tier: 2 });
      expect(upgraded.clubhouseTier).toBe(2);
    });

    it('upgrades pro shop tier', () => {
      const state = createInitialAmenityState();
      const upgraded = applyUpgrade(state, { type: 'proShop', tier: 3 });
      expect(upgraded.proShopTier).toBe(3);
    });

    it('upgrades dining tier', () => {
      const state = createInitialAmenityState();
      const upgraded = applyUpgrade(state, { type: 'dining', tier: 4 });
      expect(upgraded.diningTier).toBe(4);
    });

    it('adds facility', () => {
      const state = createInitialAmenityState();
      const upgraded = applyUpgrade(state, { type: 'facility', facility: 'teachingAcademy' });
      expect(upgraded.facilities.teachingAcademy).toBe(true);
    });

    it('adds service', () => {
      const state = createInitialAmenityState();
      const upgraded = applyUpgrade(state, { type: 'service', service: 'spa' });
      expect(upgraded.services.spa).toBe(true);
    });

    it('upgrades cart type', () => {
      const state = createInitialAmenityState();
      const upgraded = applyUpgrade(state, { type: 'cart', cartType: 'luxury_carts' });
      expect(upgraded.courseFeatures.cartType).toBe('luxury_carts');
    });

    it('upgrades comfort stations', () => {
      const state = createInitialAmenityState();
      const upgraded = applyUpgrade(state, { type: 'comfortStation', tier: 3 });
      expect(upgraded.courseFeatures.comfortStations).toBe(3);
    });

    it('adds course feature', () => {
      const state = createInitialAmenityState();
      const upgraded = applyUpgrade(state, { type: 'courseFeature', feature: 'tournamentTees' });
      expect(upgraded.courseFeatures.tournamentTees).toBe(true);
    });

    it('preserves other state when upgrading', () => {
      const state = createInitialAmenityState();
      state.facilities.drivingRange = true;
      const upgraded = applyUpgrade(state, { type: 'clubhouse', tier: 1 });
      expect(upgraded.clubhouseTier).toBe(1);
      expect(upgraded.facilities.drivingRange).toBe(true);
    });
  });

  describe('getUpgradeCost', () => {
    it('returns clubhouse upgrade cost', () => {
      const state = createInitialAmenityState();
      const cost = getUpgradeCost(state, { type: 'clubhouse', tier: 1 });
      expect(cost).toBe(CLUBHOUSE_DATA[1].cost);
    });

    it('returns pro shop upgrade cost', () => {
      const state = createInitialAmenityState();
      const cost = getUpgradeCost(state, { type: 'proShop', tier: 2 });
      expect(cost).toBe(PRO_SHOP_DATA[2].cost);
    });

    it('returns facility cost', () => {
      const state = createInitialAmenityState();
      const cost = getUpgradeCost(state, { type: 'facility', facility: 'tourLevelRange' });
      expect(cost).toBe(FACILITY_DATA.tourLevelRange.cost);
    });

    it('returns service cost', () => {
      const state = createInitialAmenityState();
      const cost = getUpgradeCost(state, { type: 'service', service: 'lockerRoom' });
      expect(cost).toBe(SERVICE_DATA.lockerRoom.cost);
    });

    it('returns dining upgrade cost', () => {
      const state = createInitialAmenityState();
      const cost = getUpgradeCost(state, { type: 'dining', tier: 3 });
      expect(cost).toBe(DINING_DATA[3].cost);
    });

    it('returns cart upgrade cost', () => {
      const state = createInitialAmenityState();
      const cost = getUpgradeCost(state, { type: 'cart', cartType: 'premium_carts' });
      expect(cost).toBe(CART_DATA.premium_carts.cost);
    });

    it('returns comfort station upgrade cost', () => {
      const state = createInitialAmenityState();
      const cost = getUpgradeCost(state, { type: 'comfortStation', tier: 2 });
      expect(cost).toBe(COMFORT_STATION_DATA[2].cost);
    });

    it('returns course feature upgrade cost', () => {
      const state = createInitialAmenityState();
      const cost = getUpgradeCost(state, { type: 'courseFeature', feature: 'halfwayHouse' });
      expect(cost).toBe(COURSE_FEATURE_DATA.halfwayHouse.cost);
    });
  });

  describe('getPrestigeGain', () => {
    it('calculates prestige gained from upgrade', () => {
      const state = createInitialAmenityState();
      const gain = getPrestigeGain(state, { type: 'clubhouse', tier: 1 });
      expect(gain).toBe(CLUBHOUSE_DATA[1].prestige);
    });

    it('calculates incremental gain for tier upgrades', () => {
      let state = createInitialAmenityState();
      state = applyUpgrade(state, { type: 'clubhouse', tier: 1 });
      const gain = getPrestigeGain(state, { type: 'clubhouse', tier: 2 });
      expect(gain).toBe(CLUBHOUSE_DATA[2].prestige - CLUBHOUSE_DATA[1].prestige);
    });

    it('returns zero for already owned facility', () => {
      let state = createInitialAmenityState();
      state = applyUpgrade(state, { type: 'facility', facility: 'drivingRange' });
      const gain = getPrestigeGain(state, { type: 'facility', facility: 'drivingRange' });
      expect(gain).toBe(0);
    });
  });

  describe('getMonthlyAmenityCost', () => {
    it('returns zero for base state', () => {
      const state = createInitialAmenityState();
      expect(getMonthlyAmenityCost(state)).toBe(0);
    });

    it('adds service monthly costs', () => {
      let state = createInitialAmenityState();
      state = applyUpgrade(state, { type: 'service', service: 'caddieProgram' });
      expect(getMonthlyAmenityCost(state)).toBe(SERVICE_DATA.caddieProgram.monthly);
    });

    it('adds course feature monthly costs', () => {
      let state = createInitialAmenityState();
      state = applyUpgrade(state, { type: 'courseFeature', feature: 'beverageService' });
      expect(getMonthlyAmenityCost(state)).toBe(COURSE_FEATURE_DATA.beverageService.monthly);
    });

    it('combines all monthly costs', () => {
      let state = createInitialAmenityState();
      state = applyUpgrade(state, { type: 'service', service: 'caddieProgram' });
      state = applyUpgrade(state, { type: 'service', service: 'spa' });
      state = applyUpgrade(state, { type: 'courseFeature', feature: 'halfwayHouse' });

      const expected =
        SERVICE_DATA.caddieProgram.monthly +
        SERVICE_DATA.spa.monthly +
        COURSE_FEATURE_DATA.halfwayHouse.monthly;
      expect(getMonthlyAmenityCost(state)).toBe(expected);
    });
  });

  describe('getAvailableUpgrades', () => {
    it('returns all upgrades for base state', () => {
      const state = createInitialAmenityState();
      const upgrades = getAvailableUpgrades(state);
      expect(upgrades.length).toBeGreaterThan(15);
    });

    it('includes next tier upgrades for buildings', () => {
      const state = createInitialAmenityState();
      const upgrades = getAvailableUpgrades(state);
      expect(upgrades).toContainEqual({ type: 'clubhouse', tier: 1 });
      expect(upgrades).toContainEqual({ type: 'proShop', tier: 1 });
      expect(upgrades).toContainEqual({ type: 'dining', tier: 1 });
    });

    it('excludes already owned facilities', () => {
      let state = createInitialAmenityState();
      state = applyUpgrade(state, { type: 'facility', facility: 'drivingRange' });
      const upgrades = getAvailableUpgrades(state);
      expect(upgrades).not.toContainEqual({ type: 'facility', facility: 'drivingRange' });
    });

    it('excludes max tier upgrades', () => {
      let state = createInitialAmenityState();
      state = { ...state, clubhouseTier: 4 };
      const upgrades = getAvailableUpgrades(state);
      const clubhouseUpgrades = upgrades.filter(u => u.type === 'clubhouse');
      expect(clubhouseUpgrades.length).toBe(0);
    });

    it('excludes max pro shop tier', () => {
      let state = createInitialAmenityState();
      state = { ...state, proShopTier: 3 };
      const upgrades = getAvailableUpgrades(state);
      const proShopUpgrades = upgrades.filter(u => u.type === 'proShop');
      expect(proShopUpgrades.length).toBe(0);
    });

    it('excludes max dining tier', () => {
      let state = createInitialAmenityState();
      state = { ...state, diningTier: 4 };
      const upgrades = getAvailableUpgrades(state);
      const diningUpgrades = upgrades.filter(u => u.type === 'dining');
      expect(diningUpgrades.length).toBe(0);
    });

    it('excludes already owned services', () => {
      let state = createInitialAmenityState();
      state = applyUpgrade(state, { type: 'service', service: 'caddieProgram' });
      const upgrades = getAvailableUpgrades(state);
      expect(upgrades).not.toContainEqual({ type: 'service', service: 'caddieProgram' });
    });

    it('excludes max cart type', () => {
      let state = createInitialAmenityState();
      state = { ...state, courseFeatures: { ...state.courseFeatures, cartType: 'luxury_carts' } };
      const upgrades = getAvailableUpgrades(state);
      const cartUpgrades = upgrades.filter(u => u.type === 'cart');
      expect(cartUpgrades.length).toBe(0);
    });

    it('excludes max comfort station tier', () => {
      let state = createInitialAmenityState();
      state = { ...state, courseFeatures: { ...state.courseFeatures, comfortStations: 4 } };
      const upgrades = getAvailableUpgrades(state);
      const comfortUpgrades = upgrades.filter(u => u.type === 'comfortStation');
      expect(comfortUpgrades.length).toBe(0);
    });

    it('excludes already owned course features', () => {
      let state = createInitialAmenityState();
      state = applyUpgrade(state, { type: 'courseFeature', feature: 'beverageService' });
      state = applyUpgrade(state, { type: 'courseFeature', feature: 'halfwayHouse' });
      state = applyUpgrade(state, { type: 'courseFeature', feature: 'signatureMarkers' });
      state = applyUpgrade(state, { type: 'courseFeature', feature: 'tournamentTees' });
      const upgrades = getAvailableUpgrades(state);
      const courseFeatureUpgrades = upgrades.filter(u => u.type === 'courseFeature');
      expect(courseFeatureUpgrades.length).toBe(0);
    });

    it('includes next cart type', () => {
      let state = createInitialAmenityState();
      state = applyUpgrade(state, { type: 'cart', cartType: 'basic_carts' });
      const upgrades = getAvailableUpgrades(state);
      expect(upgrades).toContainEqual({ type: 'cart', cartType: 'premium_carts' });
      expect(upgrades).not.toContainEqual({ type: 'cart', cartType: 'basic_carts' });
    });
  });

  describe('getUpgradeName', () => {
    it('returns clubhouse name', () => {
      expect(getUpgradeName({ type: 'clubhouse', tier: 3 })).toBe('Luxury Clubhouse');
    });

    it('returns pro shop name', () => {
      expect(getUpgradeName({ type: 'proShop', tier: 2 })).toBe('Full Pro Shop');
    });

    it('returns dining name', () => {
      expect(getUpgradeName({ type: 'dining', tier: 3 })).toBe('Fine Dining Restaurant');
    });

    it('returns facility name', () => {
      expect(getUpgradeName({ type: 'facility', facility: 'golfSimulator' })).toBe('Golf Simulator');
    });

    it('returns service name', () => {
      expect(getUpgradeName({ type: 'service', service: 'concierge' })).toBe('Concierge Service');
    });

    it('returns cart name', () => {
      expect(getUpgradeName({ type: 'cart', cartType: 'luxury_carts' })).toBe('Luxury Carts w/ GPS');
    });

    it('returns comfort station name', () => {
      expect(getUpgradeName({ type: 'comfortStation', tier: 4 })).toBe('Luxury Comfort Stations');
    });

    it('returns course feature name', () => {
      expect(getUpgradeName({ type: 'courseFeature', feature: 'tournamentTees' })).toBe('Tournament Tees');
    });
  });

  describe('data constants', () => {
    it('has increasing clubhouse costs', () => {
      expect(CLUBHOUSE_DATA[1].cost).toBeLessThan(CLUBHOUSE_DATA[2].cost);
      expect(CLUBHOUSE_DATA[2].cost).toBeLessThan(CLUBHOUSE_DATA[3].cost);
      expect(CLUBHOUSE_DATA[3].cost).toBeLessThan(CLUBHOUSE_DATA[4].cost);
    });

    it('has increasing clubhouse prestige', () => {
      expect(CLUBHOUSE_DATA[1].prestige).toBeLessThan(CLUBHOUSE_DATA[2].prestige);
      expect(CLUBHOUSE_DATA[2].prestige).toBeLessThan(CLUBHOUSE_DATA[3].prestige);
      expect(CLUBHOUSE_DATA[3].prestige).toBeLessThan(CLUBHOUSE_DATA[4].prestige);
    });

    it('has all facilities with positive prestige', () => {
      for (const data of Object.values(FACILITY_DATA)) {
        expect(data.prestige).toBeGreaterThan(0);
      }
    });

    it('has all services with monthly costs', () => {
      for (const data of Object.values(SERVICE_DATA)) {
        expect(data.monthly).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
