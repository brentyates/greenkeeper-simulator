"""
Template for procedural asset generation.

USAGE:
1. Copy this folder to generators/<category>/<name>/
2. Update ASSET_ID to match your asset (e.g., "tree.oak.small")
3. Implement the generate() function
4. Run: blender --background --python generate.py

Example:
    cp -r tools/blender/generators/_template tools/blender/generators/equipment/mower
    # Edit generate.py with asset_id="equipment.mower" and generation logic
    blender --background --python tools/blender/generators/equipment/mower/generate.py
"""

import bpy
import sys
import os

# Add generators path for imports
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_box, set_origin_to_base, join_objects
from _common.materials import create_solid_material, get_color

# =============================================================================
# ASSET CONFIGURATION
# =============================================================================

# TODO: Change this to your asset ID from AssetManifest.ts
ASSET_ID = "prop.placeholder"

# TODO: Define your tunable parameters
PARAMS = {
    "width": 1.0,
    "height": 1.0,
    "depth": 1.0,
    "color": (0.5, 0.5, 0.5),  # Gray placeholder
}


# =============================================================================
# GENERATION LOGIC
# =============================================================================

def generate():
    """
    Generate the asset.

    TODO: Replace this placeholder with your actual generation logic.
    """
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    # Set up clean context
    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    # =========================================================================
    # TODO: Replace this placeholder geometry with your actual generation
    # =========================================================================

    # Create a simple box as placeholder
    obj = create_box(
        name="Placeholder",
        width=PARAMS["width"],
        depth=PARAMS["depth"],
        height=PARAMS["height"]
    )

    # Apply material
    mat = create_solid_material("PlaceholderMaterial", PARAMS["color"])
    obj.data.materials.append(mat)

    # Ensure origin is at base center
    set_origin_to_base(obj)

    # =========================================================================
    # End of generation logic
    # =========================================================================

    print(f"\nGenerated mesh with {len(obj.data.polygons)} polygons")

    # Export (set force=True to export even if validation fails during development)
    success = export_asset(ctx, validate=True, force=False)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print(f"\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
