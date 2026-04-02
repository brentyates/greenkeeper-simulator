"""
Generator for amenity.trash.bin

Run with:
    /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/blender/generators/amenity/trash_bin/generate.py
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

ASSET_ID = "amenity.trash.bin"

COLORS = {
    "body": (0.12, 0.28, 0.12),
    "lid": (0.10, 0.22, 0.10),
    "rim": (0.15, 0.15, 0.16),
}

PARAMS = {
    "body_radius": 0.22,
    "body_height": 0.85,
    "lid_radius": 0.23,
    "lid_height": 0.08,
    "rim_radius": 0.24,
    "rim_height": 0.03,
}


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    body_mat = create_solid_material("TrashBody", COLORS["body"])
    lid_mat = create_solid_material("TrashLid", COLORS["lid"])
    rim_mat = create_solid_material("TrashRim", COLORS["rim"], roughness=0.5)

    parts: list[bpy.types.Object] = []

    body = create_cylinder("Body", radius=PARAMS["body_radius"], height=PARAMS["body_height"], segments=16)
    body.data.materials.append(body_mat)
    parts.append(body)

    rim = create_cylinder(
        "Rim",
        radius=PARAMS["rim_radius"],
        height=PARAMS["rim_height"],
        segments=16,
        location=(0, 0, PARAMS["body_height"]),
    )
    rim.data.materials.append(rim_mat)
    parts.append(rim)

    lid = create_cylinder(
        "Lid",
        radius=PARAMS["lid_radius"],
        height=PARAMS["lid_height"],
        segments=16,
        location=(0, 0, PARAMS["body_height"] + PARAMS["rim_height"]),
    )
    lid.data.materials.append(lid_mat)
    parts.append(lid)

    trash_bin = join_objects(parts, name="TrashBin")
    set_origin_to_base(trash_bin)

    print(f"\nGenerated mesh with {len(trash_bin.data.polygons)} polygons")

    success = export_asset(ctx, validate=True, force=False)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print("\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
