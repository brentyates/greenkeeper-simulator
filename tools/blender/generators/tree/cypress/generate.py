import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.nature import create_simple_trunk
from _common.geometry import create_cone, set_origin_to_base, join_objects
from _common.materials import create_solid_material

ASSET_ID = "tree.cypress"

ctx = setup_asset_context(ASSET_ID)

trunk = create_simple_trunk(
    height=1.0,
    base_radius=0.06,
    top_radius=0.03,
    material_color=(0.3, 0.22, 0.14)
)

foliage = create_cone("Foliage", radius=0.22, height=2.5, segments=8, location=(0, 0, 0.6))
foliage_mat = create_solid_material("Foliage", (0.12, 0.35, 0.12))
foliage.data.materials.append(foliage_mat)

result = join_objects([trunk, foliage], "Cypress")
set_origin_to_base(result)

export_asset(ctx, force=True)
