"""
Procedural generator for character.greenkeeper asset.

Run with:
    blender --background --python tools/blender/generators/character/greenkeeper/generate.py
"""

import bpy
import sys
import os
import math

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import set_origin_to_base
from _common.materials import create_solid_material

ASSET_ID = "character.greenkeeper"

COLORS = {
    "polo_green": (0.15, 0.4, 0.15),
    "khaki": (0.6, 0.55, 0.4),
    "skin": (0.9, 0.75, 0.65),
    "shoes": (0.35, 0.25, 0.15),
}

PARAMS = {
    "total_height": 1.8,
    "body_width": 0.35,
    "body_depth": 0.2,
}


def create_sphere(name, radius, location, segments=12):
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=radius,
        segments=segments,
        ring_count=segments // 2,
        location=location
    )
    obj = bpy.context.active_object
    obj.name = name
    return obj


def create_cylinder(name, radius, height, location, segments=8):
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius,
        depth=height,
        vertices=segments,
        location=location
    )
    obj = bpy.context.active_object
    obj.name = name
    return obj


def generate():
    print(f"\n{'='*60}")
    print(f"Generating: {ASSET_ID}")
    print(f"{'='*60}")

    ctx = setup_asset_context(ASSET_ID)

    if ctx["spec"]:
        print(f"\nSpec: height {ctx['spec']['height_range'][0]}-{ctx['spec']['height_range'][1]}m")
        print(f"      footprint {ctx['spec']['footprint'][0]}x{ctx['spec']['footprint'][1]}m")

    mat_polo = create_solid_material("PoloGreen", COLORS["polo_green"])
    mat_khaki = create_solid_material("Khaki", COLORS["khaki"])
    mat_skin = create_solid_material("Skin", COLORS["skin"])
    mat_shoes = create_solid_material("Shoes", COLORS["shoes"])

    # Scale factor: ~0.36 to go from 1.8m to 0.65m
    parts = []

    leg_height = 0.29
    leg_radius = 0.03
    leg_y = 0.0
    leg_x_offset = 0.035

    left_leg = create_cylinder("LeftLeg", leg_radius, leg_height, (-leg_x_offset, leg_y, leg_height / 2))
    left_leg.data.materials.append(mat_khaki)
    parts.append(left_leg)

    right_leg = create_cylinder("RightLeg", leg_radius, leg_height, (leg_x_offset, leg_y, leg_height / 2))
    right_leg.data.materials.append(mat_khaki)
    parts.append(right_leg)

    torso_height = 0.24
    torso_radius = 0.055
    torso_z = leg_height + torso_height / 2

    torso = create_cylinder("Torso", torso_radius, torso_height, (0, 0, torso_z))
    torso.data.materials.append(mat_polo)
    parts.append(torso)

    arm_height = 0.20
    arm_radius = 0.018
    arm_z = leg_height + torso_height * 0.7
    arm_x_offset = torso_radius + arm_radius + 0.008

    left_arm = create_cylinder("LeftArm", arm_radius, arm_height, (-arm_x_offset, 0, arm_z - arm_height * 0.3))
    left_arm.data.materials.append(mat_polo)
    parts.append(left_arm)

    right_arm = create_cylinder("RightArm", arm_radius, arm_height, (arm_x_offset, 0, arm_z - arm_height * 0.3))
    right_arm.data.materials.append(mat_polo)
    parts.append(right_arm)

    hand_radius = 0.015
    hand_z = arm_z - arm_height * 0.3 - arm_height / 2 - hand_radius

    left_hand = create_sphere("LeftHand", hand_radius, (-arm_x_offset, 0, hand_z), segments=8)
    left_hand.data.materials.append(mat_skin)
    parts.append(left_hand)

    right_hand = create_sphere("RightHand", hand_radius, (arm_x_offset, 0, hand_z), segments=8)
    right_hand.data.materials.append(mat_skin)
    parts.append(right_hand)

    head_radius = 0.055
    head_z = leg_height + torso_height + head_radius * 0.9

    head = create_sphere("Head", head_radius, (0, 0, head_z), segments=12)
    head.data.materials.append(mat_skin)
    parts.append(head)

    shoe_height = 0.03
    shoe_length = 0.055
    shoe_width = 0.035
    shoe_z = shoe_height / 2

    bpy.ops.mesh.primitive_cube_add(size=1, location=(-leg_x_offset, 0.008, shoe_z))
    left_shoe = bpy.context.active_object
    left_shoe.name = "LeftShoe"
    left_shoe.scale = (shoe_width, shoe_length, shoe_height)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    left_shoe.data.materials.append(mat_shoes)
    parts.append(left_shoe)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(leg_x_offset, 0.008, shoe_z))
    right_shoe = bpy.context.active_object
    right_shoe.name = "RightShoe"
    right_shoe.scale = (shoe_width, shoe_length, shoe_height)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    right_shoe.data.materials.append(mat_shoes)
    parts.append(right_shoe)

    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()

    character = bpy.context.active_object
    character.name = "Greenkeeper"

    set_origin_to_base(character)
    character.location = (0, 0, 0)

    total_polys = len(character.data.polygons)
    print(f"\nGenerated character with {total_polys} polygons")

    success = export_asset(ctx, validate=True, force=False)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print(f"\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
