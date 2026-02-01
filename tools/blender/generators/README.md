# Procedural Asset Generators

This folder contains procedural generators for creating 3D assets programmatically.

## Folder Structure

```
generators/
  _common/              # Shared utilities (DO NOT MODIFY unless adding features)
    context.py          # Scene setup and export
    geometry.py         # Mesh creation helpers
    materials.py        # Material utilities and color palette
    nature.py           # Tree/vegetation generators

  _template/            # Copy this to create new generators
    generate.py         # Template script
    README.md           # Template documentation

  tree/                 # Tree assets
    pine_medium/        # tree.pine.medium
      generate.py
      README.md

  shrub/                # Shrub assets (TODO)
  equipment/            # Equipment assets (TODO)
  character/            # Character assets (TODO)
  building/             # Building assets (TODO)
  prop/                 # Prop assets (TODO)
```

## Quick Start

### Generate an existing asset

```bash
# Generate medium pine tree
blender --background --python tools/blender/generators/tree/pine_medium/generate.py
```

### Create a new generator

```bash
# 1. Copy template
cp -r tools/blender/generators/_template tools/blender/generators/equipment/mower

# 2. Edit the script
#    - Set ASSET_ID = "equipment.mower"
#    - Implement generation logic

# 3. Run it
blender --background --python tools/blender/generators/equipment/mower/generate.py
```

## Workflow with AI

When working with AI to generate assets:

1. **Describe what you need** - e.g., "a low-poly push lawn mower, ~0.5m tall, green body, black wheels"

2. **AI generates/modifies generate.py** - The AI can write procedural generation code

3. **Run and iterate**:
   ```bash
   blender --background --python tools/blender/generators/equipment/mower/generate.py
   ```

4. **View result in game** - The placeholder system will show the new GLB

5. **Refine** - Adjust parameters, ask AI to modify geometry, repeat

## Per-Asset Organization

Each generator folder can contain:

| File/Folder | Purpose |
|-------------|---------|
| `generate.py` | **Required** - Main generation script |
| `README.md` | Documentation and parameters |
| `textures/` | Texture images if needed |
| `reference.blend` | Reference Blender file |
| `reference/` | Reference images |
| `variants/` | Variant generators |

## Batch Generation

Generate all assets:

```bash
# Generate all tree variants
for f in tools/blender/generators/tree/*/generate.py; do
  blender --background --python "$f"
done

# Generate everything
find tools/blender/generators -name "generate.py" -not -path "*/_template/*" | while read f; do
  blender --background --python "$f"
done
```

## Validation

All generators automatically validate against specs in `AssetManifest.ts`:
- Height range check
- Footprint check
- Origin placement check

Use `force=True` in `export_asset()` during development to bypass validation.
