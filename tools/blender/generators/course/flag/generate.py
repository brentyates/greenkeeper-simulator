"""
Procedural generator for course.flag asset.

Run with:
    /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/blender/generators/course/flag/generate.py
"""

import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_box, create_cylinder, create_cone, set_origin_to_base, join_objects
from _common.materials import create_solid_material

ASSET_ID = "course.flag"

PARAMS = {
    "color_pole": (0.74, 0.76, 0.78),
    "color_flag": (0.86, 0.16, 0.14),
    "color_tip": (0.18, 0.18, 0.20),
}


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    mat_pole = create_solid_material("FlagPoleMat", PARAMS["color_pole"], roughness=0.35)
    mat_flag = create_solid_material("FlagClothMat", PARAMS["color_flag"], roughness=0.70)
    mat_tip = create_solid_material("FlagTipMat", PARAMS["color_tip"], roughness=0.30)

    parts: list[bpy.types.Object] = []

    pole = create_cylinder(
        name="FlagPole",
        radius=0.022,
        height=2.10,
        segments=18,
        location=(0, 0, 0),
    )
    pole.data.materials.append(mat_pole)
    parts.append(pole)

    tip = create_cone(
        name="PoleTip",
        radius=0.032,
        height=0.10,
        segments=16,
        location=(0, 0, 2.10),
    )
    tip.data.materials.append(mat_tip)
    parts.append(tip)

    sleeve = create_box(
        name="FlagSleeve",
        width=0.010,
        depth=0.009,
        height=0.34,
        location=(0.024, 0, 1.70),
    )
    sleeve.data.materials.append(mat_flag)
    parts.append(sleeve)

    cloth_main = create_box(
        name="FlagClothMain",
        width=0.042,
        depth=0.010,
        height=0.24,
        location=(0.050, 0, 1.76),
    )
    cloth_main.data.materials.append(mat_flag)
    parts.append(cloth_main)

    cloth_tail = create_box(
        name="FlagClothTail",
        width=0.030,
        depth=0.010,
        height=0.10,
        location=(0.047, 0.006, 1.90),
    )
    cloth_tail.rotation_euler = (0.08, 0, 0.24)
    bpy.context.view_layer.objects.active = cloth_tail
    cloth_tail.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    cloth_tail.select_set(False)
    cloth_tail.data.materials.append(mat_flag)
    parts.append(cloth_tail)

    flag = join_objects(parts, name="CourseFlag")
    set_origin_to_base(flag)

    poly_count = len(flag.data.polygons)
    print(f"\nGenerated mesh with {poly_count} polygons")

    success = export_asset(ctx, validate=True, force=False)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print("\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
