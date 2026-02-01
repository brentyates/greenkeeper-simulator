"""
Nature/vegetation utilities for procedural asset generation.

Provides helpers for creating trees, shrubs, and other natural elements.
"""

import bpy
import bmesh
import math
import random
from mathutils import Vector, Matrix

from .geometry import create_cylinder, create_cone, join_objects, set_origin_to_base
from .materials import create_solid_material, get_color


def create_simple_trunk(
    height: float,
    base_radius: float,
    top_radius: float = None,
    segments: int = 8,
    material_color: tuple = None
) -> bpy.types.Object:
    """
    Create a tapered tree trunk.

    Args:
        height: Trunk height
        base_radius: Radius at bottom
        top_radius: Radius at top (default: base_radius * 0.6)
        segments: Number of sides
        material_color: RGB color tuple

    Returns:
        Trunk mesh object.
    """
    if top_radius is None:
        top_radius = base_radius * 0.6

    # Create tapered cylinder
    bpy.ops.mesh.primitive_cone_add(
        radius1=base_radius,
        radius2=top_radius,
        depth=height,
        vertices=segments,
        location=(0, 0, height / 2)
    )
    trunk = bpy.context.active_object
    trunk.name = "Trunk"

    # Apply material
    if material_color is None:
        material_color = get_color("tree_bark_dark")

    mat = create_solid_material("TrunkMaterial", material_color)
    trunk.data.materials.append(mat)

    return trunk


def create_conical_foliage(
    height: float,
    base_radius: float,
    layers: int = 3,
    layer_overlap: float = 0.3,
    material_color: tuple = None,
    start_z: float = 0
) -> list[bpy.types.Object]:
    """
    Create layered conical foliage (pine tree style).

    Args:
        height: Total foliage height
        base_radius: Radius of bottom layer
        layers: Number of cone layers
        layer_overlap: How much layers overlap (0-1)
        material_color: RGB color tuple
        start_z: Z position to start foliage

    Returns:
        List of foliage mesh objects.
    """
    if material_color is None:
        material_color = get_color("pine_needles")

    mat = create_solid_material("FoliageMaterial", material_color)

    cones = []
    layer_height = height / layers * (1 + layer_overlap)

    for i in range(layers):
        # Each layer is smaller as we go up
        scale = 1.0 - (i * 0.25)
        radius = base_radius * scale
        z_pos = start_z + (height / layers) * i

        bpy.ops.mesh.primitive_cone_add(
            radius1=radius,
            radius2=0,
            depth=layer_height,
            vertices=8,
            location=(0, 0, z_pos + layer_height / 2)
        )
        cone = bpy.context.active_object
        cone.name = f"Foliage_{i}"
        cone.data.materials.append(mat)
        cones.append(cone)

    return cones


def create_spherical_foliage(
    radius: float,
    center_z: float,
    segments: int = 2,
    material_color: tuple = None
) -> bpy.types.Object:
    """
    Create spherical foliage (deciduous tree style).

    Args:
        radius: Foliage radius
        center_z: Z position of sphere center
        segments: Subdivision level (1-3)
        material_color: RGB color tuple

    Returns:
        Foliage mesh object.
    """
    if material_color is None:
        material_color = get_color("leaves_green")

    bpy.ops.mesh.primitive_ico_sphere_add(
        radius=radius,
        subdivisions=segments,
        location=(0, 0, center_z)
    )
    foliage = bpy.context.active_object
    foliage.name = "Foliage"

    mat = create_solid_material("FoliageMaterial", material_color)
    foliage.data.materials.append(mat)

    return foliage


def create_simple_pine(
    total_height: float,
    trunk_ratio: float = 0.3,
    base_radius: float = None,
    seed: int = 0
) -> bpy.types.Object:
    """
    Create a simple low-poly pine tree.

    Args:
        total_height: Total tree height
        trunk_ratio: Proportion of height that is trunk (0-1)
        base_radius: Foliage base radius (default: height * 0.3)
        seed: Random seed for variation

    Returns:
        Combined tree object.
    """
    random.seed(seed)

    if base_radius is None:
        base_radius = total_height * 0.3

    trunk_height = total_height * trunk_ratio
    foliage_height = total_height * (1 - trunk_ratio)

    # Create trunk
    trunk = create_simple_trunk(
        height=trunk_height,
        base_radius=base_radius * 0.15,
        top_radius=base_radius * 0.08
    )

    # Create foliage layers
    foliage_parts = create_conical_foliage(
        height=foliage_height,
        base_radius=base_radius,
        layers=3,
        start_z=trunk_height * 0.7
    )

    # Join all parts
    all_parts = [trunk] + foliage_parts
    tree = join_objects(all_parts, "Pine")

    set_origin_to_base(tree)

    return tree


def create_simple_deciduous(
    total_height: float,
    trunk_ratio: float = 0.4,
    crown_radius: float = None,
    seed: int = 0
) -> bpy.types.Object:
    """
    Create a simple low-poly deciduous tree.

    Args:
        total_height: Total tree height
        trunk_ratio: Proportion of height that is trunk (0-1)
        crown_radius: Foliage radius (default: height * 0.35)
        seed: Random seed for variation

    Returns:
        Combined tree object.
    """
    random.seed(seed)

    if crown_radius is None:
        crown_radius = total_height * 0.35

    trunk_height = total_height * trunk_ratio

    # Create trunk
    trunk = create_simple_trunk(
        height=trunk_height * 1.2,  # Trunk extends into crown
        base_radius=total_height * 0.05,
        top_radius=total_height * 0.02,
        material_color=get_color("tree_bark_light")
    )

    # Create crown
    crown_center_z = trunk_height + crown_radius * 0.5
    crown = create_spherical_foliage(
        radius=crown_radius,
        center_z=crown_center_z
    )

    # Join
    tree = join_objects([trunk, crown], "Deciduous")
    set_origin_to_base(tree)

    return tree


def create_shrub(
    height: float,
    width: float = None,
    material_color: tuple = None,
    seed: int = 0
) -> bpy.types.Object:
    """
    Create a simple low-poly shrub.

    Args:
        height: Shrub height
        width: Shrub width (default: height * 1.2)
        material_color: RGB color tuple
        seed: Random seed for variation

    Returns:
        Shrub mesh object.
    """
    random.seed(seed)

    if width is None:
        width = height * 1.2

    if material_color is None:
        material_color = get_color("leaves_green")

    # Create flattened sphere
    bpy.ops.mesh.primitive_ico_sphere_add(
        radius=1,
        subdivisions=2,
        location=(0, 0, height * 0.5)
    )
    shrub = bpy.context.active_object
    shrub.name = "Shrub"
    shrub.scale = (width / 2, width / 2, height / 2)

    # Apply scale
    bpy.context.view_layer.objects.active = shrub
    bpy.ops.object.transform_apply(scale=True)

    # Add slight randomization for organic look
    mesh = shrub.data
    for vert in mesh.vertices:
        offset = random.uniform(-0.1, 0.1) * height
        vert.co.z += offset * (1 - abs(vert.co.z) / (height / 2))

    mesh.update()

    mat = create_solid_material("ShrubMaterial", material_color)
    shrub.data.materials.append(mat)

    set_origin_to_base(shrub)

    return shrub
