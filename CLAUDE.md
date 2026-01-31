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

Built on **Babylon.js** with 3D isometric rendering. Grid-based movement where the player moves tile-by-tile.

### Where to Find Things

- **Game controller**: `src/babylon/BabylonMain.ts` - central orchestrator, all public API methods
- **Rendering/engine**: `src/babylon/engine/`
- **Game systems**: `src/babylon/systems/` (grass, equipment, terrain editor, etc.)
- **UI panels**: `src/babylon/ui/`
- **Pure logic modules**: `src/core/*.ts` - engine-independent, unit-testable
- **Unit tests**: `src/core/*.test.ts` - colocated with modules
- **Course/scenario data**: `src/data/`
- **E2E tests**: `tests/integration/`

### Single Source of Truth

**CRITICAL**: ALL input (keyboard, mouse, tests, bots) flows through the same public API in `BabylonMain.ts`.

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

### Coordinate Systems

- **Grid coordinates**: `(gridX, gridY)` - logical tile positions
- **Screen coordinates**: `(screenX, screenY)` - pixel positions
- Conversion functions in `src/core/terrain.ts`: `gridToScreen()` / `screenToGrid()`

## Testing

### E2E Test Rules

**IMPORTANT**: All E2E tests MUST use `window.game.*` API methods - never canvas clicks or key simulations.

Use `?testMode=true` to skip the menu and access the game API directly.

### Integration Test Pattern

**CRITICAL**: All integration tests use **state-based assertions**, NOT screenshot comparisons.

```javascript
test('mowing reduces grass height', async ({ page }) => {
  await page.goto('/?testMode=true');
  await waitForGameReady(page);

  // Set up initial state via API
  await page.evaluate(() => {
    window.game.setAllCellsState({ height: 100, moisture: 50, nutrients: 50, health: 60 });
  });

  const pos = await page.evaluate(() => window.game.getPlayerPosition());

  // Perform action via API
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
});
```

### Debug Shortcuts (in-game)

| Key | Action |
|-----|--------|
| `F5` | Reload startup state |
| `F6` | Export current state to console (JSON + base64) |
| `F12` | Capture screenshot |

## Game Controls

See `src/babylon/engine/InputManager.ts` for the complete list. Key bindings:

| Key | Action |
|-----|--------|
| Arrow keys / WASD | Move player |
| 1, 2, 3 | Select equipment |
| Space | Toggle equipment on/off |
| E | Refill at station |
| Tab | Cycle overlay modes |
| P / Escape | Pause game |
| T | Toggle terrain editor |
| Ctrl+Z / Ctrl+Y | Undo/redo (terrain editor) |

## PixelLab MCP Integration

Use PixelLab MCP to generate pixel art sprites. See `src/babylon/systems/EntityVisualSystem.ts` for sprite integration.

### Creating Characters

```javascript
// Create 8-directional character
mcp__pixellab__create_character({
  description: "golf course groundskeeper with green polo shirt and khaki pants",
  n_directions: 8,
  size: 48,
  view: "high top-down",
  detail: "medium detail",
  shading: "basic shading",
  outline: "single color black outline"
})

// Add animations
mcp__pixellab__animate_character({
  character_id: "<from create_character>",
  template_animation_id: "walking",  // or "pushing"
  animation_name: "walk"
})
```

### Creating Equipment/Objects

```javascript
mcp__pixellab__create_map_object({
  description: "red push lawn mower seen from above",
  width: 48,
  height: 48,
  view: "high top-down",
  detail: "medium detail",
  shading: "medium shading"
})
```

### Tips

- Use "high top-down" view for isometric compatibility
- Match size to existing sprites (48×48 for characters)
- Use consistent shading/outline across assets
- Generation takes 2-5 minutes; check status with `get_character`
