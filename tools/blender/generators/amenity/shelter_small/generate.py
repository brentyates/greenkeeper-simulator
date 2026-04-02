"""
Generator for amenity.shelter.small

Run with:
    /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/blender/generators/amenity/shelter_small/generate.py
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

ASSET_ID = "amenity.shelter.small"

COLORS = {
    "post": (0.45, 0.28, 0.14),
    "roof": (0.18, 0.30, 0.18),
}

PARAMS = {
    "footprint": 2.80,
    "post_radius": 0.06,
    "post_height": 2.40,
    "roof_width": 2.90,
    "roof_depth": 2.90,
    "roof_height": 0.12,
    "post_inset": 1.20,
}


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    post_mat = create_solid_material("ShelterPost", COLORS["post"])
    roof_mat = create_solid_material("ShelterRoof", COLORS["roof"])

    parts: list[bpy.types.Object] = []

    for sx in [-1, 1]:
        for sy in [-1, 1]:
            x = sx * PARAMS["post_inset"]
            y = sy * PARAMS["post_inset"]
            post = create_cylinder(
                f"Post_{sx}_{sy}",
                radius=PARAMS["post_radius"],
                height=PARAMS["post_height"],
                segments=8,
                location=(x, y, 0),
            )
            post.data.materials.append(post_mat)
            parts.append(post)

    roof = create_box(
        name="Roof",
        width=PARAMS["roof_width"],
        depth=PARAMS["roof_depth"],
        height=PARAMS["roof_height"],
        location=(0, 0, PARAMS["post_height"]),
    )
    roof.data.materials.append(roof_mat)
    parts.append(roof)

    shelter = join_objects(parts, name="ShelterSmall")
    set_origin_to_base(shelter)

    print(f"\nGenerated mesh with {len(shelter.data.polygons)} polygons")

    success = export_asset(ctx, validate=True, force=False)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print("\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
