"""
Procedural generator for equipment.sprinkler.handheld asset.

Run with:
    blender --background --python tools/blender/generators/equipment/sprinkler_handheld/generate.py
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
from _common.geometry import create_cylinder, set_origin_to_base, join_objects
from _common.materials import create_solid_material

ASSET_ID = "equipment.sprinkler.handheld"

PARAMS = {
    "handle_radius": 0.012,
    "handle_length": 0.10,
    "wand_radius": 0.008,
    "wand_length": 0.06,
    "nozzle_radius": 0.015,
    "nozzle_length": 0.02,
    "color_handle": (0.2, 0.5, 0.2),
    "color_nozzle": (0.6, 0.6, 0.65),
}


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    mat_handle = create_solid_material("SprinklerHandle", PARAMS["color_handle"])
    mat_nozzle = create_solid_material("SprinklerNozzle", PARAMS["color_nozzle"], roughness=0.3)

    parts = []

    handle = create_cylinder(
        name="Handle",
        radius=PARAMS["handle_radius"],
        height=PARAMS["handle_length"],
        segments=12,
        location=(0, 0, 0)
    )
    handle.data.materials.append(mat_handle)
    parts.append(handle)

    wand = create_cylinder(
        name="Wand",
        radius=PARAMS["wand_radius"],
        height=PARAMS["wand_length"],
        segments=12,
        location=(0, 0, PARAMS["handle_length"])
    )
    wand.data.materials.append(mat_nozzle)
    parts.append(wand)

    nozzle_z = PARAMS["handle_length"] + PARAMS["wand_length"]
    nozzle = create_cylinder(
        name="Nozzle",
        radius=PARAMS["nozzle_radius"],
        height=PARAMS["nozzle_length"],
        segments=12,
        location=(0, 0, nozzle_z)
    )
    nozzle.data.materials.append(mat_nozzle)
    parts.append(nozzle)

    sprinkler = join_objects(parts, name="HandheldSprinkler")
    set_origin_to_base(sprinkler)

    poly_count = len(sprinkler.data.polygons)
    print(f"\nGenerated mesh with {poly_count} polygons")

    success = export_asset(ctx, validate=True, force=False)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print(f"\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
