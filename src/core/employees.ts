export type EmployeeRole =
  | "groundskeeper"
  | "mechanic";

export type SkillLevel = "novice" | "trained" | "experienced" | "expert";
export type EmployeeFocusPreference =
  | "balanced"
  | "mowing"
  | "watering"
  | "fertilizing"
  | "bunkers";

interface EmployeeRoleInfo {
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
  }
};

export type EmployeeStatus = "working" | "idle" | "on_break" | "training" | "withholding_work";

interface EmployeeSkills {
  readonly efficiency: number;
  readonly quality: number;
  readonly stamina: number;
  readonly reliability: number;
}

export interface Employee {
  readonly id: string;
  readonly name: string;
  readonly role: EmployeeRole;
  readonly skillLevel: SkillLevel;
  readonly skills: EmployeeSkills;
  readonly hireDate: number;
  readonly hourlyWage: number;
  readonly experience: number;
  readonly happiness: number;
  readonly fatigue: number;
  readonly status: EmployeeStatus;
  readonly assignedArea: string | null;
  readonly assignedFocus?: EmployeeFocusPreference;
}

interface EmployeeConfig {
  readonly baseWage: number;
  readonly wageMultipliers: Record<SkillLevel, number>;
  readonly baseEfficiency: number;
  readonly experienceToLevel: number;
  readonly breakThreshold: number;
  readonly fatigueRecoveryRate: number;
  readonly fatigueAccrualRate: number;
}

export interface EmployeeRoster {
  readonly employees: readonly Employee[];
  readonly maxEmployees: number;
  readonly lastPayrollTime: number;
  readonly totalWagesPaid: number;
}

interface PayrollResult {
  readonly roster: EmployeeRoster;
  readonly totalPaid: number;
  readonly breakdown: readonly { employeeId: string; amount: number }[];
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

interface ApplicationTickResult {
  readonly state: ApplicationState;
  readonly newApplicant: Employee | null;
  readonly expiredPostings: readonly JobPosting[];
}

export type PrestigeTier = 'municipal' | 'public' | 'semi_private' | 'private_club' | 'championship';

const EMPLOYEE_CONFIGS: Record<EmployeeRole, EmployeeConfig> = {
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
  }
};

const SKILL_LEVEL_BONUSES: Record<SkillLevel, number> = {
  novice: 0,
  trained: 0.15,
  experienced: 0.3,
  expert: 0.5
};

const SKILL_LEVELS_ORDER: readonly SkillLevel[] = [
  "novice",
  "trained",
  "experienced",
  "expert"
] as const;

const DEFAULT_MAX_EMPLOYEES = 20;
const PAYROLL_INTERVAL_MINUTES = 60;
const PAYROLL_SHIFT_HOURS = 8;

export const PRESTIGE_HIRING_CONFIG: Record<PrestigeTier, {
  applicationRate: number;
  maxApplications: number;
  skillDistribution: Record<SkillLevel, number>;
  postingCost: number;
  postingDuration: number;
  postingApplicationRate: number;
}> = {
  municipal: {
    applicationRate: 8,
    maxApplications: 2,
    skillDistribution: { novice: 85, trained: 13, experienced: 2, expert: 0 },
    postingCost: 500,
    postingDuration: 72,
    postingApplicationRate: 4
  },
  public: {
    applicationRate: 6,
    maxApplications: 3,
    skillDistribution: { novice: 60, trained: 28, experienced: 10, expert: 2 },
    postingCost: 350,
    postingDuration: 48,
    postingApplicationRate: 2
  },
  semi_private: {
    applicationRate: 4,
    maxApplications: 5,
    skillDistribution: { novice: 30, trained: 40, experienced: 23, expert: 7 },
    postingCost: 250,
    postingDuration: 36,
    postingApplicationRate: 1
  },
  private_club: {
    applicationRate: 2,
    maxApplications: 7,
    skillDistribution: { novice: 12, trained: 33, experienced: 38, expert: 17 },
    postingCost: 150,
    postingDuration: 24,
    postingApplicationRate: 0.5
  },
  championship: {
    applicationRate: 1,
    maxApplications: 10,
    skillDistribution: { novice: 3, trained: 17, experienced: 42, expert: 38 },
    postingCost: 100,
    postingDuration: 24,
    postingApplicationRate: 0.25
  }
};

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
  const lastIndex = Math.floor((getSeed() * 7919) % LAST_NAMES.length);
  return `${FIRST_NAMES[firstIndex]} ${LAST_NAMES[lastIndex]}`;
}

export function generateRandomSkills(
  skillLevel: SkillLevel,
  seed?: number
): EmployeeSkills {
  const getRandom = () => seed !== undefined ? (seed * 9301 + 49297) % 233280 / 233280 : Math.random();
  const bonus = SKILL_LEVEL_BONUSES[skillLevel];

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
  skills?: EmployeeSkills
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
    assignedFocus: "balanced",
  };
}

export function getEmployee(roster: EmployeeRoster, employeeId: string): Employee | null {
  return roster.employees.find(e => e.id === employeeId) ?? null;
}

function canHire(roster: EmployeeRoster): boolean {
  return roster.employees.length < roster.maxEmployees;
}

export function getAvailableSlots(roster: EmployeeRoster): number {
  return roster.maxEmployees - roster.employees.length;
}

export function calculateEffectiveEfficiency(employee: Employee): number {
  const happinessModifier = employee.happiness / 100;
  const fatigueModifier = 1 - (employee.fatigue / 100) * 0.3;
  return employee.skills.efficiency * happinessModifier * fatigueModifier;
}

function getNextSkillLevel(current: SkillLevel): SkillLevel | null {
  const index = SKILL_LEVELS_ORDER.indexOf(current);
  if (index === -1 || index >= SKILL_LEVELS_ORDER.length - 1) {
    return null;
  }
  return SKILL_LEVELS_ORDER[index + 1];
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

function updateEmployee(
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

export function assignEmployeeToArea(
  roster: EmployeeRoster,
  employeeId: string,
  area: string | null
): EmployeeRoster | null {
  return updateEmployee(roster, employeeId, { assignedArea: area });
}

export function assignEmployeeFocus(
  roster: EmployeeRoster,
  employeeId: string,
  focus: EmployeeFocusPreference
): EmployeeRoster | null {
  return updateEmployee(roster, employeeId, { assignedFocus: focus });
}

interface EmployeeTickResult {
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
      const fatigueMultiplier = 1 / trainingBonus;
      const experienceMultiplier = trainingBonus;

      updated = {
        ...updated,
        fatigue: Math.min(100, updated.fatigue + config.fatigueAccrualRate * deltaMinutes * fatigueMultiplier),
        experience: updated.experience + deltaMinutes * updated.skills.efficiency * experienceMultiplier
      };

      if (updated.fatigue >= config.breakThreshold) {
        updated = { ...updated, status: "on_break" as EmployeeStatus };
        breaksTaken.push(employee.id);
      }
    } else if (employee.status === "on_break") {
      updated = {
        ...updated,
        fatigue: Math.max(0, updated.fatigue - config.fatigueRecoveryRate * deltaMinutes)
      };

      if (updated.fatigue <= 20) {
        updated = { ...updated, status: "working" as EmployeeStatus };
      }
    }

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

  const hoursWorked = minutesSinceLastPayroll / 60;
  const payrollHours = hoursWorked / PAYROLL_SHIFT_HOURS;

  const breakdown: { employeeId: string; amount: number }[] = [];
  let totalPaid = 0;

  for (const employee of roster.employees) {
    const workModifier =
      employee.status === "working"
        ? 1.0
        : employee.status === "withholding_work"
        ? 0
        : 0.5;
    const amount = Math.round(employee.hourlyWage * payrollHours * workModifier * 100) / 100;
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

export function markEmployeesUnpaid(
  roster: EmployeeRoster
): EmployeeRoster {
  return {
    ...roster,
    employees: roster.employees.map((employee) => {
      if (employee.status === "training" || employee.status === "withholding_work") {
        return employee;
      }
      return {
        ...employee,
        status: "withholding_work" as EmployeeStatus,
        happiness: Math.max(0, employee.happiness - 15),
      };
    }),
  };
}

export function resumeEmployeesAfterPayroll(
  roster: EmployeeRoster
): EmployeeRoster {
  return {
    ...roster,
    employees: roster.employees.map((employee) =>
      employee.status === "withholding_work"
        ? {
            ...employee,
            status: "working" as EmployeeStatus,
            happiness: Math.min(100, employee.happiness + 5),
          }
        : employee
    ),
  };
}

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

function selectSkillLevelByPrestige(prestigeTier: PrestigeTier, targetSkillLevel?: SkillLevel): SkillLevel {
  const distribution = PRESTIGE_HIRING_CONFIG[prestigeTier].skillDistribution;

  if (targetSkillLevel) {
    const roll = Math.random() * 100;
    if (roll < 60) {
      return targetSkillLevel;
    }
  }

  const totalWeight = distribution.novice + distribution.trained + distribution.experienced + distribution.expert;
  const roll = Math.random() * totalWeight;

  let cumulative = 0;
  if ((cumulative += distribution.novice) >= roll) return 'novice';
  if ((cumulative += distribution.trained) >= roll) return 'trained';
  if ((cumulative += distribution.experienced) >= roll) return 'experienced';
  return 'expert';
}

function selectRoleForApplication(posting?: JobPosting): EmployeeRole {
  const roles: EmployeeRole[] = [
    'groundskeeper', 'groundskeeper', 'groundskeeper',
    'mechanic', 'mechanic',
  ];

  if (posting) {
    const roll = Math.random() * 100;
    if (roll < 65) {
      return posting.role;
    }
  }

  return roles[Math.floor(Math.random() * roles.length)];
}

function generateApplication(
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

export function hasActivePosting(state: ApplicationState, role: EmployeeRole): boolean {
  return state.activeJobPostings.some(p => p.role === role);
}

export function getPostingCost(prestigeTier: PrestigeTier): number {
  return PRESTIGE_HIRING_CONFIG[prestigeTier].postingCost;
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

export function resetEmployeeCounter(): void {
  employeeIdCounter = 0;
}

export function resetJobPostingCounter(): void {
  jobPostingIdCounter = 0;
}
