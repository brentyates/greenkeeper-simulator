"""
Generator for amenity.restroom

Run with:
    /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/blender/generators/amenity/restroom/generate.py
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

ASSET_ID = "amenity.restroom"

COLORS = {
    "walls": (0.82, 0.76, 0.65),
    "roof": (0.42, 0.28, 0.18),
    "door": (0.35, 0.22, 0.12),
    "trim": (0.70, 0.68, 0.60),
}

PARAMS = {
    "wall_width": 2.80,
    "wall_depth": 3.60,
    "wall_height": 2.60,
    "roof_overhang": 0.15,
    "roof_height": 0.30,
    "door_width": 0.70,
    "door_height": 1.90,
    "door_depth": 0.06,
    "door_offset_x": -0.60,
    "trim_width": 2.80,
    "trim_depth": 3.60,
    "trim_height": 0.08,
}


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    wall_mat = create_solid_material("RestroomWalls", COLORS["walls"])
    roof_mat = create_solid_material("RestroomRoof", COLORS["roof"])
    door_mat = create_solid_material("RestroomDoor", COLORS["door"])
    trim_mat = create_solid_material("RestroomTrim", COLORS["trim"])

    parts: list[bpy.types.Object] = []

    walls = create_box(
        name="Walls",
        width=PARAMS["wall_width"],
        depth=PARAMS["wall_depth"],
        height=PARAMS["wall_height"],
    )
    walls.data.materials.append(wall_mat)
    parts.append(walls)

    trim = create_box(
        name="Trim",
        width=PARAMS["trim_width"] + 0.02,
        depth=PARAMS["trim_depth"] + 0.02,
        height=PARAMS["trim_height"],
        location=(0, 0, PARAMS["wall_height"]),
    )
    trim.data.materials.append(trim_mat)
    parts.append(trim)

    roof_w = PARAMS["wall_width"] + PARAMS["roof_overhang"] * 2
    roof_d = PARAMS["wall_depth"] + PARAMS["roof_overhang"] * 2
    roof = create_box(
        name="Roof",
        width=roof_w,
        depth=roof_d,
        height=PARAMS["roof_height"],
        location=(0, 0, PARAMS["wall_height"] + PARAMS["trim_height"]),
    )
    roof.data.materials.append(roof_mat)
    parts.append(roof)

    door_y = -PARAMS["wall_depth"] / 2 - PARAMS["door_depth"] / 2 + 0.01
    door = create_box(
        name="Door",
        width=PARAMS["door_width"],
        depth=PARAMS["door_depth"],
        height=PARAMS["door_height"],
        location=(PARAMS["door_offset_x"], door_y, 0),
    )
    door.data.materials.append(door_mat)
    parts.append(door)

    door2 = create_box(
        name="Door2",
        width=PARAMS["door_width"],
        depth=PARAMS["door_depth"],
        height=PARAMS["door_height"],
        location=(-PARAMS["door_offset_x"], door_y, 0),
    )
    door2.data.materials.append(door_mat)
    parts.append(door2)

    restroom = join_objects(parts, name="Restroom")
    set_origin_to_base(restroom)

    print(f"\nGenerated mesh with {len(restroom.data.polygons)} polygons")

    success = export_asset(ctx, validate=True, force=False)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print("\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
