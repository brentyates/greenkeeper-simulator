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

ASSET_ID = "character.golfer.female"

PARAMS = {
    "total_height": 1.68,
    "body_width": 0.32,
    "head_radius": 0.12,
    "arm_radius": 0.035,
    "leg_radius": 0.055,
    "seed": 77,
}

COLORS = {
    "skin": (0.9, 0.75, 0.65),
    "polo": (0.92, 0.85, 0.88),
    "pants": (0.2, 0.2, 0.3),
    "shoes": (0.9, 0.9, 0.9),
    "visor": (0.9, 0.85, 0.88),
    "hair": (0.35, 0.2, 0.12),
    "club_shaft": (0.7, 0.7, 0.72),
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

    leg_height = 0.42
    torso_height = 0.46
    neck_height = 0.05
    head_r = PARAMS["head_radius"]

    shoe_height = 0.06
    parts.append(create_body_part("ShoeL", 0.06, shoe_height, COLORS["shoes"], (-0.07, 0, 0), segments=6))
    parts.append(create_body_part("ShoeR", 0.06, shoe_height, COLORS["shoes"], (0.07, 0, 0), segments=6))

    leg_z = shoe_height
    parts.append(create_body_part("LegL", PARAMS["leg_radius"], leg_height, COLORS["pants"], (-0.07, 0, leg_z)))
    parts.append(create_body_part("LegR", PARAMS["leg_radius"], leg_height, COLORS["pants"], (0.07, 0, leg_z)))

    torso_z = leg_z + leg_height
    bpy.ops.mesh.primitive_cone_add(
        radius1=PARAMS["body_width"] * 0.48,
        radius2=PARAMS["body_width"] * 0.40,
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
    arm_length = 0.36

    for side, x_off, angle in [("L", -0.18, 0.15), ("R", 0.18, -0.15)]:
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
    for side, x_off in [("L", -0.20), ("R", 0.20)]:
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=0.03,
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
    parts.append(create_body_part("Neck", 0.045, neck_height, COLORS["skin"], (0, 0, neck_z), segments=6))

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

    hair_z = head_z + head_r * 0.15
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=head_r * 1.12,
        segments=8,
        ring_count=6,
        location=(0, 0.02, hair_z)
    )
    hair = bpy.context.active_object
    hair.name = "Hair"
    hair.scale = (1.0, 1.1, 0.9)
    apply_transforms(hair)
    mat = create_solid_material("HairMat", COLORS["hair"])
    hair.data.materials.append(mat)
    parts.append(hair)

    visor_z = head_z + head_r * 0.65
    bpy.ops.mesh.primitive_cylinder_add(
        radius=head_r * 1.25,
        depth=0.015,
        vertices=8,
        location=(0, -0.05, visor_z)
    )
    visor = bpy.context.active_object
    visor.name = "Visor"
    mat = create_solid_material("VisorMat", COLORS["visor"])
    visor.data.materials.append(mat)
    parts.append(visor)

    club_length = 0.75
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.01,
        depth=club_length,
        vertices=6,
        location=(0.22, -0.05, hand_z - 0.1)
    )
    shaft = bpy.context.active_object
    shaft.name = "ClubShaft"
    shaft.rotation_euler = (0.3, 0, 0)
    apply_transforms(shaft)
    mat = create_solid_material("ShaftMat", COLORS["club_shaft"], roughness=0.3)
    shaft.data.materials.append(mat)
    parts.append(shaft)

    golfer = join_objects(parts, "GolferFemale")
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
