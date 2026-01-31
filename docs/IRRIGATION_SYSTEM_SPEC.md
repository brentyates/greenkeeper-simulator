# Irrigation System Design Specification

## Overview

SimCity-style piped irrigation system that replaces manual irrigation with an infrastructure-based approach. The system balances simplicity (like classic SimCity pipes) with enough depth to create meaningful gameplay decisions around coverage, maintenance, and costs.

---

## 1. Employee System Changes

### 1.1 Remove Irrigator Role

**Current State:**
- `irrigator` role exists in `src/core/employees.ts` (line 19)
- Base wage: $15/hr
- Used for irrigation system management

**Changes Required:**
- **REMOVE** `irrigator` from `EmployeeRole` type
- **REMOVE** irrigator config from `EMPLOYEE_CONFIGS`
- **TRANSFER** manual watering responsibility to `groundskeeper` role
- **UPDATE** groundskeeper description: "Mowing, watering, general maintenance" → remains accurate

### 1.2 Pipe Installation & Maintenance Roles

**Mechanic:**
- Install pipes (requires mechanic present)
- Repair leaking pipes
- Fix broken sprinkler heads
- Maintain pump houses/water sources

**Groundskeeper:**
- Assist with pipe installation (two-person job)
- Monitor sprinkler coverage
- Report issues (leaks, broken heads)
- Manual watering in areas without pipes (backup)

**Two-Person Job Mechanic:**
- Pipe laying requires BOTH a mechanic AND a groundskeeper
- Either can be player-controlled or employee
- If player is mechanic/groundskeeper, they need to hire the other role
- Speed bonus when both are skilled workers
- Installation cost is reduced if you have both roles at higher skill levels

---

## 2. Pipe System Design (SimCity-Style)

### 2.1 Core Concepts

**Inspiration:** Classic SimCity (1989) and SimCity 2000 pipe visuals
- Simple grid-based placement
- Pipes connect orthogonally (no diagonals initially)
- Visual flow indicators showing water direction
- Color coding for pressure/status (blue = good, yellow = low pressure, red = leak)

### 2.2 Pipe Types & Specs

| Type | Cost | Max Pressure | Capacity | Durability | Unlock |
|------|------|--------------|----------|------------|--------|
| **PVC Pipe** | $50/tile | Low | 10 heads | Poor (leaks common) | Starting |
| **Metal Pipe** | $120/tile | Medium | 25 heads | Good | Research T2 |
| **Industrial Pipe** | $250/tile | High | 50 heads | Excellent | Research T3 |

**Installation Cost Formula:**
```
Base Cost + (Labor Cost × Skill Multiplier)
Labor = (Mechanic Wage + Groundskeeper Wage) × Hours Required
Hours = Pipe Count × 0.25 (15 minutes per tile)
Skill Multiplier = 1.0 - (Avg Skill Level × 0.1)  // Expert teams are 30% faster
```

### 2.3 Pipe Mechanics

**Placement:**
- Click tile to lay pipe (requires unlocked pipe type)
- Auto-connects to adjacent pipes
- Cannot cross obstacles (trees, buildings, water hazards)
- Can go under cart paths (increased cost +$25/tile)

**Water Flow:**
- Must connect to water source (pump house, well, municipal connection)
- Pressure decreases with distance from source
- Branches reduce pressure
- Visual flow animation (subtle blue shimmer) shows active flow

**Elevation Handling:**
- Pipes can handle ±1 elevation change automatically
- ±2 elevation requires "Pump Booster" ($500, research unlock)
- Cannot cross elevation changes >2 without booster

### 2.4 Maintenance & Failures

**Leak System:**
```typescript
interface PipeTile {
  gridX: number;
  gridY: number;
  pipeType: 'pvc' | 'metal' | 'industrial';
  installDate: number;  // Game time installed
  durability: number;   // 0-100, decreases over time
  isLeaking: boolean;
  pressureLevel: 'good' | 'low' | 'none';
  connectedTo: Direction[];  // Which sides connect to other pipes
}
```

**Leak Probability:**
- PVC: 2% per game day after 30 days
- Metal: 0.5% per game day after 90 days
- Industrial: 0.1% per game day after 180 days
- High pressure increases leak chance by 1.5x
- Freeze events (winter weather) double leak chance for 3 days

**Leak Effects:**
- Reduces pressure downstream (50% reduction)
- Wastes water ($5/hour per leak)
- Creates muddy patch (moisture 100%, health penalty if prolonged)
- Visual: dark spot with water droplet particles

**Repair Process:**
- Mechanic must be assigned or player must be mechanic
- Click leaking pipe → "Repair Leak" action
- Takes 5-10 minutes (skill dependent)
- Cost: $20 in parts + labor
- Restores durability to 80%

---

## 3. Sprinkler Head System

### 3.1 Sprinkler Head Types

| Type | Cost | Coverage | Pattern | Water Rate | Unlock |
|------|------|----------|---------|------------|--------|
| **Fixed Spray** | $100 | 3×3 tiles | Square | 15/min | Starting |
| **Rotary** | $200 | 5×5 circle | Circular | 10/min | Research T2 |
| **Impact** | $350 | 7×7 circle | Circular | 12/min | Research T3 |
| **Precision** | $500 | Custom | Programmable | 8/min | Research T4 |

### 3.2 Coverage Mechanics

**Fixed Spray:**
```
Pattern (X = watered):
  X X X
  X H X   (H = head location)
  X X X
Coverage: 9 tiles
Efficiency: 100% in center, 70% at edges
```

**Rotary:**
```
Pattern (radius 2):
    X X X
  X X X X X
  X X H X X
  X X X X X
    X X X
Coverage: 21 tiles
Efficiency: 100% center 3×3, 80% outer ring
```

**Impact:**
```
Pattern (radius 3):
      X X X
    X X X X X
  X X X X X X X
  X X X H X X X
  X X X X X X X
    X X X X X
      X X X
Coverage: 49 tiles
Efficiency: 100% center 5×5, 60% outer ring
```

**Precision:**
- Player can "paint" coverage area (like terrain editor)
- Max 25 tiles
- Perfect 100% efficiency
- Expensive to operate ($2/hour per head)

### 3.3 Placement & Installation

**Requirements:**
- Must be on a pipe tile OR adjacent to pipe
- Cannot place on obstacles or cart paths
- Minimum 2 tiles between same-type heads (avoid overlap waste)

**Installation:**
- Mechanic installs head (10-minute job)
- Cost = Head Price + $20 labor
- Can be upgraded later (50% credit toward new head)

### 3.4 Scheduling & Automation

**Basic Scheduling (Free):**
- Set watering times (default: 5am-7am, 6pm-8pm)
- All-on/all-off toggle
- Manual override

**Advanced Scheduling (Research Unlock: "Smart Irrigation Controller" - $1500):**
- Per-zone schedules (group heads into zones)
- Weather-based skipping (auto-off during rain)
- Moisture sensor integration (auto-water only dry areas)
- Schedule templates (greens, fairways, rough)

---

## 4. Water Source System

### 4.1 Water Source Types

| Source | Capacity | Cost | Operating Cost | Unlock |
|--------|----------|------|----------------|--------|
| **Municipal** | Unlimited | $0 | $0.10/1000gal | Starting |
| **Well (Shallow)** | 5000 gal/day | $5,000 | $0.02/1000gal + $50/mo | Research T2 |
| **Well (Deep)** | 15000 gal/day | $15,000 | $0.01/1000gal + $120/mo | Research T3 |
| **Pond/Lake** | Varies | $0 (natural) | $0.05/1000gal (pump) | Natural feature |

### 4.2 Water Consumption

**Calculation:**
```typescript
function calculateWaterUsage(
  sprinklerHeads: SprinklerHead[],
  runtimeMinutes: number
): number {
  let totalGallons = 0;
  for (const head of sprinklerHeads) {
    const gallonsPerMinute = head.waterRate;
    const efficiency = head.efficiency; // Pipe pressure affects this
    totalGallons += gallonsPerMinute * runtimeMinutes * efficiency;
  }
  return totalGallons;
}
```

**Cost Formula:**
```
Daily Water Bill = (Total Gallons Used ÷ 1000) × Rate Per 1000 Gallons
+ Monthly Fixed Costs (wells, pumps)
```

### 4.3 Pump House

**Building:**
- Size: 2×2 tiles
- Cost: $2,500
- Stores 1000 gallons buffer
- Boosts pressure for 50 tiles radius
- Requires mechanic maintenance every 90 days ($150)

---

## 5. Visual Design (SimCity-Inspired)

### 5.1 Pipe Rendering

**Style:**
- Top-down/isometric sprite tiles
- Blue tinted pipes with connection joints
- Animated water flow (subtle shimmer, 1-2 second loop)
- Smart connections (straight, elbow, T-junction, cross)

**Sprite States:**
```
pipe_straight_NS.png
pipe_straight_EW.png
pipe_elbow_NE.png
pipe_elbow_SE.png
pipe_elbow_SW.png
pipe_elbow_NW.png
pipe_T_N.png  (three-way: south, east, west)
pipe_T_E.png
pipe_T_S.png
pipe_T_W.png
pipe_cross.png (four-way)
pipe_leak.png (overlay with water drops)
```

**Color Coding:**
- Blue = good pressure, functioning
- Yellow tint = low pressure warning
- Red pulse = leak detected
- Gray = disconnected from water source

### 5.2 Sprinkler Head Rendering

**Visual:**
- Small 16×16 sprite on tile
- Type indicated by sprite (spray = square nozzle, rotary = round, etc.)
- Active animation: rotating sprite + water particle effect
- Coverage overlay: semi-transparent blue circles when placing/editing

**Particle Effects:**
- Water droplets in coverage area when active
- 20-30 particles per head
- Fall trajectory with slight arc
- More particles in center, fewer at edges

### 5.3 UI Elements

**Pipe Toolbar (Similar to Terrain Editor):**
```
[Pipe Tool] [Sprinkler Tool] [Delete] [Info]
  ↓
Pipe Type:  [PVC] [Metal] [Industrial]
Sprinkler:  [Fixed] [Rotary] [Impact] [Precision]
```

**Info Panel (When clicking pipe/head):**
```
╔══════════════════════════════╗
║ PVC Pipe                      ║
║ Installed: Day 15             ║
║ Durability: 78%               ║
║ Pressure: Good ████░░ 80%     ║
║ Connected: N, E, S            ║
║                               ║
║ [Upgrade] [Replace] [Remove]  ║
╚══════════════════════════════╝
```

**Schedule Panel:**
```
╔═══════════════════════════════════╗
║ Irrigation Schedule                ║
║ ─────────────────────────────────  ║
║ Zone 1: Greens                     ║
║   🕐 5:00 AM - 6:00 AM  [ON]       ║
║   🕐 7:00 PM - 8:00 PM  [ON]       ║
║   Auto-skip rain: ☑                ║
║                                    ║
║ Zone 2: Fairways                   ║
║   🕐 6:00 AM - 8:00 AM  [ON]       ║
║   Auto-skip rain: ☑                ║
║                                    ║
║ [Add Zone] [Edit Schedule]         ║
╚═══════════════════════════════════╝
```

---

## 6. Research Tree Integration

### 6.1 New Research Items

```typescript
// Add to src/core/research.ts

{
  id: "piped_irrigation_basic",
  name: "Piped Irrigation System",
  description: "Install underground pipes and sprinkler heads",
  category: "irrigation",
  baseCost: 800,
  prerequisites: ["basic_sprinkler"],
  tier: 2,
  unlocks: {
    type: "feature",
    featureId: "pipe_system_pvc"
  }
},
{
  id: "sprinkler_rotary",
  name: "Rotary Sprinkler Heads",
  description: "Larger coverage area with circular pattern",
  category: "irrigation",
  baseCost: 1200,
  prerequisites: ["piped_irrigation_basic"],
  tier: 3,
  unlocks: {
    type: "feature",
    featureId: "sprinkler_rotary"
  }
},
{
  id: "metal_pipes",
  name: "Metal Pipe Infrastructure",
  description: "More durable pipes with higher capacity",
  category: "irrigation",
  baseCost: 1500,
  prerequisites: ["piped_irrigation_basic"],
  tier: 3,
  unlocks: {
    type: "feature",
    featureId: "pipe_metal"
  }
},
{
  id: "smart_irrigation_controller",
  name: "Smart Irrigation Controller",
  description: "Automated scheduling with weather integration",
  category: "irrigation",
  baseCost: 2000,
  prerequisites: ["sprinkler_rotary", "metal_pipes"],
  tier: 4,
  unlocks: {
    type: "upgrade",
    upgradeId: "smart_watering",
    bonus: { type: "efficiency", value: 0.3 }  // 30% water savings
  }
},
{
  id: "industrial_pipes",
  name: "Industrial Pipe System",
  description: "High-capacity, ultra-durable infrastructure",
  category: "irrigation",
  baseCost: 3000,
  prerequisites: ["metal_pipes"],
  tier: 4,
  unlocks: {
    type: "feature",
    featureId: "pipe_industrial"
  }
},
{
  id: "precision_sprinklers",
  name: "Precision Spray Technology",
  description: "Programmable coverage with maximum efficiency",
  category: "irrigation",
  baseCost: 3500,
  prerequisites: ["smart_irrigation_controller"],
  tier: 5,
  unlocks: {
    type: "feature",
    featureId: "sprinkler_precision"
  }
}
```

### 6.2 Research Progression Path

```
basic_sprinkler (manual equipment)
    ↓
piped_irrigation_basic (PVC pipes + fixed spray heads)
    ↓
    ├─→ sprinkler_rotary (better coverage)
    │       ↓
    │   smart_irrigation_controller (automation + efficiency)
    │       ↓
    │   precision_sprinklers (ultimate tech)
    │
    └─→ metal_pipes (durability)
            ↓
        industrial_pipes (capacity)
```

---

## 7. Cost Modeling & Economics

### 7.1 Initial Investment Comparison

**Scenario: Water a 9-hole course (50×50 tiles = 2,500 tiles)**

**Manual Watering (Current System):**
- 2 Groundskeepers @ $12/hr × 8 hrs/day = $192/day
- Sprinkler equipment refills: ~$50/day
- **Total: ~$242/day = $7,260/month**

**Piped System (Basic - PVC + Fixed Spray):**
- Initial: 500 tiles pipe @ $50 = $25,000
- 50 sprinkler heads @ $100 = $5,000
- Installation labor: ~$5,000
- **Total Initial: $35,000**
- Operating: Water $0.10/1000gal × 15,000 gal/day = $1.50/day
- Maintenance: $50/month (leak repairs)
- **Total Operating: ~$95/month**

**Break-even: $35,000 ÷ ($7,260 - $95) = 4.9 months**

**Piped System (Advanced - Metal + Rotary):**
- Initial: 500 tiles @ $120 = $60,000
- 30 heads @ $200 = $6,000
- Smart Controller: $1,500
- Installation: $8,000
- **Total Initial: $75,500**
- Operating: $1.20/day (better efficiency) + $30/month maintenance
- **Total Operating: ~$66/month**

**Break-even: $75,500 ÷ ($7,260 - $66) = 10.5 months**

### 7.2 Ongoing Cost Comparison

| System | Monthly Cost | Efficiency | Coverage | Labor |
|--------|--------------|------------|----------|-------|
| Manual | $7,260 | 100% | Variable | High |
| PVC/Fixed | $95 | 90% | Good | None |
| Metal/Rotary | $66 | 95% | Excellent | None |
| Industrial/Precision | $45 | 98% | Perfect | None |

### 7.3 Scenario Balance

**Early Game (Municipal/Public):**
- Manual watering is viable (cheap labor)
- Pipe system is luxury investment
- Focus on mowing/basic maintenance

**Mid Game (Semi-Private):**
- Pipe system becomes cost-effective
- Free up employees for other tasks
- Basic PVC system is ideal

**Late Game (Private/Championship):**
- Advanced pipe system is essential
- Precision control for course quality
- Fully automated operations

---

## 8. Gameplay Integration

### 8.1 Tutorial/Hints

When player unlocks piped irrigation:
```
💡 TIP: Piped Irrigation Unlocked!
Install pipes and sprinkler heads to automate watering.
This frees up your groundskeepers for other tasks.
Start small - connect a few greens first to test!
```

When first leak occurs:
```
⚠️ LEAK DETECTED at Hole 3!
A pipe is leaking and wasting water.
Assign a mechanic to repair it quickly.
Higher quality pipes leak less often.
```

### 8.2 Scenario Objectives

**New Scenario Ideas:**
1. **"Going Green"** - Install irrigation system on all 18 holes within 90 days
2. **"Water Conservation"** - Reduce water bill by 50% using smart irrigation
3. **"Infrastructure Crisis"** - Repair aging pipes (10+ leaks) within 30 days

### 8.3 Player Strategies

**Efficient Placement:**
- Minimize pipe length (reduce cost + leak chance)
- Use rotary heads to reduce total head count
- Zone by terrain type (greens need more water than rough)

**Maintenance Strategy:**
- Hire 1 dedicated mechanic for courses >9 holes
- Upgrade to metal pipes in high-traffic areas
- Replace PVC after 180 days (before failures spike)

**Economic Optimization:**
- Use well instead of municipal water (long-term savings)
- Schedule watering during off-peak hours (if utility rates vary)
- Skip rough areas (manual spot-watering by groundskeeper)

---

## 9. Technical Implementation Roadmap

### 9.1 Core Data Structures

```typescript
// src/core/irrigation.ts

export type PipeType = 'pvc' | 'metal' | 'industrial';
export type SprinklerType = 'fixed' | 'rotary' | 'impact' | 'precision';

export interface PipeTile {
  readonly gridX: number;
  readonly gridY: number;
  readonly pipeType: PipeType;
  readonly installDate: number;
  readonly durability: number;  // 0-100
  readonly isLeaking: boolean;
  readonly pressureLevel: number;  // 0-100
}

export interface SprinklerHead {
  readonly id: string;
  readonly gridX: number;
  readonly gridY: number;
  readonly sprinklerType: SprinklerType;
  readonly installDate: number;
  readonly isActive: boolean;
  readonly schedule: WateringSchedule;
  readonly coverageTiles: readonly { x: number; y: number; efficiency: number }[];
}

export interface WateringSchedule {
  readonly enabled: boolean;
  readonly timeRanges: readonly { start: number; end: number }[];  // Game hours
  readonly skipRain: boolean;
  readonly zone: string;
}

export interface IrrigationSystem {
  readonly pipes: readonly PipeTile[];
  readonly sprinklerHeads: readonly SprinklerHead[];
  readonly waterSources: readonly WaterSource[];
  readonly totalWaterUsedToday: number;
  readonly lastTickTime: number;
}

export interface WaterSource {
  readonly id: string;
  readonly type: 'municipal' | 'well_shallow' | 'well_deep' | 'pond';
  readonly gridX: number;
  readonly gridY: number;
  readonly capacityPerDay: number;  // Gallons (Infinity for municipal)
  readonly usedToday: number;
  readonly costPer1000Gal: number;
}
```

### 9.2 Implementation Phases

**Phase 1: Core Data Layer (Week 1)**
- Create `irrigation.ts` with types and pure functions
- Implement pipe network connectivity logic
- Write unit tests for pressure calculation
- Add water flow pathfinding algorithm

**Phase 2: Employee System Changes (Week 1)**
- Remove irrigator role from `employees.ts`
- Add pipe installation job logic (two-person requirement)
- Add repair job for mechanics
- Update employee panel UI

**Phase 3: Visual System (Week 2)**
- Create pipe sprites (8-10 variations)
- Implement pipe rendering in `GrassSystem`
- Add sprinkler head sprites and animations
- Implement coverage overlay visualization

**Phase 4: UI & Controls (Week 2)**
- Create irrigation toolbar (similar to terrain editor)
- Add pipe/sprinkler placement tools
- Implement info panels for pipes/heads
- Add scheduling UI

**Phase 5: Simulation & Costs (Week 3)**
- Integrate water consumption into economy
- Implement leak probability system
- Add scheduled watering execution
- Connect to existing grass moisture system

**Phase 6: Research Integration (Week 3)**
- Add irrigation research items to tree
- Create unlock conditions
- Add tutorial messages/hints
- Balance costs and benefits

**Phase 7: Polish & Testing (Week 4)**
- E2E tests for pipe placement and operation
- Unit tests for all irrigation logic
- Performance optimization
- Balance tuning based on playtesting

### 9.3 Key Algorithms

**Pressure Calculation:**
```typescript
function calculatePressure(
  pipe: PipeTile,
  system: IrrigationSystem
): number {
  const source = findNearestWaterSource(pipe, system);
  if (!source) return 0;

  const distance = calculatePipeDistance(pipe, source, system);
  const maxDistance = getPipeMaxDistance(pipe.pipeType);

  // Pressure drops linearly with distance
  const basePressure = Math.max(0, 100 - (distance / maxDistance) * 100);

  // Reduce pressure if feeding many sprinkler heads
  const headCount = countDownstreamHeads(pipe, system);
  const capacity = getPipeCapacity(pipe.pipeType);
  const capacityPenalty = Math.max(0, (headCount - capacity) * 2);

  return Math.max(0, basePressure - capacityPenalty);
}
```

**Coverage Calculation:**
```typescript
function getSprinklerCoverage(
  head: SprinklerHead,
  pressure: number
): { x: number; y: number; efficiency: number }[] {
  const basePattern = SPRINKLER_PATTERNS[head.sprinklerType];
  const pressureMultiplier = pressure / 100;  // Reduce radius if low pressure

  return basePattern.map(tile => ({
    x: head.gridX + tile.offsetX,
    y: head.gridY + tile.offsetY,
    efficiency: tile.baseEfficiency * pressureMultiplier
  }));
}
```

**Leak Probability:**
```typescript
function calculateLeakChance(
  pipe: PipeTile,
  currentTime: number,
  weather: WeatherEffect | undefined
): number {
  const age = currentTime - pipe.installDate;
  const baseChance = PIPE_LEAK_RATES[pipe.pipeType];

  let chance = 0;
  if (age > PIPE_WARRANTY_PERIOD[pipe.pipeType]) {
    const daysOverWarranty = (age - PIPE_WARRANTY_PERIOD[pipe.pipeType]) / (60 * 24);
    chance = baseChance * daysOverWarranty;
  }

  // Weather modifiers
  if (weather?.type === 'stormy') chance *= 1.5;
  if (weather?.temperature < 32) chance *= 2.0;  // Freezing

  // Durability modifier
  const durabilityFactor = (100 - pipe.durability) / 100;
  chance *= (1 + durabilityFactor);

  return Math.min(chance, 0.5);  // Cap at 50% per day
}
```

---

## 10. Success Metrics

### 10.1 Technical Metrics
- [ ] All unit tests passing (>90% coverage)
- [ ] E2E tests for placement, operation, repair
- [ ] Performance: 60 FPS with 1000+ pipe tiles
- [ ] No memory leaks during 1hr playtest

### 10.2 Gameplay Metrics
- [ ] Players unlock piped irrigation in 70%+ of playthroughs
- [ ] Average break-even time: 6-12 game months
- [ ] 80%+ player satisfaction ("feels intuitive")
- [ ] Reduced manual watering by 90% when pipes installed

### 10.3 Balance Metrics
- [ ] Early-game manual watering remains viable
- [ ] Mid-game pipe investment pays off
- [ ] Late-game automation essential for large courses
- [ ] Water costs are 5-10% of total operating budget

---

## 11. Open Questions & Decisions Needed

### 11.1 Design Decisions

**Q: Should pipes be visible above ground or underground?**
- **Option A:** Underground (realistic) - shown only in "irrigation overlay" mode
- **Option B:** Above ground (SimCity-style) - always visible, color-coded
- **Recommendation:** Option B for clarity, toggle with Tab (like current overlays)

**Q: Can players remove pipes and get refund?**
- **Option A:** Yes, 50% refund if <30 days old, 25% if older
- **Option B:** No refund, pipes are permanent investment
- **Recommendation:** Option A for flexibility

**Q: Should sprinkler heads work without pipes (mobile standalone)?**
- **Option A:** Yes, but require refilling like current system
- **Option B:** No, must be connected to pipes
- **Recommendation:** Option A for backward compatibility

**Q: How to handle overlapping sprinkler coverage?**
- **Option A:** Waste water (realistic)
- **Option B:** Automatically skip overlapping tiles (forgiving)
- **Recommendation:** Option B + warning message for player to optimize

### 11.2 Technical Decisions

**Q: Store pipes in terrain grid or separate data structure?**
- **Option A:** Add `pipe: PipeTile | null` to `CellState`
- **Option B:** Separate `Map<string, PipeTile>` with key "x,y"
- **Recommendation:** Option B for cleaner separation

**Q: Render pipes in GrassSystem or new IrrigationSystem?**
- **Option A:** GrassSystem (centralized rendering)
- **Option B:** New `IrrigationRenderSystem` (modular)
- **Recommendation:** Option B for maintainability

**Q: Pathfinding for water flow?**
- **Option A:** BFS from water source each tick
- **Option B:** Cache flow paths, invalidate on pipe changes
- **Recommendation:** Option B for performance

---

## 12. Next Steps

1. **Review & Approve** this plan with stakeholders
2. **Create sprites** for pipes and sprinkler heads (art task)
3. **Implement Phase 1** (core data layer + tests)
4. **Prototype** pipe placement UI in sandbox mode
5. **Iterate** based on playtest feedback
6. **Balance** costs and benefits
7. **Ship** as major feature update

---

## Appendix: Visual Reference

### SimCity Pipe Inspiration
```
Classic SimCity (1989) pipe tiles:
┌─┬─┬─┐
│ │─│ │  Straight pipes with perpendicular connectors
├─┼─┼─┤
│─│ │─│  Blue tinting, simple pixel art
└─┴─┴─┘
```

### Coverage Visualization Mockup
```
Rotary Sprinkler Coverage (5×5):
  . . ░ . .
  . ░ ▒ ░ .
  ░ ▒ █ ▒ ░   █ = head, ▒ = 100% coverage, ░ = 80%, . = 0%
  . ░ ▒ ░ .
  . . ░ . .
```

### Pressure Color Coding
```
🟦 Blue    = 80-100% pressure (optimal)
🟨 Yellow  = 40-79% pressure (reduced efficiency)
🟥 Red     = 0-39% pressure (barely functional)
⬛ Gray    = Disconnected (no water source)
🔴 Pulse  = Leak detected
```

---

**Document Version:** 1.1
**Last Updated:** 2026-01-31
**Status:** Implemented (see `src/core/irrigation.ts`)
