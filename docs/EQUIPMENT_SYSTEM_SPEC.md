# Equipment System Design Specification

## Overview

The Equipment System provides players with the tools needed to maintain the golf course. Each piece of equipment has a resource pool that depletes during use and must be refilled at stations. This creates resource management gameplay where players must balance equipment usage with refill time and costs.

### Core Philosophy

**"The right tool for the job, if you have the fuel."**

- Equipment enables the core maintenance actions
- Resources deplete during active use
- Empty equipment becomes inactive until refilled
- Refill stations are strategically placed on the course
- Equipment upgrades expand capabilities over time

---

## Equipment Types

### Starting Equipment

| Equipment | Purpose | Resource | Effect Radius |
|-----------|---------|----------|---------------|
| Mower | Cut grass height | Fuel | 1 tile |
| Sprinkler | Increase moisture | Water | 2 tiles |
| Spreader | Increase nutrients | Fertilizer | 2 tiles |

### Equipment Configuration

```typescript
interface EquipmentConfig {
  resourceMax: number;      // Maximum resource capacity
  resourceUseRate: number;  // Units consumed per second when active
  effectRadius: number;     // Tiles affected around player
}

const EQUIPMENT_CONFIGS: Record<EquipmentType, EquipmentConfig> = {
  mower: {
    resourceMax: 100,
    resourceUseRate: 0.5,   // 200 seconds of use
    effectRadius: 1         // Single tile
  },
  sprinkler: {
    resourceMax: 100,
    resourceUseRate: 1.0,   // 100 seconds of use
    effectRadius: 2         // 13 tiles (circular)
  },
  spreader: {
    resourceMax: 100,
    resourceUseRate: 0.8,   // 125 seconds of use
    effectRadius: 2         // 13 tiles (circular)
  }
};
```

**Design Intent - Forcing Delegation:**

Equipment capacity is calibrated to make solo maintenance progressively impractical:

| Course Size | Grass Tiles | Mower Refills Needed | Solo Playability |
|-------------|-------------|----------------------|------------------|
| 3-hole starter | ~700 | 3-4 refills | ✓ Manageable solo |
| 9-hole | ~2,600 | 13 refills | ⚠ Tedious solo, encourages first hire |
| 18-hole | ~6,000 | 30 refills | ✗ Impractical solo, requires team |
| 27-hole resort | ~7,700 | 38 refills | ✗ Impossible solo, requires large team or robots |

**Calculation Example (Mower on 9-hole course):**
- Mower capacity: 100 resource
- Use rate: 0.5 per second (game time) = 200 seconds = 3.33 game minutes of use
- Coverage: ~200 tiles per tank
- 9-hole course: ~2,600 grass tiles
- Refills needed: 2,600 / 200 = 13 refills
- Cost: 13 × $10 = $130 per complete mow
- Time: 13 trips to refill stations + mowing time = significant overhead

This design ensures players MUST hire employees or research better equipment to progress beyond starter courses. See EMPLOYEE_SYSTEM_SPEC.md and RESEARCH_TREE_SPEC.md for scaling solutions.

---

## Equipment State

```typescript
interface EquipmentState {
  type: EquipmentType;
  resourceCurrent: number;  // Current fuel/water/fertilizer
  resourceMax: number;      // Maximum capacity
  resourceUseRate: number;  // Consumption per second
  effectRadius: number;     // Effect area
  isActive: boolean;        // Currently in use
}
```

### State Transitions

```
┌─────────────┐     activate()      ┌─────────────┐
│             │ ──────────────────> │             │
│    IDLE     │                     │   ACTIVE    │
│             │ <────────────────── │             │
└─────────────┘     deactivate()    └─────────────┘
       │                                   │
       │                                   │ resource = 0
       │                                   ▼
       │                            ┌─────────────┐
       │                            │             │
       └─────── refill() ──────────│    EMPTY    │
                                    │             │
                                    └─────────────┘
```

---

## Equipment Operations

### Creating Equipment

```typescript
function createEquipmentState(type: EquipmentType): EquipmentState {
  const config = EQUIPMENT_CONFIGS[type];
  return {
    type,
    resourceCurrent: config.resourceMax,  // Start full
    resourceMax: config.resourceMax,
    resourceUseRate: config.resourceUseRate,
    effectRadius: config.effectRadius,
    isActive: false
  };
}
```

### Activation

```typescript
function activateEquipment(state: EquipmentState): EquipmentState {
  // Cannot activate if empty
  if (state.resourceCurrent <= 0) {
    return state;
  }
  return { ...state, isActive: true };
}

function deactivateEquipment(state: EquipmentState): EquipmentState {
  return { ...state, isActive: false };
}
```

### Resource Consumption

```typescript
function consumeResource(
  state: EquipmentState,
  deltaMs: number
): EquipmentState {
  if (!state.isActive || state.resourceCurrent <= 0) {
    return state;
  }

  const consumed = (state.resourceUseRate * deltaMs) / 1000;
  const newResource = Math.max(0, state.resourceCurrent - consumed);

  // Auto-deactivate when empty
  if (newResource <= 0) {
    return {
      ...state,
      resourceCurrent: 0,
      isActive: false
    };
  }

  return { ...state, resourceCurrent: newResource };
}
```

### Refilling

```typescript
function refillEquipment(state: EquipmentState): EquipmentState {
  return { ...state, resourceCurrent: state.resourceMax };
}
```

### Query Functions

```typescript
function getResourcePercent(state: EquipmentState): number {
  return (state.resourceCurrent / state.resourceMax) * 100;
}

function canActivate(state: EquipmentState): boolean {
  return state.resourceCurrent > 0;
}

function isEmpty(state: EquipmentState): boolean {
  return state.resourceCurrent <= 0;
}
```

---

## Effect Application

When equipment is active, effects apply to tiles within the effect radius:

### Mower Effect

```typescript
function applyMowerEffect(
  playerX: number,
  playerY: number,
  cells: CellState[][],
  radius: number
): CellState[][] {
  const affectedCells = getCellsInRadius(playerX, playerY, radius);

  for (const pos of affectedCells) {
    const cell = cells[pos.y][pos.x];
    if (cell && isGrassTerrain(cell.type)) {
      cells[pos.y][pos.x] = applyMowing(cell);
    }
  }

  return cells;
}
```

### Sprinkler Effect

```typescript
function applySprinklerEffect(
  playerX: number,
  playerY: number,
  cells: CellState[][],
  radius: number,
  amount: number = 30
): CellState[][] {
  const affectedCells = getCellsInRadius(playerX, playerY, radius);

  for (const pos of affectedCells) {
    const cell = cells[pos.y][pos.x];
    if (cell) {
      const updated = applyWatering(cell, amount);
      if (updated) {
        cells[pos.y][pos.x] = updated;
      }
    }
  }

  return cells;
}
```

### Spreader Effect

```typescript
function applySpreaderEffect(
  playerX: number,
  playerY: number,
  cells: CellState[][],
  radius: number,
  amount: number = 25
): CellState[][] {
  const affectedCells = getCellsInRadius(playerX, playerY, radius);

  for (const pos of affectedCells) {
    const cell = cells[pos.y][pos.x];
    if (cell) {
      const updated = applyFertilizing(cell, amount);
      if (updated) {
        cells[pos.y][pos.x] = updated;
      }
    }
  }

  return cells;
}
```

### Effect Radius Calculation

```typescript
function getCellsInRadius(
  centerX: number,
  centerY: number,
  radius: number
): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      // Circular radius check
      if (dx * dx + dy * dy <= radius * radius) {
        cells.push({ x: centerX + dx, y: centerY + dy });
      }
    }
  }

  return cells;
}
```

### Tiles Affected by Radius

| Radius | Tiles Affected | Pattern |
|--------|----------------|---------|
| 1 | 5 tiles | + shape |
| 2 | 13 tiles | Circle |
| 3 | 29 tiles | Larger circle |

---

## Player Controls

### Keyboard Mapping

| Key | Action |
|-----|--------|
| 1 | Select Mower |
| 2 | Select Sprinkler |
| 3 | Select Spreader |
| Space | Toggle active equipment on/off |
| E | Refill at station (when near) |

### Equipment Selection

Only one piece of equipment can be active at a time:

```typescript
interface PlayerEquipmentState {
  selectedEquipment: EquipmentType;
  equipment: Record<EquipmentType, EquipmentState>;
}

function selectEquipment(
  state: PlayerEquipmentState,
  type: EquipmentType
): PlayerEquipmentState {
  // Deactivate current equipment
  const current = state.equipment[state.selectedEquipment];
  const deactivated = deactivateEquipment(current);

  return {
    selectedEquipment: type,
    equipment: {
      ...state.equipment,
      [state.selectedEquipment]: deactivated
    }
  };
}
```

---

## Refill Stations

### Station Types

| Station | Refills | Location |
|---------|---------|----------|
| Fuel Pump | Mower | Maintenance shed |
| Water Tank | Sprinkler | Near ponds, shed |
| Fertilizer Bin | Spreader | Maintenance shed |
| All-in-One | All equipment | Premium upgrade |

### Refill Mechanics

```typescript
interface RefillStation {
  type: 'fuel' | 'water' | 'fertilizer' | 'all';
  position: { x: number; y: number };
  refillCost: number;  // Cost per full refill
}

function canRefillAt(
  station: RefillStation,
  equipment: EquipmentType
): boolean {
  if (station.type === 'all') return true;

  switch (equipment) {
    case 'mower': return station.type === 'fuel';
    case 'sprinkler': return station.type === 'water';
    case 'spreader': return station.type === 'fertilizer';
  }
}

function getRefillCost(equipment: EquipmentType): number {
  switch (equipment) {
    case 'mower': return 10;      // $10 for fuel
    case 'sprinkler': return 5;   // $5 for water
    case 'spreader': return 15;   // $15 for fertilizer
  }
}
```

### Refill Interaction

Player must be adjacent to station:

```typescript
function isNearStation(
  playerPos: { x: number; y: number },
  stationPos: { x: number; y: number }
): boolean {
  const dx = Math.abs(playerPos.x - stationPos.x);
  const dy = Math.abs(playerPos.y - stationPos.y);
  return dx <= 1 && dy <= 1;
}
```

---

## Visual Feedback

### Equipment HUD

```
┌─────────────────────────────────────────┐
│  EQUIPMENT                              │
├─────────────────────────────────────────┤
│  [1] Mower      ████████░░░░  67%      │
│  [2] Sprinkler  ██████████░░  83%  ◄   │
│  [3] Spreader   ████░░░░░░░░  33%      │
├─────────────────────────────────────────┤
│  ◄ = Selected    ● = Active            │
│  Press SPACE to toggle                  │
│  Press E near station to refill         │
└─────────────────────────────────────────┘
```

### Active Equipment Indicator

When equipment is active:
- Visual effect around player (spray particles, grass clippings)
- Sound effect (mower engine, water spray)
- Tile highlight showing effect radius
- Resource bar drains visibly

### Empty Equipment Warning

When equipment runs empty:
- Flash/shake on HUD indicator
- Audio cue (sputter/empty sound)
- Automatic deactivation
- Prompt to refill

### Effect Visualization

| Equipment | Active Visual |
|-----------|---------------|
| Mower | Grass particle spray, stripe pattern |
| Sprinkler | Water droplet particles, wet sheen |
| Spreader | Fertilizer granule particles |

---

## Equipment Positioning

### Isometric Offset

Equipment sprites are offset based on player direction:

```typescript
function getIsoOffset(direction: Direction): { x: number; y: number } {
  switch (direction) {
    case 'up':    return { x: 16, y: -8 };
    case 'down':  return { x: -16, y: 8 };
    case 'left':  return { x: -16, y: -8 };
    case 'right': return { x: 16, y: 8 };
    default:      return { x: 0, y: 8 };
  }
}
```

### Depth Ordering

Equipment renders at correct depth relative to player:

```typescript
function getDepthOffset(direction: Direction): number {
  switch (direction) {
    case 'up':
    case 'left':
      return -1;  // Behind player
    case 'down':
    case 'right':
      return 1;   // In front of player
    default:
      return 0;
  }
}
```

---

## Equipment Upgrades (Research Tree)

Equipment can be upgraded through the Research system:

### Tier 2: Basic Upgrades

| Upgrade | Effect | Research Cost |
|---------|--------|---------------|
| Larger Fuel Tank | +50% mower capacity | 400 pts |
| High-Pressure Sprinkler | +1 effect radius | 500 pts |
| Broadcast Spreader | +1 effect radius | 450 pts |

### Tier 3: Efficiency Upgrades

| Upgrade | Effect | Research Cost |
|---------|--------|---------------|
| Fuel-Efficient Engine | -25% consumption rate | 800 pts |
| Drip Irrigation Heads | -30% water consumption | 900 pts |
| Slow-Release Spreader | +50% nutrient effectiveness | 850 pts |

### Tier 4: Advanced Equipment

| Upgrade | Effect | Research Cost |
|---------|--------|---------------|
| Riding Mower | +2 effect radius, 2x speed | 1500 pts |
| Automated Sprinkler Zone | Set-and-forget irrigation | 1800 pts |
| Precision Spreader | Variable rate application | 1600 pts |

### Tier 5: Robotics

| Upgrade | Effect | Research Cost |
|---------|--------|---------------|
| Robot Mower | Autonomous mowing | 6000 pts |
| AutoSpray System | Autonomous irrigation | 5500 pts |
| NutriBot | Autonomous fertilizing | 5000 pts |

---

## Integration with Other Systems

### Economy System

Equipment operations have costs:

```typescript
// Refill costs
const REFILL_COSTS: Record<EquipmentType, number> = {
  mower: 10,      // Fuel
  sprinkler: 5,   // Water
  spreader: 15    // Fertilizer
};

// Transaction recording
economy = addExpense(
  economy,
  REFILL_COSTS[equipment.type],
  'supplies',
  `Refilled ${equipment.type}`,
  currentTime
);
```

### Employee System

Employees can operate equipment:

```typescript
interface EmployeeEquipmentTask {
  employeeId: string;
  equipmentType: EquipmentType;
  targetArea: string;
  efficiency: number;  // Based on employee skill
}

// Groundskeepers operate mowers
// Irrigators operate sprinklers
// Groundskeepers operate spreaders
```

### Research System

Research unlocks equipment upgrades:

```typescript
function applyEquipmentUpgrade(
  equipment: EquipmentState,
  upgrade: EquipmentUpgrade
): EquipmentState {
  return {
    ...equipment,
    resourceMax: equipment.resourceMax * (upgrade.capacityMultiplier ?? 1),
    resourceUseRate: equipment.resourceUseRate * (upgrade.efficiencyMultiplier ?? 1),
    effectRadius: equipment.effectRadius + (upgrade.radiusBonus ?? 0)
  };
}
```

---

## Balance Considerations

### Resource Duration

At default settings, equipment lasts:

| Equipment | Duration (Active) | Tiles Coverable |
|-----------|-------------------|-----------------|
| Mower | 200 seconds | ~200 tiles |
| Sprinkler | 100 seconds | ~1300 tiles |
| Spreader | 125 seconds | ~1625 tiles |

### Refill Frequency

For a typical 18-hole course (~3000 grass tiles):
- Mower: 15 refills per full mow cycle
- Sprinkler: 3 refills per full water cycle
- Spreader: 2 refills per full fertilize cycle

### Cost Analysis

Per full course maintenance cycle:

| Action | Refills | Cost | Total |
|--------|---------|------|-------|
| Mowing | 15 | $10 | $150 |
| Watering | 3 | $5 | $15 |
| Fertilizing | 2 | $15 | $30 |
| **Total** | | | **$195** |

This ensures maintenance has meaningful operating costs.

---

## Implementation Priority

### Phase 1: Core Equipment
1. Equipment state management
2. Activation/deactivation
3. Resource consumption
4. Basic effect application

### Phase 2: Player Integration
1. Equipment selection (1/2/3 keys)
2. Toggle activation (Space)
3. HUD display
4. Effect radius visualization

### Phase 3: Refill System
1. Refill station placement
2. Proximity detection
3. Refill action (E key)
4. Cost deduction

### Phase 4: Visual Polish
1. Active equipment effects (particles)
2. Sound effects
3. Empty equipment feedback
4. Upgrade visual changes

### Phase 5: Advanced Features
1. Equipment upgrades
2. Employee equipment operation
3. Robot equipment (autonomous)

---

## Summary

The Equipment System provides:

1. **Three Core Tools** - Mower, Sprinkler, Spreader for grass maintenance
2. **Resource Management** - Finite resources require strategic use
3. **Refill Mechanics** - Stations for resource replenishment
4. **Upgrade Path** - Research unlocks better equipment
5. **Economic Integration** - Operating costs affect profitability

The system creates satisfying gameplay through:
- Clear visual feedback on equipment state
- Simple but meaningful resource decisions
- Progression through upgrades
- Integration with employee and research systems
