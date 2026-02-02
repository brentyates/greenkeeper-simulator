"""
Generator for building.refill.station

A small fuel/supply refill station for maintenance equipment.
Components: box base/cabinet, roof overhang, cylinder pump nozzle.
"""

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

ASSET_ID = "building.refill.station"

COLORS = {
    "wood_brown": (0.55, 0.27, 0.07),
    "roof_dark": (0.4, 0.2, 0.1),
    "pump_gray": (0.4, 0.4, 0.45),
}

PARAMS = {
    "base_width": 0.68,
    "base_depth": 0.48,
    "base_height": 0.55,
    "roof_overhang": 0.05,
    "roof_height": 0.08,
    "pump_radius": 0.03,
    "pump_height": 0.12,
}


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    wood_mat = create_solid_material("WoodBrown", COLORS["wood_brown"])
    roof_mat = create_solid_material("RoofDark", COLORS["roof_dark"])
    pump_mat = create_solid_material("PumpGray", COLORS["pump_gray"])

    base = create_box(
        name="Base",
        width=PARAMS["base_width"],
        depth=PARAMS["base_depth"],
        height=PARAMS["base_height"]
    )
    base.data.materials.append(wood_mat)

    roof_width = PARAMS["base_width"] + PARAMS["roof_overhang"] * 2
    roof_depth = PARAMS["base_depth"] + PARAMS["roof_overhang"] * 2
    roof = create_box(
        name="Roof",
        width=roof_width,
        depth=roof_depth,
        height=PARAMS["roof_height"],
        location=(0, 0, PARAMS["base_height"])
    )
    roof.data.materials.append(roof_mat)

    pump_x = PARAMS["base_width"] / 2 - 0.08
    pump_y = 0
    pump_z = PARAMS["base_height"] + PARAMS["roof_height"]
    pump = create_cylinder(
        name="Pump",
        radius=PARAMS["pump_radius"],
        height=PARAMS["pump_height"],
        segments=8,
        location=(pump_x, pump_y, pump_z)
    )
    pump.data.materials.append(pump_mat)

    all_objects = [base, roof, pump]
    result = join_objects(all_objects, name="RefillStation")
    set_origin_to_base(result)

    print(f"\nGenerated mesh with {len(result.data.polygons)} polygons")

    success = export_asset(ctx, validate=True, force=False)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print(f"\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
