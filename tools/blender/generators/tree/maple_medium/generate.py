import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.nature import create_simple_trunk, create_spherical_foliage
from _common.geometry import set_origin_to_base, join_objects
from _common.materials import get_color

ASSET_ID = "tree.maple.medium"

ctx = setup_asset_context(ASSET_ID)

trunk = create_simple_trunk(
    height=1.2,
    base_radius=0.06,
    top_radius=0.03,
    material_color=get_color("tree_bark_light")
)

crown = create_spherical_foliage(
    radius=0.55,
    center_z=1.6,
    segments=2,
    material_color=(0.7, 0.25, 0.1)
)

result = join_objects([trunk, crown], "MapleMedium")
set_origin_to_base(result)

export_asset(ctx, force=True)
