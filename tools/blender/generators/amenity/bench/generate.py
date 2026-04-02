"""
Generator for amenity.bench

Run with:
    /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/blender/generators/amenity/bench/generate.py
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

ASSET_ID = "amenity.bench"

COLORS = {
    "wood": (0.45, 0.28, 0.14),
    "legs": (0.22, 0.22, 0.24),
}

PARAMS = {
    "seat_width": 1.40,
    "seat_depth": 0.38,
    "seat_height": 0.04,
    "seat_z": 0.44,
    "back_width": 1.40,
    "back_depth": 0.03,
    "back_height": 0.36,
    "leg_width": 0.06,
    "leg_depth": 0.40,
    "leg_height": 0.44,
    "leg_inset": 0.15,
}


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    wood_mat = create_solid_material("BenchWood", COLORS["wood"])
    leg_mat = create_solid_material("BenchLegs", COLORS["legs"], roughness=0.6)

    parts: list[bpy.types.Object] = []

    seat = create_box(
        name="Seat",
        width=PARAMS["seat_width"],
        depth=PARAMS["seat_depth"],
        height=PARAMS["seat_height"],
        location=(0, 0, PARAMS["seat_z"]),
    )
    seat.data.materials.append(wood_mat)
    parts.append(seat)

    back = create_box(
        name="Back",
        width=PARAMS["back_width"],
        depth=PARAMS["back_depth"],
        height=PARAMS["back_height"],
        location=(0, -PARAMS["seat_depth"] / 2 + PARAMS["back_depth"] / 2, PARAMS["seat_z"] + PARAMS["seat_height"]),
    )
    back.data.materials.append(wood_mat)
    parts.append(back)

    for side in [-1, 1]:
        x = side * (PARAMS["seat_width"] / 2 - PARAMS["leg_inset"])
        leg = create_box(
            name=f"Leg_{side}",
            width=PARAMS["leg_width"],
            depth=PARAMS["leg_depth"],
            height=PARAMS["leg_height"],
            location=(x, 0, 0),
        )
        leg.data.materials.append(leg_mat)
        parts.append(leg)

    bench = join_objects(parts, name="Bench")
    set_origin_to_base(bench)

    print(f"\nGenerated mesh with {len(bench.data.polygons)} polygons")

    success = export_asset(ctx, validate=True, force=False)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print("\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
