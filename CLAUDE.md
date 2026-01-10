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
npm run lint:e2e      # Lint E2E tests for API compliance
firebase deploy --only hosting  # Deploy to https://greenkeeper-96a0b.web.app
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

### Public JavaScript API for Testing

**IMPORTANT**: All E2E tests MUST use `window.game.*` API methods - never canvas clicks or key simulations.

The full API is defined by public methods in `src/babylon/BabylonMain.ts`. Common patterns:
- `window.game.movePlayer('right')` - player control
- `window.game.selectEquipment(1)` - equipment selection
- `window.game.getTerrainAt(x, y)` - state queries
- `window.game.set*()` / `window.game.toggle*()` - state changes

### Integration Test Pattern (State-Based)

**CRITICAL**: All integration tests use **state-based assertions**, NOT screenshot comparisons.

```javascript
// ✅ CORRECT: State-based testing
test('mowing reduces grass height', async ({ page }) => {
  await page.goto('/?testMode=true&preset=all_grass_unmown');
  await waitForGameReady(page);

  const pos = await page.evaluate(() => window.game.getPlayerPosition());

  // Check initial state
  const initialTerrain = await page.evaluate(({ x, y }) => {
    return window.game.getTerrainAt(x + 1, y);
  }, pos);
  expect(initialTerrain.height).toBeGreaterThan(0.8);

  // Perform action
  await page.evaluate(async () => {
    window.game.selectEquipment(1);
    window.game.movePlayer('right');
    await window.game.waitForPlayerIdle();
  });

  // Verify state changed
  const mownTerrain = await page.evaluate(({ x, y }) => {
    return window.game.getTerrainAt(x + 1, y);
  }, pos);
  expect(mownTerrain.height).toBeLessThan(0.3);
  expect(mownTerrain.lastMowed).toBeGreaterThan(0);
});

// ❌ WRONG: Screenshot testing is FLAKY and DEPRECATED
await expect(page).toHaveScreenshot('mowing.png');  // DON'T DO THIS!
```

### Test Organization

```
tests/
├── integration/              # Integration tests (UI layer + core logic)
│   ├── equipment-integration.spec.ts
│   ├── player-movement-integration.spec.ts
│   ├── terrain-grass-integration.spec.ts
│   ├── irrigation-integration.spec.ts
│   ├── terrain-editor-integration.spec.ts
│   └── management-integration.spec.ts
├── utils/
│   └── test-helpers.ts      # Shared test utilities
└── old-screenshot-tests/    # Deprecated screenshot tests (reference only)
```

### Available Presets
Defined in `src/data/testPresets.ts`. Common ones:
- `all_grass_mown`, `all_grass_unmown`, `mixed_mowing_pattern`
- `equipment_test`, `resource_test`, `refill_test`
- `time_morning`, `time_noon`, `time_evening`, `time_night`
- `elevation_test`, `ramp_test`, `cliff_test`
- `tree_collision_test`, `water_collision_test`

## Architecture: Single Source of Truth

**CRITICAL**: The game uses a unified control layer where ALL input (keyboard, mouse, and automated tests) flows through the SAME public API methods.

```
┌────────────────────────────────────────────────────┐
│   PUBLIC API (Single Source of Truth)             │
│   movePlayer(), selectEquipment(), etc.           │
└────────────────────────────────────────────────────┘
           ▲                           ▲
           │                           │
    ┌──────┴──────┐            ┌──────┴──────────┐
    │ InputManager │            │ Tests/Bots/MCP  │
    │ (keyboard)   │            │ (automation)    │
    └──────────────┘            └─────────────────┘
```

This ensures keyboard, tests, and bots all use the same code paths - bugs found in tests reflect actual gameplay issues.

## Game Controls

| Key | Action |
|-----|--------|
| Arrow keys / WASD | Move player |
| 1, 2, 3 | Select equipment (mower, sprinkler, spreader) |
| Space | Toggle equipment on/off |
| E | Refill at station |
| Tab | Cycle overlay modes (normal/moisture/nutrients/height) |
| P / Escape | Pause game |
| M | Mute audio |
| `+` / `-` | Speed up / slow down time |
| `[` / `]` | Zoom out/in |
| T | Toggle terrain editor |
| H | Employee panel |
| Y | Research panel |
| G | Tee sheet panel |
| K | Marketing panel |
| B | Equipment store |
| U | Amenities panel |

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

## PixelLab MCP Integration

This project uses **PixelLab MCP** to generate pixel art sprites for characters and equipment.

### Generated Assets

| Asset | Location | Description |
|-------|----------|-------------|
| Greenkeeper sprite | `public/assets/textures/greenkeeper_pixellab.png` | Player character with 8 directions × 2 animations |
| Push mower | `public/assets/textures/push_mower.png` | Equipment sprite (48×48) |

### Character Sprite Sheet Structure

The greenkeeper sprite sheet is organized as:
- **8 directions**: S, N, W, E, SE, SW, NE, NW (rows 0-7 for walk, 8-15 for pushing)
- **6 frames per direction**: Animation frames per row
- **2 animation types**: Walk (rows 0-7) and Pushing (rows 8-15)
- **Frame size**: 48×48 pixels per frame

```
Row Layout:
0-7:   Walk animation (S, N, W, E, SE, SW, NE, NW)
8-15:  Pushing animation (S, N, W, E, SE, SW, NE, NW)
```

### Creating Characters with PixelLab

Use the `mcp__pixellab__create_character` tool:

```javascript
// Create 8-directional character
{
  description: "golf course groundskeeper with green polo shirt and khaki pants",
  n_directions: 8,
  size: 48,
  view: "high top-down",
  detail: "medium detail",
  shading: "basic shading",
  outline: "single color black outline"
}
```

Then add animations with `mcp__pixellab__animate_character`:

```javascript
// Add walk animation
{
  character_id: "<from create_character>",
  template_animation_id: "walking",
  animation_name: "walk"
}

// Add pushing animation (for mower/equipment)
{
  character_id: "<from create_character>",
  template_animation_id: "pushing",
  animation_name: "pushing"
}
```

### Creating Equipment with PixelLab

Use `mcp__pixellab__create_map_object` for equipment sprites:

```javascript
{
  description: "red push lawn mower seen from above",
  width: 48,
  height: 48,
  view: "high top-down",
  detail: "medium detail",
  shading: "medium shading"
}
```

### Sprite Integration in Code

**EntityVisualSystem.ts** handles sprite rendering:
- `sharedSpriteManager`: Character sprites (greenkeeper)
- `equipmentSpriteManager`: Equipment sprites (mower, etc.)
- `showEquipmentSprite()` / `hideEquipmentSprite()`: Toggle equipment visibility
- `updateEquipmentSpritePosition()`: Position equipment based on player direction

**Animation constants**:
```typescript
SPRITE_FRAMES_PER_DIRECTION = 6  // Frames per animation row
SPRITE_DIRECTIONS_COUNT = 8      // S, N, W, E, SE, SW, NE, NW
ANIM_TYPE_WALK = 0               // Walk animation (rows 0-7)
ANIM_TYPE_PUSHING = 1            // Pushing animation (rows 8-15)
```

**Direction mapping** (sprite sheet row order):
```typescript
DIR_S = 0, DIR_N = 1, DIR_W = 2, DIR_E = 3
DIR_SE = 4, DIR_SW = 5, DIR_NE = 6, DIR_NW = 7
```

### Future PixelLab Assets Needed

| Asset | Tool | Description |
|-------|------|-------------|
| Sprinkler tank | `create_map_object` | Water tank on wheels for sprinkler equipment |
| Spreader | `create_map_object` | Fertilizer spreader for spreader equipment |
| Employee sprites | `create_character` | Different colored uniforms for employees |
| Golfer sprites | `create_character` | Golfers with golf bags |

### Tips for PixelLab Generation

1. **Use "high top-down" view** for isometric games
2. **Match size to existing sprites** (48×48 for characters)
3. **Use consistent shading/outline** across all assets
4. **Download ZIP** after generation to get all directions/frames
5. **Check job status** with `get_character` - generation takes 2-5 minutes
