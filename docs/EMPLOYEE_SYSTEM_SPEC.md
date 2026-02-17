# Employee System Design Specification

## Overview

The Employee System allows players to hire, manage, and develop staff to scale their course maintenance operations. Inspired by RollerCoaster Tycoon's handyman and mechanic system, employees work autonomously within assigned areas while the player retains the ability to direct or assist as needed.

### Core Philosophy

**"Employees are a scaling tool for course maintenance, not a people management minigame."**

Employees exist to serve **course condition**. They let the player maintain a pristine, satisfying-looking course as it grows beyond what one person can handle. The player should never feel like they're babysitting staff -- employees are hired, paid, assigned to areas, and they work. Like RollerCoaster Tycoon's handymen.

- Employees enable scaling beyond what the player can do alone
- Staff are always less efficient than the player character
- The interesting decisions are economic and strategic: how many, which roles, can I afford them
- The goal is a self-sustaining operation that frees you for course design

---

## Employee Roles

### Role Overview

| Role | Primary Function | Base Wage | Availability |
|------|------------------|-----------|--------------|
| Groundskeeper | Mowing, general maintenance | $12/hr | Start |
| Mechanic | Equipment repair, maintenance | $18/hr | 3 equipment |

### Role Details

#### Groundskeeper
The backbone of course maintenance.

```typescript
interface GroundskeeperCapabilities {
  canMow: true;
  canWater: true;      // Basic watering only
  canFertilize: true;
  canRakeBunkers: true;
  canRepairDivots: true;
}
```

**Work priorities (default):**
1. Mow overgrown grass (height > 60)
2. Water dry areas (moisture < 30)
3. Fertilize depleted areas (nutrients < 30)
4. General patrol of assigned area

#### Mechanic
Keeps equipment operational.

```typescript
interface MechanicCapabilities {
  canRepairEquipment: true;
  canPerformMaintenance: true;
  canUpgradeEquipment: true;  // With research
  canOperateShop: true;
}
```

**Work priorities:**
1. Repair broken equipment (critical)
2. Perform scheduled maintenance
3. Improve equipment efficiency
4. Maintain vehicle fleet

**Equipment breakdown:**
- Without mechanic: Equipment breaks more often, longer repair times
- With mechanic: Preventive maintenance, faster repairs, breakdown prevention

---

## Skill System

### Skill Levels

| Level | Name | Efficiency | Quality | Wage Multiplier |
|-------|------|------------|---------|-----------------|
| 1 | Novice | 0.5x | 0.7x | 1.0x |
| 2 | Trained | 0.7x | 0.8x | 1.25x |
| 3 | Experienced | 0.85x | 0.9x | 1.5x |
| 4 | Expert | 1.0x | 1.0x | 2.0x |

*Note: Player character operates at 1.5x efficiency, 1.2x quality*

### Skill Attributes

```typescript
interface EmployeeSkills {
  efficiency: number;    // 0.5-2.0, work speed multiplier
  quality: number;       // 0.5-2.0, work quality multiplier
  stamina: number;       // 0.5-2.0, fatigue resistance
}
```

**Efficiency**: How fast they complete tasks
**Quality**: How well they complete tasks (affects results)
**Stamina**: How long before needing a break

### Experience and Promotion

```typescript
interface ExperienceConfig {
  experiencePerMinuteWorking: number;  // ~1 point/minute
  experienceToNextLevel: Record<SkillLevel, number>;
}

const EXPERIENCE_REQUIREMENTS = {
  groundskeeper: 1000,  // Points to level up
  mechanic: 1500
};
```

**Promotion triggers:**
- Accumulate required experience
- Automatic skill improvement on promotion
- Wage increases with level
- Happiness boost from promotion

---

## Employee State

```typescript
interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
  skillLevel: SkillLevel;
  skills: EmployeeSkills;

  // Employment
  hireDate: number;
  hourlyWage: number;

  // Progression
  experience: number;

  // Current state
  happiness: number;      // 0-100
  fatigue: number;        // 0-100
  status: EmployeeStatus;

  // Assignment
  assignedArea: string | null;
}

type EmployeeStatus =
  | "working"
  | "idle"
  | "on_break";
```

---

## Hiring System

### Hiring Pool

A rotating pool of candidates available for hire:

```typescript
interface HiringPool {
  candidates: Employee[];
  refreshTime: number;     // Refreshes every 8 game hours
  poolSize: number;        // 5 candidates by default
}
```

**Pool composition:**
- Weighted toward groundskeepers (most needed)
- Skill levels weighted toward novice/trained
- Occasional experienced candidates (rare)
- Expert candidates very rare (or require recruiter upgrade)

### Hiring Process

```typescript
function hireEmployee(
  roster: EmployeeRoster,
  candidate: Employee
): Result {
  // Check capacity
  if (roster.employees.length >= roster.maxEmployees) {
    return { error: "At maximum employee capacity" };
  }

  // Check funds (first month advance)
  const monthlyCost = candidate.hourlyWage * 160; // 40hr/week
  if (!canAfford(economy, monthlyCost)) {
    return { error: "Cannot afford initial wages" };
  }

  // Add to roster
  return {
    roster: addEmployee(roster, candidate),
    economy: deductHiringCost(economy, monthlyCost)
  };
}
```

### Maximum Employees

Scales with course size and facilities:

| Facility/Size | Max Employees |
|---------------|---------------|
| Base | 5 |
| Per 500 tiles | +2 |
| Maintenance Shed | +3 |
| Staff Building | +5 |
| Training Center | +3 |

---

## Work Assignment

### Area Assignment

Employees can be assigned to specific course areas:

```typescript
interface AreaAssignment {
  employeeId: string;
  areaId: string;
  priority: 'low' | 'normal' | 'high';
  tasks: TaskType[];  // Which tasks to perform
}

type CourseArea =
  | "front_nine"
  | "back_nine"
  | "practice_facility"
  | "clubhouse_area"
  | "hole_1" | "hole_2" | ... | "hole_18"
  | "greens"      // All greens
  | "fairways"    // All fairways
  | "bunkers";    // All bunkers
```

### Task Prioritization

Within assigned area, employees prioritize:

```typescript
const DEFAULT_PRIORITIES: Record<TaskType, number> = {
  emergency_repair: 100,    // Equipment breakdown
  critical_health: 90,      // Health < 20
  overgrown: 70,           // Height > threshold
  dry: 60,                 // Moisture < 30
  low_nutrients: 50,       // Nutrients < 30
  maintenance: 40,         // Bunker raking, divot repair
  patrol: 10               // General walking/inspection
};
```

### Autonomous Behavior

```typescript
function tickEmployee(
  employee: Employee,
  courseState: CourseState,
  deltaMinutes: number
): EmployeeTickResult {
  if (employee.status !== "working") {
    return handleNonWorkingState(employee, deltaMinutes);
  }

  // Find highest priority task in assigned area
  const task = findHighestPriorityTask(
    employee.assignedArea,
    courseState,
    employee.role
  );

  if (!task) {
    // Patrol/idle in area
    return patrolArea(employee, deltaMinutes);
  }

  // Move toward task if not adjacent
  if (!isAdjacent(employee.position, task.position)) {
    return moveToward(employee, task.position, deltaMinutes);
  }

  // Perform task
  return performTask(employee, task, courseState, deltaMinutes);
}
```

---

## Fatigue and Breaks

### Fatigue Mechanics

```typescript
interface FatigueConfig {
  accrualRate: number;      // Per minute while working
  recoveryRate: number;     // Per minute on break
  breakThreshold: number;   // Fatigue level triggering break
  returnThreshold: number;  // Fatigue level to resume work
}

const FATIGUE_BY_ROLE: Record<EmployeeRole, FatigueConfig> = {
  groundskeeper: {
    accrualRate: 0.5,
    recoveryRate: 2.0,
    breakThreshold: 80,
    returnThreshold: 20
  },
  mechanic: {
    accrualRate: 0.4,
    recoveryRate: 1.5,
    breakThreshold: 75,
    returnThreshold: 20
  }
  // Only groundskeeper and mechanic roles exist
};
```

### Break Behavior

When fatigue reaches threshold:
1. Employee status changes to "on_break"
2. They move to nearest break area (or stay in place)
3. Fatigue recovers at recovery rate
4. Resume work when fatigue drops below return threshold

**Break areas:**
- Maintenance shed
- Staff room (if built)
- Clubhouse

### Fatigue Effects

Fatigue applies a simple linear penalty to efficiency:

```
fatigueModifier = 1 - (fatigue / 100) * 0.3
```

| Fatigue Level | Efficiency Modifier |
|---------------|-------------------|
| 0 | 1.0x (full efficiency) |
| 50 | 0.85x |
| 100 | 0.7x (minimum, seeks break) |

---

## Happiness System

Happiness is intentionally simple. It exists as a linear efficiency modifier, not as a people-management mechanic. The player's attention should be on the course, not on employee feelings.

### Happiness as Efficiency Modifier

```typescript
// Simple linear: happiness 100 = 1.0x, happiness 50 = 0.5x, happiness 0 = 0.0x
happinessModifier = employee.happiness / 100;
```

### Effective Efficiency

```typescript
function calculateEffectiveEfficiency(employee: Employee): number {
  const happinessModifier = employee.happiness / 100;
  const fatigueModifier = 1 - (employee.fatigue / 100) * 0.3;  // 0.7 to 1.0
  return employee.skills.efficiency * happinessModifier * fatigueModifier;
}
```

### What Affects Happiness

- **Wages vs. market rate**: Pay fairly and happiness stays high
- **Promotions**: Temporary happiness boost on level-up

There are no sick days, no unhappy day tracking, no complex consequence systems.

### Quitting

If happiness drops to 0, the employee quits. This is the only consequence of neglecting employee happiness, and it's entirely avoidable by paying reasonable wages.

---

## Payroll System

### Wage Structure

```typescript
interface WageCalculation {
  baseWage: number;           // From role config
  skillMultiplier: number;    // From skill level
  overtimeRate: number;       // 1.5x for hours over 40/week
}

function calculateHourlyWage(
  role: EmployeeRole,
  skillLevel: SkillLevel
): number {
  const base = EMPLOYEE_CONFIGS[role].baseWage;
  const multiplier = EMPLOYEE_CONFIGS[role].wageMultipliers[skillLevel];
  return Math.round(base * multiplier * 100) / 100;
}
```

### Example Wages

| Role | Novice | Trained | Experienced | Expert |
|------|--------|---------|-------------|--------|
| Groundskeeper | $12/hr | $15/hr | $18/hr | $24/hr |
| Mechanic | $18/hr | $23/hr | $29/hr | $40/hr |

### Payroll Processing

```typescript
function processPayroll(
  roster: EmployeeRoster,
  currentTime: number
): PayrollResult {
  const hoursSinceLastPayroll = (currentTime - roster.lastPayrollTime) / 60;

  let totalPaid = 0;
  const breakdown: PayrollBreakdown[] = [];

  for (const employee of roster.employees) {
    // Reduced pay for non-working status
    const workModifier = employee.status === "working" ? 1.0 : 0.5;
    const amount = employee.hourlyWage * hoursSinceLastPayroll * workModifier;

    breakdown.push({ employeeId: employee.id, amount });
    totalPaid += amount;
  }

  return {
    totalPaid,
    breakdown,
    newLastPayrollTime: currentTime
  };
}
```

---

## Training System

### Training Mechanics

Employees gain experience while working:

```typescript
function gainExperience(
  employee: Employee,
  deltaMinutes: number
): Employee {
  if (employee.status !== "working") {
    return employee;
  }

  const baseRate = 1; // Experience per minute
  const efficiencyBonus = employee.skills.efficiency;

  const experience = baseRate * efficiencyBonus * deltaMinutes;

  return {
    ...employee,
    experience: employee.experience + experience
  };
}
```

### Promotion

```typescript
function checkPromotion(employee: Employee): Employee | null {
  const config = EMPLOYEE_CONFIGS[employee.role];
  const nextLevel = getNextSkillLevel(employee.skillLevel);

  if (!nextLevel) return null; // Already expert

  if (employee.experience >= config.experienceToLevel) {
    return {
      ...employee,
      skillLevel: nextLevel,
      experience: 0, // Reset for next level
      hourlyWage: calculateHourlyWage(employee.role, nextLevel),
      happiness: Math.min(100, employee.happiness + 10),
      skills: improveSkills(employee.skills)
    };
  }

  return null;
}
```

---

## Integration with Player Character

### Player vs Employee Comparison

| Attribute | Player | Novice | Expert |
|-----------|--------|--------|--------|
| Move Speed | 1.5x | 0.7x | 1.0x |
| Work Speed | 1.5x | 0.5x | 1.0x |
| Quality | 1.2x | 0.7x | 1.0x |
| Stamina | Unlimited | Fatigue | Fatigue |
| Availability | When playing | 8hr shifts | 8hr shifts |

### When Player Works

The player can always perform any task:
- Immediately effective (no travel time in menus)
- Higher quality than employees
- Faster completion
- No wages

**Tradeoff:**
- Can only be one place at a time
- Time spent working isn't spent managing
- Employees work in parallel

### Delegation Philosophy

```
Early game:  Player does 80%, Employees do 20%
Mid game:    Player does 40%, Employees do 60%
Late game:   Player does 10%, Employees do 90%
End game:    Player does 5%, Employees do 95%
```

The player progressively shifts from worker to manager to director.

---

## UI Elements

### Employee Roster Panel

```
┌─────────────────────────────────────────────────────────────────────────┐
│  EMPLOYEES (7/12)                                           [$42.50/hr] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  GROUNDSKEEPERS (4)                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  👷 James Smith      Trained    $15/hr   Front Nine   Working   │   │
│  │     ████████░░ 80% happy   ██████░░░░ 60% fatigue               │   │
│  │                                                                   │   │
│  │  👷 Mary Johnson     Novice     $12/hr   Back Nine    Working   │   │
│  │     ██████░░░░ 60% happy   ████████░░ 80% fatigue  ⚠ Break     │   │
│  │                                                                   │   │
│  │  👷 Robert Williams  Expert     $24/hr   Greens       Working   │   │
│  │     ██████████ 95% happy   ████░░░░░░ 40% fatigue               │   │
│  │                                                                   │   │
│  │  👷 Patricia Brown   Trained    $15/hr   Unassigned   Idle      │   │
│  │     ████████░░ 75% happy   ░░░░░░░░░░ 0% fatigue                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  MECHANICS (1)                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🔧 David Miller     Experienced $29/hr  Workshop     Working   │   │
│  │     ████████░░ 82% happy   ██████░░░░ 55% fatigue               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  [Hire New Employee]  [View Hiring Pool]                                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Hiring Panel

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HIRING POOL                                    Refreshes in: 4:32:15   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  👷 Jennifer Davis                                               │   │
│  │  Role: Groundskeeper          Skill: Novice                     │   │
│  │  Wage: $12/hr                 Monthly: ~$1,920                  │   │
│  │                                                                   │   │
│  │  Efficiency: ██░░░  0.55      Quality: ██░░░  0.68              │   │
│  │  Stamina:    ███░░  0.71      Reliability: ████░  0.85          │   │
│  │                                                                   │   │
│  │  [Hire - $1,920 advance]                                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🔧 Michael Lee                                                  │   │
│  │  Role: Mechanic               Skill: Trained                    │   │
│  │  Wage: $23/hr                 Monthly: ~$3,680                  │   │
│  │                                                                   │   │
│  │  Efficiency: ███░░  0.75      Quality: ████░  0.82              │   │
│  │  Stamina:    ██░░░  0.60      Reliability: ████░  0.90          │   │
│  │                                                                   │   │
│  │  [Hire - $3,680 advance]                                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Visual Representation

### Employee 3D Models

All employees are visible on the golf course while working. This creates a living, dynamic course environment. Employees are rendered as 3D meshes loaded via AssetLoader.

```typescript
interface EmployeeVisualState {
  gridX: number;
  gridY: number;
  facingAngle: number;  // Radians, continuous rotation
  isAnimating: boolean;
  equipmentVisible: boolean;
}
```

### 3D Model Requirements by Role

| Role | Model Asset | Equipment Attached |
|------|-------------|-------------------|
| Groundskeeper | character.employee | Push mower, rake, spreader meshes |
| Mechanic | character.employee | Toolbox mesh |

### Visual Behavior

**Groundskeeper on duty:**
1. Walks to assigned area
2. Scans for work (grass height, moisture, etc.)
3. Performs visible task (mowing animation, particles fly)
4. Moves to next task
5. Takes breaks at break areas

**Visual indicators:**
- Speech bubbles for alerts (tired, needs supplies)
- Work trail showing recently maintained areas
- Equipment glow when actively working
- Fatigue shown through slower movement

---

## Autonomous Work Behavior

Employees work independently based on their role and assigned area.

### Work Priority System

```typescript
interface WorkTask {
  type: EmployeeTask;
  gridX: number;
  gridY: number;
  priority: number;
  estimatedMinutes: number;
}

type EmployeeTask =
  | 'mow_grass'
  | 'water_dry_area'
  | 'fertilize_depleted'
  | 'rake_bunker'
  | 'repair_divot'
  | 'equipment_maintenance'
  | 'patrol'
  | 'return_to_base';

function findNextTask(
  employee: Employee,
  cells: CellState[][],
  assignedArea: Area | null
): WorkTask | null {
  const priorities = getRolePriorities(employee.role);

  for (const taskType of priorities) {
    const target = findNearestNeedyTile(
      employee.gridX,
      employee.gridY,
      taskType,
      cells,
      assignedArea
    );
    if (target) {
      return {
        type: taskType,
        gridX: target.x,
        gridY: target.y,
        priority: getTaskPriority(taskType, target),
        estimatedMinutes: getTaskDuration(taskType, employee)
      };
    }
  }

  return { type: 'patrol', ...patrolNextTile(employee, assignedArea) };
}
```

### Groundskeeper Work Priorities

Default priority order (configurable):

1. **Critical overgrowth** (grass height > 80)
2. **Standard mowing** (grass height > 60)
3. **Water critical** (moisture < 20)
4. **Standard watering** (moisture < 40)
5. **Fertilize depleted** (nutrients < 30)
6. **Rake bunkers** (if bunker maintenance enabled)
7. **Patrol assigned area**

### Movement and Pathfinding

```typescript
interface EmployeeMovement {
  currentPath: GridCoord[];
  moveSpeed: number; // tiles per minute
  isMoving: boolean;
  blockedRetryCount: number;
}

const EMPLOYEE_MOVE_SPEEDS: Record<EmployeeRole, number> = {
  groundskeeper: 3.0,  // 3 tiles per minute
  mechanic: 2.0
};
```

### Work Execution

```typescript
interface WorkExecution {
  employee: Employee;
  task: WorkTask;
  progress: number;  // 0-100
  effectsApplied: boolean;
}

function executeWork(
  execution: WorkExecution,
  deltaMinutes: number
): { execution: WorkExecution; effects: CellEffect[] } {
  const efficiency = calculateEffectiveEfficiency(execution.employee);
  const taskDuration = getTaskDuration(execution.task.type, execution.employee);
  const progressPerMinute = 100 / taskDuration;

  const newProgress = execution.progress + (progressPerMinute * deltaMinutes * efficiency);

  if (newProgress >= 100 && !execution.effectsApplied) {
    return {
      execution: { ...execution, progress: 100, effectsApplied: true },
      effects: getTaskEffects(execution.task)
    };
  }

  return {
    execution: { ...execution, progress: Math.min(100, newProgress) },
    effects: []
  };
}
```

### Area Assignment

Employees can be assigned to specific zones:

```typescript
interface CourseArea {
  id: string;
  name: string;
  tiles: GridCoord[];
  assignedEmployees: string[];
}

// Example areas:
// - Front 9 Fairways
// - Back 9 Fairways
// - All Greens
// - Bunkers
// - Practice Area
```

### Efficiency Comparison

| Task | Player Time | Novice Employee | Expert Employee |
|------|------------|-----------------|-----------------|
| Mow 1 tile | 2 sec | 6 sec | 3 sec |
| Water 1 tile | 1 sec | 3 sec | 1.5 sec |
| Fertilize 1 tile | 1 sec | 4 sec | 2 sec |
| Rake bunker | 5 sec | 15 sec | 8 sec |

---

## Implementation Priority

### Phase 1: Core Hiring ✅
1. Employee data structure
2. Hiring pool generation
3. Basic hire/fire functionality
4. Wage deduction

### Phase 2: Work Behavior
1. Area assignment
2. Task prioritization
3. Autonomous movement
4. Work action execution

### Phase 2.5: Visual Representation
1. Employee 3D mesh loading via AssetLoader
2. Movement and rotation interpolation
3. Position sync with work state
4. Equipment mesh attachment

### Phase 3: State Management
1. Fatigue system
2. Break behavior
3. Happiness tracking
4. Shift schedules

### Phase 4: Progression
1. Experience accumulation
2. Promotion system
3. Skill improvement
4. Training facility

### Phase 5: Advanced Features
1. Additional visual roles when needed
2. Robot-employee dependency (mechanics repair robots)

---

## Summary

The Employee System enables the core gameplay progression:

1. **Solo Start**: Player does everything, learns every job
2. **First Hires**: Multiply capability, accept lower efficiency
3. **Team Building**: Hire groundskeepers and mechanics, optimize coverage
4. **Automation**: Robots supplement employees, mechanics become critical
5. **Delegation**: Systems run themselves, player focuses on course design

Key design principles:
- Employees are a scaling tool for course maintenance, not a people management minigame
- Player is always more efficient (per task)
- Employees enable parallel operations
- The interesting decisions are economic (how many, which roles, can I afford them)
- No events, no traits, no sick days -- hire, pay, assign, they work
