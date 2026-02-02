"""
Create Reference Scene for Greenkeeper Simulator Assets

Run in Blender to set up a standardized modeling environment:
  blender --python create_reference_scene.py

Creates:
- Grid floor showing tile boundaries
- Character height reference (1.8 units)
- Scale markers at key heights
- Camera set up for isometric preview
"""

import bpy
import math
from mathutils import Vector

# =============================================================================
# CONSTANTS (must match game)
# =============================================================================
TILE_SIZE = 1.0
CHARACTER_HEIGHT = 1.8
CAMERA_ANGLE = math.radians(60)  # 60° from vertical (matches game)


def clear_scene():
    """Remove default objects."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()


def create_grid_floor(tiles=5):
    """Create a grid showing tile boundaries."""
    # Ground plane
    bpy.ops.mesh.primitive_plane_add(size=tiles * TILE_SIZE)
    ground = bpy.context.active_object
    ground.name = "REF_Ground"

    # Grid material
    mat = bpy.data.materials.new("GridMaterial")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    # Clear default nodes
    nodes.clear()

    # Create checker pattern
    output = nodes.new('ShaderNodeOutputMaterial')
    principled = nodes.new('ShaderNodeBsdfPrincipled')
    checker = nodes.new('ShaderNodeTexChecker')
    mapping = nodes.new('ShaderNodeMapping')
    texcoord = nodes.new('ShaderNodeTexCoord')

    # Configure checker for 1-unit tiles
    checker.inputs['Scale'].default_value = tiles
    checker.inputs['Color1'].default_value = (0.3, 0.5, 0.3, 1)  # Grass green
    checker.inputs['Color2'].default_value = (0.25, 0.45, 0.25, 1)  # Darker green

    # Connect nodes
    links.new(texcoord.outputs['UV'], mapping.inputs['Vector'])
    links.new(mapping.outputs['Vector'], checker.inputs['Vector'])
    links.new(checker.outputs['Color'], principled.inputs['Base Color'])
    links.new(principled.outputs['BSDF'], output.inputs['Surface'])

    ground.data.materials.append(mat)

    # Lock ground from selection (it's just reference)
    ground.hide_select = True

    return ground


def create_height_reference():
    """Create a character-height reference silhouette."""
    # Simple capsule-ish shape representing a person
    bpy.ops.mesh.primitive_cylinder_add(
        radius=0.2,
        depth=CHARACTER_HEIGHT * 0.7,
        location=(2, 0, CHARACTER_HEIGHT * 0.35)
    )
    body = bpy.context.active_object

    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=0.2,
        location=(2, 0, CHARACTER_HEIGHT * 0.85)
    )
    head = bpy.context.active_object

    # Join into one object
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    head.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()

    ref = bpy.context.active_object
    ref.name = "REF_CharacterHeight"

    # Semi-transparent blue material
    mat = bpy.data.materials.new("RefCharacterMat")
    mat.use_nodes = True
    mat.blend_method = 'BLEND'
    principled = mat.node_tree.nodes["Principled BSDF"]
    principled.inputs['Base Color'].default_value = (0.2, 0.4, 0.8, 1)
    principled.inputs['Alpha'].default_value = 0.3
    ref.data.materials.append(mat)

    ref.hide_select = True
    return ref


def create_height_markers():
    """Create height markers at key intervals."""
    heights = [
        (0.5, "0.5m - Shrub"),
        (1.0, "1.0m - Waist"),
        (CHARACTER_HEIGHT, f"{CHARACTER_HEIGHT}m - Person"),
        (3.0, "3.0m - Small Tree"),
        (5.0, "5.0m - Medium Tree"),
        (8.0, "8.0m - Large Tree"),
    ]

    markers = []
    for height, label in heights:
        # Create text
        bpy.ops.object.text_add(location=(-2.5, 0, height))
        text = bpy.context.active_object
        text.data.body = label
        text.data.size = 0.15
        text.name = f"REF_Marker_{height}m"
        text.rotation_euler = (math.pi / 2, 0, 0)

        # Create horizontal line
        bpy.ops.mesh.primitive_plane_add(
            size=0.1,
            location=(-2, 0, height)
        )
        line = bpy.context.active_object
        line.scale = (10, 0.01, 1)
        line.name = f"REF_Line_{height}m"

        # Dashed line material
        mat = bpy.data.materials.new(f"LineMat_{height}")
        mat.use_nodes = True
        principled = mat.node_tree.nodes["Principled BSDF"]
        principled.inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1)
        line.data.materials.append(mat)

        text.hide_select = True
        line.hide_select = True
        markers.extend([text, line])

    return markers


def create_tile_markers():
    """Create 1x1 tile boundary markers on the ground."""
    for x in range(-2, 3):
        for y in range(-2, 3):
            if x == 0 and y == 0:
                continue  # Skip center (where asset goes)

            bpy.ops.object.empty_add(
                type='PLAIN_AXES',
                location=(x * TILE_SIZE, y * TILE_SIZE, 0.01),
                radius=0.1
            )
            marker = bpy.context.active_object
            marker.name = f"REF_Tile_{x}_{y}"
            marker.hide_select = True


def create_origin_marker():
    """Create a prominent marker at the world origin."""
    bpy.ops.object.empty_add(
        type='ARROWS',
        location=(0, 0, 0),
        radius=0.5
    )
    origin = bpy.context.active_object
    origin.name = "REF_Origin"
    origin.show_name = True
    origin.hide_select = True


def setup_camera():
    """Set up isometric camera matching game view."""
    bpy.ops.object.camera_add(
        location=(10, -10, 10)
    )
    camera = bpy.context.active_object
    camera.name = "IsometricCamera"

    # Point at origin
    camera.rotation_euler = (
        math.radians(60),  # Pitch (matches game's 60° from vertical)
        0,
        math.radians(45)   # Yaw (45° for isometric)
    )

    # Make orthographic
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 8

    bpy.context.scene.camera = camera


def setup_lighting():
    """Set up lighting similar to game."""
    # Sun light
    bpy.ops.object.light_add(
        type='SUN',
        location=(5, -5, 10)
    )
    sun = bpy.context.active_object
    sun.name = "Sun"
    sun.data.energy = 3
    sun.data.color = (1.0, 0.95, 0.8)  # Warm sunlight
    sun.rotation_euler = (math.radians(45), math.radians(30), 0)

    # Ambient fill (hemisphere approximation)
    bpy.ops.object.light_add(
        type='SUN',
        location=(-5, 5, 5)
    )
    fill = bpy.context.active_object
    fill.name = "FillLight"
    fill.data.energy = 0.5
    fill.data.color = (0.8, 0.9, 1.0)  # Cool fill


def create_working_collection():
    """Create a collection for user's work, separate from references."""
    work_collection = bpy.data.collections.new("ASSETS")
    bpy.context.scene.collection.children.link(work_collection)

    # Create reference collection
    ref_collection = bpy.data.collections.new("REFERENCE")
    bpy.context.scene.collection.children.link(ref_collection)

    # Move all REF_ objects to reference collection
    for obj in bpy.data.objects:
        if obj.name.startswith("REF_"):
            for coll in obj.users_collection:
                coll.objects.unlink(obj)
            ref_collection.objects.link(obj)

    # Make ASSETS the active collection
    layer_collection = bpy.context.view_layer.layer_collection
    for child in layer_collection.children:
        if child.name == "ASSETS":
            bpy.context.view_layer.active_layer_collection = child
            break


def setup_scene_settings():
    """Configure scene settings for asset work."""
    scene = bpy.context.scene

    # Set units to meters
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = 'METERS'

    # Set up grid
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.overlay.grid_scale = 1.0
                    space.clip_end = 100


def main():
    print("Creating Greenkeeper Simulator reference scene...")

    clear_scene()
    create_grid_floor()
    create_height_reference()
    create_height_markers()
    create_tile_markers()
    create_origin_marker()
    setup_camera()
    setup_lighting()
    setup_scene_settings()
    create_working_collection()

    print("Reference scene created!")
    print("")
    print("Instructions:")
    print("1. Create your asset in the ASSETS collection")
    print("2. Place origin at base center (or as specified)")
    print("3. Use the character reference for scale")
    print("4. Export with: blender file.blend --background --python export_glb.py")
    print("")
    print(f"Key measurements:")
    print(f"  - 1 tile = {TILE_SIZE} unit")
    print(f"  - Character height = {CHARACTER_HEIGHT} units")


if __name__ == "__main__":
    main()
