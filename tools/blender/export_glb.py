"""
Blender GLB Export Script for Greenkeeper Simulator

Run from Blender's Text Editor or command line:
  blender model.blend --background --python export_glb.py -- output.glb

Export settings optimized for:
- Babylon.js loading
- Isometric 3D game (1 Blender unit = 1 game tile)
- Low-poly stylized aesthetic
"""

import bpy
import sys
import os

# ============================================================
# EXPORT SETTINGS - Tune these for the project
# ============================================================

EXPORT_SETTINGS = {
    # Format
    "export_format": "GLB",  # Binary GLTF (single file)

    # Transform
    "export_yup": True,       # Y-up for Babylon.js
    "export_apply": True,     # Apply modifiers

    # Geometry
    "export_normals": True,
    "export_tangents": False,  # Not needed for flat shading
    "export_colors": True,     # Vertex colors for simple shading

    # Animation
    "export_animations": True,
    "export_frame_range": True,
    "export_nla_strips": True,
    "export_optimize_animation_size": True,

    # Materials
    "export_materials": "EXPORT",
    "export_image_format": "AUTO",

    # Mesh
    "export_texcoords": True,
    "export_draco_mesh_compression_enable": False,  # Keep simple

    # Armature
    "export_skins": True,
    "export_all_influences": False,
    "export_def_bones": True,
}


def get_output_path():
    """Get output path from command line args or use default"""
    argv = sys.argv
    if "--" in argv:
        args = argv[argv.index("--") + 1:]
        if args:
            return args[0]

    # Default: same name as blend file
    blend_path = bpy.data.filepath
    if blend_path:
        return os.path.splitext(blend_path)[0] + ".glb"
    return "//export.glb"


def prepare_scene():
    """Prepare scene for export"""
    # Ensure we're in object mode
    if bpy.context.active_object and bpy.context.active_object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')

    # Select all exportable objects
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.context.scene.objects:
        if obj.type in {'MESH', 'ARMATURE', 'EMPTY'}:
            obj.select_set(True)


def setup_materials_for_game():
    """Convert materials to game-friendly settings"""
    for mat in bpy.data.materials:
        if mat.use_nodes:
            # Find Principled BSDF
            for node in mat.node_tree.nodes:
                if node.type == 'BSDF_PRINCIPLED':
                    # Flatten for stylized look
                    node.inputs['Roughness'].default_value = 1.0
                    node.inputs['Metallic'].default_value = 0.0
                    node.inputs['Specular IOR Level'].default_value = 0.0


def export_glb(output_path):
    """Export scene to GLB"""
    print(f"Exporting to: {output_path}")

    bpy.ops.export_scene.gltf(
        filepath=output_path,
        **EXPORT_SETTINGS
    )

    print(f"Export complete: {output_path}")


def main():
    output_path = get_output_path()
    prepare_scene()
    setup_materials_for_game()
    export_glb(output_path)


if __name__ == "__main__":
    main()
