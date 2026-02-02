"""
Common geometry utilities for procedural asset generation.

Provides helpers for creating and manipulating meshes.
"""

import bpy
import bmesh
import math
from mathutils import Vector, Matrix


def create_mesh_object(name: str, verts: list, faces: list) -> bpy.types.Object:
    """
    Create a mesh object from vertices and faces.

    Args:
        name: Object name
        verts: List of (x, y, z) vertex coordinates
        faces: List of face vertex indices

    Returns:
        The created object.
    """
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    return obj


def set_origin_to_base(obj: bpy.types.Object):
    """Move object origin to the bottom center of its bounding box."""
    # Get bounds in local space
    bbox = obj.bound_box
    min_z = min(v[2] for v in bbox)
    center_x = sum(v[0] for v in bbox) / 8
    center_y = sum(v[1] for v in bbox) / 8

    # Calculate offset
    offset = Vector((center_x, center_y, min_z))

    # Move mesh data
    obj.data.transform(Matrix.Translation(-offset))

    # Move object location
    obj.location += offset


def apply_transforms(obj: bpy.types.Object):
    """Apply all transforms to the object."""
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)


def join_objects(objects: list[bpy.types.Object], name: str = None) -> bpy.types.Object:
    """
    Join multiple objects into one.

    Args:
        objects: List of objects to join
        name: Optional name for resulting object

    Returns:
        The joined object.
    """
    if not objects:
        return None

    bpy.ops.object.select_all(action='DESELECT')

    for obj in objects:
        obj.select_set(True)

    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()

    result = bpy.context.active_object
    if name:
        result.name = name

    return result


def add_subdivision(obj: bpy.types.Object, levels: int = 1, apply: bool = True):
    """Add subdivision surface modifier."""
    mod = obj.modifiers.new("Subdivision", 'SUBSURF')
    mod.levels = levels
    mod.render_levels = levels

    if apply:
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)


def add_smooth_shading(obj: bpy.types.Object, angle: float = 30):
    """
    Apply smooth shading with auto-smooth normals.

    Args:
        obj: Object to smooth
        angle: Auto-smooth angle in degrees
    """
    if obj.type != 'MESH':
        return

    # Enable smooth shading
    for poly in obj.data.polygons:
        poly.use_smooth = True

    # Enable auto-smooth
    obj.data.use_auto_smooth = True
    obj.data.auto_smooth_angle = math.radians(angle)


def create_cylinder(
    name: str,
    radius: float,
    height: float,
    segments: int = 12,
    location: tuple = (0, 0, 0)
) -> bpy.types.Object:
    """Create a cylinder with origin at base center."""
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius,
        depth=height,
        vertices=segments,
        location=(location[0], location[1], location[2] + height / 2)
    )
    obj = bpy.context.active_object
    obj.name = name

    # Move origin to base
    set_origin_to_base(obj)
    obj.location = location

    return obj


def create_cone(
    name: str,
    radius: float,
    height: float,
    segments: int = 12,
    location: tuple = (0, 0, 0)
) -> bpy.types.Object:
    """Create a cone with origin at base center."""
    bpy.ops.mesh.primitive_cone_add(
        radius1=radius,
        radius2=0,
        depth=height,
        vertices=segments,
        location=(location[0], location[1], location[2] + height / 2)
    )
    obj = bpy.context.active_object
    obj.name = name

    # Move origin to base
    set_origin_to_base(obj)
    obj.location = location

    return obj


def create_box(
    name: str,
    width: float,
    depth: float,
    height: float,
    location: tuple = (0, 0, 0)
) -> bpy.types.Object:
    """Create a box with origin at base center."""
    bpy.ops.mesh.primitive_cube_add(
        size=1,
        location=(location[0], location[1], location[2] + height / 2)
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (width, depth, height)

    apply_transforms(obj)
    set_origin_to_base(obj)
    obj.location = location

    return obj


def randomize_vertices(obj: bpy.types.Object, amount: float, seed: int = 0):
    """
    Add random displacement to vertices.

    Args:
        obj: Mesh object
        amount: Maximum displacement distance
        seed: Random seed for reproducibility
    """
    import random
    random.seed(seed)

    if obj.type != 'MESH':
        return

    mesh = obj.data
    for vert in mesh.vertices:
        offset = Vector((
            random.uniform(-amount, amount),
            random.uniform(-amount, amount),
            random.uniform(-amount, amount)
        ))
        vert.co += offset

    mesh.update()
