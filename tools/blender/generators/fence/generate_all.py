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


def generate_wood_section():
    ctx = setup_asset_context("fence.wood.section")

    wood_mat = create_solid_material("Wood", (0.45, 0.32, 0.18))

    post_l = create_cylinder("PostL", 0.05, 1.1, segments=6, location=(-0.9, 0, 0))
    post_l.data.materials.append(wood_mat)
    post_r = create_cylinder("PostR", 0.05, 1.1, segments=6, location=(0.9, 0, 0))
    post_r.data.materials.append(wood_mat)

    rail_top = create_box("RailTop", 1.8, 0.08, 0.06, location=(0, 0, 0.9))
    rail_top.data.materials.append(wood_mat)
    rail_mid = create_box("RailMid", 1.8, 0.08, 0.06, location=(0, 0, 0.5))
    rail_mid.data.materials.append(wood_mat)

    result = join_objects([post_l, post_r, rail_top, rail_mid], name="FenceWoodSection")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_wood_post():
    ctx = setup_asset_context("fence.wood.post")

    wood_mat = create_solid_material("Wood", (0.45, 0.32, 0.18))

    post = create_cylinder("Post", 0.06, 1.2, segments=6, location=(0, 0, 0))
    post.data.materials.append(wood_mat)

    cap = create_box("Cap", 0.14, 0.14, 0.04, location=(0, 0, 1.2))
    cap.data.materials.append(wood_mat)

    result = join_objects([post, cap], name="FenceWoodPost")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_white_section():
    ctx = setup_asset_context("fence.white.section")

    white_mat = create_solid_material("White", (0.95, 0.95, 0.93))

    post_l = create_box("PostL", 0.08, 0.08, 1.1, location=(-0.9, 0, 0))
    post_l.data.materials.append(white_mat)
    post_r = create_box("PostR", 0.08, 0.08, 1.1, location=(0.9, 0, 0))
    post_r.data.materials.append(white_mat)

    parts = [post_l, post_r]
    for i in range(7):
        x = -0.75 + i * 0.25
        picket = create_box(f"Picket{i}", 0.06, 0.02, 0.9, location=(x, 0, 0))
        picket.data.materials.append(white_mat)
        parts.append(picket)

    rail_top = create_box("RailTop", 1.8, 0.04, 0.04, location=(0, 0, 0.85))
    rail_top.data.materials.append(white_mat)
    rail_bot = create_box("RailBot", 1.8, 0.04, 0.04, location=(0, 0, 0.3))
    rail_bot.data.materials.append(white_mat)
    parts.extend([rail_top, rail_bot])

    result = join_objects(parts, name="FenceWhiteSection")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_chain_section():
    ctx = setup_asset_context("fence.chain.section")

    metal_mat = create_solid_material("Metal", (0.6, 0.6, 0.62), roughness=0.4)

    post_l = create_cylinder("PostL", 0.04, 1.7, segments=8, location=(-0.9, 0, 0))
    post_l.data.materials.append(metal_mat)
    post_r = create_cylinder("PostR", 0.04, 1.7, segments=8, location=(0.9, 0, 0))
    post_r.data.materials.append(metal_mat)

    rail_top = create_cylinder("RailTop", 0.02, 1.8, segments=6, location=(0, 0, 1.65))
    rail_top.rotation_euler = (0, 1.5708, 0)
    rail_top.data.materials.append(metal_mat)

    mesh_mat = create_solid_material("ChainMesh", (0.55, 0.55, 0.57), roughness=0.5)
    mesh_panel = create_box("MeshPanel", 1.7, 0.02, 1.5, location=(0, 0, 0.05))
    mesh_panel.data.materials.append(mesh_mat)

    result = join_objects([post_l, post_r, rail_top, mesh_panel], name="FenceChainSection")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_rope_post():
    ctx = setup_asset_context("fence.rope.post")

    wood_mat = create_solid_material("DarkWood", (0.3, 0.2, 0.12))
    rope_mat = create_solid_material("Rope", (0.55, 0.45, 0.3))

    post = create_cylinder("Post", 0.04, 0.9, segments=6, location=(0, 0, 0))
    post.data.materials.append(wood_mat)

    cap = create_cylinder("Cap", 0.05, 0.04, segments=8, location=(0, 0, 0.9))
    cap.data.materials.append(wood_mat)

    hook = create_cylinder("Hook", 0.015, 0.06, segments=6, location=(0.04, 0, 0.75))
    hook.data.materials.append(rope_mat)

    result = join_objects([post, cap, hook], name="FenceRopePost")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


if __name__ == "__main__":
    generate_wood_section()
    generate_wood_post()
    generate_white_section()
    generate_chain_section()
    generate_rope_post()
    print("\nAll fence assets generated.")
