import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_box, create_cylinder, set_origin_to_base, join_objects
from _common.materials import create_solid_material

ASSET_ID = "vehicle.cart.golf"

ctx = setup_asset_context(ASSET_ID)

white = create_solid_material("CartBody", (0.92, 0.92, 0.90, 1))
dark = create_solid_material("Dark", (0.18, 0.18, 0.18, 1))
seat_mat = create_solid_material("Seat", (0.12, 0.12, 0.14, 1))
post_mat = create_solid_material("Post", (0.25, 0.25, 0.28, 1))

body = create_box("Body", 1.2, 0.7, 0.45, location=(0, 0, 0.5))
body.data.materials.append(white)

hood = create_box("Hood", 0.5, 0.65, 0.2, location=(0.55, 0, 0.6))
hood.data.materials.append(white)

roof = create_box("Roof", 1.0, 0.78, 0.04, location=(0, 0, 1.25))
roof.data.materials.append(dark)

for side in [0.32, -0.32]:
    p = create_cylinder(f"Post_{side}", 0.025, 0.45)
    p.location = (0.35, side, 0.95)
    p.data.materials.append(post_mat)

seat = create_box("Seat", 0.45, 0.55, 0.08, location=(-0.1, 0, 0.72))
seat.data.materials.append(seat_mat)

back = create_box("Backrest", 0.06, 0.55, 0.3, location=(-0.35, 0, 0.85))
back.data.materials.append(seat_mat)

tire = create_solid_material("Tire", (0.08, 0.08, 0.08, 1))
for i, (x, y) in enumerate([(0.42, 0.38), (0.42, -0.38), (-0.42, 0.34), (-0.42, -0.34)]):
    w = create_cylinder(f"Wheel{i}", 0.13, 0.06)
    w.rotation_euler = (1.5708, 0, 0)
    w.location = (x, y, 0.13)
    w.data.materials.append(tire)

rear = create_box("RearBed", 0.5, 0.6, 0.25, location=(-0.55, 0, 0.45))
rear.data.materials.append(post_mat)

all_objs = [o for o in bpy.data.objects if o.type == "MESH"]
joined = join_objects(all_objs)
set_origin_to_base(joined)
export_asset(ctx, force=True)
