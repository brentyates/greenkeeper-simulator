"""
Procedural generator for tree.oak.medium asset.

Run with:
    blender --background --python tools/blender/generators/tree/oak_medium/generate.py
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
from _common.nature import create_simple_deciduous
from _common.geometry import set_origin_to_base

# =============================================================================
# ASSET PARAMETERS
# =============================================================================

ASSET_ID = "tree.oak.medium"

# Tunable parameters for this specific tree
PARAMS = {
    "total_height": 4.5,     # Adjusted to hit 2.0-3.0m actual height
    "trunk_ratio": 0.35,     # How much is trunk vs foliage
    "crown_radius": 0.55,    # Radius of crown (fits 1.2m footprint)
    "seed": 123,             # Random seed for reproducibility
}


# =============================================================================
# GENERATION
# =============================================================================

def generate():
    """Generate the tree.oak.medium asset."""
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    # Set up clean context
    ctx = setup_asset_context(ASSET_ID)

    print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
    print(f"Generating with height={PARAMS['total_height']}m")

    # Generate the tree
    tree = create_simple_deciduous(
        total_height=PARAMS["total_height"],
        trunk_ratio=PARAMS["trunk_ratio"],
        crown_radius=PARAMS["crown_radius"],
        seed=PARAMS["seed"]
    )

    # Ensure origin is at base
    set_origin_to_base(tree)

    print(f"\nGenerated tree with {len(tree.data.polygons)} polygons")

    # Export
    success = export_asset(ctx, validate=True)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print(f"\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
