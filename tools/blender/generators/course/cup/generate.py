"""
Generator for course.cup

Run with:
    /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/blender/generators/course/cup/generate.py
"""

import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_cylinder, set_origin_to_base, join_objects
from _common.materials import create_solid_material

ASSET_ID = "course.cup"

COLORS = {
    "cup_outer": (0.65, 0.65, 0.68),
    "cup_rim": (0.75, 0.75, 0.78),
}

PARAMS = {
    "outer_radius": 0.054,
    "outer_height": 0.12,
    "rim_radius": 0.058,
    "rim_height": 0.015,
}


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    outer_mat = create_solid_material("CupOuter", COLORS["cup_outer"], roughness=0.3)
    rim_mat = create_solid_material("CupRim", COLORS["cup_rim"], roughness=0.2)

    parts: list[bpy.types.Object] = []

    outer = create_cylinder("CupOuter", radius=PARAMS["outer_radius"], height=PARAMS["outer_height"], segments=16)
    outer.data.materials.append(outer_mat)
    parts.append(outer)

    rim = create_cylinder(
        "CupRim",
        radius=PARAMS["rim_radius"],
        height=PARAMS["rim_height"],
        segments=16,
        location=(0, 0, PARAMS["outer_height"] - PARAMS["rim_height"]),
    )
    rim.data.materials.append(rim_mat)
    parts.append(rim)

    cup = join_objects(parts, name="HoleCup")
    set_origin_to_base(cup)

    print(f"\nGenerated mesh with {len(cup.data.polygons)} polygons")

    success = export_asset(ctx, validate=True, force=False)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print("\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
