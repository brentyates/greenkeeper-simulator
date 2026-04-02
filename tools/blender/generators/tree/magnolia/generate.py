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

ASSET_ID = "tree.magnolia"

ctx = setup_asset_context(ASSET_ID)

trunk = create_simple_trunk(
    height=1.0,
    base_radius=0.07,
    top_radius=0.04,
    material_color=(0.25, 0.18, 0.12)
)

crown = create_spherical_foliage(
    radius=0.5,
    center_z=1.4,
    segments=2,
    material_color=(0.1, 0.3, 0.1)
)

result = join_objects([trunk, crown], "Magnolia")
set_origin_to_base(result)

export_asset(ctx, force=True)
