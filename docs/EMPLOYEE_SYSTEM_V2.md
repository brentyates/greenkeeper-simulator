# Employee System V2 - Design Document

## Design Philosophy

Employees exist to serve **course condition**. They are a scaling tool that lets the player maintain a pristine, satisfying-looking course as it grows beyond what one person can handle. The player should never feel like they're babysitting staff -- employees are hired, paid, assigned to areas, and they work.

**The interesting decisions are economic and strategic:**
- How many employees do I need at this course size?
- Which roles -- do I need a mechanic yet, or another groundskeeper?
- Can I afford their wages with current revenue?
- When do I invest in robots to supplement them?

Employees should feel like **RollerCoaster Tycoon's handymen**: hire them, pay them, assign them, and they work. If you underpay, they eventually quit. If you overpay, you lose money. The player's attention should be on the course, not on employee feelings.

---

## Part 1: Systems Removed

### Walk-On Queue System (REMOVED)

**Why:** Low-depth revenue filler that overlapped with tee-times. Own panel, own queue logic, own policy knobs -- but the player's only real decision was "on or off." Added cognitive overhead without creating meaningful strategy.

**What was done:** Removed entirely.

### Marketing Campaign System (REMOVED)

**Why:** Nine campaign types that boiled down to "spend money, get more golfers." Short-circuited the organic demand loop where prestige and course quality should drive golfer arrivals.

**What was done:** Removed entirely. Demand is now driven by prestige, pricing, weather, and reputation.

### Happiness Consequences System (REMOVED)

**Why:** Sick days, complex quitting thresholds, consecutive-unhappy-day tracking, and daily task counts turned the game into an HR simulator. Random sick days create staffing gaps that are annoying, not fun. The player shouldn't be managing employee feelings -- they should be managing their course.

**What was done:** Removed `employee-happiness.ts` entirely. Happiness still exists as a stat on employees (0-100), and `calculateEffectiveEfficiency()` uses a simple linear modifier from it, but there are no sick days, no tracked unhappy streaks, no daily consequence ticks.

### Employee Events System (REMOVED)

**Why:** Raise requests, personality clashes, poaching attempts, personal emergencies, and weather complaints are people-management gameplay. They pull attention away from course design and toward babysitting staff. This is a greenkeeper simulator, not an employee management game.

**What was done:** Removed `employee-events.ts` entirely. No event notifications, no player choices about staff drama, no auto-resolve timers.

### Personality Traits System (REMOVED)

**Why:** Traits existed primarily to feed the events system and add hiring RNG. Without events, traits are just noise that complicates the efficiency calculation without creating meaningful decisions. The player's hiring decision should be: role, skill level, wage. Not "does this person have the night_owl trait?"

**What was done:** Removed `employee-traits.ts` entirely. Removed `traits` field from Employee interface. `calculateEffectiveEfficiency()` uses only base skill and fatigue.

---

## Part 2: Visual Field Workers Only

**Design principle:** Everything must be visually represented or it shouldn't exist in the game.

The file `employee-roles.ts` was deleted because it contained passive role calculations for roles (pro shop staff, caddies, managers) that had no visual presence on the course. Only two roles remain: **groundskeeper** and **mechanic**. Both are visual field workers with 3D pathfinding, visible on the course at all times.

### Groundskeeper

- Mow, water, fertilize, rake bunkers, patrol
- A* pathfinding to assigned zones
- Direct visual impact: you can see them working and the course improving behind them

### Mechanic

- Each mechanic has ~2 repair actions per day (scaled by efficiency)
- Priority: robots > equipment > irrigation leaks
- Preventive maintenance savings: ~$15/day per effective mechanic
- `getMechanicBreakdownReduction()`: each mechanic reduces breakdown rate
- `getNoMechanicBreakdownPenalty()`: 1.5x breakdown rate without mechanics
- A* pathfinding -- rake bunkers and patrol when idle
- Direct visual impact: you can see them moving between equipment and robots on the course

---

## Part 3: Employee Work System (Kept)

**File:** `src/core/employee-work.ts`

### Field Workers

`FIELD_WORK_ROLES`: groundskeeper and mechanic use A* pathfinding.

- Groundskeepers: mow, water, fertilize, rake bunkers, patrol
- Mechanics: rake bunkers, patrol (main value is passive repair effects)

### Efficiency Calculation

`calculateEffectiveEfficiency()` in `employees.ts`:

```
efficiency = skills.efficiency * happinessModifier * fatigueModifier
```

Where:
- `happinessModifier = happiness / 100` (linear, 0.0 to 1.0)
- `fatigueModifier = 1 - (fatigue / 100) * 0.3` (0.7 to 1.0)

Simple and predictable. Underpaid employees get unhappy, work slower, and eventually quit. Rested employees work at full speed. No hidden modifiers or time-of-day effects.

### Quitting

If happiness drops to 0, the employee quits. This is the only consequence of neglecting employee happiness, and it's entirely avoidable by paying reasonable wages.

---

## Part 4: Progression Arc

```
PHASE 1: Solo Greenkeeper (Day 1-30)
+-- You do everything yourself
+-- Cash is tight, no room for hires
+-- The "I need help" moment: course degrades faster than you can maintain

PHASE 2: First Employees (Day 30-90)
+-- Hire 1-2 groundskeepers
+-- They're slow (novice) but cover ground you can't
+-- Economic squeeze: wages eat profits, but coverage improves

PHASE 3: Growing Team (Day 90-180)
+-- 3-5 employees, maybe a mechanic
+-- Employees gaining experience, reaching "trained"
+-- First promotion: novice becomes trained, works noticeably faster

PHASE 4: Full Staff (Day 180-365)
+-- 5-8 employees across groundskeepers and mechanics
+-- Employees reaching trained/experienced levels, working noticeably faster
+-- Experienced mechanics keeping equipment and robots running smoothly
+-- You focus on course design, not mowing

PHASE 5: Automation (Day 365+)
+-- Robots supplement employees
+-- Mechanics become critical (robot repair)
+-- Course mostly maintains itself
+-- Your attention is on design and prestige

PHASE 6: Endgame (Year 2+)
+-- Full robot fleet + expert staff
+-- The economic engine hums
+-- You step onto the course with a mower sometimes, just because
```

### The Robot-Employee Dependency

Robots are NOT a replacement for employees. They shift the employee mix:

| Phase | Groundskeepers | Mechanics |
|-------|---------------|-----------|
| Early | 2-3 | 0 |
| Mid | 4-6 | 1 |
| Late | 3-4 + robots | 2 (robot repair) |
| Endgame | 1-2 + full robots | 2-3 (critical) |

**Mechanics become MORE important as you automate, not less.**

---

## Part 5: Economic Balance

### Each Role Creates a Real Decision

| Role | Turns On When... | Monthly Cost | Monthly Value |
|------|-----------------|--------------|---------------|
| Groundskeeper | Course > 200 tiles | $1,920-3,840 | Prevents $3,000+ in degradation |
| Mechanic | 3+ equipment OR robots | $2,880-6,400 | Saves $2,000+ in repairs |

### Integration Points

- **Daily tick (10 PM):** Field worker effects applied (mowing/watering/fertilizing results, repair actions)
- **Maintenance:** Mechanic savings as `other_income` at end of day
- **Visual presence:** Both roles are visual field workers with A* pathfinding and direct, observable effects on the course
