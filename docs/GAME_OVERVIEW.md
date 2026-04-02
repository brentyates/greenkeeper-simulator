# Greenkeeper Simulator - Game Overview

## Core Philosophy

**"From a struggling greenkeeper to a championship resort."**

Greenkeeper Simulator is an isometric management game inspired by RollerCoaster Tycoon. You oversee a golf course from above -- hiring staff, managing finances, researching upgrades, and growing from a tiny 3-hole operation into a world-class resort. The course is a living thing that demands constant attention: grass grows, moisture depletes, golfers arrive, and your reputation rises or falls based on how well you manage it all.

---

## What Makes It Tick

### The Core Loop

Every day on your course follows a rhythm:

1. **Grass grows** -- if left unmowed, the course degrades
2. **Moisture and nutrients deplete** -- without care, fairways brown and weaken
3. **Golfers arrive** -- they pay green fees, but only if conditions meet their expectations
4. **Revenue comes in** -- funding your staff, equipment, research, and expansion
5. **Reputation shifts** -- good conditions build prestige; neglect destroys it

The interesting decisions come from balancing all of this simultaneously with limited money and staff.

### Systems That Interact

The game's depth comes from systems that affect each other:

- **Employee skill levels** affect how fast they maintain the course, which affects **course health**
- **Course health** drives **prestige**, which determines what **green fees** golfers will pay
- **Revenue** funds **research**, which unlocks better **equipment and automation**
- **Weather** changes conditions dynamically -- rain helps moisture, heat accelerates decay
- **Irrigation infrastructure** reduces manual watering burden but requires capital investment

No system exists in isolation.

---

## The Management Journey

### Early Game: Survival
*A small course, tight budget, and too much grass to maintain.*

You start with a small course and a skeleton crew. Cash is tight. The challenge is keeping conditions good enough that golfers keep coming back while you scrape together money for your first hires. Every dollar matters.

### Mid Game: Growth
*Building a team, investing in infrastructure, finding your groove.*

Revenue is stabilizing. You're hiring groundskeepers, maybe a mechanic to keep equipment running. Research unlocks better fertilizers, irrigation systems, and eventually autonomous robots. The course is expanding and you're learning to delegate effectively.

### Late Game: Excellence
*Fine-tuning a well-oiled machine toward championship quality.*

Your team is experienced, robots supplement the workforce, and the course mostly maintains itself. The challenge shifts to prestige -- pushing toward five-star quality, optimizing every system, and preparing for the ultimate goal.

### End Game: Legacy
*Hosting tournaments, running a resort, building something that lasts.*

Multi-course management, tournament hosting, and the satisfaction of watching an empire that started as a three-hole operation run at championship level.

---

## Core Systems

### Employees
Two roles: **groundskeepers** (mow, water, fertilize, rake) and **mechanics** (repair equipment, maintain robots). Employees are a scaling tool, not a people-management minigame -- hire them, pay them, assign them to areas, and they work. See `EMPLOYEE_SYSTEM_V2.md` for the design philosophy.

### Economy
Green fees are your primary revenue. Pricing is tied to prestige -- charge too much and golfers go elsewhere, charge too little and you can't afford staff. Memberships, amenities, and facilities provide secondary revenue as you grow. See `ECONOMY_SYSTEM_SPEC.md`.

### Research
A technology tree that unlocks better equipment, advanced fertilizers, irrigation tech, grass varieties, and autonomous robots. Research costs money to fund but pays off in efficiency and capability. See `RESEARCH_TREE_SPEC.md`.

### Prestige
A five-star reputation system driven by course conditions, historical excellence, amenities, and reputation. Higher prestige means golfers pay more and better tournament opportunities. See `PRESTIGE_SYSTEM_SPEC.md`.

### Irrigation
SimCity-style pipe placement with sprinkler heads, pressure mechanics, and scheduled watering. A major infrastructure investment that reduces the watering burden on staff. See `IRRIGATION_SYSTEM_SPEC.md`.

### Weather
Dynamic weather with seasonal cycles (spring/summer/fall/winter), rain, storms, and temperature effects. Weather creates reactive decision-making -- you can't just optimize once and repeat.

### Terrain & Course Design
An integrated terrain editor for sculpting courses. Topology-based (vertex/edge/face) rather than grid-based, enabling natural terrain contours. See `TERRAIN_TOPOLOGY_SPEC.md`.

---

## Presentation

### Camera
Isometric orthographic view at 60 degrees from vertical (RCT-style). Camera can be panned and zoomed. Employees and robots are visible on the course as they work.

### Visual Style
Babylon.js 3D rendering with GLB models. Low-poly aesthetic with clear visual feedback -- you can see grass conditions, employee activity, and irrigation coverage at a glance. Missing assets show as magenta wireframe placeholders during development.

### Time Controls

| Speed | Rate | Use Case |
|-------|------|----------|
| 0.5x | Half speed | Careful observation |
| 1x | 1 real sec = 1 game min | Active management |
| 2x | Double speed | Supervised operations |
| 4x | Quad speed | Watching the day unfold |
| 8x | Fast-forward | Skipping routine periods |

Pause is available for planning and menu interaction.

### Input
The game supports keyboard, mouse, and touch input.

**Keyboard shortcuts:**
- **Tab**: Cycle overlay modes (normal/moisture/nutrients/height)
- **[ / ]**: Zoom out/in
- **+/-**: Speed up/slow down time
- **P / Escape**: Pause
- **H/Y/G/B/U/I/J/L/T**: Toggle management panels (employees, research, tee sheet, equipment store, amenities, irrigation, hole builder, course layout, terrain editor)

**Mouse:** Click to interact, scroll to zoom, hover for feedback.

**Touch:** Tap to interact, pinch to zoom.

---

## Scenarios

The game progresses through scenarios of increasing scale and challenge:

- **3-hole courses**: Learn the basics, survive economically
- **9-hole courses**: Grow your team, restore neglected courses, build attendance
- **18-hole courses**: Manage profit, maintain satisfaction, drive revenue
- **27-hole courses**: Expert-level restoration, sustained excellence, major profit targets

A sandbox mode is also available with unlimited funds for experimentation.

See `scenarioData.ts` for the full scenario list and `SCENARIOS.md` for detailed design.

---

## Design Principles

### Depth Through Interaction
Every system should create meaningful choices that ripple through other systems. A hiring decision affects maintenance quality, which affects prestige, which affects revenue, which constrains future hiring.

### Deterministic + Reactive
The base simulation is predictable (you can plan and optimize), but weather and dynamic conditions force adaptation. The best-laid plans need to flex.

### Employees Are Tools, Not Drama
Complex employee management (morale systems, personality traits, sick days) was consciously rejected. Employees exist to scale course maintenance, not to be a people-management minigame. See `EMPLOYEE_SYSTEM_V2.md`.

### Show, Don't Tell
Course conditions are visible. Employees and robots move on the course doing visible work. Golfers arrive and play. The game state should be readable from the visual presentation, not just from numbers in panels.

---

## Summary

Greenkeeper Simulator is about **growing something from nothing through smart management**:

1. **Start small**: A few holes and a tight budget
2. **Build systems**: Hire staff, research tech, lay irrigation
3. **Scale up**: More holes, more staff, more revenue
4. **Optimize**: Push toward championship quality
5. **Achieve**: Host tournaments, run a resort, build a legacy

The core fantasy: *"I built this from a neglected three-hole course into a championship resort."*
