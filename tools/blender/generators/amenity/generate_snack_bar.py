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


def generate():
    ctx = setup_asset_context("amenity.snack.bar")

    wall_mat = create_solid_material("Walls", (0.85, 0.8, 0.7))
    roof_mat = create_solid_material("Roof", (0.3, 0.25, 0.22), roughness=0.8)
    counter_mat = create_solid_material("Counter", (0.5, 0.38, 0.22))
    awning_mat = create_solid_material("Awning", (0.7, 0.15, 0.1))

    body = create_box("Body", 3.5, 2.5, 2.5, location=(0, 0, 0))
    body.data.materials.append(wall_mat)

    roof = create_box("Roof", 3.8, 2.8, 0.1, location=(0, 0, 2.5))
    roof.data.materials.append(roof_mat)

    counter = create_box("Counter", 3.0, 0.4, 1.0, location=(0, -1.45, 0))
    counter.data.materials.append(counter_mat)

    awning = create_box("Awning", 3.2, 1.2, 0.05, location=(0, -2.0, 2.3))
    awning.data.materials.append(awning_mat)

    parts = [body, roof, counter, awning]
    for i, xoff in enumerate([-1.5, 1.5]):
        pole = create_cylinder(f"Pole{i}", 0.03, 2.3, segments=6, location=(xoff, -2.5, 0))
        pole.data.materials.append(counter_mat)
        parts.append(pole)

    result = join_objects(parts, name="SnackBar")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


if __name__ == "__main__":
    generate()
