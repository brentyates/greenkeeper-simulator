import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(SCRIPT_DIR)
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_box, create_cylinder, set_origin_to_base, join_objects
from _common.materials import create_solid_material


def generate_ball():
    ctx = setup_asset_context("course.ball")

    ball_mat = create_solid_material("Ball", (0.95, 0.95, 0.93))

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.021, segments=8, ring_count=6, location=(0, 0, 0.021))
    ball = bpy.context.active_object
    ball.name = "Ball"
    ball.data.materials.append(ball_mat)

    set_origin_to_base(ball)
    export_asset(ctx, force=True)


def generate_yardage_marker(distance):
    asset_id = f"course.yardage.marker.{distance}"
    ctx = setup_asset_context(asset_id)

    post_mat = create_solid_material("Post", (0.92, 0.92, 0.9))
    marker_mat = create_solid_material("Marker", (0.15, 0.35, 0.15))

    post = create_cylinder("Post", 0.04, 0.35, segments=6, location=(0, 0, 0))
    post.data.materials.append(post_mat)

    plate = create_box("Plate", 0.12, 0.02, 0.08, location=(0, 0.04, 0.28))
    plate.data.materials.append(marker_mat)

    result = join_objects([post, plate], name=f"Yardage{distance}")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


if __name__ == "__main__":
    generate_ball()
    generate_yardage_marker(100)
    generate_yardage_marker(150)
    generate_yardage_marker(200)
    print("\nAll missing course assets generated.")
