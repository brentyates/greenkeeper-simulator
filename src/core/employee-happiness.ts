/**
 * Employee Happiness Consequences System
 *
 * Happiness has teeth: it affects efficiency, triggers sick days,
 * and eventually causes quitting. This transforms employee management
 * from "hire and forget" into an engaging system.
 */

import type { Employee, EmployeeRoster } from './employees';
import type { PersonalityTrait } from './employee-traits';
import { getTraitSickChanceModifier } from './employee-traits';

// ============================================================================
// Types
// ============================================================================

export interface HappinessConsequenceState {
  /** Track consecutive days below happiness threshold per employee */
  readonly consecutiveUnhappyDays: ReadonlyMap<string, number>;
  /** Track which employees are on sick leave and for how many days */
  readonly sickLeave: ReadonlyMap<string, number>;
  /** Track days off granted (from events) */
  readonly daysOff: ReadonlyMap<string, number>;
  /** Track last raise request day per employee */
  readonly lastRaiseRequestDay: ReadonlyMap<string, number>;
  /** Track daily task counts per employee (reset daily) */
  readonly dailyTaskCounts: ReadonlyMap<string, number>;
}

export interface HappinessTickResult {
  readonly state: HappinessConsequenceState;
  readonly sickToday: readonly string[];       // Employee IDs who called in sick
  readonly quitting: readonly string[];         // Employee IDs who quit
  readonly notifications: readonly string[];    // Messages for the player
}

// ============================================================================
// Constants
// ============================================================================

/** Happiness-to-efficiency mapping (from design doc) */
const HAPPINESS_EFFICIENCY_TIERS: { min: number; max: number; modifier: number }[] = [
  { min: 90, max: 100, modifier: 1.10 },  // Motivated
  { min: 70, max: 89,  modifier: 1.00 },  // Content
  { min: 50, max: 69,  modifier: 0.85 },  // Disgruntled
  { min: 30, max: 49,  modifier: 0.70 },  // Unhappy
  { min: 0,  max: 29,  modifier: 0.50 },  // Miserable
];

/** Daily sick chance by happiness range */
const SICK_CHANCES: { minHappiness: number; chance: number }[] = [
  { minHappiness: 70, chance: 0.01 },   // 1% - bad luck
  { minHappiness: 50, chance: 0.05 },   // 5%
  { minHappiness: 30, chance: 0.12 },   // 12%
  { minHappiness: 0,  chance: 0.20 },   // 20%
];

/** Quit conditions */
const QUIT_THRESHOLD_SEVERE = 20;
const QUIT_THRESHOLD_MODERATE = 30;
const QUIT_DAYS_SEVERE = 3;
const QUIT_DAYS_MODERATE = 7;
const QUIT_CHANCE_SEVERE = 0.40;
const QUIT_CHANCE_MODERATE = 0.25;
const QUIT_IMMEDIATE_THRESHOLD = 10;
const QUIT_IMMEDIATE_CHANCE = 0.60;

// ============================================================================
// State Management
// ============================================================================

export function createInitialHappinessState(): HappinessConsequenceState {
  return {
    consecutiveUnhappyDays: new Map(),
    sickLeave: new Map(),
    daysOff: new Map(),
    lastRaiseRequestDay: new Map(),
    dailyTaskCounts: new Map(),
  };
}

/**
 * Serialize happiness state for save game.
 */
export function serializeHappinessState(state: HappinessConsequenceState): object {
  return {
    consecutiveUnhappyDays: Array.from(state.consecutiveUnhappyDays.entries()),
    sickLeave: Array.from(state.sickLeave.entries()),
    daysOff: Array.from(state.daysOff.entries()),
    lastRaiseRequestDay: Array.from(state.lastRaiseRequestDay.entries()),
    dailyTaskCounts: Array.from(state.dailyTaskCounts.entries()),
  };
}

/**
 * Deserialize happiness state from save game.
 */
export function deserializeHappinessState(data: {
  consecutiveUnhappyDays?: [string, number][];
  sickLeave?: [string, number][];
  daysOff?: [string, number][];
  lastRaiseRequestDay?: [string, number][];
  dailyTaskCounts?: [string, number][];
}): HappinessConsequenceState {
  return {
    consecutiveUnhappyDays: new Map(data.consecutiveUnhappyDays ?? []),
    sickLeave: new Map(data.sickLeave ?? []),
    daysOff: new Map(data.daysOff ?? []),
    lastRaiseRequestDay: new Map(data.lastRaiseRequestDay ?? []),
    dailyTaskCounts: new Map(data.dailyTaskCounts ?? []),
  };
}

// ============================================================================
// Efficiency Modifier
// ============================================================================

/**
 * Get the efficiency modifier based on happiness tier.
 * Replaces the gentle existing modifier with the design doc's tiered system.
 */
export function getHappinessEfficiencyModifier(happiness: number): number {
  for (const tier of HAPPINESS_EFFICIENCY_TIERS) {
    if (happiness >= tier.min && happiness <= tier.max) {
      return tier.modifier;
    }
  }
  return 0.50; // Fallback for edge cases
}

// ============================================================================
// Daily Tick
// ============================================================================

/**
 * Daily happiness consequences tick. Called once per game day.
 * Checks for sick days, quitting, and updates tracking state.
 */
export function tickHappinessConsequences(
  state: HappinessConsequenceState,
  roster: EmployeeRoster,
  traits: ReadonlyMap<string, readonly PersonalityTrait[]>,
  _gameDay: number
): HappinessTickResult {
  const sickToday: string[] = [];
  const quitting: string[] = [];
  const notifications: string[] = [];

  const newUnhappyDays = new Map(state.consecutiveUnhappyDays);
  const newSickLeave = new Map(state.sickLeave);
  const newDaysOff = new Map(state.daysOff);

  for (const employee of roster.employees) {
    // Decrement days off
    const remainingDaysOff = (newDaysOff.get(employee.id) ?? 0) - 1;
    if (remainingDaysOff > 0) {
      newDaysOff.set(employee.id, remainingDaysOff);
      continue; // Skip all checks while on days off
    } else {
      newDaysOff.delete(employee.id);
    }

    // Decrement sick leave
    const sickDaysLeft = (newSickLeave.get(employee.id) ?? 0) - 1;
    if (sickDaysLeft > 0) {
      newSickLeave.set(employee.id, sickDaysLeft);
      continue; // Still sick
    } else {
      newSickLeave.delete(employee.id);
    }

    // Track consecutive unhappy days
    if (employee.happiness < QUIT_THRESHOLD_MODERATE) {
      const current = newUnhappyDays.get(employee.id) ?? 0;
      newUnhappyDays.set(employee.id, current + 1);
    } else {
      newUnhappyDays.delete(employee.id);
    }

    // Check for sick day
    const empTraits = traits.get(employee.id) ?? [];
    const sickChanceModifier = getTraitSickChanceModifier(empTraits);

    if (sickChanceModifier > 0) {
      const baseSickChance = getSickChance(employee.happiness);
      const actualChance = baseSickChance * sickChanceModifier;

      if (Math.random() < actualChance) {
        sickToday.push(employee.id);
        newSickLeave.set(employee.id, 1); // 1 day sick
        notifications.push(`${employee.name} called in sick today.`);
      }
    }

    // Check for quitting
    const unhappyDays = newUnhappyDays.get(employee.id) ?? 0;
    const quitResult = checkQuitRisk(employee, unhappyDays);

    if (quitResult.quits) {
      quitting.push(employee.id);
      notifications.push(`${employee.name} has resigned! ${quitResult.reason}`);
      newUnhappyDays.delete(employee.id);
    }
  }

  return {
    state: {
      ...state,
      consecutiveUnhappyDays: newUnhappyDays,
      sickLeave: newSickLeave,
      daysOff: newDaysOff,
      dailyTaskCounts: new Map(), // Reset daily
    },
    sickToday,
    quitting,
    notifications,
  };
}

function getSickChance(happiness: number): number {
  for (const tier of SICK_CHANCES) {
    if (happiness >= tier.minHappiness) {
      return tier.chance;
    }
  }
  return 0.20; // Worst case
}

function checkQuitRisk(
  employee: Employee,
  consecutiveUnhappyDays: number
): { quits: boolean; reason: string } {
  // Immediate quit risk at very low happiness
  if (employee.happiness < QUIT_IMMEDIATE_THRESHOLD) {
    if (Math.random() < QUIT_IMMEDIATE_CHANCE) {
      return { quits: true, reason: 'Happiness dropped critically low.' };
    }
  }

  // Severe unhappiness for 3+ days
  if (employee.happiness < QUIT_THRESHOLD_SEVERE && consecutiveUnhappyDays >= QUIT_DAYS_SEVERE) {
    if (Math.random() < QUIT_CHANCE_SEVERE) {
      return { quits: true, reason: `Unhappy for ${consecutiveUnhappyDays} consecutive days.` };
    }
  }

  // Moderate unhappiness for 7+ days
  if (employee.happiness < QUIT_THRESHOLD_MODERATE && consecutiveUnhappyDays >= QUIT_DAYS_MODERATE) {
    if (Math.random() < QUIT_CHANCE_MODERATE) {
      return { quits: true, reason: `Persistently unhappy for ${consecutiveUnhappyDays} days.` };
    }
  }

  return { quits: false, reason: '' };
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Check if an employee is currently on sick leave.
 */
export function isOnSickLeave(state: HappinessConsequenceState, employeeId: string): boolean {
  return (state.sickLeave.get(employeeId) ?? 0) > 0;
}

/**
 * Check if an employee is currently on days off (from events).
 */
export function isOnDaysOff(state: HappinessConsequenceState, employeeId: string): boolean {
  return (state.daysOff.get(employeeId) ?? 0) > 0;
}

/**
 * Check if an employee is unavailable (sick or days off).
 */
export function isUnavailable(state: HappinessConsequenceState, employeeId: string): boolean {
  return isOnSickLeave(state, employeeId) || isOnDaysOff(state, employeeId);
}

/**
 * Grant days off to an employee (from event resolution).
 */
export function grantDaysOff(
  state: HappinessConsequenceState,
  employeeId: string,
  days: number
): HappinessConsequenceState {
  const newDaysOff = new Map(state.daysOff);
  newDaysOff.set(employeeId, days);
  return { ...state, daysOff: newDaysOff };
}

/**
 * Record a task completion for daily tracking.
 */
export function recordTaskCompletion(
  state: HappinessConsequenceState,
  employeeId: string
): HappinessConsequenceState {
  const newCounts = new Map(state.dailyTaskCounts);
  newCounts.set(employeeId, (newCounts.get(employeeId) ?? 0) + 1);
  return { ...state, dailyTaskCounts: newCounts };
}

/**
 * Get the current daily task count for an employee.
 */
export function getDailyTaskCount(state: HappinessConsequenceState, employeeId: string): number {
  return state.dailyTaskCounts.get(employeeId) ?? 0;
}

/**
 * Remove an employee from all tracking (called when they're fired or quit).
 */
export function removeEmployeeFromTracking(
  state: HappinessConsequenceState,
  employeeId: string
): HappinessConsequenceState {
  const newUnhappy = new Map(state.consecutiveUnhappyDays);
  const newSick = new Map(state.sickLeave);
  const newDaysOff = new Map(state.daysOff);
  const newRaise = new Map(state.lastRaiseRequestDay);
  const newTasks = new Map(state.dailyTaskCounts);

  newUnhappy.delete(employeeId);
  newSick.delete(employeeId);
  newDaysOff.delete(employeeId);
  newRaise.delete(employeeId);
  newTasks.delete(employeeId);

  return {
    consecutiveUnhappyDays: newUnhappy,
    sickLeave: newSick,
    daysOff: newDaysOff,
    lastRaiseRequestDay: newRaise,
    dailyTaskCounts: newTasks,
  };
}
