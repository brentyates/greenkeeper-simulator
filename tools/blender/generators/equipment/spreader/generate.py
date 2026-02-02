"""
Procedural generator for equipment.spreader asset.

Run with:
    blender --background --python tools/blender/generators/equipment/spreader/generate.py
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
from _common.geometry import create_box, create_cylinder, set_origin_to_base, join_objects
from _common.materials import create_solid_material

ASSET_ID = "equipment.spreader"

PARAMS = {
    "hopper_width": 0.16,
    "hopper_depth": 0.14,
    "hopper_height": 0.10,
    "hopper_z": 0.10,
    "wheel_radius": 0.05,
    "wheel_width": 0.02,
    "wheel_spacing": 0.16,
    "handle_radius": 0.010,
    "handle_height": 0.18,
    "handle_angle": 30,
    "grip_width": 0.12,
    "color_body": (0.15, 0.35, 0.15),
    "color_wheel": (0.1, 0.1, 0.1),
    "color_handle": (0.6, 0.6, 0.65),
}


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    mat_body = create_solid_material("SpreaderBody", PARAMS["color_body"])
    mat_wheel = create_solid_material("SpreaderWheel", PARAMS["color_wheel"])
    mat_handle = create_solid_material("SpreaderHandle", PARAMS["color_handle"], roughness=0.4)

    parts = []

    hopper = create_box(
        name="Hopper",
        width=PARAMS["hopper_width"],
        depth=PARAMS["hopper_depth"],
        height=PARAMS["hopper_height"],
        location=(0, 0, PARAMS["hopper_z"])
    )
    hopper.data.materials.append(mat_body)
    parts.append(hopper)

    wheel_x = PARAMS["wheel_spacing"] / 2
    wheel_y = 0

    for i, wx in enumerate([-wheel_x, wheel_x]):
        wheel = create_cylinder(
            name=f"Wheel_{i}",
            radius=PARAMS["wheel_radius"],
            height=PARAMS["wheel_width"],
            segments=12,
            location=(wx, wheel_y, PARAMS["wheel_radius"])
        )
        wheel.rotation_euler = (0, math.pi / 2, 0)
        bpy.context.view_layer.objects.active = wheel
        wheel.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        wheel.select_set(False)
        wheel.data.materials.append(mat_wheel)
        parts.append(wheel)

    handle_base_y = -PARAMS["hopper_depth"] / 2 - 0.02
    handle_base_z = PARAMS["hopper_z"] + PARAMS["hopper_height"] * 0.5

    handle_lower = create_cylinder(
        name="HandleLower",
        radius=PARAMS["handle_radius"],
        height=PARAMS["handle_height"],
        segments=8,
        location=(0, handle_base_y, handle_base_z)
    )
    angle_rad = math.radians(PARAMS["handle_angle"])
    handle_lower.rotation_euler = (angle_rad, 0, 0)
    bpy.context.view_layer.objects.active = handle_lower
    handle_lower.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    handle_lower.select_set(False)
    handle_lower.data.materials.append(mat_handle)
    parts.append(handle_lower)

    grip_y = handle_base_y - math.sin(angle_rad) * PARAMS["handle_height"]
    grip_z = handle_base_z + math.cos(angle_rad) * PARAMS["handle_height"]

    grip = create_cylinder(
        name="HandleGrip",
        radius=PARAMS["handle_radius"],
        height=PARAMS["grip_width"],
        segments=8,
        location=(-PARAMS["grip_width"] / 2, grip_y, grip_z)
    )
    grip.rotation_euler = (0, math.pi / 2, 0)
    bpy.context.view_layer.objects.active = grip
    grip.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    grip.select_set(False)
    grip.data.materials.append(mat_handle)
    parts.append(grip)

    spreader = join_objects(parts, name="Spreader")
    set_origin_to_base(spreader)

    poly_count = len(spreader.data.polygons)
    print(f"\nGenerated mesh with {poly_count} polygons")

    success = export_asset(ctx, validate=True, force=False)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print(f"\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
