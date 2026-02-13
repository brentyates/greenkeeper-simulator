"""
Procedural generator for vehicle.tractor asset.

Run with:
    blender --background --python tools/blender/generators/vehicle/tractor/generate.py
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

ASSET_ID = "vehicle.tractor"

PARAMS = {
    "color_shell": (0.18, 0.50, 0.22),
    "color_base": (0.08, 0.08, 0.08),
    "color_wheel": (0.05, 0.05, 0.05),
    "color_trim": (0.82, 0.82, 0.80),
    "color_hopper": (0.88, 0.70, 0.18),
    "color_beacon": (0.95, 0.45, 0.08),
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
        segments=24,
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

    mat_shell = create_solid_material("FertilizerShell", PARAMS["color_shell"], roughness=0.46)
    mat_base = create_solid_material("FertilizerBase", PARAMS["color_base"], roughness=0.92)
    mat_wheel = create_solid_material("FertilizerWheel", PARAMS["color_wheel"], roughness=0.95)
    mat_trim = create_solid_material("FertilizerTrim", PARAMS["color_trim"], roughness=0.35)
    mat_hopper = create_solid_material("FertilizerHopper", PARAMS["color_hopper"], roughness=0.50)
    mat_beacon = create_solid_material("FertilizerBeacon", PARAMS["color_beacon"], roughness=0.30)

    parts: list[bpy.types.Object] = []

    base = create_box("BaseSkirt", width=1.56, depth=2.56, height=0.34, location=(0, 0, 0.0))
    base.data.materials.append(mat_base)
    parts.append(base)

    shell = add_scaled_sphere("Shell", radius=0.82, location=(0, 0.03, 0.46), scale=(0.94, 1.28, 0.42))
    shell.data.materials.append(mat_shell)
    parts.append(shell)

    hopper = create_box("Hopper", width=0.98, depth=0.76, height=0.44, location=(0, 0.84, 0.44))
    hopper.data.materials.append(mat_hopper)
    parts.append(hopper)

    spreader_disc = create_cylinder("SpreaderDisc", radius=0.25, height=0.06, segments=16, location=(0, 1.18, 0.05))
    spreader_disc.data.materials.append(mat_trim)
    parts.append(spreader_disc)

    rear_intake = create_box("RearIntake", width=0.86, depth=0.10, height=0.06, location=(0, 1.22, 0.28))
    rear_intake.data.materials.append(mat_trim)
    parts.append(rear_intake)

    add_wheel(parts, "WheelRearL", radius=0.24, width=0.12, location=(-0.72, 0.70, 0.04), material=mat_wheel)
    add_wheel(parts, "WheelRearR", radius=0.24, width=0.12, location=(0.72, 0.70, 0.04), material=mat_wheel)
    add_wheel(parts, "WheelFrontL", radius=0.18, width=0.10, location=(-0.62, -0.84, 0.04), material=mat_wheel)
    add_wheel(parts, "WheelFrontR", radius=0.18, width=0.10, location=(0.62, -0.84, 0.04), material=mat_wheel)

    mast = create_cylinder("TallSensorMast", radius=0.018, height=1.36, segments=10, location=(0, -0.16, 0.70))
    mast.data.materials.append(mat_trim)
    parts.append(mast)

    mast_head = create_box("MastHead", width=0.16, depth=0.12, height=0.09, location=(0, -0.16, 2.06))
    mast_head.data.materials.append(mat_trim)
    parts.append(mast_head)

    beacon = create_box("Beacon", width=0.08, depth=0.08, height=0.05, location=(0, -0.16, 2.15))
    beacon.data.materials.append(mat_beacon)
    parts.append(beacon)

    robot = join_objects(parts, name="RobotFertilizer")
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
