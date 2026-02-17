# Research Tree System Design Specification

## Overview

The Research Tree is the primary progression system that unlocks new equipment, technologies, and capabilities over time. Inspired by RollerCoaster Tycoon's research system, players allocate funding to research and gradually unlock new tools to improve course efficiency and quality.

### Core Philosophy

**"Investment in innovation pays long-term dividends."**

- Research requires ongoing funding commitment
- Higher tiers unlock more powerful but expensive options
- Multiple paths allow different playstyles (automation vs. manual, efficiency vs. quality)
- The ultimate goal is autonomous, high-quality course maintenance with minimal staff

---

## Research Categories

| Category | Focus | Example Unlocks |
|----------|-------|-----------------|
| Equipment | Mowing and maintenance vehicles | Riding mowers, fairway mowers, greens mowers |
| Fertilizers | Nutrient application | Premium fertilizers, slow-release, organic |
| Irrigation | Watering systems | Sprinklers, smart irrigation, moisture sensors |
| Landscaping | Course features | Bunker rakes, aesthetic upgrades |
| Facilities | Buildings and amenities | Clubhouse upgrades, pro shop improvements |
| Management | Efficiency improvements | Staff training, weather prediction |
| Robotics | Autonomous equipment | Robot mowers, auto-sprayers |
| **Turf Science** | Grass varieties and soil | Elite grass strains, soil amendments |

---

## Research Funding

### Funding Levels

All rates are in **game time** (see GAME_OVERVIEW.md for time scale).

| Level | Points/Min | Cost/Day (game) | Cost/Month (game) | Description |
|-------|------------|-----------------|-------------------|-------------|
| None | 0 | $0 | $0 | No research progress |
| Minimum | 1 | $72 | $2,160 | Slow but affordable |
| Normal | 3 | $216 | $6,480 | Balanced approach |
| Maximum | 6 | $432 | $12,960 | Fast but expensive |

**Cost Calculation:**
- Points/minute × Cost per point = Total cost/minute
- Example: Normal funding = 3 pts/min × $0.05/pt = $0.15/game minute
- Per day: $0.15/min × 1,440 min/day = $216/game day
- Per month: $216/day × 30 days = $6,480/game month

**At 5x speed:** Maximum funding ($12,960/month) costs ~2.4 real hours to complete a month.

### Research Points

Each research item requires a certain number of points to complete. Higher-tier items cost significantly more points.

```
Time to Complete (game time) = Research Points / Points per Minute
```

**Examples:**

| Research Item | Points | At Minimum | At Normal | At Maximum | Real Time (5x speed) |
|---------------|--------|------------|-----------|------------|---------------------|
| Tier 2 item | 400 | 400 min (6.7 hrs) | 133 min (2.2 hrs) | 67 min (1.1 hrs) | 13 min |
| Tier 3 item | 1,200 | 1,200 min (20 hrs) | 400 min (6.7 hrs) | 200 min (3.3 hrs) | 40 min |
| Tier 4 item | 2,500 | 2,500 min (41.7 hrs) | 833 min (13.9 hrs) | 417 min (6.9 hrs) | 1.4 hrs |
| Tier 5 robot | 7,000 | 7,000 min (116.7 hrs) | 2,333 min (38.9 hrs) | 1,167 min (19.4 hrs) | 3.9 hrs |
| UltraGreen Genesis | 10,000 | 10,000 min (166.7 hrs) | 3,333 min (55.6 hrs) | 1,667 min (27.8 hrs) | 5.6 hrs |

**Design Intent:** Major research projects take meaningful game time (hours to days) but are achievable in reasonable real-world play sessions at faster speeds.

---

## Research Tier Structure

### Tier 1: Starting Equipment (Free)
- Basic Push Mower

### Tier 2: Early Game ($300-500 points)
- Basic Riding Mower
- Manual Sprinkler System
- Standard Fertilizer

### Tier 3: Mid Game ($600-1,200 points)
- Commercial Riding Mower
- Automated Sprinkler System
- Premium Fertilizer

### Tier 4: Advanced ($1,500-2,500 points)
- Fairway Mower
- Greens Mower
- Smart Irrigation System
- Slow-Release Fertilizer
- Bunker Rake Machine

### Tier 5: Elite ($3,000-8,000 points)
- Precision Greens Complex
- Organic Bio-Fertilizer
- Weather Monitoring System
- Premium Clubhouse
- **Robot Mowers** (see Robotics section)
- **Elite Grass Varieties** (see Turf Science section)

---

## Robotics Category (Tier 5)

The pinnacle of the research tree - autonomous equipment that operates 24/7 without staff.

### Robot Equipment Philosophy

**High Capital Cost, Low Operating Cost**

Robots represent a significant upfront investment but dramatically reduce ongoing labor costs. They come with tradeoffs:

| Aspect | Traditional Equipment | Robot Equipment |
|--------|----------------------|-----------------|
| Purchase Cost | $5,000-$15,000 | $28,000-$65,000 |
| Operating Cost | $15-25/hour (wages) | $1.50-$3.00/hour (power) |
| Availability | 8-hour shifts | 24/7 operation |
| Breakdowns | Rare, quick fix | Regular, needs mechanic |
| Quality | Depends on operator | Consistent |

### Available Robots

#### RoboMow Fairway Unit
- **Research Cost:** 6,000 points
- **Prerequisites:** Fairway Mower, Smart Irrigation
- **Purchase:** $45,000
- **Operating:** $2.50/hour (game time)
- **Breakdown Rate:** 2% per 100 operating hours (~4 breakdowns/month with 24/7 operation)
- **Repair Time:** 60 game minutes (1 real second)

#### RoboMow Precision Greens
- **Research Cost:** 7,000 points
- **Prerequisites:** Greens Mower, Precision Greens Complex
- **Purchase:** $65,000
- **Operating:** $3.00/hour (game time)
- **Breakdown Rate:** 2.5% per 100 operating hours (~5 breakdowns/month)
- **Repair Time:** 90 game minutes (1.5 real seconds)

#### AutoSpray Irrigation Robot
- **Research Cost:** 5,500 points
- **Prerequisites:** Smart Irrigation
- **Purchase:** $38,000
- **Operating:** $2.00/hour (game time)
- **Breakdown Rate:** 1.5% per 100 operating hours (~3 breakdowns/month)
- **Repair Time:** 45 game minutes (0.75 real seconds)

#### NutriBot Spreader
- **Research Cost:** 5,000 points
- **Prerequisites:** Slow-Release Fertilizer, Smart Irrigation
- **Purchase:** $35,000
- **Operating:** $1.80/hour (game time)
- **Breakdown Rate:** 1.8% per 100 operating hours (~4 breakdowns/month)
- **Repair Time:** 50 game minutes (0.83 real seconds)

#### SandBot Bunker Groomer
- **Research Cost:** 4,500 points
- **Prerequisites:** Bunker Rake Machine
- **Purchase:** $28,000
- **Operating:** $1.50/hour (game time)
- **Breakdown Rate:** 3% per 100 operating hours (sand is harsh, ~6 breakdowns/month)
- **Repair Time:** 40 game minutes (0.67 real seconds)

#### Fleet Management AI
- **Research Cost:** 8,000 points
- **Prerequisites:** RoboMow Fairway, AutoSpray
- **Benefit:** Reduces all robot breakdown rates by 40% (e.g., 2% becomes 1.2%)
- **Purchase:** $50,000 (one-time)

**Note on Time Scale:** All rates use game time as defined in GAME_OVERVIEW.md (1 real second = 1 game minute). Robot breakdown rates are realistic - premium robots operating 24/7 require periodic maintenance, averaging 2-6 service events per month depending on model.

### Robot Operations

```typescript
interface RobotOperationState {
  robotId: string;
  status: 'idle' | 'operating' | 'broken' | 'repairing';

  // Operating stats
  totalOperatingHours: number;     // Lifetime hours
  hoursOperatedToday: number;
  tilesProcessedToday: number;

  // Breakdown tracking
  hoursSinceLastBreakdown: number; // For breakdown probability calculation
  lastBreakdown: GameTime | null;
  breakdownsThisMonth: number;
  currentRepairProgress: number;   // 0-100%

  // Cost tracking
  operatingCostToday: number;
  repairCostToday: number;
}

// Breakdown probability check (called every game hour)
function checkBreakdown(robot: RobotOperationState, breakdownRate: number): boolean {
  // breakdownRate is "per 100 hours" (e.g., 2.0 = 2% per 100 hours)
  // Convert to hourly probability: 2% / 100 = 0.02% per hour = 0.0002
  const hourlyProbability = breakdownRate / 100 / 100;
  return Math.random() < hourlyProbability;
}
```

---

## Turf Science Category (NEW)

The Turf Science research branch unlocks advanced grass varieties that can be planted on individual tiles. Each grass variety has unique characteristics affecting maintenance requirements, visual quality, and prestige impact.

### Design Philosophy

**"You get what you pay for - or do you?"**

Grass varieties present strategic tradeoffs:
- **Hardy varieties** require less maintenance but may look "rough" (prestige penalty)
- **Premium varieties** look stunning but demand intensive care
- **Elite varieties** offer the best of both worlds at astronomical cost

This creates interesting decisions:
- Use hardy grass on out-of-play areas to save on water/fertilizer
- Reserve premium grass for greens and high-visibility areas
- Invest in elite grass for championship-caliber presentation

### Grass Variety Tiers

#### Tier 2: Basic Alternatives (400-600 points)

##### Kentucky Bluegrass (Standard)
- **Research Cost:** 0 (starting grass)
- **Planting Cost:** $0/tile
- **Water Need:** 100% (baseline)
- **Fertilizer Need:** 100% (baseline)
- **Prestige Modifier:** 0
- **Description:** The default grass variety. Reliable but demanding.

##### Tall Fescue Blend
- **Research Cost:** 400 points
- **Planting Cost:** $5/tile
- **Water Need:** 70% of baseline
- **Fertilizer Need:** 80% of baseline
- **Prestige Modifier:** -5 per 100 tiles
- **Suitable For:** Roughs, out-of-play areas
- **Description:** Drought-tolerant but coarser texture. Golfers notice the difference on fairways.

##### Perennial Ryegrass
- **Research Cost:** 500 points
- **Planting Cost:** $8/tile
- **Water Need:** 90% of baseline
- **Fertilizer Need:** 110% of baseline
- **Prestige Modifier:** +3 per 100 tiles
- **Suitable For:** Fairways, tee boxes
- **Description:** Quick to establish with excellent color. Slightly more demanding.

#### Tier 3: Improved Varieties (800-1,200 points)

##### Drought-Resistant Bermuda
- **Research Cost:** 800 points
- **Planting Cost:** $15/tile
- **Water Need:** 50% of baseline
- **Fertilizer Need:** 75% of baseline
- **Prestige Modifier:** -8 per 100 tiles
- **Suitable For:** Warm climates, water-restricted areas
- **Description:** Thrives with minimal water but has a "weedy" appearance that discerning golfers dislike.

##### Fine Fescue Mix
- **Research Cost:** 900 points
- **Planting Cost:** $12/tile
- **Water Need:** 60% of baseline
- **Fertilizer Need:** 65% of baseline
- **Prestige Modifier:** -3 per 100 tiles
- **Suitable For:** Roughs, naturalized areas
- **Description:** Low-maintenance with acceptable appearance. Popular for environmental sustainability.

##### Premium Bentgrass (Fairway Grade)
- **Research Cost:** 1,100 points
- **Planting Cost:** $25/tile
- **Water Need:** 120% of baseline
- **Fertilizer Need:** 130% of baseline
- **Prestige Modifier:** +10 per 100 tiles
- **Suitable For:** Fairways, approach areas
- **Description:** Luxurious appearance with tight grain. Requires dedicated maintenance.

##### Creeping Bentgrass (Putting Grade)
- **Research Cost:** 1,200 points
- **Planting Cost:** $40/tile
- **Water Need:** 140% of baseline
- **Fertilizer Need:** 150% of baseline
- **Prestige Modifier:** +20 per 100 tiles (greens only)
- **Suitable For:** Putting greens only
- **Description:** The gold standard for putting surfaces. Demands intensive care.

#### Tier 4: Engineered Varieties (1,500-2,500 points)

##### HydroSmart Fescue
- **Research Cost:** 1,500 points
- **Planting Cost:** $50/tile
- **Water Need:** 40% of baseline
- **Fertilizer Need:** 60% of baseline
- **Prestige Modifier:** 0 (neutral)
- **Suitable For:** All areas except greens
- **Description:** Genetically selected for water efficiency without sacrificing appearance. A breakthrough in sustainable turf.

##### NutriMax Bermuda
- **Research Cost:** 1,800 points
- **Planting Cost:** $45/tile
- **Water Need:** 65% of baseline
- **Fertilizer Need:** 40% of baseline
- **Prestige Modifier:** -2 per 100 tiles
- **Suitable For:** Fairways, tee boxes
- **Description:** Engineered for nutrient efficiency. Slight texture compromise.

##### TourGrade Bentgrass
- **Research Cost:** 2,200 points
- **Planting Cost:** $75/tile
- **Water Need:** 100% of baseline
- **Fertilizer Need:** 100% of baseline
- **Prestige Modifier:** +25 per 100 tiles
- **Suitable For:** Fairways, greens
- **Description:** Championship-quality turf used on PGA Tour venues. Standard maintenance with superior appearance.

##### Championship Zoysia
- **Research Cost:** 2,500 points
- **Planting Cost:** $80/tile
- **Water Need:** 55% of baseline
- **Fertilizer Need:** 70% of baseline
- **Prestige Modifier:** +15 per 100 tiles
- **Suitable For:** All areas
- **Description:** Slow-growing luxury grass. Reduced mowing needs with excellent visual appeal.

#### Tier 5: Elite Varieties (4,000-10,000 points)

##### Augusta Hybrid Bentgrass
- **Research Cost:** 6,000 points
- **Planting Cost:** $200/tile
- **Water Need:** 80% of baseline
- **Fertilizer Need:** 85% of baseline
- **Prestige Modifier:** +40 per 100 tiles
- **Suitable For:** All areas
- **Description:** Developed from Augusta National genetics. Premium appearance with improved resilience. The grass that dreams are made of.

##### UltraGreen Genesis
- **Research Cost:** 10,000 points
- **Planting Cost:** $500/tile
- **Water Need:** 50% of baseline
- **Fertilizer Need:** 50% of baseline
- **Prestige Modifier:** +50 per 100 tiles
- **Suitable For:** All areas
- **Description:** The ultimate grass variety. Genetically engineered perfection - stunning appearance, minimal maintenance, maximum prestige. Astronomical cost is the only barrier.

### Grass Variety Summary Table

| Variety | Tier | Plant $/tile | Water | Fert | Prestige |
|---------|------|--------------|-------|------|----------|
| Kentucky Bluegrass | 1 | $0 | 100% | 100% | 0 |
| Tall Fescue | 2 | $5 | 70% | 80% | -5 |
| Perennial Ryegrass | 2 | $8 | 90% | 110% | +3 |
| Drought Bermuda | 3 | $15 | 50% | 75% | -8 |
| Fine Fescue | 3 | $12 | 60% | 65% | -3 |
| Premium Bentgrass | 3 | $25 | 120% | 130% | +10 |
| Creeping Bentgrass | 3 | $40 | 140% | 150% | +20 |
| HydroSmart Fescue | 4 | $50 | 40% | 60% | 0 |
| NutriMax Bermuda | 4 | $45 | 65% | 40% | -2 |
| TourGrade Bentgrass | 4 | $75 | 100% | 100% | +25 |
| Championship Zoysia | 4 | $80 | 55% | 70% | +15 |
| Augusta Hybrid | 5 | $200 | 80% | 85% | +40 |
| **UltraGreen Genesis** | 5 | **$500** | **50%** | **50%** | **+50** |

### Grass Planting Mechanics

#### Per-Tile Planting

Players can select grass varieties and paint them onto tiles:

```typescript
interface GrassTile {
  gridX: number;
  gridY: number;
  terrainType: TerrainType;

  // Grass properties
  grassVariety: GrassVarietyId;
  health: number;           // 0-100
  moisture: number;         // 0-100
  nutrients: number;        // 0-100

  // Maintenance modifiers (from grass variety)
  waterNeedMultiplier: number;
  fertilizerNeedMultiplier: number;
  prestigeModifier: number;

  // Planting tracking
  plantedDate: GameDate;
  establishmentProgress: number;  // 0-100, new grass takes time
}
```

#### Establishment Period

New grass takes time to fully establish:

| Variety Type | Establishment Time | During Establishment |
|--------------|-------------------|---------------------|
| Standard | 14 days | 150% water need, no prestige bonus |
| Engineered | 21 days | 130% water need, 50% prestige bonus |
| Elite | 30 days | 120% water need, 25% prestige bonus |

#### Replacement Cost Warning

When replacing existing grass:
- Old grass must be removed (adds 20% to planting cost)
- Soil preparation required (3-day waiting period)
- Adjacent tile contamination risk (10% chance old grass spreads back)

### Grass Variety UI

#### Variety Selection Panel

```
┌─────────────────────────────────────────────────────────────────────────┐
│  GRASS VARIETIES                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  UNLOCKED VARIETIES                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🌱 Kentucky Bluegrass          [DEFAULT]                       │   │
│  │  Water: ████████████ 100%   Prestige: ═════ Neutral            │   │
│  │  Fert:  ████████████ 100%   Cost: FREE                         │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │  🌿 Tall Fescue Blend           [SELECT]                        │   │
│  │  Water: ███████░░░░░ 70%    Prestige: ══▼══ -5/100 tiles       │   │
│  │  Fert:  ████████░░░░ 80%    Cost: $5/tile                      │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │  ⭐ TourGrade Bentgrass         [SELECT]                        │   │
│  │  Water: ████████████ 100%   Prestige: ══▲▲══ +25/100 tiles     │   │
│  │  Fert:  ████████████ 100%   Cost: $75/tile                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  LOCKED VARIETIES                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🔒 UltraGreen Genesis (10,000 pts)                             │   │
│  │  The ultimate grass - no tradeoffs, $500/tile                   │   │
│  │  Prerequisites: Augusta Hybrid, Fleet Management AI             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  PAINT MODE: [●] Single Tile  [○] Area Fill  [○] Terrain Type          │
│                                                                          │
│  Selected: TourGrade Bentgrass                                          │
│  Tiles to paint: 47       Total cost: $3,525                           │
│                                                                          │
│  [Apply Changes - $3,525]  [Cancel]                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Grass Variety Overlay

When Tab-cycling overlays, add a "Grass Variety" view:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  OVERLAY: Grass Varieties                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  🟦 Kentucky Bluegrass (Standard)                                        │
│  🟩 Tall Fescue (Drought-resistant)                                      │
│  🟨 TourGrade Bentgrass (Premium)                                        │
│  🟪 UltraGreen Genesis (Elite)                                           │
│                                                                          │
│  Course Breakdown:                                                       │
│  ├─ Greens:   100% Creeping Bentgrass                                   │
│  ├─ Fairways: 60% TourGrade, 40% Kentucky                              │
│  ├─ Roughs:   80% Tall Fescue, 20% Fine Fescue                         │
│  └─ Tees:     100% TourGrade Bentgrass                                  │
│                                                                          │
│  Daily Savings: -$45 water, -$32 fertilizer                             │
│  Prestige Impact: +127 points                                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Research Tree Data Structure

```typescript
interface GrassVariety {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tier: number;

  // Costs
  readonly researchCost: number;         // Research points to unlock
  readonly plantingCostPerTile: number;  // $ per tile

  // Maintenance modifiers (1.0 = baseline)
  readonly waterNeedMultiplier: number;
  readonly fertilizerNeedMultiplier: number;
  readonly mowingFrequencyMultiplier: number;  // How often needs mowing

  // Quality
  readonly prestigeModifierPer100Tiles: number;
  readonly visualQuality: number;        // 1-10, affects appearance

  // Restrictions
  readonly suitableTerrainTypes: TerrainType[];
  readonly establishmentDays: number;

  // Prerequisites
  readonly prerequisites: string[];      // Research IDs required
}

// Add to research category
export type ResearchCategory =
  | "equipment"
  | "fertilizers"
  | "irrigation"
  | "landscaping"
  | "facilities"
  | "management"
  | "robotics"
  | "turf_science";  // NEW

export const GRASS_VARIETIES: readonly GrassVariety[] = [
  {
    id: "kentucky_bluegrass",
    name: "Kentucky Bluegrass",
    description: "The default grass variety. Reliable but demanding.",
    tier: 1,
    researchCost: 0,
    plantingCostPerTile: 0,
    waterNeedMultiplier: 1.0,
    fertilizerNeedMultiplier: 1.0,
    mowingFrequencyMultiplier: 1.0,
    prestigeModifierPer100Tiles: 0,
    visualQuality: 5,
    suitableTerrainTypes: ["fairway", "rough", "tee", "green"],
    establishmentDays: 0,
    prerequisites: []
  },
  // ... additional varieties
  {
    id: "ultragreen_genesis",
    name: "UltraGreen Genesis",
    description: "Genetically engineered perfection. Stunning appearance, minimal maintenance, maximum prestige.",
    tier: 5,
    researchCost: 10000,
    plantingCostPerTile: 500,
    waterNeedMultiplier: 0.5,
    fertilizerNeedMultiplier: 0.5,
    mowingFrequencyMultiplier: 0.7,
    prestigeModifierPer100Tiles: 50,
    visualQuality: 10,
    suitableTerrainTypes: ["fairway", "rough", "tee", "green"],
    establishmentDays: 30,
    prerequisites: ["augusta_hybrid", "robot_fleet_manager"]
  }
];
```

---

## Strategic Considerations

### Early Game Strategy

1. Start with default Kentucky Bluegrass everywhere
2. Research Tall Fescue for roughs to reduce water costs
3. Focus on equipment research before turf science
4. Accept slight prestige penalty for cost savings

### Mid Game Strategy

1. Upgrade greens to Creeping Bentgrass (+20 prestige)
2. Use HydroSmart Fescue on fairways (40% water savings)
3. Balance prestige gains against maintenance costs
4. Consider TourGrade for high-visibility areas

### Late Game Strategy

1. Research UltraGreen Genesis as ultimate goal
2. Convert high-traffic areas first (greens, fairways near clubhouse)
3. Pair with robot equipment for fully automated, premium course
4. Use variety mix to optimize cost vs. prestige

### Economic Analysis

**Scenario: 18-hole course, 5,000 fairway tiles**

| Strategy | Planting Cost | Daily Water | Daily Fert | Prestige |
|----------|---------------|-------------|------------|----------|
| All Kentucky | $0 | $100 | $100 | 0 |
| Mixed (Fescue roughs) | $15,000 | $75 | $85 | -15 |
| TourGrade fairways | $375,000 | $100 | $100 | +125 |
| UltraGreen everything | $2,500,000 | $50 | $50 | +250 |

The $2.5M investment in UltraGreen pays back over ~4 years in reduced maintenance while providing maximum prestige immediately.

---

## Implementation Priority

### Phase 1: Core Grass Variety System
1. Add turf_science research category
2. Implement 3-4 basic grass varieties
3. Per-tile grass tracking
4. Basic planting UI

### Phase 2: Maintenance Integration
1. Water/fertilizer multipliers
2. Prestige calculation integration
3. Establishment period mechanics
4. Grass variety overlay

### Phase 3: Advanced Varieties
1. Tier 4-5 engineered varieties
2. UltraGreen Genesis (ultimate tier)
3. Strategic AI recommendations
4. Economic analysis panel

### Phase 4: Visual Polish
1. Distinct visual appearance per variety
2. Health-based color variation
3. Seasonal appearance changes
4. Establishment growth animation

---

## Summary

The Research Tree provides long-term progression through:

1. **Equipment Progression** - From push mowers to autonomous robots
2. **Efficiency Improvements** - Better fertilizers, smart irrigation, staff training
3. **Turf Science** - Grass varieties with strategic tradeoffs
4. **Ultimate Goals** - Robot fleet + UltraGreen Genesis = fully automated championship course

The grass variety system creates meaningful decisions:
- Hardy grass saves money but costs prestige
- Premium grass looks great but demands maintenance
- Elite grass offers no tradeoffs but requires massive investment

This mirrors the robot equipment philosophy: expensive upfront, but eliminates ongoing headaches. Players who invest wisely in both robots AND elite grass can achieve the dream of a self-maintaining, championship-caliber course.
