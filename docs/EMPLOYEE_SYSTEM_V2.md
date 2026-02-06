# Employee System V2 - Design Document

## Context

The game has reached a point where terrain and graphics are solid, and the major gameplay shift to area-based assignment (instead of grid-walking) makes the game feel more organic. Now the focus turns to what keeps players playing.

The thesis: **players will grind the economy and oversee employees while they focus on building their dream course.** The employee system is the economic engine that enables that. Like Sid Meier's SimGolf, the course design is the creative outlet, and the management layer gives it stakes and feedback loops.

This document covers three things:
1. Systems being removed to reduce clutter
2. The employee system enhancements that make the mid-game compelling
3. How the full progression arc from solo → employees → robots works

---

## Part 1: Systems Removal

### Remove: Walk-On Queue System

**Why:** The walk-on system is a low-depth revenue filler that overlaps with tee-times. It has its own panel, its own queue logic, and its own policy knobs — but the player's only real decision is "on or off." The golfer attributes (priceFlexibility, desiredGroupSize) aren't even used in the assignment logic. The whole thing adds cognitive overhead without creating meaningful strategy.

**What to do:** Fold walk-on policy into the tee-time system as a simple configuration:

```typescript
interface TeeTimeConfig {
  // ... existing spacing, pricing, etc.

  // Walk-on policy (replaces entire walk-on system)
  allowWalkOns: boolean;
  walkOnPremium: number;    // 1.0 = same price, 1.15 = 15% surcharge
  walkOnSlotsPerDay: number; // Max slots reserved for walk-ons
}
```

Walk-ons become a tee-time setting, not a separate system. No dedicated panel. No queue management. Just: "Do you leave room for walk-ins, and what do you charge them?"

**Files to remove:**
- `src/core/walk-ons.ts`
- `src/babylon/ui/WalkOnQueuePanel.ts`
- Walk-on related state from save game
- Walk-on references in BabylonMain.ts
- The `U` keybinding (or reassign it)

**Files to modify:**
- `src/core/tee-times.ts` — add walk-on fields to TeeTimeConfig
- `src/babylon/BabylonMain.ts` — remove walk-on tick, remove walk-on panel
- `src/babylon/ui/TeeSheetPanel.ts` — add walk-on toggle to tee-time settings

---

### Remove: Marketing Campaign System

**Why:** Marketing is nine campaign types that boil down to "spend money, get more golfers." There's no risk, no long-term consequence, no way to overshoot. It short-circuits the organic demand loop where prestige and course quality should be what drives golfers to show up. If your course is great, word spreads. If it's mediocre, newspaper ads shouldn't save you.

**What to do:** Remove the campaign system entirely. Demand is driven by:
- **Prestige score** (the composite of conditions, history, amenities, reputation)
- **Green fee pricing** (price elasticity already exists)
- **Weather and seasonality** (already exists in tee-time demand calculation)
- **Word-of-mouth** (reputation component of prestige, driven by golfer satisfaction)

The prestige system already models everything marketing was trying to do, but through earned gameplay rather than a spending lever. If demand generation needs more dynamic range without marketing multipliers, that tuning can happen within the prestige → demand curve.

The `marketingBonus` parameter in `calculateDailyDemand()` (tee-times.ts) simply gets removed or defaulted to 0. All other demand multipliers (day of week, time of day, season, weather, prestige, pricing) remain.

**Files to remove:**
- `src/core/marketing.ts`
- `src/core/marketing.test.ts`
- `src/babylon/ui/MarketingDashboard.ts`
- Marketing state from save game

**Files to modify:**
- `src/core/tee-times.ts` — remove marketingMultiplier from demand calculation
- `src/babylon/BabylonMain.ts` — remove marketing tick, remove marketing panel, remove `K` keybinding
- `src/core/economy.ts` — remove "marketing" expense category (or leave as unused)
- `docs/ECONOMY_SYSTEM_SPEC.md` — remove marketing references from utilization notes

---

## Part 2: Employee System Enhancements

The employee system's core hiring/firing/payroll/groundskeeper-work loop is solid. What's missing is the depth that makes managing employees feel like a *game* rather than a checkbox. These enhancements turn employees from "hire and forget" into an engaging mid-game that demands periodic attention without overwhelming the player.

### 2.1 Happiness Consequences

**Current state:** Happiness is tracked (0-100) with factors like wages, workload, facilities, weather. But nothing actually happens when happiness drops. Employees never quit, never call in sick, never slow down meaningfully.

**The fix:** Happiness needs teeth.

#### Efficiency Impact

Happiness directly affects work output. This is the gentle, continuous consequence — you always want your team reasonably happy.

| Happiness | Efficiency Modifier | Behavior |
|-----------|-------------------|----------|
| 90-100 | 1.10x | Motivated — works faster, rarely takes breaks |
| 70-89 | 1.00x | Content — normal operation |
| 50-69 | 0.85x | Disgruntled — slower, more break time |
| 30-49 | 0.70x | Unhappy — frequent breaks, sloppy work |
| 0-29 | 0.50x | Miserable — barely functional, actively looking to quit |

#### Sick Days

Unhappy employees call in sick. Happy ones rarely do.

```
Daily sick chance:
  happiness >= 70: 1% (bad luck)
  happiness 50-69: 5%
  happiness 30-49: 12%
  happiness < 30:  20%
```

When an employee calls in sick:
- They don't work that day (still paid at 50% rate per existing payroll logic)
- Their area goes unattended unless another employee covers
- A notification appears: "James called in sick today"
- The player feels the gap — that section of the course suffers

This is the kind of small fire that creates management engagement without being overwhelming. You see the notification, you think "I should give James a raise" or "I need a second groundskeeper covering that area."

#### Quitting

The big consequence. An employee who stays unhappy long enough will quit.

```
Quit evaluation: checked once per game day at end of shift

Quit conditions:
  1. Happiness below 30 for 7+ consecutive days: 25% daily quit chance
  2. Happiness below 20 for 3+ consecutive days: 40% daily quit chance
  3. Single event: happiness drops below 10 at any point: 60% immediate quit chance

When quitting:
  - Employee gives 1-day notice (still works that day)
  - Notification: "Mary has resigned. Her last day is tomorrow."
  - All experience and skill investment is lost
  - Hiring pool may not have a replacement at the same skill level
  - The area they covered starts degrading
```

The key design intent: **losing an expert employee should sting.** You spent game-months training them from novice to expert. Their wage went up, but so did their output. If you let their happiness slide and they quit, you're back to hiring a novice and starting over. This creates a genuine incentive to manage your people.

#### Raise Requests

Employees periodically request raises. This is the soft version of quitting — a warning sign you can act on.

```
Raise request triggers:
  - Every 30 game days, each employee evaluates their satisfaction
  - If happiness < 60 AND wage is at or below market rate: request raise
  - If happiness < 40: request raise regardless of current wage
  - After promotion: no raise request for 30 days (promotion satisfaction)

Raise request options:
  1. Grant raise (+10-15% wage, +15 happiness, request cooldown 60 days)
  2. Deny raise (-10 happiness, may trigger quit evaluation sooner)
  3. Promise raise later (no immediate cost, -5 happiness, 15-day timer before re-request)
```

These create micro-decisions. You see "Robert is requesting a raise" and you weigh: he's my only expert groundskeeper, I can't afford to lose him, but I'm tight on cash this month. Grant it? Promise it? Take the risk?

---

### 2.2 Role-Specific Autonomous Work

**Current state:** Only groundskeepers have autonomous work behavior (mow, water, fertilize, rake via A* pathfinding). Mechanics, pro shop staff, caddies, and managers exist in the roster and collect wages but produce no tangible value.

**The fix:** Every role needs to *do something* that the player can see and feel.

#### Mechanic Work System

Mechanics handle equipment maintenance and irrigation repairs. They're the role that keeps your infrastructure running.

**Autonomous tasks:**

| Task | Trigger | Duration | Effect |
|------|---------|----------|--------|
| Repair equipment | Equipment durability < 30% | 15-30 min | Restores durability to 100% |
| Preventive maintenance | Equipment durability < 70% and idle | 10 min | +20% durability, extends lifespan |
| Repair irrigation leak | Pipe has active leak | 5-15 min | Stops leak, restores pressure |
| Repair robot | Robot in "broken" state | 20-45 min | Returns robot to service |

**Without mechanics:**
- Equipment breaks more frequently (1.5x breakdown rate)
- Irrigation leaks persist until player manually repairs
- Broken robots stay broken until player intervenes
- Equipment replacement cost increases (no preventive maintenance)

**With mechanics:**
- Equipment lasts longer (preventive maintenance extends lifespan by 30%)
- Irrigation leaks detected and fixed automatically
- Robots repaired automatically (this is the critical employee-robot dependency)
- 20% reduction in equipment-related expenses

**Key design point:** Mechanics create the bridge between the employee system and the robot system. Robots break down. Without a mechanic, *you* have to fix them or they sit idle. With a skilled mechanic, robots stay running. This means even in the late-game automation phase, you still need human employees.

#### Pro Shop Staff Work System

Pro shop staff are revenue generators and satisfaction boosters. They're the customer-facing role.

**Passive effects (no pathfinding needed — they work at the clubhouse):**

| Effect | Condition | Impact |
|--------|-----------|--------|
| Merchandise revenue | Per pro shop staff on duty | +$5-15 per golfer in merch sales |
| Check-in speed | Staff present | Golfers spend less time in "checking_in" status |
| Complaint handling | Staff present + golfer satisfaction < 50 | Prevents -5 satisfaction penalty, replaces with -2 |
| Tee time management | Staff present | +5% booking rate (better phone/online presence) |

**Scaling:**
- 0 pro shop staff: No merch revenue, slow check-in, no complaint handling
- 1 staff: Base effects
- 2 staff: 1.5x merch revenue (one handles sales, one handles service)
- 3+ staff: Diminishing returns (1.8x, 2.0x, etc.)

**Skill impact:**
- Novice: 60% of base effects
- Expert: 120% of base effects + premium merchandise unlocked (+$5/golfer)

**Design intent:** Pro shop staff are the simplest hire — they sit at the clubhouse and generate value passively. Good for players who want revenue without micromanagement. The decision is purely economic: does the revenue they generate exceed their wage?

#### Caddy Work System

Caddies walk with golfers and directly boost their experience. They're the premium service role.

**How it works:**
- Each caddy is assigned to one golfer group at a time
- Caddy walks with the group for the duration of their round
- When unassigned, caddy waits at the clubhouse

**Effects per assignment:**

| Effect | Value | Notes |
|--------|-------|-------|
| Golfer satisfaction boost | +10-20 | Based on caddy skill level |
| Pace of play improvement | -10% round time | Caddy knows the course, speeds play |
| Tip revenue | $5-25 per round | Based on golfer type + caddy skill |
| Prestige boost | +0.5 per active caddy | Visible luxury service |

**Caddy assignment logic:**
1. When a golfer group checks in, check for available caddies
2. Priority: professional golfers > enthusiasts > tourists > regulars > casuals
3. Golfer must be willing to pay caddy fee (tied to green fee tier)
4. Caddy walks with group, returns to clubhouse when round ends

**Scaling:**
- More caddies = more groups get caddy service
- At high prestige (4-5 stars), golfers *expect* caddy availability
- Missing caddy service at premium tiers causes a satisfaction penalty (-5)

**Design intent:** Caddies are a late-game luxury hire. They're expensive (wage + they only serve one group at a time) but they boost the metrics that matter for premium courses — satisfaction and prestige. The decision: is the satisfaction/prestige gain worth the wage for a role that's idle between groups?

#### Manager Work System

Managers are force multipliers. They don't perform tasks directly — they make everyone else better.

**How it works:**
- Managers are assigned to oversee a group of employees (or the whole roster)
- They provide passive bonuses to employees they supervise
- Bonuses scale with manager skill level

**Manager bonuses:**

| Bonus | First Manager | Additional Managers |
|-------|--------------|-------------------|
| Employee efficiency | +15% | +8%, +4%, +2% (diminishing) |
| Experience gain rate | +25% | +12%, +6% (diminishing) |
| Fatigue reduction | -15% accrual rate | -8%, -4% (diminishing) |
| Happiness boost | +8 to all supervised | +4, +2 (diminishing) |
| Sick day prevention | -30% chance | -15%, -8% (diminishing) |

**Manager-specific behaviors:**
- **Quality checks:** Manager occasionally inspects employee work. If quality is below threshold, employee is redirected to redo the task. This prevents sloppy work from low-happiness employees.
- **Conflict resolution:** When an employee's happiness drops below 50, manager automatically provides a small happiness boost (+3) every 8 hours. This represents informal check-ins and morale management.
- **Training acceleration:** Employees supervised by a manager gain experience 25% faster. This makes managers valuable in the mid-game when you're training up novice hires.

**Design intent:** Managers are the "invest to save" role. They cost the most but their bonus compounds across your whole team. The decision: is $25-63/hr worth it when your team is small (probably not) vs. when you have 8+ employees (almost certainly yes)? This creates a natural hiring progression — you don't need a manager until you have a team worth managing.

---

### 2.3 Employee Events

Events are the micro-stories that make employees feel like people rather than resource units. They create moments of decision-making that punctuate the management layer without demanding constant attention.

#### Event Types

**Raise Request** (covered in 2.1 above)
- Frequency: Every 30 days per employee if conditions met
- Player choice: Grant / Deny / Promise later

**Personality Clash**
```
Trigger: Two employees with low happiness assigned to same area
Frequency: Rare (5% daily chance when conditions met)
Effect: Both employees -10 happiness, -15% efficiency for 3 days
Resolution options:
  1. Reassign one to different area (solves immediately)
  2. Talk to both (+5 happiness each, 50% chance of recurrence)
  3. Ignore (clash continues, may escalate to one quitting)
```

**Exceptional Performance**
```
Trigger: Employee completes 50+ tasks in a day with quality > 90%
Frequency: Organic (depends on workload and skill)
Effect: Notification highlighting the employee
Resolution options:
  1. Give bonus ($50-200, +10 happiness, +loyalty)
  2. Acknowledge (free, +3 happiness)
  3. Ignore (no effect, but missed opportunity)
```

**Training Milestone**
```
Trigger: Employee reaches new skill level
Effect: Automatic notification, wage increase, +10 happiness
Optional: Throw a small celebration ($100, +5 happiness to all staff)
```

**Poaching Attempt**
```
Trigger: Expert-level employee, randomly (2% daily chance for experts)
Frequency: Rare but impactful
Effect: Employee informs you another course offered them a job
Resolution options:
  1. Match offer (10-20% raise, employee stays, +15 happiness)
  2. Counter with promotion/title (if role allows, +10 happiness)
  3. Let them go (employee quits in 3 days)
Note: Only happens to skilled employees — novices don't get poached.
This makes investing in training feel risky in a good way.
```

**Personal Emergency**
```
Trigger: Random (3% monthly chance per employee)
Effect: Employee needs 2-3 days off
Resolution options:
  1. Paid leave (full wages, +20 happiness, +loyalty)
  2. Unpaid leave (no wages, neutral happiness)
  3. Deny leave (-25 happiness, works at 50% efficiency)
Note: How you handle these defines your "management style"
  and affects all employees' perception of you (±3 happiness to all)
```

**Weather Complaint**
```
Trigger: Employee working in rain/extreme heat for 2+ hours
Frequency: Automatic when weather conditions met
Effect: -5 happiness per hour in bad conditions
Resolution: Provide weather gear (research unlock, $500 one-time)
  or rotate employees to indoor tasks during bad weather
```

#### Event Presentation

Events appear as notification cards that slide in from the side. They don't pause the game (the course keeps running while you decide). If you ignore them, they auto-resolve after 1 game day with the "ignore" outcome.

This is important: **events should feel like things happening in your organization, not interrupts demanding your attention.** The player should feel like a manager getting updates, not like they're playing whack-a-mole.

Suggested UI pattern:
```
┌──────────────────────────────────────┐
│  📋 EMPLOYEE EVENT                    │
│                                       │
│  Robert Williams is requesting        │
│  a raise. He's been at $24/hr        │
│  for 45 days and is your only        │
│  expert groundskeeper.               │
│                                       │
│  Current happiness: 52 (disgruntled)  │
│                                       │
│  [Grant Raise: $28/hr]  [Deny]       │
│  [Promise Later]                      │
│                                       │
│  Auto-resolves in: 23:45              │
└──────────────────────────────────────┘
```

---

### 2.4 Employee Personality

Each employee gets a set of personality traits generated at hire time. These create variety in the roster and make hiring decisions more interesting than just comparing stats.

#### Trait System

Each employee has 1-2 traits from the following pool:

| Trait | Effect | Positive/Negative |
|-------|--------|-------------------|
| Hard Worker | +15% efficiency, fatigue accrues 20% faster | Positive |
| Reliable | Never calls in sick, +0.1 reliability | Positive |
| Quick Learner | +30% experience gain | Positive |
| Perfectionist | +20% quality, -10% speed | Mixed |
| Social | +5 happiness to nearby employees, -10% efficiency when alone | Mixed |
| Ambitious | +20% experience gain, requests raises 50% more often | Mixed |
| Weather Tough | No happiness penalty from bad weather | Positive |
| Night Owl | +15% efficiency after 2 PM, -15% before 10 AM | Mixed |
| Early Bird | +15% efficiency before 10 AM, -15% after 2 PM | Mixed |
| Loner | +10% efficiency, -5 happiness if >3 employees in same area | Mixed |
| Clumsy | -10% quality, 5% chance of equipment damage per day | Negative |
| Lazy | -15% efficiency, +20% break time | Negative |
| Complainer | -3 happiness to nearby employees | Negative |

#### Trait Visibility

Traits are **not visible at hire time** for novice candidates. You see their stats (efficiency, quality, stamina, reliability) but not their personality. Traits reveal themselves over the first 3-5 game days of employment.

For trained/experienced candidates, 1 trait is visible at hire time.
For expert candidates (rare), all traits are visible.

This creates a "gamble" dynamic with new hires — that novice with decent stats might turn out to be a Hard Worker, or they might be Lazy. You don't know until they've been on the job.

#### Trait Impact on Events

Traits influence event frequency and outcomes:
- **Ambitious** employees request raises more often but also gain experience faster
- **Reliable** employees never trigger sick day events
- **Social** employees trigger positive team morale events
- **Complainers** trigger personality clash events more frequently
- **Hard Workers** trigger exceptional performance events more often

---

## Part 3: Progression Arc

### The Full Journey

```
PHASE 1: Solo Greenkeeper (Day 1-30)
├── You do everything yourself
├── Learn every job intimately
├── Cash is tight, no room for hires
└── The "I need help" moment: course degrades faster than you can maintain

PHASE 2: First Employees (Day 30-90)
├── Hire 1-2 groundskeepers
├── They're slow (novice) and need areas assigned
├── You still handle critical areas (greens, problem spots)
├── First taste of delegation — imperfect but necessary
├── Personality traits start revealing themselves
└── The economic squeeze: wages eat profits, but coverage improves

PHASE 3: Team Building (Day 90-180)
├── 3-5 employees, maybe a mechanic
├── Employees gaining experience, some reaching "trained"
├── Happiness management becomes relevant (first raise request)
├── Employee events start happening
├── Area assignment strategy matters
├── You shift from worker to working manager
└── First promotion: watching a novice become trained feels rewarding

PHASE 4: Mid-Game Management (Day 180-365)
├── 5-8 employees, mixed roles
├── Hire a manager (force multiplier kicks in)
├── Pro shop staff generating passive revenue
├── Expert groundskeepers emerging from your trained team
├── Poaching attempts on your best people
├── Economic decisions get real: training vs. hiring experienced
├── Research pushing toward automation
└── You mostly manage, occasionally do hands-on work

PHASE 5: Automation Transition (Day 365+)
├── Research unlocks first robots
├── Robots supplement employees (not replace — robots break down)
├── Mechanics become critical (robot repair)
├── Caddies for premium golfer experience
├── Employee team is experienced/expert, mostly self-sufficient
├── Events are the main interaction with the employee system
├── You focus on course design and prestige
└── The dream: course runs itself while you build your masterpiece

PHASE 6: Endgame (Year 2+)
├── Full robot fleet + expert staff + skilled mechanics
├── Employee events are occasional, satisfying micro-decisions
├── The economic engine hums
├── Your attention is on: course design, tournaments, prestige
└── You step onto the course with a mower sometimes, just because
```

### The Robot-Employee Dependency

Robots are NOT a replacement for employees. They're a complement that shifts the employee mix:

| Phase | Groundskeepers | Mechanics | Pro Shop | Caddies | Managers |
|-------|---------------|-----------|----------|---------|----------|
| Early | 2-3 | 0 | 0 | 0 | 0 |
| Mid | 4-6 | 1 | 1 | 0 | 1 |
| Late | 3-4 + robots | 2 (robot repair) | 1-2 | 1-2 | 1 |
| Endgame | 1-2 + full robots | 2-3 (critical) | 2 | 2-3 | 1 |

Notice: **mechanics become MORE important as you automate, not less.** And total employee count doesn't drop dramatically — the mix shifts from groundskeepers to support roles.

---

## Part 4: Economic Balance Principles

### Each Role Must Create a Real Decision

No role should be an obvious hire or an obvious skip. Every role should have a point where it "turns on" — a course size, prestige tier, or revenue level where the math starts working.

| Role | Turns On When... | Monthly Cost | Monthly Value |
|------|-----------------|--------------|---------------|
| Groundskeeper | Course > 200 tiles (can't keep up solo) | $1,920-3,840 | Prevents $3,000+ in degradation |
| Mechanic | Own 3+ pieces of equipment OR robots | $2,880-6,400 | Saves $2,000+ in repairs, keeps robots running |
| Pro Shop Staff | 15+ golfers/day | $1,600-2,720 | Generates $2,000-4,000 in merch revenue |
| Caddy | 4-star prestige, premium pricing | $1,280-2,080 | +$1,500-3,000 in satisfaction-driven retention |
| Manager | 5+ other employees | $4,000-10,080 | 15% efficiency boost × team size |

### The Novice vs. Expert Dilemma

This should be a genuine strategic choice:

**Hire novice ($12/hr):**
- Cheap
- But slow (0.5x efficiency) and low quality (0.7x)
- Unknown personality traits — might be great, might be terrible
- Takes ~17 game hours to reach "trained" level
- Investment: you're betting on their growth

**Hire experienced ($18/hr, rare in hiring pool):**
- Expensive
- But productive immediately (0.85x efficiency, 0.9x quality)
- 1 trait visible at hire time
- Less upside (already near peak)
- No training gamble

**Promote from within:**
- Zero hiring cost, trait already known
- But takes time — and they might quit before reaching expert
- Loyalty factor: promoted employees have +10 happiness baseline

### Wage Pressure

As your course grows, so does the "market rate" for your area. This is tied to prestige tier:

| Prestige Tier | Wage Multiplier | Effect |
|---------------|----------------|--------|
| Municipal (1★) | 1.0x | Base wages |
| Public (2★) | 1.0x | Base wages |
| Semi-Private (3★) | 1.1x | 10% higher wages expected |
| Private Club (4★) | 1.25x | 25% higher wages expected |
| Championship (5★) | 1.5x | 50% higher wages expected |

If you pay below market rate for your tier, happiness decays faster. If you pay above, happiness is more stable. This creates a natural economic pressure: as your course improves, your costs increase. Revenue should outpace this, but it's not free.

---

## Part 5: Integration Points

### Employee → Prestige

- Pro shop staff: Affect "service" satisfaction factor
- Caddies: Affect "service" + "amenities" satisfaction factors
- Groundskeeper quality: Directly affects "current conditions" component
- Manager presence: Indirectly improves all employee quality → conditions

### Employee → Economy

- Wages are the single largest expense category (50% of operating costs)
- Pro shop staff generate direct revenue (merch)
- Caddies generate tip revenue
- Mechanics reduce equipment costs
- Better maintenance → higher prestige → higher green fees → more revenue

### Employee → Research

- "Basic Staff Training" research: +15% experience gain for all employees
- "Advanced Staff Training" research: +30% experience gain, unlocks training facility
- "Weather Gear" research: Eliminates weather happiness penalty
- Robot research: Supplements groundskeeper work, requires mechanic support

### Employee → Tee Times

- Pro shop staff: +5% booking rate
- Caddies: Improve pace of play → better tee time utilization
- Groundskeepers: Course condition affects golfer satisfaction → reputation → demand

---

## Implementation Priority

### Phase 1: Cleanup
Remove walk-on and marketing systems. This is prerequisite work that simplifies the codebase before adding depth.

### Phase 2: Happiness Consequences
Add efficiency modifiers, sick days, and quitting. This transforms the existing happiness tracking from decorative to functional.

### Phase 3: Role-Specific Work
Wire up mechanics (equipment/irrigation/robot repair), pro shop staff (passive revenue/satisfaction), caddies (golfer walking/satisfaction), and managers (team bonuses). Each role needs to produce visible, tangible value.

### Phase 4: Employee Events
Add the event system with raise requests, personality clashes, exceptional performance, poaching, and personal emergencies. These are the micro-stories that make management engaging.

### Phase 5: Personality Traits
Add trait generation at hire time, hidden trait reveal over first few days, and trait effects on behavior and events. This makes hiring decisions more interesting.

### Phase 6: Balance Pass
Tune all numbers — wages, efficiency multipliers, event frequencies, skill scaling — against the actual economy. This requires playtesting and iteration.
