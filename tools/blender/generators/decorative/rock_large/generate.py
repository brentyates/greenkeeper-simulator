import bpy
import sys
import os
import random

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import set_origin_to_base, randomize_vertices, apply_transforms, join_objects
from _common.materials import create_solid_material

ASSET_ID = "decor.rock.large"

PARAMS = {
    "main_radius": 0.55,
    "subdivisions": 2,
    "noise_amount": 0.08,
    "seed": 33,
}

COLORS = {
    "rock_dark": (0.38, 0.35, 0.30),
    "rock_light": (0.50, 0.47, 0.42),
}


def create_rock(name, radius, location, squash, noise, seed, color):
    bpy.ops.mesh.primitive_ico_sphere_add(
        radius=radius,
        subdivisions=PARAMS["subdivisions"],
        location=location
    )
    rock = bpy.context.active_object
    rock.name = name
    rock.scale = squash
    apply_transforms(rock)
    randomize_vertices(rock, noise, seed=seed)
    mat = create_solid_material(f"{name}Mat", color)
    rock.data.materials.append(mat)
    return rock


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    random.seed(PARAMS["seed"])

    rocks = []

    rocks.append(create_rock(
        "MainRock", PARAMS["main_radius"],
        (0, 0, PARAMS["main_radius"] * 0.6),
        (1.1, 0.85, 0.7),
        PARAMS["noise_amount"], PARAMS["seed"],
        COLORS["rock_dark"]
    ))

    rocks.append(create_rock(
        "SideRock1", PARAMS["main_radius"] * 0.55,
        (0.35, 0.2, PARAMS["main_radius"] * 0.3),
        (0.9, 1.1, 0.65),
        PARAMS["noise_amount"] * 0.8, PARAMS["seed"] + 1,
        COLORS["rock_light"]
    ))

    rocks.append(create_rock(
        "SideRock2", PARAMS["main_radius"] * 0.4,
        (-0.25, -0.15, PARAMS["main_radius"] * 0.2),
        (1.0, 0.8, 0.6),
        PARAMS["noise_amount"] * 0.6, PARAMS["seed"] + 2,
        COLORS["rock_dark"]
    ))

    cluster = join_objects(rocks, "RockLarge")
    set_origin_to_base(cluster)

    print(f"\nGenerated rock cluster with {len(cluster.data.polygons)} polygons")

    success = export_asset(ctx, validate=True, force=True)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print(f"\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
