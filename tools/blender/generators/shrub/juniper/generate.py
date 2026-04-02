import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.nature import create_shrub
from _common.geometry import set_origin_to_base

ASSET_ID = "shrub.juniper"

ctx = setup_asset_context(ASSET_ID)

bush = create_shrub(
    height=0.5,
    width=1.4,
    material_color=(0.15, 0.3, 0.25),
    seed=500
)
set_origin_to_base(bush)

export_asset(ctx, force=True)
