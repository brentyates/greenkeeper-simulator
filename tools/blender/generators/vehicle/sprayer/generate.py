"""
Procedural generator for vehicle.sprayer asset.

Run with:
    blender --background --python tools/blender/generators/vehicle/sprayer/generate.py
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

ASSET_ID = "vehicle.sprayer"

PARAMS = {
    "color_shell": (0.18, 0.52, 0.22),
    "color_base": (0.08, 0.08, 0.08),
    "color_wheel": (0.05, 0.05, 0.05),
    "color_trim": (0.82, 0.84, 0.86),
    "color_tank": (0.20, 0.58, 0.82),
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


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    mat_shell = create_solid_material("SprayerShell", PARAMS["color_shell"], roughness=0.46)
    mat_base = create_solid_material("SprayerBase", PARAMS["color_base"], roughness=0.92)
    mat_wheel = create_solid_material("SprayerWheel", PARAMS["color_wheel"], roughness=0.95)
    mat_trim = create_solid_material("SprayerTrim", PARAMS["color_trim"], roughness=0.35)
    mat_tank = create_solid_material("SprayerTank", PARAMS["color_tank"], roughness=0.38)

    parts: list[bpy.types.Object] = []

    base = create_box("BaseSkirt", width=1.34, depth=2.30, height=0.28, location=(0, 0, 0.0))
    base.data.materials.append(mat_base)
    parts.append(base)

    shell = add_scaled_sphere("Shell", radius=0.70, location=(0, 0.06, 0.38), scale=(0.94, 1.28, 0.44))
    shell.data.materials.append(mat_shell)
    parts.append(shell)

    tank = create_cylinder("Tank", radius=0.28, height=0.30, segments=18, location=(0, 0.50, 0.52))
    tank.data.materials.append(mat_tank)
    parts.append(tank)

    tank_cap = create_cylinder("TankCap", radius=0.09, height=0.06, segments=14, location=(0, 0.50, 0.82))
    tank_cap.data.materials.append(mat_trim)
    parts.append(tank_cap)

    boom_left = create_box("SprayBoomLeft", width=0.10, depth=1.88, height=0.05, location=(-0.63, -0.12, 0.44))
    boom_left.data.materials.append(mat_trim)
    parts.append(boom_left)

    boom_right = create_box("SprayBoomRight", width=0.10, depth=1.88, height=0.05, location=(0.63, -0.12, 0.44))
    boom_right.data.materials.append(mat_trim)
    parts.append(boom_right)

    for side_x in (-0.63, 0.63):
        for idx, nozzle_y in enumerate((-0.72, -0.36, 0.00, 0.36)):
            nozzle = create_cylinder(
                name=f"Nozzle_{idx}_{'L' if side_x < 0 else 'R'}",
                radius=0.014,
                height=0.04,
                segments=8,
                location=(side_x, nozzle_y, 0.39),
            )
            nozzle.data.materials.append(mat_trim)
            parts.append(nozzle)

    add_wheel(parts, "WheelRearL", radius=0.21, width=0.10, location=(-0.62, 0.78, 0.04), material=mat_wheel)
    add_wheel(parts, "WheelRearR", radius=0.21, width=0.10, location=(0.62, 0.78, 0.04), material=mat_wheel)
    add_wheel(parts, "WheelFrontL", radius=0.17, width=0.10, location=(-0.56, -0.82, 0.04), material=mat_wheel)
    add_wheel(parts, "WheelFrontR", radius=0.17, width=0.10, location=(0.56, -0.82, 0.04), material=mat_wheel)

    mast = create_cylinder("SensorMast", radius=0.016, height=0.82, segments=10, location=(0, -0.20, 0.66))
    mast.data.materials.append(mat_trim)
    parts.append(mast)

    sensor_head = create_box("SensorHead", width=0.14, depth=0.10, height=0.08, location=(0, -0.20, 1.48))
    sensor_head.data.materials.append(mat_trim)
    parts.append(sensor_head)

    robot = join_objects(parts, name="RobotSprayer")
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
