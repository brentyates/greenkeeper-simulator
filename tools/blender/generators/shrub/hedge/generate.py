import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_box, set_origin_to_base
from _common.materials import create_solid_material

ASSET_ID = "shrub.hedge"

ctx = setup_asset_context(ASSET_ID)

hedge = create_box("Hedge", width=1.0, depth=0.5, height=1.0, location=(0, 0, 0))
mat = create_solid_material("HedgeMat", (0.12, 0.3, 0.1))
hedge.data.materials.append(mat)

set_origin_to_base(hedge)

export_asset(ctx, force=True)
