"""
Procedural generator for equipment.rake asset.

Run with:
    blender --background --python tools/blender/generators/equipment/rake/generate.py
"""

import bpy
import sys
import os
import math

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_cylinder, create_box, set_origin_to_base, join_objects
from _common.materials import create_solid_material

ASSET_ID = "equipment.rake"

PARAMS = {
    "handle_radius": 0.012,
    "handle_height": 0.52,
    "head_width": 0.15,
    "head_depth": 0.04,
    "head_height": 0.015,
    "tine_count": 8,
    "tine_radius": 0.004,
    "tine_length": 0.03,
    "color_handle": (0.55, 0.4, 0.25),
    "color_head": (0.5, 0.5, 0.55),
}


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    mat_handle = create_solid_material("RakeHandle", PARAMS["color_handle"])
    mat_head = create_solid_material("RakeHead", PARAMS["color_head"], roughness=0.6)

    parts = []

    handle = create_cylinder(
        name="Handle",
        radius=PARAMS["handle_radius"],
        height=PARAMS["handle_height"],
        segments=8,
        location=(0, 0, PARAMS["head_height"] + PARAMS["tine_length"])
    )
    handle.data.materials.append(mat_handle)
    parts.append(handle)

    head_z = PARAMS["tine_length"]
    head = create_box(
        name="Head",
        width=PARAMS["head_width"],
        depth=PARAMS["head_depth"],
        height=PARAMS["head_height"],
        location=(0, 0, head_z)
    )
    head.data.materials.append(mat_head)
    parts.append(head)

    tine_spacing = PARAMS["head_width"] / (PARAMS["tine_count"] + 1)
    start_x = -PARAMS["head_width"] / 2 + tine_spacing

    for i in range(PARAMS["tine_count"]):
        tine_x = start_x + i * tine_spacing
        tine = create_cylinder(
            name=f"Tine_{i}",
            radius=PARAMS["tine_radius"],
            height=PARAMS["tine_length"],
            segments=6,
            location=(tine_x, 0, 0)
        )
        tine.data.materials.append(mat_head)
        parts.append(tine)

    rake = join_objects(parts, name="Rake")
    set_origin_to_base(rake)

    poly_count = len(rake.data.polygons)
    print(f"\nGenerated mesh with {poly_count} polygons")

    success = export_asset(ctx, validate=True, force=False)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print(f"\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
