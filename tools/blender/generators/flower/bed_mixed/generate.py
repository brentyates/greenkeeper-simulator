import bpy
import sys
import os
import math

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_box, create_cylinder, set_origin_to_base, join_objects
from _common.materials import create_solid_material

ASSET_ID = "flower.bed.mixed"

ctx = setup_asset_context(ASSET_ID)

bed = create_box("Bed", width=1.0, depth=1.0, height=0.1, location=(0, 0, 0))
soil_mat = create_solid_material("Soil", (0.3, 0.2, 0.1))
bed.data.materials.append(soil_mat)

green_mat = create_solid_material("Greenery", (0.2, 0.45, 0.15))
top = create_box("GreenTop", width=0.9, depth=0.9, height=0.08, location=(0, 0, 0.1))
top.data.materials.append(green_mat)

colors = [
    (0.9, 0.2, 0.2),
    (0.9, 0.8, 0.1),
    (0.8, 0.2, 0.7),
    (0.3, 0.3, 0.9),
    (0.95, 0.5, 0.1),
    (0.95, 0.95, 0.9),
]

dots = []
import random
random.seed(42)
for i, color in enumerate(colors):
    mat = create_solid_material(f"Flower_{i}", color)
    x = random.uniform(-0.35, 0.35)
    y = random.uniform(-0.35, 0.35)
    dot = create_cylinder(f"Dot_{i}", radius=0.05, height=0.08, segments=6, location=(x, y, 0.18))
    dot.data.materials.append(mat)
    dots.append(dot)

all_parts = [bed, top] + dots
result = join_objects(all_parts, "BedMixed")
set_origin_to_base(result)

export_asset(ctx, force=True)
