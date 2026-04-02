import bpy
import sys
import os
import random

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_box, create_cylinder, set_origin_to_base, join_objects
from _common.materials import create_solid_material

ASSET_ID = "flower.bed.roses"

ctx = setup_asset_context(ASSET_ID)

bed = create_box("Bed", width=1.0, depth=1.0, height=0.12, location=(0, 0, 0))
soil_mat = create_solid_material("Soil", (0.3, 0.2, 0.1))
bed.data.materials.append(soil_mat)

green_mat = create_solid_material("Greenery", (0.15, 0.35, 0.1))
foliage = create_box("Foliage", width=0.85, depth=0.85, height=0.35, location=(0, 0, 0.12))
foliage.data.materials.append(green_mat)

rose_mat = create_solid_material("Rose", (0.75, 0.1, 0.12))
roses = []
random.seed(99)
for i in range(8):
    x = random.uniform(-0.3, 0.3)
    y = random.uniform(-0.3, 0.3)
    rose = create_cylinder(f"Rose_{i}", radius=0.06, height=0.1, segments=6, location=(x, y, 0.47))
    rose.data.materials.append(rose_mat)
    roses.append(rose)

all_parts = [bed, foliage] + roses
result = join_objects(all_parts, "BedRoses")
set_origin_to_base(result)

export_asset(ctx, force=True)
