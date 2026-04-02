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


def generate_pipe_straight():
    ctx = setup_asset_context("irrigation.pipe.straight")

    pipe_mat = create_solid_material("Pipe", (0.5, 0.5, 0.55), roughness=0.6)

    pipe = create_cylinder("Pipe", 0.06, 0.15, segments=8, location=(0, 0, 0))
    pipe.rotation_euler = (0, 1.5708, 0)
    pipe.data.materials.append(pipe_mat)

    set_origin_to_base(pipe)
    export_asset(ctx, force=True)


def generate_pipe_corner():
    ctx = setup_asset_context("irrigation.pipe.corner")

    pipe_mat = create_solid_material("Pipe", (0.5, 0.5, 0.55), roughness=0.6)

    seg_a = create_cylinder("SegA", 0.06, 0.2, segments=8, location=(0.1, 0, 0.06))
    seg_a.rotation_euler = (0, 1.5708, 0)
    seg_a.data.materials.append(pipe_mat)

    seg_b = create_cylinder("SegB", 0.06, 0.2, segments=8, location=(0, 0.1, 0.06))
    seg_b.rotation_euler = (1.5708, 0, 0)
    seg_b.data.materials.append(pipe_mat)

    elbow = create_cylinder("Elbow", 0.07, 0.06, segments=8, location=(0, 0, 0.03))
    elbow.data.materials.append(pipe_mat)

    result = join_objects([seg_a, seg_b, elbow], name="PipeCorner")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_pipe_tee():
    ctx = setup_asset_context("irrigation.pipe.tee")

    pipe_mat = create_solid_material("Pipe", (0.5, 0.5, 0.55), roughness=0.6)

    main = create_cylinder("Main", 0.06, 0.5, segments=8, location=(0, 0, 0.06))
    main.rotation_euler = (0, 1.5708, 0)
    main.data.materials.append(pipe_mat)

    branch = create_cylinder("Branch", 0.06, 0.2, segments=8, location=(0, 0.1, 0.06))
    branch.rotation_euler = (1.5708, 0, 0)
    branch.data.materials.append(pipe_mat)

    joint = create_cylinder("Joint", 0.07, 0.06, segments=8, location=(0, 0, 0.03))
    joint.data.materials.append(pipe_mat)

    result = join_objects([main, branch, joint], name="PipeTee")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_pipe_cross():
    ctx = setup_asset_context("irrigation.pipe.cross")

    pipe_mat = create_solid_material("Pipe", (0.5, 0.5, 0.55), roughness=0.6)

    main = create_cylinder("Main", 0.06, 0.5, segments=8, location=(0, 0, 0.06))
    main.rotation_euler = (0, 1.5708, 0)
    main.data.materials.append(pipe_mat)

    cross = create_cylinder("Cross", 0.06, 0.5, segments=8, location=(0, 0, 0.06))
    cross.rotation_euler = (1.5708, 0, 0)
    cross.data.materials.append(pipe_mat)

    joint = create_cylinder("Joint", 0.07, 0.06, segments=8, location=(0, 0, 0.03))
    joint.data.materials.append(pipe_mat)

    result = join_objects([main, cross, joint], name="PipeCross")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_sprinkler_popup():
    ctx = setup_asset_context("irrigation.sprinkler.popup")

    body_mat = create_solid_material("Body", (0.3, 0.3, 0.32), roughness=0.5)
    top_mat = create_solid_material("Top", (0.2, 0.2, 0.22))

    body = create_cylinder("Body", 0.05, 0.08, segments=8, location=(0, 0, 0))
    body.data.materials.append(body_mat)

    top = create_cylinder("Top", 0.04, 0.03, segments=8, location=(0, 0, 0.08))
    top.data.materials.append(top_mat)

    result = join_objects([body, top], name="SprinklerPopup")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_sprinkler_rotor():
    ctx = setup_asset_context("irrigation.sprinkler.rotor")

    body_mat = create_solid_material("Body", (0.3, 0.3, 0.32), roughness=0.5)
    head_mat = create_solid_material("Head", (0.15, 0.15, 0.17))

    body = create_cylinder("Body", 0.06, 0.12, segments=8, location=(0, 0, 0))
    body.data.materials.append(body_mat)

    head = create_cylinder("Head", 0.04, 0.06, segments=8, location=(0, 0, 0.12))
    head.data.materials.append(head_mat)

    nozzle = create_cylinder("Nozzle", 0.015, 0.03, segments=6, location=(0.03, 0, 0.15))
    nozzle.data.materials.append(head_mat)

    result = join_objects([body, head, nozzle], name="SprinklerRotor")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_valve_box():
    ctx = setup_asset_context("irrigation.valve.box")

    box_mat = create_solid_material("Box", (0.2, 0.45, 0.2))
    lid_mat = create_solid_material("Lid", (0.25, 0.5, 0.25))

    box = create_box("Box", 0.35, 0.25, 0.1, location=(0, 0, 0))
    box.data.materials.append(box_mat)

    lid = create_box("Lid", 0.37, 0.27, 0.02, location=(0, 0, 0.1))
    lid.data.materials.append(lid_mat)

    result = join_objects([box, lid], name="ValveBox")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_water_source():
    ctx = setup_asset_context("irrigation.water.source")

    wall_mat = create_solid_material("Walls", (0.6, 0.58, 0.55))
    roof_mat = create_solid_material("Roof", (0.4, 0.35, 0.3), roughness=0.8)
    pipe_mat = create_solid_material("Pipe", (0.5, 0.5, 0.55), roughness=0.5)

    body = create_box("Body", 0.5, 0.5, 0.4, location=(0, 0, 0))
    body.data.materials.append(wall_mat)

    roof = create_box("Roof", 0.55, 0.55, 0.06, location=(0, 0, 0.4))
    roof.data.materials.append(roof_mat)

    pipe = create_cylinder("Pipe", 0.04, 0.2, segments=8, location=(0.3, 0, 0.15))
    pipe.rotation_euler = (0, 1.5708, 0)
    pipe.data.materials.append(pipe_mat)

    result = join_objects([body, roof, pipe], name="WaterSource")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_water_tank():
    ctx = setup_asset_context("irrigation.water.tank")

    tank_mat = create_solid_material("Tank", (0.3, 0.45, 0.65), roughness=0.5)
    band_mat = create_solid_material("Band", (0.5, 0.5, 0.52), roughness=0.3)
    top_mat = create_solid_material("Top", (0.35, 0.5, 0.7), roughness=0.5)

    body = create_cylinder("Body", 0.6, 1.7, segments=12, location=(0, 0, 0))
    body.data.materials.append(tank_mat)

    top = create_cylinder("Top", 0.62, 0.05, segments=12, location=(0, 0, 1.7))
    top.data.materials.append(top_mat)

    for i, z in enumerate([0.3, 0.85, 1.4]):
        band = create_cylinder(f"Band{i}", 0.62, 0.04, segments=12, location=(0, 0, z))
        band.data.materials.append(band_mat)

    parts = [obj for obj in bpy.data.objects if obj.type == 'MESH']
    result = join_objects(parts, name="WaterTank")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


if __name__ == "__main__":
    generate_pipe_straight()
    generate_pipe_corner()
    generate_pipe_tee()
    generate_pipe_cross()
    generate_sprinkler_popup()
    generate_sprinkler_rotor()
    generate_valve_box()
    generate_water_source()
    generate_water_tank()
    print("\nAll irrigation assets generated.")
