import { ScenarioObjective, ScenarioConditions } from '../core/scenario';
import { CourseId } from './courseData';

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  courseId: CourseId;
  objective: ScenarioObjective;
  conditions: ScenarioConditions;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  unlockAfter?: string; // ID of previous scenario
}

export const SCENARIOS: ScenarioDefinition[] = [
  // ========== LEVEL 1: 3-HOLE BEGINNER ==========
  {
    id: 'tutorial_basics',
    name: 'Welcome to Greenkeeping',
    description: 'Learn the basics of course maintenance on this small 3-hole course. Keep the grass healthy and earn your first profits.',
    courseId: '3_hole',
    objective: {
      type: 'economic',
      targetProfit: 2000,
    },
    conditions: {
      startingCash: 5000,
      startingHealth: 60,
      timeLimitDays: 30,
      grassGrowthRate: 0.8, // Slower growth for tutorial
    },
    difficulty: 'beginner',
  },

  // ========== LEVEL 2: 9-HOLE INTERMEDIATE ==========
  {
    id: 'meadowbrook_restoration',
    name: 'Meadowbrook Restoration',
    description: 'This 9-hole course has fallen into disrepair. Restore it to good condition to attract golfers back.',
    courseId: '9_hole',
    objective: {
      type: 'restoration',
      targetHealth: 75,
      targetCondition: 'Good',
    },
    conditions: {
      startingCash: 8000,
      startingHealth: 35, // Poor starting condition
      timeLimitDays: 45,
    },
    difficulty: 'intermediate',
    unlockAfter: 'tutorial_basics',
  },

  {
    id: 'meadowbrook_attendance',
    name: 'Meadowbrook Grand Opening',
    description: 'Now that the course looks great, attract golfers! Host 100 rounds to establish your reputation.',
    courseId: '9_hole',
    objective: {
      type: 'attendance',
      targetGolfers: 400, // 4 golfers per round on average
      targetRounds: 100,
    },
    conditions: {
      startingCash: 10000,
      startingHealth: 70,
      timeLimitDays: 60,
    },
    difficulty: 'intermediate',
    unlockAfter: 'meadowbrook_restoration',
  },

  // ========== LEVEL 3: 18-HOLE ADVANCED ==========
  {
    id: 'highlands_profit_challenge',
    name: 'Royal Highlands Profit Challenge',
    description: 'Take on the prestigious Royal Highlands Championship course. Turn a profit while maintaining excellence.',
    courseId: '18_hole_championship',
    objective: {
      type: 'economic',
      targetProfit: 15000,
    },
    conditions: {
      startingCash: 12000,
      startingHealth: 65,
      timeLimitDays: 90,
      costMultiplier: 1.3, // Higher costs for championship course
      revenueMultiplier: 1.5, // But higher revenue too
    },
    difficulty: 'advanced',
    unlockAfter: 'meadowbrook_attendance',
  },

  {
    id: 'highlands_satisfaction',
    name: 'Royal Highlands Excellence',
    description: 'Maintain an excellent course rating for a full week to cement your reputation as a master greenkeeper.',
    courseId: '18_hole_championship',
    objective: {
      type: 'satisfaction',
      targetRating: 85,
      maintainForDays: 7,
    },
    conditions: {
      startingCash: 15000,
      startingHealth: 60,
      timeLimitDays: 60,
    },
    difficulty: 'advanced',
    unlockAfter: 'highlands_profit_challenge',
  },

  // ========== LEVEL 4: SECOND 18-HOLE (ORIGINAL COURSE) ==========
  {
    id: 'sunrise_valley_revenue',
    name: 'Sunrise Valley Revenue Drive',
    description: 'At Sunrise Valley, focus on maximizing revenue. This course needs to become a profit center.',
    courseId: '18_hole_original',
    objective: {
      type: 'economic',
      targetRevenue: 25000,
    },
    conditions: {
      startingCash: 10000,
      startingHealth: 70,
      timeLimitDays: 75,
    },
    difficulty: 'advanced',
    unlockAfter: 'highlands_satisfaction',
  },

  {
    id: 'sunrise_valley_attendance',
    name: 'Sunrise Valley Tournament',
    description: 'Host a major tournament by attracting 500 golfers to Sunrise Valley.',
    courseId: '18_hole_original',
    objective: {
      type: 'attendance',
      targetGolfers: 500,
      targetRounds: 125,
    },
    conditions: {
      startingCash: 15000,
      startingHealth: 75,
      timeLimitDays: 90,
    },
    difficulty: 'advanced',
    unlockAfter: 'sunrise_valley_revenue',
  },

  // ========== LEVEL 5: 27-HOLE EXPERT (FINALE) ==========
  {
    id: 'grand_summit_restoration',
    name: 'Grand Summit Restoration',
    description: 'The massive Grand Summit Resort has been neglected. This is your ultimate test - restore all 27 holes to excellent condition.',
    courseId: '27_hole',
    objective: {
      type: 'restoration',
      targetHealth: 85,
      targetCondition: 'Excellent',
    },
    conditions: {
      startingCash: 20000,
      startingHealth: 25, // Severely neglected
      timeLimitDays: 120,
      costMultiplier: 1.5, // Very expensive
    },
    difficulty: 'expert',
    unlockAfter: 'sunrise_valley_attendance',
  },

  {
    id: 'grand_summit_excellence',
    name: 'Grand Summit Excellence',
    description: 'Maintain the Grand Summit at peak condition for two weeks straight. Only the best greenkeepers can achieve this.',
    courseId: '27_hole',
    objective: {
      type: 'satisfaction',
      targetRating: 90,
      maintainForDays: 14,
    },
    conditions: {
      startingCash: 25000,
      startingHealth: 70,
      timeLimitDays: 90,
      costMultiplier: 1.4,
    },
    difficulty: 'expert',
    unlockAfter: 'grand_summit_restoration',
  },

  {
    id: 'grand_summit_finale',
    name: 'Grand Summit Grand Finale',
    description: 'The ultimate challenge: Generate massive revenue while maintaining excellence at the resort. Win this to become a legendary greenkeeper!',
    courseId: '27_hole',
    objective: {
      type: 'economic',
      targetProfit: 50000,
    },
    conditions: {
      startingCash: 30000,
      startingHealth: 80,
      timeLimitDays: 150,
      costMultiplier: 1.3,
      revenueMultiplier: 2.0,
    },
    difficulty: 'expert',
    unlockAfter: 'grand_summit_excellence',
  },
];

export interface ScenarioProgress {
  completedScenarios: string[];
  currentScenarioId: string | null;
  unlockedScenarios: string[];
}

export function getUnlockedScenarios(completedIds: string[]): ScenarioDefinition[] {
  const unlocked: ScenarioDefinition[] = [];

  for (const scenario of SCENARIOS) {
    // Always unlock first scenario
    if (!scenario.unlockAfter) {
      unlocked.push(scenario);
      continue;
    }

    // Unlock if prerequisite is completed
    if (completedIds.includes(scenario.unlockAfter)) {
      unlocked.push(scenario);
    }
  }

  return unlocked;
}

export function getScenarioById(id: string): ScenarioDefinition | undefined {
  return SCENARIOS.find(s => s.id === id);
}

export function getNextScenario(currentId: string): ScenarioDefinition | undefined {
  const scenario = SCENARIOS.find(s => s.unlockAfter === currentId);
  return scenario;
}

export function getScenariosByDifficulty(difficulty: ScenarioDefinition['difficulty']): ScenarioDefinition[] {
  return SCENARIOS.filter(s => s.difficulty === difficulty);
}

export function getProgressionPath(): string[] {
  // Returns the main progression path (one scenario per course)
  return [
    'tutorial_basics',
    'meadowbrook_restoration',
    'meadowbrook_attendance',
    'highlands_profit_challenge',
    'highlands_satisfaction',
    'sunrise_valley_revenue',
    'sunrise_valley_attendance',
    'grand_summit_restoration',
    'grand_summit_excellence',
    'grand_summit_finale',
  ];
}
