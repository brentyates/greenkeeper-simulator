# CORE LOGIC MODULES

Pure, engine-independent TypeScript. TDD-first design.

## STRUCTURE
```
core/
├── terrain.ts/.test.ts          # Coords, walkability, ramps, health
├── grass-simulation.ts          # Growth, mowing/watering/fertilizing
├── equipment-logic.ts           # Resource pools, consumption
├── movement.ts                  # Grid movement, bounds, collision
├── terrain-editor-logic.ts      # Editor ops, undo/redo
├── economy.ts                   # Cash, loans, transactions
├── employees.ts (1059 lines)    # Hiring, wages, skills, productivity
├── employee-work.ts             # Task assignment, worker positions
├── golfers.ts                   # Arrivals, satisfaction, tips
├── research.ts (1115 lines)     # Tech tree, 30+ items, unlocks
├── tee-times.ts (1085 lines)    # Booking, scheduling
├── scenario.ts                  # Objectives, win/lose conditions
├── prestige.ts                  # Course rating, demand multiplier
├── irrigation.ts                # Pipe network, sprinklers, pressure
├── marketing.ts                 # Campaigns, seasonal effects
├── weather.ts                   # Conditions, growth modifiers
├── amenities.ts                 # Upgrades, visitor satisfaction
└── movable-entity.ts            # Player/NPC pathfinding
```

## CONVENTIONS

### Testing Pattern
Every `*.ts` has matching `*.test.ts`. Tests run with Vitest.
```bash
npx vitest run src/core/terrain.test.ts
npx vitest run -t "calculates health"
```

### Pure Functions
All modules export pure functions. State passed in, new state returned.
```typescript
function tickEmployees(roster: EmployeeRoster, deltaMs: number): EmployeeRoster
```

### No Side Effects
No DOM, no Babylon, no console.log, no timers. Only pure calculations.

## WHERE TO LOOK

| Task | File |
|------|------|
| Add terrain type | `terrain.ts` - `TerrainType` enum |
| Modify growth rates | `grass-simulation.ts` - `GROWTH_RATE` |
| New employee role | `employees.ts` - `EMPLOYEE_ROLE_INFO` |
| Research item | `research.ts` - `RESEARCH_ITEMS` |
| Scenario objective | `scenario.ts` - `ObjectiveType` |

## LARGE FILE WARNING
Files >1000 lines: `employees.ts`, `research.ts`, `tee-times.ts`, `terrain.test.ts`
High complexity - read carefully before modifying.

## MODULE DEPENDENCIES
```
terrain ← movement ← movable-entity
        ← grass-simulation
        ← terrain-editor-logic

economy ← employees ← employee-work
       ← golfers
       ← research
       ← marketing

prestige ← golfers
         ← amenities
```
