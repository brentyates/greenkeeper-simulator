# 3D Asset Pipeline

## Overview

Greenkeeper Simulator uses a fully 3D asset pipeline with Babylon.js. The game achieves an isometric appearance through an orthographic camera positioned at 60 degrees from vertical, not through 2D sprite rendering.

All visual assets are GLB (binary glTF) models loaded at runtime. Missing assets automatically fall back to placeholder meshes.

## Single Source of Truth

The asset manifest in TypeScript is the authoritative definition for all game assets:

```
src/babylon/assets/AssetManifest.ts
```

This file defines:
- Asset IDs (e.g., `character.greenkeeper`, `tree.pine.medium`)
- File paths for GLB files
- Physical dimensions (height range, footprint)
- Origin point (base_center or center)
- Required animations (for characters)
- Notes describing the asset's appearance

**Never define assets elsewhere.** All tools and systems read from this manifest.

## File Structure

```
src/babylon/assets/
  AssetManifest.ts      # Asset definitions (EDIT THIS)
  AssetLoader.ts        # Loading and caching logic
  PlaceholderMeshes.ts  # Fallback for missing GLB files

public/assets/models/
  characters/           # Player, employees, golfers
  equipment/            # Mowers, sprinklers, spreaders
  irrigation/           # Pipes, sprinkler heads, valves
  trees/                # All tree varieties and sizes
  buildings/            # Clubhouse, sheds, stations
  props/                # Flags, markers, decorations
  golf/                 # Balls, tees, cups

tools/blender/
  ASSET_CONVENTIONS.md  # Modeling guidelines
  asset_specs.py        # Python module for Blender scripts
  export_glb.py         # Export automation script
```

## Workflow

### Adding a New Asset

1. **Define in manifest** - Add entry to `ASSET_MANIFEST` in `AssetManifest.ts`:

```typescript
"equipment.rake": {
  path: "/assets/models/equipment/rake.glb",
  heightRange: [1.2, 1.5],
  footprint: [0.3, 1.0],
  origin: "base_center",
  notes: "Bunker rake. Long handle, wide head.",
},
```

2. **Generate JSON for Blender** - Run `npm run assets:manifest` to update the JSON file that Blender tools read.

3. **Create model in Blender** - Follow conventions in `tools/blender/ASSET_CONVENTIONS.md`.

4. **Export GLB** - Use the export script or manual export with correct settings.

5. **Place in public folder** - Copy GLB to path specified in manifest.

6. **Test** - The asset will now load instead of showing a placeholder.

### Development Without Models

You can develop gameplay systems without any GLB files. The `PlaceholderMeshes.ts` system automatically creates:

- **Magenta wireframe boxes** sized according to manifest specs
- Boxes use the asset's `footprint` and average `heightRange`
- Origin positioned according to the `origin` field

This allows full gameplay development while art assets are in progress.

## Asset Categories

| Category | ID Pattern | Example |
|----------|------------|---------|
| Characters | `character.*` | `character.greenkeeper` |
| Trees | `tree.[species].[size]` | `tree.oak.medium` |
| Equipment | `equipment.*` | `equipment.mower` |
| Irrigation | `irrigation.*` | `irrigation.pipe.straight` |
| Buildings | `building.*` | `building.clubhouse.tier2` |
| Props | `prop.*` | `prop.flag` |
| Golf | `golf.*` | `golf.ball` |

## Blender Conventions Summary

See `tools/blender/ASSET_CONVENTIONS.md` for full details.

**Scale:** 1 Blender unit = 1 game tile (~1 meter)

**Orientation:**
- +Y is up
- -Y is forward (character facing direction)
- Origin at base center (feet for characters)

**Polygon Budgets:**
- Characters: 300-800 polys
- Equipment: 200-500 polys
- Small props: 50-150 polys
- Pipe segments: 20-50 polys

**Materials:**
- Use vertex colors or solid color materials
- Avoid complex PBR (gets converted to flat shading)

**Animations (characters only):**
- `idle` - Standing still
- `walk` - Walking cycle (1 second loop)
- `push` - Pushing equipment (1 second loop)
- Optional: `wave`, `work`, `swing`

## Loading System

### AssetLoader.ts

The loader provides:

```typescript
// Load an asset (returns cached if already loaded)
const asset = await loadAsset(scene, "character.greenkeeper");

// Create an instance (clone) for placement
const instance = createInstance(scene, asset, "player1");
instance.root.position.set(5, 0, 5);

// Preload multiple assets
await preloadAssets(scene, ["character.greenkeeper", "equipment.mower"]);

// Check if asset exists in manifest
if (hasAsset("tree.willow.medium")) { ... }
```

### Caching

- Master assets are loaded once and cached
- Instances are clones of the cached master
- Masters are disabled (invisible); only clones render
- Call `clearAssetCache()` when disposing the scene

### Material Conversion

PBR materials from Blender are automatically converted to StandardMaterial for consistent isometric appearance:

- Albedo color becomes diffuse color
- Emissive is scaled to 30%
- Specular is reduced to 10%

## Entity Visual Systems

### EntityVisualSystem.ts

Handles player and character rendering:

```typescript
interface EntityAppearance {
  readonly assetId: AssetId;  // e.g., "character.greenkeeper"
  readonly scale: number;      // Usually 1.0
}

// Create visual state for an entity
const state = createEntityMesh(scene, "player", PLAYER_APPEARANCE, startX, startY);

// Update position with smooth interpolation
updateEntityVisualPosition(state, gridX, gridY, nextX, nextY, deltaMs, elevationProvider);
```

Key features:
- Smooth movement interpolation between grid cells
- Automatic rotation to face movement direction
- Elevation-aware positioning

### EmployeeVisualSystem.ts

Extends entity visuals with task-based equipment:

- Employees show different equipment meshes based on current task
- Equipment colors indicate task type (green for mowing, blue for watering, etc.)
- Equipment automatically attaches to and follows the employee

## Coordinate System

The game uses a simple 3D grid:

```typescript
// Grid to 3D world
function gridTo3D(gridX: number, gridY: number, elevation: number): Vector3 {
  return new Vector3(gridX, elevation, gridY);
}

// 3D world to grid
function worldToGrid(pos: Vector3): { x: number; y: number } {
  return { x: Math.floor(pos.x), y: Math.floor(pos.z) };
}
```

The orthographic camera creates the isometric appearance. No manual isometric calculations needed.

## Debugging

### Console Logs

The loader logs when using placeholders:
```
[AssetLoader] GLB not found: /assets/models/characters/greenkeeper.glb, using placeholder
```

### Visual Identification

Placeholder meshes are:
- Bright magenta color
- Wireframe rendering
- Sized according to manifest specs

If you see magenta boxes, the GLB file is missing or the path is incorrect.

### Common Issues

1. **Asset not loading** - Check path in manifest matches actual file location
2. **Wrong size** - Verify Blender scale (1 unit = 1 meter)
3. **Floating/sunk** - Check origin is at base center
4. **Facing wrong way** - -Y should be forward in Blender
5. **Too detailed** - Reduce polygon count for performance

## Performance Considerations

- Use instancing (createInstance) for multiple copies
- Keep polygon counts within budget
- Preload assets during loading screens
- Dispose instances when no longer needed
- Clear cache on scene disposal
