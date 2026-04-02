import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(SCRIPT_DIR)
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_box, create_cylinder, set_origin_to_base, join_objects, randomize_vertices
from _common.materials import create_solid_material


def generate_rock_medium():
    ctx = setup_asset_context("decor.rock.medium")

    rock_mat = create_solid_material("Rock", (0.5, 0.48, 0.44))

    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.35, location=(0, 0, 0.25))
    rock = bpy.context.active_object
    rock.name = "RockMedium"
    rock.scale = (1.0, 0.9, 0.7)
    bpy.context.view_layer.objects.active = rock
    rock.select_set(True)
    bpy.ops.object.transform_apply(scale=True)
    rock.select_set(False)
    randomize_vertices(rock, 0.06, seed=42)
    rock.data.materials.append(rock_mat)

    set_origin_to_base(rock)
    export_asset(ctx, force=True)


def generate_rock_cluster():
    ctx = setup_asset_context("decor.rock.cluster")

    rock_mat = create_solid_material("Rock", (0.5, 0.48, 0.44))
    rock_dark = create_solid_material("RockDark", (0.4, 0.38, 0.35))

    parts = []
    configs = [
        (0.25, (0, 0, 0.15), 1.0, 0.8, 0.6, rock_mat, 10),
        (0.18, (-0.35, 0.2, 0.12), 0.9, 1.0, 0.7, rock_dark, 20),
        (0.15, (0.3, -0.15, 0.1), 1.1, 0.8, 0.65, rock_mat, 30),
        (0.12, (0.1, 0.35, 0.08), 0.85, 1.0, 0.7, rock_dark, 40),
    ]

    for i, (radius, loc, sx, sy, sz, mat, seed) in enumerate(configs):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=radius, location=loc)
        r = bpy.context.active_object
        r.name = f"Rock{i}"
        r.scale = (sx, sy, sz)
        bpy.context.view_layer.objects.active = r
        r.select_set(True)
        bpy.ops.object.transform_apply(scale=True)
        r.select_set(False)
        randomize_vertices(r, radius * 0.2, seed=seed)
        r.data.materials.append(mat)
        parts.append(r)

    result = join_objects(parts, name="RockCluster")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_sundial():
    ctx = setup_asset_context("decor.sundial")

    stone_mat = create_solid_material("Stone", (0.7, 0.68, 0.65))
    dial_mat = create_solid_material("Dial", (0.5, 0.48, 0.45))
    gnomon_mat = create_solid_material("Gnomon", (0.35, 0.33, 0.3), roughness=0.3)

    pedestal = create_cylinder("Pedestal", 0.15, 0.7, segments=8, location=(0, 0, 0))
    pedestal.data.materials.append(stone_mat)

    base = create_cylinder("Base", 0.2, 0.08, segments=8, location=(0, 0, 0))
    base.data.materials.append(stone_mat)

    dial = create_cylinder("Dial", 0.22, 0.04, segments=10, location=(0, 0, 0.7))
    dial.data.materials.append(dial_mat)

    gnomon = create_box("Gnomon", 0.02, 0.15, 0.12, location=(0, 0, 0.74))
    gnomon.data.materials.append(gnomon_mat)

    result = join_objects([pedestal, base, dial, gnomon], name="Sundial")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


if __name__ == "__main__":
    generate_rock_medium()
    generate_rock_cluster()
    generate_sundial()
    print("\nAll missing decorative assets generated.")
