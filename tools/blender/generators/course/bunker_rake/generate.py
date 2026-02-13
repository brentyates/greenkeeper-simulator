"""
Procedural generator for course.bunker.rake asset.

Run with:
    blender --background --python tools/blender/generators/course/bunker_rake/generate.py
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

ASSET_ID = "course.bunker.rake"

PARAMS = {
    "color_shell": (0.22, 0.56, 0.24),
    "color_base": (0.10, 0.10, 0.10),
    "color_trim": (0.80, 0.82, 0.84),
    "color_tine": (0.72, 0.76, 0.80),
}


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    mat_shell = create_solid_material("RakeBotShell", PARAMS["color_shell"], roughness=0.45)
    mat_base = create_solid_material("RakeBotBase", PARAMS["color_base"], roughness=0.92)
    mat_trim = create_solid_material("RakeBotTrim", PARAMS["color_trim"], roughness=0.35)
    mat_tine = create_solid_material("RakeBotTine", PARAMS["color_tine"], roughness=0.28)

    parts: list[bpy.types.Object] = []

    base = create_box("BaseSkirt", width=0.34, depth=0.09, height=0.12, location=(0, 0, 0.0))
    base.data.materials.append(mat_base)
    parts.append(base)

    shell = create_box("Shell", width=0.28, depth=0.08, height=0.09, location=(0, 0, 0.12))
    shell.data.materials.append(mat_shell)
    parts.append(shell)

    rear_rake_bar = create_box("RearRakeBar", width=0.34, depth=0.02, height=0.03, location=(0, 0.035, 0.03))
    rear_rake_bar.data.materials.append(mat_tine)
    parts.append(rear_rake_bar)

    tine_x = -0.14
    for idx in range(9):
        tine = create_cylinder(
            name=f"Tine_{idx}",
            radius=0.0025,
            height=0.025,
            segments=6,
            location=(tine_x, 0.046, 0.0),
        )
        tine.data.materials.append(mat_tine)
        parts.append(tine)
        tine_x += 0.035

    mast = create_cylinder("SensorMast", radius=0.004, height=1.30, segments=8, location=(0, 0.0, 0.20))
    mast.data.materials.append(mat_trim)
    parts.append(mast)

    mast_head = create_cylinder("SensorHead", radius=0.03, height=0.05, segments=10, location=(0, 0.0, 1.50))
    mast_head.data.materials.append(mat_trim)
    parts.append(mast_head)

    bot = join_objects(parts, name="BunkerRakeBot")
    set_origin_to_base(bot)

    poly_count = len(bot.data.polygons)
    print(f"\nGenerated mesh with {poly_count} polygons")

    success = export_asset(ctx, validate=True, force=False)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print("\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
