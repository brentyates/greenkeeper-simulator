# UX Overhaul Plan: Grid-Based Logic + Driving Simulator Feel

## Executive Summary

**Core Insight:** The existing grid-based game logic is solid and should be preserved. The challenge is purely a UX/rendering problem - we need to hide the grid and make the game feel like a driving simulator (Farming Simulator, Lawn Mowing Simulator) while keeping all the deep management systems intact.

**Recommended Approach:** Overhaul the Babylon.js rendering layer while keeping all core logic unchanged. This is lower risk, faster, and preserves our tested codebase.

**Optional Parallel Track:** Explore Unity 6 as a separate prototype to validate if true physics-based driving offers meaningful advantages.

---

## Current State Analysis

### What We Have (Strengths)
- ✅ **Solid core logic** - All systems in `src/core/*` are tested and working
  - Economy, employees, golfers, research, scenarios
  - Grid-based movement, collision, terrain
  - Grass simulation (height, moisture, nutrients)
- ✅ **Full 3D engine** - Babylon.js is 3D-capable (we're just using it in 2D mode)
- ✅ **Some 3D assets** - Trees, obstacles already using 3D meshes
- ✅ **Decoupled architecture** - Core logic is engine-independent

### What Needs to Change (Weaknesses)
- ❌ **Isometric camera** - Feels like SimCity, not immersive
- ❌ **Sprite-based rendering** - 2D sprites don't create driving feel
- ❌ **Grid snapping** - Visible tile-to-tile movement breaks immersion
- ❌ **Top-down perspective** - Want third-person driving view

### Key Architectural Insight

The grid doesn't need to disappear - it just needs to be **invisible to the player**.

**Current:**
```
Grid Position (10, 15) → Sprite at screenX, screenY → Isometric camera
```

**Target:**
```
Grid Position (10, 15) → 3D mesh at smooth worldX, worldZ → Third-person camera
                      ↓
              Lerp between grid positions for smooth visual movement
```

**Game logic still thinks in grid tiles. Renderer shows smooth 3D movement.**

---

## Plan A: Babylon.js Rendering Overhaul (Recommended)

### Why This Approach?
- ✅ Keep all existing TypeScript code and tests
- ✅ Incremental changes, lower risk
- ✅ No engine relearning required
- ✅ AI already familiar with codebase
- ✅ 4-5 weeks vs 8-12 weeks for Unity rewrite

### Phase 1: Camera & Smooth Movement (Week 1)

**Goal:** Make the game feel more immersive by changing perspective.

**Tasks:**
1. **Replace camera system** (`BabylonEngine.ts`)
   - Remove current isometric camera setup
   - Add `ArcRotateCamera` in third-person mode
   - Configure to follow player from behind/above (adjustable angle)
   - Add smooth camera lerping for natural movement

2. **Add 3D player mesh** (`EntityVisualSystem.ts`)
   - Replace sprite-based player with simple 3D mesh (start with cube/capsule)
   - Position mesh based on grid coordinates converted to world space
   - Later: Replace with proper character model (can use PixelLab or import)

3. **Implement smooth movement interpolation** (`BabylonMain.ts`, `EntityVisualSystem.ts`)
   - Keep grid-based movement logic in `src/core/movement.ts` (unchanged)
   - Add visual interpolation layer:
     ```typescript
     // Player is at grid (10, 15), moving to (11, 15)
     // Lerp visual position over 0.3 seconds
     visualPosition = lerp(gridToWorld(10,15), gridToWorld(11,15), t)
     ```
   - Tune lerp duration for good feel (0.2-0.5 seconds)

4. **Input adaptation**
   - Keep existing keyboard input (`InputManager.ts`)
   - Add acceleration/deceleration feel (even though grid-locked)
   - Optional: Add slight rotation animation when turning

**Success Criteria:**
- [ ] Camera follows player from third-person perspective
- [ ] Movement feels smoother (not instant grid snapping)
- [ ] Player is visible as 3D object
- [ ] All existing gameplay still works (equipment, collisions, etc.)

**Files to Modify:**
- `src/babylon/engine/BabylonEngine.ts` - Camera setup
- `src/babylon/systems/EntityVisualSystem.ts` - Player rendering
- `src/babylon/BabylonMain.ts` - Movement interpolation

---

### Phase 2: 3D Grass Rendering (Week 2-3)

**Goal:** Replace sprite-based grass with real-time 3D grass that responds to mowing.

**Current System:**
- `GrassSystem.ts` renders grass as 2D sprites positioned by grid coordinates
- Grass state (height, moisture, nutrients) stored in `GameState.terrain`

**New System:**
- Instanced mesh rendering (thousands of grass blade instances)
- Each instance's color/height driven by grid tile state
- Real-time updates when tile state changes

**Tasks:**

1. **Create grass instance system** (new file: `src/babylon/systems/GrassInstanceSystem.ts`)
   - Use Babylon's `InstancedMesh` or `SolidParticleSystem`
   - Generate instances for each fairway/rough/green tile
   - Map grid coordinates → world space instance positions

2. **Shader-based grass properties**
   - Grass height: Scale instance based on `terrain[y][x].height`
   - Grass color:
     - Green intensity based on health/moisture
     - Brown/yellow when dry or overgrown
   - Update shader uniforms when tile state changes

3. **Real-time grass updates**
   - When player mows tile: Update instance height immediately
   - When sprinkler activates: Update instance color
   - Smooth transitions (lerp colors/heights over 0.5s)

4. **Performance optimization**
   - LOD system: Full grass near player, simplified far away
   - Culling: Only render grass in camera frustum
   - Batching: Group instances by material

5. **Mowing visual feedback**
   - Leave darker "stripe" decal on mowed tiles
   - Particle effect when mowing (grass clippings)
   - Audio cue for mowing satisfaction

**Success Criteria:**
- [ ] Grass renders as 3D instances, not sprites
- [ ] Mowing visibly reduces grass height in real-time
- [ ] Maintains 60 FPS with full course rendered
- [ ] Satisfying visual feedback when cutting grass

**Files to Create/Modify:**
- `src/babylon/systems/GrassInstanceSystem.ts` (new)
- `src/babylon/systems/GrassSystem.ts` (refactor or replace)
- `src/babylon/BabylonMain.ts` (integrate new system)

---

### Phase 3: Vehicle Feel & Equipment (Week 3-4)

**Goal:** Make driving the mower feel satisfying, even though grid-locked under the hood.

**Tasks:**

1. **Add vehicle momentum**
   - Acceleration: Gradual speed increase when moving
   - Deceleration: Coasting when stopping
   - Visual only (grid movement still instant under hood)
   - Tune acceleration curves for "heavy" mower feel

2. **3D equipment rendering**
   - Replace equipment sprites with 3D meshes
   - Mower model attached to player (visible in third-person)
   - Equipment switches: Mower → Sprinkler tank → Spreader
   - Animate equipment (spinning mower blades, etc.)

3. **Equipment visual effects**
   - **Mower**: Spinning blades, grass particle spray
   - **Sprinkler**: Water particle arc, ground wetness decal
   - **Spreader**: Granule particles spreading behind

4. **Camera options**
   - Adjustable camera distance (zoom in/out with `[` `]`)
   - Optional: First-person view toggle
   - Optional: Look-around with mouse while driving

5. **Sound design**
   - Engine sound that varies with movement
   - Distinct sounds for each equipment type
   - Ambient course sounds (birds, wind)

**Success Criteria:**
- [ ] Driving feels weighty and satisfying
- [ ] Equipment is visually clear and satisfying to use
- [ ] Audio enhances immersion
- [ ] Controls feel responsive despite grid underneath

**Files to Modify:**
- `src/babylon/systems/EntityVisualSystem.ts` - Equipment rendering
- `src/babylon/systems/EquipmentManager.ts` - Visual effects
- `src/babylon/engine/InputManager.ts` - Control feel
- `src/babylon/BabylonMain.ts` - Movement feel integration

---

### Phase 4: Polish & Integration (Week 4-5)

**Goal:** Ensure all existing systems work with new rendering, add juice.

**Tasks:**

1. **UI overhaul for new perspective**
   - Keep HUD (cash, time, objectives) but adjust for third-person view
   - Equipment indicator visible in 3D (not just HUD icon)
   - Minimap showing course layout and player position

2. **Ensure all systems still work**
   - Employees still render and move correctly
   - Golfers render as 3D characters on course
   - Terrain editor mode still functional
   - All overlays (moisture, nutrients, height) work in 3D

3. **Course environment**
   - Enhance 3D trees and obstacles
   - Add environmental details (clubhouse, cart paths, bunkers)
   - Skybox and lighting for time-of-day

4. **Juice and polish**
   - Screen shake when mower hits obstacle
   - Particle effects for satisfaction (mowing, watering)
   - UI animations and transitions
   - Victory/defeat animations

5. **Testing pass**
   - All scenarios completable
   - No visual glitches
   - Performance stable
   - Controls feel good

**Success Criteria:**
- [ ] Game feels complete and polished
- [ ] All original features work correctly
- [ ] New perspective enhances gameplay
- [ ] Ready for playtesting

**Files to Modify:**
- All `src/babylon/ui/*.ts` files
- `src/babylon/systems/*` as needed
- Visual assets and shaders

---

## Plan B: Unity 6 Parallel Prototype (Optional)

### Purpose
Validate whether true physics-based driving offers meaningful advantages over enhanced Babylon.js approach.

### Timeline
Run in parallel with Babylon overhaul. After 2-3 weeks, compare and decide which to continue.

### Scope

**Week 1: Foundation**
- Install Unity 6 LTS
- Research and purchase assets:
  - Vehicle controller ($50-80) - Recommendations: NWH Vehicle Physics, Edy's Vehicle Physics
  - Grass system ($50-100) - Recommendations: Nature Renderer, Vegetation Studio Pro
- Create basic golf course terrain
- Get vehicle driving with purchased controller

**Week 2: Core Logic Port**
- Port essential modules from `src/core/*.ts` to C# (AI-assisted)
  - Focus on: terrain, grass-simulation, equipment-logic, movement
  - Skip management systems initially (employees, golfers, economy)
- Wire up basic grass cutting when vehicle moves
- Test: Does core loop work?

**Week 3: Evaluate**
- Compare Unity prototype feel vs Babylon enhanced version
- Decision point: Continue Unity or commit to Babylon?

### Success Criteria
- [ ] Vehicle feels significantly better than Babylon version
- [ ] Grass cutting is more satisfying
- [ ] Worth the investment of porting all systems

### Risk Assessment
- **High risk:** Vehicle controller may not integrate well
- **High risk:** Grass system may not support our gameplay needs
- **Medium risk:** C# port introduces subtle bugs
- **Time risk:** Could take 8-12 weeks total if continued

---

## Technical Details

### Coordinate System Conversion

**Current (2D sprite system):**
```typescript
// In GrassSystem.ts
gridToScreen(gridX: number, gridY: number, elevation: number): {x, y} {
  const screenX = (gridX - gridY) * TILE_WIDTH_HALF;
  const screenY = (gridX + gridY) * TILE_HEIGHT_HALF - elevation * ELEVATION_OFFSET;
  return {x: screenX, y: screenY};
}
```

**New (3D world space):**
```typescript
// New function in BabylonEngine or util
gridToWorld(gridX: number, gridY: number, elevation: number): Vector3 {
  // Grid space → World space
  // Assuming 1 grid unit = 1 world unit for simplicity
  return new Vector3(
    gridX,           // X axis (east-west)
    elevation,       // Y axis (height)
    gridY            // Z axis (north-south)
  );
}
```

### Camera Configuration

**Target camera setup (ArcRotateCamera):**
```typescript
// In BabylonEngine.ts
const camera = new ArcRotateCamera(
  "playerCamera",
  -Math.PI / 2,      // Alpha (horizontal rotation)
  Math.PI / 3,       // Beta (vertical angle, ~60° from horizontal)
  15,                // Radius (distance from target)
  Vector3.Zero(),    // Target (will follow player)
  scene
);

camera.lowerRadiusLimit = 8;   // Min zoom
camera.upperRadiusLimit = 30;  // Max zoom
camera.lowerBetaLimit = 0.1;   // Can't go underground
camera.upperBetaLimit = Math.PI / 2; // Can't flip over

// Smooth camera movement
camera.inertia = 0.9;
camera.angularSensibilityX = 1000;
camera.angularSensibilityY = 1000;

// Each frame, update camera target to player position
camera.target = playerMesh.position;
```

### Grass Instancing Strategy

**Option 1: InstancedMesh (simpler, good for 1000s of instances)**
```typescript
// Create template grass blade mesh
const grassBlade = MeshBuilder.CreatePlane("grassBlade", {
  width: 0.2,
  height: 0.5
}, scene);

// Create instances for each tile
const instances: InstancedMesh[] = [];
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (terrain[y][x].type === 'fairway' || terrain[y][x].type === 'rough') {
      const instance = grassBlade.createInstance(`grass_${x}_${y}`);
      const worldPos = gridToWorld(x, y, terrain[y][x].elevation);
      instance.position = worldPos;

      // Set color based on tile health/moisture
      instance.instancedBuffers.color = getGrassColor(terrain[y][x]);
      instances.push(instance);
    }
  }
}
```

**Option 2: SolidParticleSystem (better for 10,000s of instances)**
```typescript
const sps = new SolidParticleSystem("grass", scene);
sps.addShape(grassBladeMesh, numberOfGrassBlades);
sps.buildMesh();

// Initialize particle positions and properties
sps.initParticles = function() {
  for (let i = 0; i < sps.nbParticles; i++) {
    const particle = sps.particles[i];
    const tileIndex = Math.floor(i / bladesPerTile);
    const gridX = tileIndex % width;
    const gridY = Math.floor(tileIndex / width);

    particle.position = gridToWorld(gridX, gridY, elevation);
    particle.color = getGrassColor(terrain[gridY][gridX]);
    particle.scaling.y = terrain[gridY][gridX].height;
  }
};

// Update particle properties when terrain changes
sps.updateParticle = function(particle) {
  // Update based on terrain state
  particle.color = getGrassColor(terrain[y][x]);
  particle.scaling.y = terrain[y][x].height;
  return particle;
};
```

### Movement Interpolation

**Add to EntityVisualSystem or BabylonMain:**
```typescript
interface MovementState {
  fromGrid: {x: number, y: number};
  toGrid: {x: number, y: number};
  startTime: number;
  duration: number; // ms
}

let currentMovement: MovementState | null = null;

// When player moves in grid logic
onPlayerMove(newGridX: number, newGridY: number) {
  currentMovement = {
    fromGrid: {x: player.gridX, y: player.gridY},
    toGrid: {x: newGridX, y: newGridY},
    startTime: Date.now(),
    duration: 300 // 300ms animation
  };

  // Update grid logic immediately
  player.gridX = newGridX;
  player.gridY = newGridY;
}

// Each frame
updatePlayerVisual(deltaTime: number) {
  if (currentMovement) {
    const elapsed = Date.now() - currentMovement.startTime;
    const t = Math.min(elapsed / currentMovement.duration, 1.0);

    // Smooth easing (ease-out)
    const easedT = 1 - Math.pow(1 - t, 3);

    const fromWorld = gridToWorld(currentMovement.fromGrid.x, currentMovement.fromGrid.y, elevation);
    const toWorld = gridToWorld(currentMovement.toGrid.x, currentMovement.toGrid.y, elevation);

    playerMesh.position = Vector3.Lerp(fromWorld, toWorld, easedT);

    if (t >= 1.0) {
      currentMovement = null;
    }
  } else {
    // Stationary - snap to grid position
    playerMesh.position = gridToWorld(player.gridX, player.gridY, elevation);
  }
}
```

---

## Decision Framework

### After Week 1 (Camera Overhaul)
**Question:** Does third-person perspective make the game feel more immersive?
- ✅ Yes → Continue to Phase 2
- ❌ No → Reconsider approach, maybe isometric is fine

### After Week 3 (Grass Rendering)
**Question:** Is grass cutting visually satisfying?
- ✅ Yes → Continue to Phase 3
- ❌ No → May need to explore Unity or different grass approach

### After Week 4 (Vehicle Feel)
**Question:** Does driving feel good despite grid underneath?
- ✅ Yes → Continue to polish
- ❌ No → Evaluate Unity prototype if running in parallel

### If Unity Prototype Exists (Week 3)
**Question:** Is Unity version significantly better?
- ✅ Yes → Consider switching to Unity full-time
- ❌ No → Commit to Babylon and polish

---

## Risk Mitigation

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Grass instancing performance issues | Medium | High | Start with small test area, profile early, implement LOD |
| Camera feel is hard to tune | Medium | Medium | Reference other games, make highly configurable |
| Movement still feels grid-locked | Low | High | Tune interpolation timing, add momentum/easing |
| 3D rendering breaks existing systems | Low | High | Incremental changes, test frequently |

### Project Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Overhaul takes longer than estimated | High | Medium | Time-box phases, set clear exit criteria |
| End result isn't better than current | Medium | High | Early decision points after each phase |
| AI struggles with 3D rendering code | Medium | Medium | Use Babylon.js docs, reference examples |
| Lose motivation mid-overhaul | Medium | High | Focus on quick wins (camera first), parallel Unity as backup |

---

## Success Metrics

### Subjective (Playtest Feedback)
- Does it "feel" like a driving simulator?
- Is mowing grass satisfying?
- Is the perspective more immersive?
- Do players want to keep playing?

### Objective (Technical)
- Maintains 60 FPS on M4 Mac with full course
- All unit tests still pass (core logic unchanged)
- All scenarios completable
- No visual bugs or glitches

---

## Next Steps

### Immediate Actions (Today)
1. ✅ Document plan (this file)
2. Create git branch for rendering overhaul: `feature/3d-rendering-overhaul`
3. Back up current working state
4. Begin Phase 1: Camera system overhaul

### Week 1 Goals
- [ ] Third-person camera following player
- [ ] Basic 3D player mesh replacing sprite
- [ ] Smooth movement interpolation
- [ ] Playable demo with new perspective

### Questions to Answer
- What should camera default angle/distance be?
- How long should movement interpolation take? (0.2s? 0.5s?)
- Should we keep keyboard or switch to WASD + mouse look?
- Do we need first-person view option?

---

## Resources & References

### Babylon.js Documentation
- [ArcRotateCamera](https://doc.babylonjs.com/typedoc/classes/BABYLON.ArcRotateCamera)
- [InstancedMesh](https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/instances)
- [SolidParticleSystem](https://doc.babylonjs.com/features/featuresDeepDive/particles/solid_particle_system)
- [Lerp and Animations](https://doc.babylonjs.com/features/featuresDeepDive/animation/animation_introduction)

### Inspiration Games (for reference)
- **Lawn Mowing Simulator** - Satisfying grass cutting, stripe patterns
- **Farming Simulator** - Vehicle feel, third-person perspective
- **PowerWash Simulator** - Satisfying progression visualization
- **Stardew Valley** - Grid-based logic with smooth visuals

### Unity Resources (if pursuing parallel track)
- [Unity 6 LTS Download](https://unity.com/releases/lts)
- Asset Store: Vehicle Physics, Grass Systems
- ID@Xbox Program (for console deployment)

---

## Appendix: Why Not Unity Right Away?

### Babylon.js Advantages
1. **Keep existing codebase** - 20+ tested TypeScript modules
2. **Lower risk** - Incremental changes vs full rewrite
3. **Faster iteration** - No C# port, no asset purchasing delays
4. **AI familiarity** - AI already knows your code structure
5. **Web deployment** - Already set up, works on Mac immediately

### When Unity Makes Sense
1. Vehicle feel is critically important and Babylon can't deliver
2. Want AAA grass rendering quality
3. Planning to publish on Steam/consoles eventually
4. Budget allows for asset purchases ($200-500)
5. Willing to invest 8-12 weeks in full rewrite

### The Hybrid Strategy
- **Babylon first** - Prove the concept with lower investment
- **Unity as backup** - Explore in parallel if resources allow
- **Decision point at Week 3** - Compare both, commit to one

---

**Document Version:** 1.0
**Created:** 2026-01-10
**Author:** Claude (with user collaboration)
**Status:** Ready for implementation
