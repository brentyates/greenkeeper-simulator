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


def generate_fountain_aerator():
    ctx = setup_asset_context("water.fountain.aerator")

    float_mat = create_solid_material("Float", (0.3, 0.3, 0.32))
    nozzle_mat = create_solid_material("Nozzle", (0.5, 0.5, 0.52), roughness=0.4)

    base = create_cylinder("Base", 0.2, 0.08, segments=10, location=(0, 0, 0))
    base.data.materials.append(float_mat)

    ring = create_cylinder("Ring", 0.22, 0.03, segments=10, location=(0, 0, 0.04))
    ring.data.materials.append(float_mat)

    nozzle = create_cylinder("Nozzle", 0.04, 0.1, segments=8, location=(0, 0, 0.08))
    nozzle.data.materials.append(nozzle_mat)

    result = join_objects([base, ring, nozzle], name="FountainAerator")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_dock_small():
    ctx = setup_asset_context("water.dock.small")

    plank_mat = create_solid_material("Plank", (0.5, 0.38, 0.22))
    support_mat = create_solid_material("Support", (0.4, 0.28, 0.15))

    parts = []

    for i in range(10):
        y = -1.8 + i * 0.4
        plank = create_box(f"Plank{i}", 1.8, 0.18, 0.04, location=(0, y, 0.35))
        plank.data.materials.append(plank_mat)
        parts.append(plank)

    for x in [-0.7, 0, 0.7]:
        beam = create_box(f"Beam_{x}", 0.1, 3.6, 0.08, location=(x, 0, 0.28))
        beam.data.materials.append(support_mat)
        parts.append(beam)

    for i, (x, y) in enumerate([(-0.7, -1.5), (0.7, -1.5), (-0.7, 1.5), (0.7, 1.5)]):
        pile = create_cylinder(f"Pile{i}", 0.06, 0.45, segments=6, location=(x, y, 0))
        pile.data.materials.append(support_mat)
        parts.append(pile)

    result = join_objects(parts, name="DockSmall")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


def generate_bulkhead_section():
    ctx = setup_asset_context("water.bulkhead.section")

    wood_mat = create_solid_material("Wood", (0.4, 0.3, 0.2))
    cap_mat = create_solid_material("Cap", (0.45, 0.35, 0.25))

    wall = create_box("Wall", 1.8, 0.15, 0.6, location=(0, 0, 0))
    wall.data.materials.append(wood_mat)

    cap = create_box("Cap", 1.9, 0.2, 0.05, location=(0, 0, 0.6))
    cap.data.materials.append(cap_mat)

    parts = [wall, cap]
    for i, x in enumerate([-0.8, 0, 0.8]):
        stake = create_box(f"Stake{i}", 0.08, 0.2, 0.7, location=(x, 0.1, 0))
        stake.data.materials.append(wood_mat)
        parts.append(stake)

    result = join_objects(parts, name="BulkheadSection")
    set_origin_to_base(result)
    export_asset(ctx, force=True)


if __name__ == "__main__":
    generate_fountain_aerator()
    generate_dock_small()
    generate_bulkhead_section()
    print("\nAll water feature assets generated.")
