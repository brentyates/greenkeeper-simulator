"""
Procedural generator for vehicle.mower.riding asset.

Run with:
    blender --background --python tools/blender/generators/vehicle/mower_riding/generate.py
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

ASSET_ID = "vehicle.mower.riding"

PARAMS = {
    "color_shell": (0.22, 0.58, 0.24),
    "color_base": (0.09, 0.09, 0.09),
    "color_wheel": (0.05, 0.05, 0.05),
    "color_trim": (0.84, 0.84, 0.80),
    "color_accent": (0.98, 0.45, 0.10),
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
        segments=20,
        ring_count=10,
        location=location,
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def add_wheel(parts: list[bpy.types.Object], name: str, radius: float, width: float, location: tuple[float, float, float], material) -> None:
    wheel = create_cylinder(
        name=name,
        radius=radius,
        height=width,
        segments=18,
        location=location,
    )
    apply_rotation(wheel, (0, math.pi / 2, 0))
    wheel.data.materials.append(material)
    parts.append(wheel)


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    mat_shell = create_solid_material("RobotShell", PARAMS["color_shell"], roughness=0.45)
    mat_base = create_solid_material("RobotBase", PARAMS["color_base"], roughness=0.90)
    mat_wheel = create_solid_material("RobotWheel", PARAMS["color_wheel"], roughness=0.95)
    mat_trim = create_solid_material("RobotTrim", PARAMS["color_trim"], roughness=0.35)
    mat_accent = create_solid_material("RobotAccent", PARAMS["color_accent"], roughness=0.35)

    parts: list[bpy.types.Object] = []

    base = create_box("BaseSkirt", width=1.00, depth=1.58, height=0.24, location=(0, 0, 0.0))
    base.data.materials.append(mat_base)
    parts.append(base)

    shell = add_scaled_sphere(
        "Shell",
        radius=0.52,
        location=(0, -0.02, 0.32),
        scale=(0.90, 1.22, 0.44),
    )
    shell.data.materials.append(mat_shell)
    parts.append(shell)

    side_stripe = create_box("SideStripe", width=0.74, depth=0.08, height=0.05, location=(0, 0.48, 0.30))
    side_stripe.data.materials.append(mat_trim)
    parts.append(side_stripe)

    front_bumper = create_box("FrontBumper", width=0.86, depth=0.08, height=0.08, location=(0, -0.80, 0.02))
    front_bumper.data.materials.append(mat_base)
    parts.append(front_bumper)

    control_panel = create_box("ControlPanel", width=0.38, depth=0.24, height=0.06, location=(0, 0.02, 0.46))
    control_panel.data.materials.append(mat_base)
    parts.append(control_panel)

    emergency_stop = create_box("EmergencyStop", width=0.12, depth=0.10, height=0.04, location=(0, 0.02, 0.52))
    emergency_stop.data.materials.append(mat_accent)
    parts.append(emergency_stop)

    add_wheel(parts, "WheelRearL", radius=0.22, width=0.10, location=(-0.47, 0.46, 0.05), material=mat_wheel)
    add_wheel(parts, "WheelRearR", radius=0.22, width=0.10, location=(0.47, 0.46, 0.05), material=mat_wheel)
    add_wheel(parts, "WheelFrontL", radius=0.15, width=0.08, location=(-0.44, -0.44, 0.04), material=mat_wheel)
    add_wheel(parts, "WheelFrontR", radius=0.15, width=0.08, location=(0.44, -0.44, 0.04), material=mat_wheel)

    mast = create_cylinder("SensorMast", radius=0.016, height=0.68, segments=10, location=(0, -0.16, 0.56))
    mast.data.materials.append(mat_trim)
    parts.append(mast)

    lidar = create_cylinder("LidarTop", radius=0.06, height=0.05, segments=14, location=(0, -0.16, 1.24))
    lidar.data.materials.append(mat_trim)
    parts.append(lidar)

    robot = join_objects(parts, name="RobotMowerRiding")
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
