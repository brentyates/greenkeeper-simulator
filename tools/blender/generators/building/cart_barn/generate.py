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

ASSET_ID = "building.cart.barn"

COLORS = {
    "walls": (0.55, 0.38, 0.22),
    "roof": (0.3, 0.25, 0.22),
    "floor": (0.45, 0.45, 0.47),
    "trim": (0.65, 0.48, 0.30),
}

PARAMS = {
    "width": 9.0,
    "depth": 5.0,
    "wall_height": 2.8,
    "roof_overhang": 0.4,
    "roof_height": 0.15,
    "roof_slope": 0.6,
    "wall_thickness": 0.15,
    "floor_height": 0.08,
}


def create_sloped_roof(name, width, depth, height_front, height_back, location=(0, 0, 0)):
    hw = width / 2
    hd = depth / 2

    verts = [
        (-hw, -hd, 0),
        (hw, -hd, 0),
        (hw, hd, 0),
        (-hw, hd, 0),
        (-hw, -hd, height_front),
        (hw, -hd, height_front),
        (hw, hd, height_back),
        (-hw, hd, height_back),
    ]

    faces = [
        (0, 1, 5, 4),
        (2, 3, 7, 6),
        (0, 4, 7, 3),
        (1, 2, 6, 5),
        (4, 5, 6, 7),
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
    floor_mat = create_solid_material("Floor", COLORS["floor"])
    trim_mat = create_solid_material("Trim", COLORS["trim"])

    hw = PARAMS["width"] / 2
    hd = PARAMS["depth"] / 2
    wt = PARAMS["wall_thickness"]
    wh = PARAMS["wall_height"]

    floor = create_box(
        name="Floor",
        width=PARAMS["width"],
        depth=PARAMS["depth"],
        height=PARAMS["floor_height"],
    )
    floor.data.materials.append(floor_mat)

    fh = PARAMS["floor_height"]

    back_wall = create_box(
        name="BackWall",
        width=PARAMS["width"],
        depth=wt,
        height=wh,
        location=(0, hd - wt / 2, fh),
    )
    back_wall.data.materials.append(wall_mat)

    left_wall = create_box(
        name="LeftWall",
        width=wt,
        depth=PARAMS["depth"],
        height=wh,
        location=(-hw + wt / 2, 0, fh),
    )
    left_wall.data.materials.append(wall_mat)

    right_wall = create_box(
        name="RightWall",
        width=wt,
        depth=PARAMS["depth"],
        height=wh,
        location=(hw - wt / 2, 0, fh),
    )
    right_wall.data.materials.append(wall_mat)

    roof_w = PARAMS["width"] + PARAMS["roof_overhang"] * 2
    roof_d = PARAMS["depth"] + PARAMS["roof_overhang"] * 2
    roof = create_sloped_roof(
        name="Roof",
        width=roof_w,
        depth=roof_d,
        height_front=PARAMS["roof_height"] + PARAMS["roof_slope"],
        height_back=PARAMS["roof_height"],
        location=(0, 0, fh + wh),
    )
    roof.data.materials.append(roof_mat)

    beam = create_box(
        name="FrontBeam",
        width=PARAMS["width"],
        depth=0.12,
        height=0.12,
        location=(0, -hd + 0.06, fh + wh - 0.06),
    )
    beam.data.materials.append(trim_mat)

    all_objects = [floor, back_wall, left_wall, right_wall, roof, beam]
    result = join_objects(all_objects, name="CartBarn")
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
