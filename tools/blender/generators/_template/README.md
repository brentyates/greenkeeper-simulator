# Asset Template

This is a template for creating new procedural asset generators.

## Quick Start

1. **Copy this folder** to your asset location:
   ```bash
   cp -r tools/blender/generators/_template tools/blender/generators/<category>/<name>
   ```

2. **Edit generate.py**:
   - Update `ASSET_ID` to match your asset from `AssetManifest.ts`
   - Define your parameters in `PARAMS`
   - Implement your generation logic in `generate()`

3. **Run the generator**:
   ```bash
   blender --background --python tools/blender/generators/<category>/<name>/generate.py
   ```

## Folder Structure

```
<category>/<name>/
  generate.py     # Main generation script (required)
  README.md       # Documentation (optional but recommended)
  textures/       # Any texture images (optional)
  reference.blend # Reference Blender file (optional)
  variants/       # Variant generators (optional)
```

## Available Utilities

Import from `_common`:

### context.py
- `setup_asset_context(asset_id)` - Set up clean scene, get specs
- `export_asset(ctx)` - Validate and export to GLB

### geometry.py
- `create_box()`, `create_cylinder()`, `create_cone()`
- `set_origin_to_base()`, `apply_transforms()`
- `join_objects()`, `randomize_vertices()`

### materials.py
- `create_solid_material(name, color)`
- `create_vertex_color_material(name)`
- `get_color(name)` - Predefined game colors

### nature.py
- `create_simple_pine()`, `create_simple_deciduous()`
- `create_shrub()`, `create_conical_foliage()`
- `create_simple_trunk()`, `create_spherical_foliage()`

## Tips

- Start with `force=True` in `export_asset()` during development
- Use seeds for reproducible randomization
- Check polygon counts against budget in `ASSET_CONVENTIONS.md`
- Test in-game with placeholder system before finalizing
