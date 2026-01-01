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
Built on **Phaser 3** with isometric 2:1 diamond perspective (64x32 tiles). The game uses **grid-based movement** where the Player moves tile-by-tile via tweens, not velocity-based physics.

### Scene Flow
`BootScene` → `MenuScene` → `GameScene` (with `UIScene` overlay)
- `TestHarnessScene`: Accessible for debugging/state manipulation

### Key Systems (in `src/systems/`)

| System | Responsibility |
|--------|----------------|
| `GrassSystem` | Manages all terrain cells (fairway, rough, green, bunker, water), handles mowing/watering/fertilizing, overlay modes, and elevation-aware rendering |
| `EquipmentManager` | Coordinates Mower, Sprinkler, Spreader equipment with resource depletion |
| `TimeSystem` | Day/night cycle, time progression with configurable scale |
| `GameState*` | Serialization/deserialization for save/load and testing |

### Core Logic (in `src/core/`)
Pure, Phaser-independent modules for TDD:

| Module | Purpose |
|--------|---------|
| `terrain.ts` | Coordinate conversion, walkability, health calculation, ramps |
| `grass-simulation.ts` | Growth, mowing/watering/fertilizing effects, course stats |
| `equipment-logic.ts` | Resource management, activation, consumption |
| `time-logic.ts` | Time progression, day/night cycle, formatting |
| `movement.ts` | Grid movement, bounds checking, collision validation |
| `scoring.ts` | Objectives, score calculation, day transitions |

### Coordinate Systems
- **Grid coordinates**: `(gridX, gridY)` - logical tile positions
- **Screen coordinates**: `(screenX, screenY)` - pixel positions
- Conversion: `GrassSystem.gridToScreen()` / `screenToGrid()`
- Elevation affects Y position: `screenY = (gridX + gridY) * 16 - elevation * 16`

### Sprite Generation
All sprites are procedurally generated at runtime in `SpriteGenerator.ts` - no image assets. This includes terrain tiles, player, equipment, particles, trees, and ramps.

### Equipment Hierarchy
`Equipment` (abstract) → `Mower`, `Sprinkler`, `Spreader`
Each has: resource pool, depletion rate, effect radius, particle emitter

### Terrain & Obstacles
- Course layouts defined in `src/data/courseData.ts` as 2D arrays
- Terrain types: `fairway`, `rough`, `green`, `bunker`, `water`
- Obstacles: `tree`, `pine_tree`, `shrub`, `bush` (block movement)
- Elevation: integer values affecting Y rendering and movement restrictions

## Testing

### Unit Tests (Vitest)
Located in `src/core/*.test.ts`. Pure logic tests for TDD:
- `terrain.test.ts` - 76 tests for coordinates, walkability, health
- `grass-simulation.test.ts` - 53 tests for growth and equipment effects
- `equipment-logic.test.ts` - 49 tests for resource management
- `time-logic.test.ts` - 68 tests for time system
- `movement.test.ts` - 65 tests for player movement
- `scoring.test.ts` - 54 tests for objectives and scoring
- `integration.test.ts` - 32 tests for system interactions

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
