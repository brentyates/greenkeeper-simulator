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

ASSET_ID = "building.maintenance.shed"

COLORS = {
    "walls": (0.6, 0.6, 0.62),
    "roof": (0.45, 0.45, 0.48),
    "door": (0.35, 0.35, 0.38),
    "trim": (0.5, 0.5, 0.52),
}

PARAMS = {
    "body_width": 5.5,
    "body_depth": 7.0,
    "body_height": 3.2,
    "roof_overhang": 0.3,
    "roof_height": 0.15,
    "roof_slope": 0.4,
    "door_width": 3.0,
    "door_height": 2.8,
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

    wall_mat = create_solid_material("Walls", COLORS["walls"], roughness=0.7)
    roof_mat = create_solid_material("Roof", COLORS["roof"], roughness=0.6)
    door_mat = create_solid_material("Door", COLORS["door"])
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
    roof = create_sloped_roof(
        name="Roof",
        width=roof_w,
        depth=roof_d,
        height_front=PARAMS["roof_height"] + PARAMS["roof_slope"],
        height_back=PARAMS["roof_height"],
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

    door_frame_l = create_box(
        name="DoorFrameL",
        width=0.1,
        depth=0.08,
        height=PARAMS["door_height"],
        location=(-PARAMS["door_width"] / 2 - 0.05, -PARAMS["body_depth"] / 2 - 0.02, 0),
    )
    door_frame_l.data.materials.append(trim_mat)

    door_frame_r = create_box(
        name="DoorFrameR",
        width=0.1,
        depth=0.08,
        height=PARAMS["door_height"],
        location=(PARAMS["door_width"] / 2 + 0.05, -PARAMS["body_depth"] / 2 - 0.02, 0),
    )
    door_frame_r.data.materials.append(trim_mat)

    all_objects = [body, roof, door, door_frame_l, door_frame_r]
    result = join_objects(all_objects, name="MaintenanceShed")
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
