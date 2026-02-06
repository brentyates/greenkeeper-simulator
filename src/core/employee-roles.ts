/**
 * Role-Specific Work System
 *
 * Each employee role produces tangible value beyond groundskeepers.
 * - Mechanics: repair equipment, fix irrigation leaks, repair robots
 * - Pro Shop Staff: generate merch revenue, speed check-in, handle complaints
 * - Caddies: boost golfer satisfaction, improve pace of play, earn tips
 * - Managers: multiply team efficiency, boost experience gain, reduce fatigue
 */

import type { Employee, EmployeeRoster, EmployeeRole } from './employees';
import { calculateEffectiveEfficiency } from './employees';

// ============================================================================
// Types
// ============================================================================

export interface MechanicWorkResult {
  /** Equipment repair actions performed */
  readonly equipmentRepairs: number;
  /** Irrigation leaks fixed */
  readonly leaksFixed: number;
  /** Robots repaired */
  readonly robotsRepaired: number;
  /** Money saved from preventive maintenance */
  readonly maintenanceSavings: number;
}

export interface ProShopResult {
  /** Merchandise revenue generated */
  readonly merchRevenue: number;
  /** Check-in speed multiplier (1.0 = normal, higher = faster) */
  readonly checkInSpeedMultiplier: number;
  /** Complaint mitigation: satisfaction penalty reduction */
  readonly complaintMitigation: number;
  /** Booking rate bonus */
  readonly bookingRateBonus: number;
}

export interface CaddyResult {
  /** Number of golfer groups served */
  readonly groupsServed: number;
  /** Total satisfaction bonus applied */
  readonly satisfactionBonus: number;
  /** Tip revenue generated */
  readonly tipRevenue: number;
  /** Pace of play improvement (percentage) */
  readonly paceImprovement: number;
  /** Prestige bonus from caddy service */
  readonly prestigeBonus: number;
}

export interface ManagerResult {
  /** Team efficiency multiplier */
  readonly efficiencyMultiplier: number;
  /** Experience gain multiplier */
  readonly experienceMultiplier: number;
  /** Fatigue reduction multiplier (lower = less fatigue) */
  readonly fatigueReduction: number;
  /** Happiness boost per employee */
  readonly happinessBoost: number;
  /** Sick day prevention multiplier */
  readonly sickDayPrevention: number;
}

export interface RoleWorkResults {
  readonly mechanic: MechanicWorkResult;
  readonly proShop: ProShopResult;
  readonly caddy: CaddyResult;
  readonly manager: ManagerResult;
}

// ============================================================================
// Constants
// ============================================================================

// Mechanic constants
const MECHANIC_EQUIPMENT_BREAKDOWN_REDUCTION = 0.33; // 33% reduction per mechanic

// Pro shop constants
const PRO_SHOP_BASE_MERCH_PER_GOLFER = 8;   // $8 base per golfer
const PRO_SHOP_PREMIUM_MERCH_BONUS = 5;      // Extra $5 for expert staff
const PRO_SHOP_BOOKING_RATE_BONUS = 0.05;    // 5% per staff member
const PRO_SHOP_COMPLAINT_MITIGATION = 0.6;   // 60% reduction in satisfaction penalty

// Caddy constants
const CADDY_SATISFACTION_BASE = 12;     // Base satisfaction boost
const CADDY_SATISFACTION_EXPERT = 20;   // Expert caddy boost
const CADDY_TIP_BASE = 8;              // Base tip per round
const CADDY_TIP_EXPERT = 25;           // Expert caddy tip
const CADDY_PACE_IMPROVEMENT = 0.10;   // 10% faster rounds
const CADDY_PRESTIGE_BONUS = 0.5;      // Per active caddy

// Manager constants (first manager / additional managers)
const MANAGER_EFFICIENCY_FIRST = 0.15;
const MANAGER_EFFICIENCY_ADDITIONAL = [0.08, 0.04, 0.02];
const MANAGER_EXPERIENCE_FIRST = 0.25;
const MANAGER_EXPERIENCE_ADDITIONAL = [0.12, 0.06];
const MANAGER_FATIGUE_FIRST = 0.15;
const MANAGER_FATIGUE_ADDITIONAL = [0.08, 0.04];
const MANAGER_HAPPINESS_FIRST = 8;
const MANAGER_HAPPINESS_ADDITIONAL = [4, 2];
const MANAGER_SICK_PREVENTION_FIRST = 0.30;
const MANAGER_SICK_PREVENTION_ADDITIONAL = [0.15, 0.08];

// ============================================================================
// Mechanic Work
// ============================================================================

/**
 * Calculate mechanic work effects.
 * Mechanics work passively — their presence reduces breakdown rates
 * and they automatically repair things that break.
 */
export function calculateMechanicWork(
  roster: EmployeeRoster,
  brokenEquipmentCount: number,
  leakingPipeCount: number,
  brokenRobotCount: number
): MechanicWorkResult {
  const mechanics = getWorkingEmployees(roster, 'mechanic');
  if (mechanics.length === 0) {
    return {
      equipmentRepairs: 0,
      leaksFixed: 0,
      robotsRepaired: 0,
      maintenanceSavings: 0,
    };
  }

  // Total mechanic capacity (each can handle ~2 repairs per day)
  let totalCapacity = 0;
  for (const mech of mechanics) {
    totalCapacity += 2 * calculateEffectiveEfficiency(mech);
  }

  let remaining = totalCapacity;
  let equipmentRepairs = 0;
  let robotsRepaired = 0;
  let leaksFixed = 0;

  // Priority: robots > equipment > leaks
  const robotRepairs = Math.min(brokenRobotCount, Math.floor(remaining));
  robotsRepaired = robotRepairs;
  remaining -= robotRepairs;

  const equipRepairs = Math.min(brokenEquipmentCount, Math.floor(remaining));
  equipmentRepairs = equipRepairs;
  remaining -= equipRepairs;

  const leakRepairs = Math.min(leakingPipeCount, Math.floor(remaining));
  leaksFixed = leakRepairs;

  // Preventive maintenance savings
  const avgEfficiency = mechanics.reduce(
    (sum, m) => sum + calculateEffectiveEfficiency(m), 0
  ) / mechanics.length;

  const maintenanceSavings = mechanics.length * avgEfficiency * 15; // ~$15/day per effective mechanic

  return {
    equipmentRepairs,
    leaksFixed,
    robotsRepaired,
    maintenanceSavings,
  };
}

/**
 * Get the equipment breakdown rate modifier based on mechanic presence.
 * Returns a multiplier < 1.0 (lower = fewer breakdowns).
 */
export function getMechanicBreakdownReduction(roster: EmployeeRoster): number {
  const mechanics = getWorkingEmployees(roster, 'mechanic');
  if (mechanics.length === 0) return 1.0;

  // Each mechanic reduces breakdown rate, diminishing returns
  let reduction = 1.0;
  for (let i = 0; i < mechanics.length; i++) {
    const factor = MECHANIC_EQUIPMENT_BREAKDOWN_REDUCTION / (i + 1);
    reduction *= (1 - factor);
  }

  return Math.max(0.2, reduction); // Floor at 80% reduction
}

/**
 * Without mechanics: 1.5x breakdown rate
 */
export function getNoMechanicBreakdownPenalty(roster: EmployeeRoster): number {
  const mechanics = getWorkingEmployees(roster, 'mechanic');
  if (mechanics.length === 0) return 1.5;
  return 1.0;
}

// ============================================================================
// Pro Shop Staff Work
// ============================================================================

/**
 * Calculate pro shop staff effects for the day.
 * Pro shop staff work passively at the clubhouse.
 */
export function calculateProShopWork(
  roster: EmployeeRoster,
  dailyGolferCount: number
): ProShopResult {
  const staff = getWorkingEmployees(roster, 'pro_shop_staff');

  if (staff.length === 0) {
    return {
      merchRevenue: 0,
      checkInSpeedMultiplier: 1.0,
      complaintMitigation: 0,
      bookingRateBonus: 0,
    };
  }

  // Merch revenue scales with staff count (diminishing returns)
  const staffMultipliers = [1.0, 1.5, 1.8, 2.0]; // 1, 2, 3, 4+ staff
  const staffMultiplier = staffMultipliers[Math.min(staff.length - 1, staffMultipliers.length - 1)];

  // Average skill affects per-golfer revenue
  const avgEfficiency = staff.reduce(
    (sum, s) => sum + calculateEffectiveEfficiency(s), 0
  ) / staff.length;

  const hasExpert = staff.some(s => s.skillLevel === 'expert');
  const basePerGolfer = PRO_SHOP_BASE_MERCH_PER_GOLFER + (hasExpert ? PRO_SHOP_PREMIUM_MERCH_BONUS : 0);
  const merchRevenue = Math.round(dailyGolferCount * basePerGolfer * staffMultiplier * avgEfficiency);

  // Check-in speed (more staff = faster processing)
  const checkInSpeedMultiplier = 1.0 + (staff.length * 0.25);

  // Complaint mitigation (pro shop staff smooth over bad experiences)
  const complaintMitigation = avgEfficiency >= 1.0
    ? PRO_SHOP_COMPLAINT_MITIGATION
    : PRO_SHOP_COMPLAINT_MITIGATION * 0.6; // Novice staff less effective

  // Booking rate bonus
  const bookingRateBonus = staff.length * PRO_SHOP_BOOKING_RATE_BONUS;

  return {
    merchRevenue,
    checkInSpeedMultiplier,
    complaintMitigation: Math.min(0.8, complaintMitigation),
    bookingRateBonus: Math.min(0.20, bookingRateBonus), // Cap at 20%
  };
}

// ============================================================================
// Caddy Work
// ============================================================================

/**
 * Calculate caddy effects for the day.
 * Each caddy serves one golfer group at a time.
 */
export function calculateCaddyWork(
  roster: EmployeeRoster,
  dailyGolferGroups: number,
  _avgGreenFee: number
): CaddyResult {
  const caddies = getWorkingEmployees(roster, 'caddy');

  if (caddies.length === 0) {
    return {
      groupsServed: 0,
      satisfactionBonus: 0,
      tipRevenue: 0,
      paceImprovement: 0,
      prestigeBonus: 0,
    };
  }

  // Each caddy can serve ~3-4 groups per day (assuming 4-hour rounds)
  const groupsPerCaddy = 3;
  const groupsServed = Math.min(
    dailyGolferGroups,
    caddies.length * groupsPerCaddy
  );

  // Calculate total satisfaction bonus
  let totalSatisfaction = 0;
  let totalTips = 0;
  let groupsAssigned = 0;

  for (const caddy of caddies) {
    const caddyGroups = Math.min(groupsPerCaddy, dailyGolferGroups - groupsAssigned);
    if (caddyGroups <= 0) break;

    const efficiency = calculateEffectiveEfficiency(caddy);
    const isExpert = caddy.skillLevel === 'expert' || caddy.skillLevel === 'experienced';

    const satBonus = isExpert ? CADDY_SATISFACTION_EXPERT : CADDY_SATISFACTION_BASE;
    const tipBase = isExpert ? CADDY_TIP_EXPERT : CADDY_TIP_BASE;

    totalSatisfaction += satBonus * efficiency * caddyGroups;
    totalTips += tipBase * efficiency * caddyGroups;
    groupsAssigned += caddyGroups;
  }

  // Pace improvement (caddies know the course, speed play)
  const paceImprovement = Math.min(
    0.25,
    (groupsServed / Math.max(1, dailyGolferGroups)) * CADDY_PACE_IMPROVEMENT
  );

  // Prestige bonus from having caddy service
  const prestigeBonus = caddies.length * CADDY_PRESTIGE_BONUS;

  return {
    groupsServed,
    satisfactionBonus: Math.round(totalSatisfaction),
    tipRevenue: Math.round(totalTips),
    paceImprovement,
    prestigeBonus: Math.min(5, prestigeBonus), // Cap at 5
  };
}

// ============================================================================
// Manager Work
// ============================================================================

/**
 * Calculate manager bonuses for the team.
 * Managers are force multipliers with diminishing returns.
 */
export function calculateManagerBonuses(roster: EmployeeRoster): ManagerResult {
  const managers = getWorkingEmployees(roster, 'manager');

  if (managers.length === 0) {
    return {
      efficiencyMultiplier: 1.0,
      experienceMultiplier: 1.0,
      fatigueReduction: 1.0,
      happinessBoost: 0,
      sickDayPrevention: 1.0,
    };
  }

  // Sort managers by effectiveness
  const sorted = [...managers].sort(
    (a, b) => calculateEffectiveEfficiency(b) - calculateEffectiveEfficiency(a)
  );

  let efficiencyBonus = 0;
  let experienceBonus = 0;
  let fatigueBonus = 0;
  let happinessBonus = 0;
  let sickPreventionBonus = 0;

  for (let i = 0; i < sorted.length; i++) {
    const managerEfficiency = calculateEffectiveEfficiency(sorted[i]);

    if (i === 0) {
      efficiencyBonus += MANAGER_EFFICIENCY_FIRST * managerEfficiency;
      experienceBonus += MANAGER_EXPERIENCE_FIRST * managerEfficiency;
      fatigueBonus += MANAGER_FATIGUE_FIRST * managerEfficiency;
      happinessBonus += MANAGER_HAPPINESS_FIRST * managerEfficiency;
      sickPreventionBonus += MANAGER_SICK_PREVENTION_FIRST * managerEfficiency;
    } else {
      const idx = Math.min(i - 1, MANAGER_EFFICIENCY_ADDITIONAL.length - 1);
      efficiencyBonus += (MANAGER_EFFICIENCY_ADDITIONAL[idx] ?? 0.01) * managerEfficiency;
      experienceBonus += (MANAGER_EXPERIENCE_ADDITIONAL[idx] ?? 0.03) * managerEfficiency;
      fatigueBonus += (MANAGER_FATIGUE_ADDITIONAL[idx] ?? 0.02) * managerEfficiency;
      happinessBonus += (MANAGER_HAPPINESS_ADDITIONAL[idx] ?? 1) * managerEfficiency;
      sickPreventionBonus += (MANAGER_SICK_PREVENTION_ADDITIONAL[idx] ?? 0.04) * managerEfficiency;
    }
  }

  return {
    efficiencyMultiplier: 1.0 + efficiencyBonus,
    experienceMultiplier: 1.0 + experienceBonus,
    fatigueReduction: Math.max(0.5, 1.0 - fatigueBonus), // Can't go below 50%
    happinessBoost: Math.round(happinessBonus * 10) / 10,
    sickDayPrevention: Math.max(0.3, 1.0 - sickPreventionBonus), // Can't go below 30%
  };
}

// ============================================================================
// Combined Role Work
// ============================================================================

/**
 * Calculate all role-specific work effects for the current tick.
 */
export function calculateAllRoleWork(
  roster: EmployeeRoster,
  context: {
    brokenEquipmentCount: number;
    leakingPipeCount: number;
    brokenRobotCount: number;
    dailyGolferCount: number;
    dailyGolferGroups: number;
    avgGreenFee: number;
  }
): RoleWorkResults {
  return {
    mechanic: calculateMechanicWork(
      roster,
      context.brokenEquipmentCount,
      context.leakingPipeCount,
      context.brokenRobotCount
    ),
    proShop: calculateProShopWork(roster, context.dailyGolferCount),
    caddy: calculateCaddyWork(roster, context.dailyGolferGroups, context.avgGreenFee),
    manager: calculateManagerBonuses(roster),
  };
}

// ============================================================================
// Helpers
// ============================================================================

function getWorkingEmployees(roster: EmployeeRoster, role: EmployeeRole): Employee[] {
  return roster.employees.filter(
    e => e.role === role && (e.status === 'working' || e.status === 'idle')
  ) as Employee[];
}
