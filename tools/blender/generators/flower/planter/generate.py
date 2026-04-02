import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_box, set_origin_to_base, join_objects
from _common.materials import create_solid_material

ASSET_ID = "flower.planter"

ctx = setup_asset_context(ASSET_ID)

pot = create_box("Pot", width=0.45, depth=0.45, height=0.35, location=(0, 0, 0))
pot_mat = create_solid_material("PotMat", (0.55, 0.4, 0.3))
pot.data.materials.append(pot_mat)

soil = create_box("Soil", width=0.4, depth=0.4, height=0.05, location=(0, 0, 0.35))
soil_mat = create_solid_material("SoilMat", (0.3, 0.2, 0.1))
soil.data.materials.append(soil_mat)

greenery = create_box("Greenery", width=0.5, depth=0.5, height=0.3, location=(0, 0, 0.4))
green_mat = create_solid_material("GreenMat", (0.2, 0.5, 0.15))
greenery.data.materials.append(green_mat)

all_parts = [pot, soil, greenery]
result = join_objects(all_parts, "Planter")
set_origin_to_base(result)

export_asset(ctx, force=True)
