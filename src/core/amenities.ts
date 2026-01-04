/**
 * MIGRATION NOTE: This abstract amenity system will be replaced by the grid-based
 * PlaceableEntity system defined in docs/PLACEABLE_ASSETS_SPEC.md.
 *
 * Current approach: Amenities are boolean flags and tier numbers without grid positions.
 * Future approach: All amenities become PlaceableEntity instances with physical locations.
 *
 * Migration path:
 * 1. Create PlaceableEntity system in src/core/placeable-entity.ts
 * 2. Implement EntityManager for CRUD operations
 * 3. Create migration function: migrateAmenityState(old: AmenityState) => PlaceableEntity[]
 * 4. Update UI to use placement-based building menu
 * 5. Deprecate this module once migration is complete
 *
 * Until migration is complete, this module continues to function for prestige calculations.
 */

export type ClubhouseTier = 0 | 1 | 2 | 3 | 4;
export type ProShopTier = 0 | 1 | 2 | 3;
export type DiningTier = 0 | 1 | 2 | 3 | 4;
export type CartType = 'walking' | 'pull_carts' | 'basic_carts' | 'premium_carts' | 'luxury_carts';
export type ComfortStationTier = 0 | 1 | 2 | 3 | 4;

export interface Facilities {
  drivingRange: boolean;
  puttingGreen: boolean;
  chippingArea: boolean;
  teachingAcademy: boolean;
  golfSimulator: boolean;
  tourLevelRange: boolean;
}

export interface Services {
  caddieProgram: boolean;
  valetParking: boolean;
  bagStorage: boolean;
  lockerRoom: boolean;
  spa: boolean;
  concierge: boolean;
}

export interface CourseFeatures {
  cartType: CartType;
  beverageService: boolean;
  comfortStations: ComfortStationTier;
  halfwayHouse: boolean;
  signatureMarkers: boolean;
  tournamentTees: boolean;
}

export interface AmenityState {
  clubhouseTier: ClubhouseTier;
  proShopTier: ProShopTier;
  diningTier: DiningTier;
  facilities: Facilities;
  services: Services;
  courseFeatures: CourseFeatures;
}

export interface AmenityCost {
  oneTime: number;
  monthly: number;
}

export const CLUBHOUSE_DATA: Record<ClubhouseTier, { name: string; cost: number; prestige: number }> = {
  0: { name: 'Starter Shack', cost: 0, prestige: 0 },
  1: { name: 'Basic Clubhouse', cost: 50000, prestige: 50 },
  2: { name: 'Full Clubhouse', cost: 150000, prestige: 100 },
  3: { name: 'Luxury Clubhouse', cost: 400000, prestige: 175 },
  4: { name: 'Grand Clubhouse', cost: 1000000, prestige: 250 },
} as const;

export const PRO_SHOP_DATA: Record<ProShopTier, { name: string; cost: number; prestige: number }> = {
  0: { name: 'None', cost: 0, prestige: 0 },
  1: { name: 'Basic Pro Shop', cost: 25000, prestige: 25 },
  2: { name: 'Full Pro Shop', cost: 75000, prestige: 50 },
  3: { name: 'Premium Pro Shop', cost: 200000, prestige: 100 },
} as const;

export const DINING_DATA: Record<DiningTier, { name: string; cost: number; prestige: number }> = {
  0: { name: 'Vending Machines', cost: 1000, prestige: 0 },
  1: { name: 'Snack Bar', cost: 15000, prestige: 20 },
  2: { name: 'Grill Room', cost: 50000, prestige: 50 },
  3: { name: 'Fine Dining Restaurant', cost: 200000, prestige: 100 },
  4: { name: 'Celebrity Chef Restaurant', cost: 500000, prestige: 175 },
} as const;

export const FACILITY_DATA: Record<keyof Facilities, { name: string; cost: number; prestige: number }> = {
  drivingRange: { name: 'Driving Range', cost: 30000, prestige: 30 },
  puttingGreen: { name: 'Putting Green', cost: 10000, prestige: 15 },
  chippingArea: { name: 'Chipping Area', cost: 15000, prestige: 15 },
  teachingAcademy: { name: 'Teaching Academy', cost: 100000, prestige: 50 },
  golfSimulator: { name: 'Golf Simulator', cost: 75000, prestige: 35 },
  tourLevelRange: { name: 'Tour-Level Range', cost: 250000, prestige: 75 },
} as const;

export const SERVICE_DATA: Record<keyof Services, { name: string; cost: number; monthly: number; prestige: number }> = {
  caddieProgram: { name: 'Caddie Program', cost: 10000, monthly: 5000, prestige: 40 },
  valetParking: { name: 'Valet Parking', cost: 5000, monthly: 3000, prestige: 25 },
  bagStorage: { name: 'Bag Storage', cost: 15000, monthly: 500, prestige: 20 },
  lockerRoom: { name: 'Locker Room', cost: 50000, monthly: 1000, prestige: 30 },
  spa: { name: 'Spa & Wellness', cost: 200000, monthly: 8000, prestige: 60 },
  concierge: { name: 'Concierge Service', cost: 0, monthly: 6000, prestige: 35 },
} as const;

export const CART_DATA: Record<CartType, { name: string; cost: number; prestige: number }> = {
  walking: { name: 'Walking Only', cost: 0, prestige: 0 },
  pull_carts: { name: 'Pull Carts', cost: 5000, prestige: 5 },
  basic_carts: { name: 'Basic Golf Carts', cost: 50000, prestige: 15 },
  premium_carts: { name: 'Premium Carts', cost: 100000, prestige: 30 },
  luxury_carts: { name: 'Luxury Carts w/ GPS', cost: 200000, prestige: 50 },
} as const;

export const COMFORT_STATION_DATA: Record<ComfortStationTier, { name: string; cost: number; prestige: number }> = {
  0: { name: 'None', cost: 0, prestige: 0 },
  1: { name: 'Basic Restroom', cost: 10000, prestige: 10 },
  2: { name: 'Standard Facilities', cost: 25000, prestige: 20 },
  3: { name: 'Premium Facilities', cost: 50000, prestige: 35 },
  4: { name: 'Luxury Comfort Stations', cost: 100000, prestige: 50 },
} as const;

export const COURSE_FEATURE_DATA = {
  beverageService: { name: 'Beverage Cart Service', cost: 20000, monthly: 2000, prestige: 20 },
  halfwayHouse: { name: 'Halfway House', cost: 75000, monthly: 3000, prestige: 35 },
  signatureMarkers: { name: 'Signature Hole Markers', cost: 15000, prestige: 15 },
  tournamentTees: { name: 'Tournament Tees', cost: 40000, prestige: 25 },
} as const;

export function createInitialAmenityState(): AmenityState {
  return {
    clubhouseTier: 0,
    proShopTier: 0,
    diningTier: 0,
    facilities: {
      drivingRange: false,
      puttingGreen: false,
      chippingArea: false,
      teachingAcademy: false,
      golfSimulator: false,
      tourLevelRange: false,
    },
    services: {
      caddieProgram: false,
      valetParking: false,
      bagStorage: false,
      lockerRoom: false,
      spa: false,
      concierge: false,
    },
    courseFeatures: {
      cartType: 'walking',
      beverageService: false,
      comfortStations: 0,
      halfwayHouse: false,
      signatureMarkers: false,
      tournamentTees: false,
    },
  };
}

export function calculateAmenityScore(state: AmenityState): number {
  let score = 0;

  score += CLUBHOUSE_DATA[state.clubhouseTier].prestige;
  score += PRO_SHOP_DATA[state.proShopTier].prestige;
  score += DINING_DATA[state.diningTier].prestige;

  for (const [key, value] of Object.entries(state.facilities)) {
    if (value) {
      score += FACILITY_DATA[key as keyof Facilities].prestige;
    }
  }

  for (const [key, value] of Object.entries(state.services)) {
    if (value) {
      score += SERVICE_DATA[key as keyof Services].prestige;
    }
  }

  score += CART_DATA[state.courseFeatures.cartType].prestige;
  score += COMFORT_STATION_DATA[state.courseFeatures.comfortStations].prestige;

  if (state.courseFeatures.beverageService) {
    score += COURSE_FEATURE_DATA.beverageService.prestige;
  }
  if (state.courseFeatures.halfwayHouse) {
    score += COURSE_FEATURE_DATA.halfwayHouse.prestige;
  }
  if (state.courseFeatures.signatureMarkers) {
    score += COURSE_FEATURE_DATA.signatureMarkers.prestige;
  }
  if (state.courseFeatures.tournamentTees) {
    score += COURSE_FEATURE_DATA.tournamentTees.prestige;
  }

  return Math.min(score, 1000);
}

export function getMaxPossibleAmenityScore(): number {
  let max = 0;

  max += CLUBHOUSE_DATA[4].prestige;
  max += PRO_SHOP_DATA[3].prestige;
  max += DINING_DATA[4].prestige;

  for (const data of Object.values(FACILITY_DATA)) {
    max += data.prestige;
  }
  for (const data of Object.values(SERVICE_DATA)) {
    max += data.prestige;
  }

  max += CART_DATA.luxury_carts.prestige;
  max += COMFORT_STATION_DATA[4].prestige;
  max += COURSE_FEATURE_DATA.beverageService.prestige;
  max += COURSE_FEATURE_DATA.halfwayHouse.prestige;
  max += COURSE_FEATURE_DATA.signatureMarkers.prestige;
  max += COURSE_FEATURE_DATA.tournamentTees.prestige;

  return max;
}

export function getUpgradeCost(_state: AmenityState, upgrade: AmenityUpgrade): number {
  switch (upgrade.type) {
    case 'clubhouse':
      return CLUBHOUSE_DATA[upgrade.tier as ClubhouseTier].cost;
    case 'proShop':
      return PRO_SHOP_DATA[upgrade.tier as ProShopTier].cost;
    case 'dining':
      return DINING_DATA[upgrade.tier as DiningTier].cost;
    case 'facility':
      return FACILITY_DATA[upgrade.facility as keyof Facilities].cost;
    case 'service':
      return SERVICE_DATA[upgrade.service as keyof Services].cost;
    case 'cart':
      return CART_DATA[upgrade.cartType as CartType].cost;
    case 'comfortStation':
      return COMFORT_STATION_DATA[upgrade.tier as ComfortStationTier].cost;
    case 'courseFeature':
      return COURSE_FEATURE_DATA[upgrade.feature as keyof typeof COURSE_FEATURE_DATA].cost;
    default:
      return 0;
  }
}

export function getPrestigeGain(state: AmenityState, upgrade: AmenityUpgrade): number {
  const currentScore = calculateAmenityScore(state);
  const newState = applyUpgrade(state, upgrade);
  const newScore = calculateAmenityScore(newState);
  return newScore - currentScore;
}

export type AmenityUpgrade =
  | { type: 'clubhouse'; tier: ClubhouseTier }
  | { type: 'proShop'; tier: ProShopTier }
  | { type: 'dining'; tier: DiningTier }
  | { type: 'facility'; facility: keyof Facilities }
  | { type: 'service'; service: keyof Services }
  | { type: 'cart'; cartType: CartType }
  | { type: 'comfortStation'; tier: ComfortStationTier }
  | { type: 'courseFeature'; feature: keyof typeof COURSE_FEATURE_DATA };

export function applyUpgrade(state: AmenityState, upgrade: AmenityUpgrade): AmenityState {
  switch (upgrade.type) {
    case 'clubhouse':
      return { ...state, clubhouseTier: upgrade.tier };
    case 'proShop':
      return { ...state, proShopTier: upgrade.tier };
    case 'dining':
      return { ...state, diningTier: upgrade.tier };
    case 'facility':
      return {
        ...state,
        facilities: { ...state.facilities, [upgrade.facility]: true },
      };
    case 'service':
      return {
        ...state,
        services: { ...state.services, [upgrade.service]: true },
      };
    case 'cart':
      return {
        ...state,
        courseFeatures: { ...state.courseFeatures, cartType: upgrade.cartType },
      };
    case 'comfortStation':
      return {
        ...state,
        courseFeatures: { ...state.courseFeatures, comfortStations: upgrade.tier },
      };
    case 'courseFeature':
      return {
        ...state,
        courseFeatures: { ...state.courseFeatures, [upgrade.feature]: true },
      };
    default:
      return state;
  }
}

export function getMonthlyAmenityCost(state: AmenityState): number {
  let monthly = 0;

  for (const [key, value] of Object.entries(state.services)) {
    if (value) {
      monthly += SERVICE_DATA[key as keyof Services].monthly;
    }
  }

  if (state.courseFeatures.beverageService) {
    monthly += COURSE_FEATURE_DATA.beverageService.monthly;
  }
  if (state.courseFeatures.halfwayHouse) {
    monthly += COURSE_FEATURE_DATA.halfwayHouse.monthly;
  }

  return monthly;
}

export function getAvailableUpgrades(state: AmenityState): AmenityUpgrade[] {
  const upgrades: AmenityUpgrade[] = [];

  if (state.clubhouseTier < 4) {
    upgrades.push({ type: 'clubhouse', tier: (state.clubhouseTier + 1) as ClubhouseTier });
  }
  if (state.proShopTier < 3) {
    upgrades.push({ type: 'proShop', tier: (state.proShopTier + 1) as ProShopTier });
  }
  if (state.diningTier < 4) {
    upgrades.push({ type: 'dining', tier: (state.diningTier + 1) as DiningTier });
  }

  for (const key of Object.keys(state.facilities) as (keyof Facilities)[]) {
    if (!state.facilities[key]) {
      upgrades.push({ type: 'facility', facility: key });
    }
  }

  for (const key of Object.keys(state.services) as (keyof Services)[]) {
    if (!state.services[key]) {
      upgrades.push({ type: 'service', service: key });
    }
  }

  const cartOrder: CartType[] = ['walking', 'pull_carts', 'basic_carts', 'premium_carts', 'luxury_carts'];
  const currentCartIndex = cartOrder.indexOf(state.courseFeatures.cartType);
  if (currentCartIndex < cartOrder.length - 1) {
    upgrades.push({ type: 'cart', cartType: cartOrder[currentCartIndex + 1] });
  }

  if (state.courseFeatures.comfortStations < 4) {
    upgrades.push({ type: 'comfortStation', tier: (state.courseFeatures.comfortStations + 1) as ComfortStationTier });
  }

  if (!state.courseFeatures.beverageService) {
    upgrades.push({ type: 'courseFeature', feature: 'beverageService' });
  }
  if (!state.courseFeatures.halfwayHouse) {
    upgrades.push({ type: 'courseFeature', feature: 'halfwayHouse' });
  }
  if (!state.courseFeatures.signatureMarkers) {
    upgrades.push({ type: 'courseFeature', feature: 'signatureMarkers' });
  }
  if (!state.courseFeatures.tournamentTees) {
    upgrades.push({ type: 'courseFeature', feature: 'tournamentTees' });
  }

  return upgrades;
}

export function getUpgradeName(upgrade: AmenityUpgrade): string {
  switch (upgrade.type) {
    case 'clubhouse':
      return CLUBHOUSE_DATA[upgrade.tier].name;
    case 'proShop':
      return PRO_SHOP_DATA[upgrade.tier].name;
    case 'dining':
      return DINING_DATA[upgrade.tier].name;
    case 'facility':
      return FACILITY_DATA[upgrade.facility].name;
    case 'service':
      return SERVICE_DATA[upgrade.service].name;
    case 'cart':
      return CART_DATA[upgrade.cartType].name;
    case 'comfortStation':
      return COMFORT_STATION_DATA[upgrade.tier].name;
    case 'courseFeature':
      return COURSE_FEATURE_DATA[upgrade.feature].name;
    default:
      return 'Unknown';
  }
}
