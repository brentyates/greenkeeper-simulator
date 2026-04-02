import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_box, set_origin_to_base, join_objects
from _common.materials import create_solid_material

ASSET_ID = "building.clubhouse.medium"

COLORS = {
    "walls": (0.92, 0.87, 0.76),
    "roof": (0.3, 0.25, 0.22),
    "door": (0.35, 0.22, 0.12),
    "porch": (0.82, 0.77, 0.66),
    "trim": (0.95, 0.95, 0.92),
    "wing_walls": (0.88, 0.83, 0.72),
}

PARAMS = {
    "main_width": 12.0,
    "main_depth": 10.0,
    "main_height": 4.5,
    "wing_width": 7.0,
    "wing_depth": 8.0,
    "wing_height": 3.8,
    "wing_offset_x": 8.0,
    "roof_overhang": 0.5,
    "roof_height": 2.2,
    "door_width": 1.8,
    "door_height": 2.8,
    "porch_depth": 2.5,
    "porch_height": 0.15,
    "porch_roof_height": 0.12,
}


def create_wedge_roof(name, width, depth, height, location=(0, 0, 0)):
    hw = width / 2
    hd = depth / 2

    verts = [
        (-hw, -hd, 0),
        (hw, -hd, 0),
        (hw, hd, 0),
        (-hw, hd, 0),
        (-hw, 0, height),
        (hw, 0, height),
    ]

    faces = [
        (0, 1, 5, 4),
        (2, 3, 4, 5),
        (0, 4, 3),
        (1, 2, 5),
        (0, 3, 2, 1),
    ]

    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location

    return obj


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    wall_mat = create_solid_material("Walls", COLORS["walls"])
    wing_mat = create_solid_material("WingWalls", COLORS["wing_walls"])
    roof_mat = create_solid_material("Roof", COLORS["roof"], roughness=0.8)
    door_mat = create_solid_material("Door", COLORS["door"])
    porch_mat = create_solid_material("Porch", COLORS["porch"])
    trim_mat = create_solid_material("Trim", COLORS["trim"])

    main_body = create_box(
        name="MainBody",
        width=PARAMS["main_width"],
        depth=PARAMS["main_depth"],
        height=PARAMS["main_height"],
        location=(-1.5, 0, 0),
    )
    main_body.data.materials.append(wall_mat)

    main_roof_w = PARAMS["main_width"] + PARAMS["roof_overhang"] * 2
    main_roof_d = PARAMS["main_depth"] + PARAMS["roof_overhang"] * 2
    main_roof = create_wedge_roof(
        name="MainRoof",
        width=main_roof_w,
        depth=main_roof_d,
        height=PARAMS["roof_height"],
        location=(-1.5, 0, PARAMS["main_height"]),
    )
    main_roof.data.materials.append(roof_mat)

    wing = create_box(
        name="Wing",
        width=PARAMS["wing_width"],
        depth=PARAMS["wing_depth"],
        height=PARAMS["wing_height"],
        location=(PARAMS["wing_offset_x"] - 1.5, 0.5, 0),
    )
    wing.data.materials.append(wing_mat)

    wing_roof_w = PARAMS["wing_width"] + PARAMS["roof_overhang"] * 2
    wing_roof_d = PARAMS["wing_depth"] + PARAMS["roof_overhang"] * 2
    wing_roof = create_wedge_roof(
        name="WingRoof",
        width=wing_roof_w,
        depth=wing_roof_d,
        height=PARAMS["roof_height"] * 0.8,
        location=(PARAMS["wing_offset_x"] - 1.5, 0.5, PARAMS["wing_height"]),
    )
    wing_roof.data.materials.append(roof_mat)

    door = create_box(
        name="Door",
        width=PARAMS["door_width"],
        depth=0.06,
        height=PARAMS["door_height"],
        location=(-1.5, -PARAMS["main_depth"] / 2 - 0.02, 0),
    )
    door.data.materials.append(door_mat)

    porch = create_box(
        name="Porch",
        width=PARAMS["main_width"] * 0.7,
        depth=PARAMS["porch_depth"],
        height=PARAMS["porch_height"],
        location=(-1.5, -PARAMS["main_depth"] / 2 - PARAMS["porch_depth"] / 2, 0),
    )
    porch.data.materials.append(porch_mat)

    porch_roof = create_box(
        name="PorchRoof",
        width=PARAMS["main_width"] * 0.75,
        depth=PARAMS["porch_depth"] + 0.3,
        height=PARAMS["porch_roof_height"],
        location=(-1.5, -PARAMS["main_depth"] / 2 - PARAMS["porch_depth"] / 2, PARAMS["main_height"] * 0.85),
    )
    porch_roof.data.materials.append(roof_mat)

    cols = []
    for i, xoff in enumerate([-0.35, 0.35]):
        col = create_box(
            name=f"PorchCol{i}",
            width=0.18,
            depth=0.18,
            height=PARAMS["main_height"] * 0.85,
            location=(
                -1.5 + xoff * PARAMS["main_width"],
                -PARAMS["main_depth"] / 2 - PARAMS["porch_depth"] + 0.12,
                0,
            ),
        )
        col.data.materials.append(trim_mat)
        cols.append(col)

    all_objects = [main_body, main_roof, wing, wing_roof, door, porch, porch_roof] + cols
    result = join_objects(all_objects, name="ClubhouseMedium")
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
