"""
Generator for amenity.snack.bar

Run with:
    /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/blender/generators/amenity/snack_bar/generate.py
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

ASSET_ID = "amenity.snack.bar"

COLORS = {
    "walls": (0.78, 0.72, 0.62),
    "counter": (0.50, 0.32, 0.18),
    "roof": (0.40, 0.26, 0.16),
    "awning_red": (0.75, 0.18, 0.14),
    "awning_white": (0.92, 0.90, 0.88),
    "post": (0.45, 0.28, 0.14),
}

PARAMS = {
    "building_width": 3.60,
    "building_depth": 2.60,
    "building_height": 2.20,
    "roof_overhang": 0.12,
    "roof_height": 0.25,
    "counter_width": 3.60,
    "counter_depth": 0.40,
    "counter_height": 1.10,
    "awning_width": 3.80,
    "awning_depth": 1.20,
    "awning_height": 0.06,
    "awning_z": 2.20,
    "post_radius": 0.04,
    "post_height": 2.20,
}


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    wall_mat = create_solid_material("SnackWalls", COLORS["walls"])
    counter_mat = create_solid_material("SnackCounter", COLORS["counter"])
    roof_mat = create_solid_material("SnackRoof", COLORS["roof"])
    awning_red_mat = create_solid_material("AwningRed", COLORS["awning_red"])
    awning_white_mat = create_solid_material("AwningWhite", COLORS["awning_white"])
    post_mat = create_solid_material("AwningPost", COLORS["post"])

    parts: list[bpy.types.Object] = []

    building = create_box(
        name="Building",
        width=PARAMS["building_width"],
        depth=PARAMS["building_depth"],
        height=PARAMS["building_height"],
    )
    building.data.materials.append(wall_mat)
    parts.append(building)

    roof_w = PARAMS["building_width"] + PARAMS["roof_overhang"] * 2
    roof_d = PARAMS["building_depth"] + PARAMS["roof_overhang"] * 2
    roof = create_box(
        name="Roof",
        width=roof_w,
        depth=roof_d,
        height=PARAMS["roof_height"],
        location=(0, 0, PARAMS["building_height"]),
    )
    roof.data.materials.append(roof_mat)
    parts.append(roof)

    counter_y = -PARAMS["building_depth"] / 2 - PARAMS["counter_depth"] / 2
    counter = create_box(
        name="Counter",
        width=PARAMS["counter_width"],
        depth=PARAMS["counter_depth"],
        height=PARAMS["counter_height"],
        location=(0, counter_y, 0),
    )
    counter.data.materials.append(counter_mat)
    parts.append(counter)

    awning_y = -PARAMS["building_depth"] / 2 - PARAMS["awning_depth"] / 2
    stripe_count = 6
    stripe_width = PARAMS["awning_width"] / stripe_count
    for i in range(stripe_count):
        x = -PARAMS["awning_width"] / 2 + stripe_width * (i + 0.5)
        stripe = create_box(
            name=f"AwningStripe_{i}",
            width=stripe_width,
            depth=PARAMS["awning_depth"],
            height=PARAMS["awning_height"],
            location=(x, awning_y, PARAMS["awning_z"]),
        )
        mat = awning_red_mat if i % 2 == 0 else awning_white_mat
        stripe.data.materials.append(mat)
        parts.append(stripe)

    for sx in [-1, 1]:
        x = sx * (PARAMS["awning_width"] / 2 - 0.10)
        y = awning_y - PARAMS["awning_depth"] / 2 + 0.05
        post = create_cylinder(
            f"AwningPost_{sx}",
            radius=PARAMS["post_radius"],
            height=PARAMS["post_height"],
            segments=8,
            location=(x, y, 0),
        )
        post.data.materials.append(post_mat)
        parts.append(post)

    snack_bar = join_objects(parts, name="SnackBar")
    set_origin_to_base(snack_bar)

    print(f"\nGenerated mesh with {len(snack_bar.data.polygons)} polygons")

    success = export_asset(ctx, validate=True, force=False)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print("\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
