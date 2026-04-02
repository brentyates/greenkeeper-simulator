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


def generate_bird_bath():
    ctx = setup_asset_context("wildlife.bird.bath")

    stone_mat = create_solid_material("Stone", (0.65, 0.63, 0.6))
    bowl_mat = create_solid_material("Bowl", (0.6, 0.58, 0.55))

    base = create_cylinder("Base", 0.15, 0.05, segments=8, location=(0, 0, 0))
    base.data.materials.append(stone_mat)

    pedestal = create_cylinder("Pedestal", 0.08, 0.6, segments=8, location=(0, 0, 0.05))
    pedestal.data.materials.append(stone_mat)

    bowl = create_cylinder("Bowl", 0.2, 0.12, segments=10, location=(0, 0, 0.65))
    bowl.data.materials.append(bowl_mat)

    rim = create_cylinder("Rim", 0.22, 0.03, segments=10, location=(0, 0, 0.74))
    rim.data.materials.append(stone_mat)

    result = join_objects([base, pedestal, bowl, rim], name="BirdBath")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_birdhouse():
    ctx = setup_asset_context("wildlife.birdhouse")

    wood_mat = create_solid_material("Wood", (0.5, 0.38, 0.22))
    roof_mat = create_solid_material("Roof", (0.3, 0.25, 0.18))
    hole_mat = create_solid_material("Hole", (0.1, 0.08, 0.05))

    body = create_box("Body", 0.12, 0.12, 0.18, location=(0, 0, 0))
    body.data.materials.append(wood_mat)

    hw = 0.07
    hd = 0.07
    h = 0.06
    verts = [
        (-hw, -hd, 0), (hw, -hd, 0), (hw, hd, 0), (-hw, hd, 0),
        (-hw, 0, h), (hw, 0, h),
    ]
    faces = [(0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5), (0, 3, 2, 1)]
    mesh = bpy.data.meshes.new("Roof_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    roof = bpy.data.objects.new("Roof", mesh)
    bpy.context.collection.objects.link(roof)
    roof.location = (0, 0, 0.18)
    roof.data.materials.append(roof_mat)

    hole = create_cylinder("Hole", 0.02, 0.01, segments=8, location=(0, -0.065, 0.1))
    hole.rotation_euler = (1.5708, 0, 0)
    hole.data.materials.append(hole_mat)

    perch = create_cylinder("Perch", 0.005, 0.03, segments=6, location=(0, -0.075, 0.06))
    perch.rotation_euler = (1.5708, 0, 0)
    perch.data.materials.append(wood_mat)

    result = join_objects([body, roof, hole, perch], name="Birdhouse")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_duck_decoy():
    ctx = setup_asset_context("wildlife.duck.decoy")

    body_mat = create_solid_material("Body", (0.4, 0.3, 0.15))
    head_mat = create_solid_material("Head", (0.15, 0.35, 0.15))
    beak_mat = create_solid_material("Beak", (0.7, 0.55, 0.1))

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.1, segments=8, ring_count=6, location=(0, 0, 0.1))
    body = bpy.context.active_object
    body.name = "Body"
    body.scale = (0.8, 1.3, 0.6)
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    bpy.ops.object.transform_apply(scale=True)
    body.select_set(False)
    body.data.materials.append(body_mat)

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, segments=6, ring_count=4, location=(0, -0.12, 0.18))
    head = bpy.context.active_object
    head.name = "Head"
    head.data.materials.append(head_mat)

    beak = create_box("Beak", 0.02, 0.04, 0.015, location=(0, -0.17, 0.17))
    beak.data.materials.append(beak_mat)

    result = join_objects([body, head, beak], name="DuckDecoy")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


if __name__ == "__main__":
    generate_bird_bath()
    generate_birdhouse()
    generate_duck_decoy()
    print("\nAll wildlife assets generated.")
