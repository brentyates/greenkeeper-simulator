import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(SCRIPT_DIR)
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_box, create_cylinder, set_origin_to_base, join_objects
from _common.materials import create_solid_material


def generate_aerator_manual():
    ctx = setup_asset_context("equipment.aerator.manual")

    handle_mat = create_solid_material("Handle", (0.4, 0.3, 0.2))
    metal_mat = create_solid_material("Metal", (0.5, 0.5, 0.52), roughness=0.4)

    handle = create_cylinder("Handle", 0.015, 0.9, segments=6, location=(0, 0, 0.2))
    handle.data.materials.append(handle_mat)

    crossbar = create_cylinder("Crossbar", 0.012, 0.25, segments=6, location=(0, 0, 1.0))
    crossbar.rotation_euler = (0, 1.5708, 0)
    crossbar.data.materials.append(handle_mat)

    base = create_box("Base", 0.2, 0.15, 0.05, location=(0, 0, 0))
    base.data.materials.append(metal_mat)

    for i, xoff in enumerate([-0.06, 0, 0.06]):
        tine = create_cylinder(f"Tine{i}", 0.008, 0.12, segments=6, location=(xoff, 0, -0.06))
        tine.data.materials.append(metal_mat)

    parts = [obj for obj in bpy.data.objects if obj.type == 'MESH']
    result = join_objects(parts, name="AeratorManual")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_trimmer():
    ctx = setup_asset_context("equipment.trimmer")

    shaft_mat = create_solid_material("Shaft", (0.6, 0.6, 0.62), roughness=0.4)
    motor_mat = create_solid_material("Motor", (0.8, 0.5, 0.1))
    guard_mat = create_solid_material("Guard", (0.2, 0.2, 0.22))

    shaft = create_cylinder("Shaft", 0.015, 1.1, segments=6, location=(0, 0, 0.1))
    shaft.data.materials.append(shaft_mat)

    motor = create_box("Motor", 0.08, 0.06, 0.12, location=(0, 0, 1.0))
    motor.data.materials.append(motor_mat)

    head = create_cylinder("Head", 0.1, 0.03, segments=8, location=(0, 0, 0))
    head.data.materials.append(guard_mat)

    guard = create_cylinder("Guard", 0.12, 0.02, segments=8, location=(0, 0, 0.03))
    guard.data.materials.append(guard_mat)

    result = join_objects([shaft, motor, head, guard], name="Trimmer")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_blower():
    ctx = setup_asset_context("equipment.blower")

    body_mat = create_solid_material("Body", (0.8, 0.5, 0.1))
    tube_mat = create_solid_material("Tube", (0.3, 0.3, 0.32))

    body = create_box("Body", 0.25, 0.15, 0.3, location=(0, 0, 0.15))
    body.data.materials.append(body_mat)

    tube = create_cylinder("Tube", 0.04, 0.35, segments=8, location=(0, -0.15, 0.1))
    tube.rotation_euler = (0.5, 0, 0)
    tube.data.materials.append(tube_mat)

    nozzle = create_cylinder("Nozzle", 0.03, 0.15, segments=6, location=(0, -0.4, 0.0))
    nozzle.rotation_euler = (0.3, 0, 0)
    nozzle.data.materials.append(tube_mat)

    result = join_objects([body, tube, nozzle], name="Blower")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_edger():
    ctx = setup_asset_context("equipment.edger")

    shaft_mat = create_solid_material("Shaft", (0.6, 0.6, 0.62), roughness=0.4)
    motor_mat = create_solid_material("Motor", (0.7, 0.15, 0.1))
    blade_mat = create_solid_material("Blade", (0.5, 0.5, 0.52), roughness=0.3)

    shaft = create_cylinder("Shaft", 0.015, 1.0, segments=6, location=(0, 0, 0.1))
    shaft.data.materials.append(shaft_mat)

    motor = create_box("Motor", 0.08, 0.06, 0.1, location=(0, 0, 0.95))
    motor.data.materials.append(motor_mat)

    blade = create_cylinder("Blade", 0.08, 0.005, segments=8, location=(0, 0, 0))
    blade.data.materials.append(blade_mat)

    guard = create_box("Guard", 0.18, 0.06, 0.1, location=(0, 0.04, 0.02))
    guard.data.materials.append(motor_mat)

    result = join_objects([shaft, motor, blade, guard], name="Edger")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


if __name__ == "__main__":
    generate_aerator_manual()
    generate_trimmer()
    generate_blower()
    generate_edger()
    print("\nAll missing equipment assets generated.")
