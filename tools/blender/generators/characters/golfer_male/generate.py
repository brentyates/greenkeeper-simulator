import bpy
import sys
import os
import math

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import create_cylinder, set_origin_to_base, join_objects, apply_transforms
from _common.materials import create_solid_material

ASSET_ID = "character.golfer.male"

PARAMS = {
    "total_height": 1.78,
    "body_width": 0.35,
    "head_radius": 0.13,
    "arm_radius": 0.04,
    "leg_radius": 0.06,
    "seed": 42,
}

COLORS = {
    "skin": (0.9, 0.75, 0.65),
    "polo": (0.25, 0.45, 0.6),
    "pants": (0.6, 0.55, 0.4),
    "shoes": (0.35, 0.25, 0.15),
    "cap": (0.2, 0.2, 0.3),
    "club_shaft": (0.7, 0.7, 0.72),
    "club_grip": (0.1, 0.1, 0.1),
}


def create_body_part(name, radius, height, color, location, segments=8):
    obj = create_cylinder(name, radius, height, segments=segments, location=location)
    mat = create_solid_material(f"{name}Mat", color)
    obj.data.materials.append(mat)
    return obj


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")

    parts = []

    leg_height = 0.45
    torso_height = 0.50
    neck_height = 0.06
    head_r = PARAMS["head_radius"]

    shoe_height = 0.08
    parts.append(create_body_part("ShoeL", 0.07, shoe_height, COLORS["shoes"], (-0.08, 0, 0), segments=6))
    parts.append(create_body_part("ShoeR", 0.07, shoe_height, COLORS["shoes"], (0.08, 0, 0), segments=6))

    leg_z = shoe_height
    parts.append(create_body_part("LegL", PARAMS["leg_radius"], leg_height, COLORS["pants"], (-0.08, 0, leg_z)))
    parts.append(create_body_part("LegR", PARAMS["leg_radius"], leg_height, COLORS["pants"], (0.08, 0, leg_z)))

    torso_z = leg_z + leg_height
    bpy.ops.mesh.primitive_cone_add(
        radius1=PARAMS["body_width"] * 0.5,
        radius2=PARAMS["body_width"] * 0.45,
        depth=torso_height,
        vertices=8,
        location=(0, 0, torso_z + torso_height / 2)
    )
    torso = bpy.context.active_object
    torso.name = "Torso"
    mat = create_solid_material("TorsoMat", COLORS["polo"])
    torso.data.materials.append(mat)
    parts.append(torso)

    shoulder_z = torso_z + torso_height * 0.85
    arm_length = 0.40

    for side, x_off, angle in [("L", -0.20, 0.15), ("R", 0.20, -0.15)]:
        bpy.ops.mesh.primitive_cylinder_add(
            radius=PARAMS["arm_radius"],
            depth=arm_length,
            vertices=6,
            location=(x_off, 0, shoulder_z - arm_length * 0.35)
        )
        arm = bpy.context.active_object
        arm.name = f"Arm{side}"
        arm.rotation_euler = (0, angle, 0)
        apply_transforms(arm)
        mat = create_solid_material(f"Arm{side}Mat", COLORS["polo"])
        arm.data.materials.append(mat)
        parts.append(arm)

    hand_z = shoulder_z - arm_length * 0.55
    for side, x_off in [("L", -0.22), ("R", 0.22)]:
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=0.035,
            segments=6,
            ring_count=4,
            location=(x_off, 0, hand_z)
        )
        hand = bpy.context.active_object
        hand.name = f"Hand{side}"
        mat = create_solid_material(f"Hand{side}Mat", COLORS["skin"])
        hand.data.materials.append(mat)
        parts.append(hand)

    neck_z = torso_z + torso_height
    parts.append(create_body_part("Neck", 0.05, neck_height, COLORS["skin"], (0, 0, neck_z), segments=6))

    head_z = neck_z + neck_height + head_r
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=head_r,
        segments=8,
        ring_count=6,
        location=(0, 0, head_z)
    )
    head = bpy.context.active_object
    head.name = "Head"
    mat = create_solid_material("HeadMat", COLORS["skin"])
    head.data.materials.append(mat)
    parts.append(head)

    cap_z = head_z + head_r * 0.6
    bpy.ops.mesh.primitive_cylinder_add(
        radius=head_r * 1.1,
        depth=0.06,
        vertices=8,
        location=(0, 0, cap_z)
    )
    cap = bpy.context.active_object
    cap.name = "Cap"
    mat = create_solid_material("CapMat", COLORS["cap"])
    cap.data.materials.append(mat)
    parts.append(cap)

    bpy.ops.mesh.primitive_cylinder_add(
        radius=head_r * 1.3,
        depth=0.015,
        vertices=8,
        location=(0, -0.04, cap_z - 0.02)
    )
    brim = bpy.context.active_object
    brim.name = "Brim"
    mat = create_solid_material("BrimMat", COLORS["cap"])
    brim.data.materials.append(mat)
    parts.append(brim)

    club_length = 0.8
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.012,
        depth=club_length,
        vertices=6,
        location=(0.24, -0.05, hand_z - 0.1)
    )
    shaft = bpy.context.active_object
    shaft.name = "ClubShaft"
    shaft.rotation_euler = (0.3, 0, 0)
    apply_transforms(shaft)
    mat = create_solid_material("ShaftMat", COLORS["club_shaft"], roughness=0.3)
    shaft.data.materials.append(mat)
    parts.append(shaft)

    golfer = join_objects(parts, "GolferMale")
    set_origin_to_base(golfer)

    total_polys = len(golfer.data.polygons)
    print(f"\nGenerated golfer with {total_polys} polygons")

    success = export_asset(ctx, validate=True, force=True)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print(f"\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
