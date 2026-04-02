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

ASSET_ID = "tree.willow"

ctx = setup_asset_context(ASSET_ID)

trunk = create_simple_trunk(
    height=1.5,
    base_radius=0.1,
    top_radius=0.05,
    material_color=(0.35, 0.28, 0.18)
)

crown = create_spherical_foliage(
    radius=0.7,
    center_z=1.8,
    segments=2,
    material_color=(0.2, 0.45, 0.15)
)
crown.scale = (1.0, 1.0, 0.75)
bpy.context.view_layer.objects.active = crown
bpy.ops.object.transform_apply(scale=True)

result = join_objects([trunk, crown], "Willow")
set_origin_to_base(result)

export_asset(ctx, force=True)
