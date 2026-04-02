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

ASSET_ID = "building.starter.hut"

COLORS = {
    "walls": (0.75, 0.68, 0.55),
    "roof": (0.3, 0.25, 0.22),
    "door": (0.35, 0.22, 0.12),
    "window": (0.6, 0.75, 0.85),
    "trim": (0.9, 0.88, 0.82),
}

PARAMS = {
    "body_width": 2.0,
    "body_depth": 2.0,
    "body_height": 2.2,
    "roof_overhang_front": 0.5,
    "roof_overhang_sides": 0.2,
    "roof_height": 0.12,
    "roof_slope": 0.5,
    "door_width": 0.8,
    "door_height": 1.8,
    "window_width": 0.5,
    "window_height": 0.4,
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
    door_mat = create_solid_material("Door", COLORS["door"])
    window_mat = create_solid_material("Window", COLORS["window"], roughness=0.3)
    trim_mat = create_solid_material("Trim", COLORS["trim"])

    body = create_box(
        name="Body",
        width=PARAMS["body_width"],
        depth=PARAMS["body_depth"],
        height=PARAMS["body_height"],
    )
    body.data.materials.append(wall_mat)

    roof_w = PARAMS["body_width"] + PARAMS["roof_overhang_sides"] * 2
    roof_d = PARAMS["body_depth"] + PARAMS["roof_overhang_front"] + PARAMS["roof_overhang_sides"]
    roof = create_sloped_roof(
        name="Roof",
        width=roof_w,
        depth=roof_d,
        height_front=PARAMS["roof_height"] + PARAMS["roof_slope"],
        height_back=PARAMS["roof_height"],
        location=(0, -(PARAMS["roof_overhang_front"] - PARAMS["roof_overhang_sides"]) / 2, PARAMS["body_height"]),
    )
    roof.data.materials.append(roof_mat)

    door = create_box(
        name="Door",
        width=PARAMS["door_width"],
        depth=0.04,
        height=PARAMS["door_height"],
        location=(0, -PARAMS["body_depth"] / 2 - 0.01, 0),
    )
    door.data.materials.append(door_mat)

    window_z = PARAMS["body_height"] * 0.55
    window = create_box(
        name="WindowL",
        width=PARAMS["window_width"],
        depth=0.04,
        height=PARAMS["window_height"],
        location=(-PARAMS["body_width"] / 2 - 0.01, 0, window_z),
    )
    window.data.materials.append(window_mat)

    window_r = create_box(
        name="WindowR",
        width=PARAMS["window_width"],
        depth=0.04,
        height=PARAMS["window_height"],
        location=(PARAMS["body_width"] / 2 + 0.01, 0, window_z),
    )
    window_r.data.materials.append(window_mat)

    sill_l = create_box(
        name="SillL",
        width=PARAMS["window_width"] + 0.06,
        depth=0.06,
        height=0.03,
        location=(-PARAMS["body_width"] / 2 - 0.01, 0, window_z - 0.01),
    )
    sill_l.data.materials.append(trim_mat)

    sill_r = create_box(
        name="SillR",
        width=PARAMS["window_width"] + 0.06,
        depth=0.06,
        height=0.03,
        location=(PARAMS["body_width"] / 2 + 0.01, 0, window_z - 0.01),
    )
    sill_r.data.materials.append(trim_mat)

    all_objects = [body, roof, door, window, window_r, sill_l, sill_r]
    result = join_objects(all_objects, name="StarterHut")
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
