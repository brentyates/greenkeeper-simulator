import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_cylinder, set_origin_to_base, join_objects, apply_transforms
from _common.materials import create_solid_material

ASSET_ID = "decor.fountain"

PARAMS = {
    "basin_radius": 0.8,
    "basin_height": 0.25,
    "column_radius": 0.12,
    "column_height": 1.0,
    "top_radius": 0.15,
    "total_height": 1.5,
}

COLORS = {
    "stone": (0.6, 0.58, 0.55),
    "stone_dark": (0.45, 0.43, 0.40),
    "water": (0.3, 0.5, 0.7),
}


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    parts = []

    base = create_cylinder("Base", PARAMS["basin_radius"] * 1.05, 0.08, segments=12)
    mat = create_solid_material("BaseMat", COLORS["stone_dark"])
    base.data.materials.append(mat)
    parts.append(base)

    basin_z = 0.08
    bpy.ops.mesh.primitive_cone_add(
        radius1=PARAMS["basin_radius"],
        radius2=PARAMS["basin_radius"] * 0.85,
        depth=PARAMS["basin_height"],
        vertices=12,
        location=(0, 0, basin_z + PARAMS["basin_height"] / 2)
    )
    basin_outer = bpy.context.active_object
    basin_outer.name = "BasinOuter"
    mat = create_solid_material("BasinMat", COLORS["stone"])
    basin_outer.data.materials.append(mat)
    parts.append(basin_outer)

    water_z = basin_z + PARAMS["basin_height"] * 0.7
    bpy.ops.mesh.primitive_cylinder_add(
        radius=PARAMS["basin_radius"] * 0.75,
        depth=0.03,
        vertices=12,
        location=(0, 0, water_z)
    )
    water = bpy.context.active_object
    water.name = "Water"
    mat = create_solid_material("WaterMat", COLORS["water"], roughness=0.2)
    water.data.materials.append(mat)
    parts.append(water)

    column_z = basin_z + PARAMS["basin_height"] * 0.5
    column = create_cylinder("Column", PARAMS["column_radius"], PARAMS["column_height"], segments=8, location=(0, 0, column_z))
    mat = create_solid_material("ColumnMat", COLORS["stone_dark"])
    column.data.materials.append(mat)
    parts.append(column)

    mid_basin_z = column_z + PARAMS["column_height"] * 0.65
    bpy.ops.mesh.primitive_cone_add(
        radius1=PARAMS["basin_radius"] * 0.45,
        radius2=PARAMS["basin_radius"] * 0.35,
        depth=0.12,
        vertices=10,
        location=(0, 0, mid_basin_z)
    )
    mid_basin = bpy.context.active_object
    mid_basin.name = "MidBasin"
    mat = create_solid_material("MidBasinMat", COLORS["stone"])
    mid_basin.data.materials.append(mat)
    parts.append(mid_basin)

    top_z = column_z + PARAMS["column_height"]
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=PARAMS["top_radius"],
        segments=8,
        ring_count=6,
        location=(0, 0, top_z)
    )
    top_sphere = bpy.context.active_object
    top_sphere.name = "TopSphere"
    mat = create_solid_material("TopMat", COLORS["stone_dark"])
    top_sphere.data.materials.append(mat)
    parts.append(top_sphere)

    fountain = join_objects(parts, "Fountain")
    set_origin_to_base(fountain)

    print(f"\nGenerated fountain with {len(fountain.data.polygons)} polygons")

    success = export_asset(ctx, validate=True, force=True)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print(f"\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
