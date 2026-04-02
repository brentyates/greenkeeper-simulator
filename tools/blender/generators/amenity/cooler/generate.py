"""
Generator for amenity.cooler

Run with:
    /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/blender/generators/amenity/cooler/generate.py
"""

import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_box, set_origin_to_base, join_objects
from _common.materials import create_solid_material

ASSET_ID = "amenity.cooler"

COLORS = {
    "body": (0.22, 0.42, 0.72),
    "lid": (0.88, 0.88, 0.90),
    "handle": (0.30, 0.30, 0.32),
}

PARAMS = {
    "body_width": 0.36,
    "body_depth": 0.36,
    "body_height": 0.70,
    "lid_height": 0.08,
    "handle_width": 0.20,
    "handle_depth": 0.03,
    "handle_height": 0.06,
}


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    body_mat = create_solid_material("CoolerBody", COLORS["body"])
    lid_mat = create_solid_material("CoolerLid", COLORS["lid"])
    handle_mat = create_solid_material("CoolerHandle", COLORS["handle"], roughness=0.6)

    parts: list[bpy.types.Object] = []

    body = create_box(
        name="Body",
        width=PARAMS["body_width"],
        depth=PARAMS["body_depth"],
        height=PARAMS["body_height"],
    )
    body.data.materials.append(body_mat)
    parts.append(body)

    lid = create_box(
        name="Lid",
        width=PARAMS["body_width"],
        depth=PARAMS["body_depth"],
        height=PARAMS["lid_height"],
        location=(0, 0, PARAMS["body_height"]),
    )
    lid.data.materials.append(lid_mat)
    parts.append(lid)

    handle = create_box(
        name="Handle",
        width=PARAMS["handle_width"],
        depth=PARAMS["handle_depth"],
        height=PARAMS["handle_height"],
        location=(0, 0, PARAMS["body_height"] + PARAMS["lid_height"]),
    )
    handle.data.materials.append(handle_mat)
    parts.append(handle)

    cooler = join_objects(parts, name="Cooler")
    set_origin_to_base(cooler)

    print(f"\nGenerated mesh with {len(cooler.data.polygons)} polygons")

    success = export_asset(ctx, validate=True, force=False)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print("\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
