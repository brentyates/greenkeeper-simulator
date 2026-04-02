import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.nature import create_simple_deciduous
from _common.geometry import set_origin_to_base

ASSET_ID = "tree.maple.small"

ctx = setup_asset_context(ASSET_ID)

tree = create_simple_deciduous(
    total_height=1.5,
    trunk_ratio=0.35,
    crown_radius=0.35,
    seed=200
)
set_origin_to_base(tree)

export_asset(ctx, force=True)
