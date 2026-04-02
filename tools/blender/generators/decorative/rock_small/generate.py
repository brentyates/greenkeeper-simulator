import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import set_origin_to_base, randomize_vertices, apply_transforms
from _common.materials import create_solid_material

ASSET_ID = "decor.rock.small"

PARAMS = {
    "radius": 0.18,
    "subdivisions": 2,
    "noise_amount": 0.04,
    "seed": 11,
}

COLORS = {
    "rock": (0.45, 0.42, 0.38),
}


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    bpy.ops.mesh.primitive_ico_sphere_add(
        radius=PARAMS["radius"],
        subdivisions=PARAMS["subdivisions"],
        location=(0, 0, PARAMS["radius"] * 0.75)
    )
    rock = bpy.context.active_object
    rock.name = "RockSmall"
    rock.scale = (1.1, 0.9, 0.7)
    apply_transforms(rock)

    randomize_vertices(rock, PARAMS["noise_amount"], seed=PARAMS["seed"])

    mat = create_solid_material("RockMat", COLORS["rock"])
    rock.data.materials.append(mat)

    set_origin_to_base(rock)

    print(f"\nGenerated rock with {len(rock.data.polygons)} polygons")

    success = export_asset(ctx, validate=True, force=True)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print(f"\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
