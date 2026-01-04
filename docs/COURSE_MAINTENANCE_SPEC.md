# Course Maintenance System Design Specification

## Overview

The Course Maintenance System is the **core gameplay loop** of Greenkeeper Simulator. Players manage grass health across the course by balancing three primary activities: mowing, watering, and fertilizing. This creates a satisfying maintenance cycle where neglect leads to visible decline and attentive care produces pristine conditions.

### Core Philosophy

**"A golf course is a living thing that demands constant attention."**

- Grass grows continuously and requires regular mowing
- Moisture and nutrients deplete over time
- Health degrades when needs aren't met
- Different terrain types have different requirements
- The player must prioritize and manage resources efficiently

---

## Terrain System

### Terrain Types

| Type | Description | Mowable | Waterable | Fertilizable |
|------|-------------|---------|-----------|--------------|
| Fairway | Primary playing surface | Yes | Yes | Yes |
| Rough | Longer grass bordering fairways | Yes | Yes | Yes |
| Green | Putting surface, most demanding | Yes | Yes | Yes |
| Tee | Teeing ground | Yes | Yes | Yes |
| Bunker | Sand traps | No | Partial* | No |
| Water | Ponds, streams | No | No | No |

*Bunkers receive 50% watering effectiveness (for sand consistency)

### Initial Terrain Values

Each terrain type starts with different baseline conditions:

```typescript
const INITIAL_VALUES: Record<TerrainType, TerrainValues> = {
  fairway: { height: 30, moisture: 60, nutrients: 70 },
  rough:   { height: 70, moisture: 50, nutrients: 50 },
  green:   { height: 10, moisture: 70, nutrients: 80 },
  tee:     { height: 15, moisture: 65, nutrients: 75 },
  bunker:  { height: 0,  moisture: 20, nutrients: 0 },
  water:   { height: 0,  moisture: 100, nutrients: 0 }
};
```

### Height Thresholds

Different terrain types have different acceptable height ranges:

| Terrain | Mown Height | Growing Height | Unmown (Overgrown) |
|---------|-------------|----------------|-------------------|
| Green | 0-10 | 11-22 | 23+ |
| Tee | 0-12 | 13-25 | 26+ |
| Fairway | 0-20 | 21-45 | 46+ |
| Rough | 0-30 | 31-60 | 61+ |

When grass exceeds the "growing" threshold, it becomes visually overgrown and negatively impacts course health.

---

## Cell State

Each tile on the course maintains its own state:

```typescript
interface CellState {
  // Position
  x: number;
  y: number;

  // Terrain
  type: TerrainType;
  elevation: number;
  obstacle: ObstacleType;  // none, tree, pine_tree, shrub, bush

  // Grass properties (0-100 scale)
  height: number;      // Current grass height
  moisture: number;    // Water saturation level
  nutrients: number;   // Fertilizer/nutrient level
  health: number;      // Calculated overall health

  // Grass variety (see RESEARCH_TREE_SPEC.md - Turf Science section)
  grassVariety: string;  // e.g., "kentucky_bluegrass", "tourgrade_bentgrass"
  waterNeedMultiplier: number;      // From variety, default 1.0
  fertilizerNeedMultiplier: number; // From variety, default 1.0
  mowingFrequencyMultiplier: number; // From variety, default 1.0
  prestigeModifier: number;          // From variety, per 100 tiles

  // Tracking
  lastMowed: number;      // Game time of last mow
  lastWatered: number;    // Game time of last water
  lastFertilized: number; // Game time of last fertilize
}
```

---

## Health Calculation

Health is the primary metric for course quality, calculated from three factors:

```typescript
function calculateHealth(cell: CellState): number {
  if (!isGrassTerrain(cell.type)) {
    return 100; // Non-grass always "healthy"
  }

  // Weight factors
  const moistureScore = cell.moisture * 0.30;      // 30% weight
  const nutrientScore = cell.nutrients * 0.30;    // 30% weight
  const heightScore = (100 - Math.min(cell.height, 100)) * 0.40; // 40% weight

  return clamp(moistureScore + nutrientScore + heightScore, 0, 100);
}
```

### Health Breakdown

| Factor | Weight | Optimal | Impact |
|--------|--------|---------|--------|
| Moisture | 30% | 100 | Low moisture = stressed grass |
| Nutrients | 30% | 100 | Low nutrients = weak growth |
| Height | 40% | 0 (freshly mown) | Overgrown = unhealthy appearance |

### Health States

| Health Range | Condition | Visual | Course Rating Impact |
|--------------|-----------|--------|---------------------|
| 80-100 | Excellent | Vibrant green | Prestige bonus |
| 60-79 | Good | Healthy green | Neutral |
| 40-59 | Fair | Yellowish | Prestige penalty |
| 20-39 | Poor | Brown patches | Significant penalty |
| 0-19 | Dead | Brown/bare | Severe penalty |

---

## Growth Simulation

Grass grows continuously based on conditions:

```typescript
function simulateGrowth(cell: CellState, deltaMinutes: number): GrowthResult {
  if (!isGrassTerrain(cell.type)) {
    return unchanged(cell);
  }

  // Base growth rate (height units per minute)
  let growthRate = 0.1;

  // Modifiers
  if (cell.moisture > 50) growthRate += 0.05;   // Well-watered grows faster
  if (cell.nutrients > 50) growthRate += 0.10;  // Fertilized grows faster
  if (cell.health < 30) growthRate -= 0.05;     // Unhealthy grows slower

  // Grass variety mowing frequency modifier (see RESEARCH_TREE_SPEC.md)
  // Lower frequency = slower growth (e.g., 0.7 = 30% slower growth)
  growthRate *= cell.mowingFrequencyMultiplier;

  // Apply growth
  const newHeight = Math.min(100, cell.height + growthRate * deltaMinutes);

  // Decay moisture and nutrients (adjusted by grass variety needs)
  const moistureDecayRate = 0.05 * cell.waterNeedMultiplier;
  const nutrientDecayRate = 0.02 * cell.fertilizerNeedMultiplier;

  const newMoisture = Math.max(0, cell.moisture - moistureDecayRate * deltaMinutes);
  const newNutrients = Math.max(0, cell.nutrients - nutrientDecayRate * deltaMinutes);

  return {
    height: newHeight,
    moisture: newMoisture,
    nutrients: newNutrients,
    health: recalculateHealth(...)
  };
}
```

### Decay Rates

| Resource | Decay Rate | Time to Empty | Notes |
|----------|------------|---------------|-------|
| Moisture | 0.05/min × variety multiplier | ~33 hours (baseline) | Modified by grass variety; faster in hot weather (future) |
| Nutrients | 0.02/min × variety multiplier | ~83 hours (baseline) | Modified by grass variety; slower, longer-lasting |
| Height | +0.1/min (growth) × variety multiplier | Mow every ~6-8 hours (baseline) | Modified by grass variety; varies by conditions |

**Note:** Grass variety multipliers from RESEARCH_TREE_SPEC.md Turf Science section. For example, UltraGreen Genesis has 0.5× water and fertilizer needs, reducing maintenance costs by 50%.

### Growth Rate Modifiers

| Condition | Growth Rate Change |
|-----------|-------------------|
| Moisture > 50 | +0.05/min |
| Nutrients > 50 | +0.10/min |
| Health < 30 | -0.05/min |
| **Combined max** | **+0.25/min** |

---

## Maintenance Actions

### Mowing

Cuts grass height to zero on affected tiles.

```typescript
function applyMowing(cell: CellState): CellState | null {
  if (!isGrassTerrain(cell.type)) {
    return null; // Cannot mow non-grass
  }

  return {
    ...cell,
    height: 0,
    lastMowed: currentTime,
    health: recalculateHealth(...)
  };
}
```

**Mowing characteristics:**
- Effect: Sets height to 0
- Radius: 1 tile (single tile per action)
- Resource: Fuel
- Frequency: Every 6-8 game hours for optimal health

**Visual feedback:**
- Mown grass shows stripe patterns
- Overgrown grass appears shaggy
- Fresh mow creates visible contrast

### Watering

Increases moisture level on affected tiles.

```typescript
function applyWatering(cell: CellState, amount: number): CellState | null {
  if (!isGrassTerrain(cell.type) && cell.type !== 'bunker') {
    return null;
  }

  // Bunkers receive reduced effectiveness
  let effectiveAmount = amount;
  if (cell.type === 'bunker') {
    effectiveAmount *= 0.5;
  }

  return {
    ...cell,
    moisture: Math.min(100, cell.moisture + effectiveAmount),
    lastWatered: currentTime,
    health: recalculateHealth(...)
  };
}
```

**Watering characteristics:**
- Effect: +30 moisture per application (default)
- Radius: 2 tiles
- Resource: Water
- Frequency: Every 3-4 game hours for optimal moisture

**Bunker watering:**
- Bunkers can be watered at 50% effectiveness
- Maintains sand consistency
- Prevents dust/hardening

### Fertilizing

Increases nutrient level on affected tiles.

```typescript
function applyFertilizing(cell: CellState, amount: number): CellState | null {
  if (!isGrassTerrain(cell.type)) {
    return null;
  }

  return {
    ...cell,
    nutrients: Math.min(100, cell.nutrients + amount),
    lastFertilized: currentTime,
    health: recalculateHealth(...)
  };
}
```

**Fertilizing characteristics:**
- Effect: +25 nutrients per application (default)
- Radius: 2 tiles
- Resource: Fertilizer
- Frequency: Every 6-8 game hours for optimal nutrients

---

## Course Statistics

### Average Stats Calculation

```typescript
function getAverageStats(cells: CellState[][]): CourseStats {
  let totalHealth = 0;
  let totalMoisture = 0;
  let totalNutrients = 0;
  let totalHeight = 0;
  let count = 0;

  for (const cell of allCells) {
    if (isGrassTerrain(cell.type)) {
      totalHealth += cell.health;
      totalMoisture += cell.moisture;
      totalNutrients += cell.nutrients;
      totalHeight += cell.height;
      count++;
    }
  }

  return {
    health: totalHealth / count,
    moisture: totalMoisture / count,
    nutrients: totalNutrients / count,
    height: totalHeight / count
  };
}
```

### Overall Condition Rating

```typescript
function getOverallCondition(averageHealth: number): ConditionRating {
  if (averageHealth >= 80) return 'Excellent';
  if (averageHealth >= 60) return 'Good';
  if (averageHealth >= 40) return 'Fair';
  return 'Poor';
}
```

### Cells Needing Attention

```typescript
function countCellsNeedingMowing(cells: CellState[][]): number {
  return cells.filter(c => isGrassTerrain(c.type) && c.height > 60).length;
}

function countCellsNeedingWater(cells: CellState[][]): number {
  return cells.filter(c => isGrassTerrain(c.type) && c.moisture < 30).length;
}

function countCellsNeedingFertilizer(cells: CellState[][]): number {
  return cells.filter(c => isGrassTerrain(c.type) && c.nutrients < 30).length;
}
```

---

## Visual Representation

### Texture Selection

Grass tiles display different textures based on state:

```typescript
function getTextureForCell(cell: CellState): string {
  // Dead/dying grass
  if (cell.health < 20) return "iso_grass_dead";
  if (cell.health < 40) return "iso_grass_dry";

  // Height-based appearance
  const thresholds = getTerrainThresholds(cell.type);

  if (cell.height <= thresholds.mownHeight) {
    return `iso_${cell.type}_mown`;     // e.g., "iso_fairway_mown"
  }
  if (cell.height <= thresholds.growingHeight) {
    return `iso_${cell.type}_growing`;  // e.g., "iso_fairway_growing"
  }
  return `iso_${cell.type}_unmown`;     // e.g., "iso_fairway_unmown"
}
```

### Overlay Modes

Players can cycle through visualization modes:

| Mode | Display | Purpose |
|------|---------|---------|
| Normal | Standard textures | Default view |
| Moisture | Blue gradient | Identify dry areas |
| Nutrients | Green gradient | Identify low nutrient areas |
| Height | Yellow gradient | Identify overgrown areas |

---

## Coordinate System

### Grid System

The course uses an isometric grid coordinate system:

```typescript
const TILE_WIDTH = 64;   // Pixels
const TILE_HEIGHT = 32;  // Pixels (half of width for isometric)
const ELEVATION_HEIGHT = 16; // Pixels per elevation level
```

### Grid to Screen Conversion

```typescript
function gridToScreen(
  gridX: number,
  gridY: number,
  mapWidth: number,
  elevation: number = 0
): { x: number; y: number } {
  const screenX = (gridX - gridY) * (TILE_WIDTH / 2) + (mapWidth * TILE_WIDTH) / 2;
  const screenY = (gridX + gridY) * (TILE_HEIGHT / 2) - elevation * ELEVATION_HEIGHT;
  return { x: screenX, y: screenY };
}
```

### Screen to Grid Conversion

```typescript
function screenToGrid(
  screenX: number,
  screenY: number,
  mapWidth: number
): { x: number; y: number } {
  const offsetX = screenX - (mapWidth * TILE_WIDTH) / 2;
  const isoX = (offsetX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2;
  const isoY = (screenY / (TILE_HEIGHT / 2) - offsetX / (TILE_WIDTH / 2)) / 2;
  return { x: Math.floor(isoX), y: Math.floor(isoY) };
}
```

---

## Movement and Walkability

### Walkable Terrain

```typescript
function isWalkable(cell: CellState | null): boolean {
  if (!cell) return false;
  if (cell.type === "water") return false;
  if (cell.obstacle !== "none") return false;
  return true;
}
```

### Elevation Constraints

```typescript
function canMoveFromTo(from: CellState, to: CellState): boolean {
  if (!isWalkable(to)) return false;

  // Can only traverse 1 elevation level difference
  const elevationDiff = Math.abs(to.elevation - from.elevation);
  if (elevationDiff > 1) return false;

  return true;
}
```

### Terrain Speed Modifiers

| Terrain | Speed Modifier | Notes |
|---------|----------------|-------|
| Fairway | 1.0x | Full speed |
| Green | 1.0x | Full speed |
| Tee | 1.0x | Full speed |
| Rough | 0.7x | Slower movement |
| Bunker | 0.5x | Significant slowdown |
| Water | 0.0x | Impassable |

---

## Obstacles

### Obstacle Types

| Type | Blocks Movement | Blocks Mowing | Visual |
|------|-----------------|---------------|--------|
| None | No | No | - |
| Tree | Yes | Yes | Large deciduous |
| Pine Tree | Yes | Yes | Conifer |
| Shrub | Yes | Yes | Medium bush |
| Bush | Yes | Yes | Small bush |

### Effect Radius

Equipment effects do not penetrate obstacles:
- Sprinkler water is blocked by trees
- Fertilizer spreading is blocked by obstacles
- This creates strategic placement considerations

---

## Surface Physics (Future: Ball Physics)

Each terrain type has physics properties for ball behavior:

```typescript
interface SurfacePhysics {
  friction: number;      // 0-1, higher = more stopping
  bounciness: number;    // 0-1, higher = more bounce
  rollResistance: number; // 0-1, higher = shorter roll
}

const SURFACE_PHYSICS: Record<TerrainType, SurfacePhysics> = {
  fairway: { friction: 0.4, bounciness: 0.3, rollResistance: 0.02 },
  green:   { friction: 0.3, bounciness: 0.25, rollResistance: 0.01 },
  rough:   { friction: 0.7, bounciness: 0.2, rollResistance: 0.08 },
  bunker:  { friction: 0.9, bounciness: 0.1, rollResistance: 0.15 },
  water:   { friction: 0.1, bounciness: 0.0, rollResistance: 1.0 },
  tee:     { friction: 0.35, bounciness: 0.3, rollResistance: 0.015 }
};
```

---

## Integration with Other Systems

### Prestige System

Course health directly affects the "Current Conditions" component of prestige:

```
Prestige.CurrentConditions = f(
  averageHealth,      // Primary factor
  greenHealth,        // Weighted higher
  fairwayHealth,      // Secondary
  bunkerCondition,    // Tertiary
  ...
)
```

Additionally, grass variety choices affect the "Amenities" component of prestige (see PRESTIGE_SYSTEM_SPEC.md):
- Each grass variety has a `prestigeModifierPer100Tiles` value
- Example: TourGrade Bentgrass on 200 fairway tiles = +50 prestige points
- Example: UltraGreen Genesis on 100 green tiles = +50 prestige points
- This rewards investment in premium grass varieties beyond just maintenance savings

### Golfer Satisfaction

Course condition is a major satisfaction factor:

```typescript
satisfactionFactors: {
  course_condition: averageHealth,  // 30% weight in satisfaction
  ...
}
```

### Employee Work

Groundskeepers perform maintenance actions:
- Autonomous mowing based on area assignments
- Priority-based targeting (worst areas first)
- Efficiency modified by skill level

### Research Unlocks

Research can improve maintenance:
- Better fertilizers (higher effectiveness)
- Smart irrigation (auto-targeting dry areas)
- Robot mowers (autonomous operation)

---

## UI Elements

### HUD Indicators

```
┌─────────────────────────────────────────┐
│  COURSE CONDITION: Excellent (87%)      │
│  ████████████████████░░░░  87/100       │
├─────────────────────────────────────────┤
│  Needs Mowing:     12 tiles  ⚠         │
│  Needs Watering:   34 tiles  ⚠⚠        │
│  Needs Fertilizer:  8 tiles            │
└─────────────────────────────────────────┘
```

### Overlay Legend

```
┌─────────────────────────────────────────┐
│  MOISTURE OVERLAY                       │
├─────────────────────────────────────────┤
│  ████  90-100%  Saturated              │
│  ████  60-89%   Healthy                │
│  ████  30-59%   Needs Water            │
│  ████  0-29%    Critical               │
└─────────────────────────────────────────┘
```

---

## Data Persistence

### Course State

```typescript
interface CourseState {
  // Grid
  width: number;
  height: number;
  cells: CellState[][];

  // Aggregate stats
  averageHealth: number;
  averageMoisture: number;
  averageNutrients: number;
  overallCondition: ConditionRating;

  // Tracking
  lastUpdated: number;
  totalMowingActions: number;
  totalWateringActions: number;
  totalFertilizingActions: number;
}
```

### Integration with GameState

```typescript
interface GameState {
  course: CourseState;
  player: PlayerState;
  equipment: EquipmentState[];
  economy: EconomyState;
  prestige: PrestigeState;
  // ...
}
```

---

## Balance Considerations

### Maintenance Frequency

For optimal health, the player should:

| Action | Frequency | Coverage |
|--------|-----------|----------|
| Mowing | Every 6-8 game hours | Full course |
| Watering | Every 3-4 game hours | Full course |
| Fertilizing | Every 6-8 game hours | Full course |

This creates a satisfying maintenance rhythm without being overwhelming.

### Resource Economy

| Resource | Cost per Unit | Usage Rate | Refill Cost |
|----------|---------------|------------|-------------|
| Fuel | $0.10 | 0.5/sec active | $10 per tank |
| Water | $0.05 | 1.0/sec active | $10 per tank |
| Fertilizer | $0.15 | 0.8/sec active | $15 per tank |

### Difficulty Scaling

Early game:
- Smaller courses (fewer tiles to maintain)
- Slower growth rates
- More forgiving thresholds

Late game:
- Larger courses (more tiles)
- Faster growth (championship conditions)
- Stricter health requirements for prestige

---

## Implementation Priority

### Phase 1: Core Loop
1. Cell state management
2. Health calculation
3. Growth simulation
4. Basic mowing/watering/fertilizing

### Phase 2: Visual Feedback
1. Texture selection based on state
2. Overlay modes
3. Health indicators

### Phase 3: Course Statistics
1. Average stat calculation
2. Cells needing attention counts
3. Condition rating

### Phase 4: Integration
1. Prestige system connection
2. Golfer satisfaction connection
3. Employee work connection

### Phase 5: Advanced Features
1. Weather effects on growth/decay
2. Seasonal variations
3. Disease/pest mechanics (future)

---

## Summary

The Course Maintenance System creates the core gameplay loop:

1. **Observe** - Check course condition via overlays and stats
2. **Prioritize** - Identify areas needing attention
3. **Act** - Mow, water, fertilize as needed
4. **Manage** - Balance resources and time
5. **Repeat** - Continuous maintenance cycle

This creates the satisfying "tend your garden" gameplay that makes management sims compelling, while the health calculation ensures that all three activities (mowing, watering, fertilizing) are equally important and interconnected.
