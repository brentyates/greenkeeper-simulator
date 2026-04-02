# Equipment & Maintenance System Specification

## Overview

Course maintenance is performed by **employees** (groundskeepers and mechanics) and **autonomous robots**. There is no player-operated equipment -- the player manages staffing, research, and infrastructure while workers handle the physical tasks.

### Core Philosophy

**"Hire the crew, research the tools, watch the course thrive."**

- Employees perform maintenance tasks autonomously within assigned areas
- Autonomous robots supplement employees and eventually dominate the workforce
- Research unlocks better equipment and more capable robots
- The interesting decisions are economic: when to hire, when to automate, what to research

---

## Employee Task System

Groundskeepers autonomously find and perform maintenance tasks. Each task has a duration and supply cost.

### Task Types

| Task | Duration | Supply Cost | Trigger (Critical) | Trigger (Standard) |
|------|----------|-------------|-------------------|-------------------|
| Mow grass | 0.5 min | $0.25 | Height > 80 | Height > 60 |
| Water area | 0.25 min | $0.10 | Moisture < 20 | Moisture < 40 |
| Fertilize | 0.3 min | $0.50 | Nutrients < 20 | Nutrients < 30 |
| Rake bunker | 1.0 min | $0.05 | -- | Bunker needs raking |

### How Employees Work

1. **Find work** -- scan assigned area for terrain that exceeds task thresholds
2. **Pathfind** -- A* navigation (WASM-accelerated) to the target zone
3. **Execute task** -- apply the maintenance effect to terrain faces
4. **Repeat** -- find next highest-priority task, or patrol if nothing needs doing

Task priority: critical health > overgrown grass > dry areas > low nutrients > bunker raking > patrol.

Employee effectiveness is modified by skill level, happiness, and fatigue. See `EMPLOYEE_SYSTEM_V2.md` for details.

---

## Job System

The job system provides structured, region-based work assignments beyond autonomous task-finding.

### Job Types
Mow, water, fertilize, rake -- each targeting a named region of the course.

### Movement Patterns
Jobs assign workers movement patterns appropriate to the terrain:
- **Linear stripes** -- fairways
- **Concentric circles** -- greens, bunkers
- **Diagonal stripes** -- tee boxes
- **Perimeter first** -- edges before fill
- **Random coverage** -- rough areas

### Standing Orders
Automated job creation rules: "whenever the front nine fairways exceed height 50, create a mowing job." These replace manual micromanagement at scale. See `JOB_AUTOMATION_SPEC.md`.

---

## Autonomous Robot System

Robots are the late-game scaling solution. They work continuously without breaks or wages, but require capital investment, operating costs, and mechanic support.

### Robot Types

| Robot | Purchase | Operating Cost | Breakdown Rate | Research Cost |
|-------|----------|---------------|----------------|---------------|
| RoboMow Fairway | $45,000 | $2.50/hr | 2.0%/100hr | 6,000 pts |
| RoboMow Greens | $65,000 | $3.00/hr | 2.5%/100hr | 8,000 pts |
| RoboMow Rough | $42,000 | $2.20/hr | 2.2%/100hr | 5,500 pts |
| AutoSpray | $38,000 | $2.00/hr | 1.5%/100hr | 5,000 pts |
| NutriBot Spreader | $35,000 | $1.80/hr | 1.8%/100hr | 4,500 pts |
| SandBot Raker | $28,000 | $1.50/hr | 3.0%/100hr | 4,500 pts |

### Robot Lifecycle

```
idle → working → (fuel low) → charging → idle
                → (breakdown) → waiting_for_repair → idle
```

**Fuel**: Robots consume fuel continuously while working. When fuel drops below 10%, they auto-navigate to the charging station and recharge.

**Breakdowns**: Poisson-distributed failures based on the hourly breakdown rate. Broken robots stop working and wait for a mechanic to repair them. Without mechanics, the breakdown rate increases 1.5x.

**Parking**: Idle robots organize into concentric rings around the charging station, staying out of the way.

### The Mechanic Dependency

Mechanics become MORE important as you automate:
- Each mechanic reduces robot breakdown rates
- Without mechanics: 1.5x breakdown penalty
- Mechanic priority: robots > equipment > irrigation leaks > bunker raking

---

## Research Progression

Equipment capabilities are unlocked through the research tree. See `RESEARCH_TREE_SPEC.md` for the full tree.

### Key Milestones

| Tier | Unlocks | Impact |
|------|---------|--------|
| 1-2 | Basic equipment improvements | Employees work slightly faster |
| 3 | Efficiency upgrades, irrigation tech | Reduced supply costs |
| 4 | Advanced equipment, staff training | Meaningful efficiency gains |
| 5 | Autonomous robots | Paradigm shift -- robots supplement employees |
| 5+ | Fleet management AI | 40% breakdown reduction, 1.4x efficiency |

---

## Economic Integration

### Operating Costs

Employee tasks consume supplies (tracked as daily expenses):
- A full mow cycle of a 9-hole course costs roughly $50-100 in supplies
- Watering and fertilizing add another $30-60/day
- These costs scale with course size

Robot operating costs are hourly:
- A fleet of 4 robots costs roughly $8-10/hr in operating expenses
- Plus occasional breakdown repair costs
- Offset by reduced employee headcount needs

### Cost Progression

| Phase | Primary Cost | Notes |
|-------|-------------|-------|
| Early | Employee wages + supplies | Tight margins |
| Mid | Wages + supplies + research funding | Investment phase |
| Late | Wages + robot operating costs | Efficiency gains |
| Endgame | Robot fleet + mechanic wages | Mostly automated |

---

## Legacy Note

The original equipment system was designed for first-person player operation (keys 1/2/3 to select mower/sprinkler/spreader, Space to toggle, E to refill). This has been removed. `EquipmentManager.ts` and `equipment-selection.ts` contain remnant code from this system that should be cleaned up.
