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
from _common.materials import create_solid_material

ASSET_ID = "tree.dogwood"

ctx = setup_asset_context(ASSET_ID)

trunk = create_simple_trunk(
    height=0.6,
    base_radius=0.04,
    top_radius=0.02,
    material_color=(0.3, 0.22, 0.15)
)

canopy = create_spherical_foliage(
    radius=0.4,
    center_z=0.9,
    segments=2,
    material_color=(0.25, 0.5, 0.18)
)
canopy.scale = (1.2, 1.2, 0.6)
bpy.context.view_layer.objects.active = canopy
bpy.ops.object.transform_apply(scale=True)

bpy.ops.mesh.primitive_ico_sphere_add(
    radius=0.42,
    subdivisions=1,
    location=(0, 0, 1.0)
)
flowers = bpy.context.active_object
flowers.name = "Flowers"
flowers.scale = (1.2, 1.2, 0.5)
bpy.context.view_layer.objects.active = flowers
bpy.ops.object.transform_apply(scale=True)
flower_mat = create_solid_material("FlowerMat", (0.9, 0.8, 0.85))
flowers.data.materials.append(flower_mat)

result = join_objects([trunk, canopy, flowers], "Dogwood")
set_origin_to_base(result)

export_asset(ctx, force=True)
