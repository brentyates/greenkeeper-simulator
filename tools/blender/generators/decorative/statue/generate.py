import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_cylinder, create_box, set_origin_to_base, join_objects, apply_transforms
from _common.materials import create_solid_material

ASSET_ID = "decor.statue"

PARAMS = {
    "pedestal_width": 0.45,
    "pedestal_height": 0.55,
    "figure_height": 1.4,
}

COLORS = {
    "pedestal": (0.5, 0.48, 0.45),
    "bronze": (0.25, 0.3, 0.2),
    "bronze_dark": (0.2, 0.25, 0.18),
}


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    parts = []

    pedestal_base = create_box("PedestalBase", PARAMS["pedestal_width"] * 1.15, PARAMS["pedestal_width"] * 1.15, 0.08)
    mat = create_solid_material("PedestalBaseMat", COLORS["pedestal"])
    pedestal_base.data.materials.append(mat)
    parts.append(pedestal_base)

    pedestal = create_box("Pedestal", PARAMS["pedestal_width"], PARAMS["pedestal_width"], PARAMS["pedestal_height"], location=(0, 0, 0.08))
    mat = create_solid_material("PedestalMat", COLORS["pedestal"])
    pedestal.data.materials.append(mat)
    parts.append(pedestal)

    pedestal_cap = create_box("PedestalCap", PARAMS["pedestal_width"] * 1.1, PARAMS["pedestal_width"] * 1.1, 0.06, location=(0, 0, 0.08 + PARAMS["pedestal_height"]))
    mat = create_solid_material("PedestalCapMat", COLORS["pedestal"])
    pedestal_cap.data.materials.append(mat)
    parts.append(pedestal_cap)

    figure_z = 0.08 + PARAMS["pedestal_height"] + 0.06
    figure_h = PARAMS["figure_height"]

    body_height = figure_h * 0.45
    body = create_cylinder("Body", 0.12, body_height, segments=8, location=(0, 0, figure_z))
    mat = create_solid_material("BodyMat", COLORS["bronze"])
    body.data.materials.append(mat)
    parts.append(body)

    bpy.ops.mesh.primitive_cone_add(
        radius1=0.14,
        radius2=0.10,
        depth=figure_h * 0.25,
        vertices=8,
        location=(0, 0, figure_z + body_height * 0.3)
    )
    torso = bpy.context.active_object
    torso.name = "Torso"
    mat = create_solid_material("TorsoMat", COLORS["bronze"])
    torso.data.materials.append(mat)
    parts.append(torso)

    shoulder_z = figure_z + body_height
    for side, x_off, angle in [("L", -0.16, 0.4), ("R", 0.16, -0.6)]:
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.035,
            depth=figure_h * 0.3,
            vertices=6,
            location=(x_off, 0, shoulder_z - 0.1)
        )
        arm = bpy.context.active_object
        arm.name = f"Arm{side}"
        arm.rotation_euler = (0, angle, 0)
        apply_transforms(arm)
        mat = create_solid_material(f"Arm{side}Mat", COLORS["bronze_dark"])
        arm.data.materials.append(mat)
        parts.append(arm)

    head_z = shoulder_z + figure_h * 0.08
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=figure_h * 0.07,
        segments=8,
        ring_count=6,
        location=(0, 0, head_z)
    )
    head = bpy.context.active_object
    head.name = "Head"
    mat = create_solid_material("HeadMat", COLORS["bronze"])
    head.data.materials.append(mat)
    parts.append(head)

    statue = join_objects(parts, "Statue")
    set_origin_to_base(statue)

    print(f"\nGenerated statue with {len(statue.data.polygons)} polygons")

    success = export_asset(ctx, validate=True, force=True)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print(f"\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
