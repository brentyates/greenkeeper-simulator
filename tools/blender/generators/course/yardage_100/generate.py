"""
Generator for course.yardage.marker.100

Run with:
    /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/blender/generators/course/yardage_100/generate.py
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

ASSET_ID = "course.yardage.marker.100"

COLORS = {
    "post": (0.90, 0.90, 0.88),
    "plate": (0.85, 0.85, 0.82),
    "base": (0.60, 0.60, 0.58),
}

PARAMS = {
    "post_radius": 0.04,
    "post_height": 0.32,
    "plate_width": 0.14,
    "plate_depth": 0.14,
    "plate_height": 0.03,
    "base_radius": 0.06,
    "base_height": 0.03,
}


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    post_mat = create_solid_material("YardagePost", COLORS["post"])
    plate_mat = create_solid_material("YardagePlate", COLORS["plate"])
    base_mat = create_solid_material("YardageBase", COLORS["base"])

    parts: list[bpy.types.Object] = []

    base = create_cylinder("Base", radius=PARAMS["base_radius"], height=PARAMS["base_height"], segments=12)
    base.data.materials.append(base_mat)
    parts.append(base)

    post = create_cylinder(
        "Post",
        radius=PARAMS["post_radius"],
        height=PARAMS["post_height"],
        segments=10,
        location=(0, 0, PARAMS["base_height"]),
    )
    post.data.materials.append(post_mat)
    parts.append(post)

    plate = create_box(
        name="Plate",
        width=PARAMS["plate_width"],
        depth=PARAMS["plate_depth"],
        height=PARAMS["plate_height"],
        location=(0, 0, PARAMS["base_height"] + PARAMS["post_height"]),
    )
    plate.data.materials.append(plate_mat)
    parts.append(plate)

    marker = join_objects(parts, name="YardageMarker100")
    set_origin_to_base(marker)

    print(f"\nGenerated mesh with {len(marker.data.polygons)} polygons")

    success = export_asset(ctx, validate=True, force=False)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print("\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
