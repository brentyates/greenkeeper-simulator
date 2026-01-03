# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev           # Start development server (Vite)
npm run build         # TypeScript check + production build
npm run test          # Run unit tests (Vitest)
npm run test:watch    # Run unit tests in watch mode
npm run test:coverage # Run with coverage report
npm run test:e2e      # Run Playwright E2E tests
npm run test:e2e:update # Update Playwright snapshots
```

Run specific tests:
```bash
npx vitest run src/core/terrain.test.ts          # Single unit test file
npx vitest run -t "calculates health"            # By test name
npx playwright test tests/mowing.spec.ts         # Single E2E test
```

## Architecture

### Core Game Loop
Built on **Babylon.js** with 3D isometric rendering. The game uses **grid-based movement** where the Player moves tile-by-tile.

### Key Systems (in `src/babylon/`)

| Component | Responsibility |
|-----------|----------------|
| `BabylonMain.ts` | Central controller orchestrating all game logic |
| `engine/BabylonEngine.ts` | 3D rendering and camera setup |
| `engine/InputManager.ts` | Keyboard/mouse input handling |
| `systems/GrassSystem.ts` | Terrain tile rendering and state |
| `systems/EquipmentManager.ts` | Equipment activation and effects |
| `systems/TerrainEditorSystem.ts` | Terrain editing |
| `systems/TileHighlightSystem.ts` | Grid highlighting |
| `ui/UIManager.ts` | HUD and UI overlays |
| `ui/TerrainEditorUI.ts` | Terrain editor UI |

### Core Logic (in `src/core/`)
Pure, engine-independent modules for TDD:

| Module | Purpose |
|--------|---------|
| `terrain.ts` | Coordinate conversion, walkability, health calculation, ramps |
| `grass-simulation.ts` | Growth, mowing/watering/fertilizing effects, course stats |
| `equipment-logic.ts` | Resource management, activation, consumption |
| `movement.ts` | Grid movement, bounds checking, collision validation |
| `terrain-editor-logic.ts` | Terrain editor operations and undo/redo |

### Economy & Management Systems (in `src/core/`)

| Module | Purpose |
|--------|---------|
| `economy.ts` | Cash, loans, transactions, financial tracking (RCT-style) |
| `employees.ts` | Staff hiring/firing, wages, skills, productivity, promotions |
| `golfers.ts` | Guest arrivals, satisfaction, green fees, tips, course rating |
| `research.ts` | Tech tree with 30+ items, equipment unlocks, robotics tier |
| `scenario.ts` | Scenario objectives (economic/attendance/satisfaction/restoration) |
| `golf-logic.ts` | Tee boxes, pins, yardage calculations, hole validation |

### Game Flow & UI (in `src/babylon/ui/` and `src/systems/`)

| Component | Purpose |
|-----------|---------|
| `LaunchScreen.ts` | Scenario selection menu with progress indicators |
| `ProgressManager.ts` | Persists completed scenarios and best scores to localStorage |

### Data (in `src/data/`)

| File | Purpose |
|------|---------|
| `courseData.ts` | Course layouts (3/9/18/27 holes), refill stations, obstacles |
| `scenarioData.ts` | 10 scenarios with objectives, conditions, progression |
| `testPresets.ts` | Test state presets for E2E testing |

### Coordinate Systems
- **Grid coordinates**: `(gridX, gridY)` - logical tile positions
- **Screen coordinates**: `(screenX, screenY)` - pixel positions
- Conversion: `GrassSystem.gridToScreen()` / `screenToGrid()`
- Elevation affects Y position: `screenY = (gridX + gridY) * 16 - elevation * 16`

### Equipment
Mower, Sprinkler, Spreader - each has resource pool, depletion rate, and effect radius.

### Terrain & Obstacles
- Course layouts defined in `src/data/courseData.ts` as 2D arrays
- Terrain types: `fairway`, `rough`, `green`, `bunker`, `water`
- Obstacles: `tree`, `pine_tree`, `shrub`, `bush` (block movement)
- Elevation: integer values affecting Y rendering and movement restrictions

## Testing

### Unit Tests (Vitest)
Located in `src/core/*.test.ts`. Pure logic tests for TDD:
- `terrain.test.ts` - Coordinates, walkability, health
- `grass-simulation.test.ts` - Growth and equipment effects
- `equipment-logic.test.ts` - Resource management
- `movement.test.ts` - Player movement
- `terrain-editor-logic.test.ts` - Terrain editing operations

### E2E Tests (Playwright)
**State-based testing** is the primary pattern. Load specific game states via URL:

```bash
# Named preset
http://localhost:8080/?preset=equipment_test

# Arbitrary state (base64-encoded JSON)
http://localhost:8080/?state=<base64>
```

### Test Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `F5` | Reload startup state |
| `F6` | Export current state to console (JSON + base64) |
| `F12` | Capture screenshot |

### Browser APIs (for Playwright)
```javascript
window.captureScreenshot()  // PNG data URL + download
window.exportGameState()    // Log state to console
window.loadPreset('name')   // Navigate to preset
window.listPresets()        // Get available presets
```

### Playwright Test Pattern
```javascript
await page.goto('/?preset=equipment_test');
await page.mouse.click(640, 445);  // Click Continue button
await page.keyboard.press('F5');    // Ensure state loaded
await page.waitForTimeout(500);
await expect(page).toHaveScreenshot('test.png');
```

### Available Presets
Defined in `src/data/testPresets.ts`. Common ones:
- `all_grass_mown`, `all_grass_unmown`, `mixed_mowing_pattern`
- `equipment_test`, `resource_test`, `refill_test`
- `time_morning`, `time_noon`, `time_evening`, `time_night`
- `elevation_test`, `ramp_test`, `cliff_test`
- `tree_collision_test`, `water_collision_test`

## Game Controls

| Key | Action |
|-----|--------|
| Arrow keys / WASD | Move player |
| 1, 2, 3 | Select equipment (mower, sprinkler, spreader) |
| Space | Toggle equipment on/off |
| E | Refill at station |
| Tab | Cycle overlay modes (normal/moisture/nutrients/height) |
| P | Pause game |
| `[` / `]` | Zoom out/in |

## Economy & Management Integration Status

The economy/management systems are **integrated and running**. See `SCENARIOS.md` and `TODO.md` for detailed documentation.

### What's Working ✅
- All core logic modules with comprehensive unit tests
- Launch screen with scenario selection
- Progress persistence (localStorage)
- Course layouts for all 5 courses
- 10 scenarios with objectives and conditions
- **Economy HUD** - Shows cash and active golfer count
- **Scenario HUD** - Shows objective progress with progress bar and days remaining
- **Golfer simulation** - Arrivals, progression, tips, satisfaction running
- **Employee simulation** - Payroll processing, ticks, manager bonuses
- **Research simulation** - Ticks with funding cost deduction
- **Scenario tracking** - Win/lose detection with notifications

### Remaining UI Enhancements (Nice-to-Have)
| UI Component | Core Module | Priority |
|--------------|-------------|----------|
| Employee Panel | `employees.ts` | Medium - hiring, view roster |
| Research Panel | `research.ts` | Medium - tech tree, funding controls |
| Day Summary Popup | All | Medium - end-of-day stats |
| Golfer Satisfaction | `golfers.ts` | Low - detailed satisfaction display |

### Key Integration Points in BabylonMain

`updateEconomySystems(deltaMs)` runs each frame and:
- Processes hourly payroll
- Generates golfer arrivals during golf hours (6am-7pm)
- Ticks golfers through their rounds
- Processes tips from departing golfers
- Ticks employee energy/breaks
- Ticks research progress
- Updates scenario progress

`checkScenarioCompletion()` checks win/lose conditions and triggers callbacks.
