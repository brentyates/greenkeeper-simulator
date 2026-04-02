"""
Generator for course.ball

Run with:
    /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/blender/generators/course/ball/generate.py
"""

import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_cylinder, set_origin_to_base, join_objects
from _common.materials import create_solid_material

ASSET_ID = "course.ball"

COLORS = {
    "ball": (0.96, 0.96, 0.94),
    "tee": (0.85, 0.72, 0.50),
}

PARAMS = {
    "ball_radius": 0.0213,
    "tee_radius": 0.004,
    "tee_height": 0.025,
}


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    ball_mat = create_solid_material("BallWhite", COLORS["ball"], roughness=0.3)
    tee_mat = create_solid_material("TeePeg", COLORS["tee"])

    parts: list[bpy.types.Object] = []

    tee = create_cylinder("Tee", radius=PARAMS["tee_radius"], height=PARAMS["tee_height"], segments=8)
    tee.data.materials.append(tee_mat)
    parts.append(tee)

    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=PARAMS["ball_radius"],
        segments=12,
        ring_count=8,
        location=(0, 0, PARAMS["tee_height"] + PARAMS["ball_radius"]),
    )
    ball = bpy.context.active_object
    ball.name = "Ball"
    ball.data.materials.append(ball_mat)
    parts.append(ball)

    golf_ball = join_objects(parts, name="GolfBall")
    set_origin_to_base(golf_ball)

    print(f"\nGenerated mesh with {len(golf_ball.data.polygons)} polygons")

    success = export_asset(ctx, validate=True, force=False)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print("\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
