import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_box, create_cylinder, set_origin_to_base, join_objects, apply_transforms
from _common.materials import create_solid_material

ASSET_ID = "building.clubhouse.small"

COLORS = {
    "walls": (0.92, 0.87, 0.76),
    "roof": (0.3, 0.25, 0.22),
    "door": (0.35, 0.22, 0.12),
    "porch": (0.82, 0.77, 0.66),
    "trim": (0.95, 0.95, 0.92),
}

PARAMS = {
    "body_width": 10.0,
    "body_depth": 6.5,
    "body_height": 3.2,
    "roof_overhang": 0.4,
    "roof_height": 1.8,
    "door_width": 1.2,
    "door_height": 2.2,
    "porch_depth": 1.8,
    "porch_height": 0.15,
    "porch_roof_height": 0.1,
}


def create_wedge_roof(name, width, depth, height, location=(0, 0, 0)):
    import bmesh

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
    roof_mat = create_solid_material("Roof", COLORS["roof"], roughness=0.8)
    door_mat = create_solid_material("Door", COLORS["door"])
    porch_mat = create_solid_material("Porch", COLORS["porch"])
    trim_mat = create_solid_material("Trim", COLORS["trim"])

    body = create_box(
        name="Body",
        width=PARAMS["body_width"],
        depth=PARAMS["body_depth"],
        height=PARAMS["body_height"],
    )
    body.data.materials.append(wall_mat)

    roof_w = PARAMS["body_width"] + PARAMS["roof_overhang"] * 2
    roof_d = PARAMS["body_depth"] + PARAMS["roof_overhang"] * 2
    roof = create_wedge_roof(
        name="Roof",
        width=roof_w,
        depth=roof_d,
        height=PARAMS["roof_height"],
        location=(0, 0, PARAMS["body_height"]),
    )
    roof.data.materials.append(roof_mat)

    door = create_box(
        name="Door",
        width=PARAMS["door_width"],
        depth=0.05,
        height=PARAMS["door_height"],
        location=(0, -PARAMS["body_depth"] / 2 - 0.02, 0),
    )
    door.data.materials.append(door_mat)

    porch = create_box(
        name="Porch",
        width=PARAMS["body_width"] * 0.6,
        depth=PARAMS["porch_depth"],
        height=PARAMS["porch_height"],
        location=(0, -PARAMS["body_depth"] / 2 - PARAMS["porch_depth"] / 2, 0),
    )
    porch.data.materials.append(porch_mat)

    porch_roof = create_box(
        name="PorchRoof",
        width=PARAMS["body_width"] * 0.65,
        depth=PARAMS["porch_depth"] + 0.2,
        height=PARAMS["porch_roof_height"],
        location=(0, -PARAMS["body_depth"] / 2 - PARAMS["porch_depth"] / 2, PARAMS["body_height"] * 0.85),
    )
    porch_roof.data.materials.append(roof_mat)

    porch_col_l = create_box(
        name="PorchColL",
        width=0.15,
        depth=0.15,
        height=PARAMS["body_height"] * 0.85,
        location=(-PARAMS["body_width"] * 0.28, -PARAMS["body_depth"] / 2 - PARAMS["porch_depth"] + 0.1, 0),
    )
    porch_col_l.data.materials.append(trim_mat)

    porch_col_r = create_box(
        name="PorchColR",
        width=0.15,
        depth=0.15,
        height=PARAMS["body_height"] * 0.85,
        location=(PARAMS["body_width"] * 0.28, -PARAMS["body_depth"] / 2 - PARAMS["porch_depth"] + 0.1, 0),
    )
    porch_col_r.data.materials.append(trim_mat)

    all_objects = [body, roof, door, porch, porch_roof, porch_col_l, porch_col_r]
    result = join_objects(all_objects, name="ClubhouseSmall")
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
