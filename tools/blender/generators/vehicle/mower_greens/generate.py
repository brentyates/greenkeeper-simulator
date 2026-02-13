"""
Procedural generator for vehicle.mower.greens asset.

Run with:
    blender --background --python tools/blender/generators/vehicle/mower_greens/generate.py
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

ASSET_ID = "vehicle.mower.greens"

PARAMS = {
    "color_shell": (0.20, 0.56, 0.24),
    "color_base": (0.08, 0.08, 0.08),
    "color_wheel": (0.05, 0.05, 0.05),
    "color_trim": (0.82, 0.82, 0.80),
    "color_laser": (0.90, 0.16, 0.12),
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
    wheel = create_cylinder(name=name, radius=radius, height=width, segments=16, location=location)
    apply_rotation(wheel, (0, math.pi / 2, 0))
    wheel.data.materials.append(material)
    parts.append(wheel)


def add_roller(parts: list[bpy.types.Object], name: str, radius: float, width: float, location: tuple[float, float, float], material) -> None:
    roller = create_cylinder(name=name, radius=radius, height=width, segments=14, location=location)
    apply_rotation(roller, (0, math.pi / 2, 0))
    roller.data.materials.append(material)
    parts.append(roller)


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    mat_shell = create_solid_material("GreensShell", PARAMS["color_shell"], roughness=0.46)
    mat_base = create_solid_material("GreensBase", PARAMS["color_base"], roughness=0.90)
    mat_wheel = create_solid_material("GreensWheel", PARAMS["color_wheel"], roughness=0.95)
    mat_trim = create_solid_material("GreensTrim", PARAMS["color_trim"], roughness=0.35)
    mat_laser = create_solid_material("GreensLaser", PARAMS["color_laser"], roughness=0.25)

    parts: list[bpy.types.Object] = []

    base = create_box("BaseSkirt", width=0.88, depth=1.44, height=0.22, location=(0, 0, 0.0))
    base.data.materials.append(mat_base)
    parts.append(base)

    shell = add_scaled_sphere("Shell", radius=0.46, location=(0, -0.03, 0.27), scale=(0.90, 1.22, 0.42))
    shell.data.materials.append(mat_shell)
    parts.append(shell)

    front_cutter = create_box("FrontCutter", width=0.74, depth=0.26, height=0.10, location=(0, -0.64, 0.04))
    front_cutter.data.materials.append(mat_trim)
    parts.append(front_cutter)

    add_roller(parts, "FrontRoller", radius=0.12, width=0.70, location=(-0.35, -0.66, 0.01), material=mat_trim)
    add_roller(parts, "RearRoller", radius=0.10, width=0.62, location=(-0.31, 0.52, 0.01), material=mat_trim)

    add_wheel(parts, "WheelLeft", radius=0.16, width=0.08, location=(-0.38, -0.02, 0.04), material=mat_wheel)
    add_wheel(parts, "WheelRight", radius=0.16, width=0.08, location=(0.38, -0.02, 0.04), material=mat_wheel)

    laser_bar = create_box("LaserBar", width=0.62, depth=0.05, height=0.04, location=(0, -0.36, 0.40))
    laser_bar.data.materials.append(mat_laser)
    parts.append(laser_bar)

    fin = create_box("NavigationFin", width=0.10, depth=0.20, height=0.24, location=(0, 0.20, 0.46))
    fin.data.materials.append(mat_trim)
    parts.append(fin)

    mast = create_cylinder("SensorMast", radius=0.012, height=0.36, segments=10, location=(0, 0.20, 0.70))
    mast.data.materials.append(mat_trim)
    parts.append(mast)

    top_sensor = create_cylinder("TopSensor", radius=0.05, height=0.06, segments=12, location=(0, 0.20, 1.06))
    top_sensor.data.materials.append(mat_trim)
    parts.append(top_sensor)

    robot = join_objects(parts, name="RobotMowerGreens")
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
