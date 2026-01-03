/**
 * Research System - Technology tree for unlocking equipment and upgrades
 *
 * Similar to RollerCoaster Tycoon's research system:
 * - Research categories (equipment, fertilizers, irrigation, landscaping)
 * - Research items with costs and prerequisites
 * - Research progress over time based on funding level
 * - Unlock queue for research priorities
 */

// ============================================================================
// Types
// ============================================================================

export type ResearchCategory =
  | "equipment"      // Mowers, vehicles, tools
  | "fertilizers"    // Better fertilizers
  | "irrigation"     // Sprinklers, water systems
  | "landscaping"    // Course design features
  | "facilities"     // Buildings, amenities
  | "management"     // Efficiency improvements
  | "robotics";      // Autonomous equipment

export type ResearchStatus = "locked" | "available" | "researching" | "completed";

export interface ResearchItem {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: ResearchCategory;
  readonly baseCost: number;         // Research points needed
  readonly prerequisites: readonly string[];  // IDs of required research
  readonly tier: number;             // 1-5, affects unlock order
  readonly unlocks: ResearchUnlock;  // What this research provides
}

export type ResearchUnlock =
  | { type: "equipment"; equipmentId: string; stats: EquipmentStats }
  | { type: "fertilizer"; fertilizerId: string; effectiveness: number }
  | { type: "upgrade"; upgradeId: string; bonus: UpgradeBonus }
  | { type: "feature"; featureId: string };

export interface EquipmentStats {
  readonly efficiency: number;       // 1.0 = baseline
  readonly speed: number;            // Tiles per second
  readonly fuelCapacity: number;     // Max fuel
  readonly fuelEfficiency: number;   // Consumption rate multiplier
  readonly durability: number;       // Maintenance interval
  readonly isAutonomous?: boolean;   // Operates without employee
  readonly purchaseCost?: number;    // One-time purchase price
  readonly operatingCostPerHour?: number;  // Hourly cost (lower than employee wages)
  readonly breakdownRate?: number;   // Chance per hour of breakdown (0-1)
  readonly repairTime?: number;      // Minutes for mechanic to repair
}

export interface UpgradeBonus {
  readonly type: "speed" | "efficiency" | "capacity" | "quality";
  readonly value: number;            // Multiplier or flat bonus
}

export type FundingLevel = "none" | "minimum" | "normal" | "maximum";

export interface ResearchProgress {
  readonly itemId: string;
  readonly pointsEarned: number;
  readonly pointsRequired: number;
  readonly startTime: number;
}

export interface ResearchState {
  readonly completedResearch: readonly string[];
  readonly currentResearch: ResearchProgress | null;
  readonly researchQueue: readonly string[];
  readonly fundingLevel: FundingLevel;
  readonly totalPointsSpent: number;
}

// ============================================================================
// Constants
// ============================================================================

export const FUNDING_POINTS_PER_MINUTE: Record<FundingLevel, number> = {
  none: 0,
  minimum: 1,
  normal: 3,
  maximum: 6
};

export const FUNDING_COST_PER_MINUTE: Record<FundingLevel, number> = {
  none: 0,
  minimum: 50,
  normal: 150,
  maximum: 400
};

export const CATEGORY_COLORS: Record<ResearchCategory, string> = {
  equipment: "#4a90d9",
  fertilizers: "#7cb342",
  irrigation: "#29b6f6",
  landscaping: "#8d6e63",
  facilities: "#ab47bc",
  management: "#ffa726",
  robotics: "#00bcd4"
};

// ============================================================================
// Research Tree Definition
// ============================================================================

export const RESEARCH_ITEMS: readonly ResearchItem[] = [
  // === EQUIPMENT TIER 1 ===
  {
    id: "basic_push_mower",
    name: "Basic Push Mower",
    description: "A simple push mower for small areas",
    category: "equipment",
    baseCost: 0, // Starting equipment
    prerequisites: [],
    tier: 1,
    unlocks: {
      type: "equipment",
      equipmentId: "push_mower_1",
      stats: { efficiency: 1.0, speed: 1.0, fuelCapacity: 0, fuelEfficiency: 1.0, durability: 100 }
    }
  },

  // === EQUIPMENT TIER 2 ===
  {
    id: "riding_mower_basic",
    name: "Basic Riding Mower",
    description: "Faster mowing with a riding mower",
    category: "equipment",
    baseCost: 500,
    prerequisites: ["basic_push_mower"],
    tier: 2,
    unlocks: {
      type: "equipment",
      equipmentId: "riding_mower_1",
      stats: { efficiency: 1.2, speed: 2.0, fuelCapacity: 50, fuelEfficiency: 1.0, durability: 150 }
    }
  },
  {
    id: "basic_sprinkler",
    name: "Manual Sprinkler System",
    description: "Basic irrigation for small areas",
    category: "irrigation",
    baseCost: 400,
    prerequisites: [],
    tier: 2,
    unlocks: {
      type: "equipment",
      equipmentId: "sprinkler_1",
      stats: { efficiency: 1.0, speed: 1.0, fuelCapacity: 100, fuelEfficiency: 1.0, durability: 200 }
    }
  },
  {
    id: "basic_fertilizer",
    name: "Standard Fertilizer",
    description: "General-purpose lawn fertilizer",
    category: "fertilizers",
    baseCost: 300,
    prerequisites: [],
    tier: 2,
    unlocks: {
      type: "fertilizer",
      fertilizerId: "fertilizer_standard",
      effectiveness: 1.0
    }
  },

  // === EQUIPMENT TIER 3 ===
  {
    id: "riding_mower_advanced",
    name: "Commercial Riding Mower",
    description: "Heavy-duty riding mower for larger areas",
    category: "equipment",
    baseCost: 1200,
    prerequisites: ["riding_mower_basic"],
    tier: 3,
    unlocks: {
      type: "equipment",
      equipmentId: "riding_mower_2",
      stats: { efficiency: 1.5, speed: 2.5, fuelCapacity: 80, fuelEfficiency: 0.9, durability: 200 }
    }
  },
  {
    id: "auto_sprinkler",
    name: "Automated Sprinkler System",
    description: "Timer-controlled irrigation",
    category: "irrigation",
    baseCost: 1000,
    prerequisites: ["basic_sprinkler"],
    tier: 3,
    unlocks: {
      type: "equipment",
      equipmentId: "sprinkler_auto",
      stats: { efficiency: 1.3, speed: 1.5, fuelCapacity: 200, fuelEfficiency: 0.8, durability: 300 }
    }
  },
  {
    id: "premium_fertilizer",
    name: "Premium Fertilizer",
    description: "Enhanced nutrients for healthier grass",
    category: "fertilizers",
    baseCost: 800,
    prerequisites: ["basic_fertilizer"],
    tier: 3,
    unlocks: {
      type: "fertilizer",
      fertilizerId: "fertilizer_premium",
      effectiveness: 1.5
    }
  },
  {
    id: "employee_training_1",
    name: "Basic Staff Training",
    description: "Improve employee efficiency",
    category: "management",
    baseCost: 600,
    prerequisites: [],
    tier: 3,
    unlocks: {
      type: "upgrade",
      upgradeId: "training_basic",
      bonus: { type: "efficiency", value: 1.1 }
    }
  },

  // === EQUIPMENT TIER 4 ===
  {
    id: "fairway_mower",
    name: "Fairway Mower",
    description: "Wide-cut mower designed for fairways",
    category: "equipment",
    baseCost: 2500,
    prerequisites: ["riding_mower_advanced"],
    tier: 4,
    unlocks: {
      type: "equipment",
      equipmentId: "fairway_mower_1",
      stats: { efficiency: 2.0, speed: 3.0, fuelCapacity: 120, fuelEfficiency: 0.85, durability: 250 }
    }
  },
  {
    id: "greens_mower",
    name: "Greens Mower",
    description: "Precision mower for putting greens",
    category: "equipment",
    baseCost: 2000,
    prerequisites: ["riding_mower_advanced"],
    tier: 4,
    unlocks: {
      type: "equipment",
      equipmentId: "greens_mower_1",
      stats: { efficiency: 1.8, speed: 1.5, fuelCapacity: 40, fuelEfficiency: 0.9, durability: 150 }
    }
  },
  {
    id: "smart_irrigation",
    name: "Smart Irrigation System",
    description: "Sensor-based watering with moisture detection",
    category: "irrigation",
    baseCost: 2200,
    prerequisites: ["auto_sprinkler"],
    tier: 4,
    unlocks: {
      type: "equipment",
      equipmentId: "sprinkler_smart",
      stats: { efficiency: 1.8, speed: 2.0, fuelCapacity: 300, fuelEfficiency: 0.6, durability: 400 }
    }
  },
  {
    id: "slow_release_fertilizer",
    name: "Slow-Release Fertilizer",
    description: "Long-lasting nutrient delivery",
    category: "fertilizers",
    baseCost: 1500,
    prerequisites: ["premium_fertilizer"],
    tier: 4,
    unlocks: {
      type: "fertilizer",
      fertilizerId: "fertilizer_slow_release",
      effectiveness: 2.0
    }
  },
  {
    id: "bunker_rake",
    name: "Bunker Rake Machine",
    description: "Mechanical bunker maintenance",
    category: "landscaping",
    baseCost: 1800,
    prerequisites: [],
    tier: 4,
    unlocks: {
      type: "equipment",
      equipmentId: "bunker_rake_1",
      stats: { efficiency: 1.5, speed: 2.0, fuelCapacity: 30, fuelEfficiency: 1.0, durability: 200 }
    }
  },
  {
    id: "employee_training_2",
    name: "Advanced Staff Training",
    description: "Specialized training programs",
    category: "management",
    baseCost: 1400,
    prerequisites: ["employee_training_1"],
    tier: 4,
    unlocks: {
      type: "upgrade",
      upgradeId: "training_advanced",
      bonus: { type: "efficiency", value: 1.25 }
    }
  },

  // === EQUIPMENT TIER 5 ===
  {
    id: "precision_greens_mower",
    name: "Precision Greens Complex",
    description: "GPS-guided greens maintenance system",
    category: "equipment",
    baseCost: 4500,
    prerequisites: ["greens_mower"],
    tier: 5,
    unlocks: {
      type: "equipment",
      equipmentId: "greens_mower_pro",
      stats: { efficiency: 2.5, speed: 2.0, fuelCapacity: 60, fuelEfficiency: 0.7, durability: 300 }
    }
  },
  {
    id: "organic_fertilizer",
    name: "Organic Bio-Fertilizer",
    description: "Eco-friendly premium fertilizer",
    category: "fertilizers",
    baseCost: 3000,
    prerequisites: ["slow_release_fertilizer"],
    tier: 5,
    unlocks: {
      type: "fertilizer",
      fertilizerId: "fertilizer_organic",
      effectiveness: 2.5
    }
  },
  {
    id: "weather_system",
    name: "Weather Monitoring System",
    description: "Predictive weather for optimal scheduling",
    category: "management",
    baseCost: 2800,
    prerequisites: ["smart_irrigation"],
    tier: 5,
    unlocks: {
      type: "feature",
      featureId: "weather_prediction"
    }
  },
  {
    id: "clubhouse_upgrade",
    name: "Premium Clubhouse",
    description: "Upgraded facilities for higher guest satisfaction",
    category: "facilities",
    baseCost: 4000,
    prerequisites: [],
    tier: 5,
    unlocks: {
      type: "upgrade",
      upgradeId: "clubhouse_premium",
      bonus: { type: "quality", value: 1.3 }
    }
  },

  // === ROBOTICS TIER 5 ===
  // Autonomous robots: expensive to buy, cheap to run, but can break down
  {
    id: "robot_mower_fairway",
    name: "RoboMow Fairway Unit",
    description: "Autonomous GPS-guided fairway mower. Operates 24/7 without staff. Requires mechanic for repairs.",
    category: "robotics",
    baseCost: 6000,
    prerequisites: ["fairway_mower", "smart_irrigation"],
    tier: 5,
    unlocks: {
      type: "equipment",
      equipmentId: "robot_mower_fairway",
      stats: {
        efficiency: 2.8,
        speed: 1.8,
        fuelCapacity: 300,
        fuelEfficiency: 0.4,
        durability: 400,
        isAutonomous: true,
        purchaseCost: 45000,
        operatingCostPerHour: 2.50,   // Much cheaper than employee wages
        breakdownRate: 0.02,           // 2% chance per hour
        repairTime: 60                 // 1 hour to repair
      }
    }
  },
  {
    id: "robot_mower_greens",
    name: "RoboMow Precision Greens",
    description: "Ultra-precise autonomous greens mower with laser-guided cutting. Whisper quiet for early morning operation.",
    category: "robotics",
    baseCost: 7000,
    prerequisites: ["greens_mower", "precision_greens_mower"],
    tier: 5,
    unlocks: {
      type: "equipment",
      equipmentId: "robot_mower_greens",
      stats: {
        efficiency: 3.0,
        speed: 1.2,
        fuelCapacity: 150,
        fuelEfficiency: 0.35,
        durability: 350,
        isAutonomous: true,
        purchaseCost: 65000,
        operatingCostPerHour: 3.00,
        breakdownRate: 0.025,          // Slightly higher due to precision components
        repairTime: 90                 // More complex repairs
      }
    }
  },
  {
    id: "robot_sprayer",
    name: "AutoSpray Irrigation Robot",
    description: "Mobile autonomous sprayer with soil moisture sensors. Targets dry spots automatically.",
    category: "robotics",
    baseCost: 5500,
    prerequisites: ["smart_irrigation"],
    tier: 5,
    unlocks: {
      type: "equipment",
      equipmentId: "robot_sprayer",
      stats: {
        efficiency: 2.5,
        speed: 2.0,
        fuelCapacity: 500,
        fuelEfficiency: 0.3,
        durability: 450,
        isAutonomous: true,
        purchaseCost: 38000,
        operatingCostPerHour: 2.00,
        breakdownRate: 0.015,          // Water systems are reliable
        repairTime: 45
      }
    }
  },
  {
    id: "robot_fertilizer",
    name: "NutriBot Spreader",
    description: "Autonomous fertilizer spreader with GPS mapping and variable rate application. Maximizes coverage, minimizes waste.",
    category: "robotics",
    baseCost: 5000,
    prerequisites: ["slow_release_fertilizer", "smart_irrigation"],
    tier: 5,
    unlocks: {
      type: "equipment",
      equipmentId: "robot_fertilizer",
      stats: {
        efficiency: 2.6,
        speed: 1.5,
        fuelCapacity: 400,
        fuelEfficiency: 0.35,
        durability: 380,
        isAutonomous: true,
        purchaseCost: 35000,
        operatingCostPerHour: 1.80,
        breakdownRate: 0.018,
        repairTime: 50
      }
    }
  },
  {
    id: "robot_bunker_rake",
    name: "SandBot Bunker Groomer",
    description: "Autonomous bunker maintenance robot. Rakes and edges bunkers overnight while the course is closed.",
    category: "robotics",
    baseCost: 4500,
    prerequisites: ["bunker_rake"],
    tier: 5,
    unlocks: {
      type: "equipment",
      equipmentId: "robot_bunker_rake",
      stats: {
        efficiency: 2.2,
        speed: 1.0,
        fuelCapacity: 100,
        fuelEfficiency: 0.5,
        durability: 300,
        isAutonomous: true,
        purchaseCost: 28000,
        operatingCostPerHour: 1.50,
        breakdownRate: 0.03,           // Sand is hard on mechanics
        repairTime: 40
      }
    }
  },
  {
    id: "robot_fleet_manager",
    name: "Fleet Management AI",
    description: "Central AI system that coordinates all robots, optimizes routes, and predicts maintenance needs. Reduces breakdown rates by 40%.",
    category: "robotics",
    baseCost: 8000,
    prerequisites: ["robot_mower_fairway", "robot_sprayer"],
    tier: 5,
    unlocks: {
      type: "upgrade",
      upgradeId: "fleet_ai",
      bonus: { type: "efficiency", value: 1.4 }  // 40% reduction in breakdown rates
    }
  }
];

// ============================================================================
// Factory Functions
// ============================================================================

export function createInitialResearchState(): ResearchState {
  // Start with basic push mower completed
  return {
    completedResearch: ["basic_push_mower"],
    currentResearch: null,
    researchQueue: [],
    fundingLevel: "normal",
    totalPointsSpent: 0
  };
}

export function createResearchProgress(
  itemId: string,
  startTime: number
): ResearchProgress | null {
  const item = getResearchItem(itemId);
  if (!item) return null;

  return {
    itemId,
    pointsEarned: 0,
    pointsRequired: item.baseCost,
    startTime
  };
}

// ============================================================================
// Query Functions
// ============================================================================

export function getResearchItem(id: string): ResearchItem | null {
  return RESEARCH_ITEMS.find(item => item.id === id) ?? null;
}

export function getResearchItemsByCategory(
  category: ResearchCategory
): readonly ResearchItem[] {
  return RESEARCH_ITEMS.filter(item => item.category === category);
}

export function getResearchItemsByTier(tier: number): readonly ResearchItem[] {
  return RESEARCH_ITEMS.filter(item => item.tier === tier);
}

export function getResearchStatus(
  state: ResearchState,
  itemId: string
): ResearchStatus {
  if (state.completedResearch.includes(itemId)) {
    return "completed";
  }

  if (state.currentResearch?.itemId === itemId) {
    return "researching";
  }

  const item = getResearchItem(itemId);
  if (!item) return "locked";

  // Check if prerequisites are met
  const prereqsMet = item.prerequisites.every(prereq =>
    state.completedResearch.includes(prereq)
  );

  return prereqsMet ? "available" : "locked";
}

export function getAvailableResearch(state: ResearchState): readonly ResearchItem[] {
  return RESEARCH_ITEMS.filter(item =>
    getResearchStatus(state, item.id) === "available"
  );
}

export function getCompletedResearch(state: ResearchState): readonly ResearchItem[] {
  return RESEARCH_ITEMS.filter(item =>
    state.completedResearch.includes(item.id)
  );
}

export function getLockedResearch(state: ResearchState): readonly ResearchItem[] {
  return RESEARCH_ITEMS.filter(item =>
    getResearchStatus(state, item.id) === "locked"
  );
}

export function canStartResearch(state: ResearchState, itemId: string): boolean {
  return getResearchStatus(state, itemId) === "available";
}

export function getResearchProgress(state: ResearchState): number {
  if (!state.currentResearch) return 0;
  if (state.currentResearch.pointsRequired === 0) return 100;

  return Math.min(
    100,
    (state.currentResearch.pointsEarned / state.currentResearch.pointsRequired) * 100
  );
}

export function getEstimatedTimeToComplete(state: ResearchState): number | null {
  if (!state.currentResearch) return null;

  const pointsPerMinute = FUNDING_POINTS_PER_MINUTE[state.fundingLevel];
  if (pointsPerMinute === 0) return null; // Infinite time

  const remainingPoints =
    state.currentResearch.pointsRequired - state.currentResearch.pointsEarned;

  return Math.ceil(remainingPoints / pointsPerMinute);
}

export function getFundingCostPerMinute(state: ResearchState): number {
  return FUNDING_COST_PER_MINUTE[state.fundingLevel];
}

export function getTotalResearchCount(): number {
  return RESEARCH_ITEMS.length;
}

export function getCompletedResearchCount(state: ResearchState): number {
  return state.completedResearch.length;
}

export function getUnlockedEquipment(state: ResearchState): readonly string[] {
  return state.completedResearch
    .map(id => getResearchItem(id))
    .filter((item): item is ResearchItem => item !== null)
    .filter(item => item.unlocks.type === "equipment")
    .map(item => (item.unlocks as { type: "equipment"; equipmentId: string }).equipmentId);
}

export function getUnlockedFertilizers(state: ResearchState): readonly string[] {
  return state.completedResearch
    .map(id => getResearchItem(id))
    .filter((item): item is ResearchItem => item !== null)
    .filter(item => item.unlocks.type === "fertilizer")
    .map(item => (item.unlocks as { type: "fertilizer"; fertilizerId: string }).fertilizerId);
}

export function getActiveUpgrades(state: ResearchState): readonly UpgradeBonus[] {
  return state.completedResearch
    .map(id => getResearchItem(id))
    .filter((item): item is ResearchItem => item !== null)
    .filter(item => item.unlocks.type === "upgrade")
    .map(item => (item.unlocks as { type: "upgrade"; upgradeId: string; bonus: UpgradeBonus }).bonus);
}

export function getUnlockedAutonomousEquipment(state: ResearchState): readonly {
  equipmentId: string;
  stats: EquipmentStats;
}[] {
  return state.completedResearch
    .map(id => getResearchItem(id))
    .filter((item): item is ResearchItem => item !== null)
    .filter(item => item.unlocks.type === "equipment")
    .map(item => item.unlocks as { type: "equipment"; equipmentId: string; stats: EquipmentStats })
    .filter(unlock => unlock.stats.isAutonomous === true)
    .map(unlock => ({ equipmentId: unlock.equipmentId, stats: unlock.stats }));
}

export function isAutonomousEquipment(equipmentId: string): boolean {
  for (const item of RESEARCH_ITEMS) {
    if (item.unlocks.type === "equipment") {
      const unlock = item.unlocks as { type: "equipment"; equipmentId: string; stats: EquipmentStats };
      if (unlock.equipmentId === equipmentId && unlock.stats.isAutonomous) {
        return true;
      }
    }
  }
  return false;
}

export function getAutonomousEquipmentStats(equipmentId: string): EquipmentStats | null {
  for (const item of RESEARCH_ITEMS) {
    if (item.unlocks.type === "equipment") {
      const unlock = item.unlocks as { type: "equipment"; equipmentId: string; stats: EquipmentStats };
      if (unlock.equipmentId === equipmentId) {
        return unlock.stats;
      }
    }
  }
  return null;
}

export function calculateRobotOperatingCost(
  stats: EquipmentStats,
  hoursOperating: number
): number {
  return (stats.operatingCostPerHour ?? 0) * hoursOperating;
}

export function calculateBreakdownProbability(
  stats: EquipmentStats,
  hoursOperating: number,
  hasFleetAI: boolean = false
): number {
  const baseRate = stats.breakdownRate ?? 0;
  const adjustedRate = hasFleetAI ? baseRate * 0.6 : baseRate; // Fleet AI reduces by 40%
  // Probability of at least one breakdown = 1 - (1 - rate)^hours
  return 1 - Math.pow(1 - adjustedRate, hoursOperating);
}

export function getPrerequisiteChain(itemId: string): readonly string[] {
  const item = getResearchItem(itemId);
  if (!item) return [];

  const chain: string[] = [];
  const visited = new Set<string>();

  function collectPrereqs(id: string): void {
    if (visited.has(id)) return;
    visited.add(id);

    const research = getResearchItem(id);
    if (!research) return;

    for (const prereq of research.prerequisites) {
      collectPrereqs(prereq);
      if (!chain.includes(prereq)) {
        chain.push(prereq);
      }
    }
  }

  collectPrereqs(itemId);
  return chain;
}

export function getDependentResearch(itemId: string): readonly ResearchItem[] {
  return RESEARCH_ITEMS.filter(item =>
    item.prerequisites.includes(itemId)
  );
}

// ============================================================================
// State Transformation Functions
// ============================================================================

export function setFundingLevel(
  state: ResearchState,
  level: FundingLevel
): ResearchState {
  return { ...state, fundingLevel: level };
}

export function startResearch(
  state: ResearchState,
  itemId: string,
  currentTime: number
): ResearchState | null {
  if (!canStartResearch(state, itemId)) {
    return null;
  }

  // If already researching something, queue this item
  if (state.currentResearch) {
    return addToQueue(state, itemId);
  }

  const progress = createResearchProgress(itemId, currentTime);
  if (!progress) return null;

  return {
    ...state,
    currentResearch: progress
  };
}

export function addToQueue(
  state: ResearchState,
  itemId: string
): ResearchState | null {
  // Can't queue if already in queue or being researched
  if (state.researchQueue.includes(itemId)) {
    return null;
  }

  if (state.currentResearch?.itemId === itemId) {
    return null;
  }

  // Can't queue if not available or already completed
  const status = getResearchStatus(state, itemId);
  if (status !== "available" && status !== "locked") {
    return null;
  }

  return {
    ...state,
    researchQueue: [...state.researchQueue, itemId]
  };
}

export function removeFromQueue(
  state: ResearchState,
  itemId: string
): ResearchState {
  return {
    ...state,
    researchQueue: state.researchQueue.filter(id => id !== itemId)
  };
}

export function cancelResearch(state: ResearchState): ResearchState {
  if (!state.currentResearch) {
    return state;
  }

  // Start next item in queue if available
  if (state.researchQueue.length > 0) {
    const [nextId, ...remainingQueue] = state.researchQueue;
    const nextProgress = createResearchProgress(nextId, Date.now());

    if (nextProgress && getResearchStatus(state, nextId) === "available") {
      return {
        ...state,
        currentResearch: nextProgress,
        researchQueue: remainingQueue
      };
    }
  }

  return {
    ...state,
    currentResearch: null
  };
}

export interface ResearchTickResult {
  readonly state: ResearchState;
  readonly completed: ResearchItem | null;
  readonly pointsAdded: number;
}

export function tickResearch(
  state: ResearchState,
  deltaMinutes: number,
  currentTime: number
): ResearchTickResult {
  if (!state.currentResearch) {
    return { state, completed: null, pointsAdded: 0 };
  }

  const pointsPerMinute = FUNDING_POINTS_PER_MINUTE[state.fundingLevel];
  const pointsToAdd = pointsPerMinute * deltaMinutes;

  const newPointsEarned = state.currentResearch.pointsEarned + pointsToAdd;

  // Check if research is complete
  if (newPointsEarned >= state.currentResearch.pointsRequired) {
    const completedItem = getResearchItem(state.currentResearch.itemId);

    // Mark as completed
    const newCompletedResearch = [
      ...state.completedResearch,
      state.currentResearch.itemId
    ];

    // Start next in queue if available
    let newCurrentResearch: ResearchProgress | null = null;
    let newQueue = state.researchQueue;

    // Find next valid item in queue
    for (let i = 0; i < state.researchQueue.length; i++) {
      const queuedId = state.researchQueue[i];
      const queuedItem = getResearchItem(queuedId);

      if (queuedItem) {
        // Check if prerequisites are now met
        const prereqsMet = queuedItem.prerequisites.every(prereq =>
          newCompletedResearch.includes(prereq)
        );

        if (prereqsMet) {
          newCurrentResearch = createResearchProgress(queuedId, currentTime);
          newQueue = state.researchQueue.slice(i + 1);
          break;
        }
      }
    }

    return {
      state: {
        ...state,
        completedResearch: newCompletedResearch,
        currentResearch: newCurrentResearch,
        researchQueue: newQueue,
        totalPointsSpent: state.totalPointsSpent + state.currentResearch.pointsRequired
      },
      completed: completedItem,
      pointsAdded: state.currentResearch.pointsRequired - state.currentResearch.pointsEarned
    };
  }

  // Just add progress
  return {
    state: {
      ...state,
      currentResearch: {
        ...state.currentResearch,
        pointsEarned: newPointsEarned
      }
    },
    completed: null,
    pointsAdded: pointsToAdd
  };
}

export function completeResearchInstantly(
  state: ResearchState,
  itemId: string
): ResearchState | null {
  const item = getResearchItem(itemId);
  if (!item) return null;

  // Check prerequisites
  const prereqsMet = item.prerequisites.every(prereq =>
    state.completedResearch.includes(prereq)
  );

  if (!prereqsMet) return null;

  // Already completed
  if (state.completedResearch.includes(itemId)) {
    return state;
  }

  // Remove from current research if it was being researched
  let newCurrentResearch = state.currentResearch;
  if (state.currentResearch?.itemId === itemId) {
    newCurrentResearch = null;
  }

  // Remove from queue if present
  const newQueue = state.researchQueue.filter(id => id !== itemId);

  return {
    ...state,
    completedResearch: [...state.completedResearch, itemId],
    currentResearch: newCurrentResearch,
    researchQueue: newQueue,
    totalPointsSpent: state.totalPointsSpent + item.baseCost
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function formatResearchTime(minutes: number): string {
  if (minutes < 60) {
    return `${Math.ceil(minutes)} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.ceil(minutes % 60);

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

export function getResearchCategoryName(category: ResearchCategory): string {
  const names: Record<ResearchCategory, string> = {
    equipment: "Equipment",
    fertilizers: "Fertilizers",
    irrigation: "Irrigation",
    landscaping: "Landscaping",
    facilities: "Facilities",
    management: "Management",
    robotics: "Robotics"
  };
  return names[category];
}
