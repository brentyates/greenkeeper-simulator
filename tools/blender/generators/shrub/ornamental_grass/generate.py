import bpy
import sys
import os
import math

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_cone, set_origin_to_base, join_objects
from _common.materials import create_solid_material

ASSET_ID = "shrub.ornamental.grass"

ctx = setup_asset_context(ASSET_ID)

grass_mat = create_solid_material("GrassMat", (0.5, 0.6, 0.25))

blades = []
for i in range(5):
    angle = i * math.pi * 2 / 5
    x = math.cos(angle) * 0.08
    y = math.sin(angle) * 0.08
    blade = create_cone(
        f"Blade_{i}",
        radius=0.1,
        height=0.8,
        segments=6,
        location=(x, y, 0)
    )
    blade.data.materials.append(grass_mat)
    blades.append(blade)

center = create_cone("Center", radius=0.12, height=0.9, segments=6, location=(0, 0, 0))
center.data.materials.append(grass_mat)
blades.append(center)

result = join_objects(blades, "OrnamentalGrass")
set_origin_to_base(result)

export_asset(ctx, force=True)
