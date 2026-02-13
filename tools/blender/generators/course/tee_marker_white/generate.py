"""
Procedural generator for course.tee.marker.white asset.

Run with:
    /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/blender/generators/course/tee_marker_white/generate.py
"""

import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_cylinder, create_cone, set_origin_to_base, join_objects
from _common.materials import create_solid_material

ASSET_ID = "course.tee.marker.white"

PARAMS = {
    "color_base": (0.12, 0.12, 0.12),
    "color_cap": (0.90, 0.91, 0.92),
    "color_ring": (0.74, 0.76, 0.79),
}


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    mat_base = create_solid_material("TeeWhiteBaseMat", PARAMS["color_base"], roughness=0.88)
    mat_cap = create_solid_material("TeeWhiteCapMat", PARAMS["color_cap"], roughness=0.46)
    mat_ring = create_solid_material("TeeWhiteRingMat", PARAMS["color_ring"], roughness=0.34)

    parts: list[bpy.types.Object] = []

    base = create_cylinder("TeeWhiteBase", radius=0.048, height=0.050, segments=18, location=(0, 0, 0))
    base.data.materials.append(mat_base)
    parts.append(base)

    cap = create_cone("TeeWhiteCap", radius=0.046, height=0.110, segments=20, location=(0, 0, 0.050))
    cap.data.materials.append(mat_cap)
    parts.append(cap)

    ring = create_cylinder("TeeWhiteRing", radius=0.039, height=0.010, segments=20, location=(0, 0, 0.054))
    ring.data.materials.append(mat_ring)
    parts.append(ring)

    marker = join_objects(parts, name="TeeMarkerWhite")
    set_origin_to_base(marker)

    poly_count = len(marker.data.polygons)
    print(f"\nGenerated mesh with {poly_count} polygons")

    success = export_asset(ctx, validate=True, force=False)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print("\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
