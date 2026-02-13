"""
Procedural generator for vehicle.mower.fairway asset.

Run with:
    blender --background --python tools/blender/generators/vehicle/mower_fairway/generate.py
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

ASSET_ID = "vehicle.mower.fairway"

PARAMS = {
    "color_shell": (0.18, 0.52, 0.22),
    "color_base": (0.08, 0.08, 0.08),
    "color_wheel": (0.05, 0.05, 0.05),
    "color_trim": (0.80, 0.82, 0.78),
    "color_accent": (0.25, 0.72, 0.92),
}


def apply_rotation(obj: bpy.types.Object, rotation: tuple[float, float, float]) -> None:
    obj.rotation_euler = rotation
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.select_set(False)


def add_scaled_sphere(name: str, radius: float, location: tuple[float, float, float], scale: tuple[float, float, float]):
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=radius,
        segments=22,
        ring_count=12,
        location=location,
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def add_wheel(parts: list[bpy.types.Object], name: str, radius: float, width: float, location: tuple[float, float, float], material) -> None:
    wheel = create_cylinder(name=name, radius=radius, height=width, segments=18, location=location)
    apply_rotation(wheel, (0, math.pi / 2, 0))
    wheel.data.materials.append(material)
    parts.append(wheel)


def add_reel(parts: list[bpy.types.Object], name: str, width: float, location: tuple[float, float, float], material) -> None:
    reel = create_cylinder(name=name, radius=0.11, height=width, segments=14, location=location)
    apply_rotation(reel, (0, math.pi / 2, 0))
    reel.data.materials.append(material)
    parts.append(reel)


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    mat_shell = create_solid_material("FairwayShell", PARAMS["color_shell"], roughness=0.45)
    mat_base = create_solid_material("FairwayBase", PARAMS["color_base"], roughness=0.92)
    mat_wheel = create_solid_material("FairwayWheel", PARAMS["color_wheel"], roughness=0.95)
    mat_trim = create_solid_material("FairwayTrim", PARAMS["color_trim"], roughness=0.35)
    mat_accent = create_solid_material("FairwayAccent", PARAMS["color_accent"], roughness=0.35)

    parts: list[bpy.types.Object] = []

    base = create_box("BaseSkirt", width=1.46, depth=2.34, height=0.28, location=(0, 0, 0.0))
    base.data.materials.append(mat_base)
    parts.append(base)

    shell = add_scaled_sphere("Shell", radius=0.86, location=(0, 0.05, 0.40), scale=(0.92, 1.28, 0.42))
    shell.data.materials.append(mat_shell)
    parts.append(shell)

    cutter_center = create_box("CutterCenter", width=1.24, depth=0.66, height=0.12, location=(0, -1.16, 0.05))
    cutter_center.data.materials.append(mat_trim)
    parts.append(cutter_center)

    cutter_left = create_box("CutterLeft", width=0.28, depth=0.78, height=0.11, location=(-0.92, -0.86, 0.05))
    cutter_left.data.materials.append(mat_trim)
    parts.append(cutter_left)

    cutter_right = create_box("CutterRight", width=0.28, depth=0.78, height=0.11, location=(0.92, -0.86, 0.05))
    cutter_right.data.materials.append(mat_trim)
    parts.append(cutter_right)

    add_reel(parts, "ReelCenter", width=0.96, location=(-0.48, -1.14, 0.01), material=mat_accent)
    add_reel(parts, "ReelLeft", width=0.24, location=(-1.03, -0.84, 0.01), material=mat_accent)
    add_reel(parts, "ReelRight", width=0.24, location=(0.79, -0.84, 0.01), material=mat_accent)

    side_intake = create_box("SideIntake", width=1.02, depth=0.10, height=0.06, location=(0, 0.88, 0.36))
    side_intake.data.materials.append(mat_trim)
    parts.append(side_intake)

    add_wheel(parts, "WheelRearL", radius=0.26, width=0.12, location=(-0.69, 0.82, 0.04), material=mat_wheel)
    add_wheel(parts, "WheelRearR", radius=0.26, width=0.12, location=(0.69, 0.82, 0.04), material=mat_wheel)
    add_wheel(parts, "WheelFrontL", radius=0.18, width=0.10, location=(-0.62, -0.76, 0.03), material=mat_wheel)
    add_wheel(parts, "WheelFrontR", radius=0.18, width=0.10, location=(0.62, -0.76, 0.03), material=mat_wheel)

    mast = create_cylinder("SensorMast", radius=0.018, height=0.82, segments=10, location=(0, -0.04, 0.62))
    mast.data.materials.append(mat_trim)
    parts.append(mast)

    mast_head = create_cylinder("SensorHead", radius=0.08, height=0.06, segments=14, location=(0, -0.04, 1.44))
    mast_head.data.materials.append(mat_accent)
    parts.append(mast_head)

    robot = join_objects(parts, name="RobotMowerFairway")
    set_origin_to_base(robot)

    poly_count = len(robot.data.polygons)
    print(f"\nGenerated mesh with {poly_count} polygons")

    success = export_asset(ctx, validate=True, force=False)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print("\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
