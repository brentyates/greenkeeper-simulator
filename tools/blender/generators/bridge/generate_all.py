import bpy
import sys
import os
import math

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(SCRIPT_DIR)
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_box, create_cylinder, create_mesh_object, set_origin_to_base, join_objects
from _common.materials import create_solid_material


def generate_wood_small():
    ctx = setup_asset_context("bridge.wood.small")

    plank_mat = create_solid_material("Plank", (0.5, 0.38, 0.22))
    support_mat = create_solid_material("Support", (0.4, 0.28, 0.15))

    parts = []

    beam_l = create_box("BeamL", 0.15, 3.6, 0.12, location=(-0.8, 0, 0))
    beam_l.data.materials.append(support_mat)
    beam_r = create_box("BeamR", 0.15, 3.6, 0.12, location=(0.8, 0, 0))
    beam_r.data.materials.append(support_mat)
    parts.extend([beam_l, beam_r])

    for i in range(9):
        y = -1.6 + i * 0.4
        plank = create_box(f"Plank{i}", 1.8, 0.18, 0.04, location=(0, y, 0.12))
        plank.data.materials.append(plank_mat)
        parts.append(plank)

    result = join_objects(parts, name="BridgeWoodSmall")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_wood_medium():
    ctx = setup_asset_context("bridge.wood.medium")

    plank_mat = create_solid_material("Plank", (0.5, 0.38, 0.22))
    support_mat = create_solid_material("Support", (0.4, 0.28, 0.15))
    rail_mat = create_solid_material("Rail", (0.45, 0.32, 0.18))

    parts = []

    beam_l = create_box("BeamL", 0.18, 5.6, 0.15, location=(-1.2, 0, 0))
    beam_l.data.materials.append(support_mat)
    beam_r = create_box("BeamR", 0.18, 5.6, 0.15, location=(1.2, 0, 0))
    beam_r.data.materials.append(support_mat)
    parts.extend([beam_l, beam_r])

    for i in range(14):
        y = -2.6 + i * 0.4
        plank = create_box(f"Plank{i}", 2.6, 0.18, 0.04, location=(0, y, 0.15))
        plank.data.materials.append(plank_mat)
        parts.append(plank)

    for side_x in [-1.3, 1.3]:
        for j in range(4):
            y = -2.2 + j * 1.5
            rpost = create_box(f"RPost_{side_x}_{j}", 0.06, 0.06, 1.0, location=(side_x, y, 0.15))
            rpost.data.materials.append(rail_mat)
            parts.append(rpost)

        rail = create_box(f"Rail_{side_x}", 0.04, 5.2, 0.04, location=(side_x, 0, 1.1))
        rail.data.materials.append(rail_mat)
        parts.append(rail)

    result = join_objects(parts, name="BridgeWoodMedium")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_stone():
    ctx = setup_asset_context("bridge.stone")

    stone_mat = create_solid_material("Stone", (0.6, 0.58, 0.55))
    stone_dark = create_solid_material("StoneDark", (0.45, 0.43, 0.4))

    parts = []

    arch_segments = 8
    arch_radius = 2.5
    arch_width = 3.6

    for i in range(arch_segments):
        angle_start = math.pi * i / arch_segments
        angle_end = math.pi * (i + 1) / arch_segments
        angle_mid = (angle_start + angle_end) / 2

        x = 0
        y = -arch_radius * math.cos(angle_mid)
        z = arch_radius * math.sin(angle_mid) - 0.8

        seg_len = arch_radius * math.pi / arch_segments
        seg = create_box(f"ArchSeg{i}", arch_width, seg_len, 0.25, location=(x, y, max(z, 0)))
        seg.rotation_euler = (angle_mid - math.pi / 2, 0, 0)
        seg.data.materials.append(stone_mat)
        parts.append(seg)

    deck = create_box("Deck", 3.8, 7.0, 0.2, location=(0, 0, 1.5))
    deck.data.materials.append(stone_dark)
    parts.append(deck)

    for side_x in [-1.7, 1.7]:
        wall = create_box(f"Wall_{side_x}", 0.2, 7.0, 0.5, location=(side_x, 0, 1.7))
        wall.data.materials.append(stone_mat)
        parts.append(wall)

    result = join_objects(parts, name="BridgeStone")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_sign_directional():
    ctx = setup_asset_context("path.sign.directional")

    wood_mat = create_solid_material("Wood", (0.4, 0.28, 0.15))
    sign_mat = create_solid_material("Sign", (0.25, 0.5, 0.2))

    post = create_cylinder("Post", 0.04, 1.2, segments=6, location=(0, 0, 0))
    post.data.materials.append(wood_mat)

    arrow = create_box("Arrow", 0.5, 0.15, 0.04, location=(0.15, 0, 1.0))
    arrow.data.materials.append(sign_mat)

    result = join_objects([post, arrow], name="SignDirectional")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_sign_rules():
    ctx = setup_asset_context("path.sign.rules")

    wood_mat = create_solid_material("Wood", (0.4, 0.28, 0.15))
    board_mat = create_solid_material("Board", (0.9, 0.88, 0.8))

    post_l = create_cylinder("PostL", 0.04, 1.4, segments=6, location=(-0.2, 0, 0))
    post_l.data.materials.append(wood_mat)
    post_r = create_cylinder("PostR", 0.04, 1.4, segments=6, location=(0.2, 0, 0))
    post_r.data.materials.append(wood_mat)

    board = create_box("Board", 0.5, 0.04, 0.4, location=(0, 0.03, 1.0))
    board.data.materials.append(board_mat)

    result = join_objects([post_l, post_r, board], name="SignRules")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


if __name__ == "__main__":
    generate_wood_small()
    generate_wood_medium()
    generate_stone()
    generate_sign_directional()
    generate_sign_rules()
    print("\nAll bridge/path assets generated.")
