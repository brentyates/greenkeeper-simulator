/**
 * Employee Events System
 *
 * Events are micro-stories that make employees feel like people.
 * They create moments of decision-making that punctuate the management
 * layer without demanding constant attention.
 *
 * Events auto-resolve after 1 game day if ignored.
 */

import type { Employee, EmployeeRoster } from './employees';
import type { PersonalityTrait } from './employee-traits';
import { hasTrait, getTraitRaiseRequestModifier } from './employee-traits';

// ============================================================================
// Types
// ============================================================================

export type EmployeeEventType =
  | 'raise_request'
  | 'personality_clash'
  | 'exceptional_performance'
  | 'training_milestone'
  | 'poaching_attempt'
  | 'personal_emergency'
  | 'weather_complaint';

export type EventResolution =
  | 'grant'
  | 'deny'
  | 'promise_later'
  | 'reassign'
  | 'talk_to_both'
  | 'ignore'
  | 'give_bonus'
  | 'acknowledge'
  | 'celebrate'
  | 'match_offer'
  | 'counter_offer'
  | 'let_go'
  | 'paid_leave'
  | 'unpaid_leave'
  | 'deny_leave'
  | 'auto_resolved';

export interface EventOption {
  readonly id: EventResolution;
  readonly label: string;
  readonly cost: number;
  readonly description: string;
}

export interface EmployeeEvent {
  readonly id: string;
  readonly type: EmployeeEventType;
  readonly employeeId: string;
  readonly secondaryEmployeeId?: string;  // For personality clashes
  readonly title: string;
  readonly description: string;
  readonly options: readonly EventOption[];
  readonly createdDay: number;
  readonly expiresDay: number;
  readonly resolved: boolean;
  readonly resolution?: EventResolution;
}

export interface EventOutcome {
  readonly happinessChanges: readonly { employeeId: string; delta: number }[];
  readonly wageChanges: readonly { employeeId: string; newWage: number }[];
  readonly firingIds: readonly string[];  // Employees who quit
  readonly daysOff: readonly { employeeId: string; days: number }[];
  readonly cost: number;
  readonly notification: string;
  readonly teamHappinessDelta: number;  // Applied to ALL employees
}

export interface EmployeeEventSystemState {
  readonly activeEvents: readonly EmployeeEvent[];
  readonly resolvedEvents: readonly EmployeeEvent[];
  readonly lastEventCheckDay: number;
  readonly totalEventsGenerated: number;
}

// ============================================================================
// Constants
// ============================================================================

let eventIdCounter = 0;

const RAISE_REQUEST_BASE_INTERVAL = 30;  // Game days between checks
const POACHING_DAILY_CHANCE = 0.02;      // 2% per day for experts
const PERSONAL_EMERGENCY_MONTHLY_CHANCE = 0.03;  // 3% per month per employee
const CLASH_DAILY_CHANCE = 0.05;         // 5% when conditions met
const EXCEPTIONAL_PERFORMANCE_THRESHOLD = 50; // Tasks completed in a day

// ============================================================================
// State Management
// ============================================================================

export function createInitialEventState(): EmployeeEventSystemState {
  return {
    activeEvents: [],
    resolvedEvents: [],
    lastEventCheckDay: 0,
    totalEventsGenerated: 0,
  };
}

/**
 * Serialize event state for save game (already JSON-safe).
 */
export function serializeEventState(state: EmployeeEventSystemState): object {
  return { ...state };
}

/**
 * Deserialize event state from save game.
 */
export function deserializeEventState(data: Partial<EmployeeEventSystemState>): EmployeeEventSystemState {
  return {
    activeEvents: data.activeEvents ?? [],
    resolvedEvents: data.resolvedEvents ?? [],
    lastEventCheckDay: data.lastEventCheckDay ?? 0,
    totalEventsGenerated: data.totalEventsGenerated ?? 0,
  };
}

export function resetEventCounter(): void {
  eventIdCounter = 0;
}

// ============================================================================
// Event Generation
// ============================================================================

/**
 * Daily tick to check for new events. Called once per game day.
 */
export function checkForEvents(
  state: EmployeeEventSystemState,
  roster: EmployeeRoster,
  gameDay: number,
  traits: ReadonlyMap<string, readonly PersonalityTrait[]>,
  weatherIsBad: boolean = false,
  taskCounts?: ReadonlyMap<string, number>,
): EmployeeEventSystemState {
  if (gameDay <= state.lastEventCheckDay) return state;

  let newState = { ...state, lastEventCheckDay: gameDay };
  const newEvents: EmployeeEvent[] = [];

  for (const employee of roster.employees) {
    const empTraits = traits.get(employee.id) ?? [];

    // Raise request check
    const raiseEvent = checkRaiseRequest(employee, empTraits, gameDay, state.activeEvents);
    if (raiseEvent) newEvents.push(raiseEvent);

    // Poaching attempt (experts only)
    const poachEvent = checkPoachingAttempt(employee, gameDay);
    if (poachEvent) newEvents.push(poachEvent);

    // Personal emergency
    const emergencyEvent = checkPersonalEmergency(employee, gameDay);
    if (emergencyEvent) newEvents.push(emergencyEvent);

    // Weather complaint
    if (weatherIsBad) {
      const weatherEvent = checkWeatherComplaint(employee, empTraits, gameDay, state.activeEvents);
      if (weatherEvent) newEvents.push(weatherEvent);
    }

    // Exceptional performance
    if (taskCounts) {
      const count = taskCounts.get(employee.id) ?? 0;
      const perfEvent = checkExceptionalPerformance(employee, count, gameDay);
      if (perfEvent) newEvents.push(perfEvent);
    }
  }

  // Personality clashes (check pairs)
  const clashEvent = checkPersonalityClash(roster, traits, gameDay, state.activeEvents);
  if (clashEvent) newEvents.push(clashEvent);

  // Auto-resolve expired events
  const { active, expired } = autoResolveExpired(newState.activeEvents, gameDay);

  return {
    ...newState,
    activeEvents: [...active, ...newEvents],
    resolvedEvents: [...newState.resolvedEvents, ...expired],
    totalEventsGenerated: newState.totalEventsGenerated + newEvents.length,
  };
}

function autoResolveExpired(
  events: readonly EmployeeEvent[],
  gameDay: number
): { active: EmployeeEvent[]; expired: EmployeeEvent[] } {
  const active: EmployeeEvent[] = [];
  const expired: EmployeeEvent[] = [];

  for (const event of events) {
    if (event.resolved) {
      expired.push(event);
    } else if (gameDay > event.expiresDay) {
      expired.push({ ...event, resolved: true, resolution: 'auto_resolved' });
    } else {
      active.push(event);
    }
  }

  return { active, expired };
}

// ============================================================================
// Individual Event Checks
// ============================================================================

function checkRaiseRequest(
  employee: Employee,
  traits: readonly PersonalityTrait[],
  gameDay: number,
  activeEvents: readonly EmployeeEvent[]
): EmployeeEvent | null {
  // Don't generate if there's already a raise request pending
  if (activeEvents.some(e => e.type === 'raise_request' && e.employeeId === employee.id)) {
    return null;
  }

  // Only check if unhappy enough
  if (employee.happiness >= 60) return null;

  // Trait modifier affects frequency
  const modifier = getTraitRaiseRequestModifier(traits);
  const interval = RAISE_REQUEST_BASE_INTERVAL / modifier;

  // Simple day-based probability
  if (gameDay % Math.max(1, Math.floor(interval)) !== 0) return null;

  // Additional chance roll
  if (employee.happiness >= 40 && Math.random() > 0.5) return null;

  const proposedRaise = Math.round(employee.hourlyWage * 1.12 * 100) / 100;

  return {
    id: `event_${++eventIdCounter}`,
    type: 'raise_request',
    employeeId: employee.id,
    title: `${employee.name} requests a raise`,
    description: `${employee.name} has been at $${employee.hourlyWage.toFixed(2)}/hr and is feeling undervalued (happiness: ${Math.round(employee.happiness)}). They're requesting $${proposedRaise.toFixed(2)}/hr.`,
    options: [
      {
        id: 'grant',
        label: `Grant Raise: $${proposedRaise.toFixed(2)}/hr`,
        cost: 0,
        description: '+15 happiness, raise cooldown 60 days',
      },
      {
        id: 'deny',
        label: 'Deny Request',
        cost: 0,
        description: '-10 happiness, may trigger quit evaluation',
      },
      {
        id: 'promise_later',
        label: 'Promise Later',
        cost: 0,
        description: '-5 happiness, will ask again in 15 days',
      },
    ],
    createdDay: gameDay,
    expiresDay: gameDay + 1,
    resolved: false,
  };
}

function checkPoachingAttempt(
  employee: Employee,
  gameDay: number
): EmployeeEvent | null {
  if (employee.skillLevel !== 'expert' && employee.skillLevel !== 'experienced') return null;
  if (Math.random() > POACHING_DAILY_CHANCE) return null;

  const offerWage = Math.round(employee.hourlyWage * 1.18 * 100) / 100;
  const matchWage = Math.round(employee.hourlyWage * 1.15 * 100) / 100;

  return {
    id: `event_${++eventIdCounter}`,
    type: 'poaching_attempt',
    employeeId: employee.id,
    title: `${employee.name} received outside offer`,
    description: `Another course has offered ${employee.name} a position at $${offerWage.toFixed(2)}/hr. They want to know if you can match it.`,
    options: [
      {
        id: 'match_offer',
        label: `Match: $${matchWage.toFixed(2)}/hr`,
        cost: 0,
        description: '+15 happiness, employee stays',
      },
      {
        id: 'counter_offer',
        label: 'Counter with promotion',
        cost: 0,
        description: '+10 happiness if promotable, otherwise -5',
      },
      {
        id: 'let_go',
        label: 'Let them go',
        cost: 0,
        description: 'Employee quits in 3 days',
      },
    ],
    createdDay: gameDay,
    expiresDay: gameDay + 2,
    resolved: false,
  };
}

function checkPersonalEmergency(
  employee: Employee,
  gameDay: number
): EmployeeEvent | null {
  // ~3% monthly = ~0.1% daily
  if (Math.random() > PERSONAL_EMERGENCY_MONTHLY_CHANCE / 30) return null;

  return {
    id: `event_${++eventIdCounter}`,
    type: 'personal_emergency',
    employeeId: employee.id,
    title: `${employee.name} needs time off`,
    description: `${employee.name} has a personal emergency and needs 2-3 days off.`,
    options: [
      {
        id: 'paid_leave',
        label: 'Paid leave (2 days)',
        cost: Math.round(employee.hourlyWage * 16),
        description: '+20 happiness, +3 happiness to all staff',
      },
      {
        id: 'unpaid_leave',
        label: 'Unpaid leave (2 days)',
        cost: 0,
        description: 'Neutral - employee takes time off without pay',
      },
      {
        id: 'deny_leave',
        label: 'Deny leave',
        cost: 0,
        description: '-25 happiness, works at 50% efficiency, -3 happiness to all staff',
      },
    ],
    createdDay: gameDay,
    expiresDay: gameDay + 1,
    resolved: false,
  };
}

function checkWeatherComplaint(
  employee: Employee,
  traits: readonly PersonalityTrait[],
  gameDay: number,
  activeEvents: readonly EmployeeEvent[]
): EmployeeEvent | null {
  // Weather tough employees don't complain
  if (hasTrait(traits, 'weather_tough')) return null;

  // Don't double-generate
  if (activeEvents.some(e => e.type === 'weather_complaint' && e.employeeId === employee.id)) {
    return null;
  }

  // Only complain if already somewhat unhappy
  if (employee.happiness > 60) return null;
  if (Math.random() > 0.15) return null;

  return {
    id: `event_${++eventIdCounter}`,
    type: 'weather_complaint',
    employeeId: employee.id,
    title: `${employee.name} is unhappy about conditions`,
    description: `${employee.name} is struggling with the bad weather. Morale is dropping.`,
    options: [
      {
        id: 'acknowledge',
        label: 'Acknowledge & encourage',
        cost: 0,
        description: '+3 happiness',
      },
      {
        id: 'ignore',
        label: 'Ignore',
        cost: 0,
        description: 'No effect',
      },
    ],
    createdDay: gameDay,
    expiresDay: gameDay + 1,
    resolved: false,
  };
}

function checkExceptionalPerformance(
  employee: Employee,
  taskCount: number,
  gameDay: number
): EmployeeEvent | null {
  if (taskCount < EXCEPTIONAL_PERFORMANCE_THRESHOLD) return null;

  return {
    id: `event_${++eventIdCounter}`,
    type: 'exceptional_performance',
    employeeId: employee.id,
    title: `${employee.name} had an outstanding day`,
    description: `${employee.name} completed ${taskCount} tasks today with great quality. Their hard work is noticeable.`,
    options: [
      {
        id: 'give_bonus',
        label: 'Give bonus ($100)',
        cost: 100,
        description: '+10 happiness, +loyalty',
      },
      {
        id: 'acknowledge',
        label: 'Acknowledge',
        cost: 0,
        description: '+3 happiness',
      },
      {
        id: 'ignore',
        label: 'Say nothing',
        cost: 0,
        description: 'No effect (missed opportunity)',
      },
    ],
    createdDay: gameDay,
    expiresDay: gameDay + 1,
    resolved: false,
  };
}

function checkPersonalityClash(
  roster: EmployeeRoster,
  traits: ReadonlyMap<string, readonly PersonalityTrait[]>,
  gameDay: number,
  activeEvents: readonly EmployeeEvent[]
): EmployeeEvent | null {
  // Don't generate if there's already a clash pending
  if (activeEvents.some(e => e.type === 'personality_clash')) return null;

  // Find pairs of unhappy employees in the same area
  const unhappy = roster.employees.filter(e => e.happiness < 50);
  if (unhappy.length < 2) return null;

  // Check if any pair shares an area
  for (let i = 0; i < unhappy.length; i++) {
    for (let j = i + 1; j < unhappy.length; j++) {
      const a = unhappy[i];
      const b = unhappy[j];

      if (a.assignedArea && a.assignedArea === b.assignedArea) {
        // Complainers increase clash chance
        const aTraits = traits.get(a.id) ?? [];
        const bTraits = traits.get(b.id) ?? [];
        let chance = CLASH_DAILY_CHANCE;
        if (hasTrait(aTraits, 'complainer') || hasTrait(bTraits, 'complainer')) {
          chance *= 2;
        }

        if (Math.random() > chance) continue;

        return {
          id: `event_${++eventIdCounter}`,
          type: 'personality_clash',
          employeeId: a.id,
          secondaryEmployeeId: b.id,
          title: `Conflict between ${a.name} and ${b.name}`,
          description: `${a.name} and ${b.name} are having friction while working in the same area. Both are showing reduced productivity.`,
          options: [
            {
              id: 'reassign',
              label: 'Reassign one to different area',
              cost: 0,
              description: 'Solves immediately',
            },
            {
              id: 'talk_to_both',
              label: 'Talk to both',
              cost: 0,
              description: '+5 happiness each, 50% chance of recurrence',
            },
            {
              id: 'ignore',
              label: 'Ignore',
              cost: 0,
              description: 'Clash continues, may escalate',
            },
          ],
          createdDay: gameDay,
          expiresDay: gameDay + 1,
          resolved: false,
        };
      }
    }
  }

  return null;
}

// ============================================================================
// Event Resolution
// ============================================================================

/**
 * Resolve an event with the player's chosen option.
 */
export function resolveEvent(
  state: EmployeeEventSystemState,
  eventId: string,
  resolution: EventResolution,
  employee: Employee,
  secondaryEmployee?: Employee
): { state: EmployeeEventSystemState; outcome: EventOutcome } {
  const event = state.activeEvents.find(e => e.id === eventId);
  if (!event || event.resolved) {
    return {
      state,
      outcome: {
        happinessChanges: [],
        wageChanges: [],
        firingIds: [],
        daysOff: [],
        cost: 0,
        notification: '',
        teamHappinessDelta: 0,
      },
    };
  }

  const outcome = calculateOutcome(event, resolution, employee, secondaryEmployee);

  const resolvedEvent = { ...event, resolved: true, resolution };
  const newActive = state.activeEvents.filter(e => e.id !== eventId);

  return {
    state: {
      ...state,
      activeEvents: newActive,
      resolvedEvents: [...state.resolvedEvents, resolvedEvent],
    },
    outcome,
  };
}

function calculateOutcome(
  event: EmployeeEvent,
  resolution: EventResolution,
  employee: Employee,
  secondaryEmployee?: Employee
): EventOutcome {
  const happinessChanges: { employeeId: string; delta: number }[] = [];
  const wageChanges: { employeeId: string; newWage: number }[] = [];
  const firingIds: string[] = [];
  const daysOff: { employeeId: string; days: number }[] = [];
  let cost = 0;
  let notification = '';
  let teamHappinessDelta = 0;

  switch (event.type) {
    case 'raise_request':
      if (resolution === 'grant') {
        const newWage = Math.round(employee.hourlyWage * 1.12 * 100) / 100;
        wageChanges.push({ employeeId: employee.id, newWage });
        happinessChanges.push({ employeeId: employee.id, delta: 15 });
        notification = `${employee.name} is happy with the raise to $${newWage.toFixed(2)}/hr.`;
      } else if (resolution === 'deny') {
        happinessChanges.push({ employeeId: employee.id, delta: -10 });
        notification = `${employee.name} is disappointed by the denied raise.`;
      } else if (resolution === 'promise_later') {
        happinessChanges.push({ employeeId: employee.id, delta: -5 });
        notification = `${employee.name} is willing to wait, for now.`;
      }
      break;

    case 'poaching_attempt':
      if (resolution === 'match_offer') {
        const matchWage = Math.round(employee.hourlyWage * 1.15 * 100) / 100;
        wageChanges.push({ employeeId: employee.id, newWage: matchWage });
        happinessChanges.push({ employeeId: employee.id, delta: 15 });
        notification = `${employee.name} decided to stay for $${matchWage.toFixed(2)}/hr.`;
      } else if (resolution === 'counter_offer') {
        happinessChanges.push({ employeeId: employee.id, delta: 10 });
        notification = `${employee.name} appreciates the recognition and stays.`;
      } else if (resolution === 'let_go') {
        // Employee quits after a few days (immediate for simplicity)
        firingIds.push(employee.id);
        notification = `${employee.name} has accepted the outside offer and will leave.`;
      }
      break;

    case 'personal_emergency':
      if (resolution === 'paid_leave') {
        cost = Math.round(employee.hourlyWage * 16);
        daysOff.push({ employeeId: employee.id, days: 2 });
        happinessChanges.push({ employeeId: employee.id, delta: 20 });
        teamHappinessDelta = 3;
        notification = `${employee.name} is grateful for the paid time off.`;
      } else if (resolution === 'unpaid_leave') {
        daysOff.push({ employeeId: employee.id, days: 2 });
        notification = `${employee.name} takes unpaid leave.`;
      } else if (resolution === 'deny_leave') {
        happinessChanges.push({ employeeId: employee.id, delta: -25 });
        teamHappinessDelta = -3;
        notification = `${employee.name} is forced to work through the emergency. Other staff notice.`;
      }
      break;

    case 'exceptional_performance':
      if (resolution === 'give_bonus') {
        cost = 100;
        happinessChanges.push({ employeeId: employee.id, delta: 10 });
        notification = `${employee.name} is thrilled with the bonus!`;
      } else if (resolution === 'acknowledge') {
        happinessChanges.push({ employeeId: employee.id, delta: 3 });
        notification = `${employee.name} appreciates the recognition.`;
      } else {
        notification = `${employee.name}'s hard work goes unnoticed.`;
      }
      break;

    case 'personality_clash':
      if (resolution === 'reassign') {
        notification = `Conflict resolved by reassignment.`;
      } else if (resolution === 'talk_to_both') {
        happinessChanges.push({ employeeId: employee.id, delta: 5 });
        if (secondaryEmployee) {
          happinessChanges.push({ employeeId: secondaryEmployee.id, delta: 5 });
        }
        notification = `You talked to both employees. Things seem calmer.`;
      } else {
        happinessChanges.push({ employeeId: employee.id, delta: -10 });
        if (secondaryEmployee) {
          happinessChanges.push({ employeeId: secondaryEmployee.id, delta: -10 });
        }
        notification = `The conflict between employees continues.`;
      }
      break;

    case 'weather_complaint':
      if (resolution === 'acknowledge') {
        happinessChanges.push({ employeeId: employee.id, delta: 3 });
        notification = `${employee.name} feels a bit better after your encouragement.`;
      } else {
        notification = '';
      }
      break;

    default:
      notification = 'Event resolved.';
  }

  // Auto-resolved events get the "ignore" outcome
  if (resolution === 'auto_resolved') {
    return calculateOutcome(event, 'ignore', employee, secondaryEmployee);
  }

  return {
    happinessChanges,
    wageChanges,
    firingIds,
    daysOff,
    cost,
    notification,
    teamHappinessDelta,
  };
}

// ============================================================================
// Queries
// ============================================================================

export function getActiveEventCount(state: EmployeeEventSystemState): number {
  return state.activeEvents.filter(e => !e.resolved).length;
}

export function getActiveEventsForEmployee(
  state: EmployeeEventSystemState,
  employeeId: string
): readonly EmployeeEvent[] {
  return state.activeEvents.filter(e => e.employeeId === employeeId && !e.resolved);
}

export function hasActiveEvent(
  state: EmployeeEventSystemState,
  employeeId: string,
  eventType: EmployeeEventType
): boolean {
  return state.activeEvents.some(
    e => e.employeeId === employeeId && e.type === eventType && !e.resolved
  );
}
