"""
Procedural generator for tree.pine.large asset.

Run with:
    blender --background --python tools/blender/generators/tree/pine_large/generate.py

Or interactively in Blender's scripting workspace.
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
from _common.nature import create_simple_pine
from _common.geometry import set_origin_to_base

# =============================================================================
# ASSET PARAMETERS
# =============================================================================

ASSET_ID = "tree.pine.large"

# Tunable parameters for this specific tree
PARAMS = {
    "total_height": 3.5,     # Target: 3.0-4.0m per spec
    "trunk_ratio": 0.25,     # How much is trunk vs foliage
    "base_radius": 0.5,      # Width of foliage at base (fits 1.2m footprint)
    "seed": 42,              # Random seed for reproducibility
}


# =============================================================================
# GENERATION
# =============================================================================

def generate():
    """Generate the tree.pine.large asset."""
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    # Set up clean context
    ctx = setup_asset_context(ASSET_ID)

    print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
    print(f"Generating with height={PARAMS['total_height']}m")

    # Generate the tree
    tree = create_simple_pine(
        total_height=PARAMS["total_height"],
        trunk_ratio=PARAMS["trunk_ratio"],
        base_radius=PARAMS["base_radius"],
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
