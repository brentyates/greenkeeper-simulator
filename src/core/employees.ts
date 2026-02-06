/**
 * Employee System - Staff management for the golf course
 *
 * Similar to RollerCoaster Tycoon's staff system:
 * - Different employee types (groundskeepers, mechanics, managers)
 * - Hire/fire employees
 * - Wages and payroll
 * - Employee skills and experience
 * - Work assignments and productivity
 * - Personality traits that affect behavior
 * - Happiness consequences (sick days, quitting, efficiency)
 */

import { generateTraits, getTraitEfficiencyModifier, getTraitFatigueModifier, getTraitExperienceModifier } from './employee-traits';
import type { PersonalityTrait } from './employee-traits';
import { getHappinessEfficiencyModifier } from './employee-happiness';

// ============================================================================
// Types
// ============================================================================

export type EmployeeRole =
  | "groundskeeper"
  | "mechanic"
  | "pro_shop_staff"
  | "manager"
  | "caddy";

export type SkillLevel = "novice" | "trained" | "experienced" | "expert";

export interface EmployeeRoleInfo {
  readonly id: EmployeeRole;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly duties: readonly string[];
  readonly benefits: readonly string[];
}

export const EMPLOYEE_ROLE_INFO: Record<EmployeeRole, EmployeeRoleInfo> = {
  groundskeeper: {
    id: "groundskeeper",
    name: "Groundskeeper",
    icon: "🌿",
    description: "The backbone of course maintenance. Groundskeepers handle mowing, watering, general upkeep, and ensure the playing surface stays in top condition.",
    duties: [
      "Mow fairways, greens, and rough",
      "Water areas without irrigation pipes",
      "Perform general course cleanup",
      "Assist with equipment and pipe installation as needed"
    ],
    benefits: [
      "Essential for daily maintenance",
      "Most affordable staff option",
      "Flexible role - can help everywhere"
    ]
  },
  mechanic: {
    id: "mechanic",
    name: "Mechanic",
    icon: "🔧",
    description: "Keeps your equipment running smoothly. Mechanics repair broken mowers, maintain vehicles, install and repair irrigation pipes, and reduce equipment downtime.",
    duties: [
      "Repair broken equipment",
      "Install irrigation pipes (with groundskeeper)",
      "Repair leaking pipes",
      "Perform preventive maintenance",
      "Manage equipment inventory"
    ],
    benefits: [
      "Reduces equipment repair costs",
      "Faster equipment turnaround",
      "Extends equipment lifespan"
    ]
  },
  pro_shop_staff: {
    id: "pro_shop_staff",
    name: "Pro Shop Staff",
    icon: "🏌️",
    description: "The face of your golf course. Pro shop staff handle check-ins, sell merchandise, and provide customer service to golfers.",
    duties: [
      "Check in golfers",
      "Sell merchandise and rentals",
      "Answer customer inquiries"
    ],
    benefits: [
      "Increased merchandise revenue",
      "Better customer satisfaction",
      "Faster check-in times"
    ]
  },
  manager: {
    id: "manager",
    name: "Manager",
    icon: "📋",
    description: "Leadership that makes a difference. Managers boost the efficiency of all other employees and help coordinate daily operations.",
    duties: [
      "Supervise other employees",
      "Coordinate work schedules",
      "Handle administrative tasks"
    ],
    benefits: [
      "+15% efficiency for all staff",
      "Reduced employee fatigue",
      "Better crew coordination"
    ]
  },
  caddy: {
    id: "caddy",
    name: "Caddy",
    icon: "🎒",
    description: "Personal assistance for golfers. Caddies carry bags, offer course advice, and enhance the overall golfing experience.",
    duties: [
      "Carry golfer equipment",
      "Provide course knowledge",
      "Assist with club selection"
    ],
    benefits: [
      "Higher golfer satisfaction",
      "Increased tips revenue",
      "Premium service offering"
    ]
  }
};

export type EmployeeStatus = "working" | "idle" | "on_break" | "training";

export interface EmployeeSkills {
  readonly efficiency: number;     // 0.5 - 2.0, work speed multiplier
  readonly quality: number;        // 0.5 - 2.0, work quality multiplier
  readonly stamina: number;        // 0.5 - 2.0, how long before needing break
  readonly reliability: number;    // 0.5 - 1.0, chance of showing up
}

export interface Employee {
  readonly id: string;
  readonly name: string;
  readonly role: EmployeeRole;
  readonly skillLevel: SkillLevel;
  readonly skills: EmployeeSkills;
  readonly hireDate: number;       // Game time when hired
  readonly hourlyWage: number;
  readonly experience: number;     // Points toward next skill level
  readonly happiness: number;      // 0-100, affects performance
  readonly fatigue: number;        // 0-100, needs break when high
  readonly status: EmployeeStatus;
  readonly assignedArea: string | null;  // Zone/area assignment
  readonly traits?: readonly import('./employee-traits').PersonalityTrait[];
}

export interface EmployeeConfig {
  readonly baseWage: number;
  readonly wageMultipliers: Record<SkillLevel, number>;
  readonly baseEfficiency: number;
  readonly experienceToLevel: number;
  readonly breakThreshold: number;       // Fatigue level that triggers break
  readonly fatigueRecoveryRate: number;  // Per minute during break
  readonly fatigueAccrualRate: number;   // Per minute while working
}

export interface EmployeeRoster {
  readonly employees: readonly Employee[];
  readonly maxEmployees: number;
  readonly lastPayrollTime: number;
  readonly totalWagesPaid: number;
}

export interface PayrollResult {
  readonly roster: EmployeeRoster;
  readonly totalPaid: number;
  readonly breakdown: readonly { employeeId: string; amount: number }[];
}

export interface HiringPool {
  readonly candidates: readonly Employee[];
  readonly refreshTime: number;
}

export interface ApplicationState {
  readonly applications: readonly Employee[];
  readonly lastApplicationTime: number;
  readonly nextApplicationTime: number;
  readonly activeJobPostings: readonly JobPosting[];
  readonly totalApplicationsReceived: number;
}

export interface JobPosting {
  readonly id: string;
  readonly role: EmployeeRole;
  readonly postedTime: number;
  readonly expiresAt: number;
  readonly cost: number;
  readonly targetSkillLevel?: SkillLevel;
}

export interface ApplicationTickResult {
  readonly state: ApplicationState;
  readonly newApplicant: Employee | null;
  readonly expiredPostings: readonly JobPosting[];
}

export type PrestigeTier = 'municipal' | 'public' | 'semi_private' | 'private_club' | 'championship';

// ============================================================================
// Constants
// ============================================================================

export const EMPLOYEE_CONFIGS: Record<EmployeeRole, EmployeeConfig> = {
  groundskeeper: {
    baseWage: 12,
    wageMultipliers: { novice: 1.0, trained: 1.25, experienced: 1.5, expert: 2.0 },
    baseEfficiency: 1.0,
    experienceToLevel: 1000,
    breakThreshold: 80,
    fatigueRecoveryRate: 2.0,
    fatigueAccrualRate: 0.5
  },
  mechanic: {
    baseWage: 18,
    wageMultipliers: { novice: 1.0, trained: 1.3, experienced: 1.6, expert: 2.2 },
    baseEfficiency: 1.0,
    experienceToLevel: 1500,
    breakThreshold: 75,
    fatigueRecoveryRate: 1.5,
    fatigueAccrualRate: 0.4
  },
  pro_shop_staff: {
    baseWage: 10,
    wageMultipliers: { novice: 1.0, trained: 1.2, experienced: 1.4, expert: 1.7 },
    baseEfficiency: 1.0,
    experienceToLevel: 800,
    breakThreshold: 70,
    fatigueRecoveryRate: 2.5,
    fatigueAccrualRate: 0.3
  },
  manager: {
    baseWage: 25,
    wageMultipliers: { novice: 1.0, trained: 1.4, experienced: 1.8, expert: 2.5 },
    baseEfficiency: 1.2,
    experienceToLevel: 2000,
    breakThreshold: 90,
    fatigueRecoveryRate: 1.0,
    fatigueAccrualRate: 0.25
  },
  caddy: {
    baseWage: 8,
    wageMultipliers: { novice: 1.0, trained: 1.15, experienced: 1.35, expert: 1.6 },
    baseEfficiency: 1.0,
    experienceToLevel: 600,
    breakThreshold: 65,
    fatigueRecoveryRate: 3.0,
    fatigueAccrualRate: 0.6
  }
};

export const SKILL_LEVEL_BONUSES: Record<SkillLevel, number> = {
  novice: 0,
  trained: 0.15,
  experienced: 0.3,
  expert: 0.5
};

export const SKILL_LEVELS_ORDER: readonly SkillLevel[] = [
  "novice",
  "trained",
  "experienced",
  "expert"
] as const;

export const DEFAULT_MAX_EMPLOYEES = 20;
export const PAYROLL_INTERVAL_MINUTES = 60; // Pay every game hour
export const HIRING_POOL_SIZE = 5;
export const HIRING_POOL_REFRESH_INTERVAL = 480; // 8 game hours

// Prestige-based hiring configuration
export const PRESTIGE_HIRING_CONFIG: Record<PrestigeTier, {
  applicationRate: number;          // Game hours between natural applications
  maxApplications: number;          // Max pending applications at once
  skillDistribution: Record<SkillLevel, number>;  // Probability weights
  postingCost: number;             // Cost to post a job opening
  postingDuration: number;         // Hours posting stays active
  postingApplicationRate: number;  // Hours between applications when posting is active
}> = {
  municipal: {
    applicationRate: 8,   // ~4 real minutes at 1x speed
    maxApplications: 2,
    skillDistribution: { novice: 85, trained: 13, experienced: 2, expert: 0 },
    postingCost: 500,
    postingDuration: 72,  // 3 game days
    postingApplicationRate: 4   // ~2 real minutes at 1x speed
  },
  public: {
    applicationRate: 6,   // ~3 real minutes at 1x speed
    maxApplications: 3,
    skillDistribution: { novice: 60, trained: 28, experienced: 10, expert: 2 },
    postingCost: 350,
    postingDuration: 48,  // 2 game days
    postingApplicationRate: 2   // ~1 real minute at 1x speed
  },
  semi_private: {
    applicationRate: 4,   // ~2 real minutes at 1x speed
    maxApplications: 5,
    skillDistribution: { novice: 30, trained: 40, experienced: 23, expert: 7 },
    postingCost: 250,
    postingDuration: 36,  // 1.5 game days
    postingApplicationRate: 1   // ~30 real seconds at 1x speed
  },
  private_club: {
    applicationRate: 2,   // ~1 real minute at 1x speed
    maxApplications: 7,
    skillDistribution: { novice: 12, trained: 33, experienced: 38, expert: 17 },
    postingCost: 150,
    postingDuration: 24,  // 1 game day
    postingApplicationRate: 0.5 // ~15 real seconds at 1x speed
  },
  championship: {
    applicationRate: 1,   // ~30 real seconds at 1x speed
    maxApplications: 10,
    skillDistribution: { novice: 3, trained: 17, experienced: 42, expert: 38 },
    postingCost: 100,
    postingDuration: 24,  // 1 game day
    postingApplicationRate: 0.25 // ~7.5 real seconds at 1x speed
  }
};

// First names for random generation
const FIRST_NAMES = [
  "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
  "William", "Barbara", "David", "Elizabeth", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
  "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley"
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker"
];

// ============================================================================
// Factory Functions
// ============================================================================

let employeeIdCounter = 0;

export function createInitialRoster(maxEmployees: number = DEFAULT_MAX_EMPLOYEES): EmployeeRoster {
  return {
    employees: [],
    maxEmployees,
    lastPayrollTime: 0,
    totalWagesPaid: 0
  };
}

export function generateRandomName(seed?: number): string {
  const getSeed = () => seed !== undefined ? seed : Math.random();
  const firstIndex = Math.floor(getSeed() * FIRST_NAMES.length);
  const lastIndex = Math.floor((getSeed() * 7919) % LAST_NAMES.length); // Different prime for variety
  return `${FIRST_NAMES[firstIndex]} ${LAST_NAMES[lastIndex]}`;
}

export function generateRandomSkills(
  skillLevel: SkillLevel,
  seed?: number
): EmployeeSkills {
  const getRandom = () => seed !== undefined ? (seed * 9301 + 49297) % 233280 / 233280 : Math.random();
  const bonus = SKILL_LEVEL_BONUSES[skillLevel];

  // Base values with skill level bonus, plus random variation
  const baseValue = 0.7 + bonus;
  const variation = 0.3;

  return {
    efficiency: Math.min(2.0, Math.max(0.5, baseValue + (getRandom() - 0.5) * variation)),
    quality: Math.min(2.0, Math.max(0.5, baseValue + (getRandom() - 0.5) * variation)),
    stamina: Math.min(2.0, Math.max(0.5, baseValue + (getRandom() - 0.5) * variation)),
    reliability: Math.min(1.0, Math.max(0.5, 0.7 + bonus * 0.6 + getRandom() * 0.2))
  };
}

export function createEmployee(
  role: EmployeeRole,
  skillLevel: SkillLevel,
  hireDate: number,
  name?: string,
  skills?: EmployeeSkills,
  traits?: PersonalityTrait[]
): Employee {
  const config = EMPLOYEE_CONFIGS[role];
  const actualSkills = skills ?? generateRandomSkills(skillLevel);
  const hourlyWage = Math.round(config.baseWage * config.wageMultipliers[skillLevel] * 100) / 100;

  return {
    id: `emp_${++employeeIdCounter}`,
    name: name ?? generateRandomName(),
    role,
    skillLevel,
    skills: actualSkills,
    hireDate,
    hourlyWage,
    experience: 0,
    happiness: 75,
    fatigue: 0,
    status: "idle",
    assignedArea: null,
    traits: traits ?? generateTraits(),
  };
}

export function generateHiringPool(
  currentTime: number,
  count: number = HIRING_POOL_SIZE
): HiringPool {
  const candidates: Employee[] = [];
  const roles: EmployeeRole[] = [
    "groundskeeper", "groundskeeper", "mechanic",
    "pro_shop_staff", "caddy", "manager"
  ];

  const skillLevels: SkillLevel[] = ["novice", "novice", "novice", "trained", "experienced"];

  for (let i = 0; i < count; i++) {
    const role = roles[Math.floor(Math.random() * roles.length)];
    const skillLevel = skillLevels[Math.floor(Math.random() * skillLevels.length)];
    candidates.push(createEmployee(role, skillLevel, currentTime));
  }

  return {
    candidates,
    refreshTime: currentTime
  };
}

// ============================================================================
// Query Functions
// ============================================================================

export function getEmployee(roster: EmployeeRoster, employeeId: string): Employee | null {
  return roster.employees.find(e => e.id === employeeId) ?? null;
}

export function getEmployeesByRole(roster: EmployeeRoster, role: EmployeeRole): readonly Employee[] {
  return roster.employees.filter(e => e.role === role);
}

export function getEmployeesByStatus(roster: EmployeeRoster, status: EmployeeStatus): readonly Employee[] {
  return roster.employees.filter(e => e.status === status);
}

export function getWorkingEmployees(roster: EmployeeRoster): readonly Employee[] {
  return roster.employees.filter(e => e.status === "working");
}

export function getEmployeeCount(roster: EmployeeRoster): number {
  return roster.employees.length;
}

export function getEmployeeCountByRole(roster: EmployeeRoster, role: EmployeeRole): number {
  return roster.employees.filter(e => e.role === role).length;
}

export function canHire(roster: EmployeeRoster): boolean {
  return roster.employees.length < roster.maxEmployees;
}

export function getAvailableSlots(roster: EmployeeRoster): number {
  return roster.maxEmployees - roster.employees.length;
}

export function getTotalHourlyWages(roster: EmployeeRoster): number {
  return roster.employees.reduce((sum, e) => sum + e.hourlyWage, 0);
}

export function getAverageHappiness(roster: EmployeeRoster): number {
  if (roster.employees.length === 0) return 100;
  return roster.employees.reduce((sum, e) => sum + e.happiness, 0) / roster.employees.length;
}

export function getAverageEfficiency(roster: EmployeeRoster): number {
  if (roster.employees.length === 0) return 1;
  return roster.employees.reduce((sum, e) => sum + e.skills.efficiency, 0) / roster.employees.length;
}

export function getEmployeesNeedingBreak(roster: EmployeeRoster): readonly Employee[] {
  return roster.employees.filter(e => {
    const config = EMPLOYEE_CONFIGS[e.role];
    return e.fatigue >= config.breakThreshold && e.status === "working";
  });
}

export function calculateEffectiveEfficiency(employee: Employee, gameHour: number = 12): number {
  // Tiered happiness modifier (from design doc)
  const happinessModifier = getHappinessEfficiencyModifier(employee.happiness);

  // Fatigue modifier
  const fatigueModifier = 1 - (employee.fatigue / 100) * 0.3; // 0.7-1.0

  // Trait modifiers (efficiency and time-of-day effects)
  const traitModifier = getTraitEfficiencyModifier(employee.traits ?? [], gameHour);

  return employee.skills.efficiency * happinessModifier * fatigueModifier * traitModifier;
}

export function getNextSkillLevel(current: SkillLevel): SkillLevel | null {
  const index = SKILL_LEVELS_ORDER.indexOf(current);
  if (index === -1 || index >= SKILL_LEVELS_ORDER.length - 1) {
    return null;
  }
  return SKILL_LEVELS_ORDER[index + 1];
}

export function getExperienceForNextLevel(employee: Employee): number {
  const config = EMPLOYEE_CONFIGS[employee.role];
  const nextLevel = getNextSkillLevel(employee.skillLevel);
  if (!nextLevel) return 0;
  return config.experienceToLevel - employee.experience;
}

export function isEligibleForPromotion(employee: Employee): boolean {
  const config = EMPLOYEE_CONFIGS[employee.role];
  const nextLevel = getNextSkillLevel(employee.skillLevel);
  return nextLevel !== null && employee.experience >= config.experienceToLevel;
}

export function awardExperience(
  roster: EmployeeRoster,
  employeeId: string,
  amount: number
): EmployeeRoster {
  const employee = roster.employees.find(e => e.id === employeeId);
  if (!employee) return roster;

  const config = EMPLOYEE_CONFIGS[employee.role];
  let updated = {
    ...employee,
    experience: employee.experience + amount,
  };

  if (updated.experience >= config.experienceToLevel) {
    const nextLevel = getNextSkillLevel(updated.skillLevel);
    if (nextLevel) {
      updated = {
        ...updated,
        skillLevel: nextLevel,
        experience: updated.experience - config.experienceToLevel,
        hourlyWage: Math.round(config.baseWage * config.wageMultipliers[nextLevel] * 100) / 100,
        skills: {
          ...updated.skills,
          efficiency: Math.min(2.0, updated.skills.efficiency + 0.05),
          quality: Math.min(2.0, updated.skills.quality + 0.05),
        },
      };
    }
  }

  return {
    ...roster,
    employees: roster.employees.map(e => (e.id === employeeId ? updated : e)),
  };
}

export function getManagerBonus(roster: EmployeeRoster): number {
  const managers = getEmployeesByRole(roster, "manager");
  if (managers.length === 0) return 1.0;

  // Each working manager provides a bonus, diminishing returns
  const workingManagers = managers.filter(m => m.status === "working");
  if (workingManagers.length === 0) return 1.0;

  let totalBonus = 0;
  for (let i = 0; i < workingManagers.length; i++) {
    const manager = workingManagers[i];
    const managerEfficiency = calculateEffectiveEfficiency(manager);
    // First manager: full bonus, subsequent managers: diminishing
    const diminishingFactor = 1 / (i + 1);
    totalBonus += 0.1 * managerEfficiency * diminishingFactor;
  }

  return 1 + totalBonus;
}

// ============================================================================
// State Transformation Functions
// ============================================================================

export function hireEmployee(
  roster: EmployeeRoster,
  employee: Employee
): EmployeeRoster | null {
  if (!canHire(roster)) {
    return null;
  }

  const hiredEmployee = { ...employee, status: "working" as EmployeeStatus };

  return {
    ...roster,
    employees: [...roster.employees, hiredEmployee]
  };
}

export function fireEmployee(
  roster: EmployeeRoster,
  employeeId: string
): EmployeeRoster | null {
  const employee = getEmployee(roster, employeeId);
  if (!employee) {
    return null;
  }

  return {
    ...roster,
    employees: roster.employees.filter(e => e.id !== employeeId)
  };
}

export function updateEmployee(
  roster: EmployeeRoster,
  employeeId: string,
  updates: Partial<Omit<Employee, "id">>
): EmployeeRoster | null {
  const employee = getEmployee(roster, employeeId);
  if (!employee) {
    return null;
  }

  return {
    ...roster,
    employees: roster.employees.map(e =>
      e.id === employeeId ? { ...e, ...updates } : e
    )
  };
}

export function setEmployeeStatus(
  roster: EmployeeRoster,
  employeeId: string,
  status: EmployeeStatus
): EmployeeRoster | null {
  return updateEmployee(roster, employeeId, { status });
}

export function assignEmployeeToArea(
  roster: EmployeeRoster,
  employeeId: string,
  area: string | null
): EmployeeRoster | null {
  return updateEmployee(roster, employeeId, { assignedArea: area });
}

export function startEmployeeBreak(
  roster: EmployeeRoster,
  employeeId: string
): EmployeeRoster | null {
  return setEmployeeStatus(roster, employeeId, "on_break");
}

export function endEmployeeBreak(
  roster: EmployeeRoster,
  employeeId: string
): EmployeeRoster | null {
  const employee = getEmployee(roster, employeeId);
  if (!employee || employee.status !== "on_break") {
    return null;
  }

  return setEmployeeStatus(roster, employeeId, "working");
}

export interface EmployeeTickResult {
  readonly roster: EmployeeRoster;
  readonly promotions: readonly { employeeId: string; newLevel: SkillLevel }[];
  readonly breaksTaken: readonly string[];
}

export function tickEmployees(
  roster: EmployeeRoster,
  deltaMinutes: number,
  trainingBonus: number = 1.0
): EmployeeTickResult {
  const promotions: { employeeId: string; newLevel: SkillLevel }[] = [];
  const breaksTaken: string[] = [];

  const updatedEmployees = roster.employees.map(employee => {
    const config = EMPLOYEE_CONFIGS[employee.role];
    let updated = { ...employee };

    if (employee.status === "working") {
      // Training reduces fatigue (better techniques) and boosts experience gain
      const fatigueMultiplier = 1 / trainingBonus;
      const experienceMultiplier = trainingBonus;

      // Apply trait modifiers to fatigue and experience
      const traitFatigueModifier = getTraitFatigueModifier(employee.traits ?? []);
      const traitExperienceModifier = getTraitExperienceModifier(employee.traits ?? []);

      updated = {
        ...updated,
        fatigue: Math.min(100, updated.fatigue + config.fatigueAccrualRate * deltaMinutes * fatigueMultiplier * traitFatigueModifier),
        experience: updated.experience + deltaMinutes * updated.skills.efficiency * experienceMultiplier * traitExperienceModifier
      };

      // Check if needs break
      if (updated.fatigue >= config.breakThreshold) {
        updated = { ...updated, status: "on_break" as EmployeeStatus };
        breaksTaken.push(employee.id);
      }
    } else if (employee.status === "on_break") {
      // Recover fatigue
      updated = {
        ...updated,
        fatigue: Math.max(0, updated.fatigue - config.fatigueRecoveryRate * deltaMinutes)
      };

      // Return to work when recovered
      if (updated.fatigue <= 20) {
        updated = { ...updated, status: "working" as EmployeeStatus };
      }
    }

    // Check for promotion
    if (updated.experience >= config.experienceToLevel) {
      const nextLevel = getNextSkillLevel(updated.skillLevel);
      if (nextLevel) {
        updated = {
          ...updated,
          skillLevel: nextLevel,
          experience: updated.experience - config.experienceToLevel,
          // Update wage for new level
          hourlyWage: Math.round(config.baseWage * config.wageMultipliers[nextLevel] * 100) / 100,
          // Slight skill improvement on promotion
          skills: {
            ...updated.skills,
            efficiency: Math.min(2.0, updated.skills.efficiency + 0.05),
            quality: Math.min(2.0, updated.skills.quality + 0.05)
          }
        };
        promotions.push({ employeeId: employee.id, newLevel: nextLevel });
      }
    }

    return updated;
  });

  return {
    roster: { ...roster, employees: updatedEmployees },
    promotions,
    breaksTaken
  };
}

export function processPayroll(
  roster: EmployeeRoster,
  currentTime: number
): PayrollResult {
  const minutesSinceLastPayroll = currentTime - roster.lastPayrollTime;

  if (minutesSinceLastPayroll < PAYROLL_INTERVAL_MINUTES) {
    return {
      roster,
      totalPaid: 0,
      breakdown: []
    };
  }

  // Calculate hours worked (game hours)
  const hoursWorked = minutesSinceLastPayroll / 60;

  const breakdown: { employeeId: string; amount: number }[] = [];
  let totalPaid = 0;

  for (const employee of roster.employees) {
    // Only pay for time worked (not on break/idle)
    const workModifier = employee.status === "working" ? 1.0 : 0.5;
    const amount = Math.round(employee.hourlyWage * hoursWorked * workModifier * 100) / 100;
    breakdown.push({ employeeId: employee.id, amount });
    totalPaid += amount;
  }

  return {
    roster: {
      ...roster,
      lastPayrollTime: currentTime,
      totalWagesPaid: roster.totalWagesPaid + totalPaid
    },
    totalPaid,
    breakdown
  };
}

export function promoteEmployee(
  roster: EmployeeRoster,
  employeeId: string
): EmployeeRoster | null {
  const employee = getEmployee(roster, employeeId);
  if (!employee) return null;

  if (!isEligibleForPromotion(employee)) return null;

  const nextLevel = getNextSkillLevel(employee.skillLevel)!;

  const config = EMPLOYEE_CONFIGS[employee.role];
  const newWage = Math.round(config.baseWage * config.wageMultipliers[nextLevel] * 100) / 100;

  return updateEmployee(roster, employeeId, {
    skillLevel: nextLevel,
    experience: 0,
    hourlyWage: newWage,
    happiness: Math.min(100, employee.happiness + 10),
    skills: {
      ...employee.skills,
      efficiency: Math.min(2.0, employee.skills.efficiency + 0.05),
      quality: Math.min(2.0, employee.skills.quality + 0.05)
    }
  });
}

export function adjustHappiness(
  roster: EmployeeRoster,
  employeeId: string,
  delta: number
): EmployeeRoster | null {
  const employee = getEmployee(roster, employeeId);
  if (!employee) return null;

  const newHappiness = Math.max(0, Math.min(100, employee.happiness + delta));
  return updateEmployee(roster, employeeId, { happiness: newHappiness });
}

export function giveRaise(
  roster: EmployeeRoster,
  employeeId: string,
  percentIncrease: number
): EmployeeRoster | null {
  const employee = getEmployee(roster, employeeId);
  if (!employee) return null;

  const newWage = Math.round(employee.hourlyWage * (1 + percentIncrease / 100) * 100) / 100;
  return updateEmployee(roster, employeeId, {
    hourlyWage: newWage,
    happiness: Math.min(100, employee.happiness + 5)
  });
}

export function refreshHiringPool(
  pool: HiringPool,
  currentTime: number
): HiringPool {
  if (currentTime - pool.refreshTime < HIRING_POOL_REFRESH_INTERVAL) {
    return pool;
  }

  return generateHiringPool(currentTime, HIRING_POOL_SIZE);
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getRoleName(role: EmployeeRole): string {
  const names: Record<EmployeeRole, string> = {
    groundskeeper: "Groundskeeper",
    mechanic: "Mechanic",
    pro_shop_staff: "Pro Shop Staff",
    manager: "Manager",
    caddy: "Caddy"
  };
  return names[role];
}

export function getSkillLevelName(level: SkillLevel): string {
  const names: Record<SkillLevel, string> = {
    novice: "Novice",
    trained: "Trained",
    experienced: "Experienced",
    expert: "Expert"
  };
  return names[level];
}

export function formatWage(hourlyWage: number): string {
  return `$${hourlyWage.toFixed(2)}/hr`;
}

export function resetEmployeeCounter(): void {
  employeeIdCounter = 0;
}

// ============================================================================
// Prestige-Based Hiring Functions
// ============================================================================

let jobPostingIdCounter = 0;

export function createInitialApplicationState(currentTime: number = 0, prestigeTier: PrestigeTier = 'municipal'): ApplicationState {
  const config = PRESTIGE_HIRING_CONFIG[prestigeTier];
  return {
    applications: [],
    lastApplicationTime: currentTime,
    nextApplicationTime: currentTime + config.applicationRate * 60,
    activeJobPostings: [],
    totalApplicationsReceived: 0
  };
}

export function resetJobPostingCounter(): void {
  jobPostingIdCounter = 0;
}

function selectSkillLevelByPrestige(prestigeTier: PrestigeTier, targetSkillLevel?: SkillLevel): SkillLevel {
  const distribution = PRESTIGE_HIRING_CONFIG[prestigeTier].skillDistribution;

  // If there's a target skill level from a job posting, bias towards it
  if (targetSkillLevel) {
    const roll = Math.random() * 100;
    // 60% chance to match target skill level, 40% use normal distribution
    if (roll < 60) {
      return targetSkillLevel;
    }
  }

  // Weighted random selection
  const totalWeight = distribution.novice + distribution.trained + distribution.experienced + distribution.expert;
  const roll = Math.random() * totalWeight;

  let cumulative = 0;
  if ((cumulative += distribution.novice) >= roll) return 'novice';
  if ((cumulative += distribution.trained) >= roll) return 'trained';
  if ((cumulative += distribution.experienced) >= roll) return 'experienced';
  return 'expert';
}

function selectRoleForApplication(posting?: JobPosting): EmployeeRole {
  // Default weighted role distribution
  const roles: EmployeeRole[] = [
    'groundskeeper', 'groundskeeper', 'groundskeeper',  // Most common
    'mechanic',
    'pro_shop_staff', 'caddy',
    'manager'  // Least common
  ];

  // If there's a job posting, boost chance of that role
  if (posting) {
    const roll = Math.random() * 100;
    // 65% chance to match posted role, 35% use natural distribution
    if (roll < 65) {
      return posting.role;
    }
  }

  return roles[Math.floor(Math.random() * roles.length)];
}

export function generateApplication(
  currentTime: number,
  prestigeTier: PrestigeTier,
  targetPosting?: JobPosting
): Employee {
  const role = selectRoleForApplication(targetPosting);
  const skillLevel = selectSkillLevelByPrestige(prestigeTier, targetPosting?.targetSkillLevel);

  return createEmployee(role, skillLevel, currentTime);
}

export function tickApplications(
  state: ApplicationState,
  currentTime: number,
  prestigeTier: PrestigeTier
): ApplicationTickResult {
  const config = PRESTIGE_HIRING_CONFIG[prestigeTier];
  let newState = { ...state };
  let newApplicant: Employee | null = null;

  const expiredPostings = state.activeJobPostings.filter(p => p.expiresAt <= currentTime);
  newState = {
    ...newState,
    activeJobPostings: state.activeJobPostings.filter(p => p.expiresAt > currentTime)
  };

  if (currentTime >= state.nextApplicationTime && state.applications.length < config.maxApplications) {
    const activePosting = newState.activeJobPostings.length > 0
      ? newState.activeJobPostings[Math.floor(Math.random() * newState.activeJobPostings.length)]
      : undefined;

    newApplicant = generateApplication(currentTime, prestigeTier, activePosting);

    const hasActivePostings = newState.activeJobPostings.length > 0;
    const nextInterval = hasActivePostings
      ? Math.min(config.applicationRate, config.postingApplicationRate)
      : config.applicationRate;

    newState = {
      ...newState,
      applications: [...state.applications, newApplicant],
      lastApplicationTime: currentTime,
      nextApplicationTime: currentTime + nextInterval * 60,
      totalApplicationsReceived: state.totalApplicationsReceived + 1
    };
  }

  return { state: newState, newApplicant, expiredPostings };
}

export function postJobOpening(
  state: ApplicationState,
  currentTime: number,
  prestigeTier: PrestigeTier,
  role: EmployeeRole,
  targetSkillLevel?: SkillLevel
): { state: ApplicationState; posting: JobPosting } | null {
  const config = PRESTIGE_HIRING_CONFIG[prestigeTier];

  const posting: JobPosting = {
    id: `posting_${++jobPostingIdCounter}`,
    role,
    postedTime: currentTime,
    expiresAt: currentTime + config.postingDuration * 60,
    cost: config.postingCost,
    targetSkillLevel
  };

  const newState: ApplicationState = {
    ...state,
    activeJobPostings: [...state.activeJobPostings, posting],
    // Recalculate next application time with posting bonus
    nextApplicationTime: Math.min(
      state.nextApplicationTime,
      currentTime + config.postingApplicationRate * 60
    )
  };

  return { state: newState, posting };
}

export function acceptApplication(
  state: ApplicationState,
  applicationId: string
): ApplicationState | null {
  const application = state.applications.find(a => a.id === applicationId);
  if (!application) return null;

  return {
    ...state,
    applications: state.applications.filter(a => a.id !== applicationId)
  };
}

export function rejectApplication(
  state: ApplicationState,
  applicationId: string
): ApplicationState | null {
  const application = state.applications.find(a => a.id === applicationId);
  if (!application) return null;

  return {
    ...state,
    applications: state.applications.filter(a => a.id !== applicationId)
  };
}

export function getTimeUntilNextApplication(state: ApplicationState, currentTime: number): number {
  return Math.max(0, state.nextApplicationTime - currentTime);
}

export function getActivePostingsCount(state: ApplicationState): number {
  return state.activeJobPostings.length;
}

export function hasActivePosting(state: ApplicationState, role: EmployeeRole): boolean {
  return state.activeJobPostings.some(p => p.role === role);
}

export function getPostingCost(prestigeTier: PrestigeTier): number {
  return PRESTIGE_HIRING_CONFIG[prestigeTier].postingCost;
}
