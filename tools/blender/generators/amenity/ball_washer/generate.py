"""
Generator for amenity.ball.washer

Run with:
    /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/blender/generators/amenity/ball_washer/generate.py
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

ASSET_ID = "amenity.ball.washer"

COLORS = {
    "post": (0.50, 0.50, 0.52),
    "washer_body": (0.60, 0.60, 0.62),
    "towel": (0.90, 0.88, 0.80),
}

PARAMS = {
    "post_radius": 0.03,
    "post_height": 0.70,
    "body_width": 0.18,
    "body_depth": 0.14,
    "body_height": 0.22,
    "towel_width": 0.12,
    "towel_depth": 0.02,
    "towel_height": 0.18,
}


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    post_mat = create_solid_material("BallWasherPost", COLORS["post"], roughness=0.4)
    body_mat = create_solid_material("BallWasherBody", COLORS["washer_body"], roughness=0.4)
    towel_mat = create_solid_material("BallWasherTowel", COLORS["towel"])

    parts: list[bpy.types.Object] = []

    post = create_cylinder("Post", radius=PARAMS["post_radius"], height=PARAMS["post_height"], segments=10)
    post.data.materials.append(post_mat)
    parts.append(post)

    body = create_box(
        name="WasherBody",
        width=PARAMS["body_width"],
        depth=PARAMS["body_depth"],
        height=PARAMS["body_height"],
        location=(0, 0, PARAMS["post_height"]),
    )
    body.data.materials.append(body_mat)
    parts.append(body)

    towel = create_box(
        name="Towel",
        width=PARAMS["towel_width"],
        depth=PARAMS["towel_depth"],
        height=PARAMS["towel_height"],
        location=(PARAMS["body_width"] / 2 + PARAMS["towel_depth"], 0, PARAMS["post_height"] + 0.02),
    )
    towel.data.materials.append(towel_mat)
    parts.append(towel)

    washer = join_objects(parts, name="BallWasher")
    set_origin_to_base(washer)

    print(f"\nGenerated mesh with {len(washer.data.polygons)} polygons")

    success = export_asset(ctx, validate=True, force=False)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print("\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
