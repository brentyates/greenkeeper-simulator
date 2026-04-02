import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.nature import create_shrub
from _common.geometry import set_origin_to_base, join_objects
from _common.materials import create_solid_material

ASSET_ID = "shrub.flowering.rhododendron"

ctx = setup_asset_context(ASSET_ID)

bush = create_shrub(
    height=1.2,
    width=1.4,
    material_color=(0.15, 0.35, 0.12),
    seed=400
)

bpy.ops.mesh.primitive_ico_sphere_add(
    radius=0.72,
    subdivisions=1,
    location=(0, 0, 0.65)
)
flowers = bpy.context.active_object
flowers.name = "Flowers"
flowers.scale = (1.0, 1.0, 0.55)
bpy.context.view_layer.objects.active = flowers
bpy.ops.object.transform_apply(scale=True)
flower_mat = create_solid_material("FlowerMat", (0.55, 0.2, 0.6))
flowers.data.materials.append(flower_mat)

result = join_objects([bush, flowers], "Rhododendron")
set_origin_to_base(result)

export_asset(ctx, force=True)
