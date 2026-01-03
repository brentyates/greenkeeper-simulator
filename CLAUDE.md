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
