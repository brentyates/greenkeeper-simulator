# Blender Asset Conventions for Greenkeeper Simulator

## Two Workflows

### 1. Procedural Generation (Recommended)
Use Python scripts to generate assets programmatically:
```bash
blender --background --python tools/blender/generators/tree/pine_medium/generate.py
```
See `generators/README.md` for details.

### 2. Manual Modeling
Model in Blender using the reference scene, then export with `export_glb.py`.

---

## Scale & Units
- **1 Blender unit = 1 game tile** (approximately 1 meter)
- Character height: ~1.8 units (average person)
- Tile objects (pipes, sprinklers): fit within 1x1 unit footprint

## Orientation
- **+Y is up** (Blender default)
- **-Y is forward** (character facing direction)
- Origin at base center of object (feet for characters)

## Polygon Budget (Low-poly aesthetic)
| Asset Type | Target Polygons |
|------------|-----------------|
| Character | 300-800 |
| Equipment (mower) | 200-500 |
| Small prop (sprinkler) | 50-150 |
| Pipe segment | 20-50 |

## Naming Conventions
```
characters/
  greenkeeper.glb      # Main playable character
  employee.glb         # Generic worker

equipment/
  mower.glb            # Push mower
  spreader.glb         # Fertilizer spreader
  sprinkler_handheld.glb

irrigation/
  pipe_straight.glb    # Straight pipe segment
  pipe_corner.glb      # 90-degree corner
  pipe_tee.glb         # T-junction
  pipe_cross.glb       # 4-way cross
  sprinkler_head.glb   # Pop-up sprinkler
  water_source.glb     # Pump/well

props/
  flag.glb             # Hole flag
  tee_marker.glb       # Tee box marker
  ball.glb             # Golf ball
```

## Animation Naming (for characters)
Required animations:
- `idle` - Standing still
- `walk` - Walking cycle (1 second loop)
- `push` - Pushing equipment (1 second loop)

Optional:
- `wave` - Greeting gesture
- `work` - Generic working motion

## Materials
- Use **vertex colors** for simple coloring (no textures needed)
- Or use **solid color materials** (single diffuse color)
- Materials export as-is - what you see in Blender is what you get in-game
- Complex PBR may not render as expected in-game; test and adjust

## Export Checklist
1. Apply all transforms (Ctrl+A → All Transforms)
2. Apply modifiers if needed
3. Check origin is at base center
4. Verify scale (character ~1.8 units tall)
5. Run export script: `blender file.blend --background --python export_glb.py -- output.glb`

## Quick Test in Babylon.js
After export, test with:
```javascript
import { loadAsset, createInstance } from './babylon/assets/AssetLoader';

const asset = await loadAsset(scene, 'character.greenkeeper');
const instance = createInstance(scene, asset, 'player');
instance.root.position.set(5, 0, 5);
```

## Procedural Generation

For procedural/AI-assisted asset creation, see `generators/`:

```
generators/
  _common/          # Shared utilities
    context.py      # Scene setup and export
    geometry.py     # Mesh creation helpers
    materials.py    # Material utilities
    nature.py       # Tree/vegetation generators

  _template/        # Copy to create new assets
  tree/pine_medium/ # Example generator
```

### Creating a New Procedural Asset

```bash
# 1. Copy template
cp -r tools/blender/generators/_template tools/blender/generators/equipment/mower

# 2. Edit generate.py - set ASSET_ID and implement geometry

# 3. Generate
blender --background --python tools/blender/generators/equipment/mower/generate.py
```

### Common Colors (materials.py)

```python
from _common.materials import get_color

# Vegetation
get_color("leaves_green")     # (0.2, 0.5, 0.15)
get_color("pine_needles")     # (0.15, 0.35, 0.15)
get_color("tree_bark_dark")   # (0.25, 0.18, 0.12)

# Equipment
get_color("metal_painted_green")  # (0.15, 0.35, 0.15)
get_color("rubber_black")         # (0.1, 0.1, 0.1)
get_color("metal_silver")         # (0.7, 0.7, 0.72)

# Characters
get_color("shirt_polo")       # (0.9, 0.9, 0.85)
get_color("pants_khaki")      # (0.6, 0.55, 0.4)
```
