import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_cylinder, create_cone, set_origin_to_base, join_objects
from _common.materials import create_solid_material, get_color

ASSET_ID = "tree.palm"

ctx = setup_asset_context(ASSET_ID)

trunk_mat = create_solid_material("Trunk", (0.45, 0.35, 0.2))
frond_mat = create_solid_material("Fronds", (0.25, 0.55, 0.15))

trunk = create_cylinder("Trunk", radius=0.06, height=2.0, segments=8, location=(0, 0, 0))
trunk.data.materials.append(trunk_mat)

crown_center_z = 2.0
fronds = []
import math
for i in range(6):
    angle = i * math.pi * 2 / 6
    x = math.cos(angle) * 0.15
    y = math.sin(angle) * 0.15
    frond = create_cone(
        f"Frond_{i}",
        radius=0.35,
        height=0.6,
        segments=6,
        location=(x, y, crown_center_z)
    )
    frond.data.materials.append(frond_mat)
    fronds.append(frond)

top = create_cone("Top", radius=0.2, height=0.4, segments=6, location=(0, 0, crown_center_z + 0.2))
top.data.materials.append(frond_mat)

all_parts = [trunk, top] + fronds
result = join_objects(all_parts, "Palm")
set_origin_to_base(result)

export_asset(ctx, force=True)
