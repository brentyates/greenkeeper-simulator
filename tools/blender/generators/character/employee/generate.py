"""
Procedural generator for character.employee asset.

Run with:
    blender --background --python tools/blender/generators/character/employee/generate.py
"""

import bpy
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if GENERATORS_DIR not in sys.path:
    sys.path.insert(0, GENERATORS_DIR)

from _common.context import setup_asset_context, export_asset
from _common.geometry import set_origin_to_base, join_objects
from _common.materials import create_solid_material

ASSET_ID = "character.employee"

COLORS = {
    "shirt": (0.5, 0.4, 0.3),
    "pants": (0.35, 0.25, 0.15),
    "skin": (0.85, 0.7, 0.6),
    "shoes": (0.2, 0.15, 0.1),
}


def create_sphere(name: str, radius: float, location: tuple, segments: int = 12) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=radius,
        segments=segments,
        ring_count=segments // 2,
        location=location
    )
    obj = bpy.context.active_object
    obj.name = name
    return obj


def create_cylinder(name: str, radius: float, height: float, location: tuple, segments: int = 8) -> bpy.types.Object:
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

    mat_shirt = create_solid_material("Shirt", COLORS["shirt"])
    mat_pants = create_solid_material("Pants", COLORS["pants"])
    mat_skin = create_solid_material("Skin", COLORS["skin"])
    mat_shoes = create_solid_material("Shoes", COLORS["shoes"])

    # Scale factor: ~0.36 to go from 1.8m to 0.65m
    head_radius = 0.044
    torso_height = 0.20
    torso_radius = 0.055
    leg_height = 0.31
    leg_radius = 0.025
    arm_height = 0.20
    arm_radius = 0.018
    foot_height = 0.036

    feet_base = 0.0
    legs_base = feet_base + foot_height
    legs_center = legs_base + leg_height / 2
    torso_base = legs_base + leg_height
    torso_center = torso_base + torso_height / 2
    neck_top = torso_base + torso_height
    head_center = neck_top + head_radius * 0.8

    parts = []

    head = create_sphere("Head", head_radius, (0, 0, head_center), segments=10)
    head.data.materials.append(mat_skin)
    parts.append(head)

    torso = create_cylinder("Torso", torso_radius, torso_height, (0, 0, torso_center), segments=10)
    torso.data.materials.append(mat_shirt)
    parts.append(torso)

    arm_offset_x = torso_radius + arm_radius
    arm_center_z = torso_center + 0.018

    left_arm = create_cylinder("LeftArm", arm_radius, arm_height, (-arm_offset_x, 0, arm_center_z), segments=6)
    left_arm.data.materials.append(mat_shirt)
    parts.append(left_arm)

    right_arm = create_cylinder("RightArm", arm_radius, arm_height, (arm_offset_x, 0, arm_center_z), segments=6)
    right_arm.data.materials.append(mat_shirt)
    parts.append(right_arm)

    leg_offset_x = 0.03

    left_leg = create_cylinder("LeftLeg", leg_radius, leg_height, (-leg_offset_x, 0, legs_center), segments=6)
    left_leg.data.materials.append(mat_pants)
    parts.append(left_leg)

    right_leg = create_cylinder("RightLeg", leg_radius, leg_height, (leg_offset_x, 0, legs_center), segments=6)
    right_leg.data.materials.append(mat_pants)
    parts.append(right_leg)

    shoe_length = 0.044
    shoe_width = 0.03
    shoe_height = foot_height

    for side, x_offset in [("Left", -leg_offset_x), ("Right", leg_offset_x)]:
        bpy.ops.mesh.primitive_cube_add(
            size=1,
            location=(x_offset, 0.007, shoe_height / 2)
        )
        shoe = bpy.context.active_object
        shoe.name = f"{side}Shoe"
        shoe.scale = (shoe_width, shoe_length, shoe_height)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        shoe.data.materials.append(mat_shoes)
        parts.append(shoe)

    employee = join_objects(parts, "Employee")

    set_origin_to_base(employee)

    poly_count = len(employee.data.polygons)
    print(f"\nGenerated mesh with {poly_count} polygons")

    success = export_asset(ctx, validate=True, force=False)

    if success:
        print(f"\nSuccess! Asset exported to: {ctx['output_path']}")
    else:
        print(f"\nFailed to export asset")
        sys.exit(1)


if __name__ == "__main__":
    generate()
