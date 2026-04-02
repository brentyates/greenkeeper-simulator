"""
Generator for amenity.drinking.fountain

Run with:
    /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/blender/generators/amenity/drinking_fountain/generate.py
"""

import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_box, create_cylinder, set_origin_to_base, join_objects
from _common.materials import create_solid_material

ASSET_ID = "amenity.drinking.fountain"

COLORS = {
    "stone": (0.72, 0.70, 0.66),
    "basin": (0.65, 0.63, 0.60),
    "spout": (0.55, 0.55, 0.58),
}

PARAMS = {
    "pedestal_width": 0.28,
    "pedestal_depth": 0.28,
    "pedestal_height": 0.72,
    "basin_radius": 0.18,
    "basin_height": 0.10,
    "basin_inner_radius": 0.14,
    "basin_inner_depth": 0.06,
    "spout_radius": 0.02,
    "spout_height": 0.14,
}


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    stone_mat = create_solid_material("FountainStone", COLORS["stone"])
    basin_mat = create_solid_material("FountainBasin", COLORS["basin"])
    spout_mat = create_solid_material("FountainSpout", COLORS["spout"], roughness=0.3)

    parts: list[bpy.types.Object] = []

    pedestal = create_box(
        name="Pedestal",
        width=PARAMS["pedestal_width"],
        depth=PARAMS["pedestal_depth"],
        height=PARAMS["pedestal_height"],
    )
    pedestal.data.materials.append(stone_mat)
    parts.append(pedestal)

    basin = create_cylinder(
        "Basin",
        radius=PARAMS["basin_radius"],
        height=PARAMS["basin_height"],
        segments=16,
        location=(0, 0, PARAMS["pedestal_height"]),
    )
    basin.data.materials.append(basin_mat)
    parts.append(basin)

    spout = create_cylinder(
        "Spout",
        radius=PARAMS["spout_radius"],
        height=PARAMS["spout_height"],
        segments=8,
        location=(0, -0.06, PARAMS["pedestal_height"] + PARAMS["basin_height"]),
    )
    spout.data.materials.append(spout_mat)
    parts.append(spout)

    fountain = join_objects(parts, name="DrinkingFountain")
    set_origin_to_base(fountain)

    print(f"\nGenerated mesh with {len(fountain.data.polygons)} polygons")

    success = export_asset(ctx, validate=True, force=False)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print("\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
