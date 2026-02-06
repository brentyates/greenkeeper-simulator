/**
 * Employee Personality Trait System
 *
 * Each employee has 1-2 traits that affect their work behavior,
 * event frequency, and interactions. Traits are hidden at hire
 * for novice candidates and reveal over the first few days.
 */

import type { SkillLevel } from './employees';

// ============================================================================
// Types
// ============================================================================

export type PersonalityTrait =
  | 'hard_worker'
  | 'reliable'
  | 'quick_learner'
  | 'perfectionist'
  | 'social'
  | 'ambitious'
  | 'weather_tough'
  | 'night_owl'
  | 'early_bird'
  | 'loner'
  | 'clumsy'
  | 'lazy'
  | 'complainer';

export interface TraitDefinition {
  readonly id: PersonalityTrait;
  readonly name: string;
  readonly description: string;
  readonly category: 'positive' | 'mixed' | 'negative';
  readonly efficiencyModifier: number;      // Multiplied into work speed
  readonly qualityModifier: number;         // Multiplied into work quality
  readonly fatigueRateModifier: number;     // Multiplied into fatigue accrual
  readonly experienceModifier: number;      // Multiplied into XP gain
  readonly happinessModifier: number;       // Added to happiness per day
  readonly sickChanceModifier: number;      // Multiplied into sick day chance
  readonly raiseRequestModifier: number;    // Multiplied into raise request frequency
}

export interface EmployeeTraitState {
  readonly traits: readonly PersonalityTrait[];
  readonly revealedTraits: readonly PersonalityTrait[];
  readonly daysEmployed: number;
}

// ============================================================================
// Trait Definitions
// ============================================================================

export const TRAIT_DEFINITIONS: Record<PersonalityTrait, TraitDefinition> = {
  hard_worker: {
    id: 'hard_worker',
    name: 'Hard Worker',
    description: '+15% efficiency, fatigue accrues 20% faster',
    category: 'positive',
    efficiencyModifier: 1.15,
    qualityModifier: 1.0,
    fatigueRateModifier: 1.2,
    experienceModifier: 1.0,
    happinessModifier: 0,
    sickChanceModifier: 1.0,
    raiseRequestModifier: 1.0,
  },
  reliable: {
    id: 'reliable',
    name: 'Reliable',
    description: 'Never calls in sick, +0.1 reliability',
    category: 'positive',
    efficiencyModifier: 1.0,
    qualityModifier: 1.0,
    fatigueRateModifier: 1.0,
    experienceModifier: 1.0,
    happinessModifier: 0,
    sickChanceModifier: 0,  // Never sick
    raiseRequestModifier: 1.0,
  },
  quick_learner: {
    id: 'quick_learner',
    name: 'Quick Learner',
    description: '+30% experience gain',
    category: 'positive',
    efficiencyModifier: 1.0,
    qualityModifier: 1.0,
    fatigueRateModifier: 1.0,
    experienceModifier: 1.3,
    happinessModifier: 0,
    sickChanceModifier: 1.0,
    raiseRequestModifier: 1.0,
  },
  perfectionist: {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: '+20% quality, -10% speed',
    category: 'mixed',
    efficiencyModifier: 0.9,
    qualityModifier: 1.2,
    fatigueRateModifier: 1.0,
    experienceModifier: 1.0,
    happinessModifier: 0,
    sickChanceModifier: 1.0,
    raiseRequestModifier: 1.0,
  },
  social: {
    id: 'social',
    name: 'Social',
    description: '+5 happiness to nearby employees, -10% efficiency when alone',
    category: 'mixed',
    efficiencyModifier: 1.0,  // Modified contextually
    qualityModifier: 1.0,
    fatigueRateModifier: 1.0,
    experienceModifier: 1.0,
    happinessModifier: 0,
    sickChanceModifier: 1.0,
    raiseRequestModifier: 1.0,
  },
  ambitious: {
    id: 'ambitious',
    name: 'Ambitious',
    description: '+20% experience gain, requests raises 50% more often',
    category: 'mixed',
    efficiencyModifier: 1.0,
    qualityModifier: 1.0,
    fatigueRateModifier: 1.0,
    experienceModifier: 1.2,
    happinessModifier: 0,
    sickChanceModifier: 1.0,
    raiseRequestModifier: 1.5,
  },
  weather_tough: {
    id: 'weather_tough',
    name: 'Weather Tough',
    description: 'No happiness penalty from bad weather',
    category: 'positive',
    efficiencyModifier: 1.0,
    qualityModifier: 1.0,
    fatigueRateModifier: 1.0,
    experienceModifier: 1.0,
    happinessModifier: 0,
    sickChanceModifier: 1.0,
    raiseRequestModifier: 1.0,
  },
  night_owl: {
    id: 'night_owl',
    name: 'Night Owl',
    description: '+15% efficiency after 2 PM, -15% before 10 AM',
    category: 'mixed',
    efficiencyModifier: 1.0,  // Modified by time of day
    qualityModifier: 1.0,
    fatigueRateModifier: 1.0,
    experienceModifier: 1.0,
    happinessModifier: 0,
    sickChanceModifier: 1.0,
    raiseRequestModifier: 1.0,
  },
  early_bird: {
    id: 'early_bird',
    name: 'Early Bird',
    description: '+15% efficiency before 10 AM, -15% after 2 PM',
    category: 'mixed',
    efficiencyModifier: 1.0,  // Modified by time of day
    qualityModifier: 1.0,
    fatigueRateModifier: 1.0,
    experienceModifier: 1.0,
    happinessModifier: 0,
    sickChanceModifier: 1.0,
    raiseRequestModifier: 1.0,
  },
  loner: {
    id: 'loner',
    name: 'Loner',
    description: '+10% efficiency, -5 happiness if >3 employees in same area',
    category: 'mixed',
    efficiencyModifier: 1.1,
    qualityModifier: 1.0,
    fatigueRateModifier: 1.0,
    experienceModifier: 1.0,
    happinessModifier: 0,  // Modified contextually
    sickChanceModifier: 1.0,
    raiseRequestModifier: 1.0,
  },
  clumsy: {
    id: 'clumsy',
    name: 'Clumsy',
    description: '-10% quality, 5% chance of equipment damage per day',
    category: 'negative',
    efficiencyModifier: 1.0,
    qualityModifier: 0.9,
    fatigueRateModifier: 1.0,
    experienceModifier: 1.0,
    happinessModifier: 0,
    sickChanceModifier: 1.0,
    raiseRequestModifier: 1.0,
  },
  lazy: {
    id: 'lazy',
    name: 'Lazy',
    description: '-15% efficiency, +20% break time',
    category: 'negative',
    efficiencyModifier: 0.85,
    qualityModifier: 1.0,
    fatigueRateModifier: 0.8,  // Less fatigue = takes breaks less, but...
    experienceModifier: 1.0,
    happinessModifier: 0,
    sickChanceModifier: 1.0,
    raiseRequestModifier: 1.0,
  },
  complainer: {
    id: 'complainer',
    name: 'Complainer',
    description: '-3 happiness to nearby employees',
    category: 'negative',
    efficiencyModifier: 1.0,
    qualityModifier: 1.0,
    fatigueRateModifier: 1.0,
    experienceModifier: 1.0,
    happinessModifier: -1,  // Self happiness drain
    sickChanceModifier: 1.0,
    raiseRequestModifier: 1.2,
  },
};

// Traits grouped by category for balanced generation
const POSITIVE_TRAITS: PersonalityTrait[] = ['hard_worker', 'reliable', 'quick_learner', 'weather_tough'];
const MIXED_TRAITS: PersonalityTrait[] = ['perfectionist', 'social', 'ambitious', 'night_owl', 'early_bird', 'loner'];
const NEGATIVE_TRAITS: PersonalityTrait[] = ['clumsy', 'lazy', 'complainer'];

// Incompatible trait pairs (can't have both)
const INCOMPATIBLE_PAIRS: [PersonalityTrait, PersonalityTrait][] = [
  ['night_owl', 'early_bird'],
  ['social', 'loner'],
  ['hard_worker', 'lazy'],
];

// ============================================================================
// Generation
// ============================================================================

/**
 * Generate random traits for a new employee.
 * - 40% chance of 1 trait, 35% chance of 2 traits, 25% chance of no traits
 * - Weighted: 30% positive, 45% mixed, 25% negative
 */
export function generateTraits(): PersonalityTrait[] {
  const roll = Math.random() * 100;
  let traitCount: number;
  if (roll < 25) {
    traitCount = 0;
  } else if (roll < 65) {
    traitCount = 1;
  } else {
    traitCount = 2;
  }

  if (traitCount === 0) return [];

  const traits: PersonalityTrait[] = [];

  for (let i = 0; i < traitCount; i++) {
    const trait = pickRandomTrait(traits);
    if (trait) {
      traits.push(trait);
    }
  }

  return traits;
}

function pickRandomTrait(existing: PersonalityTrait[]): PersonalityTrait | null {
  // Pick category: 30% positive, 45% mixed, 25% negative
  const catRoll = Math.random() * 100;
  let pool: PersonalityTrait[];
  if (catRoll < 30) {
    pool = POSITIVE_TRAITS;
  } else if (catRoll < 75) {
    pool = MIXED_TRAITS;
  } else {
    pool = NEGATIVE_TRAITS;
  }

  // Filter out existing and incompatible traits
  const available = pool.filter(t => {
    if (existing.includes(t)) return false;
    for (const [a, b] of INCOMPATIBLE_PAIRS) {
      if (t === a && existing.includes(b)) return false;
      if (t === b && existing.includes(a)) return false;
    }
    return true;
  });

  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

// ============================================================================
// Trait State Management
// ============================================================================

/**
 * Create initial trait state for a newly hired employee.
 */
export function createTraitState(traits: PersonalityTrait[], skillLevel: SkillLevel): EmployeeTraitState {
  // Visibility at hire time depends on skill level
  let revealedTraits: PersonalityTrait[];

  switch (skillLevel) {
    case 'expert':
      revealedTraits = [...traits];
      break;
    case 'experienced':
      revealedTraits = traits.length > 0 ? [traits[0]] : [];
      break;
    case 'trained':
      revealedTraits = traits.length > 0 ? [traits[0]] : [];
      break;
    case 'novice':
    default:
      revealedTraits = [];
      break;
  }

  return {
    traits,
    revealedTraits,
    daysEmployed: 0,
  };
}

/**
 * Advance trait state by one day. Reveals hidden traits over time.
 * Novice: traits reveal over days 3-5.
 * Trained: second trait reveals on day 3.
 */
export function tickTraitDay(state: EmployeeTraitState): EmployeeTraitState {
  const newDays = state.daysEmployed + 1;
  let revealed = [...state.revealedTraits];

  // Reveal traits based on days employed
  for (const trait of state.traits) {
    if (revealed.includes(trait)) continue;

    // Random reveal chance increases with days
    const revealChance = newDays >= 5 ? 1.0 :
                         newDays >= 3 ? 0.5 :
                         0;

    if (Math.random() < revealChance) {
      revealed.push(trait);
    }
  }

  return {
    ...state,
    revealedTraits: revealed,
    daysEmployed: newDays,
  };
}

// ============================================================================
// Trait Effect Calculations
// ============================================================================

/**
 * Get the combined efficiency modifier from all traits.
 * Time-of-day effects for night_owl and early_bird are applied here.
 */
export function getTraitEfficiencyModifier(
  traits: readonly PersonalityTrait[],
  gameHour: number = 12
): number {
  let modifier = 1.0;

  for (const trait of traits) {
    const def = TRAIT_DEFINITIONS[trait];
    modifier *= def.efficiencyModifier;

    // Time-based modifiers
    if (trait === 'night_owl') {
      if (gameHour >= 14) modifier *= 1.15;
      else if (gameHour < 10) modifier *= 0.85;
    } else if (trait === 'early_bird') {
      if (gameHour < 10) modifier *= 1.15;
      else if (gameHour >= 14) modifier *= 0.85;
    }
  }

  return modifier;
}

/**
 * Get the combined quality modifier from all traits.
 */
export function getTraitQualityModifier(traits: readonly PersonalityTrait[]): number {
  let modifier = 1.0;
  for (const trait of traits) {
    modifier *= TRAIT_DEFINITIONS[trait].qualityModifier;
  }
  return modifier;
}

/**
 * Get the combined fatigue rate modifier from all traits.
 */
export function getTraitFatigueModifier(traits: readonly PersonalityTrait[]): number {
  let modifier = 1.0;
  for (const trait of traits) {
    modifier *= TRAIT_DEFINITIONS[trait].fatigueRateModifier;
  }
  return modifier;
}

/**
 * Get the combined experience modifier from all traits.
 */
export function getTraitExperienceModifier(traits: readonly PersonalityTrait[]): number {
  let modifier = 1.0;
  for (const trait of traits) {
    modifier *= TRAIT_DEFINITIONS[trait].experienceModifier;
  }
  return modifier;
}

/**
 * Get the combined sick chance modifier from all traits.
 * Returns 0 if any trait prevents sickness entirely (e.g., 'reliable').
 */
export function getTraitSickChanceModifier(traits: readonly PersonalityTrait[]): number {
  let modifier = 1.0;
  for (const trait of traits) {
    const m = TRAIT_DEFINITIONS[trait].sickChanceModifier;
    if (m === 0) return 0; // Immune to sick days
    modifier *= m;
  }
  return modifier;
}

/**
 * Get the combined raise request frequency modifier from all traits.
 */
export function getTraitRaiseRequestModifier(traits: readonly PersonalityTrait[]): number {
  let modifier = 1.0;
  for (const trait of traits) {
    modifier *= TRAIT_DEFINITIONS[trait].raiseRequestModifier;
  }
  return modifier;
}

/**
 * Check if employee has a specific trait.
 */
export function hasTrait(traits: readonly PersonalityTrait[], trait: PersonalityTrait): boolean {
  return traits.includes(trait);
}
