import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(SCRIPT_DIR)
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_box, create_cylinder, create_mesh_object, set_origin_to_base, join_objects
from _common.materials import create_solid_material


def create_wedge_roof(name, width, depth, height, location=(0, 0, 0)):
    hw = width / 2
    hd = depth / 2
    verts = [
        (-hw, -hd, 0), (hw, -hd, 0), (hw, hd, 0), (-hw, hd, 0),
        (-hw, 0, height), (hw, 0, height),
    ]
    faces = [(0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5), (0, 3, 2, 1)]
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    return obj


def generate_clubhouse_small():
    ctx = setup_asset_context("building.clubhouse.small")

    wall_mat = create_solid_material("Walls", (0.88, 0.83, 0.72))
    roof_mat = create_solid_material("Roof", (0.3, 0.25, 0.22), roughness=0.8)
    door_mat = create_solid_material("Door", (0.35, 0.22, 0.12))
    porch_mat = create_solid_material("Porch", (0.78, 0.73, 0.62))

    body = create_box("Body", 10.0, 7.0, 4.0, location=(0, 0, 0))
    body.data.materials.append(wall_mat)

    roof = create_wedge_roof("Roof", 11.0, 8.0, 1.8, location=(0, 0, 4.0))
    roof.data.materials.append(roof_mat)

    door = create_box("Door", 1.5, 0.06, 2.5, location=(0, -3.52, 0))
    door.data.materials.append(door_mat)

    porch = create_box("Porch", 6.0, 2.0, 0.12, location=(0, -4.5, 0))
    porch.data.materials.append(porch_mat)

    porch_roof = create_box("PorchRoof", 6.5, 2.2, 0.1, location=(0, -4.5, 3.4))
    porch_roof.data.materials.append(roof_mat)

    parts = [body, roof, door, porch, porch_roof]
    for i, xoff in enumerate([-2.5, 2.5]):
        col = create_box(f"Col{i}", 0.15, 0.15, 3.4, location=(xoff, -5.4, 0))
        col.data.materials.append(wall_mat)
        parts.append(col)

    result = join_objects(parts, name="ClubhouseSmall")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_clubhouse_large():
    ctx = setup_asset_context("building.clubhouse.large")

    wall_mat = create_solid_material("Walls", (0.92, 0.87, 0.76))
    wing_mat = create_solid_material("WingWalls", (0.88, 0.83, 0.72))
    roof_mat = create_solid_material("Roof", (0.3, 0.25, 0.22), roughness=0.8)
    door_mat = create_solid_material("Door", (0.35, 0.22, 0.12))
    porch_mat = create_solid_material("Porch", (0.82, 0.77, 0.66))
    trim_mat = create_solid_material("Trim", (0.95, 0.95, 0.92))

    main = create_box("Main", 16.0, 14.0, 6.0, location=(0, 0, 0))
    main.data.materials.append(wall_mat)

    main_roof = create_wedge_roof("MainRoof", 17.0, 15.0, 2.8, location=(0, 0, 6.0))
    main_roof.data.materials.append(roof_mat)

    wing_l = create_box("WingL", 8.0, 10.0, 5.0, location=(-10.5, 0, 0))
    wing_l.data.materials.append(wing_mat)
    wing_l_roof = create_wedge_roof("WingLRoof", 9.0, 11.0, 2.2, location=(-10.5, 0, 5.0))
    wing_l_roof.data.materials.append(roof_mat)

    wing_r = create_box("WingR", 8.0, 10.0, 5.0, location=(10.5, 0, 0))
    wing_r.data.materials.append(wing_mat)
    wing_r_roof = create_wedge_roof("WingRRoof", 9.0, 11.0, 2.2, location=(10.5, 0, 5.0))
    wing_r_roof.data.materials.append(roof_mat)

    door = create_box("Door", 2.5, 0.06, 3.5, location=(0, -7.02, 0))
    door.data.materials.append(door_mat)

    porch = create_box("Porch", 10.0, 3.0, 0.15, location=(0, -8.5, 0))
    porch.data.materials.append(porch_mat)
    porch_roof = create_box("PorchRoof", 10.5, 3.3, 0.12, location=(0, -8.5, 5.5))
    porch_roof.data.materials.append(roof_mat)

    parts = [main, main_roof, wing_l, wing_l_roof, wing_r, wing_r_roof, door, porch, porch_roof]
    for i, xoff in enumerate([-4.0, -1.5, 1.5, 4.0]):
        col = create_box(f"Col{i}", 0.2, 0.2, 5.5, location=(xoff, -9.8, 0))
        col.data.materials.append(trim_mat)
        parts.append(col)

    result = join_objects(parts, name="ClubhouseLarge")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_pump_house():
    ctx = setup_asset_context("building.pump.house")

    concrete_mat = create_solid_material("Concrete", (0.65, 0.63, 0.6))
    roof_mat = create_solid_material("Roof", (0.45, 0.43, 0.4), roughness=0.8)
    pipe_mat = create_solid_material("Pipe", (0.5, 0.5, 0.55), roughness=0.5)

    body = create_box("Body", 2.2, 2.2, 1.8, location=(0, 0, 0))
    body.data.materials.append(concrete_mat)

    roof = create_box("Roof", 2.4, 2.4, 0.1, location=(0, 0, 1.8))
    roof.data.materials.append(roof_mat)

    pipe = create_cylinder("Pipe", 0.08, 0.8, segments=8, location=(1.2, 0, 0.5))
    pipe.rotation_euler = (0, 1.5708, 0)
    pipe.data.materials.append(pipe_mat)

    result = join_objects([body, roof, pipe], name="PumpHouse")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


if __name__ == "__main__":
    generate_clubhouse_small()
    generate_clubhouse_large()
    generate_pump_house()
    print("\nAll missing building assets generated.")
