# GREENKEEPER SIMULATOR KNOWLEDGE BASE

**Generated:** 2026-01-08
**Commit:** aa1b2da
**Branch:** main

## OVERVIEW
Golf course maintenance simulator built on Babylon.js with 3D isometric rendering. Grid-based player movement, equipment systems, economy simulation, and scenario-driven gameplay.

## STRUCTURE
```
greenkeeper-simulator/
├── src/
│   ├── main.ts              # Entry point, URL params, launch flow
│   ├── core/                # Pure logic modules (TDD) - see src/core/AGENTS.md
│   ├── babylon/             # 3D engine integration
│   │   ├── BabylonMain.ts   # Central orchestrator (3885 lines - god object)
│   │   ├── engine/          # BabylonEngine, InputManager
│   │   ├── systems/         # GrassSystem, EquipmentManager, TerrainEditor
│   │   └── ui/              # UI panels - see src/babylon/ui/AGENTS.md
│   ├── data/                # Static data: courses, scenarios, test presets
│   └── systems/             # GameState, Serializer, ProgressManager
├── tests/                   # Playwright E2E tests + snapshots
├── public/assets/           # Textures
└── docs/                    # Reference docs
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add new terrain type | `src/core/terrain.ts` | Pure logic, add tests first |
| Add UI panel | `src/babylon/ui/*.ts` | Copy existing panel pattern |
| Modify game loop | `src/babylon/BabylonMain.ts` | WARNING: 3885 lines |
| Add equipment | `src/core/equipment-logic.ts` + `EquipmentManager.ts` | |
| New scenario | `src/data/scenarioData.ts` | 10 existing scenarios |
| Test preset | `src/data/testPresets.ts` | For E2E state loading |
| Course layout | `src/data/courseData.ts` | 2D array terrain/elevation |

## ARCHITECTURE PATTERNS

### Single Source of Truth API
ALL input (keyboard, tests, automation) flows through public API on `window.game`:
```
InputManager → Public API → Game Logic
Tests/Bots  → Public API → Game Logic
```
Methods: `movePlayer()`, `selectEquipment()`, `toggleEquipment()`, etc.

### Pure Core / Render Split
- `src/core/`: Engine-independent, pure functions, TDD-friendly
- `src/babylon/`: Babylon.js rendering, side effects

### State-Based E2E Testing
```javascript
// Load via URL
?preset=equipment_test
?state=<base64>

// Use window.game API, NEVER canvas clicks
window.game.movePlayer('right')
window.game.selectEquipment(1)
```

## COORDINATE SYSTEMS
- **Grid**: `(gridX, gridY)` - tile positions
- **Screen**: `screenY = (gridX + gridY) * 16 - elevation * 16`
- Conversion: `GrassSystem.gridToScreen()` / `screenToGrid()`

## KEY MODULES

| Module | Lines | Role |
|--------|-------|------|
| `BabylonMain.ts` | 3885 | Central controller, economy ticks, scenario tracking |
| `GrassSystem.ts` | 1454 | Terrain rendering, tile state |
| `UIManager.ts` | 1486 | HUD, overlays, panel management |
| `terrain.ts` | 870 | Walkability, ramps, health calc |
| `employees.ts` | 1059 | Staff management, payroll |
| `research.ts` | 1115 | Tech tree, 30+ items |
| `tee-times.ts` | 1085 | Booking system |

## ANTI-PATTERNS

| Forbidden | Why |
|-----------|-----|
| Canvas clicks in E2E tests | Flaky. Use `window.game.*` API |
| `as any`, `@ts-ignore` | Strict mode enforced |
| New dependencies | Minimal deps: only Babylon.js |
| Comments in code | Self-documenting or die (per user pref) |

## COMMANDS
```bash
npm run dev           # Vite dev server
npm run build         # tsc + vite build
npm run test          # Vitest unit tests
npm run test:e2e      # Playwright E2E
firebase deploy --only hosting  # Deploy
```

## ECONOMY SYSTEMS (Running)
All tick in `BabylonMain.updateEconomySystems()`:
- Payroll processing (hourly)
- Golfer arrivals (6am-7pm)
- Research progress
- Scenario win/lose detection
