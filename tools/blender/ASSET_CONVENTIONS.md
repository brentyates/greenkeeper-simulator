# Blender Asset Conventions for Greenkeeper Simulator

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
- Avoid complex PBR setups - they get converted to flat shading

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
