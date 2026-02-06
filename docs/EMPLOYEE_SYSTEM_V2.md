# Employee System V2 - Design Document

## Context

The game has reached a point where terrain and graphics are solid, and the major gameplay shift to area-based assignment (instead of grid-walking) makes the game feel more organic. Now the focus turns to what keeps players playing.

The thesis: **players will grind the economy and oversee employees while they focus on building their dream course.** The employee system is the economic engine that enables that. Like Sid Meier's SimGolf, the course design is the creative outlet, and the management layer gives it stakes and feedback loops.

This document covers:
1. Systems removed to reduce clutter
2. Employee system enhancements (implemented)
3. How the full progression arc from solo -> employees -> robots works
4. Features deferred for future implementation

---

## Part 1: Systems Removed

### Walk-On Queue System (REMOVED)

**Why:** Low-depth revenue filler that overlapped with tee-times. Own panel, own queue logic, own policy knobs -- but the player's only real decision was "on or off." Added cognitive overhead without creating meaningful strategy.

**What was done:** Removed entirely. Walk-on demand can be revisited later as a simple tee-time config toggle if needed.

**Files removed:** `walk-ons.ts`, `WalkOnQueuePanel.ts`, all BabylonMain/InputManager/save-game references.

---

### Marketing Campaign System (REMOVED)

**Why:** Nine campaign types that boiled down to "spend money, get more golfers." No risk, no long-term consequence, no way to overshoot. Short-circuited the organic demand loop where prestige and course quality should drive golfer arrivals.

**What was done:** Removed entirely. Demand is now driven purely by prestige score, green fee pricing, weather/seasonality, and word-of-mouth (reputation). The `marketingBonus` parameter was removed from tee-time demand calculations.

**Files removed:** `marketing.ts`, `marketing.test.ts`, `MarketingDashboard.ts`, all BabylonMain/UIManager/save-game references.

---

## Part 2: Employee System Enhancements (Implemented)

### 2.1 Happiness Consequences

**File:** `src/core/employee-happiness.ts`

Happiness now has teeth -- it directly affects work output, triggers sick days, and eventually causes quitting.

#### Efficiency Impact (IMPLEMENTED)

Happiness tiers replace the old linear modifier. Applied via `getHappinessEfficiencyModifier()` which feeds into `calculateEffectiveEfficiency()`.

| Happiness | Efficiency Modifier | Behavior |
|-----------|-------------------|----------|
| 90-100 | 1.10x | Motivated -- works faster |
| 70-89 | 1.00x | Content -- normal operation |
| 50-69 | 0.85x | Disgruntled -- slower output |
| 30-49 | 0.70x | Unhappy -- significantly impaired |
| 0-29 | 0.50x | Miserable -- barely functional |

#### Sick Days (IMPLEMENTED)

Daily sick chance checked per employee, modified by personality traits (Reliable trait = zero chance):

```
happiness >= 70: 1% (bad luck)
happiness 50-69: 5%
happiness 30-49: 12%
happiness < 30:  20%
```

When sick: employee doesn't work for 1 day. Notification shown to player.

#### Quitting (IMPLEMENTED)

Checked daily at end of shift. Three conditions:

```
1. Happiness below 30 for 7+ consecutive days: 25% daily quit chance
2. Happiness below 20 for 3+ consecutive days: 40% daily quit chance
3. Happiness drops below 10 at any point: 60% immediate quit chance
```

When quitting: employee is immediately removed from roster and work system. Notification shown.

#### State Tracking (IMPLEMENTED)

`HappinessConsequenceState` tracks per-employee:
- Consecutive unhappy days (for quit evaluation)
- Sick leave remaining days
- Days off granted (from event resolution)
- Last raise request day
- Daily task counts (reset daily)

Serialized/deserialized for save games via Maps -> Array entries.

---

### 2.2 Role-Specific Work

**File:** `src/core/employee-roles.ts`

Every role now produces tangible value. Non-groundskeeper roles use passive/calculation-based effects (no pathfinding). Mechanics are also field workers with pathfinding.

#### Mechanic Work (IMPLEMENTED -- abstract calculation model)

`calculateMechanicWork()` computes daily repair capacity based on mechanic count and efficiency:

- Each mechanic has ~2 repair actions per day (scaled by efficiency)
- Priority: robots > equipment > irrigation leaks
- Preventive maintenance savings: ~$15/day per effective mechanic
- `getMechanicBreakdownReduction()`: each mechanic reduces breakdown rate (diminishing returns, floor at 80% reduction)
- `getNoMechanicBreakdownPenalty()`: 1.5x breakdown rate without mechanics

**Field work:** Mechanics are included in `FIELD_WORK_ROLES` alongside groundskeepers. They use A* pathfinding and can rake bunkers and patrol when idle. Their main value comes from passive effects.

#### Pro Shop Staff (IMPLEMENTED)

`calculateProShopWork()` computes daily revenue and satisfaction effects:

- Merchandise revenue: $8-13 per golfer (base $8, +$5 with expert staff)
- Staff count scaling: 1x, 1.5x, 1.8x, 2.0x (diminishing returns)
- Check-in speed multiplier: 1.0 + (staff count * 0.25)
- Complaint mitigation: up to 60% reduction in satisfaction penalties
- Booking rate bonus: 5% per staff member (capped at 20%)

Revenue generated at end of day as `other_income` transaction.

#### Caddy Work (IMPLEMENTED -- abstract calculation model)

`calculateCaddyWork()` computes daily satisfaction and revenue effects:

- Each caddy serves ~3 groups per day
- Satisfaction bonus: +12 base, +20 for expert/experienced caddies (per group)
- Tip revenue: $8 base, $25 for expert caddies (per group)
- Pace improvement: up to 10% of groups served (capped at 25% total)
- Prestige bonus: +0.5 per active caddy (capped at 5)

Tips generated at end of day as `other_income` transaction.

#### Manager Work (IMPLEMENTED)

`calculateManagerBonuses()` computes team-wide multipliers with diminishing returns:

| Bonus | First Manager | Additional Managers |
|-------|--------------|-------------------|
| Employee efficiency | +15% | +8%, +4%, +2% (diminishing) |
| Experience gain rate | +25% | +12%, +6% (diminishing) |
| Fatigue reduction | -15% accrual rate | -8%, -4% (diminishing) |
| Happiness boost | +8 to all | +4, +2 (diminishing) |
| Sick day prevention | -30% chance | -15%, -8% (diminishing) |

Managers sorted by effectiveness (best manager gets full first-manager bonus).

---

### 2.3 Employee Events

**File:** `src/core/employee-events.ts`

Events are micro-stories that create moments of decision-making. They auto-resolve after expiry (1 day) with the last available option if the player ignores them.

#### Implemented Event Types

**Raise Request**
- Trigger: Every 30 days, employees with happiness < 60 may request a raise
- Options: Grant (15% raise, +15 happiness) / Deny (-10 happiness) / Promise later (-5 happiness)

**Personality Clash**
- Trigger: 5% daily chance when two employees in same role both have low happiness
- Requires: complainer trait on one employee, or both unhappy
- Options: Reassign (+5 each) / Talk to both (+3 each) / Ignore (-5 each)

**Exceptional Performance**
- Trigger: Employee completes 50+ tasks in a day
- Options: Give bonus ($100, +10 happiness) / Acknowledge (+5 happiness) / Ignore (no effect)

**Poaching Attempt**
- Trigger: 2% daily chance for expert or experienced employees
- Options: Match offer (15% raise, +15 happiness) / Counter offer (+10 happiness) / Let them go (employee quits)

**Personal Emergency**
- Trigger: 3% monthly chance per employee
- Options: Paid leave ($200, 3 days off, +20 happiness) / Unpaid leave (2 days off, +5 happiness) / Deny (-20 happiness)

**Weather Complaint**
- Trigger: 15% chance when weather is bad and employees are working
- Options: Provide gear ($300, +10 happiness) / Acknowledge (+3 happiness) / Ignore (-5 happiness)

#### Event Resolution Flow

Events are checked daily in `checkForEvents()`. Active events are stored in `EmployeeEventSystemState.activeEvents`. Each event has an `expiresDay` -- in BabylonMain, expired events are auto-resolved with the last option (typically "ignore" or "deny"). Resolution outcomes can include happiness changes, wage changes, costs, days off, and notifications.

---

### 2.4 Personality Traits

**File:** `src/core/employee-traits.ts`

Each employee gets 1-2 traits at hire time. Traits affect efficiency, fatigue, experience gain, sick chance, and event triggers.

#### Trait Table (IMPLEMENTED)

| Trait | Efficiency | Fatigue | Experience | Quality | Other |
|-------|-----------|---------|------------|---------|-------|
| Hard Worker | +15% | +20% faster | -- | -- | Positive |
| Reliable | -- | -- | -- | -- | Sick chance = 0 |
| Quick Learner | -- | -- | +30% | -- | Positive |
| Perfectionist | -10% speed | -- | -- | +20% | Mixed |
| Social | -- | -- | -- | -- | Mixed (contextual effects deferred) |
| Ambitious | -- | -- | +20% | -- | Raises 50% more often |
| Weather Tough | -- | -- | -- | -- | No weather happiness penalty |
| Night Owl | +15% after 2pm, -15% before 10am | -- | -- | -- | Mixed |
| Early Bird | +15% before 10am, -15% after 2pm | -- | -- | -- | Mixed |
| Loner | +10% | -- | -- | -- | Mixed (area-based effects deferred) |
| Clumsy | -- | -- | -- | -10% | Negative |
| Lazy | -15% | -20% (less fatigue) | -- | -- | Negative |
| Complainer | -- | -- | -- | -- | Triggers clashes more often |

#### Trait Generation

- 1-2 traits per employee (70% chance of 1, 30% chance of 2)
- Weighted by category: 30% positive, 45% mixed, 25% negative
- Incompatible pairs enforced: night_owl/early_bird, social/loner, hard_worker/lazy

#### Trait Visibility (IMPLEMENTED)

`getVisibleTraits()` controls what the player sees based on skill level and days employed:

- **Novice:** All traits hidden at hire. Reveal after 5 days on the job.
- **Trained/Experienced:** 1 trait visible at hire. Rest reveal after 3 days.
- **Expert:** All traits visible at hire.

This creates the hiring "gamble" -- a novice with decent stats might turn out to be a Hard Worker, or they might be Lazy.

---

### 2.5 Modified Core Systems

#### employees.ts Changes

- `Employee` interface: added optional `traits?: readonly PersonalityTrait[]` for backward compatibility
- `createEmployee()`: accepts optional traits parameter, generates random traits if not provided
- `calculateEffectiveEfficiency()`: now computes `skills.efficiency * happinessModifier * fatigueModifier * traitModifier` (tiered happiness, trait time-of-day effects)
- `tickEmployees()`: applies trait modifiers to fatigue accrual and experience gain

#### employee-work.ts Changes

- `FIELD_WORK_ROLES`: now includes both `groundskeeper` and `mechanic`
- `getTaskPriorityForRole()`: mechanics prioritize `rake_bunker` and `patrol`; groundskeepers do full task list
- `syncWorkersWithRoster()`: filters by `FIELD_WORK_ROLES` instead of groundskeeper-only

#### save-game.ts Changes

- `SaveGameState` interface: added optional `happinessState` and `eventState` fields
- `createSaveState()`: accepts and serializes happiness and event state
- Backward compatible: existing saves load without these fields (defaults used)

---

## Part 3: Progression Arc

```
PHASE 1: Solo Greenkeeper (Day 1-30)
+-- You do everything yourself
+-- Learn every job intimately
+-- Cash is tight, no room for hires
+-- The "I need help" moment: course degrades faster than you can maintain

PHASE 2: First Employees (Day 30-90)
+-- Hire 1-2 groundskeepers
+-- They're slow (novice) and need areas assigned
+-- Personality traits start revealing themselves
+-- The economic squeeze: wages eat profits, but coverage improves

PHASE 3: Team Building (Day 90-180)
+-- 3-5 employees, maybe a mechanic
+-- Employees gaining experience, some reaching "trained"
+-- Happiness management becomes relevant (first raise request)
+-- Employee events start happening
+-- First promotion: watching a novice become trained feels rewarding

PHASE 4: Mid-Game Management (Day 180-365)
+-- 5-8 employees, mixed roles
+-- Hire a manager (force multiplier kicks in)
+-- Pro shop staff generating passive revenue
+-- Poaching attempts on your best people
+-- Research pushing toward automation

PHASE 5: Automation Transition (Day 365+)
+-- Research unlocks first robots
+-- Robots supplement employees (not replace -- robots break down)
+-- Mechanics become critical (robot repair)
+-- Caddies for premium golfer experience
+-- Events are the main interaction with the employee system

PHASE 6: Endgame (Year 2+)
+-- Full robot fleet + expert staff + skilled mechanics
+-- Employee events are occasional, satisfying micro-decisions
+-- Your attention is on: course design, tournaments, prestige
```

### The Robot-Employee Dependency

Robots are NOT a replacement for employees. They're a complement that shifts the employee mix:

| Phase | Groundskeepers | Mechanics | Pro Shop | Caddies | Managers |
|-------|---------------|-----------|----------|---------|----------|
| Early | 2-3 | 0 | 0 | 0 | 0 |
| Mid | 4-6 | 1 | 1 | 0 | 1 |
| Late | 3-4 + robots | 2 (robot repair) | 1-2 | 1-2 | 1 |
| Endgame | 1-2 + full robots | 2-3 (critical) | 2 | 2-3 | 1 |

**Mechanics become MORE important as you automate, not less.**

---

## Part 4: Economic Balance Principles

### Each Role Must Create a Real Decision

| Role | Turns On When... | Monthly Cost | Monthly Value |
|------|-----------------|--------------|---------------|
| Groundskeeper | Course > 200 tiles (can't keep up solo) | $1,920-3,840 | Prevents $3,000+ in degradation |
| Mechanic | Own 3+ pieces of equipment OR robots | $2,880-6,400 | Saves $2,000+ in repairs, keeps robots running |
| Pro Shop Staff | 15+ golfers/day | $1,600-2,720 | Generates $2,000-4,000 in merch revenue |
| Caddy | 4-star prestige, premium pricing | $1,280-2,080 | +$1,500-3,000 in satisfaction-driven retention |
| Manager | 5+ other employees | $4,000-10,080 | 15% efficiency boost x team size |

### The Novice vs. Expert Dilemma

**Hire novice ($12/hr):**
- Cheap but slow (0.5x efficiency) and low quality (0.7x)
- Unknown personality traits -- might be great, might be terrible
- Investment: you're betting on their growth

**Hire experienced ($18/hr, rare in hiring pool):**
- Expensive but productive immediately (0.85x efficiency, 0.9x quality)
- 1 trait visible at hire time
- Less upside (already near peak)

---

## Part 5: Integration Points (Implemented)

### BabylonMain.ts Integration

All new systems are wired into the game loop:

- **Daily tick (10 PM):** Happiness consequences, employee events check, event auto-resolution, role-specific work calculations
- **Save/Load:** Happiness state and event state serialized/deserialized with backward compatibility
- **Revenue:** Pro shop merch and caddy tips applied as `other_income` transactions at end of day
- **Maintenance savings:** Mechanic savings applied as `other_income` at end of day
- **Event costs:** Resolution costs applied as `employee_wages` expenses

### Employee -> Prestige
- Pro shop staff: booking rate bonus
- Caddies: prestige bonus (up to +5)
- Groundskeeper quality: directly affects course conditions
- Manager presence: multiplies team efficiency -> better conditions

### Employee -> Economy
- Wages are the single largest expense category
- Pro shop staff generate merch revenue
- Caddies generate tip revenue
- Mechanics generate maintenance savings

---

## Part 6: Deferred Features (Future Work)

These features are described in the original design vision but not yet implemented. They should be added during the balance pass or as separate enhancements.

### Raise Request Market Rate Comparison
- Design: raise requests should check employee wage against prestige-tier market rate
- Current: only checks happiness threshold (< 60)
- Needed: compare current wage to `PRESTIGE_HIRING_CONFIG[tier].expectedWageMultiplier`

### Wage Pressure by Prestige Tier
- Design: as prestige grows, employee wage expectations increase (1.0x -> 1.5x)
- Current: not implemented
- Impact: would create natural economic pressure as course improves

### Training Milestone Event
- Design: event fires when employee reaches new skill level, with celebration option
- Current: promotions happen silently in `tickEmployees()`
- Needed: generate `training_milestone` event in `checkForEvents()`

### Manager Quality Checks
- Design: manager occasionally inspects work, redirects low-quality employees
- Current: manager bonuses are passive multipliers only
- Impact: would add active manager gameplay

### Manager Conflict Resolution
- Design: manager auto-boosts (+3 happiness) employees below 50 happiness every 8 hours
- Current: not implemented
- Impact: would make managers a direct counter to unhappiness spiral

### Caddy Assignment Logic
- Design: caddies assigned to specific golfer groups by priority (professional > casual)
- Current: abstract daily calculation (caddies serve ~3 groups/day)
- Impact: would connect caddy system to golfer type system

### Social Trait Contextual Effects
- Design: +5 happiness to nearby employees, -10% efficiency when working alone
- Current: trait exists but contextual effects not implemented
- Needed: requires area-based employee proximity detection

### Exceptional Performance Quality Check
- Design: requires 50+ tasks AND quality > 90%
- Current: only checks task count >= 50
- Impact: minor -- prevents low-quality workers from triggering the event

### Weather Complaint Duration Tracking
- Design: trigger after 2+ hours in bad weather, -5 happiness per hour
- Current: simple random chance (15%) when weather is bad
- Impact: would make weather a more nuanced management factor

### Raise Request Cooldown Enforcement
- Design: 60-day cooldown after grant, 15-day cooldown after "promise later"
- Current: `lastRaiseRequestDay` is tracked in state but not checked during event generation
- Fix: add cooldown check in raise request generation logic

---

## Implementation Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Remove walk-ons and marketing | DONE |
| Phase 2 | Happiness consequences | DONE |
| Phase 3 | Role-specific work | DONE |
| Phase 4 | Employee events | DONE |
| Phase 5 | Personality traits | DONE |
| Phase 6 | Balance pass + deferred features | PENDING |
