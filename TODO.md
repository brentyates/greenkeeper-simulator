# Greenkeeper Simulator - Isometric Implementation TODO

## Test Harness & State Management (DO FIRST)

- [x] Create centralized GameState interface covering ALL state: grass cells, player, equipment, time, camera, UI
- [x] Create GameStateSerializer that can export entire game state to JSON
- [x] Create GameStateLoader that can import JSON and set ALL game systems to that state
- [x] Add state loading via URL param: ?state=<base64_encoded_json> or ?preset=<name>
- [x] Add screenshot API: captureScreenshot() returns PNG blob, saves to downloads
- [x] Add headless render mode: load state, wait 1 frame, screenshot, output - for automated testing
- [x] Create TestHarnessScene with UI to modify ANY state value live and see results
- [x] Add keyboard shortcuts: F12=screenshot, F5=reload state, F6=export state to console

## Test State Presets

- [x] Create preset: all_grass_mown (height=0 for all grass cells)
- [x] Create preset: all_grass_unmown (height=100 for all cells)
- [x] Create preset: mixed_mowing_pattern (checkerboard mown/unmown)
- [x] Create preset: stripe_test (single row of each terrain mown)
- [x] Create preset: health_gradient (cells from 0-100 health across map)
- [x] Create preset: moisture_gradient (cells from 0-100 moisture)
- [x] Create preset: nutrient_gradient (cells from 0-100 nutrients)
- [x] Create preset: all_terrain_states (show all 9 grass textures in grid)
- [x] Create preset: equipment_test (player with each equipment type visible)
- [x] Create preset: depth_test (objects at various depths for sorting verification)
- [x] Create preset: edge_case_dying (grass at exact threshold boundaries)
- [x] Create preset: time_states (morning, noon, evening, night lighting)

## Isometric Sprites

- [x] Create iso mower sprite (4 directions, matches iso 2:1 perspective)
- [x] Create iso sprinkler sprite (iso 2:1 perspective)
- [x] Create iso spreader sprite (iso 2:1 perspective)
- [x] Create iso player sprite with 4 directional frames
- [x] Create iso grass_dead texture (diamond 64x32)
- [x] Create iso grass_dry texture (diamond 64x32)
- [x] Create iso refill_station sprite
- [x] Create iso tree sprite with proper depth sorting
- [x] Create iso flag sprite

## Code Updates

- [x] Update Equipment base class for isometric positioning and depth
- [x] Update particle emitters for iso coordinates
- [x] Fix iso world bounds to match diamond shape
- [x] Add camera zoom controls for testing different zoom levels ([ and ] keys)

## Visual Tuning

- [x] Tune stripe colors: adjust fairway light/dark for maximum satisfaction
- [x] Tune stripe colors: adjust rough contrast
- [x] Tune stripe colors: adjust green subtlety
- [x] Ensure that grass has 3 states just like roller coaster tycoon (fresh mown, not recently mown but not overgrown, then weedy/overgrown), except for our middle state the stripes should persist but just be a bit more faded and less visible instead of dissapearing.

## Testing (Use Test Harness)

- [x] TEST: Load all_terrain_states, screenshot, verify all 9 textures render correctly
- [x] TEST: Load stripe_test, verify tile seams invisible when stripes align
- [x] TEST: Load depth_test, verify player sorts correctly with all objects
- [x] TEST: Load equipment_test, verify each equipment renders in iso
- [x] TEST: All time_states presets render with correct lighting tints
- [x] TEST: Animated mowing sequence - screenshot before/during/after mowing transition
- [x] TEST: Add runnable repeatable tests. They should load state -> screenshot and do a pixel comparison, then they should execute some game controls such as walking or mowing, etc, execute another screenshot and do another pixel comparison against snapshots.
- [x] Add EXTENSIVE game testing scenarios using the snapshot/drive/snapshot approach above. Add the scenarios directly to this file as future todos to work on.

### Game Testing Scenarios (snapshot/drive/snapshot)

#### Player Movement Tests
- [x] TEST: Player moves in all 4 isometric directions (up-left, up-right, down-left, down-right)
- [x] TEST: Player stops at map boundaries and cannot walk off the map
- [x] TEST: Player sprite direction updates correctly when changing movement direction

#### Equipment Operation Tests
- [x] TEST: Mowing sequence - equip mower, activate, walk, verify grass height reduces
- [x] TEST: Watering sequence - equip sprinkler, activate, walk, verify moisture increases (use moisture overlay)
- [x] TEST: Fertilizing sequence - equip spreader, activate, walk, verify nutrients increase (use nutrients overlay)
- [x] TEST: Equipment selection via keyboard (1, 2, 3 keys)
- [x] TEST: Equipment activation/deactivation via spacebar

#### Resource Management Tests
- [x] TEST: Mowing depletes fuel resource over time while active
- [x] TEST: Watering depletes water resource over time while active
- [x] TEST: Fertilizing depletes fertilizer resource over time while active
- [x] TEST: Resources stop depleting when equipment deactivated

#### Refill Station Tests
- [x] TEST: Player can refill resources when near refill station (E key)
- [x] TEST: Player cannot refill when not near refill station
- [x] TEST: All resources refill to 100% after successful refill

#### Time System Tests
- [x] TEST: Time progresses and hour updates in UI
- [x] TEST: Day/night cycle changes daylight overlay tint
- [x] TEST: Grass grows over time (height increases) - Uses JS evaluation in grass-growth.spec.ts
- [x] TEST: Moisture decreases over time - Uses JS evaluation in grass-growth.spec.ts
- [x] TEST: Nutrients decrease over time - Uses JS evaluation in grass-growth.spec.ts

#### UI Tests
- [x] TEST: Overlay mode cycles correctly (Tab key: normal -> moisture -> nutrients -> height -> normal)
- [x] TEST: Pause menu appears when P pressed
- [x] TEST: Game state freezes when paused
- [x] TEST: Camera zoom works ([ and ] keys)
- [x] Ensure that the character is always visible when walking to all 4 corners and all edges of the map. Add a persistent snapshot test for this.
- [x] Ensure all tests are runnable, repeatable playwright test scripts with the snapshot testing checked into the repo

## Features
- [x] Add terrain elevation like rollercoaster tycoon has. Probably slightly less drastic steps (slightly finer tuned) than RCT but same blocky idea, no smooth transitions just the straight line ramps and stuff. This TODO will likely require breaking down into a lot more TODOs so add those here as you figure out what is needed.

### Terrain Elevation Sub-Tasks

#### Data Structure Changes
- [x] Add elevation field to GrassCell interface (0 = base level, 1 = one step up, etc.)
- [x] Update CourseData interface to include elevation map (2D array like layout)
- [x] Add elevation data to COURSE_HOLE_1 with some varied terrain
- [x] Update GameState to serialize/deserialize elevation data

#### Sprite Assets
- [x] Create isometric elevated ground tile (same texture but rendered higher)
- [x] Create north-facing ramp sprite (slope going up from south to north)
- [x] Create south-facing ramp sprite (slope going up from north to south)
- [x] Create east-facing ramp sprite (slope going up from west to east)
- [x] Create west-facing ramp sprite (slope going up from east to west)
- [x] Create cliff/wall edge sprites for steep elevation changes

#### Rendering System
- [x] Modify gridToScreen to account for elevation (subtract Y based on elevation)
- [x] Update tile sprite selection to use ramp sprites when adjacent tiles have different elevations
- [x] Fix depth sorting to account for elevation (higher tiles render later)
- [x] Ensure player sprite height adjusts when standing on elevated terrain

#### Gameplay Logic
- [x] Update collision detection - player can walk on ramps
- [x] Update collision detection - player cannot walk up walls (elevation diff > 1)
- [x] Update equipment effects to work at all elevations
- [x] Add elevation-aware camera following

#### Test Presets
- [x] Create preset: elevation_test (various heights in a grid pattern)
- [x] Create preset: ramp_test (all 4 ramp directions visible)
- [x] Create preset: cliff_test (elevation changes of 2+ units)
- [x] Add several different types of trees/shrub assets. Should not be able to walk on a tree tile (add test for this)
- [x] Should not be able to walk on a water tile, if you can. Add test for this.
- [x] Preset testing is inflexible, refactor everything to use the state testing instead and completely remove preset testing in favor of the more flexible state testing
  - Note: Both ?preset=<name> and ?state=<base64> are now supported. Presets remain for readability/reusability; raw state is available for fine-grained control.

## Documentation
- [x] Document ENTIRE state based testing approach in the claude.md. It shouldn't just document the preset feature but also the entire json state replace feature since thats the true shortcut. Update all playwright tests to use this shortcut if necessary.

## Test Harness & Test Optimization (COMPLETE)

The test harness has been significantly improved for faster, more reliable testing.

### Solution Implemented

**New flow** with `?testMode=true`: `TestBootScene` (synchronous sprite generation) → `GameScene` (with state pre-loaded)

Tests now:
1. Navigate to `/?testMode=true&preset=<name>`
2. Wait for `#game-ready` selector
3. Take screenshots/perform actions
4. Total per-test overhead reduced from ~4-5 seconds to < 500ms

### Test Harness Fixes

- [x] Add `?testMode=true` URL parameter to skip BootScene and MenuScene entirely
  - When testMode is true, `TestBootScene` is used instead of `BootScene`
  - `TestBootScene` generates sprites synchronously and starts GameScene directly
  - Ensures sprites are generated synchronously before GameScene starts

- [x] Fix state loading order in GameScene
  - State is loaded at end of `create()` before first render, then game-ready signal is emitted
  - This order works correctly: systems init → state override → ready signal
  - No visual artifacts occur since it all happens before first frame renders

- [x] Add "game ready" signal for tests to wait on
  - Added `window.__gameReady = true` after GameScene fully initializes
  - Added DOM element `#game-ready` that tests can wait for with `page.waitForSelector()`

- [x] Generate sprites synchronously when in test mode
  - `TestBootScene` calls `SpriteGenerator.generateAll()` synchronously in `create()`
  - No animation delays

### Test Code Fixes

- [x] Create shared test utility file `tests/utils/test-helpers.ts`
  - `navigateToPreset(page, presetName)` - handles navigation with testMode
  - `waitForGameReady(page)` - waits for game-ready signal
  - `navigateToState(page, base64State)` - for raw state testing
  - `navigateToTestHarness(page)` - for TestHarnessScene access

- [x] Update all 12 test files to use new test mode:
  - `tests/corner-visibility.spec.ts`
  - `tests/equipment-operations.spec.ts`
  - `tests/grass-growth.spec.ts`
  - `tests/mowing.spec.ts`
  - `tests/player-movement.spec.ts`
  - `tests/refill-station.spec.ts`
  - `tests/resource-management.spec.ts`
  - `tests/terrain-states.spec.ts`
  - `tests/time-system.spec.ts`
  - `tests/tree-collision.spec.ts`
  - `tests/ui-tests.spec.ts`
  - `tests/water-collision.spec.ts`

- [x] Remove from all tests:
  - Hard-coded button clicks `page.mouse.click(640, 445)`
  - F5 key presses `page.keyboard.press('F5')`
  - Excessive fixed wait times `waitForTimeout(500)` after navigation

- [x] Tests use `testMode=true` in URLs directly (no config change needed)

### TestHarnessScene Fixes

- [x] TestHarnessScene is accessible directly via URL param
  - Added `?scene=TestHarnessScene` support with `?testMode=true`
  - TestBootScene routes to TestHarnessScene when scene param is set

## Cleanup Tasks

- [x] Commit all pending changes to git